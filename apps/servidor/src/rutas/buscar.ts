import { Hono } from 'hono';
import { z } from 'zod';
import { normalizar } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';
import { minutosPausa } from '../pausa';
import { aRestaurante, conHorarios } from './catalogo';
import { ZONA_INICIAL, zonaPara } from './zonas';
import { enTrozos } from '../trozos';

/**
 * Buscador real del inicio del cliente (18 oct 2026, «como los grandes»): restaurantes por nombre
 * o tipo de comida y platos por su nombre, en los dos idiomas, dentro de la ciudad de la persona.
 * Abiertos primero. La comparación se hace sin acentos ni mayúsculas, en memoria, sobre lo visible
 * de la ciudad (lo mismo que ve /datos/restaurantes): nada que no esté aprobado ni agotado sale.
 */
export const buscar = new Hono<{ Bindings: Env; Variables: Variables }>();

const consulta = z.object({
  q: z.string().trim().min(2).max(60),
  lat: z.coerce.number().finite().optional(),
  lng: z.coerce.number().finite().optional(),
});
const TOPE = 10;

type FilaPlato = {
  id: string;
  restaurante_id: string;
  nombre_es: string;
  nombre_en: string;
  categoria: string;
  categoria_en: string;
  precio_centavos: number;
  imagen: string | null;
};

buscar.get('/buscar', async (c) => {
  const q = consulta.safeParse(c.req.query());
  if (!q.success) throw new ErrorDatos('Escribe al menos dos letras.', 'q', 400);
  const db = base(c);
  const ingles = (c.req.header('x-idioma') ?? '').startsWith('en');
  const u = c.get('usuario');
  let zona: { id: string; nombre: string } | null = await zonaPara(db, q.data.lat, q.data.lng);
  if (!zona && q.data.lat == null && u) {
    const f = await db
      .prepare(
        'SELECT z.id, z.nombre FROM usuarios u JOIN zonas z ON z.id = u.zona_id WHERE u.id = ?',
      )
      .bind(u.id)
      .first<{ id: string; nombre: string }>();
    if (f) zona = f;
  }
  // Sin ubicación (la web sin permiso de GPS), la ciudad inicial, igual que /datos/restaurantes.
  if (!zona && q.data.lat == null) {
    const f = await db
      .prepare('SELECT id, nombre FROM zonas WHERE id = ?')
      .bind(ZONA_INICIAL)
      .first<{ id: string; nombre: string }>();
    if (f) zona = f;
  }
  if (!zona) return c.json({ zona: null, restaurantes: [], platos: [] });
  const texto = normalizar(q.data.q);
  const { results } = await db
    .prepare(
      `SELECT * FROM restaurantes WHERE zona_id = ? AND estado = 'aprobado' AND tipo_comercio = 'restaurante'
       AND (NOT EXISTS (SELECT 1 FROM areas WHERE zona_id = ?1 AND estado <> 'borrador')
            OR area_id IN (SELECT id FROM areas WHERE zona_id = ?1 AND estado = 'activa'))
       ORDER BY abierto DESC, nombre`,
    )
    .bind(zona.id)
    .all<Record<string, unknown>>();
  const minutos = await minutosPausa(db);
  const todos = (await conHorarios(db, results)).map((f) => aRestaurante(f, minutos));
  const porId = new Map(todos.map((r) => [r.id, r]));
  const abiertoPrimero = (a: { abiertoAhora?: boolean }, b: { abiertoAhora?: boolean }) =>
    Number(Boolean(b.abiertoAhora)) - Number(Boolean(a.abiertoAhora));
  const restaurantes = todos
    .filter((r) => normalizar(`${r.nombre} ${r.categoria}`).includes(texto))
    .sort(abiertoPrimero)
    .slice(0, TOPE);

  let platos: {
    id: string;
    nombre: string;
    precioCentavos: number;
    imagen: string | null;
    restauranteId: string;
    restauranteNombre: string;
    abiertoAhora: boolean;
    /** C-MONEDA-RECORRIDO: la moneda del restaurante (el precio va en su unidad menor). */
    moneda: string;
  }[] = [];
  if (todos.length) {
    // C-LIMITE-PARAMETROS: en trozos (D1 acepta 100 parámetros por consulta).
    const filas = (
      await enTrozos(
        todos.map((r) => r.id),
        async (trozo, marcas) =>
          (
            await db
              .prepare(
                `SELECT id, restaurante_id, nombre_es, nombre_en, categoria, categoria_en, precio_centavos, imagen, orden
                   FROM platos WHERE restaurante_id IN (${marcas}) AND disponible = 1 AND eliminado = 0
                  ORDER BY orden, nombre_es LIMIT 2000`,
              )
              .bind(...trozo)
              .all<FilaPlato & { orden: number | null }>()
          ).results,
      )
    )
      .sort(
        (a, b) =>
          Number(a.orden ?? 0) - Number(b.orden ?? 0) || a.nombre_es.localeCompare(b.nombre_es),
      )
      .slice(0, 2000);
    platos = filas
      .filter((p) =>
        normalizar(`${p.nombre_es} ${p.nombre_en} ${p.categoria} ${p.categoria_en}`).includes(
          texto,
        ),
      )
      .map((p) => {
        const r = porId.get(p.restaurante_id);
        return {
          id: p.id,
          nombre: (ingles ? p.nombre_en : p.nombre_es) || p.nombre_es,
          precioCentavos: p.precio_centavos,
          imagen: p.imagen,
          restauranteId: p.restaurante_id,
          restauranteNombre: r?.nombre ?? '',
          abiertoAhora: Boolean(r?.abiertoAhora),
          moneda: r?.moneda ?? 'USD',
        };
      })
      .sort(abiertoPrimero)
      .slice(0, TOPE);
  }
  c.header('cache-control', 'private, max-age=30');
  return c.json({ zona: { id: zona.id, nombre: zona.nombre }, restaurantes, platos });
});
