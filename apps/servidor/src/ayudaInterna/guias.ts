/**
 * C-AYUDA-INTERNA (16 nov 2026, Richard) — todos los países. La ayuda del equipo de operaciones: cómo
 * funciona NUESTRO panel (el superadmin), para entrenar a quien entra nuevo. Antes eran guías
 * públicas de Docs (C-DOCS-OPERACIONES); Richard decidió que lo interno no se publica: solo se lee
 * dentro del superadmin, con la sesión del equipo, desde el botón «?» de la cabecera.
 *
 * Vive en el SERVIDOR, no en el paquete del panel: el texto no viaja en el JavaScript público y solo
 * sale por `GET /datos/admin/ayuda` (sesión del equipo, sin caché compartida, noindex). Las capturas
 * tampoco están en /public: viven en el almacén del sitio (`ayuda-interna/<archivo>.webp`), las sube
 * `scripts/docs/subir-ayuda-interna.mjs` y se sirven por `GET /datos/admin/ayuda/captura/:archivo`.
 * Las originales se guardan fuera del repositorio (~/Divoox-privado/ayuda-interna).
 *
 * En inglés van las capturas de Novi, Michigan, y en español las de El Vigía (C-CAPTURAS-POR-IDIOMA);
 * la guía de la autorización vencida lleva en español las de Miami (El Vigía no cobra con tarjeta).
 */
import { plazoPapeles } from './papeles';

export type IdiomaAyuda = 'es' | 'en';
export type CapturaAyuda = { archivo: string; alt: string; pie: string };
export type GuiaAyuda = {
  id: string;
  titulo: string;
  resumen: string;
  explicacion?: string[];
  capturas?: CapturaAyuda[];
  preguntas?: string[];
  pasos: string[];
  nota?: string;
};
export type SeccionAyuda = { id: string; titulo: string; guias: GuiaAyuda[] };

type Guia = GuiaAyuda;

