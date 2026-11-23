import { Hono } from 'hono';
import { z } from 'zod';
import {
  COMISION_ENVIO_COMIDA_VE_PB,
  COMISION_RESTAURANTE_VE_ARRANQUE_PB,
  COMISION_RESTAURANTE_VE_PREPARADA_PB,
  PAISES,
  TARIFAS_COMIDA_VENEZUELA,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { anotarCambioDinero } from '../rutas/dinero';
import {
  type ConfigPais,
  configPaisDeFabrica,
  esquemaConfigPais,
  guardarConfigPais,
  leerConfigPais,
} from '../internacional/paises';
import { ahoraSql, politicaVigente, sentenciaAuditoriaFin } from './politicas';

/**
 * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026, modelo aprobado por Richard) — Venezuela y todo país con la
 * bandera `comidaPagoRestaurante`. UNA palanca del panel para «¿Quién paga qué en la comida?»:
 *
 * - CLIENTE: tarifa de servicio (porcentaje, mínimo y máximo) y cargo por pedido pequeño (mínimo y
 *   cargo). Viven en las tarifas del país (`tarifas`). En el modelo aprobado, todo en 0.
 * - RESTAURANTE: la comisión de Divoox que sale de su saldo prepago al confirmar «Me llegó». Vive en
 *   una política financiera (`food` · `restaurante` · prepago). Cambiarla CIERRA desde ahora las que
 *   rigen en ese país y moneda y, si el valor es mayor que 0, crea la nueva con la revisión legal
 *   aprobada (exige la nota). Nunca retroactiva; con 0 solo cierra (sin política = 0 %).
 * - CONDUCTOR: la comisión sobre el envío en pago directo (`comidaComisionEnvioPb`). De fábrica 0.
 *
 * Estados Unidos nunca (422). Todo queda en la auditoría financiera y en la de cambios de dinero.
 */
export const comidaQuienPaga = new Hono<{ Bindings: Env; Variables: Variables }>();

const RUTA = '/admin/finanzas/comida-quien-paga';
const pb = z.number().int().min(0).max(5000);
const monto = z.number().int().min(0).max(1_000_000_000);

const NOTA_LEGAL_MINIMA = 10;

/** Lo que el modelo aprobado deja de fábrica (lo que el panel propone para «volver al modelo»). */
const DE_FABRICA = {
  cliente: {
    servicioPb: TARIFAS_COMIDA_VENEZUELA.servicioPb,
    servicioMinimo: TARIFAS_COMIDA_VENEZUELA.servicioMinimo,
    servicioMaximo: TARIFAS_COMIDA_VENEZUELA.servicioMaximo,
    pedidoMinimo: TARIFAS_COMIDA_VENEZUELA.pedidoMinimo,
    cargoPedidoPequeno: TARIFAS_COMIDA_VENEZUELA.cargoPedidoPequeno,
  },
  restaurante: {
    comisionPb: COMISION_RESTAURANTE_VE_ARRANQUE_PB,
    preparadaPb: COMISION_RESTAURANTE_VE_PREPARADA_PB,
  },
  conductor: { comisionEnvioPb: COMISION_ENVIO_COMIDA_VE_PB },
} as const;

const paisSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, { error: 'Elige el país.' });

/** País con pago directo de la comida o 422 claro (Estados Unidos nunca). */
async function paisConPagoDirecto(db: D1Database, pais: string) {
  if (pais === 'US')
    throw new ErrorDatos(
      'En Estados Unidos la comida se cobra con tarjeta como siempre: esta palanca no aplica.',
      'pais',
      422,
    );
  const cfg = await leerConfigPais(db, pais);
  if (cfg.comidaPagoRestaurante !== true)
    throw new ErrorDatos(
      'Este país no usa el pago directo de la comida al restaurante: esta palanca no aplica.',
      'pais',
      422,
    );
  return cfg;
}

const clienteDe = (cfg: ConfigPais) =>
  cfg.tarifas
    ? {
        servicioPb: cfg.tarifas.servicioPb,
        servicioMinimo: cfg.tarifas.servicioMinimo,
        servicioMaximo: cfg.tarifas.servicioMaximo,
        pedidoMinimo: cfg.tarifas.pedidoMinimo,
        cargoPedidoPequeno: cfg.tarifas.cargoPedidoPequeno,
      }
    : null;

