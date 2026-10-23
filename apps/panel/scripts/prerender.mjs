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
const DOMINIO = 'https://divoox.com';

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
    name: 'Divoox',
    url: `${DOMINIO}/`,
    logo: `${DOMINIO}/icono-512.png`,
    email: 'support@tumbite.com',
    description:
      'Divoox is a food delivery app with fair commissions for restaurants and 100% of the tip for the driver. It starts in Miami and opens city by city with local franchises.',
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
    name: 'Divoox',
    url: `${DOMINIO}/`,
    inLanguage: ['en', 'es'],
  };
  const datosDe = (ruta, lengua) =>
    ruta === '/'
      ? [ORGANIZACION, SITIO_WEB]
      : ruta === '/how-it-works'
        ? [
            ORGANIZACION,
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: PREGUNTAS_COMO_FUNCIONA[lengua === 'es' ? 'es' : 'en'].map(([q, a]) => ({
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
    '/how-it-works',
    '/calculator',
    '/privacy',
    '/terms',
    '/restaurant-terms',
    '/driver-terms',
    '/delete-account',
    '/support',
    '/docs',
    '/docs/how-to',
    ...DOCS.es.flatMap((s) => [`/docs/${s.id}`, ...s.guias.map((g) => `/docs/${s.id}/${g.id}`)]),
    ...PAISES.map((p) => `/country/${p.slug}`),
    ...CIUDADES.map((c) => `/city/${c.slug}`),
    ...COCINAS.map((c) => `/food/${c.slug}`),
  ];

  let n = 0;
  const espanolEnIngles = [];
  // Cada página sale dos veces: en inglés, el idioma principal (/country/brazil), y en español
  // (/es/country/brazil). Cada versión dice cuál es la otra (hreflang). Candado C-INGLES-PRINCIPAL.
  const enEspanol = (ruta) => (ruta === '/' ? '/es' : `/es${ruta}`);
  for (const lengua of ['en', 'es'])
    for (const ruta of rutas) {
      const url = lengua === 'es' ? enEspanol(ruta) : ruta;
      dom.reconfigure({ url: `${DOMINIO}${url}` });
      dom.window.localStorage.clear();
      dom.window.localStorage.setItem('tumbite.idioma', lengua);
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
          ? lengua === 'en'
            ? 'Divoox · Food delivery in Miami'
            : 'Divoox · Comida a domicilio en Miami'
          : /divoox/i.test(h1)
            ? h1
            : `${h1} · Divoox`;
      const descripcion = (
        parrafo ||
        (lengua === 'en'
          ? 'Divoox: great food, with rhythm, right to your door.'
          : 'Divoox: comida rica, con ritmo, hasta tu puerta.')
      ).slice(0, 155);
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
          `<meta property="og:url" content="${DOMINIO}${url === '/' ? '/' : url}" />`,
        )
        // Aunque la plantilla ya traiga contenido (corrida repetida), se reemplaza entero.
        .replace(
          /<div id="raiz">[\s\S]*?<\/div>(?=\s*<\/body>)/,
          () => `<div id="raiz">${html}</div>`,
        )
        .replace(
          /<link rel="canonical" href="[^"]*" \/>/,
          `<link rel="canonical" href="${DOMINIO}${url === '/' ? '/' : url}" />`,
        )
        .replace(/<html lang="[a-z]+">/, `<html lang="${lengua}">`)
        .replace(
          '</head>',
          () =>
            `<link rel="alternate" hreflang="en" href="${DOMINIO}${ruta === '/' ? '/' : ruta}" />` +
            `<link rel="alternate" hreflang="es" href="${DOMINIO}${enEspanol(ruta)}" />` +
            `<link rel="alternate" hreflang="x-default" href="${DOMINIO}${ruta === '/' ? '/' : ruta}" />` +
            datosDe(ruta, lengua)
              .map(
                (d) =>
                  `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`,
              )
              .join('') +
            '</head>',
        );
      // Candado C-INGLES-PRINCIPAL: una página en inglés no puede traer frases en español.
      if (lengua === 'en') {
        const palabras =
          /\b(el|la|los|las|del|para|con|tus|que|una|por|pedido|pedidos|restaurante|repartidor|comida|está|más|también|aquí|nuestro|nuestra)\b/gi;
        for (const trozo of html.replace(/<[^>]+>/g, '\n').split('\n')) {
          const t = trozo.trim();
          if (t.length > 3 && (t.match(palabras) ?? []).length >= 2)
            espanolEnIngles.push(`${url}: ${t.slice(0, 90)}`);
        }
      }
      paginas.push({ ruta: url, base: ruta, lengua, titulo, descripcion });
      // Se escribe «ruta.html» (no «ruta/index.html»): así el servidor de estáticos sirve /country/colombia
      // tal cual, sin redirigir a /country/colombia/ (una barra de más rompe la canónica y el SEO).
      const destino = url === '/' ? join(dist, 'index.html') : join(dist, `${url}.html`);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, pagina);
      n++;
    }
  console.log(`prerender: ${n} páginas públicas escritas en dist/`);
  if (espanolEnIngles.length) {
    throw new Error(
      `Hay texto en español en páginas en inglés (C-INGLES-PRINCIPAL):\n${espanolEnIngles.join('\n')}`,
    );
  }

  // Mapa del sitio: sale de la misma lista de páginas (nunca más a mano ni desactualizado).
  const hoy = new Date().toISOString().slice(0, 10);
  const prioridad = (r) =>
    r === '/'
      ? '1.0'
      : r === '/how-it-works'
        ? '0.9'
        : r.startsWith('/docs')
          ? '0.7'
          : /^\/(country|city|food)\//.test(r)
            ? '0.6'
            : '0.3';
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map((p) => `  <url><loc>${DOMINIO}${p.ruta === '/' ? '/' : p.ruta}</loc><lastmod>${hoy}</lastmod><priority>${prioridad(p.base)}</priority></url>`).join('\n')}
</urlset>
`;
  writeFileSync(join(dist, 'sitemap.xml'), sitemap);

  // llms.txt: el resumen para los buscadores y asistentes de IA (formato llmstxt.org).
  const grupo = (titulo, filtro) => {
    const xs = paginas.filter((p) => p.lengua === 'en' && filtro(p.ruta));
    return xs.length
      ? `## ${titulo}\n\n${xs.map((p) => `- [${p.titulo}](${DOMINIO}${p.ruta === '/' ? '/' : p.ruta}): ${p.descripcion}`).join('\n')}\n`
      : '';
  };
  const llms = `# Divoox

> Divoox is a food delivery app by Windoce LLC (Florida, United States). It connects customers, local restaurants, and drivers: restaurants pay a 7.5% to 15% commission depending on their plan, with no lock-in contracts; drivers keep 100% of the tip and see what they earn before accepting; customers see the full breakdown before paying and follow their order live. Every paid order is watched by an automatic Manager that reminds the restaurant and refunds the customer if nobody confirms within 10 minutes. It starts in Miami and opens city by city, in any country, with local franchises that fund the launch (a fleet of motorbikes, training, a tablet for every restaurant, and finding the first customers). The app is bilingual (English and Spanish). Contact: support@tumbite.com · franchises: sales@tumbite.com.

${grupo('Main pages', (r) => r === '/' || r === '/how-it-works')}
${grupo('Guides (Docs)', (r) => r.startsWith('/docs'))}
${grupo('Countries', (r) => r.startsWith('/country/'))}
${grupo('Cities', (r) => r.startsWith('/city/'))}
${grupo('Food types', (r) => r.startsWith('/food/'))}
${grupo('Legal and support', (r) => /^\/(privacy|terms|restaurant-terms|driver-terms|delete-account|support)$/.test(r))}
## En español

Every page above also exists in Spanish under ${DOMINIO}/es (for example ${DOMINIO}/es/how-it-works).
${paginas
  .filter((p) => p.lengua === 'es' && (p.base === '/' || p.base === '/how-it-works'))
  .map((p) => `- [${p.titulo}](${DOMINIO}${p.ruta}): ${p.descripcion}`)
  .join('\n')}
`;
  writeFileSync(join(dist, 'llms.txt'), llms);
  console.log(`prerender: sitemap.xml y llms.txt con ${paginas.length} páginas`);
} finally {
  await vite.close();
}
