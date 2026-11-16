import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-DOCS-OPERACIONES (15 nov 2026) — todos los países: las guías públicas del monitoreo del panel de
 * operaciones de Divoox, para entrenar al equipo (cursos y capacitación). Inglés principal, español
 * como traducción, con las mismas direcciones en inglés. Las capturas son las ORIGINALES de
 * `docs/capturas/monitoreo/` (recortadas sin la barra de dirección ni la ruta interna, en WebP);
 * en inglés van las de Novi, Michigan, y en español las de El Vigía (C-CAPTURAS-POR-IDIOMA).
 *
 * La guía 6 «Adding team members and permissions» se agrega cuando lleguen sus capturas (pasos en la
 * entrada C-DOCS-OPERACIONES de `CANDADOS.md`). Nada interno aquí: ni la dirección del panel, ni rutas, ni tablas.
 */
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/monitoreo-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

const en: Guia[] = [
  {
    id: 'search-orders-rides-people',
    titulo: 'Finding any order, ride or person',
    resumen:
      'The search bar at the top of the operations panel finds an order, a ride, a customer, a driver, a restaurant, a vehicle or a ticket from the first letter you type.',
    explicacion: [
      'The search bar is at the top of every screen of Divoox’s operations panel. Press “/” (or Ctrl+K, or ⌘K on a Mac) from anywhere and start typing. There is no button to press: results appear while you type, grouped by what they are: Orders, Rides, Customers, Drivers, Restaurants and stores, Vehicles and Tickets. The sections of the panel show up too, under “Go to”.',
      'You can type almost anything people remember. The short order code, with or without the “#”. The full ID. A name, without worrying about capitals or accents: “jose” finds “José”. A phone number: the last four digits, or the beginning. An email. A license plate. A driver code such as US-NOV-000014. Or an amount, with a dollar sign or decimals; amounts are searched only in the last 30 days, and the screen says so.',
      'The short code is the one customers read to you: the last four letters of the order. The panel shows six letters and writes those four in bold. Four letters can repeat across different orders and rides, so when you type one, the search shows all of them, newest first, each with its status, city, amount and date, so you can tell them apart. Type more letters to narrow it down.',
      'Search looks everywhere, not only at what is on screen: it finds closed orders, orders still awaiting payment, and orders from any city. Each result shows what matched, highlighted. Phone numbers and emails are partly hidden for everyone on the team (for example “+1 ••• ••• 4821”), so you can recognize a person without exposing their data.',
    ],
    capturas: [
      foto(
        'buscador',
        'en',
        'The operations panel search bar with “a7c” typed: the dropdown shows two orders and two rides whose codes start that way, each with its status, city, amount and date.',
        'Typing “a7c” shows every order and ride that starts that way, grouped by type.',
      ),
    ],
    preguntas: [
      'How do I find an order with only the code the customer gave me?',
      'How do I search for a customer by the last digits of their phone?',
      'Why does a short code show more than one order?',
      'Can I find a closed order or an order from another city?',
    ],
    pasos: [
      'Click the search bar, or press “/” or Ctrl+K (⌘K on a Mac) from any screen.',
      'Type what you have: a code, a name, the last four digits of a phone, a plate, an email or an amount.',
      'Read the groups. Each line shows the status, the city, the amount and the date; the part that matched is highlighted.',
      'Use the arrow keys and press Enter, or click a line, to open its file. Press Escape to close the list.',
      'If several orders share the code, compare their date and amount, or type more letters to narrow it down.',
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
      'The Times card calculates, for you, how long each step really took and compares it with what was expected. Green means on time (half a minute over still counts as on time). Red means late, with the minutes. A step still running shows “So far” instead of “Took.” Gray means the data is missing, and it says which one: older orders and assignments made by support do not have every time.',
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
      'El código corto es el que te lee el cliente: las últimas cuatro letras del pedido. El panel muestra seis letras y escribe esas cuatro en negrita. Cuatro letras pueden repetirse entre pedidos y viajes distintos, así que al escribir una, la búsqueda muestra todos, el más reciente primero, cada uno con su estado, ciudad, monto y fecha para distinguirlos. Escribe más letras para acotar.',
      'La búsqueda mira en todas partes, no solo lo que hay en pantalla: encuentra pedidos cerrados, pedidos que siguen esperando pago y pedidos de cualquier ciudad. Cada resultado muestra lo que coincidió, resaltado. Los teléfonos y los correos salen parcialmente tapados para todo el equipo (por ejemplo «+1 ••• ••• 4821»): reconoces a la persona sin exponer sus datos.',
    ],
    capturas: [
      foto(
        'buscador',
        'es',
        'El buscador del panel de operaciones con «a7c» escrito: la lista muestra dos pedidos y dos viajes cuyos códigos empiezan así, cada uno con su estado, ciudad, monto y fecha.',
        'Al escribir «a7c» salen todos los pedidos y viajes que empiezan así, agrupados por tipo.',
      ),
    ],
    preguntas: [
      '¿Cómo encuentro un pedido solo con el código que me dio el cliente?',
      '¿Cómo busco a un cliente por los últimos dígitos de su teléfono?',
      '¿Por qué un código corto muestra más de un pedido?',
      '¿Puedo encontrar un pedido cerrado o de otra ciudad?',
    ],
    pasos: [
      'Haz clic en el buscador, o presiona «/» o Ctrl+K (⌘K en Mac) desde cualquier pantalla.',
      'Escribe lo que tengas: un código, un nombre, los últimos cuatro dígitos de un teléfono, una placa, un correo o un monto.',
      'Lee los grupos. Cada línea muestra el estado, la ciudad, el monto y la fecha; lo que coincidió va resaltado.',
      'Usa las flechas y Enter, o haz clic en una línea, para abrir su ficha. Escape cierra la lista.',
      'Si varios pedidos comparten el código, compara su fecha y su monto, o escribe más letras para acotar.',
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
      'La tarjeta Tiempos calcula por ti cuánto tomó de verdad cada paso y lo compara con lo previsto. Verde es a tiempo (medio minuto de más sigue siendo a tiempo). Rojo es que se pasó, con los minutos. Un paso que sigue corriendo muestra «Lleva» en vez de «Tomó». Gris significa que falta el dato, y dice cuál: los pedidos viejos y las asignaciones hechas por soporte no tienen todos los tiempos.',
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
];

export const GUIAS_OPERACIONES: Record<Idioma, Guia[]> = { es, en };
