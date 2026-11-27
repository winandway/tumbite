#!/usr/bin/env node
// Apps de prueba en la página de progreso (15 nov 2026, pedido de Richard): arma progreso/apps.json
// con el enlace de instalación MÁS NUEVO de cada app (Android: el APK «pruebas» de Expo; iPhone: la
// compilación «pruebas-tienda» en TestFlight) y su código QR, para instalar apuntando la cámara del
// teléfono a la pantalla de la computadora. Las dos hablan con el sitio de pruebas.
// Lo llama scripts/progreso/publicar.sh en cada publicación: la página nunca queda con apps viejas.
// Uso: EXPO_TOKEN=$(cat ~/.config/tumbite/expo-token) node scripts/progreso/apps-de-prueba.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// «tienda» es el número de la app en App Store Connect (el mismo de su eas.json).
const APPS = [
  {
    id: 'cliente',
    tienda: '6829108108',
    nombre: 'Divoox',
    para: 'La app del cliente: pedir comida, tiendas y viajes.',
  },
  {
    id: 'repartidor',
    tienda: '6829108327',
    nombre: 'Divoox Driver',
    para: 'La app del repartidor y del conductor: entregas, rutas y viajes.',
  },
  {
    id: 'restaurante',
    tienda: '6829108322',
    nombre: 'Divoox Merchant',
    para: 'La app del restaurante: recibir y preparar pedidos.',
  },
];
if (!process.env.EXPO_TOKEN) {
  console.error('Falta EXPO_TOKEN (está en ~/.config/tumbite/expo-token).');
  process.exit(2);
}
const env = process.env;

/** La última compilación TERMINADA de esa app, plataforma y perfil (o null si no hay). */
function ultima(app, plataforma, perfil) {
  const salida = execFileSync(
    'npx',
    [
      'eas-cli',
      'build:list',
      '--platform',
      plataforma,
      '--build-profile',
      perfil,
      '--status',
      'finished',
      '--limit',
      '1',
      '--json',
      '--non-interactive',
    ],
    { cwd: join(raiz, 'apps', app), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  return JSON.parse(salida)[0] ?? null;
}

const qr = (texto) => QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });

const apps = [];
for (const app of APPS) {
  const android = ultima(app.id, 'android', 'pruebas');
  const iphone = ultima(app.id, 'ios', 'pruebas-tienda');
  if (!android?.artifacts?.buildUrl) throw new Error(`${app.id}: no hay APK de pruebas terminado.`);
  if (!iphone) throw new Error(`${app.id}: no hay compilación de pruebas de iPhone terminada.`);
  // El enlace de TestFlight de la app: abre TestFlight en esa app, con la compilación más nueva.
  const testflight = `https://beta.itunes.apple.com/v1/app/${app.tienda}`;
  apps.push({
    id: app.id,
    nombre: app.nombre,
    para: app.para,
    android: {
      url: android.artifacts.buildUrl,
      numero: android.appBuildVersion,
      // C-DESLIZAR-SIEMPRE: dos compilaciones con el MISMO número pueden salir de códigos distintos
      // (pasó el 15 nov con la 17): la página dice de qué código es cada una.
      codigo: String(android.gitCommitHash ?? '').slice(0, 7),
      fecha: android.completedAt ?? android.createdAt,
      qr: await qr(android.artifacts.buildUrl),
    },
    iphone: {
      url: testflight,
      numero: iphone.appBuildVersion,
      codigo: String(iphone.gitCommitHash ?? '').slice(0, 7),
      fecha: iphone.completedAt ?? iphone.createdAt,
      qr: await qr(testflight),
    },
  });
}
// C-APPS-VERSION-REAL (16 nov 2026, piloto en vivo de El Vigía y Tucaní): el APK de PRODUCCIÓN
// (perfil «preview»: habla con divoox.com, sin «PRUEBAS» en el nombre) va en su propia sección,
// arriba y aparte de las de prueba. Se instala directo; no depende de Google Play.
const real = [];
for (const app of APPS) {
  const b = ultima(app.id, 'android', 'preview');
  if (!b?.artifacts?.buildUrl) continue;
  real.push({
    id: app.id,
    nombre: app.nombre,
    para: app.para,
    android: {
      url: b.artifacts.buildUrl,
      numero: b.appBuildVersion,
      codigo: String(b.gitCommitHash ?? '').slice(0, 7),
      fecha: b.completedAt ?? b.createdAt,
      qr: await qr(b.artifacts.buildUrl),
    },
  });
}
writeFileSync(
  join(raiz, 'progreso', 'apps.json'),
  JSON.stringify({ actualizado: new Date().toISOString(), real, apps }, null, 2) + '\n',
);
console.log(
  apps
    .map((a) => `${a.nombre}: Android número ${a.android.numero}, iPhone número ${a.iphone.numero}`)
    .join('\n'),
);
