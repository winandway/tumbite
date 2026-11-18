import type { Idioma } from './idiomas';

/**
 * C-CAMILA-CHAT (17 nov 2026) — todos los países, primero El Vigía y Tucaní.
 *
 * Lo que comparten el chat de soporte de la web (la burbuja de divoox.com), el de Divoox Driver y el
 * buzón del superadmin: cómo se llama cada autor y la ficha anónima del navegador. Una sola pieza
 * para las tres pantallas.
 */
export type AutorCamila = 'persona' | 'camila' | 'equipo';
export type MensajeCamila = { id: string; autor: AutorCamila; texto: string; creado_en: string };
export type HiloCamila = {
  verificada: boolean;
  equipoAtendiendo: boolean;
  mensajes: MensajeCamila[];
};
export type RespuestaCamila = HiloCamila & { respuesta: string | null };

const CHAT_ES = {
  burbuja: 'Habla con nuestro equipo de soporte',
  titulo: 'Soporte de Divoox',
  camila: 'Camila Montes, del equipo de soporte de Divoox',
  equipo: 'Equipo de soporte de Divoox',
  tu: 'Tú',
  saludo:
    'Hola. Soy Camila Montes, del equipo de soporte de Divoox. Escríbeme tu pregunta y te ayudo. Si prefieres hablar con una persona del equipo, escribe «hablar con una persona».',
  escribe: 'Escribe tu mensaje…',
  enviar: 'Enviar',
  enviando: 'Enviando…',
  escribiendo: 'Camila está escribiendo…',
  equipoAtiende: 'Una persona del equipo te va a responder aquí.',
  cerrar: 'Cerrar',
  unir: '¿Ya tienes cuenta? Une este chat a tu correo',
  unirAyuda:
    'Te mandamos un código de seis números a tu correo. Así seguimos la misma conversación en la web, en la app y por correo.',
  correo: 'Tu correo',
  mandarCodigo: 'Mandar el código',
  codigo: 'Código de seis números',
  confirmar: 'Unir el chat',
  codigoEnviado: (c: string) => `Te mandamos el código a ${c}. Vale por 15 minutos.`,
  unido: 'Listo: este chat quedó unido a tu correo.',
  otroCorreo: 'Usar otro correo',
  ahoraNo: 'Ahora no',
  prefieresCorreo: '¿Prefieres escribirnos un correo?',
  formulario: 'Usa el formulario de contacto',
  sinRed: 'No pudimos conectar. Revisa tu internet e inténtalo otra vez.',
  reintentar: 'Reintentar',
  cargando: 'Cargando la conversación…',
};
const CHAT_EN: typeof CHAT_ES = {
  burbuja: 'Talk to our support team',
  titulo: 'Divoox Support',
  camila: 'Camila Montes, Divoox Support Team',
  equipo: 'Divoox Support Team',
  tu: 'You',
  saludo:
    'Hi. I’m Camila Montes, from the Divoox Support Team. Write your question and I’ll help. If you’d rather talk to a person on our team, write “talk to a person.”',
  escribe: 'Write your message…',
  enviar: 'Send',
  enviando: 'Sending…',
  escribiendo: 'Camila is typing…',
  equipoAtiende: 'A person on our team will reply to you here.',
  cerrar: 'Close',
  unir: 'Already have an account? Link this chat to your email',
  unirAyuda:
    'We’ll email you a six-digit code. That way we keep the same conversation on the web, in the app and by email.',
  correo: 'Your email',
  mandarCodigo: 'Send the code',
  codigo: 'Six-digit code',
  confirmar: 'Link the chat',
  codigoEnviado: (c: string) => `We sent the code to ${c}. It’s valid for 15 minutes.`,
  unido: 'Done: this chat is now linked to your email.',
  otroCorreo: 'Use another email',
  ahoraNo: 'Not now',
  prefieresCorreo: 'Would you rather send us an email?',
  formulario: 'Use the contact form',
  sinRed: 'We couldn’t connect. Check your internet and try again.',
  reintentar: 'Try again',
  cargando: 'Loading the conversation…',
};
export const TEXTOS_CHAT_SOPORTE = { es: CHAT_ES, en: CHAT_EN };

/** El nombre que va encima de cada mensaje, en el idioma de la pantalla. */
export function nombreAutorCamila(autor: AutorCamila, idioma: Idioma): string {
  const t = idioma === 'en' ? TEXTOS_CHAT_SOPORTE.en : TEXTOS_CHAT_SOPORTE.es;
  return autor === 'camila' ? t.camila : autor === 'equipo' ? t.equipo : t.tu;
}

/** La ficha anónima del navegador (cabecera x-camila-visita): 32 a 80 letras, números, - o _. */
export const PATRON_VISITA_CAMILA = /^[A-Za-z0-9_-]{32,80}$/;
export const esVisitaCamila = (s: unknown): s is string =>
  typeof s === 'string' && PATRON_VISITA_CAMILA.test(s);

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Una ficha nueva: 43 caracteres al azar (256 bits). */
export function nuevaVisitaCamila(
  azar: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  return [...azar(43)].map((b) => BASE64URL.charAt(b % 64)).join('');
}

export const LLAVE_VISITA_CAMILA = 'divoox.camila.visita';

/**
 * La ficha guardada en este navegador, o una nueva (que se guarda). Si el navegador no deja guardar
 * (ventana privada, almacenamiento bloqueado), igual devuelve una ficha válida para esta visita.
 */
export function visitaCamila(
  almacen: {
    getItem: (k: string) => string | null;
    setItem: (k: string, v: string) => void;
  } | null,
): string {
  try {
    const guardada = almacen?.getItem(LLAVE_VISITA_CAMILA);
    if (esVisitaCamila(guardada)) return guardada;
  } catch {
    /* sin almacenamiento: se usa una ficha de esta visita */
  }
  const nueva = nuevaVisitaCamila();
  try {
    almacen?.setItem(LLAVE_VISITA_CAMILA, nueva);
  } catch {
    /* sin almacenamiento: la conversación vive mientras dure la página */
  }
  return nueva;
}
