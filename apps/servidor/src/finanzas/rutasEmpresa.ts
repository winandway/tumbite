import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { CABECERA_IDEMPOTENCIA, actorDeEmpresa, exigirPermiso } from '../flex/autorizacion';
import {
  crearRecargaEmpresa,
  empresaFinanciera,
  leerConfigRecargas,
  movimientosEmpresa,
  recargaPublica,
  saldoEmpresa,
} from './billetera';
import { comisionesDelPeriodo } from './cobrosRuta';
import { politicaVigente, sentenciaAuditoriaFin } from './politicas';

/**
 * Divoox Flex · Fase 4: la billetera vista por la EMPRESA (prefijo /datos/v1/flex). Ver: permiso
 * `finanzas.ver`; recargar y configurar: `finanzas.gestionar` (solo personas, nunca una clave de API).
 * Lo de otra empresa responde 404.
 */
export const finanzasEmpresa = new Hono<{ Bindings: Env; Variables: Variables }>();

const dia = /^\d{4}-\d{2}-\d{2}$/;
const rango = (desde?: string, hasta?: string) => {
  const h = dia.test(hasta ?? '') ? (hasta as string) : new Date().toISOString().slice(0, 10);
  const d = dia.test(desde ?? '')
    ? (desde as string)
    : new Date(Date.parse(h) - 29 * 86_400_000).toISOString().slice(0, 10);
  if (d > h) throw new ErrorDatos('La fecha inicial va antes que la final.', 'desde');
  return { desde: d, hasta: h };
};

type FilaConfig = {
  alerta_saldo: number | null;
  avisos_correo: number;
  recarga_auto_activa: number;
  recarga_auto_umbral: number | null;
  recarga_auto_monto: number | null;
  stripe_metodo: string | null;
  metodo_resumen: string;
};

async function configEmpresa(db: D1Database, empresaId: string) {
  const f = await db
    .prepare('SELECT * FROM empresa_finanzas WHERE empresa_id = ?')
    .bind(empresaId)
    .first<FilaConfig>();
  return {
    alertaSaldo: f?.alerta_saldo ?? null,
    avisosCorreo: f ? Boolean(f.avisos_correo) : true,
    recargaAutomatica: {
      activa: Boolean(f?.recarga_auto_activa),
      umbral: f?.recarga_auto_umbral ?? null,
      monto: f?.recarga_auto_monto ?? null,
    },
    metodoGuardado: f?.stripe_metodo ? f.metodo_resumen || 'tarjeta' : null,
  };
}

finanzasEmpresa.get('/empresas/:id/billetera', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const db = base(c);
  const e = await empresaFinanciera(db, actor.empresaId);
  const [saldo, recargas, cfg, pol, pendientes] = await Promise.all([
    saldoEmpresa(db, e),
    leerConfigRecargas(db, e.pais),
    configEmpresa(db, e.id),
    politicaVigente(db, {
      servicio: 'flex',
      tipoCuenta: 'empresa',
      pais: e.pais,
      empresaId: e.id,
      moneda: e.moneda,
    }),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM recargas_empresa WHERE empresa_id = ? AND estado = 'pendiente'",
      )
      .bind(e.id)
      .first<{ n: number }>(),
  ]);
  return c.json({
    saldo,
    alertaSaldoBajo: cfg.alertaSaldo !== null && saldo.disponible < cfg.alertaSaldo,
    // Con deuda no salen rutas nuevas facturables (las que ya salieron terminan normal).
    suspendida: saldo.deuda > 0,
    recargas: {
      activas: recargas.activas,
      minimo: recargas.minimo,
      maximo: recargas.maximo,
      sugeridos: recargas.sugeridos,
      automaticaPermitida: recargas.automaticaPermitida,
      pendientes: Number(pendientes?.n ?? 0),
    },
    tarifa: pol
      ? {
          modalidad: pol.modalidad,
          regla: pol.regla,
          descuentoPb: pol.descuentoPb,
          vigenteHasta: pol.vigenteHasta,
        }
      : null,
    config: cfg,
    clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
  });
});

