import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { crearStripe } from '../stripe';
import {
  esquemaConfigPais,
  guardarConfigPais,
  leerConfigPais,
  paisDeZona,
} from '../internacional/paises';
import {
  CUENTA_TUMBITE,
  cuentaPunto,
  exigirPositivo,
  libroDePedido,
  saldoLibro,
} from '../internacional/libro';
import { clienteNoPago, confirmarCobro, deudaCliente } from '../internacional/cobroDirecto';
import {
  anularCodigo,
  canjearCodigo,
  crearRecargaStripe,
  emitirCodigo,
  fondearPunto,
} from '../internacional/recargas';

/**
 * Fase 2 · modelo internacional: interruptores por país, puntos de venta de recargas, saldo
 * prepago del repartidor, cobro directo (cobré / no pagó) y la reconstrucción del libro.
 */
export const internacional = new Hono<{ Bindings: Env; Variables: Variables }>();

const PAIS = z.string().regex(/^[A-Z]{2}$/);

async function paisDelRepartidor(db: D1Database, repartidorId: string) {
  const d = await db
    .prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
    .bind(repartidorId)
    .first<{ zona_id: string }>();
  return paisDeZona(db, d?.zona_id ?? 'US-FL-MIAMI');
}

// ───────── Superadmin: países y puntos de venta ─────────
internacional.get('/admin/paises/:pais', async (c) => {
  exigir(c, 'admin');
  const pais = PAIS.parse(c.req.param('pais').toUpperCase());
  return c.json({ pais, config: await leerConfigPais(base(c), pais) });
});

internacional.put('/admin/paises/:pais', async (c) => {
  exigir(c, 'admin');
  const pais = PAIS.parse(c.req.param('pais').toUpperCase());
  const d = await leerCuerpo(c, esquemaConfigPais.partial());
  return c.json({ pais, config: await guardarConfigPais(base(c), pais, d) });
});

internacional.post('/admin/puntos-venta', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(2).max(80),
      pais: PAIS,
      usuarioId: z.string().min(1).nullable().default(null),
    }),
  );
  const db = base(c);
  const cfg = await leerConfigPais(db, d.pais);
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO puntos_venta (id, nombre, pais, moneda, usuario_id) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, d.nombre, d.pais, cfg.moneda, d.usuarioId)
    .run();
  return c.json(
    { punto: { id, nombre: d.nombre, pais: d.pais, moneda: cfg.moneda, usuarioId: d.usuarioId } },
    201,
  );
});

internacional.get('/admin/puntos-venta', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results } = await db
    .prepare(
      `SELECT p.id, p.nombre, p.pais, p.moneda, p.usuario_id, p.activo, p.creado_en,
              (SELECT COALESCE(SUM(monto),0) FROM libro l WHERE l.cuenta_id = 'punto:' || p.id AND l.bolsillo = 'punto') AS fondo,
              (SELECT COUNT(*) FROM codigos_recarga k WHERE k.punto_id = p.id AND k.estado = 'emitido') AS emitidos
         FROM puntos_venta p ORDER BY p.creado_en DESC`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    puntos: results.map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre),
      pais: String(r.pais),
      moneda: String(r.moneda),
      usuarioId: r.usuario_id ? String(r.usuario_id) : null,
      activo: Number(r.activo) === 1,
      fondo: Number(r.fondo),
      emitidos: Number(r.emitidos),
    })),
  });
});

internacional.post('/admin/puntos-venta/:id/fondo', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ monto: z.number().int().min(1), comprobante: z.string().trim().min(3).max(120) }),
  );
  const fondo = await fondearPunto(base(c), {
    puntoId: c.req.param('id'),
    monto: d.monto,
    comprobante: d.comprobante,
    autorId: u.id,
  });
  return c.json({ fondo });
});

internacional.get('/admin/libro/pedido/:id', async (c) => {
  exigir(c, 'admin');
  return c.json({ movimientos: await libroDePedido(base(c), c.req.param('id')) });
});

internacional.get('/admin/libro/comisiones/:pais', async (c) => {
  exigir(c, 'admin');
  const pais = PAIS.parse(c.req.param('pais').toUpperCase());
  const cfg = await leerConfigPais(base(c), pais);
  return c.json({
    pais,
    moneda: cfg.moneda,
    comisiones: await saldoLibro(base(c), CUENTA_TUMBITE, 'comisiones', pais, cfg.moneda),
  });
});

// ───────── Punto de venta (el usuario dueño del punto) ─────────
async function miPunto(db: D1Database, usuarioId: string) {
  const p = await db
    .prepare(
      'SELECT id, nombre, pais, moneda FROM puntos_venta WHERE usuario_id = ? AND activo = 1',
    )
    .bind(usuarioId)
    .first<{ id: string; nombre: string; pais: string; moneda: string }>();
  if (!p) throw new ErrorDatos('Tu cuenta no es de un punto de venta.', undefined, 403);
  return p;
}

