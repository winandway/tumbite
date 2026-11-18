import { nuevoId, sha256 } from './cripto';
import { telefonoCanonico } from '@tumbite/compartido';
import { ErrorDatos } from './validar';
import { paisDeZona } from './internacional/paises';
import { CUENTA_TUMBITE } from './internacional/libro';
import { miCodigo } from './referidos';

/**
 * C-REFERIDOS-EQUIPOS (17 nov 2026, piloto de El Vigía y Tucaní) — todos los países. Como los
 * programas de referidos de Uber, DiDi e inDrive:
 *
 * - CONDUCTOR: quien invita gana saldo prepago cuando su invitado completa N carreras en X días
 *   (por defecto 1 dólar tras 10 carreras en 30 días; se paga solo con la comisión de esas carreras).
 *   El invitado recibe el regalo de arranque de su ciudad (C-SALDO-CONDUCTOR).
 * - CLIENTE: el invitado recibe un regalo de Divoox (Venezuela: primer viaje gratis hasta 1,50) y quien
 *   invitó gana un crédito cuando el invitado completa N pedidos o viajes pagados y gasta un mínimo
 *   (Venezuela: 1,50 tras 3; Estados Unidos: 5 dólares cuando gasta 40). El premio siempre es menor
 *   que lo que deja el invitado (se valida al guardar).
 * - EQUIPOS: un líder con su código, enlace y QR; quien se registra con él queda en su equipo para
 *   siempre, con fecha.
 * - Antifraude: nadie se invita a sí mismo (teléfono, aparato o cuenta de cobro); los viajes entre el
 *   que invita y su invitado no cuentan; tope de premios por persona al mes; presupuesto por programa
 *   comprobado en la misma sentencia que da el premio (al agotarse no se da nada más); alertas.
 *
 * Todo nace APAGADO con los montos por defecto listos. Los topes de abajo viven en el código.
 */
export const TOPES_REFERIDOS = {
  /** El premio más alto por invitado (10 USD). */
  premioMaximo: 1_000,
  /** El presupuesto más alto de un programa (500 USD). */
  presupuestoMaximo: 50_000,
  /** Premios por persona en 30 días, como máximo absoluto. */
  topeMesMaximo: 30,
} as const;

export type TipoPrograma = 'conductor' | 'cliente';
export type ReglasConductor = { premio: number; carreras: number; dias: number; topeMes: number };
export type ReglasCliente = {
  /** Regalo para el invitado (en Venezuela, su primer viaje gratis hasta este monto). */
  regaloInvitado: number;
  /** Premio para quien invitó. */
  premioInvitador: number;
  /** Pedidos o viajes pagados que el invitado tiene que completar. */
  operaciones: number;
  /** Lo mínimo que el invitado tiene que gastar (el premio siempre es menor). */
  gastoMinimo: number;
  topeMes: number;
};
export type Programa = {
  tipo: TipoPrograma;
  ambito: string;
  activo: boolean;
  reglas: ReglasConductor | ReglasCliente;
  presupuesto: number;
  /** Lo ya dado (premios de invitados y de quienes invitaron). */
  gastado: number;
  /** El programa salió de los valores por defecto del código (todavía no se guardó). */
  porDefecto: boolean;
};

/** Los valores por defecto (apagados) por país. */
export const PROGRAMAS_POR_DEFECTO: Record<
  string,
  { reglas: ReglasConductor | ReglasCliente; presupuesto: number }
> = {
  'conductor:VE': {
    reglas: { premio: 100, carreras: 10, dias: 30, topeMes: 10 },
    presupuesto: 5_000,
  },
  'cliente:VE': {
    reglas: {
      regaloInvitado: 150,
      premioInvitador: 150,
      operaciones: 3,
      gastoMinimo: 450,
      topeMes: 10,
    },
    presupuesto: 10_000,
  },
  'cliente:US': {
    reglas: {
      regaloInvitado: 0,
      premioInvitador: 500,
      operaciones: 1,
      gastoMinimo: 4_000,
      topeMes: 10,
    },
    presupuesto: 50_000,
  },
};

const clave = (tipo: TipoPrograma, ambito: string) => `${tipo}:${ambito}`;

