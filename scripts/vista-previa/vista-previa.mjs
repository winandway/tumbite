#!/usr/bin/env node
// C-VISTA-PREVIA-RAMA (26 nov 2026) — un sitio de pruebas por cada rama «fase-*».
//
// Cada rama tiene su propio worker de Cloudflare (divoox-preview-<rama>.windoce1.workers.dev) con su
// PROPIA base D1 (divoox-preview-<rama>). Nunca la de producción ni la del sitio compartido: lo
// impiden reglas.mjs (aquí) y el candado del servidor (apps/servidor/src/vistaPrevia.ts).
//
// Uso (desde la raíz del repo, con el paquete de pruebas ya armado: bash scripts/empaquetar.sh pruebas):
//   node scripts/vista-previa/vista-previa.mjs abrir  <rama> [--paquete out-pruebas] [--reiniciar]
//   node scripts/vista-previa/vista-previa.mjs cerrar <rama>
//   node scripts/vista-previa/vista-previa.mjs listar
//
// Credenciales: en GitHub, CLOUDFLARE_API_TOKEN (secreto CLOUDFLARE_TOKEN_VISTAS_PREVIAS). En esta Mac,
// la sesión aparte HOME=~/.tumbite-cloudflare (se pone sola si no hay token).
// Secreto del reloj de la vista previa: RELOJ_SECRETO_VISTA (si no viene, se crea uno al azar y se
// imprime en GITHUB_OUTPUT / en pantalla para los guiones).
/* eslint-disable security/detect-non-literal-fs-filename -- rutas del paquete y de una carpeta temporal propia */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ALMACEN,
  CUENTA,
  EVENTOS_STRIPE,
  PREFIJO,
  WORKER_CONOCIDO,
  configWorker,
  nombreVistaPrevia,
  urlAvisoStripe,
  urlVistaPrevia,
  validarBaseVistaPrevia,
} from './reglas.mjs';

const [orden, rama, ...resto] = process.argv.slice(2);
const opcion = (n, d) => {
  const i = resto.indexOf(n);
  return i >= 0 ? (resto[i + 1] ?? d) : d;
};
const paquete = resolve(opcion('--paquete', 'out-pruebas'));
const reiniciar = resto.includes('--reiniciar');
const commit = (process.env.VERSION || process.env.GITHUB_SHA || 'local').slice(0, 7);

const entorno = { ...process.env, CLOUDFLARE_ACCOUNT_ID: CUENTA, WRANGLER_SEND_METRICS: 'false' };
if (!entorno.CLOUDFLARE_API_TOKEN) entorno.HOME = join(homedir(), '.tumbite-cloudflare');