finanzasEmpresa.get('/empresas/:id/billetera/movimientos', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const db = base(c);
  const e = await empresaFinanciera(db, actor.empresaId);
  const hayFechas = c.req.query('desde') || c.req.query('hasta');
  const r = hayFechas ? rango(c.req.query('desde'), c.req.query('hasta')) : null;
  return c.json({
    movimientos: await movimientosEmpresa(db, e, {
      desde: r?.desde,
      hasta: r?.hasta,
      antesDe: c.req.query('antes') || undefined,
      limite: Number(c.req.query('limite') ?? 50) || 50,
    }),
  });
});

finanzasEmpresa.get('/empresas/:id/billetera/recargas', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const { results } = await base(c)
    .prepare(
      'SELECT * FROM recargas_empresa WHERE empresa_id = ? ORDER BY creado_en DESC LIMIT 100',
    )
    .bind(actor.empresaId)
    .all<Parameters<typeof recargaPublica>[0]>();
  return c.json({ recargas: results.map(recargaPublica) });
});

finanzasEmpresa.get('/empresas/:id/billetera/recargas/:rid', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const r = await base(c)
    .prepare('SELECT * FROM recargas_empresa WHERE id = ? AND empresa_id = ?')
    .bind(c.req.param('rid'), actor.empresaId)
    .first<Parameters<typeof recargaPublica>[0]>();
  if (!r) throw new ErrorDatos('Esa recarga no existe.', undefined, 404);
  return c.json({ recarga: recargaPublica(r) });
});

const esquemaRecarga = z.object({
  monto: z.number().int().min(1),
  guardarMetodo: z.boolean().default(false),
});

finanzasEmpresa.post('/empresas/:id/billetera/recargas', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.gestionar');
  const clave = c.req.header(CABECERA_IDEMPOTENCIA)?.trim() ?? '';
  if (!clave || clave.length > 200)
    throw new ErrorDatos(
      'Falta la cabecera Idempotency-Key (una clave única por operación, hasta 200 caracteres).',
      undefined,
      400,
    );
  const d = await leerCuerpo(c, esquemaRecarga);
  const r = await crearRecargaEmpresa(c.env, base(c), {
    empresaId: actor.empresaId,
    actorId: actor.actorTipo === 'usuario' ? actor.actorId : null,
    monto: d.monto,
    idempotencia: clave,
    guardarMetodo: d.guardarMetodo,
  });
  return c.json({ ...r, clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '' }, 201);
});

finanzasEmpresa.get('/empresas/:id/billetera/comisiones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const r = rango(c.req.query('desde'), c.req.query('hasta'));
  return c.json({
    periodo: r,
    ...(await comisionesDelPeriodo(base(c), actor.empresaId, r.desde, r.hasta)),
  });
});

type FilaComprobante = {
  id: string;
  numero: string;
  tipo: string;
  monto: number;
  pais: string;
  moneda: string;
  datos_json: string;
  creado_en: string;
};
const comprobantePublico = (x: FilaComprobante) => ({
  id: x.id,
  numero: x.numero,
  tipo: x.tipo,
  monto: x.monto,
  moneda: x.moneda,
  pais: x.pais,
  datos: JSON.parse(x.datos_json) as unknown,
  creadoEn: x.creado_en,
});

finanzasEmpresa.get('/empresas/:id/comprobantes', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const r = rango(c.req.query('desde'), c.req.query('hasta'));
  const tipo = c.req.query('tipo') || null;
  const { results } = await base(c)
    .prepare(
      `SELECT * FROM comprobantes WHERE empresa_id = ? AND creado_en BETWEEN ? AND ? AND (? IS NULL OR tipo = ?)
        ORDER BY creado_en DESC LIMIT 300`,
    )
    .bind(actor.empresaId, r.desde, `${r.hasta} 23:59:59`, tipo, tipo)
    .all<FilaComprobante>();
  return c.json({ periodo: r, comprobantes: results.map(comprobantePublico) });
});

