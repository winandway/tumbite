import { Hono } from 'hono';
import { z } from 'zod';
import { type Plan, calcularPedido, distanciaKm } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { crearStripe, firmaValida } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';
import { leerConfigDinero } from './dinero';
import { regalosDisponibles } from './regalos';
import { ZONA_INICIAL } from './zonas';
import { anotar } from '../historial';
import { avisoPedidoAlRestaurante, reciboDePedido } from '../avisos';
import { AVISOS, notificar } from '../notificaciones';

export const pedidos = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaNuevoPedido = z.object({
  restauranteId: z.string().min(1),
  lineas: z
    .array(z.object({ platoId: z.string().min(1), cantidad: z.number().int().min(1).max(99) }))
    .min(1, { error: 'Tu carrito está vacío.' })
    .max(50),
  propinaCentavos: z.number().int().min(0).max(50_000),
  direccion: z.string().trim().min(5, { error: 'Escribe la dirección de entrega.' }).max(200),
  notas: z.string().trim().max(300).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  regalo: z.enum(['cumpleanos', 'sellos', 'vuelve']).nullable().default(null),
});

export type FilaPedido = Record<string, unknown>;

export function aPedido(f: FilaPedido) {
  return {
    id: String(f.id),
    estado: String(f.estado),
    restauranteId: String(f.restaurante_id),
    restauranteNombre: f.restaurante_nombre == null ? undefined : String(f.restaurante_nombre),
    lineas: JSON.parse(String(f.lineas_json)) as {
      platoId: string;
      nombreEs: string;
      nombreEn: string;
      precioCentavos: number;
      cantidad: number;
    }[],
    subtotal: Number(f.subtotal),
    envio: Number(f.envio),
    servicio: Number(f.servicio),
    cargoPedidoPequeno: Number(f.cargo_pequeno),
    propina: Number(f.propina),
    regalo: Number(f.regalo),
    total: Number(f.total),
    direccion: String(f.direccion),
    notas: String(f.notas ?? ''),
    lat: f.lat == null ? null : Number(f.lat),
    lng: f.lng == null ? null : Number(f.lng),
    tiempoPrepMin: f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
    creadoEn: String(f.creado_en),
    pagadoEn: (f.pagado_en as string | null) ?? null,
    aceptadoEn: (f.aceptado_en as string | null) ?? null,
    listoEn: (f.listo_en as string | null) ?? null,
    recogidoEn: (f.recogido_en as string | null) ?? null,
    entregadoEn: (f.entregado_en as string | null) ?? null,
    repartidorId: (f.repartidor_id as string | null) ?? null,
  };
}

/**
 * Crear un pedido. El precio SIEMPRE lo calcula el servidor con los precios de la base:
 * lo que mande el teléfono solo dice qué platos y cuántos.
 */
