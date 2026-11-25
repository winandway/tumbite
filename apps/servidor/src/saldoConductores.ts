import type { Env } from './env';
import { avisarSaldoRecargado } from './avisoSaldo';
import { nuevoId } from './cripto';
import { ErrorDatos } from './validar';
import { paisDeZona } from './internacional/paises';
import { saldoLibro } from './internacional/libro';

/**
 * C-SALDO-CONDUCTOR (17 nov 2026, piloto de El Vigía y Tucaní) — todos los países con prepago.
 * El conductor tiene dos billeteras: «saldo» (prepago, de donde sale la comisión de Divoox; bolsillo
 * `prepago` del libro) y «ganancias» (`movimientos`). Aquí viven:
 * - la carga manual de saldo que hace el equipo (regalo de arranque, «pagó por pago móvil»), que pasa
 *   por la doble firma del dinero (control dual, tipo `saldo_conductor`) y por el tope del código;
 * - el saldo de regalo para conductores nuevos por ciudad, con presupuesto (igual que el cupón);
 * - la vista de conductores por ciudad del superadmin.
 * El motor de saldo es el mismo de siempre (libro y recargas): no se duplica nada.
 */
export const TOPES_SALDO = {
  /** Lo más que el equipo carga a mano de una vez (50 USD). */
  cargaMaxima: 5_000,
  /** Lo más que vale el regalo de arranque de un conductor nuevo (10 USD). */
  regaloNuevoMaximo: 1_000,
  /** El presupuesto más alto del regalo de arranque de una ciudad (300 USD). */
  presupuestoRegaloNuevoMaximo: 30_000,
} as const;

/**
 * C-TOPES-SALDO-MONEDA (19 nov 2026 — Perú). Los topes son un freno contra errores, y un freno
 * escrito en centavos de dólar no vale igual en otra moneda: 5.000 céntimos son solo 50 soles. Cada
 * moneda con conductores de prepago lleva los suyos, en SU unidad menor; una moneda sin escribir usa
 * los de dólares (que se quedan cortos, nunca largos).
 */
const TOPES_SALDO_POR_MONEDA = new Map<
  string,
  typeof TOPES_SALDO extends infer T ? { [K in keyof T]: number } : never
>([
  // Soles: carga de hasta 200, regalo de arranque de hasta 40 y presupuesto por ciudad de hasta 1.200.
  ['PEN', { cargaMaxima: 20_000, regaloNuevoMaximo: 4_000, presupuestoRegaloNuevoMaximo: 120_000 }],
]);
export const topesSaldoDe = (moneda: string | null | undefined) =>
  TOPES_SALDO_POR_MONEDA.get((moneda ?? '').toUpperCase()) ?? TOPES_SALDO;

/** País y moneda del saldo de un conductor (los de su ciudad). */
export async function cuentaDeConductor(db: D1Database, conductorId: string) {
  const f = await db
    .prepare(
      `SELECT u.id, COALESCE(r.zona_id, u.zona_id) AS zona_id FROM usuarios u
         LEFT JOIN repartidores r ON r.usuario_id = u.id
        WHERE u.id = ? AND u.rol = 'repartidor'`,
    )
    .bind(conductorId)
    .first<{ id: string; zona_id: string | null }>();
  if (!f) throw new ErrorDatos('No encontramos a ese conductor.', undefined, 404);
  if (!f.zona_id) throw new ErrorDatos('Ese conductor todavía no tiene ciudad.', undefined, 409);
  const { pais, moneda } = await paisDeZona(db, f.zona_id);
  return { zonaId: f.zona_id, pais, moneda };
}

