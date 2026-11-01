import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';
import { crearStripe } from './stripe';
import { enviarCorreo } from './correo';
import { limiteIntentos } from './seguridad';
import { nuevoId } from './cripto';

/**
 * C-TARJETAS-REGALO (R-T4, 1 nov 2026, como las tarjetas de regalo digitales de DoorDash y Uber
 * Eats: monto elegido, correo y mensaje para quien la recibe, código que se canjea como saldo).
 * Arrancan APAGADAS. Mientras el cobro no se pruebe de punta a punta, solo se encienden con llaves
 * de Stripe de prueba. Solo en dólares.
 *
 * El saldo de regalo se usa en el pedido como un descuento (el dinero ya lo cobró Divoox al vender
 * la tarjeta): el restaurante y el repartidor cobran igual.
 */
export const tarjetasRegalo = new Hono<{ Bindings: Env; Variables: Variables }>();

export type AjustesTarjetas = { activas: boolean; minimo: number; maximo: number };
export const TARJETAS_INICIAL: AjustesTarjetas = { activas: false, minimo: 1500, maximo: 50000 };

export async function leerTarjetas(db: D1Database): Promise<AjustesTarjetas> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'tarjetas_regalo'")
    .first<{ valor: string }>();
  if (!f) return TARJETAS_INICIAL;
  try {
    return { ...TARJETAS_INICIAL, ...(JSON.parse(f.valor) as Partial<AjustesTarjetas>) };
  } catch (e) {
    console.error('tarjetas de regalo: ajustes ilegibles, quedan apagadas', e);
    return TARJETAS_INICIAL;
  }
}

/** Lo canjeado menos lo usado en pedidos que no se cancelaron. */
const SALDO = `(COALESCE((SELECT SUM(centavos) FROM tarjetas_regalo WHERE canjeada_por = ?1 AND estado = 'canjeada'), 0)
  - COALESCE((SELECT SUM(u.centavos) FROM pedidos_saldo_regalo u JOIN pedidos p ON p.id = u.pedido_id
      WHERE u.usuario_id = ?1 AND p.estado <> 'cancelado'), 0))`;

export async function saldoRegalo(db: D1Database, usuarioId: string): Promise<number> {
  const f = await db.prepare(`SELECT ${SALDO} AS saldo`).bind(usuarioId).first<{ saldo: number }>();
  return Math.max(0, Number(f?.saldo ?? 0));
}

/**
 * Aparta saldo de regalo para un pedido en UNA sentencia: si llegan dos pedidos a la vez, el
 * segundo ya ve el saldo rebajado. Devuelve true si quedó apartado.
 */
export async function apartarSaldo(
  db: D1Database,
  pedidoId: string,
  usuarioId: string,
  centavos: number,
): Promise<boolean> {
  if (centavos <= 0) return false;
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO pedidos_saldo_regalo (pedido_id, usuario_id, centavos)
       SELECT ?2, ?1, ?3 WHERE ${SALDO} >= ?3`,
    )
    .bind(usuarioId, pedidoId, centavos)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

const esLlaveReal = (k: string | undefined) =>
  Boolean(k && (k.startsWith('sk_live_') || k.startsWith('rk_live_')));

/** Código legible, sin letras que se confunden (como los de las tarjetas de regalo). */
function codigoNuevo(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = [...b].map((x) => letras[x % letras.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

tarjetasRegalo.get('/tarjetas-regalo', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const a = await leerTarjetas(db);
  return c.json({ ...a, saldo: await saldoRegalo(db, u.id) });
});

tarjetasRegalo.post('/tarjetas-regalo', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const a = await leerTarjetas(db);
  if (!a.activas)
    throw new ErrorDatos('Las tarjetas de regalo todavía no están disponibles.', undefined, 409);
  const d = await leerCuerpo(
    c,
    z.object({
      centavos: z.number().int().min(1).max(1_000_000),
      paraCorreo: z.email(),
      paraNombre: z.string().trim().max(80).default(''),
      mensaje: z.string().trim().max(300).default(''),
    }),
  );
  if (d.centavos < a.minimo || d.centavos > a.maximo)
    throw new ErrorDatos('Elige un monto dentro del rango permitido.', 'centavos');
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
  const id = nuevoId();
  const intento = await stripe.post<{ id: string; client_secret: string }>(
    '/payment_intents',
    {
      amount: d.centavos,
      currency: 'usd',
      customer: cliente,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      description: 'Divoox · Tarjeta de regalo',
      metadata: { tarjeta_regalo_id: id },
    },
    `tarjeta-regalo-${id}`,
  );
  await db
    .prepare(
      `INSERT INTO tarjetas_regalo (id, codigo, centavos, comprador_id, para_correo, para_nombre, mensaje, stripe_pago)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, codigoNuevo(), d.centavos, u.id, d.paraCorreo, d.paraNombre, d.mensaje, intento.id)
    .run();
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
  return c.json(
    {
      tarjetaId: id,
      clientSecret: intento.client_secret,
      clienteStripe: cliente,
      sesionCliente: sesion.client_secret,
      clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    },
    201,
  );
});

