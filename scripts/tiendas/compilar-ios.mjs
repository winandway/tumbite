// Apps de iPhone (30 oct 2026): compila con EAS para la App Store y la envía a App Store Connect
// (TestFlight y revisión), sin escribir la contraseña de Apple: usa la llave de la API de App Store
// Connect guardada UNA vez en ~/.config/tumbite/apple-asc/ (AuthKey.p8, key-id, issuer-id, team-id).
// Ojo: la primera compilación de cada app necesitó responder a mano las preguntas de credenciales
// de EAS (ya quedaron guardadas en Expo); desde ahora corre sin preguntas.
// Uso: node scripts/tiendas/compilar-ios.mjs [--solo-enviar] [--local] [cliente|repartidor|restaurante ...]
// --solo-enviar: no compila; envía a App Store Connect la última compilación ya terminada.
// --pruebas (11 nov 2026, pedido de Richard para probar con sus iPhone): compila con el perfil
// «pruebas-tienda», que habla con el SITIO DE PRUEBAS (Stripe en modo prueba, tarjeta 4242), y la
// deja en TestFlight. Cada número de compilación de pruebas queda anotado en
// ~/.config/tumbite/ios-compilaciones-de-pruebas y `enviar-revision-ios.mjs` se niega a mandar
// una de esas a la revisión de la tienda (C-IOS-PRUEBAS-NO-A-REVISION).
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APPS = ['cliente', 'repartidor', 'restaurante'];
const soloEnviar = process.argv.includes('--solo-enviar');
// --local: compila en esta Mac (no gasta compilaciones de la nube de Expo) y envía ese archivo.
const local = process.argv.includes('--local');
const pruebas = process.argv.includes('--pruebas');
const perfil = pruebas ? 'pruebas-tienda' : 'production';
const archivo = (app) =>
  join(process.cwd(), 'apks-pruebas', `${app}${pruebas ? '-pruebas' : ''}.ipa`);
if (pruebas && !local) {
  console.error('Las compilaciones de pruebas se hacen en esta Mac: agrega --local.');
  process.exit(2);
}
const pedidas = process.argv.slice(2).filter((a) => !a.startsWith('--'));
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
  // Las capacidades (notificaciones, Apple Pay) ya se configuraron en el portal de Apple.
  EXPO_NO_CAPABILITY_SYNC: '1',
};
for (const app of apps) {
  if (!APPS.includes(app)) {
    console.error(`App desconocida: ${app}`);
    process.exit(2);
  }
  console.log(
    `\n── ${app}: ${soloEnviar ? 'enviando' : 'compilando para iPhone y enviando'} a App Store Connect…`,
  );
  // Apple rechaza (ITMS-90189) un número de compilación repetido: se envía SIEMPRE la compilación
  // que se acaba de hacer, por su id, nunca «la última» (que puede ser una ya enviada).
  let idCompilacion = null;
  if (!soloEnviar && !local) {
    const salida = execFileSync(
      'npx',
      [
        'eas-cli',
        'build',
        '--platform',
        'ios',
        '--profile',
        perfil,
        '--non-interactive',
        '--wait',
        '--json',
      ],
      {
        cwd: join(process.cwd(), 'apps', app),
        env,
        stdio: ['ignore', 'pipe', 'inherit'],
        encoding: 'utf8',
      },
    );
    idCompilacion = JSON.parse(salida)[0]?.id ?? null;
    if (!idCompilacion) {
      console.error(`${app}: EAS no devolvió el id de la compilación; no se envía nada.`);
      process.exit(1);
    }
  } else if (!soloEnviar)
    execFileSync(
      'npx',
      [
        'eas-cli',
        'build',
        '--platform',
        'ios',
        '--profile',
        perfil,
        '--non-interactive',
        ...(local ? ['--local', '--output', archivo(app)] : ['--wait']),
      ],
      { cwd: join(process.cwd(), 'apps', app), env, stdio: 'inherit' },
    );
  if (pruebas) {
    // El número de esta compilación queda anotado ANTES de enviarla: nunca irá a revisión.
    const numero = execFileSync(
      'sh',
      [
        '-c',
        `unzip -p "${archivo(app)}" 'Payload/*.app/Info.plist' | plutil -extract CFBundleVersion raw -`,
      ],
      { encoding: 'utf8' },
    ).trim();
    if (!/^\d+$/.test(numero)) {
      console.error(`${app}: no pude leer el número de la compilación de pruebas; no se envía.`);
      process.exit(1);
    }
    appendFileSync(
      join(homedir(), '.config', 'tumbite', 'ios-compilaciones-de-pruebas'),
      `${app} ${numero}\n`,
      { mode: 0o600 },
    );
    console.log(`${app}: compilación de PRUEBAS número ${numero} (sitio de pruebas).`);
  }
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
        ...(local
          ? ['--path', archivo(app)]
          : idCompilacion
            ? ['--id', idCompilacion]
            : ['--latest']),
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
