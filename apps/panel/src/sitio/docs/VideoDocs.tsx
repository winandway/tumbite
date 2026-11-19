import { useEffect, useRef, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import type { SeccionDocs } from './guias';
import {
  CANAL_YOUTUBE,
  TEMAS_VIDEO,
  TEXTOS_VIDEO,
  type VideoDocs,
  canalConVideos,
  direccionVideo,
  direccionYoutube,
  duracionCorta,
} from './videos';

/**
 * C-DOCS-VIDEO: la pieza ÚNICA de video de Docs. Muestra la portada fija y nada más: el video se
 * pide recién cuando la persona lo toca (con internet lento la guía carga igual de rápido). Debajo
 * va el texto de lo que dice, para quien no puede oírlo y para los buscadores.
 *
 * Con `youtube` en el video se muestra desde YouTube sin cookies; sin él, el MP4 del almacén del
 * sitio. Mirar un video no escribe nada en la base.
 */
export function VideoDeDocs({
  video,
  idioma,
  ancla,
  nivel = 2,
  guia,
}: {
  video: VideoDocs;
  idioma: Idioma;
  /** El id del bloque en la página (para enlazarlo: #video en la guía, #<id> en «Videos»). */
  ancla: string;
  /** El nivel del título: 2 dentro de una guía, 3 en la página «Videos». */
  nivel?: 2 | 3;
  /** En la página «Videos»: el enlace a la guía donde vive. */
  guia?: { titulo: string; a: string };
}) {
  const t = enIdioma(TEXTOS_VIDEO, idioma);
  // En inglés solo se llega aquí si el video tiene su versión en inglés (videosEnIdioma).
  const x = (idioma === 'en' ? video.en : undefined) ?? video.es;
  const [viendo, setViendo] = useState(false);
  // Quien llega con el ancla del video (el enlace «Ver el video» de Camila) cae en el video: la
  // página se arma después de cargar, así que el navegador solo no lo encuentra a tiempo.
  const bloque = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === `#${ancla}`) bloque.current?.scrollIntoView({ block: 'start' });
  }, [ancla]);
  const youtube = direccionYoutube(x);
  const Titulo = nivel === 2 ? 'h2' : 'h3';
  return (
    <figure className="docs-video" id={ancla} ref={bloque} data-testid={`docs-video-${video.id}`}>
      <Titulo className="docs-video-titulo">
        {nivel === 2 ? `${t.video}: ${x.titulo}` : x.titulo}
      </Titulo>
      <div className="docs-video-marco">
        {!viendo ? (
          <button
            type="button"
            className="docs-video-portada"
            aria-label={t.reproducir(x.titulo)}
            onClick={() => setViendo(true)}
          >
            <img src={x.portada} alt="" width={720} height={1280} loading="lazy" decoding="async" />
            <span className="docs-video-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
            <span className="docs-video-duracion">{duracionCorta(video.segundos)}</span>
          </button>
        ) : youtube ? (
          <iframe
            src={`${youtube}?autoplay=1&rel=0&playsinline=1`}
            title={x.titulo}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <video
            controls
            autoPlay
            playsInline
            preload="auto"
            poster={x.portada}
            aria-label={x.titulo}
            data-testid="docs-video-reproductor"
          >
            <source src={direccionVideo(x)} type="video/mp4" />
            {x.subtitulos ? (
              <track kind="captions" src={x.subtitulos} srcLang={idioma} label={t.texto} default />
            ) : null}
            <a href={direccionVideo(x)}>{t.descargar}</a>
          </video>
        )}
      </div>
      <figcaption>
        <p className="docs-video-descripcion">{x.descripcion}</p>
        {guia ? (
          <p>
            <Enlace a={guia.a} className="docs-video-guia">
              {`${t.verGuia}: ${guia.titulo} →`}
            </Enlace>
          </p>
        ) : null}
        <details className="docs-video-texto">
          <summary>{t.texto}</summary>
          {x.texto.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </details>
      </figcaption>
    </figure>
  );
}

/** La página «Videos» de Docs: todos los videos por tema, cada uno con el enlace a su guía. */
export function PaginaVideos({
  videos,
  secciones,
  idioma,
  volver,
  migas,
}: {
  videos: readonly VideoDocs[];
  secciones: readonly SeccionDocs[];
  idioma: Idioma;
  volver: string;
  migas: string;
}) {
  const t = enIdioma(TEXTOS_VIDEO, idioma);
  const tituloDeGuia = (ruta: string) => {
    const [seccion, id] = ruta.split('/');
    return secciones.find((s) => s.id === seccion)?.guias.find((g) => g.id === id)?.titulo ?? '';
  };
  return (
    <article className="docs-guia docs-videos">
      <nav className="docs-migas" aria-label={migas}>
        <Enlace a="/docs" className="docs-volver">
          {volver}
        </Enlace>
      </nav>
      <h1>{t.titulo}</h1>
      <p className="docs-resumen">{t.resumen}</p>
      {TEMAS_VIDEO.map((tema) => {
        const delTema = videos.filter((v) => v.tema === tema.id);
        if (!delTema.length) return null;
        return (
          <section key={tema.id} aria-labelledby={`videos-${tema.id}`}>
            <h2 id={`videos-${tema.id}`}>{enIdioma(tema, idioma)}</h2>
            <div className="docs-videos-lista">
              {delTema.map((v) => (
                <VideoDeDocs
                  key={v.id}
                  video={v}
                  idioma={idioma}
                  ancla={v.id}
                  nivel={3}
                  guia={{ titulo: tituloDeGuia(v.guia), a: `/docs/${v.guia}` }}
                />
              ))}
            </div>
          </section>
        );
      })}
      {canalConVideos(videos) ? (
        <p>
          <a
            className="docs-video-guia"
            href={CANAL_YOUTUBE}
            target="_blank"
            rel="noopener noreferrer"
          >
            {`${t.canal} →`}
          </a>
        </p>
      ) : null}
    </article>
  );
}
