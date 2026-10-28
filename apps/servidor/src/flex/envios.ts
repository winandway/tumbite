import { Hono } from 'hono';
import { z } from 'zod';
import {
  ESTADOS_FINALES_PAQUETE,
  ESTADOS_PAQUETE,
  type EstadoPaquete,
  codigoPlus,
  contenidoQrEtiqueta,
  MONEDAS_COBRO,
  documentoValido,
  perfilFlex,
  nuevoCodigoEtiqueta,
  nuevoCodigoSeguimiento,
  puedeTransitar,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import {
  ESTADOS_CERRADOS,
  paisDeEmpresa,
  ubicacionInicial,
  vincularDestinatarios,
} from './ubicacion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  type ActorFlex,
  actorDeEmpresa,
  bytesAleatorios,
  conIdempotencia,
  exigirPermiso,
  nuevoIdFlex,
  sentenciaAuditoria,
} from './autorizacion';

/**
 * Divoox Flex · envíos, paquetes, eventos de custodia y etiquetas. Un envío = un destino con
 * uno o varios paquetes. La creación es atómica (envío + paquetes + evento inicial en un lote).
 * Los estados los vigila la base (transiciones_paquete) y el código (puedeTransitar).
 */
export const flexEnvios = new Hono<{ Bindings: Env; Variables: Variables }>();

const fechaHora = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}/, 'Fecha y hora con el formato 2026-10-27T14:00');
const esquemaPaquete = z.object({
  pesoG: z.number().int().min(0).max(1_000_000).nullable().optional(),
  largoCm: z.number().int().min(0).max(1000).nullable().optional(),
  anchoCm: z.number().int().min(0).max(1000).nullable().optional(),
  altoCm: z.number().int().min(0).max(1000).nullable().optional(),
  descripcion: z.string().trim().max(200).default(''),
});
export const esquemaEnvio = z.object({
  centroId: z.string().uuid().nullable().optional(),
  referenciaExterna: z.string().trim().min(1).max(80).nullable().optional(),
  remitenteNombre: z.string().trim().max(120).default(''),
  destinatarioNombre: z.string().trim().min(1).max(120),
  destinatarioTelefono: z.string().trim().max(32).default(''),
  // Fase 5 (C-FLEX-UBICACION): con correo o teléfono se encuentra al destinatario en Divoox.
  destinatarioCorreo: z.string().trim().max(120).default(''),
  /** Cédula o RIF en Venezuela. */
  destinatarioDocumento: z.string().trim().max(20).default(''),
  /** Puntos de referencia («casa azul frente a la panadería»). */
  referencias: z.string().trim().max(300).default(''),
  /** Fase 6 (C-FLEX-COBRO): lo que el conductor cobra al entregar, en la unidad menor de la moneda. */
  cobro: z
    .object({
      monto: z.number().int().positive().max(1_000_000_000),
      moneda: z.enum(MONEDAS_COBRO),
    })
    .nullable()
    .optional(),
  direccion: z.string().trim().min(3).max(300),
  /** C-FLEX-RETIRO: «domicilio» (por defecto) o «punto»: se retira en un centro de la empresa. */
  entrega: z.enum(['domicilio', 'punto']).default('domicilio'),
  puntoCentroId: z.string().uuid().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  instrucciones: z.string().trim().max(500).default(''),
  ventanaDesde: fechaHora.nullable().optional(),
  ventanaHasta: fechaHora.nullable().optional(),
  paquetes: z
    .array(esquemaPaquete)
    .min(1)
    .max(50)
    .default([{ descripcion: '' }]),
});
const esquemaLoteEnvios = z.object({ envios: z.array(esquemaEnvio).min(1).max(25) });
const esquemaEvento = z.object({
  tipo: z.enum(ESTADOS_PAQUETE),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  nota: z.string().trim().max(300).optional(),
  operacionRef: z.string().trim().max(80).nullable().optional(),
});