finanzasEmpresa.get('/empresas/:id/comprobantes/:cid', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const db = base(c);
  const x = await db
    .prepare('SELECT * FROM comprobantes WHERE id = ? AND empresa_id = ?')
    .bind(c.req.param('cid'), actor.empresaId)
    .first<FilaComprobante>();
  if (!x) throw new ErrorDatos('Ese comprobante no existe.', undefined, 404);
  const e = await db
    .prepare('SELECT nombre, razon_social, pais FROM empresas WHERE id = ?')
    .bind(actor.empresaId)
    .first<{ nombre: string; razon_social: string; pais: string }>();
  return c.json({
    comprobante: comprobantePublico(x),
    empresa: e,
    emisor: {
      nombre: 'Windoce LLC (Divoox)',
      nota: 'Comprobante de movimiento de la billetera. No es una factura fiscal.',
    },
  });
});

const esquemaConfig = z.object({
  alertaSaldo: z.number().int().min(0).nullable(),
  avisosCorreo: z.boolean(),
  recargaAutomatica: z.object({
    activa: z.boolean(),
    umbral: z.number().int().min(0).nullable(),
    monto: z.number().int().min(1).nullable(),
  }),
});

finanzasEmpresa.put('/empresas/:id/billetera/config', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.gestionar');
  const d = await leerCuerpo(c, esquemaConfig);
  const db = base(c);
  const e = await empresaFinanciera(db, actor.empresaId);
  const actual = await configEmpresa(db, e.id);
  const a = d.recargaAutomatica;
  if (a.activa) {
    const lim = await leerConfigRecargas(db, e.pais);
    if (!lim.automaticaPermitida)
      throw new ErrorDatos(
        'La recarga automática no está disponible en tu país.',
        'recargaAutomatica',
        409,
      );
    if (!actual.metodoGuardado)
      throw new ErrorDatos(
        'Primero haz una recarga guardando tu tarjeta.',
        'recargaAutomatica',
        409,
      );
    if (a.umbral === null || a.monto === null || a.monto < lim.minimo || a.monto > lim.maximo)
      throw new ErrorDatos(
        'Revisa el umbral y el importe de la recarga automática.',
        'recargaAutomatica',
        409,
      );
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO empresa_finanzas (empresa_id, alerta_saldo, avisos_correo, recarga_auto_activa, recarga_auto_umbral, recarga_auto_monto)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(empresa_id) DO UPDATE SET alerta_saldo = ?2, avisos_correo = ?3, recarga_auto_activa = ?4,
           recarga_auto_umbral = ?5, recarga_auto_monto = ?6, actualizado_en = datetime('now')`,
      )
      .bind(e.id, d.alertaSaldo, d.avisosCorreo ? 1 : 0, a.activa ? 1 : 0, a.umbral, a.monto),
    sentenciaAuditoriaFin(db, {
      actorId: actor.actorId,
      accion: 'billetera.config',
      objeto: e.id,
      empresaId: e.id,
      detalle: d,
    }),
  ]);
  return c.json({ config: await configEmpresa(db, e.id) });
});

/** Quitar la tarjeta guardada (apaga la recarga automática). */
finanzasEmpresa.post('/empresas/:id/billetera/metodo/quitar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.gestionar');
  const db = base(c);
  await db.batch([
    db
      .prepare(
        "UPDATE empresa_finanzas SET stripe_metodo = NULL, metodo_resumen = '', recarga_auto_activa = 0, actualizado_en = datetime('now') WHERE empresa_id = ?",
      )
      .bind(actor.empresaId),
    sentenciaAuditoriaFin(db, {
      actorId: actor.actorId,
      accion: 'billetera.quitar_metodo',
      objeto: actor.empresaId,
      empresaId: actor.empresaId,
    }),
  ]);
  return c.json({ config: await configEmpresa(db, actor.empresaId) });
});
