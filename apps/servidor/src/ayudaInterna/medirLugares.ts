import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * Medir lugares en la calle (C-ESTOY-AQUI, 27 nov 2026) — todas las ciudades. Cómo el equipo arma una
 * tarea de medición, la asigna a conductores de confianza y aprueba o rechaza cada medición. Ayuda
 * INTERNA (nunca va a Docs públicos). Capturas en la carpeta privada: en español El Vigía y en inglés
 * Novi, Michigan (C-CAPTURAS-POR-IDIOMA), con datos neutros. Desde el mismo día: «Estoy aquí» solo a
 * 300 m o menos (C-ESTOY-AQUI-300), tres fotos obligatorias (C-TRES-FOTOS) y las fotos aprobadas en
 * las apps como «Así se ve el lugar», que el equipo puede quitar (C-FOTOS-PUBLICAS).
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `medir-lugares-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const medirLugares: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'measure-places',
    titulo: 'Medir lugares en la calle («Estoy aquí»)',
    resumen:
      'Arma una tarea con los lugares propios que hay que confirmar, asígnala a conductores de confianza y aprueba cada medición. Nada cambia en el mapa hasta que tú apruebas.',
    explicacion: [
      'Para qué sirve: algunos lugares se pusieron desde el mapa y nadie los ha confirmado en la calle. Un conductor de confianza va a cada uno, toca «Estoy aquí» en Driver y la app guarda el punto real con el GPS. Así una ciudad nueva se mide en una mañana.',
      'Dónde está: en el menú, Viajes · Emergencias y tarifas, la tarjeta «Medir lugares en la calle», debajo de «Lugares propios de tu ciudad». Primero eliges la ciudad.',
      'Crear la tarea: escribe un nombre («Puntos de la vía a Mérida»), una nota para el conductor si quieres, marca los lugares que hay que medir y agrega a los conductores. Puedes buscar conductores de esa ciudad o cuentas de Soporte. También puedes crearla sin asignar y elegir a los conductores después, en los tres puntos de la tarea, «Cambiar conductores».',
      'Quién la ve: solo los conductores asignados. Les llega un aviso y en Driver les aparece «Puntos por medir» en su Perfil. Si quitas a alguien o cierras la tarea, deja de verla al instante.',
      'La distancia y la precisión: «Estoy aquí» solo se activa a 300 metros o menos del punto guardado y con el GPS a 15 metros de precisión o menos. Antes, el botón queda gris y le dice al conductor qué falta («Acércate al punto (faltan 420 m)» o «Esperando precisión»). El servidor tampoco acepta una medición a más de 300 m: medir corrige un lugar, nunca lo lleva a otra parte. Si de verdad el lugar está más lejos, se cambia a mano en «Lugares propios».',
      'Las tres fotos: después de «Estoy aquí», el conductor toma tres fotos obligatorias con la cámara (nunca de la galería): entrada o fachada, letrero o algo reconocible, y vista desde la calle. Cada una llega con su GPS y su hora, y el servidor la rechaza si es vieja o si se tomó lejos del punto medido. En Driver se le pide que no salgan caras ni placas.',
      'Aprobar: cada medición llega a «Mediciones por aprobar», con el lugar, cuánto se movería, quién la tomó, la precisión, la hora y «Las tres fotos del lugar» (toca una para verla en grande). En el mapa, el punto guardado va en gris y el medido en rojo. Si falta alguna foto, la tarjeta dice cuál y «Aprobar» queda apagado: solo se aprueba con las tres. Si está bien, toca «Aprobar»: el lugar se mueve, y su precio del tabulador se mueve con él. Llega al buscador en unos minutos.',
      'Las fotos en las apps: al aprobar, las tres fotos pasan a la app de clientes y a Driver como «Así se ve el lugar», cuando ese lugar es la recogida o el destino de un viaje. Si el lugar se vuelve a medir y se aprueba, se ven las fotos nuevas. En la sección «Así se ve el lugar (fotos en las apps)» están todas las de la ciudad: si una no debe verse (sale una cara, una placa o algo que no es el lugar), en sus tres puntos toca «Quitar de las apps» y deja de verse al instante.',
      'Rechazar: si el punto no convence, toca «Rechazar» y escribe el motivo si quieres. El lugar no cambia, y el conductor ve «Medir otra vez» con tu motivo.',
      'Si el lugar se cambió a mano después de medirlo, esa medición ya no se puede aprobar: recházala y pide medirlo otra vez.',
    ],
    capturas: [
      cap(
        'pendiente',
        'es',
        'La tarjeta «Medir lugares en la calle» con una medición por aprobar: «Medición nueva: KM 9, movido…», quién la tomó, la precisión, el mapa con el punto guardado y el medido, y los botones Aprobar y Rechazar.',
        'Una medición nueva, con el punto guardado y el medido en el mapa, y sus tres fotos.',
      ),
      cap(
        'fotos',
        'es',
        'La sección «Así se ve el lugar (fotos en las apps)» con las fotos aprobadas de dos lugares de ejemplo y, abierto en los tres puntos de una, «Quitar de las apps».',
        'Las fotos que se ven en las apps; cualquiera se quita desde sus tres puntos.',
      ),
      cap(
        'tareas',
        'es',
        'La lista de tareas de medición con cuántos lugares van medidos y a quién está asignada, y el formulario para crear una tarea nueva con los lugares y los conductores.',
        'Las tareas de la ciudad y el formulario de tarea nueva.',
      ),
    ],
    preguntas: [
      '¿Cómo le pido a un conductor que confirme un lugar en la calle?',
      '¿Cómo apruebo una medición?',
      '¿Por qué no puedo aprobar una medición?',
      '¿Quién ve una tarea de medición?',
      '¿Qué precisión exige «Estoy aquí»?',
      '¿Por qué «Aprobar» está apagado?',
      '¿Cómo quito una foto de «Así se ve el lugar»?',
    ],
    pasos: [
      'Abre «Viajes · Emergencias y tarifas», baja hasta «Medir lugares en la calle» y elige la ciudad.',
      'En «Nueva tarea de medición», escribe el nombre, marca los lugares y agrega a los conductores. Toca «Crear tarea».',
      'Cuando llegue una medición, mírala en el mapa (gris es el punto guardado y rojo el medido) y revisa sus tres fotos.',
      'Toca «Aprobar» para mover el lugar y mostrar sus fotos en las apps, o «Rechazar» para dejarlo como está.',
      'Si una foto aprobada no debe verse, en «Así se ve el lugar (fotos en las apps)» toca sus tres puntos y «Quitar de las apps».',
      'Cuando estén todos, en los tres puntos de la tarea, «Cerrar tarea».',
    ],
    nota: 'Nada cambia sin tu aprobación, y solo se aprueba con las tres fotos. Una medición nunca mueve un lugar más de 300 m.',
  },
  en: {
    id: 'measure-places',
    titulo: 'Measure places on the street («I’m here»)',
    resumen:
      'Build a task with the own places that need checking, assign it to trusted drivers and approve each measurement. Nothing changes on the map until you approve.',
    explicacion: [
      'What it’s for: some places were set from the map and nobody has checked them on the street. A trusted driver goes to each one, taps «I’m here» in Driver and the app saves the real point from GPS. A new city can be measured in one morning.',
      'Where it is: in the menu, Rides · Emergencies and fares, the «Measure places on the street» card, below «Your city’s own places». Choose the city first.',
      'Create the task: type a name («Points along the highway»), a note for the driver if you want, check the places to measure and add the drivers. You can search drivers in that city or Support accounts. You can also create it unassigned and choose drivers later, in the task’s three dots, «Change drivers».',
      'Who sees it: only the assigned drivers. They get a notification and see «Points to measure» in their Profile in Driver. If you remove someone or close the task, they stop seeing it right away.',
      'Distance and accuracy: «I’m here» only turns on within 300 meters of the saved point and with GPS accuracy of 15 meters or better. Before that, the button stays gray and tells the driver what is missing («Get closer to the point (420 m to go)» or «Waiting for accuracy»). The server also refuses a measurement more than 300 m away: measuring corrects a place, it never moves it somewhere else. If the place really is farther away, change it by hand in «Your city’s own places».',
      'The three photos: after «I’m here», the driver takes three required photos with the camera (never from the gallery): entrance or front, sign or a landmark, and view from the street. Each one arrives with its GPS and time, and the server rejects it if it is old or was taken far from the measured point. Driver asks them to keep faces and license plates out.',
      'Approve: each measurement shows up in «Measurements to approve», with the place, how far it would move, who took it, the accuracy, the time and «The three photos of the place» (tap one to see it full size). On the map, the saved point is gray and the measured one is red. If a photo is missing, the card says which one and «Approve» is turned off: it is only approved with all three. If it looks right, tap «Approve»: the place moves, and its fixed price moves with it. Search picks it up within minutes.',
      'Photos in the apps: when you approve, the three photos show in the customer app and in Driver as «What the place looks like», when that place is the pickup or the destination of a ride. If the place is measured and approved again, the new photos show. The «What the place looks like (photos in the apps)» section lists all of the city’s photos: if one shouldn’t show (a face, a plate or something that isn’t the place), open its three dots and tap «Remove from the apps»; it stops showing right away.',
      'Reject: if the point doesn’t look right, tap «Reject» and add a reason if you want. The place doesn’t change, and the driver sees «Measure again» with your reason.',
      'If the place was changed by hand after it was measured, that measurement can’t be approved: reject it and ask for a new one.',
    ],
    capturas: [
      cap(
        'pendiente',
        'en',
        'The «Measure places on the street» card with a measurement to approve: «New measurement: … moved …», who took it, the accuracy, the map with the saved and measured points, and the Approve and Reject buttons.',
        'A new measurement, with the saved and measured points on the map, and its three photos.',
      ),
      cap(
        'fotos',
        'en',
        'The «What the place looks like (photos in the apps)» section with the approved photos of two example places and, open in one photo’s three dots, «Remove from the apps».',
        'The photos that show in the apps; remove any of them from its three dots.',
      ),
      cap(
        'tareas',
        'en',
        'The list of measuring tasks with how many places are measured and who it is assigned to, and the form to create a new task with places and drivers.',
        'The city’s tasks and the new task form.',
      ),
    ],
    preguntas: [
      'How do I ask a driver to check a place on the street?',
      'How do I approve a measurement?',
      'Why can’t I approve a measurement?',
      'Who sees a measuring task?',
      'What accuracy does «I’m here» require?',
      'Why is «Approve» turned off?',
      'How do I remove a photo from «What the place looks like»?',
    ],
    pasos: [
      'Open «Rides · Emergencies and fares», scroll to «Measure places on the street» and choose the city.',
      'In «New measuring task», type the name, check the places and add the drivers. Tap «Create task».',
      'When a measurement arrives, look at the map (gray is the saved point and red the measured one) and check its three photos.',
      'Tap «Approve» to move the place and show its photos in the apps, or «Reject» to leave it as it is.',
      'If an approved photo shouldn’t show, in «What the place looks like (photos in the apps)» open its three dots and tap «Remove from the apps».',
      'When all are done, in the task’s three dots, «Close task».',
    ],
    nota: 'Nothing changes without your approval, and it is only approved with all three photos. A measurement never moves a place more than 300 m.',
  },
};
