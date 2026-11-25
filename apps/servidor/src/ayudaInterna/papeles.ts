import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * C-PLAZO-PAPELES, C-VERIFICACION-ASISTENTE y C-VERIFICACION-IA (20 nov 2026) — todos los países.
 * La guía interna del plazo de papeles del conductor y de la revisión de sus fotos.
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `papeles-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const plazoPapeles: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'driver-documents-grace-period',
    titulo: 'Plazo de papeles y revisión de fotos del conductor',
    resumen:
      'En los países con plazo, el conductor trabaja desde que crea su cuenta y tiene unos días para subir sus papeles. Aquí ves cuántos días le quedan a cada uno, revisas sus fotos con la comprobación automática en verde, amarillo o rojo, y le pides repetir una sola foto.',
    explicacion: [
      'Cada país tiene su política. Con plazo, el conductor queda activo al crear la cuenta y tomarse la foto de la cara, y tiene los días del plazo para subir y que se le aprueben sus papeles. Con cero días, todo se aprueba antes del primer viaje, como siempre.',
      'Los avisos salen solos: al registrarse y cuando le quedan 15, 10, 5 y 1 día, por la app y por correo. Si el plazo vence, la cuenta queda en pausa: no recibe viajes, no se borra, y vuelve sola cuando sube lo que falta y se aprueba. Si venció y ya había enviado todo, no se le pausa por una demora nuestra: se le dan 7 días más y queda anotado.',
      'En la lista de conductores, la columna «Papeles» dice «En plazo» con los días que quedan, «Completos» o «Plazo vencido · en pausa». El filtro «Papeles» deja ver solo a los que están por vencer (10 días o menos), a los que están dentro del plazo o a los vencidos. El filtro se queda guardado para tu próxima visita.',
      'El conductor sube sus fotos con el asistente: una por paso, con el marco de lo que va. Cada papel llega solo a «Pendientes» en cuanto tiene todas sus fotos (la identidad, con el documento, la cara y el consentimiento); el vehículo, cuando tiene la placa y el registro (y el seguro fuera del plazo). No hace falta que toque «Enviar a revisión». Nada se aprueba solo: decides tú. En «Sin enviar» quedan solo los que de verdad no terminaron, con lo que les falta.',
      'Cada foto pasa por una comprobación automática. Verde: se ve lo que se pidió y se lee. Amarillo: hay dudas. Rojo: no es lo que se pidió, por ejemplo una cara donde iba el reverso. «A mano» quiere decir que no hubo comprobación automática y la revisas tú como siempre. La comprobación adelanta trabajo; quien decide eres tú. Nunca rechaza a nadie por su cuenta.',
      'La comprobación automática solo corre si el conductor dio su permiso en el aviso «Cómo revisamos tus documentos», que Driver muestra una sola vez antes de la primera foto (y una vez al entrar a quien no lo había contestado). En Android y en la web ese permiso es obligatorio para seguir; en iPhone puede elegir «Prefiero revisión solo por una persona», y entonces todas sus fotos llegan «A mano». Puede retirarlo en su perfil. Cuando lo da, las fotos que ya había subido pasan una vez por la comprobación y aquí ves el color.',
      'También compara la cara tomada en vivo con la foto del documento: «Misma persona», «Dudoso» o «No parece la misma persona». Lo dudoso y lo que no coincide se mira con cuidado.',
      'Debajo de cada foto sale lo que se leyó (nombre, número, vencimiento). Sirve para comparar con lo que la persona escribió. No se copia a su cuenta.',
      '«Pedir de nuevo» pide UNA sola foto, con el motivo. A la persona le llega el aviso con ese motivo y en su app se abre justo ese paso. Lo demás que ya subió se queda como está.',
      'Las decisiones del equipo se guardan al lado de lo que dijo la comprobación automática. De ahí sale el acierto por país y por tipo de foto, que se ve en Verificaciones y en Ajustes.',
      'La «Aprobación automática» viene apagada. Encendida en un país, lo que llegue todo en verde, con confianza alta y con la cara coincidiendo, se aprueba solo en minutos y a la persona le llega «Verificamos tus documentos». Todo lo demás sigue llegando a Verificaciones. Solo aprueba; nunca rechaza. Se enciende cuando el acierto medido convenza.',
      'La pantalla Verificaciones empieza por la lista de personas por verificar: su foto (tócala para verla en grande; se cierra con Escape o tocando fuera), su nombre, su ID, su zona, cuánto lleva esperando (ámbar; rojo después de 24 horas) y lo que dijo la comprobación automática de cada foto: verde si todo cuadra, ámbar con el motivo en palabras si hay duda, gris si se revisa a mano. Arriba están las pestañas Pendientes, Aprobadas y Rechazadas, el buscador (nombre, ID con o sin «#», correo, teléfono o zona, sin importar acentos ni mayúsculas, desde la primera letra) y los filtros de zona y de cuentas reales o de prueba, que se recuerdan para tu próxima visita. Si lo que buscas está en otra pestaña, la pantalla te lo dice.',
      'Al abrir a una persona ves sus fotos grandes lado a lado, la tabla «Lo que leyó la comprobación automática» frente a «Lo que escribió la persona» (lo que no coincide va en ámbar) y la decisión: «Aprobar», o «Rechazar» con un motivo frecuente o escrito por ti, que es obligatorio y le llega a la persona en su idioma. La comprobación automática nunca decide aquí: decide una persona.',
      'Las reglas para conductores, el reparto de Comida por habilitaciones y el gasto, el tope y el acierto de la comprobación automática están en el botón «Configuración», arriba a la derecha de Verificaciones.',
      'A quien se registró antes de que existiera el plazo no se le cambia nada. Si hace falta, en su ficha está «Dar plazo de papeles», que le empieza a contar desde ese día.',
    ],
    capturas: [
      cap(
        'lista',
        'es',
        'La lista de conductores con la columna Papeles y el filtro Papeles abierto en «Plazo por vencer».',
        'La columna «Papeles» y su filtro.',
      ),
      cap(
        'comprobaciones',
        'es',
        'La tarjeta Papeles de un conductor con sus fotos, cada una con su luz verde, amarilla o roja, lo que se leyó y el enlace Pedir de nuevo.',
        'Cada foto con su color y lo que se leyó.',
      ),
      cap(
        'pedir',
        'es',
        'El formulario para pedir de nuevo una sola foto, con el motivo escrito.',
        'Pedir de nuevo una sola foto, con motivo.',
      ),
      cap(
        'politica',
        'es',
        'El bloque Plazo de papeles del conductor en Ajustes, con los días, lo que se exige para empezar, lo que el país no exige y la aprobación automática apagada.',
        'La política del país, en Ajustes.',
      ),
    ],
    preguntas: [
      '¿Cuántos días le quedan a un conductor para subir sus papeles?',
      '¿Cómo veo a los que están por vencer?',
      '¿Qué significan el verde, el amarillo y el rojo de una foto?',
      '¿Cómo le pido a alguien que repita solo una foto?',
      '¿Dónde cambio los días del plazo de un país?',
      '¿Qué hace la aprobación automática y cuándo se enciende?',
    ],
    pasos: [
      'Para ver quién está por vencer: Conductores → filtro «Papeles» → «Plazo por vencer».',
      'Para revisar: Verificaciones → busca o elige a la persona en la lista y toca «Revisar». Mira las fotos, la tabla de lo leído frente a lo escrito y la tarjeta «Papeles».',
      'Si una foto está mal: «Pedir de nuevo» en esa foto, escribe el motivo y toca «Pedir esta foto otra vez».',
      'Si todo está bien: aprueba la identidad ahí mismo, y la licencia y el seguro en su sección de siempre.',
      'Al aprobar la moto o el carro de alguien que no tiene otro vehículo en uso, queda en uso solo y su servicio de viajes queda elegido si ya lo puede hacer: no hace falta que él toque «Usar este vehículo».',
      'La moto o el carro dentro del plazo: en Verificaciones, en «Vehículo por revisar» de su ficha, puede llegar sin póliza. Si dice «Póliza: pendiente, dentro del plazo de papeles (vence el …)», aprueba el registro y el vehículo; la póliza llega dentro del plazo. Si el plazo vence sin la póliza aprobada, el conductor no se conecta con ese vehículo.',
      'Para cambiar la política de un país: Ajustes → elige el país → «Plazo de papeles del conductor» → cambia y toca «Guardar el plazo de papeles». Queda en el historial de cambios con tu nombre.',
    ],
    nota: 'Durante el plazo hay conductores trabajando sin licencia ni seguro verificados por el equipo. Es una decisión de la empresa para arrancar; por eso conviene revisar pronto lo que llega y seguir de cerca a los que están por vencer.',
  },
  en: {
    id: 'driver-documents-grace-period',
    titulo: 'Driver documents grace period and photo review',
    resumen:
      'In countries with a grace period, drivers work from the moment they create their account and have a number of days to upload their documents. Here you see how many days each one has left, review their photos with the automatic check in green, yellow or red, and ask them to retake a single photo.',
    explicacion: [
      'Each country has its own policy. With a grace period, the driver is active once they create the account and take their face photo, and has the grace period days to upload their documents and get them approved. With zero days, everything is approved before the first ride, as always.',
      'Reminders go out on their own: at sign-up and when 15, 10, 5 and 1 day are left, in the app and by email. If the grace period ends, the account is paused: it gets no rides, it isn’t deleted, and it comes back on its own once the missing documents are uploaded and approved. If it ended and they had already sent everything, they aren’t paused for our delay: they get 7 more days and it’s logged.',
      'In the drivers list, the “Documents” column says “Grace period” with the days left, “Complete,” or “Grace period over · paused.” The “Documents” filter shows only those ending soon (10 days or less), those within the grace period, or those past it. The filter is remembered for your next visit.',
      'Drivers upload their photos with the assistant: one per step, with a frame showing what goes there. Each document reaches “Pending” on its own once all its photos are in (the identity, with the ID, the face and the consent); the vehicle, once it has the plate and the registration (and the insurance outside the grace period). They don’t need to tap “Send for review.” Nothing is approved on its own: you decide. “Not submitted” only lists those who really didn’t finish, with what they’re missing.',
      'Every photo goes through an automatic check. Green: it shows what was asked and is readable. Yellow: there are doubts. Red: it isn’t what was asked, for example a face where the back of the ID should be. “By hand” means there was no automatic check and you review it as usual. The check saves you work; you decide. It never rejects anyone on its own.',
      'The automatic check only runs if the driver gave permission on the “How we check your documents” notice, which Driver shows once before the first photo (and once on opening the app for anyone who hadn’t answered). On Android and on the web that permission is required to continue; on iPhone they can choose “I prefer review by a person only,” and then all their photos arrive “By hand.” They can withdraw it in their profile. When they give it, the photos they had already uploaded go through the check once and you see the color here.',
      'It also compares the live face with the photo on the document: “Same person,” “Unsure,” or “Doesn’t look like the same person.” Look closely at anything unsure or not matching.',
      'Under each photo you see what was read (name, number, expiration). Use it to compare with what the person typed. It isn’t copied to their account.',
      '“Ask again” requests ONE photo, with the reason. The person gets a notification with that reason and their app opens right at that step. Everything else they uploaded stays as is.',
      'The team’s decisions are stored next to what the automatic check said. That’s where the accuracy by country and photo type comes from, shown in Verifications and in Settings.',
      '“Automatic approval” is off by default. Turned on for a country, whatever comes all green, with high confidence and a matching face, is approved on its own within minutes and the person gets “We verified your documents.” Everything else still goes to Verifications. It only approves; it never rejects. Turn it on once the measured accuracy is convincing.',
      'The Verifications screen starts with the list of people to verify: their photo (tap it to see it full size; Escape or tapping outside closes it), their name, ID, area, how long they have been waiting (amber; red after 24 hours) and what the automatic check said about each photo: green if everything checks out, amber with the reason in words if there is a doubt, gray if it is reviewed by hand. At the top are the Pending, Approved and Rejected tabs, the search box (name, ID with or without “#”, email, phone or area, ignoring accents and capitals, from the first letter) and the area and real or test accounts filters, which are remembered for your next visit. If what you search for is in another tab, the screen tells you.',
      'When you open a person you see their photos full size side by side, the table “What the automatic check read” next to “What the person typed” (mismatches show in amber) and the decision: “Approve,” or “Reject” with a common reason or one you write, which is required and reaches the person in their language. The automatic check never decides here: a person does.',
      'The rules for drivers, Food dispatch by service approvals, and the spend, cap and accuracy of the automatic check are under the “Settings” button, top right of Verifications.',
      'Nothing changes for people who signed up before the grace period existed. If needed, their page has “Give a documents grace period,” which starts counting that day.',
    ],
    capturas: [
      cap(
        'lista',
        'en',
        'The drivers list with the Documents column and the Documents filter open on “Grace period ending.”',
        'The “Documents” column and its filter.',
      ),
      cap(
        'comprobaciones',
        'en',
        'A driver’s Documents card with their photos, each with a green, yellow or red light, what was read, and the Ask again link.',
        'Each photo with its color and what was read.',
      ),
      cap(
        'pedir',
        'en',
        'The form to ask for a single photo again, with the reason filled in.',
        'Ask for a single photo again, with a reason.',
      ),
      cap(
        'politica',
        'en',
        'The Driver documents grace period block in Settings, with the days, what is required to start, what the country never asks for, and automatic approval turned off.',
        'The country policy, in Settings.',
      ),
    ],
    preguntas: [
      'How many days does a driver have left to upload their documents?',
      'How do I see the ones ending soon?',
      'What do green, yellow and red mean on a photo?',
      'How do I ask someone to retake just one photo?',
      'Where do I change a country’s grace period days?',
      'What does automatic approval do, and when should it be turned on?',
    ],
    pasos: [
      'To see who is ending soon: Drivers → “Documents” filter → “Grace period ending.”',
      'To review: Verifications → search for or pick the person in the list and tap “Review.” Check the photos, the table of what was read versus what was typed, and the “Documents” card.',
      'If a photo is wrong: “Ask again” on that photo, write the reason, and tap “Ask for this photo again.”',
      'If everything is fine: approve the identity right there, and the license and insurance in their usual section.',
      'When you approve the motorbike or car of someone who isn’t using another vehicle, it’s set as in use on its own and its ride service is selected if they can already do it: they don’t need to tap “Use this vehicle.”',
      'A motorbike or car within the grace period: in Verifications, under “Vehicle to review” in their file, it may arrive without a policy. If it says “Insurance policy: pending, within the documents grace period (ends …),” approve the registration and the vehicle; the policy comes within the grace period. If the period ends without an approved policy, the driver can’t go online with that vehicle.',
      'To change a country’s policy: Settings → pick the country → “Driver documents grace period” → change it and tap “Save the documents grace period.” It’s recorded in the change history with your name.',
    ],
    nota: 'During the grace period, drivers work without a license or insurance verified by the team. It’s a company decision to get started; that’s why it helps to review what comes in quickly and keep a close eye on those ending soon.',
  },
};

/**
 * C-PAPELES-POR-PAIS (24 nov 2026) — todos los países por configuración. La guía interna de la lista
 * de papeles por país (Ajustes → país). Solo para el equipo: nunca en Docs públicos.
 */
export const papelesDelPais: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'driver-documents-by-country',
    titulo: 'Papeles del conductor por país',
    resumen:
      'En Ajustes, cada país tiene su lista de papeles: qué se le pide al conductor, cómo se llama cada papel en español y en inglés, si vence, si lleva foto y si frena las carreras o solo se pide. Viene apagada: apagada, el conductor ve los papeles de siempre.',
    explicacion: [
      'La lista está en Ajustes → elige el país → «Papeles que se le piden al conductor en este país», debajo del plazo de papeles.',
      'Cada papel dice si es del conductor (licencia, certificado médico) o del vehículo (título o carnet de circulación, póliza, fotos), para qué servicio se pide (Moto, Carro o los dos), su nombre en los dos idiomas, si vence y si lleva foto.',
      '«Frena las carreras» o «Solo se pide» no lo eliges tú: lo dice el reparto. Los papeles que hoy frenan (el registro, la póliza y la póliza de pasajeros del vehículo, la inspección en Carro y la licencia) siguen frenando. Los nuevos, como el certificado médico o la foto con la placa, solo se piden: el conductor los sube y el equipo los revisa, pero no le quitan carreras.',
      'Una lista encendida no puede dejar fuera un papel que frena: el conductor no tendría dónde subirlo. Si falta, al guardar sale el aviso con el papel exacto.',
      'En Venezuela la póliza RCV también cubre al pasajero: se pide una sola vez y se guarda en las dos casillas, como ya hacía el asistente de fotos.',
      'Encendida la lista de un país: Driver pide esos papeles con esos nombres; la barra de activación suma el paso «Papeles del país (solo se piden)», que nunca frena; Verificaciones recibe esos papeles para revisarlos; Camila le recuerda al conductor los que no subió; y el plazo de papeles no se da por completo mientras le falte subir alguno (al vencer no se le pausa por eso).',
      'Mientras escribes, lo que cambias se guarda en tu navegador. Si se cierra la ventana, al volver está todo; «Empezar de nuevo» vuelve a lo guardado.',
    ],
    capturas: [
      cap(
        'lista-pais',
        'es',
        'Ajustes de Venezuela con la lista de papeles del conductor: licencia, certificado médico, título o carnet de circulación, póliza RCV y foto con la placa, cada uno con «Frena las carreras» o «Solo se pide».',
        'La lista de papeles de un país, en Ajustes.',
      ),
    ],
    pasos: [
      'Ajustes → elige el país → baja hasta «Papeles que se le piden al conductor en este país».',
      'Revisa cada papel: para qué servicio, nombre en español y en inglés, si vence y si lleva foto.',
      'Para agregar uno: elige el papel en «Agregar papel» y toca «Agregar papel». Para quitarlo: los tres puntos de ese papel → «Quitar de la lista».',
      'Marca «Encender la lista de este país» cuando la versión de Driver que muestra estos nombres ya esté en las tiendas.',
      'Toca «Guardar los papeles del país». Queda en el historial de cambios con tu nombre.',
    ],
    nota: 'Antes de encender un país, comprueba que los conductores ya tengan la versión nueva de Driver: la anterior mostraría el certificado médico con su nombre interno.',
  },
  en: {
    id: 'driver-documents-by-country',
    titulo: 'Driver documents by country',
    resumen:
      'In Settings, each country has its own documents list: what drivers are asked for, what each document is called in Spanish and English, whether it expires, whether it needs a photo, and whether it blocks trips or is requested only. It starts off: while off, drivers see the usual documents.',
    explicacion: [
      'The list is in Settings → pick the country → “Documents drivers are asked for in this country,” below the documents grace period.',
      'Each document says whether it belongs to the driver (license, medical certificate) or to the vehicle (title or registration card, insurance policy, photos), which service it is for (Moto, Car or both), its name in both languages, whether it expires and whether it needs a photo.',
      '“Blocks trips” or “Requested only” is not up to you: dispatch decides it. Documents that block today (the vehicle registration, insurance and rider insurance, the inspection for Car, and the license) keep blocking. New ones, like the medical certificate or the photo with the plate, are requested only: the driver uploads them and the team reviews them, but they never take trips away.',
      'A list that is on cannot leave out a document that blocks: the driver would have nowhere to upload it. If one is missing, saving shows a notice naming it.',
      'In Venezuela the RCV policy also covers the rider: it is asked for once and saved in both boxes, as the photo assistant already did.',
      'With a country’s list on: Driver asks for those documents with those names; the activation bar adds the step “Country documents (requested only),” which never blocks; Verifications receives those documents for review; Camila reminds drivers of the ones they did not upload; and the documents grace period is not marked complete while one is still missing (when it ends, nobody is paused for that).',
      'While you type, your changes are saved in your browser. If the window closes, everything is there when you come back; “Start over” goes back to what was saved.',
    ],
    capturas: [
      cap(
        'lista-pais',
        'en',
        'Settings for a country with the driver documents list: license, medical certificate, title or registration card, insurance policy and plate photo, each marked “Blocks trips” or “Requested only”.',
        'A country’s documents list, in Settings.',
      ),
    ],
    pasos: [
      'Settings → pick the country → scroll to “Documents drivers are asked for in this country.”',
      'Check each document: which service, name in Spanish and in English, whether it expires and whether it needs a photo.',
      'To add one: pick it in “Add document” and tap “Add document.” To remove it: that document’s three dots → “Remove from the list.”',
      'Check “Turn on this country’s list” once the Driver version that shows these names is in the stores.',
      'Tap “Save the country’s documents.” It is recorded in the change history with your name.',
    ],
    nota: 'Before turning a country on, make sure drivers already have the new Driver version: the previous one would show the medical certificate by its internal name.',
  },
};
