import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-PERFIL-PERU y C-PAGO-A-CELULAR (19 nov 2026) — Perú. Las guías públicas de lo propio de Perú:
 * pagar el viaje con Yape o Plin (pasajero), cobrar con Yape o Plin, recargar el saldo con tarjeta y
 * los papeles del conductor.
 *
 * C-CAPTURAS-POR-IDIOMA: en español las capturas REALES son de Perú, en soles (las toma
 * `scripts/recorrido/capturas-peru.mjs` contra el servidor LOCAL, con datos de ejemplo y sin nombrar
 * la ciudad: `apps/panel/public/docs/recorrido-peru-<nombre>-es.webp`). En inglés la guía dice dónde
 * existe cada cosa y enseña las pantallas de Estados Unidos, que son las que ve quien lee en inglés.
 *
 * C-SOLO-LO-TERMINADO (decisión de Gerencia, 19 nov 2026): Docs no promete lo que el público todavía
 * no puede usar. Las guías están escritas y con sus capturas, pero quedan OCULTAS mientras Perú esté
 * apagado en producción: `PERU_PUBLICADA` pasa a true el MISMO día en que Richard encienda Ica (y se
 * regenera el conocimiento del asistente con `node scripts/camila/generar-docs.mjs`). `peru.test.ts`
 * no deja publicarlas sin sus capturas.
 */
export const PERU_PUBLICADA = false;

export const CAPTURAS_PERU = [
  'cliente-pedir',
  'cliente-viaje',
  'driver-cuenta-cobro',
  'driver-cuenta-cobro-formulario',
  'driver-viaje',
  'driver-cobro',
  'driver-saldo',
  'driver-recarga-tarjeta',
  'driver-vehiculo',
  'driver-papeles',
] as const;
type NombreCaptura = (typeof CAPTURAS_PERU)[number];

const foto = (nombre: NombreCaptura, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-peru-${nombre}-es.webp`,
  alt,
  pie,
});
/** Las pantallas de Estados Unidos que ya están en Docs (capturas de Moto, pasada en inglés). */
const fotoUs = (archivo: string, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-${archivo}-en.webp`,
  alt,
  pie,
});

type Guias = { pagar: Guia; cobrar: Guia; recargar: Guia; papeles: Guia };

