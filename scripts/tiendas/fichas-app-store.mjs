// Fichas de la App Store (30 oct 2026): carga en App Store Connect, con la llave de la API guardada
// en ~/.config/tumbite/apple-asc, los textos de las tres apps (los mismos de Google Play), el
// subtítulo, los enlaces legales, la categoría, la clasificación por edad, el copyright y los datos
// para el revisor de Apple. Uso: node scripts/tiendas/fichas-app-store.mjs
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { asc, token } from './asc.mjs';

const FICHAS = JSON.parse(fs.readFileSync('scripts/tiendas/fichas-google-play.json', 'utf8'));
const REVISORES = fs
  .readFileSync(join(os.homedir(), '.config', 'tumbite', 'revisores-tiendas'), 'utf8')
  .split('\n')
  .filter((l) => l.includes('\t'))
  .map((l) => l.split('\t'));
const APPS = [
  {
    id: '6829108108',
    paquete: 'com.windoce.tumbite',
    rol: 'cliente',
    categoria: 'FOOD_AND_DRINK',
    segunda: 'SHOPPING',
  },
  {
    id: '6829108327',
    paquete: 'com.windoce.tumbite.driver',
    rol: 'repartidor',
    categoria: 'BUSINESS',
    segunda: 'NAVIGATION',
  },
  {
    id: '6829108322',
    paquete: 'com.windoce.tumbite.restaurants',
    rol: 'restaurante',
    categoria: 'BUSINESS',
    segunda: 'FOOD_AND_DRINK',
  },
];
const LOCALES = { 'en-US': 'en-US', 'es-MX': 'es-419' };
const SUBTITULO = {
  cliente: { 'en-US': 'Local food, honest prices', 'es-MX': 'Comida local, precios claros' },
  repartidor: { 'en-US': 'Deliver and earn your way', 'es-MX': 'Reparte y gana a tu ritmo' },
  restaurante: { 'en-US': 'Orders and menu in one place', 'es-MX': 'Pedidos y menú en un lugar' },
};

