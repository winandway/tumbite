import { Hono } from 'hono';
import { z } from 'zod';
import { type AjustesPlus, PLUS_INICIAL } from '@tumbite/compartido';
import type { Env } from './env';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';
import { crearStripe } from './stripe';

/**
 * C-PLUS (R-T3, 1 nov 2026, como DashPass de DoorDash; evidencia REA ev_2ea6a124…): suscripción
 * mensual con envío en cero y servicio reducido en pedidos que llegan al mínimo. Se cobra con una
 * suscripción de Stripe que se renueva sola hasta que el cliente cancela. Arranca APAGADA (cuota
 * en cero) y, mientras el cobro completo no se pruebe, solo se puede encender con llaves de Stripe
 * de prueba. Solo EE. UU. (dólares).
 */
export const plus = new Hono<{ Bindings: Env; Variables: Variables }>();

export async function leerPlus(db: D1Database): Promise<AjustesPlus> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'plus'")
    .first<{ valor: string }>();
  if (!f) return PLUS_INICIAL;
  try {
    return { ...PLUS_INICIAL, ...(JSON.parse(f.valor) as Partial<AjustesPlus>) };
  } catch (e) {
    console.error('plus: ajustes ilegibles, queda apagado', e);
    return PLUS_INICIAL;
  }
}

/** ¿Tiene esta persona Divoox Plus vigente ahora? (encendido + pagado + sin vencer). */
export async function tienePlus(db: D1Database, usuarioId: string): Promise<boolean> {
  if ((await leerPlus(db)).centavosMes <= 0) return false;
  const f = await db
    .prepare(
      "SELECT 1 AS si FROM suscripciones_plus WHERE usuario_id = ? AND estado = 'activa' AND vence_en > datetime('now')",
    )
    .bind(usuarioId)
    .first();
  return Boolean(f);
}

const esLlaveReal = (k: string | undefined) =>
  Boolean(k && (k.startsWith('sk_live_') || k.startsWith('rk_live_')));

async function miSuscripcion(db: D1Database, usuarioId: string) {
  const f = await db
    .prepare(
      'SELECT estado, vence_en, cancela_al_final, stripe_suscripcion FROM suscripciones_plus WHERE usuario_id = ?',
    )
    .bind(usuarioId)
    .first<{
      estado: string;
      vence_en: string | null;
      cancela_al_final: number;
      stripe_suscripcion: string | null;
    }>();
  return f;
}

plus.get('/plus', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const a = await leerPlus(db);
  const s = await miSuscripcion(db, u.id);
  return c.json({
    disponible: a.centavosMes > 0,
    ...a,
    activo: await tienePlus(db, u.id),
    suscripcion: s
      ? { estado: s.estado, venceEn: s.vence_en, cancelaAlFinal: s.cancela_al_final === 1 }
      : null,
  });
});