async function gastadoDe(db: D1Database, tipo: TipoPrograma, ambito: string) {
  const f = await db
    .prepare(
      'SELECT COALESCE(SUM(monto), 0) AS s FROM premios_referido WHERE tipo = ? AND ambito = ?',
    )
    .bind(tipo, ambito)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

/** Un programa por su ámbito exacto (país o ciudad), o sus valores por defecto si es un país. */
export async function programaDe(
  db: D1Database,
  tipo: TipoPrograma,
  ambito: string,
): Promise<Programa | null> {
  const f = await db
    .prepare(
      'SELECT activo, reglas, presupuesto FROM programas_referido WHERE tipo = ? AND ambito = ?',
    )
    .bind(tipo, ambito)
    .first<{ activo: number; reglas: string; presupuesto: number }>();
  const def = new Map(Object.entries(PROGRAMAS_POR_DEFECTO)).get(clave(tipo, ambito));
  if (!f && !def) return null;
  return {
    tipo,
    ambito,
    activo: Number(f?.activo ?? 0) === 1,
    reglas: f ? (JSON.parse(f.reglas) as Programa['reglas']) : def!.reglas,
    presupuesto: f ? Number(f.presupuesto) : def!.presupuesto,
    gastado: await gastadoDe(db, tipo, ambito),
    porDefecto: !f,
  };
}

/** El programa que rige en una ciudad: el de la ciudad si existe, si no el de su país. */
export async function programaVigente(db: D1Database, tipo: TipoPrograma, zonaId: string | null) {
  if (!zonaId) return null;
  const propio = await programaDe(db, tipo, zonaId);
  if (propio && !propio.porDefecto) return propio;
  const { pais, moneda } = await paisDeZona(db, zonaId);
  const delPais = await programaDe(db, tipo, pais);
  return delPais ? { ...delPais, moneda, pais } : null;
}

/** Los programas que el superadmin ve: los por defecto y los guardados. */
export async function listarProgramas(db: D1Database) {
  const { results } = await db
    .prepare('SELECT tipo, ambito FROM programas_referido')
    .all<{ tipo: TipoPrograma; ambito: string }>();
  const claves = new Set([
    ...Object.keys(PROGRAMAS_POR_DEFECTO),
    ...results.map((r) => clave(r.tipo, r.ambito)),
  ]);
  const lista: Programa[] = [];
  for (const k of [...claves].sort()) {
    const [tipo, ambito] = k.split(':') as [TipoPrograma, string];
    const p = await programaDe(db, tipo, ambito);
    if (p) lista.push(p);
  }
  return lista;
}

/** La comisión de un viaje típico de una ciudad o país (para «el premio es menor que lo que deja»). */
async function comisionTipicaDe(db: D1Database, ambito: string) {
  const zona = await db
    .prepare(
      `SELECT z.id, z.pais, z.moneda FROM zonas z WHERE (z.id = ?1 OR z.pais = ?1) AND z.activa = 1
         AND EXISTS (SELECT 1 FROM tarifas_viaje t WHERE t.zona_id = z.id AND t.activa = 1) LIMIT 1`,
    )
    .bind(ambito)
    .first<{ id: string; pais: string; moneda: string }>();
  if (!zona) return 0;
  const { comisionTipicaMoto } = await import('./rutas/viajesPasajero');
  return comisionTipicaMoto(db, zona);
}

/** Guarda un programa con las reglas del código: topes y «el premio es menor que lo que deja». */
export async function guardarPrograma(
  db: D1Database,
  p: {
    tipo: TipoPrograma;
    ambito: string;
    activo: boolean;
    reglas: Programa['reglas'];
    presupuesto: number;
    autorId: string;
  },
) {
  const existe = await db
    .prepare('SELECT 1 FROM zonas WHERE id = ?1 OR pais = ?1 LIMIT 1')
    .bind(p.ambito)
    .first();
  if (!existe) throw new ErrorDatos('Una de las ciudades no existe.', 'ambito', 422);
  if (p.presupuesto > TOPES_REFERIDOS.presupuestoMaximo)
    throw new ErrorDatos('Ese presupuesto pasa el máximo permitido de Divoox.', 'presupuesto', 422);
  const gastado = await gastadoDe(db, p.tipo, p.ambito);
  if (p.presupuesto < gastado)
    throw new ErrorDatos(
      'El presupuesto no puede quedar por debajo de lo que ya se gastó y está apartado.',
      'presupuesto',
      422,
    );
  if (p.tipo === 'conductor') {
    const r = p.reglas as ReglasConductor;
    if (r.premio > TOPES_REFERIDOS.premioMaximo || r.topeMes > TOPES_REFERIDOS.topeMesMaximo)
      throw new ErrorDatos('Ese premio pasa el máximo permitido de Divoox.', 'premio', 422);
    const comision = await comisionTipicaDe(db, p.ambito);
    if (comision > 0 && r.premio >= r.carreras * comision)
      throw new ErrorDatos(
        'El premio tiene que ser menor que lo que deja el invitado en comisiones.',
        'premio',
        422,
      );
  } else {
    const r = p.reglas as ReglasCliente;
    if (
      r.premioInvitador > TOPES_REFERIDOS.premioMaximo ||
      r.regaloInvitado > TOPES_REFERIDOS.premioMaximo ||
      r.topeMes > TOPES_REFERIDOS.topeMesMaximo
    )
      throw new ErrorDatos('Ese premio pasa el máximo permitido de Divoox.', 'premio', 422);
    if (r.premioInvitador >= r.gastoMinimo)
      throw new ErrorDatos(
        'El premio tiene que ser menor que lo que gasta el invitado.',
        'premioInvitador',
        422,
      );
  }
  await db
    .prepare(
      `INSERT INTO programas_referido (tipo, ambito, activo, reglas, presupuesto, actualizado_por) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tipo, ambito) DO UPDATE SET activo = excluded.activo, reglas = excluded.reglas,
         presupuesto = excluded.presupuesto, actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
    )
    .bind(p.tipo, p.ambito, p.activo ? 1 : 0, JSON.stringify(p.reglas), p.presupuesto, p.autorId)
    .run();
  // C-REFERIDOS-SIN-TRAMPA: si ahora hay presupuesto, los referidos que se cerraron por falta de
  // presupuesto vuelven a la fila (el reloj los revisa de nuevo; el que no alcance se cierra otra vez).
  if (p.presupuesto > gastado)
    await db
      .prepare(
        p.tipo === 'conductor'
          ? "UPDATE referidos_conductor SET estado = 'pendiente', motivo = NULL, cerrado_en = NULL WHERE estado = 'rechazado' AND motivo = 'sin_presupuesto'"
          : "UPDATE referidos SET cierre = NULL WHERE estado = 'pendiente' AND cierre = 'sin_presupuesto'",
      )
      .run();
  return programaDe(db, p.tipo, p.ambito);
}

/**
 * La ciudad de una persona: la de su ficha, la de su última carrera, pedido o cotización. Sirve para
 * saber qué programa le toca aunque todavía no haya pedido nada.
 */
export async function zonaDeUsuario(db: D1Database, usuarioId: string): Promise<string | null> {
  const f = await db
    .prepare(
      `SELECT COALESCE(
         (SELECT zona_id FROM repartidores WHERE usuario_id = ?1),
         (SELECT zona_id FROM usuarios WHERE id = ?1),
         (SELECT zona_id FROM operaciones WHERE cliente_id = ?1 ORDER BY creado_en DESC LIMIT 1),
         (SELECT zona_id FROM pedidos WHERE cliente_id = ?1 ORDER BY creado_en DESC LIMIT 1),
         (SELECT zona_id FROM cotizaciones_viaje WHERE cliente_id = ?1 ORDER BY creado_en DESC LIMIT 1)
       ) AS zona`,
    )
    .bind(usuarioId)
    .first<{ zona: string | null }>();
  return f?.zona ?? null;
}

// ───────────────────────── Antifraude ─────────────────────────

/** Anota la huella del aparato con el que entra una persona (una fila por aparato). */
export async function anotarAparato(db: D1Database, usuarioId: string, huella: string | null) {
  if (!huella) return;
  await db
    .prepare(
      `INSERT INTO aparatos_usuario (usuario_id, huella) VALUES (?, ?)
       ON CONFLICT(usuario_id, huella) DO NOTHING`,
    )
    .bind(usuarioId, huella)
    .run();
}

async function alertaReferido(
  db: D1Database,
  tipo: string,
  clienteId: string | null,
  conductorId: string | null,
  detalle: string,
) {
  await db
    .prepare(
      'INSERT INTO alertas_regalo (id, tipo, cliente_id, conductor_id, detalle) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(nuevoId(), tipo, clienteId, conductorId, detalle.slice(0, 300))
    .run();
}

/** La misma alerta (tipo y detalle) sale una sola vez al día: el reloj no la repite cada hora. */
async function alertaUnaVez(
  db: D1Database,
  tipo: string,
  clienteId: string | null,
  conductorId: string | null,
  detalle: string,
) {
  await db
    .prepare(
      `INSERT INTO alertas_regalo (id, tipo, cliente_id, conductor_id, detalle)
       SELECT ?1, ?2, ?3, ?4, ?5
        WHERE NOT EXISTS (SELECT 1 FROM alertas_regalo WHERE tipo = ?2 AND detalle = ?5
                            AND creado_en > datetime('now', '-1 day'))`,
    )
    .bind(nuevoId(), tipo, clienteId, conductorId, detalle.slice(0, 300))
    .run();
}

/** ¿El invitado es la misma persona que quien invita (teléfono, aparato o cuenta de cobro)? */
async function esLaMismaPersona(db: D1Database, invitadoId: string, invitadorId: string) {
  const f = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM usuarios a, usuarios b WHERE a.id = ?1 AND b.id = ?2 AND a.telefono_canonico IS NOT NULL
            AND a.telefono_canonico <> '' AND a.telefono_canonico = b.telefono_canonico) AS tel,
         (SELECT COUNT(*) FROM aparatos_usuario a JOIN aparatos_usuario b ON b.huella = a.huella
           WHERE a.usuario_id = ?1 AND b.usuario_id = ?2) AS apa,
         (SELECT COUNT(*) FROM cuentas_cobro a JOIN cuentas_cobro b ON b.identificador = a.identificador
           WHERE a.usuario_id = ?1 AND b.usuario_id = ?2) AS pago`,
    )
    .bind(invitadoId, invitadorId)
    .first<{ tel: number; apa: number; pago: number }>();
  return Number(f?.tel ?? 0) + Number(f?.apa ?? 0) + Number(f?.pago ?? 0) > 0;
}

// ───────────────────────── Equipos ─────────────────────────

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codigoDeEquipo(nombre: string) {
  const base = nombre
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const azar = Array.from(
    crypto.getRandomValues(new Uint8Array(3)),
    (b) => LETRAS[b % LETRAS.length],
  ).join('');
  return `${base || 'EQUIPO'}${azar}`;
}

export async function crearEquipo(
  db: D1Database,
  p: { nombre: string; zonaId: string; lider: string; autorId: string },
) {
  const zona = await db.prepare('SELECT id FROM zonas WHERE id = ?').bind(p.zonaId).first();
  if (!zona) throw new ErrorDatos('Una de las ciudades no existe.', 'zonaId', 422);
  const tel = telefonoCanonico(p.lider);
  const lider = await db
    .prepare(
      `SELECT id FROM usuarios WHERE rol = 'repartidor' AND (correo = ?1 COLLATE NOCASE OR (?2 <> '' AND telefono_canonico = ?2)) LIMIT 1`,
    )
    .bind(p.lider.trim(), tel ?? '')
    .first<{ id: string }>();
  if (!lider)
    throw new ErrorDatos(
      'No encontramos a ese líder. Tiene que estar registrado en Divoox Driver con ese correo o celular.',
      'lider',
      404,
    );
  for (let i = 0; i < 5; i++) {
    const id = nuevoId();
    const codigo = codigoDeEquipo(p.nombre);
    const r = await db
      .prepare(
        'INSERT OR IGNORE INTO equipos (id, nombre, zona_id, lider_id, codigo, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(id, p.nombre.trim(), p.zonaId, lider.id, codigo, p.autorId)
      .run();
    if (r.meta.changes) return { id, codigo, liderId: lider.id };
  }
  throw new ErrorDatos('No pudimos crear tu código. Intenta de nuevo.', undefined, 503);
}

/** Los equipos con sus números: registrados, aprobados, activos (7 días) y carreras. */
export async function listarEquipos(
  db: D1Database,
  filtro: { zonaId?: string | null; equipoId?: string | null } = {},
) {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.nombre, e.zona_id, e.codigo, e.activo, e.creado_en, l.nombre AS lider,
         (SELECT nombre FROM zonas WHERE id = e.zona_id) AS ciudad,
         (SELECT COUNT(*) FROM miembros_equipo m WHERE m.equipo_id = e.id) AS registrados,
         (SELECT COUNT(DISTINCT m.usuario_id) FROM miembros_equipo m JOIN habilitaciones h ON h.conductor_id = m.usuario_id
            WHERE m.equipo_id = e.id AND h.estado = 'aprobada') AS aprobados,
         (SELECT COUNT(DISTINCT m.usuario_id) FROM miembros_equipo m JOIN operaciones o ON o.conductor_id = m.usuario_id
            WHERE m.equipo_id = e.id AND o.estado_general = 'terminada' AND o.actualizado_en > datetime('now', '-7 days')) AS activos,
         (SELECT COUNT(*) FROM miembros_equipo m JOIN operaciones o ON o.conductor_id = m.usuario_id
            WHERE m.equipo_id = e.id AND o.estado_general = 'terminada') AS carreras
         FROM equipos e JOIN usuarios l ON l.id = e.lider_id
        WHERE (?1 = '' OR e.zona_id = ?1) AND (?2 = '' OR e.id = ?2)
        ORDER BY e.creado_en DESC LIMIT 200`,
    )
    .bind(filtro.zonaId ?? '', filtro.equipoId ?? '')
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    zonaId: String(r.zona_id),
    ciudad: String(r.ciudad ?? r.zona_id),
    codigo: String(r.codigo),
    lider: String(r.lider),
    activo: Number(r.activo) === 1,
    creadoEn: String(r.creado_en),
    registrados: Number(r.registrados),
    aprobados: Number(r.aprobados),
    activos: Number(r.activos),
    carreras: Number(r.carreras),
  }));
}

/** Los miembros de un equipo, con fecha, si están aprobados, activos y sus carreras. */
export async function miembrosDeEquipo(db: D1Database, equipoId: string) {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, m.creado_en,
         EXISTS (SELECT 1 FROM habilitaciones h WHERE h.conductor_id = u.id AND h.estado = 'aprobada') AS aprobado,
         (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = u.id AND o.estado_general = 'terminada') AS carreras,
         (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = u.id AND o.estado_general = 'terminada' AND o.actualizado_en > datetime('now', '-7 days')) AS carreras_7d,
         (SELECT estado FROM referidos_conductor rc WHERE rc.invitado_id = u.id) AS referido
         FROM miembros_equipo m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.equipo_id = ? ORDER BY m.creado_en DESC LIMIT 500`,
    )
    .bind(equipoId)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    desde: String(r.creado_en),
    aprobado: Number(r.aprobado) === 1,
    activo: Number(r.carreras_7d) > 0,
    carreras: Number(r.carreras),
    premio: r.referido == null ? null : String(r.referido),
  }));
}