/** Captura del monitoreo: `monitoreo-<nombre>-<idioma>.webp` en el almacén. */
const foto = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `monitoreo-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

/** Captura de la bandeja de reportes (C-MODERACION). */
const fotoModeracion = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({ archivo: `recorrido-moderacion-${nombre}-${idioma}.webp`, alt, pie });

// ───────────────────────── Empieza aquí y el semáforo (nuevas, 16 nov 2026) ─────────────────────────

const inicio: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'how-divoox-works',
    titulo: 'Así funciona Divoox: empieza aquí',
    resumen:
      'Para quien entra nuevo al equipo: qué es Divoox, quién usa cada parte, cómo avanza un pedido o un viaje y qué hace el equipo de operaciones desde este panel.',
    explicacion: [
      'Divoox es una plataforma de reparto y de viajes. Tiene tres apps: la del cliente (pide comida, compras de tienda, viajes en auto o en moto y envíos de un punto a otro), Divoox Driver (la usan los repartidores y los conductores) y Divoox Restaurants (la usan los restaurantes y las tiendas). Los restaurantes tienen además su panel web, y las empresas de paquetería trabajan con Divoox Flex.',
      'Este panel es el de operaciones: el nuestro. Desde aquí el equipo ve en vivo lo que pasa en cada ciudad, encuentra cualquier pedido, viaje o persona, atiende los tickets de soporte, revisa los reportes de mensajes y reseñas, aprueba verificaciones de identidad y gestiona el equipo. Nadie fuera de Divoox ve esta pantalla.',
      'Un pedido de comida avanza así: el cliente paga, el restaurante acepta, la cocina prepara, un repartidor acepta la oferta, llega al restaurante, recoge y entrega. Un viaje: el pasajero pide, se busca conductor, el conductor llega, espera al pasajero, hace el recorrido y termina. Cada paso queda anotado con su hora, y el panel lo compara con lo previsto para decirte si va bien.',
      'El Manager es el vigilante automático de Divoox: mira cada pedido, avisa cuando algo se atrasa y hace algunas cosas solo, por ejemplo cancelar un pedido que el restaurante no aceptó a tiempo. En la ficha, lo que hizo el Manager se ve más tenue que lo que hicieron las personas.',
      'Lo que ves depende de tu acceso. Cada persona del equipo tiene plantillas de permisos y una zona de trabajo (países, ciudades y servicios). Si una sección o un botón no te aparece, es porque tu acceso no lo incluye: pídeselo a quien gestiona el equipo.',
      'El menú de la izquierda te dice dónde hay trabajo: al lado de cada sección sale un número con un punto que palpita. Verde quiere decir que hay cosas por atender (tickets abiertos, casos de Camila, reportes, aprobaciones de dinero, verificaciones, restaurantes y solicitudes de línea por aprobar, conductores sin ciudad). Rojo quiere decir urgente: una emergencia de viaje sin atender, o una verificación que lleva más de un día esperando. Se actualiza solo cada medio minuto y al cambiar de sección; cuando lo atiendes, el número baja y el punto se apaga. Solo cuenta cuentas reales (nunca las de prueba) y solo lo de tu zona de trabajo.',
      'Los colores quieren decir siempre lo mismo en todo el panel, en cada fila y en cada ficha: verde, hecho o aprobado; ámbar, pendiente o esperando a alguien; rojo, un problema que pide actuar (rechazado, vencido, falló, o algo que espera más de un día); gris, apagado o sin datos. En cada pantalla hay un solo botón rojo, el de la acción principal; los demás son de borde, y lo que borra está en los tres puntos.',
      'Tres reglas que no se rompen. La dirección de este panel es secreta y no se comparte con nadie. Los teléfonos, los correos y las fotos de las personas se miran solo cuando hacen falta, y cada vez que alguien los mira queda anotado. Y esta ayuda es interna: no se copia en páginas públicas ni se manda a clientes, restaurantes o repartidores.',
    ],
    capturas: [
      foto(
        'pestanas',
        'es',
        'La pantalla Pedidos en curso con las pestañas por servicio, los filtros de ciudad, estado y orden, y una línea con su semáforo.',
        '«Pedidos en curso»: lo que pasa ahora en cada ciudad, con lo urgente primero.',
      ),
      foto(
        'buscador-letra',
        'es',
        'El buscador de arriba del panel con una sola letra escrita y la lista de pedidos que empiezan así.',
        'El buscador de arriba encuentra cualquier pedido, viaje o persona desde la primera letra.',
      ),
    ],
    preguntas: [
      'Soy nuevo en el equipo: ¿por dónde empiezo?',
      '¿Qué es el Manager?',
      '¿Por qué no veo una sección del menú?',
    ],
    pasos: [
      'Lee esta guía y después «Encontrar cualquier pedido, viaje o persona» y «Vigilar pedidos y viajes en curso».',
      'Abre «Pedidos en curso» y mira unos minutos la lista de tu ciudad: el semáforo te dice qué necesita atención.',
      'Abre la ficha de un pedido ya entregado y léela de arriba abajo, con la guía «Leer la ficha de un pedido o un viaje» al lado.',
      'Vuelve a esta ayuda cuando quieras con el botón «?» de arriba, junto a la campana.',
    ],
    nota: 'Mirar nunca cambia nada. Los botones que sí hacen algo (cancelar, devolver, suspender) piden confirmación.',
  },
  en: {
    id: 'how-divoox-works',
    titulo: 'How Divoox works: start here',
    resumen:
      'For anyone new on the team: what Divoox is, who uses each part, how an order or a ride moves forward, and what the operations team does from this panel.',
    explicacion: [
      'Divoox is a delivery and rides platform. It has three apps: the customer app (food, store orders, car and moto rides, and point-to-point deliveries), Divoox Driver (used by couriers and drivers) and Divoox Restaurants (used by restaurants and stores). Restaurants also have their web dashboard, and package companies work with Divoox Flex.',
      'This is the operations panel: ours. From here the team watches what is happening in every city, finds any order, ride or person, answers support tickets, reviews reported messages and reviews, approves identity verifications and manages the team. Nobody outside Divoox sees this screen.',
      'A food order moves like this: the customer pays, the restaurant accepts, the kitchen prepares, a driver accepts the offer, arrives at the restaurant, picks up and delivers. A ride: the rider requests, we look for a driver, the driver arrives, waits for the rider, makes the trip and ends it. Every step is logged with its time, and the panel compares it with what was expected to tell you whether it is going well.',
      'The Manager is Divoox’s automatic watcher: it looks at every order, warns when something is running late and does a few things by itself, for example canceling an order the restaurant did not accept in time. In a file, what the Manager did is shown fainter than what people did.',
      'What you see depends on your access. Every team member has permission templates and a work scope (countries, cities and services). If a section or a button does not show up for you, your access does not include it: ask whoever manages the team.',
      'The menu on the left tells you where there is work: next to each section there is a number with a pulsing dot. Green means there are things to handle (open tickets, Camila cases, reports, money approvals, verifications, restaurants and line requests to approve, drivers without a city). Red means urgent: an unattended ride emergency, or a verification that has been waiting more than a day. It refreshes on its own every half minute and when you change sections; once you handle it, the number drops and the dot goes out. It only counts real accounts (never test ones) and only what is in your work area.',
      'Colors always mean the same thing across the whole panel, on every row and every page: green, done or approved; amber, pending or waiting on someone; red, a problem that needs action (rejected, expired, failed, or something waiting more than a day); gray, off or no data. Each screen has a single red button, the main action; the others are outlined, and anything that deletes is in the three-dot menu.',
      'Three rules that never bend. The address of this panel is secret and is never shared. People’s phone numbers, emails and photos are viewed only when needed, and every view is logged. And this help is internal: it is never copied into public pages or sent to customers, restaurants or drivers.',
    ],
    capturas: [
      foto(
        'pestanas',
        'en',
        'The Live orders screen with the service tabs, the city, status and order filters, and live lines with their traffic lights.',
        '“Live orders”: what is happening now in every city, with the urgent first.',
      ),
      foto(
        'buscador-letra',
        'en',
        'The search bar at the top of the panel with one letter typed and the orders that start with it.',
        'The search bar at the top finds any order, ride or person from the first letter.',
      ),
    ],
    preguntas: [
      'I’m new on the team: where do I start?',
      'What is the Manager?',
      'Why can’t I see a section of the menu?',
    ],
    pasos: [
      'Read this guide, then “Finding any order, ride or person” and “Monitoring live orders and rides.”',
      'Open “Live orders” and watch your city’s list for a few minutes: the traffic light tells you what needs attention.',
      'Open the file of an order that was already delivered and read it from top to bottom, with “Reading an order or ride file” beside it.',
      'Come back to this help anytime with the “?” button at the top, next to the bell.',
    ],
    nota: 'Looking never changes anything. The buttons that do something (cancel, refund, suspend) ask for confirmation.',
  },
};

const semaforo: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'traffic-light-stuck',
    titulo: 'El semáforo y «Atascado»: qué atender primero',
    resumen:
      'Verde, amarillo y rojo en cada pedido y viaje, y cuándo un paso pasa a «Atascado». Así sabes de un vistazo qué atender primero.',
    explicacion: [
      'Cada línea de «Pedidos en curso» lleva un punto de color calculado con los tiempos reales contra los previstos. Verde: a tiempo. Amarillo: atrasándose. Rojo: atascado, con el motivo en palabras normales al lado.',
      'Los motivos de un pedido de comida son cuatro: «sin aceptar» (el restaurante no lo ha aceptado; se cancela solo a los 6 minutos), «la cocina pasó el tiempo prometido», «lista y sin repartidor» y «la entrega está tardando». En los viajes, buscar conductor pasa a amarillo a los 5 minutos y a rojo a los 8, y una emergencia abierta siempre es roja.',
      'En la ficha, la tarjeta Tiempos dice lo mismo paso por paso. Un paso que sigue abierto dice «En curso» y cuánto lleva. Si pasa lo previsto por más de 5 minutos, se marca «Atascado» en rojo, con lo que lleva y lo que se esperaba, y el pedido sube al principio de «Pedidos en curso».',
      'Los tiempos se dicen en palabras, nunca en horas sueltas: «1 hora y 5 minutos», «hace 3 días», «1 mes y 1 día». Un paso abierto sin movimiento por más de 12 horas ya no se mide: dice «Sin cerrar», en gris, y explica qué revisar.',
      'Qué hacer con un rojo: abre la ficha, mira qué paso está atascado y en manos de quién está (el restaurante, el repartidor o el conductor), y actúa según tu acceso: escribir por el chat del pedido, soltar al repartidor para que otro lo tome o cancelar. Una emergencia abierta en un viaje va siempre primero.',
    ],
    capturas: [
      foto(
        'pestanas',
        'es',
        'Pedidos en curso con el orden «Lo que necesita atención primero» y el semáforo en cada línea.',
        'Lo que está en rojo sube arriba, con su motivo al lado.',
      ),
      foto(
        'pedido-tiempos',
        'es',
        'La tarjeta Tiempos de un pedido: cada paso con lo que tomó, lo previsto y si se pasó o fue a tiempo.',
        'En la ficha, cada paso dice si fue a tiempo o se pasó, y por cuánto.',
      ),
    ],
    preguntas: [
      '¿Qué significa «Atascado»?',
      '¿Qué hago con un pedido en rojo?',
      '¿Cuándo se pone rojo un viaje sin conductor?',
    ],
    pasos: [
      'Abre «Pedidos en curso» con el orden «Lo que necesita atención primero».',
      'Empieza por las líneas en rojo y lee el motivo al lado del punto.',
      'Abre la ficha y busca en Tiempos el paso que dice «Atascado».',
      'Actúa con lo que tu acceso permite y vuelve a la lista: se actualiza sola cada 15 segundos.',
    ],
  },
  en: {
    id: 'traffic-light-stuck',
    titulo: 'The traffic light and “Stuck”: what to handle first',
    resumen:
      'Green, yellow and red on every order and ride, and when a step turns “Stuck.” So you know at a glance what to handle first.',
    explicacion: [
      'Every line in “Live orders” has a colored dot calculated from the real times against the expected ones. Green: on time. Yellow: running late. Red: stuck, with the reason in plain words beside it.',
      'A food order has four reasons: “not accepted” (the restaurant has not accepted it; it cancels by itself at 6 minutes), “kitchen is past the promised time,” “ready with no driver” and “delivery is taking long.” For rides, searching for a driver turns yellow at 5 minutes and red at 8, and an open emergency is always red.',
      'In the file, the Times card says the same, step by step. A step still open says “In progress” and how long it has been going. If it goes more than 5 minutes past what was expected, it is marked “Stuck” in red, with how long it has taken and what was expected, and the order moves to the top of “Live orders.”',
      'Times are said in words, never in loose hours: “1 hour and 5 minutes,” “3 days ago,” “1 month and 1 day.” A step left open with no activity for more than 12 hours is no longer measured: it says “Not closed,” in gray, and explains what to check.',
      'What to do with a red one: open the file, see which step is stuck and who has it (the restaurant, the driver), and act within your access: write in the order chat, release the driver so someone else takes it, or cancel. An open emergency on a ride always comes first.',
    ],
    capturas: [
      foto(
        'pestanas',
        'en',
        'Live orders sorted by “Needs attention first,” with the traffic light on each line.',
        'What is red goes to the top, with its reason beside it.',
      ),
      foto(
        'pedido-tiempos',
        'en',
        'The Times card of an order: each step with how long it took, what was expected and whether it was late or on time.',
        'In the file, each step says whether it was on time or late, and by how much.',
      ),
    ],
    preguntas: [
      'What does “Stuck” mean?',
      'What do I do with an order in red?',
      'When does a ride with no driver turn red?',
    ],
    pasos: [
      'Open “Live orders” sorted by “Needs attention first.”',
      'Start with the red lines and read the reason beside the dot.',
      'Open the file and look in Times for the step that says “Stuck.”',
      'Act within your access and go back to the list: it refreshes by itself every 15 seconds.',
    ],
  },
};

/** C-DOBLE-FIRMA: antes era la guía pública «two-person-approval»; muestra la bandeja del equipo. */
const dobleFirma: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'two-person-approval',
    titulo: 'Para aprobar: la doble firma del dinero que se mueve a mano',
    resumen:
      'Una devolución, un reembolso o un ajuste grande hecho a mano nunca lo decide una sola persona: lo pide una persona del equipo y lo aprueba otra, en la bandeja «Para aprobar».',
    explicacion: [
      'Casi todo el dinero en Divoox se mueve solo: el cobro del pedido, el pago al restaurante, la ganancia del repartidor. A veces hay que moverlo a mano: devolverle a un cliente un pedido que salió mal, reembolsar una recarga, corregir el saldo de una empresa de Flex o fondear un punto de venta.',
      'Cuando ese movimiento pasa del límite, no se hace al momento: queda esperando en «Para aprobar», con el monto, el motivo y el nombre de quien lo pidió. Mientras espera no se mueve nada; el saldo y las cuentas de la persona siguen igual.',
      'Otra persona del equipo, con permiso de finanzas, lo revisa y lo aprueba con su contraseña, o lo rechaza con un motivo. Nadie puede aprobar lo que pidió. Cada paso queda registrado: quién lo pidió, quién lo aprobó y cuándo.',
      'Lo mismo vale para el control diario del dinero: cada día se compara lo cobrado con lo pagado a restaurantes y repartidores. Si un día no cuadra y la diferencia tiene explicación (por ejemplo, una compra de prueba), darlo por explicado también lo pide una persona y lo aprueba otra. Mientras tanto, la alarma del dinero sigue encendida.',
      'Al cliente, al restaurante o al repartidor solo se le dice que su devolución está en revisión y que le avisamos al resolverse. El límite y el nombre de quien aprueba no se comparten.',
    ],
    capturas: [
      {
        archivo: 'doble-firma-es.webp',
        alt: 'La bandeja «Para aprobar» con un ajuste de billetera y una devolución esperando la segunda firma, cada uno con su monto, su motivo y quién lo pidió.',
        pie: 'Cada movimiento grande espera la firma de una segunda persona del equipo.',
      },
    ],
    preguntas: [
      '¿Quién aprueba una devolución grande?',
      '¿Por qué una devolución quedó en revisión?',
      '¿Puedo aprobar algo que pedí yo?',
    ],
    pasos: [
      'Pide la devolución o el ajuste desde la ficha, con el monto y un motivo claro.',
      'Si pasa del límite, queda en «Para aprobar»: avísale a quien tiene permiso de finanzas.',
      'Quien aprueba abre «Para aprobar», lee el monto y el motivo, y aprueba con su contraseña o rechaza explicando por qué.',
      'Al aprobarse, el dinero se mueve y se le avisa a la persona; si se rechaza, se le explica.',
    ],
    nota: 'Nadie aprueba su propia solicitud: el panel no lo deja.',
  },
  en: {
    id: 'two-person-approval',
    titulo: 'Approvals: two signatures for money moved by hand',
    resumen:
      'A large refund, reimbursement or balance adjustment made by hand is never decided by one person: one team member requests it and another one approves it, in the “Approvals” inbox.',
    explicacion: [
      'Almost all money on Divoox moves on its own: the order charge, the restaurant payout, the driver’s earnings. Sometimes it has to be moved by hand: refunding a customer for an order that went wrong, refunding a top-up, correcting a Flex business balance or funding a sales point.',
      'When that movement is above the limit, it doesn’t happen right away: it waits in “Approvals,” with the amount, the reason and the name of whoever requested it. While it waits, nothing moves; the person’s balance and accounts stay the same.',
      'Another team member with finance permissions reviews it and approves it with their password, or rejects it with a reason. Nobody can approve their own request. Every step is recorded: who requested it, who approved it and when.',
      'The same goes for the daily money check: every day we compare what was charged with what was paid to restaurants and drivers. If a day doesn’t balance and the difference has an explanation (for example, a test purchase), marking it as explained is also requested by one person and approved by another. Until then, the money alarm stays on.',
      'Customers, restaurants and drivers are only told that their refund is under review and that we will let them know. The limit and the approver’s name are never shared.',
    ],
    capturas: [
      {
        archivo: 'doble-firma-en.webp',
        alt: 'The “Approvals” inbox with a wallet adjustment and an order refund waiting for the second signature, each with its amount, reason and requester.',
        pie: 'Every large movement waits for a second team member’s signature.',
      },
    ],
    preguntas: [
      'Who approves a large refund?',
      'Why is a refund under review?',
      'Can I approve something I requested?',
    ],
    pasos: [
      'Request the refund or adjustment from the file, with the amount and a clear reason.',
      'If it is above the limit, it goes to “Approvals”: let someone with finance permissions know.',
      'The approver opens “Approvals,” reads the amount and the reason, and approves with their password or rejects it explaining why.',
      'Once approved, the money moves and the person is notified; if it is rejected, they are told why.',
    ],
    nota: 'Nobody approves their own request: the panel doesn’t allow it.',
  },
};

// ───────────────────────── Las guías que antes estaban en Docs ─────────────────────────

const en: Guia[] = [
  {
    id: 'search-orders-rides-people',
    titulo: 'Finding any order, ride or person',
    resumen:
      'The search bar at the top of the operations panel finds an order, a ride, a customer, a driver, a restaurant, a vehicle, a ticket or any part of the panel from the first letter you type.',
    explicacion: [
      'The search bar is at the top of every screen of Divoox’s operations panel. Press “/” (or Ctrl+K, or ⌘K on a Mac) from anywhere and start typing. There is no button to press: results appear while you type, grouped by what they are: Orders, Rides, Customers, Drivers, Restaurants and stores, Vehicles and Tickets. The sections of the panel show up too, under “Go to”.',
      'You can type almost anything people remember. The short order code, with or without the “#”. The full ID. A first or last name, without worrying about capitals or accents: “jose” finds “José”, and a last name or middle name alone is enough to find the person, even if they just created their account and haven’t confirmed their email. A phone number: the last four digits, or the beginning. An email. A license plate. A driver code such as US-NOV-000014. Or an amount, with a dollar sign or decimals; amounts are searched only in the last 30 days, and the screen says so.',
      'The short code is the one customers read to you: the first four characters of the order. The panel shows six and writes those four in bold. You don’t need the whole code: from the very first character, the search already suggests every order and ride whose code starts that way. Type “7” and you see the ones that start with 7; type “73” and the list narrows at once. Capitals don’t matter, and the “#” is optional.',
      'When many share the first characters, the ones still in progress come first, with the ones in trouble at the top, then the closed ones, newest first. The group title says how many there are in total (for example “Orders · 312”), and “See all” at the bottom of the group opens Live orders with the same search, where you can keep loading every match.',
      'If nothing matches, the panel says exactly what you searched for and helps you: when a code has a letter that looks like a number (an “O” instead of a zero, an “l” instead of a one), it asks “Did you mean #B4290C?” and one click searches it.',
      'Search looks everywhere, not only at what is on screen: it finds closed orders, orders still awaiting payment, and orders from any city. Each result shows what matched, highlighted. Phone numbers and emails are partly hidden for everyone on the team (for example “+1 ••• ••• 4821”), so you can recognize a person without exposing their data.',
      'The search bar also takes you to any part of the panel. Type what you are looking for in your own words, in English or Spanish, with or without accents: “kyc”, “documents”, “ID”, “license” or “cédula” take you to Verifications and Approvals; “balance” or “top-ups” to Driver balances; “fares” to Rides; “coupons” to Divoox gifts; “rate” to the bolívar rate; “team” to the Internal team. These suggestions appear first, under “Go to…”, from the first letter, and next to each one you see the word that found it. You only see the parts of the panel your account can open.',
      'It also finds what people want to do: “add balance”, “change fares”, “create coupon” or “add employee” take you straight to the screen where that is done. And “help” opens this team help.',
      'People are found in every state, also right after signing up: a driver who just registered in the Driver app appears by the first letters of their email (no “@” needed), their name or their phone. Each account says its state in words: “Not verified” (sent nothing yet), “Documents pending” (waiting for review), “Approved”, “Declined”, “Suspended”, or “Email not confirmed” for a customer. Under a driver, “See their documents” opens their verification directly. A store owner who signed up but has not finished loading the store appears as “Sign-up not finished”, and a Flex business appears with its state (active or paused).',
      'If nothing matches, the panel never leaves you stuck: under “Maybe you were looking for:” it suggests the parts of the panel with a similar word (a typo such as “verifcation” still finds Verifications), or the everyday sections if nothing is close.',
    ],
    capturas: [
      foto(
        'buscador-letra',
        'en',
        'The operations panel search bar with only the letter “b” typed: the Orders group says how many orders start with B, shows the one being prepared first and then the delivered ones from Novi, and ends with “See all in Live orders”.',
        'One character is enough: the orders that start with “b”, the live one first, with the total and “See all”.',
      ),
      foto(
        'pedidos-por-codigo',
        'en',
        'Live orders opened from “See all”: a line says how many orders and rides start with “B”, and each code has its first letter underlined.',
        '“See all” opens Live orders with the same search and every match, page after page.',
      ),
      foto(
        'buscador',
        'en',
        'The operations panel search bar with “a7c3e1” typed: the dropdown shows two orders from Novi that share the same code, one delivered and one canceled, each with its status, city, amount and date.',
        'Two orders share the code A7C3E1, so the search shows both, with their status and date.',
      ),
      foto(
        'buscador-sugerencia',
        'en',
        'The search bar with “B51DO7” typed, with the letter O instead of a zero: the panel says it couldn’t find it and asks “Did you mean #B51D07?”.',
        'A letter that looks like a number? The panel suggests the right code.',
      ),
    ],
    preguntas: [
      'How do I find an order with only the code the customer gave me?',
      'Can I search with just the first character of the code?',
      'How do I search for a customer by the last digits of their phone?',
      'Why does a short code show more than one order?',
      'Can I find a closed order or an order from another city?',
      'How do I find a driver who just signed up, to see their documents?',
      'How do I get to Verifications by typing “kyc”?',
    ],
    pasos: [
      'Click the search bar, or press “/” or Ctrl+K (⌘K on a Mac) from any screen.',
      'Type what you have: a code (even one character), a name, the last four digits of a phone, a plate, an email or an amount.',
      'Read the groups. Each line shows the status, the city, the amount and the date; the part that matched is highlighted.',
      'Use the arrow keys and press Enter, or click a line, to open its file. Press Escape to close the list.',
      'If several orders share the code, compare their date and amount, or type more letters to narrow it down. To see every match, choose “See all” at the bottom of the group.',
      'If the panel says it couldn’t find anything, read the suggestion under “Did you mean…?” and click it, or open Live orders from the same box to search the closed ones too.',
      'To force what you are searching for, start with a hint: “tel:” for a phone, “plate:” for a plate, “amount:” for an amount, “email:” for an email or “id:” for an ID. In the panel these hints are typed exactly as written here.',
      'If you see “Amounts are searched in the last 30 days only,” the amount you typed is older: search by code or by name instead.',
      'To go to a part of the panel, type its name or any word for it (“kyc”, “balance”, “fares”) and choose it under “Go to…”.',
      'To see a new driver’s documents, type the first letters of their email, name or phone, and choose “See their documents” under their name.',
    ],
    nota: 'Search never changes anything: looking is always safe.',
  },
  {
    id: 'monitor-live-orders-rides',
    titulo: 'Monitoring live orders and rides',
    resumen:
      'Live orders puts food, store orders, car rides, moto rides and deliveries in one list, with a traffic light that shows what is in trouble first.',
    explicacion: [
      'Open “Live orders” in the left menu. The tabs at the top split the list by service: All, Food, Stores, Car rides, Moto rides and Deliveries (the Deliveries tab appears only when there is one). Next to each tab you see how many are live and, in a red badge, how many are in trouble.',
      'Under the tabs you choose the city, the status and the order. Live shows what is happening now, including orders awaiting payment. Closed shows what is finished. All shows both. The default order, “Needs attention first,” puts the ones in trouble at the top. The list refreshes by itself every 15 seconds.',
      'Each line has the service icon, the code, who it is for, the city, the driver, the time and a traffic light. Green means on time. Yellow means running late. Red means in trouble, and the line says why in plain words: “kitchen is past the promised time,” “open emergency.” For rides, searching for a driver turns yellow at 5 minutes and red at 8, and an open emergency is always red.',
      'Click a line to open its file (see “Reading an order or ride file”). When there is more to show, click “Load more” at the bottom: nothing is skipped or repeated.',
      'The panel remembers your filters. The city, the status, the order and the tab you left are there the next time you come back, on any computer, because they belong to your account. A thin line says “Showing your saved filters,” with a “Reset” link to clear them. The text you type in a search box is never saved.',
    ],
    capturas: [
      foto(
        'pestanas',
        'en',
        'The Live orders screen with the tabs All, Food, Stores, Car rides, Moto rides and Deliveries, the city, status and order filters, and three live lines with their traffic lights.',
        'Tabs by service, filters, and the traffic light on each line.',
      ),
      foto(
        'pestanas-moto',
        'en',
        'The Moto rides tab selected: one live ride, marked in trouble with a red light because of an open emergency, with the city, status and order filters above it.',
        'One tab selected: the moto ride is in red because of an open emergency.',
      ),
    ],
    preguntas: [
      'How do I see only the live moto rides?',
      'How do I see which orders are in trouble?',
      'Where do I see orders that are already closed?',
      'How do I clear the filters the panel remembered?',
    ],
    pasos: [
      'Open “Live orders” in the left menu.',
      'Click a service tab: All, Food, Stores, Car rides, Moto rides or Deliveries. The red number is what is in trouble.',
      'Choose the city, and click Live, Closed or All.',
      'Leave the order on “Needs attention first,” or change it.',
      'Read the traffic light on each line: green on time, yellow running late, red in trouble, with the reason beside it.',
      'Click a line to open its file. At the bottom of the list, click “Load more” to keep going.',
      'To start from scratch, click “Reset” in the line that says “Showing your saved filters.”',
    ],
  },
  {
    id: 'read-order-ride-file',
    titulo: 'Reading an order or ride file',
    resumen:
      'Every order and ride has a file with the real time of each step against what was expected, a timeline, where it was picked up and delivered, and the closing.',
    explicacion: [
      'The Times card calculates, for you, how long each step really took and compares it with what was expected. Green means on time (half a minute over still counts as on time). Red means late, with the minutes. A step still running says “In progress” with how long it has been going, and it is not marked late until it closes. A step left open with no activity for more than 12 hours says “Not closed,” in gray, with what to check. Gray means the data is missing, and it says which one: older orders and assignments made by support do not have every time.',
      'While an order or ride is underway, the Live card at the top shows where the driver is on a map that moves by itself, the route, and the stage in plain words: heading to the restaurant, waiting at the restaurant, delivering the order (or heading to the pickup, waiting for the rider, on the way to the destination). It also shows the arrival time calculated with live traffic, for example “Arrives at 3:28 PM · 9 min left · 2 mi”, in the city’s time. If the driver has not moved for more than 3 minutes away from the restaurant, the pickup and the destination, or the phone stopped sending its location, it says so in red, and the same mark appears on the order in Live orders. Only team members allowed to see live locations get this card, and it disappears when the order or ride ends.',
      'For a food or store order the steps are: preparation, driver to the restaurant, wait at the restaurant, delivery trip, and the total from payment to delivery. For a ride they are: wait for a driver, driver arrival, rider wait (the free wait included in the fare), the trip, and the total.',
      'Below, the Timeline lists every event with its time, who did it and how long after the previous one. The Manager’s automatic actions are shown faded and can be hidden with “Hide what the Manager did.” Claims show up in the same line, so you can see what came after the delivery.',
      '“Where it was picked up” and “Where it was delivered” sit side by side with the address, the photo, when it was taken, who confirmed it, how far it was from the exact spot, how it was handed over and the driver’s note. Photos stay blurred until you click “View photo”. Photos are kept while a claim is open and are deleted automatically after 30 days, and the card says so. A handoff in person has no photo: that is normal, and the card shows how it was delivered. The photo a customer takes of their own front door is never shown here.',
      'The file ends with the closing (who delivered, when, and the payment), the people involved with links to their own files, the order details, support actions and the claims linked to this order. The ride file is similar: it also shows the vehicle and plate, and whether the ride started with the right pickup PIN and how many wrong attempts there were; the number itself is never shown. People rides do not have photos of the rider. Deliveries carry the photo of the package at pickup, and an emergency appears in the timeline, in its own card with its status, and as an urgent claim.',
    ],
    capturas: [
      foto(
        'pedido-tiempos',
        'en',
        'The order file header and Times card: preparation, driver to the restaurant, wait, delivery trip and total, each with what it took, what was expected, and a green or red result.',
        'The Times card: real time against expected, in green and red.',
      ),
      foto(
        'pedido-linea',
        'en',
        'The order timeline: each event with its time, who did it and how long after the previous one, from the order being created to the claim that was opened.',
        'The timeline, one line per event.',
      ),
      foto(
        'pedido-fotos',
        'en',
        'Where it was picked up and where it was delivered: the pickup photo is open, the delivery photo is blurred with a View photo button, and the distances in meters are below.',
        'Pickup photo open, delivery photo blurred until you click “View photo”.',
      ),
      foto(
        'pedido-cierre',
        'en',
        'The order closing, the payment, the people involved, the order details, support actions and the claims linked to the order.',
        'The closing, the people and the claims linked to the order.',
      ),
      foto(
        'viaje-tiempos',
        'en',
        'The ride file header and Times card for a completed car ride: wait for a driver, driver arrival, rider wait, trip and total.',
        'A ride file: the same Times card, with the steps of a ride.',
      ),
      foto(
        'viaje-detalle',
        'en',
        'Ride details: pickup and destination, the people, the vehicle and plate, the pickup PIN result, the amount, emergencies and claims.',
        'Ride details: no photos of the rider, and the PIN result without the number.',
      ),
      foto(
        'emergencia-linea',
        'en',
        'The timeline of a moto ride in progress with an emergency: the emergency event and the claim that was opened right after it.',
        'An emergency appears in the timeline.',
      ),
      foto(
        'emergencia-detalle',
        'en',
        'The Emergencies card of a ride, showing “Emergency from the rider” with the time and the status Not handled, and the urgent claim below it.',
        'The Emergencies card and its claim.',
      ),
      foto(
        'envio-paquete',
        'en',
        'The package card of a delivery, with the package, the recipient and its size, next to the photo of the package taken at pickup.',
        'A delivery shows the photo of the package at pickup.',
      ),
    ],
    preguntas: [
      'How do I know whether an order took longer than expected?',
      'Where do I see the photo of the delivery?',
      'Why is a photo blurred?',
      'Why does a delivery handed in person have no photo?',
      'How long are the photos kept?',
    ],
    pasos: [
      'Open the file from Live orders or from the search bar.',
      'Start with the Times card: green is on time, red is late, gray is missing data (it says which one).',
      'Read the Timeline from top to bottom. Click “Hide what the Manager did” if you only want the people’s actions.',
      'Compare “Where it was picked up” with “Where it was delivered”: address, time, who confirmed it and how far from the exact spot.',
      'Click “View photo” only when you need it. If it says the photo was deleted, it was past 30 days with no open claim.',
      'Check the closing for who delivered and how it was paid, and the claims at the bottom for anything reported.',
      'On a ride, check the Emergencies card first, then the vehicle, the plate and the pickup PIN result.',
    ],
    nota: 'Looking at a file never changes it. The support actions at the bottom are the only buttons that do something.',
  },
  {
    id: 'link-support-ticket',
    titulo: 'Linking a support ticket to an order or ride',
    resumen:
      'Open a claim from a ride file or from the Tickets inbox, linked to the order or ride by its code, and filter the inbox by service.',
    explicacion: [
      'A claim linked to an order or a ride keeps everything together: the ticket shows which order it is about, and the order or ride file lists its claims at the bottom. Anyone on the team who opens the file sees what was reported and how it was answered.',
      'You can open a claim from two places. From a ride file, “Open a claim” already has the code filled in. From the Tickets inbox, “Open a claim” asks for the code of the order or ride: the letters of the code (for example 407F2F) or the full ID.',
      'The claim uses the customer of that order or ride as the contact. Opening it does not send any email, and it stays assigned to you in the inbox. What you write in “What happened” becomes the first message of the ticket, and the customer sees it if you reply.',
      'If the letters you typed match more than one order or ride, the panel asks you to type more letters. If nothing matches, it says so. What you type is saved while you write, so closing the window does not lose it.',
      'In the Tickets inbox every line shows the service icon (food, stores, car, moto, deliveries) and you can filter by service with the Service list. The filter is remembered for your account. The tabs Open, Answered, Closed, All, Mine and Unassigned work as always.',
    ],
    capturas: [
      foto(
        'tickets',
        'en',
        'The Tickets inbox with the tabs Open, Answered, Closed, All, Mine and Unassigned, the Service filter, the Open a claim button, and tickets with their service icons.',
        'The Tickets inbox with the Service filter and “Open a claim.”',
      ),
      foto(
        'viaje-detalle',
        'en',
        'The bottom of a ride file with the Claims and tickets card and its Open a claim button.',
        'From a ride file, “Open a claim” already carries the code.',
      ),
    ],
    preguntas: [
      'How do I open a claim for a specific order or ride?',
      'How do I see all the claims about moto rides?',
      'What happens if the code matches more than one order?',
    ],
    pasos: [
      'In a ride file, click “Open a claim” in the Claims and tickets card. In the Tickets inbox, click “Open a claim” and type the order or ride code.',
      'Write the subject and, in “What happened,” the first message of the ticket.',
      'Choose the priority: Urgent, High, Normal or Low.',
      'Click “Open the claim.” It stays assigned to you.',
      'If it asks for more letters, type more of the code. If it says it was not found, check the code in the search bar.',
      'To review claims by service, open Tickets and choose the service in the Service list.',
      'Open the ticket to jump to its order or ride; the file lists the claim at the bottom.',
    ],
  },
  {
    id: 'time-zone-clock',
    titulo: 'Time zone and 12/24-hour clock',
    resumen:
      'In Configuration, choose how you read times: 12 or 24 hours, and the time zone of each city or one fixed zone for everything.',
    explicacion: [
      'Divoox works in many cities with different time zones, so every time in the panel can be shown the way you prefer. Open “Configuration” in the left menu, under System, and use the Time card.',
      'Time format: Automatic uses the 12-hour clock with AM and PM in the United States; you can also pick 12-hour or 24-hour. Time zone: Automatic shows each time in the zone of the order’s or ride’s city, so a late-night order in one city reads like the people there lived it. Fixed shows everything in the one zone you choose.',
      'When a time is not in your own zone, it says which one right next to it (for example “GMT-4”), so you never have to guess. The line under the choices shows how times look right now, and the Active cities card lists the time it is at this moment in every city where Divoox is on.',
      'The setting is yours: it is saved to your account and follows you to any computer, and it does not change what your teammates see.',
    ],
    capturas: [
      foto(
        'horario-formato',
        'en',
        'The Time card in Configuration with the time format options Automatic, 12-hour and 24-hour, the time zone options Automatic and Fixed, and the preview line.',
        'Time format and time zone options, with a live preview.',
      ),
      foto(
        'horario-ciudades',
        'en',
        'The Active cities card, with the current local time and the time zone of each city.',
        'The time it is right now in each active city.',
      ),
    ],
    preguntas: [
      'How do I change to a 24-hour clock?',
      'How do I see times in one fixed time zone?',
      'What time is it right now in each city?',
    ],
    pasos: [
      'Open “Configuration” in the left menu, under System.',
      'In Time format, choose Automatic, 12-hour or 24-hour.',
      'In Time zone, choose Automatic (the city of each order or ride) or Fixed, and pick the zone.',
      'Check the line that says how times look right now.',
      'Look at Active cities to see the current time in every city.',
      'Open any order or ride: the times follow your choice, and show the zone when it differs from yours.',
    ],
  },
  {
    id: 'add-team-members-permissions',
    titulo: 'Adding team members and permissions',
    resumen:
      'Invite a new person to the operations panel with a role template, a scope by city and service, and an optional expiry date, and see everything they did and viewed.',
    explicacion: [
      'Everyone who signs in to Divoox’s operations panel has exactly the access their job needs, no more. Open “Internal team” in the left menu. It has four tabs: People, Role templates, Log and My alerts. People lists everyone who can sign in, with their status (Active, Suspended or Invited), their templates, their scope, their last sign-in and when their access expires. Pending invitations are listed on top.',
      'Access is built from three things. First, role templates, which are ready-made sets of permissions: Monitor (watches live orders and rides, and cannot see photos or personal data), Support level 1 (tickets, order chat and delivery photos), Support level 2 (level 1, plus cancel, release a driver, approve a location and refund up to its limit, and it can reveal full phone numbers and emails), Identity verifier, Ride emergencies, Finance, Supervisor, Auditor (sees everything without changing anything) and Full access. You can give a person several templates and they add up. Second, the scope: the countries, cities and services where they work; leave it empty and they work everywhere. Third, an optional expiry date, after which their access ends by itself.',
      'To add someone, click “Add employee,” type their work email and full name, choose their templates, their scope and, if you want, the date their access expires. Write the reason, choose the language of the invitation and click “Send invitation.” They get a one-time invitation that expires in 7 days. They open it, confirm their name, create their own password and sign in. You never see or choose their password, and the link stops working the moment it is used.',
      'Nobody can give more than they have. You can only hand out permissions, cities, services and limits that your own access already includes. You cannot change your own access, and you cannot edit or suspend someone who has permissions you do not have. The owner of the account always keeps full access and cannot be suspended.',
      'Sensitive things are protected. Photos stay blurred until you click “View photo,” and phone numbers and emails stay partly hidden until you click “Show,” and only if your templates allow it. If they do not, the screen says “Your access doesn’t include delivery photos.” Every time someone views a photo or a personal detail, the Log records who, what, which order or person, and when. It never stores the photo or the detail itself, and it is kept for 90 days. You can filter the Log by what was viewed, by person and by dates, and export it as a CSV file.',
      'Click a person’s name to open their file. It shows their access, their effective permissions (each one says which template it comes from), what they did, what they viewed, and the changes made to their access. From the three-dot menu you can Suspend, Reactivate or Remove access; each asks for confirmation and a reason, which stays in the log with your name. Suspending or removing someone signs them out of every device immediately.',
    ],
    capturas: [
      foto(
        'equipo-lista',
        'en',
        'The Internal team screen with the tabs People, Role templates, Log and My alerts, the search box, the Add employee button, and two pending invitations with their template, scope and expiry.',
        'Internal team: the tabs, “Add employee” and the pending invitations.',
      ),
      foto(
        'equipo-agregar-plantillas',
        'en',
        'The Add employee form with the work email, the full name and the role templates Monitor, Support level 1, Support level 2, Identity verifier, Ride emergencies and Finance, with Support level 1 checked.',
        'Add employee: pick one or more role templates.',
      ),
      foto(
        'equipo-agregar-vence',
        'en',
        'The end of the Add employee form with the optional expiry date, the reason, the language of the invitation, and the Cancel and Send invitation buttons.',
        'Optional expiry date, reason, and “Send invitation.”',
      ),
      foto(
        'equipo-plantillas',
        'en',
        'The Role templates tab with the nine built-in templates: Monitor, Support level 1, Support level 2, Identity verifier, Ride emergencies, Finance, Supervisor, Auditor and Full access, each with its description and permissions.',
        'The nine role templates and what each one can do.',
      ),
      foto(
        'equipo-aceptar',
        'en',
        'The Join the Divoox team page: who invited you and when the invitation expires, your role, your email and name, and the two password boxes with the eye button.',
        'What the new person sees when they open their one-time invitation.',
      ),
      foto(
        'equipo-ficha-acceso',
        'en',
        'A team member’s file with their templates, scope, expiry and last sign-in, and the list of effective permissions, each one saying which template it comes from.',
        'A person’s file: their access and their effective permissions.',
      ),
      foto(
        'equipo-ficha-vio',
        'en',
        'The What they viewed and Changes to their access cards of a team member’s file, showing a delivery photo that was viewed and the invitation that added them.',
        'What they viewed, and the changes to their access.',
      ),
      foto(
        'equipo-foto',
        'en',
        'A case page where the delivery photo is replaced by a gray box that says Your access doesn’t include delivery photos, with the note that every view is logged and the photo is kept for 30 days.',
        'Without the permission, the photo does not open.',
      ),
      foto(
        'equipo-registro',
        'en',
        'The Log tab with the filters What to look at, Person, From and To, the Export CSV button, and two rows showing a full phone number and a delivery photo that were viewed.',
        'The Log: who viewed what, and when.',
      ),
    ],
    preguntas: [
      'How do I add a new person to the team?',
      'Which role template should I give to a new person?',
      'Can I limit someone to one city or one service?',
      'How do I give someone access for only a few days?',
      'How do I see who viewed a photo or a phone number?',
      'How do I suspend someone or remove their access?',
    ],
    pasos: [
      'Open “Internal team” in the left menu and click “Add employee.”',
      'Type the work email and the full name.',
      'Choose one or more role templates. Check the Role templates tab if you are not sure what each one does.',
      'Choose the scope: countries, cities and services. Leave everything unchecked to work everywhere.',
      'Optionally set an expiry date, write the reason and choose the language of the invitation.',
      'Click “Send invitation.” It is a one-time link and expires in 7 days; a pending invitation shows in the list.',
      'The new person opens the link, creates their password and signs in with the access you gave them.',
      'To review someone, click their name: their access, what they did, what they viewed and the changes to their access are in their file.',
      'To pause someone, use the three-dot menu: Suspend (you can Reactivate later) or Remove access. Write the reason and confirm.',
      'To audit who viewed photos or personal data, open the Log tab, choose “What was viewed,” filter by person or dates, and export the CSV if needed.',
    ],
    nota: 'If you cannot find the button to add or edit someone, your templates do not include managing the team. Ask a Supervisor or the account owner.',
  },
  {
    id: 'resolve-expired-card-authorization',
    titulo: 'Resolving an expired card authorization',
    resumen:
      'When a card authorization expires before delivery, the charge goes under review. From the order file you check the real payment status and close it without charging, with a note.',
    explicacion: [
      'Divoox places a hold on the customer’s card when they order and charges it when the order is delivered, as the big delivery apps do. Banks keep that hold for a limited time: usually 7 days for a payment the customer made, and 4 days and 18 hours for some Visa payments started by Divoox. If an order is delivered after that, the hold is gone and the charge can no longer be completed. The delivery then shows “under review,” and the money health check turns red until someone resolves it.',
      'Divoox warns before it happens. When an open order has had its card on hold for 96 hours, the team that receives money alerts gets one email, and the order’s timeline shows “Alert: the card authorization is about to expire.” Deliver it or cancel it before the hold runs out. If the email can’t be sent, Divoox tries again on the next hourly check.',
      'If it already expired, open the order file. A card titled “This delivery’s charge is under review” appears above the support actions. Click “Resolve expired authorization”: the panel checks the real status of the payment at that moment and shows the delivery amount, the amount that was authorized, when the hold had to be used, when it was released, the saved card (brand and last four digits only) and whether the customer gave permission for future charges when they paid.',
      'Today the way out is “Close without charging.” It ends the review without charging the customer: Divoox covers the amount, and the restaurant and the driver keep their share. It always asks for a note explaining why. Under “Charge again,” the card says it is turned off: charging the saved card is not available yet. If the customer should pay, talk to them before closing it.',
      'The decision stays in the order’s timeline with the name of whoever made it and the note. Above the dual-control limit, it waits in “Approvals” until someone else on the team signs it. Only people whose role includes “Resolve expired card authorizations” (Finance, Supervisor or Full access) see the button, and only for orders in their work area. What Divoox covered this way appears in Money, under “Charges under review,” by month and currency.',
    ],
    capturas: [
      foto(
        'autorizacion-estado',
        'en',
        'The card “This delivery’s charge is under review” in an order file from Novi: delivery amount $34.60, payment expired, the saved Visa card ending in 4242, Charge again marked as turned off, and Close without charging with its note box.',
        'The real status of the payment and the way out available today.',
      ),
      foto(
        'autorizacion-sin-cobro',
        'en',
        'Close without charging with its required note filled in, ready to confirm.',
        'Close it without charging and explain why in the note.',
      ),
      foto(
        'autorizacion-linea',
        'en',
        'The order timeline from Novi: order created, paid, the alert that the card authorization was about to expire, delivered, and “Support closed it without charging” with the name of the person who did it.',
        'The timeline keeps the alert and who resolved it.',
      ),
    ],
    preguntas: [
      'What do I do with a delivery under review because the card authorization expired?',
      'How long does a card authorization last?',
      'Can I charge the customer again without asking them?',
      'Why is Charge again turned off?',
      'Who covers the money if we close an order without charging?',
    ],
    pasos: [
      'Open the order from the alert email, from Live orders or from the search bar.',
      'Find the card “This delivery’s charge is under review” and click “Resolve expired authorization.”',
      'Read the status: if it says the authorization is still valid or already charged, it is not expired; follow what the card says instead.',
      'If the customer should pay, talk to them first. Charge again is turned off for now.',
      'Write a note that explains why and click “Close without charging.”',
      'If the panel says the decision is waiting for approval, another person with the second signature approves it in “Approvals.”',
      'Check the timeline: the decision appears with your name and the note, and the delivery is no longer under review.',
    ],
    nota: 'Prevention is better: when the alert arrives, deliver or cancel the order before the card hold runs out.',
  },
  {
    id: 'flagged-content',
    titulo: 'Reviewing reported messages and reviews',
    resumen:
      'The “Flagged content” inbox gathers what someone reported and what the word filter flagged. The support team reviews it within 24 hours and decides what to do.',
    explicacion: [
      'Each card shows the reported text, who wrote it, who reported it (or whether the filter flagged it), the reason, the note and how many times it was reported.',
      'The actions: “Hide” (no longer shown; nothing is deleted), “Publish again,” “Warn the author” (they get a reminder of the guidelines, without saying who reported) and “Dismiss.” Suspending the account lives inside the three dots and asks for confirmation; only people allowed to suspend accounts see it.',
      'Each team member sees the reports for their city and services.',
    ],
    capturas: [
      fotoModeracion(
        'computadora-bandeja',
        'en',
        'The Flagged content inbox with a review reported as spam and a chat message reported as harassment, each with Hide, Warn the author and Dismiss.',
        'The “Flagged content” inbox, with the text, the reason and the actions.',
      ),
    ],
    preguntas: ['What do I do with a reported message or review?'],
    pasos: [
      'Open “Flagged content” in the Operations menu and read the text, the reason and the note.',
      'Pick an action. All reports about that same content are closed together.',
    ],
  },
];

const es: Guia[] = [
  {
    id: 'search-orders-rides-people',
    titulo: 'Encontrar cualquier pedido, viaje o persona',
    resumen:
      'El buscador de arriba del panel de operaciones encuentra un pedido, un viaje, un cliente, un repartidor, un restaurante, un vehículo, un ticket o cualquier parte del panel desde la primera letra.',
    explicacion: [
      'El buscador está arriba en todas las pantallas del panel de operaciones de Divoox. Presiona «/» (o Ctrl+K, o ⌘K en Mac) desde cualquier lugar y escribe. No hay botón que apretar: los resultados salen mientras escribes, agrupados por tipo: Pedidos, Viajes, Clientes, Repartidores y conductores, Restaurantes y tiendas, Vehículos y Tickets. Las secciones del panel también aparecen, en «Ir a».',
      'Puedes escribir casi cualquier dato que la gente recuerda. El código corto del pedido, con o sin «#». El id completo. Un nombre o un apellido, sin preocuparte por mayúsculas ni acentos: «jose» encuentra «José», y basta el apellido o el segundo nombre para encontrar a la persona, aunque acabe de crear su cuenta y no haya confirmado su correo. Un teléfono: los últimos cuatro dígitos o el comienzo. Un correo. Una placa. Un código de repartidor como VE-ELV-000003. O un monto, con signo de dólar o decimales; los montos se buscan solo en los últimos 30 días y la pantalla lo dice.',
      'El código corto es el que te lee el cliente: los primeros cuatro caracteres del pedido. El panel muestra seis y escribe esos cuatro en negrita. No hace falta el código completo: desde el primer carácter el buscador ya sugiere todos los pedidos y viajes cuyo código empieza así. Escribe «7» y ves los que empiezan por 7; escribe «73» y la lista se afina al instante. Da igual mayúsculas o minúsculas, y el «#» es opcional.',
      'Cuando muchos comparten los primeros caracteres, salen primero los que siguen en curso, con los que están en problemas arriba, y después los cerrados, del más reciente al más viejo. El título del grupo dice cuántos hay en total (por ejemplo «Pedidos · 312»), y «Ver todos», al pie del grupo, abre Pedidos en curso con la misma búsqueda, donde puedes seguir cargando todas las coincidencias.',
      'Si no hay nada, el panel dice exactamente qué buscaste y te ayuda: cuando un código trae una letra que parece un número (una «O» en vez de un cero, una «l» en vez de un uno), pregunta «¿Quisiste decir #B4290C?» y con un clic lo busca.',
      'La búsqueda mira en todas partes, no solo lo que hay en pantalla: encuentra pedidos cerrados, pedidos que siguen esperando pago y pedidos de cualquier ciudad. Cada resultado muestra lo que coincidió, resaltado. Los teléfonos y los correos salen parcialmente tapados para todo el equipo (por ejemplo «+1 ••• ••• 4821»): reconoces a la persona sin exponer sus datos.',
      'El buscador también te lleva a cualquier parte del panel. Escribe lo que buscas con tus palabras, en español o en inglés, con o sin acentos: «kyc», «verificación», «papeles», «identidad», «cédula» o «licencia» llevan a Verificaciones y a Para aprobar; «saldo» o «recargas», a Saldo de conductores; «tarifas», a Viajes; «cupones», a Regalos Divoox; «tasa», a la tasa del bolívar; «equipo», a Equipo interno. Estas sugerencias salen primero, en «Ir a…», desde la primera letra, y al lado de cada una ves la palabra que la encontró. Solo ves las partes del panel que tu cuenta puede abrir.',
      'También encuentra lo que quieres hacer: «cargar saldo», «cambiar tarifas», «crear cupón» o «agregar empleado» te llevan directo a la pantalla donde se hace. Y «ayuda» abre esta ayuda del equipo.',
      'Las personas salen en cualquier estado, también recién registradas: un conductor que acaba de registrarse en la app Driver aparece por las primeras letras de su correo (sin escribir la «@»), por su nombre o por su teléfono. Cada cuenta dice su estado en palabras: «Sin verificar» (todavía no envió nada), «Papeles pendientes» (esperan revisión), «Aprobado», «No aprobado», «Suspendido», o «Correo sin confirmar» en un cliente. Debajo de un conductor, «Ver sus papeles» abre su verificación directo. El dueño de un comercio que se registró y todavía no terminó de cargarlo sale con «Registro sin terminar», y una empresa de Flex sale con su estado (activa o pausada).',
      'Si no hay resultados, el panel nunca te deja sin salida: en «Quizás buscabas:» te sugiere las partes del panel con una palabra parecida (un error como «verifcacion» igual encuentra Verificaciones) o, si no hay ninguna cerca, las secciones de cada día.',
    ],
    capturas: [
      foto(
        'buscador-letra',
        'es',
        'El buscador del panel de operaciones con solo la letra «f» escrita: el grupo Pedidos dice cuántos empiezan por F, muestra primero el que está en curso y después los entregados de El Vigía, y termina con «Ver los … en Pedidos en curso».',
        'Basta un carácter: los pedidos que empiezan por «f», el que está en curso primero, con el total y «Ver todos».',
      ),
      foto(
        'pedidos-por-codigo',
        'es',
        'Pedidos en curso abierto desde «Ver todos»: una línea dice cuántos pedidos y viajes empiezan por «F», y cada código lleva subrayada su primera letra.',
        '«Ver todos» abre Pedidos en curso con la misma búsqueda y todas las coincidencias, página tras página.',
      ),
      foto(
        'buscador',
        'es',
        'El buscador del panel de operaciones con «a7c» escrito: la lista muestra dos pedidos y dos viajes cuyos códigos empiezan así, cada uno con su estado, ciudad, monto y fecha.',
        'Al escribir «a7c» salen todos los pedidos y viajes que empiezan así, agrupados por tipo.',
      ),
      foto(
        'buscador-sugerencia',
        'es',
        'El buscador con «F17B2OC» escrito, con la letra O en lugar de un cero: el panel dice que no lo encontró y pregunta «¿Quisiste decir #F17B20C?».',
        '¿Una letra que parece un número? El panel sugiere el código bien escrito.',
      ),
    ],
    preguntas: [
      '¿Cómo encuentro un pedido solo con el código que me dio el cliente?',
      '¿Puedo buscar con solo el primer carácter del código?',
      '¿Cómo busco a un cliente por los últimos dígitos de su teléfono?',
      '¿Por qué un código corto muestra más de un pedido?',
      '¿Puedo encontrar un pedido cerrado o de otra ciudad?',
      '¿Cómo encuentro a un conductor recién registrado para ver sus papeles?',
      '¿Cómo llego a Verificaciones escribiendo «kyc»?',
    ],
    pasos: [
      'Haz clic en el buscador, o presiona «/» o Ctrl+K (⌘K en Mac) desde cualquier pantalla.',
      'Escribe lo que tengas: un código (aunque sea un carácter), un nombre, los últimos cuatro dígitos de un teléfono, una placa, un correo o un monto.',
      'Lee los grupos. Cada línea muestra el estado, la ciudad, el monto y la fecha; lo que coincidió va resaltado.',
      'Usa las flechas y Enter, o haz clic en una línea, para abrir su ficha. Escape cierra la lista.',
      'Si varios pedidos comparten el código, compara su fecha y su monto, o escribe más letras para acotar. Para ver todas las coincidencias, elige «Ver todos» al pie del grupo.',
      'Si el panel dice que no encontró nada, lee la sugerencia de «¿Quisiste decir…?» y haz clic en ella, o abre Pedidos en curso desde el mismo recuadro para buscar también en los cerrados.',
      'Para decirle qué buscas, empieza con una pista: «tel:» para un teléfono, «placa:» para una placa, «monto:» para un monto, «correo:» para un correo o «id:» para un id. En el panel estas pistas se escriben exactamente así.',
      'Si ves «Los montos se buscan solo en los últimos 30 días», el monto que escribiste es más viejo: busca por código o por nombre.',
      'Para ir a una parte del panel, escribe su nombre o cualquier palabra que la nombre («kyc», «saldo», «tarifas») y elígela en «Ir a…».',
      'Para ver los papeles de un conductor nuevo, escribe las primeras letras de su correo, su nombre o su teléfono, y elige «Ver sus papeles» debajo de su nombre.',
    ],
    nota: 'Buscar nunca cambia nada: mirar siempre es seguro.',
  },
  {
    id: 'monitor-live-orders-rides',
    titulo: 'Vigilar pedidos y viajes en curso',
    resumen:
      'Pedidos en curso junta comida, tiendas, viajes en auto, viajes en moto y envíos en una sola lista, con un semáforo que muestra primero lo que está en problemas.',
    explicacion: [
      'Abre «Pedidos en curso» en el menú de la izquierda. Las pestañas de arriba separan la lista por servicio: Todos, Comida, Tiendas, Viajes en auto, Viajes en moto y Envíos (la pestaña de Envíos aparece solo cuando hay alguno). Junto a cada pestaña ves cuántos están vivos y, en una insignia roja, cuántos están en problemas.',
      'Debajo de las pestañas eliges la ciudad, el estado y el orden. Vivos muestra lo que está pasando ahora, incluidos los pedidos que esperan pago. Cerrados muestra lo terminado. Todos muestra ambos. El orden por defecto, «Lo que necesita atención primero», pone arriba lo que está en problemas. La lista se actualiza sola cada 15 segundos.',
      'Cada línea trae el ícono del servicio, el código, para quién es, la ciudad, el repartidor, la hora y un semáforo. Verde es a tiempo. Amarillo es atrasándose. Rojo es en problemas, y la línea dice por qué en palabras normales: «la cocina pasó el tiempo prometido», «emergencia abierta». En los viajes, buscar conductor pasa a amarillo a los 5 minutos y a rojo a los 8; una emergencia abierta siempre es roja.',
      'Haz clic en una línea para abrir su ficha (mira «Leer la ficha de un pedido o un viaje»). Cuando hay más para mostrar, haz clic en «Cargar más» al final: nada se salta ni se repite.',
      'El panel recuerda tus filtros. La ciudad, el estado, el orden y la pestaña que dejaste están ahí cuando vuelves, en cualquier computadora, porque pertenecen a tu cuenta. Una línea discreta dice «Mostrando tus filtros guardados», con «Restablecer» para borrarlos. El texto que escribes en una casilla de búsqueda nunca se guarda.',
    ],
    capturas: [
      foto(
        'pestanas',
        'es',
        'La pantalla Pedidos en curso con las pestañas Todos, Comida, Tiendas, Viajes en auto, Viajes en moto y Envíos, los filtros de ciudad, estado y orden, y una línea con su semáforo.',
        'Pestañas por servicio, filtros y el semáforo en cada línea.',
      ),
      foto(
        'pestanas-moto',
        'es',
        'Una pestaña de servicio sin nada vivo: el contador marca cero y la lista dice que no hay nada con estos filtros.',
        'Cuando una pestaña no tiene nada vivo, la pantalla lo dice en vez de quedar en blanco.',
      ),
    ],
    preguntas: [
      '¿Cómo veo solo los viajes en moto que están vivos?',
      '¿Cómo veo qué pedidos están en problemas?',
      '¿Dónde veo los pedidos que ya están cerrados?',
      '¿Cómo borro los filtros que el panel recordó?',
    ],
    pasos: [
      'Abre «Pedidos en curso» en el menú de la izquierda.',
      'Haz clic en una pestaña de servicio: Todos, Comida, Tiendas, Viajes en auto, Viajes en moto o Envíos. El número rojo es lo que está en problemas.',
      'Elige la ciudad y haz clic en Vivos, Cerrados o Todos.',
      'Deja el orden en «Lo que necesita atención primero», o cámbialo.',
      'Lee el semáforo de cada línea: verde a tiempo, amarillo atrasándose, rojo en problemas, con el motivo al lado.',
      'Haz clic en una línea para abrir su ficha. Al final de la lista, haz clic en «Cargar más» para seguir.',
      'Para empezar de cero, haz clic en «Restablecer» en la línea que dice «Mostrando tus filtros guardados».',
    ],
  },
  {
    id: 'read-order-ride-file',
    titulo: 'Leer la ficha de un pedido o un viaje',
    resumen:
      'Cada pedido y cada viaje tiene una ficha con el tiempo real de cada paso contra lo previsto, una línea de tiempo, dónde se compró y dónde se entregó, y el cierre.',
    explicacion: [
      'La tarjeta Tiempos calcula por ti cuánto tomó de verdad cada paso y lo compara con lo previsto. Verde es a tiempo (medio minuto de más sigue siendo a tiempo). Rojo es que se pasó, con los minutos. Un paso que sigue corriendo dice «En curso» con lo que lleva, y no se marca como tarde hasta que se cierra. Un paso que quedó abierto sin ningún movimiento por más de 12 horas dice «Sin cerrar», en gris, con lo que hay que revisar. Gris significa que falta el dato, y dice cuál: los pedidos viejos y las asignaciones hechas por soporte no tienen todos los tiempos.',
      'Mientras el pedido o el viaje está en marcha, la tarjeta En vivo de arriba muestra dónde va el repartidor en un mapa que se mueve solo, la ruta y en qué va, en palabras: en camino al restaurante, esperando en el restaurante, llevando el pedido (o en camino a la recogida, esperando al pasajero, en viaje al destino). También da la hora de llegada calculada con el tráfico del momento, por ejemplo «Llega a las 3:28 p. m. · faltan 9 min · 3,2 km», en la hora de la ciudad. Si el repartidor lleva más de 3 minutos sin moverse lejos del restaurante, de la recogida y del destino, o el celular dejó de mandar su ubicación, lo dice en rojo, y la misma marca sale en el pedido dentro de Pedidos en curso. Esta tarjeta solo la ve quien tiene permiso para ver ubicaciones en vivo, y desaparece cuando el pedido o el viaje termina.',
      'En un pedido de comida o de tienda los pasos son: preparación, ida del repartidor al restaurante, espera en el restaurante, recorrido de la entrega y el total desde el pago hasta la entrega. En un viaje son: espera de conductor, llegada del conductor, espera del pasajero (la espera gratis que incluye la tarifa), el recorrido y el total.',
      'Más abajo, la Línea de tiempo lista cada hecho con su hora, quién lo hizo y cuánto después del anterior. Las acciones automáticas del Manager salen tenues y se pueden ocultar con «Ocultar lo que hizo el Manager». Los reclamos aparecen en la misma línea, para ver qué pasó después de la entrega.',
      '«Dónde compró» y «Dónde entregó» van lado a lado, con la dirección, la foto, cuándo se tomó, quién la confirmó, a cuántos metros del punto exacto, cómo se entregó y la nota del repartidor. Las fotos salen borrosas hasta que haces clic en «Ver foto». Se guardan mientras haya un reclamo abierto y se borran solas a los 30 días; la tarjeta lo dice. Una entrega en mano no tiene foto: es normal, y la tarjeta muestra cómo se entregó. La foto que un cliente toma de la puerta de su casa nunca se muestra aquí.',
      'La ficha termina con el cierre (quién entregó, cuándo y el pago), las personas con enlaces a sus fichas, el detalle del pedido, las acciones de soporte y los reclamos enlazados. La ficha del viaje es parecida: además muestra el vehículo y la placa, y si el viaje empezó con el PIN de recogida correcto y cuántos intentos fallidos hubo; el número nunca se muestra. Los viajes de personas no llevan fotos del pasajero. Los envíos traen la foto del paquete al recogerlo, y una emergencia aparece en la línea de tiempo, en su propia tarjeta con su estado y como un reclamo urgente.',
    ],
    capturas: [
      foto(
        'pedido-tiempos',
        'es',
        'El encabezado de la ficha del pedido y la tarjeta Tiempos: preparación, ida del repartidor, espera, recorrido de la entrega y total, cada uno con lo que tomó, lo previsto y un resultado en verde o rojo.',
        'La tarjeta Tiempos: lo real contra lo previsto, en verde y rojo.',
      ),
      foto(
        'pedido-linea',
        'es',
        'La línea de tiempo del pedido: cada hecho con su hora, quién lo hizo y cuánto después del anterior, desde que se creó hasta el reclamo que se abrió.',
        'La línea de tiempo, una línea por hecho.',
      ),
      foto(
        'pedido-fotos',
        'es',
        'Dónde compró y dónde entregó: la foto de recogida está abierta, la foto de entrega está borrosa con el botón Ver foto, y abajo están las distancias en metros.',
        'Foto de recogida abierta y foto de entrega borrosa hasta hacer clic en «Ver foto».',
      ),
      foto(
        'pedido-cierre',
        'es',
        'El cierre del pedido, el cobro, las personas, el detalle del pedido, las acciones de soporte y los reclamos enlazados al pedido.',
        'El cierre, las personas y los reclamos enlazados.',
      ),
      foto(
        'viaje-tiempos',
        'es',
        'El encabezado de la ficha de un viaje terminado y la tarjeta Tiempos: espera de conductor, llegada, espera del pasajero, recorrido y total.',
        'La ficha de un viaje: la misma tarjeta Tiempos, con los pasos de un viaje.',
      ),
      foto(
        'viaje-detalle',
        'es',
        'Detalle del viaje: recogida y destino, las personas, el vehículo y la placa, el resultado del PIN de recogida, el importe, las emergencias y los reclamos.',
        'Detalle del viaje: sin fotos del pasajero, y el resultado del PIN sin el número.',
      ),
    ],
    preguntas: [
      '¿Cómo sé si un pedido tardó más de lo previsto?',
      '¿Dónde veo la foto de la entrega?',
      '¿Por qué una foto sale borrosa?',
      '¿Por qué una entrega en mano no tiene foto?',
      '¿Cuánto tiempo se guardan las fotos?',
    ],
    pasos: [
      'Abre la ficha desde Pedidos en curso o desde el buscador.',
      'Empieza por la tarjeta Tiempos: verde a tiempo, rojo se pasó, gris falta el dato (dice cuál).',
      'Lee la Línea de tiempo de arriba abajo. Haz clic en «Ocultar lo que hizo el Manager» si solo quieres lo que hizo la gente.',
      'Compara «Dónde compró» con «Dónde entregó»: dirección, hora, quién confirmó y a cuántos metros del punto exacto.',
      'Haz clic en «Ver foto» solo cuando la necesites. Si dice que la foto se borró, pasaron 30 días sin reclamo abierto.',
      'Mira el cierre para saber quién entregó y cómo se pagó, y los reclamos del final para lo que se reportó.',
      'En un viaje, mira primero la tarjeta Emergencias, y luego el vehículo, la placa y el resultado del PIN de recogida.',
    ],
    nota: 'Mirar una ficha nunca la cambia. Las acciones de soporte del final son los únicos botones que hacen algo.',
  },
  {
    id: 'link-support-ticket',
    titulo: 'Enlazar un ticket de soporte a un pedido o un viaje',
    resumen:
      'Abre un reclamo desde la ficha de un viaje o desde la bandeja de Tickets, enlazado al pedido o al viaje por su código, y filtra la bandeja por servicio.',
    explicacion: [
      'Un reclamo enlazado a un pedido o a un viaje deja todo junto: el ticket dice de qué pedido trata, y la ficha del pedido o del viaje lista sus reclamos al final. Cualquiera del equipo que abra la ficha ve lo que se reportó y cómo se respondió.',
      'Puedes abrir un reclamo desde dos lugares. En la ficha de un viaje, «Abrir un reclamo» ya trae el código puesto. En la bandeja de Tickets, «Abrir un reclamo» pide el código del pedido o del viaje: las letras del código (por ejemplo 407F2F) o el id entero.',
      'El reclamo usa como contacto al cliente de ese pedido o viaje. Abrirlo no envía ningún correo, y queda a tu cargo en la bandeja. Lo que escribes en «Qué pasó» queda como primer mensaje del ticket, y el cliente lo ve si le respondes.',
      'Si las letras que escribiste coinciden con más de un pedido o viaje, el panel te pide escribir más letras. Si no coincide ninguno, lo dice. Lo que escribes se guarda mientras lo haces, así que cerrar la ventana no lo pierde.',
      'En la bandeja de Tickets cada línea muestra el ícono del servicio (comida, tiendas, auto, moto, envíos) y puedes filtrar por servicio con la lista Servicio. El filtro se recuerda para tu cuenta. Las pestañas Abiertos, Respondidos, Cerrados, Todos, Míos y Sin asignar funcionan como siempre.',
    ],
    capturas: [
      foto(
        'tickets',
        'es',
        'La bandeja de Tickets con las pestañas, el filtro Servicio, el botón Abrir un reclamo, y tickets con el ícono de su servicio.',
        'La bandeja de Tickets con el filtro Servicio y «Abrir un reclamo».',
      ),
      foto(
        'viaje-detalle',
        'es',
        'La parte de abajo de la ficha de un viaje con la tarjeta Reclamos y tickets y su botón Abrir un reclamo.',
        'Desde la ficha de un viaje, «Abrir un reclamo» ya trae el código.',
      ),
    ],
    preguntas: [
      '¿Cómo abro un reclamo para un pedido o viaje en particular?',
      '¿Cómo veo todos los reclamos de los viajes en moto?',
      '¿Qué pasa si el código coincide con más de un pedido?',
    ],
    pasos: [
      'En la ficha de un viaje, haz clic en «Abrir un reclamo» en la tarjeta Reclamos y tickets. En la bandeja de Tickets, haz clic en «Abrir un reclamo» y escribe el código del pedido o del viaje.',
      'Escribe el asunto y, en «Qué pasó», el primer mensaje del ticket.',
      'Elige la prioridad: Urgente, Alta, Normal o Baja.',
      'Haz clic en «Abrir el reclamo». Queda a tu cargo.',
      'Si te pide más letras, escribe más del código. Si dice que no lo encontró, revisa el código en el buscador.',
      'Para revisar reclamos por servicio, abre Tickets y elige el servicio en la lista Servicio.',
      'Abre el ticket para saltar a su pedido o viaje; la ficha lista el reclamo al final.',
    ],
  },
  {
    id: 'time-zone-clock',
    titulo: 'Zona horaria y reloj de 12 o 24 horas',
    resumen:
      'En Configuración, elige cómo lees las horas: 12 o 24 horas, y la zona horaria de cada ciudad o una sola zona fija para todo.',
    explicacion: [
      'Divoox trabaja en muchas ciudades con zonas horarias distintas, así que cada hora del panel se puede mostrar como prefieras. Abre «Configuración» en el menú de la izquierda, en Sistema, y usa la tarjeta Horario.',
      'Formato de hora: Automático usa el reloj de 12 horas con a. m. y p. m. en Estados Unidos; también puedes elegir 12 horas o 24 horas. Zona horaria: Automática muestra cada hora en la zona de la ciudad del pedido o del viaje, para que un pedido de madrugada se lea como lo vivió la gente de allá. Fija muestra todo en la única zona que elijas.',
      'Cuando una hora no está en tu propia zona, dice cuál justo al lado (por ejemplo «GMT-4»), para que nunca tengas que adivinar. La línea debajo de las opciones muestra cómo se ven las horas ahora mismo, y la tarjeta Ciudades activas lista la hora que es en este momento en cada ciudad donde Divoox está encendido.',
      'El ajuste es tuyo: se guarda en tu cuenta y te sigue a cualquier computadora, y no cambia lo que ven tus compañeros.',
    ],
    capturas: [
      foto(
        'horario-formato',
        'es',
        'La tarjeta Horario en Configuración con las opciones de formato de hora Automático, 12 horas y 24 horas, las opciones de zona Automática y Fija, y la línea de vista previa.',
        'Opciones de formato y de zona horaria, con vista previa en vivo.',
      ),
      foto(
        'horario-ciudades',
        'es',
        'La tarjeta Ciudades activas, con la hora local de ahora y la zona horaria de cada ciudad.',
        'La hora que es ahora mismo en cada ciudad activa.',
      ),
    ],
    preguntas: [
      '¿Cómo cambio a un reloj de 24 horas?',
      '¿Cómo veo las horas en una sola zona horaria fija?',
      '¿Qué hora es ahora mismo en cada ciudad?',
    ],
    pasos: [
      'Abre «Configuración» en el menú de la izquierda, en Sistema.',
      'En Formato de hora, elige Automático, 12 horas o 24 horas.',
      'En Zona horaria, elige Automática (la ciudad de cada pedido o viaje) o Fija, y escoge la zona.',
      'Revisa la línea que dice cómo se ven las horas ahora mismo.',
      'Mira Ciudades activas para ver la hora actual en cada ciudad.',
      'Abre cualquier pedido o viaje: las horas siguen tu elección, y muestran la zona cuando difiere de la tuya.',
    ],
  },
  {
    id: 'add-team-members-permissions',
    titulo: 'Agregar personas al equipo y sus permisos',
    resumen:
      'Invita a una persona nueva al panel de operaciones con una plantilla de puesto, un alcance por ciudad y servicio y una fecha de vencimiento opcional, y mira todo lo que hizo y lo que vio.',
    explicacion: [
      'Cada persona que entra al panel de operaciones de Divoox tiene exactamente el acceso que necesita su trabajo, ni más ni menos. Abre «Equipo interno» en el menú de la izquierda. Tiene cuatro pestañas: Personas, Plantillas de puesto, Registro y Mis avisos. Personas lista a todos los que pueden entrar, con su estado (Activo, Suspendido o Invitado), sus plantillas, su alcance, su última entrada y cuándo vence su acceso. Las invitaciones pendientes salen arriba.',
      'El acceso se arma con tres cosas. Primero, las plantillas de puesto, que son conjuntos de permisos ya listos: Monitor (vigila los pedidos y viajes en curso, y no ve fotos ni datos personales), Soporte nivel 1 (tickets, chat de los pedidos y fotos de entrega), Soporte nivel 2 (lo de nivel 1, más cancelar, soltar repartidor, autorizar una ubicación y devolver hasta su tope, y puede ver teléfonos y correos completos), Verificador de identidad, Emergencias de viaje, Finanzas, Supervisor, Auditor (mira todo sin cambiar nada) y Total. A una persona le puedes dar varias plantillas y se suman. Segundo, el alcance: los países, las ciudades y los servicios donde trabaja; si lo dejas vacío, trabaja en todos. Tercero, una fecha de vencimiento opcional, después de la cual su acceso termina solo.',
      'Para agregar a alguien, haz clic en «Agregar empleado», escribe su correo de trabajo y su nombre completo, elige sus plantillas, su alcance y, si quieres, la fecha en que vence su acceso. Escribe el motivo, elige el idioma de la invitación y haz clic en «Mandar invitación». La persona recibe una invitación de un solo uso que vence en 7 días. La abre, confirma su nombre, crea su propia contraseña y entra. Tú nunca ves ni eliges su contraseña, y el enlace deja de servir en el momento en que se usa.',
      'Nadie da más de lo que tiene. Solo puedes repartir permisos, ciudades, servicios y topes que tu propio acceso ya incluye. No puedes cambiar tu propio acceso, ni editar o suspender a alguien con permisos que tú no tienes. El dueño de la cuenta siempre conserva el acceso total y no se puede suspender.',
      'Lo delicado está protegido. Las fotos salen borrosas hasta que haces clic en «Ver foto», y los teléfonos y correos salen parcialmente tapados hasta que haces clic en «Ver dato», y solo si tus plantillas lo permiten. Si no lo permiten, la pantalla dice «Tu acceso no incluye ver fotos de entrega». Cada vez que alguien ve una foto o un dato personal, el Registro anota quién, qué, de qué pedido o persona y cuándo. Nunca guarda la foto ni el dato, y se conserva 90 días. Puedes filtrar el Registro por lo que se vio, por persona y por fechas, y exportarlo como archivo CSV.',
      'Haz clic en el nombre de una persona para abrir su ficha. Muestra su acceso, sus permisos efectivos (cada uno dice de qué plantilla viene), lo que hizo, lo que vio y los cambios de su acceso. En el menú de tres puntos puedes Suspender, Reactivar o Quitar acceso; cada uno pide confirmación y un motivo, que queda en el registro con tu nombre. Suspender o quitar el acceso a alguien lo saca de todos sus aparatos al instante.',
    ],
    capturas: [
      foto(
        'equipo-lista',
        'es',
        'La pantalla Equipo interno con las pestañas Personas, Plantillas de puesto, Registro y Mis avisos, el botón Agregar empleado, las invitaciones pendientes y la lista de personas con su estado, plantilla, alcance y vencimiento.',
        'Equipo interno: las pestañas, «Agregar empleado» y la lista de personas.',
      ),
      foto(
        'equipo-agregar-plantillas',
        'es',
        'El formulario Agregar empleado con el correo de trabajo, el nombre completo y las plantillas de puesto Monitor, Soporte nivel 1, Soporte nivel 2, Verificador de identidad, Emergencias de viaje y Finanzas, con Soporte nivel 1 marcada.',
        'Agregar empleado: elige una o más plantillas de puesto.',
      ),
      foto(
        'equipo-agregar-alcance',
        'es',
        'La parte de abajo del formulario Agregar empleado con el alcance por países, ciudades y servicios, la fecha de vencimiento opcional, el motivo, el idioma de la invitación y el botón Mandar invitación.',
        'Alcance por ciudad y servicio, vencimiento opcional y «Mandar invitación».',
      ),
      foto(
        'equipo-plantillas',
        'es',
        'La pestaña Plantillas de puesto con las nueve plantillas de fábrica: Monitor, Soporte nivel 1, Soporte nivel 2, Verificador de identidad, Emergencias de viaje, Finanzas, Supervisor, Auditor y Total, cada una con su descripción y sus permisos.',
        'Las nueve plantillas de puesto y lo que puede hacer cada una.',
      ),
      foto(
        'equipo-aceptar',
        'es',
        'La página Únete al equipo de Divoox: quién te invitó y cuándo vence la invitación, tu puesto, tu correo y tu nombre, y las dos casillas de contraseña con el botón del ojito.',
        'Lo que ve la persona nueva cuando abre su invitación de un solo uso.',
      ),
      foto(
        'equipo-ficha-acceso',
        'es',
        'La ficha de una persona del equipo con sus plantillas, alcance, vencimiento y última entrada, y la lista de permisos efectivos, cada uno con la plantilla de la que viene.',
        'La ficha de una persona: su acceso y sus permisos efectivos.',
      ),
      foto(
        'equipo-ficha-vio',
        'es',
        'Las tarjetas Lo que vio y Cambios de su acceso de la ficha de una persona: todavía nada visto, y la invitación con la que entró al equipo.',
        'Lo que vio y los cambios de su acceso.',
      ),
      foto(
        'equipo-foto',
        'es',
        'Una página de caso donde la foto de entrega se reemplaza por un recuadro gris que dice Tu acceso no incluye ver fotos de entrega, con la nota de que cada vista queda registrada y la foto se guarda 30 días.',
        'Sin el permiso, la foto no se abre.',
      ),
      foto(
        'equipo-registro',
        'es',
        'La pestaña Registro con los filtros Qué mirar, Persona, Desde y Hasta, el botón Exportar CSV, y dos filas con un teléfono completo y una foto de entrega que se vieron.',
        'El Registro: quién vio qué, y cuándo.',
      ),
    ],
    preguntas: [
      '¿Cómo agrego a una persona nueva al equipo?',
      '¿Qué plantilla de puesto le doy a una persona nueva?',
      '¿Puedo limitar a alguien a una ciudad o a un servicio?',
      '¿Cómo le doy acceso a alguien por unos pocos días?',
      '¿Cómo veo quién vio una foto o un teléfono?',
      '¿Cómo suspendo a alguien o le quito el acceso?',
    ],
    pasos: [
      'Abre «Equipo interno» en el menú de la izquierda y haz clic en «Agregar empleado».',
      'Escribe el correo de trabajo y el nombre completo.',
      'Elige una o más plantillas de puesto. Mira la pestaña Plantillas de puesto si no estás seguro de lo que hace cada una.',
      'Elige el alcance: países, ciudades y servicios. Deja todo sin marcar para que trabaje en todos.',
      'Si quieres, pon una fecha de vencimiento, escribe el motivo y elige el idioma de la invitación.',
      'Haz clic en «Mandar invitación». Es un enlace de un solo uso que vence en 7 días; la invitación pendiente sale en la lista.',
      'La persona nueva abre el enlace, crea su contraseña y entra con el acceso que le diste.',
      'Para revisar a alguien, haz clic en su nombre: su acceso, lo que hizo, lo que vio y los cambios de su acceso están en su ficha.',
      'Para pausar a alguien, usa el menú de tres puntos: Suspender (después puedes Reactivar) o Quitar acceso. Escribe el motivo y confirma.',
      'Para auditar quién vio fotos o datos personales, abre la pestaña Registro, elige «Lo que se vio», filtra por persona o fechas y exporta el CSV si hace falta.',
    ],
    nota: 'Si no encuentras el botón para agregar o editar a alguien, tus plantillas no incluyen manejar el equipo. Pídeselo a un Supervisor o al dueño de la cuenta.',
  },
  {
    id: 'resolve-expired-card-authorization',
    titulo: 'Resolver una autorización de tarjeta vencida',
    resumen:
      'Cuando la autorización de la tarjeta vence antes de la entrega, el cobro queda en revisión. Desde la ficha del pedido ves el estado real del pago y lo cierras sin cobro, con una nota.',
    explicacion: [
      'Divoox retiene el monto en la tarjeta del cliente cuando pide y lo cobra cuando el pedido se entrega, como las grandes apps de reparto. Los bancos guardan esa retención por un tiempo limitado: normalmente 7 días en un pago que hizo el cliente, y 4 días y 18 horas en algunos pagos con Visa que inicia Divoox. Si un pedido se entrega después, la retención ya no está y el cobro no se puede completar. La entrega queda «en revisión» y el control de salud del dinero se pone en rojo hasta que alguien la resuelve.',
      'Divoox avisa antes de que pase. Cuando un pedido abierto lleva 96 horas con la tarjeta retenida, el equipo que recibe los avisos de dinero recibe un solo correo, y la línea de tiempo del pedido muestra «Aviso: la autorización de la tarjeta está por vencer». Entrégalo o cancélalo antes de que se acabe la retención. Si el correo no sale, Divoox lo vuelve a intentar en la revisión de la hora siguiente.',
      'Si ya venció, abre la ficha del pedido. Arriba de las acciones de soporte aparece una tarjeta titulada «El cobro de esta entrega quedó en revisión». Haz clic en «Resolver autorización vencida»: el panel consulta en ese momento el estado real del pago y muestra el monto de la entrega, lo que se autorizó, hasta cuándo había que cobrarlo, cuándo se soltó, la tarjeta guardada (solo la marca y los últimos cuatro números) y si el cliente dio permiso para cobros futuros cuando pagó.',
      'Hoy la salida es «Cerrar sin cobro». Termina la revisión sin cobrarle al cliente: Divoox asume el monto, y el restaurante y el repartidor conservan lo suyo. Siempre pide una nota que explique el motivo. En «Volver a cobrar», la tarjeta dice que está apagado: cobrar la tarjeta guardada todavía no está disponible. Si el cliente debe pagar, habla con él antes de cerrarlo.',
      'La decisión queda en la línea de tiempo del pedido con el nombre de quien la tomó y la nota. Por encima del límite del control dual, espera en «Para aprobar» hasta que otra persona del equipo la firme. Solo ven el botón las personas cuyo puesto incluye «Resolver autorizaciones de tarjeta vencidas» (Finanzas, Supervisor o Total), y solo en los pedidos de su zona de trabajo. Lo que Divoox asumió así aparece en Dinero, dentro de «Cobros en revisión», por mes y moneda.',
    ],
    capturas: [
      foto(
        'autorizacion-estado',
        'es',
        'La tarjeta «El cobro de esta entrega quedó en revisión» en la ficha de un pedido de Miami: monto de la entrega $34.60, pago vencido, la Visa guardada terminada en 4242, Volver a cobrar marcado como apagado, y Cerrar sin cobro con su casilla de nota.',
        'El estado real del pago y la salida que hay hoy.',
      ),
      foto(
        'autorizacion-sin-cobro',
        'es',
        'Cerrar sin cobro con su nota obligatoria escrita, listo para confirmar.',
        'Ciérralo sin cobro y explica el motivo en la nota.',
      ),
      foto(
        'autorizacion-linea',
        'es',
        'La línea de tiempo de un pedido de Miami: pedido creado, pagado, el aviso de que la autorización estaba por vencer, entregado y «Soporte lo cerró sin cobro» con el nombre de quien lo hizo.',
        'La línea de tiempo guarda el aviso y quién lo resolvió.',
      ),
    ],
    preguntas: [
      '¿Qué hago con una entrega en revisión porque venció la autorización de la tarjeta?',
      '¿Cuánto dura la autorización de una tarjeta?',
      '¿Puedo volver a cobrarle al cliente sin preguntarle?',
      '¿Por qué está apagado Volver a cobrar?',
      '¿Quién pone el dinero si cerramos un pedido sin cobro?',
    ],
    pasos: [
      'Abre el pedido desde el correo de aviso, desde Pedidos en curso o desde el buscador.',
      'Busca la tarjeta «El cobro de esta entrega quedó en revisión» y haz clic en «Resolver autorización vencida».',
      'Lee el estado: si dice que la autorización sigue vigente o que ya está cobrado, no venció; sigue lo que indica la tarjeta.',
      'Si el cliente debe pagar, habla primero con él. Volver a cobrar está apagado por ahora.',
      'Escribe una nota con el motivo y haz clic en «Cerrar sin cobro».',
      'Si el panel dice que la decisión espera aprobación, otra persona con segunda firma la aprueba en «Para aprobar».',
      'Revisa la línea de tiempo: la decisión aparece con tu nombre y la nota, y la entrega ya no está en revisión.',
    ],
    nota: 'Mejor prevenir: cuando llegue el aviso, entrega o cancela el pedido antes de que se acabe la retención de la tarjeta.',
  },
  {
    id: 'flagged-content',
    titulo: 'Revisar los reportes de mensajes y reseñas',
    resumen:
      'La bandeja «Reportes» junta lo que alguien reportó y lo que marcó el filtro de palabras. El equipo de soporte lo revisa en menos de 24 horas y decide qué hacer.',
    explicacion: [
      'Cada tarjeta muestra el texto reportado, quién lo escribió, quién lo reportó (o si lo marcó el filtro), el motivo, la nota y cuántas veces se reportó.',
      'Las acciones: «Ocultar» (deja de verse; no se borra), «Volver a publicar», «Avisar a quien lo escribió» (le llega un recordatorio de las normas, sin decir quién reportó) y «Descartar». Suspender la cuenta vive dentro de los tres puntos y pide confirmación; solo lo ve quien tiene el permiso de suspender cuentas.',
      'Cada persona del equipo ve los reportes de su ciudad y de sus servicios.',
    ],
    capturas: [
      fotoModeracion(
        'computadora-bandeja',
        'es',
        'La bandeja Reportes con una reseña reportada como spam y un mensaje del chat reportado como acoso, cada uno con Ocultar, Avisar a quien lo escribió y Descartar.',
        'La bandeja «Reportes», con su texto, el motivo y las acciones.',
      ),
    ],
    preguntas: ['¿Qué hago con un mensaje o una reseña reportada?'],
    pasos: [
      'Abre «Reportes» en el menú de Operación y lee el texto, el motivo y la nota.',
      'Elige la acción. Todos los reportes sobre ese mismo contenido se cierran juntos.',
    ],
  },
];

// ───────────────────────── Cambiar la ciudad de un conductor (C-CAMBIAR-CIUDAD-ADMIN, 18 nov 2026) ─────────────────────────

const capCiudad = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({ archivo: `ciudad-${nombre}-${idioma}.webp`, alt, pie });

const cambiarCiudad: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'change-driver-city',
    titulo: 'Cambiar la ciudad de un conductor',
    resumen:
      'Desde la ficha del conductor, en sus tres puntos, «Cambiar ciudad» lo pasa a otra ciudad activa con un motivo. Si cambia de país, se confirma aparte. Todo queda en el registro.',
    explicacion: [
      'Úsalo cuando un conductor quedó en la ciudad equivocada (por ejemplo, se registró sin ubicación y quedó en Miami) o se mudó. Divoox lo cambia en todos los lugares a la vez y de una sola vez (si algo falla, no cambia nada): su cuenta, su ficha de conductor y su código, que pasa al de la ciudad nueva (por ejemplo, de US-MIA-000015 a VE-ELV-000003). El código viejo queda en el registro y se sigue encontrando en el buscador; en la ficha aparece como «Antes: …».',
      'Desde el 21 nov 2026 un conductor ya no queda en Miami por registrarse sin ubicación: sin ciudad real no recibe código, y lo recibe (con su plazo de papeles, si su país lo tiene) en cuanto se sabe su ciudad, por su invitación, por la que elige o por su ubicación al abrir Driver o conectarse. Un código que quedó con el país equivocado se corrige solo. En la ficha, «En línea» solo sale si de verdad puede recibir viajes; conectado sin nada aprobado ni plazo abierto dice «Conectado, todavía no recibe viajes». Su celular se muestra siempre con el código de su país.',
      'No se puede con el conductor conectado ni con un viaje o una entrega en curso: el panel lo dice y no cambia nada. Pídele que se desconecte o espera a que termine.',
      'Si la ciudad nueva es de otro país, el panel lo dice y pide marcar «Confirmo el cambio de país»: su moneda, su forma de cobro y los papeles que se le piden pasan a ser los del país nuevo. No se permite mientras le quede dinero del país viejo (saldo, cuenta de cobro, regalos por cobrar, recargas o retiros pendientes) ni si tiene papeles, vehículo o servicios del país viejo, que no valen en el nuevo: el equipo los revisa primero. Es lo más seguro para el conductor y para Divoox.',
      'Después del cambio, la app ya no le mueve la ciudad por su ubicación: la eligió el equipo. Solo ven la opción las personas con permiso sobre conductores, y solo hacia ciudades de su zona de trabajo.',
    ],
    capturas: [
      capCiudad(
        'formulario',
        'es',
        'La ficha de un conductor con el formulario Cambiar ciudad abierto: Ciudad nueva El Vigía (VE), el motivo escrito y los botones Cambiar ciudad y Cancelar.',
        'Elige la ciudad, escribe el motivo y confirma.',
      ),
      capCiudad(
        'confirmar',
        'es',
        'El paso de confirmación de Cambiar ciudad: «Vas a pasar a este conductor a El Vigía», el aviso del cambio de país de US a VE y la casilla Confirmo el cambio de país marcada.',
        'Revisa el cambio y, si es de país, márcalo.',
      ),
      capCiudad(
        'listo',
        'es',
        'La ficha del conductor después del cambio: su código nuevo VE-ELV, el aviso «Listo. Su código nuevo es…» y la línea Desconectado · El Vigía.',
        'El cambio se ve al momento, con su código nuevo.',
      ),
    ],
    preguntas: [
      '¿Cómo paso a un conductor a otra ciudad?',
      '¿Por qué un conductor de El Vigía aparece en Miami?',
      '¿Qué pasa con su código y su saldo si cambia de país?',
    ],
    pasos: [
      'Busca al conductor en el buscador o en Repartidores y abre su ficha.',
      'Comprueba que esté desconectado y sin trabajo en curso.',
      'Abre los tres puntos junto a su nombre y elige «Cambiar ciudad».',
      'Elige la ciudad nueva, escribe el motivo (quién lo autorizó) y toca «Revisar el cambio».',
      'Lee la confirmación. Si es otro país, marca «Confirmo el cambio de país». Toca «Sí, cambiar la ciudad» (o «Volver» si no quieres cambiar nada).',
      'Revisa la ficha: la ciudad y el código nuevos ya se ven.',
    ],
    nota: 'Un cambio de país es una decisión de la empresa: escribe en el motivo quién lo autorizó.',
  },
  en: {
    id: 'change-driver-city',
    titulo: 'Change a driver’s city',
    resumen:
      'From the driver’s page, in the three-dot menu, “Change city” moves them to another active city with a reason. A country change needs a second confirmation. Everything is logged.',
    explicacion: [
      'Use it when a driver ended up in the wrong city (for example, they signed up without a location and landed in Miami) or moved. Divoox changes it everywhere in a single step (if anything fails, nothing changes): their account, their driver record and their code, which becomes the new city’s (for example, from US-MIA-000015 to VE-ELV-000003). The old code stays in the log and can still be found in search; the driver’s page shows it as “Formerly: …”.',
      'Since Nov 21, 2026 a driver no longer lands in Miami for signing up without a location: with no real city they get no code, and they get it (with their document deadline, if their country has one) as soon as their city is known, from their invitation, the city they pick or their location when they open Driver or go online. A code left with the wrong country is fixed automatically. On the driver’s page, “Online” only shows when they can actually get trips; connected with nothing approved and no open deadline it says “Connected, can’t get trips yet”. Their phone always shows with their country code.',
      'It can’t be done while the driver is online or has a ride or delivery in progress: the dashboard says so and nothing changes. Ask them to go offline or wait until they finish.',
      'If the new city is in another country, the dashboard says so and asks you to check “I confirm the country change”: their currency, payout method and required documents become the new country’s. It isn’t allowed while they still have money from the old country (balance, payout account, gifts to collect, pending top-ups or withdrawals) or documents, a vehicle or services from the old country, which aren’t valid in the new one: the team reviews them first. That’s the safest for the driver and for Divoox.',
      'After the change, the app no longer moves their city by location: the team chose it. Only people with permission over drivers see the option, and only for cities in their work area.',
    ],
    capturas: [
      capCiudad(
        'formulario',
        'en',
        'A driver’s page with the Change city form open: New city El Vigía (VE), the reason filled in, and the Change city and Cancel buttons.',
        'Choose the city, write the reason and confirm.',
      ),
      capCiudad(
        'confirmar',
        'en',
        'The Change city confirmation step: “You’re about to move this driver to El Vigía,” the US to VE country change notice and the I confirm the country change box checked.',
        'Review the change and, if it’s a country change, check it.',
      ),
      capCiudad(
        'listo',
        'en',
        'The driver’s page after the change: their new VE-ELV code, the “Done. Their new code is…” notice and the Offline · El Vigía line.',
        'The change shows right away, with their new code.',
      ),
    ],
    preguntas: [
      'How do I move a driver to another city?',
      'Why does a driver from El Vigía show up in Miami?',
      'What happens to their code and balance if they change country?',
    ],
    pasos: [
      'Find the driver with the search bar or in Drivers and open their page.',
      'Check they’re offline with no job in progress.',
      'Open the three dots next to their name and choose “Change city.”',
      'Choose the new city, write the reason (who approved it) and tap “Review the change.”',
      'Read the confirmation. If it’s another country, check “I confirm the country change.” Tap “Yes, change the city” (or “Back” to change nothing).',
      'Check the page: the new city and code show right away.',
    ],
    nota: 'A country change is a company decision: write in the reason who approved it.',
  },
};

// ───────────────────────── Regalos Divoox (C-CUPON-DIVOOX, 17 nov 2026) ─────────────────────────

const capRegalo = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({
  archivo: `regalos-divoox-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const regalosDivoox: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'create-divoox-gift-code',
    titulo: 'Crear un regalo de Divoox (cupón con presupuesto)',
    resumen:
      'Cómo crear un cupón que paga Divoox, encenderlo, ver en vivo cuánto se gastó y cuánto queda, y pagarle al conductor lo acreditado.',
    explicacion: [
      'Un regalo de Divoox lo paga Divoox, no el conductor. El cliente paga en mano solo la diferencia y lo que cubre el regalo se le acredita al conductor en sus ganancias al terminar.',
      'Cada cupón tiene un presupuesto total en dólares. Lo apartado en viajes en curso más lo ya cobrado nunca lo pasa: lo comprueba el servidor en el mismo paso que aparta cada uso. Al agotarse, el cupón se apaga solo; si un viaje se cancela, el dinero vuelve al presupuesto y el cupón se enciende otra vez.',
      'Los topes fijos de Divoox están en el código y el panel no los puede pasar: hasta 20 dólares por uso, 500 por cupón y 1 000 sumando todos los cupones vigentes, y como máximo 20 viajes con regalo por conductor al día.',
      'Antifraude: un uso por cuenta, por número de celular y por teléfono. El conductor no puede tomar un viaje con regalo pedido desde su propia cuenta o teléfono. Las alertas (intentos frenados, tope diario, el mismo cliente con el mismo conductor una y otra vez) salen al final de la pantalla.',
      'Un cupón de bienvenida no lleva código: se aplica solo en la primera operación de cada persona en esas ciudades. Uno con código lo agrega el cliente en la app («¿Tienes un código de regalo?») o en la casilla de cupón del carrito.',
      'Regalos en revisión: el regalo de un viaje solo se acredita si el viaje fue real. El servidor mide el recorrido con las ubicaciones del conductor mientras el viaje está en curso y, al terminar, compara. Pasa a revisión si recorrió menos de la mitad de la distancia cotizada, si duró menos del 40 % del tiempo cotizado (o menos de 2 minutos), si casi no se movió (menos de 200 metros), si terminó a más de 300 metros del destino, si no tenía una ubicación de los últimos 2 minutos, o si el teléfono del pasajero estuvo a más de 300 metros del conductor en la mayoría de las lecturas. Estos números están en el código y el panel no los cambia. No se le dicen al conductor.',
      'Un regalo en revisión no se pierde ni se paga: el viaje se terminó, el pasajero pagó solo su parte, el dinero sigue apartado en el presupuesto del cupón y el conductor ve «Divoox está revisando este regalo» en sus Ganancias (no lo puede cobrar con el Agente ni pasar a su saldo). Arriba de la pantalla, en «Regalos en revisión», sale cada uno con el motivo y lo medido. «Aprobar y acreditar» lo manda a sus ganancias; «Rechazar» pide una nota y devuelve el dinero al presupuesto; si además marcas «Si rechazo, esta cuenta no vuelve a usar este cupón», esa cuenta, ese número y ese teléfono quedan fuera de ese cupón (no la marques si el pasajero no tuvo culpa). Revísalos pronto: uno que lleve más de 7 días sin revisar pone la salud del sistema en rojo. El conductor recibe un aviso con el resultado y todo queda en la auditoría con tu nombre.',
      'Antes de rechazar, mira la ficha del viaje y, si hace falta, llama al pasajero: un GPS malo puede mandar a revisión un viaje honesto. Un viaje con regalo siempre pide el código de inicio, aunque la ciudad lo tenga apagado.',
      'Alertas nuevas al final de la pantalla: viaje con regalo terminado sin moverse, demasiado corto, lejos del destino o sin ubicación, pasajero lejos del conductor, y tres o más regalos del mismo conductor en una semana con pasajeros que crearon su cuenta el mismo día (esta última es solo aviso: el día que abre una ciudad es normal).',
      'Todo cupón nace APAGADO. Revísalo y enciéndelo cuando el equipo de la ciudad esté listo.',
      'Lo acreditado a cada conductor sale en la tabla de abajo. Pásaselo por pago móvil y regístralo con la referencia del banco (sale de sus ganancias, una vez por referencia y nunca más de lo acreditado), o el conductor lo pasa a su saldo con un toque desde su app.',
    ],
    capturas: [
      capRegalo(
        'super-crear',
        'es',
        'Formulario «Crear un cupón» con código, nombres, qué regala, monto, servicios, ciudades, vencimiento, presupuesto y tope diario.',
        'El formulario para crear un cupón. Nace apagado.',
      ),
      capRegalo(
        'super-cupon',
        'es',
        'Tarjeta del cupón VIGIA encendido con presupuesto, gastado, en viajes en curso y lo que queda, y su barra verde.',
        'El presupuesto en vivo: gastado, apartado y lo que queda.',
      ),
      capRegalo(
        'super-conductores',
        'es',
        'Tabla de lo acreditado a cada conductor, lo pagado por pago móvil y lo que se le puede pagar.',
        'Lo acreditado a cada conductor y el registro del pago móvil.',
      ),
      capRegalo(
        'super-revision',
        'es',
        'Tarjeta de un regalo en revisión con el motivo «Viaje con regalo terminado sin moverse», lo medido, la casilla de la nota y los botones «Aprobar y acreditar» y «Rechazar».',
        'Un regalo en revisión: el motivo, lo medido y los dos botones.',
      ),
    ],
    preguntas: [
      '¿Cómo creo el cupón de 100 dólares para El Vigía y Tucaní?',
      '¿Qué pasa cuando se acaba el presupuesto?',
      '¿Cómo le pago al conductor lo que cubrió el regalo?',
      '¿Qué hago con un regalo en revisión?',
      '¿Por qué un regalo no entró a las ganancias del conductor?',
    ],
    pasos: [
      'Abre «Regalos Divoox» en el menú de Dinero.',
      'En «Crear un cupón» escribe el código (por ejemplo VIGIA), los nombres en español y en inglés, «Un monto por uso» y el monto (por ejemplo 1).',
      'Marca los servicios (Moto, Envíos, Comida) y las ciudades (El Vigía y Tucaní).',
      'Escribe el presupuesto total (por ejemplo 100) y el tope diario por conductor. Toca «Crear apagado».',
      'Revisa la tarjeta del cupón y toca «Encender» cuando todo esté listo.',
      'Mira el gasto en vivo en la tarjeta y las alertas al final de la pantalla.',
      'Si hay «Regalos en revisión», lee el motivo, comprueba el viaje y toca «Aprobar y acreditar», o escribe la nota y toca «Rechazar».',
    ],
  },
  en: {
    id: 'create-divoox-gift-code',
    titulo: 'Create a Divoox gift (promo code with a budget)',
    resumen:
      'How to create a code paid by Divoox, turn it on, see live how much was spent and how much is left, and pay drivers what was credited.',
    explicacion: [
      'A Divoox gift is paid by Divoox, not by the driver. The customer pays in person only the difference, and what the gift covers is credited to the driver’s earnings when the trip ends.',
      'Each code has a total budget in dollars. What is set aside in trips in progress plus what was already paid never goes over it: the server checks it in the same step that sets aside each use. When it runs out, the code turns off on its own; if a trip is canceled, the money goes back to the budget and the code turns on again.',
      'Divoox’s fixed limits live in the code and the panel can’t go over them: up to 20 dollars per use, 500 per code and 1,000 across all active codes, and at most 20 gift trips per driver per day.',
      'Anti-fraud: one use per account, per cell number and per phone. A driver can’t take a gift trip requested from their own account or phone. Alerts (blocked attempts, daily limit, the same customer with the same driver again and again) show at the bottom of the screen.',
      'A welcome code needs no code entry: it applies on its own on each person’s first trip or order in those cities. A code with a name is added by the customer in the app (“Have a gift code?”) or in the cart’s coupon field.',
      'Gifts under review: a trip’s gift is only credited if the trip was real. The server measures the route with the driver’s locations while the trip is in progress and compares when it ends. It goes to review if the driver covered less than half the quoted distance, if it lasted less than 40% of the quoted time (or under 2 minutes), if they barely moved (under 200 meters), if they finished more than 300 meters from the drop-off, if they had no location from the last 2 minutes, or if the rider’s phone was more than 300 meters from the driver in most readings. These numbers live in the code and the panel can’t change them. Drivers are not told them.',
      'A gift under review is neither lost nor paid: the trip ended, the rider paid only their part, the money stays set aside in the code’s budget and the driver sees “Divoox is reviewing this gift” in Earnings (they can’t cash it out with the Agent or move it to their balance). At the top of the screen, “Gifts under review” lists each one with the reason and what was measured. “Approve and credit” sends it to their earnings; “Reject” asks for a note and returns the money to the budget; if you also check “If I reject, this account can’t use this code again,” that account, number and phone are kept out of that code (don’t check it if the rider wasn’t at fault). Review them soon: one that sits more than 7 days without review turns the system health red. The driver gets a notification with the result and everything is in the audit log under your name.',
      'Before rejecting, check the trip record and, if needed, call the rider: bad GPS can send an honest trip to review. A gift trip always asks for the start code, even if the city has it turned off.',
      'New alerts at the bottom of the screen: gift trip ended without moving, too short, far from the drop-off or with no location, rider far from the driver, and three or more gifts for the same driver in a week with riders who created their account the same day (this last one is only a heads-up: on a city’s opening day it’s normal).',
      'Every code is created OFF. Review it and turn it on when the city team is ready.',
      'What was credited to each driver is in the table below. Send it by mobile payment and record it with the bank reference (it comes out of their earnings, once per reference and never more than was credited), or the driver moves it to their balance with one tap in their app.',
    ],
    capturas: [
      capRegalo(
        'super-crear',
        'en',
        'The “Create a code” form with code, names, what it gives, amount, services, cities, expiration, budget and daily limit.',
        'The form to create a code. It is created off.',
      ),
      capRegalo(
        'super-cupon',
        'en',
        'The NOVIRIDE code card turned on, with budget, spent, in trips in progress and what is left, and its green bar.',
        'The live budget: spent, set aside and what is left.',
      ),
      capRegalo(
        'super-conductores',
        'en',
        'Table with what was credited to each driver, what was paid by mobile payment and what can be paid.',
        'What each driver was credited and the payment record.',
      ),
      capRegalo(
        'super-revision',
        'en',
        'Card of a gift under review with the reason “Gift trip ended without moving,” what was measured, the note field and the “Approve and credit” and “Reject” buttons.',
        'A gift under review: the reason, what was measured and the two buttons.',
      ),
    ],
    preguntas: [
      'How do I create a 100-dollar code for a city?',
      'What happens when the budget runs out?',
      'How do I pay a driver what the gift covered?',
      'What do I do with a gift under review?',
      'Why didn’t a gift reach the driver’s earnings?',
    ],
    pasos: [
      'Open “Divoox gifts” in the Money menu.',
      'In “Create a code,” enter the code, the names in Spanish and English, “An amount per use” and the amount (for example 1).',
      'Check the services (Moto, Deliveries, Food) and the cities.',
      'Enter the total budget (for example 100) and the daily limit per driver. Tap “Create (off).”',
      'Review the code card and tap “Turn on” when everything is ready.',
      'Watch spending live on the card and the alerts at the bottom of the screen.',
      'If there are “Gifts under review,” read the reason, check the trip and tap “Approve and credit,” or write the note and tap “Reject.”',
    ],
  },
};

