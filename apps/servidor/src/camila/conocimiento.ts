import { enlaceDeGuia } from './buscadorDocs';
import type { IdiomaCamila } from './identidad';

/**
 * C-CAMILA-CONOCIMIENTO (17 nov 2026) — todos los países.
 *
 * Lo único que Camila sabe por su cuenta sale de las guías PÚBLICAS de Docs (cada entrada nombra la
 * suya y la prueba comprueba que exista en apps/panel/src/sitio/docs). Nada interno de la empresa:
 * ni costos, ni proveedores, ni el superadmin. Lo demás que sabe es lo que el equipo APROBÓ en la
 * lista semanal (tabla camila_conocimiento, estado «aprobada»), y el estado de la cuenta de la
 * persona que escribe. Nada más.
 */
export type EntradaDocs = {
  id: string;
  /** La guía pública de donde sale (sección/guía de /docs). */
  guia: string;
  palabras: string[];
  es: string;
  en: string;
};

export const CONOCIMIENTO_DOCS: readonly EntradaDocs[] = [
  {
    // C-CAMILA-VISITANTE: lo primero que pregunta un visitante. También se contesta sin IA.
    id: 'que-es-divoox',
    guia: 'ordering/where-divoox-works',
    palabras: [
      ...['que es divoox', 'a que se dedica', 'a que se dedican', 'que hace esta empresa'],
      ...['que hacen', 'de que trata', 'de que se trata', 'que es esto', 'que ofrecen'],
      ...['que servicios', 'donde funciona', 'donde funcionan', 'donde operan', 'en que ciudades'],
      ...['what is divoox', 'what do you do', 'what does this company do', 'what is this'],
      ...['what services', 'where do you operate', 'where does divoox work', 'which cities'],
    ],
    es: 'Divoox es una app para pedir un viaje en moto o en carro, pedir comida, comprar en tiendas y mandar paquetes. También da trabajo a conductores y repartidores. Estamos arrancando en El Vigía y Tucaní (Mérida, Venezuela) y abrimos ciudad por ciudad: puedes crear tu cuenta desde cualquier lugar y, si tu ciudad todavía no tiene servicio, la app te avisa cuando llegue.',
    en: 'Divoox is an app to request a moto or car ride, order food, shop at stores and send packages. It also gives work to drivers and couriers. We are starting in El Vigía and Tucaní (Mérida, Venezuela) and opening city by city: you can create your account from anywhere and, if your city does not have service yet, the app lets you know when it arrives.',
  },
  {
    id: 'saldo-y-comision',
    guia: 'drivers/driver-balance',
    palabras: [
      'saldo',
      'comision',
      'comisión',
      'descuentan',
      'descuento',
      'balance',
      'commission',
      'fee',
      'fees',
      'cobran',
      'porcentaje',
    ],
    es: 'Tienes dos billeteras. Tu «saldo» es el dinero que recargas por adelantado para pagar la comisión de Divoox; tus «ganancias» son lo que Divoox te debe (por ejemplo, lo que cubren los regalos de tus pasajeros). El pasajero te paga la carrera completa en mano y Divoox no toca ese dinero. Al aceptar una carrera, la comisión se aparta de tu saldo y al terminar se descuenta; si la carrera se cancela o la sueltas, vuelve entera. La comisión es un porcentaje del precio: con un 10 %, en una carrera de 2,00 dólares se descuentan 0,20. Lo ves en Ganancias, «Saldo para comisiones».',
    en: 'You have two wallets. Your “balance” is the money you top up in advance to pay the Divoox commission; your “earnings” are what Divoox owes you (for example, what your riders’ gifts cover). The rider pays you the full trip in person and Divoox never touches that money. When you accept a trip, the commission is set aside from your balance and charged when you finish; if the trip is canceled or you drop it, it goes back in full. The commission is a percentage of the price: with 10%, a 2.00-dollar trip takes off 0.20. You see it under Earnings, “Balance for fees.”',
  },
  {
    id: 'recargar-saldo',
    guia: 'drivers/driver-balance',
    palabras: [
      'recargar',
      'recarga',
      'recargo',
      'codigo de recarga',
      'punto de venta',
      'pago movil',
      'pago móvil',
      'top up',
      'top-up',
      'reload',
    ],
    es: 'Para recargar tu saldo: compra un código en un punto de venta autorizado y canjéalo en Ganancias, «Saldo para comisiones». También puedes pagarle al equipo de Divoox de tu ciudad por pago móvil: el equipo te carga el saldo y lo ves en «Cargas y regalos de saldo».',
    en: 'To top up your balance: buy a code at an authorized sales point and redeem it under Earnings, “Balance for fees.” The Divoox team in your city can also add balance for you, and you see it under “Balance top-ups and gifts.”',
  },
  {
    id: 'sin-carreras',
    guia: 'drivers/driver-balance',
    palabras: [
      'no me llegan',
      'no llegan',
      'no recibo',
      'sin carreras',
      'no trips',
      'no rides',
      'no offers',
      'no me sale',
    ],
    es: 'Si no te llegan carreras, lo primero es mirar tu saldo para comisiones: sin saldo no te llegan carreras, y la app te avisa cuando te queda poco. También revisa que estés conectado y que tu cuenta esté activada para ese servicio. Si quieres, reviso tu cuenta contigo.',
    en: 'If you are not getting trips, first check your balance for fees: without balance you don’t get trips, and the app warns you when you are running low. Also make sure you are online and that your account is activated for that service. If you want, I can check your account with you.',
  },
  {
    id: 'regalo-de-arranque',
    guia: 'drivers/driver-balance',
    palabras: [
      'regalo de arranque',
      'regalo',
      'saldo de regalo',
      'bono',
      'starter gift',
      'gift',
      'bonus',
      'saldo gratis',
    ],
    es: 'Al registrarte, Divoox puede darte un regalo de arranque: saldo para tus primeras carreras. Se da una sola vez: cuando tu cuenta queda aprobada o, donde hay plazo para los papeles, la primera vez que te conectas con la foto de tu cara ya tomada. Y solo mientras tu ciudad tenga ese regalo encendido. Lo ves en tu saldo con la fecha en que vence; lo que no uses antes de esa fecha se retira, y tu propio dinero nunca se toca.',
    en: 'When you sign up, Divoox may give you a starter gift: balance for your first trips. It is given only once: when your account is approved or, where there is a document deadline, the first time you go online with the photo of your face already taken. And only while your city has that gift turned on. You see it in your balance with its expiration date; whatever you don’t use by then is removed, and your own money is never touched.',
  },
  {
    // C-PLAZO-PAPELES: el plazo, las fotos solo con cámara y que nada se envía solo.
    id: 'plazo-de-papeles',
    guia: 'drivers/document-deadline',
    palabras: [
      ...['plazo', 'papeles', 'mis papeles', 'tus papeles', 'documentos', '30 dias', 'un mes'],
      ...['cuanto tiempo tengo', 'subir foto', 'subir desde archivos', 'galeria', 'camara'],
      ...['cuenta en pausa', 'me pausaron', 'antecedentes', 'licencia', 'seguro'],
      ...['deadline', 'documents', 'my documents', 'paperwork', '30 days', 'upload a photo'],
      ...['from my files', 'gallery', 'camera', 'account paused', 'license', 'insurance'],
    ],
    es: 'Donde Divoox da un plazo, empiezas a trabajar con la foto de tu cara y entregas el resto de tus papeles después, por lo general dentro de un mes. En «Tus papeles» ves cada papel con su estado y los días que te quedan. Las fotos se toman en el momento con la cámara de la app: no se suben desde tus archivos. Nada se envía solo: revisas tus fotos y tocas «Enviar a revisión». Te recordamos el plazo varias veces; si se acaba y falta algo, tu cuenta queda en pausa hasta que lo subas, sin perder lo que ya enviaste. Qué papeles hacen falta depende de tu lugar, y la app te lo dice.',
    en: 'Where Divoox gives you a deadline, you start working with a photo of your face and turn in the rest of your documents later, usually within a month. Under “Your documents” you see each one with its status and the days you have left. Photos are taken on the spot with the app’s camera: you can’t upload them from your files. Nothing is sent on its own: you review your photos and tap “Send for review.” We remind you of the deadline several times; if it runs out and something is missing, your account is paused until you send it, and nothing you already sent is lost. Which documents you need depends on where you are, and the app tells you.',
  },
  {
    id: 'mi-linea',
    guia: 'drivers/your-line',
    palabras: [
      ...['mi linea', 'linea', 'lider', 'codigo de la linea', 'codigo de linea', 'mi grupo'],
      ...['entrar a una linea', 'cambiar de linea', 'esperando que el lider', 'qr de la linea'],
      ...['my line', 'line code', 'leader', 'join a line', 'change line', 'my group'],
    ],
    es: 'Si trabajas en una línea de taxis o mototaxis, abre «Mi línea» en tu perfil de Divoox Driver. Entras con el código de tu línea o eligiéndola de la lista de tu ciudad, y tu líder acepta tu solicitud. Estás en una sola línea a la vez; para cambiar, pídele a tu líder que te saque de la suya. Si eres líder, ahí ves tu código, tu QR, las solicitudes y tu equipo.',
    en: 'If you work in a taxi or moto-taxi line, open “My line” in your Divoox Driver profile. You join with your line’s code or by picking it from your city’s list, and your leader accepts your request. You are in one line at a time; to switch, ask your leader to remove you from theirs. If you are the leader, that is where you see your code, your QR, the requests and your team.',
  },
  {
    id: 'regalo-del-pasajero',
    guia: 'drivers/divoox-gift-trips',
    palabras: [
      'pasajero con regalo',
      'viaje con regalo',
      'divoox te paga',
      'cobra en efectivo',
      'gift trip',
      'rider gift',
    ],
    es: 'Cuando el pasajero trae un regalo de Divoox, cobras en mano solo la diferencia («Cobra en efectivo») y lo que cubre el regalo te lo paga Divoox: entra a tus ganancias al terminar el viaje. Desde Ganancias lo pasas a tu saldo con «Pasar a mi saldo», o Divoox te lo paga por pago móvil.',
    en: 'When the rider has a Divoox gift, you collect only the difference in person (“Collect in cash”) and Divoox pays you what the gift covers: it goes into your earnings when the trip ends. From Earnings you can move it to your balance with “Move to my balance,” or Divoox pays it out to you.',
  },
  {
    id: 'empezar',
    guia: 'drivers/get-started',
    palabras: [
      'empezar',
      'registrarme',
      'registro',
      'crear cuenta',
      'como empiezo',
      'activar',
      'activarme',
      'pasos',
      'get started',
      'sign up',
      'register',
      'activate',
      ...[
        'empiezo',
        'comenzar',
        'comienzo',
        'manejar con divoox',
        'trabajar con divoox',
        'ser conductor',
      ],
      ...[
        'start driving',
        'start',
        'begin',
        'become a driver',
        'drive with divoox',
        'join',
        'how do i drive',
      ],
    ],
    es: 'Para empezar: descarga Divoox Driver y crea tu cuenta. En Perfil, «Empieza a repartir», ves los pasos y cuál te falta: tus datos y vehículo, tu documento y foto, la verificación y tu cuenta para cobrar. Cada paso se abre con un toque. Cuando el equipo aprueba tu cuenta, deslizas para conectarte y empiezas a recibir carreras. No hay horarios ni mínimos.',
    en: 'To get started: download Divoox Driver and create your account. In Profile, “Start driving,” you see the steps and which one is missing: your details and vehicle, your document and photo, verification and your payout account. Each step opens with one tap. Once the team approves your account, slide to go online and you start getting trips. No schedules or minimums.',
  },
  {
    id: 'verificar-identidad',
    guia: 'drivers/verify',
    palabras: [
      'documento',
      'cedula',
      'cédula',
      'licencia',
      'foto',
      'selfie',
      'verificar',
      'verificacion',
      'verificación',
      'identidad',
      'document',
      'license',
      'photo',
      'verify',
      'identity',
    ],
    es: 'Para verificar tu identidad: en la app, menú de arriba a la izquierda, «Mis datos y vehículo». Elige tu documento y toma las fotos que la app te pide (el frente y, donde tu país lo pide, el reverso; que se lean bien, sin reflejos) y la foto de tu cara de frente, con buena luz, sin gorra ni lentes oscuros. Toca «Enviar para revisión»: te avisamos por correo cuando esté aprobada o qué foto repetir. Si vas en moto, también escribes tu licencia y tu seguro con su vencimiento.',
    en: 'To verify your identity: in the app, top-left menu, “My details and vehicle.” Choose your document and take the photos the app asks for (the front and, where your country requires it, the back; clear, no glare) and a photo of your face, facing forward, with good light, no cap or dark glasses. Tap “Send for review”: we email you when it is approved or which photo to retake. If you ride a motorcycle, you also enter your license and insurance with their expiration dates.',
  },
  {
    id: 'hablar-con-soporte',
    guia: 'trust/talk-to-support',
    palabras: ['soporte', 'ayuda', 'support', 'help', 'contacto', 'contact'],
    es: 'Puedes escribirnos por el chat de divoox.com, por el chat de la app Divoox Driver (Ayuda) o por correo. Es la misma conversación por cualquier camino: si empiezas por correo y sigues por el chat, ya sabemos lo que hablamos. Si prefieres hablar con una persona del equipo, solo dilo.',
    en: 'You can write to us through the chat on divoox.com, the chat in the Divoox Driver app (Help) or by email. It is the same conversation on every channel: if you start by email and continue in the chat, we already know what we talked about. If you would rather talk to a person on the team, just say so.',
  },
];

