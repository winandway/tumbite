import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { guardarFoto } from '../fotoLimpia';
import { MAX_FOTO_BYTES, tipoReal } from '../rutas/fotos';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { cuentaEmpresa, empresaFinanciera, saldoEmpresa } from '../finanzas/billetera';
import { sentenciaAuditoriaFin } from '../finanzas/politicas';
import { hacerOPedirAprobacion } from '../finanzas/controlDual';
import { CABECERA_IDEMPOTENCIA, actorDeEmpresa, exigirPermiso } from './autorizacion';

/**
 * Divoox Flex · Fase 7 (C-FLEX-RECARGA-LOCAL). Venezuela y cualquier país sin Stripe.
 *
 * La empresa declara una recarga que pagó fuera de Divoox (pago móvil, transferencia, Zelle o
 * efectivo) con su referencia y la foto del comprobante. El equipo de Divoox la revisa y la
 * acredita UNA sola vez, o la rechaza con motivo. Todo queda en `finanzas_auditoria`.
 *
 * - Apagado por país: `config` → `fin_recargas_locales:<país>`. Sin esa fila, no existe.
 * - Acreditar: el UPDATE que pasa de `pendiente` a `acreditada` deja un token único, y las filas
 *   del libro se insertan SOLO si ese token quedó escrito (misma transacción). Dos toques, dos
 *   revisores a la vez o un rechazo cruzado no acreditan dos veces ni acreditan lo rechazado.
 *   Además el libro tiene su referencia única (`recarga_local:<id>:…`).
 * - Como en la recarga con tarjeta, lo que se acredita paga primero la deuda y el resto va al
 *   disponible.
 * - La foto va al almacén privado bajo la carpeta de la empresa; no se guarda en la base hasta
 *   declarar la recarga.
 * - Las recargas con Stripe no cambian.
 */
export const flexRecargasLocales = new Hono<{ Bindings: Env; Variables: Variables }>();

export const METODOS_LOCALES = ['pago_movil', 'transferencia', 'zelle', 'efectivo'] as const;
export type MetodoLocal = (typeof METODOS_LOCALES)[number];

export const esquemaConfigLocales = z.object({
  activas: z.boolean(),
  minimo: z.number().int().min(1),
  maximo: z.number().int().min(1),
  metodos: z.array(z.enum(METODOS_LOCALES)).min(1).max(4),
  /** A dónde paga la empresa (lo escribe el superadmin): banco, teléfono, correo de Zelle… */
  instruccionesEs: z.string().max(1000).default(''),
  instruccionesEn: z.string().max(1000).default(''),
});
export type ConfigLocales = z.infer<typeof esquemaConfigLocales>;

/** De fábrica, APAGADAS en todos los países. */
export const LOCALES_DE_FABRICA: ConfigLocales = {
  activas: false,
  minimo: 500,
  maximo: 500_000,
  metodos: ['pago_movil', 'transferencia', 'zelle', 'efectivo'],
  instruccionesEs: '',
  instruccionesEn: '',
};

const claveConfig = (pais: string) => `fin_recargas_locales:${pais}`;

export async function leerConfigLocales(db: D1Database, pais: string): Promise<ConfigLocales> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(claveConfig(pais))
    .first<{ valor: string }>();
  if (!f) return LOCALES_DE_FABRICA;
  const r = esquemaConfigLocales.partial().safeParse(JSON.parse(f.valor));
  return r.success ? { ...LOCALES_DE_FABRICA, ...r.data } : LOCALES_DE_FABRICA;
}

type FilaLocal = {
  id: string;
  empresa_id: string;
  pais: string;
  moneda: string;
  monto: number;
  metodo: MetodoLocal;
  referencia: string;
  banco: string;
  fecha_pago: string | null;
  comprobante_clave: string;
  estado: 'pendiente' | 'acreditada' | 'rechazada';
  motivo: string;
  creado_por: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  creado_en: string;
};

export const recargaLocalPublica = (r: FilaLocal) => ({
  id: r.id,
  monto: r.monto,
  moneda: r.moneda,
  metodo: r.metodo,
  referencia: r.referencia,
  banco: r.banco,
  fechaPago: r.fecha_pago,
  estado: r.estado,
  motivo: r.motivo,
  creadoEn: r.creado_en,
  revisadoEn: r.revisado_en,
});