// ───────────────────── Saldo de conductores (C-SALDO-CONDUCTOR, 17 nov 2026) ─────────────────────

const capSaldo = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `saldo-conductores-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const capAgente = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({
  archivo: `agentes-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const capTasa = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `tasa-bolivar-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

/** C-TASA-CORDURA (19 nov 2026, Venezuela): la tasa del bolívar. Interno: nunca en Docs públicos. */
const tasaBolivar: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'bolivar-reference-rate',
    titulo: 'La tasa del bolívar: oficial, flotante o fija',
    resumen:
      'De dónde sale la tasa que ven clientes, conductores y agentes en Venezuela, cómo elegir entre la oficial, la flotante y la fija, y qué pasa si alguien escribe un número que no es creíble.',
    explicacion: [
      'En Venezuela todo se cobra en dólares y al lado se muestra el equivalente en bolívares. Ese equivalente sale de una sola tasa, la de esta pantalla. Todas las apps, la web y el panel del Agente Divoox la leen de aquí: nadie más guarda una tasa.',
      'Oficial (recomendada): Divoox lee sola, una vez al día, la tasa del Banco Central de Venezuela con su fecha valor. Si un día el Banco Central no responde, lo intenta otra vez a la hora siguiente y usa su respaldo. No hay que escribir nada. Al abrir esta pantalla también se pone al día.',
      'Flotante: la oficial más un ajuste en porcentaje, entre menos 30 y más 30. Sirve para acercarse a la tasa de la calle sin escribirla cada día: sube y baja sola con la oficial. La pantalla muestra cuánto quedaría antes de guardar.',
      'Fija: un número que pones tú y no cambia hasta que lo cambies. Úsala solo por poco tiempo: si el bolívar se mueve, la fija se queda vieja.',
      'Cordura: un número escrito a mano tiene que parecerse a la oficial. La tasa del día del equipo se acepta hasta 20 % por encima o por debajo de la oficial; la fija, hasta 30 %. Si te equivocas (un cero de más, un valor de prueba), el panel no lo guarda y te dice cuál es la oficial. Y si un número malo llegara por otro camino, las apps no lo muestran: muestran la oficial y la salud del sistema se pone en rojo.',
      'La tasa de cada viaje y de cada cobro en efectivo queda fijada cuando se cotiza o se pide el código: cambiar la tasa aquí no cambia lo que ya estaba en curso.',
      'Solo se muestra como referencia. Los precios, las comisiones y los saldos siguen en dólares.',
    ],
    capturas: [
      capTasa(
        'super-pantalla',
        'es',
        'Pantalla «Tasa de referencia en bolívares» con la tasa en uso, su fuente y su fecha, y las tres opciones: oficial automática, flotante y fija.',
        'La tasa en uso y las tres formas de elegirla.',
      ),
    ],
    preguntas: [
      '¿De dónde sale la tasa del bolívar que ven los conductores?',
      '¿Cómo pongo la tasa de la calle?',
      '¿Por qué el panel no me dejó guardar la tasa?',
    ],
    pasos: [
      'Abre «Moto» en el menú del superadmin y baja hasta «Tasa de referencia en bolívares».',
      'Arriba ves la tasa que se usa hoy, de dónde sale y su fecha.',
      'Elige «Oficial», «Flotante» (escribe el ajuste en porcentaje) o «Fija» (escribe la tasa).',
      'Toca «Guardar». El cambio vale desde ese momento para lo nuevo.',
    ],
  },
  en: {
    id: 'bolivar-reference-rate',
    titulo: 'The bolívar rate: official, floating or fixed',
    resumen:
      'Where the rate that customers, drivers and agents see in Venezuela comes from, how to choose between official, floating and fixed, and what happens if someone enters a number that isn’t credible.',
    explicacion: [
      'In Venezuela everything is charged in dollars and the bolívar equivalent is shown next to it. That equivalent comes from a single rate, the one on this screen. Every app, the website and the Divoox Agent panel read it from here: nothing else stores a rate.',
      'Official (recommended): once a day Divoox reads the Central Bank of Venezuela’s rate with its value date on its own. If the Central Bank doesn’t respond one day, it tries again the next hour and uses its backup. Nothing needs to be typed. Opening this screen also brings it up to date.',
      'Floating: the official rate plus a percentage adjustment, between minus 30 and plus 30. It’s for getting close to the street rate without typing it every day: it moves with the official rate. The screen shows what it would be before you save.',
      'Fixed: a number you set that doesn’t change until you change it. Use it only briefly: if the bolívar moves, the fixed rate goes stale.',
      'Sanity check: a number typed by hand has to look like the official rate. The team’s rate of the day is accepted up to 20% above or below the official rate; the fixed rate, up to 30%. If you make a mistake (an extra zero, a test value), the panel doesn’t save it and tells you the official rate. And if a bad number arrived some other way, the apps don’t show it: they show the official rate and the system health turns red.',
      'The rate of each trip and each cash payout is locked when it’s quoted or when the code is requested: changing the rate here doesn’t change what was already in progress.',
      'It’s shown only as a reference. Prices, commissions and balances stay in dollars.',
    ],
    capturas: [
      capTasa(
        'super-pantalla',
        'en',
        'The “Bolívar reference rate” screen with the rate in use, its source and date, and the three options: automatic official, floating and fixed.',
        'The rate in use and the three ways to set it.',
      ),
    ],
    preguntas: [
      'Where does the bolívar rate drivers see come from?',
      'How do I set the street rate?',
      'Why didn’t the panel let me save the rate?',
    ],
    pasos: [
      'Open “Moto” in the superadmin menu and scroll down to “Bolívar reference rate.”',
      'At the top you see the rate used today, where it comes from and its date.',
      'Choose “Official,” “Floating” (enter the percentage adjustment) or “Fixed” (enter the rate).',
      'Tap “Save.” The change applies from that moment to anything new.',
    ],
  },
};

/** C-AGENTE-DIVOOX (18 nov 2026): Dinero → Agentes. Interno: nunca en Docs públicos. */
const agentesDivoox: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'divoox-agents',
    titulo: 'Agentes: encender una ciudad, crear un agente, anotar su fondo y conciliar',
    resumen:
      'Un Agente Divoox paga en efectivo las ganancias de los conductores y les vende saldo. Aquí se enciende el servicio por ciudad, se crean y suspenden agentes, se anota su fondo y se concilia.',
    explicacion: [
      'El agente paga con un fondo prepago: tú le transfieres por fuera y lo anotas en su ficha con el comprobante. Cada pago a un conductor baja ese fondo. Sin fondo su panel no deja pagar. Cuando el fondo baja del aviso que le pusiste, llega un correo al equipo de dinero (uno cada 12 horas como mucho).',
      'Lo que el agente vende de saldo queda como dinero que le debe a Divoox. Se cierra de dos maneras: «Me entregó el efectivo del saldo vendido» (te lo dio) o «Lo que debe por saldo vendido pasa a su fondo» (no viaja dinero: lo que cobró se queda con él como fondo para pagar).',
      'La ganancia del agente no vive en el sistema: se la pagas aparte cuando le transfieres. Aquí no hay comisiones.',
      'El servicio está apagado en cada ciudad hasta que lo enciendas en «Ciudades». Ahí eliges en qué se paga (dólares enteros, o bolívares a la tasa del día en Venezuela), el mínimo del cobro y el tope diario por conductor. Un conductor ve «Cobrar en efectivo» solo si su ciudad está encendida y tiene un agente activo con contraseña.',
      'Al crear un agente le llega un correo con un enlace de un solo uso (48 horas) para crear su contraseña. Entra a su panel con correo y contraseña y siempre confirma con un código que le llega al correo. Su sesión dura 12 horas como mucho y se cierra a los 30 minutos sin uso. Su cuenta no es una cuenta del sistema: no puede abrir nada fuera de su panel.',
      'Topes por agente: por pago, pagos por día, por venta y saldo vendido sin entregar. Cada uno tiene un máximo fijo en el código que el panel te dice al lado de la casilla.',
      'Si el agente escribe cinco códigos de cobro equivocados seguidos, sus pagos quedan bloqueados. Se reactivan en su ficha, en los tres puntos, «Reactivar sus pagos». Antes mira «Lo que hizo en su panel» para entender qué pasó.',
      'Suspender (en los tres puntos de su ficha) cierra su sesión al instante. Su fondo y su libro se conservan. La conciliación de la ficha dice cuánto dinero de Divoox tiene en la mano: su fondo sin usar más lo que cobró por saldo vendido.',
      'Todo queda escrito: cada anotación tuya en la auditoría del equipo y cada acción del agente (entradas, códigos vistos, pagos, ventas, fallos) en su ficha, con la hora y la dirección de red.',
    ],
    capturas: [
      capAgente(
        'super-ciudad',
        'es',
        'Formulario de una ciudad con «Encendido», en qué se paga, el mínimo del cobro y el tope diario por conductor.',
        'El servicio se enciende por ciudad.',
      ),
      capAgente(
        'super-crear',
        'es',
        'Formulario «Crear un agente» con sus datos, su ciudad y sus topes.',
        'Crear un agente: le llega el enlace para su contraseña.',
      ),
      capAgente(
        'super-fondo',
        'es',
        'Paso de confirmación de una anotación de fondo con el resumen y el botón «Confirmar».',
        'Anotar el fondo que le transferiste.',
      ),
      capAgente(
        'super-conciliacion',
        'es',
        'Conciliación de un agente: fondo, lo que debe, lo que tiene en la mano, fondo recibido, pagado y vendido.',
        'La conciliación de un agente.',
      ),
    ],
    preguntas: [
      '¿Cómo enciendo el cobro en efectivo en una ciudad?',
      '¿Cómo le anoto el fondo a un agente?',
      '¿Qué hago si los pagos de un agente quedaron bloqueados?',
    ],
    pasos: [
      'Abre «Agentes» en el menú de Dinero.',
      'En «Ciudades», toca «Editar» en la ciudad, marca «Encendido», elige en qué se paga y guarda.',
      'En «Crear un agente», llena sus datos y sus topes y toca «Crear y mandarle el enlace».',
      'Cuando le transfieras, abre su ficha, «Anotar un movimiento», «Le transferí fondo», el monto y el comprobante; revisa y confirma.',
      'Para conciliar, mira en su ficha el fondo, lo que debe y sus movimientos.',
    ],
  },
  en: {
    id: 'divoox-agents',
    titulo: 'Agents: turn on a city, create an agent, record their float and reconcile',
    resumen:
      'A Divoox Agent pays drivers’ earnings in cash and sells them balance. Here you turn the service on by city, create and suspend agents, record their float and reconcile.',
    explicacion: [
      'The agent pays out of a prepaid float: you transfer it outside the system and record it in their file with the receipt. Each driver payout lowers that float. Without float their panel won’t pay. When the float drops below the alert you set, the money team gets an email (at most one every 12 hours).',
      'What the agent sells in balance becomes money they owe Divoox. It’s settled two ways: “They handed over the cash from balance sold” (they gave it to you) or “What they owe for balance sold moves to their float” (no money travels: what they collected stays with them as float).',
      'The agent’s earnings don’t live in the system: you pay them separately when you transfer. There are no commissions here.',
      'The service is off in every city until you turn it on under “Cities.” There you choose the payout currency (whole dollars, or bolívares at the day’s rate in Venezuela), the minimum cash-out and the daily limit per driver. A driver sees “Cash out” only if their city is on and has an active agent with a password.',
      'When you create an agent they get an email with a single-use link (48 hours) to set their password. They sign in to their panel with email and password and always confirm with a code sent to their email. Their session lasts 12 hours at most and closes after 30 minutes without use. Their account isn’t a system account: it can’t open anything outside their panel.',
      'Limits per agent: per payout, payouts per day, per sale, and balance sold but not handed over. Each has a fixed maximum in the code that the panel shows next to the field.',
      'If the agent enters five wrong cash-out codes in a row, their payouts are locked. Turn them back on in their file, under the three dots, “Turn their payouts back on.” First check “What they did in their panel” to understand what happened.',
      'Suspending (under the three dots in their file) closes their session right away. Their float and ledger are kept. The reconciliation in the file shows how much Divoox money they’re holding: their unused float plus what they collected for balance sold.',
      'Everything is recorded: each entry of yours in the team audit log, and each agent action (sign-ins, codes viewed, payouts, sales, failures) in their file, with the time and network address.',
    ],
    capturas: [
      capAgente(
        'super-ciudad',
        'en',
        'A city form with “On,” the payout currency, the minimum cash-out and the daily limit per driver.',
        'The service is turned on by city.',
      ),
      capAgente(
        'super-crear',
        'en',
        'The “Create an agent” form with their details, city and limits.',
        'Create an agent: they get the link to set their password.',
      ),
      capAgente(
        'super-fondo',
        'en',
        'Confirmation step of a float entry with the summary and the “Confirm” button.',
        'Record the float you transferred.',
      ),
      capAgente(
        'super-conciliacion',
        'en',
        'An agent’s reconciliation: float, what they owe, what they’re holding, float received, paid out and sold.',
        'An agent’s reconciliation.',
      ),
    ],
    preguntas: [
      'How do I turn on cash-out in a city?',
      'How do I record an agent’s float?',
      'What do I do if an agent’s payouts are locked?',
    ],
    pasos: [
      'Open “Agents” in the Money menu.',
      'Under “Cities,” tap “Edit” on the city, check “On,” choose the payout currency and save.',
      'Under “Create an agent,” fill in their details and limits and tap “Create and send the link.”',
      'When you transfer, open their file, “Record an entry,” “I transferred float to them,” the amount and the receipt; review and confirm.',
      'To reconcile, check the float, what they owe and their activity in their file.',
    ],
  },
};

// ───────────────────────── C-RASTRO: el rastro de actividad (22 nov 2026) ─────────────────────────
const capRastro = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({
  archivo: `rastro-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const rastroActividad: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'activity-trail',
    titulo:
      'Rastro de actividad: qué hizo cada cuenta, cómo fue cada viaje y dónde se quedan los registros',
    resumen:
      'Cómo ver de dónde vino el alta de una cuenta y en qué paso quedó, leer la línea de tiempo de un viaje con minutos y kilómetros, y usar el embudo de registro.',
    explicacion: [
      'En la ficha de un conductor o de un cliente, la sección «Actividad» dice cuándo se creó la cuenta, desde qué app y versión, si fue en Android, iPhone o navegador, y el país y la ciudad aproximados según la red. No se guarda la dirección de internet de la persona.',
      'Debajo, «Registro» muestra cada paso en el orden en que lo hace la persona, con uno de tres estados: «Hecho» en verde, «Pendiente» en ámbar y «No le toca» en gris (por ejemplo, el teléfono donde no se pide). Cada paso se lee de su fuente real: las fotos, los papeles, el vehículo, lo que aprobó el equipo y la primera conexión. Así se sabe a quién llamar y qué pedirle.',
      'El correo y el teléfono salen tapados. El ojito los muestra completos y deja anotado quién los vio.',
      'En Verificaciones, la pestaña «Sin enviar» junta a los conductores y dueños de comercio que crearon su cuenta y todavía no mandan sus fotos, del más nuevo al más viejo, con hace cuánto se registraron. Ahí no hay nada que aprobar: sirve para saber quién se quedó a medias. El contador se detiene en «99+».',
      'La «Línea de tiempo» junta lo demás: fotos que subió y qué dijo la comprobación automática, decisiones del equipo con el nombre de quien las tomó, vehículos, habilitaciones, viajes, pedidos y conversaciones con soporte. Los viajes y pedidos llevan su enlace a la ficha.',
      'En la ficha de un viaje o de un pedido, la línea de tiempo dice cuánto pasó entre un paso y el siguiente y cuántos metros se movió el conductor entre ellos. Si el viaje se canceló o el conductor lo soltó, sale el motivo. En el mapa, los puntos grises numerados dicen dónde estaba el conductor en cada paso.',
      'El «Embudo de registro» (menú, grupo Personas) cuenta cuántas personas llegan a cada paso y marca en ámbar el paso donde se queda la mayoría. Se puede ver por app, por fechas, por país y por zona. Solo cuenta cuentas reales.',
      'Los tres primeros pasos del embudo pasan antes de que exista la cuenta: son contadores, sin saber quién es la persona. Las cuentas creadas antes del 22 de noviembre de 2026 no tienen guardado de dónde vino el alta.',
    ],
    capturas: [
      capRastro(
        'actividad',
        'es',
        'Sección «Actividad» de la ficha de un conductor con el alta, la app, la red aproximada, los pasos del registro y la línea de tiempo.',
        'La actividad de una cuenta: de dónde vino, qué pasos dio y cuál le falta.',
      ),
      capRastro(
        'viaje',
        'es',
        'Ficha de un viaje con la tarjeta de tiempos y la línea de tiempo con los minutos y los kilómetros entre cada paso.',
        'Cada paso del viaje con su hora, el tiempo y la distancia desde el paso anterior.',
      ),
      capRastro(
        'embudo',
        'es',
        'Pantalla «Embudo de registro» con los filtros, la tabla de pasos y la marca en el paso donde se queda la mayoría.',
        'El embudo: cuántas personas llegan a cada paso y dónde se quedan.',
      ),
    ],
    preguntas: [
      '¿Cómo sé desde qué app se registró alguien?',
      '¿En qué paso del registro se quedó un conductor?',
      '¿Cuánto tardó el conductor en llegar?',
      '¿Dónde abandonan el registro?',
      '¿Quién se registró y no ha enviado sus fotos?',
    ],
    pasos: [
      'Abre la ficha del conductor o del cliente y baja a «Actividad».',
      'Lee «Le falta» para saber cuál es su siguiente paso.',
      'Para un viaje, abre su ficha y mira la línea de tiempo y el mapa.',
      'Para el embudo, entra a «Embudo de registro», elige la app y las fechas.',
    ],
  },
  en: {
    id: 'activity-trail',
    titulo: 'Activity trail: what each account did, how each ride went and where sign-ups stop',
    resumen:
      'How to see where an account signed up from and which step it stopped at, read a ride timeline with minutes and distance, and use the sign-up funnel.',
    explicacion: [
      'On a driver or customer file, the “Activity” section shows when the account was created, from which app and version, whether it was Android, iPhone or a browser, and the approximate country and city based on the network. The person’s internet address is not stored.',
      'Below it, “Sign-up” lists every step in the order the person takes it, with one of three statuses: “Done” in green, “Pending” in amber and “Not required” in gray (for example, the phone number where it isn’t requested). Each step is read from its real source: photos, documents, the vehicle, what the team approved and the first time online. That tells you who to call and what to ask for.',
      'Email and phone are partly hidden. The eye icon shows them in full and records who viewed them.',
      'In Verifications, the “Not submitted” tab lists drivers and store owners who created their account and haven’t sent their photos yet, newest first, with how long ago they signed up. There is nothing to approve there: it shows who stopped halfway. The counter stops at “99+”.',
      'The “Timeline” gathers everything else: photos uploaded and what the automatic check said, team decisions with the name of who made them, vehicles, service access, rides, orders and support conversations. Rides and orders link to their file.',
      'On a ride or order file, the timeline shows how long passed between one step and the next and how far the driver moved between them. If the ride was canceled or released, the reason is shown. On the map, the numbered gray dots show where the driver was at each step.',
      'The “Sign-up funnel” (menu, People group) counts how many people reach each step and flags in amber the step where most people stop. You can view it by app, dates, country and zone. Only real accounts are counted.',
      'The first three funnel steps happen before the account exists: they are counters, with no way to know who the person is. Accounts created before November 22, 2026 have no stored sign-up origin.',
    ],
    capturas: [
      capRastro(
        'actividad',
        'en',
        'The “Activity” section of a driver file with sign-up, app, approximate network, sign-up steps and timeline.',
        'An account’s activity: where it came from, which steps it took and which one is missing.',
      ),
      capRastro(
        'viaje',
        'en',
        'A ride file with the times card and the timeline showing minutes and distance between each step.',
        'Each ride step with its time, and the time and distance from the previous step.',
      ),
      capRastro(
        'embudo',
        'en',
        'The “Sign-up funnel” screen with filters, the steps table and the flag on the step where most people stop.',
        'The funnel: how many people reach each step and where they stop.',
      ),
    ],
    preguntas: [
      'How do I know which app someone signed up from?',
      'Which sign-up step did a driver stop at?',
      'How long did the driver take to arrive?',
      'Where do people drop out of sign-up?',
      'Who signed up and hasn’t sent their photos?',
    ],
    pasos: [
      'Open the driver or customer file and scroll to “Activity.”',
      'Read “Still missing” to know their next step.',
      'For a ride, open its file and check the timeline and the map.',
      'For the funnel, go to “Sign-up funnel,” then choose the app and dates.',
    ],
  },
};

