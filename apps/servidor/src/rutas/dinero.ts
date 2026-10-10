import { Hono } from 'hono';
import { z } from 'zod';
import { CONFIG_DINERO_INICIAL, type ConfigDinero, PLANES } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { crearStripe } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';

export const dinero = new Hono<{ Bindings: Env; Variables: Variables }>();

const centavos = z.number().int().min(0).max(100_000);
const pb = z.number().int().min(0).max(5000);
export const esquemaConfigDinero = z.object({
  comisionPb: z.object({ inicial: pb, crece: pb, elite: pb }),
  envioBase: centavos,
  envioKmIncluidos: z.number().min(0).max(50),
  envioPorKm: centavos,
  envioMaximo: centavos,
  servicioPb: pb,
  servicioMinimo: centavos,
  servicioMaximo: centavos,
  pedidoMinimo: centavos,
  cargoPedidoPequeno: centavos,
  pagoMinimoRepartidor: centavos,
});

export async function leerConfigDinero(db: D1Database): Promise<ConfigDinero> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'dinero'")
    .first<{ valor: string }>();
  if (!f) return CONFIG_DINERO_INICIAL;
  const r = esquemaConfigDinero.safeParse(JSON.parse(f.valor));
  if (!r.success) {
    console.error('config de dinero dañada: se usan los valores iniciales', r.error.issues);
    return CONFIG_DINERO_INICIAL;
  }
  return r.data;
}

dinero.get('/config-dinero', async (c) =>
  c.json({ config: await leerConfigDinero(base(c)), planes: PLANES }),
);

dinero.put('/admin/config-dinero', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaConfigDinero);
  if (d.servicioMinimo > d.servicioMaximo || d.envioBase > d.envioMaximo) {
    throw new ErrorDatos(
      'Revisa los mínimos y máximos: el mínimo no puede ser mayor que el máximo.',
    );
  }
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('dinero', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json({ config: d });
});

// ---------- Billetera (restaurantes y repartidores independientes) ----------

async function saldo(db: D1Database, usuarioId: string): Promise<number> {
  const f = await db
    .prepare('SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

dinero.get('/billetera', async (c) => {
  const u = exigir(c, 'restaurante', 'repartidor');
  const db = base(c);
  const { results } = await db
    .prepare(
      'SELECT id, pedido_id AS pedidoId, monto, concepto, creado_en AS fecha FROM movimientos WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 100',
    )
    .bind(u.id)
    .all();
  const cuenta = await db
    .prepare('SELECT pagos_activos FROM cuentas_stripe WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ pagos_activos: number }>();
  return c.json({
    saldo: await saldo(db, u.id),
    movimientos: results,
    cuentaConectada: Boolean(cuenta),
    pagosActivos: cuenta?.pagos_activos === 1,
  });
});

function exigirStripe(c: Ctx) {
  const s = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!s)
    throw new ErrorDatos(
      'Los pagos todavía no están activados. Te avisamos muy pronto.',
      undefined,
      422,
    );
  return s;
}

/** Abre (o continúa) el alta en Stripe. Los datos bancarios se escriben en la página de Stripe, nunca aquí. */
dinero.post('/billetera/conectar', async (c) => {
  const u = exigir(c, 'restaurante', 'repartidor');
  const stripe = exigirStripe(c);
  const db = base(c);
  let fila = await db
    .prepare('SELECT stripe_cuenta FROM cuentas_stripe WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ stripe_cuenta: string }>();
  if (!fila) {
    const cuenta = await stripe.post<{ id: string }>(
      '/accounts',
      {
        type: 'express',
        country: 'US',
        email: u.correo,
        capabilities: { transfers: { requested: true } },
        business_type: u.rol === 'repartidor' ? 'individual' : undefined,
        metadata: { usuario_id: u.id, rol: u.rol },
      },
      `cuenta-${u.id}`,
    );
    await db
      .prepare('INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta) VALUES (?, ?)')
      .bind(u.id, cuenta.id)
      .run();
    fila = { stripe_cuenta: cuenta.id };
  }
  const sitio = c.env.SITIO_URL ?? 'https://tumbite.com';
  const enlace = await stripe.post<{ url: string }>('/account_links', {
    account: fila.stripe_cuenta,
    type: 'account_onboarding',
    refresh_url: `${sitio}/billetera/conectar`,
    return_url: `${sitio}/billetera/lista`,
  });
  return c.json({ url: enlace.url });
});

/** Retirar el saldo a la cuenta de Stripe (de ahí Stripe lo manda al banco). */
dinero.post('/billetera/retirar', async (c) => {
  const u = exigir(c, 'restaurante', 'repartidor');
  const { montoCentavos } = await leerCuerpo(
    c,
    z.object({
      montoCentavos: z.number().int().min(100, { error: 'El retiro mínimo es de 1 dólar.' }),
    }),
  );
  const stripe = exigirStripe(c);
  const db = base(c);
  const cuenta = await db
    .prepare('SELECT stripe_cuenta, pagos_activos FROM cuentas_stripe WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ stripe_cuenta: string; pagos_activos: number }>();
  if (!cuenta || cuenta.pagos_activos !== 1)
    throw new ErrorDatos('Primero conecta tu cuenta bancaria en «Billetera».', undefined, 409);
  const disponible = await saldo(db, u.id);
  if (montoCentavos > disponible)
    throw new ErrorDatos('No tienes saldo suficiente para ese retiro.', 'montoCentavos', 409);
  const id = nuevoId();
  // Primero se anota el retiro (el saldo baja ya, así no se puede retirar dos veces); si Stripe falla, se devuelve.
  await db
    .prepare("INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES (?, ?, ?, 'retiro')")
    .bind(id, u.id, -montoCentavos)
    .run();
  try {
    const t = await stripe.post<{ id: string }>(
      '/transfers',
      {
        amount: montoCentavos,
        currency: 'usd',
        destination: cuenta.stripe_cuenta,
        metadata: { movimiento: id },
      },
      `retiro-${id}`,
    );
    await db.prepare('UPDATE movimientos SET referencia = ? WHERE id = ?').bind(t.id, id).run();
  } catch (e) {
    // El libro no se borra: se anota la devolución para que el saldo vuelva a cuadrar.
    await db
      .prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES (?, ?, ?, 'ajuste', ?)",
      )
      .bind(nuevoId(), u.id, montoCentavos, `retiro-fallido-${id}`)
      .run();
    throw e;
  }
  return c.json({ ok: true, saldo: await saldo(db, u.id) });
});
