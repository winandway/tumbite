import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * Lugares propios de tu ciudad (27 nov 2026) — todos los países. Cómo el equipo agrega los lugares
 * con el nombre que usa la gente de la ciudad, mueve su punto en el mapa y lo ata a un precio del
 * tabulador. Ayuda INTERNA (nunca va a Docs públicos).
 *
 * Capturas en la carpeta privada (~/Divoox-privado/ayuda-interna/capturas): en español las de El
 * Vigía y en inglés las de Novi, Michigan (C-CAPTURAS-POR-IDIOMA), con datos neutros.
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `lugares-propios-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const lugaresCiudad: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'city-own-places',
    titulo: 'Lugares propios de tu ciudad',
    resumen:
      'Los lugares con el nombre que usa la gente de la ciudad («km9», la plaza, el terminal), con su punto exacto en el mapa y, si quieres, atados a un precio del tabulador. Salen en el buscador de la app de clientes, la web y Driver.',
    explicacion: [
      'Para qué sirve: el buscador de direcciones no conoce los nombres que la gente usa de verdad en su pueblo. Aquí los escribes tú una vez, con el punto exacto, y desde ese momento el cliente y el conductor los encuentran al escribir, aunque lo escriban de otra forma.',
      'Dónde está: en el menú, Viajes · Emergencias y tarifas, y más abajo la tarjeta «Lugares propios de tu ciudad», justo debajo de los precios de la zona. Primero eliges la ciudad. Los lugares de una ciudad solo salen en esa ciudad.',
      'Otros nombres: en «Otros nombres o formas de escribirlo» pones, separados por comas, las otras formas que usa la gente, por ejemplo «km9, kilómetro 9, KM-9». El buscador no distingue mayúsculas ni acentos y encuentra desde la segunda letra. Un nombre no se puede repetir en dos lugares de la misma ciudad.',
      'El punto: en el mapa, arrastra el mapa hasta que el pin fijo del centro quede justo sobre el lugar. Ese es el punto que recibe el conductor.',
      'Atarlo a un precio: en «Precio del tabulador» eliges una ruta de los precios de la zona, o «Sin precio fijo». Al guardar un lugar atado, el punto de esa ruta del tabulador se mueve al mismo lugar, y también el de la ruta de regreso que sale de ahí. Así el precio y el lugar nunca quedan desfasados.',
      'Apagar: en los tres puntos de cada lugar eliges «Apagar» y deja de salir en el buscador. No se borra: «Encender» lo devuelve con todo lo que tenía. No hay botón de borrar.',
      'Cuándo se ve: lo que guardas llega al buscador de la app de clientes, la web y Driver en unos minutos (la memoria del buscador dura 5 minutos). En cada búsqueda salen como mucho tres lugares propios, los más parecidos a lo que se escribe.',
    ],
    capturas: [
      cap(
        'lista',
        'es',
        'La tarjeta «Lugares propios de tu ciudad» con la ciudad elegida, el buscador y la lista de lugares con sus otros nombres, el precio atado y el enlace «Ver en el mapa».',
        'La lista de lugares de la ciudad, con su buscador.',
      ),
      cap(
        'formulario',
        'es',
        'El formulario para agregar un lugar con el nombre, los otros nombres separados por comas, el mapa con el pin fijo en el centro y el selector «Precio del tabulador».',
        'Nombre, otros nombres, punto en el mapa y precio atado.',
      ),
    ],
    preguntas: [
      '¿Cómo agrego un lugar que el buscador no encuentra?',
      '¿Cómo hago que «km9» encuentre «KM 9»?',
      '¿Cómo muevo el punto de un lugar?',
      '¿Cómo ato un lugar a un precio del tabulador?',
      '¿Cuánto tarda en salir en el buscador?',
    ],
    pasos: [
      'Abre «Viajes · Emergencias y tarifas», baja hasta «Lugares propios de tu ciudad» y elige la ciudad.',
      'Para agregar: escribe el nombre y, en «Otros nombres», las otras formas separadas por comas.',
      'Arrastra el mapa hasta que el pin quede sobre el lugar.',
      'Si tiene precio fijo, elígelo en «Precio del tabulador»; si no, deja «Sin precio fijo». Toca «Guardar».',
      'Para cambiarlo: tres puntos del lugar, «Editar». Para quitarlo del buscador: tres puntos, «Apagar».',
    ],
    nota: 'Los cambios llegan al buscador en unos minutos y solo en esa ciudad. Apagar no borra nada.',
  },
  en: {
    id: 'city-own-places',
    titulo: 'Your city’s own places',
    resumen:
      'The places under the name people in the city really use (“km9”, the plaza, the terminal), with their exact point on the map and, if you want, tied to a pricing-table price. They show up in search in the customer app, the web and Driver.',
    explicacion: [
      'What it is for: the address search doesn’t know the names people really use in their town. You type them here once, with the exact point, and from then on customers and drivers find them as they type, even if they spell them another way.',
      'Where it is: in the menu, Rides · Emergencies and fares, and further down the “Your city’s own places” card, right under the local fixed prices. You choose the city first. A city’s places only show up in that city.',
      'Other names: in “Other names or ways to write it” you add, separated by commas, the other forms people use, for example “km9, kilometer 9, KM-9”. Search ignores capitals and accents and finds from the second letter. A name can’t be used by two places in the same city.',
      'The point: on the map, drag the map until the fixed pin in the center sits right on the place. That is the point the driver receives.',
      'Tying it to a price: in “Pricing-table price” you choose a route from the local fixed prices, or “No fixed price”. When you save a place tied to a price, the point of that pricing-table route moves to the same place, and so does the return route that starts there. That way the price and the place never drift apart.',
      'Turning off: in each place’s three dots choose “Turn off” and it stops showing in search. Nothing is deleted: “Turn on” brings it back with everything it had. There is no delete button.',
      'When it shows: what you save reaches search in the customer app, the web and Driver within a few minutes (search keeps a 5-minute memory). Each search shows at most three of the city’s own places, the closest matches to what was typed.',
    ],
    capturas: [
      cap(
        'lista',
        'en',
        'The “Your city’s own places” card with the city chosen, the search box and the list of places with their other names, the tied price and the “View on map” link.',
        'The city’s list of places, with its search box.',
      ),
      cap(
        'formulario',
        'en',
        'The form to add a place with the name, the other names separated by commas, the map with the fixed pin in the center and the “Pricing-table price” selector.',
        'Name, other names, point on the map and tied price.',
      ),
    ],
    preguntas: [
      'How do I add a place the search can’t find?',
      'How do I make “km9” find “KM 9”?',
      'How do I move a place’s point?',
      'How do I tie a place to a pricing-table price?',
      'How long until it shows in search?',
    ],
    pasos: [
      'Open “Rides · Emergencies and fares”, scroll to “Your city’s own places” and choose the city.',
      'To add one: type the name and, in “Other names”, the other forms separated by commas.',
      'Drag the map until the pin sits on the place.',
      'If it has a fixed price, choose it in “Pricing-table price”; if not, leave “No fixed price”. Tap “Save”.',
      'To change it: the place’s three dots, “Edit”. To take it out of search: three dots, “Turn off”.',
    ],
    nota: 'Changes reach search in a few minutes and only in that city. Turning off deletes nothing.',
  },
};