/** La comisión del restaurante que RIGE ahora (0 si ninguna política rige). */
async function restauranteDe(db: D1Database, pais: string, moneda: string) {
  const pol = await politicaVigente(db, {
    servicio: 'food',
    tipoCuenta: 'restaurante',
    pais,
    moneda,
  });
  const rige = pol && pol.modalidad === 'prepago' ? pol : null;
  const r = rige?.regla;
  const parejo =
    r?.tipo === 'porcentaje' && r.minimo == null && r.maximo == null && rige?.descuentoPb === 0;
  return {
    comisionPb: rige ? (r?.tipo === 'porcentaje' ? r.pb : null) : 0,
    /** La regla completa cuando no es un porcentaje parejo (la creó otra pantalla del panel). */
    regla: rige && !parejo ? { ...rige.regla, descuentoPb: rige.descuentoPb } : null,
    preparadaPb: COMISION_RESTAURANTE_VE_PREPARADA_PB,
    revisionLegalAprobada: rige ? rige.revisionLegalAprobada : false,
    politicaId: rige ? rige.id : null,
  };
}

async function vista(db: D1Database, pais: string, cfg: ConfigPais) {
  return {
    pais,
    moneda: cfg.moneda,
    pagoDirecto: cfg.comidaPagoRestaurante === true,
    tarifasEscritas: Boolean(cfg.tarifas),
    cliente: clienteDe(cfg),
    restaurante: await restauranteDe(db, pais, cfg.moneda),
    conductor: { comisionEnvioPb: cfg.comidaComisionEnvioPb ?? 0 },
    deFabrica: DE_FABRICA,
  };
}

/** Los países que hoy usan el pago directo (una sola lectura de las configuraciones guardadas). */
async function paisesConPagoDirecto(db: D1Database) {
  const { results } = await db
    .prepare("SELECT clave, valor FROM config WHERE clave LIKE 'pais:%' LIMIT 300")
    .all<{ clave: string; valor: string }>();
  const guardadas = new Map(results.map((r) => [r.clave.slice(5), r.valor]));
  const lista: { pais: string; moneda: string }[] = [];
  for (const iso of Object.keys(PAISES).sort()) {
    if (iso === 'US') continue;
    let cfg = configPaisDeFabrica(iso);
    const crudo = guardadas.get(iso);
    if (crudo) {
      const r = esquemaConfigPais.partial().safeParse(JSON.parse(crudo));
      if (r.success) cfg = { ...cfg, ...r.data };
    }
    if (cfg.comidaPagoRestaurante === true) lista.push({ pais: iso, moneda: cfg.moneda });
  }
  return lista;
}

comidaQuienPaga.get(RUTA, async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const pais = paisSchema.safeParse(c.req.query('pais') ?? 'VE');
  if (!pais.success) throw new ErrorDatos('Elige el país.', 'pais', 422);
  const cfg = await paisConPagoDirecto(db, pais.data);
  return c.json({ ...(await vista(db, pais.data, cfg)), paises: await paisesConPagoDirecto(db) });
});

const esquemaCambio = z.object({
  pais: paisSchema,
  motivo: z.string().trim().min(5, { error: 'Escribe el motivo del cambio.' }).max(500),
  cliente: z
    .object({
      servicioPb: pb,
      servicioMinimo: monto,
      servicioMaximo: monto,
      pedidoMinimo: monto,
      cargoPedidoPequeno: monto,
    })
    .partial()
    .optional(),
  restaurante: z
    .object({
      comisionPb: pb,
      revisionLegalNota: z.string().trim().max(1000).optional(),
    })
    .optional(),
  conductor: z.object({ comisionEnvioPb: pb }).optional(),
});

