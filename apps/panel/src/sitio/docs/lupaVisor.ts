import PhotoSwipe, { type SlideData } from 'photoswipe';
import 'photoswipe/style.css';
import type { Idioma } from '@tumbite/compartido';
import type { Captura } from './guias';
import MEDIDAS from './capturasMedidas.json';

/**
 * El visor de la lupa (C-DOCS-LUPA, 15 nov 2026). Este archivo, PhotoSwipe (código libre, MIT) y
 * las medidas de las capturas solo se bajan la primera vez que alguien toca una captura: la página
 * de la guía no pesa más al cargar.
 *
 * Como en la documentación de los grandes: la imagen al máximo, su pie debajo, «+» y «−», rueda del
 * ratón, pellizco y doble toque en el celular, arrastrar para moverse, flechas entre capturas,
 * Escape o tocar afuera para cerrar, el foco queda dentro y vuelve a la captura al cerrar.
 */

const TEXTOS = {
  es: {
    titulo: 'Captura ampliada',
    cerrar: 'Cerrar (Esc)',
    zoom: 'Acercar o alejar',
    acercar: 'Acercar',
    alejar: 'Alejar',
    anterior: 'Captura anterior',
    siguiente: 'Captura siguiente',
    de: ' de ',
    error: 'No pudimos abrir esta imagen.',
  },
  en: {
    titulo: 'Enlarged screenshot',
    cerrar: 'Close (Esc)',
    zoom: 'Zoom in or out',
    acercar: 'Zoom in',
    alejar: 'Zoom out',
    anterior: 'Previous screenshot',
    siguiente: 'Next screenshot',
    de: ' of ',
    error: 'We couldn’t open this image.',
  },
} as const;

let activo: PhotoSwipe | null = null;

const medidas = new Map(Object.entries(MEDIDAS as Record<string, (number | string)[]>));

