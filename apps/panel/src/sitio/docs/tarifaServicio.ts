import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-QUIEN-PAGA-VIAJES (23 nov 2026) — donde la comisión de Divoox sale del saldo del conductor (hoy,
 * Venezuela). Dos guías públicas, en español e inglés: la del pasajero («La tarifa de servicio de
 * Divoox», sección «Pedir») y la del conductor («Cuánto cobro y cuánto es mío», sección
 * «Conductores»). Lo del panel (la palanca) va en la ayuda interna, nunca aquí.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-tarifa-servicio.mjs` con las apps web del
 * cliente y del Driver contra el servidor local del recorrido y las deja en
 * `apps/panel/public/docs/recorrido-tarifa-<nombre>-<es|en>.webp`. En inglés se recorta solo lo que
 * muestra la tarifa (dólares, sin bolívares ni direcciones de Venezuela: C-CAPTURAS-POR-IDIOMA).
 */
export const TARIFA_SERVICIO_PUBLICADA = true;

export const CAPTURAS_TARIFA_SERVICIO = {
  es: ['pedir', 'viaje-cliente', 'oferta', 'viaje-driver'],
  en: ['pedir', 'oferta', 'viaje-driver'],
} as const;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-tarifa-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

type Par = { pasajero: Guia; conductor: Guia };

export const GUIAS_TARIFA_SERVICIO: Record<Idioma, Par> = {
  es: {
    pasajero: {
      id: 'ride-service-fee',
      titulo: 'La tarifa de servicio de Divoox en tu viaje',
      resumen:
        'En algunas ciudades, al precio de tu viaje se le suma una línea aparte: la tarifa de servicio de Divoox. La ves antes de pedir, ya sumada en el total, y nunca cambia después.',
      explicacion: [
        'Cuando pides una moto o un carro, la app te muestra el precio fijo del viaje antes de pedirlo. En las ciudades donde aplica, debajo del total ves dos líneas: «Viaje», que es lo que recibe tu conductor, y «Tarifa de servicio de Divoox», que es lo que cobra Divoox por conectar el viaje.',
        'La tarifa ya está sumada en el total que ves arriba. No hay nada escondido: lo que ves antes de pedir es lo que pagas, y el precio queda fijo para ese viaje.',
        'Si pagas en efectivo o por pago móvil, le pagas el total al conductor y él se encarga de entregarle a Divoox su parte. No tienes que hacer nada más.',
        'En algunas ciudades la tarifa de servicio es la mitad de lo que cobra Divoox, porque la otra mitad la pone el conductor. Lo ves igual, en su propia línea, antes de pedir.',
        'Si tienes un regalo de Divoox que cubre tu viaje, el regalo también cubre la tarifa de servicio: no pagas nada en mano.',
        'La tarifa aparece también en tu viaje en curso y en el recibo de «Mis viajes».',
      ],
      capturas: [
        foto(
          'pedir',
          'es',
          'La tarjeta del precio antes de pedir una moto: precio fijo 1,50 dólares; debajo, Viaje 1,36 y Tarifa de servicio de Divoox 0,14, con la explicación de que ya está sumada en el total, el monto en bolívares y las formas de pago.',
          'Antes de pedir: el viaje y la tarifa de servicio, cada uno en su línea, y el total arriba.',
        ),
        foto(
          'viaje-cliente',
          'es',
          'El viaje en curso del pasajero: recogida, destino, precio fijo 1,50 dólares y la línea Tarifa de servicio de Divoox 0,14, con lo que le paga al conductor.',
          'En tu viaje en curso, la tarifa sigue a la vista.',
        ),
      ],
      preguntas: [
        '¿Qué es la tarifa de servicio de Divoox?',
        '¿Por qué mi viaje tiene una tarifa de servicio?',
        '¿A quién le pago la tarifa de servicio?',
        '¿El conductor recibe todo el precio del viaje?',
      ],
      pasos: [
        'Escribe a dónde vas: la app te muestra el precio fijo.',
        'Mira las dos líneas debajo del total: «Viaje» y «Tarifa de servicio de Divoox».',
        'Elige cómo pagas y pide tu viaje. Al llegar, le pagas el total al conductor.',
      ],
    },
    conductor: {
      id: 'driver-service-fee',
      titulo: 'Cuánto cobro y cuánto es mío',
      resumen:
        'Cuando el pasajero paga la tarifa de servicio de Divoox, la cobras en mano junto con el viaje. Tu app te dice cuánto cobras, cuánto es tuyo y cuánto es de Divoox, antes de aceptar.',
      explicacion: [
        'En las ciudades donde el pasajero paga la tarifa de servicio de Divoox, el precio que ves al recibir la oferta ya la incluye. Debajo de «Cobras» tienes una línea que lo dice todo: «Cobras 1,50 · 1,36 son tuyos · 0,14 son de Divoox».',
        'Lo tuyo es el precio completo del viaje. Lo de Divoox es la tarifa de servicio que pagó el pasajero: no es una comisión sobre tu ganancia.',
        'Como el pasajero te paga todo en mano (en efectivo o por pago móvil), al terminar el viaje la parte de Divoox sale de tu saldo prepago. Por eso necesitas saldo para recibir viajes, igual que siempre.',
        'En algunas ciudades la comisión se reparte mitad y mitad: el pasajero paga la mitad como tarifa de servicio y la otra mitad sale de tu ganancia. La misma línea te lo dice, con cada monto.',
        'La cuenta es la misma en la oferta, durante el viaje y al terminar. Si el precio cambia porque el pasajero agrega o quita una parada, la cuenta se pone al día sola.',
      ],
      capturas: [
        foto(
          'oferta',
          'es',
          'La oferta de un viaje en Divoox Driver: Ganas 1,36 dólares; Cobras en efectivo al terminar 1,50 dólares con su monto en bolívares; y la línea Cobras 1,50 · 1,36 son tuyos · 0,14 son de Divoox, con la explicación de la tarifa de servicio.',
          'En la oferta, antes de aceptar: cuánto cobras, cuánto es tuyo y cuánto es de Divoox.',
        ),
        foto(
          'viaje-driver',
          'es',
          'El viaje en curso en Divoox Driver: cobra en efectivo 1,50 dólares, con su monto en bolívares y la misma línea de cuánto es tuyo y cuánto es de Divoox.',
          'Durante el viaje, la misma cuenta.',
        ),
      ],
      preguntas: [
        '¿Cuánto cobro al pasajero y cuánto es mío?',
        '¿Qué es la tarifa de servicio que pagó el pasajero?',
        '¿Por qué sale dinero de mi saldo si el pasajero pagó la tarifa?',
        '¿La tarifa de servicio es una comisión sobre mi ganancia?',
      ],
      pasos: [
        'Mira la línea debajo de «Cobras» en la oferta: cuánto cobras, cuánto es tuyo y cuánto es de Divoox.',
        'Acepta el viaje si te conviene. Necesitas saldo para la parte de Divoox.',
        'Al terminar, cobra el total en mano. La parte de Divoox sale sola de tu saldo.',
      ],
    },
  },
  en: {
    pasajero: {
      id: 'ride-service-fee',
      titulo: 'The Divoox service fee on your ride',
      resumen:
        'In some cities, a separate line is added to your ride price: the Divoox service fee. You see it before you request, already included in the total, and it never changes afterward.',
      explicacion: [
        'When you request a moto or a car, the app shows the upfront price before you request it. In the cities where it applies, under the total you see two lines: “Ride fare,” which is what your driver gets, and “Divoox service fee,” which is what Divoox charges for connecting the ride.',
        'The fee is already included in the total at the top. Nothing is hidden: what you see before you request is what you pay, and the price stays fixed for that ride.',
        'If you pay in cash, you pay the total to your driver, who passes the Divoox part along. There is nothing else for you to do.',
        'In some cities the service fee is half of what Divoox charges, because your driver covers the other half. You see it the same way, on its own line, before you request.',
        'If you have a Divoox gift that covers your ride, the gift also covers the service fee: you pay nothing in hand.',
        'The fee also shows on your ride in progress and on the receipt in “My rides.”',
      ],
      capturas: [
        foto(
          'pedir',
          'en',
          'The price card before requesting a moto: upfront price 1.50 dollars; below it, Ride fare 1.36 and Divoox service fee 0.14, with a note that it is already included in the total.',
          'Before you request: the ride fare and the service fee, each on its own line, with the total at the top.',
        ),
        foto(
          'oferta',
          'en',
          'What the driver sees: You collect 1.50 · 1.36 is yours · 0.14 goes to Divoox, with a note that the 0.14 is the service fee paid by the rider.',
          'Your driver sees the same numbers: the full ride fare is theirs.',
        ),
        foto(
          'viaje-driver',
          'en',
          'The same breakdown on the driver’s ride in progress: You collect 1.50 · 1.36 is yours · 0.14 goes to Divoox.',
          'The same total for you and your driver, from the request to the end of the ride.',
        ),
      ],
      preguntas: [
        'What is the Divoox service fee?',
        'Why does my ride have a service fee?',
        'Who do I pay the service fee to?',
        'Does my driver get the full ride price?',
      ],
      pasos: [
        'Enter where you are going: the app shows the upfront price.',
        'Check the two lines under the total: “Ride fare” and “Divoox service fee.”',
        'Choose how you pay and request your ride. When you arrive, pay the total to your driver.',
      ],
    },
    conductor: {
      id: 'driver-service-fee',
      titulo: 'How much I collect and how much is mine',
      resumen:
        'When the rider pays the Divoox service fee, you collect it in hand along with the ride. Your app tells you how much you collect, how much is yours and how much goes to Divoox, before you accept.',
      explicacion: [
        'In the cities where the rider pays the Divoox service fee, the amount you see on the offer already includes it. Under the amount you collect there is one line that says it all: “You collect 1.50 · 1.36 is yours · 0.14 goes to Divoox.”',
        'What is yours is the full ride fare. What goes to Divoox is the service fee the rider paid: it is not a fee on your earnings.',
        'Because the rider pays you everything in hand, when the ride ends the Divoox part comes out of your prepaid balance. That is why you need balance to receive rides, as always.',
        'In some cities the fee is split half and half: the rider pays half as a service fee and the other half comes out of your earnings. The same line shows you each amount.',
        'The breakdown is the same on the offer, during the ride and at the end. If the price changes because the rider adds or removes a stop, it updates on its own.',
      ],
      capturas: [
        foto(
          'oferta',
          'en',
          'The breakdown on a ride offer in Divoox Driver: You collect 1.50 · 1.36 is yours · 0.14 goes to Divoox, with a note that the 0.14 is the service fee paid by the rider and comes out of the balance when the ride ends.',
          'On the offer, before you accept: how much you collect, how much is yours and how much goes to Divoox.',
        ),
        foto(
          'viaje-driver',
          'en',
          'The same breakdown on the ride in progress in Divoox Driver.',
          'During the ride, the same breakdown.',
        ),
        foto(
          'pedir',
          'en',
          'What the rider saw before requesting: upfront price 1.50, with Ride fare 1.36 and Divoox service fee 0.14 on separate lines.',
          'The rider saw the same total, with the fee on its own line.',
        ),
      ],
      preguntas: [
        'How much do I collect from the rider and how much is mine?',
        'What is the service fee the rider paid?',
        'Why does money come out of my balance if the rider paid the fee?',
        'Is the service fee a fee on my earnings?',
      ],
      pasos: [
        'Read the line under the amount you collect on the offer: what you collect, what is yours and what goes to Divoox.',
        'Accept the ride if it works for you. You need balance for the Divoox part.',
        'When the ride ends, collect the total in hand. The Divoox part comes out of your balance on its own.',
      ],
    },
  },
};
