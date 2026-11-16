import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-DOCS-LUPA y C-DOCS-BUSCADOR-MOTOR (15 nov 2026): la guía pública de cómo buscar en Docs y cómo
 * ampliar una captura. Va al final de «Tu cuenta». Capturas reales tomadas con
 * `scripts/docs/capturas-buscar-lupa.mjs`: en español con El Vigía; en inglés con Novi, Michigan
 * (C-CAPTURAS-POR-IDIOMA).
 */
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/docs-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_DOCS: Record<Idioma, Guia[]> = {
  es: [
    {
      id: 'search-docs-and-zoom',
      titulo: 'Buscar en Docs y ampliar una captura para leerla bien',
      resumen:
        'Escribe lo que buscas y Docs te sugiere las guías desde la primera letra, aunque lo escribas en inglés o con un error. Toca cualquier captura para verla en grande y acercarla.',
      explicacion: [
        'El buscador está arriba de todas las páginas de Docs. Mientras escribes, se abre una lista con las guías que coinciden, la más útil primero, y la palabra que buscaste resaltada en cada título.',
        'Busca como hablas: sin acentos, con mayúsculas o sin ellas, con un error de escritura («biletera») o con la palabra en inglés que usa mucha gente («wallet», «tracking», «top up»). Docs entiende las dos lenguas y encuentra la guía igual.',
        'Cada captura de una guía se puede ampliar. Al tocarla se abre a pantalla completa, con su explicación debajo. En la computadora acercas con «+» y «−» o con la rueda del ratón; en el celular, con dos dedos o tocando dos veces. Para moverte por la imagen ampliada, arrástrala.',
      ],
      capturas: [
        foto(
          'buscar',
          'es',
          'El buscador de Docs con la lista de guías que coinciden con «wallet».',
          'Escribes «wallet» y Docs te muestra las guías de la billetera.',
        ),
        foto(
          'lupa-boton',
          'es',
          'Una captura de una guía de Moto con el botón de la lupa en la esquina.',
          'Cada captura lleva una lupa: tócala para verla en grande.',
        ),
        foto(
          'lupa-abierta',
          'es',
          'La captura abierta a pantalla completa, con su explicación y los botones para acercar y alejar.',
          'La captura en grande, con su explicación debajo.',
        ),
        foto(
          'lupa-zoom',
          'es',
          'La captura ampliada, con los datos del conductor y del pago móvil fáciles de leer.',
          'Acercada para leer cada detalle.',
        ),
      ],
      preguntas: [
        '¿Cómo busco una guía en Docs?',
        '¿Puedo buscar una palabra en inglés, como «wallet» o «tracking»?',
        '¿Cómo veo una captura más grande?',
        '¿Cómo acerco una imagen en el celular?',
      ],
      pasos: [
        'Toca el buscador de arriba (en la computadora también se abre con ⌘K o Ctrl+K).',
        'Escribe lo que buscas. Desde la primera letra ves la lista de guías que coinciden.',
        'Baja con las flechas y abre la guía con Enter, o tócala con el dedo o el ratón.',
        'En la guía, toca una captura para abrirla en grande.',
        'Acerca con «+», la rueda del ratón, dos dedos o un doble toque, y arrastra para moverte.',
        'Pasa a la captura siguiente con las flechas o deslizando, y cierra con la X, con Escape o tocando afuera.',
      ],
    },
  ],
  en: [
    {
      id: 'search-docs-and-zoom',
      titulo: 'Search Docs and enlarge a screenshot to read it clearly',
      resumen:
        'Start typing and Docs suggests guides from the first letter, even if you type in Spanish or make a typo. Tap any screenshot to see it full screen and zoom in.',
      explicacion: [
        'The search box sits at the top of every Docs page. As you type, a list of matching guides opens, best match first, with your search word highlighted in each title.',
        'Search the way you talk: accents and capital letters don’t matter, a typo (“walet”) still works, and so does the Spanish word many people use (“billetera”, “rastreo”, “recargar”). Docs understands both languages and finds the guide either way.',
        'Every screenshot in a guide can be enlarged. Tap it and it opens full screen, with its caption below. On a computer, zoom with “+” and “−” or your mouse wheel; on a phone, pinch with two fingers or double-tap. Drag to move around the enlarged image.',
      ],
      capturas: [
        foto(
          'buscar',
          'en',
          'Docs search showing the guides that match “billetera”.',
          'Type “billetera” and Docs shows the wallet guides.',
        ),
        foto(
          'lupa-boton',
          'en',
          'A screenshot in a Moto guide with the magnifier button in the corner.',
          'Every screenshot has a magnifier: tap it to see it full size.',
        ),
        foto(
          'lupa-abierta',
          'en',
          'The screenshot open full screen, with its caption and the zoom in and zoom out buttons.',
          'The screenshot full size, with its caption below.',
        ),
        foto(
          'lupa-zoom',
          'en',
          'The screenshot zoomed in, with the ride details easy to read.',
          'Zoomed in to read every detail.',
        ),
      ],
      preguntas: [
        'How do I search for a guide in Docs?',
        'Can I search in Spanish, like “billetera” or “rastreo”?',
        'How do I see a screenshot bigger?',
        'How do I zoom into an image on my phone?',
      ],
      pasos: [
        'Tap the search box at the top (on a computer you can also press ⌘K or Ctrl+K).',
        'Type what you’re looking for. From the first letter you see the matching guides.',
        'Move with the arrow keys and press Enter to open a guide, or tap or click it.',
        'In the guide, tap a screenshot to open it full screen.',
        'Zoom in with “+”, your mouse wheel, two fingers, or a double-tap, and drag to move around.',
        'Go to the next screenshot with the arrows or by swiping, and close with the X, Escape, or by tapping outside it.',
      ],
    },
  ],
};