const filaEnvio = (f: Record<string, unknown>) => ({
  id: f.id,
  centroId: f.centro_id,
  referenciaExterna: f.referencia_externa,
  remitenteNombre: f.remitente_nombre,
  destinatarioNombre: f.destinatario_nombre,
  destinatarioTelefono: f.destinatario_telefono,
  direccion: f.direccion,
  lat: f.lat,
  lng: f.lng,
  instrucciones: f.instrucciones,
  // Fase 5 (C-FLEX-UBICACION).
  destinatarioCorreo: f.destinatario_correo ?? '',
  destinatarioDocumento: f.destinatario_documento ?? '',
  referencias: f.referencias ?? '',
  ubicacionEstado: f.ubicacion_estado ?? 'sin_coordenadas',
  ubicacionFuente: f.ubicacion_fuente ?? '',
  ubicacionConfirmadaEn: f.ubicacion_confirmada_en ?? null,
  destinatarioEnDivoox: Boolean(f.destinatario_usuario_id),
  // Fase 6 (C-FLEX-COBRO).
  cobro: filaCobro(f),
  // C-FLEX-RETIRO.
  entrega: (f.entrega_tipo as string) ?? 'domicilio',
  puntoCentroId: (f.punto_centro_id as string | null) ?? null,
  retiroDisponibleEn: (f.retiro_disponible_en as string | null) ?? null,
  retiroVence: (f.retiro_vence as string | null) ?? null,
  ventanaDesde: f.ventana_desde,
  ventanaHasta: f.ventana_hasta,
  estado: f.estado,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
  paquetes: f.paquetes,
});
/** El cobro contra entrega de un envío (null si no lleva). */
export function filaCobro(f: Record<string, unknown>) {
  if (!f.cobro_monto) return null;
  return {
    monto: f.cobro_monto as number,
    moneda: f.cobro_moneda as string,
    estado: (f.cobro_estado as string) ?? 'pendiente',
    metodo: (f.cobro_metodo as string | null) ?? null,
    montoRecibido: (f.cobro_monto_recibido as number | null) ?? null,
    monedaRecibida: (f.cobro_moneda_recibida as string | null) ?? null,
    referencia: (f.cobro_referencia as string | null) ?? null,
    cobradoEn: (f.cobrado_en as string | null) ?? null,
    liquidadoEn: (f.liquidado_en as string | null) ?? null,
  };
}
const filaPaquete = (f: Record<string, unknown>) => ({
  id: f.id,
  envioId: f.envio_id,
  codigoSeguimiento: f.codigo_seguimiento,
  codigoEtiqueta: f.codigo_etiqueta,
  pesoG: f.peso_g,
  largoCm: f.largo_cm,
  anchoCm: f.ancho_cm,
  altoCm: f.alto_cm,
  descripcion: f.descripcion,
  estado: f.estado,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});
const filaEvento = (f: Record<string, unknown>) => ({
  id: f.id,
  tipo: f.tipo,
  actorTipo: f.actor_tipo,
  actor:
    f.actor_nombre ??
    (f.actor_tipo === 'api' ? 'API' : f.actor_tipo === 'sistema' ? 'Sistema' : null),
  lat: f.lat,
  lng: f.lng,
  operacionRef: f.operacion_ref,
  metadatos: JSON.parse(String(f.metadatos_json ?? 'null')),
  creadoEn: f.creado_en,
});

type EnvioEntrada = z.infer<typeof esquemaEnvio>;

