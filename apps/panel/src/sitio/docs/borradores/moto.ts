import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from '../guias';

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
const TODAS_MOTO: Record<Idioma, { pasajero: Guia[]; conductor: Guia[] }> = {
  es: {
    pasajero: [
      {
        id: 'ride-moto',
        titulo: 'Pedir un viaje en moto',
        resumen:
          'Elige a dónde vas, mira el precio antes de confirmar y sigue a tu conductor en el mapa hasta que llegue.',
        explicacion: [
          'Divoox Moto te lleva rápido por la ciudad. Está disponible en las ciudades donde Divoox Moto esté abierto; si en la tuya todavía no lo está, la app no te deja pedirlo.',
          'El precio es fijo: lo ves antes de pedir y no cambia por el tráfico. En Venezuela el precio va en dólares y, al lado, ves su equivalente en bolívares con la tasa del día. La tasa es, por defecto, la oficial del Banco Central de Venezuela, que se actualiza sola cada día hábil; al lado ves de qué día es. Es solo de referencia: el precio se fija en dólares.',
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
          'Mira el precio fijo y toca «Continuar»: en «Método de pago» eliges cómo pagas con los métodos de tu ciudad (en Venezuela, tu Saldo Divoox, Pago Móvil o efectivo).',
          'Toca «Solicitar moto». Cuando el conductor acepte, verás sus datos y su ubicación.',
          'Al subirte, comprueba la placa y, si la app te muestra un código, díselo al conductor.',
        ],
        nota: 'Usa siempre el casco que te ofrece el conductor.',
      },
      {
        id: 'ride-moto-pago',
        titulo: 'Pagar, cancelar y dejar propina en Moto',
        resumen:
          'Paga con tu Saldo Divoox, en efectivo, con tarjeta o por Pago Móvil (según tu país), cancela gratis al principio y deja propina cuando termine el viaje.',
        explicacion: [
          'Después de ver el precio tocas «Continuar» y llegas a «Método de pago»: ahí ves el monto a pagar y eliges cómo pagas antes de solicitar. Está en su propia guía, «Elegir cómo pagas un viaje».',
          'Con tarjeta, apartamos el precio al pedir y lo cobramos al terminar. En efectivo, le pagas al conductor al llegar.',
          'Donde existe el Pago Móvil (por ejemplo, en Venezuela), cuando te asignan conductor ves sus datos de Pago Móvil en la app. Pagas el equivalente en bolívares a la tasa oficial del día y el conductor confirma en su app que le llegó. Si en ese momento no hay conductores cerca que reciban Pago Móvil, la opción sale con «Aún no disponible para este viaje» y puedes pagar en efectivo.',
          'En Venezuela también puedes pagar con tu Saldo Divoox: si alcanza, pagas todo con saldo; si no, usas lo que tienes y el resto lo pagas en efectivo o por Pago Móvil. Está en la guía «Tu Saldo Divoox».',
          'En Venezuela todo lo que pagas en mano se ve en dólares y en bolívares: antes de confirmar, durante el viaje, al terminar y en tu recibo. La tasa queda fijada al pedir el viaje, así tú y tu conductor ven exactamente el mismo monto aunque la tasa cambie después; la app te dice qué tasa se usó y de qué día. Si tienes un regalo de Divoox, ves la diferencia que te toca pagar en las dos monedas. Si ese día no hay tasa disponible, la app lo dice y pagas en dólares.',
          'Cancelar es gratis mientras buscamos conductor y durante los primeros minutos después de que acepta. Después, la app te dice antes cuánto cuesta cancelar; ese cargo es para el conductor que fue a buscarte.',
          'Si el conductor espera más de lo incluido en el punto de recogida, se suma un pequeño cargo por minuto, como en los demás servicios de transporte.',
          'En algunas ciudades el viaje sube un porcentaje fijo de noche (tarifa nocturna), como en la calle. Antes de pedir, la tarjeta del precio dice «Tarifa nocturna» con el porcentaje, y el precio que ves ya lo trae: es el que pagas, en efectivo, por pago móvil o con tarjeta. Si reservas, cuenta la hora de la reserva.',
        ],
        preguntas: [
          '¿Cuánto cuesta cancelar un viaje en moto?',
          '¿Qué es la tarifa nocturna?',
          '¿Puedo dejar propina?',
          '¿Qué pasa si debo un cargo de un viaje en efectivo?',
        ],
        pasos: [
          'Toca «Continuar» y, en «Método de pago», elige cómo pagas: la app te muestra solo los métodos de tu ciudad.',
          'Para cancelar, toca «Cancelar viaje»: la app te dice si es gratis o cuánto cuesta.',
          'Al terminar, califica el viaje y, si pagaste con tarjeta, deja propina si quieres. Va entera al conductor.',
          'Si cancelaste tarde un viaje en efectivo, el cargo se suma a tu próximo viaje.',
        ],
      },
      {
        id: 'payment-method',
        titulo: 'Elegir cómo pagas un viaje',
        resumen:
          'Después de ver el precio, la pantalla «Método de pago» te muestra el monto a pagar y eliges cómo pagas antes de solicitar.',
        explicacion: [
          'Al tocar «Continuar» en Moto, Carro o Envíos llegas a «Método de pago». Arriba ves el monto a pagar en grande; en Venezuela, también en bolívares con la tasa del día y su fecha. De noche, en las ciudades con tarifa nocturna, ese monto ya la trae y debajo dice «Incluye la tarifa nocturna» con su porcentaje: tu Saldo Divoox se descuenta de ese total.',
          'Debajo ves las formas de pago de tu ciudad. En Venezuela: tu Saldo Divoox, Pago Móvil y efectivo. Con Pago Móvil le pagas al conductor y ves sus datos cuando acepta; con efectivo le pagas al terminar.',
          'Si en ese momento no hay conductores cerca que reciban Pago Móvil, la opción sale con «Aún no disponible para este viaje» y la app elige efectivo por ti. No pierdes nada de lo que escribiste.',
          'El botón «Solicitar» dice cuánto pagas en mano. Si algo cambió mientras elegías, la app te lo dice en la misma pantalla y puedes elegir otra forma de pago.',
        ],
        preguntas: [
          '¿Dónde elijo cómo pago el viaje?',
          '¿Por qué Pago Móvil dice «Aún no disponible para este viaje»?',
          '¿Puedo pagar parte con saldo y parte en efectivo?',
        ],
        pasos: [
          'Elige tu destino y mira el precio.',
          'Toca «Continuar».',
          'Si tienes Saldo Divoox, decide si lo usas con el interruptor.',
          'Elige cómo pagas el resto: Pago Móvil o efectivo.',
          'Toca «Solicitar».',
        ],
      },
      {
        id: 'divoox-balance',
        titulo: 'Tu Saldo Divoox',
        resumen:
          'El Saldo Divoox es crédito en dólares para pagar tus viajes: si alcanza, pagas todo con saldo; si no, usas lo que tienes y el resto lo pagas en mano.',
        explicacion: [
          'Tu Saldo Divoox lo carga nuestro equipo: una carrera de regalo, una recarga de regalo o lo que pagaste por adelantado. Cuando te cargamos saldo, te llega un aviso con el monto.',
          'En «Método de pago» ves tu saldo disponible en dólares y en bolívares, con el logo de Divoox. Con el interruptor encendido, primero se descuenta tu regalo de código (si tienes) y después tu saldo, hasta donde alcance.',
          'Si el saldo cubre todo el viaje, no pagas nada en mano. Si no alcanza, la pantalla te dice cuánto usas y cuánto te queda por pagar, y eliges si el resto va por Pago Móvil o en efectivo.',
          'El saldo se separa al pedir. Si cancelas, o si no encontramos conductor, vuelve completo a tu cuenta. Por ahora se usa en los viajes de ahora, no en las reservas.',
        ],
        preguntas: [
          '¿Cómo consigo Saldo Divoox?',
          '¿Qué pasa con mi saldo si cancelo el viaje?',
          '¿Puedo usar el saldo en una reserva?',
        ],
        pasos: [
          'Pide tu viaje y toca «Continuar».',
          'En la tarjeta «Saldo Divoox», deja el interruptor encendido.',
          'Mira cuánto usas y cuánto te queda por pagar.',
          'Si queda algo por pagar, elige Pago Móvil o efectivo.',
          'Toca «Solicitar».',
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
          '¿Es seguro viajar en moto con Divoox?',
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
          'Al llegar, desliza la barra «Desliza al llegar». El pasajero tiene unos minutos de espera incluidos; si no aparece, puedes cerrar el viaje como «no se presentó» y recibes el cargo.',
          'Para empezar, confirma que el pasajero lleva casco y, si la ciudad lo usa, escribe el código que te dice. Al llegar al destino, toca «Terminar».',
        ],
        preguntas: [
          '¿Cómo acepto un viaje en moto?',
          '¿Qué hago si el pasajero no aparece?',
          '¿Quién recibe el cargo si el pasajero cancela?',
        ],
        pasos: [
          'Conéctate y espera una oferta. Revisa la ganancia y la ruta, y toca «Aceptar».',
          'Ve al punto de recogida y desliza la barra «Desliza al llegar» cuando estés ahí.',
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
          'Divoox Moto se abre ciudad por ciudad: puedes registrarte en las ciudades donde Divoox Moto esté abierto. Para llevar pasajeros en moto primero te conocemos: verificamos tu identidad, tu licencia y los papeles de tu moto. Así cuidamos al pasajero y a ti.',
          'Lo que se pide depende de tu lugar, y la app te lo dice. Donde Divoox da un plazo, empiezas a trabajar con la foto de tu cara y entregas el resto de tus papeles después, por lo general dentro de un mes: lo explica la guía «Tu plazo para entregar los papeles». Las fotos de tu cara, tu documento, tu licencia y el seguro se toman en el momento con la cámara de la app, y nuestro equipo las revisa una por una.',
          'Cada papel muestra su estado: sin subir, en revisión, aprobado o «hay que corregir» con el motivo. Cuando todo está aprobado, activas «Recibir viajes de Moto».',
        ],
        preguntas: [
          '¿Qué papeles necesito para trabajar con Divoox Moto?',
          '¿Cómo subo la foto de un documento?',
          '¿Cuánto tarda la aprobación?',
        ],
        pasos: [
          'En la app Divoox Driver, entra a Cuenta → «Mis datos y vehículo» y toca «Divoox Moto».',
          'Revisa tu ciudad y cámbiala si hace falta (después de elegirla, puedes cambiarla una vez cada 24 horas dentro de tu país).',
          'Escribe la marca, el modelo, el año, el color y la placa de tu moto, y toca «Guardar mi moto».',
          'Sube cada papel de la moto: toca «Subir» y elige «Tomar foto» o «Subir desde archivos».',
          'Toma las fotos de tus papeles de conductor en «Tus papeles», con la cámara de la app, y envíalas a revisión.',
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
          'En Venezuela, lo que cobras en mano se ve en dólares y en bolívares, con la tasa fijada al pedir el viaje: en la oferta, en la tarjeta del viaje y al terminar. Tu pasajero ve el mismo monto. Si el pasajero trae un regalo de Divoox, cobras solo la diferencia y Divoox te paga el resto en tu saldo.',
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
          'Divoox Moto gets you across the city fast. It’s available in the cities where Divoox Moto is open; if it isn’t open in yours yet, the app won’t let you request it.',
          'The price is upfront: you see it before you request and it doesn’t change with traffic. In the United States the price is in US dollars, and the app shows it next to the distance and the time of your ride, so you know what you’ll pay before you get on.',
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
          'Check the upfront price and tap “Continue”: on “Payment method” you choose how to pay with the methods available in your city (in the United States, cash or card).',
          'Tap “Request moto”. When a driver accepts, you’ll see their details and location.',
          'When you get on, check the plate and, if the app shows a code, tell it to the driver.',
        ],
        nota: 'Always wear the helmet your driver offers you.',
      },
      {
        id: 'ride-moto-pago',
        titulo: 'Paying, canceling and tipping on Moto',
        resumen:
          'Pay with cash or card, cancel for free at the start, and tip your driver when the ride ends.',
        explicacion: [
          'After you see the price, tap “Continue” to open “Payment method”: it shows the amount to pay and you choose how you’ll pay before you request. It has its own guide, “Choosing how you pay for a ride.”',
          'With a card, we hold the price when you request and charge it when the ride ends. With cash, you pay the driver when you arrive.',
          'During the ride the app keeps the upfront price in view, so you always know exactly what you’ll pay.',
          'Canceling is free while we look for a driver and for the first few minutes after one accepts. After that, the app tells you upfront what canceling costs; that fee goes to the driver who came to pick you up.',
          'If the driver waits longer than the included time at pickup, a small per-minute fee is added, as with other ride services.',
          'In some cities, rides cost a set percentage more at night (night fare). Before you request, the price card says “Night fare” with the percentage, and the price you see already includes it: that is what you pay. If you book a ride for later, the booked time is what counts.',
        ],
        preguntas: [
          'How much does it cost to cancel a motorcycle ride?',
          'What is the night fare?',
          'Can I leave a tip?',
          'What happens if I owe a fee from a cash ride?',
        ],
        pasos: [
          'Tap “Continue” and, on “Payment method,” choose how you pay: the app only shows the methods available in your city.',
          'To cancel, tap “Cancel ride”: the app tells you whether it’s free or what it costs.',
          'When the ride ends, rate it and leave a tip if you like: in the app if you paid by card, or handed to your driver if you paid in cash. It all goes to the driver.',
          'If you canceled a cash ride late, the fee is added to your next ride.',
        ],
      },
      {
        id: 'payment-method',
        titulo: 'Choosing how you pay for a ride',
        resumen:
          'After you see the price, the “Payment method” screen shows the amount to pay and you choose how you’ll pay before you request.',
        explicacion: [
          'When you tap “Continue” on Moto, Car or Deliveries, you get to “Payment method.” At the top you see the amount to pay in large type. At night, in cities with a night fare, that amount already includes it and the line below says “Includes the night fare” with its percentage: your Divoox Balance comes off that total.',
          'Below it are the payment methods available in your city. In the United States: cash or card. With cash, you pay the driver when the ride ends; with a card, we hold the price when you request and charge it when the ride ends.',
          'If a method can’t be used for a ride, it shows “Not available for this trip yet” and the app picks another one for you. Nothing you entered is lost.',
          'The “Request” button shows what you’ll pay. If something changed while you were choosing, the app tells you on the same screen and you can pick another method.',
        ],
        preguntas: [
          'Where do I choose how to pay for a ride?',
          'Can I pay for a ride with a card?',
          'What does “Not available for this trip yet” mean?',
        ],
        pasos: [
          'Choose your destination and check the price.',
          'Tap “Continue.”',
          'Choose cash or card.',
          'Tap “Request.”',
        ],
      },
      {
        id: 'divoox-balance',
        titulo: 'Your Divoox Balance',
        resumen:
          'Divoox Balance is credit for paying rides in some countries. It isn’t used in the United States: here you pay with cash or card.',
        explicacion: [
          'In some countries, our team can add Divoox Balance to your account (a gift ride, a gift top-up or a prepayment), and you use it on the “Payment method” screen.',
          'Divoox Balance isn’t used in the United States, so you won’t see it on your “Payment method” screen. Here you pay each ride with cash or card.',
          'Promo codes still work the same way: add them in your account and they’re applied to your next eligible ride.',
        ],
        preguntas: [
          'Can I use Divoox Balance in the United States?',
          'How do I pay for a ride in the United States?',
        ],
        pasos: [
          'Request your ride and tap “Continue.”',
          'On “Payment method,” choose cash or card.',
          'Tap “Request.”',
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
          'Is it safe to ride a motorbike with Divoox?',
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
          'When you arrive, slide the bar “Slide when you arrive”. The rider has a few minutes of included wait time; if they don’t show up, you can close the ride as a no-show and you get the fee.',
          'To start, confirm the rider is wearing a helmet and, if the city uses it, enter the code they tell you. When you reach the destination, tap “End”.',
        ],
        preguntas: [
          'How do I accept a motorcycle ride?',
          'What do I do if the rider doesn’t show up?',
          'Who gets the fee if the rider cancels?',
        ],
        pasos: [
          'Go online and wait for an offer. Check the earnings and route, and tap “Accept”.',
          'Go to the pickup point and slide the bar “Slide when you arrive” when you’re there.',
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
          'Divoox Moto opens city by city: you can sign up in the cities where Divoox Moto is open. Before you give rides, we get to know you: we verify your identity, your license, your background, and your motorcycle’s documents. That keeps riders and you safe.',
          'What we ask for depends on your country. In the United States, your background check and driving record are run by our screening partner, so you don’t upload them yourself: you enter your details on the partner’s secure page and see the result in the app.',
          'Where Divoox gives you a deadline, you start working with a photo of your face and turn in the rest of your documents later, usually within a month: see the guide “Your deadline to submit your documents.” Those photos are always taken on the spot with the app’s camera.',
          'Each document shows its status: not uploaded, under review, approved, or “needs a fix” with the reason. Once everything is approved, you turn on “Get Moto rides.”',
        ],
        preguntas: [
          'What documents do I need to drive with Divoox Moto?',
          'How do I upload a photo of a document?',
          'How long does approval take?',
        ],
        pasos: [
          'In the Divoox Driver app, go to Account → “My details and vehicle” and tap “Divoox Moto.”',
          'Check your city and change it if needed (once chosen, you can change it once every 24 hours within your country).',
          'Enter your motorcycle’s make, model, year, color, and license plate, and tap “Save my motorcycle.”',
          'Upload each motorcycle document: tap “Upload” and choose “Take photo” or “Upload from files.”',
          'Verify your identity and complete your background check under “Documents.”',
          'Tap “Send my motorcycle for review.” We’ll let you know when it’s approved.',
          'Once everything is approved, tap “Use this motorcycle to work” and “Get Moto rides.”',
        ],
        nota: 'If a document says “needs a fix,” read the reason and upload it again: you don’t have to start over.',
      },
      {
        id: 'drive-moto-saldo',
        titulo: 'How you’re paid for Moto rides',
        resumen:
          'On a cash ride the rider pays you the full fare at the end, and the app shows the amount at every step. A prepaid fee balance is only used in some countries, not in the United States.',
        explicacion: [
          'Every offer tells you how the rider pays before you accept. On a cash ride you collect the full upfront price from the rider when you arrive: the app shows “Collect in cash” with the exact amount during the ride and again when it ends.',
          'On a card ride there is nothing to collect: the rider pays in the app and the fare is added to your earnings.',
          'In some countries drivers work with a prepaid fee balance that they top up with a code at a sales point. That balance isn’t used in the United States, so there is nothing to top up before you drive here.',
        ],
        preguntas: [
          'How do I get paid for a cash ride?',
          'Do I need to top up a balance to drive in the United States?',
          'Where do I see how the rider pays?',
        ],
        pasos: [
          'Before you accept, check the top of the offer: it says whether you collect cash at the end.',
          'During the ride, the amount to collect stays on screen under the destination.',
          'When you slide “Slide to end the ride,” collect the amount shown under “Collect in cash.”',
          'Rate your rider and tap “Done” to get your next offer.',
        ],
        nota: 'Collect only the amount the app shows. A tip is the rider’s choice, and it’s all yours.',
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

/**
 * C-DOCS-MOTO (13 nov 2026, Venezuela): las guías de Moto que ya tienen capturas REALES (tomadas con
 * scripts/recorrido/capturas-moto-venezuela.mjs en las apps web y el servidor de esta computadora)
 * se publican en Docs. Dicen con honestidad que Moto se abre ciudad por ciudad. Desde el 13 nov 2026
 * las capturas se toman en El Vigía, estado Mérida (no en Caracas), con una tarifa que no es de
 * prueba, y también se publicaron las dos de seguridad.
 */
const PUBLICADAS = new Set([
  'ride-moto',
  'ride-moto-pago',
  // C-METODO-PAGO-PANTALLA y C-SALDO-CLIENTE (25 nov 2026): con sus capturas reales.
  'payment-method',
  'divoox-balance',
  'drive-moto',
  'drive-moto-alta',
  'drive-moto-saldo',
  // 13 nov 2026: las de seguridad, con sus capturas reales tomadas en El Vigía.
  'ride-seguridad',
  'drive-moto-seguridad',
]);

// C-CAPTURAS-POR-IDIOMA (15 nov 2026): el español se enseña con El Vigía (`moto-ve`); el inglés, con
// Novi, Michigan (`moto-us`). Las toma `scripts/recorrido/capturas-moto-venezuela.mjs` en dos pasadas.
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-moto-${idioma === 'en' ? 'us' : 've'}-${nombre}-v2-${idioma}.webp`,
  alt,
  pie,
});

const CAPTURAS: Record<Idioma, Record<string, Captura[]>> = {
  es: {
    'payment-method': [
      foto(
        'pago-metodos',
        'es',
        'La pantalla «Método de pago» con el monto a pagar en dólares y en bolívares, y las opciones Efectivo y Pago Móvil.',
        'Eliges cómo pagas antes de solicitar.',
      ),
      foto(
        'pago-sin-saldo',
        'es',
        'Pago Móvil apagado con «Aún no disponible para este viaje» y Efectivo elegido.',
        'Si nadie cerca recibe Pago Móvil, la opción sale apagada.',
      ),
      foto(
        'pago-saldo-parcial',
        'es',
        'El Saldo Divoox usado en parte y Pago Móvil elegido para el resto.',
        'Puedes pagar parte con saldo y el resto en mano.',
      ),
    ],
    'divoox-balance': [
      foto(
        'pago-saldo-todo',
        'es',
        'La tarjeta Saldo Divoox encendida: el saldo cubre todo el viaje y no pagas nada en mano.',
        'Si tu saldo alcanza, pagas todo con saldo.',
      ),
      foto(
        'pago-saldo-parcial',
        'es',
        'La tarjeta Saldo Divoox con lo que usas y lo que te queda por pagar en dólares y en bolívares.',
        'Si no alcanza, ves cuánto usas y cuánto te falta.',
      ),
      foto(
        'pago-sin-saldo',
        'es',
        'La tarjeta Saldo Divoox apagada con «Sin saldo por ahora».',
        'Sin saldo, la tarjeta sale apagada.',
      ),
    ],
    'ride-moto': [
      foto(
        'cliente-pedir',
        'es',
        'La pantalla Moto con el punto de recogida, el destino, el tipo de viaje y el precio fijo en dólares con su equivalente en bolívares.',
        'Antes de pedir ves el precio fijo y cómo puedes pagar.',
      ),
      foto(
        'cliente-viaje',
        'es',
        'El viaje en curso con el mapa, la moto y la placa del conductor, y el precio fijo.',
        'En el viaje ves al conductor, su moto y su placa.',
      ),
      foto(
        'driver-oferta',
        'es',
        'La oferta que recibe el conductor con su ganancia, la distancia, la recogida y el destino.',
        'Tu conductor recibe el viaje con la ruta completa.',
      ),
    ],
    'ride-moto-pago': [
      foto(
        'cliente-pedir',
        'es',
        'Las formas de pago de la ciudad: efectivo y pago móvil, con el precio y su equivalente en bolívares.',
        'Eliges efectivo o pago móvil antes de pedir.',
      ),
      foto(
        'cliente-viaje',
        'es',
        'La tarjeta «Paga por pago móvil a» con el banco, el titular, el teléfono y la cédula del conductor.',
        'Con pago móvil ves a quién pagar en cuanto te asignan conductor.',
      ),
      foto(
        'driver-viaje-pago-movil',
        'es',
        'El conductor con la pregunta «¿Te llegó el pago móvil del pasajero?» y los botones para responder.',
        'El conductor confirma en su app que le llegó el pago.',
      ),
    ],
    'drive-moto': [
      foto(
        'driver-oferta',
        'es',
        'Una oferta de viaje en moto con la ganancia, la distancia a la recogida, el viaje y los minutos.',
        'Antes de aceptar ves cuánto ganas y la ruta.',
      ),
      foto(
        'driver-viaje-pago-movil',
        'es',
        'El viaje en curso con el destino y la pregunta del pago móvil.',
        'Durante el viaje confirmas el pago y luego deslizas «Desliza para terminar el viaje».',
      ),
      foto(
        'driver-cobro-efectivo',
        'es',
        'Viaje terminado: cuánto cobras en efectivo en dólares y su equivalente en bolívares.',
        'Al terminar, la app te dice cuánto cobrar.',
      ),
    ],
    'drive-moto-alta': [
      foto(
        'driver-moto',
        'es',
        'La sección Divoox Moto con tu ciudad, tu moto aprobada y los papeles de la moto con su estado.',
        'Tu ciudad, tu moto y cada papel con su estado.',
      ),
      foto(
        'driver-moto-papeles',
        'es',
        'Tus papeles de conductor aprobados y el aviso «Ya recibes viajes de Moto».',
        'Con todo aprobado, ya recibes viajes de Moto.',
      ),
      foto(
        'driver-identidad',
        'es',
        'La sección Documentos con la verificación de identidad aprobada.',
        'Tu identidad se verifica en «Documentos».',
      ),
    ],
    'drive-moto-saldo': [
      foto(
        'driver-saldo',
        'es',
        'El saldo para comisiones en dólares con la línea «Te alcanza para unas N carreras» y la casilla para el código de recarga.',
        'Tu saldo y para cuántas carreras te alcanza.',
      ),
      foto(
        'driver-cobro-efectivo',
        'es',
        'Viaje en efectivo terminado: el pasajero te paga el total a ti.',
        'En efectivo, el pasajero te paga el viaje completo.',
      ),
      foto(
        'driver-cobro-pago-movil',
        'es',
        'Viaje por pago móvil terminado con el monto en dólares y su equivalente en bolívares.',
        'Por pago móvil también recibes tú el total; la comisión sale de tu saldo.',
      ),
    ],
    'ride-seguridad': [
      foto(
        'cliente-contactos',
        'es',
        'Los contactos de confianza en la pantalla de Moto, con un contacto guardado y la opción «Solo de noche» elegida.',
        'Antes de pedir, eliges a quién y cuándo se comparte tu viaje.',
      ),
      foto(
        'cliente-compartir',
        'es',
        'El viaje en curso con los botones «Compartir mi viaje» y «Emergencia».',
        'Durante el viaje, compartes el enlace o pides ayuda con un toque.',
      ),
      foto(
        'cliente-todo-bien',
        'es',
        'La pregunta «¿Todo bien?» con los botones «Estoy bien» y «Necesito ayuda», sobre el mapa del viaje.',
        'Si el viaje se sale de la ruta, la app te pregunta si todo está bien.',
      ),
    ],
    'drive-moto-seguridad': [
      foto(
        'driver-descanso',
        'es',
        'El aviso «Llevas 13 horas manejando. Por tu seguridad, descansa: vuelves a recibir viajes en 6 horas.» en el inicio del conductor.',
        'Con 12 horas al volante, la app te pide descansar y te dice cuándo vuelves.',
      ),
      foto(
        'driver-emergencia',
        'es',
        'El viaje en curso del conductor con el botón rojo «Emergencia» debajo de «Desliza para terminar el viaje».',
        'En cada viaje tienes el botón «Emergencia».',
      ),
      foto(
        'cliente-todo-bien',
        'es',
        'La pregunta «¿Todo bien?» que recibe el pasajero si el viaje se sale de la ruta.',
        'Si el viaje se sale de la ruta, también le preguntamos al pasajero.',
      ),
    ],
  },
  en: {
    'payment-method': [
      foto(
        'pago-metodos',
        'en',
        'The “Payment method” screen with the amount to pay and the Cash and Card options.',
        'You choose how to pay before you request.',
      ),
      foto(
        'pago-tarjeta',
        'en',
        'Card selected on “Payment method,” with the note that it’s charged when the ride ends.',
        'With a card, we charge when the ride ends.',
      ),
      foto(
        'pago-efectivo',
        'en',
        'Cash on “Payment method,” with the note that you pay the driver when the ride ends.',
        'With cash, you pay the driver at the end.',
      ),
    ],
    'divoox-balance': [
      foto(
        'pago-metodos',
        'en',
        'The “Payment method” screen in the United States, with Cash and Card only.',
        'In the United States you pay with cash or card.',
      ),
      foto(
        'pago-tarjeta',
        'en',
        'Card selected on “Payment method,” with the amount to pay.',
        'Card is charged when the ride ends.',
      ),
      foto(
        'pago-efectivo',
        'en',
        'Cash selected on “Payment method,” with the amount to pay.',
        'Cash goes to the driver at the end.',
      ),
    ],
    'ride-moto': [
      foto(
        'cliente-pedir',
        'en',
        'The Moto screen with the pickup point, the destination, the ride type, the upfront price in US dollars, the distance and time, and the Cash and Card options.',
        'Before you request, you see the upfront price and how you can pay.',
      ),
      foto(
        'cliente-viaje',
        'en',
        'The ride in progress with the map, the driver’s name, motorcycle and plate, the pickup at Central Plaza and the upfront price.',
        'During the ride you see your driver, their motorcycle and plate.',
      ),
      foto(
        'driver-oferta',
        'en',
        'The offer the driver gets, with earnings, distance, pickup and destination.',
        'Your driver gets the ride with the full route.',
      ),
    ],
    'ride-moto-pago': [
      foto(
        'cliente-pedir',
        'en',
        'The payment methods under the upfront price: Cash, selected, and Card, with the note “Pay your driver in cash when you arrive.”',
        'You choose cash or card before you request.',
      ),
      foto(
        'cliente-viaje',
        'en',
        'The ride in progress with the pickup, the destination and the upfront price that doesn’t change.',
        'The upfront price stays in view for the whole ride.',
      ),
      foto(
        'cliente-propina',
        'en',
        'The end of a cash ride: “Pay in cash” with the amount, the star rating, and the note about handing a tip to your driver.',
        'When you arrive, you pay, rate the ride and can leave a tip.',
      ),
    ],
    'drive-moto': [
      foto(
        'driver-oferta',
        'en',
        'A motorcycle ride offer with earnings, distance to pickup, ride length and minutes.',
        'Before you accept, you see what you earn and the route.',
      ),
      foto(
        'driver-viaje',
        'en',
        'The ride in progress with the rider’s name, the destination, the amount to collect in cash, and the “Slide to end the ride” slider.',
        'During the ride you see where you’re going and what to collect, then slide “Slide to end the ride.”',
      ),
      foto(
        'driver-cobro-efectivo',
        'en',
        'Ride completed: how much to collect in cash, in US dollars.',
        'When it ends, the app tells you how much to collect.',
      ),
    ],
    'drive-moto-alta': [
      foto(
        'driver-moto',
        'en',
        'The Divoox Moto section with your city, your approved motorcycle and its documents with their status.',
        'Your city, your motorcycle and each document with its status.',
      ),
      foto(
        'driver-moto-papeles',
        'en',
        'Every motorcycle document approved and the notice “You’re getting Moto rides.”',
        'With everything approved, you get Moto rides.',
      ),
      foto(
        'driver-identidad',
        'en',
        'The Documents section with your identity verified and your background check approved.',
        'Your identity and background check are under “Documents.”',
      ),
    ],
    'drive-moto-saldo': [
      foto(
        'driver-oferta',
        'en',
        'A Moto ride offer that says “You collect cash at the end,” with what you earn and the route.',
        'The offer tells you how the rider pays.',
      ),
      foto(
        'driver-viaje',
        'en',
        'The ride in progress with “Collect in cash” and the amount under the destination.',
        'The amount to collect stays on screen during the ride.',
      ),
      foto(
        'driver-cobro-efectivo',
        'en',
        'Cash ride completed: the rider pays the full amount to you.',
        'With cash, the rider pays you the whole ride.',
      ),
    ],
    'ride-seguridad': [
      foto(
        'cliente-contactos',
        'en',
        'Trusted contacts on the Moto screen, with one saved contact and “Only at night” selected.',
        'Before you request, you choose who gets your ride and when.',
      ),
      foto(
        'cliente-compartir',
        'en',
        'The ride in progress with the “Share my ride” and “Emergency” buttons.',
        'During the ride, share the link or get help with one tap.',
      ),
      foto(
        'cliente-todo-bien',
        'en',
        'The “Everything OK?” question with the “I’m OK” and “I need help” buttons, above the ride map.',
        'If the ride goes off route, the app asks whether everything is OK.',
      ),
    ],
    'drive-moto-seguridad': [
      foto(
        'driver-descanso',
        'en',
        'The notice “You’ve been driving for 12 hours. For your safety, take a break: you’ll get rides again in 6 hours.” on the driver’s home screen.',
        'After 12 hours of driving, the app asks you to rest and tells you when you’re back.',
      ),
      foto(
        'driver-emergencia',
        'en',
        'The driver’s ride in progress with the red “Emergency” button below “Slide to end the ride.”',
        'Every ride has the “Emergency” button.',
      ),
      foto(
        'cliente-todo-bien',
        'en',
        'The “Everything OK?” question the rider gets if the ride goes off route.',
        'If the ride goes off route, we also check in with the rider.',
      ),
    ],
  },
};

function separar(publicar: boolean): Record<Idioma, { pasajero: Guia[]; conductor: Guia[] }> {
  const de = (idioma: Idioma, lista: Guia[]) => {
    const fotos = new Map(Object.entries(idioma === 'es' ? CAPTURAS.es : CAPTURAS.en));
    return lista
      .filter((g) => PUBLICADAS.has(g.id) === publicar)
      .map((g) => (publicar ? { ...g, capturas: fotos.get(g.id) ?? [] } : g));
  };
  return {
    es: {
      pasajero: de('es', TODAS_MOTO.es.pasajero),
      conductor: de('es', TODAS_MOTO.es.conductor),
    },
    en: {
      pasajero: de('en', TODAS_MOTO.en.pasajero),
      conductor: de('en', TODAS_MOTO.en.conductor),
    },
  };
}

/** Publicadas en Docs: «ordering» (pasajero) y «drivers» (conductor). */
export const GUIAS_MOTO = separar(true);
/** Todavía guardadas sin publicar (les faltan capturas reales). */
export const BORRADORES_MOTO = separar(false);
