// Enviar a revisión de Apple (30 oct 2026): para cada app de iPhone cuya versión ya tiene la
// compilación adjunta, crea la entrega de revisión en App Store Connect y la envía, con la llave de la
// API guardada en ~/.config/tumbite/apple-asc. Una app sin compilación se salta y se dice.
// Uso: node scripts/tiendas/enviar-revision-ios.mjs [cliente|repartidor|restaurante ...]
import { asc } from './asc.mjs';

const APPS = { cliente: '6829108108', repartidor: '6829108327', restaurante: '6829108322' };
const pedidas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(APPS);

for (const nombre of pedidas) {
  const id = new Map(Object.entries(APPS)).get(nombre);
  if (!id) {
    console.error(`App desconocida: ${nombre}`);
    process.exit(2);
  }
  const [version] = (await asc('GET', `/v1/apps/${id}/appStoreVersions?filter[platform]=IOS`)).data;
  const estado = version.attributes.appStoreState;
  if (estado !== 'PREPARE_FOR_SUBMISSION') {
    console.log(`${nombre}: la versión ya está en «${estado}», no se envía otra vez.`);
    continue;
  }
  const build = (await asc('GET', `/v1/appStoreVersions/${version.id}/build`)).data;
  if (!build) {
    console.log(`${nombre}: todavía no tiene compilación adjunta; se salta.`);
    continue;
  }
  // Una entrega abierta se reutiliza para no dejar borradores sueltos.
  const abiertas = (
    await asc(
      'GET',
      `/v1/reviewSubmissions?filter[app]=${id}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW`,
    )
  ).data;
  const entrega =
    abiertas[0] ??
    (
      await asc('POST', '/v1/reviewSubmissions', {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'IOS' },
          relationships: { app: { data: { type: 'apps', id } } },
        },
      })
    ).data;
  const items = (await asc('GET', `/v1/reviewSubmissions/${entrega.id}/items`)).data;
  if (!items.length)
    await asc('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: entrega.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
        },
      },
    });
  await asc('PATCH', `/v1/reviewSubmissions/${entrega.id}`, {
    data: { type: 'reviewSubmissions', id: entrega.id, attributes: { submitted: true } },
  });
  console.log(
    `${nombre}: enviada a revisión de Apple (versión ${version.attributes.versionString}).`,
  );
}
