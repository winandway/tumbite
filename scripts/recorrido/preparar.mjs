// Arma Tumbite como en producción en .recorrido/: el panel en «/», la app del cliente en «/app»,
// la del repartidor en «/driver» y el servidor en «/datos», todo en una sola dirección local.
// La base de datos sale nueva en cada corrida (solo el esquema y la zona de Miami).
// Uso: node scripts/recorrido/preparar.mjs   (SIN_COMPILAR=1 reusa lo ya compilado)
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');
const dir = join(raiz, '.recorrido');
const puerto = process.env.PUERTO_RECORRIDO ?? '8790';
const url = `http://localhost:${puerto}`;
const correr = (cmd, env = {}) =>
  execSync(cmd, { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...env } });

if (!process.env.SIN_COMPILAR) {
  correr('npm run build -w @tumbite/panel');
  correr('npm run build:app-web', { URL_API: url });
  correr('npm run build:repartidor-web', { URL_API: url });
  // La app del restaurante solo hace falta para las capturas de las tiendas.
  if (process.env.TIENDA) correr('npm run build:restaurante-web', { URL_API: url });
}
for (const d of ['apps/panel/dist', 'apps/cliente/dist-web', 'apps/repartidor/dist-web']) {
  // Rutas fijas de este mismo repositorio.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(join(raiz, d))) throw new Error(`recorrido: falta ${d}; compila primero`);
}

rmSync(dir, { recursive: true, force: true });
const sitio = join(dir, 'sitio');
mkdirSync(sitio, { recursive: true });
cpSync(join(raiz, 'apps/panel/dist'), sitio, { recursive: true });
cpSync(join(raiz, 'apps/cliente/dist-web'), join(sitio, 'app'), { recursive: true });
cpSync(join(raiz, 'apps/repartidor/dist-web'), join(sitio, 'driver'), { recursive: true });
if (process.env.TIENDA && existsSync(join(raiz, 'apps/restaurante/dist-web')))
  cpSync(join(raiz, 'apps/restaurante/dist-web'), join(sitio, 'restaurant'), { recursive: true });

writeFileSync(
  join(dir, 'wrangler.jsonc'),
  JSON.stringify(
    {
      name: 'tumbite-recorrido',
      main: '../apps/servidor/src/index.ts',
      compatibility_date: '2026-09-01',
      compatibility_flags: ['nodejs_compat'],
      assets: {
        directory: './sitio',
        binding: 'ASSETS',
        run_worker_first: ['/datos/*', '/media/*'],
      },
      d1_databases: [{ binding: 'DB', database_name: 'tumbite-local', database_id: 'local' }],
      r2_buckets: [{ binding: 'BUCKET', bucket_name: 'tumbite-local' }],
    },
    null,
    2,
  ),
);

// Valores de prueba hechos en el momento: no existen en ningún otro lado.
const datos = {
  url,
  correoEquipo: 'equipo@recorrido.test',
  semilla: randomBytes(24).toString('hex'),
  secretoAviso: `whsec_${randomBytes(18).toString('hex')}`,
  clave: `Recorrido-${randomBytes(6).toString('hex')}`,
};
writeFileSync(
  join(dir, '.dev.vars'),
  [
    'STRIPE_SECRET_KEY=sk_test_recorrido',
    'STRIPE_PUBLISHABLE_KEY=pk_test_recorrido',
    `STRIPE_WEBHOOK_SECRET=${datos.secretoAviso}`,
    `STRIPE_API_URL=http://localhost:${process.env.PUERTO_STRIPE ?? 12111}`,
    `ADMIN_CORREOS=${datos.correoEquipo}`,
    `ADMIN_SEMILLA=${datos.semilla}`,
    `SITIO_URL=${url}`,
    'TWILIO_ACCOUNT_SID=ACrecorrido000000000000000000000',
    'TWILIO_AUTH_TOKEN=token-recorrido-de-prueba-largo',
    'TWILIO_FROM=+13055550000',
    `TWILIO_API_URL=http://localhost:${process.env.PUERTO_TWILIO ?? 12112}`,
  ].join('\n') + '\n',
);
writeFileSync(join(dir, 'datos.json'), JSON.stringify(datos, null, 2));

correr(
  'npx wrangler d1 execute tumbite-local --local --persist-to .recorrido/estado -c .recorrido/wrangler.jsonc --file schema.sql',
);
console.log(`recorrido: listo en ${url}`);
