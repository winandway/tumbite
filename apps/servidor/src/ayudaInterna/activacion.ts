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
      'En la lista de conductores, la columna «Activación» dice «Listo para recibir carreras» o «Todavía no». En «Países y servicios» (dentro de Sistema y configuración) quedan abrir ciudades, la compuerta del país y la tasa: ahí no se aprueba a nadie. La revisión de papeles, motos y carros vive aquí.',
      'La pestaña «Vehículos» junta todas las motos y los carros. «Esperan revisión» trae cada vehículo con su conductor, su ID, su ciudad, su placa y sus fotos y papeles en miniatura (tócalas para verlas en grande); lo apruebas o lo rechazas ahí mismo, sin buscar a la persona. «Revisar todo del conductor» abre su ficha en Verificaciones con su identidad, su vehículo, sus papeles, el casco y la edad juntos. «Sin enviar» lista a quien registró su vehículo y no lo mandó a revisión: no hay nada que aprobar todavía y Camila le recuerda enviarlo. El número del menú cuenta a cada persona con algo por decidir (aunque no haya empezado su verificación de identidad) y baja en cuanto apruebas.',
      'La barra y el vehículo dicen siempre lo mismo: «Vehículo aprobado» y «Vehículo en uso» salen en verde solo si de verdad lo están. Si lo registró con su placa pero no lo envió, «Vehículo registrado con su placa» sale en verde y «Vehículo aprobado» en gris con «lo registró, falta enviarlo a revisión», y le toca al conductor.',
      'En la tarjeta de papeles, cada foto dice la verdad: si la licencia, el documento o el seguro llegaron por otro camino (la verificación de identidad, «Tus papeles» o los papeles del vehículo), se ve esa foto con de dónde llegó. Si un papel está aprobado y no tiene ninguna foto guardada, lo dice en rojo («Aprobado sin foto guardada») con «Pedir de nuevo».',
      'Si un documento ya aprobado parece vencido, sale arriba en rojo con la fecha que se leyó. Mira la foto: si de verdad venció, toca «Pedir el documento vigente» (el motivo ya viene escrito) y Camila se lo pide al conductor. Cuando la fecha leída ya pasó, el caso llega también a la campana del equipo para que una persona lo decida.',
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
      cap(
        'vehiculos',
        'es',
        'La pestaña Vehículos de Verificaciones con una moto que espera revisión, su conductor, su placa, sus fotos en miniatura y el botón para aprobarla.',
        'Los vehículos se ven y se aprueban en Verificaciones.',
      ),
    ],
    pasos: [
      'Entra a Verificaciones, pestaña «Pendientes». Si es un registro masivo, elige la zona y el orden «Más cerca de activarse».',
      'Abre a la persona. Mira sus fotos y aprueba su identidad, o recházala con el motivo.',
      'Baja a «Vehículo por revisar»: abre cada foto con «Ver el archivo» y aprueba (o recházalo desde los tres puntos, con el motivo).',
      'Si todo lo que ves está bien, usa «Aprobar todo lo que está en verde» y confirma.',
      'Mira la barra: si dice «Ya puede recibir carreras», el conductor solo tiene que abrir Driver y deslizar para conectarse. Si dice «Todavía no», el paso en gris dice qué falta y a quién le toca.',
      'Para revisar solo vehículos, abre la pestaña «Vehículos», lista «Esperan revisión»: mira las fotos, aprueba los papeles y la moto o el carro, o recházalo desde los tres puntos con el motivo.',
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
      'In the driver list, the «Activation» column says «Ready to receive trips» or «Not yet». «Countries and services» (under System and settings) keeps opening cities, the country gate and the rate: nobody is approved there. Reviewing documents, motorbikes and cars lives here.',
      'The «Vehicles» tab brings together every motorbike and car. «Waiting for review» shows each vehicle with its driver, ID, city, plate and its photos and documents as thumbnails (tap to see them full size); you approve or reject it right there, without looking the person up. «Review everything for this driver» opens their Verifications file with their identity, vehicle, documents, helmet and age together. «Not sent» lists whoever registered a vehicle and never sent it for review: there is nothing to approve yet and Camila reminds them to send it. The menu number counts each person with something to decide (even if they have not started identity verification) and goes down as soon as you approve.',
      'The bar and the vehicle always say the same thing: «Vehicle approved» and «Vehicle in use» are green only if they really are. If they registered it with its plate but did not send it, «Vehicle registered with its plate» is green and «Vehicle approved» is gray with «registered, not sent for review yet», and it is the driver’s turn.',
      'On the documents card, each photo tells the truth: if the license, ID or insurance came another way (identity verification, «Your documents» or the vehicle documents), that photo shows with where it came from. If a document is approved with no saved photo, it says so in red («Approved with no saved photo») with «Ask again».',
      'If an approved document looks expired, it shows at the top in red with the date that was read. Look at the photo: if it really expired, tap «Ask for the current document» (the reason is already written) and Camila asks the driver for it. When the date read has already passed, the case also reaches the team bell so a person decides.',
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
      cap(
        'vehiculos',
        'en',
        'The Vehicles tab in Verifications with a motorbike waiting for review, its driver, plate, photo thumbnails and the button to approve it.',
        'Vehicles are seen and approved in Verifications.',
      ),
    ],
    pasos: [
      'Go to Verifications, «Pending» tab. For a bulk sign-up, choose the area and the «Closest to activation» order.',
      'Open the person. Look at their photos and approve their identity, or reject it with the reason.',
      'Scroll to «Vehicle to review»: open each photo with «See the file» and approve (or reject from the three dots, with the reason).',
      'If everything you see is fine, use «Approve everything in green» and confirm.',
      'Check the bar: if it says «Ready to receive trips», the driver only has to open Driver and swipe to go online. If it says «Not yet», the gray step says what is missing and whose turn it is.',
      'To review vehicles only, open the «Vehicles» tab, «Waiting for review» list: look at the photos, approve the documents and the motorbike or car, or reject it from the three dots with the reason.',
    ],
    nota: 'The bar writes nothing when you look at it: it is worked out every time it opens, with the same rule dispatch uses.',
  },
};

