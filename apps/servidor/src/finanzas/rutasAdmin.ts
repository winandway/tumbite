import { Hono } from 'hono';
import { z } from 'zod';
import {
  MODALIDADES,
  SERVICIOS_FINANCIEROS,
  TIPOS_CUENTA,
  desgloseServicioLogistico,
  esquemaRegla,
} from '@tumbite/compartido';
import { verificarClave } from '../cripto';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  ajusteManual,
  esquemaConfigRecargas,
  guardarConfigRecargas,
  leerConfigRecargas,
  movimientosEmpresa,
  empresaFinanciera,
  reembolsarRecarga,
  saldoEmpresa,
} from './billetera';
import {
  ahoraSql,
  filaPolitica,
  listarPoliticas,
  politicaPublica,
  sentenciaAuditoriaFin,
} from './politicas';
import { conciliarFinanzas, ultimaConciliacion } from './reloj';

/**
 * Divoox · Fase 4: SUPERADMIN financiero (prefijo /datos). Solo rol admin. Los ajustes manuales y
 * los reembolsos además piden la contraseña del administrador (permiso reforzado) y un motivo; todo
 * queda en la auditoría inmutable. Ningún cambio de tarifa es retroactivo.
 */
export const finanzasAdmin = new Hono<{ Bindings: Env; Variables: Variables }>();

const fechaHora = z
  .string()
  .refine(
    (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) ||
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(s) ||
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s),
    'Fecha en formato AAAA-MM-DD HH:MM.',
  )
  .transform((s) => {
    const x = s.replace('T', ' ');
    return x.length === 10 ? `${x} 00:00:00` : x.length === 16 ? `${x}:00` : x;
  });

async function reforzado(c: Parameters<typeof base>[0], clave: string) {
  const u = exigir(c, 'admin');
  const f = await base(c)
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(clave, f.clave_hash)))
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
  return u;
}

finanzasAdmin.get('/admin/finanzas/politicas', async (c) => {
  exigir(c, 'admin');
  return c.json({
    politicas: await listarPoliticas(base(c), {
      servicio: c.req.query('servicio') || undefined,
      pais: c.req.query('pais') || undefined,
    }),
  });
});

const esquemaPolitica = z
  .object({
    nombre: z.string().trim().min(3).max(120),
    servicio: z.enum(SERVICIOS_FINANCIEROS),
    tipoCuenta: z.enum(TIPOS_CUENTA),
    pais: z.string().regex(/^([A-Z]{2}|\*)$/, 'País en dos letras (o * para todos).'),
    ciudad: z.string().trim().min(2).max(80).nullable().default(null),
    empresaId: z.string().uuid().nullable().default(null),
    modalidad: z.enum(MODALIDADES),
    moneda: z.string().length(3).toUpperCase(),
    regla: esquemaRegla,
    descuentoPb: z.number().int().min(0).max(10_000).default(0),
    vigenteDesde: fechaHora.optional(),
    vigenteHasta: fechaHora.nullable().default(null),
    prioridad: z.number().int().min(-100).max(100).default(0),
    motivo: z.string().trim().min(5).max(500),
    revisionLegalAprobada: z.boolean().default(false),
    revisionLegalNota: z.string().trim().max(1000).default(''),
  })
  .refine((p) => !p.revisionLegalAprobada || p.revisionLegalNota.length >= 10, {
    message: 'Escribe la referencia de la revisión legal y comercial aprobada.',
    path: ['revisionLegalNota'],
  });

