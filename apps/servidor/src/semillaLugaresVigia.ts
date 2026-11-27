import { nuevoId } from './cripto';
import {
  CLAVE_SEMILLA_TABULADOR_VIGIA,
  ZONA_TABULADOR_VIGIA,
  leerMarcaSemilla,
} from './semillaTabuladorVigia';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';

/**
 * C-LUGARES-PROPIOS (27 nov 2026, Richard: «¿el resto de las direcciones también fueron probadas?») —
 * Venezuela, El Vigía. UNA sola vez, después de la semilla del tabulador:
 *
 * 1. Corrige el punto de los 17 destinos que habían quedado aproximados («revisar») y el radio de los
 *    dos vecinos que se tocaban con ellos. Solo las rutas que siguen con el punto viejo (si el equipo ya
 *    lo movió en el panel, no se toca) y su regreso (la ruta que sale de ese mismo punto).
 * 2. Crea el lugar propio de cada destino del tabulador (83), atado a su ruta, con el punto de la ruta y
 *    sus otros nombres (OTROS_NOMBRES_VIGIA). Si la ciudad ya tiene un lugar con ese nombre, no lo repite.
 *
 * Presupuesto (regla de la nube): un lote, como mucho TOPE_ESCRITURAS_LUGARES_VIGIA escrituras. La marca se
 * toma antes de escribir (INSERT OR IGNORE): dos servidores a la vez, solo uno corre. Si falla, la marca
 * se borra y se reintenta en el arranque siguiente.
 */
export const CLAVE_SEMILLA_LUGARES_VIGIA = 'semilla:lugares-propios-el-vigia:1';
export const TOPE_ESCRITURAS_LUGARES_VIGIA = 160;

/** De dónde salió cada punto corregido (para el reporte y la ayuda interna). */
export type FuentePunto = 'Google' | 'OpenStreetMap' | 'carretera';
export const PUNTOS_CORREGIDOS_VIGIA: readonly {
  nombre: string;
  antes: { lat: number; lng: number };
  fuente: FuentePunto;
  nota: string;
}[] = [
  {
    nombre: 'La Vega II',
    antes: { lat: 8.6, lng: -71.626 },
    fuente: 'carretera',
    nota: 'sobre la vía a Mérida entre La Vega I y el peaje, a mitad del tramo (mismo precio que el peaje)',
  },
  {
    nombre: 'Alcabala La Victoria',
    antes: { lat: 8.45, lng: -71.6 },
    fuente: 'Google',
    nota: 'Punto de Control GNB «La Victoria», Troncal 7',
  },
  {
    nombre: 'Pedeca',
    antes: { lat: 8.638, lng: -71.663 },
    fuente: 'carretera',
    nota: 'sobre la vía al Zulia, a mitad del tramo entre el casco y Parque Chama',
  },
  {
    nombre: 'Caño Frío',
    antes: { lat: 8.645, lng: -71.67 },
    fuente: 'OpenStreetMap',
    nota: 'Parcelamiento Caño Frío, Los Pozones',
  },
  {
    nombre: 'Cañito',
    antes: { lat: 8.685, lng: -71.69 },
    fuente: 'Google',
    nota: 'Los Cañitos, vía al Zulia antes de Vera de Agua',
  },
  {
    nombre: 'KM 35',
    antes: { lat: 8.84, lng: -71.85 },
    fuente: 'OpenStreetMap',
    nota: 'Kilómetro 35, parroquia Moralito (Zulia)',
  },
  {
    nombre: 'Carlos Andrés',
    antes: { lat: 8.575, lng: -71.705 },
    fuente: 'carretera',
    nota: 'vía a Los Giros pasando Onia, a la distancia de su precio',
  },
  {
    nombre: 'Culebria',
    antes: { lat: 8.5, lng: -71.72 },
    fuente: 'carretera',
    nota: 'vía a Los Giros, a la distancia de su precio (cerca del río Culebrilla)',
  },
  {
    nombre: 'KM 12',
    antes: { lat: 8.588, lng: -71.735 },
    fuente: 'carretera',
    nota: 'Troncal 1, tres kilómetros después del KM 9 (que está a 9,9 km por carretera)',
  },
  {
    nombre: 'KM 15',
    antes: { lat: 8.575, lng: -71.752 },
    fuente: 'carretera',
    nota: 'Troncal 1, seis kilómetros después del KM 9',
  },
  {
    nombre: 'El Puerto',
    antes: { lat: 8.13, lng: -72.26 },
    fuente: 'carretera',
    nota: 'vía La Fría a San Juan de Colón, a la distancia de su precio',
  },
  {
    nombre: 'Aguas Clara',
    antes: { lat: 8.07, lng: -72.28 },
    fuente: 'carretera',
    nota: 'vía La Fría a San Juan de Colón, antes de San Juan de Colón',
  },
  {
    nombre: 'Aroa I',
    antes: { lat: 8.65, lng: -71.625 },
    fuente: 'Google',
    nota: 'Hacienda Aroa, La Blanca (Aroa II queda 1,2 km antes)',
  },
  {
    nombre: 'El Chivo',
    antes: { lat: 8.95, lng: -71.65 },
    fuente: 'OpenStreetMap',
    nota: 'Pueblo Nuevo - El Chivo (Zulia)',
  },
  {
    nombre: 'Los Robles',
    antes: { lat: 8.6419, lng: -71.6146 },
    fuente: 'Google',
    nota: 'Los Robles, avenida principal de Caño Seco, La Blanca',
  },
  {
    nombre: 'Colinas de Buenos Aires',
    antes: { lat: 8.592, lng: -71.628 },
    fuente: 'carretera',
    nota: 'la calle más cercana al sector, al lado de la urbanización Buenos Aires',
  },
  {
    nombre: 'Cementerio Onia',
    antes: { lat: 8.6005, lng: -71.688 },
    fuente: 'Google',
    nota: 'Cementerio Santa Isabel, Onia',
  },
];
/** Los dos vecinos que solo achican el radio (su punto no cambia). */
export const RADIOS_CORREGIDOS_VIGIA = ['Mesa de las Palmas', 'Buenos Aires (Asodega)'] as const;

