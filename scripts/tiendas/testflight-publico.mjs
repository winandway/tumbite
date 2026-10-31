// Enlace público de TestFlight (31 oct 2026): para cada app de iPhone crea el grupo externo «Prueba
// pública» con enlace abierto, le pone la última compilación válida y la manda a la revisión de prueba
// de Apple (la de TestFlight, aparte de la de la tienda). Copia el contacto y la cuenta de revisión de
// la ficha de la App Store. Al aprobarse, el enlace funciona: quien lo abre en un iPhone instala
// TestFlight y la app. Uso: node scripts/tiendas/testflight-publico.mjs
import { asc } from './asc.mjs';

const APPS = { cliente: '6829108108', repartidor: '6829108327', restaurante: '6829108322' };
const PROBAR = {
  cliente: 'Order food from local restaurants, track the driver live and pay in the app.',
  repartidor: 'Go online, accept delivery offers, follow the route and see your earnings.',
  restaurante: 'Receive and manage orders, edit your menu and see your sales.',
};

for (const [nombre, id] of Object.entries(APPS)) {
  const [version] = (await asc('GET', `/v1/apps/${id}/appStoreVersions?filter[platform]=IOS`)).data;
  const revision = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`))
    .data.attributes;
  const detalle = (await asc('GET', `/v1/apps/${id}/betaAppReviewDetail`)).data;
  await asc('PATCH', `/v1/betaAppReviewDetails/${detalle.id}`, {
    data: {
      type: 'betaAppReviewDetails',
      id: detalle.id,
      attributes: {
        contactFirstName: revision.contactFirstName,
        contactLastName: revision.contactLastName,
        contactPhone: revision.contactPhone,
        contactEmail: revision.contactEmail,
        demoAccountName: revision.demoAccountName,
        demoAccountPassword: revision.demoAccountPassword,
        demoAccountRequired: true,
        notes: revision.notes,
      },
    },
  });
  const que = new Map(Object.entries(PROBAR)).get(nombre) ?? '';
  const locs = (await asc('GET', `/v1/apps/${id}/betaAppLocalizations`)).data;
  if (!locs.some((l) => l.attributes.locale === 'en-US'))
    await asc('POST', '/v1/betaAppLocalizations', {
      data: {
        type: 'betaAppLocalizations',
        attributes: {
          locale: 'en-US',
          feedbackEmail: 'go@windoce.com',
          description: que,
          marketingUrl: 'https://divoox.com',
          privacyPolicyUrl: 'https://divoox.com/privacy',
        },
        relationships: { app: { data: { type: 'apps', id } } },
      },
    });
  // Última compilación válida y su texto de «Qué probar».
  const build = (
    await asc(
      'GET',
      `/v1/builds?filter[app]=${id}&filter[processingState]=VALID&sort=-uploadedDate&limit=1`,
    )
  ).data[0];
  if (!build) {
    console.log(`${nombre}: sin compilación válida; se salta.`);
    continue;
  }
  const bl = (await asc('GET', `/v1/builds/${build.id}/betaBuildLocalizations`)).data;
  const en = bl.find((l) => l.attributes.locale === 'en-US');
  if (en)
    await asc('PATCH', `/v1/betaBuildLocalizations/${en.id}`, {
      data: { type: 'betaBuildLocalizations', id: en.id, attributes: { whatsNew: que } },
    });
  else
    await asc('POST', '/v1/betaBuildLocalizations', {
      data: {
        type: 'betaBuildLocalizations',
        attributes: { locale: 'en-US', whatsNew: que },
        relationships: { build: { data: { type: 'builds', id: build.id } } },
      },
    });
  // Grupo externo con enlace público.
  const grupos = (await asc('GET', `/v1/betaGroups?filter[app]=${id}`)).data;
  const grupo =
    grupos.find((g) => g.attributes.name === 'Prueba pública') ??
    (
      await asc('POST', '/v1/betaGroups', {
        data: {
          type: 'betaGroups',
          attributes: {
            name: 'Prueba pública',
            publicLinkEnabled: true,
            publicLinkLimitEnabled: true,
            publicLinkLimit: 1000,
            feedbackEnabled: true,
          },
          relationships: { app: { data: { type: 'apps', id } } },
        },
      })
    ).data;
  await asc('POST', `/v1/betaGroups/${grupo.id}/relationships/builds`, {
    data: [{ type: 'builds', id: build.id }],
  });
  // Revisión de prueba de Apple. Si ya está pedida (409) o hay otra compilación en revisión de prueba
  // (422 ANOTHER_BUILD_IN_REVIEW), se sigue: esa se pide de nuevo cuando Apple termine la anterior.
  try {
    await asc('POST', '/v1/betaAppReviewSubmissions', {
      data: {
        type: 'betaAppReviewSubmissions',
        relationships: { build: { data: { type: 'builds', id: build.id } } },
      },
    });
  } catch (e) {
    if (!/409|ANOTHER_BUILD_IN_REVIEW/.test(String(e))) throw e;
  }
  const g = (await asc('GET', `/v1/betaGroups/${grupo.id}`)).data.attributes;
  console.log(
    `${nombre}: compilación ${build.attributes.version} en revisión de prueba · ${g.publicLink}`,
  );
}
