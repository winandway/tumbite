import { telefonoCanonico } from '@tumbite/compartido';
import { nuevoId } from './cripto';
import type { Env } from './env';
import { notificar } from './notificaciones';
import { crearEquipo, resolverCodigo, vincularConductor } from './programaReferidos';
import { enviarSms, telefonoE164 } from './sms';
import { ErrorDatos } from './validar';

/**
 * C-LINEAS-TAXI (19 nov 2026) — todos los países. Una LÍNEA de taxi o mototaxi es un equipo con líder
 * (`equipos`) más sus datos (`lineas`). Va aparte de los referidos: entrar a una línea no da premios.
 *
 * - La crea el equipo de Divoox en el superadmin, o nace de una solicitud del formulario público
 *   «Registra tu línea» que el equipo aprueba tras verificar el teléfono del líder. Nadie la crea sin aprobación.
 * - El código solo vale en la ciudad de la línea.
 * - El conductor PIDE entrar (con el código o eligiendo su línea de la lista de su ciudad) y el líder acepta o
 *   rechaza con un toque. Un conductor, una sola línea.
 * - La emergencia del conductor avisa (app y SMS con ubicación) al líder y al segundo contacto de su línea.
 */
export const TIPOS_LINEA = ['taxi', 'mototaxi', 'ambos'] as const;
export type TipoLinea = (typeof TIPOS_LINEA)[number];

/** Tope de emergencias que avisan a la línea por conductor y por día (cada una manda hasta dos SMS). */
export const TOPE_EMERGENCIAS_LINEA_DIA = 5;
export const TIPO_SMS_LINEA = 'equipo_panico_linea';
/** Las solicitudes públicas abiertas que se guardan (contra quien inunda el formulario). */
export const TOPE_SOLICITUDES_ABIERTAS = 200;

export type Linea = {
  id: string;
  nombre: string;
  zonaId: string;
  ciudad: string;
  codigo: string;
  tipo: TipoLinea;
  liderId: string;
  lider: string;
  liderTelefono: string;
  contacto2Nombre: string;
  contacto2Telefono: string;
  activa: boolean;
  miembros: number;
  pendientes: number;
  verificada: boolean;
  creadaEn: string;
};

type FilaLinea = Record<string, unknown>;
const mapear = (r: FilaLinea): Linea => ({
  id: String(r.id),
  nombre: String(r.nombre),
  zonaId: String(r.zona_id),
  ciudad: String(r.ciudad ?? r.zona_id),
  codigo: String(r.codigo),
  tipo: String(r.tipo) as TipoLinea,
  liderId: String(r.lider_id),
  lider: String(r.lider ?? ''),
  liderTelefono: String(r.lider_telefono ?? ''),
  contacto2Nombre: String(r.contacto2_nombre ?? ''),
  contacto2Telefono: String(r.contacto2_telefono ?? ''),
  activa: Number(r.activo) === 1,
  miembros: Number(r.miembros ?? 0),
  pendientes: Number(r.pendientes ?? 0),
  verificada: r.telefono_verificado_en != null,
  creadaEn: String(r.creado_en),
});

const SELECT_LINEA = `SELECT e.id, e.nombre, e.zona_id, e.codigo, e.activo, e.lider_id, e.creado_en, l.tipo,
    l.contacto2_nombre, l.contacto2_telefono, l.telefono_verificado_en, u.nombre AS lider, u.telefono AS lider_telefono,
    (SELECT nombre FROM zonas WHERE id = e.zona_id) AS ciudad,
    (SELECT COUNT(*) FROM miembros_equipo m WHERE m.equipo_id = e.id) AS miembros,
    (SELECT COUNT(*) FROM pedidos_linea p WHERE p.equipo_id = e.id AND p.estado = 'pendiente') AS pendientes
  FROM lineas l JOIN equipos e ON e.id = l.equipo_id JOIN usuarios u ON u.id = e.lider_id`;

/** Texto plano para buscar: sin acentos, en minúscula, sin símbolos. */
export const plano = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 +]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Las líneas para el superadmin, con buscador por nombre, código, líder, teléfono o ciudad. */
export async function listarLineas(
  db: D1Database,
  f: { zonaId?: string | null; q?: string | null; lineaId?: string | null } = {},
): Promise<Linea[]> {
  const { results } = await db
    .prepare(
      `${SELECT_LINEA} WHERE (?1 = '' OR e.zona_id = ?1) AND (?2 = '' OR e.id = ?2) ORDER BY e.creado_en DESC LIMIT 300`,
    )
    .bind(f.zonaId ?? '', f.lineaId ?? '')
    .all<FilaLinea>();
  const todas = results.map(mapear);
  const q = plano(f.q ?? '');
  if (!q) return todas;
  const digitos = q.replace(/\D/g, '');
  return todas.filter((l) => {
    const campos = [l.nombre, l.codigo, l.lider, l.ciudad, l.tipo, l.contacto2Nombre].map(plano);
    if (campos.some((c) => c.includes(q))) return true;
    if (digitos.length >= 3) {
      const tels = [l.liderTelefono, l.contacto2Telefono].map((t) => t.replace(/\D/g, ''));
      return tels.some((t) => t.includes(digitos));
    }
    return false;
  });
}

