import { type PapelDePersona, VERSION_TERMINOS, esPapelDePersona } from '@tumbite/compartido';
import { hashClave, nuevoId, nuevoToken } from './cripto';
import { ErrorDatos } from './validar';

/**
 * C-CUENTA-UNICA (24 nov 2026, Richard; todos los países). UNA persona, UNA cuenta, varios papeles,
 * como Uber, DoorDash, DiDi e inDrive (ficha docs/investigaciones-rea/2026-11-24-cuenta-unica.md).
 *
 * - El papel principal sigue en `usuarios.rol` (lo leen las apps publicadas y las consultas de hoy).
 *   Cuando una persona con papel de cliente activa el de conductor, su papel principal pasa a ser
 *   «repartidor» (así el reparto, los saldos, el plazo de papeles y la verificación la ven sin
 *   cambiar nada) y «cliente» queda en `usuario_papeles`.
 * - Cada sesión guarda el papel de la app que la abrió (`sesiones.papel`): la app de clientes ve a la
 *   persona como cliente y Driver como conductor, con el mismo token de identidad.
 * - Lo de cada papel queda separado: saldo y ganancias del conductor, pedidos y deuda del cliente.
 * - Suspender por papeles vencidos suspende solo el papel de conductor (sigue pudiendo pedir); el
 *   fraude o la seguridad suspenden a la persona entera (C-CUENTA-UNICA-SUSPENSION).
 */

export type EstadoPapel = 'activo' | 'suspendido' | null;

/** El estado de un papel de la persona: activo, suspendido o null (no lo tiene). */
export async function estadoPapel(
  db: D1Database,
  u: { id: string; rol: string },
  papel: string,
): Promise<EstadoPapel> {
  const f = await db
    .prepare('SELECT estado FROM usuario_papeles WHERE usuario_id = ? AND papel = ?')
    .bind(u.id, papel)
    .first<{ estado: 'activo' | 'suspendido' }>();
  if (f) return f.estado;
  return u.rol === papel ? 'activo' : null;
}

/** Los papeles de la persona (el principal y los añadidos), con su estado. */
export async function papelesDe(
  db: D1Database,
  u: { id: string; rol: string },
): Promise<{ papel: string; estado: 'activo' | 'suspendido' }[]> {
  const { results } = await db
    .prepare('SELECT papel, estado FROM usuario_papeles WHERE usuario_id = ?')
    .bind(u.id)
    .all<{ papel: string; estado: 'activo' | 'suspendido' }>();
  const lista = [...results];
  if (!lista.some((p) => p.papel === u.rol)) lista.unshift({ papel: u.rol, estado: 'activo' });
  return lista;
}

/** C-CUENTA-UNICA: los términos de un papel, aparte de los de los otros papeles de la misma cuenta. */
export function sentenciaTerminosPapel(db: D1Database, usuarioId: string, papel: string) {
  return db
    .prepare('INSERT OR IGNORE INTO terminos_papel (usuario_id, papel, version) VALUES (?, ?, ?)')
    .bind(usuarioId, papel, VERSION_TERMINOS);
}

/**
 * Activa el papel que falta (con la aceptación de sus términos ya hecha en la app). Devuelve el papel
 * principal que queda en `usuarios.rol`. Una sola transacción; nada se escribe si ya lo tenía.
 */
