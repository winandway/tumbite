import { Hono } from 'hono';
import { z } from 'zod';
import { decodificarGeohash, geohash } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { zonaPara } from './zonas';

/**
 * C-MAPA-DEMANDA (29 oct 2026, como el «Dash Now» de DoorDash y las zonas de Uber Driver): las
 * zonas de la ciudad del repartidor con más pedidos en la última hora, para que sepa hacia dónde
 * moverse. Se agrupa por celdas de geohash de 6 letras (unos 1,2 km) y se cuenta desde el LOCAL,
 * nunca desde la casa del cliente. Una celda con un solo pedido no sale. No devuelve ni nombres,
 * ni direcciones, ni pedidos, ni dinero: solo el centro de la celda, cuántos y el nivel.
 */
export const demanda = new Hono<{ Bindings: Env; Variables: Variables }>();

const PRECISION = 6;
const MINIMO = 2;
const ALTA = 5;
const TOPE = 8;

const consulta = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
});

demanda.get('/repartidor/demanda', async (c) => {
  exigir(c, 'repartidor');
  const q = consulta.safeParse(c.req.query());
  if (!q.success) return c.json({ zonas: [] });
  const db = base(c);
  const zona = await zonaPara(db, q.data.lat, q.data.lng);
  if (!zona) return c.json({ zonas: [] });
  const { results } = await db
    .prepare(
      `SELECT r.lat, r.lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE r.zona_id = ? AND r.lat IS NOT NULL AND r.lng IS NOT NULL
          AND p.estado IN ('pagado','aceptado','listo','en_camino','entregado')
          AND p.creado_en >= datetime('now', '-60 minutes')
        LIMIT 5000`,
    )
    .bind(zona.id)
    .all<{ lat: number; lng: number }>();
  const cuenta = new Map<string, number>();
  for (const f of results) {
    const celda = geohash(Number(f.lat), Number(f.lng), PRECISION);
    cuenta.set(celda, (cuenta.get(celda) ?? 0) + 1);
  }
  const zonas = [...cuenta]
    .filter(([, n]) => n >= MINIMO)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOPE)
    .map(([celda, pedidos]) => {
      const centro = decodificarGeohash(celda);
      return {
        lat: Math.round(centro.lat * 10_000) / 10_000,
        lng: Math.round(centro.lng * 10_000) / 10_000,
        pedidos,
        nivel: pedidos >= ALTA ? ('alta' as const) : ('media' as const),
      };
    });
  c.header('cache-control', 'private, max-age=60');
  return c.json({ zonas });
});
