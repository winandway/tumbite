import { Hono } from 'hono';
import { z } from 'zod';
import { RADIO_LLEGADA_M, distanciaKm, metrosEntre, minutosDeViaje } from '@tumbite/compartido';
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

repartidorGrandes.get('/repartidor/calificaciones', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const estrellas = await db
    .prepare(
      `SELECT c.estrellas_repartidor AS e, c.culpa_restaurante AS culpa FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id
        WHERE p.repartidor_id = ? AND c.estrellas_repartidor IS NOT NULL ORDER BY c.creado_en DESC LIMIT ${ULTIMAS}`,
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
  return c.json({
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
  });
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
      `SELECT p.id, p.entregado_en, p.envio, p.complemento, p.propina, p.pago_repartidor, r.nombre AS restaurante,
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
      base,
      bono,
      propina,
      propinaPosterior,
      total: base + bono + propina + propinaPosterior,
    };
  });
  const totales = pedidos.reduce(
    (acc, p) => ({
      entregas: acc.entregas + 1,
      base: acc.base + p.base,
      bonos: acc.bonos + p.bono,
      propinas: acc.propinas + p.propina + p.propinaPosterior,
      total: acc.total + p.total,
    }),
    { entregas: 0, base: 0, bonos: 0, propinas: 0, total: 0 },
  );
  return c.json({ pedidos, totales });
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
      `SELECT m.monto, m.creado_en, substr(m.referencia, 15) AS pedido_id, r.nombre FROM movimientos m
         LEFT JOIN pedidos p ON p.id = substr(m.referencia, 15) LEFT JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE m.usuario_id = ? AND m.concepto = 'ajuste' AND m.referencia LIKE 'propina-extra-%'
          AND m.creado_en > datetime('now','-7 days') ORDER BY m.creado_en DESC LIMIT 20`,
    )
    .bind(u.id)
    .all<{ monto: number; creado_en: string; pedido_id: string | null; nombre: string | null }>();
  for (const p of propinas.results)
    lista.push({
      tipo: 'propina_posterior',
      pedidoId: p.pedido_id,
      codigo: p.pedido_id ? p.pedido_id.slice(0, 4).toUpperCase() : null,
      restaurante: p.nombre,
      detalle: '',
      centavos: Number(p.monto),
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