/** Una carga al saldo prepago, en un lote: la fila de la carga y su asiento en el libro. */
function sentenciasCarga(
  db: D1Database,
  c: {
    id: string;
    conductorId: string;
    zonaId: string | null;
    pais: string;
    moneda: string;
    monto: number;
    tipo: 'manual' | 'regalo_nuevo' | 'regalo_a_saldo';
    motivo: string;
    comprobante: string;
    autorId: string | null;
  },
) {
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO cargas_saldo_conductor (id, conductor_id, zona_id, pais, moneda, monto, tipo, motivo, comprobante, autor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        c.id,
        c.conductorId,
        c.zonaId,
        c.pais,
        c.moneda,
        c.monto,
        c.tipo,
        c.motivo.slice(0, 120),
        c.comprobante.slice(0, 80),
        c.autorId,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
         SELECT ?, ?, 'prepago', ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM cargas_saldo_conductor WHERE id = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        c.conductorId,
        c.pais,
        c.moneda,
        c.monto,
        `carga_${c.tipo}`,
        `carga-saldo:${c.id}`,
        c.autorId,
        c.id,
      ),
  ];
}

/**
 * La carga manual del equipo (la ejecuta el control dual: bajo el límite de la persona y del día de
 * una vez; por encima, con la firma de otra persona). Nunca pasa el tope del código.
 */
export async function cargarSaldoConductor(
  db: D1Database,
  p: { conductorId: string; monto: number; motivo: string; comprobante: string; autorId: string },
) {
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new ErrorDatos('El monto no es válido.', 'monto', 400);
  if (p.motivo.trim().length < 3)
    throw new ErrorDatos('Escribe el motivo de la carga.', 'motivo', 422);
  const cuenta = await cuentaDeConductor(db, p.conductorId);
  if (p.monto > topesSaldoDe(cuenta.moneda).cargaMaxima)
    throw new ErrorDatos('Esa carga pasa el máximo permitido de Divoox por carga.', 'monto', 422);
  const id = nuevoId();
  await db.batch(
    sentenciasCarga(db, {
      id,
      conductorId: p.conductorId,
      zonaId: cuenta.zonaId,
      pais: cuenta.pais,
      moneda: cuenta.moneda,
      monto: p.monto,
      tipo: 'manual',
      motivo: p.motivo.trim(),
      comprobante: p.comprobante.trim(),
      autorId: p.autorId,
    }),
  );
  return {
    id,
    saldo: await saldoLibro(db, p.conductorId, 'prepago', cuenta.pais, cuenta.moneda),
    moneda: cuenta.moneda,
  };
}

// ───────────────────── Regalo de arranque para conductores nuevos ─────────────────────

const SQL_DADO =
  "(SELECT COALESCE(SUM(c.monto), 0) FROM cargas_saldo_conductor c WHERE c.tipo = 'regalo_nuevo' AND c.zona_id = g.zona_id)";

/**
 * Al aprobarse un conductor: si su ciudad tiene el regalo de arranque encendido y le queda
 * presupuesto, recibe el saldo UNA vez en la vida (índice único). La misma sentencia comprueba el
 * presupuesto; el último puede recibir menos (lo que queda). Devuelve el monto dado o 0.
 */
