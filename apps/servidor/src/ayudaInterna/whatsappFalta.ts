import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * C-WHATSAPP-FALTA (25 nov 2026, encargo urgente de Richard) — todos los países. El WhatsApp «te
 * falta» al conductor trabado: qué dice, a quién le llega, sus topes, la plantilla de Meta, el botón de
 * la ficha y el envío a todos los trabados de una zona. Ayuda INTERNA (no va a Docs públicos).
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `whatsapp-falta-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const whatsappFalta: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'whatsapp-what-is-missing',
    titulo: 'WhatsApp «te falta»: el aviso al conductor trabado',
    resumen:
      'Camila le manda al conductor trabado, solo por WhatsApp, el paso exacto que le falta según su barra de activación. Quién lo recibe, cuántos como mucho, la plantilla de Meta, el botón de la ficha y el envío a todos los trabados de una zona.',
    explicacion: [
      'Qué le llega: «Hola Carlos 👋 Para que tu cuenta de Divoox Driver empiece a recibir carreras te falta: enviar tu moto a revisión. Entra a la app y complétalo. Si tienes dudas, responde a este mensaje.» Lo que le falta sale del PRIMER paso de su barra de activación que le toca a él, dicho en palabras: actualizar la app, tomarse la foto de la cara, la foto de su cédula, registrar la moto con su placa, enviarla a revisión, recargar saldo, subir sus papeles o conectarse. Lo que le toca al equipo nunca se le manda a él.',
      'A quién: solo a quien confirmó su celular ACTUAL con el código que le llegó por WhatsApp. La casilla de SMS no vale para WhatsApp. Si cambió de número, si el código por WhatsApp no le llegó o si pidió no recibir más recordatorios, no se le manda, ni a mano. La ventana dice el motivo en palabras.',
      'Cuántos: como mucho uno cada 24 horas por persona y tres por el mismo paso; al completarlo, deja de llegar. Desde la ficha puedes mandarlo aunque hayan pasado menos de 24 horas: la ventana te pide confirmarlo y queda en la auditoría con tu nombre. El tope de tres por paso y el permiso de la persona no se saltan nunca.',
      'Solo, sin que nadie lo toque: el vigilante de registros lo manda en las zonas donde los recordatorios de registro están encendidos, dentro del horario de la zona y con el mismo ritmo de horas del primer, segundo y tercer recordatorio. Va aparte del correo y del aviso en la app, que siguen como siempre.',
      'La plantilla de Meta: se llama divoox_driver_te_falta, es de categoría utilidad y está en español. Hasta que Meta la apruebe no sale ningún mensaje, ni solo ni a mano, y la sección «WhatsApp “te falta”» de Recordatorios de registro dice «No sale ningún mensaje» y por qué. Meta avisa sola cuando la aprueba; si no llega el aviso, se marca a mano en esa misma sección con lo que diga el administrador de WhatsApp de Meta. Si Meta la pasa a marketing, deja de usarse.',
      'Países y presupuesto: WhatsApp se enciende por país (Venezuela encendido, Estados Unidos apagado de fábrica). Hay un tope de mensajes y de dólares al día, con el costo estimado de cada mensaje (unos 0,01 dólares en Venezuela). Al llegar al tope, ese día no sale nada más y la pieza del canario se pone amarilla desde el 80 % y roja al tope.',
      'A todos los trabados de una zona: elige la zona, toca «Ver a quién se le manda» y revisa la tabla: cada conductor, lo que le falta y si sale o por qué no. «Mandar a N por WhatsApp» pide confirmación y manda solo a los que dicen «Sí». Se ven de 25 en 25: después de mandar, mira la página siguiente. Nunca se manda con un guion a mano.',
      'Dónde queda: cada envío queda en la línea de tiempo de la ficha («Camila le envió un WhatsApp» o «El equipo le envió un WhatsApp») con su estado, que pasa a «entregado» cuando Meta lo confirma. Si Meta no lo acepta, queda «no salió» con su motivo.',
      'Las respuestas: si la persona responde el WhatsApp, por ahora no llegan a la bandeja de Camila. Para atenderla, escríbele por los otros canales desde «Enviar mensaje».',
    ],
    capturas: [
      cap(
        'vista',
        'es',
        'La ficha de un conductor en Verificaciones con la ventana «WhatsApp: lo que le falta» abierta, el texto exacto que le llegará y el botón «Mandar por WhatsApp».',
        'Primero ves el texto exacto; para mandarlo hay que confirmar.',
      ),
      cap(
        'zona',
        'es',
        'La sección «WhatsApp “te falta”» de Recordatorios de registro con el estado de la plantilla, los países, el presupuesto del día y la tabla de los conductores trabados de una zona con lo que les falta.',
        'El estado del canal, los países y el envío a todos los trabados de una zona.',
      ),
    ],
    preguntas: [
      '¿Cómo le mando por WhatsApp a un conductor lo que le falta?',
      '¿Por qué no le puedo mandar el WhatsApp a este conductor?',
      '¿Cómo les mando el WhatsApp a todos los trabados de una ciudad?',
      '¿Por qué no sale ningún WhatsApp?',
      '¿Cómo apago el WhatsApp en un país?',
    ],
    pasos: [
      'Para uno: abre su ficha (en Verificaciones o en Repartidores), toca «Mandarle por WhatsApp lo que le falta», revisa el texto y toca «Mandar por WhatsApp».',
      'Para toda una zona: abre «Recordatorios de registro», baja a «WhatsApp “te falta”», elige la zona, toca «Ver a quién se le manda», revisa la tabla y toca «Mandar a N por WhatsApp».',
      'Para apagarlo en un país: en esa misma sección, desmarca el país y toca «Guardar».',
    ],
    nota: 'Nunca se le manda a una cuenta de prueba ni a quien no confirmó su celular por WhatsApp.',
  },
  en: {
    id: 'whatsapp-what-is-missing',
    titulo: 'WhatsApp “what is missing”: the notice to a stuck driver',
    resumen:
      'Camila sends a stuck driver, only on WhatsApp, the exact step they are missing according to their activation bar. Who gets it, how many at most, the Meta template, the button in the driver file and sending to everyone stuck in a zone.',
    explicacion: [
      'What they get (in Spanish, the only template for now): “Hola Carlos 👋 Para que tu cuenta de Divoox Driver empiece a recibir carreras te falta: enviar tu moto a revisión. …” (“to start getting trips you are missing: sending your motorcycle for review”). What is missing comes from the FIRST step of their activation bar that is up to them, in words: updating the app, the face photo, the ID photo, registering the motorcycle with its plate, sending it for review, topping up the balance, uploading documents or going online. What is up to the team is never sent to them.',
      'Who: only people who confirmed their CURRENT phone with the code they got on WhatsApp. The SMS checkbox does not count for WhatsApp. If they changed numbers, if the WhatsApp code was not delivered or if they asked to stop reminders, it is not sent, not even by hand. The window says why in words. Accounts in English do not get it until there is an English template.',
      'How many: at most one every 24 hours per person and three for the same step; once they complete it, it stops. From the driver file you can send it even if less than 24 hours have passed: the window asks you to confirm and it is logged in the audit trail with your name. The three-per-step limit and the person’s permission are never skipped.',
      'On its own: the sign-up watcher sends it in zones where sign-up reminders are on, within the zone’s hours and with the same hours as the first, second and third reminder. It is separate from the email and the app notification, which keep working as always.',
      'The Meta template: it is called divoox_driver_te_falta, it is a utility template and it is in Spanish. Until Meta approves it no message goes out, on its own or by hand, and the “WhatsApp ‘what is missing’” section in Sign-up reminders says “No message goes out” and why. Meta reports the approval by itself; if that notice does not arrive, set it by hand in that same section with what Meta’s WhatsApp Manager shows. If Meta moves it to marketing, it stops being used.',
      'Countries and budget: WhatsApp is turned on per country (Venezuela on, the United States off by default). There is a daily cap on messages and dollars, with the estimated cost of each message (about 0.01 dollars in Venezuela). Once the cap is reached nothing else goes out that day, and the health check piece turns yellow from 80% and red at the cap.',
      'Everyone stuck in a zone: pick the zone, tap “See who gets it” and check the table: each driver, what is missing and whether it goes out or why not. “Send to N on WhatsApp” asks for confirmation and sends only to those marked “Yes.” They are shown 25 at a time: after sending, check the next page. It is never sent with a script by hand.',
      'Where it is logged: every send shows on the file’s timeline (“Camila sent them a WhatsApp message” or “The team sent them a WhatsApp message”) with its status, which turns “delivered” when Meta confirms it. If Meta does not accept it, it shows “not sent” with the reason.',
      'Replies: if the person replies on WhatsApp, replies do not reach Camila’s inbox yet. To help them, write to them through the other channels with “Send message.”',
    ],
    capturas: [
      cap(
        'vista',
        'en',
        'A driver’s file in Verifications with the “WhatsApp: what is missing” window open, the exact text they would get and why it does not go out.',
        'First you see the exact text; sending it needs a confirmation.',
      ),
      cap(
        'zona',
        'en',
        'The “WhatsApp ‘what is missing’” section in Sign-up reminders with the template status, the countries, the daily budget and the table of stuck drivers in a zone with what each one is missing.',
        'The channel status, the countries and sending to everyone stuck in a zone.',
      ),
    ],
    preguntas: [
      'How do I send a driver what they are missing on WhatsApp?',
      'Why can’t I send the WhatsApp message to this driver?',
      'How do I send the WhatsApp message to everyone stuck in a city?',
      'Why is no WhatsApp message going out?',
      'How do I turn WhatsApp off in a country?',
    ],
    pasos: [
      'For one driver: open their file (in Verifications or Drivers), tap “Send them what is missing on WhatsApp,” check the text and tap “Send on WhatsApp.”',
      'For a whole zone: open “Sign-up reminders,” scroll to “WhatsApp ‘what is missing’,” pick the zone, tap “See who gets it,” check the table and tap “Send to N on WhatsApp.”',
      'To turn it off in a country: in that same section, uncheck the country and tap “Save.”',
    ],
    nota: 'It is never sent to a test account or to anyone who did not confirm their phone on WhatsApp.',
  },
};