// ───────────────────────── Al registrarse con un código ─────────────────────────

/** Qué es un código de invitación: el de un equipo o el personal de alguien. */
export async function resolverCodigo(db: D1Database, escrito: string) {
  const codigo = escrito
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (codigo.length < 4) return null;
  const equipo = await db
    .prepare(
      `SELECT e.id, e.nombre, e.lider_id, e.zona_id, l.nombre AS lider, (SELECT nombre FROM zonas WHERE id = e.zona_id) AS ciudad
         FROM equipos e JOIN usuarios l ON l.id = e.lider_id WHERE e.codigo = ? AND e.activo = 1`,
    )
    .bind(codigo)
    .first<{
      id: string;
      nombre: string;
      lider_id: string;
      zona_id: string;
      lider: string;
      ciudad: string | null;
    }>();
  if (equipo)
    return {
      codigo,
      invitadorId: equipo.lider_id,
      equipoId: equipo.id,
      equipo: equipo.nombre,
      nombre: equipo.lider.split(' ')[0] ?? '',
      ciudad: equipo.ciudad,
      zonaId: equipo.zona_id,
      rol: 'repartidor',
    };
  const p = await db
    .prepare(
      `SELECT c.usuario_id, u.nombre, u.rol, COALESCE(r.zona_id, u.zona_id) AS zona_id FROM codigos_referido c
         JOIN usuarios u ON u.id = c.usuario_id LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE c.codigo = ?`,
    )
    .bind(codigo)
    .first<{ usuario_id: string; nombre: string; rol: string; zona_id: string | null }>();
  if (!p) return null;
  return {
    codigo,
    invitadorId: p.usuario_id,
    equipoId: null as string | null,
    equipo: null as string | null,
    nombre: p.nombre.split(' ')[0] ?? '',
    ciudad: null as string | null,
    zonaId: p.zona_id ?? (await zonaDeUsuario(db, p.usuario_id)),
    rol: p.rol,
  };
}

