import type { Idioma } from '@tumbite/compartido';

/**
 * C-AVISO-IA-UNICO (21 nov 2026, dictamen duodécimo del auditor de tiendas). El texto exacto de la
 * pantalla única del aviso de IA (fotos de verificación y chat de ayuda), en español y en inglés.
 * Cambiar una palabra exige un dictamen nuevo y subir VERSION_AVISO_IA en el servidor.
 */
export const TEXTOS_AVISO_IA = {
  es: {
    titulo: 'Cómo revisamos tus documentos',
    texto:
      'Para verificar tu documento de identidad, licencia, seguro y la foto de tu cara, y para contestarte en el chat de ayuda, usamos un servicio automático de inteligencia artificial de Google (Gemini). Reciben tus fotos y tus mensajes. Nunca te rechaza una máquina: la decisión siempre la toma una persona de nuestro equipo. Puedes cambiar esto cuando quieras en tu perfil. Más información en nuestra política de privacidad.',
    politica: 'Ver la política de privacidad',
    casilla:
      'Doy mi permiso para que Google (Gemini) analice mis fotos de documentos y mis mensajes de ayuda como se explica arriba.',
    boton: 'Aceptar y continuar',
    alternativa: 'Prefiero revisión solo por una persona',
    falta: 'Marca la casilla para continuar.',
    // C-FOTO-CARA-A-LA-VISTA (23 nov 2026): el resumen va arriba, a la vista; el texto del dictamen
    // sigue completo en la misma pantalla, con «Ver todo el texto». No reemplaza al texto.
    resumen:
      'Google (Gemini), un servicio de inteligencia artificial, recibe tus fotos de documentos y tus mensajes de ayuda para revisarlos. Nunca te rechaza una máquina: decide una persona de nuestro equipo.',
    verMas: 'Ver todo el texto',
    verMenos: 'Ver menos',
    relectura:
      'Guardamos tu respuesta, pero no pudimos actualizar la pantalla. Revisa tu señal y toca Reintentar.',
    reintentar: 'Reintentar',
  },
  en: {
    titulo: 'How we check your documents',
    texto:
      'To verify your ID, license, insurance and a photo of your face, and to answer you in the help chat, we use an automated artificial intelligence service from Google (Gemini). It receives your photos and your messages. A machine never rejects you: a person on our team always makes the decision. You can change this anytime in your profile. More in our privacy policy.',
    politica: 'See the privacy policy',
    casilla:
      'I give my permission for Google (Gemini) to analyze my document photos and help messages as explained above.',
    boton: 'Accept and continue',
    alternativa: 'I prefer review by a person only',
    falta: 'Check the box to continue.',
    resumen:
      'Google (Gemini), an artificial intelligence service, receives your document photos and help messages to check them. A machine never rejects you: a person on our team decides.',
    verMas: 'See the full text',
    verMenos: 'Show less',
    relectura:
      'We saved your answer, but couldn’t refresh the screen. Check your signal and tap Retry.',
    reintentar: 'Retry',
  },
} as const;

export const textosAvisoIa = (idioma: Idioma) =>
  idioma === 'en' ? TEXTOS_AVISO_IA.en : TEXTOS_AVISO_IA.es;

export type PlataformaAviso = 'ios' | 'android' | 'web';

/** La plataforma que se le dice al servidor (todo lo que no es iPhone ni Android cuenta como web). */
export const plataformaAviso = (os: string): PlataformaAviso =>
  os === 'ios' ? 'ios' : os === 'android' ? 'android' : 'web';

/**
 * La ÚNICA diferencia entre plataformas (excepción escrita en CANDADOS.md): en iPhone la pantalla
 * ofrece seguir sin la IA (Apple 5.1.1(iv)); en Android y en la web es obligatoria (Google no exige
 * alternativa y Gerencia lo ordenó así).
 */
export const avisoConAlternativa = (p: PlataformaAviso) => p === 'ios';

export const politicaDePrivacidad = (idioma: Idioma) =>
  idioma === 'en' ? 'https://divoox.com/privacy' : 'https://divoox.com/es/privacy';

/** Se muestra mientras el servidor lo diga (un servidor viejo no manda el dato: no se muestra). */
export const hayQueMostrarAvisoIa = (v: { avisoIaPendiente?: boolean } | null | undefined) =>
  v?.avisoIaPendiente === true;
