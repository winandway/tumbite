import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pie } from '../Pie';
import { Docs } from './Docs';
import { DOCS } from './guias';
import {
  VIDEOS,
  type VideoDocs,
  datosDeVideo,
  duracionCorta,
  duracionIso,
  fallasDeVideos,
} from './videos';

/**
 * C-DOCS-VIDEO (19 nov 2026, Richard: «que los videos no se queden en una carpeta: que vivan en
 * Docs, al lado de la guía que explican») — todos los países.
 *
 * La pieza de video de Docs: portada fija, el video se pide SOLO al tocarla, el texto de lo que
 * dice va en la página, y la página «Videos» no existe mientras no haya ninguno. La lista real
 * (`VIDEOS`) pasa por el validador: dos idiomas, guía que existe, portada en su sitio y nada de
 * ciudades ni nombres reales.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');
const MUESTRA_EN = {
  titulo: 'Request a moto ride in one minute',
  descripcion: 'How to request your first moto ride, step by step.',
  archivo: 'ride-moto-in-a-minute-en-9f8e7d6c.mp4',
  portada: '/docs/video-ride-moto-in-a-minute-en.webp',
  texto: ['Open Divoox and tap Moto.', 'Choose where you’re going and confirm the price first.'],
};
const MUESTRA: VideoDocs & { en: typeof MUESTRA_EN } = {
  id: 'ride-moto-in-a-minute',
  tema: 'customers',
  guia: 'ordering/ride-moto',
  lugar: 'arriba',
  segundos: 47,
  publicado: '2026-11-19',
  es: {
    titulo: 'Pide una moto en un minuto',
    descripcion: 'Cómo pedir tu primer viaje en moto, paso a paso.',
    archivo: 'ride-moto-in-a-minute-es-0a1b2c3d.mp4',
    portada: '/docs/video-ride-moto-in-a-minute-es.webp',
    texto: ['Abre Divoox y toca Moto.', 'Elige a dónde vas y confirma el precio antes de pedir.'],
  },
  en: MUESTRA_EN,
};
const GUIAS = new Set(DOCS.es.flatMap((s) => s.guias.map((g) => `${s.id}/${g.id}`)));
const html = (ruta: string, videos: readonly VideoDocs[], idioma: 'es' | 'en' = 'es') =>
  renderToString(<Docs ruta={ruta} idioma={idioma} videos={videos} />);

describe('C-DOCS-VIDEO · la lista real de videos', () => {
  it('pasa el validador: dos idiomas, guía que existe, portada en su sitio y sin lugares', () => {
    expect(fallasDeVideos(VIDEOS, GUIAS)).toEqual([]);
  });

  it('cada portada (y cada archivo de subtítulos) está en el sitio', () => {
    for (const v of VIDEOS)
      for (const x of [v.es, ...(v.en ? [v.en] : [])])
        for (const archivo of [x.portada, ...(x.subtitulos ? [x.subtitulos] : [])])
          expect(
            existsSync(join(RAIZ, 'apps', 'panel', 'public', archivo)),
            `${v.id}: falta ${archivo}`,
          ).toBe(true);
  });

  it('las guías existen igual en inglés', () => {
    const en = new Set(DOCS.en.flatMap((s) => s.guias.map((g) => `${s.id}/${g.id}`)));
    for (const v of VIDEOS) if (v.en) expect(en.has(v.guia), v.id).toBe(true);
  });
});

describe('C-DOCS-VIDEO · el validador atrapa un video mal puesto', () => {
  const con = (cambio: Partial<VideoDocs>) => fallasDeVideos([{ ...MUESTRA, ...cambio }], GUIAS);

  it('la muestra buena no tiene fallas', () => {
    expect(fallasDeVideos([MUESTRA], GUIAS)).toEqual([]);
  });

  it('guía que no existe, id repetido, fecha y duración', () => {
    expect(con({ guia: 'ordering/no-existe' }).join()).toContain('no existe en Docs');
    expect(fallasDeVideos([MUESTRA, MUESTRA], GUIAS).join()).toContain('id repetido');
    expect(con({ publicado: '19/11/2026' }).join()).toContain('AAAA-MM-DD');
    expect(con({ segundos: 0 }).join()).toContain('duración');
  });

  it('archivo sin huella, portada fuera de sitio, sin texto y YouTube mal escrito', () => {
    expect(con({ es: { ...MUESTRA.es, archivo: 'video.mp4' } }).join()).toContain('huella');
    expect(con({ en: { ...MUESTRA.en, portada: '/otra.webp' } }).join()).toContain('portada');
    expect(con({ es: { ...MUESTRA.es, texto: ['Hola.'] } }).join()).toContain('falta el texto');
    expect(con({ es: { ...MUESTRA.es, youtube: 'corto' } }).join()).toContain('YouTube');
    expect(con({ en: { ...MUESTRA.en, archivo: MUESTRA.es.archivo } }).join()).toContain(
      'mismo archivo',
    );
  });

  it('un video que nombra una ciudad o un equipo real no entra (C-DOCS-SIN-DATOS-REALES)', () => {
    for (const texto of [
      'Ya estamos en El Vigía con las motos.',
      'El equipo Jehová Jireh te lleva.',
    ])
      expect(con({ es: { ...MUESTRA.es, texto: [texto, ...MUESTRA.es.texto] } }).join()).toContain(
        'neutros',
      );
    expect(
      con({ en: { ...MUESTRA.en, descripcion: 'Rides in Novi, Michigan.' } }).join(),
    ).toContain('neutros');
  });
});

describe('C-DOCS-VIDEO · la pieza dentro de la guía', () => {
  it('sin videos, la guía queda igual: ni bloque de video ni enlace a «Videos»', () => {
    const pagina = html('/docs/ordering/ride-moto', []);
    expect(pagina).not.toContain('docs-video');
    expect(pagina).not.toContain('/docs/videos');
  });

  it('va arriba: después del resumen y antes de los pasos, con el ancla #video', () => {
    const pagina = html('/docs/ordering/ride-moto', [MUESTRA]);
    const en = (trozo: string) => pagina.indexOf(trozo);
    expect(en('<figure class="docs-video" id="video"')).toBeGreaterThan(en('class="docs-resumen"'));
    expect(en('<figure class="docs-video" id="video"')).toBeLessThan(en('<ol'));
    expect(pagina).toContain('Video: Pide una moto en un minuto');
    expect(pagina).toContain('0:47');
  });

  it('con «pasos» va después de los pasos y antes de las capturas', () => {
    const pagina = html('/docs/ordering/ride-moto', [{ ...MUESTRA, lugar: 'pasos' }]);
    const en = (trozo: string) => pagina.indexOf(trozo);
    expect(en('class="docs-video"')).toBeGreaterThan(en('</ol>'));
    expect(en('class="docs-video"')).toBeLessThan(en('class="docs-capturas"'));
  });

  it('al cargar solo va la portada: el video NO se pide hasta tocarla', () => {
    const pagina = html('/docs/ordering/ride-moto', [MUESTRA]);
    expect(pagina).toContain('src="/docs/video-ride-moto-in-a-minute-es.webp"');
    expect(pagina).toMatch(/<img[^>]*loading="lazy"/);
    expect(pagina).not.toContain('<video');
    expect(pagina).not.toContain('<iframe');
    expect(pagina).not.toContain('.mp4');
    expect(pagina).not.toContain('youtube');
  });

  it('el texto de lo que dice el video va en la página, para buscadores y lectores', () => {
    const pagina = html('/docs/ordering/ride-moto', [MUESTRA]);
    expect(pagina).toContain('Lo que dice el video');
    for (const p of MUESTRA.es.texto) expect(pagina).toContain(p);
    const ingles = html('/docs/ordering/ride-moto', [MUESTRA], 'en');
    expect(ingles).toContain('What the video says');
    expect(ingles).toContain('Video: Request a moto ride in one minute');
    expect(ingles).toContain('Open Divoox and tap Moto.');
    expect(ingles).not.toContain('Abre Divoox');
  });

  it('al tocar la portada aparece el video del almacén del sitio, con sus controles', async () => {
    render(<Docs ruta="/docs/ordering/ride-moto" idioma="es" videos={[MUESTRA]} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver el video: Pide una moto en un minuto' }),
    );
    const video = screen.getByTestId('docs-video-reproductor');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video.querySelector('source')).toHaveAttribute(
      'src',
      '/media/docs-video/ride-moto-in-a-minute-es-0a1b2c3d.mp4',
    );
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('con identificador de YouTube, al tocar sale el reproductor sin cookies', async () => {
    const conYoutube = { ...MUESTRA, en: { ...MUESTRA.en, youtube: 'abcDEF_1234' } };
    render(<Docs ruta="/docs/ordering/ride-moto" idioma="en" videos={[conYoutube]} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Watch the video: Request a moto ride in one minute' }),
    );
    const marco = document.querySelector('iframe');
    expect(marco?.getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF_1234\?/,
    );
    expect(document.querySelector('video')).toBeNull();
  });

  it('el servidor deja cargar ese reproductor (y ningún otro marco de video)', () => {
    const seguridad = readFileSync(join(RAIZ, 'apps', 'servidor', 'src', 'seguridad.ts'), 'utf8');
    expect(seguridad).toMatch(/frame-src [^;]*https:\/\/www\.youtube-nocookie\.com;/);
    expect(seguridad).not.toContain('https://www.youtube.com');
  });
});

describe('C-DOCS-VIDEO · la página «Videos»', () => {
  it('no existe mientras no haya videos: ni en el menú ni en su dirección', () => {
    const pagina = html('/docs/videos', []);
    expect(pagina).toContain('role="alert"');
    expect(pagina).not.toContain('docs-videos');
    expect(html('/docs', [])).not.toContain('/docs/videos');
  });

  it('con videos: está en el menú y en la portada de Docs, y la barra no se pierde', () => {
    const portada = html('/docs', [MUESTRA]);
    expect(portada.match(/href="\/docs\/videos"/g)?.length).toBeGreaterThanOrEqual(2);
    const pagina = html('/docs/videos', [MUESTRA]);
    expect(pagina).toContain('<h1>Videos</h1>');
    expect(pagina).toContain('class="docs-barra-cuerpo"');
    expect(pagina).toMatch(/href="\/docs\/videos" class="docs-inicio activo"/);
    expect(pagina).not.toContain('role="alert"');
  });

  it('lista cada video bajo su tema, con el enlace a su guía y su ancla propia', () => {
    const pagina = html('/docs/videos', [MUESTRA]);
    expect(pagina).toContain('<h2 id="videos-customers">Para pedir</h2>');
    // Un tema sin videos no deja un título vacío.
    expect(pagina).not.toContain('id="videos-restaurants"');
    expect(pagina).toContain('<figure class="docs-video" id="ride-moto-in-a-minute"');
    expect(pagina).toContain('href="/docs/ordering/ride-moto"');
    const guia = DOCS.es.find((s) => s.id === 'ordering')!.guias.find((g) => g.id === 'ride-moto')!;
    expect(pagina).toContain(`Ver la guía paso a paso: ${guia.titulo}`);
    const ingles = html('/docs/videos', [MUESTRA], 'en');
    expect(ingles).toContain('For customers');
    expect(ingles).toContain('See the step-by-step guide');
  });
});

describe('C-DOCS-VIDEO · un video solo en español (Richard, 19 nov 2026)', () => {
  const soloEs: VideoDocs = { ...MUESTRA, en: undefined };

  it('es válido sin la versión en inglés', () => {
    expect(fallasDeVideos([soloEs], GUIAS)).toEqual([]);
  });

  it('en español se ve; en la guía en inglés NO (sería un video en el idioma equivocado)', () => {
    expect(html('/docs/ordering/ride-moto', [soloEs])).toContain('docs-video');
    const ingles = html('/docs/ordering/ride-moto', [soloEs], 'en');
    expect(ingles).not.toContain('docs-video');
    expect(ingles).not.toContain('Pide una moto');
  });

  it('la página «Videos» y su enlace existen en español y no en inglés', () => {
    expect(html('/docs/videos', [soloEs])).toContain('<h1>Videos</h1>');
    expect(html('/docs/videos', [soloEs], 'en')).toContain('role="alert"');
    expect(html('/docs', [soloEs], 'en')).not.toContain('/docs/videos');
    expect(renderToString(<Pie idioma="en" videos={[soloEs]} />)).not.toContain('/docs/videos');
    expect(renderToString(<Pie idioma="es" videos={[soloEs]} />)).toContain('/docs/videos');
  });

  it('el prerender no crea la página en inglés ni anuncia una versión que no existe', () => {
    const guion = readFileSync(join(RAIZ, 'apps', 'panel', 'scripts', 'prerender.mjs'), 'utf8');
    expect(guion).toContain(
      "if (ruta === '/docs/videos' && !videosEnIdioma(VIDEOS, lengua).length) continue;",
    );
    expect(guion).toContain("ruta === '/docs/videos' && !videosEnIdioma(VIDEOS, 'en').length");
  });
});

describe('C-DOCS-VIDEO · el canal de YouTube', () => {
  const CANAL = 'href="https://www.youtube.com/@divoox-com"';
  const subido = { ...MUESTRA, es: { ...MUESTRA.es, youtube: 'abcDEF_1234' } };
  const pie = (videos: readonly VideoDocs[]) => renderToString(<Pie idioma="es" videos={videos} />);

  it('no se enlaza un canal vacío: ni en «Videos» ni en el pie', () => {
    expect(html('/docs/videos', [MUESTRA])).not.toContain('youtube.com');
    expect(pie([MUESTRA])).not.toContain('youtube.com');
    expect(pie([])).not.toContain('/docs/videos');
  });

  it('con el primer video, el pie enlaza la página «Videos»', () => {
    expect(pie([MUESTRA])).toContain('href="/docs/videos"');
  });

  it('con un video ya subido al canal, se enlaza en «Videos» y en el pie, en pestaña nueva', () => {
    const pagina = html('/docs/videos', [subido]);
    expect(pagina).toContain(CANAL);
    expect(pagina).toContain('Más videos en el canal de Divoox en YouTube');
    expect(pie([subido])).toMatch(
      /href="https:\/\/www\.youtube\.com\/@divoox-com" target="_blank" rel="noopener noreferrer"/,
    );
  });
});

describe('C-DOCS-VIDEO · los datos para Google', () => {
  it('la duración se escribe como la piden la gente y schema.org', () => {
    expect(duracionCorta(47)).toBe('0:47');
    expect(duracionCorta(73)).toBe('1:13');
    expect(duracionIso(47)).toBe('PT47S');
    expect(duracionIso(73)).toBe('PT1M13S');
    expect(duracionIso(120)).toBe('PT2M');
  });

  it('cada video sale como VideoObject, con portada, archivo, duración y lo que dice', () => {
    const d = datosDeVideo(
      MUESTRA,
      'en',
      'https://divoox.com',
      'https://divoox.com/docs/ordering/ride-moto',
    );
    expect(d).toMatchObject({
      '@type': 'VideoObject',
      name: 'Request a moto ride in one minute',
      thumbnailUrl: ['https://divoox.com/docs/video-ride-moto-in-a-minute-en.webp'],
      uploadDate: '2026-11-19',
      duration: 'PT47S',
      inLanguage: 'en',
      contentUrl: 'https://divoox.com/media/docs-video/ride-moto-in-a-minute-en-9f8e7d6c.mp4',
    });
    expect(d.transcript).toContain('Open Divoox and tap Moto.');
    expect(d).not.toHaveProperty('embedUrl');
    const conYoutube = { ...MUESTRA, en: { ...MUESTRA.en, youtube: 'abcDEF_1234' } };
    expect(datosDeVideo(conYoutube, 'en', 'https://divoox.com', 'x')).toHaveProperty(
      'embedUrl',
      'https://www.youtube-nocookie.com/embed/abcDEF_1234',
    );
  });

  it('el prerender escribe esos datos en la guía y en la página «Videos», y solo si hay videos', () => {
    const guion = readFileSync(join(RAIZ, 'apps', 'panel', 'scripts', 'prerender.mjs'), 'utf8');
    expect(guion).toContain("...(VIDEOS.length ? ['/docs/videos'] : [])");
    expect(guion).toContain(
      'videosDeGuia(videosEnIdioma(VIDEOS, idioma), `${seccion.id}/${guia.id}`)',
    );
    expect(guion).toContain("if (ruta === '/docs/videos')");
  });
});
