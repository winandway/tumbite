import { activarVehiculoAprobadoSolo } from './rutas/servicios';

/**
 * C-VEHICULO-ACTIVO-SOLO, la reparación (23 nov 2026, Gerencia por Richard). Los conductores reales
 * con UN solo vehículo aprobado y ninguno activo (o el activo retirado, rechazado o suspendido) quedan
 * con ese activo, con la MISMA función que usa la aprobación (`activarVehiculoAprobadoSolo`).
 *
 * - Una sola vez, dentro de la migración de arranque. La marca se toma ANTES (`INSERT OR IGNORE`):
 *   dos servidores a la vez, solo uno corre. Una sola fila en `config`: la marca y, al terminar, a
 *   quién tocó.
 * - No toca cuentas de prueba (`es_prueba`), revisores de las tiendas ni cuentas inactivas.
 * - Presupuesto: como mucho TOPE conductores; por cada uno, unas diez lecturas por índice y entre una
 *   y tres escrituras.
 */
export const CLAVE_REPARACION_VEHICULO_ACTIVO = 'reparacion:vehiculo-activo-solo:1';
export const TOPE_REPARACION_VEHICULO_ACTIVO = 300;

export const SQL_CANDIDATOS_VEHICULO_ACTIVO = `SELECT u.id AS conductor_id,
       (SELECT v.id FROM vehiculos v WHERE v.conductor_id = u.id AND v.estado = 'aprobado') AS vehiculo_id
  FROM usuarios u
  LEFT JOIN repartidores r ON r.usuario_id = u.id
 WHERE u.rol = 'repartidor' AND u.activo = 1 AND COALESCE(u.es_prueba, 0) = 0
   AND NOT EXISTS (SELECT 1 FROM revisores rv WHERE rv.correo = u.correo)
   AND (SELECT COUNT(*) FROM vehiculos v WHERE v.conductor_id = u.id AND v.estado = 'aprobado') = 1
   AND (r.vehiculo_activo_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM vehiculos x WHERE x.id = r.vehiculo_activo_id
            AND x.estado NOT IN ('retirado', 'rechazado', 'suspendido')))
 ORDER BY u.creado_en LIMIT ${TOPE_REPARACION_VEHICULO_ACTIVO}`;

/** Devuelve a quién dejó con su vehículo activo, o null si ya había corrido (o corre en otro lado). */
export async function repararVehiculoActivo(db: D1Database): Promise<string[] | null> {
  const marca = await db
    .prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, 'corriendo')")
    .bind(CLAVE_REPARACION_VEHICULO_ACTIVO)
    .run();
  if (!Number(marca.meta?.changes ?? 0)) return null;
  const { results } = await db
    .prepare(SQL_CANDIDATOS_VEHICULO_ACTIVO)
    .all<{ conductor_id: string; vehiculo_id: string }>();
  const activados: string[] = [];
  for (const f of results) {
    try {
      if ((await activarVehiculoAprobadoSolo(db, f.conductor_id, f.vehiculo_id)).activo)
        activados.push(f.conductor_id);
    } catch (e) {
      console.error('reparación vehículo activo: un conductor falló', f.conductor_id, e);
    }
  }
  await db
    .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = ?")
    .bind(
      JSON.stringify({ hecha: true, revisados: results.length, activados }),
      CLAVE_REPARACION_VEHICULO_ACTIVO,
    )
    .run();
  if (activados.length)
    console.warn(
      `reparación: ${activados.length} conductores quedaron con su vehículo aprobado activo (C-VEHICULO-ACTIVO-SOLO)`,
    );
  return activados;
}