const carpetaComprobantes = (empresaId: string) => `flex/${empresaId}/recargas/`;
const esIdComprobante = (s: string) => /^[a-f0-9-]{36}$/.test(s);

function exigirPersona(actor: { actorTipo: string }) {
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos(
      'Las recargas las declara una persona de la empresa, no una clave de API.',
      undefined,
      403,
    );
}

// ───────────────────────────── La empresa ─────────────────────────────

flexRecargasLocales.get('/empresas/:id/billetera/recargas-locales', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.ver');
  const db = base(c);
  const e = await empresaFinanciera(db, actor.empresaId);
  const [cfg, lista] = await Promise.all([
    leerConfigLocales(db, e.pais),
    db
      .prepare(
        'SELECT * FROM recargas_locales_empresa WHERE empresa_id = ? ORDER BY creado_en DESC LIMIT 50',
      )
      .bind(e.id)
      .all<FilaLocal>(),
  ]);
  return c.json({
    config: {
      activas: cfg.activas,
      minimo: cfg.minimo,
      maximo: cfg.maximo,
      metodos: cfg.metodos,
      instrucciones:
        c.req.header('x-idioma') === 'es'
          ? cfg.instruccionesEs
          : cfg.instruccionesEn || cfg.instruccionesEs,
      moneda: e.moneda,
    },
    recargas: lista.results.map(recargaLocalPublica),
  });
});

/** Sube la foto del comprobante (bytes crudos). Devuelve su id para declarar la recarga. */
flexRecargasLocales.post('/empresas/:id/billetera/recargas-locales/comprobante', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.gestionar');
  exigirPersona(actor);
  const db = base(c);
  const e = await empresaFinanciera(db, actor.empresaId);
  const cfg = await leerConfigLocales(db, e.pais);
  if (!cfg.activas)
    throw new ErrorDatos(
      'Las recargas con pago local no están activas en tu país.',
      undefined,
      409,
    );
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (!bytes.byteLength) throw new ErrorDatos('Falta la foto del comprobante.', 'comprobante', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'comprobante', 413);
  const mime = tipoReal(bytes);
  if (!mime) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'comprobante', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos('El almacén de fotos no está disponible en este momento.', undefined, 503);
  const id = crypto.randomUUID();
  await guardarFoto(c.env.BUCKET, `${carpetaComprobantes(e.id)}${id}`, bytes, mime, {
    cacheControl: 'private, no-store',
  });
  return c.json({ comprobanteId: id }, 201);
});

const esquemaDeclarar = z.object({
  monto: z.number().int().min(1),
  metodo: z.enum(METODOS_LOCALES),
  referencia: z.string().trim().min(3).max(80),
  banco: z.string().trim().max(80).default(''),
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  comprobanteId: z.string().refine(esIdComprobante, 'Falta la foto del comprobante.'),
});

