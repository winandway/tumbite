import { Hono } from 'hono';
import { z } from 'zod';
import { decodificarGeohash, geohash } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { zonaPara } from './zonas';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  PEDIDOS_DEMANDA_ALTA,
  PRECISION_CELDA,
  leerPagoPico,
  montoPicoDisponible,
} from '../pagoPico';

/**
 * C-MAPA-DEMANDA (29 oct 2026, como el «Dash Now» de DoorDash y las zonas de Uber Driver): las
 * zonas de la ciudad del repartidor con más pedidos en la última hora, para que sepa hacia dónde
 * moverse. Se agrupa por celdas de geohash de 6 letras (unos 1,2 km) y se cuenta desde el LOCAL,
 * nunca desde la casa del cliente. Una celda con un solo pedido no sale. No devuelve ni nombres,
 * ni direcciones, ni pedidos, ni dinero: solo el centro de la celda, cuántos y el nivel.
 */
export const demanda = new Hono<{ Bindings: Env; Variables: Variables }>();

const PRECISION = PRECISION_CELDA;
const MINIMO = 2;
const ALTA = PEDIDOS_DEMANDA_ALTA;
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
  // C-LECTURAS-DEMANDA (14 nov 2026): parte de los pedidos de la ÚLTIMA HORA de la zona, por el
  // índice zona + estado + fecha (cinco rangos cortos), y de cada uno busca su local por la clave.
  // Antes partía de los restaurantes de la zona y leía TODOS los pedidos de su historia en esos
  // estados (63.442 filas en una vuelta del sitio de pruebas) para quedarse con los de la hora.
  // El pedido nace con la zona de su local (pedidos.ts); se exige además que el local siga en ella.
  const { results } = await db
    .prepare(
      `SELECT r.lat, r.lng FROM pedidos p INDEXED BY pedidos_zona_estado
         CROSS JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.zona_id = ?1 AND p.estado IN ('pagado','aceptado','listo','en_camino','entregado')
          AND p.creado_en >= datetime('now', '-60 minutes')
          AND r.zona_id = ?1 AND r.lat IS NOT NULL AND r.lng IS NOT NULL
        LIMIT 5000`,
    )
    .bind(zona.id)
    .all<{ lat: number; lng: number }>();
  const cuenta = new Map<string, number>();
  for (const f of results) {
    const celda = geohash(Number(f.lat), Number(f.lng), PRECISION);
    cuenta.set(celda, (cuenta.get(celda) ?? 0) + 1);
  }
  // C-PAGO-PICO: las zonas en rojo muestran el pago extra si está encendido y queda presupuesto.
  const pico = await montoPicoDisponible(db);
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
        ...(pico && pedidos >= ALTA ? { pico } : {}),
      };
    });
  c.header('cache-control', 'private, max-age=60');
  return c.json({ zonas, moneda: zona.moneda });
});

/** C-PAGO-PICO: el equipo fija el monto por pedido y el presupuesto del día (0 = apagado). */
demanda.get('/admin/pago-pico', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerPagoPico(base(c)));
});

demanda.put('/admin/pago-pico', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      centavos: z.number().int().min(0).max(1_000),
      presupuestoDiaCentavos: z.number().int().min(0).max(1_000_000),
    }),
  );
  if (d.centavos > 0 && d.presupuestoDiaCentavos < d.centavos)
    throw new ErrorDatos(
      'El presupuesto del día tiene que alcanzar al menos para un pago.',
      'presupuestoDiaCentavos',
      422,
    );
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('pago_pico', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});
