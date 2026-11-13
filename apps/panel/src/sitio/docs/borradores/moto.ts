import type { Idioma } from '@tumbite/compartido';
import type { Guia } from '../guias';

/**
 * Guías de Divoox Moto escritas y GUARDADAS SIN PUBLICAR (punto 12 del roadmap). No están en `DOCS`:
 * se publican el día que Richard encienda Moto en un país, agregándolas a la sección que toque
 * («ordering» para el pasajero y «drivers» para el conductor). Para el público, en los dos idiomas,
 * sin nada interno. La prueba `borradores.test.ts` cuida que sigan completas y sin publicar.
 *
 * 13 nov 2026 (Moto en Venezuela): se agregaron el alta del conductor (moto y papeles) y el saldo
 * con recargas, y el pago móvil del pasajero. FALTAN CAPTURAS REALES antes de publicar (regla: ninguna
 * guía sin capturas): Driver «Divoox Moto» (ciudad, moto, papeles con su estado), Ganancias con «Te
 * alcanza para unas N carreras», el viaje con «¿Te llegó el pago móvil?», y en la app del pasajero la
 * elección de pago móvil y la tarjeta con los datos del conductor. Se toman en el sitio de pruebas.
 */
export const BORRADORES_MOTO: Record<Idioma, { pasajero: Guia[]; conductor: Guia[] }> = {
  es: {
    pasajero: [
      {
        id: 'ride-moto',
        titulo: 'Pedir un viaje en moto',
        resumen:
          'Elige a dónde vas, mira el precio antes de confirmar y sigue a tu conductor en el mapa hasta que llegue.',
        explicacion: [
          'Divoox Moto te lleva rápido por la ciudad. El precio es fijo: lo ves antes de pedir y no cambia por el tráfico.',
          'Al confirmar buscamos al conductor más cercano. Cuando acepta, ves su nombre, su moto, el color y la placa, y lo sigues en el mapa.',
          'Para empezar el viaje, en las ciudades donde se usa, le dices al conductor tu código de cuatro números. Así sabes que te subes con la persona correcta.',
        ],
        preguntas: [
          '¿Cómo pido una moto?',
          '¿El precio puede cambiar?',
          '¿Para qué sirve el código del viaje?',
        ],
        pasos: [
          'Abre Divoox y toca «Moto».',
          'Confirma el punto de recogida (puedes moverlo en el mapa) y escribe tu destino.',
          'Mira el precio fijo y elige cómo pagas: efectivo o tarjeta.',
          'Toca «Pedir». Cuando el conductor acepte, verás sus datos y su ubicación.',
          'Al subirte, comprueba la placa y, si la app te muestra un código, díselo al conductor.',
        ],
        nota: 'Usa siempre el casco que te ofrece el conductor.',
      },
      {
        id: 'ride-moto-pago',
        titulo: 'Pagar, cancelar y dejar propina en Moto',
        resumen:
          'Paga en efectivo, con tarjeta o por pago móvil (según tu país), cancela gratis al principio y deja propina cuando termine el viaje.',
        explicacion: [
          'Con tarjeta, apartamos el precio al pedir y lo cobramos al terminar. En efectivo, le pagas al conductor al llegar.',
          'Donde existe el pago móvil (por ejemplo, en Venezuela), cuando te asignan conductor ves sus datos de pago móvil en la app. Pagas el equivalente en bolívares a la tasa oficial del día y el conductor confirma en su app que le llegó.',
          'Cancelar es gratis mientras buscamos conductor y durante los primeros minutos después de que acepta. Después, la app te dice antes cuánto cuesta cancelar; ese cargo es para el conductor que fue a buscarte.',
          'Si el conductor espera más de lo incluido en el punto de recogida, se suma un pequeño cargo por minuto, como en los demás servicios de transporte.',
        ],
        preguntas: [
          '¿Cuánto cuesta cancelar un viaje en moto?',
          '¿Puedo dejar propina?',
          '¿Qué pasa si debo un cargo de un viaje en efectivo?',
        ],
        pasos: [
          'Elige cómo pagas antes de pedir: la app te muestra solo los métodos de tu ciudad.',
          'Para cancelar, toca «Cancelar viaje»: la app te dice si es gratis o cuánto cuesta.',
          'Al terminar, califica el viaje y, si pagaste con tarjeta, deja propina si quieres. Va entera al conductor.',
          'Si cancelaste tarde un viaje en efectivo, el cargo se suma a tu próximo viaje.',
        ],
      },
      {
        id: 'ride-seguridad',
        titulo: 'Tu seguridad en los viajes',
        resumen:
          'Comparte tu viaje en vivo, elige contactos de confianza y pide ayuda con un toque.',
        explicacion: [
          'Puedes compartir tu viaje con quien quieras: recibe un enlace para verlo en vivo, sin necesidad de tener cuenta. El enlace deja de funcionar cuando el viaje termina.',
          'Con los contactos de confianza (hasta cinco), ellos reciben el enlace por mensaje cuando empieza tu viaje: siempre, solo de noche o nunca, como elijas.',
          'Si el viaje se sale de la ruta esperada, la app te pregunta si todo está bien. Si necesitas ayuda, con un toque llamas a emergencias y avisamos a nuestro equipo con tu ubicación.',
        ],
        preguntas: [
          '¿Cómo comparto mi viaje?',
          '¿Qué son los contactos de confianza?',
          '¿Qué hago si me siento inseguro en un viaje?',
        ],
        pasos: [
          'Antes de pedir, agrega tus contactos de confianza en la pantalla de Moto y elige cuándo compartir.',
          'Durante el viaje, toca «Compartir mi viaje» para mandar el enlace a quien quieras.',
          'Si la app te pregunta «¿Todo bien?», toca «Estoy bien» o «Necesito ayuda».',
          'En cualquier momento, el botón «Emergencia» llama al número de emergencias de tu país y nos avisa.',
        ],
      },
    ],
    conductor: [
      {
        id: 'drive-moto',
        titulo: 'Conducir con Divoox Moto',
        resumen:
          'Recibe ofertas de viaje con la ganancia a la vista, recoge al pasajero con su código y termina el viaje en la app.',
        explicacion: [
          'Cada oferta te muestra antes de aceptar lo que ganas, dónde recoges, a dónde vas, cuánto dura y cómo paga el pasajero.',
          'Al llegar, toca «Llegué». El pasajero tiene unos minutos de espera incluidos; si no aparece, puedes cerrar el viaje como «no se presentó» y recibes el cargo.',
          'Para empezar, confirma que el pasajero lleva casco y, si la ciudad lo usa, escribe el código que te dice. Al llegar al destino, toca «Terminar».',
        ],
        preguntas: [
          '¿Cómo acepto un viaje en moto?',
          '¿Qué hago si el pasajero no aparece?',
          '¿Quién recibe el cargo si el pasajero cancela?',
        ],
        pasos: [
          'Conéctate y espera una oferta. Revisa la ganancia y la ruta, y toca «Aceptar».',
          'Ve al punto de recogida y toca «Llegué» cuando estés ahí.',
          'Ofrece el casco al pasajero, confírmalo en la app y escribe su código si la app lo pide.',
          'Llévalo a su destino y toca «Terminar». En efectivo, cobra el total que muestra la app.',
          'Si el pasajero cancela tarde o no aparece, el cargo es para ti.',
        ],
        nota: 'En algunas ciudades te pedimos una selfie con el casco puesto antes de aceptar viajes. Vale 12 horas.',
      },
      {
        id: 'drive-moto-alta',
        titulo: 'Registrar tu moto y tus papeles para Divoox Moto',
        resumen:
          'Elige tu ciudad, registra tu moto, sube tus papeles con la cámara y sigue tu aprobación desde la app.',
        explicacion: [
          'Para llevar pasajeros en moto primero te conocemos: verificamos tu identidad, tu licencia, tus antecedentes y los papeles de tu moto. Así cuidamos al pasajero y a ti.',
          'Lo que se pide depende de tu país. En Venezuela, por ejemplo, subes tu licencia para manejar moto y tu certificado de antecedentes penales, y nuestro equipo los revisa uno por uno.',
          'Cada papel muestra su estado: sin subir, en revisión, aprobado o «hay que corregir» con el motivo. Cuando todo está aprobado, activas «Recibir viajes de Moto».',
        ],
        preguntas: [
          '¿Qué papeles necesito para trabajar con Divoox Moto?',
          '¿Cómo subo la foto de un documento?',
          '¿Cuánto tarda la aprobación?',
        ],
        pasos: [
          'En la app Divoox Driver, entra a Perfil y toca «Divoox Moto».',
          'Revisa tu ciudad y cámbiala si hace falta.',
          'Escribe la marca, el modelo, el año, el color y la placa de tu moto, y toca «Guardar mi moto».',
          'Sube cada papel de la moto: toca «Subir» y elige «Tomar foto» o «Subir desde archivos».',
          'Sube tus papeles de conductor y verifica tu identidad en «Documentos».',
          'Toca «Enviar mi moto a revisión». Te avisamos cuando esté aprobada.',
          'Cuando todo esté aprobado, toca «Usar esta moto para trabajar» y «Recibir viajes de Moto».',
        ],
        nota: 'Si un papel sale con «hay que corregir», lee el motivo y súbelo de nuevo: no hace falta empezar desde cero.',
      },
      {
        id: 'drive-moto-saldo',
        titulo: 'Tu saldo para comisiones y las recargas',
        resumen:
          'El pasajero te paga el viaje completo; la comisión de Divoox sale de tu saldo. Mira para cuántas carreras te alcanza y recarga en un punto autorizado.',
        explicacion: [
          'En los países donde trabajas con saldo, el pasajero te paga todo el viaje a ti, en efectivo o por pago móvil. Al terminar el viaje, la comisión de Divoox se descuenta de tu saldo.',
          'Al aceptar un viaje apartamos su comisión; si el viaje no se hace, vuelve a tu saldo. Nunca se descuenta dos veces.',
          'La app te dice para cuántas carreras te alcanza tu saldo, calculado con la comisión de un viaje típico. Es un aproximado. Cuando se está acabando, te avisamos; sin saldo no recibes carreras hasta que recargues.',
        ],
        preguntas: [
          '¿Cómo recargo mi saldo?',
          '¿Para cuántas carreras me alcanza?',
          '¿Por qué no me llegan viajes?',
        ],
        pasos: [
          'Compra una recarga en un punto de venta autorizado de Divoox. Te dan un código.',
          'En la app, entra a Ganancias y busca «Saldo para comisiones».',
          'Escribe el código y toca «Recargar con el código». El saldo aparece al momento.',
          'Revisa la línea «Te alcanza para unas N carreras» y recarga antes de quedarte sin saldo.',
        ],
        nota: 'El saldo para comisiones no es una ganancia y no se retira: solo paga las comisiones de tus viajes.',
      },
      {
        id: 'drive-moto-seguridad',
        titulo: 'Descanso y seguridad del conductor',
        resumen:
          'Después de 12 horas manejando, descansas 6 antes de recibir más viajes. Tienes botón de emergencia en cada viaje.',
        explicacion: [
          'Por tu seguridad y la del pasajero, contamos el tiempo que pasas en viajes. Con 12 horas en un día, la app te pide descansar 6 horas seguidas antes de aceptar otro viaje.',
          'En cada viaje tienes el botón de emergencia: llama al número de emergencias del país y avisa a nuestro equipo con tu ubicación.',
        ],
        preguntas: ['¿Por qué no puedo aceptar más viajes hoy?', '¿Cómo pido ayuda en un viaje?'],
        pasos: [
          'Si la app te dice que descanses, desconéctate: te dice en cuántas horas vuelves a recibir viajes.',
          'Ante cualquier problema en el viaje, toca «Emergencia».',
        ],
      },
    ],
  },
  en: {
    pasajero: [
      {
        id: 'ride-moto',
        titulo: 'Request a motorcycle ride',
        resumen:
          'Choose where you’re going, see the price before you confirm, and follow your driver on the map until they arrive.',
        explicacion: [
          'Divoox Moto gets you across the city fast. The price is upfront: you see it before you request and it doesn’t change with traffic.',
          'When you confirm, we find the nearest driver. Once they accept, you see their name, motorcycle, color and plate, and you can follow them on the map.',
          'To start the ride, in cities that use it, you tell the driver your four-digit code. That way you know you’re getting on with the right person.',
        ],
        preguntas: [
          'How do I request a motorcycle ride?',
          'Can the price change?',
          'What is the ride code for?',
        ],
        pasos: [
          'Open Divoox and tap “Moto”.',
          'Confirm your pickup point (you can move it on the map) and enter your destination.',
          'Check the upfront price and choose how to pay: cash or card.',
          'Tap “Request”. When a driver accepts, you’ll see their details and location.',
          'When you get on, check the plate and, if the app shows a code, tell it to the driver.',
        ],
        nota: 'Always wear the helmet your driver offers you.',
      },
      {
        id: 'ride-moto-pago',
        titulo: 'Paying, canceling and tipping on Moto',
        resumen:
          'Pay with cash, card, or mobile payment (depending on your country), cancel for free at the start, and leave a tip when the ride ends.',
        explicacion: [
          'With a card, we hold the price when you request and charge it when the ride ends. With cash, you pay the driver when you arrive.',
          'Where mobile payment is available (for example, in Venezuela), once you get a driver you see their mobile payment details in the app. You pay the equivalent in bolívars at the official rate of the day, and the driver confirms in their app that it arrived.',
          'Canceling is free while we look for a driver and for the first few minutes after one accepts. After that, the app tells you upfront what canceling costs; that fee goes to the driver who came to pick you up.',
          'If the driver waits longer than the included time at pickup, a small per-minute fee is added, as with other ride services.',
        ],
        preguntas: [
          'How much does it cost to cancel a motorcycle ride?',
          'Can I leave a tip?',
          'What happens if I owe a fee from a cash ride?',
        ],
        pasos: [
          'Choose how you pay before you request: the app only shows the methods available in your city.',
          'To cancel, tap “Cancel ride”: the app tells you whether it’s free or what it costs.',
          'When the ride ends, rate it and, if you paid by card, leave a tip if you like. It all goes to the driver.',
          'If you canceled a cash ride late, the fee is added to your next ride.',
        ],
      },
      {
        id: 'ride-seguridad',
        titulo: 'Your safety on rides',
        resumen: 'Share your ride live, choose trusted contacts and get help with one tap.',
        explicacion: [
          'You can share your ride with anyone: they get a link to follow it live, no account needed. The link stops working when the ride ends.',
          'With trusted contacts (up to five), they get the link by text when your ride starts: always, only at night or never, as you choose.',
          'If the ride goes off the expected route, the app asks whether everything is OK. If you need help, one tap calls emergency services and alerts our team with your location.',
        ],
        preguntas: [
          'How do I share my ride?',
          'What are trusted contacts?',
          'What should I do if I feel unsafe on a ride?',
        ],
        pasos: [
          'Before you request, add your trusted contacts on the Moto screen and choose when to share.',
          'During the ride, tap “Share my ride” to send the link to anyone.',
          'If the app asks “Everything OK?”, tap “I’m OK” or “I need help”.',
          'At any time, the “Emergency” button calls your country’s emergency number and alerts us.',
        ],
      },
    ],
    conductor: [
      {
        id: 'drive-moto',
        titulo: 'Driving with Divoox Moto',
        resumen:
          'Get ride offers with your earnings upfront, pick up the rider with their code and end the ride in the app.',
        explicacion: [
          'Each offer shows you, before you accept, what you earn, where you pick up, where you’re going, how long it takes and how the rider pays.',
          'When you arrive, tap “I’ve arrived”. The rider has a few minutes of included wait time; if they don’t show up, you can close the ride as a no-show and you get the fee.',
          'To start, confirm the rider is wearing a helmet and, if the city uses it, enter the code they tell you. When you reach the destination, tap “End”.',
        ],
        preguntas: [
          'How do I accept a motorcycle ride?',
          'What do I do if the rider doesn’t show up?',
          'Who gets the fee if the rider cancels?',
        ],
        pasos: [
          'Go online and wait for an offer. Check the earnings and route, and tap “Accept”.',
          'Go to the pickup point and tap “I’ve arrived” when you’re there.',
          'Offer the rider a helmet, confirm it in the app and enter their code if the app asks for it.',
          'Take them to their destination and tap “End”. For cash rides, collect the total the app shows.',
          'If the rider cancels late or doesn’t show up, the fee is yours.',
        ],
        nota: 'In some cities we ask for a selfie with your helmet on before you accept rides. It’s valid for 12 hours.',
      },
      {
        id: 'drive-moto-alta',
        titulo: 'Register your motorcycle and documents for Divoox Moto',
        resumen:
          'Choose your city, register your motorcycle, upload your documents with your camera, and track your approval in the app.',
        explicacion: [
          'Before you give rides, we get to know you: we verify your identity, your license, your background, and your motorcycle’s documents. That keeps riders and you safe.',
          'What we ask for depends on your country. In Venezuela, for example, you upload your motorcycle license and your criminal record certificate, and our team reviews each one.',
          'Each document shows its status: not uploaded, under review, approved, or “needs a fix” with the reason. Once everything is approved, you turn on “Get Moto rides.”',
        ],
        preguntas: [
          'What documents do I need to drive with Divoox Moto?',
          'How do I upload a photo of a document?',
          'How long does approval take?',
        ],
        pasos: [
          'In the Divoox Driver app, go to Profile and tap “Divoox Moto.”',
          'Check your city and change it if needed.',
          'Enter your motorcycle’s make, model, year, color, and license plate, and tap “Save my motorcycle.”',
          'Upload each motorcycle document: tap “Upload” and choose “Take photo” or “Upload from files.”',
          'Upload your driver documents and verify your identity under “Documents.”',
          'Tap “Send my motorcycle for review.” We’ll let you know when it’s approved.',
          'Once everything is approved, tap “Use this motorcycle to work” and “Get Moto rides.”',
        ],
        nota: 'If a document says “needs a fix,” read the reason and upload it again: you don’t have to start over.',
      },
      {
        id: 'drive-moto-saldo',
        titulo: 'Your fee balance and top-ups',
        resumen:
          'The rider pays you the full fare; the Divoox fee comes out of your balance. See how many rides it covers and top up at an authorized sales point.',
        explicacion: [
          'In countries where you work with a balance, the rider pays you the whole fare, in cash or by mobile payment. When the ride ends, the Divoox fee is deducted from your balance.',
          'When you accept a ride, we set its fee aside; if the ride doesn’t happen, it goes back to your balance. It’s never deducted twice.',
          'The app tells you how many rides your balance covers, based on the fee for a typical ride. It’s an estimate. When it’s running low we let you know; with no balance you don’t get rides until you top up.',
        ],
        preguntas: [
          'How do I top up my balance?',
          'How many rides does my balance cover?',
          'Why am I not getting rides?',
        ],
        pasos: [
          'Buy a top-up at an authorized Divoox sales point. You get a code.',
          'In the app, go to Earnings and find “Balance for fees.”',
          'Enter the code and tap “Top up with the code.” The balance shows up right away.',
          'Check the line “Enough for about N rides” and top up before you run out.',
        ],
        nota: 'Your fee balance isn’t earnings and can’t be withdrawn: it only pays the fees for your rides.',
      },
      {
        id: 'drive-moto-seguridad',
        titulo: 'Driver rest and safety',
        resumen:
          'After 12 hours of driving, you rest for 6 before getting more rides. Every ride has an emergency button.',
        explicacion: [
          'For your safety and the rider’s, we count the time you spend on rides. With 12 hours in a day, the app asks you to rest for 6 hours in a row before accepting another ride.',
          'Every ride has the emergency button: it calls the country’s emergency number and alerts our team with your location.',
        ],
        preguntas: ['Why can’t I accept more rides today?', 'How do I get help during a ride?'],
        pasos: [
          'If the app asks you to rest, go offline: it tells you in how many hours you’ll get rides again.',
          'If anything goes wrong during a ride, tap “Emergency”.',
        ],
      },
    ],
  },
};