flexRecargasLocales.post('/empresas/:id/billetera/recargas-locales', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.gestionar');
  exigirPersona(actor);
  const clave = c.req.header(CABECERA_IDEMPOTENCIA)?.trim() ?? '';
  if (!clave || clave.length > 200)
    throw new ErrorDatos(
      'Falta la cabecera Idempotency-Key (una clave única por operación, hasta 200 caracteres).',
      undefined,
      400,
    );
  const d = await leerCuerpo(c, esquemaDeclarar);
  const db = base(c);
  const e = await empresaFinanciera(db, actor.empresaId);
  const repetida = await db
    .prepare('SELECT * FROM recargas_locales_empresa WHERE idempotencia = ? AND empresa_id = ?')
    .bind(clave, e.id)
    .first<FilaLocal>();
  if (repetida) return c.json({ recarga: recargaLocalPublica(repetida) }, 200);
  const cfg = await leerConfigLocales(db, e.pais);
  if (!cfg.activas)
    throw new ErrorDatos(
      'Las recargas con pago local no están activas en tu país.',
      undefined,
      409,
    );
  if (!cfg.metodos.includes(d.metodo))
    throw new ErrorDatos('Ese método de pago no está disponible en tu país.', 'metodo', 422);
  if (d.monto < cfg.minimo || d.monto > cfg.maximo)
    throw new ErrorDatos('El monto está fuera de los límites de tu país.', 'monto', 422);
  const claveFoto = `${carpetaComprobantes(e.id)}${d.comprobanteId}`;
  const foto = c.env.BUCKET ? await c.env.BUCKET.head(claveFoto) : null;
  if (!foto) throw new ErrorDatos('Falta la foto del comprobante.', 'comprobanteId', 422);
  const id = crypto.randomUUID();
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO recargas_locales_empresa
         (id, empresa_id, pais, moneda, monto, metodo, referencia, banco, fecha_pago, comprobante_clave, idempotencia, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      e.id,
      e.pais,
      e.moneda,
      d.monto,
      d.metodo,
      d.referencia,
      d.banco,
      d.fechaPago ?? null,
      claveFoto,
      clave,
      actor.actorId,
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Esa referencia de pago ya se declaró. Si es otro pago, escribe su referencia.',
      'referencia',
      409,
    );
  await sentenciaAuditoriaFin(db, {
    actorId: actor.actorId,
    accion: 'recarga_local.declarar',
    objeto: id,
    empresaId: e.id,
    detalle: { monto: d.monto, metodo: d.metodo },
  }).run();
  const fila = await db
    .prepare('SELECT * FROM recargas_locales_empresa WHERE id = ?')
    .bind(id)
    .first<FilaLocal>();
  return c.json({ recarga: recargaLocalPublica(fila!) }, 201);
});

// ───────────────────────────── El equipo de Divoox (superadmin) ─────────────────────────────

/**
 * Las rutas del equipo viven bajo `/datos/admin/finanzas/recargas-locales` (se montan en `/datos`):
 * así las cubre el guardia de perfiles del equipo (`permisosInternos`: escribir exige perfil Total
 * o Finanzas; Solo lectura y Soporte reciben 403) y cada cambio queda en `acciones_equipo`.
 * Acreditar pasa por el control dual (`recarga_local` en `TIPOS_DUAL`): por encima del umbral, una
 * persona pide y otra distinta aprueba.
 */
export const flexRecargasLocalesAdmin = new Hono<{ Bindings: Env; Variables: Variables }>();
const ADMIN = '/admin/finanzas/recargas-locales';

flexRecargasLocalesAdmin.get(`${ADMIN}/config/:pais`, async (c) => {
  exigir(c, 'admin');
  return c.json({ config: await leerConfigLocales(base(c), c.req.param('pais').toUpperCase()) });
});

flexRecargasLocalesAdmin.put(`${ADMIN}/config/:pais`, async (c) => {
  const u = exigir(c, 'admin');
  const pais = c.req.param('pais').toUpperCase();
  if (!/^[A-Z]{2}$/.test(pais)) throw new ErrorDatos('País inválido.', 'pais');
  const cfg = await leerCuerpo(c, esquemaConfigLocales);
  if (cfg.minimo > cfg.maximo)
    throw new ErrorDatos('El mínimo no puede ser mayor que el máximo.', 'minimo', 409);
  const db = base(c);
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(claveConfig(pais), JSON.stringify(cfg)),
    sentenciaAuditoriaFin(db, {
      actorId: u.id,
      accion: 'recarga_local.config',
      objeto: pais,
      detalle: cfg,
    }),
  ]);
  return c.json({ config: cfg });
});

flexRecargasLocalesAdmin.get(ADMIN, async (c) => {
  exigir(c, 'admin');
  const estado = c.req.query('estado') ?? 'pendiente';
  const db = base(c);
  // Las pendientes por su índice parcial; las demás, las últimas 100.
  const { results } = await db
    .prepare(
      estado === 'pendiente'
        ? `SELECT r.*, e.nombre AS empresa FROM recargas_locales_empresa r JOIN empresas e ON e.id = r.empresa_id
            WHERE r.estado = 'pendiente' ORDER BY r.creado_en LIMIT 100`
        : `SELECT r.*, e.nombre AS empresa FROM recargas_locales_empresa r JOIN empresas e ON e.id = r.empresa_id
            ORDER BY r.rowid DESC LIMIT 100`,
    )
    .all<FilaLocal & { empresa: string }>();
  return c.json({
    recargas: results.map((r) => ({
      ...recargaLocalPublica(r),
      empresaId: r.empresa_id,
      empresa: r.empresa,
      pais: r.pais,
    })),
  });
});

