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
      'The search bar at the top of the operations panel finds an order, a ride, a customer, a driver, a restaurant, a vehicle or a ticket from the first letter you type.',
    explicacion: [
      'The search bar is at the top of every screen of Divoox’s operations panel. Press “/” (or Ctrl+K, or ⌘K on a Mac) from anywhere and start typing. There is no button to press: results appear while you type, grouped by what they are: Orders, Rides, Customers, Drivers, Restaurants and stores, Vehicles and Tickets. The sections of the panel show up too, under “Go to”.',
      'You can type almost anything people remember. The short order code, with or without the “#”. The full ID. A name, without worrying about capitals or accents: “jose” finds “José”. A phone number: the last four digits, or the beginning. An email. A license plate. A driver code such as US-NOV-000014. Or an amount, with a dollar sign or decimals; amounts are searched only in the last 30 days, and the screen says so.',
      'The short code is the one customers read to you: the first four characters of the order. The panel shows six and writes those four in bold. You don’t need the whole code: from the very first character, the search already suggests every order and ride whose code starts that way. Type “7” and you see the ones that start with 7; type “73” and the list narrows at once. Capitals don’t matter, and the “#” is optional.',
      'When many share the first characters, the ones still in progress come first, with the ones in trouble at the top, then the closed ones, newest first. The group title says how many there are in total (for example “Orders · 312”), and “See all” at the bottom of the group opens Live orders with the same search, where you can keep loading every match.',
      'If nothing matches, the panel says exactly what you searched for and helps you: when a code has a letter that looks like a number (an “O” instead of a zero, an “l” instead of a one), it asks “Did you mean #B4290C?” and one click searches it.',
      'Search looks everywhere, not only at what is on screen: it finds closed orders, orders still awaiting payment, and orders from any city. Each result shows what matched, highlighted. Phone numbers and emails are partly hidden for everyone on the team (for example “+1 ••• ••• 4821”), so you can recognize a person without exposing their data.',
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
      'El buscador de arriba del panel de operaciones encuentra un pedido, un viaje, un cliente, un repartidor, un restaurante, un vehículo o un ticket desde la primera letra.',
    explicacion: [
      'El buscador está arriba en todas las pantallas del panel de operaciones de Divoox. Presiona «/» (o Ctrl+K, o ⌘K en Mac) desde cualquier lugar y escribe. No hay botón que apretar: los resultados salen mientras escribes, agrupados por tipo: Pedidos, Viajes, Clientes, Repartidores y conductores, Restaurantes y tiendas, Vehículos y Tickets. Las secciones del panel también aparecen, en «Ir a».',
      'Puedes escribir casi cualquier dato que la gente recuerda. El código corto del pedido, con o sin «#». El id completo. Un nombre, sin preocuparte por mayúsculas ni acentos: «jose» encuentra «José». Un teléfono: los últimos cuatro dígitos o el comienzo. Un correo. Una placa. Un código de repartidor como VE-ELV-000003. O un monto, con signo de dólar o decimales; los montos se buscan solo en los últimos 30 días y la pantalla lo dice.',
      'El código corto es el que te lee el cliente: los primeros cuatro caracteres del pedido. El panel muestra seis y escribe esos cuatro en negrita. No hace falta el código completo: desde el primer carácter el buscador ya sugiere todos los pedidos y viajes cuyo código empieza así. Escribe «7» y ves los que empiezan por 7; escribe «73» y la lista se afina al instante. Da igual mayúsculas o minúsculas, y el «#» es opcional.',
      'Cuando muchos comparten los primeros caracteres, salen primero los que siguen en curso, con los que están en problemas arriba, y después los cerrados, del más reciente al más viejo. El título del grupo dice cuántos hay en total (por ejemplo «Pedidos · 312»), y «Ver todos», al pie del grupo, abre Pedidos en curso con la misma búsqueda, donde puedes seguir cargando todas las coincidencias.',
      'Si no hay nada, el panel dice exactamente qué buscaste y te ayuda: cuando un código trae una letra que parece un número (una «O» en vez de un cero, una «l» en vez de un uno), pregunta «¿Quisiste decir #B4290C?» y con un clic lo busca.',
      'La búsqueda mira en todas partes, no solo lo que hay en pantalla: encuentra pedidos cerrados, pedidos que siguen esperando pago y pedidos de cualquier ciudad. Cada resultado muestra lo que coincidió, resaltado. Los teléfonos y los correos salen parcialmente tapados para todo el equipo (por ejemplo «+1 ••• ••• 4821»): reconoces a la persona sin exponer sus datos.',
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

const porId = (lista: Guia[]) => new Map(lista.map((g) => [g.id, g]));

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
    { id: 'start', titulo: esp ? 'Empieza aquí' : 'Start here', guias: [de(inicio)] },
    {
      id: 'monitoring',
      titulo: esp ? 'Monitoreo' : 'Monitoring',
      guias: [
        ...tomar(['search-orders-rides-people', 'monitor-live-orders-rides']),
        de(semaforo),
        ...tomar(['read-order-ride-file']),
      ],
    },
    {
      id: 'support',
      titulo: esp ? 'Soporte' : 'Support',
      guias: [
        ...tomar(['link-support-ticket', 'flagged-content', 'resolve-expired-card-authorization']),
        de(dobleFirma),
      ],
    },
    {
      id: 'settings',
      titulo: esp ? 'Configuración y equipo' : 'Settings and team',
      guias: tomar(['time-zone-clock', 'add-team-members-permissions']),
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
