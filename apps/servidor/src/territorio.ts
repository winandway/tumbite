import {
  type EstadoArea,
  type Poligono,
  distanciaKm,
  puntoEnPoligonoOBorde,
  resolverArea,
} from '@tumbite/compartido';
import { ErrorDatos } from './validar';

/**
 * Cobertura territorial (C-TERRITORIO, 17 oct 2026). Una sola respuesta, en el servidor, para
 * «¿llega Tumbite a este punto?»:
 *
 * 1. Si el punto cae en un área ACTIVA de una ciudad activa → dentro (gana la regla de prioridad).
 * 2. Si cae en un área publicada pero no activa (o en una ciudad apagada) → ese estado
 *    (próximamente, pausada o cerrada): no se atiende.
 * 3. Si la ciudad NO tiene áreas publicadas (las de borrador no cuentan), vale su círculo
 *    (radio_km), como hasta hoy. Así Miami sigue igual hasta que se le dibujen áreas.
 */
export type FilaZona = {
  id: string;
  nombre: string;
  pais: string;
  moneda: string;
  zona_horaria: string;
  lat: number;
  lng: number;
  radio_km: number;
  activa: number;
  region?: string;
  idioma?: string;
};

export type AreaCobertura = {
  id: string;
  nombre: string;
  estado: EstadoArea;
  aperturaPrevista: string | null;
};

export type Cobertura = {
  estado: 'dentro' | 'proximamente' | 'pausada' | 'cerrada' | 'fuera';
  zona: FilaZona | null;
  area: AreaCobertura | null;
};

type FilaArea = {
  id: string;
  zona_id: string;
  nombre: string;
  estado: EstadoArea;
  poligono: string;
  prioridad: number;
  apertura_prevista: string | null;
  creado_en: string;
};

export function leerPoligono(texto: string): Poligono {
  try {
    const p = JSON.parse(texto) as unknown;
    return Array.isArray(p) ? (p as Poligono) : [];
  } catch {
    console.error('territorio: polígono ilegible', texto.slice(0, 80));
    return [];
  }
}

const aCobertura = (a: FilaArea): AreaCobertura => ({
  id: a.id,
  nombre: a.nombre,
  estado: a.estado,
  aperturaPrevista: a.apertura_prevista,
});

/** Ciudades que ya tienen al menos un área publicada (fuera de borrador). */
export async function ciudadesConAreas(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT DISTINCT zona_id FROM areas WHERE estado <> 'borrador'")
    .all<{ zona_id: string }>();
  return new Set(results.map((r) => r.zona_id));
}

export async function ciudadTieneAreas(db: D1Database, zonaId: string): Promise<boolean> {
  const f = await db
    .prepare("SELECT 1 FROM areas WHERE zona_id = ? AND estado <> 'borrador' LIMIT 1")
    .bind(zonaId)
    .first();
  return Boolean(f);
}

