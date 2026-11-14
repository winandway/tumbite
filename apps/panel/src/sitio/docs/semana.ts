import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';
import { GUIAS_FLEX_ENVIOS } from './semanaFlexEnvios';

/**
 * C-DOCS-SEMANA (14 nov 2026): las guías públicas de lo construido la semana del 9 al 14 de noviembre,
 * con capturas REALES. Comida en Venezuela (pagar al recibir, «sí me llegó», el saldo para comisiones
 * y el cliente que no aparece) tomadas en El Vigía con `scripts/recorrido/capturas-comida-venezuela.mjs`;
 * Divoox Flex y Envíos de A a B en su propio archivo (`semanaFlexEnvios.ts`). Cada lista va al final de
 * su sección de Docs.
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-comida-ve-${nombre}-${idioma}.webp`,
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
          'Los precios van en dólares y el total de tu carrito trae al lado su equivalente en bolívares con la tasa del día, para que sepas cuánto vas a pagar.',
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
  en: {
    ordering: [
      {
        id: 'pay-on-delivery-venezuela',
        titulo: 'Pay for your food on delivery: cash or mobile payment',
        resumen:
          'In Venezuela you pay when your order arrives, in cash or with a mobile payment transfer to the driver, and you also see the total in bolívares.',
        explicacion: [
          'In countries where payment is collected in person, like Venezuela, you choose “Cash on delivery” or “Transfer to the driver” (mobile payment) when you order. No card needed.',
          'Prices are in US dollars, and your cart total shows its equivalent in bolívares at the day’s rate, so you know how much you’ll pay.',
          'If you choose transfer, your order tracking shows the driver’s name and account details so you can pay them when they arrive. The driver confirms in their app that it arrived.',
          'A cash tip goes straight to the driver: they keep all of it.',
        ],
        capturas: [
          foto(
            'carrito-pago',
            'en',
            'The cart with “How do you pay?”: Cash on delivery and Transfer to the driver, and the delivery address in El Vigía.',
            'Choose how you’ll pay on delivery.',
          ),
          foto(
            'carrito-total',
            'en',
            'The cart total in US dollars with its equivalent in bolívares at the day’s rate.',
            'The total in bolívares, too.',
          ),
          foto(
            'pedido-cliente',
            'en',
            'Order tracking with “Pay on delivery”: how much to transfer, the driver’s name, and their account details.',
            'Tracking shows who to pay.',
          ),
        ],
        preguntas: [
          'Can I pay for food in cash?',
          'How do I pay for my order with mobile payment?',
          'How much is it in bolívares?',
        ],
        pasos: [
          'Build your order and open the cart.',
          'Under “How do you pay?”, choose “Cash on delivery” or “Transfer to the driver.”',
          'Check the total in US dollars and its equivalent in bolívares, and tap to order and pay on delivery.',
          'If you chose transfer, tracking will show the driver’s details: pay them when they arrive.',
        ],
        nota: 'Have the amount ready when the driver arrives so the handoff is quick.',
      },
      {
        id: 'order-not-delivered',
        titulo: 'If you weren’t there when the driver arrived',
        resumen:
          'If the driver arrives and can’t find you, we notify you and they wait a few minutes. If you don’t show up, the order is closed and you see it in your order.',
        explicacion: [
          'When the driver reaches your door and can’t find you, they tap “Customer isn’t here”: we notify your phone and they wait a few minutes while messaging you in the chat.',
          'If the wait ends and you don’t show up, food paid on delivery isn’t left at the door: the driver closes the order and your order shows “Order canceled.” The cost of the food stays as an outstanding balance with Divoox, which you resolve with support before ordering again.',
          'For card orders with a PIN, the food isn’t left alone either: the driver closes the order with a photo of where they waited, and your order shows “We couldn’t deliver your order” with that photo.',
          'If something went wrong (the address was right, nobody notified you), write to us from that same order with “Problems with your order? Tell us.”',
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
            'After the wait, on an order paid in person: no safe-spot drop-off and the “The customer didn’t pay” button.',
            'If you don’t show up, the driver closes the order.',
          ),
          foto(
            'pedido-no-entregado',
            'en',
            'The customer’s order after the driver couldn’t find them: “Order canceled,” the receipt, and the button to report the problem.',
            'Your order shows what happened, and you can ask for help.',
          ),
        ],
        preguntas: [
          'What happens if I’m not there when the driver arrives?',
          'Why does my order say “Order canceled” or “We couldn’t deliver your order”?',
        ],
        pasos: [
          'Keep your phone handy while your order is on the way.',
          'If we tell you the driver arrived and can’t find you, go out to meet them or message them in the chat.',
          'If you didn’t make it in time, open your order to see what happened and, if something went wrong, tap “Problems with your order? Tell us.”',
        ],
      },
    ],
    drivers: [
      {
        id: 'driver-cash-mobile-payment-venezuela',
        titulo: 'Collect orders in person: cash and mobile payment',
        resumen:
          'For orders paid on delivery, you collect at the customer’s door and confirm mobile payments with “Yes, it arrived” or “It didn’t arrive.”',
        explicacion: [
          'When the customer pays on delivery, at their door your app shows “Collect from the customer” with the amount without the tip and its equivalent in bolívares at the day’s rate.',
          'For cash, enter what you received and tap “Collected.” For mobile payment, check your bank and tap “Yes, the mobile payment arrived” or “It didn’t arrive.” If the transfer hasn’t shown up yet, tap “The transfer hasn’t arrived yet.”',
          'If the customer isn’t there, tap “Customer isn’t here”: we notify them and you wait a few minutes. An order paid in person is never left in a safe spot: after the wait, tap “The customer didn’t pay” and take the food back to the restaurant.',
          'A cash tip is yours and isn’t counted in the collection.',
        ],
        capturas: [
          foto(
            'driver-cobro',
            'en',
            'The “Collect from the customer” card with the amount in US dollars and bolívares, and the buttons to confirm the cash or mobile payment.',
            'At the door you collect and confirm the mobile payment.',
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
            'An order paid in person isn’t left in a safe spot: the “The customer didn’t pay” button.',
            'After the wait, close it with “The customer didn’t pay.”',
          ),
        ],
        preguntas: [
          'How do I collect a cash order?',
          'How do I confirm a mobile payment arrived?',
          'What do I do if the customer isn’t there?',
        ],
        pasos: [
          'At the door, check the amount to collect under “Collect from the customer.”',
          'For cash, enter what you received and tap “Collected.”',
          'For mobile payment, check your bank and tap “Yes, the mobile payment arrived” or “It didn’t arrive.”',
          'If the customer isn’t there, tap “Customer isn’t here” and wait; when time is up, tap “The customer didn’t pay.”',
        ],
      },
      {
        id: 'driver-commission-balance-top-up',
        titulo: 'Your fee balance and how to top it up with a code',
        resumen:
          'Fees for orders you collect in person come out of your balance; the app tells you how many orders it covers, and you top up with a code.',
        explicacion: [
          'In countries where you collect in person, the Divoox fee isn’t taken from a card payment: it comes out of your fee balance. It’s reserved when you accept the order and charged when you deliver; if the order is canceled, it goes back to your balance.',
          'Under “Earnings” you see your available balance, what’s reserved in orders, and an estimate of how many orders (and rides, if you drive Moto or Car) it covers. When it’s running low, the notice turns red.',
          'To top up, you pay at an authorized sales point and get a code. Enter it under “Top-up code” and tap “Top up with the code”: the balance is added right away.',
          'Without a balance, you don’t receive orders paid in person.',
        ],
        capturas: [
          foto(
            'driver-saldo',
            'en',
            'The fee balance under Earnings: available, reserved in orders, “Enough for about N orders,” and the top-up code box.',
            'Your balance, how many orders it covers, and the code top-up.',
          ),
        ],
        preguntas: [
          'Where does the fee for a cash order come from?',
          'How do I top up my balance with a code?',
          'How many orders does my balance cover?',
        ],
        pasos: [
          'In the app, tap “Earnings” and check your fee balance.',
          'To top up, enter the sales point code under “Top-up code” and tap “Top up with the code.”',
        ],
      },
    ],
  },
};

/** Junta las listas por sección: Comida en Venezuela y luego Flex y Envíos. */
function juntar(idioma: Idioma): PorSeccion {
  const a = new Map(Object.entries(idioma === 'es' ? COMIDA_VE.es : COMIDA_VE.en));
  const b = new Map(Object.entries(idioma === 'es' ? GUIAS_FLEX_ENVIOS.es : GUIAS_FLEX_ENVIOS.en));
  const ids = new Set([...a.keys(), ...b.keys()]);
  return Object.fromEntries(
    [...ids].map((id) => [id, [...(a.get(id) ?? []), ...(b.get(id) ?? [])]]),
  ) as PorSeccion;
}

export const GUIAS_SEMANA: Record<Idioma, PorSeccion> = { es: juntar('es'), en: juntar('en') };
