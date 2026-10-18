import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/** Direcciones guardadas del cliente (auditoría final, punto 14): casa, trabajo, con instrucciones. */
export const direcciones = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX = 10;

const aDireccion = (r: Record<string, unknown>) => ({
  id: String(r.id),
  etiqueta: String(r.etiqueta ?? ''),
  direccion: String(r.direccion),
  lat: r.lat == null ? null : Number(r.lat),
  lng: r.lng == null ? null : Number(r.lng),
  instrucciones: String(r.instrucciones ?? ''),
  entrega: String(r.entrega ?? 'puerta') as 'puerta' | 'mano',
  usadaEn: String(r.usada_en),
});

direcciones.get('/mis-direcciones', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      'SELECT * FROM direcciones_cliente WHERE usuario_id = ? ORDER BY usada_en DESC LIMIT ?',
    )
    .bind(u.id, MAX)
    .all<Record<string, unknown>>();
  return c.json({ direcciones: results.map(aDireccion) });
});

direcciones.post('/mis-direcciones', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      etiqueta: z.string().trim().max(30).default(''),
      direccion: z.string().trim().min(5, { error: 'Escribe la dirección de entrega.' }).max(200),
      lat: z.number().min(-90).max(90).nullable().default(null),
      lng: z.number().min(-180).max(180).nullable().default(null),
      instrucciones: z.string().trim().max(300).default(''),
      entrega: z.enum(['puerta', 'mano']).default('puerta'),
    }),
  );
  const db = base(c);
  // La misma dirección (texto) se actualiza en vez de duplicarse.
  const igual = await db
    .prepare(
      'SELECT id FROM direcciones_cliente WHERE usuario_id = ? AND lower(direccion) = lower(?)',
    )
    .bind(u.id, d.direccion)
    .first<{ id: string }>();
  const id = igual?.id ?? crypto.randomUUID();
  if (igual)
    await db
      .prepare(
        "UPDATE direcciones_cliente SET etiqueta = ?, lat = ?, lng = ?, instrucciones = ?, entrega = ?, usada_en = datetime('now') WHERE id = ?",
      )
      .bind(d.etiqueta, d.lat, d.lng, d.instrucciones, d.entrega, id)
      .run();
  else {
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM direcciones_cliente WHERE usuario_id = ?')
      .bind(u.id)
      .first<{ n: number }>();
    if (Number(n?.n ?? 0) >= MAX)
      throw new ErrorDatos(
        'Ya tienes el máximo de direcciones guardadas. Borra una para agregar otra.',
        undefined,
        409,
      );
    await db
      .prepare(
        'INSERT INTO direcciones_cliente (id, usuario_id, etiqueta, direccion, lat, lng, instrucciones, entrega) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, u.id, d.etiqueta, d.direccion, d.lat, d.lng, d.instrucciones, d.entrega)
      .run();
  }
  const r = (await db
    .prepare('SELECT * FROM direcciones_cliente WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>())!;
  return c.json({ direccion: aDireccion(r) }, igual ? 200 : 201);
});

direcciones.delete('/mis-direcciones/:id', async (c) => {
  const u = exigir(c, 'cliente');
  await base(c)
    .prepare('DELETE FROM direcciones_cliente WHERE id = ? AND usuario_id = ?')
    .bind(c.req.param('id'), u.id)
    .run();
  return c.json({ ok: true });
});
