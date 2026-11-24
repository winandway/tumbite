import type { Env } from './env';
import { type Aviso, type Idioma, notificar } from './notificaciones';

/**
 * C-AVISOS-COMIDA (24 nov 2026) — todos los países. Los huecos que quedaban en los avisos de un
 * pedido de comida, como los grandes (DoorDash, Uber Eats):
 *
 * - Cliente: «El restaurante no pudo tomar tu pedido» si el restaurante lo rechaza, y «Cancelamos tu
 *   pedido» si lo cancela soporte, con lo que pasa con su dinero.
 * - Restaurante: «El cliente canceló el pedido #X» y «Soporte canceló el pedido #X».
 * - Conductor: «Te quitamos el pedido» cuando el sistema se lo suelta por falta de señal (o soporte).
 * - Restaurante: «El conductor llega en unos 5 minutos» y «El conductor llegó por el pedido #X».
 *
 * UNA vez por pedido y por paso: se llama solo desde la rama donde el cambio de verdad ocurrió (la
 * cancelación que devolvió `true`, el pedido que se soltó, el hito o el aviso que se marcó por primera
 * vez en `hitos_pedido` / `avisos_pedido`). Sin tabla nueva: lo único que escribe es la fila de la
 * campana que `notificar` ya guarda. Sin montos, sin direcciones. Dice «conductor». Nunca frena el
 * pedido: si falla, queda en el registro de errores.
 *
 * Candado en `avisosComida.test.ts`: toda cancelación de un pedido (`cancelarConReembolso`) y todo
 * pedido soltado (`soltarPedido`) del servidor avisa o dice por escrito por qué no.
 */

/** Qué pasa con el dinero del cliente al cancelarse su pedido. */
export type DineroCancelado = 'tarjeta' | 'directo' | 'sin_cobro';

const dineroTexto = (d: DineroCancelado, i: Idioma) => {
  if (i === 'en')
    return d === 'tarjeta'
      ? 'We’re returning everything you paid to your card; depending on your bank it can take a few days to show.'
      : d === 'directo'
        ? 'If you already paid the restaurant, they’ll return your money and we’ll let you know.'
        : 'You weren’t charged anything.';
  return d === 'tarjeta'
    ? 'Te devolvemos todo lo que pagaste a tu tarjeta; según tu banco, puede tardar unos días en verse.'
    : d === 'directo'
      ? 'Si ya le pagaste al restaurante, te devuelve tu dinero y te avisamos.'
      : 'No se te cobró nada.';
};

export const AVISOS_COMIDA = {
  restauranteNoPudo: (i: Idioma, rest: string, d: DineroCancelado): Aviso =>
    i === 'en'
      ? {
          titulo: `${rest} couldn’t take your order`,
          cuerpo: `${dineroTexto(d, i)} You can order from another place.`,
        }
      : {
          titulo: `${rest} no pudo tomar tu pedido`,
          cuerpo: `${dineroTexto(d, i)} Puedes pedir en otro lugar.`,
        },
  soporteCanceloCliente: (i: Idioma, rest: string, d: DineroCancelado): Aviso =>
    i === 'en'
      ? {
          titulo: 'We canceled your order',
          cuerpo: `Our support team canceled your order from ${rest}. ${dineroTexto(d, i)}`,
        }
      : {
          titulo: 'Cancelamos tu pedido',
          cuerpo: `Nuestro equipo de soporte canceló tu pedido de ${rest}. ${dineroTexto(d, i)}`,
        },
  clienteCancelo: (i: Idioma, corto: string): Aviso =>
    i === 'en'
      ? {
          titulo: `The customer canceled order #${corto}`,
          cuerpo: 'You don’t need to prepare it anymore.',
        }
      : {
          titulo: `El cliente canceló el pedido #${corto}`,
          cuerpo: 'Ya no tienes que prepararlo.',
        },
  soporteCanceloRestaurante: (i: Idioma, corto: string): Aviso =>
    i === 'en'
      ? {
          titulo: `Support canceled order #${corto}`,
          cuerpo: 'You don’t need to prepare or hand it over anymore.',
        }
      : {
          titulo: `Soporte canceló el pedido #${corto}`,
          cuerpo: 'Ya no tienes que prepararlo ni entregarlo.',
        },
  conductorCanceladoSoporte: (i: Idioma, rest: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Support canceled your order',
          cuerpo: `The ${rest} order was canceled. You’re free for the next one.`,
        }
      : {
          titulo: 'Soporte canceló tu pedido',
          cuerpo: `Se canceló el pedido de ${rest}. Quedas libre para el siguiente.`,
        },
  conductorSinSenal: (i: Idioma, rest: string): Aviso =>
    i === 'en'
      ? {
          titulo: `We took the ${rest} order off your list`,
          cuerpo:
            'We lost your signal for 10 minutes and offered it to another driver. Check your connection and GPS to get the next one.',
        }
      : {
          titulo: `Te quitamos el pedido de ${rest}`,
          cuerpo:
            'Perdimos tu señal por 10 minutos y se lo ofrecimos a otro conductor. Revisa tu conexión y tu GPS para recibir el siguiente.',
        },
  conductorQuitadoSoporte: (i: Idioma, rest: string): Aviso =>
    i === 'en'
      ? {
          titulo: `Support took the ${rest} order off your list`,
          cuerpo: 'We offered it to another driver. You’re free for the next one.',
        }
      : {
          titulo: `Soporte te quitó el pedido de ${rest}`,
          cuerpo: 'Se lo ofrecimos a otro conductor. Quedas libre para el siguiente.',
        },
  restauranteLlega5: (i: Idioma, corto: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Your driver arrives in about 5 minutes',
          cuerpo: `They’re coming for order #${corto}. Have it ready.`,
        }
      : {
          titulo: 'El conductor llega en unos 5 minutos',
          cuerpo: `Viene por el pedido #${corto}. Tenlo listo.`,
        },
  restauranteLlego: (i: Idioma, corto: string): Aviso =>
    i === 'en'
      ? {
          titulo: `The driver is here for order #${corto}`,
          cuerpo: 'Hand it over as soon as it’s ready.',
        }
      : {
          titulo: `El conductor llegó por el pedido #${corto}`,
          cuerpo: 'Entrégaselo en cuanto esté listo.',
        },
};

