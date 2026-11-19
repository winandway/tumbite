import type { Idioma } from '@tumbite/compartido';

/**
 * C-DOCS-VIDEO (19 nov 2026, Richard: «que los videos no se queden en una carpeta: que vivan en
 * Docs, al lado de la guía que explican») — todos los países.
 *
 * La lista de videos de Docs. Cada video vive en SU guía (arriba o después de los pasos) y en la
 * página «Videos» (/docs/videos), que solo existe cuando hay al menos uno.
 *
 * Cómo entra un video (lo hace `node scripts/docs/subir-video.mjs`, que deja la entrada lista):
 *  - el MP4 vertical de 720×1280 con arranque rápido va al almacén del sitio y se sirve en
 *    /media/docs-video/<nombre>-<huella>.mp4 (nunca en el paquete del sitio);
 *  - la portada, en WebP, va en apps/panel/public/docs/ como video-<id>-<idioma>.webp;
 *  - el texto de lo que dice el video va aquí, en los dos idiomas: lo leen Google, los lectores de
 *    pantalla y quien no puede oírlo.
 * Un video SIEMPRE trae español e inglés (lo exige el tipo) y es neutro de lugar y sin datos reales
 * (C-DOCS-SIN-DATOS-REALES). Solo entra lo que ya funciona y está encendido (C-SOLO-LO-TERMINADO).
 *
 * El día que exista el canal de YouTube basta poner `youtube` (el identificador del video) en cada
 * idioma: la pieza cambia sola al reproductor sin cookies.
 */
export type TemaVideo = 'customers' | 'drivers' | 'partners' | 'restaurants' | 'business';

export type VideoEnIdioma = {
  titulo: string;
  /** Una o dos frases: de qué trata y para quién es. */
  descripcion: string;
  /** El archivo en el almacén: <nombre>-<huella de 8>.mp4 (la huella cambia si cambia el video). */
  archivo: string;
  /** La portada fija: /docs/video-<id>-<idioma>.webp, vertical. */
  portada: string;
  /** Lo que dice el video, en párrafos. */
  texto: string[];
  /** El identificador del video en YouTube (11 caracteres). Si está, se muestra desde YouTube. */
  youtube?: string;
  /** Subtítulos en formato WebVTT, si los hay: /docs/video-<id>-<idioma>.vtt. */
  subtitulos?: string;
};

export type VideoDocs = {
  /** Fijo y en inglés: es su ancla en la página «Videos» (/docs/videos#<id>). */
  id: string;
  tema: TemaVideo;
  /** La guía donde vive: «seccion/guia», como en la dirección. */
  guia: string;
  /** Arriba (después del resumen) o después de los pasos. */
  lugar: 'arriba' | 'pasos';
  /** Cuánto dura, en segundos. */
  segundos: number;
  /** El día en que se publicó, AAAA-MM-DD (lo pide Google). */
  publicado: string;
  es: VideoEnIdioma;
  /**
   * Opcional (Richard, 19 nov 2026): un video para un público que solo habla español (las líneas de
   * mototaxi) va solo en español. Sin `en`, la guía y la página «Videos» en inglés van sin él: un
   * video en español en una página en inglés es el idioma equivocado (C-CAPTURAS-POR-IDIOMA).
   */
  en?: VideoEnIdioma;
};

/** Los videos publicados. Vacía hasta que entre el primero: la página «Videos» no se publica vacía. */
export const VIDEOS: readonly VideoDocs[] = [];

/** El orden y el nombre de cada tema en la página «Videos». */
export const TEMAS_VIDEO: readonly { id: TemaVideo; es: string; en: string }[] = [
  { id: 'customers', es: 'Para pedir', en: 'For customers' },
  { id: 'drivers', es: 'Para repartidores y conductores', en: 'For drivers' },
  { id: 'partners', es: 'Para líneas y equipos', en: 'For fleets and teams' },
  { id: 'restaurants', es: 'Para restaurantes', en: 'For restaurants' },
  { id: 'business', es: 'Para empresas', en: 'For business' },
];

const VIDEO_ES = {
  titulo: 'Videos',
  resumen: 'Videos cortos de Divoox, cada uno con su guía paso a paso.',
  reproducir: (titulo: string) => `Ver el video: ${titulo}`,
  video: 'Video',
  texto: 'Lo que dice el video',
  verGuia: 'Ver la guía paso a paso',
  enVideos: 'Todos los videos',
  sinSonido: 'Tu navegador no puede mostrar este video.',
  descargar: 'Bajar el video',
  canal: 'Más videos en el canal de Divoox en YouTube',
  canalCorto: 'Divoox en YouTube',
};
const VIDEO_EN: typeof VIDEO_ES = {
  titulo: 'Videos',
  resumen: 'Short Divoox videos, each with its step-by-step guide.',
  reproducir: (titulo: string) => `Watch the video: ${titulo}`,
  video: 'Video',
  texto: 'What the video says',
  verGuia: 'See the step-by-step guide',
  enVideos: 'All videos',
  sinSonido: 'Your browser can’t play this video.',
  descargar: 'Download the video',
  canal: 'More videos on the Divoox YouTube channel',
  canalCorto: 'Divoox on YouTube',
};
export const TEXTOS_VIDEO: Record<Idioma, typeof VIDEO_ES> = { es: VIDEO_ES, en: VIDEO_EN };

/** El canal de Divoox en YouTube (creado el 19 nov 2026). */
export const CANAL_YOUTUBE = 'https://www.youtube.com/@divoox-com';