for (const app of APPS) {
  const ficha = new Map(Object.entries(FICHAS)).get(app.paquete);
  const [info] = (await asc('GET', `/v1/apps/${app.id}/appInfos`)).data;
  // Categoría.
  await asc('PATCH', `/v1/appInfos/${info.id}`, {
    data: {
      type: 'appInfos',
      id: info.id,
      relationships: {
        primaryCategory: { data: { type: 'appCategories', id: app.categoria } },
        secondaryCategory: { data: { type: 'appCategories', id: app.segunda } },
      },
    },
  });
  // Nombre, subtítulo y privacidad por idioma.
  const infoLocs = (await asc('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data;
  for (const [locale, origen] of Object.entries(LOCALES)) {
    const texto = new Map(Object.entries(ficha)).get(origen);
    const attrs = {
      name: texto.title,
      subtitle: new Map(Object.entries(new Map(Object.entries(SUBTITULO)).get(app.rol))).get(
        locale,
      ),
      privacyPolicyUrl: `https://divoox.com${locale === 'en-US' ? '' : '/es'}/privacy`,
    };
    const ya = infoLocs.find((l) => l.attributes.locale === locale);
    if (ya)
      await asc('PATCH', `/v1/appInfoLocalizations/${ya.id}`, {
        data: { type: 'appInfoLocalizations', id: ya.id, attributes: attrs },
      });
    else
      await asc('POST', '/v1/appInfoLocalizations', {
        data: {
          type: 'appInfoLocalizations',
          attributes: { locale, ...attrs },
          relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } },
        },
      });
  }
  // Clasificación por edad: sin contenido sensible; la app del cliente menciona licores (con verificación de 21+).
  const edad = (await asc('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
  // Respuestas reales: hay chat con el repartidor en las tres apps; reseñas de clientes y respuestas
  // del restaurante; la app del cliente vende licores (desactivados hoy) con verificación de 21+.
  const BOOLEANOS = new Set([
    'advertising',
    'gambling',
    'lootBox',
    'healthOrWellnessTopics',
    'messagingAndChat',
    'parentalControls',
    'ageAssurance',
    'socialMedia',
    'socialMediaAgeRestricted',
    'unrestrictedWebAccess',
    'userGeneratedContent',
  ]);
  const OMITIR = new Set([
    'kidsAgeBand',
    'gracRatingClassificationNumber',
    'developerAgeRatingInfoUrl',
  ]);
  const respuestas = Object.fromEntries(
    Object.keys(edad.attributes)
      .filter(
        (k) =>
          !OMITIR.has(k) && !k.startsWith('ageRatingOverride') && k !== 'koreaAgeRatingOverride',
      )
      .map((k) => [k, BOOLEANOS.has(k) ? false : 'NONE']),
  );
  respuestas.messagingAndChat = true;
  if (app.rol !== 'repartidor') respuestas.userGeneratedContent = true;
  if (app.rol === 'cliente') {
    respuestas.alcoholTobaccoOrDrugUseOrReferences = 'INFREQUENT_OR_MILD';
    respuestas.ageAssurance = true;
  }
  await asc('PATCH', `/v1/ageRatingDeclarations/${edad.id}`, {
    data: { type: 'ageRatingDeclarations', id: edad.id, attributes: respuestas },
  });
  // Textos de la versión.
  const [version] = (await asc('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS`))
    .data;
  await asc('PATCH', `/v1/appStoreVersions/${version.id}`, {
    data: {
      type: 'appStoreVersions',
      id: version.id,
      attributes: { copyright: '2026 Windoce LLC' },
    },
  });
  const verLocs = (
    await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)
  ).data;
  for (const [locale, origen] of Object.entries(LOCALES)) {
    const texto = new Map(Object.entries(ficha)).get(origen);
    const attrs = {
      description: texto.fullDescription.slice(0, 4000),
      promotionalText: texto.shortDescription.slice(0, 170),
      keywords: (locale === 'en-US'
        ? 'food,delivery,restaurants,order,driver,courier,Miami,local'
        : 'comida,domicilio,restaurantes,pedido,repartidor,Miami,local'
      ).slice(0, 100),
      supportUrl: `https://divoox.com${locale === 'en-US' ? '' : '/es'}/support`,
      marketingUrl: 'https://divoox.com',
    };
    const ya = verLocs.find((l) => l.attributes.locale === locale);
    if (ya)
      await asc('PATCH', `/v1/appStoreVersionLocalizations/${ya.id}`, {
        data: { type: 'appStoreVersionLocalizations', id: ya.id, attributes: attrs },
      });
    else
      await asc('POST', '/v1/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale, ...attrs },
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      });
  }
  // Datos para el revisor de Apple: contacto y la cuenta de revisión de esa app.
  const revisor = REVISORES.find((r) => r[2] === app.rol);
  const revision = {
    contactFirstName: 'Pedro',
    contactLastName: 'Llerena',
    contactEmail: 'go@windoce.com',
    contactPhone: process.env.TELEFONO_REVISION ?? '',
    demoAccountName: revisor?.[0] ?? '',
    demoAccountPassword: revisor?.[1] ?? '',
    demoAccountRequired: true,
    notes:
      'Divoox is a food delivery marketplace (customers, drivers and restaurants). Sign in with the review account above. Card payments run on Stripe; the review environment has test data. Support: go@windoce.com.',
  };
  const det = await fetch(
    `https://api.appstoreconnect.apple.com/v1/appStoreVersions/${version.id}/appStoreReviewDetail`,
    {
      headers: { authorization: `Bearer ${token()}` },
    },
  ).then((r) => (r.status === 200 ? r.json() : null));
  if (det?.data)
    await asc('PATCH', `/v1/appStoreReviewDetails/${det.data.id}`, {
      data: { type: 'appStoreReviewDetails', id: det.data.id, attributes: revision },
    });
  else
    await asc('POST', '/v1/appStoreReviewDetails', {
      data: {
        type: 'appStoreReviewDetails',
        attributes: revision,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } },
      },
    });
  console.log(`${app.rol}: ficha cargada (en-US y es-MX), categoría, edad, copyright y revisión`);
}
