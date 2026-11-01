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
  await db
    .prepare(
      `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'migracion')`,
    )
    .bind(id, usuarioId, d.vehiculo_tipo, d.marca, d.modelo, d.color, d.placa)
    .run();
  // Queda como vehículo activo solo si no tenía uno y NO está en plena operación: el candado
  // repartidores_vehiculo_fijo_en_operacion no deja cambiarlo con un pedido o una ruta en curso
  // (así falló en producción el 1 nov). Mientras tanto, el aviso «ya llega» usa este vehículo igual.
  await db
    .prepare(
      `UPDATE repartidores SET vehiculo_activo_id = ?1
        WHERE usuario_id = ?2 AND vehiculo_activo_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?2)`,
    )
    .bind(id, usuarioId)
    .run();
}

/** Nunca frena lo que se está haciendo (aceptar, vincular, avisar): si falla, queda en el registro. */
export async function asegurarVehiculoSinFrenar(db: D1Database, usuarioId: string) {
  try {
    await asegurarVehiculoDesdeDriver(db, usuarioId);
  } catch (e) {
    console.error('flex: no se pudo crear el vehículo desde Driver', e);
  }
}
