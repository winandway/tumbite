import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026) — todos los países. Las guías públicas:
 * «Tu conductor de confianza» y «Viajes fijos (también para menores)» del pasajero (sección «Para
 * pedir») y «Tus clientes fijos» del conductor (sección «Repartidores»), en español e inglés.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-viajes-fijos.mjs` (español en El Vigía,
 * inglés en Novi, C-CAPTURAS-POR-IDIOMA) y las deja en
 * `apps/panel/public/docs/recorrido-viajes-fijos-<nombre>-<es|en>.webp`. Ninguna guía sin capturas:
 * las guías entran en Docs SOLO cuando `VIAJES_FIJOS_PUBLICADA` es true; `viajesFijos.test.ts` se
 * pone en rojo si las capturas existen y la guía no está publicada, o al revés.
 */
export const VIAJES_FIJOS_PUBLICADA = false;

export const CAPTURAS_VIAJES_FIJOS = [
  'confianza-marcar',
  'confianza-lista',
  'pedir-confianza',
  'fijos-lista',
  'fijos-formulario',
  'fijos-menor',
  'fijos-acciones',
  'driver-agenda',
  'driver-oferta',
] as const;
type NombreCaptura = (typeof CAPTURAS_VIAJES_FIJOS)[number];

const foto = (nombre: NombreCaptura, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-viajes-fijos-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

type Guias = { confianza: Guia; fijos: Guia; conductor: Guia };

const ES: Guias = {
  confianza: {
    id: 'trusted-driver',
    titulo: 'Tu conductor de confianza',
    resumen:
      'Elige al conductor con quien ya viajaste y te gustó: cuando pidas Moto, Carro o un envío, tu viaje le llega primero a él.',
    explicacion: [
      'Muchas personas tienen «su» conductor: el mototaxista que las lleva siempre, el que conoce la casa y la familia. En Divoox puedes marcarlo como tu conductor de confianza y seguir pidiéndolo por la app, con el precio fijo, el viaje compartido en vivo y la ayuda de siempre.',
      'Puedes tener hasta 3 conductores de confianza. Solo puedes elegir a alguien con quien ya hiciste un viaje completo en Divoox.',
      'Cuando pides, si tu conductor de confianza está conectado y cerca, el viaje le llega primero a él, solo a él, durante 1 minuto. Si lo acepta, va por ti. Si no puede o no responde, el viaje pasa enseguida a los demás conductores: nunca te quedas esperando sin respuesta.',
      'Al pedir ves «Pedir primero a» con el nombre de tu conductor. Puedes cambiarlo por otro de los tuyos o elegir «Cualquier conductor».',
      'Tu teléfono y el del conductor siguen protegidos: se hablan por el chat del viaje, como en cualquier viaje de Divoox.',
    ],
    capturas: [
      foto(
        'confianza-marcar',
        'es',
        'Mis viajes con un viaje terminado y la opción para marcar a ese conductor como conductor de confianza.',
        'Desde «Mis viajes» eliges a tu conductor de confianza.',
      ),
      foto(
        'confianza-lista',
        'es',
        'La pantalla Conductores de confianza con el conductor elegido, su vehículo y placa, si está conectado y cuántos viajes hicieron juntos.',
        'Tus conductores de confianza, con su vehículo y si están conectados.',
      ),
      foto(
        'pedir-confianza',
        'es',
        'La pantalla para pedir Moto con la línea «Pedir primero a» y el nombre del conductor de confianza.',
        'Al pedir, tu viaje le llega primero a él.',
      ),
    ],
    preguntas: [
      '¿Cómo pido siempre al mismo conductor?',
      '¿Qué pasa si mi conductor de confianza no está conectado?',
      '¿Cuántos conductores de confianza puedo tener?',
      '¿Puedo quitar a un conductor de confianza?',
    ],
    pasos: [
      'Haz un viaje con el conductor que te gusta.',
      'Abre «Mis viajes», busca ese viaje y toca «Conductor de confianza».',
      'La próxima vez que pidas, revisa la línea «Pedir primero a»: ahí está tu conductor.',
      'Para ver o quitar a tus conductores, entra a «Conductores de confianza» en tu cuenta y usa los tres puntos.',
    ],
    nota: 'Si bloqueas a un conductor, deja de ser tu conductor de confianza y no vuelve a recibir tus viajes.',
  },
  fijos: {
    id: 'regular-rides',
    titulo: 'Viajes fijos: la escuela, el trabajo y más',
    resumen:
      'Programa una vez el viaje que haces siempre (por ejemplo, la escuela de lunes a viernes a las 7:00 y la vuelta al mediodía) y Divoox lo pide solo cada día.',
    explicacion: [
      'Un viaje fijo es un viaje que se repite: eliges de dónde a dónde, los días de la semana, la hora de ida y, si quieres, la hora de vuelta. Sirve para Moto, Carro y envíos.',
      'Cada viaje se reserva solo un día antes, con el precio fijo de ese momento, y aparece en tus viajes programados. Puedes cancelar sin cargo hasta 1 hora antes, como cualquier viaje programado.',
      'Si eliges a tu conductor de confianza, él recibe tu viaje fijo en su agenda, un aviso 30 minutos antes y la oferta antes que nadie. Si un día no puede, te avisamos y el viaje lo hace otro conductor.',
      'Viajes de un menor: activa «Es para un menor», escribe su nombre y un PIN de 4 números que tú le enseñas. El conductor tiene que escribir ese PIN para empezar el viaje, y tú recibes un aviso cuando el conductor acepta, cuando llega, cuando lo recoge y cuando lo deja, con la hora. Estos viajes solo los hacen conductores que aceptan llevar menores.',
      '¿Vacaciones o un día sin clases? Pausa el viaje fijo (con fecha de regreso o hasta que lo reanudes) o salta solo un día.',
    ],
    capturas: [
      foto(
        'fijos-lista',
        'es',
        'La pantalla Viajes fijos con un viaje a la escuela de lunes a viernes, sus horas de ida y vuelta, el conductor de confianza y la próxima salida.',
        'Tus viajes fijos, con sus días, horas y la próxima salida.',
      ),
      foto(
        'fijos-formulario',
        'es',
        'El formulario de un viaje fijo con el nombre, la recogida y el destino, los días de la semana, la hora de ida y la de vuelta, la forma de pago y el conductor de confianza.',
        'Eliges los días, la ida y la vuelta una sola vez.',
      ),
      foto(
        'fijos-menor',
        'es',
        'La parte «Es para un menor» del formulario con el nombre del menor y su PIN de 4 números.',
        'Para un menor: su nombre y el PIN que le enseñas.',
      ),
      foto(
        'fijos-acciones',
        'es',
        'El menú de un viaje fijo con pausar, saltar el próximo viaje, editar, cambiar el PIN y borrar.',
        'Pausa, salta un día o cámbialo cuando quieras.',
      ),
    ],
    preguntas: [
      '¿Cómo programo un viaje que se repite todos los días?',
      '¿Cómo llevo a mi hijo a la escuela con Divoox?',
      '¿Qué avisos recibo cuando mi hijo viaja?',
      '¿Cómo pauso un viaje fijo en vacaciones?',
      '¿Cuándo se cobra un viaje fijo?',
    ],
    pasos: [
      'En tu cuenta, entra a «Viajes fijos» y toca «Nuevo viaje fijo».',
      'Ponle un nombre (por ejemplo, «Escuela de Sofía») y escribe la recogida y el destino.',
      'Marca los días, la hora de ida y, si hay, la de vuelta.',
      'Elige la forma de pago y, si quieres, a tu conductor de confianza.',
      'Si es para un menor, activa «Es para un menor», escribe su nombre y su PIN, y enséñale el PIN.',
      'Toca «Guardar». Cada viaje aparecerá en tus viajes programados un día antes.',
    ],
    nota: 'Cada viaje se paga como siempre, con la forma de pago que elegiste. Si un día el servicio no está disponible o no se pudo reservar, te avisamos para que lo arregles a tiempo.',
  },
  conductor: {
    id: 'regular-riders',
    titulo: 'Tus clientes fijos y tu agenda',
    resumen:
      'Los clientes que te eligen de confianza te ven primero cuando piden, y sus viajes fijos aparecen en tu agenda de la semana.',
    explicacion: [
      'Cuando un cliente te elige como su conductor de confianza, te llega un aviso. Desde ese momento, cuando pide y estás conectado y cerca, su viaje te llega primero a ti, solo a ti, durante 1 minuto. La oferta dice «Cliente de confianza · solo para ti».',
      'Si el cliente arma un viaje fijo contigo (por ejemplo, la escuela de lunes a viernes), lo ves en «Clientes fijos»: la agenda de los próximos 7 días con la hora, de dónde a dónde y la forma de pago. 30 minutos antes de cada viaje te llega un aviso: conéctate para recibirlo primero.',
      'Si un día no puedes, toca «No puedo» en ese viaje: el cliente recibe un aviso y el viaje pasa a otro conductor. Si ya no vas a hacer ese viaje fijo, usa «Dejar este viaje fijo».',
      'Viajes de menores: la oferta dice «Recoges a un menor» con su nombre. Pídele su PIN de 4 números para empezar el viaje. Para recibirlos, activa «Acepto llevar menores» en tu vehículo.',
      'Cada viaje se cobra y se registra como siempre en la app. Así queda tu historial, tus calificaciones y la protección de Divoox.',
    ],
    capturas: [
      foto(
        'driver-agenda',
        'es',
        'La pantalla Clientes fijos del conductor con la agenda de la semana, cada viaje con su hora, el cliente, la recogida y el destino, y el botón «No puedo».',
        'Tu agenda de clientes fijos de la semana.',
      ),
      foto(
        'driver-oferta',
        'es',
        'La oferta de un viaje con «Cliente de confianza · solo para ti» y «Recoges a un menor», la ganancia y la recogida.',
        'La oferta de un cliente de confianza te llega solo a ti.',
      ),
    ],
    preguntas: [
      '¿Cómo veo los viajes fijos de mis clientes?',
      '¿Qué hago si no puedo hacer un viaje fijo?',
      '¿Cómo recibo viajes de menores?',
    ],
    pasos: [
      'En la app Driver, abre «Clientes fijos».',
      'Revisa la agenda de la semana: hora, cliente, recogida y destino.',
      'Conéctate antes de la hora: el aviso te llega 30 minutos antes.',
      'Acepta la oferta «solo para ti» y haz el viaje como siempre.',
      'Si un día no puedes, toca «No puedo» en ese viaje.',
    ],
    nota: 'Cobrar o llevar a un cliente fuera de la app no está permitido: pierdes la protección de Divoox y puede cerrar tu cuenta.',
  },
};

const EN: Guias = {
  confianza: {
    id: 'trusted-driver',
    titulo: 'Your trusted driver',
    resumen:
      'Choose a driver you’ve already ridden with and liked: when you request Moto, Car, or a delivery, your ride reaches them first.',
    explicacion: [
      'Many people have “their” driver: the one who always takes them, who knows the house and the family. In Divoox you can mark them as your trusted driver and keep requesting them in the app, with the upfront price, live trip sharing, and the usual support.',
      'You can have up to 3 trusted drivers. You can only choose someone you’ve completed a ride with on Divoox.',
      'When you request, if your trusted driver is online and nearby, the ride reaches them first, and only them, for 1 minute. If they accept, they’re on their way. If they can’t or don’t answer, the ride goes right away to other drivers: you’re never left waiting.',
      'When you request, you see “Request first from” with your driver’s name. You can switch to another of your drivers or choose “Any driver.”',
      'Your phone number and the driver’s stay private: you talk through the ride chat, like on any Divoox ride.',
    ],
    capturas: [
      foto(
        'confianza-marcar',
        'en',
        'My rides with a completed ride and the option to mark that driver as a trusted driver.',
        'Choose your trusted driver from “My rides.”',
      ),
      foto(
        'confianza-lista',
        'en',
        'The Trusted drivers screen with the chosen driver, their vehicle and plate, whether they’re online, and how many rides you’ve taken together.',
        'Your trusted drivers, with their vehicle and whether they’re online.',
      ),
      foto(
        'pedir-confianza',
        'en',
        'The Moto request screen with the “Request first from” line and the trusted driver’s name.',
        'When you request, your ride reaches them first.',
      ),
    ],
    preguntas: [
      'How do I always request the same driver?',
      'What happens if my trusted driver is offline?',
      'How many trusted drivers can I have?',
      'Can I remove a trusted driver?',
    ],
    pasos: [
      'Take a ride with the driver you like.',
      'Open “My rides,” find that ride, and tap “Trusted driver.”',
      'Next time you request, check the “Request first from” line: your driver is there.',
      'To see or remove your drivers, go to “Trusted drivers” in your account and use the three dots.',
    ],
    nota: 'If you block a driver, they stop being your trusted driver and won’t receive your rides again.',
  },
  fijos: {
    id: 'regular-rides',
    titulo: 'Regular rides: school, work, and more',
    resumen:
      'Set up the ride you always take once (for example, school Monday to Friday at 7:00 and the ride back at noon) and Divoox requests it for you every day.',
    explicacion: [
      'A regular ride is a ride that repeats: you choose where from and where to, the days of the week, the outbound time, and, if you want, the return time. It works for Moto, Car, and deliveries.',
      'Each ride is booked automatically one day ahead, at that moment’s upfront price, and shows up in your scheduled rides. You can cancel at no charge up to 1 hour before, like any scheduled ride.',
      'If you choose your trusted driver, they get your regular ride in their schedule, a reminder 30 minutes before, and the request before anyone else. If they can’t make it one day, we let you know and another driver takes the ride.',
      'Rides for a minor: turn on “It’s for a minor,” enter their name and a 4-digit PIN that you teach them. The driver has to enter that PIN to start the ride, and you get a notification when the driver accepts, arrives, picks them up, and drops them off, with the time. Only drivers who accept minors take these rides.',
      'Vacation or a day off from school? Pause the regular ride (until a date or until you resume it) or skip just one day.',
    ],
    capturas: [
      foto(
        'fijos-lista',
        'en',
        'The Regular rides screen with a school ride Monday to Friday, its outbound and return times, the trusted driver, and the next ride.',
        'Your regular rides, with their days, times, and the next ride.',
      ),
      foto(
        'fijos-formulario',
        'en',
        'The regular ride form with the name, the pickup and destination, the days of the week, the outbound and return times, the payment method, and the trusted driver.',
        'Choose the days, the outbound ride, and the return once.',
      ),
      foto(
        'fijos-menor',
        'en',
        'The “It’s for a minor” part of the form with the minor’s name and their 4-digit PIN.',
        'For a minor: their name and the PIN you teach them.',
      ),
      foto(
        'fijos-acciones',
        'en',
        'A regular ride’s menu with pause, skip the next ride, edit, change PIN, and delete.',
        'Pause, skip a day, or change it whenever you want.',
      ),
    ],
    preguntas: [
      'How do I schedule a ride that repeats every day?',
      'How do I take my child to school with Divoox?',
      'What notifications do I get when my child rides?',
      'How do I pause a regular ride during vacation?',
      'When am I charged for a regular ride?',
    ],
    pasos: [
      'In your account, go to “Regular rides” and tap “New regular ride.”',
      'Give it a name (for example, “Sofía’s school”) and enter the pickup and destination.',
      'Select the days, the outbound time, and, if there is one, the return time.',
      'Choose the payment method and, if you want, your trusted driver.',
      'If it’s for a minor, turn on “It’s for a minor,” enter their name and PIN, and teach them the PIN.',
      'Tap “Save.” Each ride shows up in your scheduled rides one day ahead.',
    ],
    nota: 'Each ride is paid as usual, with the payment method you chose. If the service isn’t available one day or the ride couldn’t be booked, we let you know so you can fix it in time.',
  },
  conductor: {
    id: 'regular-riders',
    titulo: 'Your regular riders and schedule',
    resumen:
      'Riders who choose you as their trusted driver reach you first when they request, and their regular rides show up in your weekly schedule.',
    explicacion: [
      'When a rider chooses you as their trusted driver, you get a notification. From then on, when they request and you’re online and nearby, their ride reaches you first, and only you, for 1 minute. The request says “Trusted rider · just for you.”',
      'If the rider sets up a regular ride with you (for example, school Monday to Friday), you see it in “Regular riders”: your schedule for the next 7 days with the time, where from and where to, and the payment method. 30 minutes before each ride you get a reminder: go online to receive it first.',
      'If you can’t make it one day, tap “Can’t make it” on that ride: the rider gets a notification and the ride goes to another driver. If you’ll no longer do that regular ride, use “Leave this regular ride.”',
      'Rides for minors: the request says “You’re picking up a minor” with their name. Ask for their 4-digit PIN to start the ride. To receive them, turn on “I accept minors” for your vehicle.',
      'Every ride is paid and recorded in the app as usual. That keeps your history, your ratings, and Divoox protection.',
    ],
    capturas: [
      foto(
        'driver-agenda',
        'en',
        'The driver’s Regular riders screen with the weekly schedule, each ride with its time, rider, pickup and destination, and the “Can’t make it” button.',
        'Your weekly schedule of regular riders.',
      ),
      foto(
        'driver-oferta',
        'en',
        'A ride request with “Trusted rider · just for you” and “You’re picking up a minor,” the earnings, and the pickup.',
        'A trusted rider’s request reaches only you.',
      ),
    ],
    preguntas: [
      'How do I see my riders’ regular rides?',
      'What do I do if I can’t make a regular ride?',
      'How do I receive rides for minors?',
    ],
    pasos: [
      'In the Driver app, open “Regular riders.”',
      'Check the weekly schedule: time, rider, pickup, and destination.',
      'Go online before the time: the reminder arrives 30 minutes before.',
      'Accept the “just for you” request and do the ride as usual.',
      'If you can’t make it one day, tap “Can’t make it” on that ride.',
    ],
    nota: 'Charging or driving a rider outside the app isn’t allowed: you lose Divoox protection and it may close your account.',
  },
};

export const GUIAS_VIAJES_FIJOS: Record<Idioma, Guias> = { es: ES, en: EN };