/** Para comparar sin acentos ni mayúsculas. */
export const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export type Coincidencia = { id: string; guia: string | null; texto: string; puntos: number };

/** Las entradas de Docs que mejor encajan con el texto (sin IA: por palabras). */
export function buscarEnDocs(texto: string, idioma: IdiomaCamila, max = 2): Coincidencia[] {
  const t = ` ${normalizar(texto)} `;
  return CONOCIMIENTO_DOCS.map((e) => ({
    id: e.id,
    guia: e.guia,
    texto: idioma === 'en' ? e.en : e.es,
    puntos: e.palabras.reduce(
      (n, p) => n + (t.includes(` ${normalizar(p)}`) ? normalizar(p).split(' ').length : 0),
      0,
    ),
  }))
    .filter((c) => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, max);
}

/** Las respuestas aprobadas por el equipo que encajan (solo «aprobada»: nunca una propuesta). */
export async function buscarAprobadas(
  db: D1Database,
  texto: string,
  idioma: IdiomaCamila,
  max = 2,
): Promise<Coincidencia[]> {
  const { results } = await db
    .prepare(
      `SELECT id, pregunta_es, pregunta_en, respuesta_es, respuesta_en FROM camila_conocimiento
        WHERE estado = 'aprobada' ORDER BY veces DESC LIMIT 200`,
    )
    .all<{
      id: string;
      pregunta_es: string;
      pregunta_en: string;
      respuesta_es: string;
      respuesta_en: string;
    }>();
  const palabras = new Set(
    normalizar(texto)
      .split(' ')
      .filter((p) => p.length > 3),
  );
  if (!palabras.size) return [];
  return results
    .map((r) => {
      const pregunta = normalizar(`${r.pregunta_es} ${r.pregunta_en}`).split(' ');
      const puntos = pregunta.filter((p) => p.length > 3 && palabras.has(p)).length;
      return {
        id: r.id,
        guia: null,
        texto:
          idioma === 'en' ? r.respuesta_en || r.respuesta_es : r.respuesta_es || r.respuesta_en,
        puntos,
      };
    })
    .filter((c) => c.puntos >= 2 || (c.puntos >= 1 && palabras.size <= 3))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, max);
}

/** El enlace de la guía, en el idioma de la persona (C-CAMILA-ENLACE-GUIA). */
export const enlaceGuia = (guia: string, idioma: IdiomaCamila) => enlaceDeGuia(guia, idioma);
