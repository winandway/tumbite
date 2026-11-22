// Capturas del buscador de arriba encontrando a una cuenta por su APELLIDO (C-BUSCADOR-APELLIDO) y de
// la pestaña «Sin enviar» de Verificaciones (C-VERIFICACIONES-SIN-ENVIAR) — 22 nov 2026, Gerencia.
// Contra el servidor LOCAL del recorrido (.recorrido; ver scripts/recorrido/preparar.mjs). NO toca el
// sitio de pruebas ni producción. Datos inventados y neutros, sin ciudades ni personas reales.
//
// Uso: node scripts/recorrido/capturas-buscador-sin-enviar.mjs
//   → ~/Documents/Entregas/Divoox/panel-buscador-y-sin-enviar/  (SALIDA_CAPTURAS la cambia)
// Termina con error si el apellido no encuentra a la cuenta o la pestaña no la trae.
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CIUDAD_NEUTRA } from './neutro.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA =
  process.env.SALIDA_CAPTURAS ||
  join(homedir(), 'Documents', 'Entregas', 'Divoox', 'panel-buscador-y-sin-enviar');
mkdirSync(SALIDA, { recursive: true });
const ZONA = 'VE-ZZ-EJEMPLO';

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.86.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = async (q) => {
  const d = await pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': DATOS.relojSecreto,
  });
  return d.filas ?? d.results ?? [];
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

await sql(
  `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
   VALUES ('${ZONA}', '${CIUDAD_NEUTRA.es}', 'VE', 'VES', 'America/Caracas', 8.6, -71.1, 20, 1)`,
);
// Cuentas recién creadas, sin confirmar el correo y sin fotos: lo que antes no se encontraba.
const NUEVAS = [
  [
    'conductor.nuevo.uno@recorrido.test',
    'Andrés José Peñalver Ejemplo',
    'repartidor',
    3,
    'VE-EJE-000041',
  ],
  [
    'conductor.nuevo.dos@recorrido.test',
    'Rosa Elena Campos Ejemplo',
    'repartidor',
    26,
    'VE-EJE-000042',
  ],
  [
    'conductor.nuevo.tres@recorrido.test',
    'Luis Alberto Mora Ejemplo',
    'repartidor',
    80,
    'VE-EJE-000043',
  ],
];
for (const [correo, nombre, rol, horas, codigo] of NUEVAS) {
  let id = (await sql(`SELECT id FROM usuarios WHERE correo = '${correo}'`))[0]?.id;
  if (!id)
    id = (
      await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo,
        clave: DATOS.clave,
        rol,
        idioma: 'es',
      })
    ).usuario.id;
  await sql(
    `UPDATE usuarios SET zona_id = '${ZONA}', telefono = '+584145550${String(horas).padStart(3, '0')}', creado_en = datetime('now', '-${horas} hours') WHERE id = '${id}'`,
  );
  await sql(
    `INSERT INTO repartidores (usuario_id, zona_id, codigo) VALUES ('${id}', '${ZONA}', '${codigo}')
     ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, codigo = excluded.codigo`,
  );
}

const reg = await pedir('POST', '/datos/cuentas/registro', {
  nombre: 'Divoox Soporte',
  correo: DATOS.correoEquipo,
  clave: DATOS.clave,
  rol: 'cliente',
  idioma: 'es',
}).catch(() => null);
const t0 =
  reg?.token ??
  (await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave }))
    .token;
await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, t0).catch(() => null);
const equipo = (
  await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
).token;
const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, equipo)).ruta;

const navegador = await chromium.launch();
const fallos = [];
for (const [idioma, ancho] of [
  ['es', 1440],
  ['en', 1440],
  ['es', 390],
]) {
  const ctx = await navegador.newContext({
    baseURL: URL,
    viewport: { width: ancho, height: ancho < 500 ? 844 : 900 },
    deviceScaleFactor: ancho < 500 ? 2 : 1,
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
  });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  await ctx.addCookies([
    { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const p = await ctx.newPage();
  const sufijo = `${idioma}${ancho < 500 ? '-celular' : ''}`;

  // 1) El buscador de arriba, solo con el apellido.
  await p.goto(`/panel/${ruta}`);
  await p.getByTestId('armazon').waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => null);
  if (ancho >= 500) {
    await p.keyboard.press('/');
    await p.keyboard.type('Peñalver', { delay: 40 });
    await espera(1500);
    const sale = await p.getByText('Andrés José', { exact: false }).count();
    if (!sale) fallos.push(`${sufijo}: el buscador no encontró a la cuenta por su apellido`);
    await p.screenshot({ path: join(SALIDA, `1-buscador-por-apellido-${sufijo}.png`) });
    console.log(`capturas: 1-buscador-por-apellido-${sufijo}.png`);
    await p.keyboard.press('Escape');
  }

  // 2) Verificaciones → «Sin enviar».
  await p.goto(`/panel/${ruta}/verifications`);
  await p.getByTestId('armazon').waitFor({ timeout: 60_000 });
  const pestana = p.getByRole('tab', { name: idioma === 'es' ? /^Sin enviar/ : /^Not submitted/ });
  await pestana.waitFor({ timeout: 30_000 });
  await p.screenshot({ path: join(SALIDA, `2-verificaciones-contador-${sufijo}.png`) });
  await pestana.click();
  await p.getByTestId('kyc-registro').first().waitFor({ timeout: 30_000 });
  await espera(600);
  const filas = await p.getByTestId('kyc-fila').count();
  if (filas < 3) fallos.push(`${sufijo}: «Sin enviar» trajo ${filas} filas, se esperaban 3 o más`);
  await p.screenshot({
    path: join(SALIDA, `3-verificaciones-sin-enviar-${sufijo}.png`),
    fullPage: true,
  });
  console.log(`capturas: 3-verificaciones-sin-enviar-${sufijo}.png`);
  // 3) Y buscando ahí mismo por el apellido.
  await p.getByRole('searchbox').last().fill('peñalver');
  await espera(1200);
  if ((await p.getByTestId('kyc-fila').count()) !== 1)
    fallos.push(`${sufijo}: la búsqueda por apellido en «Sin enviar» no dejó una sola fila`);
  await p.screenshot({ path: join(SALIDA, `4-sin-enviar-buscando-apellido-${sufijo}.png`) });
  await ctx.close();
}
await navegador.close();
console.log(fallos.length ? `capturas: FALLOS\n- ${fallos.join('\n- ')}` : 'capturas: todo salió');
if (fallos.length) process.exit(1);
