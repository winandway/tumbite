import {
  type AccesoInterno,
  type Alcance,
  type AsignacionInterna,
  type AjustePersona,
  ALCANCE_TOTAL,
  LISTA_RUTAS_ADMIN,
  PERFILES_INTERNOS,
  type PerfilInterno,
  PLANTILLAS_SISTEMA,
  SERVICIOS_ALCANCE,
  type ServicioAlcance,
  type Topes,
  alcanceEsTotal,
  calcularAcceso,
  servicioAlcanceDeOperacion,
  enmascararCorreo,
  enmascararTelefono,
  puedeVer,
} from '@tumbite/compartido';
import { z } from 'zod';
import type { Env } from './env';
import type { Ctx } from './sesion';
import { ErrorDatos } from './validar';

/**
 * C-PERMISOS-FINOS (MON-5, 15 nov 2026) — todos los países. Los permisos efectivos de cada persona
 * del equipo, calculados UNA vez por sesión y guardados en la propia sesión (`sesiones.permisos_json`).
 * `cargarSesion` ya lee la sesión en cada petición: así comprobar un permiso no cuesta ninguna
 * lectura de más. Un cambio de permisos borra ese cálculo (`renovarSesionesDe`) y la siguiente
 * petición lo rehace; suspender o quitar el acceso cierra las sesiones (`cerrarSesionesDe`).
 */

/** Cambia si cambia el mapa de rutas o las plantillas de fábrica: los cálculos viejos se rehacen. */
export const HUELLA_PERMISOS = (() => {
  const texto = JSON.stringify([LISTA_RUTAS_ADMIN, PLANTILLAS_SISTEMA]);
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
  return `p1-${(h >>> 0).toString(36)}`;
})();

export type AccesoEnSesion = AccesoInterno & { huella: string };

const esquemaAlcance = z
  .object({
    paises: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .max(50)
      .nullable()
      .optional(),
    zonas: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,60}$/))
      .max(200)
      .nullable()
      .optional(),
    servicios: z.array(z.enum(SERVICIOS_ALCANCE)).max(10).nullable().optional(),
  })
  .strict();
export { esquemaAlcance };

/** Lee un alcance guardado. Uno dañado no abre todo: se queda sin nada (y queda en el registro). */
export function leerAlcance(texto: string | null | undefined): Alcance {
  if (!texto) return ALCANCE_TOTAL;
  try {
    const a = esquemaAlcance.parse(JSON.parse(texto));
    return {
      paises: a.paises?.length ? a.paises : null,
      zonas: a.zonas?.length ? a.zonas : null,
      servicios: a.servicios?.length ? a.servicios : null,
    };
  } catch (e) {
    console.error('equipo: alcance guardado no válido; la asignación queda sin ciudades', e);
    return { paises: [], zonas: ['-'], servicios: [] };
  }
}