export async function lineaPorId(db: D1Database, id: string): Promise<Linea | null> {
  return (await listarLineas(db, { lineaId: id }))[0] ?? null;
}

/** Los miembros de una línea (aceptados) con su teléfono (solo para el líder y el equipo). */
export async function miembrosDeLinea(db: D1Database, equipoId: string) {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, u.telefono, m.creado_en,
         EXISTS (SELECT 1 FROM habilitaciones h WHERE h.conductor_id = u.id AND h.estado = 'aprobada') AS aprobado,
         (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = u.id AND o.estado_general = 'terminada' AND o.actualizado_en > datetime('now', '-7 days')) AS carreras_7d
         FROM miembros_equipo m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.equipo_id = ? ORDER BY m.creado_en DESC LIMIT 500`,
    )
    .bind(equipoId)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    telefono: String(r.telefono ?? ''),
    desde: String(r.creado_en),
    aprobado: Number(r.aprobado) === 1,
    activo: Number(r.carreras_7d) > 0,
  }));
}

export async function pedidosDeLinea(db: D1Database, equipoId: string) {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, u.telefono, p.creado_en FROM pedidos_linea p JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.equipo_id = ? AND p.estado = 'pendiente' ORDER BY p.creado_en LIMIT 200`,
    )
    .bind(equipoId)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    telefono: String(r.telefono ?? ''),
    desde: String(r.creado_en),
  }));
}

/** ¿Este equipo es una línea? (Los equipos de referidos no lo son.) */
export async function esLinea(db: D1Database, equipoId: string): Promise<boolean> {
  return Boolean(
    await db.prepare('SELECT 1 AS si FROM lineas WHERE equipo_id = ?').bind(equipoId).first(),
  );
}

type DatosLinea = {
  nombre: string;
  zonaId: string;
  tipo: TipoLinea;
  lider: string;
  contacto2Nombre: string;
  contacto2Telefono: string;
  conductores?: number | null;
  autorId: string;
};

function validarContacto2(nombre: string, telefono: string) {
  if (!nombre.trim() || !telefonoE164(telefono) || !telefonoCanonico(telefono))
    throw new ErrorDatos(
      'Escribe el nombre y el celular completo (con el código del país) del segundo contacto de emergencia.',
      'contacto2Telefono',
      422,
    );
}

/**
 * Crea la línea: el equipo con su líder (que ya tiene que estar en Divoox Driver) y sus datos. Los conductores
 * que ya entraron con el código de invitación personal del líder, en la ciudad de la línea, pasan como aceptados.
 */