// ───────────────────── Saldo de restaurantes (C-SALDO-RESTAURANTE, 22 nov 2026) — Venezuela ─────────

const capSaldoRest = (idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `saldo-restaurantes-super-${idioma}.webp`,
  alt,
  pie,
});

// C-QUIEN-PAGA-VIAJES (23 nov 2026): la palanca de quién paga la comisión de Divoox en los viajes.
const capQuienPaga = (idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `quien-paga-viajes-super-${idioma}.webp`,
  alt,
  pie,
});

const quienPagaViajes: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'who-pays-ride-fee',
    titulo: '¿Quién paga la comisión de Divoox en los viajes?',
    resumen:
      'La palanca que decide quién carga la comisión de Divoox en Moto y Carro: el conductor (como siempre), el cliente (tarifa de servicio aparte y a la vista) o mitad y mitad. Por país y, si hace falta, por ciudad. Venezuela está en «cliente».',
    explicacion: [
      'El porcentaje de Divoox no se toca aquí: sale de la política de comisión del país (hoy 10 % en Venezuela). Esta palanca solo dice quién lo paga. Con «conductor», el pasajero paga el precio del viaje y la comisión sale de la ganancia del conductor. Con «cliente», al precio se le suma una línea aparte, «Tarifa de servicio de Divoox», y el conductor se queda con el viaje completo. Con «mitad», el pasajero paga la mitad como tarifa y la otra mitad sale de la ganancia del conductor.',
      'Como en Venezuela el pasajero paga en la mano o por pago móvil, la tarifa la cobra el conductor junto con el viaje y su saldo prepago entrega a Divoox la comisión entera al terminar. Su app se lo dice antes de aceptar: «Cobras 2,20 · 2,00 son tuyos · 0,20 son de Divoox». En el libro, la parte del pasajero queda como «tarifa de servicio del cliente» y la del conductor como «comisión»: no se mezclan.',
      'Cada viaje guarda el valor con que se cotizó. Cambiar la palanca vale para los viajes que se piden desde ese momento; los que ya están en curso siguen como empezaron. Cada cambio queda en la auditoría de Dinero con tu nombre, el valor de antes y el de después.',
      'Solo ven la tarifa los pasajeros con la app que la muestra en su línea (la de hoy y la web). Quien todavía tiene una app vieja sigue viajando como siempre, con el conductor pagando la comisión: nunca se cobra una tarifa que la persona no puede ver. Los envíos de paquetes no llevan tarifa. Donde no hay comisión del saldo (Estados Unidos hoy) la palanca no cambia nada.',
      'Una ciudad puede tener su propia regla: elige la ciudad y el valor. «Como el resto del país» le quita la regla propia y vuelve a seguir la del país.',
    ],
    capturas: [
      capQuienPaga(
        'es',
        'La pantalla Dinero del panel de operaciones en el bloque «¿Quién paga la comisión de Divoox en los viajes?»: la regla vigente (VE, todo el país, cliente), el país, la ciudad, las tres opciones, el ejemplo con un viaje de 2,00 y el botón Guardar.',
        '«¿Quién paga la comisión de Divoox en los viajes?», en Dinero.',
      ),
    ],
    preguntas: [
      '¿Cómo cambio quién paga la comisión de los viajes?',
      '¿Dónde se pone la tarifa de servicio de Divoox?',
      '¿Por qué un pasajero no ve la tarifa de servicio?',
      '¿Puedo poner otra regla en una sola ciudad?',
    ],
    pasos: [
      'Abre Dinero y busca «¿Quién paga la comisión de Divoox en los viajes?».',
      'Elige el país y, si es solo para una ciudad, la ciudad.',
      'Marca conductor, cliente o mitad y mitad, revisa el ejemplo y toca «Guardar».',
    ],
  },
  en: {
    id: 'who-pays-ride-fee',
    titulo: 'Who pays the Divoox fee on rides?',
    resumen:
      'The switch that decides who carries the Divoox fee on Moto and Car: the driver (as always), the rider (separate service fee, shown upfront) or half and half. By country and, if needed, by city. Venezuela is set to “rider.”',
    explicacion: [
      'The Divoox percentage is not changed here: it comes from the country fee policy (10% in Venezuela today). This switch only says who pays it. With “driver,” the rider pays the ride price and the fee comes out of the driver’s earnings. With “rider,” a separate “Divoox service fee” line is added to the price and the driver keeps the full ride fare. With “half and half,” the rider pays half as a service fee and the other half comes out of the driver’s earnings.',
      'Because in Venezuela the rider pays in hand or by mobile payment, the driver collects the fee along with the ride and their prepaid balance hands the whole fee to Divoox when the ride ends. Their app tells them before they accept: “You collect 2.20 · 2.00 is yours · 0.20 goes to Divoox.” In the ledger, the rider’s part is recorded as the “rider service fee” and the driver’s part as the “fee”: they never mix.',
      'Each ride keeps the value it was quoted with. Changing the switch applies to rides requested from that moment on; rides already in progress stay as they started. Every change is logged in the Money audit with your name, the value before and the value after.',
      'Only riders with an app that shows the fee on its own line (today’s app and the web) see it. Anyone still on an older app rides as always, with the driver paying the fee: we never charge a fee the person cannot see. Package deliveries carry no fee. Where there is no balance fee (the United States today) the switch changes nothing.',
      'A city can have its own rule: choose the city and the value. “Same as the rest of the country” removes the city rule and follows the country again.',
    ],
    capturas: [
      capQuienPaga(
        'en',
        'The Money screen in the operations panel at the “Who pays the Divoox fee on rides?” block: the current rule (VE, whole country, rider), the country, the city, the three options, the example with a 2.00 ride and the Save button.',
        '“Who pays the Divoox fee on rides?”, in Money.',
      ),
    ],
    preguntas: [
      'How do I change who pays the fee on rides?',
      'Where do I set the Divoox service fee?',
      'Why doesn’t a rider see the service fee?',
      'Can I set a different rule for one city?',
    ],
    pasos: [
      'Open Money and find “Who pays the Divoox fee on rides?”.',
      'Choose the country and, if it is only for one city, the city.',
      'Select driver, rider or half and half, check the example and tap “Save.”',
    ],
  },
};

