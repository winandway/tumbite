// Apps de iPhone (30 oct 2026): compila con EAS para la App Store y la envía a App Store Connect
// (TestFlight y revisión), sin escribir la contraseña de Apple: usa la llave de la API de App Store
// Connect guardada UNA vez en ~/.config/tumbite/apple-asc/ (AuthKey.p8, key-id, issuer-id, team-id).
// Uso: node scripts/tiendas/compilar-ios.mjs [cliente|repartidor|restaurante ...]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APPS = ['cliente', 'repartidor', 'restaurante'];
const apps = process.argv.slice(2).length ? process.argv.slice(2) : APPS;
const dir = join(homedir(), '.config', 'tumbite', 'apple-asc');
const leer = (f) => readFileSync(join(dir, f), 'utf8').trim();
for (const f of ['AuthKey.p8', 'key-id', 'issuer-id', 'team-id'])
  if (!existsSync(join(dir, f))) {
    console.error(
      `Falta ${f} en ${dir}: la llave de la API de App Store Connect no está guardada.`,
    );
    process.exit(2);
  }
const env = {
  ...process.env,
  EXPO_TOKEN: readFileSync(join(homedir(), '.config', 'tumbite', 'expo-token'), 'utf8').trim(),
  EXPO_ASC_API_KEY_PATH: join(dir, 'AuthKey.p8'),
  EXPO_ASC_KEY_ID: leer('key-id'),
  EXPO_ASC_ISSUER_ID: leer('issuer-id'),
  EXPO_APPLE_TEAM_ID: leer('team-id'),
  EXPO_APPLE_TEAM_TYPE: 'COMPANY_OR_ORGANIZATION',
};
for (const app of apps) {
  if (!APPS.includes(app)) {
    console.error(`App desconocida: ${app}`);
    process.exit(2);
  }
  console.log(`\n── ${app}: compilando para iPhone y enviando a App Store Connect…`);
  execFileSync(
    'npx',
    [
      'eas-cli',
      'build',
      '--platform',
      'ios',
      '--profile',
      'production',
      '--non-interactive',
      '--auto-submit',
      '--wait',
    ],
    { cwd: join(process.cwd(), 'apps', app), env, stdio: 'inherit' },
  );
}
console.log('\nListo: las compilaciones quedaron en App Store Connect (TestFlight).');
