// C-VERSION-VISIBLE (18 nov 2026): la versión visible de cada compilación es 0.1.<número de
// compilación> (0.1.47 para la compilación 47). El número (versionCode de Android) lo lleva EAS en su
// servidor (appVersionSource «remote») y lo sube en 1 al compilar (autoIncrement). Este guion lo
// consulta ANTES de compilar y pasa el siguiente en DIVOOX_NUMERO_COMPILACION; app.config.js de las
// tres apps arma con él la versión nativa (versionName).
//
// Solo Android: en iPhone la versión nativa (CFBundleShortVersionString) tiene que coincidir con la
// versión abierta en App Store Connect a la que se adjunta la compilación (enviar-revision-ios.mjs);
// cambiarla en cada compilación obligaría a abrir una versión nueva en Apple cada vez. En iPhone, y
// si la consulta falla, la versión nativa queda la de app.json, pero lo que se LEE en la app es igual
// de exacto en las dos plataformas: «Versión 0.1.47 (47)» sale del número nativo de la compilación
// (expo-application, packages/movil/src/version.tsx).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function entornoNumeroCompilacion({
  cwd,
  plataforma,
  perfil,
  datosPerfil,
  env = process.env,
  ejecutar = execFileSync,
  log = (m) => console.log(m),
}) {
  if (plataforma !== 'android' || !datosPerfil?.autoIncrement) return {};
  try {
    const salida = ejecutar(
      'npx',
      [
        'eas-cli',
        'build:version:get',
        '--platform',
        'android',
        '--profile',
        perfil,
        '--json',
        '--non-interactive',
      ],
      { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const actual = Number(JSON.parse(String(salida)).versionCode);
    if (!Number.isInteger(actual) || actual < 0) throw new Error(`número raro: ${salida}`);
    const siguiente = String(actual + 1);
    log(`Compilación ${siguiente}: la versión visible será 0.1.${siguiente}.`);
    return { DIVOOX_NUMERO_COMPILACION: siguiente };
  } catch (e) {
    console.warn(
      `Aviso: no pude consultar el número de compilación (${e instanceof Error ? e.message : e}). ` +
        'La versión nativa queda la de app.json; la app igual dice el número exacto.',
    );
    return {};
  }
}

// Desde la terminal (compilar-local-y-subir.sh): escribe solo el número siguiente de Android, o nada.
// Uso: node scripts/tiendas/numero-compilacion.mjs <app> <perfil>
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [app, perfil] = process.argv.slice(2);
  const cwd = join(process.cwd(), 'apps', app ?? '');
  const config = JSON.parse(readFileSync(join(cwd, 'eas.json'), 'utf8'));
  const datosPerfil = new Map(Object.entries(config.build ?? {})).get(perfil);
  const r = entornoNumeroCompilacion({
    cwd,
    plataforma: 'android',
    perfil,
    datosPerfil,
    log: (m) => console.error(m),
  });
  process.stdout.write(r.DIVOOX_NUMERO_COMPILACION ?? '');
}