/**
 * El canal se enlaza (página «Videos» y pie del sitio) recién cuando algún video de Docs ya está
 * subido ahí: no se manda a nadie a un canal vacío (C-SOLO-LO-TERMINADO).
 */
export const canalConVideos = (videos: readonly VideoDocs[]) =>
  videos.some((v) => Boolean(v.es.youtube ?? v.en?.youtube));

/** Los videos de una guía («seccion/guia»), en el orden de la lista. */
/** Los videos que tienen versión en ese idioma (los únicos que se muestran en esa lengua). */
export const videosEnIdioma = (videos: readonly VideoDocs[], idioma: Idioma) =>
  idioma === 'en' ? videos.filter((v) => v.en) : videos;

export const videosDeGuia = (videos: readonly VideoDocs[], guia: string) =>
  videos.filter((v) => v.guia === guia);

/** La dirección pública del MP4 en el almacén del sitio. */
export const direccionVideo = (v: VideoEnIdioma) => `/media/docs-video/${v.archivo}`;

/** La dirección del reproductor de YouTube sin cookies (solo cuando el video tiene identificador). */
export const direccionYoutube = (v: VideoEnIdioma) =>
  v.youtube ? `https://www.youtube-nocookie.com/embed/${v.youtube}` : null;

/** «0:47», para la portada. */
export function duracionCorta(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** «PT47S» / «PT1M13S», como lo pide schema.org. */
export function duracionIso(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  const m = Math.floor(s / 60);
  return `PT${m ? `${m}M` : ''}${s % 60 || !m ? `${s % 60}S` : ''}`;
}

/**
 * Los datos estructurados de un video (schema.org VideoObject), para Google y los buscadores de IA.
 * `dominio` sin barra final; `pagina` es la dirección completa de la página donde se ve.
 */
export function datosDeVideo(v: VideoDocs, idioma: Idioma, dominio: string, pagina: string) {
  const x = (idioma === 'en' ? v.en : undefined) ?? v.es;
  const youtube = direccionYoutube(x);
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: x.titulo,
    description: x.descripcion,
    thumbnailUrl: [`${dominio}${x.portada}`],
    uploadDate: v.publicado,
    duration: duracionIso(v.segundos),
    inLanguage: idioma,
    contentUrl: `${dominio}${direccionVideo(x)}`,
    ...(youtube ? { embedUrl: youtube } : {}),
    transcript: x.texto.join(' '),
    url: pagina,
    publisher: { '@type': 'Organization', name: 'Divoox', url: `${dominio}/` },
  };
}

/** Minúsculas, números y guiones sueltos (sin guion al principio, al final ni dos seguidos). */
const esId = (id: string) => /^[a-z0-9-]{1,80}$/.test(id) && !/^-|-$|--/.test(id);
const ARCHIVO = /^[a-z0-9-]{1,100}-[0-9a-f]{8}\.mp4$/;
const YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/**
 * C-DOCS-SIN-DATOS-REALES: lo que se escribe de un video (título, descripción y lo que dice) es
 * neutro de lugar, igual que las capturas. Los nombres de equipos reales los veta, en todo el
 * repositorio, la lista de `sinDatosReales.test.ts` (este archivo incluido).
 */
const CON_LUGAR =
  /\b(el vigia|tucani|novi|miami|tampa|orlando|ocala|caracas|merida|bogota|detroit|michigan|florida)\b/;
const llano = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Lo que está mal en la lista de videos (vacío = todo bien). Lo corre el candado con la lista real
 * y con las guías reales, así un video mal puesto no llega a publicarse.
 */
export function fallasDeVideos(videos: readonly VideoDocs[], guias: ReadonlySet<string>) {
  const fallas: string[] = [];
  const vistos = new Set<string>();
  for (const v of videos) {
    const mal = (que: string) => fallas.push(`${v.id}: ${que}`);
    if (!esId(v.id)) mal('el id va en minúsculas, con guiones');
    if (vistos.has(v.id)) mal('id repetido');
    vistos.add(v.id);
    if (!guias.has(v.guia)) mal(`la guía «${v.guia}» no existe en Docs`);
    if (!(v.segundos > 0)) mal('falta la duración');
    if (!FECHA.test(v.publicado)) mal('la fecha va como AAAA-MM-DD');
    for (const idioma of ['es', 'en'] as const) {
      const x = idioma === 'en' ? v.en : v.es;
      if (!x) continue;
      if (!x.titulo.trim() || !x.descripcion.trim())
        mal(`${idioma}: falta el título o la descripción`);
      if (!ARCHIVO.test(x.archivo)) mal(`${idioma}: el archivo va como <nombre>-<huella>.mp4`);
      if (x.portada !== `/docs/video-${v.id}-${idioma}.webp`)
        mal(`${idioma}: la portada va en /docs/video-${v.id}-${idioma}.webp`);
      if (x.texto.join(' ').trim().length < 40) mal(`${idioma}: falta el texto de lo que dice`);
      if (CON_LUGAR.test(llano([x.titulo, x.descripcion, ...x.texto].join(' '))))
        mal(`${idioma}: nombra una ciudad (los videos de Docs son neutros de lugar)`);
      if (x.youtube !== undefined && !YOUTUBE.test(x.youtube))
        mal(`${idioma}: el identificador de YouTube tiene 11 caracteres`);
      if (x.subtitulos !== undefined && x.subtitulos !== `/docs/video-${v.id}-${idioma}.vtt`)
        mal(`${idioma}: los subtítulos van en /docs/video-${v.id}-${idioma}.vtt`);
    }
    if (v.es.archivo === v.en?.archivo)
      mal('el video en inglés es el mismo archivo que en español');
  }
  return fallas;
}