/** Los pasos que avisan, para el candado y la guía. */
export const PASOS_COMIDA = [
  'cancelado_restaurante',
  'cancelado_soporte',
  'cancelado_cliente',
  'soltado_sin_senal',
  'soltado_soporte',
  'rest_llega_5',
  'rest_llego',
] as const;
export type PasoComida = (typeof PASOS_COMIDA)[number];

type Fila = {
  cliente_id: string;
  repartidor_id: string | null;
  dueno_id: string;
  restaurante: string;
  metodo_pago: string;
  stripe: number;
  directo: number;
};

async function filaPedido(db: D1Database, pedidoId: string) {
  return db
    .prepare(
      `SELECT p.cliente_id, p.repartidor_id, r.dueno_id, r.nombre AS restaurante, p.metodo_pago,
         (p.stripe_pago IS NOT NULL OR p.stripe_sesion IS NOT NULL) AS stripe,
         EXISTS (SELECT 1 FROM pagos_comida pc WHERE pc.pedido_id = p.id) AS directo
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?`,
    )
    .bind(pedidoId)
    .first<Fila>();
}

const dineroDe = (f: Fila): DineroCancelado =>
  Number(f.directo)
    ? 'directo'
    : f.metodo_pago === 'tarjeta' && Number(f.stripe)
      ? 'tarjeta'
      : 'sin_cobro';

const corto = (id: string) => id.slice(0, 8).toUpperCase();

/**
 * Avisa a quien corresponde de UN paso del pedido. `repartidorId`: el conductor al que se le soltó
 * (ya no está en el pedido). Nunca lanza.
 */
export async function avisarPasoComida(
  env: Env,
  db: D1Database,
  pedidoId: string,
  paso: PasoComida,
  repartidorId?: string,
): Promise<void> {
  try {
    const f = await filaPedido(db, pedidoId);
    if (!f) return;
    const datos = { pedidoId, tipo: 'pedido', paso };
    const a = async (para: string | null | undefined, aviso: (i: Idioma) => Aviso) => {
      if (para) await notificar(env, db, para, (i) => ({ ...aviso(i), datos }));
    };
    switch (paso) {
      case 'cancelado_restaurante':
        return await a(f.cliente_id, (i) =>
          AVISOS_COMIDA.restauranteNoPudo(i, f.restaurante, dineroDe(f)),
        );
      case 'cancelado_soporte':
        await a(f.cliente_id, (i) =>
          AVISOS_COMIDA.soporteCanceloCliente(i, f.restaurante, dineroDe(f)),
        );
        await a(f.repartidor_id, (i) => AVISOS_COMIDA.conductorCanceladoSoporte(i, f.restaurante));
        return await a(f.dueno_id, (i) =>
          AVISOS_COMIDA.soporteCanceloRestaurante(i, corto(pedidoId)),
        );
      case 'cancelado_cliente':
        return await a(f.dueno_id, (i) => AVISOS_COMIDA.clienteCancelo(i, corto(pedidoId)));
      case 'soltado_sin_senal':
        return await a(repartidorId, (i) => AVISOS_COMIDA.conductorSinSenal(i, f.restaurante));
      case 'soltado_soporte':
        return await a(repartidorId, (i) =>
          AVISOS_COMIDA.conductorQuitadoSoporte(i, f.restaurante),
        );
      case 'rest_llega_5':
        return await a(f.dueno_id, (i) => AVISOS_COMIDA.restauranteLlega5(i, corto(pedidoId)));
      case 'rest_llego':
        return await a(f.dueno_id, (i) => AVISOS_COMIDA.restauranteLlego(i, corto(pedidoId)));
    }
  } catch (e) {
    console.error('comida: aviso del paso', paso, pedidoId, e);
  }
}
