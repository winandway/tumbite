/**
 * C-SMS-VENEZUELA-TEXTOS (22 nov 2026, Venezuela): lo que sale por SMS Masivo Venezuela pasa SIEMPRE por
 * esta compuerta. Tres reglas del proveedor y del bolsillo:
 *  1. Solo códigos, avisos y recordatorios: NUNCA montos, saldos ni datos de pago (sus términos). Un
 *     texto así no se manda por aquí.
 *  2. Un solo SMS: 160 caracteres como mucho.
 *  3. Sin acentos ni signos fuera del alfabeto básico de los SMS (con uno solo, el mensaje entero pasa
 *     a contar de 70 en 70 y se cobra doble o triple).
 * Los mensajes largos de siempre (paquete, regalo, viaje compartido, invitaciones, emergencia) tienen
 * aquí su versión corta, medida en su prueba con los datos más largos posibles.
 *
 * Qué NO tocar: el orden (primero se limpia, después se mira el dinero, al final se ajusta el largo) y
 * los recortes de cada versión corta: están calculados para que el enlace nunca se parta.
 */
export const LARGO_UN_SMS = 160;

/** Quita acentos y todo lo que no está en el alfabeto básico de los SMS. */
export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[«»“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[~^`\\|{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Montos, saldos y datos de pago: lo que el proveedor no deja mandar. Se mira ya sin acentos. */
const DINERO: readonly RegExp[] = [
  /(?:\$|\bUSD|\bVES|\bCOP|\bPEN|\bBs\.?|\bS\/\.?) ?\d/i,
  /\d ?(?:USD|VES|COP|PEN|Bs|dolares|dolar|dollars|bolivares|pesos|soles)\b/i,
  /\b(?:saldo|balance|tarjeta|card|cvv|iban|zelle|pago movil|cuenta bancaria|numero de cuenta|bank account|account number)\b/i,
];
/**
 * C-SMS-ENLACE-NO-ES-DINERO (26 nov 2026): los enlaces no se miran. Su código es al azar y a veces
 * trae «9usd» o «Bs5»: el aviso salía frenado como si llevara un monto.
 */
const sinEnlaces = (texto: string) =>
  texto.replace(/(?:https?:\/\/|\b[a-z0-9-]+\.(?:com|dev|app|net|org)\/)\S*/gi, ' ');
const tieneDinero = (limpio: string) => DINERO.some((r) => r.test(sinEnlaces(limpio)));
export const hablaDeDinero = (texto: string) => tieneDinero(sinAcentos(texto));

function cortarEnPalabra(texto: string, largo: number): string {
  if (texto.length <= largo) return texto;
  const corte = texto.slice(0, largo + 1);
  const espacio = corte.lastIndexOf(' ');
  return (espacio > largo / 2 ? corte.slice(0, espacio) : texto.slice(0, largo))
    .replace(/[ ,;:-]+$/, '')
    .trim();
}

export type TextoSmsVenezuela =
  { texto: string; bloqueado?: undefined } | { texto?: undefined; bloqueado: 'dinero' | 'largo' };

/**
 * El texto tal como puede salir por el proveedor de Venezuela, o por qué no puede salir. Si pasa de un
 * SMS, se acorta sin partir el enlace (lo que venga después del enlace se pierde: por eso los mensajes
 * con algo importante después tienen su versión corta).
 */
export function textoParaSmsVenezuela(original: string): TextoSmsVenezuela {
  const limpio = sinAcentos(original);
  if (!limpio) return { bloqueado: 'largo' };
  if (tieneDinero(limpio)) return { bloqueado: 'dinero' };
  if (limpio.length <= LARGO_UN_SMS) return { texto: limpio };
  const m = /https?:\/\/\S+/.exec(limpio);
  if (!m) return { texto: cortarEnPalabra(limpio, LARGO_UN_SMS) };
  const enlace = m[0].replace(/[.,;]+$/, '');
  const libre = LARGO_UN_SMS - enlace.length - 1;
  if (libre < 20) return { bloqueado: 'largo' };
  return { texto: `${cortarEnPalabra(limpio.slice(0, m.index).trim(), libre)} ${enlace}` };
}

/** Un dato variable (nombre, empresa, zona) recortado a su cupo, ya sin acentos. */
const cupo = (s: string | null | undefined, largo: number, siFalta = '') =>
  sinAcentos(String(s ?? ''))
    .slice(0, largo)
    .trim() || siFalta;

/** El punto en el mapa con el enlace más corto que abre Google Maps (5 decimales: un metro). */
export const mapaCorto = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null
    ? `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`
    : 'sin GPS';

type Idioma = 'es' | 'en';

/** Paquete de persona a persona: quién lo manda, dónde seguirlo y el PIN (lo último, nunca se pierde). */
export const cortoEnvioDestinatario = (i: Idioma, nombre: string, enlace: string, pin: string) =>
  i === 'en'
    ? `Divoox: ${cupo(nombre, 15, 'Someone')} sent you a package. Track: ${enlace} Delivery PIN: ${pin}`
    : `Divoox: ${cupo(nombre, 15, 'Alguien')} te envio un paquete. Siguelo: ${enlace} PIN de entrega: ${pin}`;

export const cortoViajeCompartido = (i: Idioma, nombre: string, enlace: string) =>
  i === 'en'
    ? `Divoox: ${cupo(nombre, 15, 'Someone')} shared a ride with you. Follow it: ${enlace}`
    : `Divoox: ${cupo(nombre, 15, 'Alguien')} compartio su viaje contigo. Siguelo: ${enlace}`;

export const cortoRegalo = (i: Idioma, de: string, restaurante: string, enlace: string) =>
  i === 'en'
    ? `Divoox: ${cupo(de, 12, 'Someone')} sent you a gift from ${cupo(restaurante, 20)}. Track: ${enlace}`
    : `Divoox: ${cupo(de, 12, 'Alguien')} te mando un regalo de ${cupo(restaurante, 20)}. Siguelo: ${enlace}`;

export const cortoPaqueteEmpresa = (i: Idioma, empresa: string, enlace: string) =>
  i === 'en'
    ? `Divoox: ${cupo(empresa, 25, 'A company')} sent you a package. Track: ${enlace}`
    : `Divoox: ${cupo(empresa, 25, 'Una empresa')} te envio un paquete. Siguelo: ${enlace}`;

export const cortoInvitarConductor = (i: Idioma, empresa: string, enlace: string) =>
  i === 'en'
    ? `${cupo(empresa, 22, 'A company')} invited you to Divoox Driver. Get the app and join: ${enlace}`
    : `${cupo(empresa, 22, 'Una empresa')} te invito a Divoox Driver. Instala la app y entra: ${enlace}`;

type Emergencia = {
  nombre: string;
  telefono: string | null | undefined;
  lat?: number | null;
  lng?: number | null;
};
const quien = (p: Emergencia) =>
  `${cupo(p.nombre, 15, 'sin nombre')} tel ${cupo(p.telefono, 14, 'no dio')}`;

/** Pánico al responsable de la zona. */
export const cortoPanico = (p: Emergencia, rol: string, zona: string) =>
  `Divoox PANICO ${cupo(zona, 18)}: ${cupo(rol, 13)} ${quien(p)} pide ayuda. ${mapaCorto(p.lat, p.lng)} Llamalo ya.`;

/** Emergencia al líder y al segundo contacto de la línea. */
export const cortoEmergenciaLinea = (p: Emergencia, linea: string) =>
  `Divoox EMERGENCIA linea ${cupo(linea, 15)}: ${quien(p)} pide ayuda. ${mapaCorto(p.lat, p.lng)} Llamalo ya.`;