export async function activarPapel(
  db: D1Database,
  u: { id: string; rol: string },
  papel: PapelDePersona,
): Promise<string> {
  if (!esPapelDePersona(u.rol) || u.rol === papel)
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  if (papel === 'repartidor') {
    // El conductor pasa a ser el papel principal; «cliente» queda como papel añadido. Las sesiones
    // que la persona ya tenía abiertas eran de la app de clientes: siguen siendo de cliente.
    await db.batch([
      db
        .prepare(
          `INSERT INTO usuario_papeles (usuario_id, papel) VALUES (?, 'cliente')
           ON CONFLICT(usuario_id, papel) DO NOTHING`,
        )
        .bind(u.id),
      db
        .prepare("UPDATE sesiones SET papel = 'cliente' WHERE usuario_id = ? AND papel IS NULL")
        .bind(u.id),
      db
        .prepare("UPDATE usuarios SET rol = 'repartidor' WHERE id = ? AND rol = 'cliente'")
        .bind(u.id),
      sentenciaTerminosPapel(db, u.id, 'repartidor'),
    ]);
    return 'repartidor';
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO usuario_papeles (usuario_id, papel) VALUES (?, 'cliente')
         ON CONFLICT(usuario_id, papel) DO NOTHING`,
      )
      .bind(u.id),
    sentenciaTerminosPapel(db, u.id, 'cliente'),
  ]);
  return u.rol;
}

// ─────────────── C-CUENTA-UNICA-SUSPENSION ───────────────

export type MotivoSuspension = 'fraude' | 'seguridad' | 'papeles' | 'otro';

/**
 * Decisión de Richard (24 nov 2026): el fraude o la seguridad suspenden a la PERSONA (y los
 * restaurantes de los que es dueña); los papeles vencidos suspenden solo el papel de conductor: sigue
 * pudiendo pedir como cliente. «Otro» se queda como hasta hoy (la cuenta entera).
 */
export const SUSPENDE_A_LA_PERSONA: ReadonlySet<MotivoSuspension> = new Set([
  'fraude',
  'seguridad',
  'otro',
]);

/** Suspende solo el papel de conductor: Driver se cierra y no se conecta; la app de clientes sigue. */
export async function suspenderPapelConductor(db: D1Database, usuarioId: string, motivo: string) {
  await db.batch([
    db
      .prepare(
        `INSERT INTO usuario_papeles (usuario_id, papel, estado, motivo) VALUES (?1, 'repartidor', 'suspendido', ?2)
         ON CONFLICT(usuario_id, papel) DO UPDATE SET estado = 'suspendido', motivo = excluded.motivo,
           actualizado_en = datetime('now')`,
      )
      .bind(usuarioId, motivo),
    db.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?').bind(usuarioId),
    db
      .prepare(
        `DELETE FROM sesiones WHERE usuario_id = ?1 AND (papel = 'repartidor'
           OR (papel IS NULL AND (SELECT rol FROM usuarios WHERE id = ?1) = 'repartidor'))`,
      )
      .bind(usuarioId),
  ]);
}

/** Al reactivar, vuelve el papel de conductor (la fila del principal se borra: sin fila, activo). */
export function sentenciasReactivarPapeles(db: D1Database, usuarioId: string) {
  return [
    db
      .prepare(
        "DELETE FROM usuario_papeles WHERE usuario_id = ? AND estado = 'suspendido' AND papel = (SELECT rol FROM usuarios WHERE id = usuario_papeles.usuario_id)",
      )
      .bind(usuarioId),
    db
      .prepare(
        "UPDATE usuario_papeles SET estado = 'activo', motivo = '', actualizado_en = datetime('now') WHERE usuario_id = ? AND estado = 'suspendido'",
      )
      .bind(usuarioId),
  ];
}

/**
 * Las sentencias que suspenden a la persona entera por fraude o seguridad, con los negocios
 * (restaurantes) de los que es dueña. Suspender un restaurante solo NO llega aquí: eso no toca a la
 * persona, salvo que sea por fraude (C-CUENTA-UNICA-RESTAURANTE).
 */
export function sentenciasSuspenderNegociosDe(db: D1Database, personaId: string) {
  return [
    // Se anota cuáles caen por ESTA suspensión: al reactivar a la persona vuelven solo esos (no los
    // que ya estaban apagados por otra causa).
    db
      .prepare(
        `INSERT OR IGNORE INTO suspensiones_negocio (negocio_id, persona_id)
         SELECT d.negocio_id, d.persona_id FROM duenos_negocio d JOIN usuarios n ON n.id = d.negocio_id
          WHERE d.persona_id = ? AND n.activo = 1`,
      )
      .bind(personaId),
    db
      .prepare(
        'UPDATE usuarios SET activo = 0 WHERE id IN (SELECT negocio_id FROM duenos_negocio WHERE persona_id = ?)',
      )
      .bind(personaId),
    db
      .prepare(
        'DELETE FROM sesiones WHERE usuario_id IN (SELECT negocio_id FROM duenos_negocio WHERE persona_id = ?)',
      )
      .bind(personaId),
    db
      .prepare(
        'UPDATE restaurantes SET abierto = 0 WHERE dueno_id IN (SELECT negocio_id FROM duenos_negocio WHERE persona_id = ?)',
      )
      .bind(personaId),
  ];
}

/** Al reactivar a la persona: vuelven los restaurantes que cayeron con ella (y solo esos). */
export function sentenciasReactivarNegociosDe(db: D1Database, personaId: string) {
  return [
    db
      .prepare(
        'UPDATE usuarios SET activo = 1 WHERE id IN (SELECT negocio_id FROM suspensiones_negocio WHERE persona_id = ?)',
      )
      .bind(personaId),
    db.prepare('DELETE FROM suspensiones_negocio WHERE persona_id = ?').bind(personaId),
  ];
}

// ─────────────── C-CUENTA-UNICA-RESTAURANTE ───────────────

/** El correo interno de una cuenta de negocio: nunca recibe nada; los correos van a su dueño. */
export const DOMINIO_NEGOCIO = '@negocio.divoox.invalid';
export const esCorreoDeNegocio = (correo: string) => correo.toLowerCase().endsWith(DOMINIO_NEGOCIO);

/** Los restaurantes (cuentas de negocio) de los que esta persona es dueña. */
export async function negociosDe(db: D1Database, personaId: string) {
  const { results } = await db
    .prepare(
      `SELECT n.id, n.nombre, n.activo, r.id AS restaurante_id, r.nombre AS restaurante, r.estado
         FROM duenos_negocio d JOIN usuarios n ON n.id = d.negocio_id
         LEFT JOIN restaurantes r ON r.dueno_id = n.id
        WHERE d.persona_id = ? ORDER BY d.creado_en LIMIT 50`,
    )
    .bind(personaId)
    .all<{
      id: string;
      nombre: string;
      activo: number;
      restaurante_id: string | null;
      restaurante: string | null;
      estado: string | null;
    }>();
  return results.map((r) => ({
    negocioId: r.id,
    nombre: r.restaurante ?? r.nombre,
    estado: r.estado ?? 'sin_datos',
    activo: Number(r.activo) === 1,
  }));
}

/** Tope de restaurantes por dueño (los grandes no ponen uno visible; esto frena un abuso). */
export const MAX_NEGOCIOS_POR_PERSONA = 20;

/**
 * Crea la cuenta de negocio de un restaurante nuevo para su dueño (una persona con papel de cliente o
 * de conductor). El restaurante en sí se llena después en «Mi restaurante» y pasa por la aprobación
 * del equipo, como cualquier alta.
 */
export async function crearNegocio(
  db: D1Database,
  persona: { id: string; nombre: string; idioma: 'es' | 'en' },
  nombre: string,
): Promise<string> {
  const ya = await db
    .prepare('SELECT COUNT(*) AS n FROM duenos_negocio WHERE persona_id = ?')
    .bind(persona.id)
    .first<{ n: number }>();
  if (Number(ya?.n ?? 0) >= MAX_NEGOCIOS_POR_PERSONA)
    throw new ErrorDatos(
      'Llegaste al máximo de restaurantes en una cuenta. Escríbenos a soporte.',
      undefined,
      409,
    );
  const id = nuevoId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO usuarios (id, correo, nombre, rol, idioma, clave_hash, correo_confirmado_en)
         VALUES (?, ?, ?, 'restaurante', ?, ?, datetime('now'))`,
      )
      // La cuenta de negocio no tiene contraseña propia: se entra con la de su dueño.
      .bind(id, `r-${id}${DOMINIO_NEGOCIO}`, nombre, persona.idioma, await hashClave(nuevoToken())),
    db
      .prepare('INSERT INTO duenos_negocio (negocio_id, persona_id) VALUES (?, ?)')
      .bind(id, persona.id),
    sentenciaTerminosPapel(db, persona.id, 'restaurante'),
  ]);
  return id;
}