export async function cobertura(
  db: D1Database,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<Cobertura> {
  const fuera: Cobertura = { estado: 'fuera', zona: null, area: null };
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return fuera;

  // 1 y 2: áreas publicadas cuya caja contiene el punto (el índice areas_caja las filtra rápido).
  const { results: filas } = await db
    .prepare(
      `SELECT a.id, a.zona_id, a.nombre, a.estado, a.poligono, a.prioridad, a.apertura_prevista, a.creado_en
       FROM areas a WHERE a.estado <> 'borrador'
       AND ? BETWEEN a.min_lat AND a.max_lat AND ? BETWEEN a.min_lng AND a.max_lng`,
    )
    .bind(lat, lng)
    .all<FilaArea>();
  const contienen = filas
    .map((a) => ({
      ...a,
      prioridad: Number(a.prioridad),
      creadoEn: a.creado_en,
      poligono: leerPoligono(a.poligono),
    }))
    .filter((a) => puntoEnPoligonoOBorde(lat, lng, a.poligono));
  if (contienen.length) {
    const ids = [...new Set(contienen.map((a) => a.zona_id))];
    const { results: zonas } = await db
      .prepare(`SELECT * FROM zonas WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids)
      .all<FilaZona>();
    const zonaDe = new Map(zonas.map((z) => [z.id, z]));
    const enCiudadActiva = contienen.filter((a) => Number(zonaDe.get(a.zona_id)?.activa) === 1);
    const ganadora = resolverArea(lat, lng, enCiudadActiva);
    if (ganadora)
      return {
        estado: 'dentro',
        zona: zonaDe.get(ganadora.zona_id) ?? null,
        area: aCobertura({ ...ganadora, poligono: '', creado_en: ganadora.creadoEn }),
      };
    // No se atiende: se dice por qué (primero lo que va a abrir, luego lo pausado, luego lo cerrado).
    const orden: Record<string, number> = { proximamente: 0, activa: 0, pausada: 1, cerrada: 2 };
    const a = [...contienen].sort(
      (x, y) => (orden[x.estado] ?? 3) - (orden[y.estado] ?? 3) || y.prioridad - x.prioridad,
    )[0] as (typeof contienen)[number];
    // Un área activa en una ciudad todavía apagada es, para el público, una próxima apertura.
    const estado = a.estado === 'activa' ? 'proximamente' : (a.estado as Cobertura['estado']);
    return {
      estado,
      zona: zonaDe.get(a.zona_id) ?? null,
      area: aCobertura({ ...a, poligono: '', creado_en: a.creadoEn }),
    };
  }

  // 3: ciudades sin áreas publicadas, por su círculo (la más cercana que lo cubre).
  const conAreas = await ciudadesConAreas(db);
  const { results: zonas } = await db.prepare('SELECT * FROM zonas').all<FilaZona>();
  let mejor: { zona: FilaZona; km: number } | null = null;
  for (const z of zonas) {
    if (conAreas.has(z.id)) continue;
    const km = distanciaKm({ lat, lng }, { lat: Number(z.lat), lng: Number(z.lng) });
    if (km > Number(z.radio_km)) continue;
    // Una ciudad activa gana a una apagada aunque esté un poco más lejos.
    const mejorActiva = mejor && Number(mejor.zona.activa) === 1;
    const estaActiva = Number(z.activa) === 1;
    if (!mejor || (estaActiva && !mejorActiva) || (estaActiva === mejorActiva && km < mejor.km))
      mejor = { zona: z, km };
  }
  if (!mejor) return fuera;
  return {
    estado: Number(mejor.zona.activa) === 1 ? 'dentro' : 'proximamente',
    zona: mejor.zona,
    area: null,
  };
}

/** El área en la que cae un punto, en cualquier estado publicado (para restaurantes y repartidores). */
export async function areaPara(
  db: D1Database,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<string | null> {
  return (await cobertura(db, lat, lng)).area?.id ?? null;
}

/**
 * Después de dibujar, mover o cambiar de estado un área: cada restaurante de esa ciudad vuelve a
 * quedar en el área que le toca por su ubicación (los pedidos viejos conservan la suya).
 */
export async function recalcularAreasCiudad(db: D1Database, zonaId: string): Promise<number> {
  const { results } = await db
    .prepare('SELECT id, lat, lng, area_id FROM restaurantes WHERE zona_id = ? AND lat IS NOT NULL')
    .bind(zonaId)
    .all<{ id: string; lat: number; lng: number; area_id: string | null }>();
  const cambios = [];
  for (const r of results) {
    const area = await areaPara(db, Number(r.lat), Number(r.lng));
    if (area !== r.area_id)
      cambios.push(db.prepare('UPDATE restaurantes SET area_id = ? WHERE id = ?').bind(area, r.id));
  }
  if (cambios.length) await db.batch(cambios);
  return cambios.length;
}

/**
 * El pedido solo sale si la dirección de entrega está dentro de un área ACTIVA de la ciudad del
 * restaurante. Las ciudades sin áreas siguen con la regla de siempre (la distancia al restaurante).
 * La recogida en el local no lleva dirección de entrega.
 */
export async function exigirCobertura(
  db: D1Database,
  zonaId: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
  recogida = false,
): Promise<void> {
  if (recogida || !(await ciudadTieneAreas(db, zonaId))) return;
  const c = await cobertura(db, lat, lng);
  if (c.estado !== 'dentro' || c.zona?.id !== zonaId)
    throw new ErrorDatos(
      'Esa dirección está fuera de la zona de cobertura de Tumbite.',
      'direccion',
      409,
    );
}
