import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. La guía pública «Pide la misma ruta otra vez» del
 * pasajero (sección «Para pedir»), en español e inglés.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-misma-ruta.mjs` en el sitio de pruebas
 * (español en El Vigía, inglés en Novi, C-CAPTURAS-POR-IDIOMA) y las deja en
 * `apps/panel/public/docs/recorrido-misma-ruta-<nombre>-<es|en>.webp`. Regla de la casa: ninguna guía
 * sin capturas. Por eso la guía entra en Docs SOLO cuando `MISMA_RUTA_PUBLICADA` es true; la prueba
 * `mismaRuta.test.ts` se pone en rojo si las capturas ya existen y la guía sigue sin publicar, o si se
 * publica sin ellas.
 */
export const MISMA_RUTA_PUBLICADA = false;

/** Los nombres de las capturas, en el orden de la guía. */
export const CAPTURAS_MISMA_RUTA = ['mis-viajes', 'confirmar', 'espera', 'inicio-repetir'] as const;

const foto = (
  nombre: (typeof CAPTURAS_MISMA_RUTA)[number],
  idioma: Idioma,
  alt: string,
  pie: string,
): Captura => ({ src: `/docs/recorrido-misma-ruta-${nombre}-${idioma}.webp`, alt, pie });

const ES: Guia = {
  id: 'ride-same-route',
  titulo: 'Pide la misma ruta otra vez',
  resumen:
    'En «Mis viajes» toca «Pedir la misma ruta»: confirmas el trayecto con el precio de ahora y tu conductor sale a buscarte, sin volver a escribir las direcciones.',
  explicacion: [
    'En «Mis viajes» ves cada viaje que pediste en Moto o Carro, agrupado por mes: el mapita de la ruta, de dónde a dónde fuiste, el precio, la fecha y si se completó o se canceló.',
    'Si vuelves a hacer el mismo trayecto (por ejemplo, de la casa al trabajo) o se canceló un viaje y lo quieres pedir de nuevo, toca «Pedir la misma ruta». La app te pregunta «De tu recogida a tu destino, ¿confirmas?» y te muestra el mismo recorrido, con sus paradas si las tuvo, el tipo de vehículo y la forma de pago de la vez pasada.',
    'El precio se calcula otra vez en ese momento y es el que pagas: puede ser distinto al de la vez pasada, porque cambian el tráfico y la demanda. Si quieres ajustar algo (otra parada, otro destino, otro carro), toca «Cambiar algo» y se abre la pantalla de pedir viaje ya llena.',
    'También en el inicio de la app ves tu último viaje con el botón «Repetir», que abre la misma confirmación.',
  ],
  capturas: [
    foto(
      'mis-viajes',
      'es',
      'La pantalla Mis viajes con los viajes agrupados por mes: cada uno con el mapita de la ruta, el vehículo, el precio, la fecha, el estado y el botón «Pedir la misma ruta».',
      'En «Mis viajes» cada viaje tiene su botón «Pedir la misma ruta».',
    ),
    foto(
      'confirmar',
      'es',
      'La confirmación «¿confirmas?» con el mapita, la recogida y el destino, el vehículo, la duración, el precio fijo de ahora y los botones «Sí, pedir ahora» y «Cambiar algo».',
      'Confirmas el mismo trayecto con el precio de ahora.',
    ),
    foto(
      'espera',
      'es',
      'La pantalla de espera del viaje recién pedido, buscando un conductor cerca de la recogida.',
      'El viaje sale como siempre: buscamos a tu conductor.',
    ),
    foto(
      'inicio-repetir',
      'es',
      'El inicio de la app con la tarjeta «Tu último viaje», el trayecto, el vehículo y el botón «Repetir».',
      'Desde el inicio repites tu último viaje con un toque.',
    ),
  ],
  preguntas: [
    '¿Cómo pido otra vez un viaje que ya hice?',
    '¿Cómo vuelvo a pedir un viaje que se canceló?',
    '¿El precio es el mismo de la vez pasada?',
    '¿Puedo cambiar el destino antes de repetir el viaje?',
  ],
  pasos: [
    'Abre Divoox, toca «Pedidos» abajo y elige «Viajes». También puedes entrar desde la pantalla de Moto o Carro, más abajo, en «Mis viajes».',
    'Busca el viaje y toca «Pedir la misma ruta».',
    'Revisa la recogida, las paradas y el destino, el vehículo y el precio fijo de ahora.',
    'Toca «Sí, pedir ahora». Verás la misma pantalla de espera de siempre mientras buscamos a tu conductor.',
    'Si quieres cambiar algo antes de pedir, toca «Cambiar algo»: se abre pedir viaje con todo escrito para que lo ajustes.',
  ],
  nota: 'En los tres puntos de cada viaje están el recibo y la ayuda con ese viaje (por ejemplo, si olvidaste algo en el vehículo).',
};

const EN: Guia = {
  id: 'ride-same-route',
  titulo: 'Request the same route again',
  resumen:
    'In “My rides,” tap “Request the same route”: confirm the trip at today’s price and your driver heads your way, without typing the addresses again.',
  explicacion: [
    'In “My rides” you see every Moto or Car ride you requested, grouped by month: a small map of the route, where you went from and to, the price, the date, and whether it was completed or canceled.',
    'If you take the same trip again (say, from home to work) or a ride was canceled and you want it back, tap “Request the same route.” The app asks “From your pickup to your destination, confirm?” and shows you the same route, with its stops if it had any, the vehicle type, and the payment method you used last time.',
    'The price is recalculated right then, and that’s what you pay: it may differ from last time, because traffic and demand change. If you want to adjust something (another stop, another destination, another car), tap “Change something” and the request screen opens already filled in.',
    'The app’s home screen also shows your last ride with a “Repeat” button that opens the same confirmation.',
  ],
  capturas: [
    foto(
      'mis-viajes',
      'en',
      'The My rides screen with rides grouped by month: each one with a small route map, the vehicle, the price, the date, the status, and the “Request the same route” button.',
      'In “My rides,” every ride has a “Request the same route” button.',
    ),
    foto(
      'confirmar',
      'en',
      'The “confirm?” sheet with the small map, the pickup and destination, the vehicle, the trip time, today’s upfront price, and the “Yes, request now” and “Change something” buttons.',
      'Confirm the same trip at today’s price.',
    ),
    foto(
      'espera',
      'en',
      'The waiting screen for the ride just requested, finding a driver near the pickup.',
      'Your ride starts as usual: we find your driver.',
    ),
    foto(
      'inicio-repetir',
      'en',
      'The app’s home screen with the “Your last ride” card, the route, the vehicle, and the “Repeat” button.',
      'Repeat your last ride from home with one tap.',
    ),
  ],
  preguntas: [
    'How do I request a ride I already took?',
    'How do I request a canceled ride again?',
    'Is the price the same as last time?',
    'Can I change the destination before repeating the ride?',
  ],
  pasos: [
    'Open Divoox, tap “Orders” at the bottom, and choose “Rides.” You can also get there from the Moto or Car screen, further down, under “My rides.”',
    'Find the ride and tap “Request the same route.”',
    'Check the pickup, the stops and the destination, the vehicle, and today’s upfront price.',
    'Tap “Yes, request now.” You’ll see the usual waiting screen while we find your driver.',
    'To change something before requesting, tap “Change something”: the request screen opens with everything filled in so you can adjust it.',
  ],
  nota: 'Each ride’s three-dot menu has the receipt and help with that ride (for example, if you left something in the vehicle).',
};

export const GUIA_MISMA_RUTA: Record<Idioma, Guia> = { es: ES, en: EN };
