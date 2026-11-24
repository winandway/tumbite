// C-CAMPANA-SE-VACIA y C-CONTADORES-DE-TAREA (23 nov 2026, Richard) — todos los países. Comprueba EN
// PANTALLA, contra un servidor LOCAL propio, que la campana del superadmin va a cero al abrirla, sigue
// en cero al recargar y en otra sesión de la misma cuenta, y vuelve a contar con algo nuevo; y toma
// las capturas de la ayuda interna. NO toca el sitio de pruebas ni producción.
// Datos neutros: nombres de ejemplo y correos de ejemplo.com; ninguna persona real.
//   campana-abierta-<es|en> → la campana abierta: lo nuevo arriba con punto rojo, lo visto apagado
//   campana-menu-<es|en>    → el menú con los números de tarea (Tickets, Repartidores)
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_CAMPANA=8796 node scripts/recorrido/capturas-campana.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
// Otro puerto que el del recorrido (8790), por si otra sesión lo está usando.
const PUERTO = process.env.PUERTO_CAMPANA ?? '8796';
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
      'cf-connecting-ip': `10.86.0.${++ip % 250}`,
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
const comprobar = (ok, que) => {
  if (!ok) throw new Error(`NO: ${que}`);
  console.log(`ok: ${que}`);
};

const L = {
  es: {
    locale: 'es-US',
    conductor: ['Laura Gómez', 'laura.gomez.campana@ejemplo.com'],
    viejo: 'Cambio de dirección',
    nuevo: 'No llega mi pedido',
    otro: 'Pregunta sobre una propina',
    avisos: 'Avisos',
    sinLeer: (n) => `Avisos: ${n} sin leer`,
  },
  en: {
    locale: 'en-US',
    conductor: ['Laura Smith', 'laura.smith.campana@ejemplo.com'],
    viejo: 'Address change',
    nuevo: 'My order hasn’t arrived',
    otro: 'Question about a tip',
    avisos: 'Notifications',
    sinLeer: (n) => `Notifications: ${n} unread`,
  },
};
const comillas = (t) => t.replaceAll("'", "''");
const ticket = (id, asunto, estado, creado, actualizado) =>
  sql(
    `INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, estado, creado_en, actualizado_en)
     VALUES ('${id}', 'c-${id}', 'soporte', 'Cliente de ejemplo', 'cliente@ejemplo.com', '${comillas(asunto)}',
       '${estado}', datetime('now', '${creado}'), datetime('now', '${actualizado}'))`,
  );

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
  const entrar = async () =>
    (
      await pedir('POST', '/datos/cuentas/entrar', {
        correo: DATOS.correoEquipo,
        clave: DATOS.clave,
      })
    ).token;
  const token = await entrar();
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    await sql('DELETE FROM intentos_limite').catch(() => null);
    await sql('DELETE FROM campana_vista');
    await sql('DELETE FROM tickets');
    // Lo VIEJO: un ticket que ya se respondió (queda como historial, apagado y en verde).
    await ticket('t-viejo', T.viejo, 'respondido', '-2 days', '-1 days');
    const yaVisto = (await pedir('GET', '/datos/panel/avisos', undefined, token)).campana;
    await pedir(
      'POST',
      '/datos/campana/visto',
      { campana: 'superadmin', hasta: yaVisto.avisos[0].en },
      token,
    );
    // Lo NUEVO: un ticket abierto y un conductor que se registró sin ciudad.
    await ticket('t-nuevo', T.nuevo, 'abierto', '-12 minutes', '-12 minutes');
    const [nombre, correo] = T.conductor;
    const cond = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: DATOS.clave,
      rol: 'repartidor',
      idioma,
    }).catch(() => pedir('POST', '/datos/cuentas/entrar', { correo, clave: DATOS.clave }));
    const idCond =
      cond.usuario?.id ??
      (await pedir('GET', '/datos/cuentas/yo', undefined, cond.token)).usuario.id;
    await sql(
      `INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${idCond}', 'US-FL-MIAMI')
       ON CONFLICT(usuario_id) DO UPDATE SET zona_id = 'US-FL-MIAMI', ubicacion_en = NULL, ciudad_elegida_en = NULL`,
    );
    await sql(
      `UPDATE usuarios SET zona_id = NULL, creado_en = datetime('now', '-40 minutes') WHERE id = '${idCond}'`,
    );

    const contexto = async () => {
      const ctx = await navegador.newContext({
        baseURL: URL,
        viewport: { width: 1180, height: 760 },
        deviceScaleFactor: 1,
        locale: T.locale,
      });
      await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
      await ctx.addCookies([
        { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
      ]);
      return ctx;
    };
    const ctx = await contexto();
    const s = await ctx.newPage();
    const privada = async (nombre) => {
      const png = join(ORIGINALES_PRIVADAS, `campana-${nombre}-${idioma}.png`);
      await s.screenshot({ path: png });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `campana-${nombre}-${idioma}.webp`),
      ]);
      console.log(`captura: campana-${nombre}-${idioma}`);
    };
    const campana = () => s.getByTestId('campana');
    const numero = () => s.locator('.pd-campana-numero').count();

    // 1. Llegan dos avisos nuevos: la campana dice 2 y el menú, sus tareas.
    await s.goto(`/panel/${ruta}`);
    await s.getByRole('button', { name: T.sinLeer(2) }).waitFor({ timeout: 60_000 });
    await s.getByTestId('pendiente-drivers').waitFor({ timeout: 30_000 });
    await espera(600);
    await privada('menu');

    // 2. Abrirla: cero en ese momento, lo nuevo resaltado arriba y lo visto apagado abajo.
    await campana().click();
    await s.locator('.pd-aviso-nuevo').first().waitFor({ timeout: 10_000 });
    comprobar((await numero()) === 0, `${idioma}: al abrir la campana el número va a cero`);
    comprobar(
      (await s.locator('.pd-aviso-nuevo').count()) === 2,
      `${idioma}: dos avisos resaltados`,
    );
    comprobar((await s.locator('.pd-aviso-leido').count()) === 1, `${idioma}: uno como historial`);
    await espera(500);
    await privada('abierta');
    const filas = await sql('SELECT COUNT(*) AS n FROM campana_vista');
    console.log(
      `escrituras: filas en campana_vista = ${JSON.stringify(filas.resultados ?? filas)}`,
    );

    // 3. Recargar: sigue en cero (lo guardó el servidor), y los números del menú siguen (son tareas).
    await s.reload();
    await campana().waitFor({ timeout: 60_000 });
    await s.getByTestId('pendiente-drivers').waitFor({ timeout: 30_000 });
    await espera(1500);
    comprobar((await numero()) === 0, `${idioma}: al recargar sigue en cero`);
    comprobar(
      (await s.getByTestId('pendiente-tickets').count()) === 1,
      `${idioma}: el número de Tickets sigue (abrir la campana no hace la tarea)`,
    );

    // 4. La misma cuenta en otro contexto del navegador (otra computadora): también en cero.
    const ctx2 = await contexto();
    const s2 = await ctx2.newPage();
    await s2.goto(`/panel/${ruta}`);
    await s2.getByTestId('pendiente-drivers').waitFor({ timeout: 60_000 });
    await espera(1500);
    comprobar(
      (await s2.locator('.pd-campana-numero').count()) === 0,
      `${idioma}: en otro contexto de la misma cuenta, también en cero`,
    );
    await ctx2.close();

    // 5. Llega algo NUEVO: vuelve a contar uno.
    await ticket('t-otro', T.otro, 'abierto', '+5 seconds', '+5 seconds');
    await s.reload();
    await s.getByRole('button', { name: T.sinLeer(1) }).waitFor({ timeout: 60_000 });
    comprobar(true, `${idioma}: un aviso nuevo vuelve a contar uno`);

    // 6. La tarea: ponerle la ciudad al conductor baja el número de «Repartidores».
    await pedir(
      'PUT',
      `/datos/admin/conductores/${idCond}/ciudad`,
      { zonaId: 'US-FL-MIAMI', motivo: 'Confirmó su ciudad' },
      token,
    );
    await s.reload();
    await s.getByTestId('pendiente-tickets').waitFor({ timeout: 60_000 });
    await espera(1500);
    comprobar(
      (await s.getByTestId('pendiente-drivers').count()) === 0,
      `${idioma}: al ponerle la ciudad, el número de Repartidores baja a cero`,
    );
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('campana comprobada en pantalla; capturas en la carpeta privada de la ayuda interna');