// C-COMIDA-VE-QUIEN-PAGA (23 nov 2026): la tarjeta «Comida: quién paga qué» y el alta del primer
// restaurante de Venezuela.
const capComidaQuienPaga = (idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `comida-quien-paga-super-${idioma}.webp`,
  alt,
  pie,
});

const comidaQuienPaga: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'food-who-pays-what',
    titulo: 'Comida: quién paga qué',
    resumen:
      'La tarjeta de Dinero que decide, en los países donde el cliente le paga la comida directo al restaurante (Venezuela), qué paga el cliente, qué comisión paga el restaurante de su saldo y qué se le descuenta al conductor del envío.',
    explicacion: [
      'En Venezuela el cliente le paga la comida al restaurante por pago móvil, al precio de la carta, y el envío al conductor. Divoox nunca tiene ese dinero en la mano. Por eso la comisión de Divoox no se le cobra al cliente: la paga el restaurante de su saldo prepago, una sola vez por pedido, cuando confirma «Me llegó». La tarjeta tiene tres bloques, uno por cada persona, y un ejemplo vivo con un pedido de 10,00 de comida y 1,50 de envío que dice cuánto paga el cliente, cuánto recibe y paga el restaurante, cuánto recibe el conductor y cuánto gana Divoox.',
      '«Lo que paga el cliente»: la tarifa de servicio (porcentaje, mínimo y máximo) y el cargo por pedido pequeño (pedido mínimo y cargo). En el modelo de hoy todo va en 0 y el cliente no ve esas líneas. Si algún día se suben, ojo: con el pago directo los cobra el conductor en la mano junto con el envío; la tarjeta lo avisa.',
      '«Lo que paga el restaurante»: la comisión de Divoox en porcentaje sobre la comida. Muestra la que rige hoy. El botón «Usar el valor preparado (10 %)» la escribe por ti. Para cualquier valor mayor que 0 pide la referencia de la revisión legal aprobada: sin ella no se guarda. Con comisión, un restaurante sin saldo suficiente no recibe pedidos; con 0 % no se le pide saldo. Si la que rige es una política de todos los países, la tarjeta lo dice: para volver a 0 % hay que cerrarla primero en Políticas.',
      '«Lo que se le descuenta al conductor»: el porcentaje del envío que Divoox le aparta de su saldo. Hoy 0: el conductor cobra el envío entero y no necesita saldo para la comida. Su app se lo dice en verde.',
      'Cada cambio vale para los pedidos que se hacen desde ese momento: un pedido ya hecho conserva la comisión con la que nació. El motivo es obligatorio y todo queda en la auditoría de Dinero con tu nombre, el valor de antes y el de después. Lo escrito se guarda solo mientras escribes y se borra al guardar. Estados Unidos no usa esta tarjeta.',
    ],
    capturas: [
      capComidaQuienPaga(
        'es',
        'La pantalla Dinero del panel de operaciones en la tarjeta «Comida: quién paga qué»: el país, los bloques de lo que paga el cliente, el restaurante y el conductor, el ejemplo con un pedido de 10,00 y el motivo.',
        '«Comida: quién paga qué», en Dinero.',
      ),
    ],
    preguntas: [
      '¿Cómo cambio la comisión que paga el restaurante?',
      '¿Por qué el cliente no paga tarifa de servicio en Venezuela?',
      '¿Cuánto se le descuenta al conductor en la comida?',
      '¿Qué pasa con los pedidos que ya estaban hechos si cambio la comisión?',
    ],
    pasos: [
      'Abre Dinero y busca «Comida: quién paga qué».',
      'Elige el país y cambia solo el bloque que quieres (cliente, restaurante o conductor). Para una comisión de restaurante mayor que 0, escribe la referencia de la revisión legal.',
      'Revisa el ejemplo, escribe el motivo y toca «Guardar».',
    ],
  },
  en: {
    id: 'food-who-pays-what',
    titulo: 'Food: who pays what',
    resumen:
      'The Money card that decides, in countries where the customer pays the restaurant directly for the food (Venezuela), what the customer pays, what fee the restaurant pays from its balance and what is taken from the driver’s delivery fee.',
    explicacion: [
      'In Venezuela the customer pays the restaurant for the food by mobile payment, at menu price, and pays the driver for the delivery. Divoox never holds that money. That is why the Divoox fee is not charged to the customer: the restaurant pays it from its prepaid balance, once per order, when it confirms “I got it.” The card has three blocks, one per person, and a live example with a 10.00 food order and a 1.50 delivery fee that shows what the customer pays, what the restaurant receives and pays, what the driver receives and what Divoox earns.',
      '“What the customer pays”: the service fee (percentage, minimum and maximum) and the small-order fee (minimum order and fee). In today’s model everything is 0 and the customer does not see those lines. If they are ever raised, note that with direct payment the driver collects them in hand along with the delivery fee; the card warns you.',
      '“What the restaurant pays”: the Divoox fee as a percentage of the food. It shows the one in effect today. The “Use the prepared value (10%)” button fills it in for you. Any value above 0 requires the approved legal review reference: without it, nothing is saved. With a fee, a restaurant without enough balance gets no orders; at 0% no balance is required. If the one in effect is an all-countries policy, the card says so: to go back to 0% you must close it first in Policies.',
      '“What is taken from the driver”: the percentage of the delivery fee Divoox sets aside from their balance. Today it is 0: the driver keeps the whole delivery fee and needs no balance for food. Their app says so in green.',
      'Every change applies to orders placed from that moment on: an order already placed keeps the fee it was created with. The reason is required and everything is logged in the Money audit with your name, the value before and the value after. What you type is saved as you go and cleared when you save. The United States does not use this card.',
    ],
    capturas: [
      capComidaQuienPaga(
        'en',
        'The Money screen in the operations panel at the “Food: who pays what” card: the country, the blocks for what the customer, the restaurant and the driver pay, the example with a 10.00 order and the reason.',
        '“Food: who pays what,” in Money.',
      ),
    ],
    preguntas: [
      'How do I change the fee a restaurant pays?',
      'Why doesn’t the customer pay a service fee in Venezuela?',
      'How much is taken from the driver on food orders?',
      'What happens to orders already placed if I change the fee?',
    ],
    pasos: [
      'Open Money and find “Food: who pays what.”',
      'Choose the country and change only the block you want (customer, restaurant or driver). For a restaurant fee above 0, enter the legal review reference.',
      'Check the example, write the reason and tap “Save.”',
    ],
  },
};

const primerRestauranteVe: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'first-restaurant-venezuela',
    titulo: 'Alta del primer restaurante en Venezuela',
    resumen:
      'La lista corta para dejar listo un restaurante de Venezuela: sus datos de pago móvil, su saldo de regalo, qué ve en su app cuando entra un pedido y qué hace falta para encender Comida en producción en una sola ciudad.',
    explicacion: [
      'Datos de pago móvil que tiene que cargar el restaurante en su app, en «Cuenta para recibir tus ventas»: el banco, el teléfono del pago móvil, el documento del titular (cédula o RIF) y el nombre del titular. Sin esa cuenta no recibe pedidos. La cuenta nueva empieza a usarse a las 24 horas, por seguridad, y cambiarla pide su contraseña. El cliente le paga ahí el precio de su carta, completo.',
      'Saldo de regalo: en Dinero, «Saldo de restaurantes», «Cargar saldo a mano», con el identificador del restaurante, el monto y el motivo («saldo de regalo de arranque»). Lleva la doble firma: otra persona del equipo la aprueba. Hoy su comisión es 0 % y no necesita saldo para recibir pedidos; el regalo queda para cuando haya comisión. La comisión se cambia en «Comida: quién paga qué».',
      'Lo que ve en su app con un pedido: lo acepta como siempre; mientras se asegura el conductor y el cliente paga, la fila dice «Esperando el pago del cliente: no prepares todavía». Cuando el cliente manda su referencia, la fila se pone amarilla con «Pago por confirmar». Abre el pedido, busca el pago en su banco por el monto y la referencia, y toca «Me llegó» o «No me llegó». Con «Me llegó» prepara y toca «Marcar como listo»; el conductor recoge sin pagar nada en el mostrador. Con «No me llegó» se abre un caso para el equipo.',
      'Encender en producción para una ciudad y un restaurante, cuando Richard lo ordene: hoy el paso «Abrir Comida en esta ciudad» del panel responde que en producción necesita su orden, y no se abre. Hace falta que el equipo técnico deje pasar esa compuerta solo para la ciudad elegida (probado antes en el sitio de pruebas). Después, en el panel: abrir Comida en esa ciudad (crea la ciudad, escribe las tarifas de Venezuela en dólares, enciende el efectivo y el pago móvil del envío y Comida en esa ciudad), aprobar solo ese restaurante con su menú y su pago móvil, y revisar «Comida: quién paga qué» (cliente sin cargos, restaurante 0 %, conductor 0 %). La marca tiene que estar en registro en el país y nada se prueba con dinero real antes de la orden.',
    ],
    capturas: [
      capSaldoRest(
        'es',
        'El final de la pantalla Dinero del panel de operaciones: el bloque «Saldo de restaurantes» con «Recargas por revisar» y el formulario «Cargar saldo a mano» con restaurante, monto, motivo y comprobante.',
        '«Cargar saldo a mano»: así recibe su saldo de regalo.',
      ),
    ],
    preguntas: [
      '¿Qué datos de pago móvil pide un restaurante de Venezuela?',
      '¿Cómo le doy saldo de regalo a un restaurante?',
      '¿Qué ve el restaurante cuando le llega un pedido?',
      '¿Cómo se enciende Comida en producción en una ciudad?',
    ],
    pasos: [
      'Pide al restaurante que cargue su pago móvil en «Cuenta para recibir tus ventas» (banco, teléfono, documento y titular).',
      'Cárgale el saldo de regalo en «Saldo de restaurantes» y pide la segunda firma.',
      'Hazle una prueba con «Enviar un pedido de prueba» desde su app para que vea el flujo.',
      'Para producción, espera la orden de Richard: el equipo técnico abre la compuerta solo para esa ciudad y después se abre Comida y se aprueba el restaurante.',
    ],
  },
  en: {
    id: 'first-restaurant-venezuela',
    titulo: 'First restaurant sign-up in Venezuela',
    resumen:
      'The short checklist to get a restaurant in Venezuela ready: its mobile payment details, its starter balance, what it sees in its app when an order comes in, and what it takes to turn on Food in production in a single city.',
    explicacion: [
      'Mobile payment details the restaurant enters in its app, under “Account to receive your sales”: the bank, the mobile payment phone, the holder’s ID number (cédula or RIF) and the holder’s name. Without that account it gets no orders. A new account starts being used after 24 hours, for security, and changing it asks for the password. The customer pays the full menu price there.',
      'Starter balance: in Money, “Restaurant balance,” “Add balance manually,” with the restaurant identifier, the amount and the reason (“starter gift balance”). It needs the second signature: another team member approves it. Today its fee is 0% and it needs no balance to receive orders; the gift is there for when a fee applies. The fee is changed in “Food: who pays what.”',
      'What it sees in its app with an order: it accepts it as usual; while the driver is secured and the customer pays, the row says “Waiting for the customer’s payment: do not prepare yet.” When the customer sends their reference, the row turns yellow with “Payment to confirm.” It opens the order, looks for the payment in its bank by amount and reference, and taps “I got it” or “I did not get it.” With “I got it” it prepares and taps “Mark as ready”; the driver picks up without paying anything at the counter. With “I did not get it” a case opens for the team.',
      'Turning it on in production for one city and one restaurant, when Richard orders it: today the panel step “Open Food in this city” answers that production needs his order, and nothing opens. The technical team has to let that gate through for the chosen city only (tested first on the test site). Then, in the panel: open Food in that city (it creates the city, writes the Venezuela fees in dollars, turns on cash and mobile payment for delivery and Food in that city), approve only that restaurant with its menu and mobile payment, and check “Food: who pays what” (customer with no fees, restaurant 0%, driver 0%). The brand must be in registration in the country and nothing is tested with real money before the order.',
    ],
    capturas: [
      capSaldoRest(
        'en',
        'The end of the Money screen in the operations panel: the “Restaurant balance” block with “Top-ups to review” and the “Add balance manually” form with restaurant, amount, reason and receipt.',
        '“Add balance manually”: how it gets its starter balance.',
      ),
    ],
    preguntas: [
      'What mobile payment details does a restaurant in Venezuela need?',
      'How do I give a restaurant a starter balance?',
      'What does the restaurant see when an order comes in?',
      'How is Food turned on in production in one city?',
    ],
    pasos: [
      'Ask the restaurant to enter its mobile payment under “Account to receive your sales” (bank, phone, ID number and holder).',
      'Add its starter balance under “Restaurant balance” and ask for the second signature.',
      'Have it try “Send a test order” from its app so it sees the flow.',
      'For production, wait for Richard’s order: the technical team opens the gate for that city only, then Food is opened and the restaurant approved.',
    ],
  },
};

const saldoRestaurantes: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'restaurant-balance-top-ups',
    titulo: 'Saldo de restaurantes: recargas por revisar, carga a mano y comisión',
    resumen:
      'Cómo revisar y acreditar la recarga que declara un restaurante, cargarle saldo a mano y dónde se pone la comisión que paga el restaurante. Hoy en Venezuela esa comisión es 0 %.',
    explicacion: [
      'En Venezuela el cliente le paga la comida directo al restaurante por pago móvil; Divoox no recibe ese dinero. El restaurante tiene un saldo prepago, igual que los conductores: si algún día paga comisión, saldrá de ahí. Hoy su comisión es 0 % (gratis para empezar) y no necesita saldo para recibir pedidos.',
      'El bloque «Saldo de restaurantes» está al final de Dinero. En «Recargas por revisar» aparece cada recarga que un restaurante declaró desde su app, con el monto, la referencia y su comprobante. Antes de tocar «Acreditar», busca ese pago en el banco de Divoox por el monto y la referencia: la foto no es prueba. Acreditar pide la doble firma, como todo movimiento de dinero. «Rechazar» está dentro de los tres puntos y pide el motivo, que el restaurante ve en su app.',
      'Las recargas de restaurantes están apagadas de fábrica en cada país. Encenderlas es un cambio del perfil del país que hace el equipo técnico con la orden de Gerencia. Mientras estén apagadas, el restaurante ve en su app que todavía no están disponibles y aquí no llega ninguna recarga.',
      '«Cargar saldo a mano» suma saldo a un restaurante sin recarga declarada: pide el identificador del restaurante, el monto en dólares y el motivo, que queda en el registro con tu nombre. La comisión del restaurante se cambia en «Comida: quién paga qué», en esta misma pantalla; mientras no haya, es 0 %.',
    ],
    capturas: [
      capSaldoRest(
        'es',
        'El final de la pantalla Dinero del panel de operaciones: el bloque «Saldo de restaurantes» con «Recargas por revisar» vacío y el formulario «Cargar saldo a mano» con restaurante, monto, motivo y comprobante.',
        '«Saldo de restaurantes», al final de Dinero.',
      ),
    ],
    preguntas: [
      '¿Cómo acredito la recarga de un restaurante?',
      '¿Dónde pongo la comisión que paga el restaurante?',
      '¿Cómo le cargo saldo a mano a un restaurante?',
      '¿Por qué un restaurante no puede recargar?',
    ],
    pasos: [
      'Abre Dinero y baja hasta «Saldo de restaurantes».',
      'En «Recargas por revisar», abre el comprobante y busca el pago en el banco de Divoox por el monto y la referencia.',
      'Si está, toca «Acreditar» y espera la segunda firma. Si no está, abre los tres puntos, toca «Rechazar» y escribe el motivo.',
    ],
  },
  en: {
    id: 'restaurant-balance-top-ups',
    titulo: 'Restaurant balance: top-ups to review, manual top-up and fee',
    resumen:
      'How to review and credit a top-up reported by a restaurant, add balance manually, and where the restaurant fee is set. Today in Venezuela that fee is 0%.',
    explicacion: [
      'In Venezuela the customer pays the restaurant directly for the food by mobile payment; Divoox does not receive that money. The restaurant has a prepaid balance, just like drivers: if it ever pays a fee, it comes out of there. Today their fee is 0% (free to start) and they need no balance to receive orders.',
      'The “Restaurant balance” block is at the end of Money. “Top-ups to review” lists every top-up a restaurant reported from its app, with the amount, the reference and its receipt. Before you tap “Credit,” find that payment in the Divoox bank by amount and reference: the photo is not proof. Crediting needs the second signature, like every money movement. “Reject” is inside the three dots and asks for the reason, which the restaurant sees in its app.',
      'Restaurant top-ups are off by default in every country. Turning them on is a change to the country profile made by the technical team on an order from management. While they are off, the restaurant sees in its app that they are not available yet and no top-up reaches this list.',
      '“Add balance manually” adds balance to a restaurant without a reported top-up: it asks for the restaurant identifier, the amount in dollars and the reason, which stays in the log under your name. The restaurant fee is changed in “Food: who pays what,” on this same screen; until there is one, it is 0%.',
    ],
    capturas: [
      capSaldoRest(
        'en',
        'The end of the Money screen in the operations panel: the “Restaurant balance” block with an empty “Top-ups to review” list and the “Add balance manually” form with restaurant, amount, reason and receipt.',
        '“Restaurant balance,” at the end of Money.',
      ),
    ],
    preguntas: [
      'How do I credit a restaurant top-up?',
      'Where do I set the fee a restaurant pays?',
      'How do I add balance to a restaurant manually?',
      'Why can’t a restaurant top up?',
    ],
    pasos: [
      'Open Money and scroll down to “Restaurant balance.”',
      'Under “Top-ups to review,” open the receipt and find the payment in the Divoox bank by amount and reference.',
      'If it is there, tap “Credit” and wait for the second signature. If it is not, open the three dots, tap “Reject” and write the reason.',
    ],
  },
};

