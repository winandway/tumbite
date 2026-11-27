import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';
import { GUIAS_FLEX_ENVIOS } from './semanaFlexEnvios';
import { GUIAS_FOTO_PUERTA } from './fotoPuerta';
import { GUIAS_MODERACION } from './moderacion';
import { GUIAS_FLEX_BLOQUE } from './flexBloque';
import { GUIAS_SERVICIOS_CONECTADOS } from './serviciosConectados';
import { GUIAS_PLAZO_PERFIL } from './plazoPerfil';

/**
 * C-DOCS-SEMANA (14 nov 2026): las guías públicas de lo construido la semana del 9 al 14 de noviembre,
 * con capturas REALES. Comida en Venezuela (desde el 22 nov 2026 la comida se le paga al restaurante
 * por pago móvil, C-COMIDA-PAGO-RESTAURANTE; «sí me llegó» del envío, el saldo para comisiones
 * y el cliente que no aparece) tomadas en El Vigía con `scripts/recorrido/capturas-comida-venezuela.mjs`;
 * Divoox Flex y Envíos de A a B en su propio archivo (`semanaFlexEnvios.ts`). Cada lista va al final de
 * su sección de Docs.
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

// C-CAPTURAS-POR-IDIOMA (15 nov 2026): el español se enseña con El Vigía (`comida-ve`); el inglés, con
// Novi, Michigan (`comida-us`), como funciona Comida en Estados Unidos: se paga con tarjeta en la app.
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  // Las de Venezuela van en su tercera versión (22 nov 2026): la comida se le paga al restaurante.
  src: `/docs/recorrido-comida-${idioma === 'en' ? 'us-' + nombre + '-v2' : 've-' + nombre + '-v3'}-${idioma}.webp`,
  alt,
  pie,
});

const COMIDA_VE: Record<Idioma, PorSeccion> = {
  es: {
    ordering: [
      {
        id: 'pay-on-delivery-venezuela',
        titulo: 'Pagar tu comida en Venezuela: pago móvil al restaurante y el envío al conductor',
        resumen:
          'En Venezuela pagas solo la comida, al precio de la carta, directo al restaurante por pago móvil, y el envío se lo pagas al conductor cuando te entrega. Sin tarifa de servicio ni cargo por pedido pequeño. Ves el monto exacto en bolívares.',
        explicacion: [
          'En Venezuela la comida se la pagas al restaurante, no al conductor. En el carrito eliges solo cómo pagas el envío: «Envío en efectivo» o «Envío por pago móvil al conductor». No hace falta tarjeta. La comida no se paga en efectivo: va por pago móvil; en efectivo puedes pagar el envío. Lo que pagas es la comida al mismo precio de la carta del restaurante y el envío. No hay tarifa de servicio ni cargo por pedido pequeño: el carrito te muestra solo la comida, el envío, la propina si quieres dejarla y el total. La propina es voluntaria y es toda del conductor.',
          'Cuando el restaurante acepta tu pedido y ya hay un conductor para llevarlo, en tu pedido aparece «Paga la comida al restaurante» con el monto exacto en bolívares, el banco, el teléfono, el documento y el nombre del titular. Cada dato tiene su botón «Copiar» para pegarlo en la app de tu banco. Antes de eso no pagues nada: la pantalla te avisa cuándo.',
          'El monto en bolívares queda fijo durante quince minutos, con la tasa del día a la vista. Paga desde tu banco, escribe el número de referencia que te dio y toca «Ya pagué». Si quieres, agrega el banco desde el que pagaste y una captura: ayudan si hay un reclamo. Si se acaba el tiempo sin que pagues, el pedido se cancela solo y la pantalla te lo dice: no pagues ese monto, haz el pedido otra vez.',
          'El restaurante revisa su banco y confirma. En tu pedido ves «El restaurante confirmó tu pago. Ya está preparando tu pedido». Si dice que no le llegó, puedes corregir la referencia ahí mismo y nuestro equipo lo revisa contigo. Y si un pedido se cancela después de confirmado tu pago, el restaurante te devuelve el dinero por pago móvil y en tu pedido ves la referencia de esa devolución.',
          'Cuando llega tu pedido le pagas al conductor solo el envío, en efectivo o por pago móvil a la cuenta que ves en el seguimiento. La propina en efectivo es toda suya.',
        ],
        capturas: [
          foto(
            'carrito-pago',
            'es',
            'El carrito avisa que la comida se paga al restaurante por pago móvil y deja elegir cómo se paga el envío: en efectivo o por pago móvil al conductor.',
            'En el carrito eliges cómo pagas el envío.',
          ),
          foto(
            'pago-comida-datos',
            'es',
            '«Paga la comida al restaurante»: el monto exacto en bolívares con la tasa del día, el banco, el teléfono, el documento y el titular, cada uno con su botón Copiar, y el tiempo que vale el monto.',
            'Los datos del restaurante y el monto exacto, listos para copiar.',
          ),
          foto(
            'pago-comida-referencia',
            'es',
            'La casilla «Número de referencia» ya escrita, el banco opcional, «Agregar captura (opcional)» y el botón «Ya pagué».',
            'Escribes tu referencia y tocas «Ya pagué».',
          ),
          foto(
            'pago-comida-confirmado',
            'es',
            'El pedido con «El restaurante confirmó tu pago. Ya está preparando tu pedido» y el envío que se paga al conductor al recibir.',
            'El restaurante confirma y empieza a preparar.',
          ),
          foto(
            'pedido-cliente',
            'es',
            'El seguimiento del pedido en camino: el recibo, el pago de la comida confirmado y «El envío lo pagas al recibir» con el nombre del conductor y su pago móvil.',
            'Al recibir le pagas al conductor solo el envío.',
          ),
        ],
        preguntas: [
          '¿Cómo pago mi comida en Venezuela?',
          '¿Puedo pagar la comida en efectivo?',
          '¿A quién le hago el pago móvil de la comida?',
          '¿Dónde escribo el número de referencia?',
          '¿Qué le pago al conductor cuando llega?',
          '¿Cuánto es en bolívares?',
          '¿Divoox me cobra una tarifa de servicio en Venezuela?',
        ],
        pasos: [
          'Arma tu pedido, abre el carrito y elige cómo pagas el envío.',
          'Haz el pedido y espera el aviso: cuando aparezca «Paga la comida al restaurante», copia los datos y el monto exacto.',
          'Paga por pago móvil desde la app de tu banco, antes de que se acabe el tiempo.',
          'Escribe el número de referencia y toca «Ya pagué».',
          'Cuando el restaurante confirme, tu pedido se prepara y sale. Al recibirlo, págale al conductor solo el envío.',
        ],
        nota: 'Paga el monto exacto en bolívares que ves en la pantalla y escribe bien la referencia: así el restaurante encuentra tu pago rápido.',
      },
      {
        id: 'order-not-delivered',
        titulo: 'Si no estabas cuando llegó el repartidor',
        resumen:
          'Si el repartidor llega y no te encuentra, te avisamos y te espera unos minutos. Si no apareces, el pedido se cierra y lo ves en tu pedido.',
        explicacion: [
          'Cuando el repartidor llega a tu puerta y no te encuentra, toca «El cliente no aparece»: te avisamos al celular y él te espera unos minutos mientras te escribe por el chat.',
          'Si pasa la espera y no apareces, en los pedidos que se pagan al recibir la comida no se deja en la puerta: el repartidor cierra el pedido y en tu pedido ves «Pedido cancelado». Lo que quedó sin pagar queda como saldo pendiente con Divoox y hay que resolverlo con soporte antes de volver a pedir.',
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
        titulo: 'Pedidos de comida en Venezuela: no pagas en el local y cobras solo el envío',
        resumen:
          'En Venezuela el cliente le paga la comida directo al restaurante. Tú no adelantas dinero: esperas el aviso, recoges y en la puerta cobras solo el envío, en efectivo o por pago móvil. El envío es todo tuyo.',
        explicacion: [
          'En los pedidos de comida de Venezuela ya no pagas la comida en el mostrador. El cliente se la paga al restaurante por pago móvil cuando tú ya aceptaste el pedido.',
          'Mientras el cliente paga, tu app dice «Espera un momento». Cuando el restaurante confirma que le llegó el dinero, cambia a «Ya puedes ir al restaurante»: ahí sales a recoger. En el local no pagas nada, solo recoges el pedido.',
          'En la puerta del cliente tu app muestra «Cobra al cliente» con el monto del envío, sin la propina, y su equivalente en bolívares a la tasa del día. En efectivo, escribe lo que recibiste y toca «Cobré». Por pago móvil, revisa tu banco y toca «Sí, me llegó el pago móvil» o «No me llegó».',
          'Si el cliente no aparece, toca «El cliente no aparece»: le avisamos y esperas unos minutos. Un pedido que se cobra en mano nunca se deja en un lugar seguro: pasada la espera, toca «El cliente no pagó» y lleva la comida de vuelta al restaurante. El envío que cobras es todo tuyo: en estos pedidos Divoox no te descuenta nada y no necesitas saldo para recibirlos. La propina en efectivo también es tuya: no se cuenta en el cobro.',
        ],
        capturas: [
          foto(
            'driver-espera-pago',
            'es',
            'El pedido en Divoox Driver con «Espera un momento»: el cliente le está pagando la comida al restaurante y al entregar se cobra solo el envío.',
            'Mientras el cliente paga, esperas sin adelantar nada.',
          ),
          foto(
            'driver-salida',
            'es',
            '«Ya puedes ir al restaurante»: el restaurante confirmó el pago de la comida y el conductor no paga nada en el local.',
            'Con el pago confirmado, sales a recoger.',
          ),
          foto(
            'driver-cobro',
            'es',
            'La tarjeta «Cobra al cliente» con el monto del envío en dólares y en bolívares, y los botones Sí, me llegó el pago móvil, No me llegó y El cliente no pagó.',
            'En la puerta cobras solo el envío.',
          ),
        ],
        preguntas: [
          '¿Tengo que pagar la comida en el restaurante?',
          '¿Cuándo salgo a recoger el pedido?',
          '¿Cuánto le cobro al cliente en la puerta?',
          '¿Cómo confirmo que me llegó el pago móvil?',
          '¿Qué hago si el cliente no aparece?',
          '¿Divoox me descuenta algo del envío de la comida?',
        ],
        pasos: [
          'Acepta el pedido y espera mientras el cliente le paga al restaurante. Cuando veas «Ya puedes ir al restaurante», ve a recoger: no pagas nada en el local.',
          'En la puerta, mira el monto del envío en «Cobra al cliente».',
          'En efectivo, escribe lo que recibiste y toca «Cobré». Por pago móvil, revisa tu banco y toca «Sí, me llegó el pago móvil» o «No me llegó».',
          'Si el cliente no aparece, toca «El cliente no aparece» y espera; pasado el tiempo, toca «El cliente no pagó».',
        ],
      },
      {
        id: 'driver-commission-balance-top-up',
        titulo: 'Tu saldo para comisiones y cómo recargarlo con un código',
        resumen:
          'Las comisiones de lo que cobras en mano salen de tu saldo; la app te dice para cuánto te alcanza y recargas con un código. En la comida que el cliente le paga al restaurante, el envío es todo tuyo.',
        explicacion: [
          'En los países donde cobras en mano, la comisión de Divoox no se descuenta de un pago con tarjeta: sale de tu saldo para comisiones. Se aparta al aceptar el pedido y se cobra al entregar; si el pedido se cancela, vuelve a tu saldo.',
          'En «Ganancias» ves tu saldo disponible, lo apartado en pedidos y una estimación de para cuántos pedidos (y viajes, si haces Moto o Carro) te alcanza. Cuando queda poco, el aviso sale en rojo.',
          'Para recargar, pagas en un punto de venta autorizado y te dan un código. Lo escribes en «Código de recarga» y tocas «Recargar con el código»: el saldo se suma al momento.',
          'En Venezuela, en los pedidos de comida que el cliente le paga directo al restaurante, cobras el envío entero: no se te aparta nada y no necesitas saldo para recibirlos. La app te lo dice en verde en tu saldo. Sin saldo no recibes lo que sí cobra comisión, como las carreras de Moto y Carro.',
        ],
        capturas: [
          foto(
            'driver-saldo',
            'es',
            'El saldo para comisiones en Ganancias: disponible, apartado en carreras y pedidos, el aviso en verde de que en la comida cobras el envío entero y la casilla del código de recarga.',
            'Tu saldo, lo que no se te descuenta y la recarga por código.',
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
    restaurants: [
      {
        id: 'restaurant-direct-payment-venezuela',
        titulo: 'Recibir el pago de la comida por pago móvil y confirmar «Me llegó»',
        resumen:
          'En Venezuela tus clientes te pagan la comida directo a tu pago móvil, al precio de tu carta. Tú revisas tu banco, tocas «Me llegó» y recién ahí preparas el pedido. Recibes el 100 % de la comida: Divoox no recibe ese dinero.',
        explicacion: [
          'Primero agrega tu cuenta en «Cuenta para recibir tus ventas», en el inicio de tu app: banco, teléfono del pago móvil, documento y titular. Sin esa cuenta todavía no recibes pedidos. Cambiarla pide tu contraseña. El cliente te paga el precio de tu carta, completo, y le paga el envío al conductor. La comisión de Divoox no se descuenta del pago del cliente: sale del saldo de tu restaurante cuando tocas «Me llegó». Hoy empezar es gratis; tu comisión de hoy siempre está en «Saldo de tu restaurante».',
          'Cuando entra un pedido, lo aceptas como siempre. Aseguramos un conductor y recién entonces el cliente te paga: mientras tanto la fila del pedido dice «Esperando el pago del cliente: no prepares todavía».',
          'Cuando el cliente paga, la fila se pone amarilla con «Pago por confirmar». Ábrela: ves el monto en bolívares y el número de referencia. Abre la app de tu banco y busca ese pago por el monto y la referencia.',
          'Si lo ves en tu banco, toca «Me llegó»: ya puedes preparar el pedido y el conductor sale a recogerlo. Confirma solo lo que veas en tu banco: una captura del cliente no es prueba.',
          'Si no aparece, toca «No me llegó». El cliente puede corregir su referencia y nuestro equipo revisa el caso. Si después lo encuentras, toca «Ya lo vi en mi banco: sí me llegó». No puedes marcar un pedido como listo sin haber confirmado su pago, y el conductor no te paga nada en el mostrador: solo recoge. Si un pedido se cancela después de que confirmaste el pago, tu app te pide devolverle ese monto al cliente por pago móvil y escribir la referencia de la devolución.',
        ],
        capturas: [
          foto(
            'rest-cuenta-cobro',
            'es',
            'El inicio de la app Divoox Merchant con «Cuenta para recibir tus ventas»: el titular, el banco, el teléfono y el documento, y el botón «Cambiar cuenta».',
            'Tu pago móvil, donde te pagan tus clientes.',
          ),
          foto(
            'rest-fila-pago',
            'es',
            'La lista «En cocina y por salir» con un pedido resaltado en amarillo y el aviso «Pago por confirmar: abre el pedido y mira tu banco».',
            'La fila te avisa cuando hay un pago por confirmar.',
          ),
          foto(
            'rest-pago-por-confirmar',
            'es',
            'El pedido abierto con «Pago de la comida»: lo que el cliente dice que pagó en bolívares, su número de referencia y los botones «Me llegó» y «No me llegó».',
            'Revisas tu banco y confirmas.',
          ),
          foto(
            'rest-pago-confirmado',
            'es',
            'El mismo pedido con «Pago confirmado. Ya puedes preparar el pedido» y el botón «Marcar como listo».',
            'Con el pago confirmado, preparas y marcas listo.',
          ),
        ],
        preguntas: [
          '¿Cómo me pagan los clientes la comida?',
          '¿Dónde pongo mi pago móvil?',
          '¿Cómo confirmo que me llegó un pago?',
          '¿Qué hago si el pago no me llegó?',
          '¿El conductor me paga en el mostrador?',
        ],
        pasos: [
          'En el inicio de tu app, agrega tu pago móvil en «Cuenta para recibir tus ventas».',
          'Acepta el pedido y espera: no lo prepares hasta que el cliente pague.',
          'Cuando la fila diga «Pago por confirmar», ábrela y busca el pago en la app de tu banco, por el monto y la referencia.',
          'Si lo ves, toca «Me llegó», prepara el pedido y toca «Marcar como listo». Si no lo ves, toca «No me llegó».',
        ],
        nota: 'Confirma solo lo que veas en tu banco. Una captura se puede editar; el movimiento en tu cuenta, no.',
      },
      {
        id: 'restaurant-balance-venezuela',
        titulo: 'El saldo de tu restaurante',
        resumen:
          'Tu restaurante tiene un saldo en la app, de donde sale la comisión de Divoox. Para empezar es gratis: tu comisión es 0 % y no necesitas saldo para recibir pedidos.',
        explicacion: [
          'En el inicio de tu app, debajo de tu cuenta de pago móvil, está «Saldo de tu restaurante» con lo que tienes disponible. Para empezar, tu comisión de Divoox es 0 %: recibes completo lo que tus clientes te pagan, directo en tu pago móvil, y no necesitas saldo para recibir pedidos. La app te lo dice en verde: «Gratis para empezar». Al empezar, nuestro equipo te puede cargar un saldo de regalo: lo ves sumado en tu disponible.',
          'El saldo funciona como el de los conductores. Si más adelante tu restaurante tiene una comisión, te avisaremos antes con el porcentaje exacto, y la app te muestra cuánto sería en un pedido de 10. Se cobra una sola vez por pedido, sobre la comida, cuando confirmas «Me llegó», y queda fija con lo que regía cuando el cliente hizo el pedido. Con comisión y sin saldo suficiente, no recibes pedidos nuevos hasta recargar. Mientras sea 0 % no hace falta recargar; la app misma te dice si las recargas todavía no están disponibles.',
        ],
        capturas: [
          foto(
            'rest-saldo',
            'es',
            '«Saldo de tu restaurante» en el inicio de la app: el disponible, el aviso en verde «Gratis para empezar» con la comisión en 0 % y que las recargas todavía no están disponibles.',
            'Tu saldo y tu comisión de hoy: gratis para empezar.',
          ),
        ],
        preguntas: [
          '¿Cuánto me cobra Divoox por vender?',
          '¿Tengo que recargar saldo para recibir pedidos?',
          '¿Para qué sirve el saldo de mi restaurante?',
          '¿Cuándo sale la comisión de mi saldo?',
        ],
        pasos: [
          'Abre tu app y mira «Saldo de tu restaurante» en el inicio.',
          'Revisa la línea en verde: ahí dice tu comisión de hoy.',
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
          'The tip you add in the app goes to your driver in full. Paying in cash or by bank transfer on delivery is offered only in countries where Divoox collects in person; it isn’t available in the United States. In those countries the customer pays only for the food, at menu price, directly to the restaurant, plus the delivery fee to the driver, with no service fee.',
          'Your card is authorized when you order and charged when the order is delivered. If you cancel before the restaurant accepts, you aren’t charged.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-mano-en.webp',
            alt: 'The cart in the Divoox app with “Hand it to me” selected as the way to receive the order.',
            pie: 'In the cart you choose how to receive your order.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-en.webp',
            alt: 'The order screen right after paying by card, with the order confirmed.',
            pie: 'Once you pay, your order is confirmed.',
          },
          foto(
            'carrito',
            'en',
            'The cart for an order from a restaurant: the item in US dollars, when you want it and how you want to receive it.',
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
          'When your order arrives there is nothing left to pay: just receive it.',
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
          'If the customer chose “Hand it to me,” ask for their 4-digit PIN, enter it and slide the bar “Slide: handed to the customer.” An order with a PIN can’t be left with a photo.',
          'If the customer isn’t there, tap “Customer isn’t here”: we notify them and you wait a few minutes while you message or call them. After the wait, on an order with a PIN, tap “Customer didn’t show: close with photo” and take a photo of the door or the spot: the order is closed, you get paid and support is notified.',
          'Collecting cash or a bank transfer at the door applies only in countries where Divoox collects in person. There, on food orders the customer pays the restaurant directly, the driver collects only the delivery fee and keeps all of it. It isn’t used in the United States.',
        ],
        capturas: [
          foto(
            'driver-puerta',
            'en',
            'The order at the customer’s door: the address, “Customer chose: hand it to them,” the PIN box and the “Slide: handed to the customer” bar.',
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
          'For “hand it to them,” ask for the PIN, enter it and slide the bar “Slide: handed to the customer.”',
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
          'A fee balance exists only in countries where drivers collect orders in person: there, the Divoox fee comes out of a prepaid balance that the driver tops up with a code from a sales point. On food orders paid directly to the restaurant, the driver keeps the whole delivery fee and needs no balance.',
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
    restaurants: [
      {
        id: 'restaurant-direct-payment-venezuela',
        titulo: 'How customers pay for the orders you receive',
        resumen:
          'In the United States every order reaches your restaurant already paid by card in the app, so there is no payment for you to confirm.',
        explicacion: [
          'In the United States, customers pay by card in the app when they order. A new order shows up in your app already paid: you accept it, prepare it and mark it ready.',
          'The driver doesn’t pay you anything at the counter and you don’t collect from the customer.',
          'You don’t need to check your bank before you start cooking: an order only reaches your kitchen once the card payment went through.',
          'The Orders tab keeps every order of the last 24 hours with its items and its total.',
          'In countries where Divoox collects in person, customers pay the restaurant directly by bank transfer, at menu price, and the restaurant confirms each payment in its app before preparing the order. The restaurant keeps the full food amount, and any Divoox fee comes out of its prepaid balance instead. That option isn’t used in the United States.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restapp-pedidos-en.webp',
            alt: 'The Orders tab of the Divoox Merchant app with the orders in progress and the recent ones.',
            pie: 'Every order, with its items and its total.',
          },
          {
            src: '/docs/recorrido-restapp-listo-en.webp',
            alt: 'The Divoox Merchant app with an order marked ready, waiting for the driver.',
            pie: 'Ready: the driver comes to pick it up.',
          },
          {
            src: '/docs/recorrido-restapp-nuevo-en.webp',
            alt: 'The Divoox Merchant app with a new order waiting to be accepted.',
            pie: 'Orders arrive already paid in the app.',
          },
          {
            src: '/docs/recorrido-restapp-preparando-en.webp',
            alt: 'The Divoox Merchant app with an accepted order being prepared and the button to mark it ready.',
            pie: 'You accept, prepare and mark the order ready.',
          },
        ],
        preguntas: [
          'How do customers pay for their orders?',
          'Do I have to confirm a payment before I prepare an order?',
          'Does the driver pay me at the counter?',
        ],
        pasos: [
          'When a new order comes in, accept it: it is already paid.',
          'Prepare the order.',
          'Tap the button to mark it ready.',
          'Hand it to the driver when they arrive.',
        ],
      },
      {
        id: 'restaurant-balance-venezuela',
        titulo: 'Is there a balance to top up for my restaurant?',
        resumen:
          'Not in the United States. Orders are paid by card in the app and your restaurant doesn’t keep a prepaid balance.',
        explicacion: [
          'In the United States your restaurant has no balance to top up: customers pay by card in the app and what you see in your app are your orders and your sales.',
          'A restaurant balance exists only in countries where customers pay the restaurant directly. There, the Divoox Merchant app shows its balance and its current fee, which is free to start; when there is a fee, it comes out of the balance once per order, when the restaurant confirms the payment arrived.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restapp-estadisticas-en.webp',
            alt: 'The Statistics screen of the Divoox Merchant app with the sales of the period.',
            pie: 'Your sales, in the Statistics tab.',
          },
        ],
        preguntas: [
          'Do I need to top up a balance to receive orders?',
          'Where do I see my restaurant’s sales?',
        ],
        pasos: ['Open the Divoox Merchant app.', 'Tap “Statistics” to see your sales.'],
      },
    ],
  },
};

/** Junta las listas por sección: servicios conectados del Driver, Comida en Venezuela, Flex y Envíos, la foto de la puerta y el bloque de Flex. */
function juntar(idioma: Idioma): PorSeccion {
  const a = new Map(Object.entries(idioma === 'es' ? COMIDA_VE.es : COMIDA_VE.en));
  const b = new Map(Object.entries(idioma === 'es' ? GUIAS_FLEX_ENVIOS.es : GUIAS_FLEX_ENVIOS.en));
  const c = new Map(Object.entries(idioma === 'es' ? GUIAS_FOTO_PUERTA.es : GUIAS_FOTO_PUERTA.en));
  const d = new Map(Object.entries(idioma === 'es' ? GUIAS_FLEX_BLOQUE.es : GUIAS_FLEX_BLOQUE.en));
  const f = new Map(
    Object.entries(idioma === 'es' ? GUIAS_SERVICIOS_CONECTADOS.es : GUIAS_SERVICIOS_CONECTADOS.en),
  );
  // C-MODERACION y C-AVISOS-IDIOMA (16 nov 2026).
  const e = new Map(Object.entries(idioma === 'es' ? GUIAS_MODERACION.es : GUIAS_MODERACION.en));
  // C-PLAZO-PAPELES y C-PERFIL-CONDUCTOR (20 nov 2026).
  const g = new Map(
    Object.entries(idioma === 'es' ? GUIAS_PLAZO_PERFIL.es : GUIAS_PLAZO_PERFIL.en),
  );
  const ids = new Set([
    ...g.keys(),
    ...a.keys(),
    ...b.keys(),
    ...c.keys(),
    ...d.keys(),
    ...e.keys(),
    ...f.keys(),
  ]);
  return Object.fromEntries(
    [...ids].map((id) => [
      id,
      [
        ...(f.get(id) ?? []),
        ...(a.get(id) ?? []),
        ...(b.get(id) ?? []),
        ...(c.get(id) ?? []),
        ...(d.get(id) ?? []),
        ...(e.get(id) ?? []),
        ...(g.get(id) ?? []),
      ],
    ]),
  ) as PorSeccion;
}

export const GUIAS_SEMANA: Record<Idioma, PorSeccion> = { es: juntar('es'), en: juntar('en') };