/**
 * C-REFERIDOS-SIN-TRAMPA: el código tiene que existir y ser del mismo tipo de cuenta. Un conductor
 * entra con el código de un equipo o de otro conductor; un cliente, con el de otro cliente. Se
 * comprueba ANTES de crear la cuenta, para decírselo a la persona en la casilla del código.
 */
export async function codigoPara(
  db: D1Database,
  rol: 'repartidor' | 'cliente',
  escrito: string,
  campo = 'codigo',
) {
  const c = await resolverCodigo(db, escrito);
  if (!c) throw new ErrorDatos('Ese código no existe.', campo, 404);
  if (rol === 'repartidor' && c.rol !== 'repartidor')
    throw new ErrorDatos(
      'Ese código es de un cliente. Pídele su código a tu líder o a otro conductor.',
      campo,
      409,
    );
  if (rol === 'cliente' && (c.equipoId || c.rol !== 'cliente'))
    throw new ErrorDatos(
      'Ese código es para conductores. Pídele su código a un amigo que ya use Divoox.',
      campo,
      409,
    );
  return c;
}

/**
 * Un conductor nuevo con un código: queda en el equipo (si es de un equipo, para siempre y con
 * fecha) y como referido de quien invitó, salvo que sea la misma persona (queda la alerta).
 */