/** ¿Esta persona es dueña de ese negocio? (y el negocio sigue activo) */
export async function esDuenoDe(db: D1Database, personaId: string, negocioId: string) {
  const f = await db
    .prepare(
      `SELECT 1 FROM duenos_negocio d JOIN usuarios n ON n.id = d.negocio_id
        WHERE d.negocio_id = ? AND d.persona_id = ? AND n.activo = 1`,
    )
    .bind(negocioId, personaId)
    .first();
  return Boolean(f);
}

/** El correo del dueño de una cuenta de negocio (los correos del restaurante le llegan a él). */
export async function correoDelDueno(db: D1Database, correoNegocio: string) {
  const f = await db
    .prepare(
      `SELECT p.correo FROM usuarios n JOIN duenos_negocio d ON d.negocio_id = n.id
         JOIN usuarios p ON p.id = d.persona_id WHERE n.correo = ?`,
    )
    .bind(correoNegocio)
    .first<{ correo: string }>();
  return f?.correo ?? null;
}

// ─────────────── C-CUENTA-UNICA-UNIR y C-CUENTA-UNICA-REGALO ───────────────

type CuentaParaUnir = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  activo: number;
  telefono_canonico: string | null;
  telefono_verificado_en: string | null;
};

export type RevisionUnion = {
  conductor: { id: string; nombre: string; correo: string } | null;
  cliente: { id: string; nombre: string; correo: string } | null;
  /** Lo que impide unirlas, en palabras para el equipo. Vacío: se pueden unir. */
  frenos: string[];
  /** Lo que pasará al unir (para que el equipo lo lea antes de confirmar). */
  mueve: { pedidos: number; viajes: number; direcciones: number };
  /** Después de unir: lo que de verdad pasó a la principal y lo que se quedó, por tabla. */
  movidas?: Record<string, number>;
  quedaron?: Record<string, number>;
};