const ES: Guias = {
  pagar: {
    id: 'pay-with-yape-or-plin',
    titulo: 'Pagar tu viaje con Yape o Plin',
    resumen:
      'En Perú pagas tu viaje en mano: en efectivo, con Yape o con Plin. El precio es fijo y lo ves en soles antes de pedir.',
    explicacion: [
      'En Perú el precio de tu viaje sale en soles y es fijo: lo ves antes de pedir y no cambia en el camino.',
      'Debajo del precio eliges cómo pagas: «Efectivo», «Yape» o «Plin». Le pagas a tu conductor, no a Divoox.',
      'Si eliges Yape o Plin, cuando tu conductor llega ves en tu viaje su número de celular y el nombre del titular. Abre tu billetera, envía el monto exacto a ese número y avísale.',
      'Yape y Plin se envían entre sí con el número de celular. Si tú usas Plin y tu conductor tiene Yape, igual le llega: la app te dice de qué billetera es su número.',
      'Tu conductor confirma en su app que le llegó. Cuando confirma, lo ves en tu viaje.',
      'Antes de enviar, compara el nombre que te muestra tu billetera con el titular que ves en Divoox. Si no coincide, no envíes y paga en efectivo.',
    ],
    capturas: [
      foto(
        'cliente-pedir',
        'La pantalla para pedir un viaje con el mapa, el precio fijo en soles y las formas de pago Efectivo, Yape y Plin, con Yape elegido.',
        'El precio en soles y cómo pagas: efectivo, Yape o Plin.',
      ),
      foto(
        'cliente-viaje',
        'El viaje en curso del pasajero con la tarjeta del pago: el monto en soles, la billetera del conductor, el nombre del titular y su número de celular.',
        'En tu viaje ves a qué número enviar el pago.',
      ),
    ],
    preguntas: [
      '¿Puedo pagar mi viaje con Yape?',
      '¿Puedo pagar con Plin si el conductor tiene Yape?',
      '¿A qué número le envío el pago?',
      '¿El precio del viaje cambia en el camino?',
    ],
    pasos: [
      'Escribe tu destino y mira el precio fijo en soles.',
      'Elige «Yape» o «Plin» y pide tu viaje.',
      'Cuando llegue tu conductor, dile el código de tu viaje.',
      'Mira en tu viaje su número y el titular, y envía el monto exacto desde tu billetera.',
      'Espera a que tu conductor confirme que le llegó.',
    ],
    nota: 'Divoox no cobra ni guarda ese dinero: el pago va directo de tu billetera a la de tu conductor.',
  },
  cobrar: {
    id: 'get-paid-with-yape-or-plin',
    titulo: 'Cobrar con Yape o Plin: carga tu número y confirma cada pago',
    resumen:
      'En Perú el pasajero te paga todo en mano: efectivo, Yape o Plin. Carga tu número una vez en Ganancias y confirma en cada viaje si te llegó el pago.',
    explicacion: [
      'En Divoox Driver ve a Ganancias y busca «Dónde te pagan los pasajeros». Toca «Cargar mi número», elige tu billetera (Yape o Plin), escribe el nombre del titular y tu número de celular de nueve cifras.',
      'Para guardar te pedimos tu contraseña de Divoox: así nadie más puede cambiar dónde te pagan. Te avisamos por correo de cada cambio.',
      'Tu número entra en uso 24 horas después de guardarlo, o antes si nuestro equipo lo confirma. Es para proteger tu dinero.',
      'Yape y Plin se envían entre sí. Con uno de los dos cargado recibes los viajes que se pagan con cualquiera de los dos. Sin número cargado solo recibes viajes en efectivo.',
      'En el viaje, cuando tu pasajero ya subió, la app te muestra el monto y te pregunta si te llegó. Revisa tu billetera y toca «Sí, me llegó» o «No me llegó».',
      'Si tocas «No me llegó», nuestro equipo de soporte recibe el caso con los datos del viaje y te escribe. Puedes cobrarle al pasajero en efectivo y terminar el viaje.',
      'La comisión de Divoox no sale de lo que te paga el pasajero: sale de tu saldo para comisiones.',
    ],
    capturas: [
      foto(
        'driver-cuenta-cobro',
        'Ganancias en Divoox Driver con la tarjeta Dónde te pagan los pasajeros: la billetera, el número con sus últimas cifras, el titular y el aviso En uso.',
        'Tu número cargado y en uso: los pasajeros ya lo ven.',
      ),
      foto(
        'driver-cuenta-cobro-formulario',
        'El formulario para cargar tu número: los botones Yape y Plin, el nombre del titular, el número de celular y tu contraseña de Divoox.',
        'Eliges tu billetera y escribes titular, celular y contraseña.',
      ),
      foto(
        'driver-viaje',
        'El viaje en curso del conductor con el monto en soles que paga el pasajero y los botones Sí, me llegó y No me llegó.',
        'Revisa tu billetera y confirma si te llegó.',
      ),
      foto(
        'driver-cobro',
        'La pantalla del cobro al terminar el viaje, con el monto en soles en cifra grande y en verde.',
        'Al terminar ves lo que cobraste en ese viaje.',
      ),
    ],
    preguntas: [
      '¿Cómo cargo mi Yape o mi Plin para que me paguen?',
      '¿Por qué no me llegan viajes que se pagan con Yape?',
      '¿Qué hago si el pago del pasajero no me llegó?',
      '¿Necesito tener Yape y Plin a la vez?',
    ],
    pasos: [
      'Abre Ganancias y toca «Cargar mi número» en «Dónde te pagan los pasajeros».',
      'Elige Yape o Plin, escribe el titular, tu celular y tu contraseña, y toca «Guardar».',
      'Acepta el viaje y, cuando tu pasajero suba, escribe su código para empezar.',
      'Revisa tu billetera y toca «Sí, me llegó» o «No me llegó».',
      'Al llegar al destino, desliza para terminar el viaje.',
    ],
    nota: 'Nunca le pidas al pasajero que te pague a otro número distinto del que muestra la app: es el único que protege a los dos.',
  },
  recargar: {
    id: 'top-up-balance-with-card',
    titulo: 'Recargar tu saldo con tarjeta',
    resumen:
      'En Perú puedes recargar tu saldo para comisiones con tarjeta de débito o crédito, en soles y sin salir de Divoox Driver. El saldo aparece en cuanto se confirma el pago.',
    explicacion: [
      'Tu saldo para comisiones es lo que recargas por adelantado para pagar la comisión de Divoox en cada viaje. Sin saldo no te llegan viajes.',
      'En Ganancias, dentro de «Saldo para comisiones», verás «Recargar con tarjeta». Elige uno de los montos o escribe otro en «Otro monto».',
      'La recarga con tarjeta tiene un monto mínimo: la app te lo dice antes de pagar.',
      'Al tocar «Pagar» se abre la página segura de nuestro procesador de pagos dentro de la app. Ahí escribes los datos de tu tarjeta. Divoox no ve ni guarda el número de tu tarjeta.',
      'Cuando el pago se confirma vuelves a la app y tu saldo se actualiza en unos segundos. Si cierras la página sin pagar, no se cobra nada.',
      'También puedes recargar en efectivo, con Yape o con Plin en el punto de venta de Divoox de tu ciudad: te dan un código y lo canjeas en la misma pantalla.',
    ],
    capturas: [
      foto(
        'driver-saldo',
        'Ganancias en Divoox Driver con el saldo para comisiones en soles, para cuántas carreras alcanza, la casilla del código de recarga y Recargar con tarjeta.',
        'Tu saldo en soles y para cuántos viajes te alcanza.',
      ),
      foto(
        'driver-recarga-tarjeta',
        'La parte Recargar con tarjeta: los montos en soles para elegir, la casilla Otro monto y el botón Pagar con el monto elegido.',
        'Eliges el monto y pagas en la página segura.',
      ),
    ],
    preguntas: [
      '¿Cómo recargo mi saldo con tarjeta?',
      '¿Cuánto es lo mínimo que puedo recargar con tarjeta?',
      '¿Cuánto tarda en aparecer mi saldo?',
      '¿Puedo recargar con Yape o en efectivo?',
    ],
    pasos: [
      'Abre Ganancias y baja a «Recargar con tarjeta».',
      'Elige un monto o escribe otro.',
      'Toca «Pagar» y escribe los datos de tu tarjeta en la página segura.',
      'Vuelve a la app: tu saldo se actualiza en unos segundos.',
    ],
    nota: 'Si tu banco rechaza el pago, no se descuenta nada de tu tarjeta y tu saldo queda igual. Prueba con otra tarjeta o recarga en el punto de venta.',
  },
  papeles: {
    id: 'driver-documents-peru',
    titulo: 'Tus papeles para manejar con Divoox en Perú',
    resumen:
      'Para llevar pasajeros en Perú subes desde Divoox Driver los papeles de tu mototaxi, tu moto o tu carro y los tuyos. Nuestro equipo los revisa y te avisa.',
    explicacion: [
      'Primero registras tu vehículo: tipo, marca, modelo, año, color y placa.',
      'Del vehículo subes una foto de la tarjeta de identificación vehicular, tu SOAT vigente (o tu CAT, si manejas mototaxi o moto) y una foto del vehículo de frente. El SOAT o el CAT ya cubre a tus pasajeros: subes el mismo en las dos casillas.',
      'Tuyos subes tu licencia de conducir: clase B para mototaxi (B-IIc) o moto (B-IIb), y clase A (A-I o A-IIa) para carro. También tu certificado de antecedentes penales o tu Certificado Único Laboral.',
      'Además verificas tu identidad con tu documento y una foto tuya.',
      'Las fotos de tu documento, tu licencia, tu SOAT y tu cara se toman en vivo con la cámara de Divoox Driver, en el momento: no se suben desde tus archivos.',
      'Nuestro equipo revisa cada papel. Si alguno no se lee bien o está vencido, te decimos cuál para que lo subas otra vez. Cuando todo está aprobado, puedes conectarte y recibir viajes.',
      'Cuando un papel está por vencer, la app te avisa para que subas el nuevo a tiempo.',
    ],
    capturas: [
      foto(
        'driver-vehiculo',
        'El registro del vehículo en Divoox Driver con la ciudad, los datos del vehículo y el estado de cada requisito.',
        'Tu vehículo y el estado de cada requisito.',
      ),
      foto(
        'driver-papeles',
        'La parte Tus papeles con la licencia de conducir clase B y el certificado de antecedentes penales o Certificado Único Laboral, cada uno con su estado.',
        'Tus papeles con los nombres que usas en Perú.',
      ),
    ],
    preguntas: [
      '¿Qué papeles necesito para manejar mototaxi con Divoox en Perú?',
      '¿Qué licencia necesito para carro?',
      '¿Sirve el Certificado Único Laboral en vez de los antecedentes?',
      '¿Cuánto tardan en aprobar mis papeles?',
    ],
    pasos: [
      'En Divoox Driver elige tu ciudad y registra tu vehículo.',
      'Sube la tarjeta de identificación vehicular, tu SOAT o CAT y la foto del vehículo.',
      'Sube tu licencia y tu certificado de antecedentes o tu Certificado Único Laboral.',
      'Verifica tu identidad con tu documento y una foto tuya.',
      'Espera nuestro aviso: cuando todo esté aprobado, conéctate.',
    ],
    nota: 'Sube fotos claras, completas y sin reflejos: es lo que más acelera la revisión.',
  },
};

