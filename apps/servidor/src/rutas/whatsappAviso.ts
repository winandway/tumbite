import { Hono } from 'hono';
import type { Env } from '../env';
import type { Variables } from '../sesion';
import { respaldoDeReferencia } from '../telefonoVuelta';
import { anotarEstadosWhatsapp, firmaMetaValida } from '../whatsapp';
import { anotarAvisoFalta } from '../whatsappFalta';

/**
 * C-WHATSAPP-ENTREGA (23 nov 2026, Gerencia): el aviso de estados de la app de Meta «Divoox Avisos»
 * (webhook, campo `messages`), en https://divoox.com/datos/whatsapp/aviso.
 * - GET: la verificación de Meta (hub.mode=subscribe y hub.verify_token igual a
 *   META_WHATSAPP_VERIFY_TOKEN) devuelve hub.challenge tal cual.
 * - POST: solo con la firma X-Hub-Signature-256 válida (META_APP_SECRET); anota sent / delivered /
 *   read / failed de cada mensaje y, si un código falló, lo manda por SMS al momento.
 * No lee ni guarda el contenido de los mensajes: solo el estado de los nuestros.
 * C-WHATSAPP-FALTA: también la entrega de los mensajes «te falta» y el estado y la categoría de su
 * plantilla (campos `message_template_status_update` y `template_category_update` del mismo webhook).
 */
export const whatsappAviso = new Hono<{ Bindings: Env; Variables: Variables }>();

whatsappAviso.get('/whatsapp/aviso', (c) => {
  const esperado = c.env.META_WHATSAPP_VERIFY_TOKEN;
  const modo = c.req.query('hub.mode');
  const dado = c.req.query('hub.verify_token') ?? '';
  if (!esperado || modo !== 'subscribe' || dado !== esperado) return c.text('No autorizado', 403);
  return c.text(c.req.query('hub.challenge') ?? '', 200);
});

whatsappAviso.post('/whatsapp/aviso', async (c) => {
  const cuerpo = await c.req.text();
  if (!(await firmaMetaValida(c.env.META_APP_SECRET, cuerpo, c.req.header('x-hub-signature-256'))))
    return c.text('Firma no válida', 401);
  let aviso: Parameters<typeof anotarEstadosWhatsapp>[1];
  try {
    aviso = JSON.parse(cuerpo) as typeof aviso;
  } catch {
    return c.text('Cuerpo no válido', 400);
  }
  const db = c.env.DB;
  if (!db) return c.json({ ok: true });
  const fallidas = await anotarEstadosWhatsapp(db, aviso);
  await anotarAvisoFalta(db, aviso as Parameters<typeof anotarAvisoFalta>[1]).catch((e: unknown) =>
    console.error('whatsapp: aviso de la plantilla «te falta»', String(e)),
  );
  for (const ref of fallidas)
    await respaldoDeReferencia(c.env, db, ref).catch((e: unknown) =>
      console.error('whatsapp: respaldo tras «failed»', String(e)),
    );
  // Meta reintenta si no recibe 200: se contesta siempre que la firma sea buena.
  return c.json({ ok: true });
});
