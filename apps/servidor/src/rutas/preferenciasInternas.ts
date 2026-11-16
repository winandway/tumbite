import { Hono } from 'hono';
import { z } from 'zod';
import {
  CLAVES_PREFERENCIAS,
  PANTALLAS_PREFERENCIAS,
  VALOR_PREFERENCIA,
  limpiarPreferencias,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-FILTROS-GUARDADOS (15 nov 2026, pedido de Richard: al volver a una pantalla del superadmin los
 * filtros estaban en blanco). Todos los países. Cada empleado guarda los filtros de cada pantalla
 * (ciudad, estado, orden…) en el servidor, así lo siguen de una computadora a otra.
 *
 * - Una fila por empleado y pantalla (tabla WITHOUT ROWID): un cambio escribe UNA fila.
 * - Mirar no escribe. Guardar lo mismo que ya estaba tampoco (el UPDATE lleva su WHERE).
 * - Nunca el texto buscado ni datos personales: solo claves conocidas con valores cortos sin
 *   espacios (`limpiarPreferencias`), y el cuerpo entero va acotado.
 */
export const preferenciasInternas = new Hono<{ Bindings: Env; Variables: Variables }>();

function pantallaDe(c: { req: { param: (k: string) => string | undefined } }) {
  const p = c.req.param('pantalla') ?? '';
  if (!(PANTALLAS_PREFERENCIAS as readonly string[]).includes(p))
    throw new ErrorDatos('Esa pantalla no guarda filtros.', 'pantalla', 404);
  return p;
}

const esquemaValor = z
  .object(
    Object.fromEntries(
      CLAVES_PREFERENCIAS.map((k) => [k, z.string().regex(VALOR_PREFERENCIA).optional()]),
    ),
  )
  .strict();
const esquemaPreferencias = z.object({ valor: esquemaValor }).strict();

preferenciasInternas.get('/admin/preferencias/:pantalla', async (c) => {
  const u = exigir(c, 'admin');
  const pantalla = pantallaDe(c);
  const f = await base(c)
    .prepare(
      'SELECT valor_json, actualizado_en FROM preferencias_internas WHERE usuario_id = ? AND pantalla = ?',
    )
    .bind(u.id, pantalla)
    .first<{ valor_json: string; actualizado_en: string }>();
  let valor: unknown = {};
  try {
    valor = f ? JSON.parse(f.valor_json) : {};
  } catch (e) {
    console.error('preferencias: valor guardado ilegible', pantalla, e);
  }
  return c.json({
    valor: limpiarPreferencias(valor),
    guardada: Boolean(f),
    actualizadoEn: f?.actualizado_en ?? null,
  });
});

preferenciasInternas.put('/admin/preferencias/:pantalla', async (c) => {
  const u = exigir(c, 'admin');
  const pantalla = pantallaDe(c);
  // Tamaño acotado antes de leer nada (la cabecera puede no venir: se mide el cuerpo).
  if ((await c.req.text()).length > 2_000)
    throw new ErrorDatos('Los filtros guardados son demasiado grandes.', undefined, 413);
  const { valor } = await leerCuerpo(c, esquemaPreferencias);
  const json = JSON.stringify(limpiarPreferencias(valor));
  // Si no cambió nada, el WHERE del UPDATE no deja escribir (cero filas).
  await base(c)
    .prepare(
      `INSERT INTO preferencias_internas (usuario_id, pantalla, valor_json) VALUES (?, ?, ?)
         ON CONFLICT (usuario_id, pantalla) DO UPDATE
           SET valor_json = excluded.valor_json, actualizado_en = datetime('now')
           WHERE preferencias_internas.valor_json != excluded.valor_json`,
    )
    .bind(u.id, pantalla, json)
    .run();
  return c.json({ ok: true, valor: JSON.parse(json) as unknown });
});

/** «Restablecer»: vuelve a los filtros de fábrica (se borra la fila de esa pantalla). */
preferenciasInternas.delete('/admin/preferencias/:pantalla', async (c) => {
  const u = exigir(c, 'admin');
  const pantalla = pantallaDe(c);
  await base(c)
    .prepare('DELETE FROM preferencias_internas WHERE usuario_id = ? AND pantalla = ?')
    .bind(u.id, pantalla)
    .run();
  return c.json({ ok: true });
});