/** Sentencias para crear un envío con sus paquetes y su evento inicial (van en un solo lote). */
export function sentenciasDeEnvio(
  db: D1Database,
  actor: Pick<ActorFlex, 'empresaId' | 'actorId' | 'actorTipo'>,
  d: EnvioEntrada,
  origen: string,
  pais = 'US',
): {
  id: string;
  paquetes: { id: string; codigoSeguimiento: string; codigoEtiqueta: string }[];
  sentencias: D1PreparedStatement[];
} {
  const id = nuevoIdFlex();
  const ubic = ubicacionInicial(pais, d, origen);
  const sentencias: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO envios (id, empresa_id, centro_id, referencia_externa, remitente_nombre, destinatario_nombre,
         destinatario_telefono, direccion, lat, lng, instrucciones, ventana_desde, ventana_hasta,
         destinatario_correo, destinatario_documento, referencias, ubicacion_estado, ubicacion_fuente,
         ubicacion_confirmada_en, cobro_monto, cobro_moneda, cobro_estado, entrega_tipo, punto_centro_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        actor.empresaId,
        d.centroId ?? null,
        d.referenciaExterna ?? null,
        d.remitenteNombre,
        d.destinatarioNombre,
        d.destinatarioTelefono,
        d.direccion,
        d.lat ?? null,
        d.lng ?? null,
        d.instrucciones,
        d.ventanaDesde ?? null,
        d.ventanaHasta ?? null,
        d.destinatarioCorreo,
        d.destinatarioDocumento,
        d.referencias,
        ubic.estado,
        ubic.fuente,
        ubic.confirmada ? 1 : 0,
        d.cobro?.monto ?? null,
        d.cobro?.moneda ?? null,
        d.cobro ? 'pendiente' : 'sin_cobro',
        d.entrega,
        d.entrega === 'punto' ? (d.puntoCentroId ?? d.centroId ?? null) : null,
      ),
  ];
  const paquetes = d.paquetes.map((p) => {
    const pid = nuevoIdFlex();
    const codigoSeguimiento = nuevoCodigoSeguimiento(bytesAleatorios);
    const codigoEtiqueta = nuevoCodigoEtiqueta(bytesAleatorios);
    sentencias.push(
      db
        .prepare(
          `INSERT INTO paquetes (id, envio_id, empresa_id, codigo_seguimiento, codigo_etiqueta, peso_g, largo_cm, ancho_cm, alto_cm, descripcion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          pid,
          id,
          actor.empresaId,
          codigoSeguimiento,
          codigoEtiqueta,
          p.pesoG ?? null,
          p.largoCm ?? null,
          p.anchoCm ?? null,
          p.altoCm ?? null,
          p.descripcion,
        ),
      db
        .prepare(
          `INSERT INTO paquete_eventos (paquete_id, empresa_id, tipo, actor_id, actor_tipo, idempotencia, metadatos_json)
           VALUES (?, ?, 'creado', ?, ?, ?, ?)`,
        )
        .bind(
          pid,
          actor.empresaId,
          actor.actorId,
          actor.actorTipo,
          `creado:${pid}`,
          JSON.stringify({ origen }),
        ),
    );
    return { id: pid, codigoSeguimiento, codigoEtiqueta };
  });
  sentencias.push(
    sentenciaAuditoria(db, actor, 'envio.crear', id, {
      referencia: d.referenciaExterna ?? null,
      paquetes: paquetes.length,
      origen,
    }),
  );
  return { id, paquetes, sentencias };
}

/**
 * Lo que el perfil del país exige de un envío (CADA PAÍS ES SU PROPIO SISTEMA): la cédula o el RIF
 * con su forma (Fase 5) y el cobro contra entrega solo donde se usa, en una moneda del país (Fase 6).
 */
export function errorDelPais(
  pais: string,
  d: Pick<EnvioEntrada, 'destinatarioDocumento' | 'cobro'>,
): { campo: string; mensaje: string } | null {
  if (d.destinatarioDocumento && !documentoValido(pais, d.destinatarioDocumento))
    return {
      campo: 'destinatarioDocumento',
      mensaje: 'El documento del destinatario no tiene una forma válida (por ejemplo V-12345678).',
    };
  const perfil = perfilFlex(pais);
  if (d.cobro && !perfil.cobroContraEntrega)
    return { campo: 'cobro', mensaje: 'En este país Flex no lleva cobro contra entrega.' };
  if (d.cobro && !perfil.monedas.includes(d.cobro.moneda))
    return {
      campo: 'cobro',
      mensaje: `El cobro va en ${perfil.monedas.join(' o ')}.`,
    };
  return null;
}

function exigirReglasDelPais(
  pais: string,
  d: Pick<EnvioEntrada, 'destinatarioDocumento' | 'cobro'>,
) {
  const e = errorDelPais(pais, d);
  if (e) throw new ErrorDatos(e.mensaje, e.campo, 422);
}

/** C-FLEX-RETIRO: el punto de retiro es un centro activo de la empresa. */
async function comprobarPunto(
  db: D1Database,
  empresaId: string,
  d: Pick<EnvioEntrada, 'entrega' | 'puntoCentroId' | 'centroId'>,
) {
  if (d.entrega !== 'punto') return;
  const punto = d.puntoCentroId ?? d.centroId;
  if (!punto)
    throw new ErrorDatos('Elige el centro donde se retira el paquete.', 'puntoCentroId', 422);
  await comprobarCentro(db, empresaId, punto);
}

async function comprobarCentro(
  db: D1Database,
  empresaId: string,
  centroId: string | null | undefined,
) {
  if (!centroId) return;
  const f = await db
    .prepare("SELECT 1 FROM empresa_centros WHERE id = ? AND empresa_id = ? AND estado = 'activo'")
    .bind(centroId, empresaId)
    .first();
  if (!f) throw new ErrorDatos('Ese centro no existe en tu empresa.', 'centroId', 404);
}

function errorUnico(e: unknown): never {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes('envios_referencia_unica') || msg.includes('referencia_externa'))
    throw new ErrorDatos(
      'Ya existe un envío con esa referencia externa en tu empresa.',
      'referenciaExterna',
      409,
    );
  if (msg.includes('codigo_seguimiento') || msg.includes('codigo_etiqueta'))
    throw new ErrorDatos('El código generado chocó con otro. Vuelve a intentar.', undefined, 409);
  throw e;
}

async function envioCompleto(db: D1Database, empresaId: string, id: string) {
  const f = await db
    .prepare('SELECT * FROM envios WHERE id = ? AND empresa_id = ?')
    .bind(id, empresaId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Ese envío no existe.', undefined, 404);
  const p = await db
    .prepare('SELECT * FROM paquetes WHERE envio_id = ? ORDER BY creado_en, id')
    .bind(id)
    .all<Record<string, unknown>>();
  return {
    ...filaEnvio({ ...f, paquetes: p.results.map(filaPaquete) }),
    // El panel solo ofrece pedir o marcar la ubicación mientras se puede cambiar (C-FLEX-UBICACION).
    ubicacionEditable: !p.results.some((x) => ESTADOS_CERRADOS.includes(String(x.estado))),
  };
}

// ───────────────────────────── Crear ─────────────────────────────

flexEnvios.post('/empresas/:id/envios', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.crear');
  const d = await leerCuerpo(c, esquemaEnvio);
  const db = base(c);
  await comprobarCentro(db, actor.empresaId, d.centroId);
  await comprobarPunto(db, actor.empresaId, d);
  return conIdempotencia(c, actor, d, async () => {
    const pais = await paisDeEmpresa(db, actor.empresaId);
    exigirReglasDelPais(pais, d);
    const { id, sentencias } = sentenciasDeEnvio(
      db,
      actor,
      d,
      actor.actorTipo === 'api' ? 'api' : 'panel',
      pais,
    );
    await db.batch(sentencias).catch(errorUnico);
    await vincularDestinatarios(db, [id], pais);
    return { estado: 201, datos: { envio: await envioCompleto(db, actor.empresaId, id) } };
  });
});

/** Varios envíos en una llamada (hasta 25): o se crean todos o ninguno. */
flexEnvios.post('/empresas/:id/envios/lote', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.crear');
  const d = await leerCuerpo(c, esquemaLoteEnvios);
  const db = base(c);
  const refs = d.envios.map((e) => e.referenciaExterna).filter((r): r is string => Boolean(r));
  if (new Set(refs).size !== refs.length)
    throw new ErrorDatos(
      'Hay referencias externas repetidas dentro del mismo lote.',
      'envios',
      409,
    );
  for (const e of d.envios) {
    await comprobarCentro(db, actor.empresaId, e.centroId);
    await comprobarPunto(db, actor.empresaId, e);
  }
  return conIdempotencia(c, actor, d, async () => {
    const pais = await paisDeEmpresa(db, actor.empresaId);
    for (const e of d.envios) exigirReglasDelPais(pais, e);
    const creados = d.envios.map((e) =>
      sentenciasDeEnvio(db, actor, e, actor.actorTipo === 'api' ? 'api' : 'panel', pais),
    );
    await db.batch(creados.flatMap((x) => x.sentencias)).catch(errorUnico);
    await vincularDestinatarios(
      db,
      creados.map((x) => x.id),
      pais,
    );
    return {
      estado: 201,
      datos: { envios: creados.map((x) => ({ id: x.id, paquetes: x.paquetes })) },
    };
  });
});

// ───────────────────────────── Consultar ─────────────────────────────

const PAGINA = 50;
const esquemaLista = z.object({
  estado: z.string().max(32).optional(),
  q: z.string().trim().max(80).optional(),
  centro: z.string().max(64).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

flexEnvios.get('/empresas/:id/envios', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const q = esquemaLista.parse(c.req.query());
  const db = base(c);
  const condiciones = ['e.empresa_id = ?'];
  const valores: unknown[] = [actor.empresaId];
  if (q.estado) {
    condiciones.push('e.estado = ?');
    valores.push(q.estado);
  }
  if (q.q) {
    condiciones.push(
      '(e.referencia_externa LIKE ? OR e.destinatario_nombre LIKE ? OR e.direccion LIKE ?)',
    );
    const like = `%${q.q}%`;
    valores.push(like, like, like);
  }
  const { results } = await db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM paquetes p WHERE p.envio_id = e.id) AS paquetes,
         (SELECT COUNT(*) FROM paquetes p WHERE p.envio_id = e.id AND p.estado = 'entregado') AS entregados
       FROM envios e WHERE ${condiciones.join(' AND ')} ORDER BY e.creado_en DESC, e.id LIMIT ? OFFSET ?`,
    )
    .bind(...valores, PAGINA + 1, (q.pagina - 1) * PAGINA)
    .all<Record<string, unknown>>();
  return c.json({
    envios: results.slice(0, PAGINA).map((f) => ({ ...filaEnvio(f), entregados: f.entregados })),
    hayMas: results.length > PAGINA,
    pagina: q.pagina,
  });
});

flexEnvios.get('/empresas/:id/envios/:envioId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const envio = await envioCompleto(db, actor.empresaId, c.req.param('envioId'));
  const { results } = await db
    .prepare(
      `SELECT ev.*, u.nombre AS actor_nombre FROM paquete_eventos ev
       LEFT JOIN usuarios u ON u.id = ev.actor_id AND ev.actor_tipo = 'usuario'
       WHERE ev.paquete_id IN (SELECT id FROM paquetes WHERE envio_id = ?) ORDER BY ev.id`,
    )
    .bind(envio.id)
    .all<Record<string, unknown>>();
  return c.json({
    envio,
    eventos: results.map((f) => ({ ...filaEvento(f), paqueteId: f.paquete_id })),
  });
});

