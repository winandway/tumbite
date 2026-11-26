import { PAIS_CONDUCTOR_SQL, ZONA_CONDUCTOR_SQL, ZONA_REAL_SQL } from './cuentaPais';

/**
 * País y ciudad del conductor (la ciudad de su última ubicación o la que eligió).
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026): si todavía no tiene zona real y su cuenta dice dónde vive, el
 * país es el de su lugar (sus papeles, su perfil y su moneda son los de su país) y el nombre es el de
 * su ciudad («Maracaibo»), nunca el «Miami» por defecto de la fila. `zona_id` sigue siendo el de su
 * fila: no es una ciudad abierta y no da ID ni viajes (`enEspera` lo dice).
 */
export async function paisDelConductor(db: D1Database, conductorId: string) {
  const f = await db
    .prepare(
      `SELECT z.id AS zona_id, z.nombre, z.pais, z.moneda, ${PAIS_CONDUCTOR_SQL} AS pais_real,
              ${ZONA_REAL_SQL} IS NULL AND u.lugar_pais IS NOT NULL AS en_espera, u.lugar_ciudad,
              CASE WHEN u.lugar_pais IS NOT NULL THEN (SELECT zm.moneda FROM zonas zm WHERE zm.pais = u.lugar_pais ORDER BY zm.activa DESC, zm.id LIMIT 1) END AS moneda_lugar
         FROM usuarios u
         LEFT JOIN repartidores r ON r.usuario_id = u.id
         JOIN zonas z ON z.id = ${ZONA_CONDUCTOR_SQL}
        WHERE u.id = ?`,
    )
    .bind(conductorId)
    .first<{
      zona_id: string;
      nombre: string;
      pais: string;
      moneda: string;
      pais_real: string;
      en_espera: number;
      lugar_ciudad: string | null;
      moneda_lugar: string | null;
    }>();
  if (!f)
    return { zona_id: 'US-FL-MIAMI', nombre: 'Miami', pais: 'US', moneda: 'USD', enEspera: false };
  const enEspera = Number(f.en_espera) === 1;
  return {
    zona_id: f.zona_id,
    nombre: enEspera && f.lugar_ciudad ? f.lugar_ciudad : f.nombre,
    pais: (f.pais_real ?? f.pais).toUpperCase(),
    moneda: enEspera ? (f.moneda_lugar ?? f.moneda) : f.moneda,
    enEspera,
  };
}