export async function vincularConductor(db: D1Database, invitadoId: string, escrito: string) {
  const c = await codigoPara(db, 'repartidor', escrito);
  if (c.invitadorId === invitadoId)
    throw new ErrorDatos('No puedes usar tu propio código.', 'codigo', 409);
  const ya = await db
    .prepare('SELECT 1 FROM referidos_conductor WHERE invitado_id = ?')
    .bind(invitadoId)
    .first();
  if (ya) throw new ErrorDatos('Ya usaste un código de invitación.', 'codigo', 409);
  const carreras = await db
    .prepare(
      "SELECT 1 FROM operaciones WHERE conductor_id = ? AND estado_general = 'terminada' LIMIT 1",
    )
    .bind(invitadoId)
    .first();
  if (carreras)
    throw new ErrorDatos(
      'El código es solo para conductores que todavía no hicieron carreras.',
      'codigo',
      409,
    );
  const propio = await esLaMismaPersona(db, invitadoId, c.invitadorId);
  if (propio)
    await alertaReferido(
      db,
      'referido_propio',
      null,
      invitadoId,
      'Un conductor intentó invitarse a sí mismo (mismo teléfono, aparato o cuenta de cobro).',
    );
  await db.batch([
    ...(c.equipoId
      ? [
          db
            .prepare('INSERT OR IGNORE INTO miembros_equipo (usuario_id, equipo_id) VALUES (?, ?)')
            .bind(invitadoId, c.equipoId),
        ]
      : []),
    db
      .prepare(
        'INSERT OR IGNORE INTO referidos_conductor (invitado_id, invitador_id, equipo_id, zona_id, estado, motivo) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        invitadoId,
        c.invitadorId,
        c.equipoId,
        c.zonaId,
        propio ? 'rechazado' : 'pendiente',
        propio ? 'misma_persona' : null,
      ),
  ]);
  return c;
}