finanzasAdmin.post('/admin/finanzas/politicas', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaPolitica);
  const db = base(c);
  const ahora = ahoraSql();
  const desde = d.vigenteDesde ?? ahora;
  // Nunca retroactiva: una política nueva rige desde ahora en adelante.
  if (desde < ahora.slice(0, 16))
    throw new ErrorDatos('Una política nueva no puede empezar en el pasado.', 'vigenteDesde', 409);
  if (d.vigenteHasta && d.vigenteHasta <= desde)
    throw new ErrorDatos('La fecha final va después de la inicial.', 'vigenteHasta', 409);
  if (d.empresaId) await empresaFinanciera(db, d.empresaId);
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO politicas_financieras (id, nombre, servicio, tipo_cuenta, pais, ciudad, empresa_id, modalidad, moneda, regla_json,
           descuento_pb, vigente_desde, vigente_hasta, prioridad, revision_legal_aprobada, revision_legal_nota, motivo, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        d.nombre,
        d.servicio,
        d.tipoCuenta,
        d.pais,
        d.ciudad,
        d.empresaId,
        d.modalidad,
        d.moneda,
        JSON.stringify(d.regla),
        d.descuentoPb,
        desde,
        d.vigenteHasta,
        d.prioridad,
        d.revisionLegalAprobada ? 1 : 0,
        d.revisionLegalNota,
        d.motivo,
        u.id,
      ),
    sentenciaAuditoriaFin(db, {
      actorId: u.id,
      accion: 'politica.crear',
      objeto: id,
      empresaId: d.empresaId,
      detalle: d,
    }),
  ]);
  return c.json({ politica: politicaPublica((await filaPolitica(db, id))!) }, 201);
});

finanzasAdmin.post('/admin/finanzas/politicas/:pid/cerrar', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ desde: fechaHora.optional(), motivo: z.string().trim().min(5).max(500) }),
  );
  const db = base(c);
  const p = await filaPolitica(db, c.req.param('pid'));
  if (!p) throw new ErrorDatos('Esa política no existe.', undefined, 404);
  const hasta = d.desde ?? ahoraSql();
  if (hasta < ahoraSql().slice(0, 16))
    throw new ErrorDatos('Una política solo se cierra desde ahora en adelante.', 'desde', 409);
  // Si todavía no empezó a regir, cerrarla es apagarla (nunca llegó a cobrar nada).
  const antesDeEmpezar = hasta <= p.vigente_desde;
  await db
    .batch([
      antesDeEmpezar
        ? db
            .prepare(
              "UPDATE politicas_financieras SET activa = 0, cerrada_por = ?, cerrada_en = datetime('now') WHERE id = ?",
            )
            .bind(u.id, p.id)
        : db
            .prepare(
              "UPDATE politicas_financieras SET vigente_hasta = ?, cerrada_por = ?, cerrada_en = datetime('now') WHERE id = ?",
            )
            .bind(hasta, u.id, p.id),
      sentenciaAuditoriaFin(db, {
        actorId: u.id,
        accion: 'politica.cerrar',
        objeto: p.id,
        empresaId: p.empresa_id,
        detalle: { hasta, motivo: d.motivo },
      }),
    ])
    .catch((e: unknown) => {
      const m = String(e instanceof Error ? e.message : e);
      if (m.includes('politica_cierre_retroactivo') || m.includes('CHECK'))
        throw new ErrorDatos('Una política solo se cierra desde ahora en adelante.', 'desde', 409);
      throw e;
    });
  return c.json({ politica: politicaPublica((await filaPolitica(db, p.id))!) });
});

finanzasAdmin.post('/admin/finanzas/politicas/:pid/revision-legal', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ aprobada: z.boolean(), nota: z.string().trim().min(10).max(1000) }),
  );
  const db = base(c);
  const p = await filaPolitica(db, c.req.param('pid'));
  if (!p) throw new ErrorDatos('Esa política no existe.', undefined, 404);
  await db.batch([
    db
      .prepare(
        'UPDATE politicas_financieras SET revision_legal_aprobada = ?, revision_legal_nota = ? WHERE id = ?',
      )
      .bind(d.aprobada ? 1 : 0, d.nota, p.id),
    sentenciaAuditoriaFin(db, {
      actorId: u.id,
      accion: 'politica.revision_legal',
      objeto: p.id,
      detalle: d,
    }),
  ]);
  return c.json({ politica: politicaPublica((await filaPolitica(db, p.id))!) });
});