export async function darRegaloConductorNuevo(
  db: D1Database,
  conductorId: string,
  /** Tramo 1: con el entorno, le llega el aviso del saldo regalado. */
  env?: Env,
) {
  let cuenta: Awaited<ReturnType<typeof cuentaDeConductor>>;
  try {
    cuenta = await cuentaDeConductor(db, conductorId);
  } catch {
    return 0;
  }
  const g = await db
    .prepare(
      `SELECT g.monto, g.presupuesto, ${SQL_DADO} AS dado FROM regalo_conductor_nuevo g WHERE g.zona_id = ? AND g.activo = 1`,
    )
    .bind(cuenta.zonaId)
    .first<{ monto: number; presupuesto: number; dado: number }>();
  if (!g) return 0;
  const monto = Math.min(
    Number(g.monto),
    topesSaldoDe(cuenta.moneda).regaloNuevoMaximo,
    Number(g.presupuesto) - Number(g.dado),
  );
  if (monto <= 0) return 0;
  const id = nuevoId();
  const [ins] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO cargas_saldo_conductor (id, conductor_id, zona_id, pais, moneda, monto, tipo, motivo)
         SELECT ?1, ?2, g.zona_id, ?3, ?4, ?5, 'regalo_nuevo', 'Regalo de arranque de Divoox'
           FROM regalo_conductor_nuevo g
          WHERE g.zona_id = ?6 AND g.activo = 1 AND ${SQL_DADO} + ?5 <= g.presupuesto`,
      )
      .bind(id, conductorId, cuenta.pais, cuenta.moneda, monto, cuenta.zonaId),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
         SELECT ?, ?, 'prepago', ?, ?, ?, 'carga_regalo_nuevo', ? WHERE EXISTS (SELECT 1 FROM cargas_saldo_conductor WHERE id = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        conductorId,
        cuenta.pais,
        cuenta.moneda,
        monto,
        `carga-saldo:${id}`,
        id,
      ),
    // Presupuesto agotado: el regalo de la ciudad se apaga solo.
    db
      .prepare(
        `UPDATE regalo_conductor_nuevo SET activo = 0, actualizado_en = datetime('now')
          WHERE zona_id = ? AND activo = 1 AND (SELECT COALESCE(SUM(monto), 0) FROM cargas_saldo_conductor
                 WHERE tipo = 'regalo_nuevo' AND zona_id = regalo_conductor_nuevo.zona_id) >= presupuesto`,
      )
      .bind(cuenta.zonaId),
  ]);
  if (!ins?.meta.changes) return 0;
  await avisarSaldoRecargado(env, db, conductorId, monto, cuenta.moneda);
  return monto;
}

export async function leerRegalosConductorNuevo(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT g.zona_id, g.monto, g.presupuesto, g.activo, ${SQL_DADO} AS dado,
              (SELECT COUNT(*) FROM cargas_saldo_conductor c WHERE c.tipo = 'regalo_nuevo' AND c.zona_id = g.zona_id) AS conductores
         FROM regalo_conductor_nuevo g`,
    )
    .all<{
      zona_id: string;
      monto: number;
      presupuesto: number;
      activo: number;
      dado: number;
      conductores: number;
    }>();
  return results.map((r) => ({
    zonaId: r.zona_id,
    monto: Number(r.monto),
    presupuesto: Number(r.presupuesto),
    activo: Number(r.activo) === 1,
    dado: Number(r.dado),
    restante: Math.max(0, Number(r.presupuesto) - Number(r.dado)),
    conductores: Number(r.conductores),
  }));
}

