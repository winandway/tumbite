import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-DOCS-CARRO (14 nov 2026) — todos los países. Las guías públicas de Divoox Carro (el taxi): dos del
 * pasajero («ordering») y dos del conductor («drivers»), con capturas REALES tomadas en El Vigía,
 * estado Mérida, con `scripts/recorrido/capturas-carro.mjs`. Lo que cambia por país (efectivo, pago
 * móvil o tarjeta) se dice así, sin prometer nada que la app no haga.
 */
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-carro-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const ES: { pasajero: Guia[]; conductor: Guia[] } = {
  pasajero: [
    {
      id: 'ride-car',
      titulo: 'Pedir un carro (taxi) con Divoox Carro',
      resumen:
        'Pide un Carro o un Carro XL de seis plazas, mira el precio fijo antes de confirmar y sigue a tu conductor hasta que llegue.',
      explicacion: [
        'Divoox Carro es el taxi de Divoox: un conductor verificado te lleva en su carro de un punto a otro de la ciudad. Está disponible en las ciudades donde Divoox Carro esté abierto; si en la tuya todavía no lo está, la app no te deja pedirlo.',
        'Hay dos tamaños. Carro lleva hasta cuatro pasajeros con equipaje de mano. Carro XL lleva hasta seis, para grupos o con más maletas.',
        'El precio es fijo: lo ves antes de pedir y no cambia por el tráfico. En Venezuela va en dólares y, al lado, ves su equivalente en bolívares con la tasa del día.',
        'Cuando un conductor acepta, ves su nombre, su foto (si la tiene), el carro con su color y sus plazas, la placa y en cuántos minutos llega. Para empezar el viaje le dices tu código de cuatro números: así sabes que te subes con la persona correcta.',
      ],
      capturas: [
        foto(
          'pasajero-precio',
          'es',
          'La pantalla Carro con el mapa, la elección entre Carro y Carro XL, el precio fijo en dólares con su equivalente en bolívares y las formas de pago.',
          'Antes de pedir ves el precio fijo y eliges cómo pagas.',
        ),
        foto(
          'pasajero-xl',
          'es',
          'La pantalla Carro con Carro XL de seis plazas elegido y su precio fijo.',
          'Para seis pasajeros eliges Carro XL.',
        ),
        foto(
          'pasajero-conductor',
          'es',
          'El viaje asignado: el mapa, el conductor con su carro, el color, las plazas, la placa y la llegada estimada, y el código del viaje.',
          'Ves a tu conductor, su carro, la placa y en cuánto llega.',
        ),
        foto(
          'driver-codigo',
          'es',
          'La app del conductor pidiendo el código de cuatro números del pasajero para empezar el viaje.',
          'Tu conductor escribe tu código para empezar el viaje.',
        ),
      ],
      preguntas: [
        '¿Cómo pido un taxi en Divoox?',
        '¿Qué diferencia hay entre Carro y Carro XL?',
        '¿El precio del carro puede cambiar?',
        '¿Para qué sirve el código del viaje?',
      ],
      pasos: [
        'Abre Divoox y toca «Carro».',
        'Confirma el punto de recogida (puedes moverlo en el mapa) y escribe tu destino.',
        'Elige «Carro» o «Carro XL (6 plazas)» y toca «Ver precio».',
        'Mira el precio fijo y elige cómo pagas: la app te muestra los métodos de tu país (en Venezuela, efectivo o pago móvil; en Estados Unidos, tarjeta).',
        'Toca «Pedir Carro». Cuando el conductor acepte, verás sus datos y su ubicación en el mapa.',
        'Al subirte, comprueba la placa y dile al conductor tu código de cuatro números.',
      ],
      nota: 'No compartas tu código por mensaje: díselo al conductor en persona cuando te recoja.',
    },
    {
      id: 'ride-car-pay',
      titulo: 'Pagar, dejar propina y ver tus viajes en Carro',
      resumen:
        'Paga en efectivo, por pago móvil o con tarjeta según tu país, deja propina al llegar y encuentra el recibo y la ayuda en «Mis viajes».',
      explicacion: [
        'En efectivo, le pagas al conductor al llegar. Con tarjeta, autorizamos el precio fijo al pedir y lo cobramos al terminar el viaje.',
        'Donde existe el pago móvil (por ejemplo, en Venezuela), cuando te asignan conductor ves sus datos de pago móvil en la app. Pagas el equivalente en bolívares a la tasa oficial del día y el conductor confirma en su app que le llegó.',
        'Al llegar calificas el viaje con estrellas y un comentario. Si pagaste con tarjeta, además puedes dejarle propina desde la app; la recibe completa. En efectivo o pago móvil, la propina se la das directamente.',
        'En «Mis viajes», debajo de la pantalla Carro, están tus viajes anteriores. Cada uno abre su recibo con el detalle del precio, la forma de pago, el conductor y el carro.',
        'Si olvidaste algo en el carro, abre ese viaje y elige «Olvidé algo en el vehículo». Le avisamos al conductor y abrimos tu caso; nuestro equipo coordina la devolución contigo. Por seguridad no compartimos teléfonos.',
      ],
      capturas: [
        foto(
          'pasajero-codigo',
          'es',
          'El viaje en curso con el código para empezar y los datos de pago móvil del conductor: banco, nombre, teléfono y cédula.',
          'Con pago móvil ves a quién le pagas en cuanto te asignan conductor.',
        ),
        foto(
          'pasajero-propina',
          'es',
          'Al llegar: las estrellas para calificar el viaje, el comentario y el pago móvil confirmado por el conductor.',
          'Al llegar calificas el viaje y ves que el conductor confirmó tu pago.',
        ),
        foto(
          'pasajero-mis-viajes',
          'es',
          'La lista «Mis viajes» con el viaje en Carro, la fecha, el destino, el total y el estado en verde.',
          'Tus viajes anteriores, debajo de la pantalla Carro.',
        ),
        foto(
          'pasajero-recibo',
          'es',
          'El recibo de un viaje en Carro con la recogida, el destino, el detalle del precio, la forma de pago, el conductor y el carro.',
          'Cada viaje abre su recibo.',
        ),
        foto(
          'pasajero-olvide',
          'es',
          'La ayuda con el viaje con la opción «Olvidé algo en el vehículo» elegida y la casilla para contar qué olvidaste.',
          'Si olvidaste algo, avisas desde el mismo viaje.',
        ),
      ],
      preguntas: [
        '¿Cómo pago un viaje en carro?',
        '¿Puedo pagar el taxi por pago móvil?',
        '¿Puedo dejarle propina al conductor?',
        '¿Dónde veo el recibo de mi viaje?',
        '¿Qué hago si olvidé algo en el carro?',
      ],
      pasos: [
        'Al pedir, elige la forma de pago que te muestra la app.',
        'Con pago móvil, paga a los datos que aparecen en el viaje; con efectivo, paga al llegar.',
        'Al llegar, califica el viaje. Si pagaste con tarjeta, puedes dejar propina en la app.',
        'Para ver un viaje anterior, abre «Carro» y baja hasta «Mis viajes». Toca el viaje para ver su recibo.',
        'Si olvidaste algo, en ese viaje toca «Olvidé algo en el vehículo», cuéntanos qué y dónde lo dejaste, y toca «Enviar a soporte».',
      ],
    },
  ],
  conductor: [
    {
      id: 'drive-car-signup',
      titulo: 'Registrarte para Divoox Carro: tu carro y tus papeles',
      resumen:
        'Registra tu carro con sus plazas, sube los papeles del carro y los tuyos, y sigue la aprobación desde la app.',
      explicacion: [
        'Para llevar pasajeros en tu carro abres «Divoox Carro» en el Perfil de la app Divoox Driver. Ahí ves tu ciudad, registras el carro y subes lo que pide tu país.',
        'Del carro anotas la marca, el modelo, el año, el color, la placa y las plazas: cuatro para Carro o seis para Carro XL. Después subes sus papeles (el título o carnet de circulación, la póliza del carro y la que cubre a los pasajeros) y sus fotos.',
        'Tus papeles personales dependen del país; por ejemplo, la licencia de conducir. La app te dice uno por uno lo que te falta.',
        'Nuestro equipo revisa todo. Mientras tanto ves «Te falta» con lo pendiente; cuando te aprueban, la app te dice «Ya recibes viajes de Carro».',
      ],
      capturas: [
        foto(
          'driver-alta',
          'es',
          'La pantalla Divoox Carro del Driver con la ciudad, El Vigía, y el formulario del carro: marca, modelo, año, color, placa y plazas.',
          'Registras tu carro con sus plazas: 4 o 6.',
        ),
        foto(
          'driver-revision',
          'es',
          'El estado de la aprobación para Carro con la lista de lo que falta.',
          'Mientras revisamos, ves lo que te falta.',
        ),
        foto(
          'driver-aprobado',
          'es',
          'El estado de la aprobación en verde: Ya recibes viajes de Carro.',
          'Aprobado: ya recibes viajes de Carro.',
        ),
      ],
      preguntas: [
        '¿Cómo me registro como taxista en Divoox?',
        '¿Qué papeles piden para Divoox Carro?',
        '¿Cómo sé si ya me aprobaron para Carro?',
      ],
      pasos: [
        'En Divoox Driver, toca «Perfil» y abre «Divoox Carro».',
        'Comprueba tu ciudad.',
        'Escribe los datos de tu carro, elige sus plazas y toca «Guardar mi carro».',
        'Sube los papeles y las fotos del carro, y tus papeles personales, y envíalos a revisión.',
        'Revisa «Te falta» hasta que diga «Ya recibes viajes de Carro».',
      ],
      nota: 'Si te rechazan un papel, la app te dice por qué y puedes subirlo otra vez.',
    },
    {
      id: 'drive-car',
      titulo: 'Recibir y hacer viajes de Divoox Carro',
      resumen:
        'Acepta la oferta, busca al pasajero, empieza con su código y cobra al terminar según la forma de pago.',
      explicacion: [
        'Con Carro aprobado y conectado, te llegan ofertas de viaje con lo que ganas, la distancia, la recogida y el destino.',
        'Al llegar a la recogida tocas «Llegué». El viaje empieza solo cuando escribes el código de cuatro números que te dice el pasajero.',
        'Si el pasajero paga por pago móvil, en el viaje confirmas si te llegó el pago: «Sí, me llegó» o «No me llegó». Si paga en efectivo, al terminar la app te dice cuánto cobrar.',
        'En los países con saldo para comisiones, la comisión de cada viaje sale de tu saldo; con tarjeta, lo tuyo se suma a tus ganancias.',
      ],
      capturas: [
        foto(
          'driver-oferta',
          'es',
          'La oferta de un viaje de Carro con la ganancia, la distancia, la recogida y el destino.',
          'La oferta te muestra lo que ganas y la ruta.',
        ),
        foto(
          'driver-codigo',
          'es',
          'El viaje en la recogida con la casilla para escribir el código del pasajero.',
          'Empiezas el viaje con el código del pasajero.',
        ),
        foto(
          'driver-viaje',
          'es',
          'El viaje en curso con la confirmación del pago móvil: Sí, me llegó o No me llegó.',
          'Con pago móvil, confirmas si te llegó.',
        ),
        foto(
          'driver-cobro-efectivo',
          'es',
          'Al terminar un viaje en efectivo: cuánto cobrarle al pasajero.',
          'En efectivo, la app te dice cuánto cobrar.',
        ),
      ],
      preguntas: [
        '¿Cómo recibo viajes de taxi en Divoox?',
        '¿Para qué es el código del pasajero?',
        '¿Cómo confirmo un pago móvil?',
      ],
      pasos: [
        'Conéctate en la pantalla de Inicio.',
        'Cuando llegue la oferta, revisa la ganancia y la ruta, y toca «Aceptar viaje».',
        'Ve a la recogida y toca «Llegué».',
        'Pídele al pasajero su código, escríbelo y toca «Iniciar viaje».',
        'Si paga por pago móvil, confirma si te llegó. Al llegar al destino, toca «Terminar viaje» y, si es en efectivo, cobra lo que te dice la app.',
      ],
    },
  ],
};