const EN: Guias = {
  pagar: {
    id: 'pay-with-yape-or-plin',
    titulo: 'Paying your driver directly: cash, card, or a phone wallet',
    resumen:
      'You always see a fixed price before you request. In the United States you pay with cash or a card. In Peru you pay your driver in soles with cash, Yape, or Plin.',
    explicacion: [
      'Your price is fixed: you see it before you request and it doesn’t change during the ride.',
      'Below the price you choose how to pay. The app only shows the payment methods available in your country.',
      'In the United States you choose cash or card. With cash, you pay your driver when you arrive.',
      'In Peru the price is in soles and you choose cash, Yape, or Plin. With Yape or Plin, your ride shows your driver’s mobile number and the account holder’s name once they arrive. You send the exact amount from your wallet.',
      'Yape and Plin can send money to each other using the mobile number, so you can pay from Plin even if your driver uses Yape. Your driver confirms in their app that the payment arrived.',
      'Before you send money, compare the name your wallet shows with the account holder you see in Divoox. If they don’t match, don’t send it and pay with cash.',
    ],
    capturas: [
      fotoUs(
        'moto-us-cliente-pedir-v2',
        'The request screen with the pickup, the destination, the fixed price in dollars, and the payment methods available in the United States.',
        'Your fixed price and how you pay.',
      ),
      fotoUs(
        'moto-us-cliente-viaje-v2',
        'The rider’s trip in progress with the map, the driver, the vehicle, and the code to start the ride.',
        'Your ride in progress, with your driver and your code.',
      ),
    ],
    preguntas: [
      'Can I pay my ride with Yape?',
      'Can I pay with Plin if my driver uses Yape?',
      'Which number do I send the payment to?',
      'Does the price change during the ride?',
    ],
    pasos: [
      'Enter your destination and check the fixed price.',
      'Choose your payment method and request your ride.',
      'When your driver arrives, tell them your ride code.',
      'If you chose a phone wallet, check the number and the account holder in your ride and send the exact amount.',
      'Wait for your driver to confirm the payment arrived.',
    ],
    nota: 'When you pay in hand, Divoox doesn’t collect or hold that money: it goes straight from you to your driver.',
  },
  cobrar: {
    id: 'get-paid-with-yape-or-plin',
    titulo: 'Getting paid in hand: add your wallet number and confirm each payment',
    resumen:
      'In Peru riders pay you directly with cash, Yape, or Plin. Add your number once under Earnings and confirm on each ride whether the payment arrived. In the United States riders pay with cash or card.',
    explicacion: [
      'In Peru, open Earnings in Divoox Driver and find “Where riders pay you”. Tap “Add my number”, choose your wallet (Yape or Plin), and enter the account holder name and your nine-digit mobile number.',
      'To save, we ask for your Divoox password so nobody else can change where you get paid. We email you about every change.',
      'Your number goes live 24 hours after you save it, or sooner if our team confirms it. This protects your money.',
      'Yape and Plin send to each other. With either one on file you get rides paid with both. With no number on file you only get cash rides.',
      'On the ride, once your rider is on board, the app shows the amount and asks if it arrived. Check your wallet and tap “Yes, it arrived” or “It didn’t arrive”.',
      'If you tap “It didn’t arrive”, our support team gets the case with the ride details and contacts you. You can collect cash from the rider and end the ride.',
      'In the United States there is no wallet number to add: on a cash ride the app shows the amount to collect, and on a card ride the fare goes to your earnings.',
    ],
    capturas: [
      fotoUs(
        'moto-us-driver-oferta-v2',
        'A ride offer in Divoox Driver in the United States with the fare, the distance, and the Accept ride button.',
        'The offer shows what you earn before you accept.',
      ),
      fotoUs(
        'moto-us-driver-viaje-v2',
        'The driver’s ride in progress in the United States with the fare, the rider, the destination, and the slider to end the ride.',
        'During the ride you see the fare and how the rider pays.',
      ),
      fotoUs(
        'moto-us-driver-cobro-efectivo-v2',
        'The collection screen after ending a cash ride in the United States, with the amount to collect in large green figures.',
        'After a cash ride you see the amount to collect.',
      ),
    ],
    preguntas: [
      'How do I add my Yape or Plin number so riders can pay me?',
      'Why am I not getting rides paid with Yape?',
      'What do I do if the rider’s payment didn’t arrive?',
      'Do I need both Yape and Plin?',
    ],
    pasos: [
      'In Peru, open Earnings and tap “Add my number” under “Where riders pay you”.',
      'Choose Yape or Plin, enter the account holder, your mobile number, and your password, and tap “Save”.',
      'Accept the ride and, when your rider gets in, enter their code to start.',
      'Check your wallet and tap “Yes, it arrived” or “It didn’t arrive”.',
      'At the destination, slide to end the ride.',
    ],
    nota: 'Never ask a rider to pay a number other than the one shown in the app: it is the only one that protects you both.',
  },
  recargar: {
    id: 'top-up-balance-with-card',
    titulo: 'Topping up your balance with a card',
    resumen:
      'In Peru you can top up your commission balance with a debit or credit card, in soles, without leaving Divoox Driver. In the United States your fares are paid out to you and there is nothing to top up.',
    explicacion: [
      'In countries where riders pay you in hand, Divoox’s commission comes out of a balance you top up in advance. With no balance you don’t get rides.',
      'In Peru, under Earnings, inside “Commission balance”, you’ll see “Top up with a card”. Choose one of the amounts or enter another under “Other amount”.',
      'Card top-ups have a minimum amount: the app tells you before you pay.',
      'When you tap “Pay”, our payment processor’s secure page opens inside the app. You enter your card details there. Divoox never sees or stores your card number.',
      'Once the payment is confirmed you return to the app and your balance updates within seconds. If you close the page without paying, nothing is charged.',
      'In Peru you can also top up with cash, Yape, or Plin at the Divoox point of sale in your city: you get a code and redeem it on the same screen.',
    ],
    capturas: [
      fotoUs(
        'saldo-inicio-driver',
        'Divoox Driver home with the Your commission balance card: the balance, how many rides it covers, and the View my balance link.',
        'Where a commission balance applies, it is always visible on your home screen.',
      ),
      fotoUs(
        'moto-us-driver-cobro-efectivo-v2',
        'The collection screen after a cash ride in the United States, with the amount to collect in large green figures.',
        'In the United States you collect cash rides in hand and have nothing to top up.',
      ),
    ],
    preguntas: [
      'How do I top up my balance with a card?',
      'What is the minimum card top-up?',
      'How long does it take for my balance to show up?',
      'Can I top up with Yape or cash?',
    ],
    pasos: [
      'Open Earnings and scroll to “Top up with a card”.',
      'Choose an amount or enter another.',
      'Tap “Pay” and enter your card details on the secure page.',
      'Return to the app: your balance updates within seconds.',
    ],
    nota: 'If your bank declines the payment, nothing is charged to your card and your balance stays the same. Try another card or top up at the point of sale.',
  },
  papeles: {
    id: 'driver-documents-peru',
    titulo: 'Your documents to drive with Divoox in Peru',
    resumen:
      'To carry riders in Peru you upload your vehicle’s documents and your own from Divoox Driver. Our team reviews them and lets you know. In the United States the app asks for the documents of your state.',
    explicacion: [
      'First you register your vehicle: type, make, model, year, color, and plate.',
      'For the vehicle in Peru you upload a photo of the vehicle identification card (tarjeta de identificación vehicular), your valid SOAT (or CAT, for a mototaxi or motorcycle), and a front photo of the vehicle. Your SOAT or CAT already covers your riders: you upload the same one in both boxes.',
      'For yourself you upload your driver’s license: Class B for a mototaxi (B-IIc) or motorcycle (B-IIb), and Class A (A-I or A-IIa) for a car. You also upload your criminal record certificate or your Certificado Único Laboral.',
      'You also verify your identity with your ID and a photo of yourself.',
      'The photos of your ID, your license, your SOAT and your face are taken live with the Divoox Driver camera, on the spot: they can’t be uploaded from your files.',
      'Our team reviews each document. If one is hard to read or expired, we tell you which one so you can upload it again. Once everything is approved, you can go online and get rides.',
      'When a document is about to expire, the app reminds you to upload the new one in time.',
    ],
    capturas: [
      fotoUs(
        'moto-us-driver-moto-v2',
        'Vehicle registration in Divoox Driver in the United States with the city, the vehicle details, and the status of each requirement.',
        'Your vehicle and the status of each requirement.',
      ),
      fotoUs(
        'moto-us-driver-moto-papeles-v2',
        'The requirements status in Divoox Driver in the United States, with each document and check marked as approved.',
        'Each document shows its status once reviewed.',
      ),
    ],
    preguntas: [
      'Which documents do I need to drive a mototaxi with Divoox in Peru?',
      'Which license do I need for a car?',
      'Can I use the Certificado Único Laboral instead of a criminal record certificate?',
      'How long does it take to approve my documents?',
    ],
    pasos: [
      'In Divoox Driver, choose your city and register your vehicle.',
      'Upload the vehicle identification card, your SOAT or CAT, and the vehicle photo.',
      'Upload your license and your criminal record certificate or Certificado Único Laboral.',
      'Verify your identity with your ID and a photo of yourself.',
      'Wait for our notice: once everything is approved, go online.',
    ],
    nota: 'Upload clear, complete photos with no glare: that speeds up the review more than anything else.',
  },
};

export const GUIAS_PERU: Record<Idioma, Guias> = { es: ES, en: EN };
