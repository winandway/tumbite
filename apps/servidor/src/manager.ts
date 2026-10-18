import { enviarCorreo } from './correo';
import type { Env } from './env';
import { anotar } from './historial';
import { notificar } from './notificaciones';
import { crearStripe, type Stripe } from './stripe';
import { ErrorDatos } from './validar';
import { soltarPedido } from './rutas/operacion';
import { aplicarAjuste } from './rutas/pedidos';

/**
 * El Manager de Tumbite, fase de reglas (sin IA y sin costo): vigila que ningún pedido pagado
 * se quede olvidado. Corre en el reloj externo y también cada vez que el cliente mira su
 * seguimiento (la app pregunta cada pocos segundos), así no depende de que el reloj sea puntual.
 * Candado C-MANAGER-1.
 */
export const REGLAS = {
  /** Minutos sin que el restaurante acepte: primer recordatorio. */
  recordatorio1: 1,
  /** Segundo recordatorio. */
  recordatorio2: 3,
  /** Cancelación con devolución automática del dinero. */
  cancelar: 6,
  /** Minutos sin señal del repartidor (con pedido asignado y sin haber llegado): se reasigna. */
  repartidorPerdido: 10,
  /** Minutos que tiene el cliente para decidir sobre un plato agotado; después se quita solo. */
  ajusteSinRespuesta: 5,
  /** Minutos desde que el restaurante aceptó sin que ningún repartidor tome el pedido. */
  sinRepartidor: 5,
} as const;

/** Anota un evento del Manager; devuelve false si ya estaba (así el aviso no se repite). */
export async function anotarEvento(
  db: D1Database,
  pedidoId: string,
  evento: string,
  detalle = '',
): Promise<boolean> {
  const r = await db
    .prepare('INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, ?, ?)')
    .bind(pedidoId, evento, detalle)
    .run();
  return Boolean(r.meta.changes);
}

/**
 * La única forma de cancelar un pedido cobrado: primero lo aparta (nadie más lo puede aceptar),
 * después devuelve el dinero en Stripe y, si Stripe falla, lo deja como estaba y avisa del error.
 * Nunca queda un pedido cancelado con el dinero sin devolver.
 */
/**
 * ¿Stripe ya devolvió el dinero de este pago? Se consulta tras un error (p. ej. respuesta perdida).
 * Autorizado: el cobro quedó anulado. Capturado: existe un reembolso que no falló. Si la consulta
 * misma falla, se responde «no»: el pedido vuelve a su estado y reintentar es seguro (misma clave).
 */
async function devolucionHecha(
  stripe: Stripe,
  pi: string,
  soloAutorizado: boolean,
): Promise<boolean> {
  try {
    if (soloAutorizado) {
      const r = await stripe.get<{ status?: string }>(`/payment_intents/${pi}`);
      return r.status === 'canceled';
    }
    const r = await stripe.get<{ data?: { status?: string }[] }>('/refunds', {
      payment_intent: pi,
      limit: 10,
    });
    return (r.data ?? []).some((x) => x.status !== 'failed' && x.status !== 'canceled');
  } catch {
    return false;
  }
}

