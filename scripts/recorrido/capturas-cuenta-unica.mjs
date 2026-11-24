/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y llaves de idioma fijas «es» y «en»; `localStorage` corre dentro del navegador */
// C-CUENTA-UNICA (24 nov 2026, Richard) — todos los países. Prueba EN PANTALLA, con las apps web reales
// (/app y /driver) y el panel web contra el servidor LOCAL del recorrido (.recorrido; antes:
// node scripts/recorrido/preparar.mjs), de la cuenta única. Cada paso lleva su comprobación:
//   1. Un conductor entra a la app de clientes con su correo: la app ofrece «Activar mi cuenta de
//      cliente» (sin cuenta nueva); al activarla entra como cliente.
//   2. Un cliente entra a Divoox Driver: «Empezar mi registro de conductor».
//   3. En el panel web, la misma persona ve «Mis restaurantes», registra uno y trabaja con él.
//   4. El superadmin: «Unir dos cuentas de la misma persona» (para la ayuda interna, fuera del repo).
// Español con ejemplos de habla hispana; inglés con ejemplos de Estados Unidos (C-CAPTURAS-POR-IDIOMA).
// Nombres neutros, correos de ejemplo y números 555, sin ciudades (C-DOCS-SIN-DATOS-REALES).
//   → docs/capturas/cuenta-unica/<nombre>-<es|en>.png
//   → apps/panel/public/docs/recorrido-cuenta-unica-<nombre>-<es|en>.webp (Docs públicos)
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas}/cuenta-unica-<nombre>-<es|en> (ayuda interna)
// Uso: node scripts/recorrido/capturas-cuenta-unica.mjs
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'cuenta-unica');
const DOCS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
for (const d of [SALIDA, DOCS, ORIGINALES_PRIVADAS, CAPTURAS_PRIVADAS])
  mkdirSync(d, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    new globalThis.URL(URL).port,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.87.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
function comprobar(cond, paso, evidencia) {
  if (!cond) throw new Error(`FALLA ${paso}: ${evidencia}`);
  console.log(`  ✓ ${paso}: ${evidencia}`);
}

const L = {
  es: {
    locale: 'es-US',
    conductor: ['Laura Pérez', 'laura.perez@ejemplo.com', '+584145550142'],
    cliente: ['Daniel Rojas', 'daniel.rojas@ejemplo.com', '+584145550177'],
    restaurante: 'Pizzería La Esquina',
    correo: 'Correo',
    clave: 'Contraseña',
    entrar: 'Entrar',
    activarCliente: 'Activar mi cuenta de cliente',
    activarConductor: 'Empezar mi registro de conductor',
    registrar: 'Registrar mi restaurante',
    nombreRest: 'Nombre del restaurante',
    revisar: 'Revisar',
    conductorId: 'Número de la cuenta de conductor',
    clienteId: 'Número de la cuenta de cliente',
  },
  en: {
    locale: 'en-US',
    conductor: ['Jamie Lee', 'jamie.lee@example.com', '+12485550142'],
    cliente: ['Taylor Brooks', 'taylor.brooks@example.com', '+12485550177'],
    restaurante: 'Corner Pizza Co.',
    correo: 'Email',
    clave: 'Password',
    entrar: 'Sign in',
    activarCliente: 'Activate my customer account',
    activarConductor: 'Start my driver sign-up',
    registrar: 'Register my restaurant',
    nombreRest: 'Restaurant name',
    revisar: 'Review',
    conductorId: 'Driver account ID',
    clienteId: 'Customer account ID',
  },
};

function webp(nombre, idioma) {
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    '-resize',
    '540',
    '0',
    join(SALIDA, `${nombre}-${idioma}.png`),
    '-o',
    join(DOCS, `recorrido-cuenta-unica-${nombre}-${idioma}.webp`),
  ]);
  console.log(`  → recorrido-cuenta-unica-${nombre}-${idioma}.webp`);
}

