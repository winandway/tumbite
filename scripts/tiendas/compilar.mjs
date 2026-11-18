// La forma de compilar cualquier app de Divoox (C-COMPILA-EN-ESTA-MAC, 18 nov 2026): en esta Mac,
// gratis, con las credenciales de firma guardadas en Expo. La nube solo con --nube (se cobra).
// Uso: node scripts/tiendas/compilar.mjs <cliente|repartidor|restaurante> <android|ios> <perfil> [--nube]
//   perfiles: pruebas (APK de Android contra el sitio de pruebas), production, pruebas-tienda, simulador…
// Deja el archivo en apks-pruebas/<app>-<perfil>.<apk|aab|ipa|tar.gz> y dice la ruta al final.
// Subir a las tiendas es aparte: publicar-google-play.mjs / subir-google-play.mjs / compilar-ios.mjs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { autorizarCompilacion, pidioNube } from './guardia-nube.mjs';

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
const env = {
  ...process.env,
  EXPO_TOKEN: readFileSync(join(homedir(), '.config', 'tumbite', 'expo-token'), 'utf8').trim(),
  JAVA_HOME:
    process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
  ANDROID_HOME: process.env.ANDROID_HOME ?? join(homedir(), 'Library', 'Android', 'sdk'),
  EXPO_NO_CAPABILITY_SYNC: '1',
};
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
console.log(nube ? '\nListo en la nube de Expo.' : `\nListo: ${salida}`);