export async function cancelarConReembolso(
  env: Env,
  db: D1Database,
  pedidoId: string,
  p: { desde: string[]; actorId: string | null; restauranteId?: string; clienteId?: string },
): Promise<boolean> {
  const filtros = [
    p.restauranteId ? ' AND restaurante_id = ?' : '',
    p.clienteId ? ' AND cliente_id = ?' : '',
  ].join('');
  const extra = [p.restauranteId, p.clienteId].filter((x): x is string => Boolean(x));
  const antes = await db
    .prepare(
      `SELECT estado, stripe_pago, stripe_sesion FROM pedidos WHERE id = ?${filtros} AND estado IN (${p.desde.map(() => '?').join(',')})`,
    )
    .bind(pedidoId, ...extra, ...p.desde)
    .first<{ estado: string; stripe_pago: string | null; stripe_sesion: string | null }>();
  if (!antes) return false;
  const apartado = await db
    .prepare(
      "UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now') WHERE id = ? AND estado = ?",
    )
    .bind(pedidoId, antes.estado)
    .run();
  if (!apartado.meta.changes) return false;
  // C-FALLOS-CRITICOS 2: antes del aviso de Stripe el pago vive en stripe_sesion (el PaymentIntent
  // recién creado). También se anula, para que la tarjeta no quede retenida por un pedido cancelado.
  const intento =
    antes.stripe_pago ||
    (antes.estado === 'pago_pendiente' && env.STRIPE_SECRET_KEY ? antes.stripe_sesion : null);
  if (intento) {
    const stripe = crearStripe(env.STRIPE_SECRET_KEY);
    const cobro = await db
      .prepare('SELECT capturado_en FROM cobros WHERE pedido_id = ?')
      .bind(pedidoId)
      .first<{ capturado_en: string | null }>();
    const soloAutorizado = !antes.stripe_pago || Boolean(cobro && !cobro.capturado_en);
    try {
      if (!stripe) throw new Error('Stripe no está configurado');
      if (soloAutorizado) {
        // Solo autorizado: se anula la autorización. Sin reembolso y sin comisión de Stripe.
        await stripe.post(`/payment_intents/${intento}/cancel`, {}, `anular-${pedidoId}`);
        await db
          .prepare("UPDATE cobros SET cancelado_en = datetime('now') WHERE pedido_id = ?")
          .bind(pedidoId)
          .run();
      } else {
        await stripe.post(
          '/refunds',
          { payment_intent: intento, metadata: { pedido_id: pedidoId } },
          `reembolso-${pedidoId}`,
        );
      }
    } catch (e) {
      // Candado C-ANULACION-VERIFICADA (Fase 0): una respuesta perdida no es un «no». Antes de
      // revivir el pedido se le pregunta a Stripe si la anulación o el reembolso SÍ ocurrieron.
      if (stripe && (await devolucionHecha(stripe, intento, soloAutorizado))) {
        console.error(
          'manager: Stripe sí devolvió el dinero aunque la respuesta se perdió',
          pedidoId,
          e,
        );
        if (soloAutorizado)
          await db
            .prepare("UPDATE cobros SET cancelado_en = datetime('now') WHERE pedido_id = ?")
            .bind(pedidoId)
            .run();
        await anotar(db, pedidoId, 'cancelado', p.actorId);
        return true;
      }
      await db
        .prepare(
          "UPDATE pedidos SET estado = ?, cancelado_en = NULL WHERE id = ? AND estado = 'cancelado'",
        )
        .bind(antes.estado, pedidoId)
        .run();
      console.error('manager: no se pudo devolver el dinero', pedidoId, e);
      throw new ErrorDatos(
        'No se pudo devolver el dinero ahora mismo. Intenta otra vez en un momento o escríbenos.',
        undefined,
        422,
      );
    }
  }
  await anotar(db, pedidoId, 'cancelado', p.actorId);
  return true;
}

const TEXTOS = {
  recordatorio: (i: string, corto: string, min: number) =>
    i === 'en'
      ? {
          titulo: `Order #${corto} is waiting`,
          cuerpo: `The customer paid ${min} minutes ago. Accept it or it will be canceled.`,
        }
      : {
          titulo: `El pedido #${corto} está esperando`,
          cuerpo: `El cliente pagó hace ${min} minutos. Acéptalo o se cancelará.`,
        },
  canceladoAlCliente: (i: string, rest: string) =>
    i === 'en'
      ? {
          titulo: 'Order canceled, money back',
          cuerpo: `${rest} didn’t confirm in time. We refunded your money in full.`,
        }
      : {
          titulo: 'Pedido cancelado, dinero devuelto',
          cuerpo: `${rest} no confirmó a tiempo. Te devolvimos todo tu dinero.`,
        },
  canceladoAlRestaurante: (i: string, corto: string) =>
    i === 'en'
      ? {
          titulo: `Order #${corto} was canceled`,
          cuerpo: 'Nobody accepted it in 6 minutes. The customer got a refund.',
        }
      : {
          titulo: `Se canceló el pedido #${corto}`,
          cuerpo: 'Nadie lo aceptó en 6 minutos. Al cliente le devolvimos el dinero.',
        },
};

type Vigilado = {
  id: string;
  cliente_id: string;
  dueno_id: string;
  restaurante: string;
  idioma_cliente: string;
  idioma_dueno: string;
  minutos: number;
};