pedidos.post('/pedidos', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(c, esquemaNuevoPedido);
  const db = base(c);
  const rest = await db
    .prepare("SELECT * FROM restaurantes WHERE id = ? AND estado = 'aprobado'")
    .bind(d.restauranteId)
    .first<Record<string, unknown>>();
  if (!rest) throw new ErrorDatos('Este restaurante no está disponible.', undefined, 404);
  if (Number(rest.abierto) !== 1)
    throw new ErrorDatos('El restaurante acaba de cerrar. Intenta más tarde.', undefined, 409);

  const ids = [...new Set(d.lineas.map((l) => l.platoId))];
  const { results: platos } = await db
    .prepare(
      `SELECT * FROM platos WHERE restaurante_id = ? AND eliminado = 0 AND id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(rest.id, ...ids)
    .all<Record<string, unknown>>();
  const porId = new Map(platos.map((p) => [String(p.id), p]));
  const lineas = d.lineas.map((l) => {
    const p = porId.get(l.platoId);
    if (!p || Number(p.disponible) !== 1)
      throw new ErrorDatos(
        'Uno de los platos ya no está disponible. Revisa tu carrito.',
        'lineas',
        409,
      );
    return {
      platoId: l.platoId,
      nombreEs: String(p.nombre_es),
      nombreEn: String(p.nombre_en),
      precioCentavos: Number(p.precio_centavos),
      cantidad: l.cantidad,
    };
  });

  const km =
    d.lat != null && d.lng != null && rest.lat != null && rest.lng != null
      ? distanciaKm({ lat: d.lat, lng: d.lng }, { lat: Number(rest.lat), lng: Number(rest.lng) })
      : null;
  if (km != null && km > 25)
    throw new ErrorDatos(
      'Esa dirección está fuera del área de entrega de este restaurante.',
      'direccion',
      409,
    );
  const plan = rest.plan as Plan;
  const config = await leerConfigDinero(db);
  let regalo = 0;
  if (d.regalo) {
    const subtotal = lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
    const precios = new Map(lineas.map((l) => [l.platoId, l.precioCentavos]));
    const disponible = (
      await regalosDisponibles(db, String(rest.id), u.id, subtotal, precios)
    ).find((r) => r.tipo === d.regalo);
    if (!disponible) throw new ErrorDatos('Ese regalo ya no está disponible.', 'regalo', 409);
    regalo = disponible.valorCentavos;
  }
  const desglose = calcularPedido({
    lineas,
    plan,
    propina: d.propinaCentavos,
    distanciaKm: km,
    config,
    regalo,
  });

  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
        pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, lat, lng, distancia_km, tiempo_prep_min, regalo, regalo_tipo, zona_id)
       VALUES (?, ?, ?, 'pago_pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      u.id,
      rest.id,
      JSON.stringify(lineas),
      desglose.subtotal,
      desglose.envio,
      desglose.servicio,
      desglose.cargoPedidoPequeno,
      desglose.propina,
      desglose.totalCliente,
      desglose.comisionRestaurante,
      desglose.pagoRestaurante,
      desglose.pagoRepartidor,
      desglose.complementoRepartidor,
      desglose.gananciaPlataforma,
      plan,
      d.direccion,
      d.notas,
      d.lat,
      d.lng,
      km,
      Number(rest.tiempo_prep_min),
      regalo,
      d.regalo,
      String(rest.zona_id ?? ZONA_INICIAL),
    )
    .run();
  await anotar(db, id, 'pago_pendiente', u.id);

  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) {
    // Honesto: sin llaves de Stripe no se cobra. El pedido queda sin pagar y no le llega a nadie.
    throw new ErrorDatos(
      'Los pagos todavía no están activados. Te avisamos muy pronto.',
      undefined,
      422,
    );
  }
  // Pago dentro de la app (sin salto): un PaymentIntent del cliente de Stripe de esta persona,
  // y una sesión de cliente para que la hoja de pago muestre y guarde sus tarjetas.
  const fila = await db
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  let clienteStripe = fila?.stripe_cliente ?? null;
  if (!clienteStripe) {
    const cliente = await stripe.post<{ id: string }>(
      '/customers',
      { email: u.correo, name: u.nombre, metadata: { usuario_id: u.id } },
      `cliente-${u.id}`,
    );
    clienteStripe = cliente.id;
    await db
      .prepare('UPDATE usuarios SET stripe_cliente = ? WHERE id = ?')
      .bind(clienteStripe, u.id)
      .run();
  }
  const intento = await stripe.post<{ id: string; client_secret: string }>(
    '/payment_intents',
    {
      amount: desglose.totalCliente,
      currency: 'usd',
      customer: clienteStripe,
      automatic_payment_methods: { enabled: true },
      // Obligatorio cuando la sesión del cliente permite guardar la tarjeta: sin esto, Stripe
      // se niega a pintar el formulario (y lo hace en silencio). Candado C-PAGO-FORMULARIO.
      setup_future_usage: 'off_session',
      description: `Tumbite · ${String(rest.nombre)}`,
      metadata: { pedido_id: id },
    },
    `pedido-${id}`,
  );
  const funciones = {
    payment_method_save: 'enabled',
    payment_method_redisplay: 'enabled',
    payment_method_remove: 'enabled',
  };
  const sesionCliente = await stripe.post<{ client_secret: string }>('/customer_sessions', {
    customer: clienteStripe,
    components: {
      payment_element: { enabled: true, features: funciones },
      mobile_payment_element: { enabled: true, features: funciones },
    },
  });
  await db.prepare('UPDATE pedidos SET stripe_sesion = ? WHERE id = ?').bind(intento.id, id).run();
  return c.json(
    {
      pedidoId: id,
      clientSecret: intento.client_secret,
      sesionCliente: sesionCliente.client_secret,
      clienteStripe,
      // La clave pública viaja con el cobro: la app no depende de otra consulta (que puede venir
      // vieja de la caché) para pintar el formulario de tarjeta.
      clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
      desglose,
    },
    201,
  );
});

/**
 * Aviso de Stripe. Sin firma válida no se toca nada. Cada aviso se procesa una sola vez.
 */
pedidos.post('/stripe/aviso', async (c) => {
  const cuerpo = await c.req.text();
  const secreto = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto || !(await firmaValida(cuerpo, c.req.header('stripe-signature'), secreto))) {
    console.error('aviso de stripe con firma inválida o sin secreto configurado');
    return c.json({ error: 'firma inválida' }, 400);
  }
  const evento = JSON.parse(cuerpo) as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  const db = base(c);
  const nuevo = await db
    .prepare('INSERT OR IGNORE INTO avisos_stripe (id, tipo) VALUES (?, ?)')
    .bind(evento.id, evento.type)
    .run();
  if (!nuevo.meta.changes) return c.json({ ok: true, repetido: true });

  const obj = evento.data.object;
  if (evento.type === 'checkout.session.completed' && obj.payment_status === 'paid') {
    const pedidoId = (obj.metadata as Record<string, string> | undefined)?.pedido_id;
    const pedido = pedidoId
      ? await db
          .prepare('SELECT total, stripe_sesion, estado FROM pedidos WHERE id = ?')
          .bind(pedidoId)
          .first<{ total: number; stripe_sesion: string; estado: string }>()
      : null;
    if (!pedido) {
      console.error('aviso de pago sin pedido conocido', pedidoId);
    } else if (
      pedido.stripe_sesion !== obj.id ||
      Number(obj.amount_total) !== Number(pedido.total)
    ) {
      console.error(
        'aviso de pago que no cuadra con el pedido',
        pedidoId,
        obj.amount_total,
        pedido.total,
      );
    } else if (pedido.estado === 'pago_pendiente') {
      await db
        .prepare(
          "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = ? WHERE id = ?",
        )
        .bind(String(obj.payment_intent ?? ''), pedidoId)
        .run();
      await anotar(db, pedidoId as string, 'pagado', null);
      await correosDePedidoPagado(c.env, db, pedidoId as string);
    }
  }
  if (evento.type === 'payment_intent.succeeded') {
    const pedidoId = (obj.metadata as Record<string, string> | undefined)?.pedido_id;
    const pedido = pedidoId
      ? await db
          .prepare('SELECT total, stripe_sesion, estado FROM pedidos WHERE id = ?')
          .bind(pedidoId)
          .first<{ total: number; stripe_sesion: string; estado: string }>()
      : null;
    if (!pedido) {
      if (pedidoId) console.error('aviso de pago sin pedido conocido', pedidoId);
    } else if (
      pedido.stripe_sesion !== obj.id ||
      Number(obj.amount_received) !== Number(pedido.total)
    ) {
      console.error(
        'aviso de pago que no cuadra con el pedido',
        pedidoId,
        obj.amount_received,
        pedido.total,
      );
    } else if (pedido.estado === 'pago_pendiente') {
      await db
        .prepare(
          "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = ? WHERE id = ?",
        )
        .bind(String(obj.id), pedidoId)
        .run();
      await anotar(db, pedidoId as string, 'pagado', null);
      await correosDePedidoPagado(c.env, db, pedidoId as string);
    }
  }
  if (evento.type === 'account.updated') {
    const activo = obj.payouts_enabled === true && obj.charges_enabled !== false ? 1 : 0;
    await db
      .prepare('UPDATE cuentas_stripe SET pagos_activos = ? WHERE stripe_cuenta = ?')
      .bind(activo, String(obj.id))
      .run();
  }
  return c.json({ ok: true });
});

/** Recibo al cliente y aviso al restaurante. Si el correo falla, el pedido sigue igual. */
async function correosDePedidoPagado(env: Env, db: D1Database, pedidoId: string) {
  const f = await db
    .prepare(
      `SELECT p.id, p.lineas_json, p.subtotal, p.envio, p.servicio, p.propina, p.regalo, p.total, p.direccion, p.notas, p.pago_restaurante,
        c.correo AS cliente_correo, c.nombre AS cliente_nombre, c.idioma AS cliente_idioma,
        r.nombre AS restaurante, d.id AS dueno_id, d.correo AS dueno_correo, d.idioma AS dueno_idioma
       FROM pedidos p JOIN usuarios c ON c.id = p.cliente_id
       JOIN restaurantes r ON r.id = p.restaurante_id JOIN usuarios d ON d.id = r.dueno_id WHERE p.id = ?`,
    )
    .bind(pedidoId)
    .first<Record<string, unknown>>();
  if (!f) return;
  const lineas = JSON.parse(String(f.lineas_json)) as {
    nombreEs: string;
    nombreEn: string;
    precioCentavos: number;
    cantidad: number;
  }[];
  await reciboDePedido(env, {
    correo: String(f.cliente_correo),
    nombre: String(f.cliente_nombre),
    idioma: f.cliente_idioma === 'en' ? 'en' : 'es',
    pedidoId,
    restaurante: String(f.restaurante),
    lineas,
    subtotal: Number(f.subtotal),
    envio: Number(f.envio),
    servicio: Number(f.servicio),
    propina: Number(f.propina),
    regalo: Number(f.regalo),
    total: Number(f.total),
    direccion: String(f.direccion),
  });
  await avisoPedidoAlRestaurante(env, {
    correo: String(f.dueno_correo),
    idioma: f.dueno_idioma === 'en' ? 'en' : 'es',
    pedidoId,
    restaurante: String(f.restaurante),
    lineas,
    pagoRestaurante: Number(f.pago_restaurante),
    notas: String(f.notas ?? ''),
  });
  await notificar(env, db, String(f.dueno_id), {
    ...AVISOS.pedidoNuevo(
      f.dueno_idioma === 'en' ? 'en' : 'es',
      pedidoId.slice(0, 8).toUpperCase(),
    ),
    datos: { pedidoId },
  });
}

pedidos.get('/mis-pedidos', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      `SELECT p.*, r.nombre AS restaurante_nombre FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE p.cliente_id = ? AND p.estado != 'pago_pendiente' ORDER BY p.creado_en DESC LIMIT 50`,
    )
    .bind(u.id)
    .all<FilaPedido>();
  return c.json({ pedidos: results.map(aPedido) });
});

pedidos.get('/pedidos/:id', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      'SELECT p.*, r.nombre AS restaurante_nombre, r.dueno_id, r.lat AS rest_lat, r.lng AS rest_lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?',
    )
    .bind(c.req.param('id'))
    .first<FilaPedido>();
  const puede =
    f &&
    (u.rol === 'admin' || f.cliente_id === u.id || f.dueno_id === u.id || f.repartidor_id === u.id);
  if (!f || !puede) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  return c.json({ pedido: aPedido(f) });
});

// ======================= Tarjetas guardadas (Mi cuenta) =======================

type MetodoStripe = {
  id: string;
  customer: string | null;
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
};

/** Las tarjetas que la persona guardó en Stripe (Tumbite nunca ve el número completo). */
pedidos.get('/mis-tarjetas', async (c) => {
  const u = exigir(c, 'cliente');
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  const fila = await base(c)
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  if (!stripe || !fila?.stripe_cliente) return c.json({ tarjetas: [] });
  const r = await stripe.get<{ data: MetodoStripe[] }>(
    `/customers/${fila.stripe_cliente}/payment_methods`,
    { type: 'card', limit: 20 },
  );
  return c.json({
    tarjetas: r.data
      .filter((m) => m.card)
      .map((m) => ({
        id: m.id,
        marca: m.card?.brand ?? '',
        ultimos4: m.card?.last4 ?? '',
        vence: `${String(m.card?.exp_month ?? '').padStart(2, '0')}/${String(m.card?.exp_year ?? '').slice(-2)}`,
      })),
  });
});

/** Quitar una tarjeta guardada: solo si es de esta persona. */
pedidos.post('/mis-tarjetas/:id/quitar', async (c) => {
  const u = exigir(c, 'cliente');
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Los pagos no están disponibles ahora.', undefined, 503);
  const id = c.req.param('id');
  if (!/^pm_[A-Za-z0-9]+$/.test(id)) throw new ErrorDatos('Esa tarjeta no existe.', undefined, 404);
  const fila = await base(c)
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  const metodo = await stripe.get<MetodoStripe>(`/payment_methods/${id}`).catch(() => null);
  if (!metodo || !fila?.stripe_cliente || metodo.customer !== fila.stripe_cliente)
    throw new ErrorDatos('Esa tarjeta no existe.', undefined, 404);
  await stripe.post(`/payment_methods/${id}/detach`, {});
  return c.json({ ok: true });
});