export async function guardarRegaloConductorNuevo(
  db: D1Database,
  p: { zonaId: string; monto: number; presupuesto: number; activo: boolean; autorId: string },
) {
  const zona = await db
    .prepare('SELECT id, moneda FROM zonas WHERE id = ?')
    .bind(p.zonaId)
    .first<{ id: string; moneda: string }>();
  if (!zona) throw new ErrorDatos('Una de las ciudades no existe.', 'zonaId', 422);
  const topes = topesSaldoDe(zona.moneda);
  if (p.monto > topes.regaloNuevoMaximo)
    throw new ErrorDatos(
      'Ese regalo pasa el máximo permitido de Divoox por conductor.',
      'monto',
      422,
    );
  if (p.presupuesto > topes.presupuestoRegaloNuevoMaximo)
    throw new ErrorDatos('Ese presupuesto pasa el máximo permitido de Divoox.', 'presupuesto', 422);
  const dado = Number(
    (
      await db
        .prepare(
          "SELECT COALESCE(SUM(monto), 0) AS s FROM cargas_saldo_conductor WHERE tipo = 'regalo_nuevo' AND zona_id = ?",
        )
        .bind(p.zonaId)
        .first<{ s: number }>()
    )?.s ?? 0,
  );
  if (p.presupuesto < dado)
    throw new ErrorDatos(
      'El presupuesto no puede quedar por debajo de lo que ya se gastó y está apartado.',
      'presupuesto',
      422,
    );
  if (p.activo && p.presupuesto - dado <= 0)
    throw new ErrorDatos(
      'Este regalo no tiene presupuesto. Súbele el presupuesto para encenderlo.',
      'presupuesto',
      409,
    );
  await db
    .prepare(
      `INSERT INTO regalo_conductor_nuevo (zona_id, monto, presupuesto, activo, actualizado_por) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(zona_id) DO UPDATE SET monto = excluded.monto, presupuesto = excluded.presupuesto,
         activo = excluded.activo, actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
    )
    .bind(p.zonaId, p.monto, p.presupuesto, p.activo ? 1 : 0, p.autorId)
    .run();
  return (await leerRegalosConductorNuevo(db)).find((r) => r.zonaId === p.zonaId);
}

// ───────────────────── Vista de conductores por ciudad ─────────────────────

/**
 * Los conductores de una ciudad con su saldo, sus carreras y lo que Divoox les debe por regalos.
 * «Activo» = conectado ahora o con una carrera terminada en los últimos 7 días.
 */
export async function conductoresDeCiudad(db: D1Database, zonaId: string) {
  const { pais, moneda } = await paisDeZona(db, zonaId);
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, r.conectado,
         (SELECT COALESCE(SUM(l.monto), 0) FROM libro l WHERE l.cuenta_id = u.id AND l.bolsillo = 'prepago' AND l.pais = ?2 AND l.moneda = ?3) AS saldo,
         (SELECT COALESCE(SUM(l.monto), 0) FROM libro l WHERE l.cuenta_id = u.id AND l.bolsillo = 'reservado' AND l.pais = ?2 AND l.moneda = ?3) AS reservado,
         (SELECT COALESCE(SUM(m.monto), 0) FROM movimientos m WHERE m.usuario_id = u.id) AS ganancias,
         (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = u.id AND o.estado_general = 'terminada') AS carreras,
         (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = u.id AND o.estado_general = 'terminada' AND o.actualizado_en > datetime('now', '-7 days')) AS carreras_7d,
         (SELECT COUNT(*) FROM pedidos p WHERE p.repartidor_id = u.id AND p.estado = 'entregado') AS pedidos,
         (SELECT MAX(o.actualizado_en) FROM operaciones o WHERE o.conductor_id = u.id AND o.estado_general = 'terminada') AS ultima,
         EXISTS (SELECT 1 FROM cargas_saldo_conductor c WHERE c.conductor_id = u.id AND c.tipo = 'regalo_nuevo') AS con_regalo
         FROM repartidores r JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.zona_id = ?1 AND u.rol = 'repartidor' AND u.activo = 1
        ORDER BY r.conectado DESC, u.nombre LIMIT 500`,
    )
    .bind(zonaId, pais, moneda)
    .all<Record<string, unknown>>();
  const conductores = results.map((r) => {
    const carreras7d = Number(r.carreras_7d);
    return {
      id: String(r.id),
      nombre: String(r.nombre),
      conectado: Number(r.conectado) === 1,
      activo: Number(r.conectado) === 1 || carreras7d > 0,
      saldo: Number(r.saldo),
      reservado: Number(r.reservado),
      ganancias: Number(r.ganancias),
      carreras: Number(r.carreras),
      carreras7d,
      pedidos: Number(r.pedidos),
      ultimaCarrera: r.ultima == null ? null : String(r.ultima),
      regaloArranque: Number(r.con_regalo) === 1,
    };
  });
  return {
    zonaId,
    pais,
    moneda,
    total: conductores.length,
    activos: conductores.filter((c) => c.activo).length,
    conectados: conductores.filter((c) => c.conectado).length,
    sinSaldo: conductores.filter((c) => c.saldo <= 0).length,
    conductores,
  };
}