comidaQuienPaga.put(RUTA, async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaCambio);
  const db = base(c);
  const cfg = await paisConPagoDirecto(db, d.pais);
  const cliente = d.cliente && Object.keys(d.cliente).length ? d.cliente : null;
  if (!cliente && !d.restaurante && !d.conductor)
    throw new ErrorDatos('No hay nada que cambiar.', undefined, 422);
  if (!cfg.tarifas)
    throw new ErrorDatos(
      'Este país todavía no tiene las tarifas de comida escritas: abre Comida en una ciudad primero.',
      'pais',
      409,
    );

  // Todo se valida ANTES de escribir: si algo no cuadra, nada cambia.
  const tarifas = cliente ? { ...cfg.tarifas, ...cliente } : cfg.tarifas;
  if (tarifas.servicioMinimo > tarifas.servicioMaximo)
    throw new ErrorDatos(
      'La tarifa de servicio mínima no puede ser mayor que la máxima.',
      'cliente',
      422,
    );
  const nota = d.restaurante?.revisionLegalNota ?? '';
  if (d.restaurante && d.restaurante.comisionPb > 0 && nota.length < NOTA_LEGAL_MINIMA)
    throw new ErrorDatos(
      'Para cobrarle comisión al restaurante escribe la referencia de la revisión legal aprobada (al menos 10 letras).',
      'restaurante.revisionLegalNota',
      422,
    );

  const antes = await vista(db, d.pais, cfg);

  // Cliente y conductor: en la configuración del país.
  if (cliente || d.conductor) {
    const nueva = await guardarConfigPais(db, d.pais, {
      ...(cliente ? { tarifas } : {}),
      ...(d.conductor ? { comidaComisionEnvioPb: d.conductor.comisionEnvioPb } : {}),
    });
    await anotarCambioDinero(db, u.id, `config-pais:${d.pais}`, cfg, nueva);
  }

  // Restaurante: se cierran desde ahora las políticas que rigen y, si hay comisión, nace la nueva.
  const sentencias: D1PreparedStatement[] = [];
  let politicaNueva: string | null = null;
  if (d.restaurante) {
    const ahora = ahoraSql();
    const { results: abiertas } = await db
      .prepare(
        `SELECT id, vigente_desde FROM politicas_financieras
          WHERE servicio = 'food' AND tipo_cuenta = 'restaurante' AND pais = ? AND moneda = ? AND activa = 1
            AND (vigente_hasta IS NULL OR vigente_hasta > ?)
          LIMIT 50`,
      )
      .bind(d.pais, cfg.moneda, ahora)
      .all<{ id: string; vigente_desde: string }>();
    for (const p of abiertas)
      sentencias.push(
        // Si todavía no empezó a regir, cerrarla es apagarla (nunca cobró nada).
        p.vigente_desde >= ahora
          ? db
              .prepare(
                "UPDATE politicas_financieras SET activa = 0, cerrada_por = ?, cerrada_en = datetime('now') WHERE id = ?",
              )
              .bind(u.id, p.id)
          : db
              .prepare(
                "UPDATE politicas_financieras SET vigente_hasta = ?, cerrada_por = ?, cerrada_en = datetime('now') WHERE id = ?",
              )
              .bind(ahora, u.id, p.id),
      );
    if (d.restaurante.comisionPb > 0) {
      politicaNueva = crypto.randomUUID();
      sentencias.push(
        db
          .prepare(
            `INSERT INTO politicas_financieras (id, nombre, servicio, tipo_cuenta, pais, ciudad, empresa_id, modalidad, moneda, regla_json,
               descuento_pb, vigente_desde, vigente_hasta, prioridad, revision_legal_aprobada, revision_legal_nota, motivo, creado_por)
             VALUES (?, ?, 'food', 'restaurante', ?, NULL, NULL, 'prepago', ?, ?, 0, ?, NULL, 0, 1, ?, ?, ?)`,
          )
          .bind(
            politicaNueva,
            `Comida · comisión del restaurante · ${d.pais}`,
            d.pais,
            cfg.moneda,
            JSON.stringify({ tipo: 'porcentaje', pb: d.restaurante.comisionPb }),
            ahora,
            nota,
            d.motivo,
            u.id,
          ),
      );
    }
  }

  const cfgDespues = await leerConfigPais(db, d.pais);
  const despuesParcial = {
    cliente: clienteDe(cfgDespues),
    restaurante: d.restaurante
      ? { comisionPb: d.restaurante.comisionPb, politicaId: politicaNueva }
      : antes.restaurante,
    conductor: { comisionEnvioPb: cfgDespues.comidaComisionEnvioPb ?? 0 },
  };
  await db.batch([
    ...sentencias,
    sentenciaAuditoriaFin(db, {
      actorId: u.id,
      accion: 'comida_quien_paga.cambiar',
      objeto: d.pais,
      detalle: {
        motivo: d.motivo,
        revisionLegalNota: nota || null,
        antes: {
          cliente: antes.cliente,
          restaurante: antes.restaurante,
          conductor: antes.conductor,
        },
        despues: despuesParcial,
      },
    }),
  ]);
  return c.json(await vista(db, d.pais, cfgDespues));
});
