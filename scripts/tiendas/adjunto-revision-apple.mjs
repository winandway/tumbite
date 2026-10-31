// Sube un archivo (el video que pide Apple, pauta 2.1) como adjunto para el revisor de una app
// (App Review Information → Attachments), por la API de App Store Connect (31 oct 2026).
// Uso: node scripts/tiendas/adjunto-revision-apple.mjs <id-de-la-app> <archivo>
import crypto from 'node:crypto';
import fs from 'node:fs';
import { basename } from 'node:path';
import { asc } from './asc.mjs';

const [app, archivo] = process.argv.slice(2);
if (!app || !archivo) {
  console.error('Uso: node scripts/tiendas/adjunto-revision-apple.mjs <id-de-la-app> <archivo>');
  process.exit(2);
}

const datos = fs.readFileSync(archivo);
const v = await asc('GET', `/v1/apps/${app}/appStoreVersions?limit=1&include=appStoreReviewDetail`);
const detalle = v.included?.[0];
if (!detalle) throw new Error('La versión no tiene «App Review Information».');
const reserva = await asc('POST', '/v1/appStoreReviewAttachments', {
  data: {
    type: 'appStoreReviewAttachments',
    attributes: { fileName: basename(archivo), fileSize: datos.length },
    relationships: {
      appStoreReviewDetail: { data: { type: 'appStoreReviewDetails', id: detalle.id } },
    },
  },
});
const id = reserva.data.id;
for (const op of reserva.data.attributes.uploadOperations) {
  const r = await fetch(op.url, {
    method: op.method,
    headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
    body: datos.subarray(op.offset, op.offset + op.length),
  });
  if (!r.ok) throw new Error(`parte ${op.offset}: ${r.status}`);
}
await asc('PATCH', `/v1/appStoreReviewAttachments/${id}`, {
  data: {
    type: 'appStoreReviewAttachments',
    id,
    attributes: {
      uploaded: true,
      sourceFileChecksum: crypto.createHash('md5').update(datos).digest('hex'),
    },
  },
});
console.log(`Adjunto ${id} subido (${(datos.length / 1e6).toFixed(1)} MB) a la app ${app}.`);
