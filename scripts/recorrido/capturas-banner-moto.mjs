// Capturas del banner de mototaxi del inicio de la app del cliente (C-BANNER-MOTO, 22 nov 2026,
// Richard vía Gerencia). Contra el servidor LOCAL del recorrido (.recorrido; ver preparar.mjs) con la
// zona de Venezuela armada (scripts/staging/probar-moto-venezuela.mjs contra ese servidor). NO toca el
// sitio de pruebas ni producción.
//
// Hace lo mismo que el equipo en «Banners de la app»: sube la imagen, crea el banner de promociones
// (español e inglés, lleva a pedir un viaje en moto, sin ciudades marcadas) y lo aprueba. Después lo
// fotografía en el inicio del cliente, en tamaño de celular: en la ciudad con Moto abierto (español e
// inglés), al tocarlo, y en una ciudad sin Moto (no sale: C-BANNER-SEGUN-SERVICIO). Las ciudades
// salen con nombre de ejemplo y se devuelven a su nombre al terminar.
//
// Uso: node scripts/recorrido/capturas-banner-moto.mjs
//   → ~/Documents/Entregas/Divoox/banner-moto-clientes/ (SALIDA_CAPTURAS=<carpeta> para otra)
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA =
  process.env.SALIDA_CAPTURAS ||
  join(homedir(), 'Documents', 'Entregas', 'Divoox', 'banner-moto-clientes');