/**
 * Cómo la gente escribe cada destino además de su nombre. Lo demás lo resuelve el buscador solo: sin
 * acentos ni mayúsculas, «km9», «KM-9» y «kilómetro 9» son «KM 9».
 */
export const OTROS_NOMBRES_VIGIA: Readonly<Record<string, readonly string[]>> = {
  'La Vega I': ['La Vega 1', 'La Vega uno'],
  'La Vega II': ['La Vega 2', 'La Vega dos'],
  'Peaje Vía Mérida': ['Peaje de Mérida', 'Peaje La Vega'],
  'La Lagunillas': ['Lagunillas'],
  'Alcabala La Victoria': ['La Victoria', 'PAC La Victoria', 'Punto de control La Victoria'],
  'Parque Chama II': ['Parque Chama 2'],
  'Alcabala Vera Agua': ['Vera de Agua', 'Alcabala Vera de Agua'],
  Cañito: ['El Cañito', 'Los Cañitos'],
  'KM 35': ['Kilómetro 35'],
  'Santa Bárbara': ['Santa Bárbara del Zulia'],
  Encontrado: ['Encontrados'],
  'Santa Cruz Zulia': ['Santa Cruz del Zulia'],
  'Casigua El Cubo': ['Casigua'],
  'Puente de Onia': ['Onia', 'Puente Onia'],
  'Carlos Andrés': ['Carlos Andrés Pérez'],
  'KM 9': ['Kilómetro 9'],
  'KM 12': ['Kilómetro 12'],
  'KM 15': ['Kilómetro 15'],
  'Caño Tigre': ['Caño del Tigre'],
  'Aguas Clara': ['Aguas Claras', 'Agua Clara'],
  'San Juan de Colón': ['Colón'],
  'Redoma de la Blanca': ['La Blanca'],
  'Aroa I': ['Aroa 1'],
  'Aroa II': ['Aroa 2'],
  '4 Esquinas': ['Cuatro Esquinas'],
  'El Chivo': ['Pueblo Nuevo', 'Pueblo Nuevo El Chivo'],
  'Blanca Universidad': ['La Blanca Universidad'],
  'Av. 15': ['Avenida 15'],
  'La Pedregosa (Redoma)': ['Redoma La Pedregosa'],
  'La Pedregosa ULA': ['ULA', 'Núcleo ULA'],
  'Buenos Aires (Asodega)': ['Asodega', 'Buenos Aires'],
  'Cementerio Onia': ['Cementerio Santa Isabel', 'Cementerio de Onia'],
  '23 de Enero': ['Veintitrés de Enero'],
};

/** ¿Hay que correr esta semilla? Solo con el tabulador ya sembrado y sin su propia marca. */
export function lugaresVigiaPorCorrer(marcaTabulador: string | null, marcaLugares: string | null) {
  return leerMarcaSemilla(marcaTabulador)?.estado === 'sembrado' && marcaLugares == null;
}

const POR = 'C-LUGARES-PROPIOS';

