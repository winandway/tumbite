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
    es: 'Al empezar, Divoox puede darte un regalo de arranque: saldo para tus primeras carreras. Se da una sola vez, cuando tu cuenta queda aprobada, y solo mientras tu ciudad tenga ese regalo encendido.',
    en: 'When you start, Divoox may give you a starter gift: balance for your first trips. It is given only once, when your account is approved, and only while your city has that gift turned on.',
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
    ],
    es: 'Para empezar: descarga Divoox Driver y crea tu cuenta. En Perfil, «Empieza a repartir», ves los pasos y cuál te falta: tus datos y vehículo, tu documento y foto, la verificación y tu cuenta para cobrar. Cada paso se abre con un toque. Cuando el equipo aprueba tu cuenta, tocas «Conectarme» y empiezas a recibir carreras. No hay horarios ni mínimos.',
    en: 'To get started: download Divoox Driver and create your account. In Profile, “Start driving,” you see the steps and which one is missing: your details and vehicle, your document and photo, verification and your payout account. Each step opens with one tap. Once the team approves your account, tap “Go online” and you start getting trips. No schedules or minimums.',
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
    es: 'Para verificar tu identidad: en la app, menú de arriba a la izquierda, «Mis datos y vehículo». Elige tu documento, toma la foto del frente y la del reverso (que se lean bien, sin reflejos) y la foto de tu cara de frente, con buena luz, sin gorra ni lentes oscuros. Toca «Enviar para revisión»: te avisamos por correo cuando esté aprobada o qué foto repetir. Si vas en moto, también escribes tu licencia y tu seguro con su vencimiento.',
    en: 'To verify your identity: in the app, top-left menu, “My details and vehicle.” Choose your document, take the photo of the front and the back (clear, no glare) and a photo of your face, facing forward, with good light, no cap or dark glasses. Tap “Send for review”: we email you when it is approved or which photo to retake. If you ride a motorcycle, you also enter your license and insurance with their expiration dates.',
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

/** La dirección pública de la guía, en el idioma de la persona. */
export const enlaceGuia = (guia: string, idioma: IdiomaCamila) =>
  `https://divoox.com${idioma === 'es' ? '/es' : ''}/docs/${guia}`;
