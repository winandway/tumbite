// Prerrenderiza las páginas públicas a HTML estático después de `vite build`, para que Google
// (y cualquiera sin JavaScript) reciba el contenido armado: landing, legales, Docs, países,
// ciudades y comidas. La app sigue siendo la misma: al cargar, React toma el control.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const plantilla = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/<div id="raiz">[\s\S]*?<\/div>\s*<\/body>/.test(plantilla))
  throw new Error('prerender: no encuentro el #raiz seguido de </body> en dist/index.html');
const DOMINIO = 'https://tumbite.com';

// Un navegador de mentira para que los módulos encuentren window, document y localStorage.
const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', {
  url: `${DOMINIO}/`,
  pretendToBeVisual: true,
});
// Con getters: al cambiar la dirección, jsdom recrea algunas piezas y los globales deben seguirlas.
for (const k of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Node']) {
  Object.defineProperty(globalThis, k, { get: () => dom.window[k], configurable: true });
}
// Español por defecto: es el idioma que Google indexa; el visitante en inglés cambia al cargar.
Object.defineProperty(dom.window.navigator, 'language', { get: () => 'es', configurable: true });

const vite = await createServer({
  root: raiz,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { App } = await vite.ssrLoadModule('/src/App.tsx');
  const { DOCS } = await vite.ssrLoadModule('/src/sitio/docs/guias.ts');
  const { PAISES, CIUDADES, COCINAS } = await vite.ssrLoadModule('/src/sitio/cobertura.ts');

  const rutas = [
    '/',
    '/privacidad',
    '/terminos',
    '/terminos-restaurantes',
    '/terminos-repartidores',
    '/borrar-cuenta',
    '/soporte',
    '/docs',
    ...DOCS.es.flatMap((s) => [`/docs/${s.id}`, ...s.guias.map((g) => `/docs/${s.id}/${g.id}`)]),
    ...PAISES.map((p) => `/pais/${p.slug}`),
    ...CIUDADES.map((c) => `/ciudad/${c.slug}`),
    ...COCINAS.map((c) => `/comida/${c.slug}`),
  ];

  let n = 0;
  for (const ruta of rutas) {
    dom.reconfigure({ url: `${DOMINIO}${ruta}` });
    // Se prerrenderiza en español (el idioma por defecto); el visitante en inglés cambia al cargar.
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem('tumbite.idioma', 'es');
    const html = renderToString(React.createElement(App));
    // Título y descripción propios de cada página (si no, Google ve 50 páginas iguales).
    const limpiar = (t) =>
      t
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const h1 = limpiar(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
    const parrafo = limpiar(
      (ruta === '/'
        ? html.match(/<div class="ld-hero-texto">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1]
        : null) ??
        html.match(
          /<p class="(?:ld-entrada|docs-resumen|docs-sub|legal-intro)"[^>]*>([\s\S]*?)<\/p>/,
        )?.[1] ??
        html.match(/<main[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ??
        '',
    );
    const titulo =
      ruta === '/'
        ? 'Tumbite · Comida a domicilio en Miami'
        : /tumbite/i.test(h1)
          ? h1
          : `${h1} · Tumbite`;
    const descripcion = (parrafo || 'Tumbite: comida rica, con ritmo, hasta tu puerta.').slice(
      0,
      155,
    );
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const pagina = plantilla
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`)
      .replace(
        /<meta name="description" content="[^"]*" \/>/,
        `<meta name="description" content="${esc(descripcion)}" />`,
      )
      .replace(
        /<meta property="og:title" content="[^"]*" \/>/,
        `<meta property="og:title" content="${esc(titulo)}" />`,
      )
      .replace(
        /<meta property="og:url" content="[^"]*" \/>/,
        `<meta property="og:url" content="${DOMINIO}${ruta === '/' ? '/' : ruta}" />`,
      )
      // Aunque la plantilla ya traiga contenido (corrida repetida), se reemplaza entero.
      .replace(
        /<div id="raiz">[\s\S]*?<\/div>(?=\s*<\/body>)/,
        () => `<div id="raiz">${html}</div>`,
      )
      .replace(
        /<link rel="canonical" href="[^"]*" \/>/,
        `<link rel="canonical" href="${DOMINIO}${ruta === '/' ? '/' : ruta}" />`,
      )
      .replace('<html lang="en">', '<html lang="es">');
    // Se escribe «ruta.html» (no «ruta/index.html»): así el servidor de estáticos sirve /pais/colombia
    // tal cual, sin redirigir a /pais/colombia/ (una barra de más rompe la canónica y el SEO).
    const destino = ruta === '/' ? join(dist, 'index.html') : join(dist, `${ruta}.html`);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, pagina);
    n++;
  }
  console.log(`prerender: ${n} páginas públicas escritas en dist/`);
} finally {
  await vite.close();
}