function wrangler(args, { json = false, silencio = false } = {}) {
  const salida = execFileSync('npx', ['--yes', 'wrangler', ...args], {
    env: entorno,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', silencio ? 'pipe' : 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  return json ? JSON.parse(salida.slice(salida.search(/[[{]/))) : salida;
}

function salida(clave, valor) {
  console.log(`${clave}=${valor}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

/** La cuenta es parte del proyecto: un recurso conocido de Divoox tiene que existir ahí. */
function comprobarCuenta() {
  try {
    wrangler(['deployments', 'list', '--name', WORKER_CONOCIDO], { silencio: true });
  } catch {
    throw new Error(
      `PARADA: el worker ${WORKER_CONOCIDO} no aparece; la sesión no está en la cuenta de Divoox (${CUENTA}). No se crea nada.`,
    );
  }
}

function bases() {
  return wrangler(['d1', 'list', '--json'], { json: true, silencio: true });
}

function sql(nombre, comando) {
  return wrangler(['d1', 'execute', nombre, '--remote', '--yes', '--json', '--command', comando], {
    json: true,
    silencio: true,
  });
}

/**
 * Las llaves de Stripe de la vista previa: SOLO de modo prueba (sk_test_/pk_test_). Una llave real
 * frena todo (además, el servidor la ignoraría en un sitio de pruebas: C-ENTORNOS-SEPARADOS).
 */
function llavesStripePrueba() {
  const sk = process.env.STRIPE_SECRET_KEY_PRUEBA ?? '';
  const pk = process.env.STRIPE_PUBLISHABLE_KEY_PRUEBA ?? '';
  if (!sk && !pk) return {};
  if (!/^(sk|rk)_test_/.test(sk) || !pk.startsWith('pk_test_'))
    throw new Error(
      'PROHIBIDO: las llaves de Stripe de una vista previa tienen que ser de modo prueba',
    );
  return { STRIPE_SECRET_KEY: sk, STRIPE_PUBLISHABLE_KEY: pk };
}

/** Stripe en MODO PRUEBA (la llave ya se revisó en llavesStripePrueba). */
async function stripe(sk, metodo, ruta, cuerpo) {
  const r = await fetch(`https://api.stripe.com/v1${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${sk}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: cuerpo ? new URLSearchParams(cuerpo) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Stripe (prueba) ${metodo} ${ruta}: ${d.error?.message ?? r.status}`);
  return d;
}

/** Borra los avisos de Stripe de prueba que apuntan a esta vista previa (solo los suyos). */
async function borrarAvisosStripe(sk, nombre) {
  const { data } = await stripe(sk, 'GET', '/webhook_endpoints?limit=100');
  for (const a of data.filter((x) => x.url === urlAvisoStripe(nombre)))
    await stripe(sk, 'DELETE', `/webhook_endpoints/${a.id}`);
}

/**
 * El aviso (webhook) de Stripe de prueba de la vista previa: el que acredita recargas y cobros.
 * Stripe entrega su secreto solo al crearlo, así que en cada publicación se rehace (uno por rama).
 */
async function avisoStripe(sk, nombre) {
  await borrarAvisosStripe(sk, nombre);
  const cuerpo = [
    ['url', urlAvisoStripe(nombre)],
    ['description', `Divoox vista previa ${nombre}`],
    ['metadata[tumbite]', 'vista-previa'],
    ...EVENTOS_STRIPE.map((e) => ['enabled_events[]', e]),
  ];
  const a = await stripe(sk, 'POST', '/webhook_endpoints', cuerpo);
  if (!String(a.secret ?? '').startsWith('whsec_'))
    throw new Error('Stripe no devolvió el secreto del aviso');
  if (a.livemode) throw new Error('PROHIBIDO: el aviso de la vista previa quedó en modo real');
  return a.secret;
}

async function esperarVersion(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${url}/datos/version?v=${Date.now()}`);
      const t = await r.text();
      if (r.ok && (commit === 'local' || t.includes(commit))) return t;
      if (r.status === 503) throw new Error(`la vista previa se bloqueó a sí misma: ${t}`);
    } catch (e) {
      if (String(e.message).includes('bloqueó')) throw e;
    }
    await new Promise((s) => setTimeout(s, 3000));
  }
  throw new Error(`${url} no sirvió la versión ${commit} en dos minutos`);
}

async function abrir() {
  if (!existsSync(join(paquete, '_worker.js')))
    throw new Error(
      `Falta el paquete ${paquete} (arma primero: bash scripts/empaquetar.sh pruebas)`,
    );
  const nombre = nombreVistaPrevia(rama);
  const url = urlVistaPrevia(nombre);
  const t0 = Date.now();
  comprobarCuenta();
  validarBaseVistaPrevia({ nombre });

  // 1) La base aparte (se crea una sola vez por rama; --reiniciar la rehace vacía).
  let base = bases().find((b) => b.name === nombre);
  if (base && reiniciar) {
    validarBaseVistaPrevia({ nombre, id: base.uuid });
    wrangler(['d1', 'delete', nombre, '--skip-confirmation'], { silencio: true });
    base = undefined;
  }
  const nueva = !base;
  if (nueva) {
    wrangler(['d1', 'create', nombre], { silencio: true });
    base = bases().find((b) => b.name === nombre);
    if (!base) throw new Error(`No apareció la base ${nombre} después de crearla`);
  }
  validarBaseVistaPrevia({ nombre, id: base.uuid });

  // 2) El esquema (igual que la plataforma en cada publicación: solo crea lo que falta) y la marca
  //    que el candado del servidor exige para atender.
  wrangler(['d1', 'execute', nombre, '--remote', '--yes', '--file', join(paquete, 'schema.sql')], {
    silencio: true,
  });
  sql(
    nombre,
    `INSERT INTO config (clave, valor) VALUES ('vista_previa_base', '${nombre}') ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
  );

  // 3) El almacén de archivos compartido de las vistas previas (se vacía solo a los 14 días).
  const almacenes = wrangler(['r2', 'bucket', 'list'], { silencio: true });
  // eslint-disable-next-line security/detect-non-literal-regexp -- ALMACEN es una constante fija
  if (!new RegExp(`name:\\s+${ALMACEN}\\b`).test(almacenes)) {
    wrangler(['r2', 'bucket', 'create', ALMACEN], { silencio: true });
    wrangler(
      [
        'r2',
        'bucket',
        'lifecycle',
        'add',
        ALMACEN,
        'vaciar-14-dias',
        '--expire-days',
        '14',
        '--force',
      ],
      { silencio: true },
    );
  }

  // 4) El worker con SU base y sin ninguna llave de producción.
  const dir = mkdtempSync(join(tmpdir(), 'vista-previa-'));
  try {
    writeFileSync(
      join(paquete, '.assetsignore'),
      ['_worker.js', 'schema.sql', 'yadominios.json', '.entorno', '.assetsignore'].join('\n'),
    );
    const config = configWorker({ nombre, idBase: base.uuid, paquete, commit });
    writeFileSync(join(dir, 'wrangler.json'), JSON.stringify(config, null, 2));
    const reloj = process.env.RELOJ_SECRETO_VISTA || randomBytes(24).toString('hex');
    const secretos = { RELOJ_SECRETO: reloj, ...llavesStripePrueba() };
    if (secretos.STRIPE_SECRET_KEY)
      secretos.STRIPE_WEBHOOK_SECRET = await avisoStripe(secretos.STRIPE_SECRET_KEY, nombre);
    writeFileSync(join(dir, 'secretos.json'), JSON.stringify(secretos));
    wrangler(
      [
        'deploy',
        '--config',
        join(dir, 'wrangler.json'),
        '--secrets-file',
        join(dir, 'secretos.json'),
      ],
      {
        silencio: true,
      },
    );
    if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${reloj}`);
    salida('reloj', reloj);
    salida('stripe', secretos.STRIPE_SECRET_KEY ? 'si' : 'no');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  await esperarVersion(url);
  salida('url', url);
  salida('base', nombre);
  salida('base_nueva', nueva ? 'si' : 'no');
  salida('segundos', Math.round((Date.now() - t0) / 1000));
}

async function cerrar() {
  const nombre = nombreVistaPrevia(rama);
  const { STRIPE_SECRET_KEY: sk } = llavesStripePrueba();
  if (sk) {
    await borrarAvisosStripe(sk, nombre);
    console.log(`aviso de Stripe de prueba de ${nombre} borrado`);
  }
  comprobarCuenta();
  validarBaseVistaPrevia({ nombre });
  try {
    wrangler(['delete', '--name', nombre, '--force'], { silencio: true });
    console.log(`worker ${nombre} borrado`);
  } catch {
    console.log(`worker ${nombre}: no existía`);
  }
  const base = bases().find((b) => b.name === nombre);
  if (base) {
    validarBaseVistaPrevia({ nombre, id: base.uuid });
    wrangler(['d1', 'delete', nombre, '--skip-confirmation'], { silencio: true });
    console.log(`base ${nombre} borrada`);
  } else console.log(`base ${nombre}: no existía`);
}

function listar() {
  for (const b of bases().filter((x) => x.name.startsWith(PREFIJO)))
    console.log(`${b.name}  ${urlVistaPrevia(b.name)}  creada ${b.created_at}`);
}

try {
  if (orden === 'abrir' && rama) await abrir();
  else if (orden === 'cerrar' && rama) await cerrar();
  else if (orden === 'listar') listar();
  else {
    console.error('Uso: vista-previa.mjs abrir|cerrar <rama> | listar');
    process.exit(2);
  }
} catch (e) {
  console.error(`::error::${e.message}`);
  process.exit(1);
}
