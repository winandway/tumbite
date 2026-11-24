import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * C-VERIFICACION-UNICA y C-BARRA-ACTIVACION (23 nov 2026) — todos los países. La guía interna de la
 * Verificación única (todo lo de un conductor en un solo lugar) y de su barra de activación.
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `activacion-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const verificacionUnica: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'driver-activation-bar',
    titulo: 'Verificación única y barra de activación del conductor',
    resumen:
      'Todo lo que se aprueba de un conductor está en Verificaciones: su identidad, su vehículo con sus fotos, sus papeles y sus servicios. Arriba de su ficha, la barra de activación dice qué le falta para recibir carreras, a quién le toca cada paso, y al final si ya puede recibirlas.',
    explicacion: [
      'Verificaciones tiene un pendiente por conductor, no uno por papel. En «Pendientes» está quien tiene algo por decidir: su identidad, su moto o su carro en revisión, o un papel suyo como la licencia. Cada fila dice qué espera («Por decidir: Vehículo»). El número del menú cuenta esas personas y baja en cuanto decides lo último que esperaba.',
      'Al abrir a una persona ves, en este orden: sus fotos y la decisión de su identidad, la tarjeta de papeles, la barra de activación, «Aprobar todo lo que está en verde», su vehículo por revisar (cada foto con «Ver el archivo», Aprobar, y Rechazar en los tres puntos con su motivo), sus papeles por revisar y sus servicios y requisitos (habilitación, edad, casco). Es la misma pieza que sale en su ficha de conductor.',
      'La barra de activación lleva cada paso en orden: celular, cara, documento, identidad aprobada, vehículo con su placa, vehículo aprobado, vehículo en uso, servicio aprobado, servicio abierto en su zona, saldo, papeles enviados y, al final, abrir Driver y conectarse. Verde es hecho, gris es pendiente y rojo es solo lo que tiene un problema (por ejemplo, un vehículo rechazado). Cada paso pendiente dice de quién depende: del conductor, del equipo (con su botón «Hacerlo aquí») o del sistema solo.',
      'La frase del final no se adivina: sale de la misma regla con la que el reparto elige a quién ofrecerle un viaje. «Ya puede recibir carreras de Moto. Solo le falta abrir Driver y conectarse» quiere decir que, si se conecta ahora, el reparto lo toma. «Todavía no: falta vehículo aprobado (le toca al equipo)» dice exactamente lo que lo frena.',
      'El pago móvil es un paso opcional: sin él puede trabajar, pero solo le llegan carreras en efectivo. La barra lo avisa y la app del conductor también.',
      'Cuando tu decisión lo deja listo, al conductor le llega una sola vez el aviso «Ya puedes recibir carreras» (y, sin pago móvil, que por ahora solo recibe en efectivo). Si el vehículo aprobado es el único que tiene, queda en uso solo.',
      'Para registros masivos: filtra por zona, ordena por «Más cerca de activarse» y marca las casillas de las identidades «En verde» (todas sus comprobaciones automáticas en verde, la cara igual a la del documento y nada más por decidir). «Aprobar las identidades en verde» las aprueba juntas, con una confirmación. Un vehículo o un papel no tienen comprobación automática: se miran en la ficha de la persona. La IA nunca aprueba ni rechaza: decides tú.',
      'En la lista de conductores, la columna «Activación» dice «Listo para recibir carreras» o «Todavía no». En Moto · Abrir y aprobar quedan abrir ciudades, la compuerta del país y la tasa; la revisión de papeles, motos y carros se mudó aquí.',
    ],
    capturas: [
      cap(
        'barra',
        'es',
        'La barra de activación de un conductor con sus pasos en verde y en gris, quién hace cada uno y la frase final.',
        'La barra de activación y su frase final.',
      ),
      cap(
        'bandeja',
        'es',
        'La pestaña Pendientes de Verificaciones con «Por decidir: Vehículo», las casillas «En verde» y el orden «Más cerca de activarse».',
        'Un pendiente por conductor, con lo que espera.',
      ),
    ],
    pasos: [
      'Entra a Verificaciones, pestaña «Pendientes». Si es un registro masivo, elige la zona y el orden «Más cerca de activarse».',
      'Abre a la persona. Mira sus fotos y aprueba su identidad, o recházala con el motivo.',
      'Baja a «Vehículo por revisar»: abre cada foto con «Ver el archivo» y aprueba (o recházalo desde los tres puntos, con el motivo).',
      'Si todo lo que ves está bien, usa «Aprobar todo lo que está en verde» y confirma.',
      'Mira la barra: si dice «Ya puede recibir carreras», el conductor solo tiene que abrir Driver y deslizar para conectarse. Si dice «Todavía no», el paso en gris dice qué falta y a quién le toca.',
    ],
    nota: 'La barra no escribe nada al mirarla: se calcula cada vez que se abre, con la misma regla del reparto.',
  },
  en: {
    id: 'driver-activation-bar',
    titulo: 'One verification and the driver activation bar',
    resumen:
      'Everything you approve for a driver is in Verifications: their identity, their vehicle with its photos, their documents and their services. At the top of their file, the activation bar says what they still need to receive trips, whose turn each step is, and at the end whether they can receive them now.',
    explicacion: [
      'Verifications has one pending item per driver, not one per document. «Pending» shows anyone with something to decide: their identity, their motorbike or car under review, or a document such as their license. Each row says what is waiting («To decide: Vehicle»). The menu number counts those people and goes down as soon as you decide the last thing they were waiting for.',
      'When you open a person you see, in this order: their photos and the identity decision, the documents card, the activation bar, «Approve everything in green», their vehicle to review (each photo with «See the file», Approve, and Reject in the three dots with its reason), their documents to review and their services and requirements (service approval, age, helmet). It is the same piece shown in their driver file.',
      'The activation bar lists each step in order: phone, face, ID document, identity approved, vehicle with its plate, vehicle approved, vehicle in use, service approved, service open in their area, balance, documents submitted and, last, opening Driver and going online. Green is done, gray is pending and red is only what has a problem (for example, a rejected vehicle). Each pending step says whose turn it is: the driver’s, the team’s (with its «Do it here» button) or done automatically.',
      'The sentence at the end is not a guess: it comes from the same rule dispatch uses to choose who gets a trip offer. «Ready to receive Moto trips. They only need to open Driver and go online» means that if they go online now, dispatch picks them. «Not yet: missing vehicle approved (team’s turn)» says exactly what is holding them back.',
      'Mobile payment is an optional step: they can work without it, but they only get cash trips. The bar says so and so does the driver app.',
      'When your decision makes them ready, the driver gets the «You can now receive trips» notice once (and, without mobile payment, that for now they only get cash trips). If the approved vehicle is the only one they have, it goes into use by itself.',
      'For bulk sign-ups: filter by area, sort by «Closest to activation» and tick the identities marked «In green» (every automatic check in green, the face matching the document and nothing else to decide). «Approve identities in green» approves them together, with one confirmation. A vehicle or a document has no automatic check: you look at it in the person’s file. AI never approves or rejects: you decide.',
      'In the driver list, the «Activation» column says «Ready to receive trips» or «Not yet». Moto · Open and approve keeps opening cities, the country gate and the rate; reviewing documents, motorbikes and cars moved here.',
    ],
    capturas: [
      cap(
        'barra',
        'en',
        'A driver’s activation bar with its steps in green and gray, who does each one and the final sentence.',
        'The activation bar and its final sentence.',
      ),
      cap(
        'bandeja',
        'en',
        'The Pending tab in Verifications with «To decide: Vehicle», the «In green» boxes and the «Closest to activation» order.',
        'One pending item per driver, with what is waiting.',
      ),
    ],
    pasos: [
      'Go to Verifications, «Pending» tab. For a bulk sign-up, choose the area and the «Closest to activation» order.',
      'Open the person. Look at their photos and approve their identity, or reject it with the reason.',
      'Scroll to «Vehicle to review»: open each photo with «See the file» and approve (or reject from the three dots, with the reason).',
      'If everything you see is fine, use «Approve everything in green» and confirm.',
      'Check the bar: if it says «Ready to receive trips», the driver only has to open Driver and swipe to go online. If it says «Not yet», the gray step says what is missing and whose turn it is.',
    ],
    nota: 'The bar writes nothing when you look at it: it is worked out every time it opens, with the same rule dispatch uses.',
  },
};
