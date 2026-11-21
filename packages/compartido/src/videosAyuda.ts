import type { Idioma } from './idiomas';

/**
 * C-VER-VIDEO (21 nov 2026, pedido de Richard) — todos los países. Los videos cortos de ayuda que una
 * pantalla ofrece con el enlace «Ver video». Cada pantalla tiene su clave; cada clave, un video por
 * idioma (nunca el de otro idioma: quien lee en inglés no recibe la narración en español). Viven en
 * el almacén del sitio y se encienden por ajuste, sin compilar las apps otra vez.
 */
export const CLAVES_VIDEO_AYUDA = ['fotos-entrada'] as const;
export type ClaveVideoAyuda = (typeof CLAVES_VIDEO_AYUDA)[number];
/** Lo que responde GET /datos/videos-ayuda: la dirección del video de cada pantalla, por idioma. */
export type VideosAyuda = Partial<Record<ClaveVideoAyuda, Partial<Record<'es' | 'en', string>>>>;

/** El nombre de un video de ayuda en el almacén: `<nombre>-<idioma>-<huella>.mp4` (lo pone subir-video). */
export const PATRON_VIDEO_AYUDA = /^[a-z0-9-]{1,100}-[0-9a-f]{8}\.mp4$/;

/** La dirección del video de esa pantalla en ese idioma, o null si está apagado. */
export function videoAyudaPara(
  videos: VideosAyuda | null | undefined,
  clave: ClaveVideoAyuda,
  idioma: Idioma,
): string | null {
  const deLaPantalla = videos ? new Map(Object.entries(videos)).get(clave) : undefined;
  const v = idioma === 'en' ? deLaPantalla?.en : deLaPantalla?.es;
  return typeof v === 'string' && v.startsWith('/media/docs-video/') ? v : null;
}

export const TEXTOS_VER_VIDEO = {
  es: {
    ver: 'Ver video',
    cerrar: 'Cerrar',
    titulo: 'Video de ayuda',
    sinSenal: 'No se pudo cargar el video. Revisa tu conexión.',
  },
  en: {
    ver: 'Watch video',
    cerrar: 'Close',
    titulo: 'Help video',
    sinSenal: 'Couldn’t load the video. Check your connection.',
  },
} as const;