/** Una vuelta del Manager. Con pedidoId, solo mira ese pedido (lo usa el seguimiento). */
export async function vigilarPedidos(env: Env, db: D1Database, pedidoId?: string) {
  const resumen = {
    recordatorios: 0,
    cancelados: 0,
    sinRepartidor: 0,
    abandonados: 0,
    perdidos: 0,
    ajustes: 0,
  };
  const solo = pedidoId ? ' AND p.id = ?' : '';
  // La espera del restaurante cuenta desde el pago o, si hubo un plato agotado, desde que el
  // cliente decidió (el restaurante recién ahí puede aceptar).
  const { results: esperando } = await db
    .prepare(
      `SELECT p.id, p.cliente_id, r.dueno_id, r.nombre AS restaurante, uc.idioma AS idioma_cliente, ud.idioma AS idioma_dueno,
        CAST((julianday('now') - julianday(COALESCE((SELECT a.resuelto_en FROM ajustes_pedido a WHERE a.pedido_id = p.id AND a.estado = 'quitado'), p.pagado_en, p.creado_en))) * 1440 AS INTEGER) AS minutos
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
       JOIN usuarios uc ON uc.id = p.cliente_id JOIN usuarios ud ON ud.id = r.dueno_id
       WHERE p.estado = 'pagado' AND COALESCE((SELECT a.resuelto_en FROM ajustes_pedido a WHERE a.pedido_id = p.id AND a.estado = 'quitado'), p.pagado_en, p.creado_en) <= datetime('now', ?)
       AND NOT EXISTS (SELECT 1 FROM ajustes_pedido a WHERE a.pedido_id = p.id AND a.estado = 'pendiente')${solo}
       ORDER BY p.pagado_en LIMIT 50`,
    )
    .bind(`-${REGLAS.recordatorio1} minutes`, ...(pedidoId ? [pedidoId] : []))
    .all<Vigilado>();
  for (const p of esperando) {
    const corto = p.id.slice(0, 6).toUpperCase();
    try {
      if (p.minutos >= REGLAS.cancelar) {
        if (await cancelarConReembolso(env, db, p.id, { desde: ['pagado'], actorId: null })) {
          await anotarEvento(db, p.id, 'cancelado_sin_respuesta', `${p.minutos} min`);
          resumen.cancelados++;
          await notificar(env, db, p.cliente_id, {
            ...TEXTOS.canceladoAlCliente(p.idioma_cliente, p.restaurante),
            datos: { pedidoId: p.id },
          });
          await notificar(
            env,
            db,
            p.dueno_id,
            TEXTOS.canceladoAlRestaurante(p.idioma_dueno, corto),
          );
        }
        continue;
      }
      const evento = p.minutos >= REGLAS.recordatorio2 ? 'recordatorio_2' : 'recordatorio_1';
      if (await anotarEvento(db, p.id, evento, `${p.minutos} min`)) {
        resumen.recordatorios++;
        await notificar(env, db, p.dueno_id, {
          ...TEXTOS.recordatorio(p.idioma_dueno, corto, p.minutos),
          datos: { pedidoId: p.id },
        });
      }
    } catch (e) {
      // Un pedido con problema no frena la vuelta: queda en el registro y se reintenta en la próxima.
      console.error('manager: pedido', p.id, e);
    }
  }

  // Plato agotado sin respuesta del cliente en 5 minutos: se quita y se le devuelve esa parte.
  const { results: ajustes } = await db
    .prepare(
      `SELECT a.pedido_id AS id FROM ajustes_pedido a JOIN pedidos p ON p.id = a.pedido_id
       WHERE a.estado = 'pendiente' AND a.creado_en <= datetime('now', ?)${solo} LIMIT 20`,
    )
    .bind(`-${REGLAS.ajusteSinRespuesta} minutes`, ...(pedidoId ? [pedidoId] : []))
    .all<{ id: string }>();
  for (const a of ajustes) {
    try {
      await aplicarAjuste(env, db, a.id, 'quitar', 'manager');
      resumen.ajustes++;
    } catch (e) {
      console.error('manager: ajuste sin respuesta', a.id, e);
    }
  }

  // Repartidor perdido: aceptó, no ha llegado al restaurante y su celular lleva 10 minutos sin
  // mandar ubicación. Se le quita el pedido y vuelve a la fila de ofertas; se avisa al equipo.
  const { results: perdidos } = await db
    .prepare(
      `SELECT p.id, p.repartidor_id AS repartidor, r.nombre AS restaurante
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id JOIN repartidores d ON d.usuario_id = p.repartidor_id
       WHERE p.estado IN ('aceptado','listo') AND p.repartidor_id IS NOT NULL
       AND d.ubicacion_en <= datetime('now', ?)
       AND NOT EXISTS (SELECT 1 FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_restaurante')${solo}
       LIMIT 20`,
    )
    .bind(`-${REGLAS.repartidorPerdido} minutes`, ...(pedidoId ? [pedidoId] : []))
    .all<{ id: string; repartidor: string; restaurante: string }>();
  for (const p of perdidos) {
    await soltarPedido(db, p.id, p.repartidor, 'perdido');
    await anotarEvento(db, p.id, 'repartidor_perdido', `${REGLAS.repartidorPerdido} min sin señal`);
    resumen.perdidos++;
    const corto = p.id.slice(0, 6).toUpperCase();
    for (const para of (env.ADMIN_CORREOS ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean))
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Pedido #${corto}: el repartidor se perdió, se volvió a ofrecer`,
        texto: `El repartidor del pedido #${corto} de ${p.restaurante} llevaba ${REGLAS.repartidorPerdido} minutos sin mandar su ubicación y no había llegado al restaurante. Se le quitó el pedido y se está ofreciendo a otros.`,
      }).catch((e: unknown) => console.error('manager: correo repartidor perdido', e));
  }

  const { results: solos } = await db
    .prepare(
      `SELECT p.id, r.nombre AS restaurante, p.direccion,
        CAST((julianday('now') - julianday(p.aceptado_en)) * 1440 AS INTEGER) AS minutos
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
       WHERE p.estado IN ('aceptado','listo') AND p.repartidor_id IS NULL AND p.aceptado_en <= datetime('now', ?)
       AND NOT EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id)${solo}
       LIMIT 50`,
    )
    .bind(`-${REGLAS.sinRepartidor} minutes`, ...(pedidoId ? [pedidoId] : []))
    .all<{ id: string; restaurante: string; direccion: string; minutos: number }>();
  const admins = (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const p of solos) {
    if (!(await anotarEvento(db, p.id, 'sin_repartidor', `${p.minutos} min`))) continue;
    resumen.sinRepartidor++;
    const corto = p.id.slice(0, 6).toUpperCase();
    for (const para of admins)
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Pedido #${corto} sin repartidor (${p.minutos} min)`,
        texto: `El pedido #${corto} de ${p.restaurante} lleva ${p.minutos} minutos aceptado y ningún repartidor lo ha tomado.\n\nEntrega en: ${p.direccion}\n\nRevisa la bitácora del pedido en el superadmin y, si hace falta, llama a un repartidor de la zona.`,
      }).catch((e: unknown) => console.error('manager: correo sin repartidor', e));
  }
  // Pedidos abandonados en el pago: después de 2 horas se anula el cobro en Stripe (para que ya
  // no se pueda pagar) y se cierran. Si Stripe no lo deja anular (porque sí se pagó), no se
  // tocan: el aviso del pago los pondrá como pagados.
  if (!pedidoId) {
    const stripe = crearStripe(env.STRIPE_SECRET_KEY);
    const { results: abandonados } = await db
      .prepare(
        "SELECT id, stripe_sesion FROM pedidos WHERE estado = 'pago_pendiente' AND creado_en <= datetime('now', '-2 hours') LIMIT 20",
      )
      .all<{ id: string; stripe_sesion: string | null }>();
    for (const p of abandonados) {
      try {
        if (p.stripe_sesion) {
          if (!stripe) continue;
          await stripe.post(`/payment_intents/${p.stripe_sesion}/cancel`, {}, `anular-${p.id}`);
        }
        const r = await db
          .prepare(
            "UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now') WHERE id = ? AND estado = 'pago_pendiente'",
          )
          .bind(p.id)
          .run();
        if (r.meta.changes) {
          await anotarEvento(db, p.id, 'abandonado_sin_pagar');
          resumen.abandonados++;
        }
      } catch (e) {
        console.error('manager: no se pudo cerrar un pedido sin pagar', p.id, e);
      }
    }
  }
  return resumen;
}