plus.post('/plus/suscribirse', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const a = await leerPlus(db);
  if (a.centavosMes <= 0)
    throw new ErrorDatos('Divoox Plus todavía no está disponible.', undefined, 409);
  if (await tienePlus(db, u.id)) throw new ErrorDatos('Ya tienes Divoox Plus.', undefined, 409);
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  const fila = await db
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  let cliente = fila?.stripe_cliente ?? null;
  if (!cliente) {
    cliente = (
      await stripe.post<{ id: string }>(
        '/customers',
        { email: u.correo, name: u.nombre, metadata: { usuario_id: u.id } },
        `cliente-${u.id}`,
      )
    ).id;
    await db
      .prepare('UPDATE usuarios SET stripe_cliente = ? WHERE id = ?')
      .bind(cliente, u.id)
      .run();
  }
  // El producto «Divoox Plus» se crea una vez por cuenta de Stripe y se guarda.
  const prod = await db
    .prepare("SELECT valor FROM config WHERE clave = 'plus_producto'")
    .first<{ valor: string }>();
  let producto = prod?.valor ?? '';
  if (!producto) {
    producto = (
      await stripe.post<{ id: string }>(
        '/products',
        { name: 'Divoox Plus', metadata: { tumbite: 'plus' } },
        'producto-divoox-plus',
      )
    ).id;
    await db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('plus_producto', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      )
      .bind(producto)
      .run();
  }
  const sub = await stripe.post<{
    id: string;
    latest_invoice?: { confirmation_secret?: { client_secret?: string } };
  }>(
    '/subscriptions',
    {
      customer: cliente,
      items: [
        {
          price_data: {
            currency: 'usd',
            product: producto,
            unit_amount: a.centavosMes,
            recurring: { interval: 'month' },
          },
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.confirmation_secret'],
      metadata: { tumbite: 'plus', usuario_id: u.id },
    },
    `plus-${u.id}-${Date.now()}`,
  );
  const secreto = sub.latest_invoice?.confirmation_secret?.client_secret;
  if (!secreto)
    throw new ErrorDatos('Stripe no devolvió el cobro. Intenta otra vez.', undefined, 503);
  await db
    .prepare(
      `INSERT INTO suscripciones_plus (usuario_id, stripe_suscripcion, estado) VALUES (?, ?, 'pendiente')
       ON CONFLICT(usuario_id) DO UPDATE SET stripe_suscripcion = excluded.stripe_suscripcion,
         estado = CASE WHEN suscripciones_plus.estado = 'activa' THEN 'activa' ELSE 'pendiente' END,
         cancela_al_final = 0, actualizado_en = datetime('now')`,
    )
    .bind(u.id, sub.id)
    .run();
  // La hoja de pago de la app muestra y guarda las tarjetas del cliente (igual que en el pedido).
  const funciones = {
    payment_method_save: 'enabled',
    payment_method_redisplay: 'enabled',
    payment_method_remove: 'enabled',
  };
  const sesion = await stripe.post<{ client_secret: string }>('/customer_sessions', {
    customer: cliente,
    components: {
      payment_element: { enabled: true, features: funciones },
      mobile_payment_element: { enabled: true, features: funciones },
    },
  });
  return c.json({
    clientSecret: secreto,
    clienteStripe: cliente,
    sesionCliente: sesion.client_secret,
    clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    centavosMes: a.centavosMes,
  });
});

plus.post('/plus/cancelar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const s = await miSuscripcion(db, u.id);
  if (!s?.stripe_suscripcion || s.estado === 'terminada')
    throw new ErrorDatos('No tienes Divoox Plus.', undefined, 404);
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  // Como DashPass: sigue vigente hasta el final del periodo pagado y no se renueva.
  await stripe.post(
    `/subscriptions/${s.stripe_suscripcion}`,
    { cancel_at_period_end: true },
    `plus-cancelar-${s.stripe_suscripcion}`,
  );
  await db
    .prepare(
      "UPDATE suscripciones_plus SET cancela_al_final = 1, actualizado_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(u.id)
    .run();
  return c.json({ ok: true, venceEn: s.vence_en });
});

plus.get('/admin/plus', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerPlus(base(c)));
});

plus.put('/admin/plus', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      centavosMes: z.number().int().min(0).max(10_000),
      minimoSubtotal: z.number().int().min(0).max(100_000),
      servicioDescuentoPct: z.number().int().min(0).max(100),
    }),
  );
  // VERIFICAR-PAGOS: un cobro recurrente sin probar de punta a punta no corre con dinero real.
  if (d.centavosMes > 0 && esLlaveReal(c.env.STRIPE_SECRET_KEY))
    throw new ErrorDatos(
      'Divoox Plus se enciende con dinero real cuando su cobro esté probado de punta a punta.',
      'centavosMes',
      409,
    );
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('plus', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});

/**
 * Avisos firmados de Stripe de la suscripción. «invoice.paid» la activa hasta el fin del periodo
 * pagado; «customer.subscription.deleted» la termina. Devuelve true si el aviso era de Plus.
 */
export async function avisoPlus(
  db: D1Database,
  tipo: string,
  obj: Record<string, unknown>,
): Promise<boolean> {
  if (tipo === 'invoice.paid') {
    const padre = obj.parent as
      { type?: string; subscription_details?: { subscription?: string } } | undefined;
    const subId = padre?.subscription_details?.subscription;
    if (!subId) return false;
    const lineas = (obj.lines as { data?: { period?: { end?: number } }[] } | undefined)?.data;
    const fin = lineas?.[0]?.period?.end;
    if (!fin) {
      console.error('plus: factura pagada sin periodo', subId);
      return false;
    }
    const r = await db
      .prepare(
        `UPDATE suscripciones_plus SET estado = 'activa', vence_en = datetime(?, 'unixepoch'),
           actualizado_en = datetime('now') WHERE stripe_suscripcion = ?`,
      )
      .bind(fin, subId)
      .run();
    return (r.meta.changes ?? 0) > 0;
  }
  if (tipo === 'customer.subscription.deleted') {
    const r = await db
      .prepare(
        "UPDATE suscripciones_plus SET estado = 'terminada', actualizado_en = datetime('now') WHERE stripe_suscripcion = ?",
      )
      .bind(String(obj.id ?? ''))
      .run();
    return (r.meta.changes ?? 0) > 0;
  }
  return false;
}