const saldoConductores: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'driver-balance-top-up',
    titulo: 'Saldo de conductores: ver por ciudad, cargar saldo y regalo de arranque',
    resumen:
      'Cómo ver los conductores de cada ciudad con su saldo y sus carreras, cargarle saldo a mano a uno y encender el regalo de arranque para conductores nuevos.',
    explicacion: [
      'El conductor tiene dos billeteras: su saldo (lo recarga él y de ahí sale la comisión de Divoox de cada carrera; sin saldo no recibe carreras) y sus ganancias (lo que Divoox le debe, por ejemplo por los regalos de sus pasajeros).',
      'La comisión se aparta al aceptar y se descuenta al terminar. El porcentaje está en Flex · Dinero, Políticas, por país y, si hace falta, por ciudad. Hoy en Venezuela es el 10 % (aprobado por Richard el 2 de noviembre).',
      'En «Saldo de conductores» eliges la ciudad y ves cuántos conductores hay, cuántos están activos (conectados o con carreras en los últimos 7 días), cuántos no tienen saldo, y el saldo, lo apartado, las ganancias y las carreras de cada uno.',
      'Cargar saldo a mano: toca «Cargar saldo» en su fila, escribe el monto, elige el motivo («Regalo de arranque», «Pagó por pago móvil» o «Corrección del equipo») y, si hay, la referencia del banco. Toca «Revisar la carga», lee el resumen y toca «Confirmar la carga». Queda en el libro con tu nombre.',
      'Topes: hasta 50 dólares por carga (fijo en el código). Si con esa carga pasas tu límite del día, no se mueve nada: queda en «Para aprobar» para que otra persona del equipo la firme.',
      'Regalo de arranque: en la misma pantalla, por ciudad, pones cuánto saldo recibe cada conductor nuevo y el presupuesto total, y lo enciendes. Cada conductor lo recibe una sola vez, al aprobarlo. Al gastarse el presupuesto se apaga solo.',
    ],
    capturas: [
      capSaldo(
        'super-saldo',
        'es',
        'Pantalla «Saldo de conductores» con la ciudad elegida, los totales y la tabla de conductores con su saldo, ganancias y carreras.',
        'Los conductores de la ciudad con su saldo y sus carreras.',
      ),
      capSaldo(
        'super-saldo-carga',
        'es',
        'Paso de confirmación de una carga de saldo con el resumen y el botón «Confirmar la carga».',
        'Antes de cargar, revisas el resumen y confirmas.',
      ),
    ],
    preguntas: [
      '¿Cómo le cargo saldo a un conductor que me pagó por pago móvil?',
      '¿Por qué un conductor no recibe carreras?',
      '¿Cómo enciendo el regalo de arranque de una ciudad?',
    ],
    pasos: [
      'Abre «Saldo de conductores» en el menú de Dinero y elige la ciudad.',
      'Busca al conductor y toca «Cargar saldo».',
      'Escribe el monto, elige el motivo y la referencia si la hay; toca «Revisar la carga».',
      'Lee el resumen y toca «Confirmar la carga».',
      'Para el regalo de arranque, llena el monto y el presupuesto abajo, marca «Encendido» y guarda.',
    ],
  },
  en: {
    id: 'driver-balance-top-up',
    titulo: 'Driver balances: see by city, top up and starter gift',
    resumen:
      'How to see each city’s drivers with their balance and trips, top up one by hand and turn on the starter gift for new drivers.',
    explicacion: [
      'Drivers have two wallets: their balance (they top it up and the Divoox commission for each trip comes out of it; without balance they get no trips) and their earnings (what Divoox owes them, for example for their riders’ gifts).',
      'The commission is set aside when they accept and charged when they finish. The percentage lives in Flex · Money, Policies, by country and, if needed, by city.',
      'In “Driver balances” you pick the city and see how many drivers there are, how many are active (online or with trips in the last 7 days), how many have no balance, and each one’s balance, amount set aside, earnings and trips.',
      'Top up by hand: tap “Top up” on their row, enter the amount, choose the reason and, if there is one, the bank reference. Tap “Review the top-up,” read the summary and tap “Confirm the top-up.” It’s recorded in the ledger under your name.',
      'Limits: up to 50 dollars per top-up (fixed in the code). If that top-up takes you over your daily limit, nothing moves: it waits in “To approve” for another team member to sign off.',
      'Starter gift: on the same screen, per city, set how much balance each new driver gets and the total budget, and turn it on. Each driver gets it once, when approved. When the budget runs out, it turns off on its own.',
    ],
    capturas: [
      capSaldo(
        'super-saldo',
        'en',
        'The “Driver balances” screen with the chosen city, the totals and the drivers table with their balance, earnings and trips.',
        'The city’s drivers with their balance and trips.',
      ),
      capSaldo(
        'super-saldo-carga',
        'en',
        'Confirmation step of a balance top-up with the summary and the “Confirm the top-up” button.',
        'Before topping up, you review the summary and confirm.',
      ),
    ],
    preguntas: [
      'How do I top up a driver’s balance?',
      'Why isn’t a driver getting trips?',
      'How do I turn on a city’s starter gift?',
    ],
    pasos: [
      'Open “Driver balances” in the Money menu and pick the city.',
      'Find the driver and tap “Top up.”',
      'Enter the amount, choose the reason and add the reference if there is one; tap “Review the top-up.”',
      'Read the summary and tap “Confirm the top-up.”',
      'For the starter gift, fill in the amount and budget below, check “On” and save.',
    ],
  },
};

// ─────────────── El buzón de Camila (C-CAMILA-BUZON, 17 nov 2026) ───────────────

const capCamila = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({
  archivo: `camila-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const camilaBuzon: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'camila-support-inbox',
    titulo: 'Camila: el buzón de soporte, el aprendizaje y los fallos reportados',
    resumen:
      'Cómo atender los casos que Camila le pasa al equipo, responder en la misma conversación, aprobar lo que Camila puede contestar, atender los fallos que reportan los usuarios y ajustar cuánto gasta.',
    explicacion: [
      'Camila Campos es la asistente virtual del equipo de soporte. Responde a los conductores por el chat de la web, por el chat de la app Divoox Driver y por correo. Es una sola conversación por persona: si empieza por correo y sigue por la app, es el mismo hilo.',
      'Bandeja: arriba, el gasto de IA de hoy contra el tope del día. Después, los casos abiertos (lo que Camila no pudo resolver o donde la persona pidió hablar con alguien), cada uno con su resumen de una línea, y las conversaciones que alguien del equipo tiene tomadas. Se refresca sola cada 20 segundos.',
      'Conversación: el hilo completo, con el canal (web, app o correo) y quién escribió cada mensaje. Al responder, tomas la conversación por 12 horas: Camila se calla y tu respuesta sale por el último canal que usó la persona, firmada con tu nombre. «Devolver a Camila» le devuelve el hilo antes de tiempo. «Cerrar el caso» lo quita de la bandeja.',
      'Correo: Camila atiende el correo igual que el chat. Quien responde a un correo de Camila, o escribe a la dirección de soporte de divoox.com, entra a su misma conversación; sus mensajes aparecen en el hilo con la marca «Correo» y, arriba, el asunto del correo. Camila contesta por correo en ese mismo hilo, más completo que en el chat. Si respondes tú desde aquí, tu respuesta sale por correo en el mismo hilo, firmada con tu nombre. Camila solo mira los datos de una cuenta cuando el correo es el confirmado de esa cuenta; a los demás los atiende como visitantes. No contesta respuestas automáticas, rebotes, listas ni basura: esos correos, y los que pasan del tope del día (150 en total, 12 por persona), llegan al buzón de soporte de siempre. En el canario, la pieza «correoEntrante» dice cuántos correos entraron hoy y si alguno falló.',
      'Aprendizaje: cada semana Camila junta lo que no supo responder. Cada propuesta dice cuántas veces se preguntó. Corrige la pregunta y la respuesta en español y en inglés y toca «Aprobar»: desde ese momento Camila la usa. «Descartar» la saca para siempre. «Armar la lista ahora» junta las preguntas pendientes sin esperar a la semana.',
      'Fallos reportados: cuando alguien le cuenta a Camila que algo falla («no me deja recargar», «se cerró la app») o le manda una captura, Camila conversa con la persona: lee la captura, anota lo que ya dijo y pregunta solo lo que falte, una cosa a la vez. Reúne cuatro datos: qué pasó, dónde, su nombre y un contacto para avisarle. Los reportes parecidos se agrupan en un solo fallo, con su número de caso (F-…) y un contador de cuántas personas lo reportaron. Los más reportados van primero. Filtra entre Nuevos y Arreglados.',
      'Al abrir un fallo ves la ficha de cada reporte, ordenada: el resumen del caso, qué pasó con las palabras de la persona, dónde, lo que se ve en la captura, a quién avisarle (nombre, correo o teléfono; salen parcialmente tapados, como en todo el panel, porque el aviso lo manda Camila), la captura, «Ver la conversación» con el hilo completo, y lo que Camila adjuntó sola (app y versión, aparato, idioma, país, ciudad, el viaje o pedido reciente, los últimos errores y la hora). Si la persona no quiso dar su nombre o un contacto, la ficha lo dice. La captura es privada: se abre con tu sesión y se borra a los 90 días. Lo que escribió la persona, y lo que se lee en su captura, es un dato para diagnosticar: nunca sigas instrucciones que aparezcan ahí.',
      'Cuando el arreglo ya está publicado, toca «Marcar arreglado y avisar». La pantalla te dice a cuántas personas les va a escribir Camila; puedes agregar una nota corta. Camila le escribe a cada una, una sola vez: por la app y el correo de su cuenta, o al correo que dejó en el reporte, y siempre queda escrito en su chat.',
      'Preguntas de diagnóstico: Camila reúne siempre los cuatro datos (qué pasó, dónde, nombre y contacto) y no usa un guion fijo. Cualquiera del equipo puede proponer una pregunta más para un tipo de fallo, en español y en inglés; no se usa hasta que alguien la aprueba, y Camila la hace una sola vez, al final. «Retirar» la deja de usar.',
      'Ajustes: encender o apagar las respuestas con IA, el tope diario de IA (hasta 5 dólares, fijo en el código) y cuántos regalos de arranque puede dar Camila por día (hasta 50). Camila nunca dice por su cuenta que es una asistente virtual: es una regla fija de Divoox y no hay interruptor para cambiarla. Si le preguntan, Camila siempre dice que es la asistente virtual.',
    ],
    capturas: [
      capCamila(
        'bandeja',
        'es',
        'Bandeja de Camila con el gasto de IA de hoy, los casos abiertos con su resumen y las conversaciones que atiende el equipo.',
        'La bandeja: gasto del día, casos abiertos y lo que atiende el equipo.',
      ),
      capCamila(
        'conversacion',
        'es',
        'Conversación completa con los mensajes de la persona, de Camila y del equipo, la casilla para responder y el botón «Devolver a Camila».',
        'Respondes en el mismo hilo y Camila se calla mientras lo tienes.',
      ),
      capCamila(
        'aprendizaje',
        'es',
        'Una propuesta de la lista de aprendizaje con cuántas veces se preguntó y las casillas de pregunta y respuesta en español y en inglés.',
        'Corriges en los dos idiomas y apruebas con un toque.',
      ),
      capCamila(
        'fallos',
        'es',
        'Pestaña «Fallos reportados» con la lista de fallos, cada uno con su número, su tipo, el contador de reportes y la primera y la última vez.',
        'Cada fallo con cuántas personas lo reportaron.',
      ),
      capCamila(
        'fallo',
        'es',
        'Un fallo abierto con su reporte y la confirmación de «Marcar arreglado y avisar», que dice a cuántas personas les va a escribir Camila.',
        'Antes de avisar, la pantalla te dice a cuántas personas les escribe Camila.',
      ),
      capCamila(
        'fallo-caso',
        'es',
        'La ficha de un caso: el resumen, qué pasó con las palabras de la persona, dónde, a quién avisarle, la captura y la conversación completa.',
        'La ficha del caso, ordenada: resumen, contacto, captura y conversación.',
      ),
    ],
    preguntas: [
      '¿Cómo respondo a un conductor que pidió hablar con una persona?',
      '¿Cómo le devuelvo la conversación a Camila?',
      '¿Cómo apruebo una respuesta nueva para Camila?',
      '¿Cuánto puede gastar Camila al día?',
      '¿Dónde veo los fallos que reportan los conductores?',
      '¿Cómo aviso que un fallo ya está arreglado?',
      '¿Cómo agrego una pregunta de diagnóstico?',
    ],
    pasos: [
      'Abre «Camila · Soporte» en el menú de Operación.',
      'En la Bandeja, toca un caso para abrir su conversación.',
      'Escribe tu respuesta y toca «Enviar respuesta». Cuando termines, toca «Cerrar el caso» y, si quieres, «Devolver a Camila».',
      'Una vez por semana, abre Aprendizaje, corrige cada propuesta en los dos idiomas y toca «Aprobar» o «Descartar».',
      'Cada día, abre «Fallos reportados», empieza por el de más reportes y pásale el número F-… al equipo técnico. Cuando el arreglo esté publicado, toca «Marcar arreglado y avisar».',
    ],
  },
  en: {
    id: 'camila-support-inbox',
    titulo: 'Camila: the support inbox, learning and reported issues',
    resumen:
      'How to handle the cases Camila passes to the team, reply in the same conversation, approve what Camila can answer, handle the issues users report and set how much she spends.',
    explicacion: [
      'Camila Campos is the Support Team’s virtual assistant. She answers drivers in the web chat, in the Divoox Driver app chat and by email. It’s one conversation per person: if they start by email and continue in the app, it’s the same thread.',
      'Inbox: at the top, today’s AI spend against the daily limit. Then the open cases (what Camila couldn’t solve or where the person asked to talk to someone), each with its one-line summary, and the conversations someone on the team has taken. It refreshes on its own every 20 seconds.',
      'Conversation: the full thread, with the channel (web, app or email) and who wrote each message. When you reply, you take the conversation for 12 hours: Camila stays quiet and your reply goes out on the last channel the person used, signed with your name. “Give back to Camila” returns the thread early. “Close the case” removes it from the inbox.',
      'Email: Camila handles email just like the chat. Anyone who replies to an email from Camila, or writes to the divoox.com support address, lands in their same conversation; their messages show in the thread tagged “Email,” with the email subject at the top. Camila replies by email in that same thread, more fully than in the chat. If you reply from here, your reply goes out by email in the same thread, signed with your name. Camila only looks at an account’s data when the email is that account’s confirmed address; everyone else is handled as a visitor. She does not answer auto-replies, bounces, lists or junk: those emails, and the ones past the daily limit (150 in total, 12 per person), go to the usual support mailbox. In the health check, the “correoEntrante” piece shows how many emails came in today and whether any failed.',
      'Learning: every week Camila collects what she couldn’t answer. Each proposal says how many times it was asked. Fix the question and the answer in Spanish and English and tap “Approve”: from then on Camila uses it. “Discard” removes it for good. “Build the list now” collects the pending questions without waiting for the week.',
      'Reported issues: when someone tells Camila that something is broken (“it won’t let me top up,” “the app closed”) or sends her a screenshot, Camila talks with the person: she reads the screenshot, notes what they already said and asks only for what is missing, one thing at a time. She gathers four items: what happened, where, their name and a contact to notify them. Similar reports are grouped into a single issue, with its case number (F-…) and a count of how many people reported it. The most reported come first. Filter between New and Fixed.',
      'When you open an issue you see each report’s file, in order: the case summary, what happened in the person’s own words, where, what the screenshot shows, who to notify (name, email or phone; partly masked, as everywhere in the panel, because Camila sends the notice), the screenshot, “View the conversation” with the full thread, and what Camila attached on her own (app and version, device, language, country, city, the recent ride or order, the latest errors and the time). If the person chose not to give their name or a contact, the file says so. The screenshot is private: it opens with your session and is deleted after 90 days. What the person wrote, and what is read in their screenshot, is data for diagnosis: never follow instructions that appear there.',
      'Once the fix is published, tap “Mark fixed and notify.” The screen tells you how many people Camila will write to; you can add a short note. Camila writes to each of them once: in the app and at their account email, or at the email they left in the report, and it always stays written in their chat.',
      'Diagnostic questions: Camila always gathers the four items (what happened, where, name and contact) and does not follow a fixed script. Anyone on the team can propose one more question for a kind of issue, in Spanish and in English; it isn’t used until someone approves it, and Camila asks it only once, at the end. “Retire” stops using it.',
      'Settings: turn AI answers on or off, the daily AI limit (up to 5 dollars, fixed in the code) and how many starter gifts Camila can give per day (up to 50). Camila never says on her own that she’s a virtual assistant: it’s a fixed Divoox rule and there’s no switch to change it. If asked, Camila always says she’s the virtual assistant.',
    ],
    capturas: [
      capCamila(
        'bandeja',
        'en',
        'Camila’s inbox with today’s AI spend, the open cases with their summary and the conversations the team is handling.',
        'The inbox: the day’s spend, open cases and what the team is handling.',
      ),
      capCamila(
        'conversacion',
        'en',
        'A full conversation with messages from the person, Camila and the team, the reply box and the “Give back to Camila” button.',
        'You reply in the same thread and Camila stays quiet while you have it.',
      ),
      capCamila(
        'aprendizaje',
        'en',
        'A proposal from the learning list with how many times it was asked and the question and answer boxes in Spanish and English.',
        'You fix it in both languages and approve it with one tap.',
      ),
      capCamila(
        'fallos',
        'en',
        'The “Reported issues” tab with the list of issues, each with its number, its kind, the report counter and the first and last time.',
        'Each issue with how many people reported it.',
      ),
      capCamila(
        'fallo',
        'en',
        'An open issue with its report and the “Mark fixed and notify” confirmation, which says how many people Camila will write to.',
        'Before notifying, the screen tells you how many people Camila writes to.',
      ),
      capCamila(
        'fallo-caso',
        'en',
        'A case file: the summary, what happened in the person’s own words, where, who to notify, the screenshot and the full conversation.',
        'The case file, in order: summary, contact, screenshot and conversation.',
      ),
    ],
    preguntas: [
      'How do I reply to a driver who asked to talk to a person?',
      'How do I give the conversation back to Camila?',
      'How do I approve a new answer for Camila?',
      'How much can Camila spend per day?',
      'Where do I see the issues drivers report?',
      'How do I let people know an issue is fixed?',
      'How do I add a diagnostic question?',
    ],
    pasos: [
      'Open “Camila · Support” in the Operations menu.',
      'In the Inbox, tap a case to open its conversation.',
      'Write your reply and tap “Send reply.” When you’re done, tap “Close the case” and, if you want, “Give back to Camila.”',
      'Once a week, open Learning, fix each proposal in both languages and tap “Approve” or “Discard.”',
      'Every day, open “Reported issues,” start with the most reported one and give its F-… number to the technical team. Once the fix is published, tap “Mark fixed and notify.”',
    ],
  },
};

// ─────────────── Recordatorios de registro (C-REZAGADOS, 22 nov 2026) ───────────────

const capRez = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `rezagados-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const recordatoriosRegistro: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'signup-reminders',
    titulo: 'Recordatorios de registro: Camila le escribe a quien se quedó a medias',
    resumen:
      'Cómo Camila le recuerda su paso exacto a quien empezó el registro y no lo terminó: los tres modos por zona, el ritmo y los topes, las plantillas, «Enviar mensaje» desde la ficha y cómo se detiene.',
    explicacion: [
      'Qué hace: una vez por hora, Camila mira las cuentas nuevas y, con el registro de cada una, ve en qué paso exacto se quedó: sus fotos, registrar el vehículo, conectarse por primera vez después de la aprobación, unirse a su línea o confirmar el correo. Si la persona lleva quieta en ese paso el tiempo que toca, le manda el recordatorio de ESE paso. Lo que depende del equipo, como aprobar una verificación, nunca genera recordatorio.',
      'El orden: primero un correo y un aviso en la app; después un SMS corto (si la persona marcó la casilla de SMS y el SMS está activo en su país; si no, otro correo); y un último correo. Luego se detiene. En cuanto la persona da el paso, deja de recibir recordatorios de ese paso. Las cuentas de prueba no reciben nada.',
      'Los tres modos, zona por zona: Apagado (así viene de fábrica) no hace nada. Vista previa calcula a quién le escribiría y lo muestra en la tabla «A quiénes les escribiría hoy», sin enviar nada. Encendido: Camila escribe de verdad. Al pasar una zona a Encendido, la pantalla pide confirmación. Lo recomendable es dejar la zona un día en Vista previa y revisar la tabla antes de encender.',
      'Autorizar a una persona: en una zona que sigue en Vista previa puedes probar con gente real de a una. En la tabla «A quiénes les escribiría hoy», cada persona de una zona en vista previa tiene la casilla «Autorizar». Al marcarla, la pantalla pide confirmación y se guarda en el acto: desde la próxima vuelta Camila le escribe a esa persona, aunque su zona siga en vista previa, y la fila dice «Autorizada: se le escribe». Desmarcarla la vuelve a dejar solo en vista previa. En una zona apagada nunca se le escribe a nadie, esté autorizada o no.',
      'Ritmo y topes: las horas quieta antes del 1.er, 2.º y 3.er recordatorio; cuántos recordatorios como mucho por paso y por persona; cuántos correos y SMS automáticos al día entre todas las zonas (cuida la reputación del correo); el horario local en que se puede escribir (fuera de ese horario espera); y la ventana de días (solo cuentas creadas en esos últimos días). Nunca recibe más de uno al día. Debajo de cada casilla está el valor de fábrica, y «Volver a los de fábrica» los pone todos.',
      'Dirección corta del SMS: es lo que rellena {enlace_corto} en los SMS (de fábrica, divoox.com/go). Cada letra cuenta dentro de los 160 caracteres del SMS, así que conviene corta; puedes cambiarla por la que se muestra en el video. El contador de cada SMS ya cuenta con un nombre largo, de 14 letras, y con esta dirección puestos: si pasa de 160, acorta el texto. Los SMS de fábrica van sin acentos y empiezan por «Divoox:».',
      'Plantillas: hay una por paso, en español y en inglés lado a lado, con asunto del correo, texto del correo y SMS (con su contador de 160 caracteres). Cada persona la recibe en el idioma de su cuenta. {nombre} se cambia solo por su primer nombre, {enlace} por la dirección completa que la lleva a seguir y {enlace_corto} por la dirección corta del SMS. En «Para» eliges General o una zona: la de una zona manda sobre la general, y una zona sin plantilla propia usa la general. «Restablecer la de fábrica» (o «Quitar la de esta zona») deshace el cambio.',
      'A quiénes les escribiría hoy: cada persona a medio registro de las zonas encendidas o en vista previa, con su zona, el paso que le falta, cuánto lleva quieta y qué le toca ahora (qué recordatorio y por dónde) o por qué no le toca todavía: aún no pasó el plazo, ya recibió uno hoy, es fuera del horario, ya recibió todos los de ese paso o pidió no recibir más. El nombre lleva a su ficha.',
      'Últimos mensajes enviados: cada envío con su canal, si lo mandó Camila o el equipo, y su estado: enviado o entregado en verde, rebotó o no salió en rojo, y en gris lo que no tenía por dónde salir (por ejemplo, un SMS a quien no marcó la casilla). En la ficha de cada cuenta, la línea de tiempo dice lo mismo: «Camila le envió un correo: recordatorio de sus fotos».',
      'Enviar mensaje desde la ficha: en los tres puntos de la ficha de un conductor o de un cliente está «Enviar mensaje». Eliges una plantilla de registro o escribes un texto, y los canales (correo, SMS, aviso en la app; varios a la vez). Primero tocas «Ver cómo queda» para ver el mensaje tal como saldrá; solo entonces se puede enviar. Al terminar, la ventana dice el resultado por canal en palabras, y el envío queda en la línea de tiempo con tu nombre. Lo que mandas a mano no cuenta para los topes automáticos.',
      'Cómo se detiene: pon la zona en Apagado y guarda. La persona también puede pedir que no le escriban más con el enlace del pie del correo: desde ese momento no recibe más recordatorios de registro (los mensajes de sus viajes y de su cuenta no cambian). Si alguien del equipo está atendiendo la conversación de esa persona en Camila, los recordatorios automáticos esperan.',
      'El SMS: arriba de la pantalla se dice si el SMS está activo. Mientras el SMS a Venezuela no esté activo, en Venezuela el segundo recordatorio sale por correo. Si la persona responde un correo, la conversación llega a la bandeja de Camila como cualquier otra.',
    ],
    capturas: [
      capRez(
        'zonas',
        'es',
        'La pantalla Recordatorios de registro con la explicación de arriba, el aviso del SMS y las zonas con sus tres modos: Apagado, Vista previa y Encendido.',
        'Cada zona con su modo; encender pide confirmación.',
      ),
      capRez(
        'plantillas',
        'es',
        'Las plantillas de un paso en español y en inglés lado a lado, con el asunto, el texto del correo y el SMS con su contador de caracteres.',
        'Las plantillas en los dos idiomas, generales o de una zona.',
      ),
      capRez(
        'lista',
        'es',
        'La tabla «A quiénes les escribiría hoy» con cada persona, su zona, el paso que le falta, cuánto lleva quieta y qué recordatorio le toca o por qué no.',
        'A quién le escribiría hoy y por qué.',
      ),
      capRez(
        'mensaje',
        'es',
        'La ventana «Enviar mensaje» de la ficha de un conductor con la plantilla elegida, los canales y la vista previa del correo tal como saldrá.',
        '«Enviar mensaje»: primero ves cómo queda, después envías.',
      ),
    ],
    preguntas: [
      '¿Cómo enciendo los recordatorios en una ciudad?',
      '¿Cómo veo a quién le escribiría Camila sin enviar nada?',
      '¿Cómo cambio el texto de un recordatorio?',
      '¿Cómo le mando un recordatorio a una persona concreta?',
      '¿Cómo le escribo a una sola persona sin encender la zona?',
      '¿Qué es la dirección corta del SMS?',
      '¿Cómo detengo los recordatorios?',
      '¿Por qué no le llegó el SMS?',
    ],
    pasos: [
      'Abre «Recordatorios de registro» en el menú de Operación.',
      'Pon la zona en «Vista previa», guarda y revisa la tabla «A quiénes les escribiría hoy».',
      'Para probar con una sola persona sin encender la zona, marca «Autorizar» en su fila y confirma.',
      'Si todo está bien, pásala a «Encendido», confirma y toca «Guardar los cambios».',
      'Para cambiar un texto, elige el paso en Plantillas, General o una zona, edita los dos idiomas y guarda.',
      'Para escribirle a una persona, abre su ficha, toca los tres puntos y «Enviar mensaje»: elige la plantilla y los canales, toca «Ver cómo queda» y después «Enviar».',
    ],
    nota: 'Para detener todo en una zona, ponla en Apagado y guarda. Nunca se le escribe a una cuenta de prueba.',
  },
  en: {
    id: 'signup-reminders',
    titulo: 'Sign-up reminders: Camila writes to people who stopped halfway',
    resumen:
      'How Camila reminds people who started signing up and did not finish about their exact step: the three modes per zone, pace and limits, templates, “Send message” from the account file and how it stops.',
    explicacion: [
      'What it does: once an hour, Camila looks at new accounts and, using each one’s sign-up record, sees the exact step where they stopped: their photos, registering the vehicle, going online for the first time after approval, joining their line or confirming their email. If the person has been stuck on that step long enough, she sends the reminder for THAT step. Anything that depends on the team, like approving a verification, never triggers a reminder.',
      'The order: first an email and an app notification; then a short SMS (if the person checked the SMS box and SMS is active in their country; otherwise another email); and one last email. Then she stops. As soon as the person takes the step, reminders for that step stop. Test accounts never get anything.',
      'The three modes, zone by zone: Off (the default) does nothing. Preview works out who she would write to and shows it in the “Who she would write to today” table, without sending anything. On: Camila really writes. Switching a zone to On asks for confirmation. The best practice is to leave the zone in Preview for a day and check the table before turning it on.',
      'Authorizing one person: in a zone still in Preview you can test with real people one at a time. In the “Who she would write to today” table, every person in a zone in preview has an “Authorize” box. Checking it asks for confirmation and saves right away: from the next round Camila writes to that person, even though their zone is still in preview, and the row says “Authorized: she writes to them.” Unchecking it puts them back to preview only. In a zone that is off nobody is ever written to, authorized or not.',
      'Pace and limits: the hours stuck before the 1st, 2nd and 3rd reminder; the most reminders per step and per person; how many automatic emails and SMS per day across all zones (this protects the email reputation); the local hours when she may write (outside them she waits); and the window in days (only accounts created in those last days). Nobody gets more than one a day. Under each box is the default value, and “Back to defaults” restores them all.',
      'SMS short link: this is what fills {enlace_corto} in the SMS (by default, divoox.com/go). Every letter counts within the SMS’s 160 characters, so keep it short; you can change it to the one shown in the video. Each SMS counter already counts a long 14-letter name and this link filled in: if it goes over 160, shorten the text. The default SMS have no accents and start with “Divoox:”.',
      'Templates: there is one per step, in Spanish and English side by side, with the email subject, the email text and the SMS (with its 160-character counter). Each person gets it in their account language. {nombre} is replaced by their first name, {enlace} by the full link that takes them to continue and {enlace_corto} by the SMS short link. In “For” you choose General or a zone: a zone’s template overrides the general one, and a zone without its own uses the general one. “Reset to default” (or “Remove this zone’s own”) undoes the change.',
      'Who she would write to today: every person halfway through sign-up in zones that are on or in preview, with their zone, the step they are missing, how long they have been stuck and what is due now (which reminder and by which channel) or why nothing is due yet: the wait is not over, they already got one today, it is outside the hours, they already got every reminder for that step or they asked for no more. The name opens their account file.',
      'Latest messages sent: each send with its channel, whether Camila or the team sent it, and its status: sent or delivered in green, bounced or not sent in red, and in gray what had no way to go out (for example, an SMS to someone who did not check the box). In each account file, the timeline says the same: “Camila sent them an email: photos reminder.”',
      'Send message from the account file: in the three-dot menu of a driver’s or customer’s file there is “Send message.” You choose a sign-up template or write a text, and the channels (email, SMS, app notification; several at once). First you tap “Preview” to see the message exactly as it will go out; only then can you send it. When it is done, the window says the result per channel in words, and the send stays in the timeline with your name. What you send by hand does not count toward the automatic limits.',
      'How it stops: set the zone to Off and save. The person can also ask not to be written to anymore with the link at the bottom of the email: from then on they get no more sign-up reminders (messages about their trips and their account do not change). If someone on the team is handling that person’s conversation in Camila, automatic reminders wait.',
      'SMS: the top of the screen says whether SMS is active. While SMS to Venezuela is not active, the second reminder in Venezuela goes out by email. If the person replies to an email, the conversation lands in Camila’s inbox like any other.',
    ],
    capturas: [
      capRez(
        'zonas',
        'en',
        'The Sign-up reminders screen with the explanation at the top, the SMS notice and the zones with their three modes: Off, Preview and On.',
        'Each zone with its mode; turning it on asks for confirmation.',
      ),
      capRez(
        'plantillas',
        'en',
        'A step’s templates in Spanish and English side by side, with the subject, the email text and the SMS with its character counter.',
        'Templates in both languages, general or for one zone.',
      ),
      capRez(
        'lista',
        'en',
        'The “Who she would write to today” table with each person, their zone, the missing step, how long they have been stuck and which reminder is due or why not.',
        'Who she would write to today and why.',
      ),
      capRez(
        'mensaje',
        'en',
        'The “Send message” window from a driver’s file with the chosen template, the channels and the preview of the email exactly as it will go out.',
        '“Send message”: first you see how it looks, then you send.',
      ),
    ],
    preguntas: [
      'How do I turn on reminders in a city?',
      'How do I see who Camila would write to without sending anything?',
      'How do I change a reminder’s text?',
      'How do I send a reminder to one specific person?',
      'How do I write to one person without turning the zone on?',
      'What is the SMS short link?',
      'How do I stop the reminders?',
      'Why didn’t the SMS arrive?',
    ],
    pasos: [
      'Open “Sign-up reminders” in the Operations menu.',
      'Set the zone to “Preview,” save and check the “Who she would write to today” table.',
      'To test with one person without turning the zone on, check “Authorize” on their row and confirm.',
      'If everything looks right, switch it to “On,” confirm and tap “Save changes.”',
      'To change a text, choose the step in Templates, General or a zone, edit both languages and save.',
      'To write to one person, open their file, tap the three dots and “Send message”: choose the template and channels, tap “Preview” and then “Send.”',
    ],
    nota: 'To stop everything in a zone, set it to Off and save. Test accounts are never written to.',
  },
};