/** Las últimas cargas a mano y regalos de saldo de un conductor (para su ficha y su app). */
export async function cargasDeConductor(db: D1Database, conductorId: string) {
  const { results } = await db
    .prepare(
      // C-AGENTE-DIVOOX: el saldo comprado a un Agente Divoox sale en la misma lista (tipo «agente»).
      // Una app anterior, que no conoce ese tipo, muestra el motivo tal cual.
      `SELECT * FROM (
         SELECT c.id, c.monto, c.moneda, c.tipo, c.motivo, c.comprobante, c.creado_en, replace(a.nombre, 'Tumbite', 'Divoox') AS autor
           FROM cargas_saldo_conductor c LEFT JOIN usuarios a ON a.id = c.autor_id
          WHERE c.conductor_id = ?1
         UNION ALL
         SELECT v.id, v.monto, v.moneda, 'agente', 'Agente Divoox · ' || g.nombre, '', v.creado_en, g.nombre
           FROM ventas_saldo_agente v JOIN agentes g ON g.id = v.agente_id
          WHERE v.conductor_id = ?1
       ) ORDER BY creado_en DESC LIMIT 30`,
    )
    .bind(conductorId)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    id: String(r.id),
    monto: Number(r.monto),
    moneda: String(r.moneda),
    tipo: String(r.tipo),
    motivo: String(r.motivo),
    comprobante: String(r.comprobante),
    autor: r.autor == null ? null : String(r.autor),
    creadoEn: String(r.creado_en),
  }));
}

/**
 * El conductor pasa a su saldo, con un toque, lo que Divoox le debe por los regalos de sus pasajeros
 * (está en «ganancias»). Sale de ganancias y entra al saldo prepago, una sola vez por pedido y nunca
 * más de lo que tiene por cobrar de regalos.
 */
export async function regalosASaldo(db: D1Database, conductorId: string) {
  const { porCobrarRegalos, SIN_HEREDADOS } = await import('./regalosDivoox');
  const pendiente = await porCobrarRegalos(db, conductorId);
  if (!pendiente || pendiente.monto <= 0)
    throw new ErrorDatos('No tienes regalos por pasar a tu saldo.', undefined, 409);
  const cuenta = await cuentaDeConductor(db, conductorId);
  const id = nuevoId();
  const m = pendiente.monto;
  // La carga nace SOLO si lo acreditado menos lo ya pagado o pasado sigue cubriendo el monto: dos
  // toques a la vez no pasan dos veces lo mismo.
  const [, , , mov] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO cargas_saldo_conductor (id, conductor_id, zona_id, pais, moneda, monto, tipo, motivo, autor_id)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'regalo_a_saldo', 'Regalos de pasajeros pasados al saldo', ?2
          WHERE (SELECT COALESCE(SUM(monto), 0) FROM usos_cupon_divoox WHERE conductor_id = ?2 AND estado = 'cobrado' AND moneda = ?5 ${SIN_HEREDADOS})
              - (SELECT COALESCE(SUM(monto), 0) FROM pagos_regalo_conductor WHERE conductor_id = ?2 AND moneda = ?5) >= ?6`,
      )
      .bind(id, conductorId, cuenta.zonaId, pendiente.pais, pendiente.moneda, m),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
         SELECT ?, ?, 'prepago', ?, ?, ?, 'carga_regalo_a_saldo', ?, ? WHERE EXISTS (SELECT 1 FROM cargas_saldo_conductor WHERE id = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        conductorId,
        pendiente.pais,
        pendiente.moneda,
        m,
        `carga-saldo:${id}`,
        conductorId,
        id,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO pagos_regalo_conductor (id, conductor_id, monto, moneda, pais, referencia, pagado_por)
         SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM cargas_saldo_conductor WHERE id = ?)`,
      )
      .bind(id, conductorId, m, pendiente.moneda, pendiente.pais, `saldo:${id}`, conductorId, id),
    db
      .prepare(
        `INSERT OR IGNORE INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, 'ajuste', ? WHERE EXISTS (SELECT 1 FROM pagos_regalo_conductor WHERE id = ?)`,
      )
      .bind(nuevoId(), conductorId, -m, `regalo-a-saldo:${id}`, id),
  ]);
  if (!mov?.meta.changes)
    throw new ErrorDatos('No tienes regalos por pasar a tu saldo.', undefined, 409);
  return {
    monto: pendiente.monto,
    moneda: pendiente.moneda,
    saldo: await saldoLibro(db, conductorId, 'prepago', pendiente.pais, pendiente.moneda),
  };
}
