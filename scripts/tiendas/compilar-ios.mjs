// Apps de iPhone (30 oct 2026): compila con EAS para la App Store y la envía a App Store Connect
// (TestFlight y revisión), sin escribir la contraseña de Apple: usa la llave de la API de App Store
// Connect guardada UNA vez en ~/.config/tumbite/apple-asc/ (AuthKey.p8, key-id, issuer-id, team-id).
// Ojo: la primera compilación de cada app necesitó responder a mano las preguntas de credenciales
// de EAS (ya quedaron guardadas en Expo); desde ahora corre sin preguntas.
// Uso: node scripts/tiendas/compilar-ios.mjs [--solo-enviar] [cliente|repartidor|restaurante ...]
// --solo-enviar: no compila; envía a App Store Connect la última compilación ya terminada.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APPS = ['cliente', 'repartidor', 'restaurante'];
const soloEnviar = process.argv.includes('--solo-enviar');
const pedidas = process.argv.slice(2).filter((a) => a !== '--solo-enviar');
const apps = pedidas.length ? pedidas : APPS;
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
  console.log(
    `\n── ${app}: ${soloEnviar ? 'enviando' : 'compilando para iPhone y enviando'} a App Store Connect…`,
  );
  if (!soloEnviar)
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
        '--wait',
      ],
      { cwd: join(process.cwd(), 'apps', app), env, stdio: 'inherit' },
    );
  // Envío a TestFlight: la llave va en eas.json SOLO durante el envío y el archivo vuelve a quedar
  // exactamente como estaba (los identificadores de la llave nunca entran al repositorio).
  const ruta = join(process.cwd(), 'apps', app, 'eas.json');
  const original = readFileSync(ruta, 'utf8');
  const config = JSON.parse(original);
  Object.assign(config.submit.production.ios, {
    ascApiKeyPath: join(dir, 'AuthKey.p8'),
    ascApiKeyIssuerId: leer('issuer-id'),
    ascApiKeyId: leer('key-id'),
  });
  try {
    writeFileSync(ruta, JSON.stringify(config, null, 2));
    execFileSync(
      'npx',
      [
        'eas-cli',
        'submit',
        '--platform',
        'ios',
        '--latest',
        '--profile',
        'production',
        '--non-interactive',
      ],
      { cwd: join(process.cwd(), 'apps', app), env, stdio: 'inherit' },
    );
  } finally {
    writeFileSync(ruta, original);
  }
}
console.log('\nListo: las compilaciones quedaron en App Store Connect (TestFlight).');