async function recargaLocal(db: D1Database, id: string) {
  const r = await db
    .prepare('SELECT * FROM recargas_locales_empresa WHERE id = ?')
    .bind(id)
    .first<FilaLocal>();
  if (!r) throw new ErrorDatos('Esa recarga no existe.', undefined, 404);
  return r;
}

/** La foto del comprobante, solo para el equipo (privada, sin caché). */
flexRecargasLocalesAdmin.get(`${ADMIN}/:rid/comprobante`, async (c) => {
  exigir(c, 'admin');
  const r = await recargaLocal(base(c), c.req.param('rid'));
  const obj = c.env.BUCKET ? await c.env.BUCKET.get(r.comprobante_clave) : null;
  if (!obj) throw new ErrorDatos('La foto del comprobante no está disponible.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/webp',
      'cache-control': 'private, no-store',
    },
  });
});

/** Una fila del libro que SOLO se escribe si el token de esta revisión quedó en la recarga. */
function libroSiGano(
  db: D1Database,
  p: {
    recargaId: string;
    token: string;
    e: { id: string; pais: string; moneda: string };
    bolsillo: 'prepago' | 'deuda_cliente';
    monto: number;
    concepto: string;
    referencia: string;
    autorId: string;
  },
) {
  if (!Number.isSafeInteger(p.monto)) throw new Error('recarga local: monto inválido');
  return db
    .prepare(
      `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, pedido_id, referencia, autor_id)
       SELECT ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?
        WHERE EXISTS (SELECT 1 FROM recargas_locales_empresa WHERE id = ? AND estado = 'acreditada' AND revision_token = ?)`,
    )
    .bind(
      crypto.randomUUID(),
      cuentaEmpresa(p.e.id),
      p.bolsillo,
      p.e.pais,
      p.e.moneda,
      p.monto,
      p.concepto,
      p.referencia,
      p.autorId,
      p.recargaId,
      p.token,
    );
}

/** Una sentencia cualquiera que SOLO corre si el token de esta revisión quedó en la recarga. */
const siGano = (id = '?', token = '?') =>
  `EXISTS (SELECT 1 FROM recargas_locales_empresa WHERE id = ${id} AND estado = 'acreditada' AND revision_token = ${token})`;

/**
 * Acredita UNA vez, en UNA sola transacción: cambio de estado, libro, comprobante numerado y
 * auditoría. Todo lo que sigue al UPDATE está condicionado a que esta revisión lo haya ganado.
 * La usa la ruta (bajo el umbral) y la aprobación del control dual (por encima).
 */