mkdirSync(SALIDA, { recursive: true });
const IMAGEN = join(RAIZ, 'docs', 'capturas', 'banners', 'banner-moto.webp');
export const BANNER_MOTO = {
  lugar: 'promociones',
  tituloEs: 'Tu mototaxi, en minutos',
  tituloEn: 'Your moto taxi, in minutes',
  textoEs: 'Divoox Moto',
  textoEn: 'Divoox Moto',
  destinoTipo: 'servicio',
  destinoValor: 'moto',
  codigo: '',
  zonas: [],
  paises: [],
  inicio: null,
  fin: null,
  peso: 1,
  orden: 0,
  idea: 'Banner de mototaxi con la moto del inicio de la app',
};
const CON_MOTO = { id: 'VE-MER-ELVIGIA', lat: 8.6219, lng: -71.6506 };
const SIN_MOTO = { id: 'US-FL-MIAMI', lat: 25.7617, lng: -80.1918 };

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const binario = cuerpo instanceof Uint8Array;
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': binario ? 'image/webp' : 'application/json',
      'cf-connecting-ip': `10.84.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : binario ? cuerpo : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = async (q) =>
  (
    await pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
      'x-reloj-secreto': DATOS.relojSecreto,
    })
  ).results ?? [];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── El equipo y un cliente de ejemplo ─────────
async function cuenta(correo, nombre) {
  const reg = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: DATOS.clave,
    rol: 'cliente',
    idioma: 'es',
  }).catch(() => null);
  return (reg ?? (await pedir('POST', '/datos/cuentas/entrar', { correo, clave: DATOS.clave })))
    .token;
}
const t0 = await cuenta(DATOS.correoEquipo, 'Divoox Soporte');
await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, t0).catch(() => null);
const equipo = (
  await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
).token;
const cliente = await cuenta('cliente.banner@recorrido.test', 'Cliente Ejemplo');
const [yo] = await sql("SELECT id FROM usuarios WHERE correo = 'cliente.banner@recorrido.test'");

// ───────── Las ciudades con nombre de ejemplo (se devuelven al final) ─────────
const nombres = await sql(
  `SELECT id, nombre FROM zonas WHERE id IN ('${CON_MOTO.id}', '${SIN_MOTO.id}')`,
);
await sql(`UPDATE zonas SET nombre = 'Ciudad de ejemplo' WHERE id = '${CON_MOTO.id}'`);
await sql(`UPDATE zonas SET nombre = 'Otra ciudad de ejemplo' WHERE id = '${SIN_MOTO.id}'`);

const navegador = await chromium.launch();
let n = 0;
const lista = [];
async function foto(p, nombre) {
  await espera(900);
  const archivo = `${String(++n).padStart(2, '0')}-${nombre}.png`;
  await p.screenshot({ path: join(SALIDA, archivo) });
  lista.push(archivo);
  console.log(`✓ ${archivo}`);
}

try {
  // ───────── 1 · El banner, como en «Banners de la app» ─────────
  const viejos = await pedir('GET', '/datos/admin/banners', undefined, equipo);
  for (const b of viejos.banners.filter((x) => x.tituloEs === BANNER_MOTO.tituloEs))
    await pedir('DELETE', `/datos/admin/banners/${b.id}`, undefined, equipo);
  const { url: imagen } = await pedir(
    'POST',
    '/datos/admin/banners/imagen',
    new Uint8Array(readFileSync(IMAGEN)),
    equipo,
  );
  const { banner } = await pedir(
    'POST',
    '/datos/admin/banners',
    { ...BANNER_MOTO, imagen },
    equipo,
  );
  await pedir('POST', `/datos/admin/banners/${banner.id}/publicar`, {}, equipo);

  // El panel: la lista de banners con el de moto publicado.
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, equipo)).ruta;
  {
    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1366, height: 900 },
      locale: 'es-VE',
    });
    await ctx.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const p = await ctx.newPage();
    await p.goto(`/panel/${ruta}/banners`);
    await p.getByTestId('armazon').waitFor({ timeout: 60_000 });
    await p.getByText(BANNER_MOTO.tituloEs).first().waitFor({ timeout: 30_000 });
    await p.waitForLoadState('networkidle').catch(() => null);
    await foto(p, 'panel-banners-de-la-app');
    await ctx.close();
  }

  // ───────── 2 · El inicio del cliente en el celular ─────────
  const telefono = async (idioma, punto) => {
    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
      geolocation: { latitude: punto.lat, longitude: punto.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [cliente, yo?.id ?? '', idioma],
    );
    const p = await ctx.newPage();
    await p.goto(`/app?lat=${punto.lat}&lng=${punto.lng}`);
    await p.getByTestId('servicios-inicio').waitFor({ timeout: 60_000 });
    await p.waitForLoadState('networkidle').catch(() => null);
    await espera(1500);
    return { ctx, p };
  };

  for (const idioma of ['es', 'en']) {
    const { ctx, p } = await telefono(idioma, CON_MOTO);
    await foto(p, `inicio-arriba-${idioma}`);
    const promo = p.getByTestId('inicio-promos');
    await promo.waitFor({ timeout: 30_000 });
    // Los ocho íconos y el banner en la misma pantalla: así se ve que no los tapa ni los empuja.
    await p.getByTestId('servicios-inicio').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await espera(600);
    await foto(p, `inicio-iconos-y-banner-${idioma}`);
    await promo.screenshot({ path: join(SALIDA, `banner-de-cerca-${idioma}.png`) });
    lista.push(`banner-de-cerca-${idioma}.png`);
    await promo.getByRole('button').first().click();
    await p.waitForURL(/\/ride/, { timeout: 30_000 });
    await p.waitForLoadState('networkidle').catch(() => null);
    await espera(2000);
    await foto(p, `al-tocarlo-pedir-moto-${idioma}`);
    await ctx.close();
  }

  // ───────── 3 · Donde Moto no funciona, el banner no sale ─────────
  {
    const { ctx, p } = await telefono('es', SIN_MOTO);
    await p.getByTestId('servicios-inicio').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await espera(600);
    if (await p.getByTestId('inicio-promos').count())
      throw new Error('El banner de moto salió en una ciudad sin Moto.');
    await foto(p, 'ciudad-sin-moto-no-sale-es');
    await ctx.close();
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const z of nombres)
    await sql(
      `UPDATE zonas SET nombre = '${String(z.nombre).replace(/'/g, "''")}' WHERE id = '${z.id}'`,
    );
  await navegador.close();
}
console.log(`capturas-banner-moto: ${lista.length} capturas en ${SALIDA}`);
