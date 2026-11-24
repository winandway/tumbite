import { SERVICIOS_SIN_SEGUNDO_REGISTRO, encenderServiciosDelVehiculo } from './rutas/servicios';

/**
 * C-SERVICIOS-DEL-VEHICULO, la reparación (23 nov 2026, Tucaní) — todos los países. Los conductores
 * reales con un vehículo en uso que todavía no tienen fila de preferencia de Envíos: se les enciende
 * si la regla de Driver lo permite (`encenderServiciosDelVehiculo`, la MISMA que usa la aprobación).
 *
 * - Una sola vez, dentro de la migración de arranque; la marca se toma ANTES (`INSERT OR IGNORE`).
 * - No toca cuentas de prueba, revisores de las tiendas ni cuentas inactivas. Nunca pisa una
 *   preferencia que ya existe (encendida o apagada).
 * - Presupuesto: como mucho TOPE conductores; por cada uno, unas veinte lecturas por índice y como
 *   mucho una escritura por servicio. Más dos escrituras de la marca.
 */
export const CLAVE_REPARACION_SERVICIOS_VEHICULO = 'reparacion:servicios-del-vehiculo:1';
export const TOPE_REPARACION_SERVICIOS_VEHICULO = 300;

export const SQL_CANDIDATOS_SERVICIOS_VEHICULO = `SELECT u.id AS conductor_id
  FROM usuarios u
  JOIN repartidores r ON r.usuario_id = u.id
  JOIN vehiculos v ON v.id = r.vehiculo_activo_id AND v.conductor_id = u.id
                  AND v.estado NOT IN ('rechazado', 'suspendido', 'retirado')
 WHERE u.rol = 'repartidor' AND u.activo = 1 AND COALESCE(u.es_prueba, 0) = 0
   AND NOT EXISTS (SELECT 1 FROM revisores rv WHERE rv.correo = u.correo)
   AND NOT EXISTS (SELECT 1 FROM preferencias_servicio p
                    WHERE p.conductor_id = u.id AND p.servicio_id = 'envios')
 ORDER BY u.creado_en LIMIT ${TOPE_REPARACION_SERVICIOS_VEHICULO}`;

/** Devuelve a quién le encendió algo, o null si ya había corrido (o corre en otro lado). */
export async function repararServiciosVehiculo(db: D1Database): Promise<string[] | null> {
  const marca = await db
    .prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, 'corriendo')")
    .bind(CLAVE_REPARACION_SERVICIOS_VEHICULO)
    .run();
  if (!Number(marca.meta?.changes ?? 0)) return null;
  const { results } = await db
    .prepare(SQL_CANDIDATOS_SERVICIOS_VEHICULO)
    .all<{ conductor_id: string }>();
  const encendidos: string[] = [];
  for (const f of results) {
    try {
      if (
        (await encenderServiciosDelVehiculo(db, f.conductor_id, SERVICIOS_SIN_SEGUNDO_REGISTRO))
          .length
      )
        encendidos.push(f.conductor_id);
    } catch (e) {
      console.error('reparación servicios del vehículo: un conductor falló', f.conductor_id, e);
    }
  }
  await db
    .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = ?")
    .bind(
      JSON.stringify({ hecha: true, revisados: results.length, encendidos }),
      CLAVE_REPARACION_SERVICIOS_VEHICULO,
    )
    .run();
  if (encendidos.length)
    console.warn(
      `reparación: ${encendidos.length} conductores quedaron con Envíos encendido (C-SERVICIOS-DEL-VEHICULO)`,
    );
  return encendidos;
}
