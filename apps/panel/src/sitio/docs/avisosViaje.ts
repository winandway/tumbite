import type { Idioma } from '@tumbite/compartido';
import type { Guia } from './guias';

/**
 * C-AVISOS-VIAJE (24 nov 2026) — todos los países. La guía pública «Qué avisos recibes en tu viaje»
 * (sección «Para pedir»), en español e inglés: el aviso de cada paso de un viaje de Moto o Carro y de
 * un envío, que llega con la app cerrada y queda en la campana. La captura es la real del recorrido
 * de Carro (`recorrido-carro-pasajero-conductor-v2-*`), con datos de prueba neutros.
 */
const ES: Guia = {
  id: 'ride-notifications',
  titulo: 'Qué avisos recibes en tu viaje',
  resumen:
    'En cada paso de tu viaje o de tu envío te llega un aviso al celular, aunque tengas la app cerrada: cuando tu conductor acepta, cuando llega, cuando empieza el viaje y cuando termina. Todos quedan en tu campana.',
  explicacion: [
    'Apenas un conductor acepta tu viaje te avisamos con su nombre, su vehículo y su placa, para que lo reconozcas en la calle. Cuando llega a tu punto de recogida te llega «Tu conductor llegó»; cuando arranca, «Empezó tu viaje»; y al llegar a tu destino, «Viaje terminado», con la invitación a calificar a tu conductor.',
    'Si tu conductor cancela o no puede llegar, te avisamos que ya estamos buscando otro: no tienes que hacer nada. Si ningún conductor acepta a tiempo, también te lo decimos, para que lo pidas otra vez.',
    'En un envío los avisos hablan de tu paquete: «Tu conductor llegó por tu paquete», «Tu paquete va en camino» y «Paquete entregado».',
    'Cada aviso queda guardado en la campana de la app con su hora. El número rojo de la campana cuenta solo lo que todavía no viste y se va a cero al abrirla. Al tocar un aviso de viaje, en la bandeja del celular o en la campana, se abre ese viaje.',
    'Si tú cancelas un viaje que ya tenía conductor, a él también le llega un aviso, para que quede libre de una vez.',
  ],
  capturas: [
    {
      src: '/docs/recorrido-carro-pasajero-conductor-v2-es.webp',
      alt: 'La pantalla del viaje en Carro con el título «Tu conductor va en camino», el mapa, la tarjeta del conductor con su vehículo y su placa, y el código para empezar el viaje.',
      pie: 'Al tocar el aviso «Tu conductor aceptó y va por ti» se abre tu viaje: el conductor, su vehículo y su placa.',
    },
  ],
  preguntas: [
    '¿Me avisan cuando llega mi conductor?',
    '¿Por qué no me llegan los avisos de mi viaje?',
    '¿Dónde veo los avisos que ya me llegaron?',
    '¿Qué pasa si mi conductor cancela?',
  ],
  pasos: [
    'La primera vez que abras la app, toca «Permitir» cuando te pida enviarte avisos.',
    'Pide tu viaje o tu envío como siempre. Puedes cerrar la app: los avisos te llegan igual.',
    'Cuando te llegue un aviso, tócalo para abrir tu viaje.',
    'Para ver los avisos que ya te llegaron, toca la campana en el inicio de la app.',
    'Al terminar, toca el aviso «Viaje terminado» para calificar a tu conductor.',
  ],
  nota: 'Si no te llegan los avisos, revisa en los ajustes de tu celular que Divoox tenga permiso para enviarte notificaciones. Si al tocar un aviso no se abre tu viaje, actualiza la app desde la tienda.',
};

const EN: Guia = {
  id: 'ride-notifications',
  titulo: 'Notifications during your ride',
  resumen:
    'At every step of your ride or delivery you get a notification on your phone, even with the app closed: when your driver accepts, arrives, starts the ride, and finishes. They all stay in your bell.',
  explicacion: [
    'As soon as a driver accepts your ride, we let you know their name, vehicle, and plate so you can spot them on the street. When they reach your pickup spot you get “Your driver has arrived”; when you set off, “Your ride has started”; and when you reach your destination, “Ride complete,” with an invitation to rate your driver.',
    'If your driver cancels or can’t make it, we let you know we’re already finding another one: there’s nothing you need to do. If no driver accepts in time, we tell you that too, so you can request it again.',
    'On a delivery, the notifications are about your package: “Your driver is here for your package,” “Your package is on its way,” and “Package delivered.”',
    'Every notification is saved in the app’s bell with its time. The red number on the bell counts only what you haven’t seen yet and goes back to zero when you open it. Tapping a ride notification, in your phone’s notification tray or in the bell, opens that ride.',
    'If you cancel a ride that already had a driver, they get a notification too, so they’re free right away.',
  ],
  capturas: [
    {
      src: '/docs/recorrido-carro-pasajero-conductor-v2-en.webp',
      alt: 'The Car ride screen with the title “Your driver is on the way,” the map, the driver card with their vehicle and plate, and the code to start the ride.',
      pie: 'Tapping “Your driver accepted and is on the way” opens your ride: the driver, their vehicle, and their plate.',
    },
  ],
  preguntas: [
    'Will I be notified when my driver arrives?',
    'Why am I not getting notifications about my ride?',
    'Where can I see notifications I already got?',
    'What happens if my driver cancels?',
  ],
  pasos: [
    'The first time you open the app, tap “Allow” when it asks to send you notifications.',
    'Request your ride or delivery as usual. You can close the app: notifications still reach you.',
    'When a notification arrives, tap it to open your ride.',
    'To see notifications you already got, tap the bell on the app’s home screen.',
    'When you arrive, tap the “Ride complete” notification to rate your driver.',
  ],
  nota: 'If notifications aren’t reaching you, check your phone’s settings to make sure Divoox is allowed to send notifications. If tapping a notification doesn’t open your ride, update the app from the store.',
};

export const GUIA_AVISOS_VIAJE: Record<Idioma, Guia> = { es: ES, en: EN };