flexEnvios.get('/empresas/:id/paquetes', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const q = esquemaLista.parse(c.req.query());
  const db = base(c);
  const condiciones = ['p.empresa_id = ?'];
  const valores: unknown[] = [actor.empresaId];
  if (q.estado) {
    condiciones.push('p.estado = ?');
    valores.push(q.estado);
  }
  if (q.q) {
    condiciones.push(
      '(p.codigo_seguimiento LIKE ? OR p.codigo_etiqueta LIKE ? OR e.referencia_externa LIKE ? OR e.destinatario_nombre LIKE ?)',
    );
    const like = `%${q.q}%`;
    valores.push(like, like, like, like);
  }
  if (q.centro) {
    condiciones.push('e.centro_id = ?');
    valores.push(q.centro);
  }
  const { results } = await db
    .prepare(
      `SELECT p.*, e.referencia_externa, e.destinatario_nombre, e.direccion, e.centro_id, e.estado AS envio_estado
       FROM paquetes p JOIN envios e ON e.id = p.envio_id WHERE ${condiciones.join(' AND ')}
       ORDER BY p.creado_en DESC, p.id LIMIT ? OFFSET ?`,
    )
    .bind(...valores, PAGINA + 1, (q.pagina - 1) * PAGINA)
    .all<Record<string, unknown>>();
  return c.json({
    paquetes: results.slice(0, PAGINA).map((f) => ({
      ...filaPaquete(f),
      referenciaExterna: f.referencia_externa,
      destinatarioNombre: f.destinatario_nombre,
      direccion: f.direccion,
      centroId: f.centro_id ?? null,
    })),
    hayMas: results.length > PAGINA,
    pagina: q.pagina,
  });
});

