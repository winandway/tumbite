import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-PRECIO-ZONA (24 nov 2026) — todos los países. La guía pública «El precio de la zona» (sección
 * «Pedir»), en español e inglés, para el pasajero y el conductor: en algunos trayectos cercanos la
 * ciudad tiene un precio fijo acostumbrado y la app cobra el menor. Lo del panel (cómo el equipo
 * escribe las rutas) va en la ayuda interna, nunca aquí. Sin nombres de ciudades ni datos reales.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-precio-zona.mjs` con las apps web del
 * cliente y del Driver contra el servidor local del recorrido, y las deja en
 * `apps/panel/public/docs/recorrido-precio-zona-<nombre>-<es|en>.webp`.
 */
export const PRECIO_ZONA_PUBLICADA = true;

export const CAPTURAS_PRECIO_ZONA = {
  es: ['pedir', 'ida-vuelta', 'oferta'],
  en: ['pedir', 'ida-vuelta', 'oferta'],
} as const;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-precio-zona-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIA_PRECIO_ZONA: Record<Idioma, Guia> = {
  es: {
    id: 'local-fixed-price',
    titulo: 'El precio de la zona',
    resumen:
      'En algunos trayectos cercanos, tu ciudad tiene un precio fijo que se cobra siempre. Si es más barato que el precio por distancia, la app te cobra el precio de la zona y te lo dice antes de pedir.',
    explicacion: [
      'En muchos lugares hay un precio que todos conocen para ir de un sitio a otro cercano. Por la distancia saldría un poco más, pero se acostumbra cobrar ese precio fijo. En Divoox, el equipo de tu ciudad anota esos trayectos con su precio.',
      'Cuando pides una moto, un carro o un envío, la app calcula el precio por distancia y tiempo, como siempre. Si tu recogida y tu destino caen en uno de esos trayectos y el precio de la zona es más barato, pagas el precio de la zona. Si los dos precios son casi iguales, ves el precio de siempre.',
      'Lo ves antes de pedir: arriba de la tarjeta del precio dice «Precio de la zona», con el lugar al que vas. El precio queda fijo para ese viaje, igual que siempre.',
      'Algunos trayectos tienen también precio de ida y vuelta. Si es así, debajo del precio eliges «Solo ida» o «Ida y vuelta». Con ida y vuelta, el conductor te espera en el destino y te trae de vuelta al punto de recogida, por un solo precio. La espera en el destino es como en cualquier parada: unos minutos gratis y, si pasas de ese tiempo, se cobra por minuto de espera, como lo hacen las apps de viajes.',
      'El precio de la zona es para ese trayecto tal cual: un viaje con precio de la zona no admite cambios de paradas una vez pedido. Si necesitas otra cosa (otra parada, otro destino), pide otro viaje. Si pones paradas antes de pedir, el precio se calcula por distancia, como siempre. El de la zona aplica a la categoría de siempre; Comfort, Premium y XL se calculan aparte.',
      'Para el conductor, la oferta dice «Precio de la zona» antes de aceptar, y lo que gana ya sale de ese precio. En un viaje de ida y vuelta, la oferta lo dice también: espera en el destino y vuelve al punto de recogida.',
      'El precio de la zona aparece también en tu recibo de «Mis viajes», en su propia línea.',
    ],
    capturas: [
      foto(
        'pedir',
        'es',
        'La tarjeta del precio antes de pedir una moto: arriba dice Precio de la zona, con el total fijo, y debajo la línea que explica que es el precio que se cobra siempre para ir hasta ese lugar.',
        'Antes de pedir: «Precio de la zona», con el lugar al que vas.',
      ),
      foto(
        'ida-vuelta',
        'es',
        'La misma tarjeta con las dos opciones del trayecto: Solo ida e Ida y vuelta, con el precio de ida y vuelta, y la explicación de que el conductor te espera allá y te trae de vuelta.',
        'Si el trayecto tiene ida y vuelta, eliges una de las dos opciones.',
      ),
      foto(
        'oferta',
        'es',
        'El recuadro Precio de la zona en la oferta de un viaje de ida y vuelta en Divoox Driver, con la explicación de que espera en el destino y vuelve al punto de recogida.',
        'El conductor ve «Precio de la zona» antes de aceptar.',
      ),
    ],
    preguntas: [
      '¿Qué es el precio de la zona?',
      '¿Por qué mi viaje cuesta menos que por la distancia?',
      '¿Cómo pido un viaje de ida y vuelta?',
      '¿Puedo agregar una parada a un viaje con precio de la zona?',
      '¿Se cobra la espera en un viaje de ida y vuelta?',
    ],
    pasos: [
      'Escribe a dónde vas: la app te muestra el precio fijo.',
      'Si el trayecto tiene precio de la zona, arriba de la tarjeta dice «Precio de la zona».',
      'Si hay ida y vuelta, elige «Solo ida» o «Ida y vuelta».',
      'Elige cómo pagas y pide tu viaje.',
    ],
  },
  en: {
    id: 'local-fixed-price',
    titulo: 'Local fixed prices',
    resumen:
      'On some nearby trips, your city has a usual fixed price. If it is cheaper than the distance-based price, the app charges the local fixed price and tells you before you request.',
    explicacion: [
      'In many places there is a price everyone knows for going from one spot to another nearby. By distance it would cost a little more, but people usually charge that fixed price. At Divoox, your city team records those trips with their price.',
      'When you request a moto, a car or a delivery, the app works out the price by distance and time, as always. If your pickup and drop-off fall on one of those trips and the local fixed price is cheaper, you pay the local fixed price. If both prices are almost the same, you see the usual price.',
      'You see it before you request: the price card says “Local fixed price,” with the place you are going. The price stays fixed for that ride, as always.',
      'Some trips also have a round-trip price. If so, under the price you choose “One way” or “Round trip.” With a round trip, your driver waits for you at the drop-off and brings you back to your pickup spot, for one price. Waiting at the drop-off works like any stop: a few free minutes, and after that a per-minute wait fee, the way ride apps do it.',
      'A local fixed price is for that exact trip: once requested, a ride with a local fixed price can’t have its stops changed. If you need something else (another stop, another drop-off), request another ride. If you add stops before requesting, the price is by distance and time, as usual. The local fixed price applies to the standard ride; Comfort, Premium and XL are priced on their own.',
      'For drivers, the offer says “Local fixed price” before accepting, and earnings already come from that price. On a round trip, the offer says so too: wait at the drop-off and come back to the pickup spot.',
      'The local fixed price also shows on your receipt in “My rides,” on its own line.',
    ],
    capturas: [
      foto(
        'pedir',
        'en',
        'The price card before requesting a moto: it says Local fixed price at the top, with the fixed total, and a line underneath explaining it is the usual price to go to that place.',
        'Before you request: “Local fixed price,” with the place you are going.',
      ),
      foto(
        'ida-vuelta',
        'en',
        'The same card with the two trip options: One way and Round trip, with the round-trip price and a note that the driver waits for you there and brings you back.',
        'If the trip has a round trip, you choose one of the two options.',
      ),
      foto(
        'oferta',
        'en',
        'The Local fixed price box on a round-trip ride offer in Divoox Driver, with a note that the driver waits at the drop-off and comes back to the pickup spot.',
        'Drivers see “Local fixed price” before accepting.',
      ),
    ],
    preguntas: [
      'What is a local fixed price?',
      'Why does my ride cost less than the distance-based price?',
      'How do I request a round trip?',
      'Can I add a stop to a ride with a local fixed price?',
      'Is waiting charged on a round trip?',
    ],
    pasos: [
      'Enter where you are going: the app shows the upfront price.',
      'If the trip has a local fixed price, the price card says “Local fixed price.”',
      'If there is a round trip, choose “One way” or “Round trip.”',
      'Choose how you pay and request your ride.',
    ],
  },
};