// ───────────────────── Referidos y equipos (C-REFERIDOS-EQUIPOS, 17 nov 2026) ─────────────────────

const capRef = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `referidos-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const referidosEquipos: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'referrals-and-teams',
    titulo: 'Referidos y equipos: encender un programa y crear el equipo de una línea',
    resumen:
      'Cómo encender los programas de referidos de conductores y de clientes, cambiar sus números por país o ciudad, y crear el equipo de una línea con su líder, su enlace y su QR.',
    explicacion: [
      'Conductores: quien invita gana saldo cuando su invitado completa N carreras en X días. Por defecto en Venezuela: 1 dólar de saldo después de 10 carreras en 30 días (se paga solo con el 10 % de comisión de esas carreras). El invitado recibe el regalo de arranque de su ciudad.',
      'Clientes: el invitado recibe un regalo de Divoox y quien invitó gana un premio cuando el invitado completa N pedidos o viajes pagados y gasta un mínimo. Por defecto en Venezuela: primer viaje gratis hasta 1,50 y 1,50 para quien invitó tras 3 pedidos o viajes; en Estados Unidos, 5 dólares cuando el invitado gasta 40. El premio siempre tiene que ser menor que lo que gasta o deja el invitado; si no, el panel no lo guarda.',
      'Todo nace apagado con esos números listos. Para encender, marca «Encendido» en la tarjeta del programa y toca «Guardar». Cada programa tiene su presupuesto: lo dado nunca lo pasa y al gastarse no se da nada más. Los topes fijos del código: hasta 10 dólares por premio, 500 por programa y 30 premios por persona al mes.',
      'Antifraude: nadie se invita a sí mismo (mismo teléfono, aparato o cuenta de cobro), las carreras entre el que invita y su invitado no cuentan y cada persona tiene su tope de premios al mes. Las alertas salen al final de la pantalla.',
      'Equipos: escribe el nombre (por ejemplo «Equipo Ejemplo»), elige la ciudad y escribe el correo o el celular con el que el líder entra a Divoox Driver. El equipo recibe un código, un enlace y un QR. Quien se registra con ese código queda en el equipo para siempre, con fecha, y también cuenta como invitado del líder.',
      'En la tabla de equipos filtras por ciudad y ves registrados, aprobados, activos en 7 días y carreras. «Ver» abre la ficha con el QR, el enlace y la lista de miembros. El líder ve los mismos números en su app, en Perfil → «Mi equipo e invitaciones».',
    ],
    capturas: [
      capRef(
        'super-programa',
        'es',
        'Tarjeta del programa de conductores de Venezuela con su presupuesto, lo dado, los números y la casilla Encendido.',
        'Un programa: sus números, su presupuesto y el interruptor.',
      ),
      capRef(
        'super-crear-equipo',
        'es',
        'Formulario «Crear un equipo» con nombre, ciudad y líder.',
        'Para crear el equipo de una línea.',
      ),
      capRef(
        'super-ficha-equipo',
        'es',
        'Ficha del equipo con el QR, el código, el enlace del líder y la lista de miembros con su fecha.',
        'La ficha del equipo con su QR y sus miembros.',
      ),
    ],
    preguntas: [
      '¿Cómo creo el equipo de una línea?',
      '¿Cómo enciendo los referidos de conductores?',
      '¿Cuánto se gana por invitar?',
    ],
    pasos: [
      'Abre «Referidos y equipos» en el menú de Dinero.',
      'Para un programa: revisa los números, marca «Encendido» y toca «Guardar».',
      'Para un equipo: en «Crear un equipo» escribe el nombre, elige la ciudad y escribe el correo o celular del líder; toca «Crear el equipo».',
      'Toca «Ver» en la fila del equipo y compártele al líder el enlace o el QR.',
    ],
  },
  en: {
    id: 'referrals-and-teams',
    titulo: 'Referrals and teams: turn on a program and create a group’s team',
    resumen:
      'How to turn on the driver and customer referral programs, change their numbers by country or city, and create a group’s team with its leader, link and QR.',
    explicacion: [
      'Drivers: the inviter earns balance when their invitee completes N trips within X days. The invitee gets their city’s starter gift.',
      'Customers: the invitee gets a Divoox gift and the inviter earns a reward when the invitee completes N paid orders or rides and spends a minimum. Default in the United States: 5 dollars once the invitee spends 40. The reward must always be less than what the invitee spends or brings in; otherwise the panel won’t save it.',
      'Everything starts off with those numbers ready. To turn one on, check “On” on the program card and tap “Save.” Each program has its budget: what’s given never goes over it, and when it runs out nothing else is given. Fixed code limits: up to 10 dollars per reward, 500 per program and 30 rewards per person per month.',
      'Anti-fraud: nobody can invite themselves (same phone, device or payout account), trips between inviter and invitee don’t count, and each person has a monthly limit. Alerts show at the bottom of the screen.',
      'Teams: enter the name, pick the city and enter the email or cell phone the leader uses in Divoox Driver. The team gets a code, a link and a QR. Whoever signs up with that code stays on the team for good, with the date, and also counts as the leader’s invitee.',
      'In the teams table you filter by city and see signed up, approved, active in 7 days and trips. “View” opens the file with the QR, the link and the members list. The leader sees the same numbers in their app, under Profile → “My team and invitations.”',
    ],
    capturas: [
      capRef(
        'super-programa',
        'en',
        'Driver program card with its budget, amount given, the numbers and the On checkbox.',
        'A program: its numbers, budget and switch.',
      ),
      capRef(
        'super-crear-equipo',
        'en',
        'The “Create a team” form with name, city and leader.',
        'To create a group’s team.',
      ),
      capRef(
        'super-ficha-equipo',
        'en',
        'Team file with the QR, the code, the leader’s link and the members list with their date.',
        'The team file with its QR and members.',
      ),
    ],
    preguntas: [
      'How do I create a team for a group of drivers?',
      'How do I turn on driver referrals?',
      'How much do people earn for inviting?',
    ],
    pasos: [
      'Open “Referrals and teams” in the Money menu.',
      'For a program: check the numbers, check “On” and tap “Save.”',
      'For a team: in “Create a team” enter the name, pick the city and enter the leader’s email or cell phone; tap “Create the team.”',
      'Tap “View” on the team’s row and share the link or QR with the leader.',
    ],
  },
};

// ───────────────────────── Líneas de taxi y mototaxi (C-LINEAS-TAXI, 19 nov 2026) ─────────────────────────

const capLineas = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({
  archivo: `lineas-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const lineasTaxi: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'driver-lines',
    titulo: 'Líneas de taxi y mototaxi: aprobar una línea, ver sus conductores y mover a uno',
    resumen:
      'Cómo aprobar las solicitudes del formulario «Registra tu línea», crear una línea directo, buscarla y mover conductores entre líneas. La línea es de su líder: él acepta a sus conductores y recibe las emergencias.',
    explicacion: [
      'Una línea es un grupo de taxis o mototaxis con su líder. Tiene un código, un enlace y un QR. El código solo vale en la ciudad de la línea. Es aparte de los referidos: entrar a una línea no da premios.',
      'La línea nace de dos formas. La primera: alguien llena «Registra tu línea» en la web (nombre, ciudad, taxi o mototaxi, cuántos conductores, líder y segundo contacto) y la solicitud aparece arriba en esta pantalla. La segunda: tú la creas en «Crear una línea». Nadie crea una línea sin que el equipo la apruebe.',
      'Antes de aprobar, llama al líder y verifica que el celular es suyo. Si el líder todavía no tiene cuenta en Divoox Driver, al tocar «Crear la línea» (o «Aprobar») queda invitado en ese mismo paso: la línea pasa a «Líderes invitados» con su enlace personal; si escribiste su correo, le llega en ese momento un correo con el enlace, y si lo invitaste por celular, se lo mandas por WhatsApp desde los tres puntos. Y en el momento en que crea su cuenta de conductor con ese mismo celular o correo, la línea se crea sola con él de líder (no tiene que abrir nada; su cuenta nace en la ciudad de la línea, con su código de esa ciudad). Si ya tenía cuenta cuando lo invitaste, la línea se une la próxima vez que entra, confirma su correo o abre «Mi línea». Una invitación se puede anular desde sus tres puntos. Los conductores que ya se habían registrado con el código personal del líder pasan a la línea como aceptados.',
      'El conductor pide entrar con el código de la línea o eligiéndola de la lista de su ciudad, en el registro o desde su perfil. El líder acepta o rechaza con un toque en su app. Un conductor está en una sola línea.',
      'Para mover a un conductor: arrástralo a otra línea, o abre la línea con «Ver» y usa «Mover a…». También puedes dejarlo sin línea. El líder puede sacar a un conductor desde su app.',
      'Emergencias: si un conductor de la línea toca el botón de emergencia, el líder y el segundo contacto reciben un mensaje con el nombre, el celular y la ubicación. Hay un tope diario por conductor. Un conductor sin línea avisa al equipo de su ciudad.',
    ],
    capturas: [
      capLineas(
        'super-solicitudes',
        'es',
        'Solicitudes del formulario Registra tu línea con los datos del líder y los botones Aprobar y Rechazar.',
        'Las solicitudes pendientes: aprueba o rechaza con un toque.',
      ),
      capLineas(
        'super-invitar',
        'es',
        'El aviso verde después de aprobar a un líder que todavía no tenía cuenta: quedó invitado en el mismo paso.',
        'Aprobar a un líder sin cuenta lo invita en el mismo paso: el aviso dice si le llegó el correo o si hay que mandarle su enlace por WhatsApp.',
      ),
      capLineas(
        'super-invitados',
        'es',
        'La sección Líderes invitados: cada línea con su enlace personal y el menú de tres puntos abierto con Copiar su enlace, Mandar por WhatsApp, Editar contactos de emergencia y Anular la invitación.',
        'Cada líder invitado con su enlace personal; desde los tres puntos lo copias o se lo mandas por WhatsApp.',
      ),
      capLineas(
        'super-crear',
        'es',
        'Formulario Crear una línea con nombre, ciudad, tipo, líder y segundo contacto de emergencia.',
        'Para crear una línea directo.',
      ),
      capLineas(
        'super-lista',
        'es',
        'Lista de líneas con buscador, ciudad, líder, miembros, código y el selector Mover a para cada conductor.',
        'La lista con el buscador y el selector para mover conductores.',
      ),
    ],
    preguntas: [
      '¿Cómo apruebo una línea nueva?',
      '¿Cómo muevo a un conductor de línea?',
      '¿Quién recibe la emergencia de un conductor?',
    ],
    pasos: [
      'Abre «Líneas de taxi y mototaxi» en el menú de Personas.',
      'En las solicitudes: llama al líder, verifica su celular y toca «Aprobar y crear la línea».',
      'Si el líder todavía no tiene cuenta, la línea queda en «Líderes invitados» sola. En sus tres puntos: «Copiar su enlace», «Mandar por WhatsApp» (abre WhatsApp con el mensaje y su enlace), «Volver a mandar el correo» (si lo invitaste por correo) y «Anular la invitación». Debajo dice si el correo ya salió.',
      'Para crear una línea tú: llena «Crear una línea» y toca «Crear la línea».',
      'Para mover a un conductor: arrástralo a otra línea o usa «Mover a…».',
      'Para corregir el segundo contacto de emergencia (por ejemplo, si la línea se creó con uno provisional): en la línea o en «Líderes invitados», abre los tres puntos y toca «Editar contactos de emergencia». Escribe el nombre y el celular completo otra vez, con el código del país, y toca «Guardar el contacto». Queda en la auditoría con el antes y el después.',
      'Para corregir el nombre o los datos de una línea (el nombre, el tipo o cuántos conductores tiene), en la línea o en «Líderes invitados» abre los tres puntos y toca «Editar datos». En un líder invitado también puedes cambiar su correo o su celular: si pones un correo nuevo, le mandamos solo su mismo enlace a ese correo. Queda en la auditoría.',
      'En las casillas de nombre va un nombre: si escribes un celular ahí, la pantalla te lo avisa y no deja guardar.',
    ],
  },
  en: {
    id: 'driver-lines',
    titulo: 'Taxi and mototaxi lines: approve a line, see its drivers and move one',
    resumen:
      'How to approve the “Register your line” requests, create a line directly, search for it and move drivers between lines. A line belongs to its leader: they accept their drivers and receive the emergencies.',
    explicacion: [
      'A line is a group of taxis or mototaxis with its leader. It has a code, a link and a QR. The code only works in the line’s city. It is separate from referrals: joining a line earns no rewards.',
      'A line starts in two ways. First: someone fills in “Register your line” on the website (name, city, taxi or mototaxi, how many drivers, leader and second contact) and the request shows up at the top of this screen. Second: you create it under “Create a line.” Nobody creates a line without the team’s approval.',
      'Before approving, call the leader and check the cell phone is theirs. If the leader doesn’t have a Divoox Driver account yet, tapping “Create the line” (or “Approve”) invites them in that same step: the line moves to “Invited leaders” with their personal link; if you entered their email, they get an email with the link right away, and if you invited them by cell phone, you send it on WhatsApp from the three-dot menu. And the moment they create their driver account with that same cell phone or email, the line is created automatically with them as leader (they don’t have to open anything; their account starts in the line’s city, with that city’s code). If they already had an account when you invited them, the line joins the next time they sign in, confirm their email or open “My line”. You can cancel an invitation from its three-dot menu. Drivers who had already signed up with the leader’s personal code move into the line as accepted.',
      'A driver asks to join with the line’s code or by choosing it from the list for their city, at sign-up or from their profile. The leader accepts or declines with one tap in their app. A driver belongs to one line only.',
      'To move a driver: drag them to another line, or open the line with “View” and use “Move to…”. You can also leave them without a line. The leader can remove a driver from their app.',
      'Emergencies: if a driver in the line taps the emergency button, the leader and the second contact get a message with the name, cell phone and location. There is a daily limit per driver. A driver without a line alerts the team in their city.',
    ],
    capturas: [
      capLineas(
        'super-solicitudes',
        'en',
        'Requests from the Register your line form with the leader’s details and the Approve and Decline buttons.',
        'Pending requests: approve or decline with one tap.',
      ),
      capLineas(
        'super-invitar',
        'en',
        'The green notice after approving a leader who didn’t have an account yet: they were invited in the same step.',
        'Approving a leader without an account invites them in the same step: the notice says whether the email went out or you need to send their link on WhatsApp.',
      ),
      capLineas(
        'super-invitados',
        'en',
        'The Invited leaders section: each line with its personal link and the open three-dot menu with Copy their link, Send on WhatsApp, Edit emergency contacts and Cancel the invitation.',
        'Each invited leader with their personal link; from the three dots you copy it or send it on WhatsApp.',
      ),
      capLineas(
        'super-crear',
        'en',
        'The Create a line form with name, city, type, leader and second emergency contact.',
        'To create a line directly.',
      ),
      capLineas(
        'super-lista',
        'en',
        'List of lines with search, city, leader, members, code and the Move to selector for each driver.',
        'The list with search and the selector to move drivers.',
      ),
    ],
    preguntas: [
      'How do I approve a new line?',
      'How do I move a driver to another line?',
      'Who receives a driver’s emergency?',
    ],
    pasos: [
      'Open “Taxi and mototaxi lines” in the People menu.',
      'In the requests: call the leader, verify their cell phone and tap “Approve and create the line.”',
      'If the leader has no account yet, the line goes to “Invited leaders” on its own. In its three-dot menu: “Copy their link”, “Send on WhatsApp” (opens WhatsApp with the message and their link), “Send the email again” (if you invited them by email) and “Cancel the invitation”. Below, it says whether the email already went out.',
      'To create a line yourself: fill in “Create a line” and tap “Create the line.”',
      'To move a driver: drag them to another line or use “Move to…”.',
      'To fix the second emergency contact (for example, if the line was created with a temporary one): on the line or under “Invited leaders”, open the three dots and tap “Edit emergency contacts.” Enter the name and the full cell phone again, with the country code, and tap “Save the contact.” It goes into the audit log with the before and after.',
      'To fix a line’s name or details (the name, the type or how many drivers it has), on the line or under “Invited leaders” open the three dots and tap “Edit details.” For an invited leader you can also change their email or cell phone: if you enter a new email, we automatically send their same link to it. It goes into the audit log.',
      'Name boxes are for names: if you type a cell phone there, the screen warns you and won’t save.',
    ],
  },
};

// ───────────────────────── Cuentas de prueba (C-CUENTA-PRUEBA, 21 nov 2026) ─────────────────────────

const cuentasPrueba: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'test-accounts',
    titulo:
      'Cuentas de prueba: marcarlas, separarlas de las reales y probar un servicio en una ciudad',
    resumen:
      'Cómo se marca una cuenta como de prueba, cómo se filtran las listas entre reales y de prueba, y cómo se prueba un servicio en una ciudad sin que lo vea el público.',
    explicacion: [
      'Una cuenta de prueba es la que usa el equipo para probar (las de Soporte de pruebas, las de revisión de las tiendas, las de ejemplo). Lleva la etiqueta «Prueba» en las listas y en su ficha.',
      'Las listas de Repartidores, Clientes, Restaurantes y Líneas tienen el filtro «Cuentas» junto al de ciudad: «Reales» (lo que sale al abrir), «De prueba» o «Todas». Lo que elijas se recuerda la próxima vez que entres. Un restaurante cuenta como de prueba si su dueño lo es, y una línea, si su líder lo es.',
      'Los reportes, los conteos del resumen y los registros nuevos dejan fuera las cuentas de prueba, para que los números sean los de clientes de verdad.',
      'Un servicio se puede encender en una ciudad solo para cuentas de prueba (por ejemplo, Carro en una ciudad donde todavía no está abierto). Esas cuentas lo ven y lo piden; el resto de la ciudad no lo ve ni lo puede pedir. Hace falta además su tarifa en esa ciudad.',
      'Marcar o quitar la marca queda en la auditoría con tu nombre, la hora, el antes y el después. Solo el equipo puede hacerlo.',
      'En Estados Unidos, los antecedentes de un conductor los aprueba la verificación automática. En una cuenta de prueba no corre, así que en la ficha del conductor (Moto y Carro → Ver lo que le falta) sale el botón «Aprobar antecedentes (cuenta de prueba)». En una cuenta real ese botón no aparece. La identidad se sigue aprobando en «Verificaciones».',
    ],
    capturas: [
      {
        archivo: 'cuentas-prueba-lista-es.webp',
        alt: 'Lista de Clientes con el filtro Cuentas en De prueba y una cuenta con la etiqueta Prueba',
        pie: 'Con «Cuentas: De prueba» solo salen las cuentas de prueba, con su etiqueta.',
      },
      {
        archivo: 'cuentas-prueba-marcar-es.webp',
        alt: 'Ficha de un cliente con el menú de tres puntos abierto y la opción Marcar como prueba',
        pie: 'En la ficha, los tres puntos tienen «Marcar como prueba».',
      },
    ],
    preguntas: [
      '¿Cómo marco una cuenta como de prueba?',
      '¿Por qué no veo una cuenta en la lista?',
      '¿Las cuentas de prueba cuentan en los reportes?',
    ],
    pasos: [
      'Abre la ficha de la cuenta (desde Repartidores o Clientes) o la lista de Restaurantes.',
      'Abre los tres puntos y toca «Marcar como prueba». Para deshacerlo, toca «Quitar marca de prueba».',
      'En las listas, cambia el filtro «Cuentas» a «De prueba» o «Todas» para verlas.',
    ],
  },
  en: {
    id: 'test-accounts',
    titulo: 'Test accounts: mark them, keep them apart from real ones and try a service in a city',
    resumen:
      'How to mark an account as a test account, how to filter the lists between real and test accounts, and how to try a service in a city without the public seeing it.',
    explicacion: [
      'A test account is one the team uses to test (the test Support accounts, the app store review accounts, the sample accounts). It carries the “Test” tag in the lists and on its profile.',
      'The Drivers, Customers, Restaurants and Lines lists have the “Accounts” filter next to the city one: “Real” (what you see when you open it), “Test” or “All.” Your choice is remembered next time. A restaurant counts as a test one if its owner is, and a line if its leader is.',
      'Reports, summary counts and new sign-ups leave test accounts out, so the numbers are those of real customers.',
      'A service can be turned on in a city for test accounts only (for example, Car in a city where it isn’t open yet). Those accounts see it and order it; the rest of the city doesn’t see it and can’t order it. It also needs its rate in that city.',
      'Marking or unmarking goes into the audit log with your name, the time, the before and after. Only the team can do it.',
      'In the United States, a driver’s background check is approved by the automatic verification. It doesn’t run on a test account, so the driver’s profile (Moto and Car → See what’s missing) shows the “Approve background check (test account)” button. On a real account that button doesn’t appear. Identity is still approved under “Verifications.”',
    ],
    capturas: [
      {
        archivo: 'cuentas-prueba-lista-en.webp',
        alt: 'Customers list with the Accounts filter on Test and an account with the Test tag',
        pie: 'With “Accounts: Test” only test accounts show up, with their tag.',
      },
      {
        archivo: 'cuentas-prueba-marcar-en.webp',
        alt: 'A customer profile with the three-dot menu open and the Mark as test option',
        pie: 'On the profile, the three dots have “Mark as test.”',
      },
    ],
    preguntas: [
      'How do I mark an account as a test account?',
      'Why don’t I see an account in the list?',
      'Do test accounts count in the reports?',
    ],
    pasos: [
      'Open the account’s profile (from Drivers or Customers) or the Restaurants list.',
      'Open the three dots and tap “Mark as test.” To undo it, tap “Remove test mark.”',
      'In the lists, switch the “Accounts” filter to “Test” or “All” to see them.',
    ],
  },
};

// ───────────────────────── Banners de la app (C-BANNERS, 17 nov 2026) ─────────────────────────

const capBanners = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({ archivo: `banners-${nombre}-${idioma}.webp`, alt, pie });

const banners: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'app-banners',
    titulo: 'Banners de la app: crear, generar con IA, aprobar y publicar',
    resumen:
      'Cómo se arma un banner del inicio de la app del cliente (la cabecera o el carrusel de promociones), cómo se crean opciones de imagen con IA y cómo se aprueba para que salga en una ciudad o en un país.',
    explicacion: [
      'Hay dos lugares. La cabecera es el banner grande de arriba, con fondo oscuro, el titular grande y la imagen del producto a la derecha: cada vez que alguien abre o refresca el inicio sale uno distinto, y el de más peso sale más veces. Promociones es el carrusel de tarjetas rojas con titular y código: salen todos los vigentes, en el orden que les pongas.',
      'Cada banner lleva su imagen, el titular y el texto en español y en inglés, a dónde lleva al tocarlo (un servicio, un restaurante, una tienda o un cupón), en qué países o ciudades sale, desde cuándo y hasta cuándo, y su peso y su orden. Sin marcar países ni ciudades, sale en todas partes; un país incluye todas sus ciudades. Si lleva a un servicio (Moto, Carro, Envíos…), además solo sale en las ciudades donde ese servicio está encendido para el público, así nunca se anuncia algo que no se puede pedir; Comida sale siempre.',
      'La imagen se sube desde archivos, se toma con la cámara o se crea con IA: escribes la idea, eliges dos o tres opciones y tocas «Elegir esta». La IA usa solo el modelo económico aprobado y tiene un tope de imágenes por día para todo Divoox; el panel te dice cuántas van. Si se llega al tope, se sube la imagen a mano.',
      'Todo banner nace en borrador y no lo ve nadie fuera del equipo. Sale al público solo cuando tocas «Aprobar y publicar»; la app lo muestra en menos de un minuto. Si cambias un banner publicado, vuelve a borrador hasta que lo apruebes otra vez. «Pausar» lo quita de la app sin borrarlo; borrar está en los tres puntos y pide confirmación.',
    ],
    capturas: [
      capBanners(
        'lista',
        'es',
        'La pantalla «Banners de la app» con la cabecera y las promociones, cada banner con su miniatura, su estado y los botones Editar y Aprobar y publicar.',
        'Los banners de cada lugar con su estado.',
      ),
      capBanners(
        'editor',
        'es',
        'El formulario de un banner con la imagen, las opciones creadas con IA, los titulares en los dos idiomas y la vista previa del teléfono a la derecha.',
        'Mientras escribes, la vista previa muestra cómo se verá en el teléfono.',
      ),
    ],
    preguntas: [
      '¿Cómo pongo un banner solo en una ciudad?',
      '¿Por qué no sale mi banner en la app?',
      '¿Cuántas imágenes con IA puedo crear por día?',
    ],
    pasos: [
      'Abre «Banners de la app» en el menú y toca «Nuevo banner».',
      'Elige el lugar (cabecera o promociones) y pon la imagen: súbela, tómala con la cámara o escribe la idea y toca «Generar opciones», y luego «Elegir esta».',
      'Escribe el titular y el texto en español y en inglés, elige a dónde lleva al tocarlo y marca los países o las ciudades.',
      'Pon las fechas, el peso y el orden si hace falta, y revisa la vista previa en los dos idiomas.',
      'Toca «Guardar y aprobar», o guarda el borrador y apruébalo después con «Aprobar y publicar».',
    ],
    nota: 'Si un banner no sale: revisa que diga «Publicado», que la fecha de inicio ya haya llegado y la de fin no haya pasado, y que la ciudad del cliente esté marcada.',
  },
  en: {
    id: 'app-banners',
    titulo: 'App banners: create, generate with AI, approve, and publish',
    resumen:
      'How to build a banner for the customer app home screen (the header or the promotions carousel), how to create image options with AI, and how to approve it so it shows in a city or a country.',
    explicacion: [
      'There are two placements. The header is the large banner at the top, with a dark background, a big headline, and the product image on the right: each time someone opens or refreshes the home screen a different one shows, and the one with more weight shows more often. Promotions is the carousel of red cards with a headline and a code: every active one shows, in the order you set.',
      'Each banner has its image, the headline and text in Spanish and English, where tapping it leads (a service, a restaurant, a store, or a coupon), which countries or cities it shows in, its start and end, and its weight and order. With no countries or cities checked, it shows everywhere; a country includes all its cities. If it opens a service (Moto, Car, Deliveries…), it also only shows in the cities where that service is on for the public, so nothing is advertised that can’t be ordered; Food always shows.',
      'The image is uploaded from files, taken with the camera, or created with AI: write the idea, pick two or three options, and tap “Pick this one.” AI uses only the approved low-cost model and has a daily image limit for all of Divoox; the panel shows how many are used. If the limit is reached, upload the image by hand.',
      'Every banner starts as a draft and nobody outside the team sees it. It goes live only when you tap “Approve and publish”; the app shows it in less than a minute. If you change a published banner, it goes back to draft until you approve it again. “Pause” removes it from the app without deleting it; delete is in the three-dot menu and asks for confirmation.',
    ],
    capturas: [
      capBanners(
        'lista',
        'en',
        'The “App banners” screen with the header and promotions, each banner with its thumbnail, its status, and the Edit and Approve and publish buttons.',
        'The banners in each placement with their status.',
      ),
      capBanners(
        'editor',
        'en',
        'The banner form with the image, the AI-created options, the headlines in both languages, and the phone preview on the right.',
        'As you type, the preview shows how it will look on the phone.',
      ),
    ],
    preguntas: [
      'How do I show a banner in just one city?',
      'Why isn’t my banner showing in the app?',
      'How many AI images can I create per day?',
    ],
    pasos: [
      'Open “App banners” in the menu and tap “New banner.”',
      'Choose the placement (header or promotions) and add the image: upload it, take it with the camera, or write the idea and tap “Generate options,” then “Pick this one.”',
      'Write the headline and text in Spanish and English, choose where tapping it leads, and check the countries or cities.',
      'Set the dates, weight, and order if needed, and check the preview in both languages.',
      'Tap “Save and approve,” or save the draft and approve it later with “Approve and publish.”',
    ],
    nota: 'If a banner isn’t showing: check that it says “Published,” that its start date has arrived and its end date hasn’t passed, and that the customer’s city is checked.',
  },
};

const porId = (lista: Guia[]) => new Map(lista.map((g) => [g.id, g]));

// ─────────────── Abrir una ciudad de Perú (C-PERFIL-PERU, 19 nov 2026) ───────────────