/** Un cliente nuevo con un código: su regalo de invitado (si el programa lo da) y el vínculo. */
export async function vincularCliente(
  db: D1Database,
  invitadoId: string,
  escrito: string,
  zonaId: string | null,
) {
  const c = await codigoPara(db, 'cliente', escrito);
  if (c.invitadorId === invitadoId)
    throw new ErrorDatos('No puedes usar tu propio código.', 'codigo', 409);
  const yaPidio = await db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM pedidos WHERE cliente_id = ?1 AND estado <> 'cancelado')
           OR EXISTS (SELECT 1 FROM operaciones WHERE cliente_id = ?1 AND estado_general = 'terminada') AS si`,
    )
    .bind(invitadoId)
    .first<{ si: number }>();
  if (Number(yaPidio?.si ?? 0) === 1)
    throw new ErrorDatos('El código es solo para tu primer pedido.', 'codigo', 409);
  const propio = await esLaMismaPersona(db, invitadoId, c.invitadorId);
  const programa = await programaVigente(db, 'cliente', zonaId ?? c.zonaId);
  const id = nuevoId();
  const r = await db
    .prepare(
      'INSERT OR IGNORE INTO referidos (id, invitado_id, invitador_id, estado, para_amigo, para_quien_invita, cierre) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    // Los montos van en cero: los da el programa (premios_referido), no el «Invita a un amigo» viejo.
    // C-REFERIDOS-SIN-TRAMPA: si es la misma persona, el vínculo nace cerrado y nunca da premio.
    .bind(id, invitadoId, c.invitadorId, 'pendiente', 0, 0, propio ? 'misma_persona' : null)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ya usaste un código de invitación.', 'codigo', 409);
  if (propio) {
    await alertaReferido(
      db,
      'referido_propio',
      invitadoId,
      null,
      'Un cliente intentó invitarse a sí mismo (mismo teléfono o aparato).',
    );
    return { ...c, regalo: 0 };
  }
  let regalo = 0;
  if (programa?.activo && programa.tipo === 'cliente') {
    const reglas = programa.reglas as ReglasCliente;
    if (reglas.regaloInvitado > 0)
      ({ monto: regalo } = await darPremio(db, {
        programa,
        rol: 'invitado',
        beneficiarioId: invitadoId,
        invitadoId,
        monto: reglas.regaloInvitado,
        zonaId: zonaId ?? c.zonaId,
        nombreEs: 'Tu primer viaje gratis por invitación',
        nombreEn: 'Your first ride free by invitation',
        tipoCupon: 'gratis',
      }));
  }
  return { ...c, regalo };
}

// ───────────────────────── Premios ─────────────────────────

/** Por qué un premio se dio o no se dio. */
type Premio = {
  monto: number;
  motivo: 'dado' | 'ya_dado' | 'sin_presupuesto' | 'tope_mes' | 'sin_ciudad' | 'sin_premio';
};

/**
 * Da un premio contra el presupuesto del programa: la fila del premio nace SOLO si lo dado más este
 * premio no pasa el presupuesto y si el beneficiario no pasó su tope del mes (en la misma sentencia).
 * Conductor: saldo prepago. Cliente en un país en mano: un regalo de Divoox personal (un cupón de un
 * solo uso, guardado en su cuenta). Cliente con tarjeta (EE. UU.): saldo de regalo.
 *
 * C-REFERIDOS-SIN-TRAMPA: el premio, su acreditación y el gasto de Divoox van en UN solo lote. La
 * acreditación está condicionada a que la fila del premio haya nacido en ese mismo lote; si algo
 * falla, no queda nada escrito y el premio se puede reintentar.
 */
async function darPremio(
  db: D1Database,
  p: {
    programa: Programa & { moneda?: string; pais?: string };
    rol: 'invitado' | 'invitador';
    beneficiarioId: string;
    invitadoId: string;
    monto: number;
    zonaId: string | null;
    nombreEs: string;
    nombreEn: string;
    tipoCupon: 'monto' | 'gratis';
  },
): Promise<Premio> {
  if (p.monto <= 0) return { monto: 0, motivo: 'sin_premio' };
  if (!p.zonaId) return { monto: 0, motivo: 'sin_ciudad' };
  const { pais, moneda } = await paisDeZona(db, p.zonaId);
  const topeMes = Math.min(
    (p.programa.reglas as { topeMes: number }).topeMes,
    TOPES_REFERIDOS.topeMesMaximo,
  );
  const monto = Math.min(p.monto, TOPES_REFERIDOS.premioMaximo);
  const forma = p.programa.tipo === 'conductor' ? 'saldo' : pais === 'US' ? 'credito' : 'cupon';
  const id = nuevoId();
  const ref = `premio-referido:${id}`;
  const nacio = 'EXISTS (SELECT 1 FROM premios_referido WHERE id = ?)';
  const acreditar: D1PreparedStatement[] = [];
  if (forma === 'saldo') {
    acreditar.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
           SELECT ?, ?, 'prepago', ?, ?, ?, 'premio_referido', ? WHERE ${nacio}`,
        )
        .bind(crypto.randomUUID(), p.beneficiarioId, pais, moneda, monto, ref, id),
    );
  } else if (forma === 'credito') {
    acreditar.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO creditos_regalo (id, usuario_id, centavos, motivo, referencia)
           SELECT ?, ?, ?, ?, ? WHERE ${nacio}`,
        )
        .bind(
          nuevoId(),
          p.beneficiarioId,
          monto,
          p.rol === 'invitado' ? 'referido_amigo' : 'referido_invita',
          ref,
          id,
        ),
    );
  } else {
    // Un regalo de Divoox personal: un cupón de un solo uso por el monto exacto, en las ciudades del
    // país, guardado en la cuenta de la persona. Lo paga Divoox y lo cierra el mismo motor de regalos.
    const { results: zonas } = await db
      .prepare('SELECT id FROM zonas WHERE pais = ? AND activa = 1')
      .bind(pais)
      .all<{ id: string }>();
    const codigo = `PREMIO${(await sha256(id)).slice(0, 10).toUpperCase()}`;
    acreditar.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO cupones_divoox (codigo, nombre_es, nombre_en, tipo, valor, moneda, servicios, zonas, vence_en, presupuesto, bienvenida, tope_diario_conductor, activo, creado_por)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+90 days'), ?, 0, 6, 1, 'referidos' WHERE ${nacio}`,
        )
        .bind(
          codigo,
          p.nombreEs,
          p.nombreEn,
          p.tipoCupon,
          monto,
          moneda,
          JSON.stringify(['moto', 'carro', 'envios', 'comida']),
          JSON.stringify(zonas.map((z) => z.id)),
          monto,
          id,
        ),
      db
        .prepare(
          `INSERT OR IGNORE INTO cupones_divoox_guardados (cliente_id, codigo) SELECT ?, ? WHERE ${nacio}`,
        )
        .bind(p.beneficiarioId, codigo, id),
      db.prepare('UPDATE premios_referido SET referencia = ? WHERE id = ?').bind(codigo, id),
    );
  }
  const [ins] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO premios_referido (id, tipo, ambito, rol, beneficiario_id, invitado_id, monto, moneda, pais, forma)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
          WHERE (SELECT COALESCE(SUM(monto), 0) FROM premios_referido WHERE tipo = ?2 AND ambito = ?3) + ?7 <= ?11
            AND (SELECT COUNT(*) FROM premios_referido WHERE beneficiario_id = ?5 AND rol = ?4
                   AND creado_en > datetime('now', '-30 days')) < ?12`,
      )
      .bind(
        id,
        p.programa.tipo,
        p.programa.ambito,
        p.rol,
        p.beneficiarioId,
        p.invitadoId,
        monto,
        moneda,
        pais,
        forma,
        p.programa.presupuesto,
        topeMes,
      ),
    ...acreditar,
    // El gasto de Divoox en referidos, en su libro (contrapartida), una vez por premio.
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
         SELECT ?, ?, 'comisiones', ?, ?, ?, 'premio_referido_pagado', ? WHERE ${nacio}`,
      )
      .bind(crypto.randomUUID(), CUENTA_TUMBITE, pais, moneda, -monto, `${ref}:divoox`, id),
  ]);
  if (ins?.meta.changes) return { monto, motivo: 'dado' };
  const f = await db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM premios_referido WHERE tipo = ?1 AND rol = ?2 AND invitado_id = ?3) AS ya,
              (SELECT COALESCE(SUM(monto), 0) FROM premios_referido WHERE tipo = ?1 AND ambito = ?4) AS gastado`,
    )
    .bind(p.programa.tipo, p.rol, p.invitadoId, p.programa.ambito)
    .first<{ ya: number; gastado: number }>();
  if (Number(f?.ya ?? 0) === 1) return { monto: 0, motivo: 'ya_dado' };
  const motivo =
    Number(f?.gastado ?? 0) + monto > p.programa.presupuesto ? 'sin_presupuesto' : 'tope_mes';
  // Una alerta por programa y por día, no una por referido ni una por hora.
  await alertaUnaVez(
    db,
    'referido_sin_premio',
    null,
    null,
    motivo === 'sin_presupuesto'
      ? `El programa de referidos ${p.programa.tipo} · ${p.programa.ambito} se quedó sin presupuesto: hay premios que no se dieron. Súbele el presupuesto para que vuelvan a contar.`
      : `En el programa de referidos ${p.programa.tipo} · ${p.programa.ambito} alguien llegó a su tope de premios del mes.`,
  );
  return { monto: 0, motivo };
}

/** Desde qué fila revisa el reloj: rota de a cien por hora para que nadie se quede sin revisar. */
function turnoDe(pendientes: number) {
  if (pendientes <= 100) return 0;
  return (Math.floor(Date.now() / 3_600_000) * 100) % pendientes;
}

/**
 * Revisa los referidos pendientes: conductores (N carreras en X días, sin contar las que hizo con
 * quien lo invitó) y clientes (N pedidos o viajes pagados y el gasto mínimo, sin contar los que hizo
 * con quien lo invitó). Da los premios y cierra los vencidos. Idempotente; lo corre el reloj y la
 * entrega o el fin de un viaje.
 *
 * C-REFERIDOS-SIN-TRAMPA: antes de premiar se vuelve a comprobar que no sean la misma persona (el
 * aparato o la cuenta de cobro pueden coincidir después del registro); un premio que no se puede dar
 * (sin presupuesto, premio en cero o sin ciudad) cierra el referido en vez de quedarse pendiente para
 * siempre; el tope del mes lo deja pendiente, para que cobre cuando el tope lo permita.
 */
export async function revisarReferidos(db: D1Database, soloInvitado?: string) {
  let dados = 0;
  const solo = soloInvitado ?? '';
  const cuenta = async (sql: string) =>
    solo ? 0 : Number((await db.prepare(sql).first<{ n: number }>())?.n ?? 0);
  const { results: conductores } = await db
    .prepare(
      `SELECT invitado_id, invitador_id, zona_id, creado_en FROM referidos_conductor
        WHERE estado = 'pendiente' AND (?1 = '' OR invitado_id = ?1) ORDER BY creado_en, invitado_id LIMIT 100 OFFSET ?2`,
    )
    .bind(
      solo,
      turnoDe(
        await cuenta("SELECT COUNT(*) AS n FROM referidos_conductor WHERE estado = 'pendiente'"),
      ),
    )
    .all<{
      invitado_id: string;
      invitador_id: string;
      zona_id: string | null;
      creado_en: string;
    }>();
  const cerrarConductor = (invitadoId: string, estado: string, motivo: string | null) =>
    db
      .prepare(
        "UPDATE referidos_conductor SET estado = ?, motivo = ?, cerrado_en = datetime('now') WHERE invitado_id = ? AND estado = 'pendiente'",
      )
      .bind(estado, motivo, invitadoId)
      .run();
  for (const r of conductores) {
    const zona =
      r.zona_id ??
      (
        await db
          .prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
          .bind(r.invitado_id)
          .first<{ zona_id: string | null }>()
      )?.zona_id ??
      null;
    const programa = await programaVigente(db, 'conductor', zona);
    if (!programa) continue;
    const reglas = programa.reglas as ReglasConductor;
    const f = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = ?1 AND o.estado_general = 'terminada'
              AND o.cliente_id <> ?2 AND o.actualizado_en <= datetime(?3, ?4)) AS carreras,
           (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = ?1 AND o.estado_general = 'terminada' AND o.cliente_id = ?2) AS entre_ellos,
           (SELECT MAX(n) FROM (SELECT COUNT(*) AS n FROM operaciones o WHERE o.conductor_id = ?1 AND o.estado_general = 'terminada' GROUP BY o.cliente_id)) AS mismo_pasajero,
           datetime(?3, ?4) < datetime('now') AS vencido`,
      )
      .bind(r.invitado_id, r.invitador_id, r.creado_en, `+${reglas.dias} days`)
      .first<{
        carreras: number;
        entre_ellos: number;
        mismo_pasajero: number | null;
        vencido: number;
      }>();
    const carreras = Number(f?.carreras ?? 0);
    if (
      Number(f?.entre_ellos ?? 0) > 0 &&
      !(await db
        .prepare(
          "SELECT 1 FROM alertas_regalo WHERE tipo = 'referido_entre_ellos' AND conductor_id = ? LIMIT 1",
        )
        .bind(r.invitado_id)
        .first())
    )
      await alertaReferido(
        db,
        'referido_entre_ellos',
        r.invitador_id,
        r.invitado_id,
        'Hay carreras entre el que invitó y su invitado; no cuentan para el premio.',
      );
    if (carreras >= reglas.carreras) {
      if (
        Number(f?.mismo_pasajero ?? 0) * 2 >= carreras &&
        !(await db
          .prepare(
            "SELECT 1 FROM alertas_regalo WHERE tipo = 'referido_mismo_pasajero' AND conductor_id = ? LIMIT 1",
          )
          .bind(r.invitado_id)
          .first())
      )
        await alertaReferido(
          db,
          'referido_mismo_pasajero',
          null,
          r.invitado_id,
          'La mitad o más de las carreras del invitado son con el mismo pasajero.',
        );
      if (!programa.activo) continue;
      if (await esLaMismaPersona(db, r.invitado_id, r.invitador_id)) {
        await cerrarConductor(r.invitado_id, 'rechazado', 'misma_persona');
        await alertaReferido(
          db,
          'referido_propio',
          null,
          r.invitado_id,
          'Un conductor invitado resultó ser la misma persona que quien lo invitó (mismo teléfono, aparato o cuenta de cobro). No se dio el premio.',
        );
        continue;
      }
      const premio = await darPremio(db, {
        programa,
        rol: 'invitador',
        beneficiarioId: r.invitador_id,
        invitadoId: r.invitado_id,
        monto: reglas.premio,
        zonaId: zona,
        nombreEs: '',
        nombreEn: '',
        tipoCupon: 'monto',
      });
      if (premio.motivo === 'dado') dados++;
      if (premio.motivo === 'dado' || premio.motivo === 'ya_dado')
        await cerrarConductor(r.invitado_id, 'premiado', null);
      // El tope del mes no cierra nada: el referido sigue pendiente y cobra cuando el tope lo permita.
      else if (premio.motivo !== 'tope_mes')
        await cerrarConductor(r.invitado_id, 'rechazado', premio.motivo);
    } else if (Number(f?.vencido ?? 0) === 1) {
      await cerrarConductor(r.invitado_id, 'vencido', null);
    }
  }
  const { results: clientes } = await db
    .prepare(
      `SELECT r.id, r.invitado_id, r.invitador_id, u.zona_id FROM referidos r JOIN usuarios u ON u.id = r.invitado_id
        WHERE r.estado = 'pendiente' AND r.cierre IS NULL AND (?1 = '' OR r.invitado_id = ?1)
        ORDER BY r.creado_en, r.id LIMIT 100 OFFSET ?2`,
    )
    .bind(
      solo,
      turnoDe(
        await cuenta(
          "SELECT COUNT(*) AS n FROM referidos WHERE estado = 'pendiente' AND cierre IS NULL",
        ),
      ),
    )
    .all<{ id: string; invitado_id: string; invitador_id: string; zona_id: string | null }>();
  const cerrarCliente = (id: string, cierre: string) =>
    db
      .prepare("UPDATE referidos SET cierre = ? WHERE id = ? AND estado = 'pendiente'")
      .bind(cierre, id)
      .run();
  for (const r of clientes) {
    // La ciudad del cliente: la de su última operación o pedido.
    const zona =
      (
        await db
          .prepare(
            `SELECT zona_id FROM (
               SELECT zona_id, creado_en FROM operaciones WHERE cliente_id = ?1 AND estado_general = 'terminada'
               UNION ALL SELECT zona_id, creado_en FROM pedidos WHERE cliente_id = ?1 AND estado = 'entregado'
             ) ORDER BY creado_en DESC LIMIT 1`,
          )
          .bind(r.invitado_id)
          .first<{ zona_id: string | null }>()
      )?.zona_id ?? r.zona_id;
    const programa = await programaVigente(db, 'cliente', zona);
    if (!programa?.activo) continue;
    const reglas = programa.reglas as ReglasCliente;
    const f = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM operaciones o WHERE o.cliente_id = ?1 AND o.estado_general = 'terminada' AND COALESCE(o.conductor_id, '') <> ?2)
         + (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = ?1 AND p.estado = 'entregado' AND COALESCE(p.repartidor_id, '') <> ?2) AS operaciones,
           (SELECT COALESCE(SUM(v.total_final_centavos), 0) FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
              WHERE o.cliente_id = ?1 AND o.estado_general = 'terminada' AND COALESCE(o.conductor_id, '') <> ?2)
         + (SELECT COALESCE(SUM(p.total), 0) FROM pedidos p WHERE p.cliente_id = ?1 AND p.estado = 'entregado' AND COALESCE(p.repartidor_id, '') <> ?2) AS gasto`,
      )
      .bind(r.invitado_id, r.invitador_id)
      .first<{ operaciones: number; gasto: number }>();
    if (
      Number(f?.operaciones ?? 0) < reglas.operaciones ||
      Number(f?.gasto ?? 0) < reglas.gastoMinimo
    )
      continue;
    if (await esLaMismaPersona(db, r.invitado_id, r.invitador_id)) {
      await cerrarCliente(r.id, 'misma_persona');
      await alertaReferido(
        db,
        'referido_propio',
        r.invitado_id,
        null,
        'Un cliente invitado resultó ser la misma persona que quien lo invitó (mismo teléfono o aparato). No se dio el premio.',
      );
      continue;
    }
    const premio = await darPremio(db, {
      programa,
      rol: 'invitador',
      beneficiarioId: r.invitador_id,
      invitadoId: r.invitado_id,
      monto: reglas.premioInvitador,
      zonaId: zona,
      nombreEs: 'Premio por invitar a un amigo',
      nombreEn: 'Reward for inviting a friend',
      tipoCupon: 'monto',
    });
    if (premio.motivo === 'dado') dados++;
    if (premio.motivo === 'dado' || premio.motivo === 'ya_dado')
      await db
        .prepare(
          "UPDATE referidos SET estado = 'premiado', premiado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
        )
        .bind(r.id)
        .run();
    else if (premio.motivo !== 'tope_mes') await cerrarCliente(r.id, premio.motivo);
  }
  return dados;
}

export const TAREA_REFERIDOS = {
  nombre: 'referidos',
  critica: false,
  escriturasEsperadas: 400,
  correr: (_env: unknown, db: D1Database) => revisarReferidos(db),
};

/** Lo que ve una persona de sus invitaciones (Driver «Mi equipo» y el cliente «Invita a un amigo»). */
export async function misInvitaciones(
  db: D1Database,
  usuario: { id: string; nombre: string },
  sitio: string,
) {
  const codigo = await miCodigo(db, usuario.id, usuario.nombre);
  const { results: invitados } = await db
    .prepare(
      `SELECT u.nombre, rc.estado, rc.creado_en,
         (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = rc.invitado_id AND o.estado_general = 'terminada' AND o.cliente_id <> rc.invitador_id) AS carreras
         FROM referidos_conductor rc JOIN usuarios u ON u.id = rc.invitado_id
        WHERE rc.invitador_id = ? ORDER BY rc.creado_en DESC LIMIT 100`,
    )
    .bind(usuario.id)
    .all<Record<string, unknown>>();
  const ganado = await db
    .prepare(
      "SELECT COALESCE(SUM(monto), 0) AS s FROM premios_referido WHERE beneficiario_id = ? AND rol = 'invitador'",
    )
    .bind(usuario.id)
    .first<{ s: number }>();
  const equipos = await db
    .prepare('SELECT id FROM equipos WHERE lider_id = ? AND activo = 1')
    .bind(usuario.id)
    .all<{ id: string }>();
  const equipo = equipos.results[0]
    ? (await listarEquipos(db, { equipoId: equipos.results[0].id }))[0]
    : null;
  // Robot (18 nov 2026): el miembro ve a qué equipo pertenece y quién lo lidera, y si ya quedó
  // registrado como invitado (aunque el referido no cuente, por ejemplo por el mismo aparato).
  const miEquipo = await db
    .prepare(
      `SELECT e.nombre, u.nombre AS lider FROM miembros_equipo m
         JOIN equipos e ON e.id = m.equipo_id JOIN usuarios u ON u.id = e.lider_id
        WHERE m.usuario_id = ? ORDER BY m.creado_en DESC LIMIT 1`,
    )
    .bind(usuario.id)
    .first<{ nombre: string; lider: string }>();
  const invitado = await db
    .prepare('SELECT 1 AS si FROM referidos_conductor WHERE invitado_id = ? LIMIT 1')
    .bind(usuario.id)
    .first<{ si: number }>();
  return {
    miEquipo: miEquipo
      ? { nombre: miEquipo.nombre, lider: String(miEquipo.lider).split(' ')[0] ?? '' }
      : null,
    yaInvitado: Boolean(miEquipo || invitado),
    codigo,
    enlace: `${sitio}/join/${codigo}`,
    ganado: Number(ganado?.s ?? 0),
    invitados: invitados.map((r) => ({
      nombre: String(r.nombre).split(' ')[0] ?? '',
      estado: String(r.estado),
      carreras: Number(r.carreras),
      desde: String(r.creado_en),
    })),
    equipo: equipo
      ? {
          ...equipo,
          enlace: `${sitio}/join/${equipo.codigo}`,
          miembros: await miembrosDeEquipo(db, equipo.id),
        }
      : null,
  };
}
