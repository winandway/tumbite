import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { limiteIntentos } from '../seguridad';
import { nuevoId } from '../cripto';
import { anotarToque, leerAnuncios, resumenAnuncios } from '../anuncios';
import { mio } from './restauranteMas';

/** C-ANUNCIOS: el restaurante maneja su anuncio; el superadmin fija el precio por pedido. */
export const anuncios = new Hono<{ Bindings: Env; Variables: Variables }>();

anuncios.get('/mi-restaurante/anuncios', async (c) => {
  const db = base(c);
  const r = await mio(c, db);
  return c.json(await resumenAnuncios(db, r.id));
});

anuncios.put('/mi-restaurante/anuncios', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  const d = await leerCuerpo(
    c,
    z.object({
      activa: z.boolean(),
      presupuestoSemanalCentavos: z.number().int().min(0).max(10_000_000),
    }),
  );
  if ((await leerAnuncios(db)).centavosPorPedido <= 0)
    throw new ErrorDatos('Los anuncios todavía no están disponibles.', undefined, 409);
  if (d.activa && d.presupuestoSemanalCentavos <= 0)
    throw new ErrorDatos(
      'Escribe tu presupuesto semanal para encender el anuncio.',
      'presupuestoSemanalCentavos',
    );
  await db
    .prepare(
      `INSERT INTO campanas_anuncio (id, restaurante_id, activa, presupuesto_semanal) VALUES (?, ?, ?, ?)
       ON CONFLICT(restaurante_id) DO UPDATE SET activa = excluded.activa,
         presupuesto_semanal = excluded.presupuesto_semanal, actualizado_en = datetime('now')`,
    )
    .bind(nuevoId(), r.id, d.activa ? 1 : 0, d.presupuestoSemanalCentavos)
    .run();
  return c.json(await resumenAnuncios(db, r.id));
});

// Un toque en el anuncio desde la app del cliente: solo estadística, nunca se cobra.
anuncios.post('/anuncios/:id/toque', limiteIntentos(60, 60_000), async (c) => {
  await anotarToque(base(c), c.req.param('id'));
  return c.json({ ok: true });
});

anuncios.get('/admin/anuncios', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerAnuncios(base(c)));
});

anuncios.put('/admin/anuncios', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      centavosPorPedido: z.number().int().min(0).max(10_000),
      maxEnLista: z.number().int().min(0).max(5),
    }),
  );
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('anuncios', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});
