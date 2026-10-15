import { Hono } from 'hono';
import { z } from 'zod';
import { CONFIG_DINERO_INICIAL, type ConfigDinero, PLANES } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { crearStripe } from '../stripe';
import { pedirRetiro, procesarRetiro, retirosActivos } from '../retiros';
import { nuevoId } from '../cripto';
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
    // Fase 0: la app puede apagar el botón y mostrar los retiros que siguen en proceso.
    retirosActivos: await retirosActivos(c.env, db),
    retirosEnProceso: (
      await db
        .prepare(
          "SELECT id, monto_centavos AS monto, estado, creado_en AS fecha FROM retiros WHERE usuario_id = ? AND estado IN ('pendiente', 'enviando', 'reintentar', 'revision') ORDER BY creado_en DESC LIMIT 10",
        )
        .bind(u.id)
        .all()
    ).results,
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
    refresh_url: `${sitio}/wallet/connect`,
    return_url: `${sitio}/wallet/ready`,
  });
  return c.json({ url: enlace.url });
});

/**
 * Retirar el saldo a la cuenta de Stripe (de ahí Stripe lo manda al banco). Fase 0 (15 oct 2026):
 * un resultado incierto de Stripe NUNCA devuelve el saldo (antes sí, y se podía pagar dos veces).
 * Ver retiros.ts y el candado C-RETIROS-SEGUROS.
 */
dinero.post('/billetera/retirar', async (c) => {
  const u = exigir(c, 'restaurante', 'repartidor');
  const { montoCentavos } = await leerCuerpo(
    c,
    z.object({
      montoCentavos: z.number().int().min(100, { error: 'El retiro mínimo es de 1 dólar.' }),
    }),
  );
  const db = base(c);
  if (!(await retirosActivos(c.env, db)))
    throw new ErrorDatos(
      'Los retiros están en pausa por mantenimiento. Tu saldo está a salvo; vuelve a intentarlo más tarde.',
      undefined,
      409,
    );
  const stripe = exigirStripe(c);
  const cuenta = await db
    .prepare('SELECT stripe_cuenta, pagos_activos FROM cuentas_stripe WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ stripe_cuenta: string; pagos_activos: number }>();
  if (!cuenta || cuenta.pagos_activos !== 1)
    throw new ErrorDatos('Primero conecta tu cuenta bancaria en «Billetera».', undefined, 409);
  // Revisar el saldo, anotar el retiro y descontarlo en UNA sentencia: si llegan dos retiros a la
  // vez, el segundo ya ve el saldo rebajado y no pasa. Así nunca se retira más de lo que hay.
  const id = await pedirRetiro(db, u.id, cuenta.stripe_cuenta, montoCentavos);
  if (!id)
    throw new ErrorDatos('No tienes saldo suficiente para ese retiro.', 'montoCentavos', 409);
  const resultado = await procesarRetiro(db, stripe, id);
  if (resultado === 'fallido')
    // El detalle técnico de Stripe queda en retiros.ultimo_error para soporte.
    throw new ErrorDatos(
      'Stripe no aceptó el retiro. El dinero volvió a tu saldo.',
      'montoCentavos',
      422,
    );
  return c.json({
    ok: true,
    saldo: await saldo(db, u.id),
    retiro: { id, estado: resultado === 'confirmado' ? 'enviado' : 'en_proceso' },
  });
});

/** Bandera de seguridad de los retiros (Fase 0). La variable RETIROS_APAGADOS=1 manda sobre ella. */
dinero.get('/admin/retiros', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results } = await db
    .prepare(
      'SELECT estado, COUNT(*) AS n, COALESCE(SUM(monto_centavos), 0) AS monto FROM retiros GROUP BY estado',
    )
    .all<{ estado: string; n: number; monto: number }>();
  const conc = await db
    .prepare("SELECT valor FROM config WHERE clave = 'retiros_conciliacion'")
    .first<{ valor: string }>();
  return c.json({
    activos: await retirosActivos(c.env, db),
    apagadosPorVariable: c.env.RETIROS_APAGADOS === '1',
    porEstado: results,
    conciliacion: conc ? (JSON.parse(conc.valor) as unknown) : null,
  });
});

dinero.put('/admin/retiros', async (c) => {
  exigir(c, 'admin');
  const { activos } = await leerCuerpo(c, z.object({ activos: z.boolean() }));
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('retiros_activos', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(activos ? '1' : '0')
    .run();
  return c.json({ activos: await retirosActivos(c.env, base(c)) });
});

/**
 * Diagnóstico S7 (Fase 0): comprueba EN LA BASE REAL que un batch que falla a la mitad se deshace
 * entero. Solo administradores; usa una tabla temporal con nombre aleatorio y la borra al terminar.
 */
dinero.post('/admin/diagnostico/lote-atomico', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const tabla = `zz_diag_${nuevoId()
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 16)
    .toLowerCase()}`;
  await db.prepare(`CREATE TABLE ${tabla} (id INTEGER PRIMARY KEY, v TEXT NOT NULL)`).run();
  let loteFallo = false;
  try {
    await db.batch([
      db.prepare(`INSERT INTO ${tabla} (id, v) VALUES (1, 'primera')`),
      db.prepare(`INSERT INTO ${tabla} (id, v) VALUES (1, 'repetida: debe fallar')`),
    ]);
  } catch {
    loteFallo = true;
  }
  const quedaron = await db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).first<{ n: number }>();
  await db.prepare(`DROP TABLE ${tabla}`).run();
  const filas = Number(quedaron?.n ?? -1);
  return c.json({ loteFallo, filasQuedaron: filas, atomico: loteFallo && filas === 0 });
});