tarjetasRegalo.post('/tarjetas-regalo/canjear', limiteIntentos(10, 60_000), async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  if (!(await leerTarjetas(db)).activas)
    throw new ErrorDatos('Las tarjetas de regalo todavía no están disponibles.', undefined, 409);
  const d = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(4).max(20) }));
  const codigo = d.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formateado = `${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8, 12)}`;
  const r = await db
    .prepare(
      `UPDATE tarjetas_regalo SET estado = 'canjeada', canjeada_por = ?, canjeada_en = datetime('now')
        WHERE codigo = ? AND estado = 'pagada'`,
    )
    .bind(u.id, formateado)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese código no es válido o ya se usó.', 'codigo', 404);
  return c.json({ ok: true, saldo: await saldoRegalo(db, u.id) });
});

tarjetasRegalo.get('/admin/tarjetas-regalo', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerTarjetas(base(c)));
});

tarjetasRegalo.put('/admin/tarjetas-regalo', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      activas: z.boolean(),
      minimo: z.number().int().min(100).max(100_000),
      maximo: z.number().int().min(100).max(100_000),
    }),
  );
  if (d.activas && esLlaveReal(c.env.STRIPE_SECRET_KEY))
    throw new ErrorDatos(
      'Las tarjetas de regalo se encienden con dinero real cuando su cobro esté probado de punta a punta.',
      'activas',
      409,
    );
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('tarjetas_regalo', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});

/**
 * Aviso firmado de Stripe: la tarjeta pagada (monto e intento tienen que cuadrar) queda lista y le
 * llega el código a quien la recibe. Devuelve true si el aviso era de una tarjeta de regalo.
 */
export async function avisoTarjetaRegalo(
  env: Env,
  db: D1Database,
  tipo: string,
  obj: Record<string, unknown>,
): Promise<boolean> {
  const id = (obj.metadata as Record<string, string> | undefined)?.tarjeta_regalo_id;
  if (!id || tipo !== 'payment_intent.succeeded') return false;
  const t = await db.prepare('SELECT * FROM tarjetas_regalo WHERE id = ?').bind(id).first<{
    codigo: string;
    centavos: number;
    stripe_pago: string;
    estado: string;
    para_correo: string;
    para_nombre: string;
    mensaje: string;
    comprador_id: string;
  }>();
  if (!t) {
    console.error('tarjeta de regalo: aviso sin tarjeta conocida', id);
    return true;
  }
  if (t.stripe_pago !== obj.id || Number(obj.amount_received) !== Number(t.centavos)) {
    console.error('tarjeta de regalo: el aviso no cuadra', id, obj.amount_received, t.centavos);
    return true;
  }
  const r = await db
    .prepare("UPDATE tarjetas_regalo SET estado = 'pagada' WHERE id = ? AND estado = 'pendiente'")
    .bind(id)
    .run();
  if (!r.meta.changes) return true;
  const de = await db
    .prepare('SELECT nombre FROM usuarios WHERE id = ?')
    .bind(t.comprador_id)
    .first<{ nombre: string }>();
  const monto = `$${(Number(t.centavos) / 100).toFixed(2)}`;
  const quien = (de?.nombre ?? '').split(' ')[0] || 'Someone';
  await enviarCorreo(env, {
    de: 'avisos',
    para: t.para_correo,
    idioma: 'en',
    asunto: `${quien} sent you a ${monto} Divoox gift card`,
    texto: [
      `Hi${t.para_nombre ? ` ${t.para_nombre}` : ''}! ${quien} sent you a ${monto} Divoox gift card.`,
      t.mensaje ? `“${t.mensaje}”` : '',
      `Your code: ${t.codigo}`,
      'To use it, open the Divoox app, go to My account → Gift cards and enter the code. The balance is applied to your next orders.',
      `Hola: ${quien} te regaló una tarjeta de regalo de Divoox de ${monto}. Tu código: ${t.codigo}. Canjéalo en la app, en Mi cuenta → Tarjetas de regalo.`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  }).catch((e: unknown) => console.error('tarjeta de regalo: correo', e));
  return true;
}
