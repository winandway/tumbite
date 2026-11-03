// C-ICONOS-POR-APP (3 nov 2026, lámina aprobada por Richard): en la ficha de Apple, cada app dice
// para quién es (subtítulo y primera frase del texto promocional), para que las tres no se lean como
// apps repetidas (pauta 4.3). Solo toca esos dos textos: no manda nada a revisión.
// Uso: node scripts/tiendas/ficha-por-app.mjs
import { asc } from './asc.mjs';

const APPS = [
  {
    id: '6829108108',
    subtitulo: { 'en-US': 'Food delivery for customers', 'es-MX': 'Para clientes: pide comida' },
    lema: { 'en-US': 'For customers.', 'es-MX': 'Para clientes.' },
  },
  {
    id: '6829108327',
    subtitulo: { 'en-US': 'For delivery drivers', 'es-MX': 'Para repartidores' },
    lema: { 'en-US': 'For delivery drivers.', 'es-MX': 'Para repartidores.' },
  },
  {
    id: '6829108322',
    subtitulo: { 'en-US': 'For restaurants: get orders', 'es-MX': 'Para restaurantes' },
    lema: { 'en-US': 'For restaurants.', 'es-MX': 'Para restaurantes.' },
  },
];

for (const app of APPS) {
  const infos = (await asc('GET', `/v1/apps/${app.id}/appInfos`)).data;
  const info = infos.find((i) => i.attributes.state !== 'READY_FOR_DISTRIBUTION') ?? infos[0];
  for (const loc of (await asc('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data) {
    const subtitle = app.subtitulo[loc.attributes.locale];
    if (!subtitle) continue;
    await asc('PATCH', `/v1/appInfoLocalizations/${loc.id}`, {
      data: { type: 'appInfoLocalizations', id: loc.id, attributes: { subtitle } },
    });
  }
  const [version] = (await asc('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS`))
    .data;
  for (const loc of (
    await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)
  ).data) {
    const lema = app.lema[loc.attributes.locale];
    if (!lema) continue;
    const actual = String(loc.attributes.promotionalText ?? '').replace(
      /^For [^.]+\.\s*|^Para [^.]+\.\s*/,
      '',
    );
    const promotionalText = `${lema} ${actual}`.slice(0, 170);
    await asc('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { promotionalText } },
    });
    console.log(app.id, loc.attributes.locale, '→', promotionalText.slice(0, 60));
  }
}