async function paqueteDe(db: D1Database, empresaId: string, paqueteId: string) {
  const f = await db
    .prepare('SELECT * FROM paquetes WHERE id = ? AND empresa_id = ?')
    .bind(paqueteId, empresaId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Ese paquete no existe.', undefined, 404);
  return f;
}

async function eventosDe(db: D1Database, paqueteId: string) {
  const { results } = await db
    .prepare(
      `SELECT ev.*, u.nombre AS actor_nombre FROM paquete_eventos ev
       LEFT JOIN usuarios u ON u.id = ev.actor_id AND ev.actor_tipo = 'usuario'
       WHERE ev.paquete_id = ? ORDER BY ev.id`,
    )
    .bind(paqueteId)
    .all<Record<string, unknown>>();
  return results.map(filaEvento);
}

flexEnvios.get('/empresas/:id/paquetes/:paqueteId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const f = await paqueteDe(db, actor.empresaId, c.req.param('paqueteId'));
  const envio = await envioCompleto(db, actor.empresaId, String(f.envio_id));
  return c.json({ paquete: filaPaquete(f), envio, eventos: await eventosDe(db, String(f.id)) });
});

/** Datos de la etiqueta: identificador opaco (QR y barras), referencia y lo mínimo para repartir. */
flexEnvios.get('/empresas/:id/paquetes/:paqueteId/etiqueta', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const f = await paqueteDe(db, actor.empresaId, c.req.param('paqueteId'));
  const e = await db
    .prepare(
      `SELECT e.referencia_externa, e.destinatario_nombre, e.direccion, e.instrucciones, e.centro_id,
         e.referencias, e.lat, e.lng, e.ubicacion_estado, e.cobro_monto, e.cobro_moneda, e.cobro_estado,
         (SELECT nombre FROM empresa_centros WHERE id = e.centro_id) AS centro,
         (SELECT nombre FROM empresas WHERE id = e.empresa_id) AS empresa,
         (SELECT COUNT(*) FROM paquetes WHERE envio_id = e.id) AS total
       FROM envios e WHERE e.id = ?`,
    )
    .bind(f.envio_id)
    .first<Record<string, unknown>>();
  const orden = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM paquetes WHERE envio_id = ? AND (creado_en < ? OR (creado_en = ? AND id <= ?))',
    )
    .bind(f.envio_id, f.creado_en, f.creado_en, f.id)
    .first<{ n: number }>();
  // Ruta abierta del paquete (si ya está en una, aunque sea borrador): nombre, parada y total.
  // Solo lectura; un paquete excluido de esa ruta no la muestra.
  const enRuta = await db
    .prepare(
      `SELECT r.id, r.nombre, rp.orden,
         (SELECT COUNT(*) FROM ruta_paradas WHERE ruta_id = r.id) AS paradas
       FROM ruta_paradas rp JOIN rutas_flex r ON r.id = rp.ruta_id
       WHERE rp.envio_id = ?1 AND r.empresa_id = ?2
         AND r.estado NOT IN ('cancelada', 'completada', 'con_incidencias')
         AND NOT EXISTS (SELECT 1 FROM ruta_paquetes rq
           WHERE rq.ruta_id = r.id AND rq.paquete_id = ?3 AND rq.activo = 0)
       ORDER BY r.creado_en DESC, r.id DESC LIMIT 1`,
    )
    .bind(f.envio_id, actor.empresaId, f.id)
    .first<{ id: string; nombre: string; orden: number; paradas: number }>();
  return c.json({
    etiqueta: {
      paqueteId: f.id,
      codigoEtiqueta: f.codigo_etiqueta,
      codigoSeguimiento: f.codigo_seguimiento,
      qr: contenidoQrEtiqueta(String(f.codigo_etiqueta)),
      referenciaExterna: e?.referencia_externa ?? null,
      destinatarioNombre: e?.destinatario_nombre,
      direccion: e?.direccion,
      instrucciones: e?.instrucciones,
      // Fase 5: punto de referencia y código plus del punto exacto (Google Maps lo entiende sin internet).
      referencias: e?.referencias ?? '',
      codigoPlus: e?.lat != null && e.lng != null ? codigoPlus(Number(e.lat), Number(e.lng)) : null,
      ubicacionConfirmada: e?.ubicacion_estado === 'confirmada',
      // Fase 6: «COBRAR» en grande en la etiqueta (como MRW o Zoom con su cobro en destino).
      cobro: e?.cobro_monto
        ? { monto: e.cobro_monto as number, moneda: e.cobro_moneda as string }
        : null,
      centro: e?.centro ?? null,
      empresa: e?.empresa,
      pieza: orden?.n ?? 1,
      total: e?.total ?? 1,
      descripcion: f.descripcion,
      pesoG: f.peso_g,
      largoCm: f.largo_cm ?? null,
      anchoCm: f.ancho_cm ?? null,
      altoCm: f.alto_cm ?? null,
      ruta: enRuta
        ? {
            id: enRuta.id,
            nombre: enRuta.nombre,
            parada: enRuta.orden,
            paradas: enRuta.paradas,
          }
        : null,
    },
  });
});

