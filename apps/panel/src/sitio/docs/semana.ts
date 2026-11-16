import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';
import { GUIAS_FLEX_ENVIOS } from './semanaFlexEnvios';
import { GUIAS_FOTO_PUERTA } from './fotoPuerta';
import { GUIAS_MODERACION } from './moderacion';
import { GUIAS_FLEX_BLOQUE } from './flexBloque';

/**
 * C-DOCS-SEMANA (14 nov 2026): las guías públicas de lo construido la semana del 9 al 14 de noviembre,
 * con capturas REALES. Comida en Venezuela (pagar al recibir, «sí me llegó», el saldo para comisiones
 * y el cliente que no aparece) tomadas en El Vigía con `scripts/recorrido/capturas-comida-venezuela.mjs`;
 * Divoox Flex y Envíos de A a B en su propio archivo (`semanaFlexEnvios.ts`). Cada lista va al final de
 * su sección de Docs.
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

// C-CAPTURAS-POR-IDIOMA (15 nov 2026): el español se enseña con El Vigía (`comida-ve`); el inglés, con
// Novi, Michigan (`comida-us`), como funciona Comida en Estados Unidos: se paga con tarjeta en la app.
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-comida-${idioma === 'en' ? 'us' : 've'}-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const COMIDA_VE: Record<Idioma, PorSeccion> = {
  es: {
    ordering: [
      {
        id: 'pay-on-delivery-venezuela',
        titulo: 'Pagar tu comida al recibir: efectivo o pago móvil',
        resumen:
          'En Venezuela pagas tu pedido cuando llega, en efectivo o con una transferencia por pago móvil al repartidor, y ves el total también en bolívares.',
        explicacion: [
          'En los países donde se cobra en mano, como Venezuela, al pedir eliges «Efectivo al recibir» o «Transferencia al repartidor» (pago móvil). No hace falta tarjeta.',
          'Los precios van en dólares y el total de tu carrito trae al lado su equivalente en bolívares con la tasa del día, para que sepas cuánto vas a pagar. La tasa es, por defecto, la oficial del Banco Central de Venezuela, que se actualiza sola cada día hábil; al lado ves de qué día es. Es solo de referencia: el precio se fija en dólares.',
          'Si eliges transferencia, en el seguimiento de tu pedido ves el nombre del repartidor y los datos de su cuenta para pagarle cuando llegue. El repartidor confirma en su app que le llegó.',
          'La propina en efectivo se la das directamente al repartidor: es toda suya.',
        ],
        capturas: [
          foto(
            'carrito-pago',
            'es',
            'El carrito con «¿Cómo pagas?»: Efectivo al recibir y Transferencia al repartidor, y la dirección de entrega en El Vigía.',
            'Eliges cómo pagas al recibir.',
          ),
          foto(
            'carrito-total',
            'es',
            'El total del carrito en dólares con su equivalente en bolívares a la tasa del día.',
            'El total también en bolívares.',
          ),
          foto(
            'pedido-cliente',
            'es',
            'El seguimiento del pedido con «Pagas al recibir»: cuánto transferir, el nombre del repartidor y los datos de su cuenta.',
            'En el seguimiento ves a quién le pagas.',
          ),
        ],
        preguntas: [
          '¿Puedo pagar la comida en efectivo?',
          '¿Cómo pago mi pedido por pago móvil?',
          '¿Cuánto es en bolívares?',
        ],
        pasos: [
          'Arma tu pedido y abre el carrito.',
          'En «¿Cómo pagas?», elige «Efectivo al recibir» o «Transferencia al repartidor».',
          'Revisa el total en dólares y su equivalente en bolívares, y toca para pedir y pagar al recibir.',
          'Si elegiste transferencia, en el seguimiento verás los datos del repartidor: págale cuando llegue.',
        ],
        nota: 'Ten el monto listo cuando llegue el repartidor: así la entrega es rápida.',
      },
      {
        id: 'order-not-delivered',
        titulo: 'Si no estabas cuando llegó el repartidor',
        resumen:
          'Si el repartidor llega y no te encuentra, te avisamos y te espera unos minutos. Si no apareces, el pedido se cierra y lo ves en tu pedido.',
        explicacion: [
          'Cuando el repartidor llega a tu puerta y no te encuentra, toca «El cliente no aparece»: te avisamos al celular y él te espera unos minutos mientras te escribe por el chat.',
          'Si pasa la espera y no apareces, en los pedidos que se pagan al recibir la comida no se deja en la puerta: el repartidor cierra el pedido y en tu pedido ves «Pedido cancelado». Lo que costó la comida queda como saldo pendiente con Divoox y hay que resolverlo con soporte antes de volver a pedir.',
          'En los pedidos con tarjeta y PIN, la comida tampoco se deja sola: el repartidor cierra el pedido con una foto del lugar donde te esperó, y en tu pedido ves «No pudimos entregar tu pedido» con esa foto.',
          'Si algo salió mal (la dirección estaba bien, nadie te avisó), escríbenos desde ese mismo pedido con «¿Problemas con tu pedido? Cuéntanos».',
        ],
        capturas: [
          foto(
            'driver-no-aparece-espera',
            'es',
            'La app del repartidor en la puerta: avisamos al cliente y la cuenta regresiva de la espera.',
            'El repartidor te avisa y te espera unos minutos.',
          ),
          foto(
            'driver-no-aparece',
            'es',
            'Pasada la espera, en un pedido que se cobra en mano: no se deja en un lugar seguro y el botón «El cliente no pagó».',
            'Si no apareces, el repartidor cierra el pedido.',
          ),
          foto(
            'pedido-no-entregado',
            'es',
            'El pedido del cliente después de que el repartidor no lo encontró: «Pedido cancelado», el recibo y el botón para contar el problema.',
            'En tu pedido ves lo que pasó y puedes pedir ayuda.',
          ),
        ],
        preguntas: [
          '¿Qué pasa si no estoy cuando llega el repartidor?',
          '¿Por qué mi pedido dice «Pedido cancelado» o «No pudimos entregar tu pedido»?',
        ],
        pasos: [
          'Ten el celular a mano cuando tu pedido esté en camino.',
          'Si te avisamos que el repartidor llegó y no te encuentra, sal a recibirlo o escríbele por el chat.',
          'Si no llegaste a tiempo, abre tu pedido para ver lo que pasó y, si algo salió mal, toca «¿Problemas con tu pedido? Cuéntanos».',
        ],
      },
    ],
    drivers: [
      {
        id: 'driver-cash-mobile-payment-venezuela',
        titulo: 'Cobrar pedidos en mano: efectivo y pago móvil',
        resumen:
          'En los pedidos que se pagan al recibir, cobras al cliente en su puerta y confirmas el pago móvil con «Sí, me llegó» o «No me llegó».',
        explicacion: [
          'Cuando el cliente paga al recibir, al llegar a su puerta tu app te muestra «Cobra al cliente» con el monto sin la propina y su equivalente en bolívares a la tasa del día.',
          'En efectivo, escribe lo que recibiste y toca «Cobré». Por pago móvil, revisa tu banco y toca «Sí, me llegó el pago móvil» o «No me llegó». Si la transferencia todavía no aparece, toca «La transferencia aún no me llega».',
          'Si el cliente no aparece, toca «El cliente no aparece»: le avisamos y esperas unos minutos. Un pedido que se cobra en mano nunca se deja en un lugar seguro: pasada la espera, toca «El cliente no pagó» y lleva la comida de vuelta al restaurante.',
          'La propina en efectivo es tuya y no se cuenta en el cobro.',
        ],
        capturas: [
          foto(
            'driver-cobro',
            'es',
            'La tarjeta «Cobra al cliente» con el monto en dólares y en bolívares, y los botones Cobré, Sí, me llegó el pago móvil y No me llegó.',
            'En la puerta cobras y confirmas el pago móvil.',
          ),
          foto(
            'driver-no-aparece-espera',
            'es',
            'La espera después de tocar «El cliente no aparece», con la cuenta regresiva.',
            'Si el cliente no aparece, esperas unos minutos.',
          ),
          foto(
            'driver-no-aparece',
            'es',
            'El pedido que se cobra en mano no se deja en un lugar seguro: el botón «El cliente no pagó».',
            'Pasada la espera, cierras con «El cliente no pagó».',
          ),
        ],
        preguntas: [
          '¿Cómo cobro un pedido en efectivo?',
          '¿Cómo confirmo que me llegó el pago móvil?',
          '¿Qué hago si el cliente no aparece?',
        ],
        pasos: [
          'Al llegar a la puerta, mira el monto a cobrar en «Cobra al cliente».',
          'En efectivo, escribe lo que recibiste y toca «Cobré».',
          'Por pago móvil, revisa tu banco y toca «Sí, me llegó el pago móvil» o «No me llegó».',
          'Si el cliente no aparece, toca «El cliente no aparece» y espera; pasado el tiempo, toca «El cliente no pagó».',
        ],
      },
      {
        id: 'driver-commission-balance-top-up',
        titulo: 'Tu saldo para comisiones y cómo recargarlo con un código',
        resumen:
          'Las comisiones de los pedidos que cobras en mano salen de tu saldo; la app te dice para cuántos pedidos te alcanza y recargas con un código.',
        explicacion: [
          'En los países donde cobras en mano, la comisión de Divoox no se descuenta de un pago con tarjeta: sale de tu saldo para comisiones. Se aparta al aceptar el pedido y se cobra al entregar; si el pedido se cancela, vuelve a tu saldo.',
          'En «Ganancias» ves tu saldo disponible, lo apartado en pedidos y una estimación de para cuántos pedidos (y viajes, si haces Moto o Carro) te alcanza. Cuando queda poco, el aviso sale en rojo.',
          'Para recargar, pagas en un punto de venta autorizado y te dan un código. Lo escribes en «Código de recarga» y tocas «Recargar con el código»: el saldo se suma al momento.',
          'Sin saldo no recibes pedidos que se cobran en mano.',
        ],
        capturas: [
          foto(
            'driver-saldo',
            'es',
            'El saldo para comisiones en Ganancias: disponible, apartado en pedidos, «Te alcanza para unos N pedidos» y la casilla del código de recarga.',
            'Tu saldo, para cuántos pedidos te alcanza y la recarga por código.',
          ),
        ],
        preguntas: [
          '¿De dónde sale la comisión de un pedido en efectivo?',
          '¿Cómo recargo mi saldo con un código?',
          '¿Para cuántos pedidos me alcanza el saldo?',
        ],
        pasos: [
          'En la app, toca «Ganancias» y mira tu saldo para comisiones.',
          'Para recargar, escribe el código del punto de venta en «Código de recarga» y toca «Recargar con el código».',
        ],
      },
    ],
  },
  // En inglés, Estados Unidos: allá la comida se paga con tarjeta en la app. El pago al recibir, el pago
  // móvil y el saldo para comisiones son de los países donde se cobra en mano, y la guía lo dice.
  en: {
    ordering: [
      {
        id: 'pay-on-delivery-venezuela',
        titulo: 'How you pay for your food order',
        resumen:
          'In the United States you pay by card in the app when you order, in US dollars, and you see every charge before you confirm.',
        explicacion: [
          'In the United States, food orders are paid by card in the app. You don’t pay the driver at the door: when your order arrives, you only have to receive it.',
          'Prices are in US dollars. Before you pay, your cart shows the food, the delivery fee, the service fee, the tip and the total, and “What are these fees?” explains each one.',
          'After you pay, your order tracking shows the receipt, where your driver is and, if you chose “Hand it to me,” the PIN you give the driver to receive your order.',
          'The tip you add in the app goes to your driver in full. Paying in cash or by bank transfer on delivery is offered only in countries where Divoox collects in person; it isn’t available in the United States.',
        ],
        capturas: [
          foto(
            'carrito',
            'en',
            'The cart for an order from a restaurant in Novi, Michigan: the item in US dollars, when you want it and how you want to receive it.',
            'Your cart, in US dollars.',
          ),
          foto(
            'carrito-total',
            'en',
            'The tip options and the totals: food, delivery, service fee, tip and total, with the “Continue to payment” button.',
            'You see every charge before you pay.',
          ),
          foto(
            'pedido-cliente',
            'en',
            'Order tracking: the receipt, “Your driver is on the way,” the arrival window and the PIN to receive the order.',
            'Tracking shows your receipt, your driver and your PIN.',
          ),
        ],
        preguntas: [
          'How do I pay for my food order?',
          'Can I pay for food in cash?',
          'Where do I see the fees before I pay?',
        ],
        pasos: [
          'Build your order and open the cart.',
          'Choose when you want it and how to receive it, and check your delivery address.',
          'Pick a tip, review the total and tap “Continue to payment” to pay by card.',
          'Follow your order in tracking; if you chose “Hand it to me,” give the driver your PIN when they arrive.',
        ],
        nota: 'Keep your phone handy when your order is close so the handoff is quick.',
      },
      {
        id: 'order-not-delivered',
        titulo: 'If you weren’t there when the driver arrived',
        resumen:
          'If the driver arrives and can’t find you, we notify you and they wait a few minutes. If you don’t show up, the driver closes the order with a photo and you see what happened in your order.',
        explicacion: [
          'When the driver reaches your door and can’t find you, they tap “Customer isn’t here”: we notify your phone and they wait a few minutes while messaging you in the chat.',
          'If the wait ends and you don’t show up, an order you asked to receive in person with a PIN isn’t left alone at the door: the driver closes it with a photo of where they waited, and your order shows “We couldn’t deliver it” with that photo.',
          'If you chose “Leave at my door” instead, the driver doesn’t need you to be there: they leave the order at your door and send you a photo.',
          'If something went wrong (the address was right, nobody notified you), contact us from that same order.',
        ],
        capturas: [
          foto(
            'driver-no-aparece-espera',
            'en',
            'The driver app at the door: we told the customer, and the wait countdown.',
            'The driver notifies you and waits a few minutes.',
          ),
          foto(
            'driver-no-aparece',
            'en',
            'After the wait, on an order handed over with a PIN: the “Customer didn’t show: close with photo” button.',
            'If you don’t show up, the driver closes the order.',
          ),
          foto(
            'pedido-no-entregado',
            'en',
            'The customer’s order after the driver couldn’t reach them: the message “We couldn’t deliver it” and the photo of where the driver waited.',
            'Your order shows what happened, and you can ask for help.',
          ),
        ],
        preguntas: [
          'What happens if I’m not there when the driver arrives?',
          'Why does my order say “We couldn’t deliver it”?',
        ],
        pasos: [
          'Keep your phone handy while your order is on the way.',
          'If we tell you the driver arrived and can’t find you, go out to meet them or message them in the chat.',
          'If you didn’t make it in time, open your order to see what happened and, if something went wrong, tap “Help” to contact us.',
        ],
      },
    ],
    drivers: [
      {
        id: 'driver-cash-mobile-payment-venezuela',
        titulo: 'At the customer’s door: handing over the order',
        resumen:
          'In the United States orders are already paid in the app, so there is nothing to collect at the door: you hand over the order with the customer’s PIN, and the app tells you what to do if they aren’t there.',
        explicacion: [
          'In the United States, customers pay by card in the app. At the door your app shows the address and how the customer chose to receive the order; you don’t collect any money.',
          'If the customer chose “Hand it to me,” ask for their 4-digit PIN, enter it and tap “Handed to the customer.” An order with a PIN can’t be left with a photo.',
          'If the customer isn’t there, tap “Customer isn’t here”: we notify them and you wait a few minutes while you message or call them. After the wait, on an order with a PIN, tap “Customer didn’t show: close with photo” and take a photo of the door or the spot: the order is closed, you get paid and support is notified.',
          'Collecting cash or a bank transfer at the door applies only in countries where Divoox collects in person. It isn’t used in the United States.',
        ],
        capturas: [
          foto(
            'driver-puerta',
            'en',
            'The order at the customer’s door in Novi, Michigan: the address, “Customer chose: hand it to them,” the PIN box and the “Handed to the customer” button.',
            'At the door you hand over the order with the customer’s PIN.',
          ),
          foto(
            'driver-no-aparece-espera',
            'en',
            'The wait after tapping “Customer isn’t here,” with the countdown.',
            'If the customer isn’t there, you wait a few minutes.',
          ),
          foto(
            'driver-no-aparece',
            'en',
            'After the wait, on an order with a PIN: the “Customer didn’t show: close with photo” button.',
            'After the wait, close the order with a photo.',
          ),
        ],
        preguntas: [
          'Do I collect money at the door?',
          'How do I hand over an order with a PIN?',
          'What do I do if the customer isn’t there?',
        ],
        pasos: [
          'At the door, check how the customer chose to receive the order.',
          'For “hand it to them,” ask for the PIN, enter it and tap “Handed to the customer.”',
          'If the customer isn’t there, tap “Customer isn’t here,” then message or call them while you wait.',
          'When the wait is over, tap “Customer didn’t show: close with photo” and take the photo.',
        ],
      },
      {
        id: 'driver-commission-balance-top-up',
        titulo: 'Fee balance and top-ups: not needed in the United States',
        resumen:
          'In the United States customers pay in the app, so you don’t keep a fee balance or buy top-ups: what you earn on each delivery shows under Earnings.',
        explicacion: [
          'A fee balance exists only in countries where drivers collect orders in person: there, the Divoox fee comes out of a prepaid balance that the driver tops up with a code from a sales point.',
          'In the United States orders are paid by card in the app, so there is no balance to top up and no code to enter before you can receive orders.',
          'Under “Earnings” you see today’s total, the week and the month, split into base pay, bonuses and tips.',
          'Base pay never changes because of the tip: tips are added on top, and they’re all yours.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-ganancias-en.webp',
            alt: 'The Earnings tab in Divoox Driver: today’s total with base pay, bonuses and tips, in US dollars.',
            pie: 'Your earnings by day, week and month.',
          },
        ],
        preguntas: [
          'Do I need a fee balance to deliver in the United States?',
          'Where do I see what I earned?',
          'Do tips change my base pay?',
        ],
        pasos: [
          'In the app, tap “Earnings.”',
          'Switch between Today, Week and Month to see your base pay, bonuses and tips.',
        ],
      },
    ],
  },
};

/** Junta las listas por sección: Comida en Venezuela, Flex y Envíos, la foto de la puerta y el bloque de Flex. */
function juntar(idioma: Idioma): PorSeccion {
  const a = new Map(Object.entries(idioma === 'es' ? COMIDA_VE.es : COMIDA_VE.en));
  const b = new Map(Object.entries(idioma === 'es' ? GUIAS_FLEX_ENVIOS.es : GUIAS_FLEX_ENVIOS.en));
  const c = new Map(Object.entries(idioma === 'es' ? GUIAS_FOTO_PUERTA.es : GUIAS_FOTO_PUERTA.en));
  const d = new Map(Object.entries(idioma === 'es' ? GUIAS_FLEX_BLOQUE.es : GUIAS_FLEX_BLOQUE.en));
  // C-MODERACION y C-AVISOS-IDIOMA (16 nov 2026).
  const e = new Map(Object.entries(idioma === 'es' ? GUIAS_MODERACION.es : GUIAS_MODERACION.en));
  const ids = new Set([...a.keys(), ...b.keys(), ...c.keys(), ...d.keys(), ...e.keys()]);
  return Object.fromEntries(
    [...ids].map((id) => [
      id,
      [
        ...(a.get(id) ?? []),
        ...(b.get(id) ?? []),
        ...(c.get(id) ?? []),
        ...(d.get(id) ?? []),
        ...(e.get(id) ?? []),
      ],
    ]),
  ) as PorSeccion;
}

export const GUIAS_SEMANA: Record<Idioma, PorSeccion> = { es: juntar('es'), en: juntar('en') };
