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
  const { PREGUNTAS_COMO_FUNCIONA } = await vite.ssrLoadModule('/src/sitio/ComoFunciona.tsx');

  // Datos estructurados (schema.org) que leen Google y los buscadores de IA.
  const ORGANIZACION = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Tumbite',
    url: `${DOMINIO}/`,
    logo: `${DOMINIO}/marca/logo.webp`,
    email: 'support@tumbite.com',
    description:
      'Tumbite es una app de comida a domicilio con comisiones justas para los restaurantes y el 100 % de la propina para el repartidor. Empieza en Miami y abre ciudad por ciudad con franquicias locales.',
    areaServed: 'Miami, Florida, United States',
    parentOrganization: {
      '@type': 'Organization',
      name: 'Windoce LLC',
      url: 'https://windoce.com',
    },
  };
  const SITIO_WEB = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Tumbite',
    url: `${DOMINIO}/`,
    inLanguage: ['es', 'en'],
  };
  const datosDe = (ruta) =>
    ruta === '/'
      ? [ORGANIZACION, SITIO_WEB]
      : ruta === '/como-funciona'
        ? [
            ORGANIZACION,
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: PREGUNTAS_COMO_FUNCIONA.es.map(([q, a]) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a },
              })),
            },
          ]
        : [];
  const paginas = [];

  const rutas = [
    '/',
    '/como-funciona',
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
      .replace('<html lang="en">', '<html lang="es">')
      .replace(
        '</head>',
        () =>
          datosDe(ruta)
            .map(
              (d) =>
                `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`,
            )
            .join('') + '</head>',
      );
    paginas.push({ ruta, titulo, descripcion });
    // Se escribe «ruta.html» (no «ruta/index.html»): así el servidor de estáticos sirve /pais/colombia
    // tal cual, sin redirigir a /pais/colombia/ (una barra de más rompe la canónica y el SEO).
    const destino = ruta === '/' ? join(dist, 'index.html') : join(dist, `${ruta}.html`);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, pagina);
    n++;
  }
  console.log(`prerender: ${n} páginas públicas escritas en dist/`);

  // Mapa del sitio: sale de la misma lista de páginas (nunca más a mano ni desactualizado).
  const hoy = new Date().toISOString().slice(0, 10);
  const prioridad = (r) =>
    r === '/'
      ? '1.0'
      : r === '/como-funciona'
        ? '0.9'
        : r.startsWith('/docs')
          ? '0.7'
          : /^\/(pais|ciudad|comida)\//.test(r)
            ? '0.6'
            : '0.3';
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map((p) => `  <url><loc>${DOMINIO}${p.ruta === '/' ? '/' : p.ruta}</loc><lastmod>${hoy}</lastmod><priority>${prioridad(p.ruta)}</priority></url>`).join('\n')}
</urlset>
`;
  writeFileSync(join(dist, 'sitemap.xml'), sitemap);

  // llms.txt: el resumen para los buscadores y asistentes de IA (formato llmstxt.org).
  const grupo = (titulo, filtro) => {
    const xs = paginas.filter((p) => filtro(p.ruta));
    return xs.length
      ? `## ${titulo}\n\n${xs.map((p) => `- [${p.titulo}](${DOMINIO}${p.ruta === '/' ? '/' : p.ruta}): ${p.descripcion}`).join('\n')}\n`
      : '';
  };
  const llms = `# Tumbite

> Tumbite es una app de comida a domicilio de Windoce LLC (Florida, Estados Unidos). Conecta a clientes, restaurantes locales y repartidores: los restaurantes pagan entre 7,5 % y 15 % de comisión según su plan, sin contratos de permanencia; el repartidor se queda con el 100 % de la propina y ve cuánto gana antes de aceptar; el cliente ve el desglose completo antes de pagar y sigue su pedido en vivo. Empieza en Miami y abre ciudad por ciudad, en cualquier país, con franquicias locales que financian el arranque (flota de motos, entrenamiento, una tablet para cada restaurante y la búsqueda de los primeros clientes). La app es bilingüe (español e inglés). Contacto: support@tumbite.com · franquicias: sales@tumbite.com.

${grupo('Lo principal', (r) => r === '/' || r === '/como-funciona')}
${grupo('Guías (Docs)', (r) => r.startsWith('/docs'))}
${grupo('Países', (r) => r.startsWith('/pais/'))}
${grupo('Ciudades', (r) => r.startsWith('/ciudad/'))}
${grupo('Tipos de comida', (r) => r.startsWith('/comida/'))}
${grupo('Legal y soporte', (r) => /^\/(privacidad|terminos|borrar-cuenta|soporte)/.test(r))}`;
  writeFileSync(join(dist, 'llms.txt'), llms);
  console.log(`prerender: sitemap.xml y llms.txt con ${paginas.length} páginas`);
} finally {
  await vite.close();
}
