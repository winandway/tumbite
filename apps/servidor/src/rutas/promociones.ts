import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { nuevoId } from '../cripto';
import { topesDeZona } from '../internacional/tarifas';
import { leerPromociones, resumenPromociones } from '../promociones';
import { ZONA_INICIAL } from './zonas';
import { mio } from './restauranteMas';
import { limitesDelDia } from './operacion';

/**
 * C-PROMO-RESTAURANTE (BRE-5): el restaurante arma, ve y termina sus promociones; el superadmin
 * las enciende para todos. Nacen apagadas.
 */
export const promociones = new Hono<{ Bindings: Env; Variables: Variables }>();

const fecha = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v), {
    error: 'La fecha no es válida.',
  })
  .transform((v) => (v.length === 10 ? `${v} 00:00:00` : v));

/**
 * BRE-5d: una fecha sin hora es un día entero en la hora del restaurante: «Empieza» desde su
 * medianoche y «Termina» hasta el final de ese día (se guarda exclusivo, en UTC como la base).
 */
function diaLocal(v: string, zona: string, extremo: 'inicio' | 'fin'): string {
  if (!/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(v)) return v;
  const [inicio, fin] = limitesDelDia(zona, new Date(`${v.slice(0, 10)}T12:00:00Z`));
  return extremo === 'inicio' ? inicio : fin;
}

async function monedaDe(db: D1Database, restauranteId: string) {
  const f = await db
    .prepare('SELECT zona_id FROM restaurantes WHERE id = ?')
    .bind(restauranteId)
    .first<{ zona_id: string | null }>();
  return topesDeZona(db, String(f?.zona_id ?? ZONA_INICIAL));
}

promociones.get('/mi-restaurante/promociones', async (c) => {
  const db = base(c);
  const r = await mio(c, db);
  const { moneda } = await monedaDe(db, r.id);
  return c.json({
    disponible: (await leerPromociones(db)).encendidas,
    moneda,
    promociones: await resumenPromociones(db, r.id),
  });
});

promociones.post('/mi-restaurante/promociones', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  const d = await leerCuerpo(
    c,
    z.object({
      tipo: z.enum(['porcentaje', 'envio_gratis', 'gasta_ahorra']),
      valor: z.number().int().min(0).max(1_000_000).default(0),
      minimoSubtotal: z.number().int().min(0).max(10_000_000).default(0),
      topeCentavos: z.number().int().min(0).max(10_000_000).default(0),
      usosMax: z.number().int().min(1).max(100_000).nullable().default(null),
      iniciaEn: fecha,
      venceEn: fecha,
    }),
  );
  if (!(await leerPromociones(db)).encendidas)
    throw new ErrorDatos('Las promociones todavía no están disponibles.', undefined, 409);
  if (d.tipo === 'porcentaje' && (d.valor < 100 || d.valor > 5000))
    throw new ErrorDatos('El descuento tiene que ir del 1 al 50 %.', 'valor', 400);
  if (d.tipo === 'gasta_ahorra') {
    if (d.valor <= 0) throw new ErrorDatos('Escribe cuánto ahorra el cliente.', 'valor', 400);
    if (d.valor >= d.minimoSubtotal)
      throw new ErrorDatos(
        'Lo que ahorra el cliente tiene que ser menos de lo que gasta.',
        'valor',
        400,
      );
  }
  const zona =
    (
      await db
        .prepare(
          'SELECT z.zona_horaria FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
        )
        .bind(r.id)
        .first<{ zona_horaria: string | null }>()
    )?.zona_horaria || 'America/New_York';
  d.iniciaEn = diaLocal(d.iniciaEn, zona, 'inicio');
  d.venceEn = diaLocal(d.venceEn, zona, 'fin');
  if (d.venceEn <= d.iniciaEn)
    throw new ErrorDatos('La promoción tiene que terminar después de empezar.', 'venceEn', 400);
  const { topes } = await monedaDe(db, r.id);
  if (!topes) throw new ErrorDatos('Ese país no tiene sus topes escritos todavía.', undefined, 409);
  if (d.tipo === 'gasta_ahorra' && d.valor > topes.cuponMontoMax)
    throw new ErrorDatos('El ahorro pasa del máximo permitido.', 'valor', 400);
  const activas = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM promociones_restaurante WHERE restaurante_id = ? AND activa = 1 AND vence_en > datetime('now')",
    )
    .bind(r.id)
    .first<{ n: number }>();
  if (Number(activas?.n ?? 0) >= 5)
    throw new ErrorDatos('Puedes tener hasta 5 promociones a la vez.', undefined, 409);
  await db
    .prepare(
      `INSERT INTO promociones_restaurante (id, restaurante_id, tipo, valor, minimo_subtotal, tope_centavos, usos_max, inicia_en, vence_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      nuevoId(),
      r.id,
      d.tipo,
      d.tipo === 'envio_gratis' ? 0 : d.valor,
      d.minimoSubtotal,
      d.tipo === 'porcentaje' ? d.topeCentavos : 0,
      d.usosMax,
      d.iniciaEn,
      d.venceEn,
    )
    .run();
  return c.json({ promociones: await resumenPromociones(db, r.id) }, 201);
});

/** Terminar una promoción antes de tiempo (no se borra: los pedidos la siguen nombrando). */
promociones.patch('/mi-restaurante/promociones/:id', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  await leerCuerpo(c, z.object({ activa: z.literal(false) }));
  const res = await db
    .prepare(
      'UPDATE promociones_restaurante SET activa = 0 WHERE id = ? AND restaurante_id = ? AND activa = 1',
    )
    .bind(c.req.param('id'), r.id)
    .run();
  if (!res.meta.changes)
    throw new ErrorDatos('Esa promoción no existe o ya terminó.', undefined, 404);
  return c.json({ promociones: await resumenPromociones(db, r.id) });
});

promociones.get('/admin/promociones', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerPromociones(base(c)));
});

promociones.put('/admin/promociones', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, z.object({ encendidas: z.boolean() }));
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('promociones_restaurante', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});
