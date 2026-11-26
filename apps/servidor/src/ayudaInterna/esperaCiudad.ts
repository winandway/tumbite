import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026, Richard) — Venezuela y Estados Unidos. La lista de
 * espera por ciudad: qué es, cómo leerla, cómo decidir dónde abrir, qué pasa al abrir la zona y cómo
 * ponerle la ciudad a una cuenta a medias. Ayuda INTERNA (nunca va a Docs públicos).
 *
 * Capturas en la carpeta privada (~/Divoox-privado/ayuda-interna/capturas), con datos neutros.
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `espera-ciudad-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const esperaCiudad: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'city-waitlist',
    titulo: 'Lista de espera por ciudad: dónde abrir y cómo pasan los que esperan',
    resumen:
      'Cada persona se registra diciendo dónde vive: país, estado y ciudad. Si su ciudad todavía no tiene una zona abierta, su cuenta se crea igual y queda en la lista de espera de su ciudad. Aquí ves cuántos esperan en cada ciudad para decidir dónde abrir.',
    explicacion: [
      'Qué es: desde el 25 de noviembre de 2026 nadie se queda sin registrarse por su ciudad. Al crear la cuenta en Divoox Driver, en la app de clientes o en la web, la persona elige su país, su estado y su ciudad de la lista completa de Venezuela y de Estados Unidos. Si su ciudad cae dentro de una zona abierta, entra a esa zona sola. Si no, su cuenta queda «En espera de su ciudad»: puede entrar, subir sus fotos y sus papeles, y la app le dice que todavía no hay viajes ahí y que le avisamos apenas abramos.',
      'Dónde está: en el menú, grupo Personas, «Espera por ciudad». No lleva número rojo porque no es una tarea: nadie la «termina» desde el panel. Es un dato para decidir.',
      'Cómo leerla: cada fila es una ciudad, por ejemplo «Maracaibo, Zulia» o «Gilroy, California (CA)», con cuántos esperan en total y cuántos son conductores, clientes y personas que dejaron su correo en la web sin crear cuenta. Las de más gente van arriba. «Desde» es la fecha del primero que se anotó: una ciudad con mucha gente esperando desde hace semanas es una señal clara.',
      'Filtros: elige el país, después el estado, y en «Quién» mira solo conductores, solo clientes o solo los anotados en la web. Se guardan con tu cuenta y vuelven la próxima vez. El buscador encuentra desde la primera letra, sin acentos, por ciudad, municipio o estado: «mara» encuentra Maracaibo, «merida» todas las de Mérida.',
      'Al tocar una ciudad ves quiénes esperan ahí, con su código y la fecha en que se registraron. Cada nombre abre su ficha.',
      'Cómo decidir dónde abrir: mira primero cuántos conductores esperan, porque sin conductores no hay servicio. Después los clientes. Una ciudad con conductores y clientes esperando, y cerca de una zona que ya funciona, es la mejor candidata. La decisión de abrir un país o una ciudad nueva es de Richard.',
      'Qué pasa al abrir: cuando enciendes una zona en «Zonas», o guardas un área nueva, el sistema pasa solo a esa zona a todas las cuentas de la lista de espera cuya ciudad queda dentro. Zonas te dice en verde cuántas pasaron, y Camila les avisa por correo y en la app (y por WhatsApp «lo que te falta» cuando la plantilla esté aprobada) para que terminen su registro. Si dudas de que hayan pasado todos, en la zona encendida toca «Pasar a los que esperan»: vuelve a correr el paso y te dice cuántos pasaron. Cada vez se revisan hasta 100 cuentas; si en esa ciudad esperan más, el aviso dice «Quedan N por revisar» y el botón «Seguir» continúa donde quedó, hasta terminar. Si alguna cuenta no pudo pasar por un fallo, sigue en la lista de espera y pasa la próxima vez que toques el botón (el fallo queda anotado para el equipo técnico).',
      'En Repartidores y en Embudo de registro ves dónde vive cada cuenta y puedes filtrar por país y estado. «En espera de su ciudad» va en ámbar y no es un error. «Sin ciudad» va en gris: son cuentas de antes que nunca dijeron dónde viven.',
      'Cuentas a medias: a una cuenta «Sin ciudad» se le pide su ciudad la próxima vez que entra a la app. Si no entra, se la pones tú: abre su ficha, toca los tres puntos y elige «Poner su ciudad». Eliges país, estado y ciudad (escribe las primeras letras) y tocas «Guardar su ciudad». Si ahí hay una zona abierta, pasa a ella; si no, queda en la lista de espera de su ciudad. Nada de lo que ya subió se pierde.',
      'No confundas «Poner su ciudad» con «Cambiar ciudad»: «Cambiar ciudad» mueve a un conductor que ya trabaja de una zona abierta a otra. «Poner su ciudad» es para quien no dijo dónde vive.',
      'La lista de las ciudades donde vive la gente nunca se le muestra al público como «dónde funciona Divoox»: es solo de dónde es cada persona.',
    ],
    capturas: [
      cap(
        'lista',
        'es',
        'La pantalla «Lista de espera por ciudad» con los filtros de país, estado y quién, el buscador y la tabla de ciudades con cuántos conductores, clientes y anotados en la web esperan en cada una.',
        'Las ciudades con más gente esperando van arriba.',
      ),
      cap(
        'personas',
        'es',
        'Una ciudad abierta en la lista de espera con las personas que esperan ahí, cada una con su código, si es conductor o cliente y la fecha en que se registró.',
        'Al tocar una ciudad ves quiénes esperan y abres su ficha.',
      ),
      cap(
        'poner',
        'es',
        'La ventana «Poner su ciudad» en la ficha de un conductor, con el país, el estado y la ciudad elegidos y el botón «Guardar su ciudad».',
        'Para una cuenta que no dijo dónde vive: país, estado y ciudad.',
      ),
    ],
    preguntas: [
      '¿Cuántas personas esperan en cada ciudad?',
      '¿Dónde conviene abrir la próxima ciudad?',
      '¿Qué pasa con los que esperan cuando abro una zona?',
      '¿Cómo le pongo la ciudad a un conductor que quedó sin zona?',
      '¿Por qué un conductor sale «En espera de su ciudad»?',
    ],
    pasos: [
      'Para ver dónde esperan: menú, Personas, «Espera por ciudad». Elige el país y el estado, y en «Quién» elige conductores o clientes.',
      'Para ver quiénes son: toca la ciudad en la tabla y abre la ficha que necesites.',
      'Para abrir una ciudad: en «Zonas», enciende su zona (o guarda el área que la cubre). Mira el aviso verde con cuántos pasaron; si hace falta, toca «Pasar a los que esperan».',
      'Para una cuenta sin ciudad: abre su ficha, toca los tres puntos, «Poner su ciudad», elige país, estado y ciudad, y toca «Guardar su ciudad».',
    ],
    nota: 'Abrir un país o una ciudad nueva es una decisión de Richard: la lista sirve para traerle los números.',
  },
  en: {
    id: 'city-waitlist',
    titulo: 'Waitlist by city: where to open and how waiting people move in',
    resumen:
      'Everyone signs up by saying where they live: country, state and city. If their city has no open zone yet, their account is still created and stays on their city’s waitlist. Here you see how many people are waiting in each city so you can decide where to open.',
    explicacion: [
      'What it is: since November 25, 2026 nobody is kept from signing up because of their city. When they create their account in Divoox Driver, in the customer app or on the website, people pick their country, state and city from the full list for Venezuela and the United States. If their city falls inside an open zone, they join that zone on their own. If not, their account shows “Waiting for their city”: they can sign in, upload their photos and documents, and the app tells them there are no trips there yet and that we will let them know as soon as we open.',
      'Where it is: in the menu, People group, “Waitlist by city.” It has no red number because it is not a task: nobody “finishes” it from the panel. It is data for a decision.',
      'How to read it: each row is a city, for example “Maracaibo, Zulia” or “Gilroy, California (CA),” with how many are waiting in total and how many are drivers, customers and people who left their email on the website without creating an account. The ones with the most people are at the top. “Since” is the date of the first person who signed up there: a city with many people waiting for weeks is a clear signal.',
      'Filters: pick the country, then the state, and in “Who” look only at drivers, only at customers or only at website sign-ups. They are saved with your account and come back next time. The search box matches from the first letter, ignoring accents, by city, county or state: “mara” finds Maracaibo, “merida” every city in Mérida.',
      'Tap a city to see who is waiting there, with their code and the date they signed up. Each name opens their file.',
      'How to decide where to open: look at drivers first, because without drivers there is no service. Then customers. A city with drivers and customers waiting, close to a zone that already works, is the best candidate. Opening a new country or city is Richard’s decision.',
      'What happens when you open: when you turn a zone on in “Zones,” or save a new area, the system moves into that zone every waitlist account whose city falls inside it. Zones tells you in green how many moved in, and Camila lets them know by email and in the app (and with the WhatsApp “what is missing” message once the template is approved) so they finish signing up. If you doubt everyone moved in, tap “Move in the people waiting” on the live zone: it runs the step again and tells you how many moved in. Each run checks up to 100 accounts; if more people are waiting in that city, the notice says how many are left and the “Keep going” button continues where it stopped, until it is done. If an account could not move in because of an error, it stays on the waitlist and moves in the next time you tap the button (the error is logged for the tech team).',
      'In Drivers and in the Sign-up funnel you see where each account lives and can filter by country and state. “Waiting for their city” is amber and is not an error. “No city” is gray: these are older accounts that never said where they live.',
      'Half-finished accounts: a “No city” account is asked for its city the next time it opens the app. If they don’t, set it yourself: open their file, tap the three dots and choose “Set their city.” Pick the country, state and city (type the first letters) and tap “Save their city.” If there is an open zone there, they move into it; if not, they stay on their city’s waitlist. Nothing they already uploaded is lost.',
      'Don’t confuse “Set their city” with “Change city”: “Change city” moves a driver who already works from one live zone to another. “Set their city” is for people who never said where they live.',
      'The list of cities where people live is never shown to the public as “where Divoox works”: it only says where each person is from.',
    ],
    capturas: [
      cap(
        'lista',
        'en',
        'The “Waitlist by city” screen with the country, state and who filters, the search box and the table of cities with how many drivers, customers and website sign-ups are waiting in each one.',
        'The cities with the most people waiting are at the top.',
      ),
      cap(
        'personas',
        'en',
        'A city opened in the waitlist with the people waiting there, each with their code, whether they are a driver or a customer and the date they signed up.',
        'Tap a city to see who is waiting and open their file.',
      ),
      cap(
        'poner',
        'en',
        'The “Set their city” window in a driver’s file, with the country, state and city chosen and the “Save their city” button.',
        'For an account that never said where they live: country, state and city.',
      ),
    ],
    preguntas: [
      'How many people are waiting in each city?',
      'Where should we open the next city?',
      'What happens to the people waiting when I open a zone?',
      'How do I set the city of a driver with no zone?',
      'Why does a driver show “Waiting for their city”?',
    ],
    pasos: [
      'To see where people wait: menu, People, “Waitlist by city.” Pick the country and the state, and in “Who” choose drivers or customers.',
      'To see who they are: tap the city in the table and open the file you need.',
      'To open a city: in “Zones,” turn its zone on (or save the area that covers it). Check the green notice with how many moved in; if needed, tap “Move in the people waiting.”',
      'For an account with no city: open their file, tap the three dots, “Set their city,” pick the country, state and city, and tap “Save their city.”',
    ],
    nota: 'Opening a new country or city is Richard’s decision: the list is there to bring him the numbers.',
  },
};
