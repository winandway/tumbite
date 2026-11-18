/**
 * C-CAMILA-IDENTIDAD (17 nov 2026, decisión de Richard) — todos los países.
 *
 * Camila Campos firma como «del equipo de soporte de Divoox», sin pie de «asistente virtual», porque
 * en el mismo hilo también contestan personas del equipo. Pero NUNCA engaña: si alguien pregunta si
 * habla con una persona, la respuesta es SIEMPRE la verdad (es la asistente virtual de Divoox) y ofrece
 * pasarlo con alguien del equipo. Esa respuesta sale del código, no del modelo, para que ninguna
 * conversación pueda torcerla. Y donde una ley pide avisarlo desde el primer mensaje, el interruptor
 * por país (ajustes de Camila) lo dice al empezar.
 */
export type IdiomaCamila = 'es' | 'en';

export const NOMBRE_CAMILA = 'Camila Campos';

export const FIRMA = {
  es: 'Camila Campos, del equipo de soporte de Divoox',
  en: 'Camila Campos, Divoox Support Team',
} as const;

/** Lo que dice cuando le preguntan si es una persona. Siempre la verdad. */
export const VERDAD = {
  es: 'Te soy sincera: soy la asistente virtual de Divoox, no una persona. Te ayudo con todo lo que pueda, y si prefieres hablar con alguien del equipo, escribe «hablar con una persona» y te paso con ellos.',
  en: 'To be honest with you: I am the Divoox virtual assistant, not a person. I will help with everything I can, and if you would rather talk to someone on the team, write «talk to a person» and I will pass you to them.',
} as const;

/** El aviso del primer mensaje donde la ley lo pide (interruptor por país). */
export const AVISO_PRIMER_MENSAJE = {
  es: 'Hola, soy Camila, la asistente virtual de Divoox.',
  en: 'Hi, I am Camila, the Divoox virtual assistant.',
} as const;

/** No entendió (primer intento): pide que se lo digan de otra forma, sin pasar a nadie todavía. */
export const NO_ENTENDI = {
  es: 'No estoy segura de haberte entendido. ¿Me lo cuentas con otras palabras?',
  en: 'I am not sure I understood. Could you tell me in other words?',
} as const;

/** Segundo intento sin poder resolver: ahí sí lo ve una persona del equipo. */
export const LO_VE_EL_EQUIPO = {
  es: 'Esto prefiero que lo vea alguien del equipo. Ya les pasé tu pregunta y te responden por aquí.',
  en: 'I would rather have someone on the team look at this. I passed them your question and they will reply here.',
} as const;

/** La persona está molesta: disculpa corta y pasa a una persona. */
export const ENTIENDO_TU_MOLESTIA = {
  es: 'Entiendo tu molestia y lo siento. Ya le pasé tu caso a una persona del equipo; te escribe por aquí.',
  en: 'I understand you are upset, and I am sorry. I passed your case to a person on the team; they will write to you here.',
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

/**
 * C-CAMILA-CORTESIA (18 nov 2026, Richard: escribió «Hola» y Camila le contestó «no estoy segura de
 * haberte entendido»). Un saludo, un «gracias», un «ok» o una despedida se contestan con calidez,
 * desde el código (con IA y sin ella): nunca con «no te entendí», y nunca cuentan como un intento
 * fallido. Solo cuando el mensaje ENTERO es eso; «hola, ¿cómo pido una moto?» sigue su camino.
 */
const CORTESIAS = {
  saludo: [
    ...['hola', 'holaa', 'holaaa', 'ola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes'],
    ...['buenas noches', 'saludos', 'que tal', 'como estas', 'hola que tal', 'hola como estas'],
    ...['hola buenas', 'hola buenos dias', 'hola buenas tardes', 'hola buenas noches', 'epa'],
    ...['hi', 'hello', 'hey', 'hi there', 'hello there', 'good morning', 'good afternoon'],
    ...['good evening', 'how are you', 'hi how are you', 'hello how are you'],
  ],
  gracias: [
    ...[
      'gracias',
      'muchas gracias',
      'mil gracias',
      'ok gracias',
      'listo gracias',
      'gracias camila',
    ],
    ...['vale gracias', 'perfecto gracias', 'bueno gracias', 'gracias por todo', 'muy amable'],
    ...['thanks', 'thank you', 'thanks a lot', 'thank you so much', 'thank you very much'],
    ...['ok thanks', 'ok thank you', 'great thanks', 'perfect thanks'],
  ],
  ok: [
    ...['ok', 'okey', 'okay', 'oki', 'vale', 'listo', 'perfecto', 'entendido', 'bueno', 'bien'],
    ...['dale', 'de acuerdo', 'esta bien', 'ah ok', 'excelente', 'genial'],
    ...['got it', 'great', 'perfect', 'alright', 'all right', 'sounds good', 'understood', 'cool'],
  ],
  despedida: [
    ...['chao', 'chau', 'adios', 'hasta luego', 'nos vemos', 'hasta pronto', 'bye', 'goodbye'],
    ...['bye bye', 'see you', 'see you later', 'chao gracias', 'gracias chao', 'hasta manana'],
  ],
} as const;
export type Cortesia = keyof typeof CORTESIAS;
const POR_FRASE = new Map<string, Cortesia>(
  Object.entries(CORTESIAS).flatMap(([tipo, frases]) =>
    frases.map((f) => [f, tipo as Cortesia] as const),
  ),
);
/** ¿El mensaje entero es un saludo, un agradecimiento, un «ok» o una despedida? */
export function cortesiaDe(t: string): Cortesia | null {
  const limpio = plano(t)
    .replace(/ camila /g, ' ')
    .trim();
  return POR_FRASE.get(limpio) ?? null;
}
const RESPUESTAS_CORTESIA = new Map<Cortesia, { es: string; en: string }>([
  ['saludo', { es: '¡Hola! ¿En qué te puedo ayudar?', en: 'Hi! How can I help you?' }],
  [
    'gracias',
    {
      es: 'Con mucho gusto. Si necesitas algo más, aquí estoy.',
      en: 'You are welcome. If you need anything else, I am here.',
    },
  ],
  [
    'ok',
    {
      es: 'Perfecto. Si necesitas algo más, escríbeme.',
      en: 'Great. If you need anything else, just write to me.',
    },
  ],
  ['despedida', { es: '¡Hasta luego! Que te vaya muy bien.', en: 'Bye! Take care.' }],
]);
export const respuestaCortesia = (c: Cortesia, idioma: IdiomaCamila) => {
  const r = RESPUESTAS_CORTESIA.get(c) ?? { es: '', en: '' };
  return idioma === 'en' ? r.en : r.es;
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

/** ¿Está molesta? (insultos, «estafa», «pésimo servicio»…). Entonces sí pasa a una persona. */
const ENOJO = [
  ...[
    'estafa',
    'estafadores',
    'ladrones',
    'me robaron',
    'pesimo',
    'pesima',
    'horrible',
    'inservible',
  ],
  ...[
    'basura',
    'porqueria',
    'mierda',
    'harto',
    'harta',
    'indignado',
    'indignada',
    'los voy a denunciar',
  ],
  ...[
    'que mal servicio',
    'mal servicio',
    'no sirven para nada',
    'scam',
    'useless',
    'awful',
    'terrible',
  ],
  ...['i am angry', 'im angry', 'furious', 'worst service', 'rip off'],
] as const;
export const estaMolesta = (t: string) => contiene(t, ENOJO);

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
