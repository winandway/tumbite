import { Hono } from 'hono';
import { z } from 'zod';
import {
  RADIO_LLEGADA_M,
  distanciaKm,
  metrosEntre,
  minutosDeViaje,
  requisitosDestacado,
  resumenAnual,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { AVISOS, notificar } from '../notificaciones';
import { anotarEvento } from '../manager';

/**
 * La app del repartidor «como los grandes» (18 oct 2026, C-REPARTIDOR-GRANDES). Ficha:
 * docs/investigaciones-rea/2026-10-18-repartidor.md. Lo que Dasher y Uber Driver muestran y aquí
 * faltaba: calificaciones visibles, ganancias con desglose por pedido, campana con avisos reales,
 * pausa sin desconectarse, «llegué al restaurante» y «el pedido no está listo».
 * Los mínimos de referencia (4,2 estrellas, 90 % de finalización) se muestran como guía; nadie se
 * desactiva por ellos: esa es una decisión de negocio que no se ha tomado.
 */
export const repartidorGrandes = new Hono<{ Bindings: Env; Variables: Variables }>();

const ULTIMAS = 100;
const MINIMO_ESTRELLAS = 4.2;
const MINIMO_FINALIZACION = 90;
/** Margen de la hora «a más tardar» (la misma fórmula que ve el cliente en su pedido). */
const MARGEN_MIN = 10;

const pct = (parte: number, de: number) => (de ? Math.round((parte / de) * 100) : null);

/** Las métricas del repartidor (las mismas que ve en Calificaciones). */
export async function metricasRepartidor(db: D1Database, repartidorId: string) {
  const u = { id: repartidorId };
  const estrellas = await db
    .prepare(
      `SELECT e, culpa FROM (
         SELECT c.estrellas_repartidor AS e, c.culpa_restaurante AS culpa, c.creado_en FROM calificaciones c
           JOIN pedidos p ON p.id = c.pedido_id
          WHERE p.repartidor_id = ?1 AND c.estrellas_repartidor IS NOT NULL
         -- Divoox Moto · M8: las de los pasajeros cuentan igual que las de Comida.
         UNION ALL
         SELECT k.estrellas, 0, k.creado_en FROM calificaciones_viaje k
           JOIN operaciones o ON o.id = k.operacion_id
          WHERE o.conductor_id = ?1 AND k.de = 'pasajero')
        ORDER BY creado_en DESC LIMIT ${ULTIMAS}`,
    )
    .bind(u.id)
    .all<{ e: number; culpa: number | null }>();
  // F18: si el cliente marcó que la mala nota fue culpa del restaurante, no le cuenta al repartidor
  // (lo que prometen Docs y la web).
  const cuentan = estrellas.results.filter((x) => !x.culpa);
  const excluidas = estrellas.results.length - cuentan.length;
  const cuantas = cuentan.length;
  const promedio = cuantas
    ? Math.round((cuentan.reduce((s, x) => s + x.e, 0) / cuantas) * 10) / 10
    : null;

  // Aceptación: las últimas 100 ofertas respondidas (vencer cuenta como rechazo, como en Dasher).
  const ofertas = await db
    .prepare(
      `SELECT o.estado, EXISTS (SELECT 1 FROM abandonos_repartidor a WHERE a.pedido_id = o.pedido_id AND a.repartidor_id = o.repartidor_id) AS abandonada
         FROM ofertas o WHERE o.repartidor_id = ? AND o.estado IN ('aceptada','rechazada','vencida')
        ORDER BY o.creada_en DESC LIMIT ${ULTIMAS}`,
    )
    .bind(u.id)
    .all<{ estado: string; abandonada: number }>();
  const aceptadas = ofertas.results.filter((o) => o.estado === 'aceptada' || o.abandonada).length;

  // Finalización: de lo aceptado, lo entregado frente a lo soltado o perdido.
  const entregados = await db
    .prepare(
      `SELECT p.id, p.aceptado_en, p.entregado_en, p.tiempo_prep_min, p.distancia_km FROM pedidos p
        WHERE p.repartidor_id = ? AND p.estado = 'entregado' ORDER BY p.entregado_en DESC LIMIT ${ULTIMAS}`,
    )
    .bind(u.id)
    .all<{
      id: string;
      aceptado_en: string | null;
      entregado_en: string;
      tiempo_prep_min: number | null;
      distancia_km: number | null;
    }>();
  const abandonos = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (SELECT 1 FROM abandonos_repartidor WHERE repartidor_id = ? ORDER BY creado_en DESC LIMIT ${ULTIMAS})`,
    )
    .bind(u.id)
    .first<{ n: number }>();
  const nEntregados = entregados.results.length;
  const nAbandonos = Number(abandonos?.n ?? 0);

  // Puntualidad: entregado antes de la hora «a más tardar» fijada al aceptar.
  const ms = (t: string | null) => (t ? new Date(`${t.replace(' ', 'T')}Z`).getTime() : null);
  const puntuales = entregados.results.filter((p) => {
    const a = ms(p.aceptado_en);
    const e = ms(p.entregado_en);
    if (a == null || e == null) return true;
    const limite =
      (Number(p.tiempo_prep_min ?? 20) + minutosDeViaje(Number(p.distancia_km ?? 3)) + MARGEN_MIN) *
      60_000;
    return e - a <= limite;
  }).length;

  const [treinta, totales] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM pedidos WHERE repartidor_id = ? AND estado = 'entregado' AND entregado_en > datetime('now','-30 days')",
      )
      .bind(u.id)
      .first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM pedidos WHERE repartidor_id = ? AND estado = 'entregado'")
      .bind(u.id)
      .first<{ n: number }>(),
  ]);
  return {
    clientes: { promedio, cuantas, excluidas, minimo: MINIMO_ESTRELLAS },
    aceptacion: { porcentaje: pct(aceptadas, ofertas.results.length), de: ofertas.results.length },
    finalizacion: {
      porcentaje: pct(nEntregados, nEntregados + nAbandonos),
      de: nEntregados + nAbandonos,
      minimo: MINIMO_FINALIZACION,
    },
    puntualidad: { porcentaje: pct(puntuales, nEntregados), de: nEntregados },
    entregas30Dias: Number(treinta?.n ?? 0),
    entregasTotales: Number(totales?.n ?? 0),
  };
}

/** C-REPARTIDOR-DESTACADO: revisa los requisitos y guarda si es destacado (lo lee el despacho). */
export async function evaluarDestacado(db: D1Database, repartidorId: string) {
  const m = await metricasRepartidor(db, repartidorId);
  const r = requisitosDestacado({
    estrellas: m.clientes.promedio,
    aceptacion: m.aceptacion.porcentaje,
    finalizacion: m.finalizacion.porcentaje,
    entregas30Dias: m.entregas30Dias,
    entregasTotales: m.entregasTotales,
  });
  await db
    .prepare('UPDATE repartidores SET destacado = ? WHERE usuario_id = ?')
    .bind(r.destacado ? 1 : 0, repartidorId)
    .run();
  return { metricas: m, ...r };
}

repartidorGrandes.get('/repartidor/calificaciones', async (c) => {
  const u = exigir(c, 'repartidor');
  const { metricas, destacado, requisitos } = await evaluarDestacado(base(c), u.id);
  return c.json({ ...metricas, destacado, requisitos });
});

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
repartidorGrandes.get('/repartidor/ganancias', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const q = z.object({ desde: fecha.optional(), hasta: fecha.optional() }).safeParse(c.req.query());
  const desde = q.success && q.data.desde ? `${q.data.desde} 00:00:00` : null;
  const hasta = q.success && q.data.hasta ? `${q.data.hasta} 23:59:59` : null;
  const { results } = await db
    .prepare(
      `SELECT p.id, p.entregado_en, p.envio, p.complemento, p.propina, p.pago_repartidor, p.moneda, p.metodo_pago, r.nombre AS restaurante,
              COALESCE((SELECT centavos FROM bonos_pedido b WHERE b.pedido_id = p.id), 0) AS bono,
              COALESCE((SELECT SUM(m.monto) FROM movimientos m WHERE m.usuario_id = p.repartidor_id AND m.concepto = 'ajuste' AND m.referencia = 'propina-extra-' || p.id), 0) AS propina_posterior
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.repartidor_id = ? AND p.estado = 'entregado'
          AND (? IS NULL OR p.entregado_en >= ?) AND (? IS NULL OR p.entregado_en <= ?)
        ORDER BY p.entregado_en DESC LIMIT 500`,
    )
    .bind(u.id, desde, desde, hasta, hasta)
    .all<{
      id: string;
      entregado_en: string;
      envio: number;
      complemento: number;
      propina: number;
      pago_repartidor: number;
      moneda: string | null;
      metodo_pago: string | null;
      restaurante: string;
      bono: number;
      propina_posterior: number;
    }>();
  const pedidos = results.map((p) => {
    const base = Number(p.envio) + Number(p.complemento);
    const bono = Number(p.bono);
    const propina = Number(p.propina);
    const propinaPosterior = Number(p.propina_posterior);
    return {
      pedidoId: p.id,
      codigo: p.id.slice(0, 4).toUpperCase(),
      restaurante: p.restaurante,
      entregadoEn: p.entregado_en,
      // C-MONEDA-RECORRIDO: cada pedido en su moneda.
      moneda: p.moneda ?? 'USD',
      // Cobrado en mano: no pasa por la billetera de Stripe; «Hoy» lo suma desde aquí.
      cobradoEnMano: (p.metodo_pago ?? 'tarjeta') !== 'tarjeta',
      base,
      bono,
      propina,
      propinaPosterior,
      total: base + bono + propina + propinaPosterior,
    };
  });
  // C-MONEDA-RECORRIDO: los totales se suman por moneda, nunca mezclando (dólares primero).
  const sumar = (lista: typeof pedidos) =>
    lista.reduce(
      (acc, p) => ({
        entregas: acc.entregas + 1,
        base: acc.base + p.base,
        bonos: acc.bonos + p.bono,
        propinas: acc.propinas + p.propina + p.propinaPosterior,
        total: acc.total + p.total,
      }),
      { entregas: 0, base: 0, bonos: 0, propinas: 0, total: 0 },
    );
  const monedas = [...new Set(pedidos.map((p) => p.moneda))].sort((a, b) =>
    a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b),
  );
  const totalesPorMoneda = monedas.map((m) => ({
    moneda: m,
    ...sumar(pedidos.filter((p) => p.moneda === m)),
  }));
  // «totales» queda en la primera moneda (en EE. UU., los dólares de siempre); sin pedidos, ceros.
  const primera = monedas[0];
  const totales = sumar(primera ? pedidos.filter((p) => p.moneda === primera) : []);
  return c.json({ pedidos, totales, totalesPorMoneda });
});

/**
 * C-RESUMEN-ANUAL: el año del repartidor por mes (entregas, distancia estimada y lo ganado por moneda),
 * con la misma cuenta que «Ganancias» (pago base + bono + propina + propina después de entregar).
 */
repartidorGrandes.get('/repartidor/resumen-anual', async (c) => {
  const u = exigir(c, 'repartidor');
  const q = z
    .object({ anio: z.coerce.number().int().min(2025).max(2100).optional() })
    .safeParse(c.req.query());
  const anio = (q.success && q.data.anio) || new Date().getUTCFullYear();
  const { results } = await base(c)
    .prepare(
      `SELECT p.entregado_en, p.distancia_km, p.moneda,
              p.envio + p.complemento + p.propina
                + COALESCE((SELECT centavos FROM bonos_pedido b WHERE b.pedido_id = p.id), 0)
                + COALESCE((SELECT SUM(m.monto) FROM movimientos m WHERE m.usuario_id = p.repartidor_id AND m.concepto = 'ajuste' AND m.referencia = 'propina-extra-' || p.id), 0) AS total
         FROM pedidos p
        WHERE p.repartidor_id = ? AND p.estado = 'entregado' AND substr(p.entregado_en, 1, 4) = ?`,
    )
    .bind(u.id, String(anio))
    .all<{
      entregado_en: string;
      distancia_km: number | null;
      moneda: string | null;
      total: number;
    }>();
  const r = resumenAnual(
    results.map((x) => ({
      entregadoEn: String(x.entregado_en),
      distanciaKm: x.distancia_km == null ? null : Number(x.distancia_km),
      moneda: x.moneda ?? 'USD',
      total: Number(x.total),
    })),
  );
  return c.json({ anio, ...r });
});

/** La campana: calculada al momento, sin tabla nueva (igual que la del cliente). */
repartidorGrandes.get('/repartidor/avisos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  type Aviso = {
    tipo: string;
    pedidoId: string | null;
    codigo: string | null;
    restaurante: string | null;
    detalle: string;
    centavos: number | null;
    /** C-MONEDA-RECORRIDO: la moneda de «centavos» (unidad menor). */
    moneda?: string;
    en: string;
  };
  const lista: Aviso[] = [];
  const TIPOS = new Map<string, string>([
    ['rechazado_por_restaurante', 'cancelado_por_restaurante'],
    ['cancelado_por_cliente', 'cancelado_por_cliente'],
    ['cancelado_sin_respuesta', 'cancelado_por_restaurante'],
    ['direccion_cambiada', 'direccion_cambiada'],
    ['ubicacion_autorizada', 'excepcion_autorizada'],
  ]);
  const eventos = await db
    .prepare(
      `SELECT b.evento, b.detalle, b.creado_en, p.id, r.nombre FROM bitacora_pedidos b
         JOIN pedidos p ON p.id = b.pedido_id JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE (p.repartidor_id = ? OR EXISTS (SELECT 1 FROM abandonos_repartidor a WHERE a.pedido_id = p.id AND a.repartidor_id = ?))
          AND b.evento IN (${[...TIPOS.keys()].map((e) => `'${e}'`).join(',')})
          AND b.creado_en > datetime('now','-7 days')
        ORDER BY b.creado_en DESC LIMIT 30`,
    )
    .bind(u.id, u.id)
    .all<{ evento: string; detalle: string; creado_en: string; id: string; nombre: string }>();
  for (const e of eventos.results)
    lista.push({
      tipo: TIPOS.get(e.evento) ?? e.evento,
      pedidoId: e.id,
      codigo: e.id.slice(0, 4).toUpperCase(),
      restaurante: e.nombre,
      detalle: e.detalle,
      centavos: null,
      en: e.creado_en,
    });
  const propinas = await db
    .prepare(
      `SELECT m.monto, m.creado_en, substr(m.referencia, 15) AS pedido_id, r.nombre, p.moneda FROM movimientos m
         LEFT JOIN pedidos p ON p.id = substr(m.referencia, 15) LEFT JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE m.usuario_id = ? AND m.concepto = 'ajuste' AND m.referencia LIKE 'propina-extra-%'
          AND m.creado_en > datetime('now','-7 days') ORDER BY m.creado_en DESC LIMIT 20`,
    )
    .bind(u.id)
    .all<{
      monto: number;
      creado_en: string;
      pedido_id: string | null;
      nombre: string | null;
      moneda: string | null;
    }>();
  for (const p of propinas.results)
    lista.push({
      tipo: 'propina_posterior',
      pedidoId: p.pedido_id,
      codigo: p.pedido_id ? p.pedido_id.slice(0, 4).toUpperCase() : null,
      restaurante: p.nombre,
      detalle: '',
      centavos: Number(p.monto),
      moneda: p.moneda ?? 'USD',
      en: p.creado_en,
    });
  const listo = await db
    .prepare(
      `SELECT p.id, p.listo_en, r.nombre FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.repartidor_id = ? AND p.estado = 'listo' AND p.listo_en IS NOT NULL`,
    )
    .bind(u.id)
    .all<{ id: string; listo_en: string; nombre: string }>();
  for (const p of listo.results)
    lista.push({
      tipo: 'pedido_listo',
      pedidoId: p.id,
      codigo: p.id.slice(0, 4).toUpperCase(),
      restaurante: p.nombre,
      detalle: '',
      centavos: null,
      en: p.listo_en,
    });
  const vencidas = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM ofertas WHERE repartidor_id = ? AND estado = 'vencida' AND creada_en > datetime('now','-1 day')",
    )
    .bind(u.id)
    .first<{ n: number }>();
  if (Number(vencidas?.n ?? 0) > 0)
    lista.push({
      tipo: 'ofertas_vencidas',
      pedidoId: null,
      codigo: null,
      restaurante: null,
      detalle: String(vencidas?.n ?? 0),
      centavos: null,
      en: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  const selfie = await db
    .prepare('SELECT pedida_en FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL')
    .bind(u.id)
    .first<{ pedida_en: string }>();
  if (selfie)
    lista.push({
      tipo: 'foto_control',
      pedidoId: null,
      codigo: null,
      restaurante: null,
      detalle: '',
      centavos: null,
      en: selfie.pedida_en,
    });
  lista.sort((a, b) => b.en.localeCompare(a.en));
  return c.json({
    avisos: lista,
    pendientes: lista.filter((a) => a.tipo === 'pedido_listo' || a.tipo === 'foto_control').length,
  });
});

/** Pausa: sigue conectado (el equipo lo ve) pero no recibe ofertas, como «pausar el dash». */
repartidorGrandes.post('/repartidor/pausar', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, z.object({ pausado: z.boolean() }));
  const r = await base(c)
    .prepare('UPDATE repartidores SET pausado = ? WHERE usuario_id = ? AND conectado = 1')
    .bind(d.pausado ? 1 : 0, u.id)
    .run();
  if (!r.meta.changes && d.pausado)
    throw new ErrorDatos('Para pausar, primero tienes que estar conectado.', undefined, 409);
  return c.json({ pausado: d.pausado });
});

const punto = z.object({ lat: z.number().finite(), lng: z.number().finite() });

/**
 * «Llegué al restaurante»: como el «Slide upon arrival» de Dasher. El GPS lo marca solo a 200 m;
 * este botón lo confirma con la posición de ahora y, si está lejos, se lo dice con los metros.
 */
repartidorGrandes.post('/repartidor/pedidos/:id/llegue', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const d = await leerCuerpo(c, punto);
  const p = await db
    .prepare(
      `SELECT p.estado, r.lat, r.lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.id = ? AND p.repartidor_id = ? AND p.estado IN ('aceptado','listo')`,
    )
    .bind(c.req.param('id'), u.id)
    .first<{ estado: string; lat: number | null; lng: number | null }>();
  if (!p) throw new ErrorDatos('Este pedido no está contigo.', undefined, 409);
  if (p.lat == null || p.lng == null)
    throw new ErrorDatos('El restaurante no tiene ubicación en el mapa.', undefined, 409);
  const metros = Math.round(metrosEntre(d, { lat: p.lat, lng: p.lng }));
  if (metros > RADIO_LLEGADA_M) return c.json({ llegue: false, metros, radio: RADIO_LLEGADA_M });
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito, valor) VALUES (?, 'llego_restaurante', ?)",
      )
      .bind(c.req.param('id'), metros),
    db
      .prepare(
        "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
      )
      .bind(d.lat, d.lng, u.id),
  ]);
  return c.json({ llegue: true, metros, radio: RADIO_LLEGADA_M });
});

/** «El pedido no está listo» (como «Not ready» en Uber): queda en la bitácora y avisa al local. */
repartidorGrandes.post('/repartidor/pedidos/:id/no-esta-listo', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      `SELECT p.estado, r.dueno_id, u.idioma FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id JOIN usuarios u ON u.id = r.dueno_id
        WHERE p.id = ? AND p.repartidor_id = ? AND p.estado IN ('aceptado','listo')`,
    )
    .bind(id, u.id)
    .first<{ estado: string; dueno_id: string; idioma: string }>();
  if (!p) throw new ErrorDatos('Este pedido no está contigo.', undefined, 409);
  const nuevo = await anotarEvento(db, id, 'no_esta_listo', `${u.id}`);
  if (nuevo)
    await notificar(c.env, db, p.dueno_id, {
      ...AVISOS.restNoListo(p.idioma, id.slice(0, 4).toUpperCase()),
      datos: { pedidoId: id },
    }).catch((e: unknown) => console.error('aviso no está listo', e));
  return c.json({ ok: true, avisado: nuevo });
});

/** Para las pruebas y el panel: distancia entre dos puntos en km (reexportada por comodidad). */
export const kmEntre = distanciaKm;

/**
 * C-CALIFICA-CLIENTE (29 oct 2026), como Uber: el repartidor califica al cliente de sus entregas de
 * las últimas 24 horas (una vez por pedido). Solo lo ve soporte; nadie se bloquea por esto.
 */
repartidorGrandes.get('/repartidor/por-calificar', async (c) => {
  const u = exigir(c, 'repartidor');
  const { results } = await base(c)
    .prepare(
      `SELECT p.id AS pedidoId, uc.nombre AS cliente, p.entregado_en AS entregadoEn FROM pedidos p
         JOIN usuarios uc ON uc.id = p.cliente_id
        WHERE p.repartidor_id = ? AND p.estado = 'entregado' AND p.entregado_en > datetime('now', '-1 day')
          AND NOT EXISTS (SELECT 1 FROM calificaciones_cliente k WHERE k.pedido_id = p.id)
        ORDER BY p.entregado_en DESC LIMIT 10`,
    )
    .bind(u.id)
    .all<{ pedidoId: string; cliente: string; entregadoEn: string }>();
  return c.json({
    pedidos: results.map((r) => ({ ...r, cliente: String(r.cliente ?? '').split(' ')[0] })),
  });
});

repartidorGrandes.post('/repartidor/pedidos/:id/calificar-cliente', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      estrellas: z.number().int().min(1).max(5),
      motivo: z.enum(['', 'no_salio', 'direccion', 'trato', 'espera']).default(''),
      comentario: z.string().trim().max(300).default(''),
    }),
  );
  const db = base(c);
  const f = await db
    .prepare(
      "SELECT cliente_id FROM pedidos WHERE id = ? AND repartidor_id = ? AND estado = 'entregado' AND entregado_en > datetime('now', '-1 day')",
    )
    .bind(c.req.param('id'), u.id)
    .first<{ cliente_id: string }>();
  if (!f) throw new ErrorDatos('Solo calificas a clientes de tus entregas de hoy.', undefined, 404);
  const r = await db
    .prepare(
      'INSERT OR IGNORE INTO calificaciones_cliente (pedido_id, repartidor_id, cliente_id, estrellas, motivo, comentario) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      c.req.param('id'),
      u.id,
      f.cliente_id,
      d.estrellas,
      d.estrellas >= 4 ? '' : d.motivo,
      d.comentario,
    )
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ya calificaste este pedido.', undefined, 409);
  return c.json({ ok: true }, 201);
});
