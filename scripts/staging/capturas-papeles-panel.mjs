#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- guion de la Mac del equipo: carpetas y nombres fijos del propio guion, sin entrada de terceros */
// C-PLAZO-PAPELES (20 nov 2026): fotografía en el SITIO DE PRUEBAS las pantallas del superadmin del
// plazo de papeles, con los conductores de ejemplo que deja sembrar-papeles-capturas.mjs (córrelo
// antes). Datos neutros: solo ven «… Ejemplo» de la ciudad de pruebas de Caracas.
//   1. Cuatro capturas de la ayuda interna: papeles-{lista,comprobaciones,pedir,politica}-{es,en}
//      → PNG originales en ~/Divoox-privado/ayuda-interna/originales y WebP en .../capturas.
//   2. Las pantallas completas, numeradas, en PNG para la entrega:
//      ~/Documents/Entregas/Divoox/driver-plazo-de-papeles/panel/{es,en}/
// Entra por la API con la cuenta de soporte de pruebas (la cookie de sesión), sin escribir claves
// en la página. No manda nada ni cambia ninguna configuración: solo lee y escribe en casillas
// sin guardar.
// Uso: node scripts/staging/capturas-papeles-panel.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const URL_PRUEBAS = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO ?? 'Demo2026!';
const ENTREGA = join(
  homedir(),
  'Documents',
  'Entregas',
  'Divoox',
  'driver-plazo-de-papeles',
  'panel',
);
for (const d of [CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS, join(ENTREGA, 'es'), join(ENTREGA, 'en')])
  mkdirSync(d, { recursive: true });

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const equipo = await api('POST', '/datos/cuentas/entrar', {
  correo: 'demo.soporte@ejemplo.com',
  clave: CLAVE,
});
const ruta = (await api('GET', '/datos/admin/ruta', undefined, equipo.token)).ruta;
const idDe = async (correo) =>
  (await api('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE })).usuario.id;
const ANDRES = await idDe('ejemplo.andres.vz@ejemplo.com'); // todo enviado
const SOFIA = await idDe('ejemplo.sofia.vz@ejemplo.com'); // a medias

// Para que la lista tenga estados distintos: Sofía queda con 6 días (por vencer), los demás con 30.
await api('POST', `/datos/admin/verificacion/${SOFIA}/plazo`, { dias: 6 }, equipo.token);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hechas = [];
const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const pre = idioma === 'es' ? '/es' : '';
    const ctx = await navegador.newContext({
      viewport: { width: 1440, height: 1000 },
      baseURL: URL_PRUEBAS,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: equipo.token, url: URL_PRUEBAS, httpOnly: true },
    ]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    let n = 0;
    /** El recorte de un elemento con la cabecera fija fuera del cuadro (si no, la tapa por arriba). */
    const recortar = async (elemento, completa, ruta) => {
      if (!elemento) return p.screenshot({ path: ruta, ...(completa ? { fullPage: true } : {}) });
      await p.setViewportSize({ width: 1440, height: 1500 });
      await elemento.evaluate((x) =>
        globalThis.scrollTo(0, x.getBoundingClientRect().top + globalThis.scrollY - 90),
      );
      await espera(500);
      const c = await elemento.boundingBox();
      await p.screenshot({
        path: ruta,
        clip: { x: c.x, y: c.y, width: c.width, height: Math.min(c.height, 1400) },
      });
      await p.setViewportSize({ width: 1440, height: 1000 });
    };
    /** Guarda la captura numerada de la entrega y, si lleva nombre de ayuda, el PNG y la WebP. */
    const foto = async (nombre, { ayuda, elemento, completa } = {}) => {
      n += 1;
      const archivo = join(ENTREGA, idioma, `${String(n).padStart(2, '0')}-${nombre}.png`);
      const tomar = (ruta) => recortar(elemento, completa, ruta);
      await tomar(archivo);
      hechas.push(archivo);
      if (ayuda) {
        const png = join(ORIGINALES_PRIVADAS, `papeles-${ayuda}-${idioma}.png`);
        await tomar(png);
        execFileSync('cwebp', [
          '-quiet',
          '-q',
          '82',
          png,
          '-o',
          join(CAPTURAS_PRIVADAS, `papeles-${ayuda}-${idioma}.webp`),
        ]);
        hechas.push(`ayuda: papeles-${ayuda}-${idioma}.webp`);
      }
    };
    const ir = async (sub) => {
      await p.goto(`${pre}/panel/${ruta}${sub}`, { waitUntil: 'networkidle' });
      await espera(1800);
    };
    const traer = (loc) => loc.evaluate((x) => x.scrollIntoView({ block: 'start' }));

    // 1. Lista de conductores de la ciudad de pruebas, con la columna «Papeles».
    await ir('/drivers');
    await p.locator('select').first().selectOption('VE-CCS-PRUEBAS');
    await espera(1800);
    await foto('lista-columna-papeles');
    // 2. El filtro «Papeles» abierto en «Plazo por vencer» (el filtro es el segundo desplegable).
    await p.locator('select').nth(1).selectOption('por_vencer');
    await espera(1800);
    await foto('lista-filtro-por-vencer', { ayuda: 'lista' });
    await p.locator('select').nth(1).selectOption('en_plazo');
    await espera(1800);
    await foto('lista-filtro-dentro-del-plazo');
    // El filtro se guarda por empleado: se deja como estaba (todos).
    await p.locator('select').nth(1).selectOption('');
    await espera(800);

    // 3. Ficha del conductor con todo enviado: la tarjeta «Papeles» con sus miniaturas.
    await ir(`/drivers/${ANDRES}`);
    const tarjeta = p.getByTestId('papeles-conductor');
    await tarjeta.waitFor({ timeout: 30_000 });
    await traer(tarjeta);
    await espera(1500);
    await foto('ficha-tarjeta-papeles', { elemento: tarjeta });
    await p.evaluate(() => globalThis.scrollTo(0, 0));
    await espera(400);
    await foto('ficha-pantalla-entera', { completa: true });
    // 4. «Pedir de nuevo» una foto: el formulario con el motivo escrito (sin enviarlo).
    const pedir = p.getByTestId('pedir-doc_reverso');
    await pedir.click();
    await p
      .locator('.papeles-pedir input')
      .first()
      .fill(idioma === 'en' ? 'It is cut off.' : 'Sale cortado.');
    await espera(600);
    await foto('ficha-pedir-de-nuevo', { ayuda: 'pedir', elemento: tarjeta });
    // El borrador del motivo se queda en el navegador: se borra para que no aparezca en las demás.
    await p.evaluate(() => {
      for (const k of Object.keys(localStorage))
        if (k !== 'tumbite.idioma') localStorage.removeItem(k);
    });

    // 5. Ficha de un conductor a medias.
    await ir(`/drivers/${SOFIA}`);
    const tarjeta2 = p.getByTestId('papeles-conductor');
    await tarjeta2.waitFor({ timeout: 30_000 });
    await traer(tarjeta2);
    await espera(1500);
    await foto('ficha-conductor-a-medias', { elemento: tarjeta2 });

    // 6. Verificaciones: el tablero de consultas y acierto, y la tarjeta completa con fotos grandes.
    await ir('/verifications');
    const tablero = p.getByTestId('tablero-ia');
    await tablero.waitFor({ timeout: 30_000 });
    await tablero.locator('summary').click();
    await espera(1200);
    await traer(tablero);
    await foto('verificaciones-tablero-consultas-y-acierto', { elemento: tablero });
    await ir(`/verifications/${ANDRES}`);
    const completa = p.getByTestId('papeles-conductor');
    await completa.waitFor({ timeout: 30_000 });
    await traer(completa);
    await espera(1500);
    await foto('verificaciones-tarjeta-completa', { ayuda: 'comprobaciones', elemento: completa });
    await p.goto(`${pre}/panel/${ruta}/verifications/${ANDRES}`, { waitUntil: 'networkidle' });
    await espera(1500);
    await foto('verificaciones-pantalla-entera', { completa: true });

    // 7. Ajustes → Dinero → país → «Plazo de papeles del conductor».
    // OJO (fallo real del panel, ver el reporte): al cambiar de pestaña, el bloque nace con los datos del
    // país anterior y no los cambia. Para fotografiar lo que debe verse, la primera carga (la de US)
    // recibe la configuración REAL de Venezuela; al tocar VE el bloque nace con ella.
    const ve = await api('GET', '/datos/admin/paises/VE', undefined, equipo.token);
    await p.route('**/datos/admin/paises/US', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ve) }),
    );
    await p.goto(`${pre}/panel/money`, { waitUntil: 'networkidle' });
    await p.getByRole('tab', { name: 'VE', exact: true }).click({ timeout: 60_000 });
    await p.unroute('**/datos/admin/paises/US');
    const politica = p.getByTestId('politica-papeles');
    await politica.waitFor({ timeout: 30_000 });
    await traer(politica);
    await espera(1500);
    await foto('ajustes-pais-plazo-de-papeles', { ayuda: 'politica', elemento: politica });
    await ctx.close();
  }
} finally {
  await navegador.close();
}
console.log(hechas.join('\n'));