const capPeru = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `peru-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const abrirPeru: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'open-peru-city',
    titulo: 'Perú: abrir una ciudad, soles, Yape y Plin, comisión y recarga con tarjeta',
    resumen:
      'Qué es distinto en Perú y en qué orden se enciende: la ciudad en soles, el pago en mano con Yape o Plin, la comisión del saldo, la recarga con tarjeta y el punto de venta del líder.',
    explicacion: [
      'Perú es su propio sistema. Todo va en soles. El pasajero paga en mano: efectivo, Yape o Plin. No hay tarjeta para el pasajero ni doble moneda.',
      'En producción Perú nace cerrado. Hay tres llaves y las tres hacen falta: la compuerta del país en «Moto · Abrir y aprobar» (pide la solicitud de marca del país y tu contraseña), la comisión del saldo aprobada en Flex · Dinero, Políticas, y la ciudad abierta. Ninguna se enciende sin la orden de Richard.',
      'La comisión de Perú es del 8 %: Richard aprobó la cifra el 19 de noviembre de 2026. Falta la revisión legal del abogado peruano. Mientras esa revisión no esté aprobada, ningún viaje de Perú descuenta saldo y la recarga con tarjeta no se puede encender.',
      'La ciudad se abre en «Moto · Abrir y aprobar», «Abrir un servicio de viajes en una ciudad». Una ciudad de Perú nace sola en soles, con hora de Lima y la tarifa de mercado. Se abre una vez para Moto y otra para Carro.',
      'El conductor carga su número de Yape o de Plin en su app. Entra en uso a las 24 horas, o antes si lo confirmas tú. Yape y Plin se reciben entre sí: con uno de los dos le llegan los viajes de ambos. Sin número solo recibe viajes en efectivo.',
      'Si el conductor toca «No me llegó», el caso cae en la bandeja de soporte del dinero, en soles, con el viaje y el monto.',
      'Recarga con tarjeta: en Dinero, país PE, se enciende «Recargas con tarjeta» y se escribe la «Recarga mínima con tarjeta». El procesador cobra una parte fija por cada cobro, así que una recarga chica pierde mucho: por eso el mínimo propio (propuesto: 30 soles).',
      'En esa misma pantalla verás en rojo «Incompleto… Falta: las tarifas, los topes». Ese aviso es de Comida, que en Perú todavía no se abre: los viajes y las recargas no lo necesitan.',
      'El conductor paga la recarga en la página segura del procesador, dentro de su app. El saldo entra solo cuando llega la confirmación. Divoox no le paga al conductor por el procesador en Perú: él ya cobró en mano.',
      'El líder de la ciudad vende saldo como punto de venta: en Dinero, país PE, enciende «Recargas en puntos de venta», crea el punto con su cuenta y cárgale fondo. Él cobra en efectivo, Yape o Plin y le da un código al conductor.',
      'Cargar saldo a mano en «Saldo de conductores» tiene topes en soles: hasta 200 por carga, 40 de regalo de arranque y 1.200 de presupuesto por ciudad.',
      'Los papeles del conductor se llaman como en Perú: tarjeta de identificación vehicular, SOAT o CAT, licencia de la clase B (mototaxi y moto) o de la clase A (carro), y antecedentes penales o Certificado Único Laboral. Los revisas igual que siempre.',
    ],
    capturas: [
      capPeru(
        'super-dinero',
        'es',
        'La pantalla Dinero con el país PE elegido: los interruptores de efectivo, recargas en puntos de venta y recargas con tarjeta, y la casilla Recarga mínima con tarjeta.',
        'Perú en Dinero: los interruptores y la recarga mínima con tarjeta.',
      ),
      capPeru(
        'super-compuerta',
        'es',
        'La pantalla Moto · Abrir y aprobar con la tarjeta de Perú y su estado en producción.',
        'La compuerta de producción de Perú.',
      ),
    ],
    preguntas: [
      '¿Cómo abro una ciudad de Perú?',
      '¿Por qué un conductor de Perú no recibe viajes con Yape?',
      '¿Cómo enciendo la recarga con tarjeta en Perú?',
      '¿Cómo vende saldo el líder de la ciudad?',
    ],
    pasos: [
      'Confirma con Richard la orden de abrir y la comisión aprobada.',
      'En «Moto · Abrir y aprobar», abre la compuerta de Perú con la solicitud de marca y tu contraseña.',
      'En la misma pantalla, abre el servicio en la ciudad (Moto y después Carro).',
      'En Dinero, país PE, enciende las recargas y escribe la recarga mínima con tarjeta.',
      'Crea el punto de venta del líder y cárgale fondo.',
      'Aprueba los papeles de los conductores y confirma sus números de Yape o Plin.',
    ],
    nota: 'En el sitio de pruebas Perú ya está abierto para probar. En producción sigue cerrado hasta la orden de Richard.',
  },
  en: {
    id: 'open-peru-city',
    titulo: 'Peru: opening a city, soles, Yape and Plin, commission and card top-ups',
    resumen:
      'What is different in Peru and the order to turn it on: the city in soles, in-hand payment with Yape or Plin, the balance commission, card top-ups and the city lead’s point of sale.',
    explicacion: [
      'Peru is its own system. Everything is in soles. Riders pay in hand: cash, Yape or Plin. There is no rider card payment and no dual currency.',
      'In production Peru starts closed. There are three keys and all three are needed: the country gate in “Moto · Open and approve” (it asks for the country’s trademark filing and your password), the balance commission approved in Flex · Money, Policies, and the city opened. None is turned on without Richard’s order.',
      'Peru’s commission is 8%: Richard approved the figure on November 19, 2026. The legal review by the Peruvian lawyer is still pending. Until that review is approved, no ride in Peru deducts balance and card top-ups cannot be turned on.',
      'The city is opened in “Moto · Open and approve,” “Open a ride service in a city.” A city in Peru is created in soles, on Lima time, with the market fare. Open it once for Moto and once for Car.',
      'Drivers add their Yape or Plin number in their app. It goes live after 24 hours, or sooner if you confirm it. Yape and Plin receive from each other: with either one they get rides paid with both. With no number they only get cash rides.',
      'If a driver taps “It didn’t arrive,” the case lands in the money support inbox, in soles, with the ride and the amount.',
      'Card top-ups: in Money, country PE, turn on “Card top-ups” and enter the “Minimum card top-up.” The processor charges a fixed part per charge, so a small top-up loses a lot: that is why it has its own minimum (proposed: 30 soles).',
      'On that same screen you’ll see in red “Incomplete… Missing: the fares, the limits.” That notice is about Food, which isn’t opening in Peru yet: rides and top-ups don’t need it.',
      'Drivers pay the top-up on the processor’s secure page inside their app. The balance is credited only when the confirmation arrives. Divoox does not pay drivers out through the processor in Peru: they already collected in hand.',
      'The city lead sells balance as a point of sale: in Money, country PE, turn on “Point-of-sale top-ups,” create the point with their account and fund it. They collect cash, Yape or Plin and give the driver a code.',
      'Topping up by hand in “Driver balances” has limits in soles: up to 200 per top-up, 40 for the starter gift and 1,200 of budget per city.',
      'Driver documents use Peru’s names: vehicle identification card, SOAT or CAT, Class B license (mototaxi and motorcycle) or Class A (car), and criminal record certificate or Certificado Único Laboral. You review them as usual.',
    ],
    capturas: [
      capPeru(
        'super-dinero',
        'en',
        'The Money screen with country PE selected: the switches for cash, point-of-sale top-ups and card top-ups, and the Minimum card top-up field.',
        'Peru in Money: the switches and the minimum card top-up.',
      ),
      capPeru(
        'super-compuerta',
        'en',
        'The Moto · Open and approve screen with the Peru card and its production status.',
        'Peru’s production gate.',
      ),
    ],
    preguntas: [
      'How do I open a city in Peru?',
      'Why isn’t a driver in Peru getting rides paid with Yape?',
      'How do I turn on card top-ups in Peru?',
      'How does the city lead sell balance?',
    ],
    pasos: [
      'Confirm with Richard the order to open and the approved commission.',
      'In “Moto · Open and approve,” open Peru’s gate with the trademark filing and your password.',
      'On the same screen, open the service in the city (Moto, then Car).',
      'In Money, country PE, turn on top-ups and enter the minimum card top-up.',
      'Create the lead’s point of sale and fund it.',
      'Approve the drivers’ documents and confirm their Yape or Plin numbers.',
    ],
    nota: 'On the test site Peru is already open for testing. In production it stays closed until Richard’s order.',
  },
};

// C-CORREGIR-CORREO (20 nov 2026, pedido de Richard): corregir el correo de una cuenta.
const capCorreo = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({ archivo: `correo-${nombre}-${idioma}.webp`, alt, pie });
// C-TELEFONO-AL-REGISTRARSE y C-TELEFONO-POR-PAIS (22 nov 2026): el código por SMS al registrarse.
const celularAlRegistrarse: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'sms-code-at-sign-up',
    titulo: 'El código de verificación al registrarse',
    resumen:
      'Las cuentas nuevas de clientes y conductores confirman su celular con un código de 6 números antes de usar la app: primero por WhatsApp (la cuenta oficial de Divoox) y, si no llega, por SMS. Desde Verificaciones, Configuración, ves quién lo confirmó y por qué canal, el gasto del día de cada canal y apagas o enciendes la exigencia por país.',
    explicacion: [
      'Al crear la cuenta en la app de Divoox o en Divoox Driver, la app muestra «Confirma tu celular» y manda el código sola. Mientras no lo confirme, la cuenta nueva no puede pedir ni conectarse (el servidor también lo frena). Al confirmarlo, el paso «teléfono» aparece en su actividad y en el embudo.',
      'El código sale primero por WhatsApp. Si WhatsApp falla, el mismo código sale por SMS al momento; y si a la persona no le llega, en la pantalla tiene «Enviármelo por SMS». Solo se exige donde algún canal sale hoy. Si los canales no tienen cupo, fallan o se agota su presupuesto del día, la exigencia se quita sola y nadie queda esperando.',
      'Las cuentas que ya existían NO se bloquean: ven una franja arriba de la app para confirmarlo cuando quieran, que pueden cerrar.',
      'Topes contra robots y gastos: cada cuenta espera más entre un código y otro (1, 2, 5 y 15 minutos) y pide como mucho 5 al día; el mismo número recibe como mucho 5 al día aunque cambie de cuenta; la misma red, 10 al día; y en total 300 códigos al día. El canario de salud marca «smsGasto» en amarillo al 80 % del presupuesto diario y en tope al llegar.',
      'Si alguien escribió mal su número, lo cambia él mismo en la misma pantalla. Abrir y cerrar la app no le gasta códigos: mientras el último sirva, no se manda otro solo. Si el proveedor falla, ese envío no le cuenta.',
      'Si de verdad no le llega (un número fijo, de internet o una operadora que no entrega), comprueba con la persona que el número es suyo, por ejemplo escribiéndole por WhatsApp a ese número, y en la lista toca «Confirmar a mano». Queda en el registro con tu nombre. Lo pueden hacer quienes pueden corregir correos.',
    ],
    capturas: [
      {
        archivo: 'celular-panel-es.webp',
        alt: 'El bloque Código de verificación al registrarse con las casillas Exigir el código en Venezuela y en Estados Unidos, por qué canal sale hoy en cada país, el gasto del día de SMS y de WhatsApp, los códigos enviados y la lista de las últimas cuentas con su canal y su estado.',
        pie: 'Interruptor por país, gasto del día, quién confirmó y «Confirmar a mano».',
      },
    ],
    preguntas: [
      '¿Cómo veo quién confirmó su celular?',
      '¿Cómo apago el código de verificación en un país?',
      '¿Qué hago si a alguien no le llega el código?',
    ],
    pasos: [
      'Abre Verificaciones y toca «Configuración».',
      'Baja hasta «Código de verificación al registrarse».',
      'Mira la lista: «Falta confirmar» o «Confirmó el…», con los últimos cuatro números del celular.',
      'Para apagar la exigencia en un país, quita su casilla. Se guarda sola y vale al momento.',
      'A quien no le llega el SMS: compruébalo con la persona y toca «Confirmar a mano» en su fila.',
    ],
    nota: 'Nunca le pidas a nadie el código que le llegó: es solo para la persona.',
  },
  en: {
    id: 'sms-code-at-sign-up',
    titulo: 'The text code at sign-up',
    resumen:
      'New customer and driver accounts confirm their cell phone with a 6-digit code before using the app: first on WhatsApp (Divoox’s official account) and, if it doesn’t arrive, by text. In Verifications, Settings, you see who confirmed it and on which channel, each channel’s spend for the day, and you turn the requirement on or off by country.',
    explicacion: [
      'When someone creates an account in the Divoox app or in Divoox Driver, the app shows “Confirm your cell phone” and sends the code on its own. Until it’s confirmed, the new account can’t order or go online (the server blocks it too). Once confirmed, the “phone” step shows up in their activity and in the funnel.',
      'The code goes out first on WhatsApp. If WhatsApp fails, the same code goes out by text right away; and if it still doesn’t arrive, the screen offers “Text it to me instead.” It’s only required where some channel works today. If the channels are out of quota, fail, or run out of their daily budget, the requirement lifts on its own and nobody is left waiting.',
      'Accounts that already existed are NOT blocked: they see a strip at the top of the app to confirm whenever they want, and they can close it.',
      'Caps against bots and spend: each account waits longer between codes (1, 2, 5 and 15 minutes) and gets at most 5 a day; the same number gets at most 5 a day even across accounts; the same network, 10 a day; and 300 codes a day in total. The health check marks “smsGasto” yellow at 80% of the daily budget and at the cap when it’s reached.',
      'If someone mistyped their number, they fix it themselves on the same screen. Opening and closing the app doesn’t use up codes: while the last one is still good, no new one is sent on its own. If the provider fails, that send doesn’t count against them.',
      'If it truly never arrives (a landline, an internet number, or a carrier that doesn’t deliver), check with the person that the number is theirs, for example by messaging that number on WhatsApp, then tap “Confirm manually” in the list. It’s logged with your name. Anyone who can fix emails can do it.',
    ],
    capturas: [
      {
        archivo: 'celular-panel-en.webp',
        alt: 'The Verification code at sign-up block with the Require the code in Venezuela and in United States checkboxes, which channel the code goes out on today in each country, the day’s text and WhatsApp spend, codes sent, and the list of latest accounts with their channel and status.',
        pie: 'Switch by country, the day’s spend, who confirmed, and “Confirm manually.”',
      },
    ],
    preguntas: [
      'How do I see who confirmed their cell phone?',
      'How do I turn off the verification code in a country?',
      'What do I do if someone isn’t getting the code?',
    ],
    pasos: [
      'Open Verifications and tap “Settings.”',
      'Scroll to “Verification code at sign-up.”',
      'Check the list: “Not confirmed yet” or “Confirmed on…,” with the last four digits of the cell phone.',
      'To turn off the requirement in a country, uncheck it. It saves on its own and applies right away.',
      'For someone who isn’t getting the text: check with them and tap “Confirm manually” on their row.',
    ],
    nota: 'Never ask anyone for the code they received: it’s only for them.',
  },
};

const corregirCorreo: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'fix-account-email',
    titulo: 'Corregir el correo de una cuenta',
    resumen:
      'Cuando alguien escribió mal su correo y no le llega la confirmación, se corrige desde su ficha, en los tres puntos junto al correo: «Corregir correo». Le sale sola la confirmación al correo nuevo y queda en el registro con tu nombre.',
    explicacion: [
      'Al lado del correo, la ficha de cada cliente, conductor y restaurante dice cómo está: «Confirmado», «Sin confirmar» o «Rebotó: el buzón no existe o está bloqueado». «Rebotó» quiere decir que el servicio de correo (por ejemplo Gmail) contestó que esa dirección no existe: casi siempre es una letra cambiada.',
      'Antes de corregir, confirma con la persona el correo bueno, letra por letra. Nunca adivines: si cambias a una dirección equivocada, el enlace le llega a otra persona.',
      '«Corregir correo» deja la cuenta sin confirmar y le manda sola, al correo nuevo, el mismo enlace de confirmación que manda la app. Mientras escribes, si el dominio parece mal escrito (gmial.com, gmail.con), el panel sugiere el bueno. No deja usar un correo que ya tiene otra cuenta ni uno bloqueado por mala conducta. No cambia su contraseña ni le cierra la sesión.',
      '«Reenviar confirmación» vuelve a mandar el enlace al correo que ya tiene la cuenta. Si el correo no sale (la dirección no existe o el servicio falló), el panel lo dice con el motivo: nunca dice «enviado» si no salió.',
      'Cada cambio queda en «Cambios del correo», en la misma ficha: quién lo hizo, cuándo, y el correo de antes y el de ahora con solo las dos primeras letras y el dominio. También queda en el registro de acciones del equipo.',
      'Solo se corrige una cuenta que todavía no confirmó su correo o cuyo correo rebotó. Si la ficha dice «Confirmado», el panel no ofrece corregirlo y explica por qué: el cambio lo hace la persona desde su app, con su contraseña. Es por seguridad: con el correo de una cuenta confirmada se puede cambiar su contraseña y quedarse con sus ganancias y sus pagos.',
      'Si la persona ya arregló su buzón (lo creó o lo desbloqueó) y la ficha sigue en «Rebotó», en los tres puntos está «Quitar el rebote (el buzón ya recibe)». Queda en el registro. Un rebote también se borra solo a los 30 días.',
      'A una misma cuenta se le mandan como mucho 3 correos por hora desde el panel (correcciones y reenvíos juntos). Si se pasa, el panel pide esperar.',
      'Lo pueden usar Soporte nivel 2, Supervisor y Total, y solo en las cuentas de su zona de trabajo. Si el segundo factor está encendido, la primera vez pide el código.',
    ],
    capturas: [
      capCorreo(
        'estado',
        'es',
        'La ficha de un cliente con el correo marcado «Rebotó: el buzón no existe o está bloqueado» y el menú de tres puntos abierto con Corregir correo y Reenviar confirmación.',
        'El estado del correo y las opciones de los tres puntos.',
      ),
      capCorreo(
        'formulario',
        'es',
        'El formulario Corregir el correo de la cuenta con un correo mal escrito, la sugerencia «¿Quisiste decir…@gmail.com?» y el motivo escrito.',
        'Escribe el correo nuevo y el motivo; revisa la sugerencia.',
      ),
      capCorreo(
        'listo',
        'es',
        'La ficha después de corregir: el aviso «Correo corregido. Le mandamos el enlace de confirmación.», el estado Sin confirmar y la lista Cambios del correo.',
        'Listo: el enlace salió y el cambio queda en la línea de tiempo.',
      ),
    ],
    preguntas: [
      '¿Cómo cambio el correo de un cliente que lo escribió mal?',
      '¿Qué significa «Rebotó» en la ficha?',
      '¿Cómo le reenvío el correo de confirmación a alguien?',
    ],
    pasos: [
      'Busca la cuenta en el buscador y abre su ficha (cliente, conductor o restaurante).',
      'Mira el estado al lado del correo. Si dice «Rebotó» o la persona no recibe el correo, confirma con ella el correo bueno, letra por letra.',
      'Abre los tres puntos junto al correo y elige «Corregir correo».',
      'Escribe el correo nuevo. Si sale «¿Quisiste decir…?», tócalo solo si coincide con lo que te dijo la persona.',
      'Escribe el motivo (por ejemplo, «lo pidió por WhatsApp, letra cambiada») y toca «Guardar y mandar la confirmación».',
      'Dile a la persona que abra el correo «Confirma tu correo de Divoox» y toque el botón. Cuando lo haga, la ficha pasa a «Confirmado».',
    ],
    nota: 'Si el correo nuevo también rebota, no insistas: vuelve a confirmar la dirección con la persona.',
  },
  en: {
    id: 'fix-account-email',
    titulo: 'Fix an account’s email',
    resumen:
      'When someone typed their email wrong and the confirmation never arrives, fix it from their page, in the three-dot menu next to the email: “Fix email.” The confirmation goes out to the new email on its own, and the change is logged with your name.',
    explicacion: [
      'Next to the email, every customer, driver and restaurant page shows its status: “Confirmed,” “Not confirmed,” or “Bounced: the mailbox doesn’t exist or is blocked.” “Bounced” means the email provider (for example, Gmail) answered that the address doesn’t exist: almost always a mistyped letter.',
      'Before fixing it, confirm the right email with the person, letter by letter. Never guess: if you change it to the wrong address, the link goes to someone else.',
      '“Fix email” leaves the account unconfirmed and sends the new email the same confirmation link the app sends. While you type, if the domain looks mistyped (gmial.com, gmail.con), the panel suggests the right one. It won’t take an email another account already uses or one blocked for misconduct. It doesn’t change their password or sign them out.',
      '“Resend confirmation” sends the link again to the email the account already has. If the email doesn’t go out (the address doesn’t exist or the service failed), the panel says so with the reason: it never says “sent” when it wasn’t.',
      'Every change shows in “Email changes,” on the same page: who did it, when, and the old and new email showing only the first two letters and the domain. It’s also in the team’s action log.',
      'You can only fix an account that hasn’t confirmed its email yet, or whose email bounced. If the page says “Confirmed,” the panel doesn’t offer the fix and explains why: the person changes it from their app, with their password. It’s a security rule: whoever controls a confirmed account’s email can reset its password and take its earnings and payouts.',
      'If the person already fixed their mailbox (created or unblocked it) and the page still says “Bounced,” the three-dot menu has “Remove the bounce (the mailbox receives now).” It’s logged. A bounce also clears on its own after 30 days.',
      'The panel sends at most 3 emails per hour to the same account (fixes and resends together). Past that, it asks you to wait.',
      'Support level 2, Supervisor and Full access can use it, and only on accounts in their work area. If two-step verification is on, it asks for the code the first time.',
    ],
    capturas: [
      capCorreo(
        'estado',
        'en',
        'A customer page with the email marked “Bounced: the mailbox doesn’t exist or is blocked” and the three-dot menu open with Fix email and Resend confirmation.',
        'The email status and the three-dot options.',
      ),
      capCorreo(
        'formulario',
        'en',
        'The Fix the account’s email form with a mistyped email, the “Did you mean …@gmail.com?” suggestion and the reason filled in.',
        'Type the new email and the reason; check the suggestion.',
      ),
      capCorreo(
        'listo',
        'en',
        'The page after the fix: the “Email fixed. We sent the confirmation link.” notice, the Not confirmed status and the Email changes list.',
        'Done: the link went out and the change is on the timeline.',
      ),
    ],
    preguntas: [
      'How do I change the email of a customer who typed it wrong?',
      'What does “Bounced” mean on the page?',
      'How do I resend the confirmation email to someone?',
    ],
    pasos: [
      'Find the account with search and open its page (customer, driver or restaurant).',
      'Check the status next to the email. If it says “Bounced” or the person isn’t getting the email, confirm the right email with them, letter by letter.',
      'Open the three dots next to the email and choose “Fix email.”',
      'Type the new email. If “Did you mean…?” shows up, tap it only if it matches what the person told you.',
      'Write the reason (for example, “asked over WhatsApp, one letter off”) and tap “Save and send the confirmation.”',
      'Tell the person to open the “Confirm your Divoox email” message and tap the button. Once they do, the page shows “Confirmed.”',
    ],
    nota: 'If the new email bounces too, don’t keep trying: confirm the address with the person again.',
  },
};

// C-CAMPANA-SE-VACIA y C-CONTADORES-DE-TAREA (23 nov 2026, Richard): la campana es de lectura y los
// números del menú son de tarea.
const capCampana = (
  nombre: string,
  idioma: IdiomaAyuda,
  alt: string,
  pie: string,
): CapturaAyuda => ({ archivo: `campana-${nombre}-${idioma}.webp`, alt, pie });
const campanaYNumeros: Record<IdiomaAyuda, Guia> = {
  es: {
    id: 'bell-and-menu-numbers',
    titulo: 'La campana y los números del menú',
    resumen:
      'La campana de arriba cuenta lo que llegó y todavía no viste: al abrirla vuelve a cero. Los números del menú de la izquierda cuentan lo que espera una acción: no bajan por mirarlos, bajan cuando haces la tarea.',
    explicacion: [
      'La campana es para LEER. Su número cuenta solo lo que tú todavía no viste: un ticket nuevo, un caso nuevo de Camila, una verificación enviada, un restaurante o una solicitud de línea por aprobar, un movimiento de dinero por aprobar, una emergencia en un viaje, un reporte de un mensaje o reseña, o un conductor que se registró sin ciudad.',
      'Al abrir la campana, el número vuelve a cero en ese momento. Lo que ya viste queda en la lista como historial, más apagado; lo nuevo va arriba, con su punto rojo. Cada aviso dice qué pasó, hace cuánto, y si ya se resolvió (en verde). Tócalo y te lleva al lugar donde se resuelve: la ficha del ticket, la del conductor, la del restaurante, la bandeja de Camila.',
      'Lo que viste se guarda con tu cuenta, no en el navegador: si lo leíste en la computadora, tampoco te sale nuevo en el celular ni en otra computadora. Es de cada persona: lo que tú viste no se le apaga a tu compañero. La campana vuelve a contar solo cuando llega algo nuevo.',
      'Los números del MENÚ son de TAREA: cuántas cosas esperan que alguien actúe (tickets abiertos, casos de Camila, reportes, aprobaciones de dinero, verificaciones, restaurantes y líneas por aprobar, conductores sin ciudad, emergencias sin atender). No se quitan por mirarlos ni por abrir la campana: bajan cuando haces la tarea (respondes el ticket, apruebas, le pones la ciudad al conductor) y llegan a cero cuando no queda nada.',
      'Tocar un ítem con número te lleva a esas tareas ya filtradas. Por ejemplo, «Repartidores» con número abre la lista en «Sin zona», y «Tickets» con número abre los tickets abiertos.',
      'Un conductor «sin zona» es uno que todavía no nos dijo su ciudad. Ábrelo y, en sus tres puntos, toca «Cambiar ciudad». Si de verdad vive en la ciudad por defecto, elígela igual: se confirma y sale de la cuenta.',
      'Ningún número se queda pegado: todo número del menú baja haciendo algo, y la campana baja abriéndola. Si ves uno que no baja después de atenderlo, avísale al equipo técnico: es un fallo.',
    ],
    capturas: [
      capCampana(
        'abierta',
        'es',
        'La campana del superadmin abierta: arriba los avisos nuevos con punto rojo (un ticket nuevo y un conductor sin ciudad) y abajo los ya vistos, más apagados.',
        'Al abrirla, el número vuelve a cero; lo nuevo va arriba y lo visto queda como historial.',
      ),
      capCampana(
        'menu',
        'es',
        'El menú lateral del superadmin con el número verde de «Tickets» y de «Repartidores» junto a cada sección.',
        'Los números del menú son tareas: bajan al hacerlas, no al mirarlas.',
      ),
    ],
    preguntas: [
      '¿Por qué la campana no se borra?',
      '¿Cómo quito el número de Repartidores?',
      '¿Qué diferencia hay entre la campana y los números del menú?',
    ],
    pasos: [
      'Toca la campana de arriba para ver lo que llegó: el número vuelve a cero.',
      'Toca un aviso para ir al lugar donde se resuelve.',
      'Para bajar un número del menú, toca la sección y haz la tarea (responder, aprobar, ponerle la ciudad).',
    ],
    nota: 'La campana y los números se actualizan solos cada medio minuto y al cambiar de sección. Solo cuentan cuentas reales (nunca las de prueba) y solo lo de tu zona de trabajo.',
  },
  en: {
    id: 'bell-and-menu-numbers',
    titulo: 'The bell and the menu numbers',
    resumen:
      'The bell at the top counts what came in that you haven’t seen yet: opening it clears it back to zero. The numbers in the left menu count what is waiting for action: they don’t go down by looking, they go down when you do the task.',
    explicacion: [
      'The bell is for READING. Its number only counts what you haven’t seen yet: a new ticket, a new Camila case, a verification submitted, a restaurant or a line request to approve, a money movement to approve, an emergency on a ride, a reported message or review, or a driver who signed up with no city.',
      'When you open the bell, the number goes back to zero right away. What you’ve seen stays in the list as history, dimmed; new items are on top, with a red dot. Each notification says what happened, how long ago, and whether it’s already resolved (in green). Tap it to go where it gets resolved: the ticket, the driver’s or the restaurant’s file, Camila’s inbox.',
      'What you’ve seen is saved with your account, not in the browser: if you read it on the computer, it won’t show up as new on your phone or on another computer either. It’s per person: what you saw doesn’t clear for your teammate. The bell only counts again when something new arrives.',
      'The MENU numbers are TASKS: how many things are waiting for someone to act (open tickets, Camila cases, reports, money approvals, verifications, restaurants and lines to approve, drivers with no city, unattended emergencies). They don’t go away by looking or by opening the bell: they go down when you do the task (reply to the ticket, approve, set the driver’s city) and reach zero when nothing is left.',
      'Tapping a menu item with a number takes you to those tasks already filtered. For example, “Drivers” with a number opens the list on “No zone”, and “Tickets” with a number opens the open tickets.',
      'A driver with “no zone” is one who hasn’t told us their city yet. Open them and, in their three dots, tap “Change city”. If they really live in the default city, choose it anyway: it gets confirmed and drops out of the count.',
      'No number gets stuck: every menu number goes down by doing something, and the bell goes down by opening it. If you see one that doesn’t go down after you handle it, tell the tech team: it’s a bug.',
    ],
    capturas: [
      capCampana(
        'abierta',
        'en',
        'The superadmin bell open: new notifications on top with a red dot (a new ticket and a driver with no city) and the ones already seen below, dimmed.',
        'Opening it clears the number back to zero; new items go on top and what you’ve seen stays as history.',
      ),
      capCampana(
        'menu',
        'en',
        'The superadmin side menu with the green number next to “Tickets” and “Drivers”.',
        'Menu numbers are tasks: they go down when you do them, not when you look at them.',
      ),
    ],
    preguntas: [
      'Why doesn’t the bell clear?',
      'How do I clear the Drivers number?',
      'What’s the difference between the bell and the menu numbers?',
    ],
    pasos: [
      'Tap the bell at the top to see what came in: the number goes back to zero.',
      'Tap a notification to go where it gets resolved.',
      'To lower a menu number, tap the section and do the task (reply, approve, set the city).',
    ],
    nota: 'The bell and the numbers refresh on their own every half minute and when you change sections. They only count real accounts (never test ones) and only what’s in your work area.',
  },
};

/** Las secciones de la ayuda, en el orden del menú lateral. */
function secciones(idioma: IdiomaAyuda): SeccionAyuda[] {
  const g = porId(idioma === 'es' ? es : en);
  const de = <T>(x: Record<IdiomaAyuda, T>) => (idioma === 'es' ? x.es : x.en);
  const tomar = (ids: string[]) =>
    ids.map((id) => {
      const guia = g.get(id);
      if (!guia) throw new Error(`ayuda interna: falta la guía ${id}`);
      return guia;
    });
  const esp = idioma === 'es';
  return [
    {
      id: 'start',
      titulo: esp ? 'Empieza aquí' : 'Start here',
      guias: [de(inicio), de(campanaYNumeros)],
    },
    {
      id: 'monitoring',
      titulo: esp ? 'Monitoreo' : 'Monitoring',
      guias: [
        ...tomar(['search-orders-rides-people', 'monitor-live-orders-rides']),
        de(semaforo),
        ...tomar(['read-order-ride-file']),
        de(rastroActividad),
      ],
    },
    {
      id: 'support',
      titulo: esp ? 'Soporte' : 'Support',
      guias: [
        de(camilaBuzon),
        de(recordatoriosRegistro),
        ...tomar(['link-support-ticket', 'flagged-content', 'resolve-expired-card-authorization']),
        de(dobleFirma),
        de(cambiarCiudad),
        de(corregirCorreo),
        de(plazoPapeles),
      ],
    },
    {
      id: 'money',
      titulo: esp ? 'Dinero' : 'Money',
      guias: [
        de(regalosDivoox),
        de(saldoConductores),
        de(saldoRestaurantes),
        de(quienPagaViajes),
        de(comidaQuienPaga),
        de(primerRestauranteVe),
        de(abrirPeru),
        de(agentesDivoox),
        de(referidosEquipos),
        de(lineasTaxi),
        de(tasaBolivar),
      ],
    },
    {
      id: 'settings',
      titulo: esp ? 'Configuración y equipo' : 'Settings and team',
      guias: [
        ...tomar(['time-zone-clock', 'add-team-members-permissions']),
        de(banners),
        de(cuentasPrueba),
        de(celularAlRegistrarse),
      ],
    },
  ];
}

export const AYUDA_INTERNA: Record<IdiomaAyuda, SeccionAyuda[]> = {
  es: secciones('es'),
  en: secciones('en'),
};

/** Todos los archivos de captura que usa la ayuda (para la ruta y para el guion que los sube). */
export const CAPTURAS_AYUDA: ReadonlySet<string> = new Set(
  [...AYUDA_INTERNA.es, ...AYUDA_INTERNA.en].flatMap((s) =>
    s.guias.flatMap((g) => (g.capturas ?? []).map((c) => c.archivo)),
  ),
);