const EN_CURSO_PEDIDO = "estado IN ('pagado','aceptado','listo','en_camino')";
const EN_CURSO_OPERACION = "estado_general IN ('pago_pendiente','buscando','asignada','en_curso')";

/**
 * Revisa si dos cuentas de la misma persona (una de conductor y una de cliente, con correos distintos)
 * se pueden unir. Nunca se unen solas: lo decide una persona del equipo después de leer esto.
 */
export async function revisarUnion(
  db: D1Database,
  conductorId: string,
  clienteId: string,
): Promise<RevisionUnion> {
  const leer = (id: string) =>
    db
      .prepare(
        'SELECT id, nombre, correo, rol, activo, telefono_canonico, telefono_verificado_en FROM usuarios WHERE id = ?',
      )
      .bind(id)
      .first<CuentaParaUnir>();
  const [a, b] = await Promise.all([leer(conductorId), leer(clienteId)]);
  const frenos: string[] = [];
  const corto = (u: CuentaParaUnir | null) =>
    u ? { id: u.id, nombre: u.nombre, correo: u.correo } : null;
  if (!a || !b) frenos.push('Una de las dos cuentas no existe.');
  if (a && b) {
    if (a.id === b.id) frenos.push('Es la misma cuenta.');
    if (a.rol !== 'repartidor') frenos.push('La primera cuenta tiene que ser la de conductor.');
    if (b.rol !== 'cliente') frenos.push('La segunda cuenta tiene que ser la de cliente.');
    if (!Number(a.activo) || !Number(b.activo))
      frenos.push('Una de las dos cuentas está suspendida o cerrada.');
    if (!a.telefono_canonico || a.telefono_canonico !== b.telefono_canonico)
      frenos.push('El celular de las dos cuentas no es el mismo.');
    else if (!a.telefono_verificado_en && !b.telefono_verificado_en)
      frenos.push(
        'El celular todavía no está confirmado con su código en ninguna de las dos cuentas.',
      );
    const [papel, enCurso, saldo, yaUnida] = await Promise.all([
      db
        .prepare("SELECT 1 FROM usuario_papeles WHERE usuario_id = ? AND papel = 'cliente'")
        .bind(a.id)
        .first(),
      db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM pedidos WHERE (cliente_id IN (?1, ?2) OR repartidor_id IN (?1, ?2)) AND ${EN_CURSO_PEDIDO})
                + (SELECT COUNT(*) FROM operaciones WHERE (cliente_id IN (?1, ?2) OR conductor_id IN (?1, ?2)) AND ${EN_CURSO_OPERACION}) AS n`,
        )
        .bind(a.id, b.id)
        .first<{ n: number }>(),
      // No se mezclan saldos: la cuenta de cliente que se cierra no puede tener nada en su libro.
      db
        .prepare(
          // C-SALDO-CLIENTE: tampoco su Saldo Divoox (su libro propio, inmutable: no se mueve).
          `SELECT 1 WHERE EXISTS (SELECT 1 FROM libro WHERE cuenta_id = ?1 GROUP BY bolsillo, moneda HAVING SUM(monto) <> 0)
              OR EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE cliente_id = ?1 GROUP BY moneda HAVING SUM(monto) <> 0)`,
        )
        .bind(b.id)
        .first(),
      db
        .prepare(
          'SELECT 1 FROM uniones_cuenta WHERE secundaria_id IN (?1, ?2) OR principal_id = ?2',
        )
        .bind(a.id, b.id)
        .first(),
    ]);
    if (papel) frenos.push('La cuenta de conductor ya tiene su papel de cliente.');
    if (Number(enCurso?.n ?? 0) > 0)
      frenos.push('Hay un pedido o un viaje en curso. Espera a que termine.');
    if (saldo)
      frenos.push(
        'La cuenta de cliente tiene saldo (también Saldo Divoox) o deuda. Resuélvelo antes de unir.',
      );
    if (yaUnida) frenos.push('Una de las dos cuentas ya fue unida antes.');
  }
  const cuenta = async (sql: string) =>
    b ? Number((await db.prepare(sql).bind(b.id).first<{ n: number }>())?.n ?? 0) : 0;
  return {
    conductor: corto(a),
    cliente: corto(b),
    frenos,
    mueve: {
      pedidos: await cuenta('SELECT COUNT(*) AS n FROM pedidos WHERE cliente_id = ?'),
      viajes: await cuenta('SELECT COUNT(*) AS n FROM operaciones WHERE cliente_id = ?'),
      direcciones: await cuenta(
        'SELECT COUNT(*) AS n FROM direcciones_cliente WHERE usuario_id = ?',
      ),
    },
  };
}

/**
 * Une la cuenta de cliente a la de conductor de la misma persona, en UNA transacción:
 * - La cuenta de conductor queda como principal (su correo y su contraseña siguen) y gana el papel de
 *   cliente; la de cliente se cierra y su correo queda reservado (no se puede volver a registrar).
 * - El historial de cliente (pedidos, viajes, direcciones, calificaciones) pasa a la principal. Nada se
 *   mueve entre bolsillos de dinero (la de cliente no puede tener saldo: lo frena la revisión).
 * - C-CUENTA-UNICA-REGALO (decisión de Richard): un solo regalo de bienvenida por persona. Lo ya
 *   cobrado se respeta (pasa a la principal, así no se puede volver a usar), lo pendiente de la cuenta
 *   que se cierra se anula, y los premios por invitar que estaban por darse se cierran: nada doble.
 */
/** Lo que pasa a la cuenta principal al unir: [tabla, columna, condición extra]. */
const MOVIDAS: readonly [string, string, string][] = [
  ['pedidos', 'cliente_id', ' AND (repartidor_id IS NULL OR repartidor_id <> ?1)'],
  ['operaciones', 'cliente_id', ' AND (conductor_id IS NULL OR conductor_id <> ?1)'],
  ['calificaciones_cliente', 'cliente_id', ' AND repartidor_id <> ?1'],
  ['calificaciones_viaje', 'autor_id', " AND de = 'pasajero'"],
  ['pagos_comida', 'cliente_id', ''],
  ['direcciones_cliente', 'usuario_id', ''],
  ['conductores_confianza', 'cliente_id', ' AND conductor_id <> ?1'],
  ['rutinas_viaje', 'cliente_id', ''],
  ['viajes_programados', 'cliente_id', ''],
  ['contactos_confianza', 'cliente_id', ''],
];
/** Las tres sentencias de regalos van antes de las movidas en el lote. */
const INICIO_MOVIDAS = 3;

export async function unirCuentas(
  db: D1Database,
  conductorId: string,
  clienteId: string,
  hechaPor: string,
  motivo: string,
): Promise<RevisionUnion> {
  const r = await revisarUnion(db, conductorId, clienteId);
  if (r.frenos.length) throw new ErrorDatos(r.frenos.join(' '), undefined, 409);
  const P = conductorId;
  const S = clienteId;
  const mover = (tabla: string, columna: string, extra = '') =>
    db
      .prepare(`UPDATE OR IGNORE ${tabla} SET ${columna} = ?1 WHERE ${columna} = ?2${extra}`)
      .bind(P, S);
  const resultados = await db.batch([
    // Lo pendiente de la cuenta que se cierra se anula; lo cobrado pasa a la principal.
    db
      .prepare(
        "UPDATE usos_cupon_divoox SET estado = 'liberado', cerrado_en = datetime('now'), motivo = 'cuenta_unida' WHERE cliente_id = ? AND estado = 'apartado'",
      )
      .bind(S),
    mover('usos_cupon_divoox', 'cliente_id', " AND estado = 'cobrado'"),
    db
      .prepare(
        "UPDATE referidos SET cierre = 'cuenta_unida' WHERE (invitado_id = ?1 OR invitador_id = ?1) AND estado = 'pendiente' AND cierre IS NULL",
      )
      .bind(S),
    // El historial de cliente, con su papel (nunca una fila donde quedaría de los dos lados).
    ...MOVIDAS.map(([tabla, columna, extra]) => mover(tabla, columna, extra)),
    // Sus teléfonos siguen recibiendo los avisos de cliente (ahora de la principal).
    db
      .prepare(
        "UPDATE OR IGNORE dispositivos SET usuario_id = ?1, app = COALESCE(app, 'cliente') WHERE usuario_id = ?2",
      )
      .bind(P, S),
    // La principal gana el papel de cliente, con los términos de cliente que aceptó la otra cuenta.
    db
      .prepare(
        "INSERT INTO usuario_papeles (usuario_id, papel, motivo) VALUES (?, 'cliente', 'cuenta_unida') ON CONFLICT(usuario_id, papel) DO NOTHING",
      )
      .bind(P),
    db
      .prepare(
        "INSERT OR IGNORE INTO terminos_papel (usuario_id, papel, version, aceptado_en) SELECT ?1, 'cliente', version, aceptado_en FROM terminos_aceptados WHERE usuario_id = ?2",
      )
      .bind(P, S),
    // La cuenta de cliente se cierra (su correo queda reservado) y sus sesiones mueren.
    db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').bind(S),
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(S),
    db
      .prepare(
        'INSERT INTO uniones_cuenta (id, principal_id, secundaria_id, hecha_por, motivo, resumen_json) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(nuevoId(), P, S, hechaPor, motivo, '{}'),
  ]);
  // El resumen cuenta lo que DE VERDAD se movió; lo que se quedó (por una clave única: la principal
  // ya tenía esa fila) se anota y se dice en el registro de errores, nunca en silencio.
  const movidas = Object.fromEntries(
    MOVIDAS.map(([tabla], i) => [tabla, Number(resultados[INICIO_MOVIDAS + i]?.meta.changes ?? 0)]),
  );
  const quedanLista: [string, number][] = [];
  for (const [tabla, columna, extra] of MOVIDAS) {
    const n = Number(
      (
        await db
          .prepare(
            `SELECT COUNT(*) AS n FROM ${tabla} WHERE ${columna} = ?2${extra.replace(/\?1/g, '?1')}`,
          )
          .bind(P, S)
          .first<{ n: number }>()
      )?.n ?? 0,
    );
    if (n) quedanLista.push([tabla, n]);
  }
  const quedaron = Object.fromEntries(quedanLista);
  if (Object.keys(quedaron).length)
    console.error('unir cuentas: filas que no se pudieron mover (clave única)', P, S, quedaron);
  await db
    .prepare('UPDATE uniones_cuenta SET resumen_json = ? WHERE secundaria_id = ?')
    .bind(JSON.stringify({ movidas, quedaron }), S)
    .run();
  r.movidas = movidas;
  r.quedaron = quedaron;
  return r;
}
