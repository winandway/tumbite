import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-SERVICIOS-CONECTADOS (16 nov 2026) — todos los países. Las guías públicas del panel de
 * servicios del Driver: conectarse a varios servicios a la vez y agregar un servicio sin repetir
 * los datos. Capturas REALES tomadas por e2e/recorrido/serviciosConectados.spec.ts con CAPTURAS=1
 * (inglés con datos de EE. UU.; español con datos neutros). Van en «Repartidores».
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-servicios-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_SERVICIOS_CONECTADOS: Record<Idioma, PorSeccion> = {
  es: {
    drivers: [
      {
        id: 'online-for-several-services',
        titulo: 'Conéctate a varios servicios a la vez',
        resumen:
          'En Divoox Driver te conectas a la vez a todos los servicios que tienes aprobados: comida, envíos y viajes con pasajero. Te llegan ofertas de todos y, al aceptar una, los demás se pausan solos hasta que la termines.',
        explicacion: [
          'Más servicios conectados es menos tiempo esperando. Por eso, cuando te conectas, quedas disponible para todos los servicios que tienes aprobados en tu ciudad, como en las apps de reparto y de viajes más grandes.',
          'Arriba ves una tarjeta oscura con una luz verde que late: «Conectado a 3 servicios. Esperando la próxima oferta». Debajo, tus ganancias de hoy y la lista de tus servicios. Cada servicio conectado va en verde, con su luz y tres flechas que te indican hacia dónde deslizar.',
          'Para conectar un servicio, toca «Conectar» en su tarjeta. La primera vez de la sesión la app te pide tu ubicación. Si quieres conectarte a todo de una, toca «Conectarme».',
          'Para desconectar un servicio, arrastra su ícono hacia la derecha hasta el final y suéltalo. Si lo sueltas antes, la tarjeta vuelve a su lugar y sigues conectado: así un toque sin querer, con el teléfono en el bolsillo o en el soporte de la moto, no te desconecta.',
          'Al desconectarlo aparece abajo un aviso por unos segundos: «Comida desconectada. Lo demás sigue conectado». Si fue sin querer, toca «Deshacer».',
          'Cuando aceptas una oferta, los demás servicios quedan en pausa: no te llega nada más hasta que entregues. Arriba lo dice siempre («Estás llevando una comida») y una franja gris te muestra qué está en pausa. Al terminar, todo vuelve solo, sin tocar nada.',
          'Los servicios que todavía no tienes salen con «Agregar este servicio», y los que están en revisión dicen cuánto falta. Nada de eso te llega como oferta hasta que esté aprobado.',
          'Un bloque de Divoox Flex es distinto: es exclusivo. Mientras lo haces, todo lo demás está desconectado y con candado hasta que termines el bloque.',
          'Para dejar de trabajar, toca «Desconectarme»: se apagan todos tus servicios a la vez.',
        ],
        capturas: [
          foto(
            'conectados',
            'es',
            'El inicio de Divoox Driver con la tarjeta «Conectado a 3 servicios», las ganancias de hoy y Comida, Envíos en moto y Moto con pasajero conectados en verde.',
            'Conectado a varios servicios a la vez: cada uno en verde, con su luz viva.',
          ),
          foto(
            'deslizando',
            'es',
            'La tarjeta de Comida mientras se arrastra hacia la derecha, con el texto «Suelta para desconectar».',
            'Para desconectar uno, arrastra su ícono hasta el final.',
          ),
          foto(
            'deshacer',
            'es',
            'Comida desconectada con su botón «Conectar» y el aviso de abajo «Comida desconectada. Lo demás sigue conectado. Deshacer».',
            'Lo demás sigue conectado. Si fue sin querer, toca «Deshacer».',
          ),
          foto(
            'en-pausa',
            'es',
            'El aviso «Estás llevando una comida» y la franja «En pausa: Envíos en moto y Moto con pasajero».',
            'Al aceptar una oferta, los demás se pausan solos y vuelven al entregar.',
          ),
        ],
        preguntas: [
          '¿Puedo recibir pedidos de comida, envíos y viajes al mismo tiempo?',
          '¿Cómo me desconecto de un solo servicio?',
          '¿Qué pasa con los demás servicios cuando acepto una oferta?',
          '¿Cómo vuelvo a conectar un servicio que desconecté sin querer?',
        ],
        pasos: [
          'Abre Divoox Driver y toca «Conectarme», o «Conectar» en el servicio que quieras.',
          'Espera tus ofertas: te llegan de todos los servicios conectados.',
          'Para desconectar uno, arrastra su ícono hacia la derecha hasta el final.',
          'Si fue sin querer, toca «Deshacer» en el aviso de abajo.',
          'Para terminar el día, toca «Desconectarme».',
        ],
      },
      {
        id: 'add-a-service',
        titulo: 'Agrega un servicio sin repetir tus datos',
        resumen:
          'Tu perfil sirve para todos tus servicios. Para agregar uno nuevo, Divoox te pide solo lo que le falta a ese servicio: lo que ya aprobamos no se vuelve a pedir.',
        explicacion: [
          'Tus datos se separan en dos grupos. Los del perfil (tu foto, tu nombre, tu documento de identidad y tus antecedentes) se piden una sola vez y sirven para todos los servicios. Los del vehículo (licencia, registro, seguro y fotos) van con cada moto o carro que registras.',
          'En el inicio, los servicios que funcionan en tu ciudad y todavía no tienes aparecen con «Agregar este servicio». Tócalo.',
          'Arriba ves, en verde, todo lo que ya está verificado: «Ya verificado, no se vuelve a pedir». Debajo, «Falta para este servicio», con solo los pasos nuevos, numerados.',
          'Toca «Empezar» o cualquier paso. Se abre la pantalla de ese papel: cada foto se puede tomar con la cámara o subir desde tus archivos, y lo que escribes se guarda solo aunque cierres la app.',
          'Si nuestro equipo rechaza un papel, ves el motivo escrito como instrucción, por ejemplo: «Tómala de día, de frente y a un paso de distancia». Vuelves a tomar la foto desde ahí mismo.',
          'En «Perfil» tienes todo ordenado en dos secciones que se abren y se cierran: «Mi vehículo», con una tarjeta por cada vehículo y sus papeles (aprobado, pendiente o rechazado), y «Documentos», con los papeles de tu perfil y en qué servicios sirve cada uno.',
          'Cuando todo está aprobado, el servicio aparece en tu inicio con su botón «Conectar».',
        ],
        capturas: [
          foto(
            'agregar',
            'es',
            'La pantalla «Agregar un servicio» de Carro con pasajero, con «Ya verificado · no se vuelve a pedir» en verde y la lista «Falta para este servicio».',
            'Lo ya verificado en verde; abajo, solo lo que falta para este servicio.',
          ),
          foto(
            'agregar-falta',
            'es',
            'La lista «Falta para este servicio» con los pasos numerados del carro y el botón «Empezar · paso 1 de 3».',
            'Solo lo nuevo, numerado, y «Empezar» para el primer paso.',
          ),
          foto(
            'agregar-paso',
            'es',
            'El paso del carro: marca, modelo, año, color, placa y plazas, con «Guardar mi carro».',
            'Cada paso abre su pantalla de alta; al guardar el carro, sus fotos van con «Tomar foto» o «Subir archivo».',
          ),
          foto(
            'perfil-vehiculo',
            'es',
            'El perfil con «Mi vehículo» abierto: la moto con sus papeles aprobados, uno pendiente y la foto de la placa rechazada con su motivo.',
            'En «Mi vehículo», cada papel con su estado y, si se rechazó, el motivo.',
          ),
          foto(
            'perfil-rechazado',
            'es',
            'La foto de la placa rechazada con el motivo «Tómala de día, de frente y a un paso de distancia» y los botones «Tomar foto» y «Subir archivo».',
            'Si se rechaza, el motivo dice qué corregir y la vuelves a subir ahí mismo.',
          ),
          foto(
            'perfil-documentos',
            'es',
            'La sección «Documentos» del perfil con los papeles compartidos aprobados y los servicios donde sirve cada uno.',
            'En «Documentos», lo de tu perfil y en qué servicios sirve.',
          ),
        ],
        preguntas: [
          '¿Tengo que volver a subir mis documentos para agregar otro servicio?',
          '¿Cómo agrego viajes con pasajero a mi cuenta?',
          '¿Dónde veo por qué rechazaron un papel?',
          '¿Puedo subir la foto de un documento desde mis archivos?',
        ],
        pasos: [
          'En el inicio, toca el servicio que dice «Agregar este servicio».',
          'Revisa lo que ya está verificado y lo que falta.',
          'Toca «Empezar» y completa cada paso con «Tomar foto» o «Subir archivo».',
          'Espera la revisión de nuestro equipo: te avisamos cuando esté aprobado.',
          'Cuando esté listo, toca «Conectar» en ese servicio.',
        ],
      },
    ],
  },
  en: {
    drivers: [
      {
        id: 'online-for-several-services',
        titulo: 'Go online for several services at once',
        resumen:
          'In Divoox Driver you go online for every service you’re approved for at the same time: food, deliveries and rides. You get offers from all of them, and when you accept one, the others pause on their own until you finish it.',
        explicacion: [
          'More services online means less time waiting. When you go online, you’re available for every service you’re approved for in your city, just like the biggest delivery and rideshare apps.',
          'At the top you see a dark card with a pulsing green light: “Online for 3 services. Waiting for your next offer.” Below it are today’s earnings and your list of services. Each service that’s online shows in green, with its light and three arrows that point the way to swipe.',
          'To turn a service on, tap “Go online” on its card. The first time in a session, the app asks for your location. To turn everything on at once, tap “Go online” at the top.',
          'To turn a service off, drag its icon all the way to the right and let go. If you let go early, the card slides back and you stay online, so an accidental tap with the phone in your pocket or on the bike mount won’t take you offline.',
          'When it goes offline, a notice shows at the bottom for a few seconds: “Food is offline. Everything else is still on.” If it was an accident, tap “Undo.”',
          'When you accept an offer, your other services pause: nothing else comes in until you drop off. The top of the screen always says so (“You’re delivering a food order”), and a gray strip shows what’s paused. When you finish, everything comes back on by itself.',
          'Services you don’t have yet show “Add this service,” and the ones under review tell you what’s missing. None of them send you offers until they’re approved.',
          'A Divoox Flex block is different: it’s exclusive. While you’re on it, everything else is offline and locked until the block ends.',
          'To stop working, tap “Go offline”: all your services turn off at once.',
        ],
        capturas: [
          foto(
            'conectados',
            'en',
            'The Divoox Driver home screen with the “Online for 3 services” card, today’s earnings, and Food, Deliveries by motorcycle and Moto rides online in green.',
            'Online for several services at once: each one in green, with its live light.',
          ),
          foto(
            'deslizando',
            'en',
            'The Food card being dragged to the right, reading “Release to go offline.”',
            'To turn one off, drag its icon all the way across.',
          ),
          foto(
            'deshacer',
            'en',
            'Food offline with its “Go online” button and the notice at the bottom: “Food is offline. Everything else is still on. Undo.”',
            'Everything else stays on. If it was an accident, tap “Undo.”',
          ),
          foto(
            'en-pausa',
            'en',
            'The “You’re delivering a food order” notice and the “Paused: Deliveries by motorcycle and Moto rides” strip.',
            'When you accept an offer, the rest pause and come back when you drop off.',
          ),
        ],
        preguntas: [
          'Can I get food orders, deliveries and rides at the same time?',
          'How do I go offline for just one service?',
          'What happens to my other services when I accept an offer?',
          'How do I turn a service back on if I turned it off by accident?',
        ],
        pasos: [
          'Open Divoox Driver and tap “Go online,” or “Go online” on the service you want.',
          'Wait for offers: they come from every service that’s online.',
          'To turn one off, drag its icon all the way to the right.',
          'If it was an accident, tap “Undo” in the notice at the bottom.',
          'To end your day, tap “Go offline.”',
        ],
      },
      {
        id: 'add-a-service',
        titulo: 'Add a service without re-entering your info',
        resumen:
          'Your profile works for all your services. To add a new one, Divoox only asks for what that service still needs: anything we’ve already approved isn’t asked again.',
        explicacion: [
          'Your info is split into two groups. Profile info (your photo, your name, your ID and your background check) is asked for once and works for every service. Vehicle info (license, registration, insurance and photos) goes with each motorcycle or car you register.',
          'On the home screen, services that work in your city but you don’t have yet show “Add this service.” Tap it.',
          'At the top you see, in green, everything that’s already verified: “Already verified · we won’t ask again.” Below it, “Still needed for this service,” with only the new steps, numbered.',
          'Tap “Start” or any step. That document’s screen opens: every photo can be taken with your camera or uploaded from your files, and whatever you type is saved automatically, even if you close the app.',
          'If our team rejects a document, you see the reason written as an instruction, for example: “Take it in daylight, straight on, one step away.” You can retake the photo right there.',
          'Under “Profile,” everything is organized in two sections that open and close: “My vehicle,” with a card for each vehicle and its documents (approved, pending or rejected), and “Documents,” with your profile documents and which services each one counts for.',
          'Once everything is approved, the service shows up on your home screen with its “Go online” button.',
        ],
        capturas: [
          foto(
            'agregar',
            'en',
            'The “Add a service” screen for Car rides, with “Already verified · we won’t ask again” in green and the “Still needed for this service” list.',
            'What’s verified in green; below, only what this service still needs.',
          ),
          foto(
            'agregar-falta',
            'en',
            'The “Still needed for this service” list with the car’s numbered steps and the “Start · step 1 of 3” button.',
            'Only what’s new, numbered, with “Start” for the first step.',
          ),
          foto(
            'agregar-paso',
            'en',
            'The car step: make, model, year, color, plate and seats, with “Save my car.”',
            'Each step opens its own sign-up screen; once the car is saved, its photos go in with “Take photo” or “Upload file.”',
          ),
          foto(
            'perfil-vehiculo',
            'en',
            'The profile with “My vehicle” open: the motorcycle with approved documents, one pending, and the plate photo rejected with its reason.',
            'In “My vehicle,” each document with its status and, if rejected, the reason.',
          ),
          foto(
            'perfil-rechazado',
            'en',
            'The plate photo rejected with the reason “Take it in daylight, straight on, one step away” and the “Take photo” and “Upload file” buttons.',
            'If it’s rejected, the reason tells you what to fix and you upload it again right there.',
          ),
          foto(
            'perfil-documentos',
            'en',
            'The “Documents” section of the profile with the approved shared documents and the services each one counts for.',
            'In “Documents,” your profile info and which services it counts for.',
          ),
        ],
        preguntas: [
          'Do I have to upload my documents again to add another service?',
          'How do I add rides to my account?',
          'Where can I see why a document was rejected?',
          'Can I upload a document photo from my files?',
        ],
        pasos: [
          'On the home screen, tap the service that says “Add this service.”',
          'Review what’s already verified and what’s still needed.',
          'Tap “Start” and complete each step with “Take photo” or “Upload file.”',
          'Wait for our team’s review: we’ll let you know when it’s approved.',
          'When it’s ready, tap “Go online” on that service.',
        ],
      },
    ],
  },
};