/** Resolver lo que lee un escáner (QR «dvx:…» o barras): solo dentro de la empresa dueña. */
flexEnvios.get('/empresas/:id/etiquetas/:codigo', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const codigo = c.req.param('codigo').replace(/^dvx:/, '').trim().toUpperCase();
  const f = await db
    .prepare(
      'SELECT * FROM paquetes WHERE (codigo_etiqueta = ? OR codigo_seguimiento = ?) AND empresa_id = ?',
    )
    .bind(codigo, codigo, actor.empresaId)
    .first<Record<string, unknown>>();
  if (!f)
    throw new ErrorDatos('Ese código no corresponde a un paquete de tu empresa.', undefined, 404);
  return c.json({ paquete: filaPaquete(f), eventos: await eventosDe(db, String(f.id)) });
});

// ───────────────────────────── Eventos de custodia ─────────────────────────────

/** Estado del envío según sus paquetes (una sola sentencia, después de cada evento). */
/** El estado del envío según sus paquetes (una sola sentencia). */
const ESTADO_ENVIO = `estado = (
  SELECT CASE
    WHEN SUM(estado = 'entregado') = COUNT(*) THEN 'entregado'
    WHEN SUM(estado = 'cancelado') = COUNT(*) THEN 'cancelado'
    WHEN SUM(estado = 'devuelto') = COUNT(*) THEN 'devuelto'
    WHEN SUM(estado IN ('entregado','devuelto','cancelado')) = COUNT(*) THEN 'parcial'
    WHEN SUM(estado = 'entrega_fallida') > 0 AND SUM(estado IN ('en_transito','cargado','asignado','en_devolucion')) = 0 THEN 'fallido'
    WHEN SUM(estado <> 'creado') > 0 THEN 'en_proceso'
    ELSE 'creado' END FROM paquetes WHERE envio_id = envios.id
  ), actualizado_en = datetime('now')`;
