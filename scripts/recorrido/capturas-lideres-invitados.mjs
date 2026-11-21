// Capturas REALES de «Líderes invitados» (C-LIDER-INVITADO) para la AYUDA INTERNA del panel — todos
// los países. Arma un servidor LOCAL propio (carpeta .recorrido, solo servidor + el panel ya
// compilado), lo enciende, toma las capturas y lo apaga. NO toca el sitio de pruebas ni producción.
// Datos neutros: «Línea Ejemplo», «Ciudad de ejemplo», teléfonos imposibles; ninguna ciudad ni persona real.
//   lineas-super-invitar-<es|en>    → la solicitud con el aviso «Ese líder todavía no tiene cuenta» y «Invitar al líder»
//   lineas-super-invitados-<es|en>  → la sección «Líderes invitados» con el enlace para mandarle
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Antes: npm run build -w @tumbite/panel
// Uso: node scripts/recorrido/capturas-lideres-invitados.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection, no-undef -- guion local: carpetas fijas del repositorio y de la carpeta privada; `document` corre dentro del navegador */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const PUERTO = '8791';
const DIR = join(RAIZ, '.recorrido');
execSync('node scripts/recorrido/preparar.mjs', {
  cwd: RAIZ,
  stdio: 'inherit',
  env: { ...process.env, SOLO_SERVIDOR: '1', PUERTO_RECORRIDO: PUERTO },
});
cpSync(join(RAIZ, 'apps/panel/dist'), join(DIR, 'sitio'), { recursive: true });
const DATOS = JSON.parse(readFileSync(join(DIR, 'datos.json'), 'utf8'));
const URL = DATOS.url;
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });

