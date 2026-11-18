import type { Idioma } from './idiomas';

/**
 * C-CAMILA-CHAT (17 nov 2026) — todos los países, primero El Vigía y Tucaní.
 *
 * Lo que comparten el chat de soporte de la web (la burbuja de divoox.com), el de Divoox Driver y el
 * buzón del superadmin: cómo se llama cada autor y la ficha anónima del navegador. Una sola pieza
 * para las tres pantallas.
 */
export type AutorCamila = 'persona' | 'camila' | 'equipo';
export type MensajeCamila = {
  id: string;
  autor: AutorCamila;
  texto: string;
  creado_en: string;
  /** C-CAMILA-REPORTAR: la persona ya reportó esta respuesta de Camila. */
  reportado?: boolean;
};
export type HiloCamila = {
  verificada: boolean;
  equipoAtendiendo: boolean;
  mensajes: MensajeCamila[];
};
export type RespuestaCamila = HiloCamila & { respuesta: string | null };

const CHAT_ES = {
  burbuja: 'Habla con nuestro equipo de soporte',
  titulo: 'Soporte de Divoox',
  camila: 'Camila Campos, del equipo de soporte de Divoox',
  // En cada mensaje va solo el nombre: quién es ya lo dice el encabezado (no se repite).
  camilaCorto: 'Camila',
  equipo: 'Equipo de soporte de Divoox',
  tu: 'Tú',
  // Un solo saludo, corto, y solo cuando la conversación está vacía.
  saludo: 'Hola. ¿En qué te ayudo?',
  escribe: 'Escribe tu mensaje…',
  enviar: 'Enviar',
  enviando: 'Enviando…',
  escribiendo: 'Camila está escribiendo',
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
  reportar: 'Reportar respuesta',
  reportada: 'Respuesta reportada. El equipo la va a revisar.',
};
const CHAT_EN: typeof CHAT_ES = {
  burbuja: 'Talk to our support team',
  titulo: 'Divoox Support',
  camila: 'Camila Campos, Divoox Support Team',
  camilaCorto: 'Camila',
  equipo: 'Divoox Support Team',
  tu: 'You',
  saludo: 'Hi. How can I help?',
  escribe: 'Write your message…',
  enviar: 'Send',
  enviando: 'Sending…',
  escribiendo: 'Camila is typing',
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
  reportar: 'Report reply',
  reportada: 'Reply reported. Our team will review it.',
};
export const TEXTOS_CHAT_SOPORTE = { es: CHAT_ES, en: CHAT_EN };

/** El nombre que va encima de cada mensaje, en el idioma de la pantalla. */
export function nombreAutorCamila(autor: AutorCamila, idioma: Idioma): string {
  const t = idioma === 'en' ? TEXTOS_CHAT_SOPORTE.en : TEXTOS_CHAT_SOPORTE.es;
  return autor === 'camila' ? t.camilaCorto : autor === 'equipo' ? t.equipo : t.tu;
}

/**
 * C-CAMILA-TONO (18 nov 2026, Richard): Camila no contesta al instante, como una máquina. Entre que
 * llega la respuesta y se muestra, el chat enseña «Camila está escribiendo» con tres puntitos, de 2
 * a 4 segundos según el largo de lo que va a decir.
 */
let espera = (texto: string) => Math.min(4000, Math.max(2000, 2000 + texto.length * 8));
export const esperaDeEscrituraMs = (texto: string) => espera(texto);
/** Pruebas: sin espera (null vuelve a la de verdad). */
export function usarEsperaDeEscritura(f: ((texto: string) => number) | null) {
  espera = f ?? ((texto: string) => Math.min(4000, Math.max(2000, 2000 + texto.length * 8)));
}
/** Lo que falta esperar para que la respuesta salga con su ritmo, contando lo que ya tardó el servidor. */
export const pausaDeEscritura = (texto: string | null, desdeMs: number, ahoraMs: number) =>
  new Promise<void>((listo) =>
    setTimeout(listo, texto ? Math.max(0, esperaDeEscrituraMs(texto) - (ahoraMs - desdeMs)) : 0),
  );

/**
 * Se llama al mandar el mensaje; devuelve la función que, con la respuesta ya en la mano, espera lo
 * que falte para que salga con su ritmo.
 */
export function cronometroDeEscritura() {
  const inicio = Date.now();
  return (texto: string | null) => pausaDeEscritura(texto, inicio, Date.now());
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
