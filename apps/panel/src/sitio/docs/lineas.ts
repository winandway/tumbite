import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-LINEAS-TAXI (19 nov 2026) — todos los países. Las guías públicas de las líneas de taxi y mototaxi:
 * «Registra tu línea» (para quien lidera un grupo de taxis o mototaxis) y «Tu línea en Divoox Driver» (para
 * el conductor y para el líder), en español e inglés.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-lineas.mjs` contra el servidor LOCAL del
 * recorrido, con datos de ejemplo (líneas y personas inventadas, código EJEMPLO01) y las deja en
 * `apps/panel/public/docs/recorrido-lineas-<nombre>-<es|en>.webp`. Ninguna guía sin capturas: las guías
 * entran en Docs SOLO cuando `LINEAS_PUBLICADA` es true; `lineas.test.ts` se pone en rojo si las capturas
 * existen y la guía no está publicada, o al revés.
 */
export const LINEAS_PUBLICADA = true;

export const CAPTURAS_LINEAS = [
  'registro',
  'driver-pedir',
  'driver-lider',
  'driver-equipo',
] as const;
type NombreCaptura = (typeof CAPTURAS_LINEAS)[number];

const foto = (nombre: NombreCaptura, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-lineas-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

type Guias = { registro: Guia; conductor: Guia };

const ES: Guias = {
  registro: {
    id: 'register-your-line',
    titulo: 'Registra tu línea de taxis o mototaxis',
    resumen:
      'Si diriges una línea de taxis o mototaxis, regístrala en Divoox: tú eres el líder, tus conductores piden entrar contigo y, si alguno pide ayuda, tú te enteras primero.',
    explicacion: [
      'Una línea es tu grupo de conductores. En Divoox la línea tiene su líder (tú), su código, su enlace y su QR. Tus conductores se unen con ese código y tú aceptas a cada uno con un toque.',
      'Para registrarla llena el formulario «Registra tu línea» con seis datos: el nombre de la línea, la ciudad, si son taxis, mototaxis o los dos, cuántos conductores tiene, tu nombre y celular como líder y un segundo contacto de emergencia con su celular.',
      'Nuestro equipo verifica tu celular y aprueba la línea. Nadie crea una línea sin esa verificación. Si todavía no tienes tu cuenta de Divoox Driver, te llega tu enlace personal (por correo o por WhatsApp): crea tu cuenta con ese mismo correo o celular y la línea queda a tu nombre sola, sin hacer nada más.',
      'Cuando tu línea está lista te llega tu código. El código solo vale en la ciudad de tu línea. Compártelo por mensaje o muestra el QR: tus conductores lo escriben al crear su cuenta o desde su perfil.',
      'Seguridad: si un conductor de tu línea toca el botón de emergencia en la app, tú y tu segundo contacto reciben un mensaje con su nombre, su celular y su ubicación en el mapa.',
    ],
    capturas: [
      foto(
        'registro',
        'es',
        'El formulario Registra tu línea con el nombre de la línea, la ciudad, el tipo de servicio, cuántos conductores, el líder y el segundo contacto de emergencia.',
        'Los seis datos para registrar tu línea.',
      ),
      foto(
        'driver-lider',
        'es',
        'La pantalla Mi línea del líder con el código de la línea, el QR para compartir y las solicitudes de conductores con los botones Aceptar y Rechazar.',
        'Tu código, tu QR y las solicitudes de tus conductores.',
      ),
    ],
    preguntas: [
      '¿Cómo registro mi línea de mototaxis?',
      '¿Quién recibe el aviso si un conductor de mi línea pide ayuda?',
      '¿Cuánto tarda en aprobarse mi línea?',
      '¿Puedo tener taxis y mototaxis en la misma línea?',
    ],
    pasos: [
      'Crea tu cuenta de Divoox Driver con tu celular.',
      'Abre «Registra tu línea» en la página de Divoox y llena los seis datos.',
      'Espera nuestro mensaje: verificamos tu celular y aprobamos tu línea.',
      'Abre «Mi línea» en Divoox Driver: ahí están tu código y tu QR.',
      'Comparte tu código con tus conductores y acepta sus solicitudes.',
    ],
    nota: 'El segundo contacto de emergencia recibe un mensaje de texto solo cuando un conductor de tu línea pide ayuda. Elige a alguien que pueda contestar rápido.',
  },
  conductor: {
    id: 'your-line',
    titulo: 'Tu línea en Divoox Driver',
    resumen:
      'Entra a la línea de tu grupo con su código, o elígela de la lista de tu ciudad. Tu líder te acepta y, si pides ayuda, le llega tu ubicación.',
    explicacion: [
      'Si trabajas en una línea de taxis o mototaxis, en Divoox Driver ve a tu perfil y abre «Mi línea». También puedes escribir el código de la línea cuando creas tu cuenta.',
      'Para entrar: escribe el código de tu línea o elígela de la lista de las líneas de tu ciudad (usa el buscador). El código solo vale en la ciudad de la línea. Tu líder recibe tu solicitud y la acepta o la rechaza con un toque. Mientras tanto verás «Esperando que el líder te acepte».',
      'Estás en una sola línea a la vez. Si quieres cambiar, pídele a tu líder que te saque de la suya.',
      'Si te invitamos a ser líder, tu línea queda a tu nombre sola en el momento en que creas tu cuenta de Divoox Driver con el correo o el celular de la invitación: no tienes que hacer nada más. Si eres el líder: en «Mi línea» ves tu código, el QR para compartir, las solicitudes de conductores y tu equipo. Para sacar a un conductor, toca los tres puntos de su fila.',
      'Si tocas el botón de emergencia durante un servicio, tu líder y su segundo contacto reciben un mensaje con tu ubicación. Si no tienes línea, el aviso le llega al equipo de Divoox de tu ciudad.',
    ],
    capturas: [
      foto(
        'driver-pedir',
        'es',
        'La pantalla Mi línea de un conductor sin línea con la casilla del código, el buscador y la lista de líneas de su ciudad con el botón Pedir entrada.',
        'Entras con el código o eligiendo tu línea de la lista.',
      ),
      foto(
        'driver-lider',
        'es',
        'La pantalla Mi línea del líder con el código, el QR y las solicitudes de conductores con los botones Aceptar y Rechazar.',
        'El líder acepta o rechaza con un toque.',
      ),
      foto(
        'driver-equipo',
        'es',
        'La parte Mi equipo del líder con la lista de conductores y el menú de tres puntos abierto con la opción Sacar de la línea.',
        'Para sacar a un conductor, usa los tres puntos.',
      ),
    ],
    preguntas: [
      '¿Cómo entro a una línea?',
      '¿Puedo estar en dos líneas?',
      '¿Qué pasa cuando toco el botón de emergencia?',
      '¿Cómo saco a un conductor de mi línea?',
    ],
    pasos: [
      'En Divoox Driver abre tu perfil y toca «Mi línea».',
      'Escribe el código de tu línea o elígela de la lista y toca «Pedir entrada».',
      'Espera a que tu líder te acepte con un toque.',
      'Si eres líder: acepta o rechaza las solicitudes y comparte tu código o tu QR.',
    ],
    nota: 'Tu línea es solo para organizar a tu grupo y avisar en una emergencia. Los pagos y las ganancias de cada viaje funcionan igual que siempre.',
  },
};

const EN: Guias = {
  registro: {
    id: 'register-your-line',
    titulo: 'Register your taxi or mototaxi line',
    resumen:
      'If you run a line of taxis or mototaxis, register it on Divoox: you are the leader, your drivers ask to join through you and, if one of them asks for help, you hear about it first.',
    explicacion: [
      'A line is your group of drivers. On Divoox the line has its leader (you), its code, its link and its QR. Your drivers join with that code and you accept each one with a tap.',
      'To register it, fill in the “Register your line” form with six details: the line’s name, the city, whether it’s taxis, mototaxis or both, how many drivers it has, your name and cell phone as the leader, and a second emergency contact with their cell phone.',
      'Our team verifies your cell phone and approves the line. Nobody creates a line without that check. If you don’t have a Divoox Driver account yet, you get your personal link (by email or WhatsApp): create your account with that same email or cell phone and the line is yours automatically, with nothing else to do.',
      'When your line is ready you get your code. The code only works in your line’s city. Share it by message or show the QR: your drivers enter it when they create their account or from their profile.',
      'Safety: if a driver in your line taps the emergency button in the app, you and your second contact get a message with the driver’s name, cell phone and map location.',
    ],
    capturas: [
      foto(
        'registro',
        'en',
        'The Register your line form with the line name, city, type of service, how many drivers, the leader and the second emergency contact.',
        'The six details to register your line.',
      ),
      foto(
        'driver-lider',
        'en',
        'The leader’s My line screen with the line code, the QR to share and the driver requests with the Accept and Decline buttons.',
        'Your code, your QR and your drivers’ requests.',
      ),
    ],
    preguntas: [
      'How do I register my mototaxi line?',
      'Who gets the alert if a driver in my line asks for help?',
      'How long does it take for my line to be approved?',
      'Can I have taxis and mototaxis in the same line?',
    ],
    pasos: [
      'Create your Divoox Driver account with your cell phone.',
      'Open “Register your line” on the Divoox website and fill in the six details.',
      'Wait for our message: we verify your cell phone and approve your line.',
      'Open “My line” in Divoox Driver: your code and your QR are there.',
      'Share your code with your drivers and accept their requests.',
    ],
    nota: 'Your second emergency contact gets a text message only when a driver in your line asks for help. Choose someone who can answer quickly.',
  },
  conductor: {
    id: 'your-line',
    titulo: 'Your line in Divoox Driver',
    resumen:
      'Join your group’s line with its code, or choose it from the list for your city. Your leader accepts you and, if you ask for help, gets your location.',
    explicacion: [
      'If you work in a taxi or mototaxi line, open your profile in Divoox Driver and tap “My line.” You can also enter the line’s code when you create your account.',
      'To join: enter your line’s code or choose it from the list of lines in your city (use the search). The code only works in the line’s city. Your leader gets your request and accepts or declines it with a tap. Meanwhile you’ll see “Waiting for the leader to accept you.”',
      'You are in one line at a time. If you want to switch, ask your leader to remove you from theirs.',
      'If we invited you to be a leader, your line is yours automatically the moment you create your Divoox Driver account with the email or cell phone from the invitation: there’s nothing else to do. If you’re the leader: in “My line” you see your code, the QR to share, driver requests and your team. To remove a driver, tap the three dots on their row.',
      'If you tap the emergency button during a service, your leader and their second contact get a message with your location. If you have no line, the alert goes to the Divoox team in your city.',
    ],
    capturas: [
      foto(
        'driver-pedir',
        'en',
        'A driver’s My line screen without a line, showing the code field, the search box and the list of lines in their city with the Ask to join button.',
        'Join with the code or by choosing your line from the list.',
      ),
      foto(
        'driver-lider',
        'en',
        'The leader’s My line screen with the code, the QR and the driver requests with the Accept and Decline buttons.',
        'The leader accepts or declines with one tap.',
      ),
      foto(
        'driver-equipo',
        'en',
        'The leader’s My team section with the list of drivers and the three-dot menu open showing Remove from the line.',
        'To remove a driver, use the three dots.',
      ),
    ],
    preguntas: [
      'How do I join a line?',
      'Can I be in two lines?',
      'What happens when I tap the emergency button?',
      'How do I remove a driver from my line?',
    ],
    pasos: [
      'In Divoox Driver, open your profile and tap “My line.”',
      'Enter your line’s code or choose it from the list and tap “Ask to join.”',
      'Wait for your leader to accept you with one tap.',
      'If you’re the leader: accept or decline requests and share your code or QR.',
    ],
    nota: 'Your line is only to organize your group and to alert someone in an emergency. Payments and earnings for each trip work the same as always.',
  },
};

export const GUIAS_LINEAS: Record<Idioma, Guias> = { es: ES, en: EN };