/**
 * C-MENU-POR-USO (25 nov 2026, Richard) — todos los países. La guía interna del menú del panel por uso:
 * lo del día arriba, la configuración al final.
 */
const capMenu = (idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `menu-por-uso-${idioma}.webp`,
  alt,
  pie,
});

export const menuPorUso: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'panel-menu-by-use',
    titulo: 'El menú del panel va por uso',
    resumen:
      'El menú de la izquierda pone arriba lo que se usa todos los días y deja al final, dentro de Sistema y configuración, lo que se toca cada mes o casi nunca. Verificaciones va justo debajo de Resumen.',
    explicacion: [
      'Operación es lo del día, en el orden en que más se usa: Resumen, Verificaciones, Pedidos en curso, Tickets, Camila, Viajes con sus emergencias, Reportes y Recordatorios de registro. Después vienen Personas (repartidores, clientes, restaurantes, líneas y el embudo de registro), Dinero, Servicios y Ventas y marketing.',
      'Al final está Sistema y configuración: Configuración (tu horario, el equipo y el límite de cada moneda del control dual), Países y servicios (abrir un servicio en una ciudad, la compuerta de cada país y la tasa), Ciudades, Zonas, Franquicias, Lista de espera, Equipo interno y Para aprobar.',
      '«Países y servicios» se llamaba «Moto · Abrir y aprobar»: abre y cierra países, nunca aprueba a un conductor ni una moto. Los conductores y sus vehículos se aprueban en Verificaciones.',
      '«Para aprobar» es la segunda firma del dinero movido a mano. Vive abajo porque casi no se usa; su número sale solo cuando hay algo esperando. El límite de cada moneda ya no está ahí: se cambia en Configuración.',
      'Los números del menú son tareas: dicen cuántas cosas esperan una acción y bajan al hacerla (aprobar, responder, asignar), no al mirarlas.',
    ],
    capturas: [
      capMenu(
        'es',
        'El menú del panel con Resumen y Verificaciones arriba, y Sistema y configuración al final con Países y servicios y Para aprobar.',
        'Lo del día arriba; la configuración al final.',
      ),
    ],
    pasos: [
      'Para aprobar conductores, motos o carros, entra a Verificaciones (justo debajo de Resumen).',
      'Para abrir un servicio en una ciudad o la compuerta de un país, baja a Sistema y configuración y entra a Países y servicios.',
      'Para cambiar el límite de una moneda del control dual, entra a Configuración.',
    ],
    nota: 'Una pantalla nueva entra en su grupo por cuánto se usa: lo diario en Operación, lo que es configuración dentro de Sistema y configuración.',
  },
  en: {
    id: 'panel-menu-by-use',
    titulo: 'The panel menu is ordered by use',
    resumen:
      'The left menu puts what is used every day at the top and leaves what is touched monthly or almost never at the end, under System and settings. Verifications sits right below Summary.',
    explicacion: [
      'Operations is the daily work, in order of use: Summary, Verifications, Live orders, Tickets, Camila, Rides with their emergencies, Reports and Sign-up reminders. Then come People (drivers, customers, restaurants, lines and the sign-up funnel), Money, Services and Sales and marketing.',
      'At the end is System and settings: Settings (your time zone, the team and the limit for each currency of two-person approval), Countries and services (opening a service in a city, each country gate and the rate), Cities, Zones, Franchises, Waitlist, Internal team and Approvals.',
      '«Countries and services» used to be «Moto · Launch and approve»: it opens and closes countries and never approves a driver or a motorbike. Drivers and their vehicles are approved in Verifications.',
      '«Approvals» is the second signature for money moved by hand. It lives at the bottom because it is rarely used; its number only shows when something is waiting. The limit for each currency is no longer there: it is changed in Settings.',
      'The menu numbers are tasks: they say how many things are waiting for an action and go down when you do it (approve, reply, assign), not when you look.',
    ],
    capturas: [
      capMenu(
        'en',
        'The panel menu with Summary and Verifications at the top, and System and settings at the end with Countries and services and Approvals.',
        'Daily work at the top; settings at the end.',
      ),
    ],
    pasos: [
      'To approve drivers, motorbikes or cars, go to Verifications (right below Summary).',
      'To open a service in a city or a country gate, scroll to System and settings and open Countries and services.',
      'To change the limit for a currency of two-person approval, open Settings.',
    ],
    nota: 'A new screen goes into its group by how often it is used: daily work in Operations, anything that is a setting under System and settings.',
  },
};