const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    PUERTO,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);
const apagar = () => {
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.83.0.${++ip % 250}`,
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
    'x-reloj-secreto': DATOS.relojSecreto,
  });

const L = {
  es: {
    zona: 'ZZ-EJEMPLO-ES',
    ciudad: 'Ciudad de ejemplo',
    pais: 'VE',
    moneda: 'VES',
    tz: 'America/Caracas',
    locale: 'es-US',
    solicitud: [
      'Línea Ejemplo',
      'Laura Pérez',
      '+58 414 000 0001',
      'Rosa Pérez',
      '+58 414 000 0002',
    ],
    otra: [
      'Línea Centro',
      'Héctor Medina',
      '+58 414 000 0003',
      'Gloria Medina',
      '+58 414 000 0004',
    ],
    aprobar: 'Aprobar y crear la línea',
  },
  en: {
    zona: 'ZZ-EJEMPLO-EN',
    ciudad: 'Example city',
    pais: 'US',
    moneda: 'USD',
    tz: 'America/Detroit',
    locale: 'en-US',
    solicitud: ['Example Line', 'Laura Smith', '+1 555 010 0001', 'Rose Smith', '+1 555 010 0002'],
    otra: ['Downtown Line', 'Henry Adams', '+1 555 010 0003', 'Grace Adams', '+1 555 010 0004'],
    aprobar: 'Approve and create the line',
  },
};

let navegador;
try {
  for (let i = 0; ; i++) {
    const ok = await fetch(`${URL}/datos/salud`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2000);
  }
  const reg = await pedir('POST', '/datos/cuentas/registro', {
    nombre: 'Divoox Soporte',
    correo: DATOS.correoEquipo,
    clave: DATOS.clave,
    rol: 'cliente',
    idioma: 'es',
  });
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token);
  const dueno = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, dueno)).ruta;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    await sql('DELETE FROM solicitudes_linea');
    await sql('DELETE FROM invitaciones_lider');
    await sql('DELETE FROM intentos_limite').catch(() => null);
    await sql(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('${T.zona}', '${T.ciudad}', '${T.pais}', '${T.moneda}', '${T.tz}', 0, 0, 20, 1)`,
    );
    const solicitar = (
      [nombre, liderNombre, liderTelefono, contacto2Nombre, contacto2Telefono],
      tipo,
    ) =>
      pedir('POST', '/datos/publico/lineas/solicitud', {
        nombre,
        zonaId: T.zona,
        tipo,
        conductores: 24,
        liderNombre,
        liderTelefono,
        contacto2Nombre,
        contacto2Telefono,
      });
    // Una línea ya invitada (para que la sección exista) y otra por aprobar (para ver el aviso).
    await solicitar(T.otra, 'taxi');
    const primera = (await pedir('GET', '/datos/admin/lineas-solicitudes', undefined, dueno))
      .solicitudes[0];
    await pedir(
      'POST',
      `/datos/admin/lineas-solicitudes/${primera.id}/aprobar`,
      { invitar: true },
      dueno,
    );
    await solicitar(T.solicitud, 'mototaxi');

    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1000, height: 900 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: dueno, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    // El enlace para el líder sale de la dirección del servidor que atiende (aquí, la computadora).
    // En la captura va el del sitio público, que es el que el equipo ve en producción.
    await s.route('**/datos/admin/lineas-invitaciones', async (r) => {
      const res = await r.fetch();
      await r.fulfill({
        response: res,
        json: { ...(await res.json()), enlace: 'https://divoox.com/driver' },
      });
    });
    await s.goto(`/panel/${ruta}/lines`);
    await s.getByTestId('lineas-solicitudes').waitFor({ timeout: 60_000 });
    const privada = async (clip, nombre) => {
      const png = join(ORIGINALES_PRIVADAS, `lineas-super-${nombre}-${idioma}.png`);
      await s.screenshot({ path: png, clip, fullPage: true });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `lineas-super-${nombre}-${idioma}.webp`),
      ]);
      console.log(
        `lineas-super-${nombre}-${idioma}: ${Math.round(clip.width)}×${Math.round(clip.height)}`,
      );
    };
    /** El rectángulo de la página que va del primer elemento al último, con un margen. */
    const caja = (desde, hasta) =>
      s.evaluate(
        ([a, b]) => {
          const r1 = document.querySelector(a).getBoundingClientRect();
          const r2 = document.querySelector(b).getBoundingClientRect();
          const x = Math.min(r1.left, r2.left) - 12;
          const y = r1.top + scrollY - 12;
          return {
            x,
            y,
            width: Math.max(r1.right, r2.right) - x + 12,
            height: r2.bottom + scrollY - y + 12,
          };
        },
        [desde, hasta],
      );

    // 1. Aprobar una solicitud cuyo líder no tiene cuenta: sale el aviso con «Invitar al líder».
    await s
      .getByTestId('lineas-solicitudes')
      .getByRole('button', { name: T.aprobar, exact: true })
      .click();
    await s.getByTestId('lineas-invitar-lider').waitFor({ timeout: 30_000 });
    await espera(700);
    await privada(
      await caja('[data-testid="lineas-solicitudes"]', '[data-testid="lineas-solicitudes"]'),
      'invitar',
    );
    // 2. Tocar «Invitar al líder»: la línea pasa a «Líderes invitados», con el enlace para mandarle.
    await s.getByTestId('lineas-invitar-lider').getByRole('button').click();
    await s.getByTestId('lineas-invitados').locator('li').nth(1).waitFor({ timeout: 30_000 });
    await s.evaluate(() => {
      // El título de la sección es el h3 que va justo antes de la explicación y del enlace.
      const lista = document.querySelector('[data-testid="lineas-invitados"]');
      let e = lista.previousElementSibling;
      while (e && e.tagName !== 'H3') e = e.previousElementSibling;
      e?.setAttribute('data-captura', 'titulo-invitados');
    });
    await espera(700);
    await privada(
      await caja('[data-captura="titulo-invitados"]', '[data-testid="lineas-invitados"]'),
      'invitados',
    );
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('capturas de «Líderes invitados» listas en la carpeta privada de la ayuda interna');