const ACTUALIZAR_ENVIO = `UPDATE envios SET ${ESTADO_ENVIO} WHERE id = ?`;
/** Lo mismo para todos los envíos (paradas) de una ruta, de una vez. */
export const ACTUALIZAR_ENVIOS_DE_RUTA = `UPDATE envios SET ${ESTADO_ENVIO} WHERE id IN (SELECT envio_id FROM ruta_paradas WHERE ruta_id = ?)`;

flexEnvios.post('/empresas/:id/paquetes/:paqueteId/eventos', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'paquetes.eventos');
  const d = await leerCuerpo(c, esquemaEvento);
  const db = base(c);
  const paqueteId = c.req.param('paqueteId');
  // Primero el paquete (404 si es de otra empresa); la idempotencia va ANTES de mirar el estado,
  // para que repetir la misma petición devuelva la misma respuesta aunque el estado ya cambió.
  await paqueteDe(db, actor.empresaId, paqueteId);
  return conIdempotencia(c, actor, { ...d, paqueteId }, async () => {
    const f = await paqueteDe(db, actor.empresaId, paqueteId);
    const desde = String(f.estado) as EstadoPaquete;
    if (!puedeTransitar(desde, d.tipo))
      throw new ErrorDatos(`Un paquete «${desde}» no puede pasar a «${d.tipo}».`, 'tipo', 409);
    const clave = `evt:${actor.empresaId}:${c.req.header('idempotency-key')}`;
    const r = await db
      .batch([
        // La base vuelve a exigir la transición (disparador) y que el estado sea el que vimos.
        db
          .prepare(
            "UPDATE paquetes SET estado = ?, actualizado_en = datetime('now') WHERE id = ? AND estado = ?",
          )
          .bind(d.tipo, f.id, desde),
        db
          .prepare(
            `INSERT INTO paquete_eventos (paquete_id, empresa_id, tipo, actor_id, actor_tipo, lat, lng, operacion_ref, idempotencia, metadatos_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            f.id,
            actor.empresaId,
            d.tipo,
            actor.actorId,
            actor.actorTipo,
            d.lat ?? null,
            d.lng ?? null,
            d.operacionRef ?? null,
            clave,
            JSON.stringify(d.nota ? { nota: d.nota } : null),
          ),
        db.prepare(ACTUALIZAR_ENVIO).bind(f.envio_id),
      ])
      .catch((e: unknown) => {
        const msg = String(e instanceof Error ? e.message : e);
        if (msg.includes('transicion_de_paquete_no_permitida'))
          throw new ErrorDatos(`Un paquete «${desde}» no puede pasar a «${d.tipo}».`, 'tipo', 409);
        if (msg.includes('paquete_eventos.idempotencia'))
          throw new ErrorDatos('Ese evento ya se registró.', undefined, 409);
        throw e;
      });
    if (!r[0]?.meta.changes)
      throw new ErrorDatos(
        'El paquete cambió de estado mientras tanto. Vuelve a consultarlo.',
        undefined,
        409,
      );
    const nuevo = await paqueteDe(db, actor.empresaId, String(f.id));
    return {
      estado: 201,
      datos: { paquete: filaPaquete(nuevo), eventos: await eventosDe(db, String(f.id)) },
    };
  });
});

// ───────────────────────────── Seguimiento público ─────────────────────────────

/**
 * Seguimiento por código (lo que recibe el destinatario): solo el estado y las fechas.
 * Sin dirección, sin teléfono, sin coordenadas, sin nombres. El código es opaco (13 letras).
 */
flexEnvios.get('/seguimiento/:codigo', async (c) => {
  const db = base(c);
  const codigo = c.req.param('codigo').trim().toUpperCase();
  if (!/^DVX[A-Z2-9]{10}$/.test(codigo))
    throw new ErrorDatos('Ese código no existe.', undefined, 404);
  const f = await db
    .prepare(
      'SELECT id, estado, creado_en, actualizado_en FROM paquetes WHERE codigo_seguimiento = ?',
    )
    .bind(codigo)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Ese código no existe.', undefined, 404);
  const { results } = await db
    .prepare('SELECT tipo, creado_en FROM paquete_eventos WHERE paquete_id = ? ORDER BY id')
    .bind(f.id)
    .all<{ tipo: string; creado_en: string }>();
  return c.json({
    seguimiento: {
      codigo,
      estado: f.estado,
      final: ESTADOS_FINALES_PAQUETE.includes(String(f.estado) as EstadoPaquete),
      eventos: results.map((e) => ({ tipo: e.tipo, creadoEn: e.creado_en })),
    },
  });
});