/** Lo que el visor necesita de cada captura: la versión grande si existe y sus medidas. */
export function datosDeCaptura(c: Captura): SlideData & { pie: string; liviana: SlideData } {
  const nombre = c.src.replace(/^.*\//, '').replace(/\.webp$/, '');
  const [w = 0, h = 0, gw, gh, huella] = medidas.get(nombre) ?? [];
  const liviana = { src: c.src, width: Number(w) || 1200, height: Number(h) || 800 };
  // La nítida vive en el almacén del sitio (no en el paquete), con su huella en el nombre.
  const grande =
    gw && gh && huella
      ? {
          src: `/media/docs-grande/${nombre}-${String(huella)}.webp`,
          width: Number(gw),
          height: Number(gh),
        }
      : null;
  return {
    ...(grande ?? liviana),
    liviana,
    // Mientras baja la grande se ve la liviana, que ya está en la página.
    msrc: c.src,
    alt: c.alt,
    pie: c.pie,
  };
}

const svg = (camino: string) =>
  `<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="${camino}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`;

/**
 * Abre la lupa en la captura `indice`. `botones` son los botones de las capturas de la guía: al
 * cerrar, el foco vuelve al de la captura que se estaba viendo (también si se pasó a otra).
 */
export function abrirLupa(
  capturas: Captura[],
  indice: number,
  idioma: Idioma,
  botones?: readonly HTMLElement[],
) {
  const t = idioma === 'es' ? TEXTOS.es : TEXTOS.en;
  // Nunca dos visores a la vez.
  activo?.destroy();
  const pswp = new PhotoSwipe({
    dataSource: capturas.map(datosDeCaptura),
    index: indice,
    // Tamaño: la imagen ocupa todo lo posible y deja lugar abajo para el pie.
    // (en el celular el pie ocupa dos líneas: más lugar abajo).
    paddingFn: (v) => ({ top: 56, bottom: v.x < 600 ? 104 : 76, left: 8, right: 8 }),
    bgOpacity: 1,
    wheelToZoom: true,
    // Doble toque o clic: 2,5 veces; hasta 6 veces con «+», la rueda o el pellizco.
    secondaryZoomLevel: (z) => Math.max(z.fit * 2.5, 1),
    maxZoomLevel: (z) => Math.max(z.fit * 6, 2),
    // En el celular, tocar la imagen muestra u oculta los botones; tocar afuera cierra.
    tapAction: (_punto, e) => {
      const enImagen = e.target instanceof Element && e.target.closest('.pswp__img');
      if (enImagen) pswp.element?.classList.toggle('pswp--ui-visible');
      else pswp.close();
    },
    bgClickAction: 'close',
    trapFocus: true,
    // El foco vuelve a mano (abajo): Safari no enfoca el botón al tocarlo.
    returnFocus: false,
    showHideAnimationType: 'fade',
    closeTitle: t.cerrar,
    zoomTitle: t.zoom,
    arrowPrevTitle: t.anterior,
    arrowNextTitle: t.siguiente,
    indexIndicatorSep: t.de,
    errorMsg: t.error,
  });

  const cambiarZoom = (factor: number) => {
    const s = pswp.currSlide;
    if (!s) return;
    const destino = Math.min(
      s.zoomLevels.max,
      Math.max(s.zoomLevels.initial, s.currZoomLevel * factor),
    );
    // Sin punto: PhotoSwipe acerca desde el centro de lo que se está viendo.
    s.zoomTo(destino, undefined, 250);
  };

  pswp.on('uiRegister', () => {
    pswp.ui?.registerElement({
      name: 'alejar',
      order: 8,
      isButton: true,
      title: t.alejar,
      html: svg('M9 16h14'),
      onClick: () => cambiarZoom(1 / 1.6),
    });
    pswp.ui?.registerElement({
      name: 'acercar',
      order: 9,
      isButton: true,
      title: t.acercar,
      html: svg('M9 16h14M16 9v14'),
      onClick: () => cambiarZoom(1.6),
    });
    pswp.ui?.registerElement({
      name: 'pie',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit: (el) => {
        el.setAttribute('aria-live', 'polite');
        const poner = () => {
          el.textContent = String(
            (pswp.currSlide?.data as { pie?: string } | undefined)?.pie ?? '',
          );
        };
        pswp.on('change', poner);
        poner();
      },
    });
  });
  // Si la nítida no llega (todavía no se subió al almacén), se muestra la liviana: nunca un error.
  pswp.on('loadError', ({ content }) => {
    const d = content.data as SlideData & { liviana?: SlideData };
    if (!d.liviana || d.src === d.liviana.src) return;
    console.warn('lupa: falta la captura nítida, se usa la liviana', d.src);
    Object.assign(d, d.liviana);
    pswp.refreshSlideContent(content.index);
  });
  pswp.on('firstUpdate', () => {
    pswp.element?.setAttribute('aria-label', t.titulo);
    pswp.element?.setAttribute('aria-modal', 'true');
  });
  pswp.on('bindEvents', () => {
    // Si el navegador «desplaza» el marco para mostrar un botón con el foco, la imagen quedaría
    // corrida: el marco no se desplaza nunca, el que mueve la imagen es el visor.
    const marco = pswp.scrollWrap;
    marco?.addEventListener('scroll', () => {
      marco.scrollLeft = 0;
      marco.scrollTop = 0;
    });
  });
  // El foco no sale de la lupa: Tab y Mayús+Tab dan la vuelta entre sus botones.
  const atrapar = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !pswp.element) return;
    const botones = [...pswp.element.querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.offsetParent !== null && !b.hasAttribute('disabled'),
    );
    if (!botones.length) return;
    const actual = botones.indexOf(document.activeElement as HTMLElement);
    const siguiente = e.shiftKey
      ? actual <= 0
        ? botones.length - 1
        : actual - 1
      : actual === -1 || actual === botones.length - 1
        ? 0
        : actual + 1;
    e.preventDefault();
    botones.at(siguiente)?.focus();
  };
  document.addEventListener('keydown', atrapar, true);
  pswp.on('destroy', () => {
    document.removeEventListener('keydown', atrapar, true);
    botones?.at(pswp.currIndex)?.focus({ preventScroll: false });
  });
  pswp.on('destroy', () => {
    if (activo === pswp) activo = null;
  });
  activo = pswp;
  pswp.init();
  return pswp;
}
