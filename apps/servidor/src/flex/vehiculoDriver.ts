import { nuevoId } from '../cripto';

/**
 * C-FLEX-VEHICULO-DRIVER (1 nov 2026): el conductor registra su vehículo en Divoox Driver (en
 * «Mis datos y vehículo», tabla repartidor_datos), pero la empresa, la asignación por capacidad y
 * el aviso «ya llega» leen la tabla vehiculos, que ninguna app llenaba. Al sumarse a una empresa se
 * crea su vehículo desde lo que registró, una sola vez, y queda como su vehículo activo.
 */
export async function asegurarVehiculoDesdeDriver(db: D1Database, usuarioId: string) {
  const ya = await db
    .prepare(
      "SELECT 1 FROM vehiculos WHERE conductor_id = ? AND estado NOT IN ('rechazado', 'retirado') LIMIT 1",
    )
    .bind(usuarioId)
    .first();
  if (ya) return;
  const d = await db
    .prepare(
      "SELECT vehiculo_tipo, marca, modelo, color, placa FROM repartidor_datos WHERE usuario_id = ? AND vehiculo_tipo <> ''",
    )
    .bind(usuarioId)
    .first<{
      vehiculo_tipo: string;
      marca: string;
      modelo: string;
      color: string;
      placa: string;
    }>();
  if (!d) return;
  const id = nuevoId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, origen)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'migracion')`,
      )
      .bind(id, usuarioId, d.vehiculo_tipo, d.marca, d.modelo, d.color, d.placa),
    db
      .prepare(
        'UPDATE repartidores SET vehiculo_activo_id = COALESCE(vehiculo_activo_id, ?) WHERE usuario_id = ?',
      )
      .bind(id, usuarioId),
  ]);
}