function leerLista(texto: string | null | undefined): string[] {
  try {
    const v = JSON.parse(texto ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch (e) {
    console.error('equipo: lista de permisos guardada no válida', e);
    return [];
  }
}

function leerTopes(texto: string | null | undefined): Topes | null {
  if (!texto) return null;
  try {
    return z.record(z.string(), z.number().int().min(0)).parse(JSON.parse(texto));
  } catch (e) {
    console.error('equipo: topes guardados no válidos; se usan 0', e);
    return {};
  }
}

export function esDueno(env: Pick<Env, 'ADMIN_CORREOS'>, correo: string): boolean {
  return (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(correo.trim().toLowerCase());
}

/** Una plantilla: la guardada (si alguien la editó o la creó) o la de fábrica. */
export type PlantillaLeida = {
  id: string;
  nombre: { es: string; en: string };
  descripcion: { es: string; en: string };
  permisos: string[];
  topes: Topes | null;
  sistema: boolean;
};

export function plantillaDeFila(
  id: string,
  f: {
    nombre_es: string | null;
    nombre_en: string | null;
    descripcion_es: string | null;
    descripcion_en: string | null;
    permisos_json: string | null;
    topes_json: string | null;
  } | null,
): PlantillaLeida | null {
  const fabrica = PLANTILLAS_SISTEMA.find((p) => p.id === id);
  // «Total» es todo, siempre: no se edita (si no, el dueño podría quedarse sin una cuenta completa).
  if (fabrica && (id === 'total' || !f))
    return {
      id,
      nombre: fabrica.nombre,
      descripcion: fabrica.descripcion,
      permisos: [...fabrica.permisos],
      topes: fabrica.topes ?? null,
      sistema: true,
    };
  if (!f) return null;
  return {
    id,
    nombre: { es: f.nombre_es ?? id, en: f.nombre_en ?? f.nombre_es ?? id },
    descripcion: { es: f.descripcion_es ?? '', en: f.descripcion_en ?? '' },
    permisos: leerLista(f.permisos_json),
    topes: leerTopes(f.topes_json),
    sistema: !!fabrica,
  };
}

/** Calcula el acceso de una persona del equipo: tres lecturas por índice, una vez por sesión. */
export async function leerAccesoInterno(
  db: D1Database,
  env: Pick<Env, 'ADMIN_CORREOS'>,
  u: { id: string; correo: string },
): Promise<AccesoEnSesion> {
  const [cuenta, asignaciones, ajustes] = await db.batch([
    db
      .prepare(
        `SELECT (SELECT perfil FROM perfiles_internos WHERE usuario_id = ?1) AS perfil,
                (SELECT estado FROM equipo_cuentas WHERE usuario_id = ?1) AS estado`,
      )
      .bind(u.id),
    db
      .prepare(
        `SELECT a.plantilla_id, a.alcance_json, a.vence_en, p.nombre_es, p.nombre_en, p.descripcion_es,
                p.descripcion_en, p.permisos_json, p.topes_json
           FROM asignaciones_internas a LEFT JOIN plantillas_internas p ON p.id = a.plantilla_id
          WHERE a.usuario_id = ?`,
      )
      .bind(u.id),
    db.prepare('SELECT permiso, tipo FROM permisos_persona WHERE usuario_id = ?').bind(u.id),
  ]);
  const c = (cuenta?.results[0] ?? {}) as { perfil?: string | null; estado?: string | null };
  const perfil = (PERFILES_INTERNOS as readonly string[]).includes(String(c.perfil))
    ? (c.perfil as PerfilInterno)
    : null;
  const filas = (asignaciones?.results ?? []) as Array<Record<string, string | null>>;
  const lista: AsignacionInterna[] = [];
  for (const f of filas) {
    const id = String(f.plantilla_id);
    const p = plantillaDeFila(
      id,
      f.permisos_json == null
        ? null
        : {
            nombre_es: f.nombre_es ?? null,
            nombre_en: f.nombre_en ?? null,
            descripcion_es: f.descripcion_es ?? null,
            descripcion_en: f.descripcion_en ?? null,
            permisos_json: f.permisos_json ?? null,
            topes_json: f.topes_json ?? null,
          },
    );
    // Una plantilla borrada deja la asignación sin permisos (no abre nada).
    lista.push({
      plantillaId: id,
      nombre: p?.nombre.es ?? id,
      permisos: p?.permisos ?? [],
      topes: p?.topes ?? null,
      alcance: leerAlcance(f.alcance_json),
      venceEn: f.vence_en ?? null,
    });
  }
  const estado = c.estado === 'suspendido' || c.estado === 'retirado' ? c.estado : 'activo';
  const acceso = calcularAcceso({
    dueno: esDueno(env, u.correo),
    perfilViejo: perfil,
    estado,
    asignaciones: lista,
    ajustes: (ajustes?.results ?? []) as AjustePersona[],
    rutas: LISTA_RUTAS_ADMIN,
  });
  return { ...acceso, huella: HUELLA_PERMISOS };
}

/** Lee el cálculo guardado en la sesión; null si no hay, es de otra versión o ya hay que revisarlo. */
export function accesoGuardado(texto: string | null | undefined): AccesoEnSesion | null {
  if (!texto) return null;
  try {
    const a = JSON.parse(texto) as AccesoEnSesion;
    if (a.huella !== HUELLA_PERMISOS || !Array.isArray(a.permisos)) return null;
    const ahora = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (a.revisarEn && a.revisarEn <= ahora) return null;
    return a;
  } catch (e) {
    console.error('equipo: permisos guardados en la sesión no válidos; se recalculan', e);
    return null;
  }
}

/** Un cambio de permisos: la próxima petición de esa persona recalcula (sin cerrarle la sesión). */
export function renovarSesionesDe(db: D1Database, usuarioId: string) {
  return db
    .prepare('UPDATE sesiones SET permisos_json = NULL WHERE usuario_id = ?')
    .bind(usuarioId);
}
/** Suspender o quitar el acceso: fuera al instante, en todos sus aparatos. */
export function cerrarSesionesDe(db: D1Database, usuarioId: string) {
  return db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(usuarioId);
}

/** El acceso de quien hace la petición (solo cuentas del equipo; null para el resto). */
export function accesoDe(c: Ctx): AccesoEnSesion | null {
  const u = c.get('usuario');
  return u?.rol === 'admin' ? (u.interno ?? null) : null;
}

/** ¿Quien pide tiene este permiso? (las rutas fuera de /datos/admin lo preguntan así). */
export function tienePermiso(c: Ctx, permiso: Parameters<typeof puedeVer>[1]): boolean {
  return puedeVer(accesoDe(c), permiso);
}

export function exigirPermiso(c: Ctx, permiso: Parameters<typeof puedeVer>[1]) {
  if (!tienePermiso(c, permiso))
    throw new ErrorDatos(
      'Tu acceso del equipo no incluye esto. Pídeselo a quien gestiona el equipo.',
      undefined,
      403,
    );
}

// ─────────────────────────────── Registro de lo que se vio ───────────────────────────────

export const TIPOS_ACCESO_SENSIBLE = [
  'foto_recogida',
  'foto_entrega',
  'foto_ticket',
  'telefono',
  'correo',
  'chat_pedido',
] as const;
export type TipoAccesoSensible = (typeof TIPOS_ACCESO_SENSIBLE)[number];

/**
 * Una fila por cada vez que alguien del equipo mira una foto, desenmascara un dato o abre el chat.
 * NUNCA guarda el dato: solo quién, qué objeto (su id), qué tipo de dato, con qué permiso y cuándo.
 * Si no se puede anotar, no se muestra el dato (un registro que falla en silencio no sirve).
 */
export async function anotarAccesoSensible(
  db: D1Database,
  usuarioId: string,
  objeto: string,
  tipo: TipoAccesoSensible,
  permiso: string,
) {
  try {
    await db
      .prepare(
        'INSERT INTO accesos_sensibles (usuario_id, objeto, tipo, permiso) VALUES (?, ?, ?, ?)',
      )
      .bind(usuarioId, objeto.slice(0, 120), tipo, permiso)
      .run();
  } catch (e) {
    console.error('equipo: no se pudo anotar el acceso sensible; no se muestra el dato', e);
    throw new ErrorDatos(
      'No pudimos registrar este acceso y por eso no lo mostramos. Intenta de nuevo.',
      undefined,
      503,
    );
  }
}

/**
 * Retención de 90 días, dentro de la limpieza de fotos que ya corre cada hora (sin tarea nueva).
 * Las filas entran en orden de tiempo, así que se mira el comienzo por la llave (como mucho 200
 * filas leídas) y se borra hasta la última vieja: sin índice por fecha y sin recorrer la tabla.
 */
export async function depurarAccesosSensibles(db: D1Database, dias: number): Promise<number> {
  const r = await db
    .prepare(
      `DELETE FROM accesos_sensibles WHERE id <= (
         SELECT MAX(id) FROM (SELECT id, creado_en FROM accesos_sensibles ORDER BY id LIMIT 200)
          WHERE creado_en < datetime('now', ?))`,
    )
    .bind(`-${dias} days`)
    .run();
  return Number(r.meta.changes ?? 0);
}

// ─────────────────────────────── Alcance en las consultas ───────────────────────────────

/**
 * El filtro de alcance para una consulta: `zona` es la columna de la ciudad; `servicio` la expresión
 * que da el servicio de la fila (`comida`, `tiendas`, `carro`, `moto`, `envios`). Sin alcance, nada.
 */
export function filtroAlcance(
  acceso: Pick<AccesoInterno, 'alcance'> | null,
  columnas: { zona: string; servicio?: string },
): { sql: string; valores: unknown[] } {
  if (!acceso || alcanceEsTotal(acceso.alcance)) return { sql: '', valores: [] };
  const a = acceso.alcance;
  const partes: string[] = [];
  const valores: unknown[] = [];
  if (a.paises !== null || a.zonas !== null) {
    const donde: string[] = [];
    if (a.zonas?.length) {
      donde.push(`${columnas.zona} IN (${a.zonas.map(() => '?').join(', ')})`);
      valores.push(...a.zonas);
    }
    if (a.paises?.length) {
      donde.push(
        `${columnas.zona} IN (SELECT id FROM zonas WHERE pais IN (${a.paises.map(() => '?').join(', ')}))`,
      );
      valores.push(...a.paises);
    }
    partes.push(donde.length ? `(${donde.join(' OR ')})` : '0');
  }
  if (a.servicios !== null && columnas.servicio) {
    partes.push(
      a.servicios.length
        ? `${columnas.servicio} IN (${a.servicios.map(() => '?').join(', ')})`
        : '0',
    );
    valores.push(...a.servicios);
  }
  return { sql: partes.length ? ` AND ${partes.join(' AND ')}` : '', valores };
}

/** Expresión SQL del servicio de un pedido a partir de la columna del tipo de comercio. */
export const servicioPedidoSql = (tipoComercio: string) =>
  `(CASE WHEN COALESCE(${tipoComercio}, 'restaurante') = 'restaurante' THEN 'comida' ELSE 'tiendas' END)`;
/** Expresión SQL del servicio de una operación a partir de `servicio_id`. */
export const servicioOperacionSql = (servicioId: string) =>
  `(CASE WHEN ${servicioId} IN ('carro', 'moto') THEN ${servicioId} ELSE 'envios' END)`;

/** El servicio de un ticket: el de su pedido; sin pedido, «otro» (solo lo ve quien no tiene servicio limitado). */
export const servicioTicketSql = (alias: string) =>
  `COALESCE((SELECT ${servicioOperacionSql('ot.servicio_id')} FROM operaciones ot WHERE ot.id = ${alias}.operacion_id), (SELECT ${servicioPedidoSql('rt.tipo_comercio')} FROM pedidos pt JOIN restaurantes rt ON rt.id = pt.restaurante_id WHERE pt.id = ${alias}.pedido_id), 'otro')`;

/** ¿Una fila (ciudad, país, servicio) cabe en el alcance? (fichas: se comprueba al abrir). */
export function dentroDelAlcance(
  acceso: Pick<AccesoInterno, 'alcance'> | null,
  fila: { zona: string | null; pais: string | null; servicio: ServicioAlcance | null },
): boolean {
  if (!acceso || alcanceEsTotal(acceso.alcance)) return true;
  const a = acceso.alcance;
  if (a.paises !== null || a.zonas !== null) {
    const enZona = !!fila.zona && (a.zonas ?? []).includes(fila.zona);
    const enPais = !!fila.pais && (a.paises ?? []).includes(fila.pais);
    if (!enZona && !enPais) return false;
  }
  if (a.servicios !== null && (!fila.servicio || !a.servicios.includes(fila.servicio)))
    return false;
  return true;
}

/** El alcance para las listas de pedidos (columnas con `+`: no cambia el índice de la consulta). */
export function alcancePedidos(c: Ctx) {
  return filtroAlcance(accesoDe(c), {
    zona: '+p.zona_id',
    servicio: servicioPedidoSql(
      '(SELECT tipo_comercio FROM restaurantes WHERE id = p.restaurante_id)',
    ),
  });
}

/**
 * El alcance para los viajes del monitoreo, como una pregunta por fila (zona y servicio ya vienen
 * en la fila leída). Solo lee las zonas (tabla chica) si la persona tiene países en su alcance.
 */
export async function alcanceViajes(
  c: Ctx,
): Promise<((f: Record<string, unknown>) => boolean) | undefined> {
  const acceso = accesoDe(c);
  if (!acceso || alcanceEsTotal(acceso.alcance) || !c.env.DB) return undefined;
  const paises = new Map<string, string>();
  if (acceso.alcance.paises?.length) {
    const { results } = await c.env.DB.prepare('SELECT id, pais FROM zonas').all<{
      id: string;
      pais: string;
    }>();
    for (const z of results) paises.set(z.id, z.pais);
  }
  return (f) =>
    dentroDelAlcance(acceso, {
      zona: f.zona_id == null ? null : String(f.zona_id),
      pais: paises.get(String(f.zona_id)) ?? null,
      servicio: servicioAlcanceDeOperacion(f.servicio_id == null ? null : String(f.servicio_id)),
    });
}

/** Un pedido fuera del alcance de la persona del equipo: como si no existiera (404). */
export async function exigirPedidoEnAlcance(c: Ctx, db: D1Database, pedidoId: string) {
  const acceso = accesoDe(c);
  if (!acceso || alcanceEsTotal(acceso.alcance)) return;
  const f = await db
    .prepare(
      `SELECT p.zona_id AS zona, z.pais, ${servicioPedidoSql('r.tipo_comercio')} AS servicio
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
         LEFT JOIN zonas z ON z.id = p.zona_id WHERE p.id = ?`,
    )
    .bind(pedidoId)
    .first<{ zona: string | null; pais: string | null; servicio: ServicioAlcance | null }>();
  if (f && !dentroDelAlcance(acceso, f))
    throw new ErrorDatos('Eso no existe o no está en tu zona de trabajo.', undefined, 404);
}

// ─────────────────────────────── Datos personales enmascarados ───────────────────────────────

const CLAVE_TELEFONO = /(^|_)(telefono|phone|tel)($|_)|Telefono|Phone/;
const CLAVE_CORREO = /(^|_)(correo|email)($|_)|Correo|Email/;
const PARECE_CORREO = /^[^\s@]+@[^\s@]+$/;
const PARECE_TELEFONO = /^\+?[\d\s().-]{7,20}$/;

/**
 * Enmascara teléfonos y correos en una respuesta del superadmin (listas, fichas, buscador). Mira el
 * nombre del campo Y la forma del valor: una fecha en `correo_confirmado_en` no se toca.
 * `conservar` = claves cuyo contenido no se enmascara (por ejemplo, las emergencias para quien las
 * atiende: necesita llamar).
 */
export function enmascararRespuesta(valor: unknown, conservar: ReadonlySet<string>): unknown {
  if (Array.isArray(valor)) return valor.map((v) => enmascararRespuesta(v, conservar));
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([k, v]): [string, unknown] => {
      if (conservar.has(k)) return [k, v];
      if (typeof v === 'string' && CLAVE_CORREO.test(k) && PARECE_CORREO.test(v.trim()))
        return [k, enmascararCorreo(v)];
      if (typeof v === 'string' && CLAVE_TELEFONO.test(k) && PARECE_TELEFONO.test(v.trim()))
        return [k, enmascararTelefono(v)];
      return [k, enmascararRespuesta(v, conservar)];
    }),
  );
}
