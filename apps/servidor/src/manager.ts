import { enviarCorreo } from './correo';
import type { Env } from './env';
import { anotar } from './historial';
import { notificar } from './notificaciones';
import { crearStripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * El Manager de Tumbite, fase de reglas (sin IA y sin costo): vigila que ningún pedido pagado
 * se quede olvidado. Corre en el reloj externo y también cada vez que el cliente mira su
 * seguimiento (la app pregunta cada pocos segundos), así no depende de que el reloj sea puntual.
 * Candado C-MANAGER-1.
 */
export const REGLAS = {
  /** Minutos sin que el restaurante acepte: primer recordatorio. */
  recordatorio1: 3,
  /** Segundo recordatorio. */
  recordatorio2: 6,
  /** Cancelación con devolución automática del dinero. */
  cancelar: 10,
  /** Minutos desde que el restaurante aceptó sin que ningún repartidor tome el pedido. */
  sinRepartidor: 15,
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
      `SELECT estado, stripe_pago FROM pedidos WHERE id = ?${filtros} AND estado IN (${p.desde.map(() => '?').join(',')})`,
    )
    .bind(pedidoId, ...extra, ...p.desde)
    .first<{ estado: string; stripe_pago: string | null }>();
  if (!antes) return false;
  const apartado = await db
    .prepare(
      "UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now') WHERE id = ? AND estado = ?",
    )
    .bind(pedidoId, antes.estado)
    .run();
  if (!apartado.meta.changes) return false;
  if (antes.stripe_pago) {
    const stripe = crearStripe(env.STRIPE_SECRET_KEY);
    try {
      if (!stripe) throw new Error('Stripe no está configurado');
      await stripe.post(
        '/refunds',
        { payment_intent: antes.stripe_pago, metadata: { pedido_id: pedidoId } },
        `reembolso-${pedidoId}`,
      );
    } catch (e) {
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
          cuerpo: 'Nobody accepted it in 10 minutes. The customer got a refund.',
        }
      : {
          titulo: `Se canceló el pedido #${corto}`,
          cuerpo: 'Nadie lo aceptó en 10 minutos. Al cliente le devolvimos el dinero.',
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
  const resumen = { recordatorios: 0, cancelados: 0, sinRepartidor: 0, abandonados: 0 };
  const solo = pedidoId ? ' AND p.id = ?' : '';
  const { results: esperando } = await db
    .prepare(
      `SELECT p.id, p.cliente_id, r.dueno_id, r.nombre AS restaurante, uc.idioma AS idioma_cliente, ud.idioma AS idioma_dueno,
        CAST((julianday('now') - julianday(COALESCE(p.pagado_en, p.creado_en))) * 1440 AS INTEGER) AS minutos
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
       JOIN usuarios uc ON uc.id = p.cliente_id JOIN usuarios ud ON ud.id = r.dueno_id
       WHERE p.estado = 'pagado' AND COALESCE(p.pagado_en, p.creado_en) <= datetime('now', ?)${solo}
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

  const { results: solos } = await db
    .prepare(
      `SELECT p.id, r.nombre AS restaurante, p.direccion,
        CAST((julianday('now') - julianday(p.aceptado_en)) * 1440 AS INTEGER) AS minutos
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
       WHERE p.estado IN ('aceptado','listo') AND p.repartidor_id IS NULL AND p.aceptado_en <= datetime('now', ?)${solo}
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
