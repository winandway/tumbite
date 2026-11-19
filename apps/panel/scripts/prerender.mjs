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
  const { VIDEOS, datosDeVideo, videosDeGuia, videosEnIdioma } = await vite.ssrLoadModule(
    '/src/sitio/docs/videos.ts',
  );
  const { PAISES, CIUDADES, COCINAS } = await vite.ssrLoadModule('/src/sitio/cobertura.ts');
  const { PREGUNTAS_COMO_FUNCIONA } = await vite.ssrLoadModule('/src/sitio/ComoFunciona.tsx');

  // Datos estructurados (schema.org) que leen Google y los buscadores de IA.
  const ORGANIZACION = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Divoox',
    url: `${DOMINIO}/`,
    logo: `${DOMINIO}/icono-512.png`,
    email: 'soporte+divoox@windoce.com',
    description:
      'Divoox is a delivery startup: food, stores and packages in one app, with fair commissions for restaurants and 100% of the tip for the driver. It opens city by city with local franchises.',
    areaServed: 'United States',
    parentOrganization: {
      '@type': 'Organization',
      name: 'Windoce, LLC',
      url: 'https://windoce.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Novi',
        addressRegion: 'MI',
        addressCountry: 'US',
      },
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
  /**
   * C-DOCS-AL-GRANO: cada guía de Docs lleva sus datos estructurados, para que Google y los
   * buscadores de IA la lean como un tutorial: el paso a paso (HowTo) o el artículo, y su ruta.
   */
  const datosDeGuia = (ruta, lengua, canonica) => {
    const idioma = lengua === 'es' ? 'es' : 'en';
    // C-DOCS-VIDEO: la página «Videos» lleva los datos de todos sus videos.
    if (ruta === '/docs/videos')
      return videosEnIdioma(VIDEOS, idioma).map((v) =>
        datosDeVideo(v, idioma, DOMINIO, `${canonica}#${v.id}`),
      );
    const m = /^\/docs\/([a-z-]+)\/([a-z0-9-]+)$/.exec(ruta);
    if (!m) return [];
    const seccion = DOCS[lengua === 'es' ? 'es' : 'en'].find((s) => s.id === m[1]);
    const guia = seccion?.guias.find((g) => g.id === m[2]);
    if (!seccion || !guia) return [];
    const pre = lengua === 'es' ? '/es' : '';
    const imagenes = (guia.capturas ?? []).map((c) => `${DOMINIO}${c.src}`);
    const comun = {
      '@context': 'https://schema.org',
      name: guia.titulo,
      description: guia.resumen,
      inLanguage: lengua,
      url: canonica,
      ...(imagenes.length ? { image: imagenes } : {}),
      publisher: { '@type': 'Organization', name: 'Divoox', url: `${DOMINIO}/` },
    };
    return [
      guia.pasos.length
        ? {
            ...comun,
            '@type': 'HowTo',
            step: guia.pasos.map((p, i) => ({ '@type': 'HowToStep', position: i + 1, text: p })),
          }
        : { ...comun, '@type': 'Article', headline: guia.titulo },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Docs', item: `${DOMINIO}${pre}/docs` },
          {
            '@type': 'ListItem',
            position: 2,
            name: seccion.titulo,
            item: `${DOMINIO}${pre}/docs/${seccion.id}`,
          },
          { '@type': 'ListItem', position: 3, name: guia.titulo, item: canonica },
        ],
      },
      // C-DOCS-VIDEO: los videos de la guía, para que Google los muestre con su portada.
      ...videosDeGuia(videosEnIdioma(VIDEOS, idioma), `${seccion.id}/${guia.id}`).map((v) =>
        datosDeVideo(v, idioma, DOMINIO, canonica),
      ),
      // C-DOCS-SEO: las preguntas que la guía responde, con su respuesta (el resumen y los pasos).
      ...(guia.preguntas?.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: guia.preguntas.map((q) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: [guia.resumen, ...guia.pasos.map((x, i) => `${i + 1}. ${x}`)].join(' '),
                  url: canonica,
                },
              })),
            },
          ]
        : []),
    ];
  };
  const paginas = [];

  const rutas = [
    '/',
    '/how-it-works',
    '/calculator',
    '/franchise',
    '/flex',
    '/download',
    '/track',
    '/privacy',
    '/terms',
    '/restaurant-terms',
    '/driver-terms',
    '/delete-account',
    '/support',
    '/sms-consent',
    '/contact',
    '/register-line',
    '/docs',
    '/docs/how-to',
    // C-DOCS-VIDEO: la página «Videos» solo existe (y solo entra al mapa del sitio) si hay videos.
    ...(VIDEOS.length ? ['/docs/videos'] : []),
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
      // C-DOCS-VIDEO: la página «Videos» de un idioma existe solo si hay videos en ese idioma.
      if (ruta === '/docs/videos' && !videosEnIdioma(VIDEOS, lengua).length) continue;
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
            ? 'Divoox · Food, stores and packages delivered'
            : 'Divoox · Comida, tiendas y paquetes a domicilio'
          : /divoox/i.test(h1)
            ? h1
            : `${h1} · Divoox`;
      const descripcion = (
        parrafo ||
        (lengua === 'en'
          ? 'Divoox: great food, right to your door.'
          : 'Divoox: comida rica, hasta tu puerta.')
      ).slice(0, 155);
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      // C-SEO-DESCRIPCION (18 nov 2026): cada reemplazo de la cabecera TIENE que aplicarse. Durante
      // semanas la descripción no se cambiaba (la plantilla la trae en varias líneas) y todas las
      // páginas salían con la misma descripción genérica en inglés, sin que nada avisara.
      const cabecera = (texto, patron, valor, nombre) => {
        if (!patron.test(texto))
          throw new Error(`prerender: no se pudo poner «${nombre}» en la cabecera de ${url}`);
        return texto.replace(patron, () => valor);
      };
      const canonica = `${DOMINIO}${url === '/' ? '/' : url}`;
      let pagina = plantilla;
      for (const [patron, valor, nombre] of [
        [/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`, 'title'],
        [
          /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
          `<meta name="description" content="${esc(descripcion)}" />`,
          'description',
        ],
        [
          /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
          `<meta property="og:title" content="${esc(titulo)}" />`,
          'og:title',
        ],
        [
          /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
          `<meta property="og:description" content="${esc(descripcion)}" />`,
          'og:description',
        ],
        [
          /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
          `<meta property="og:url" content="${canonica}" />`,
          'og:url',
        ],
        [
          /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
          `<link rel="canonical" href="${canonica}" />`,
          'canonical',
        ],
        [
          /<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/,
          `<meta property="og:type" content="${/^\/docs\/[a-z-]+\/[a-z0-9-]+$/.test(ruta) ? 'article' : 'website'}" />`,
          'og:type',
        ],
        [/<html lang="[a-z]+">/, `<html lang="${lengua}">`, 'lang'],
      ])
        pagina = cabecera(pagina, patron, valor, nombre);
      pagina = pagina
        // Aunque la plantilla ya traiga contenido (corrida repetida), se reemplaza entero.
        .replace(
          /<div id="raiz">[\s\S]*?<\/div>(?=\s*<\/body>)/,
          () => `<div id="raiz">${html}</div>`,
        )
        .replace(
          '</head>',
          () =>
            // La página «Videos» solo en español no anuncia una versión en inglés que no existe.
            (ruta === '/docs/videos' && !videosEnIdioma(VIDEOS, 'en').length
              ? `<link rel="alternate" hreflang="es" href="${DOMINIO}${enEspanol(ruta)}" />`
              : `<link rel="alternate" hreflang="en" href="${DOMINIO}${ruta === '/' ? '/' : ruta}" />` +
                `<link rel="alternate" hreflang="es" href="${DOMINIO}${enEspanol(ruta)}" />` +
                `<link rel="alternate" hreflang="x-default" href="${DOMINIO}${ruta === '/' ? '/' : ruta}" />`) +
            [...datosDe(ruta, lengua), ...datosDeGuia(ruta, lengua, canonica)]
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

> Divoox is a delivery startup by Windoce, LLC, a Delaware company with offices in Novi, Michigan (United States). It connects customers, local restaurants, and drivers: restaurants pay a 7.5% to 15% commission depending on their plan, with no lock-in contracts; drivers keep 100% of the tip and see what they earn before accepting; customers see the full breakdown before paying and follow their order live. Every paid order is watched by an automatic Manager that reminds the restaurant and refunds the customer if nobody confirms within 10 minutes. It opens city by city, in any country, with local franchises that fund the launch (a fleet of motorbikes, training, a tablet for every restaurant, and finding the first customers). The app is bilingual (English and Spanish). Contact: https://divoox.com/contact.

${grupo('Main pages', (r) => r === '/' || r === '/how-it-works')}
${grupo('Guides (Docs)', (r) => r.startsWith('/docs'))}
${grupo('Countries', (r) => r.startsWith('/country/'))}
${grupo('Cities', (r) => r.startsWith('/city/'))}
${grupo('Food types', (r) => r.startsWith('/food/'))}
${grupo('Legal and support', (r) => /^\/(privacy|terms|restaurant-terms|driver-terms|delete-account|support|sms-consent|contact)$/.test(r))}
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
