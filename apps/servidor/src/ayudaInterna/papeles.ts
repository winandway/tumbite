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
      'El conductor sube sus fotos con el asistente: una por paso, con el marco de lo que va. Nada llega a revisión hasta que él toca «Enviar a revisión».',
      'Cada foto pasa por una comprobación automática. Verde: se ve lo que se pidió y se lee. Amarillo: hay dudas. Rojo: no es lo que se pidió, por ejemplo una cara donde iba el reverso. «A mano» quiere decir que no hubo comprobación automática y la revisas tú como siempre. La comprobación adelanta trabajo; quien decide eres tú. Nunca rechaza a nadie por su cuenta.',
      'También compara la cara tomada en vivo con la foto del documento: «Misma persona», «Dudoso» o «No parece la misma persona». Lo dudoso y lo que no coincide se mira con cuidado.',
      'Debajo de cada foto sale lo que se leyó (nombre, número, vencimiento). Sirve para comparar con lo que la persona escribió. No se copia a su cuenta.',
      '«Pedir de nuevo» pide UNA sola foto, con el motivo. A la persona le llega el aviso con ese motivo y en su app se abre justo ese paso. Lo demás que ya subió se queda como está.',
      'Las decisiones del equipo se guardan al lado de lo que dijo la comprobación automática. De ahí sale el acierto por país y por tipo de foto, que se ve en Verificaciones y en Ajustes.',
      'La «Aprobación automática» viene apagada. Encendida en un país, lo que llegue todo en verde, con confianza alta y con la cara coincidiendo, se aprueba solo en minutos y a la persona le llega «Verificamos tus documentos». Todo lo demás sigue llegando a Verificaciones. Solo aprueba; nunca rechaza. Se enciende cuando el acierto medido convenza.',
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
      'Para revisar: Verificaciones → abre a la persona. Mira la tarjeta «Papeles»: los colores, lo leído y la comparación de la cara.',
      'Si una foto está mal: «Pedir de nuevo» en esa foto, escribe el motivo y toca «Pedir esta foto otra vez».',
      'Si todo está bien: aprueba la identidad ahí mismo, y la licencia y el seguro en su sección de siempre.',
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
      'Drivers upload their photos with the assistant: one per step, with a frame showing what goes there. Nothing reaches review until they tap “Send for review.”',
      'Every photo goes through an automatic check. Green: it shows what was asked and is readable. Yellow: there are doubts. Red: it isn’t what was asked, for example a face where the back of the ID should be. “By hand” means there was no automatic check and you review it as usual. The check saves you work; you decide. It never rejects anyone on its own.',
      'It also compares the live face with the photo on the document: “Same person,” “Unsure,” or “Doesn’t look like the same person.” Look closely at anything unsure or not matching.',
      'Under each photo you see what was read (name, number, expiration). Use it to compare with what the person typed. It isn’t copied to their account.',
      '“Ask again” requests ONE photo, with the reason. The person gets a notification with that reason and their app opens right at that step. Everything else they uploaded stays as is.',
      'The team’s decisions are stored next to what the automatic check said. That’s where the accuracy by country and photo type comes from, shown in Verifications and in Settings.',
      '“Automatic approval” is off by default. Turned on for a country, whatever comes all green, with high confidence and a matching face, is approved on its own within minutes and the person gets “We verified your documents.” Everything else still goes to Verifications. It only approves; it never rejects. Turn it on once the measured accuracy is convincing.',
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
      'To review: Verifications → open the person. Check the “Documents” card: the colors, what was read, and the face comparison.',
      'If a photo is wrong: “Ask again” on that photo, write the reason, and tap “Ask for this photo again.”',
      'If everything is fine: approve the identity right there, and the license and insurance in their usual section.',
      'To change a country’s policy: Settings → pick the country → “Driver documents grace period” → change it and tap “Save the documents grace period.” It’s recorded in the change history with your name.',
    ],
    nota: 'During the grace period, drivers work without a license or insurance verified by the team. It’s a company decision to get started; that’s why it helps to review what comes in quickly and keep a close eye on those ending soon.',
  },
};
