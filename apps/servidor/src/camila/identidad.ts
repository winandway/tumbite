/**
 * C-CAMILA-IDENTIDAD (17 nov 2026, decisión de Richard) — todos los países.
 *
 * Camila Montes firma como «del equipo de soporte de Divoox», sin pie de «asistente virtual», porque
 * en el mismo hilo también contestan personas del equipo. Pero NUNCA engaña: si alguien pregunta si
 * habla con una persona, la respuesta es SIEMPRE la verdad (es la asistente virtual de Divoox) y ofrece
 * pasarlo con alguien del equipo. Esa respuesta sale del código, no del modelo, para que ninguna
 * conversación pueda torcerla. Y donde una ley pide avisarlo desde el primer mensaje, el interruptor
 * por país (ajustes de Camila) lo dice al empezar.
 */
export type IdiomaCamila = 'es' | 'en';

export const NOMBRE_CAMILA = 'Camila Montes';

export const FIRMA = {
  es: 'Camila Montes, del equipo de soporte de Divoox',
  en: 'Camila Montes, Divoox Support Team',
} as const;

/** Lo que dice cuando le preguntan si es una persona. Siempre la verdad. */
export const VERDAD = {
  es: 'Te soy sincera: soy la asistente virtual de Divoox, no una persona. Te ayudo con todo lo que pueda, y si prefieres hablar con alguien del equipo, escribe «hablar con una persona» y te paso con ellos.',
  en: 'To be honest with you: I am the Divoox virtual assistant, not a person. I will help with everything I can, and if you would rather talk to someone on the team, write «talk to a person» and I will pass you to them.',
} as const;

/** El aviso del primer mensaje donde la ley lo pide (interruptor por país). */
export const AVISO_PRIMER_MENSAJE = {
  es: 'Hola, soy Camila, la asistente virtual de Divoox. Si en algún momento prefieres hablar con una persona del equipo, solo dímelo.',
  en: 'Hi, I am Camila, the Divoox virtual assistant. If at any point you would rather talk to a person on the team, just tell me.',
} as const;

export const PASO_A_PERSONA = {
  es: 'Listo, le pasé tu conversación a una persona del equipo de soporte. Te va a escribir por aquí mismo en cuanto pueda. Mientras tanto, si quieres, puedes seguir contándome los detalles.',
  en: 'Done, I passed your conversation to a person on the support team. They will write to you right here as soon as they can. In the meantime, feel free to tell me any details.',
} as const;

/** Para comparar frases sin acentos ni mayúsculas. */
const plano = (t: string) =>
  ` ${t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
const contiene = (t: string, frases: readonly string[]) => {
  const x = plano(t);
  return frases.some((f) => x.includes(` ${f} `));
};

/** ¿Pregunta si habla con una persona o con una máquina? */
const PREGUNTA_HUMANO = [
  'eres una persona',
  'eres persona',
  'eres humana',
  'eres humano',
  'eres real',
  'eres un robot',
  'eres robot',
  'eres un bot',
  'eres bot',
  'eres una maquina',
  'eres una ia',
  'eres ia',
  'eres inteligencia artificial',
  'eres una asistente virtual',
  'eres un asistente virtual',
  'es usted una persona',
  'usted es una persona',
  'usted es humana',
  'usted es un robot',
  'hablo con una persona',
  'hablo con un robot',
  'hablo con un bot',
  'hablo con una maquina',
  'estoy hablando con una persona',
  'estoy hablando con un robot',
  'estoy hablando con un bot',
  'estoy hablando con una maquina',
  'persona real',
  'ser humano',
  'eres de verdad',
  'are you human',
  'are you a human',
  'are you a person',
  'are you real',
  'are you a robot',
  'are you a bot',
  'are you a machine',
  'are you ai',
  'are you an ai',
  'is this a bot',
  'am i talking to a human',
  'am i talking to a person',
  'am i talking to a bot',
  'am i talking to a robot',
  'am i chatting with a bot',
  'real person',
] as const;
export const preguntaSiEsHumana = (t: string) => contiene(t, PREGUNTA_HUMANO);

/** ¿Pide hablar con una persona del equipo? */
const PIDE_HUMANO = [
  'hablar con una persona',
  'hablar con alguien',
  'hablar con un humano',
  'hablar con un agente',
  'hablar con un asesor',
  'hablar con una asesora',
  'hablar con un operador',
  'hablar con soporte',
  'pasame con una persona',
  'pasame con alguien',
  'pasame con un humano',
  'pasame con un agente',
  'quiero una persona',
  'quiero un humano',
  'quiero un agente',
  'comunicarme con una persona',
  'alguien del equipo',
  'una persona del equipo',
  'talk to a person',
  'talk to a human',
  'talk to someone',
  'talk to an agent',
  'speak to a person',
  'speak to a human',
  'speak with a person',
  'speak to someone',
  'talk with a person',
  'real agent',
  'live agent',
  'human agent',
  'a representative',
] as const;
export const pideHumano = (t: string) => contiene(t, PIDE_HUMANO);

/** Elige el texto del idioma (sin índices dinámicos). */
export const segun = <T>(par: { es: T; en: T }, idioma: IdiomaCamila): T =>
  idioma === 'en' ? par.en : par.es;

/** Lo que va al pie del correo: la firma, sin pie de «asistente virtual». */
export const conFirma = (texto: string, idioma: IdiomaCamila) =>
  `${texto.trim()}\n\n${segun(FIRMA, idioma)}`;

/** Regla mental del candado: Camila nunca dice que es humana. */
const DICE_SER_HUMANA = [
  'soy una persona',
  'soy humana',
  'soy una persona real',
  'soy una mujer real',
  'no soy un robot',
  'no soy un bot',
  'no soy una ia',
  'no soy una maquina',
  'no soy una asistente virtual',
  'i am a real person',
  'i am human',
  'i am a human',
  'im not a bot',
  'i am not a bot',
  'im not a robot',
  'i am not a robot',
  'i am not an ai',
  'im not an ai',
] as const;
export const diceSerHumana = (t: string) => contiene(t, DICE_SER_HUMANA);
