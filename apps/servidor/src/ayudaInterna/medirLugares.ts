import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * Medir lugares en la calle (C-ESTOY-AQUI, 27 nov 2026) — todas las ciudades. Cómo el equipo arma una
 * tarea de medición, la asigna a conductores de confianza y aprueba o rechaza cada medición. Ayuda
 * INTERNA (nunca va a Docs públicos). Capturas en la carpeta privada: en español El Vigía y en inglés
 * Novi, Michigan (C-CAPTURAS-POR-IDIOMA), con datos neutros.
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
      'La precisión: la app solo deja tocar «Estoy aquí» cuando el GPS tiene 15 metros de precisión o menos. Si no, le pide al conductor esperar unos segundos al aire libre o acercarse. Tampoco acepta una medición a más de 5 kilómetros del punto guardado: medir corrige un lugar, nunca lo lleva a otra parte ni a otra ciudad.',
      'Aprobar: cada medición llega a «Mediciones por aprobar», con el lugar, cuánto se movería, quién la tomó, la precisión, la hora y la foto si la tomó. En el mapa, el punto guardado va en gris y el medido en rojo. Si está bien, toca «Aprobar»: el lugar se mueve, y su precio del tabulador se mueve con él. Llega al buscador en unos minutos.',
      'Rechazar: si el punto no convence, toca «Rechazar» y escribe el motivo si quieres. El lugar no cambia, y el conductor ve «Medir otra vez» con tu motivo.',
      'Si el lugar se cambió a mano después de medirlo, esa medición ya no se puede aprobar: recházala y pide medirlo otra vez.',
    ],
    capturas: [
      cap(
        'pendiente',
        'es',
        'La tarjeta «Medir lugares en la calle» con una medición por aprobar: «Medición nueva: KM 9, movido…», quién la tomó, la precisión, el mapa con el punto guardado y el medido, y los botones Aprobar y Rechazar.',
        'Una medición nueva, con el punto guardado y el medido en el mapa.',
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
    ],
    pasos: [
      'Abre «Viajes · Emergencias y tarifas», baja hasta «Medir lugares en la calle» y elige la ciudad.',
      'En «Nueva tarea de medición», escribe el nombre, marca los lugares y agrega a los conductores. Toca «Crear tarea».',
      'Cuando llegue una medición, mírala en el mapa: gris es el punto guardado y rojo el medido.',
      'Toca «Aprobar» para mover el lugar, o «Rechazar» para dejarlo como está.',
      'Cuando estén todos, en los tres puntos de la tarea, «Cerrar tarea».',
    ],
    nota: 'Nada cambia sin tu aprobación. Una medición nunca mueve un lugar a otra ciudad ni más de 5 km.',
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
      'Accuracy: the app only lets the driver tap «I’m here» when GPS accuracy is 15 meters or better. If not, it asks them to wait a few seconds outdoors or move closer. It also refuses a measurement more than 5 kilometers from the saved point: measuring corrects a place, it never moves it somewhere else or to another city.',
      'Approve: each measurement shows up in «Measurements to approve», with the place, how far it would move, who took it, the accuracy, the time and the photo if there is one. On the map, the saved point is gray and the measured one is red. If it looks right, tap «Approve»: the place moves, and its fixed price moves with it. Search picks it up within minutes.',
      'Reject: if the point doesn’t look right, tap «Reject» and add a reason if you want. The place doesn’t change, and the driver sees «Measure again» with your reason.',
      'If the place was changed by hand after it was measured, that measurement can’t be approved: reject it and ask for a new one.',
    ],
    capturas: [
      cap(
        'pendiente',
        'en',
        'The «Measure places on the street» card with a measurement to approve: «New measurement: … moved …», who took it, the accuracy, the map with the saved and measured points, and the Approve and Reject buttons.',
        'A new measurement, with the saved and measured points on the map.',
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
    ],
    pasos: [
      'Open «Rides · Emergencies and fares», scroll to «Measure places on the street» and choose the city.',
      'In «New measuring task», type the name, check the places and add the drivers. Tap «Create task».',
      'When a measurement arrives, look at the map: gray is the saved point and red is the measured one.',
      'Tap «Approve» to move the place, or «Reject» to leave it as it is.',
      'When all are done, in the task’s three dots, «Close task».',
    ],
    nota: 'Nothing changes without your approval. A measurement never moves a place to another city or more than 5 km.',
  },
};
