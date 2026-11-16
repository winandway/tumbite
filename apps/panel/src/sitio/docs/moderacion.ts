import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-MODERACION y C-AVISOS-IDIOMA (16 nov 2026) — todos los países. Guías públicas de reportar,
 * bloquear, el filtro de palabras, la bandeja del equipo y los avisos en tu idioma, con capturas
 * REALES tomadas por `scripts/recorrido/capturas-moderacion.mjs` (inglés en Novi, Michigan; español
 * en Miami). Nada privado: la dirección del superadmin no aparece.
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-moderacion-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_MODERACION: Record<Idioma, PorSeccion> = {
  es: {
    trust: [
      {
        id: 'report-and-block',
        titulo: 'Reportar un mensaje o una reseña, y bloquear a una persona',
        resumen:
          'Si alguien te escribe algo ofensivo en el chat del pedido o del viaje, o ves una reseña fuera de lugar, la reportas en dos toques. Y si no quieres saber más de esa persona, la bloqueas.',
        explicacion: [
          'En Divoox el chat existe solo entre las dos personas de un pedido o de un viaje, y solo mientras está en curso. Aun así, a veces alguien se pasa de la raya. Por eso, como en las grandes apps de reparto y de viajes, cada mensaje de la otra persona lleva su botón «Reportar», y cada reseña pública también.',
          'Al reportar eliges el motivo (es ofensivo, es acoso o una amenaza, es spam, u otra cosa) y, si quieres, escribes una nota. Lo revisa una persona de nuestro equipo en menos de 24 horas. La otra persona nunca sabe quién la reportó.',
          'Bloquear va un paso más allá: dejas de ver sus mensajes, no recibes avisos de lo que escriba y no te volvemos a emparejar con esa persona en pedidos ni viajes. No se le avisa. Puedes desbloquearla cuando quieras desde tu cuenta, en «Personas bloqueadas».',
          'Además, un filtro de palabras revisa cada mensaje y cada reseña en español y en inglés: los insultos se tapan con puntos en el chat, y una reseña con insultos no se publica hasta que nuestro equipo la revise.',
        ],
        capturas: [
          foto(
            'chat',
            'es',
            'El chat del pedido con dos mensajes del repartidor, cada uno con el enlace Reportar, y los tres puntos arriba a la derecha.',
            'Cada mensaje de la otra persona lleva «Reportar».',
          ),
          foto(
            'hoja-reportar',
            'es',
            'La hoja Reportar este mensaje con los motivos Es ofensivo, Es acoso o una amenaza (elegido), Es spam o publicidad y Otra cosa, una nota y el botón Enviar reporte.',
            'Eliges el motivo y, si quieres, escribes una nota.',
          ),
          foto(
            'gracias',
            'es',
            'El mensaje Gracias. Recibimos tu reporte y nuestro equipo lo revisa, con el botón Cerrar.',
            'Listo: nuestro equipo lo revisa.',
          ),
          foto(
            'bloquear',
            'es',
            'La confirmación ¿Bloquear a Andrés? con la explicación de lo que pasa y el botón Bloquear.',
            'Desde los tres puntos del chat: «Bloquear» y su confirmación.',
          ),
          foto(
            'bloqueado',
            'es',
            'El chat con el aviso Bloqueaste a Andrés. Ya no verás sus mensajes.',
            'Después de bloquear ya no ves sus mensajes.',
          ),
          foto(
            'personas-bloqueadas',
            'es',
            'La tarjeta Personas bloqueadas en la cuenta, con Andrés, la fecha y el botón Desbloquear.',
            'En tu cuenta ves a quién bloqueaste y puedes desbloquear.',
          ),
        ],
        preguntas: [
          '¿Cómo reporto un mensaje ofensivo?',
          '¿Cómo bloqueo a un repartidor o a un cliente?',
          '¿La otra persona sabe que la reporté o la bloqueé?',
          '¿Cómo desbloqueo a alguien?',
        ],
        pasos: [
          'En el chat del pedido o del viaje, toca «Reportar» debajo del mensaje.',
          'Elige el motivo, escribe una nota si quieres y toca «Enviar reporte».',
          'Para bloquear, toca los tres puntos del chat y luego «Bloquear», y confirma.',
          'Para desbloquear, ve a tu cuenta, busca «Personas bloqueadas» y toca «Desbloquear».',
        ],
        nota: 'Si alguien te amenaza o te sientes en peligro, llama primero a emergencias. Después repórtalo y escríbenos desde «Ayuda».',
      },
    ],
    restaurants: [
      {
        id: 'report-a-review',
        titulo: 'Reportar una reseña que no corresponde',
        resumen:
          'Si una reseña de tu restaurante es ofensiva, falsa o publicidad, la reportas desde tu panel o desde la app. Nuestro equipo la revisa y, si no cumple las normas, la oculta.',
        explicacion: [
          'Las reseñas ayudan a los clientes a elegir, y la gran mayoría son honestas. Pero a veces llega una con insultos, una que no tiene nada que ver con tu comida o una que promociona otro negocio. Para esas está el botón «Reportar», debajo de cada reseña.',
          'Eliges el motivo y, si quieres, explicas qué pasa. Nuestro equipo la revisa en menos de 24 horas. El cliente no sabe que la reportaste.',
          'Mientras una reseña está en revisión ves la marca «No se ve en público». Las estrellas siguen contando en tu promedio: lo que se oculta es el texto.',
          'Tus respuestas también pasan por el filtro de palabras: una respuesta con insultos no se publica y te pedimos escribirla de otra forma.',
        ],
        capturas: [
          foto(
            'computadora-restaurante-resenas',
            'es',
            'La lista de Reseñas del panel del restaurante con una reseña de dos estrellas y el enlace Reportar debajo.',
            'Debajo de cada reseña está «Reportar».',
          ),
          foto(
            'computadora-restaurante-reportar',
            'es',
            'La ventanita Reportar esta reseña en el panel del restaurante, con el motivo Es spam, publicidad o falsa elegido y el botón Enviar reporte.',
            'Debajo de cada reseña, «Reportar» abre esta ventanita.',
          ),
          foto(
            'computadora-restaurante-gracias',
            'es',
            'El mensaje Gracias. Recibimos tu reporte y nuestro equipo lo revisa, en el panel del restaurante.',
            'Listo: nuestro equipo la revisa.',
          ),
        ],
        preguntas: [
          '¿Puedo quitar una reseña ofensiva de mi restaurante?',
          '¿El cliente sabe que reporté su reseña?',
        ],
        pasos: [
          'Abre «Reseñas» en tu panel o en la app del restaurante.',
          'Debajo de la reseña, toca «Reportar».',
          'Elige el motivo, escribe una nota si quieres y toca «Enviar reporte».',
        ],
      },
    ],
    account: [
      {
        id: 'notifications-language',
        titulo: 'Tus avisos llegan en tu idioma',
        resumen:
          'Los avisos al celular, los del navegador, los correos y los mensajes de texto llegan en el idioma que eliges en la app. Si nunca lo cambiaste, en el idioma de tu teléfono.',
        explicacion: [
          'Cada teléfono y cada navegador donde usas Divoox guarda el idioma de la app. Cuando sale un aviso (tu pedido va en camino, te escribieron, tienes una oferta nueva), te llega en ese idioma.',
          'Si cambias el idioma con el selector de arriba, tus avisos cambian también, en todos tus aparatos. Si nunca lo elegiste, usamos el idioma de tu teléfono; y si no lo sabemos, inglés.',
        ],
        capturas: [
          foto(
            'idioma',
            'es',
            'El selector de idioma de la app abierto, con English - EN y español - ES (elegido).',
            'El idioma que eliges aquí es el de tus avisos.',
          ),
        ],
        preguntas: [
          '¿Por qué mis avisos llegan en inglés?',
          '¿Cómo cambio el idioma de los avisos?',
        ],
        pasos: [
          'Toca el selector de idioma arriba, en la pantalla de inicio.',
          'Elige «español - ES» o «English - EN»: desde ese momento tus avisos llegan en ese idioma.',
        ],
      },
    ],
    operations: [
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
          foto(
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
    ],
  },
  en: {
    trust: [
      {
        id: 'report-and-block',
        titulo: 'Report a message or a review, and block someone',
        resumen:
          'If someone writes something offensive in the order or ride chat, or you see an inappropriate review, report it in two taps. And if you don’t want to hear from that person again, block them.',
        explicacion: [
          'On Divoox, chat only exists between the two people on an order or a ride, and only while it’s in progress. Even so, sometimes someone crosses the line. That’s why, like the big delivery and ride apps, every message from the other person has a “Report” button, and so does every public review.',
          'When you report, you pick a reason (it’s offensive, it’s harassment or a threat, it’s spam, or something else) and can add a note. A person on our team reviews it within 24 hours. The other person never knows who reported them.',
          'Blocking goes a step further: you stop seeing their messages, you don’t get notifications about what they write, and we won’t match you with that person again on orders or rides. They aren’t notified. You can unblock them anytime from your account, under “Blocked people.”',
          'On top of that, a word filter checks every message and review in English and Spanish: slurs are covered with dots in the chat, and a review with slurs isn’t published until our team reviews it.',
        ],
        capturas: [
          foto(
            'chat',
            'en',
            'The order chat with two messages from the driver, each with a Report link, and the three dots at the top right.',
            'Every message from the other person has “Report.”',
          ),
          foto(
            'hoja-reportar',
            'en',
            'The Report this message sheet with the reasons It’s offensive, It’s harassment or a threat (selected), It’s spam or advertising and Something else, a note and the Send report button.',
            'Pick a reason and, if you want, add a note.',
          ),
          foto(
            'gracias',
            'en',
            'The message Thanks. We got your report and our team will review it, with a Close button.',
            'Done: our team reviews it.',
          ),
          foto(
            'bloquear',
            'en',
            'The confirmation Block Sam? with an explanation of what happens and the Block button.',
            'From the chat’s three dots: “Block” and its confirmation.',
          ),
          foto(
            'bloqueado',
            'en',
            'The chat with the notice You blocked Sam. You won’t see their messages.',
            'After blocking, you no longer see their messages.',
          ),
          foto(
            'personas-bloqueadas',
            'en',
            'The Blocked people card in the account, with Sam, the date and the Unblock button.',
            'In your account you see who you blocked and can unblock them.',
          ),
        ],
        preguntas: [
          'How do I report an offensive message?',
          'How do I block a driver or a customer?',
          'Does the other person know I reported or blocked them?',
          'How do I unblock someone?',
        ],
        pasos: [
          'In the order or ride chat, tap “Report” under the message.',
          'Pick a reason, add a note if you want and tap “Send report.”',
          'To block, tap the chat’s three dots, then “Block,” and confirm.',
          'To unblock, go to your account, find “Blocked people” and tap “Unblock.”',
        ],
        nota: 'If someone threatens you or you feel unsafe, call emergency services first. Then report it and write to us from “Help.”',
      },
    ],
    restaurants: [
      {
        id: 'report-a-review',
        titulo: 'Report a review that doesn’t belong',
        resumen:
          'If a review of your restaurant is offensive, fake or advertising, report it from your dashboard or the app. Our team reviews it and hides it if it breaks the guidelines.',
        explicacion: [
          'Reviews help customers choose, and the vast majority are honest. But sometimes one arrives with insults, one that has nothing to do with your food, or one that promotes another business. That’s what the “Report” button under each review is for.',
          'Pick a reason and, if you want, explain what’s wrong. Our team reviews it within 24 hours. The customer doesn’t know you reported it.',
          'While a review is under review, you see the label “Not shown publicly.” The stars still count toward your rating: what’s hidden is the text.',
          'Your replies also go through the word filter: a reply with slurs isn’t published and we ask you to write it another way.',
        ],
        capturas: [
          foto(
            'computadora-restaurante-resenas',
            'en',
            'The Reviews list in the restaurant dashboard with a two-star review and the Report link under it.',
            '“Report” is under each review.',
          ),
          foto(
            'computadora-restaurante-reportar',
            'en',
            'The Report this review window in the restaurant dashboard, with the reason It’s spam, advertising or fake selected and the Send report button.',
            'Under each review, “Report” opens this window.',
          ),
          foto(
            'computadora-restaurante-gracias',
            'en',
            'The message Thanks. We got your report and our team will review it, in the restaurant dashboard.',
            'Done: our team reviews it.',
          ),
        ],
        preguntas: [
          'Can I remove an offensive review of my restaurant?',
          'Does the customer know I reported their review?',
        ],
        pasos: [
          'Open “Reviews” in your dashboard or in the restaurant app.',
          'Under the review, tap “Report.”',
          'Pick a reason, add a note if you want and tap “Send report.”',
        ],
      },
    ],
    account: [
      {
        id: 'notifications-language',
        titulo: 'Your notifications arrive in your language',
        resumen:
          'Phone notifications, browser notifications, emails and text messages arrive in the language you pick in the app. If you never changed it, in your phone’s language.',
        explicacion: [
          'Each phone and browser where you use Divoox keeps the app’s language. When a notification goes out (your order is on the way, someone wrote to you, you have a new offer), it arrives in that language.',
          'If you change the language with the selector at the top, your notifications change too, on all your devices. If you never picked one, we use your phone’s language; and if we don’t know it, English.',
        ],
        capturas: [
          foto(
            'idioma',
            'en',
            'The app’s language selector open, with English - EN (selected) and español - ES.',
            'The language you pick here is the language of your notifications.',
          ),
        ],
        preguntas: [
          'Why do my notifications arrive in Spanish?',
          'How do I change the language of my notifications?',
        ],
        pasos: [
          'Tap the language selector at the top of the home screen.',
          'Pick “English - EN” or “español - ES”: from then on, your notifications arrive in that language.',
        ],
      },
    ],
    operations: [
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
          foto(
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
    ],
  },
};