export async function acreditarRecargaLocal(db: D1Database, recargaId: string, autorId: string) {
  const r = await recargaLocal(db, recargaId);
  if (r.estado !== 'pendiente')
    throw new ErrorDatos(
      r.estado === 'acreditada' ? 'Esa recarga ya se acreditó.' : 'Esa recarga se rechazó.',
      undefined,
      409,
    );
  const e = await empresaFinanciera(db, r.empresa_id);
  if (e.pais !== r.pais || e.moneda !== r.moneda)
    throw new ErrorDatos(
      'La empresa cambió de país o de moneda: revisa la recarga.',
      undefined,
      409,
    );
  const token = crypto.randomUUID();
  const prefijo = `recarga_local:${r.id}`;
  const s = await saldoEmpresa(db, e);
  const aDeuda = Math.min(Math.max(s.deuda, 0), r.monto);
  const base_ = { recargaId: r.id, token, e, autorId };
  const anio = String(new Date().getUTCFullYear());
  const contador = `comprobantes:${anio}`;
  const lista: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE recargas_locales_empresa SET estado = 'acreditada', revisado_por = ?, revisado_en = datetime('now'),
           revision_token = ?, actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'`,
      )
      .bind(autorId, token, r.id),
  ];
  if (aDeuda > 0)
    lista.push(
      libroSiGano(db, {
        ...base_,
        bolsillo: 'deuda_cliente',
        monto: -aDeuda,
        concepto: 'recarga_empresa:pago_deuda',
        referencia: `${prefijo}:deuda`,
      }),
    );
  if (r.monto - aDeuda > 0)
    lista.push(
      libroSiGano(db, {
        ...base_,
        bolsillo: 'prepago',
        monto: r.monto - aDeuda,
        concepto: 'recarga_empresa',
        referencia: `${prefijo}:prepago`,
      }),
    );
  // El comprobante (mismo formato que `sentenciasComprobante`) y la auditoría, con la misma guarda.
  lista.push(
    db
      .prepare(
        `INSERT INTO contadores (clave, n) SELECT ?1, 1
          WHERE NOT EXISTS (SELECT 1 FROM comprobantes WHERE referencia = ?2) AND ${siGano('?3', '?4')}
         ON CONFLICT(clave) DO UPDATE SET n = n + 1`,
      )
      .bind(contador, prefijo, r.id, token),
    db
      .prepare(
        `INSERT OR IGNORE INTO comprobantes (id, numero, empresa_id, tipo, monto, pais, moneda, referencia, datos_json)
         SELECT ?1, 'DVX-' || ?2 || '-' || printf('%06d', (SELECT n FROM contadores WHERE clave = ?3)), ?4, 'recarga', ?5, ?6, ?7, ?8, ?9
          WHERE NOT EXISTS (SELECT 1 FROM comprobantes WHERE referencia = ?8) AND ${siGano('?10', '?11')}`,
      )
      .bind(
        crypto.randomUUID(),
        anio,
        contador,
        e.id,
        r.monto,
        e.pais,
        e.moneda,
        prefijo,
        JSON.stringify({ recargaLocalId: r.id, metodo: r.metodo, referencia: r.referencia }),
        r.id,
        token,
      ),
    db
      .prepare(
        `INSERT INTO finanzas_auditoria (actor_id, actor_tipo, accion, objeto, empresa_id, detalle_json)
         SELECT ?, 'usuario', 'recarga_local.acreditar', ?, ?, ? WHERE ${siGano()}`,
      )
      .bind(
        autorId,
        r.id,
        e.id,
        JSON.stringify({ monto: r.monto, metodo: r.metodo, aDeuda }),
        r.id,
        token,
      ),
  );
  const res = await db.batch(lista);
  if (!res[0]?.meta.changes)
    throw new ErrorDatos('Esa recarga ya no está pendiente.', undefined, 409);
  return {
    recarga: recargaLocalPublica(await recargaLocal(db, r.id)),
    saldo: await saldoEmpresa(db, e),
  };
}

flexRecargasLocalesAdmin.post(`${ADMIN}/:rid/acreditar`, async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const r = await recargaLocal(db, c.req.param('rid'));
  if (r.estado !== 'pendiente')
    throw new ErrorDatos(
      r.estado === 'acreditada' ? 'Esa recarga ya se acreditó.' : 'Esa recarga se rechazó.',
      undefined,
      409,
    );
  // C-CONTROL-DUAL: bajo el umbral se acredita ya; por encima queda pendiente (202) para otra persona.
  return hacerOPedirAprobacion(c, {
    tipo: 'recarga_local',
    objeto: r.id,
    monto: r.monto,
    motivo: `Recarga con pago local ${r.metodo} ${r.referencia}`,
    datos: { recargaId: r.id },
  });
});

const esquemaRechazo = z.object({ motivo: z.string().trim().min(5).max(300) });

flexRecargasLocalesAdmin.post(`${ADMIN}/:rid/rechazar`, async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaRechazo);
  const db = base(c);
  const r = await recargaLocal(db, c.req.param('rid'));
  const res = await db
    .prepare(
      `UPDATE recargas_locales_empresa SET estado = 'rechazada', motivo = ?, revisado_por = ?, revisado_en = datetime('now'),
         actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'`,
    )
    .bind(d.motivo, u.id, r.id)
    .run();
  if (!res.meta.changes) throw new ErrorDatos('Esa recarga ya no está pendiente.', undefined, 409);
  await sentenciaAuditoriaFin(db, {
    actorId: u.id,
    accion: 'recarga_local.rechazar',
    objeto: r.id,
    empresaId: r.empresa_id,
    detalle: { motivo: d.motivo },
  }).run();
  return c.json({ recarga: recargaLocalPublica(await recargaLocal(db, r.id)) });
});