export async function crearLinea(db: D1Database, d: DatosLinea) {
  validarContacto2(d.contacto2Nombre, d.contacto2Telefono);
  if (!TIPOS_LINEA.includes(d.tipo))
    throw new ErrorDatos('Elige taxi, mototaxi o los dos.', 'tipo', 422);
  const e = await crearEquipo(db, {
    nombre: d.nombre,
    zonaId: d.zonaId,
    lider: d.lider,
    autorId: d.autorId,
  });
  await db
    .prepare(
      `INSERT INTO lineas (equipo_id, tipo, contacto2_nombre, contacto2_telefono, conductores_estimados, telefono_verificado_en)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(e.id, d.tipo, d.contacto2Nombre.trim(), d.contacto2Telefono.trim(), d.conductores ?? null)
    .run();
  const adoptados = await adoptarInvitados(db, e.id, e.liderId, d.zonaId);
  return { ...e, adoptados };
}

/** Los conductores que ya se registraron con el código personal del líder entran a su línea como aceptados. */
export async function adoptarInvitados(
  db: D1Database,
  equipoId: string,
  liderId: string,
  zonaId: string,
) {
  const { results } = await db
    .prepare(
      `SELECT rc.invitado_id AS id FROM referidos_conductor rc JOIN usuarios u ON u.id = rc.invitado_id
        WHERE rc.invitador_id = ?1 AND rc.invitado_id <> ?1 AND (u.zona_id IS NULL OR u.zona_id = ?2)
          AND NOT EXISTS (SELECT 1 FROM miembros_equipo m WHERE m.usuario_id = rc.invitado_id) LIMIT 200`,
    )
    .bind(liderId, zonaId)
    .all<{ id: string }>();
  if (!results.length) return 0;
  await db.batch(
    results.flatMap((r) => [
      db
        .prepare('INSERT OR IGNORE INTO miembros_equipo (usuario_id, equipo_id) VALUES (?, ?)')
        .bind(r.id, equipoId),
      db
        .prepare(
          `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado, resuelto_en) VALUES (?, ?, 'aceptada', datetime('now'))
           ON CONFLICT(usuario_id) DO UPDATE SET equipo_id = excluded.equipo_id, estado = 'aceptada', resuelto_en = datetime('now')`,
        )
        .bind(r.id, equipoId),
    ]),
  );
  return results.length;
}

// ───────────────────────── Formulario público «Registra tu línea» ─────────────────────────

export type SolicitudLinea = {
  nombre: string;
  zonaId: string;
  tipo: TipoLinea;
  conductores: number;
  liderNombre: string;
  liderTelefono: string;
  contacto2Nombre: string;
  contacto2Telefono: string;
};

export async function registrarSolicitud(db: D1Database, s: SolicitudLinea) {
  const zona = await db
    .prepare('SELECT id FROM zonas WHERE id = ? AND activa = 1')
    .bind(s.zonaId)
    .first();
  if (!zona) throw new ErrorDatos('Elige una ciudad de la lista.', 'zonaId', 422);
  if (!telefonoE164(s.liderTelefono) || !telefonoCanonico(s.liderTelefono))
    throw new ErrorDatos(
      'Escribe el celular completo del líder, con el código del país.',
      'liderTelefono',
      422,
    );
  validarContacto2(s.contacto2Nombre, s.contacto2Telefono);
  const abiertas = await db
    .prepare("SELECT COUNT(*) AS n FROM solicitudes_linea WHERE estado = 'pendiente'")
    .first<{ n: number }>();
  if (Number(abiertas?.n ?? 0) >= TOPE_SOLICITUDES_ABIERTAS)
    throw new ErrorDatos(
      'Estamos recibiendo muchas solicitudes. Vuelve a intentar en unas horas.',
      undefined,
      503,
    );
  const repetida = await db
    .prepare(
      "SELECT 1 AS si FROM solicitudes_linea WHERE estado = 'pendiente' AND lider_telefono = ? AND zona_id = ?",
    )
    .bind(s.liderTelefono.trim(), s.zonaId)
    .first();
  if (repetida) return { id: null, repetida: true };
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO solicitudes_linea (id, nombre, zona_id, tipo, conductores, lider_nombre, lider_telefono, contacto2_nombre, contacto2_telefono)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      s.nombre.trim(),
      s.zonaId,
      s.tipo,
      s.conductores,
      s.liderNombre.trim(),
      s.liderTelefono.trim(),
      s.contacto2Nombre.trim(),
      s.contacto2Telefono.trim(),
    )
    .run();
  return { id, repetida: false };
}

export async function listarSolicitudes(db: D1Database, estado = 'pendiente') {
  const { results } = await db
    .prepare(
      `SELECT s.*, (SELECT nombre FROM zonas WHERE id = s.zona_id) AS ciudad FROM solicitudes_linea s
        WHERE (?1 = 'todas' OR s.estado = ?1) ORDER BY s.creado_en DESC LIMIT 200`,
    )
    .bind(estado)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    zonaId: String(r.zona_id),
    ciudad: String(r.ciudad ?? r.zona_id),
    tipo: String(r.tipo),
    conductores: Number(r.conductores),
    liderNombre: String(r.lider_nombre),
    liderTelefono: String(r.lider_telefono),
    contacto2Nombre: String(r.contacto2_nombre),
    contacto2Telefono: String(r.contacto2_telefono),
    estado: String(r.estado),
    motivo: r.motivo == null ? null : String(r.motivo),
    equipoId: r.equipo_id == null ? null : String(r.equipo_id),
    creadaEn: String(r.creado_en),
  }));
}

// ───────────────────────── C-LIDER-INVITADO: el líder que todavía no tiene cuenta ─────────────────────────

export type InvitacionLider = {
  id: string;
  nombre: string;
  zonaId: string;
  tipo: TipoLinea;
  lider: string;
  creadoEn: string;
};

/** Código del error de `crearEquipo` cuando nadie en Driver tiene ese correo o celular. */
export const esLiderSinCuenta = (e: unknown) =>
  e instanceof ErrorDatos && e.campo === 'lider' && e.estado === 404;

/**
 * Deja la línea esperando a su líder: se guarda con su celular o correo y se crea sola cuando esa
 * persona se registra en Divoox Driver y abre «Mi línea». Una invitación viva por líder y ciudad.
 */
export async function invitarLider(
  db: D1Database,
  d: DatosLinea,
  solicitudId: string | null = null,
) {
  validarContacto2(d.contacto2Nombre, d.contacto2Telefono);
  if (!TIPOS_LINEA.includes(d.tipo))
    throw new ErrorDatos('Elige taxi, mototaxi o los dos.', 'tipo', 422);
  const zona = await db.prepare('SELECT id FROM zonas WHERE id = ?').bind(d.zonaId).first();
  if (!zona) throw new ErrorDatos('Una de las ciudades no existe.', 'zonaId', 422);
  const texto = d.lider.trim();
  const correo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto) ? texto.toLowerCase() : null;
  const tel = correo ? null : telefonoE164(texto) ? telefonoCanonico(texto) : null;
  if (!correo && !tel)
    throw new ErrorDatos(
      'Para invitar al líder escribe su correo o su celular completo, con el código del país.',
      'lider',
      422,
    );
  const ya = await db
    .prepare(
      `SELECT id FROM invitaciones_lider WHERE estado = 'pendiente'
         AND ((?1 IS NOT NULL AND lider_telefono_canonico = ?1) OR (?2 IS NOT NULL AND lider_correo = ?2)) LIMIT 1`,
    )
    .bind(tel, correo)
    .first<{ id: string }>();
  if (ya)
    throw new ErrorDatos(
      'Ese líder ya tiene una invitación pendiente. Anúlala antes de crear otra.',
      'lider',
      409,
    );
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO invitaciones_lider (id, nombre, zona_id, tipo, conductores, lider, lider_telefono_canonico, lider_correo,
         contacto2_nombre, contacto2_telefono, solicitud_id, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      d.nombre.trim(),
      d.zonaId,
      d.tipo,
      d.conductores ?? null,
      texto,
      tel,
      correo,
      d.contacto2Nombre.trim(),
      d.contacto2Telefono.trim(),
      solicitudId,
      d.autorId,
    )
    .run();
  return { id };
}

/** Las invitaciones que siguen esperando a su líder (para el superadmin). */
export async function invitacionesDeLider(db: D1Database): Promise<InvitacionLider[]> {
  const { results } = await db
    .prepare(
      "SELECT id, nombre, zona_id, tipo, lider, creado_en FROM invitaciones_lider WHERE estado = 'pendiente' ORDER BY creado_en DESC LIMIT 100",
    )
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    zonaId: String(r.zona_id),
    tipo: String(r.tipo) as TipoLinea,
    lider: String(r.lider),
    creadoEn: String(r.creado_en),
  }));
}

export async function anularInvitacionLider(db: D1Database, id: string) {
  const r = await db
    .prepare(
      "UPDATE invitaciones_lider SET estado = 'anulada' WHERE id = ? AND estado = 'pendiente'",
    )
    .bind(id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa invitación ya no está pendiente.', undefined, 404);
  await db
    .prepare(
      "UPDATE solicitudes_linea SET estado = 'pendiente', resuelta_por = NULL, resuelta_en = NULL WHERE estado = 'aprobada' AND equipo_id IS NULL AND id = (SELECT solicitud_id FROM invitaciones_lider WHERE id = ?)",
    )
    .bind(id)
    .run();
}

/**
 * El conductor recién registrado que tiene una línea esperándolo (por su celular o su correo) pasa a
 * ser su líder: la línea se crea en ese momento, una sola vez. Devuelve si creó algo.
 */
async function reclamarLineaDeLider(db: D1Database, usuarioId: string) {
  const u = await db
    .prepare("SELECT correo, telefono_canonico FROM usuarios WHERE id = ? AND rol = 'repartidor'")
    .bind(usuarioId)
    .first<{ correo: string; telefono_canonico: string | null }>();
  if (!u) return false;
  const inv = await db
    .prepare(
      `SELECT * FROM invitaciones_lider WHERE estado = 'pendiente'
         AND ((?1 <> '' AND lider_telefono_canonico = ?1) OR lider_correo = ?2) ORDER BY creado_en LIMIT 1`,
    )
    .bind(u.telefono_canonico ?? '', String(u.correo).toLowerCase())
    .first<Record<string, unknown>>();
  if (!inv) return false;
  // Se aparta primero: dos aperturas a la vez no crean dos líneas.
  const mia = await db
    .prepare(
      "UPDATE invitaciones_lider SET estado = 'usada', usada_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
    )
    .bind(inv.id)
    .run();
  if (!mia.meta.changes) return false;
  try {
    const r = await crearLinea(db, {
      nombre: String(inv.nombre),
      zonaId: String(inv.zona_id),
      tipo: String(inv.tipo) as TipoLinea,
      lider: u.correo,
      contacto2Nombre: String(inv.contacto2_nombre),
      contacto2Telefono: String(inv.contacto2_telefono),
      conductores: inv.conductores == null ? null : Number(inv.conductores),
      autorId: String(inv.creado_por),
    });
    await db
      .prepare('UPDATE invitaciones_lider SET equipo_id = ? WHERE id = ?')
      .bind(r.id, inv.id)
      .run();
    if (inv.solicitud_id)
      await db
        .prepare('UPDATE solicitudes_linea SET equipo_id = ? WHERE id = ?')
        .bind(r.id, inv.solicitud_id)
        .run();
    return true;
  } catch (e) {
    // Si no se pudo crear, la invitación vuelve a quedar viva y el fallo queda a la vista.
    console.error('lineas: no se pudo crear la línea del líder invitado', inv.id, String(e));
    await db
      .prepare("UPDATE invitaciones_lider SET estado = 'pendiente', usada_en = NULL WHERE id = ?")
      .bind(inv.id)
      .run();
    return false;
  }
}

/** Aprueba una solicitud. Si el líder no tiene cuenta y se pide invitarlo, queda esperándolo. */
export async function aprobarSolicitud(
  db: D1Database,
  id: string,
  autorId: string,
  invitar = false,
) {
  const s = await db
    .prepare("SELECT * FROM solicitudes_linea WHERE id = ? AND estado = 'pendiente'")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!s) throw new ErrorDatos('Esa solicitud ya no está pendiente.', undefined, 404);
  const datos: DatosLinea = {
    nombre: String(s.nombre),
    zonaId: String(s.zona_id),
    tipo: String(s.tipo) as TipoLinea,
    lider: String(s.lider_telefono),
    contacto2Nombre: String(s.contacto2_nombre),
    contacto2Telefono: String(s.contacto2_telefono),
    conductores: Number(s.conductores),
    autorId,
  };
  const r = await crearLinea(db, datos).catch(async (e: unknown) => {
    if (!invitar || !esLiderSinCuenta(e)) throw e;
    return { invitacion: await invitarLider(db, datos, id) };
  });
  if ('invitacion' in r) {
    await db
      .prepare(
        "UPDATE solicitudes_linea SET estado = 'aprobada', resuelta_por = ?, resuelta_en = datetime('now') WHERE id = ?",
      )
      .bind(autorId, id)
      .run();
    return r;
  }
  await db
    .prepare(
      "UPDATE solicitudes_linea SET estado = 'aprobada', equipo_id = ?, resuelta_por = ?, resuelta_en = datetime('now') WHERE id = ?",
    )
    .bind(r.id, autorId, id)
    .run();
  return r;
}

export async function rechazarSolicitud(
  db: D1Database,
  id: string,
  autorId: string,
  motivo: string,
) {
  const r = await db
    .prepare(
      "UPDATE solicitudes_linea SET estado = 'rechazada', motivo = ?, resuelta_por = ?, resuelta_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
    )
    .bind(motivo.slice(0, 300), autorId, id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa solicitud ya no está pendiente.', undefined, 404);
}

// ───────────────────────── Conductores: pedir entrada, aceptar, sacar, mover ─────────────────────────

/** La línea de un conductor: la que lidera o a la que pertenece, o su solicitud pendiente. */
export async function lineaDe(db: D1Database, usuarioId: string) {
  const lidera = await db
    .prepare(
      'SELECT e.id FROM equipos e JOIN lineas l ON l.equipo_id = e.id WHERE e.lider_id = ? AND e.activo = 1 LIMIT 1',
    )
    .bind(usuarioId)
    .first<{ id: string }>();
  if (lidera) return { equipoId: lidera.id, rol: 'lider' as const };
  const miembro = await db
    .prepare(
      'SELECT m.equipo_id AS id FROM miembros_equipo m JOIN lineas l ON l.equipo_id = m.equipo_id WHERE m.usuario_id = ? LIMIT 1',
    )
    .bind(usuarioId)
    .first<{ id: string }>();
  if (miembro) return { equipoId: miembro.id, rol: 'miembro' as const };
  const pedido = await db
    .prepare(
      "SELECT equipo_id AS id FROM pedidos_linea WHERE usuario_id = ? AND estado = 'pendiente'",
    )
    .bind(usuarioId)
    .first<{ id: string }>();
  if (pedido) return { equipoId: pedido.id, rol: 'pendiente' as const };
  return null;
}

/** Las líneas de la ciudad del conductor para elegir (buscador; nunca texto libre). */
export async function lineasDeCiudad(db: D1Database, zonaId: string, q = '') {
  const todas = await listarLineas(db, { zonaId, q });
  return todas
    .filter((l) => l.activa)
    .map((l) => ({
      id: l.id,
      nombre: l.nombre,
      tipo: l.tipo,
      lider: l.lider.split(' ')[0] ?? '',
      miembros: l.miembros,
    }));
}

async function zonaDelConductor(db: D1Database, usuarioId: string): Promise<string | null> {
  const f = await db
    .prepare(
      'SELECT COALESCE(r.zona_id, u.zona_id) AS zona FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?',
    )
    .bind(usuarioId)
    .first<{ zona: string | null }>();
  return f?.zona ?? null;
}

/** El conductor pide entrar. `mismaCiudadObligatoria`: el código solo vale en la ciudad de la línea. */
export async function pedirEntrada(
  env: Env | null,
  db: D1Database,
  usuarioId: string,
  equipoId: string,
) {
  const l = await lineaPorId(db, equipoId);
  if (!l || !l.activa) throw new ErrorDatos('Esa línea no está disponible.', 'codigo', 404);
  if (l.liderId === usuarioId)
    throw new ErrorDatos('Tú eres el líder de esta línea.', 'codigo', 409);
  const ya = await lineaDe(db, usuarioId);
  if (ya?.rol === 'miembro' || ya?.rol === 'lider')
    throw new ErrorDatos(
      'Ya estás en una línea. Pídele a tu líder que te saque antes de entrar a otra.',
      'codigo',
      409,
    );
  if (ya?.rol === 'pendiente' && ya.equipoId === equipoId) return { linea: l, repetido: true };
  const zona = await zonaDelConductor(db, usuarioId);
  if (zona && zona !== l.zonaId)
    throw new ErrorDatos(`Esa línea es de ${l.ciudad}. Su código solo vale allá.`, 'codigo', 409);
  await db
    .prepare(
      `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado) VALUES (?, ?, 'pendiente')
       ON CONFLICT(usuario_id) DO UPDATE SET equipo_id = excluded.equipo_id, estado = 'pendiente', creado_en = datetime('now'), resuelto_en = NULL`,
    )
    .bind(usuarioId, equipoId)
    .run();
  if (env) {
    const quien = await db
      .prepare('SELECT nombre FROM usuarios WHERE id = ?')
      .bind(usuarioId)
      .first<{ nombre: string }>();
    await notificar(env, db, l.liderId, (i) => ({
      titulo: i === 'es' ? 'Quiere entrar a tu línea' : 'Someone wants to join your line',
      cuerpo:
        i === 'es'
          ? `${quien?.nombre ?? 'Un conductor'} pidió entrar a ${l.nombre}. Acepta o rechaza en «Mi línea».`
          : `${quien?.nombre ?? 'A driver'} asked to join ${l.nombre}. Accept or decline in “My line”.`,
      datos: { tipo: 'linea_solicitud' },
    })).catch((e: unknown) => console.error('lineas: aviso al líder', String(e)));
  }
  return { linea: l, repetido: false };
}

/** El líder acepta o rechaza con un toque. */
export async function resolverPedido(
  env: Env | null,
  db: D1Database,
  liderId: string,
  usuarioId: string,
  aceptar: boolean,
) {
  const mia = await lineaDe(db, liderId);
  if (mia?.rol !== 'lider')
    throw new ErrorDatos('Esta pantalla es del líder de la línea.', undefined, 403);
  const p = await db
    .prepare(
      "SELECT 1 AS si FROM pedidos_linea WHERE usuario_id = ? AND equipo_id = ? AND estado = 'pendiente'",
    )
    .bind(usuarioId, mia.equipoId)
    .first();
  if (!p) throw new ErrorDatos('Esa solicitud ya no está pendiente.', undefined, 404);
  if (aceptar) {
    const otra = await db
      .prepare('SELECT 1 AS si FROM miembros_equipo WHERE usuario_id = ?')
      .bind(usuarioId)
      .first();
    if (otra) throw new ErrorDatos('Ese conductor ya está en otra línea o equipo.', undefined, 409);
    await db.batch([
      db
        .prepare('INSERT OR IGNORE INTO miembros_equipo (usuario_id, equipo_id) VALUES (?, ?)')
        .bind(usuarioId, mia.equipoId),
      db
        .prepare(
          "UPDATE pedidos_linea SET estado = 'aceptada', resuelto_en = datetime('now') WHERE usuario_id = ?",
        )
        .bind(usuarioId),
    ]);
  } else {
    await db
      .prepare(
        "UPDATE pedidos_linea SET estado = 'rechazada', resuelto_en = datetime('now') WHERE usuario_id = ?",
      )
      .bind(usuarioId)
      .run();
  }
  const l = await lineaPorId(db, mia.equipoId);
  if (env && l)
    await notificar(env, db, usuarioId, (i) => ({
      titulo: aceptar
        ? i === 'es'
          ? 'Ya estás en la línea'
          : 'You are in the line'
        : i === 'es'
          ? 'Tu solicitud no fue aceptada'
          : 'Your request was declined',
      cuerpo: aceptar
        ? i === 'es'
          ? `${l.nombre} te aceptó. Tus avisos de emergencia le llegan a tu líder.`
          : `${l.nombre} accepted you. Your emergency alerts now reach your leader.`
        : i === 'es'
          ? `${l.nombre} no aceptó tu solicitud.`
          : `${l.nombre} did not accept your request.`,
      datos: { tipo: 'linea_respuesta' },
    })).catch((e: unknown) => console.error('lineas: aviso al conductor', String(e)));
}

/** El líder saca a un conductor de su línea (dentro de los tres puntos en la app). */
export async function sacarDeLinea(db: D1Database, liderId: string, usuarioId: string) {
  const mia = await lineaDe(db, liderId);
  if (mia?.rol !== 'lider')
    throw new ErrorDatos('Esta pantalla es del líder de la línea.', undefined, 403);
  if (usuarioId === liderId)
    throw new ErrorDatos('El líder no puede sacarse a sí mismo.', undefined, 409);
  const r = await db
    .prepare('DELETE FROM miembros_equipo WHERE usuario_id = ? AND equipo_id = ?')
    .bind(usuarioId, mia.equipoId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese conductor no está en tu línea.', undefined, 404);
  await db.prepare('DELETE FROM pedidos_linea WHERE usuario_id = ?').bind(usuarioId).run();
}

/** El equipo de Divoox mueve a un conductor a otra línea (arrastrando en el superadmin) o lo deja sin línea. */
export async function moverConductor(db: D1Database, usuarioId: string, destinoId: string | null) {
  const u = await db
    .prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'repartidor'")
    .bind(usuarioId)
    .first();
  if (!u) throw new ErrorDatos('Ese conductor no existe.', undefined, 404);
  if (destinoId) {
    const l = await lineaPorId(db, destinoId);
    if (!l) throw new ErrorDatos('Esa línea no existe.', undefined, 404);
    if (l.liderId === usuarioId)
      throw new ErrorDatos('Ese conductor es el líder de esa línea.', undefined, 409);
    const zona = await zonaDelConductor(db, usuarioId);
    if (zona && zona !== l.zonaId)
      throw new ErrorDatos(
        `Esa línea es de ${l.ciudad}; el conductor está en otra ciudad.`,
        undefined,
        409,
      );
  }
  await db
    .prepare(
      'DELETE FROM miembros_equipo WHERE usuario_id = ? AND equipo_id IN (SELECT equipo_id FROM lineas)',
    )
    .bind(usuarioId)
    .run();
  if (destinoId)
    await db.batch([
      db
        .prepare('INSERT OR IGNORE INTO miembros_equipo (usuario_id, equipo_id) VALUES (?, ?)')
        .bind(usuarioId, destinoId),
      db
        .prepare(
          `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado, resuelto_en) VALUES (?, ?, 'aceptada', datetime('now'))
           ON CONFLICT(usuario_id) DO UPDATE SET equipo_id = excluded.equipo_id, estado = 'aceptada', resuelto_en = datetime('now')`,
        )
        .bind(usuarioId, destinoId),
    ]);
  else await db.prepare('DELETE FROM pedidos_linea WHERE usuario_id = ?').bind(usuarioId).run();
}

/** Todo lo que el conductor ve en «Mi línea» (líder o miembro). */
export async function miLinea(db: D1Database, usuario: { id: string }, sitio: string) {
  let m = await lineaDe(db, usuario.id);
  // C-LIDER-INVITADO: si el equipo dejó una línea esperándolo, se crea ahora y entra como líder.
  if (!m && (await reclamarLineaDeLider(db, usuario.id))) m = await lineaDe(db, usuario.id);
  if (!m) return { linea: null };
  const l = await lineaPorId(db, m.equipoId);
  if (!l) return { linea: null };
  if (m.rol === 'lider')
    return {
      linea: {
        rol: 'lider' as const,
        id: l.id,
        nombre: l.nombre,
        tipo: l.tipo,
        ciudad: l.ciudad,
        codigo: l.codigo,
        enlace: `${sitio}/join/${l.codigo}`,
        contacto2Nombre: l.contacto2Nombre,
        solicitudes: await pedidosDeLinea(db, l.id),
        miembros: await miembrosDeLinea(db, l.id),
      },
    };
  return {
    linea: {
      rol: m.rol,
      id: l.id,
      nombre: l.nombre,
      tipo: l.tipo,
      ciudad: l.ciudad,
      lider: l.lider.split(' ')[0] ?? '',
    },
  };
}

// ───────────────────────── Emergencia al líder ─────────────────────────

export type EmergenciaLinea = {
  usuarioId: string;
  nombre: string;
  telefono: string | null | undefined;
  lat?: number | null;
  lng?: number | null;
  referencia: string;
};

const enlaceMapa = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : 'sin ubicación (no compartió el GPS)';

export function textoEmergenciaLinea(p: EmergenciaLinea, linea: string): string {
  return [
    `Divoox EMERGENCIA en tu línea ${linea}: ${p.nombre || 'un conductor'}`,
    `tel. ${p.telefono || 'sin teléfono'} pidió ayuda.`,
    `Dónde: ${enlaceMapa(p.lat, p.lng)}`,
    p.referencia ? `${p.referencia}.` : '',
    'Llámalo ya.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 480);
}

/**
 * Avisa al líder y al segundo contacto de la línea del conductor: aviso en la app (al líder) y SMS con la
 * ubicación a los dos, con tope por conductor y por día. Sin línea no hace nada (entonces el aviso va al
 * equipo de Divoox de su ciudad, que ya lo recibe). Devuelve cuántos avisos salieron. Nunca frena la emergencia.
 */
export async function avisarLinea(
  env: Env,
  db: D1Database,
  p: EmergenciaLinea,
  texto = '',
): Promise<number> {
  const m = await lineaDe(db, p.usuarioId);
  if (!m || m.rol === 'pendiente') return 0;
  const l = await lineaPorId(db, m.equipoId);
  if (!l) return 0;
  const hoy = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM emergencias_linea WHERE usuario_id = ? AND creado_en >= datetime('now', '-1 day')",
    )
    .bind(p.usuarioId)
    .first<{ n: number }>();
  if (Number(hoy?.n ?? 0) >= TOPE_EMERGENCIAS_LINEA_DIA) {
    console.error(`lineas: tope diario de emergencias del conductor ${p.usuarioId}`);
    return 0;
  }
  const cuerpo = texto || textoEmergenciaLinea(p, l.nombre);
  let enviados = 0;
  const destinos: { telefono: string; usuarioId: string }[] = [];
  // El líder no se avisa a sí mismo: si el que pide ayuda es el líder, solo va al segundo contacto.
  if (l.liderId !== p.usuarioId && l.liderTelefono)
    destinos.push({ telefono: l.liderTelefono, usuarioId: p.usuarioId });
  if (l.contacto2Telefono) destinos.push({ telefono: l.contacto2Telefono, usuarioId: p.usuarioId });
  const vistos = new Set<string>();
  for (const d of destinos) {
    const e164 = telefonoE164(d.telefono);
    if (!e164 || vistos.has(e164)) continue;
    vistos.add(e164);
    if (
      await enviarSms(env, db, {
        usuarioId: d.usuarioId,
        pedidoId: null,
        tipo: TIPO_SMS_LINEA,
        telefono: e164,
        texto: cuerpo,
      })
    )
      enviados++;
  }
  if (l.liderId !== p.usuarioId) {
    const r = await notificar(env, db, l.liderId, (i) => ({
      titulo: i === 'es' ? `EMERGENCIA en ${l.nombre}` : `EMERGENCY in ${l.nombre}`,
      cuerpo,
      datos: { tipo: 'panico' },
    })).catch(() => ({ enviados: 0 }));
    enviados += r.enviados;
  }
  await db
    .prepare(
      'INSERT INTO emergencias_linea (id, usuario_id, equipo_id, avisos) VALUES (?, ?, ?, ?)',
    )
    .bind(nuevoId(), p.usuarioId, l.id, enviados)
    .run();
  return enviados;
}

/**
 * Un conductor escribe (o trae por /join) un código de invitación. Si es el de una LÍNEA, queda como solicitud
 * que el líder acepta (sin referido ni premio); si no, sigue el camino de los referidos y equipos de siempre.
 */
export async function usarCodigoDeConductor(
  env: Env | null,
  db: D1Database,
  usuarioId: string,
  escrito: string,
) {
  const c = await resolverCodigo(db, escrito);
  if (c?.equipoId && (await esLinea(db, c.equipoId))) {
    if (c.invitadorId === usuarioId)
      throw new ErrorDatos('No puedes usar tu propio código.', 'codigo', 409);
    const r = await pedirEntrada(env, db, usuarioId, c.equipoId);
    // La ciudad de la línea es la del conductor mientras no tenga una ubicación real ni haya elegido ciudad.
    await db.batch([
      db
        .prepare('UPDATE usuarios SET zona_id = ? WHERE id = ? AND zona_id IS NULL')
        .bind(r.linea.zonaId, usuarioId),
      db
        .prepare(
          `INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, ?)
           ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id
            WHERE repartidores.ubicacion_en IS NULL AND repartidores.ciudad_elegida_en IS NULL`,
        )
        .bind(usuarioId, r.linea.zonaId),
    ]);
    return { ...c, linea: r.linea.nombre as string | null };
  }
  return { ...(await vincularConductor(db, usuarioId, escrito)), linea: null as string | null };
}