internacional.get('/punto-venta', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const p = await miPunto(db, u.id);
  const { results } = await db
    .prepare(
      'SELECT id, monto, estado, creado_en, canjeado_en FROM codigos_recarga WHERE punto_id = ? ORDER BY creado_en DESC LIMIT 100',
    )
    .bind(p.id)
    .all<Record<string, unknown>>();
  return c.json({
    punto: p,
    fondo: await saldoLibro(db, cuentaPunto(p.id), 'punto', p.pais, p.moneda),
    codigos: results.map((r) => ({
      id: String(r.id),
      monto: Number(r.monto),
      estado: String(r.estado),
      creadoEn: String(r.creado_en),
      canjeadoEn: r.canjeado_en ? String(r.canjeado_en) : null,
    })),
  });
});

internacional.post('/punto-venta/codigos', async (c) => {
  const u = exigir(c);
  const { monto } = await leerCuerpo(c, z.object({ monto: z.number().int().min(1) }));
  const db = base(c);
  const p = await miPunto(db, u.id);
  return c.json(await emitirCodigo(db, { puntoId: p.id, monto, emitidoPor: u.id }), 201);
});

internacional.post('/punto-venta/codigos/:id/anular', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const p = await miPunto(db, u.id);
  await anularCodigo(db, { codigoId: c.req.param('id'), puntoId: p.id, autorId: u.id });
  return c.json({ ok: true });
});

// ───────── Repartidor: saldo prepago, recargas y cobro directo ─────────
internacional.get('/repartidor/saldo-prepago', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const { pais, moneda } = await paisDelRepartidor(db, u.id);
  const cfg = await leerConfigPais(db, pais);
  const { results } = await db
    .prepare(
      'SELECT monto, canal, estado, creado_en FROM recargas WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 20',
    )
    .bind(u.id)
    .all<Record<string, unknown>>();
  return c.json({
    pais,
    moneda,
    decimales: cfg.decimales,
    disponible: await saldoLibro(db, u.id, 'prepago', pais, moneda),
    reservado: await saldoLibro(db, u.id, 'reservado', pais, moneda),
    efectivoActivo: cfg.efectivoActivo,
    transferenciaActiva: cfg.transferenciaRepartidorActiva,
    recargasPuntoVenta: cfg.recargasPuntoVentaActivas,
    recargasStripe: cfg.recargasStripeActivas,
    recargas: results.map((r) => ({
      monto: Number(r.monto),
      canal: String(r.canal),
      estado: String(r.estado),
      creadoEn: String(r.creado_en),
    })),
  });
});

internacional.post('/repartidor/recargar', async (c) => {
  const u = exigir(c, 'repartidor');
  const { codigo } = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(6).max(20) }));
  const db = base(c);
  const { pais, moneda } = await paisDelRepartidor(db, u.id);
  const r = await canjearCodigo(db, { codigo, repartidorId: u.id, pais, moneda });
  return c.json({ ...r, disponible: await saldoLibro(db, u.id, 'prepago', pais, moneda) });
});

internacional.post('/repartidor/recargas/stripe', async (c) => {
  const u = exigir(c, 'repartidor');
  const { monto } = await leerCuerpo(c, z.object({ monto: z.number().int().min(1) }));
  exigirPositivo(monto, 'monto');
  const db = base(c);
  const { pais, moneda } = await paisDelRepartidor(db, u.id);
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  const recargaId = await crearRecargaStripe(db, { repartidorId: u.id, pais, moneda, monto });
  const intento = await stripe.post<{ id: string; client_secret: string }>(
    '/payment_intents',
    {
      amount: monto,
      currency: moneda.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      description: 'Tumbite · recarga de saldo para comisiones',
      metadata: { recarga_id: recargaId, usuario_id: u.id },
    },
    `recarga-${recargaId}`,
  );
  return c.json(
    {
      recargaId,
      clientSecret: intento.client_secret,
      clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    },
    201,
  );
});

internacional.post('/repartidor/pedidos/:id/cobre', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      montoRecibido: z.number().int().min(0),
      nota: z.string().trim().max(300).default(''),
    }),
  );
  const estado = await confirmarCobro(base(c), {
    pedidoId: c.req.param('id'),
    repartidorId: u.id,
    montoRecibido: d.montoRecibido,
    nota: d.nota,
  });
  return c.json({ cobroEstado: estado });
});

internacional.post('/repartidor/pedidos/:id/no-pago', async (c) => {
  const u = exigir(c, 'repartidor');
  const { motivo } = await leerCuerpo(c, z.object({ motivo: z.string().trim().min(2).max(300) }));
  await clienteNoPago(base(c), { pedidoId: c.req.param('id'), repartidorId: u.id, motivo });
  return c.json({ ok: true });
});

// ───────── Cliente ─────────
internacional.get('/mi-deuda', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const z = await db
    .prepare('SELECT zona_id FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ zona_id: string | null }>();
  const { pais, moneda } = await paisDeZona(db, z?.zona_id ?? 'US-FL-MIAMI');
  return c.json({ pais, moneda, deuda: await deudaCliente(db, u.id, pais, moneda) });
});
