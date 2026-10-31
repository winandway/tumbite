// Capturas de la App Store (30 oct 2026): sube las capturas ORIGINALES del recorrido
// (npm run recorrido:tiendas → capturas-tiendas/<app>/Apple App Store/<idioma>/<Celular|Tableta>/)
// a la versión de cada app, en inglés y español. Reemplaza las que hubiera. Máximo 10 por juego.
// Uso: node scripts/tiendas/capturas-app-store.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';
import { asc, token } from './asc.mjs';

const APPS = [
  { id: '6829108108', carpeta: 'Divoox (cliente)', tableta: false },
  { id: '6829108327', carpeta: 'Divoox Driver (repartidor)', tableta: false },
  { id: '6829108322', carpeta: 'Divoox Restaurants (restaurante)', tableta: true },
];
const IDIOMAS = new Map([
  ['en-US', 'English'],
  ['es-MX', 'Español'],
]);
const TIPOS = [
  ['Celular', 'APP_IPHONE_67'],
  ['Tableta', 'APP_IPAD_PRO_3GEN_129'],
];

async function subir(setId, archivo) {
  const datos = fs.readFileSync(archivo);
  const res = await asc('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: archivo.split('/').at(-1), fileSize: datos.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });
  for (const op of res.data.attributes.uploadOperations) {
    const r = await fetch(op.url, {
      method: op.method,
      headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
      body: datos.subarray(op.offset, op.offset + op.length),
    });
    if (!r.ok) throw new Error(`subida ${r.status}`);
  }
  await asc('PATCH', `/v1/appScreenshots/${res.data.id}`, {
    data: {
      type: 'appScreenshots',
      id: res.data.id,
      attributes: {
        uploaded: true,
        sourceFileChecksum: crypto.createHash('md5').update(datos).digest('hex'),
      },
    },
  });
}

void token;
for (const app of APPS) {
  const [version] = (await asc('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS`))
    .data;
  const locs = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`))
    .data;
  for (const loc of locs) {
    const idioma = IDIOMAS.get(loc.attributes.locale);
    if (!idioma) continue;
    const sets = (await asc('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`))
      .data;
    for (const [carpeta, tipo] of TIPOS) {
      if (carpeta === 'Tableta' && !app.tableta) continue;
      const dir = join('capturas-tiendas', app.carpeta, 'Apple App Store', idioma, carpeta);
      if (!fs.existsSync(dir)) continue;
      const archivos = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .sort()
        .slice(0, 10);
      const viejo = sets.find((x) => x.attributes.screenshotDisplayType === tipo);
      if (viejo) await asc('DELETE', `/v1/appScreenshotSets/${viejo.id}`);
      const set = await asc('POST', '/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: tipo },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: loc.id },
            },
          },
        },
      });
      for (const f of archivos) await subir(set.data.id, join(dir, f));
      console.log(
        `${app.carpeta} · ${loc.attributes.locale} · ${carpeta}: ${archivos.length} capturas`,
      );
    }
  }
}
