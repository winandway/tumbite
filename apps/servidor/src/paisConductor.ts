/** País y ciudad del conductor (la ciudad de su última ubicación o la que eligió). */
export async function paisDelConductor(db: D1Database, conductorId: string) {
  const f = await db
    .prepare(
      `SELECT z.id AS zona_id, z.nombre, z.pais, z.moneda FROM usuarios u
         LEFT JOIN repartidores r ON r.usuario_id = u.id
         JOIN zonas z ON z.id = COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI')
        WHERE u.id = ?`,
    )
    .bind(conductorId)
    .first<{ zona_id: string; nombre: string; pais: string; moneda: string }>();
  return f ?? { zona_id: 'US-FL-MIAMI', nombre: 'Miami', pais: 'US', moneda: 'USD' };
}
