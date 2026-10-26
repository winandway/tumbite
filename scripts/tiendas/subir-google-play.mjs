// Sube un .aab a Google Play (pista de pruebas internas, como borrador) con la llave de la cuenta
// de servicio de la empresa (26 oct 2026). La llave vive fuera del repo, en
// ~/.config/tumbite/google-play-eas.json, y nunca se imprime.
// Uso: node scripts/tiendas/subir-google-play.mjs <paquete> <archivo.aab> [pista]
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [paquete, aab, pista = 'internal'] = process.argv.slice(2);
if (!paquete || !aab) {
  console.error('Uso: node scripts/tiendas/subir-google-play.mjs <paquete> <archivo.aab> [pista]');
  process.exit(1);
}
const llave = JSON.parse(
  readFileSync(join(homedir(), '.config', 'tumbite', 'google-play-eas.json'), 'utf8'),
);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = Math.floor(Date.now() / 1000);
const cuerpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
  iss: llave.client_email,
  scope: 'https://www.googleapis.com/auth/androidpublisher',
  aud: llave.token_uri,
  iat: ahora,
  exp: ahora + 3000,
})}`;
const firma = createSign('RSA-SHA256').update(cuerpo).sign(llave.private_key, 'base64url');
const t = await (
  await fetch(llave.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${cuerpo}.${firma}`,
  })
).json();
if (!t.access_token) throw new Error(`sin acceso a Google Play: ${t.error}`);
const auth = { authorization: `Bearer ${t.access_token}` };
const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${paquete}`;
const pedir = async (url, init) => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${d.error?.message ?? ''}`);
  return d;
};

const { id } = await pedir(`${api}/edits`, { method: 'POST', headers: auth });
const subido = await pedir(
  `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${paquete}/edits/${id}/bundles?uploadType=media`,
  {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/octet-stream' },
    body: readFileSync(aab),
  },
);
console.log(`subido: versión ${subido.versionCode}`);
await pedir(`${api}/edits/${id}/tracks/${pista}`, {
  method: 'PUT',
  headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({
    track: pista,
    releases: [{ status: 'draft', versionCodes: [String(subido.versionCode)] }],
  }),
});
await pedir(`${api}/edits/${id}:commit`, { method: 'POST', headers: auth });
console.log(`listo: ${paquete} en la pista «${pista}» como borrador`);
