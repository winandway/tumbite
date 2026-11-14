// C-AVISOS-WEB (13 nov 2026) — todos los países. Genera el par de llaves VAPID de los avisos de las
// apps instaladas desde el navegador. NO sube nada a ningún sitio:
//   - la PRIVADA se escribe en ~/.config/tumbite/vapid-privada (permisos 600), fuera del repositorio;
//   - la PÚBLICA se escribe en ~/.config/tumbite/vapid-publica y se muestra en pantalla.
// Si ya existen, no las pisa (cambiarlas deja sin avisos a todos los suscritos): para rehacerlas,
// pasa --nuevas.
// Uso: node scripts/avisos/generar-vapid.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';

// Rutas fijas dentro de ~/.config/tumbite (no vienen de afuera).
/* eslint-disable security/detect-non-literal-fs-filename */

const dir = join(homedir(), '.config', 'tumbite');
const privada = join(dir, 'vapid-privada');
const publica = join(dir, 'vapid-publica');
const b64url = (b) => Buffer.from(b).toString('base64url');

if (existsSync(privada) && existsSync(publica) && !process.argv.includes('--nuevas')) {
  console.log('Las llaves VAPID ya existen; no se tocan.');
  console.log(`Pública (VAPID_PUBLIC_KEY): ${readFileSync(publica, 'utf8').trim()}`);
  console.log(`Privada: en ${privada} (no se muestra).`);
  process.exit(0);
}

const par = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const jwk = await webcrypto.subtle.exportKey('jwk', par.privateKey);
const crudo = new Uint8Array(await webcrypto.subtle.exportKey('raw', par.publicKey));

mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
writeFileSync(privada, `${jwk.d}\n`, { mode: 0o600 });
chmodSync(privada, 0o600);
writeFileSync(publica, `${b64url(crudo)}\n`, { mode: 0o600 });
console.log('Llaves VAPID generadas.');
console.log(`Pública (VAPID_PUBLIC_KEY y EXPO_PUBLIC_VAPID_PUBLIC_KEY): ${b64url(crudo)}`);
console.log(`Privada (VAPID_PRIVATE_KEY): guardada en ${privada} (600), no se muestra.`);
