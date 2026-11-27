import { perfilPasajeros, placaLimpia } from '@tumbite/compartido';
import { nuevoId } from './cripto';
import { paisDelConductor } from './paisConductor';

/**
 * C-VEHICULO-DE-REPARTO (27 nov 2026, Richard en su Android, en Michigan donde solo hay Comida): en
 * «Datos para Comida y Envíos» eligió Moto y escribió marca, modelo, año, color y placa; la pantalla
 * los guardó en `repartidor_datos` y NUNCA creó el vehículo real (`vehiculos`), así que el panel decía
 * «todavía no registra ninguno» y nadie le pidió las fotos. Arreglo de raíz para todos (también las
 * apps viejas que siguen mandando esa pantalla): si el conductor todavía no tiene ningún vehículo,
 * lo que escribió ahí se vuelve su vehículo real, en «registrado», listo para sus fotos y su revisión.
 * Si ya tiene uno, manda el real (no se crea otro).
 *
 * Devuelve el id del vehículo creado, o null si no hacía falta.
 */
export async function vehiculoDesdeDatosReparto(
  db: D1Database,
  conductorId: string,
  d: {
    vehiculoTipo: string;
    marca: string;
    modelo: string;
    anio: number | '' | null;
    color: string;
    placa: string;
  },
): Promise<string | null> {
  if (!['carro', 'moto', 'scooter', 'bicicleta', 'a_pie'].includes(d.vehiculoTipo)) return null;
  const ya = await db
    .prepare("SELECT 1 FROM vehiculos WHERE conductor_id = ? AND estado != 'retirado' LIMIT 1")
    .bind(conductorId)
    .first();
  if (ya) return null;
  const { pais } = await paisDelConductor(db, conductorId);
  const anio = typeof d.anio === 'number' && d.anio >= 1980 && d.anio <= 2100 ? d.anio : null;
  const id = nuevoId();
  await db
    .prepare(
      'INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, anio, color, placa, placa_estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      conductorId,
      d.vehiculoTipo,
      d.marca.slice(0, 40),
      d.modelo.slice(0, 40),
      anio,
      d.color.slice(0, 30),
      placaLimpia(d.placa).slice(0, 12),
      // Donde la placa es nacional (Venezuela) se guarda con el país, como en el alta.
      perfilPasajeros(pais).placaNacional ? pais : '',
    )
    .run();
  return id;
}

export const CLAVE_REPARACION_VEHICULOS_DE_REPARTO = 'reparacion:vehiculos-de-reparto:1';
export const TOPE_REPARACION_VEHICULOS_DE_REPARTO = 500;

/** Los conductores reales con vehículo escrito en «Datos para Comida y Envíos» y ninguno real. */
export const SQL_CANDIDATOS_VEHICULOS_DE_REPARTO = `SELECT d.usuario_id, d.vehiculo_tipo, d.marca, d.modelo, d.anio, d.color, d.placa
  FROM repartidor_datos d
  JOIN usuarios u ON u.id = d.usuario_id
 WHERE u.rol = 'repartidor' AND u.activo = 1 AND COALESCE(u.es_prueba, 0) = 0
   AND d.vehiculo_tipo IN ('carro', 'moto', 'scooter', 'bicicleta', 'a_pie')
   AND NOT EXISTS (SELECT 1 FROM vehiculos v WHERE v.conductor_id = d.usuario_id AND v.estado != 'retirado')
 ORDER BY d.actualizado_en LIMIT ${TOPE_REPARACION_VEHICULOS_DE_REPARTO}`;

/**
 * La reparación, una sola vez dentro de la migración de arranque (la marca se toma ANTES: dos
 * servidores a la vez, solo uno corre). Devuelve a quién le creó el vehículo, o null si ya corrió.
 */
export async function repararVehiculosDeReparto(db: D1Database): Promise<string[] | null> {
  const marca = await db
    .prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, 'corriendo')")
    .bind(CLAVE_REPARACION_VEHICULOS_DE_REPARTO)
    .run();
  if (!Number(marca.meta?.changes ?? 0)) return null;
  const { results } = await db.prepare(SQL_CANDIDATOS_VEHICULOS_DE_REPARTO).all<{
    usuario_id: string;
    vehiculo_tipo: string;
    marca: string | null;
    modelo: string | null;
    anio: number | null;
    color: string | null;
    placa: string | null;
  }>();
  const creados: string[] = [];
  for (const f of results) {
    try {
      const id = await vehiculoDesdeDatosReparto(db, f.usuario_id, {
        vehiculoTipo: f.vehiculo_tipo,
        marca: f.marca ?? '',
        modelo: f.modelo ?? '',
        anio: f.anio,
        color: f.color ?? '',
        placa: f.placa ?? '',
      });
      if (id) creados.push(f.usuario_id);
    } catch (e) {
      console.error('reparación vehículos de reparto: un conductor falló', f.usuario_id, e);
    }
  }
  await db
    .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = ?")
    .bind(
      JSON.stringify({ hecha: true, revisados: results.length, creados }),
      CLAVE_REPARACION_VEHICULOS_DE_REPARTO,
    )
    .run();
  if (creados.length)
    console.warn(
      `reparación: ${creados.length} conductores ya tienen su vehículo real (C-VEHICULO-DE-REPARTO)`,
    );
  return creados;
}
