import type { Context } from 'hono';
import {
  PERMISOS_CLAVE_API,
  PERMISOS_POR_ROL,
  type PermisoFlex,
  type RolEmpresa,
} from '@tumbite/compartido';
import { sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

export type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

/** Quién actúa sobre una empresa: una persona con sesión (miembro) o una clave de integración. */
export type ActorFlex = {
  empresaId: string;
  permisos: readonly PermisoFlex[];
  /** Id de la cuenta (miembro) o de la clave de API. */
  actorId: string;
  actorTipo: 'usuario' | 'api';
  rol: RolEmpresa | null;
  idioma: 'es' | 'en';
};

/** Límite por clave de API: 60 peticiones por minuto por clave, en memoria del aislado. */
const LIMITE_CLAVE = 60;
const VENTANA_MS = 60_000;
const usoClaves = new Map<string, { cuenta: number; desde: number }>();
export function reiniciarLimiteClaves() {
  usoClaves.clear();
}

function limitarClave(claveId: string) {
  const ahora = Date.now();
  const r = usoClaves.get(claveId);
  if (!r || ahora - r.desde > VENTANA_MS) usoClaves.set(claveId, { cuenta: 1, desde: ahora });
  else if (++r.cuenta > LIMITE_CLAVE)
    throw new ErrorDatos(
      'Too many requests with this API key. Try again in a minute.',
      undefined,
      429,
    );
}

export const CABECERA_CLAVE = 'x-api-key';
export const CABECERA_IDEMPOTENCIA = 'idempotency-key';

/**
 * Resuelve quién actúa sobre la empresa y con qué permisos. Nunca por correo: solo una fila
 * activa en empresa_miembros o una clave de API activa de ESA empresa. Lo ajeno responde 404.
 */
export async function actorDeEmpresa(c: Ctx, empresaId: string): Promise<ActorFlex> {
  const db = base(c);
  const clave = c.req.header(CABECERA_CLAVE);
  const idioma = (c.req.header('x-idioma') === 'es' ? 'es' : 'en') as 'es' | 'en';
  if (clave) {
    const hash = await sha256(clave);
    const f = await db
      .prepare(
        "SELECT id, empresa_id, permisos FROM empresa_claves WHERE clave_hash = ? AND estado = 'activa'",
      )
      .bind(hash)
      .first<{ id: string; empresa_id: string; permisos: string }>();
    // Clave inválida, revocada o de OTRA empresa: la misma respuesta, sin decir cuál fue.
    if (!f || f.empresa_id !== empresaId)
      throw new ErrorDatos('Invalid API key for this company.', undefined, 401);
    limitarClave(f.id);
    let permisos: PermisoFlex[];
    try {
      permisos = (JSON.parse(f.permisos) as PermisoFlex[]).filter((p) =>
        PERMISOS_CLAVE_API.includes(p),
      );
    } catch {
      permisos = [];
    }
    // Uso contado sin revelar la clave (ni en logs ni en la base).
    await db
      .prepare(
        "UPDATE empresa_claves SET usos = usos + 1, ultimo_uso_en = datetime('now') WHERE id = ?",
      )
      .bind(f.id)
      .run();
    return { empresaId, permisos, actorId: f.id, actorTipo: 'api', rol: null, idioma };
  }
  const u = exigir(c);
  const m = await db
    .prepare(
      `SELECT m.rol FROM empresa_miembros m JOIN empresas e ON e.id = m.empresa_id
       WHERE m.empresa_id = ? AND m.usuario_id = ? AND m.estado = 'activo' AND e.estado <> 'cerrada'`,
    )
    .bind(empresaId, u.id)
    .first<{ rol: RolEmpresa }>();
  if (!m) throw new ErrorDatos('Esa empresa no existe.', undefined, 404);
  return {
    empresaId,
    permisos: PERMISOS_POR_ROL[m.rol],
    actorId: u.id,
    actorTipo: 'usuario',
    rol: m.rol,
    idioma: (u.idioma === 'es' ? 'es' : 'en') as 'es' | 'en',
  };
}

export function exigirPermiso(actor: ActorFlex, permiso: PermisoFlex): void {
  if (!actor.permisos.includes(permiso))
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
}

/** Sentencia de auditoría de la empresa, para meter en el mismo batch que el cambio. */
export function sentenciaAuditoria(
  db: D1Database,
  actor:
    | Pick<ActorFlex, 'empresaId' | 'actorId' | 'actorTipo'>
    | { empresaId: string; actorId: string | null; actorTipo: 'usuario' | 'api' | 'sistema' },
  accion: string,
  objeto: string,
  detalle?: unknown,
): D1PreparedStatement {
  return db
    .prepare(
      'INSERT INTO empresa_auditoria (empresa_id, actor_id, actor_tipo, accion, objeto, detalle_json) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      actor.empresaId,
      actor.actorId,
      actor.actorTipo,
      accion,
      objeto,
      JSON.stringify(detalle ?? null),
    );
}

/**
 * Idempotencia de las rutas que crean cosas: la cabecera `Idempotency-Key` es obligatoria.
 * La misma clave con el mismo cuerpo devuelve la MISMA respuesta (sin crear nada otra vez);
 * con otro cuerpo responde 409; mientras la primera está en proceso, también 409.
 */
export async function conIdempotencia(
  c: Ctx,
  actor: ActorFlex,
  cuerpo: unknown,
  hacer: () => Promise<{ estado: 200 | 201; datos: unknown }>,
): Promise<Response> {
  const clave = c.req.header(CABECERA_IDEMPOTENCIA)?.trim() ?? '';
  if (!clave || clave.length > 200)
    throw new ErrorDatos(
      'Falta la cabecera Idempotency-Key (una clave única por operación, hasta 200 caracteres).',
      undefined,
      400,
    );
  const db = base(c);
  const ruta = c.req.path;
  const huella = await sha256(`${ruta}\n${JSON.stringify(cuerpo ?? null)}`);
  // Se reserva la clave ANTES de hacer nada: dos peticiones iguales a la vez no crean dos cosas.
  const reserva = await db
    .prepare(
      'INSERT OR IGNORE INTO idempotencia_flex (empresa_id, clave, ruta, cuerpo_hash, estado, respuesta_json) VALUES (?, ?, ?, ?, 0, ?)',
    )
    .bind(actor.empresaId, clave, ruta, huella, 'null')
    .run();
  if (!reserva.meta.changes) {
    const previa = await db
      .prepare(
        'SELECT ruta, cuerpo_hash, estado, respuesta_json FROM idempotencia_flex WHERE empresa_id = ? AND clave = ?',
      )
      .bind(actor.empresaId, clave)
      .first<{ ruta: string; cuerpo_hash: string; estado: number; respuesta_json: string }>();
    if (!previa || previa.cuerpo_hash !== huella || previa.ruta !== ruta)
      throw new ErrorDatos(
        'Esa Idempotency-Key ya se usó con otros datos. Usa una clave nueva.',
        undefined,
        409,
      );
    if (previa.estado === 0)
      throw new ErrorDatos('Esa operación todavía se está procesando.', undefined, 409);
    return c.json(JSON.parse(previa.respuesta_json), previa.estado as 200 | 201);
  }
  try {
    const r = await hacer();
    await db
      .prepare(
        'UPDATE idempotencia_flex SET estado = ?, respuesta_json = ? WHERE empresa_id = ? AND clave = ?',
      )
      .bind(r.estado, JSON.stringify(r.datos), actor.empresaId, clave)
      .run();
    return c.json(r.datos, r.estado);
  } catch (e) {
    // Si falló, la clave se libera para que se pueda reintentar con los mismos datos.
    await db
      .prepare('DELETE FROM idempotencia_flex WHERE empresa_id = ? AND clave = ? AND estado = 0')
      .bind(actor.empresaId, clave)
      .run();
    throw e;
  }
}

/** Sin ids secuenciales ni adivinables: UUID de la plataforma. */
export const nuevoIdFlex = () => crypto.randomUUID();
export const bytesAleatorios = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function tieneCorreoConfirmado(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT correo_confirmado_en FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ correo_confirmado_en: string | null }>();
  return Boolean(f?.correo_confirmado_en);
}
