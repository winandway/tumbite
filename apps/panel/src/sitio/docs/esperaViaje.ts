import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-ESPERA-VEHICULO (16 nov 2026) — todos los países. La guía pública «Mientras buscamos a tu
 * conductor» (sección «Para pedir»), en español e inglés, con las cuatro esperas reales: carro, moto
 * con pasajero, envío en moto y envío en carro. Las capturas las toma
 * `scripts/recorrido/capturas-espera.mjs` (español en El Vigía, inglés en Novi).
 */
export const CAPTURAS_ESPERA = ['carro', 'moto-pasajero', 'moto-envio', 'carro-envio'] as const;

const foto = (
  nombre: (typeof CAPTURAS_ESPERA)[number],
  idioma: Idioma,
  alt: string,
  pie: string,
): Captura => ({ src: `/docs/recorrido-espera-${nombre}-${idioma}.webp`, alt, pie });

const ES: Guia = {
  id: 'ride-waiting-screen',
  titulo: 'Mientras buscamos a tu conductor',
  resumen:
    'Apenas pides un viaje o un envío, ves una escena con el vehículo que pediste y la ruta con el precio. Casi siempre tarda menos de un minuto, y cancelar es gratis mientras buscamos.',
  explicacion: [
    'Al pedir, Divoox les avisa a los conductores más cerca de tu recogida. Mientras alguien acepta, la pantalla te muestra una escena tranquila con el vehículo de lo que pediste: un carro si pediste Carro, una moto con el casco del pasajero si pediste Moto, una moto con su caja de reparto si mandas un paquete pequeño y un carro con una caja en el techo si mandas algo mediano o grande.',
    'Debajo ves el título de lo que estamos buscando, la recogida, el destino, el vehículo y el precio fijo. En un viaje puedes agregar una parada desde «Parada»; en un envío, «Qué envías» te muestra el paquete y quién lo recibe. «Compartir» manda el enlace del viaje a quien tú quieras.',
    'Si tu teléfono tiene activado «reducir movimiento», la escena se queda quieta. Cuando un conductor acepta, la escena se cambia suavemente por el mapa con el conductor en camino.',
  ],
  capturas: [
    foto(
      'carro',
      'es',
      'La espera de un viaje en Carro: un carro blanco de línea avanza por su carril derecho frente a la ciudad, con el título «Buscando tu conductor», la ruta y el precio.',
      'Carro: buscamos a tu conductor.',
    ),
    foto(
      'moto-pasajero',
      'es',
      'La espera de un viaje en Moto: la moto con el piloto y el casco extra del pasajero, con el título «Buscando tu moto».',
      'Moto: la moto lleva tu casco.',
    ),
    foto(
      'moto-envio',
      'es',
      'La espera de un envío pequeño: la moto con su caja de reparto, el título «Buscando quién lleve tu envío», Recoger y Entregar, y el botón «Qué envías».',
      'Envío pequeño: va en moto con caja de reparto.',
    ),
    foto(
      'carro-envio',
      'es',
      'La espera de un envío grande: el carro con una caja amarrada al techo y el título «Buscando quién lleve tu envío».',
      'Envío mediano o grande: va en carro.',
    ),
  ],
  preguntas: [
    '¿Cuánto tarda en aparecer un conductor?',
    '¿Puedo cancelar mientras buscan?',
    '¿Puedo agregar una parada mientras buscan?',
    '¿Cómo detengo la animación de la pantalla de espera?',
  ],
  pasos: [
    'Pide tu viaje o tu envío como siempre y toca el botón para confirmarlo.',
    'Mira la pantalla de espera: el título dice qué estamos buscando y abajo están la recogida, el destino y el precio fijo.',
    'Si quieres, toca «Parada» para agregar una parada (en un viaje) o «Qué envías» para revisar tu paquete (en un envío).',
    'Toca «Compartir» para mandarle el enlace del viaje a alguien.',
    'Si cambiaste de idea, toca «Cancelar el viaje» (o «Cancelar el envío»): mientras buscamos no tiene costo.',
  ],
  nota: 'Para que la escena no se mueva, activa «reducir movimiento» en los ajustes de accesibilidad de tu teléfono.',
};

const EN: Guia = {
  id: 'ride-waiting-screen',
  titulo: 'While we find your driver',
  resumen:
    'As soon as you request a ride or a delivery, you see a scene with the vehicle you chose, plus the route and the price. It usually takes less than a minute, and canceling is free while we search.',
  explicacion: [
    'When you request, Divoox lets the drivers closest to your pickup know. While someone accepts, the screen shows a calm scene with the vehicle for what you requested: a car for Car, a motorcycle carrying the passenger’s helmet for Moto, a motorcycle with a delivery box if you’re sending a small package, and a car with a box on the roof if you’re sending something medium or large.',
    'Below it you see what we’re looking for, the pickup, the destination, the vehicle, and the upfront price. On a ride you can add a stop from “Stop”; on a delivery, “Your package” shows the package and who receives it. “Share” sends the trip link to anyone you choose.',
    'If your phone has “reduce motion” turned on, the scene stays still. When a driver accepts, the scene fades into the map with your driver on the way.',
  ],
  capturas: [
    foto(
      'carro',
      'en',
      'The waiting screen for a Car ride: a white line-drawn car drives in its right-hand lane past the city, with the title “Finding your driver,” the route, and the price.',
      'Car: we’re finding your driver.',
    ),
    foto(
      'moto-pasajero',
      'en',
      'The waiting screen for a Moto ride: the motorcycle with its rider and the passenger’s extra helmet, with the title “Finding your motorcycle.”',
      'Moto: the motorcycle brings your helmet.',
    ),
    foto(
      'moto-envio',
      'en',
      'The waiting screen for a small delivery: the motorcycle with its delivery box, the title “Finding a courier,” Pick up and Drop off, and the “Your package” button.',
      'Small delivery: it goes by motorcycle with a delivery box.',
    ),
    foto(
      'carro-envio',
      'en',
      'The waiting screen for a large delivery: the car with a box strapped to the roof and the title “Finding a courier.”',
      'Medium or large delivery: it goes by car.',
    ),
  ],
  preguntas: [
    'How long does it take to find a driver?',
    'Can I cancel while you search?',
    'Can I add a stop while you search?',
    'How do I stop the animation on the waiting screen?',
  ],
  pasos: [
    'Request your ride or delivery as usual and tap the button to confirm it.',
    'Look at the waiting screen: the title says what we’re looking for, and below are the pickup, the destination, and the upfront price.',
    'If you like, tap “Stop” to add a stop (on a ride) or “Your package” to check your package (on a delivery).',
    'Tap “Share” to send someone the trip link.',
    'If you changed your mind, tap “Cancel ride” (or “Cancel delivery”): it’s free while we search.',
  ],
  nota: 'To keep the scene still, turn on “reduce motion” in your phone’s accessibility settings.',
};

export const GUIA_ESPERA: Record<Idioma, Guia> = { es: ES, en: EN };
