import { Hono } from 'hono';
import { z } from 'zod';
import { CONFIG_DINERO_INICIAL, type ConfigDinero } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { crearStripe } from '../stripe';
import { pedirRetiro, procesarRetiro, retirosActivos } from '../retiros';
import { liquidacionesParaRevisar, liquidar, liquidarDesdeAviso } from '../liquidaciones';
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
  /** 0 = apagado. Lo fija Richard con el contador (Miami-Dade: 700 = 7 %). */
  impuestoPb: pb.optional().default(0),
});

/**
 * C-TOPES-PAIS: las tarifas de otro país, en SU moneda. Mismos campos y validación que la global,
 * con montos más altos (en pesos o bolívares 100 000 unidades se quedan cortas). La de EE. UU. no
 * cambia.
 */
const montoPais = z.number().int().min(0).max(1_000_000_000);
export const esquemaTarifasPais = esquemaConfigDinero.extend({
  envioBase: montoPais,
  envioPorKm: montoPais,
  envioMaximo: montoPais,
  servicioMinimo: montoPais,
  servicioMaximo: montoPais,
  pedidoMinimo: montoPais,
  cargoPedidoPequeno: montoPais,
  pagoMinimoRepartidor: montoPais,
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

// GET /datos/config-dinero vive en rutas/catalogo.ts (C-MONEDA-RECORRIDO): con ?restauranteId= da las
// tarifas del país de ese restaurante. Aquí no, porque tarifas.ts ya importa este archivo.

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

/**
 * C-COBRO-AL-ENTREGAR: las entregas cuyo cobro quedó en revisión o atrasado. Su saldo sigue anotado
 * pero bloqueado para retirar; la resolución es de un administrador (decisión de Richard).
 */
dinero.get('/admin/liquidaciones', async (c) => {
  exigir(c, 'admin');
  return c.json(await liquidacionesParaRevisar(base(c)));
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
 * Pantalla de dinero del superadmin (auditoría final, punto 7): resolver una liquidación en
 * revisión. «Reintentar» la vuelve a poner en la fila y la intenta ya; «confirmar» pregunta a
 * Stripe y, solo si el cobro figura capturado, lo anota (nunca se inventa un cobro).
 */
dinero.post('/admin/liquidaciones/:id/reintentar', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      "UPDATE liquidaciones SET estado = 'reintentar', proximo_en = NULL, actualizado_en = datetime('now') WHERE pedido_id = ? AND estado IN ('revision', 'reintentar', 'pendiente')",
    )
    .bind(id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa liquidación no existe o ya se cobró.', undefined, 404);
  const estado = (await liquidar(c.env, db, id)) ?? 'ocupada';
  return c.json({ estado });
});

dinero.post('/admin/liquidaciones/:id/confirmar', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare('SELECT pi, monto, estado FROM liquidaciones WHERE pedido_id = ?')
    .bind(id)
    .first<{ pi: string | null; monto: number; estado: string }>();
  if (!f) throw new ErrorDatos('Esa liquidación no existe o ya se cobró.', undefined, 404);
  if (f.estado === 'capturada') return c.json({ estado: 'capturada' });
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe || !f.pi)
    throw new ErrorDatos('Stripe no muestra ese cobro como capturado.', undefined, 409);
  const pi = await stripe
    .get<{ status?: string; amount_received?: number }>(`/payment_intents/${f.pi}`)
    .catch(() => null);
  if (pi?.status !== 'succeeded')
    throw new ErrorDatos('Stripe no muestra ese cobro como capturado.', undefined, 409);
  await liquidarDesdeAviso(db, id, Number(pi.amount_received ?? f.monto));
  return c.json({ estado: 'capturada' });
});

/** Abonos que el banco rechazó (payout.failed): la lista y el «ya lo resolví» del equipo. */
dinero.get('/admin/abonos-fallidos', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT a.id, a.usuario_id, a.stripe_cuenta, a.motivo, a.creado_en, a.resuelto_en, u.nombre, u.correo, u.rol
         FROM abonos_fallidos a LEFT JOIN usuarios u ON u.id = a.usuario_id
        ORDER BY a.resuelto_en IS NOT NULL, a.creado_en DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    abonos: results.map((r) => ({
      id: String(r.id),
      usuarioId: r.usuario_id ? String(r.usuario_id) : null,
      nombre: r.nombre ? String(r.nombre) : null,
      correo: r.correo ? String(r.correo) : null,
      rol: r.rol ? String(r.rol) : null,
      stripeCuenta: String(r.stripe_cuenta),
      motivo: String(r.motivo ?? ''),
      creadoEn: String(r.creado_en),
      resueltoEn: r.resuelto_en ? String(r.resuelto_en) : null,
    })),
  });
});

dinero.patch('/admin/abonos-fallidos/:id', async (c) => {
  exigir(c, 'admin');
  const { resuelto } = await leerCuerpo(c, z.object({ resuelto: z.boolean() }));
  const r = await base(c)
    .prepare(
      "UPDATE abonos_fallidos SET resuelto_en = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?",
    )
    .bind(resuelto ? 1 : 0, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese abono fallido no existe.', undefined, 404);
  return c.json({ ok: true });
});
