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
import { barraLigera } from './barraLigera.mjs';

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
  const { PAISES_ABIERTOS_PUBLICADOS, CIUDADES_ABIERTAS_PUBLICADAS, estadoDePais, estadoDeCiudad } =
    await vite.ssrLoadModule('/src/sitio/paisesAbiertos.ts');
  const { TARIFAS_PUBLICADAS } = await vite.ssrLoadModule('/src/sitio/tarifasCiudades.ts');
  const { RUTAS_TARIFAS } = await vite.ssrLoadModule('/src/sitio/CiudadPublica.tsx');
  const { preguntasPais, preguntasTarifas, paisDeCiudad } = await vite.ssrLoadModule(
    '/src/sitio/ciudadesPublicas.ts',
  );
  const { nombreGrupo } = await vite.ssrLoadModule('/src/sitio/tarifasCiudades.ts');
  // C-PAIS-ABIERTO-SIN-PRONTO: las páginas de los países abiertos (según producción al compilar).
  const paisesAbiertos = new Set(
    PAISES.filter((p) => estadoDePais(p, PAISES_ABIERTOS_PUBLICADOS).abierto).map(
      (p) => `/country/${p.slug}`,
    ),
  );
  const paginasConPronto = [];
  // C-CIUDAD-ABIERTA-SIN-PRONTO: las ciudades con clave (Venezuela) y su página de precios: ninguna
  // dice «muy pronto», y la que no tiene servicio abierto no afirma que ya funcione.
  const ciudadesConClave = new Map(
    CIUDADES.filter((c) => c.clave).map((c) => {
      const pais = paisDeCiudad(c);
      return [
        `/city/${c.slug}`,
        { c, pais, ...estadoDeCiudad(c, pais?.codigo, CIUDADES_ABIERTAS_PUBLICADAS) },
      ];
    }),
  );
  const ciudadesQueAfirman = [];

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
    // C-CIUDAD-ABIERTA-SIN-PRONTO: los países donde hay algo abierto (según producción al publicar).
    areaServed: [
      'United States',
      ...PAISES.filter((p) => estadoDePais(p, PAISES_ABIERTOS_PUBLICADOS).abierto).map(
        (p) => p.nombre.en,
      ),
    ],
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
  const PROVEEDOR = { '@type': 'Organization', name: 'Divoox', url: `${DOMINIO}/` };
  const migas = (lengua, items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, ruta], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${DOMINIO}${lengua === 'es' ? (ruta === '/' ? '/es' : `/es${ruta}`) : ruta}`,
    })),
  });
  const preguntasLd = (xs, canonica) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: xs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a, url: canonica },
    })),
  });
  const lugarLd = (c, pais) => ({
    '@type': 'City',
    name: c.nombre.es,
    ...(c.estadoRegion
      ? {
          containedInPlace: {
            '@type': 'State',
            name: c.estadoRegion,
            ...(pais ? { containedInPlace: { '@type': 'Country', name: pais.nombre.en } } : {}),
          },
        }
      : {}),
  });
  const nombreServicio = (lista, lengua) =>
    lista.map((s) => (lengua === 'es' ? s.es : s.en)).join(', ');
  /**
   * C-CIUDAD-ABIERTA-SIN-PRONTO y C-TARIFAS-PUBLICAS: los datos estructurados de la página de un país
   * abierto (organización, servicio, preguntas y migas), de una ciudad con clave (el servicio solo si
   * está abierta) y de la página de precios (el catálogo de ofertas con el precio que paga el pasajero).
   */
  const datosVenezuela = (ruta, lengua, canonica) => {
    const idioma = lengua === 'es' ? 'es' : 'en';
    const mPais = /^\/country\/([a-z-]+)$/.exec(ruta);
    if (mPais) {
      const p = PAISES.find((x) => x.slug === mPais[1]);
      const ep = p ? estadoDePais(p, PAISES_ABIERTOS_PUBLICADOS) : null;
      if (!p || !ep?.abierto) return [];
      const abiertas = CIUDADES.filter(
        (c) =>
          c.pais === p.slug &&
          c.clave &&
          estadoDeCiudad(c, p.codigo, CIUDADES_ABIERTAS_PUBLICADAS).abierta,
      );
      return [
        {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: idioma === 'es' ? `Divoox en ${p.nombre.es}` : `Divoox in ${p.nombre.en}`,
          serviceType: nombreServicio(ep.servicios, idioma),
          provider: PROVEEDOR,
          areaServed: abiertas.length
            ? abiertas.map((c) => lugarLd(c, p))
            : { '@type': 'Country', name: p.nombre.en },
          url: canonica,
        },
        preguntasLd(
          preguntasPais(p, idioma, {
            ciudades: CIUDADES_ABIERTAS_PUBLICADAS,
            tarifas: TARIFAS_PUBLICADAS,
          }),
          canonica,
        ),
        migas(lengua, [
          ['Divoox', '/'],
          [p.nombre[idioma], ruta],
        ]),
      ];
    }
    const mTarifas = /^\/city\/([a-z-]+)\/prices$/.exec(ruta);
    const mCiudad = /^\/city\/([a-z-]+)$/.exec(ruta);
    const c = CIUDADES.find((x) => x.slug === (mTarifas?.[1] ?? mCiudad?.[1]) && x.clave);
    if (!c) return [];
    const info = ciudadesConClave.get(`/city/${c.slug}`);
    const pais = info?.pais;
    const base = [
      ['Divoox', '/'],
      ...(pais ? [[pais.nombre[idioma], `/country/${pais.slug}`]] : []),
      [c.nombre[idioma], `/city/${c.slug}`],
    ];
    if (mCiudad)
      return [
        ...(info?.abierta
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'Service',
                name: idioma === 'es' ? `Divoox en ${c.nombre.es}` : `Divoox in ${c.nombre.en}`,
                serviceType: nombreServicio(info.servicios, idioma),
                provider: PROVEEDOR,
                areaServed: lugarLd(c, pais),
                url: canonica,
              },
            ]
          : []),
        migas(lengua, base),
      ];
    const t = c.clave ? TARIFAS_PUBLICADAS[c.clave] : null;
    if (!t) return [migas(lengua, base)];
    const dinero = (centavos) => (centavos / 100).toFixed(2);
    const desde = t.centro ?? c.nombre.es;
    const ofertas = t.grupos.flatMap((g) =>
      g.lugares
        .filter((l) => l.ida)
        .map((l) => ({
          '@type': 'Offer',
          name: `${desde} → ${l.lugar}`,
          category: nombreGrupo(g.grupo, idioma),
          price: dinero(l.ida.dia),
          priceCurrency: t.moneda,
          itemOffered: {
            '@type': 'Service',
            name:
              idioma === 'es'
                ? `Mototaxi de ${desde} a ${l.lugar}`
                : `Moto taxi from ${desde} to ${l.lugar}`,
          },
        })),
    );
    const titulo =
      idioma === 'es'
        ? `Tarifas de mototaxi en ${c.nombre.es}`
        : `Moto taxi fares in ${c.nombre.en}`;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: titulo,
        serviceType: idioma === 'es' ? 'Mototaxi' : 'Moto taxi',
        provider: PROVEEDOR,
        areaServed: lugarLd(c, pais),
        url: canonica,
        hasOfferCatalog: { '@type': 'OfferCatalog', name: titulo, itemListElement: ofertas },
      },
      preguntasLd(preguntasTarifas(c, t, idioma), canonica),
      migas(lengua, [...base, [titulo, ruta]]),
    ];
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
    '/promo-terms',
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
    // C-TARIFAS-PUBLICAS: la página de precios de cada ciudad que los tiene publicados.
    ...RUTAS_TARIFAS(),
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
      // C-BARRA-LIGERA: la barra de Docs no repite todas las guías en cada página prearmada.
      const html = barraLigera(renderToString(React.createElement(App)));
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
            [
              ...datosDe(ruta, lengua),
              ...datosDeGuia(ruta, lengua, canonica),
              ...datosVenezuela(ruta, lengua, canonica),
            ]
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
      // Candado C-PAIS-ABIERTO-SIN-PRONTO: un país abierto no puede salir con «muy pronto» en su
      // título, su descripción, su tarjeta social ni su contenido (el lema del desfile incluido).
      if (paisesAbiertos.has(ruta)) {
        const cabeza = pagina.slice(0, pagina.indexOf('</head>'));
        const metas = [...cabeza.matchAll(/<(?:title|meta)[^>]*>(?:[^<]*<\/title>)?/g)].join(' ');
        // Hasta el final del contenido: el pie lista aparte las ciudades que todavía no abren.
        const cuerpo = html.slice(0, html.indexOf('</main>'));
        if (/pronto|pr[oó]ximamente|coming soon|\bsoon\b/i.test(`${metas} ${cuerpo}`))
          paginasConPronto.push(url);
      }
      // Candado C-CIUDAD-ABIERTA-SIN-PRONTO: lo mismo para cada ciudad con clave y su página de
      // precios; y una ciudad sin servicio abierto no afirma que ya funcione.
      const ciudadRuta = ciudadesConClave.get(ruta.replace(/\/prices$/, ''));
      if (ciudadRuta) {
        const cabeza = pagina.slice(0, pagina.indexOf('</head>'));
        const metas = [...cabeza.matchAll(/<(?:title|meta)[^>]*>(?:[^<]*<\/title>)?/g)].join(' ');
        const cuerpo = html.slice(0, html.indexOf('</main>'));
        if (/pronto|pr[oó]ximamente|coming soon|\bsoon\b/i.test(`${metas} ${cuerpo}`))
          paginasConPronto.push(url);
        if (
          !ciudadRuta.abierta &&
          /ya funciona|now live|ya disponible|now available|ya estamos en|now in /i.test(
            `${metas} ${cuerpo.replace(/<p class="lugar-donde-hoy"[\s\S]*?<\/p>/, '')}`,
          )
        )
          ciudadesQueAfirman.push(url);
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
  if (ciudadesQueAfirman.length)
    throw new Error(
      `Una ciudad sin servicio abierto dice que ya funciona (C-CIUDAD-ABIERTA-SIN-PRONTO):\n${ciudadesQueAfirman.join('\n')}`,
    );
  if (paginasConPronto.length)
    throw new Error(
      `Un país abierto sale con «muy pronto» (C-PAIS-ABIERTO-SIN-PRONTO):\n${paginasConPronto.join('\n')}`,
    );
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
          : /^\/city\/[a-z-]+\/prices$/.test(r)
            ? '0.8'
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

${(() => {
  // C-CIUDAD-ABIERTA-SIN-PRONTO: dónde funciona hoy, según producción al publicar (sin «pronto»).
  const lineas = PAISES.filter((p) => estadoDePais(p, PAISES_ABIERTOS_PUBLICADOS).abierto).map(
    (p) => {
      const cs = [...ciudadesConClave.values()].filter((x) => x.pais?.slug === p.slug && x.abierta);
      const servicios = estadoDePais(p, PAISES_ABIERTOS_PUBLICADOS)
        .servicios.map((s) => s.en)
        .join(', ');
      return `- Live today in ${p.nombre.en}${cs.length ? ` (${cs.map((x) => x.c.nombre.en).join(', ')})` : ''}: ${servicios}. ${DOMINIO}/country/${p.slug}`;
    },
  );
  return lineas.length ? `## Where Divoox is live\n\n${lineas.join('\n')}\n` : '';
})()}
${grupo('Main pages', (r) => r === '/' || r === '/how-it-works')}
${grupo('Guides (Docs)', (r) => r.startsWith('/docs'))}
${grupo('Countries', (r) => r.startsWith('/country/'))}
${grupo('Cities', (r) => /^\/city\/[a-z-]+$/.test(r))}
${grupo('Fares', (r) => /^\/city\/[a-z-]+\/prices$/.test(r))}
${grupo('Food types', (r) => r.startsWith('/food/'))}
${grupo('Legal and support', (r) => /^\/(privacy|terms|restaurant-terms|driver-terms|promo-terms|delete-account|support|sms-consent|contact)$/.test(r))}
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