finanzasAdmin.get('/admin/finanzas/recargas-config/:pais', async (c) => {
  exigir(c, 'admin');
  return c.json({ config: await leerConfigRecargas(base(c), c.req.param('pais').toUpperCase()) });
});

finanzasAdmin.put('/admin/finanzas/recargas-config/:pais', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaConfigRecargas);
  const pais = c.req.param('pais').toUpperCase();
  if (!/^[A-Z]{2}$/.test(pais)) throw new ErrorDatos('País en dos letras.', 'pais');
  await guardarConfigRecargas(base(c), pais, d, u.id);
  return c.json({ config: await leerConfigRecargas(base(c), pais) });
});

finanzasAdmin.get('/admin/finanzas/empresas', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results } = await db
    .prepare('SELECT id, nombre, pais, moneda, estado FROM empresas ORDER BY nombre LIMIT 500')
    .all<{ id: string; nombre: string; pais: string; moneda: string; estado: string }>();
  const empresas = [];
  for (const e of results) empresas.push({ ...e, saldo: await saldoEmpresa(db, e) });
  return c.json({ empresas });
});

finanzasAdmin.get('/admin/finanzas/empresas/:eid/movimientos', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const e = await empresaFinanciera(db, c.req.param('eid'));
  const [mov, recargas, auditoria] = await Promise.all([
    movimientosEmpresa(db, e, { limite: 200, antesDe: c.req.query('antes') || undefined }),
    db
      .prepare(
        'SELECT * FROM recargas_empresa WHERE empresa_id = ? ORDER BY creado_en DESC LIMIT 100',
      )
      .bind(e.id)
      .all(),
    db
      .prepare('SELECT * FROM finanzas_auditoria WHERE empresa_id = ? ORDER BY id DESC LIMIT 100')
      .bind(e.id)
      .all(),
  ]);
  return c.json({
    empresa: e,
    saldo: await saldoEmpresa(db, e),
    movimientos: mov,
    recargas: recargas.results,
    auditoria: auditoria.results,
  });
});

finanzasAdmin.post('/admin/finanzas/empresas/:eid/ajuste', async (c) => {
  const d = await leerCuerpo(
    c,
    z.object({
      monto: z.number().int(),
      motivo: z.string().trim().min(10).max(500),
      clave: z.string().min(1).max(200),
    }),
  );
  const u = await reforzado(c, d.clave);
  return c.json({
    saldo: await ajusteManual(base(c), {
      empresaId: c.req.param('eid'),
      monto: d.monto,
      motivo: d.motivo,
      actorId: u.id,
    }),
  });
});

finanzasAdmin.post('/admin/finanzas/recargas/:rid/reembolsar', async (c) => {
  const d = await leerCuerpo(
    c,
    z.object({
      monto: z.number().int().min(1),
      motivo: z.string().trim().min(10).max(500),
      clave: z.string().min(1).max(200),
    }),
  );
  const u = await reforzado(c, d.clave);
  return c.json(
    await reembolsarRecarga(c.env, base(c), {
      recargaId: c.req.param('rid'),
      monto: d.monto,
      motivo: d.motivo,
      actorId: u.id,
    }),
  );
});

finanzasAdmin.get('/admin/finanzas/conciliacion', async (c) => {
  exigir(c, 'admin');
  return c.json({ ultima: await ultimaConciliacion(base(c)) });
});

finanzasAdmin.post('/admin/finanzas/conciliacion', async (c) => {
  exigir(c, 'admin');
  return c.json({ resultado: await conciliarFinanzas(c.env, base(c)) });
});

finanzasAdmin.post('/admin/finanzas/simular-logistico', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      paquetes: z.number().int().min(1).max(10_000),
      tecnologiaPorPaquete: z.number().int().min(0),
      transportePorPaquete: z.number().int().min(0),
      conductorPb: z.number().int().min(0).max(10_000),
      procesadorPb: z.number().int().min(0).max(2000),
      procesadorFijo: z.number().int().min(0),
      impuestoPb: z.number().int().min(0).max(5000),
    }),
  );
  return c.json({ desglose: desgloseServicioLogistico(d) });
});