export async function sembrarLugaresVigia(
  db: D1Database,
): Promise<{ escrituras: number; lugares: number } | null> {
  const marcas = await db
    .prepare('SELECT clave, valor FROM config WHERE clave IN (?, ?)')
    .bind(CLAVE_SEMILLA_TABULADOR_VIGIA, CLAVE_SEMILLA_LUGARES_VIGIA)
    .all<{ clave: string; valor: string }>();
  const valor = (k: string) => marcas.results.find((m) => m.clave === k)?.valor ?? null;
  if (
    !lugaresVigiaPorCorrer(valor(CLAVE_SEMILLA_TABULADOR_VIGIA), valor(CLAVE_SEMILLA_LUGARES_VIGIA))
  )
    return null;
  const tomada = await db
    .prepare('INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)')
    .bind(
      CLAVE_SEMILLA_LUGARES_VIGIA,
      JSON.stringify({ estado: 'corriendo', desde: new Date().toISOString() }),
    )
    .run();
  if (!Number(tomada.meta?.changes ?? 0)) return null;
  try {
    const destino = new Map(TABULADOR_EL_VIGIA.map((d) => [d.nombre, d]));
    const s: D1PreparedStatement[] = [];
    const corregir = [
      ...PUNTOS_CORREGIDOS_VIGIA,
      ...RADIOS_CORREGIDOS_VIGIA.map((nombre) => ({ nombre, antes: destino.get(nombre)! })),
    ];
    for (const c of corregir) {
      const d = destino.get(c.nombre);
      if (!d) throw new Error(`semilla de lugares: «${c.nombre}» no está en el tabulador`);
      // La ida (hasta ese lugar) y el regreso (desde ese lugar), solo si siguen en el punto viejo.
      s.push(
        db
          .prepare(
            `UPDATE rutas_precio_zona SET hasta_lat = ?, hasta_lng = ?, hasta_radio_km = ?, revisar = 0,
               actualizada_por = ?, actualizada_en = datetime('now')
             WHERE zona_id = ? AND servicio_id = 'moto' AND hasta_nombre = ? AND hasta_lat = ? AND hasta_lng = ?`,
          )
          .bind(
            d.lat,
            d.lng,
            d.radioKm,
            POR,
            ZONA_TABULADOR_VIGIA,
            d.nombre,
            c.antes.lat,
            c.antes.lng,
          ),
        db
          .prepare(
            `UPDATE rutas_precio_zona SET desde_lat = ?, desde_lng = ?, desde_radio_km = ?, revisar = 0,
               actualizada_por = ?, actualizada_en = datetime('now')
             WHERE zona_id = ? AND servicio_id = 'moto' AND desde_nombre = ? AND desde_lat = ? AND desde_lng = ?`,
          )
          .bind(
            d.lat,
            d.lng,
            d.radioKm,
            POR,
            ZONA_TABULADOR_VIGIA,
            d.nombre,
            c.antes.lat,
            c.antes.lng,
          ),
      );
    }
    // El lugar propio de cada destino, atado a su ruta de ida y con el punto que la ruta tiene ahora
    // (el del equipo si lo movió, o el recién corregido: va después en el mismo lote).
    for (const d of TABULADOR_EL_VIGIA)
      s.push(
        db
          .prepare(
            `INSERT INTO lugares_propios (id, zona_id, nombre, otros_nombres, lat, lng, ruta_id, creado_por, actualizado_por)
             SELECT ?, r.zona_id, r.hasta_nombre, ?, r.hasta_lat, r.hasta_lng, r.id, ?, ?
               FROM rutas_precio_zona r
              WHERE r.zona_id = ? AND r.servicio_id = 'moto' AND r.hasta_nombre = ? AND r.activa = 1
                AND NOT EXISTS (SELECT 1 FROM lugares_propios l WHERE l.zona_id = r.zona_id AND l.nombre = r.hasta_nombre)
              ORDER BY r.precio LIMIT 1`,
          )
          .bind(
            nuevoId(),
            JSON.stringify(OTROS_NOMBRES_VIGIA[d.nombre] ?? []),
            POR,
            POR,
            ZONA_TABULADOR_VIGIA,
            d.nombre,
          ),
      );
    const escrituras = s.length + 2;
    if (escrituras > TOPE_ESCRITURAS_LUGARES_VIGIA)
      throw new Error(`semilla de lugares: ${escrituras} escrituras pasan el tope`);
    s.push(
      db
        .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = ?")
        .bind(JSON.stringify({ hecha: true, escrituras }), CLAVE_SEMILLA_LUGARES_VIGIA),
    );
    const r = await db.batch(s);
    const lugares = r
      .slice(corregir.length * 2, corregir.length * 2 + TABULADOR_EL_VIGIA.length)
      .reduce((n, x) => n + Number(x.meta?.changes ?? 0), 0);
    console.warn(`semilla: ${lugares} lugares propios de El Vigía y puntos corregidos (${POR})`);
    return { escrituras, lugares };
  } catch (e) {
    // Sin marca: el próximo arranque lo intenta otra vez.
    await db
      .prepare('DELETE FROM config WHERE clave = ?')
      .bind(CLAVE_SEMILLA_LUGARES_VIGIA)
      .run()
      .catch((x: unknown) => console.error('semilla de lugares: no se pudo soltar la marca', x));
    throw e;
  }
}
