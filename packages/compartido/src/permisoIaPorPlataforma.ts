import type { Idioma } from './idiomas';

/**
 * C-CHAT-WEB-SIN-MURO (23 nov 2026, orden de Richard, decisión de Gerencia) — todos los países.
 *
 * La ÚNICA pieza que decide cómo se informa del procesamiento con IA en el chat de ayuda según dónde
 * corre. Nada de condiciones sueltas por pantalla.
 *
 *  - Web (`web`, el chat de divoox.com en el navegador): SIN muro. Una línea discreta debajo de la
 *    casilla informa, con enlace a la política de privacidad y «Prefiero que me atienda una persona».
 *    Al enviar, el servidor guarda una vez cuándo y con qué versión del texto se informó.
 *  - Apps nativas (`ios`, `android`): permiso EXPLÍCITO, exactamente como hoy (Apple 5.1.2(i); para
 *    Android, Gerencia espera el dictamen del auditor de tiendas). Los papeles del conductor («Cómo
 *    revisamos tus documentos») NO pasan por aquí: siguen con su pantalla en todas las plataformas.
 *
 * Camila no se presenta como asistente virtual (C-CAMILA-SIN-AVISO): la línea habla de privacidad y de
 * cómo se procesa el mensaje, nunca de «soy una IA».
 */
export type PlataformaIa = 'ios' | 'android' | 'web';

/** La plataforma (todo lo que no es iPhone ni Android cuenta como web). */
export const plataformaIa = (os: string): PlataformaIa =>
  os === 'ios' ? 'ios' : os === 'android' ? 'android' : 'web';

export type ModoPermisoIa = 'explicito' | 'linea';

/** Solo la web va por la línea informativa; iPhone y Android, permiso explícito. */
export const modoPermisoIa = (p: PlataformaIa): ModoPermisoIa =>
  p === 'web' ? 'linea' : 'explicito';

/**
 * La versión del texto de la línea. Cambiar una palabra de `LINEA_IA` exige subir esta fecha: queda
 * guardada con la persona como prueba de qué se le dijo.
 */
export const VERSION_LINEA_IA = 'linea-2026-11-23';

/** La marca que viaja con el mensaje para que el servidor registre que se informó. */
export const marcaLineaIa = (p: 'web') => `${VERSION_LINEA_IA}/${p}`;

/** Solo la web; una marca de Android o de iPhone no vale (allí el permiso es explícito). */
export const PATRON_MARCA_LINEA_IA = /^linea-\d{4}-\d{2}-\d{2}\/web$/;
export const esMarcaLineaIa = (s: unknown): s is string =>
  typeof s === 'string' && PATRON_MARCA_LINEA_IA.test(s);

/** La línea de debajo de la casilla del chat de ayuda de la web. */
const LINEA_IA = {
  es: {
    linea:
      'Al enviar, tus mensajes y capturas se procesan con un servicio de Google (Gemini) para responderte.',
    privacidad: 'Privacidad',
    prefieroPersona: 'Prefiero que me atienda una persona',
    conPersona: 'Te atiende una persona de nuestro equipo.',
    error: 'No se pudo guardar tu elección. Inténtalo otra vez.',
  },
  en: {
    linea:
      'When you send, your messages and screenshots are processed with a Google (Gemini) service to answer you.',
    privacidad: 'Privacy',
    prefieroPersona: 'I’d rather talk to a person',
    conPersona: 'A person on our team is helping you.',
    error: 'Couldn’t save your choice. Please try again.',
  },
} as const;
export const textosLineaIa = (idioma: Idioma) => (idioma === 'en' ? LINEA_IA.en : LINEA_IA.es);

export const enlacePrivacidad = (idioma: Idioma) =>
  idioma === 'en' ? 'https://divoox.com/privacy' : 'https://divoox.com/es/privacy';