let navegador;
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${URL}/datos/salud`).then(
        () => true,
        () => false,
      )
    )
      break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2_000);
  }
  navegador = await chromium.launch();
  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    console.log(`— ${idioma}`);
    // El correo de ejemplo de una pasada anterior se aparta (el correo es único).
    const crear = async ([nombre, correo, telefono], rol, app) => {
      await sql(
        `UPDATE usuarios SET correo = id || '@apartado.test', correo_canonico = NULL, telefono = NULL, telefono_canonico = NULL WHERE correo = '${correo}'`,
      );
      await sql(
        `UPDATE usuarios SET telefono = NULL, telefono_canonico = NULL WHERE telefono_canonico = '${telefono}'`,
      );
      const r = await pedir(
        'POST',
        '/datos/cuentas/registro',
        { nombre, correo, clave: DATOS.clave, rol, idioma, telefono },
        undefined,
        { 'x-tumbite-app': `${app}/0.1.70 web` },
      );
      await sql(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now'), telefono_verificado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
      );
      return { token: r.token, id: r.usuario.id, correo };
    };
    const movil = async () => {
      const ctx = await navegador.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        baseURL: URL,
        locale: T.locale,
      });
      await ctx.addInitScript((i) => {
        localStorage.clear();
        localStorage.setItem('tumbite.idioma', i);
      }, idioma);
      return ctx;
    };
    const foto = async (p, nombre) => {
      await espera(600);
      await p.screenshot({ path: join(SALIDA, `${nombre}-${idioma}.png`) });
      webp(nombre, idioma);
    };
    const entrarEnApp = async (p, ruta, correo) => {
      await p.goto(ruta);
      await p.getByLabel(T.correo, { exact: true }).first().waitFor({ timeout: 90_000 });
      await p.getByLabel(T.correo, { exact: true }).first().fill(correo);
      await p.getByLabel(T.clave, { exact: true }).first().fill(DATOS.clave);
      await p.getByText(T.entrar, { exact: true }).last().click();
      await p.getByTestId('activar-papel').waitFor({ timeout: 30_000 });
    };

    // 1. El conductor en la app de clientes.
    const conductor = await crear(T.conductor, 'repartidor', 'repartidor');
    const ctx1 = await movil();
    const p1 = await ctx1.newPage();
    await entrarEnApp(p1, '/app/account', conductor.correo);
    await p1.getByText(T.activarCliente).first().waitFor();
    await foto(p1, 'activar-cliente');
    await p1.getByTestId('activar-papel-casilla').click();
    await p1.getByTestId('activar-papel-boton').click();
    await p1.getByTestId('activar-papel').waitFor({ state: 'detached', timeout: 30_000 });
    const papeles = await sql(
      `SELECT papel FROM usuario_papeles WHERE usuario_id = '${conductor.id}'`,
    );
    comprobar(
      JSON.stringify(papeles).includes('cliente'),
      'la misma cuenta ya tiene su papel de cliente',
      conductor.id,
    );
    await espera(2_500);
    await foto(p1, 'cliente-listo');
    await ctx1.close();

    // 2. El cliente en Driver.
    const cliente = await crear(T.cliente, 'cliente', 'cliente');
    const ctx2 = await movil();
    const p2 = await ctx2.newPage();
    await entrarEnApp(p2, '/driver/', cliente.correo);
    await p2.getByText(T.activarConductor).first().waitFor();
    await foto(p2, 'activar-conductor');
    await ctx2.close();

    // 3. El panel web de la misma persona (el cliente): sus restaurantes.
    const web = await pedir('POST', '/datos/cuentas/entrar', {
      correo: cliente.correo,
      clave: DATOS.clave,
    });
    const ctx3 = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1280, height: 860 },
      locale: T.locale,
    });
    await ctx3.addInitScript((i) => {
      localStorage.clear();
      localStorage.setItem('tumbite.idioma', i);
    }, idioma);
    await ctx3.addCookies([
      { name: 'tumbite_sesion', value: web.token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const p3 = await ctx3.newPage();
    await p3.goto('/panel');
    await p3.getByTestId('mis-restaurantes').waitFor({ timeout: 60_000 });
    await foto(p3, 'mis-restaurantes');
    await p3.getByText(T.registrar, { exact: true }).first().click();
    await p3.getByLabel(T.nombreRest).fill(T.restaurante);
    await p3.locator('[data-testid="form-registrar-restaurante"] input[type="checkbox"]').check();
    await foto(p3, 'registrar');
    await p3.locator('[data-testid="form-registrar-restaurante"] button[type="submit"]').click();
    await p3.getByTestId('barra-negocio').waitFor({ timeout: 60_000 });
    comprobar(
      (await p3.getByTestId('barra-negocio').textContent())?.includes(T.restaurante),
      'el panel trabaja con el restaurante nuevo',
      T.restaurante,
    );
    await foto(p3, 'trabajando-con');
    await ctx3.close();

    // 4. El superadmin (ayuda interna, fuera del repositorio).
    const reg = await pedir('POST', '/datos/cuentas/registro', {
      nombre: 'Divoox Soporte',
      correo: DATOS.correoEquipo,
      clave: DATOS.clave,
      rol: 'cliente',
      idioma: 'es',
    }).catch(() => null);
    if (reg)
      await pedir(
        'POST',
        '/datos/cuentas/hacer-admin',
        { semilla: DATOS.semilla },
        reg.token,
      ).catch(() => null);
    const eq = await pedir('POST', '/datos/cuentas/entrar', {
      correo: DATOS.correoEquipo,
      clave: DATOS.clave,
    }).catch(() => null);
    if (eq) {
      const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, eq.token)).ruta;
      const otro = await crear(
        // Otra cuenta de cliente con OTRO celular: la revisión dice por qué no se pueden unir.
        [
          T.cliente[0],
          `otra.${randomBytes(3).toString('hex')}@ejemplo.com`,
          T.cliente[2].replace(/77$/, '99'),
        ],
        'cliente',
        'cliente',
      );
      const ctx4 = await navegador.newContext({
        baseURL: URL,
        viewport: { width: 1440, height: 900 },
        locale: T.locale,
      });
      await ctx4.addInitScript((i) => {
        localStorage.clear();
        localStorage.setItem('tumbite.idioma', i);
      }, idioma);
      await ctx4.addCookies([
        { name: 'tumbite_sesion', value: eq.token, domain: 'localhost', path: '/', httpOnly: true },
      ]);
      const p4 = await ctx4.newPage();
      await p4.goto(`/panel/${ruta}/customers`);
      const form = p4.getByTestId('form-unir-cuentas');
      await form.waitFor({ timeout: 60_000 });
      await p4.getByLabel(T.conductorId).fill(conductor.id);
      await p4.getByLabel(T.clienteId).fill(otro.id);
      const privada = async (nombre) => {
        await form.scrollIntoViewIfNeeded();
        await espera(500);
        const png = join(ORIGINALES_PRIVADAS, `cuenta-unica-${nombre}-${idioma}.png`);
        await form.screenshot({ path: png });
        execFileSync('cwebp', [
          '-quiet',
          '-q',
          '82',
          png,
          '-o',
          join(CAPTURAS_PRIVADAS, `cuenta-unica-${nombre}-${idioma}.webp`),
        ]);
        console.log(`  → ayuda interna: cuenta-unica-${nombre}-${idioma}.webp`);
      };
      await privada('revisar');
      await p4.getByText(T.revisar, { exact: true }).click();
      await p4.getByTestId('unir-frenos').waitFor({ timeout: 30_000 });
      await privada('frenos');
      await ctx4.close();
    } else console.log('  (sin cuenta del equipo en esta base: la captura del panel se salta)');
  }
  console.log('capturas: todo salió');
} finally {
  await navegador?.close();
  try {
    process.kill(-servidor.pid);
  } catch {
    // ya estaba apagado
  }
}
