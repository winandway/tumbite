// Regla de Richard (29 oct 2026): cada actualización de las apps se sube a Google Play, a la versión
// que revisa Google, para que la revisión vea siempre lo último. Este guion compila con EAS (o toma
// una compilación ya lanzada), espera, baja el .aab y lo deja en la pista de producción.
// Uso: node scripts/tiendas/compilar-y-subir.mjs [cliente|repartidor|restaurante ...]
//      BUILD_<APP>=<id de compilación ya lanzada>  (opcional, para no compilar otra vez)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const PAQUETES = {
  cliente: 'com.windoce.tumbite',
  repartidor: 'com.windoce.tumbite.driver',
  restaurante: 'com.windoce.tumbite.restaurants',
};
const apps = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAQUETES);
const env = {
  ...process.env,
  EXPO_TOKEN: readFileSync(join(homedir(), '.config', 'tumbite', 'expo-token'), 'utf8').trim(),
};
const eas = (app, args) =>
  JSON.parse(
    execFileSync('npx', ['eas-cli', ...args, '--json'], {
      cwd: join(process.cwd(), 'apps', app),
      env,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    }),
  );
const carpeta = mkdtempSync(join(tmpdir(), 'divoox-aab-'));
for (const app of apps) {
  const paquete = new Map(Object.entries(PAQUETES)).get(app);
  if (!paquete) throw new Error(`App desconocida: ${app}`);
  const ya = process.env[`BUILD_${app.toUpperCase()}`];
  const build = ya
    ? eas(app, ['build:view', ya])
    : eas(app, [
        'build',
        '--platform',
        'android',
        '--profile',
        'production',
        '--wait',
        '--non-interactive',
      ])[0];
  let b = build;
  while (!['FINISHED', 'ERRORED', 'CANCELED'].includes(b.status)) {
    await new Promise((r) => setTimeout(r, 30_000));
    b = eas(app, ['build:view', b.id]);
  }
  if (b.status !== 'FINISHED') throw new Error(`${app}: la compilación terminó en ${b.status}`);
  const aab = join(carpeta, `${app}.aab`);
  writeFileSync(aab, Buffer.from(await (await fetch(b.artifacts.buildUrl)).arrayBuffer()));
  const nombre = `${b.appVersion} (${b.appBuildVersion})`;
  execFileSync('node', ['scripts/tiendas/publicar-google-play.mjs', paquete, aab, nombre], {
    stdio: 'inherit',
  });
}