const EN: { pasajero: Guia[]; conductor: Guia[] } = {
  pasajero: [
    {
      id: 'ride-car',
      titulo: 'Request a car (taxi) with Divoox Car',
      resumen:
        'Request a Car or a six-seat Car XL, see the fixed price before you confirm, and follow your driver until they arrive.',
      explicacion: [
        'Divoox Car is the Divoox taxi: a verified driver takes you in their car from one place to another in the city. It’s available in cities where Divoox Car is open; if it isn’t open in yours yet, the app won’t let you request it.',
        'There are two sizes. Car fits up to four riders with carry-on bags. Car XL fits up to six, for groups or more luggage.',
        'The price is fixed: you see it before you request and traffic doesn’t change it. In Venezuela it’s in US dollars, with its equivalent in bolívares at the day’s rate next to it.',
        'When a driver accepts, you see their name, their photo (if they have one), the car with its color and seats, the license plate, and how many minutes away they are. To start the ride you tell them your four-digit code, so you know you’re getting in with the right person.',
      ],
      capturas: [
        foto(
          'pasajero-precio',
          'en',
          'The Car screen with the map, the choice between Car and Car XL, the fixed price in US dollars with its equivalent in bolívares, and the payment methods.',
          'Before you request, you see the fixed price and choose how to pay.',
        ),
        foto(
          'pasajero-xl',
          'en',
          'The Car screen with the six-seat Car XL selected and its fixed price.',
          'For six riders, choose Car XL.',
        ),
        foto(
          'pasajero-conductor',
          'en',
          'The assigned ride: the map, the driver with their car, color, seats, license plate, and estimated arrival, and the ride code.',
          'You see your driver, their car, the plate, and when they arrive.',
        ),
        foto(
          'driver-codigo',
          'en',
          'The driver app asking for the rider’s four-digit code to start the ride.',
          'Your driver enters your code to start the ride.',
        ),
      ],
      preguntas: [
        'How do I request a taxi on Divoox?',
        'What’s the difference between Car and Car XL?',
        'Can the car price change?',
        'What is the ride code for?',
      ],
      pasos: [
        'Open Divoox and tap “Car.”',
        'Confirm the pickup point (you can move it on the map) and enter your destination.',
        'Choose “Car” or “Car XL (6 seats)” and tap “See price.”',
        'Check the fixed price and choose how to pay: the app shows the methods in your country (cash or mobile payment in Venezuela; card in the United States).',
        'Tap “Request Car.” When the driver accepts, you’ll see their details and location on the map.',
        'When you get in, check the plate and tell the driver your four-digit code.',
      ],
      nota: 'Don’t share your code by message: tell it to the driver in person when they pick you up.',
    },
    {
      id: 'ride-car-pay',
      titulo: 'Pay, tip, and see your rides in Car',
      resumen:
        'Pay with cash, mobile payment, or card depending on your country, tip when you arrive, and find the receipt and help in “My rides.”',
      explicacion: [
        'With cash, you pay the driver when you arrive. With a card, we authorize the fixed price when you request and charge it when the ride ends.',
        'Where mobile payment exists (for example, in Venezuela), you see your driver’s mobile payment details in the app as soon as they’re assigned. You pay the equivalent in bolívares at the day’s official rate, and the driver confirms in their app that it arrived.',
        'When you arrive you rate the ride with stars and a comment. If you paid by card, you can also tip your driver in the app; they get the whole tip. With cash or mobile payment, you tip them directly.',
        '“My rides,” below the Car screen, lists your past rides. Each one opens its receipt with the price breakdown, payment method, driver, and car.',
        'If you left something in the car, open that ride and choose “I left something in the vehicle.” We let the driver know and open your case; our team arranges the return with you. For safety, we don’t share phone numbers.',
      ],
      capturas: [
        foto(
          'pasajero-codigo',
          'en',
          'The ride in progress with the code to start and the driver’s mobile payment details: bank, name, phone, and ID number.',
          'With mobile payment, you see who to pay as soon as a driver is assigned.',
        ),
        foto(
          'pasajero-propina',
          'en',
          'On arrival: the stars to rate the ride, the comment box, and the mobile payment confirmed by the driver.',
          'When you arrive, rate the ride and see that the driver confirmed your payment.',
        ),
        foto(
          'pasajero-mis-viajes',
          'en',
          'The “My rides” list with the Car ride, date, destination, total, and status in green.',
          'Your past rides, below the Car screen.',
        ),
        foto(
          'pasajero-recibo',
          'en',
          'A Car ride receipt with pickup, destination, price breakdown, payment method, driver, and car.',
          'Every ride opens its receipt.',
        ),
        foto(
          'pasajero-olvide',
          'en',
          'Help with the ride, with “I left something in the vehicle” selected and the box to describe what you left.',
          'If you left something, report it from the ride itself.',
        ),
      ],
      preguntas: [
        'How do I pay for a car ride?',
        'Can I pay for a taxi with mobile payment?',
        'Can I tip my driver?',
        'Where do I see my ride receipt?',
        'What do I do if I left something in the car?',
      ],
      pasos: [
        'When you request, choose the payment method the app shows you.',
        'With mobile payment, pay to the details shown in the ride; with cash, pay when you arrive.',
        'When you arrive, rate the ride. If you paid by card, you can tip in the app.',
        'To see a past ride, open “Car” and scroll down to “My rides.” Tap the ride to see its receipt.',
        'If you left something, in that ride tap “I left something in the vehicle,” tell us what and where, and tap “Send to support.”',
      ],
    },
  ],
  conductor: [
    {
      id: 'drive-car-signup',
      titulo: 'Sign up for Divoox Car: your car and your documents',
      resumen:
        'Register your car with its seats, upload the car’s documents and your own, and track your approval in the app.',
      explicacion: [
        'To give rides in your car, open “Divoox Car” in Profile in the Divoox Driver app. There you see your city, register the car, and upload what your country requires.',
        'For the car you enter the make, model, year, color, license plate, and seats: four for Car or six for Car XL. Then you upload its documents (title or registration card, the car’s insurance policy, and the one that covers riders) and its photos.',
        'Your personal documents depend on the country; for example, your driver’s license. The app tells you, one by one, what’s missing.',
        'Our team reviews everything. Meanwhile you see “Still needed” with what’s pending; once you’re approved, the app says “You’re receiving Car rides.”',
      ],
      capturas: [
        foto(
          'driver-alta',
          'en',
          'The Divoox Car screen in Driver with the city, El Vigía, and the car form: make, model, year, color, license plate, and seats.',
          'Register your car with its seats: 4 or 6.',
        ),
        foto(
          'driver-revision',
          'en',
          'The Car approval status with the list of what’s still needed.',
          'While we review, you see what’s still needed.',
        ),
        foto(
          'driver-aprobado',
          'en',
          'The approval status in green: you’re receiving Car rides.',
          'Approved: you’re receiving Car rides.',
        ),
      ],
      preguntas: [
        'How do I sign up as a taxi driver on Divoox?',
        'What documents does Divoox Car require?',
        'How do I know I’m approved for Car?',
      ],
      pasos: [
        'In Divoox Driver, tap “Profile” and open “Divoox Car.”',
        'Check your city.',
        'Enter your car’s details, choose its seats, and tap “Save my car.”',
        'Upload the car’s documents and photos and your personal documents, and send them for review.',
        'Check the list of what’s still needed until it says you’re receiving Car rides.',
      ],
      nota: 'If a document is rejected, the app tells you why and you can upload it again.',
    },
    {
      id: 'drive-car',
      titulo: 'Receive and complete Divoox Car rides',
      resumen:
        'Accept the offer, pick up the rider, start with their code, and collect at the end based on the payment method.',
      explicacion: [
        'Once approved for Car and online, you receive ride offers with your earnings, the distance, the pickup, and the destination.',
        'When you reach the pickup, tap “I’ve arrived.” The ride starts only when you enter the four-digit code the rider gives you.',
        'If the rider pays by mobile payment, you confirm in the ride whether it arrived: “Yes, it arrived” or “It didn’t arrive.” If they pay cash, the app tells you how much to collect when the ride ends.',
        'In countries with a commission balance, each ride’s commission comes out of your balance; with card payments, your share is added to your earnings.',
      ],
      capturas: [
        foto(
          'driver-oferta',
          'en',
          'A Car ride offer with earnings, distance, pickup, and destination.',
          'The offer shows your earnings and the route.',
        ),
        foto(
          'driver-codigo',
          'en',
          'The ride at pickup with the box to enter the rider’s code.',
          'You start the ride with the rider’s code.',
        ),
        foto(
          'driver-viaje',
          'en',
          'The ride in progress with the mobile payment confirmation: Yes, it arrived or It didn’t arrive.',
          'With mobile payment, you confirm whether it arrived.',
        ),
        foto(
          'driver-cobro-efectivo',
          'en',
          'At the end of a cash ride: how much to collect from the rider.',
          'With cash, the app tells you how much to collect.',
        ),
      ],
      preguntas: [
        'How do I receive taxi rides on Divoox?',
        'What is the rider’s code for?',
        'How do I confirm a mobile payment?',
      ],
      pasos: [
        'Go online on the Home screen.',
        'When an offer arrives, check the earnings and route, and tap “Accept ride.”',
        'Go to the pickup and tap “I’ve arrived.”',
        'Ask the rider for their code, enter it, and tap “Start ride.”',
        'If they pay by mobile payment, confirm whether it arrived. At the destination, tap “End ride” and, if it’s cash, collect what the app tells you.',
      ],
    },
  ],
};

export const GUIAS_CARRO: Record<Idioma, { pasajero: Guia[]; conductor: Guia[] }> = {
  es: ES,
  en: EN,
};
