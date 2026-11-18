// La forma de compilar cualquier app de Divoox (C-COMPILA-EN-ESTA-MAC, 18 nov 2026): en esta Mac,
// gratis, con las credenciales de firma guardadas en Expo. La nube solo con --nube (se cobra).
// Uso: node scripts/tiendas/compilar.mjs <cliente|repartidor|restaurante> <android|ios> <perfil> [--nube]
//   perfiles: pruebas (APK de Android contra el sitio de pruebas), production, pruebas-tienda, simulador…
// Deja el archivo en apks-pruebas/<app>-<perfil>.<apk|aab|ipa|tar.gz> y dice la ruta al final.
// Subir a las tiendas es aparte: publicar-google-play.mjs / subir-google-play.mjs / compilar-ios.mjs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { autorizarCompilacion, entornoLocal, llevaRelleno, pidioNube } from './guardia-nube.mjs';

const APPS = ['cliente', 'repartidor', 'restaurante'];
const [app, plataforma, perfil] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!APPS.includes(app) || !['android', 'ios'].includes(plataforma) || !perfil) {
  console.error(
    'Uso: node scripts/tiendas/compilar.mjs <cliente|repartidor|restaurante> <android|ios> <perfil> [--nube]',
  );
  process.exit(2);
}
const raiz = process.cwd();
const config = JSON.parse(readFileSync(join(raiz, 'apps', app, 'eas.json'), 'utf8'));
const datos = new Map(Object.entries(config.build)).get(perfil);
if (!datos) {
  console.error(`El perfil «${perfil}» no existe en apps/${app}/eas.json.`);
  process.exit(2);
}
const extension =
  plataforma === 'ios'
    ? datos.ios?.simulator
      ? 'tar.gz'
      : 'ipa'
    : datos.android?.buildType === 'apk'
      ? 'apk'
      : 'aab';
const salida = join(raiz, 'apks-pruebas', `${app}-${perfil}.${extension}`);
mkdirSync(join(raiz, 'apks-pruebas'), { recursive: true });
const nube = pidioNube();
autorizarCompilacion({ donde: nube ? 'nube' : 'local', app, plataforma, perfil });
const env = entornoLocal();
execFileSync(
  'npx',
  [
    'eas-cli',
    'build',
    '--platform',
    plataforma,
    '--profile',
    perfil,
    '--non-interactive',
    ...(nube ? ['--wait'] : ['--local', '--output', salida]),
  ],
  { cwd: join(raiz, 'apps', app), env, stdio: 'inherit' },
);
// Comprobación del archivo de Android: si salió con el relleno en vez de la llave del mapa, no sirve.
if (!nube && plataforma === 'android') {
  const manifiesto = execFileSync(
    'unzip',
    [
      '-p',
      salida,
      extension === 'aab' ? 'base/manifest/AndroidManifest.xml' : 'AndroidManifest.xml',
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  if (llevaRelleno(manifiesto)) {
    renameSync(salida, `${salida}.SIN-MAPA`);
    console.error(
      `\nLa compilación salió SIN la llave del mapa. Quedó apartada: ${salida}.SIN-MAPA`,
    );
    process.exit(1);
  }
  console.log('Comprobado: el archivo lleva la llave del mapa, no el relleno.');
}
console.log(nube ? '\nListo en la nube de Expo.' : `\nListo: ${salida}`);
