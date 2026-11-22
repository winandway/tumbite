// Capturas del registro de Divoox Driver TAL COMO ESTÁ HOY, para el video tutorial «Cómo crear tu
// cuenta en Divoox Driver» (22 nov 2026, pedido de Richard por Motor Escenia) — todos los países con
// el asistente de verificación (la pasada usa la zona de pruebas de Venezuela, con nombre de ejemplo).
// Driver web real (/driver, el mismo código de la app) contra el servidor LOCAL del recorrido: no
// toca el sitio de pruebas ni producción, no envía correos ni SMS (Twilio y Stripe van al simulador
// local). Datos neutros (C-DOCS-SIN-DATOS-REALES): la cara es un DIBUJO y los documentos dicen
// «EJEMPLO» (scripts/recorrido/dibujosVerificacion.mjs); la cámara simulada de Chromium los «filma».
//   → $SALIDA_REGISTRO (por defecto ~/Documents/Entregas/Divoox/capturas-registro-driver-hoy/pantallas)
// Antes: PUERTO_RECORRIDO=<puerto> node scripts/recorrido/preparar.mjs, el servidor encendido
//   (npx wrangler dev -c .recorrido/wrangler.jsonc --port <puerto> --persist-to .recorrido/estado)
//   y la zona de Venezuela armada (node scripts/staging/probar-moto-venezuela.mjs contra ese servidor).
// Uso: node scripts/recorrido/capturas-registro-driver.mjs
/* eslint-disable security/detect-non-literal-fs-filename, no-undef -- guion local: carpetas fijas; `document` corre dentro del navegador */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { cuadro, videoDe } from './dibujosVerificacion.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA =
  process.env.SALIDA_REGISTRO ??
  join(homedir(), 'Documents', 'Entregas', 'Divoox', 'capturas-registro-driver-hoy', 'pantallas');
mkdirSync(SALIDA, { recursive: true });
const TELEFONO = { width: 390, height: 844 };
const ZONA = 'VE-MER-ELVIGIA';
const ORIGEN = { lat: 8.6219, lng: -71.6506 };
const CORREO = 'conductor.ejemplo@ejemplo.com';
const NOMBRE = 'Carlos Vera';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(metodo, ruta, cuerpo, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...extra },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = async (q) =>
  (
    await pedir(
      'POST',
      '/datos/interno/diagnostico/sql',
      { sql: q },
      {
        'x-reloj-secreto': DATOS.relojSecreto,
      },
    )
  ).results ?? [];

let n = 0;
const lista = [];
async function foto(p, nombre) {
  await espera(900);
  const archivo = `${String(++n).padStart(2, '0')}-${nombre}.png`;
  await p.screenshot({ path: join(SALIDA, archivo) });
  lista.push(archivo);
  console.log(`✓ ${archivo}`);
}

/** Un teléfono con la sesión (si la hay) y, si se pide, una cámara que «filma» un dibujo. */
const navegadores = [];
async function telefono(sesion, dibujo) {
  const args = ['--use-fake-ui-for-media-stream'];
  if (dibujo) {
    const video = await videoDe(dibujo, join(mkdtempSync(join(tmpdir(), 'cam-')), 'cam.mjpeg'));
    args.push('--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`);
  }
  const b = await chromium.launch({ args });
  navegadores.push(b);
  b.on('disconnected', () => null);
  const ctx = await b.newContext({
    viewport: TELEFONO,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    baseURL: URL,
    locale: 'es-US',
    timezoneId: 'America/Caracas',
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation', 'camera'],
  });
  await ctx.addInitScript(
    ([pase, u]) => {
      localStorage.setItem('tumbite.idioma', 'es');
      if (pase) {
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      }
    },
    [sesion?.token ?? null, sesion?.id ?? null],
  );
  ultimaPagina = await ctx.newPage();
  return ultimaPagina;
}
let ultimaPagina = null;

/** Lleva el texto al borde de arriba de lo que se desliza. */
const arriba = (loc, aire = 16) =>
  loc.first().evaluate((x, a) => {
    x.scrollIntoView({ block: 'start' });
    let caja = x.parentElement;
    while (caja && caja.scrollHeight <= caja.clientHeight + 4) caja = caja.parentElement;
    if (caja) caja.scrollTop -= a;
  }, aire);

// ───────── preparar: la zona con nombre de ejemplo y sin la cuenta de una pasada anterior
await sql(`UPDATE zonas SET nombre = 'Ciudad de ejemplo' WHERE id = '${ZONA}'`);
// La moto de ejemplo de una pasada anterior deja libre su placa.
await sql(`UPDATE vehiculos SET placa = 'X' || substr(id, 1, 8) WHERE placa = 'EJ0000'`);
// La de una pasada anterior deja libre el correo (también su forma canónica) y el celular.
await sql(
  `UPDATE usuarios SET correo = 'vieja-' || id || '@recorrido.test', correo_canonico = 'vieja-' || id || '@recorrido.test', telefono = NULL, telefono_canonico = NULL WHERE correo = '${CORREO}' OR correo_canonico = '${CORREO}'`,
);

try {
  // ───────── 1 · Entrar y crear la cuenta
  const p = await telefono(null);
  await p.goto('/driver/', { waitUntil: 'networkidle' });
  await p.getByText('Para conductores').first().waitFor({ timeout: 60_000 });
  await foto(p, 'portada-entrar');

  await p.getByTestId('ir-a-crear-cuenta').click();
  await p.getByText('Crear cuenta').first().waitFor();
  await foto(p, 'crear-cuenta-vacio');

  await p.getByPlaceholder('Nombre').first().fill(NOMBRE);
  await p
    .getByLabel(/correo/i)
    .first()
    .fill(CORREO);
  const tel = p.getByLabel(/celular|teléfono/i).first();
  await tel.click();
  await tel.fill(process.env.TELEFONO ?? '5550100123');
  await p
    .getByLabel(/contraseña/i)
    .first()
    .fill(DATOS.clave);
  await p.evaluate(() => document.activeElement?.blur());
  await arriba(p.getByText('Crear cuenta'), 0);
  await foto(p, 'crear-cuenta-datos');

  const casilla = p.getByRole('checkbox').first();
  await casilla.scrollIntoViewIfNeeded();
  await casilla.click();
  await p.getByTestId('registro-continuar').scrollIntoViewIfNeeded();
  await foto(p, 'crear-cuenta-terminos');

  await p.getByTestId('registro-continuar').click();
  await p.getByTestId('revisa-tus-datos').waitFor({ timeout: 20_000 });
  await foto(p, 'revisa-tus-datos');

  await p.getByTestId('crear-mi-cuenta').click();
  // La cuenta nueva: primero los permisos del teléfono (una vez por cuenta), después el aviso único.
  const listo = p.getByText('Estoy listo', { exact: true }).first();
  await listo.waitFor({ timeout: 60_000 });
  await espera(1200);
  await foto(p, 'permisos-del-telefono');
  await listo.click();
  await p.getByTestId('aviso-ia-casilla').waitFor({ timeout: 60_000 });
  const sesion = await p.evaluate(() => localStorage.getItem('tumbite.sesion'));
  const [yo] = await sql(`SELECT id, zona_id FROM usuarios WHERE correo = '${CORREO}'`);
  console.log('cuenta', yo);
  const cuenta = { id: yo.id, token: sesion };
  await foto(p, 'aviso-como-revisamos');
  await p.getByTestId('aviso-ia-casilla').click();
  await foto(p, 'aviso-casilla-marcada');
  await p.getByTestId('aviso-ia-aceptar').click();
  await p.getByTestId('tus-papeles').first().waitFor({ timeout: 60_000 });
  await espera(2500);
  await foto(p, 'inicio-cuenta-nueva');
  await p.context().close();

  // ───────── 2 · El asistente de fotos: un teléfono por dibujo (la cámara simulada filma uno solo)
  const PASOS = [
    ['cara', 'cara'],
    ['doc_frente', 'identidad-frente'],
    ['doc_reverso', 'identidad-reverso'],
    ['licencia_frente', 'licencia-frente'],
    ['licencia_reverso', 'licencia-reverso'],
    ['seguro', 'seguro-vehiculo'],
  ];
  /** Las fotos que faltan, una por una, y al final «Revisa tus papeles» → «Enviar a revisión». */
  async function asistente(sufijoEnviados) {
    const v = await pedir('GET', '/datos/conductor/verificacion', undefined, {
      authorization: `Bearer ${cuenta.token}`,
    });
    const pide = new Set(v.pasos.filter((x) => x.foto?.estado !== 'vigente').map((x) => x.paso));
    console.log('fotos que faltan:', [...pide].join(', '));
    let ultimo = null;
    for (const [paso, nombre] of PASOS) {
      if (!pide.has(paso)) continue;
      await ultimo?.context().close();
      const q = await telefono(cuenta, paso);
      await q.goto('/driver/');
      await q.getByTestId('tus-papeles').first().click({ timeout: 60_000 });
      await q.getByTestId('asistente-papeles').waitFor({ timeout: 30_000 });
      await q.getByTestId('horma-horma').waitFor({ timeout: 30_000 });
      // El inicio quedó deslizado al tocar «Tus papeles»: el asistente (y su cámara) desde arriba.
      await q.evaluate(() => window.scrollTo(0, 0));
      await espera(1500);
      await foto(q, `${nombre}-guia`);
      if (paso === 'cara' && (await q.getByTestId('papeles-acepto').count())) {
        await q.getByTestId('papeles-acepto').scrollIntoViewIfNeeded();
        await foto(q, 'cara-permiso-foto');
        await q.getByTestId('papeles-acepto').click();
      }
      await q.getByTestId('papeles-tomar').click({ timeout: 20_000 });
      await q.getByTestId('camara-con-marco').waitFor({ timeout: 30_000 });
      await q.evaluate(() => window.scrollTo(0, 0));
      await q.waitForFunction(
        () => {
          const v = document.querySelector('video');
          return v && v.readyState >= 2 && v.videoWidth > 0;
        },
        undefined,
        { timeout: 30_000 },
      );
      // La cámara simulada de Chromium se pinta en espejo; la de atrás de un teléfono, no. Solo para
      // los documentos se le quita el espejo a la vista (la foto que se guarda no cambia).
      if (paso !== 'cara')
        await q.evaluate(() =>
          document.querySelectorAll('video').forEach((v) => {
            v.style.transform = 'none';
          }),
        );
      await espera(1500);
      await foto(q, `${nombre}-camara`);
      await q.getByTestId('camara-disparo').click();
      await q
        .locator('[data-testid="papeles-usar"], [data-testid="papeles-usar-igual"]')
        .first()
        .waitFor({ timeout: 60_000 });
      await espera(1200);
      await foto(q, `${nombre}-vista-previa`);
      await q
        .locator('[data-testid="papeles-usar"], [data-testid="papeles-usar-igual"]')
        .first()
        .click();
      await q
        .locator(
          '[data-testid="papeles-foto-lista"], [data-testid="ya-puedes-trabajar"], [data-testid="rejilla-papeles"]',
        )
        .first()
        .waitFor({ timeout: 60_000 });
      await espera(1200);
      if (await q.getByTestId('ya-puedes-trabajar').count()) {
        await foto(q, 'ya-puedes-trabajar');
        await q.getByTestId('ya-puedes-seguir').click();
      } else if (await q.getByTestId('papeles-foto-lista').count()) {
        await foto(q, `${nombre}-lista`);
      }
      ultimo = q;
    }

    // ───────── 3 · Revisa tus papeles y envíalos
    const r = ultimo;
    if (!(await r.getByTestId('rejilla-papeles').count()))
      await r
        .getByTestId('papeles-siguiente')
        .click()
        .catch(() => null);
    await r.getByTestId('rejilla-papeles').waitFor({ timeout: 30_000 });
    await espera(1500);
    await foto(r, `revisa-tus-papeles${sufijoEnviados}`);
    // Con papeles ya en revisión, las fotos nuevas se suman solas a la revisión: no hay botón.
    if (await r.getByTestId('papeles-enviar').count()) {
      await r.getByTestId('papeles-enviar').scrollIntoViewIfNeeded();
      await r.getByTestId('papeles-enviar').click();
      await r.getByTestId('papeles-enviados').waitFor({ timeout: 30_000 });
      await espera(1200);
      await foto(r, `papeles-enviados${sufijoEnviados}`);
    }
    await r.context().close();
  }
  await asistente('');

  // ───────── 4 · Tus papeles en revisión, el perfil, la moto y «Mi línea»
  const d = await telefono(cuenta);
  await d.goto('/driver/');
  await d.getByTestId('tus-papeles').first().waitFor({ timeout: 60_000 });
  await espera(2500);
  await foto(d, 'inicio-papeles-en-revision');

  await d.getByRole('tab', { name: 'Perfil' }).click({ timeout: 60_000 });
  await d.getByTestId('tus-papeles').first().waitFor({ timeout: 30_000 });
  await arriba(d.getByTestId('tus-papeles'), 8);
  await espera(1500);
  await foto(d, 'perfil');

  // La moto: Perfil → «Mi vehículo» → «Registrar mi moto» (la tarjeta del servicio en el inicio
  // solo dice su estado). Sus papeles se suben con el selector del teléfono: aquí, los dibujos.
  await d.getByTestId('seccion-vehiculo').first().click();
  await d.getByText('Registrar mi moto').first().waitFor({ timeout: 20_000 });
  await arriba(d.getByText('Mi vehículo', { exact: true }), 8);
  await foto(d, 'perfil-mi-vehiculo');
  await d.getByText('Registrar mi moto').first().click();
  await d.getByTestId('alta-moto').waitFor({ timeout: 30_000 });
  await arriba(d.getByText('Divoox Moto', { exact: true }), 8);
  await foto(d, 'moto-registrar');
  for (const [etiqueta, valor] of [
    ['Marca', 'Marca Ejemplo'],
    ['Modelo', 'Modelo 150'],
    ['Año', '2024'],
    ['Color', 'Gris'],
    ['Placa', 'EJ0000'],
  ])
    await d.getByLabel(etiqueta, { exact: true }).first().fill(valor);
  await d.evaluate(() => document.activeElement?.blur());
  await arriba(d.getByText('Tu moto', { exact: true }), 8);
  await foto(d, 'moto-datos');
  const guardar = d.getByText(/^Guardar mi moto/).first();
  await guardar.scrollIntoViewIfNeeded();
  await espera(800);
  await guardar.click();
  await d.getByText('Papeles de la moto').first().waitFor({ timeout: 30_000 });
  await arriba(d.getByText('Papeles de la moto', { exact: true }), 8);
  await foto(d, 'moto-papeles-por-subir');

  const DIBUJO_DE = [
    [/^Registro o título/, 'vehiculo'],
    [/^Póliza de responsabilidad/, 'seguro'],
    [/^Póliza que cubre/, 'seguro'],
    [/^Foto de la moto/, 'moto'],
    [/^Foto de la placa/, 'placa'],
    [/^Licencia para manejar/, 'licencia_frente'],
  ];
  for (const [fila, dibujo] of DIBUJO_DE) {
    const caja = d
      .getByText(fila)
      .first()
      .locator('xpath=ancestor::div[.//*[normalize-space(text())="Subir"]][1]');
    const boton = caja.getByText('Subir', { exact: true }).first();
    await boton.scrollIntoViewIfNeeded();
    const elegir = d.waitForEvent('filechooser', { timeout: 20_000 });
    await boton.click();
    await (
      await elegir
    ).setFiles({
      name: `${dibujo}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await cuadro(dibujo),
    });
    await d
      .getByText('Subiendo')
      .first()
      .waitFor({ state: 'detached', timeout: 30_000 })
      .catch(() => null);
    await espera(1500);
  }
  await arriba(d.getByText('Papeles de la moto', { exact: true }), 8);
  await foto(d, 'moto-papeles-subidos');
  await d.getByText('Enviar mi moto a revisión').first().click();
  await espera(2500);
  await arriba(d.getByText('Tu moto', { exact: true }), 8);
  await foto(d, 'moto-en-revision');

  // Con la moto, el país pide además la licencia y el seguro: el asistente sigue donde quedó.
  await asistente('-licencia-y-seguro');

  // «Mi línea»: unirse a la línea de su grupo con el código que da el líder (opcional).
  await d.goto('/driver/');
  await d.getByRole('tab', { name: 'Perfil' }).click({ timeout: 60_000 });
  await d.getByText('Mi línea', { exact: true }).first().click({ timeout: 30_000 });
  await espera(2500);
  await foto(d, 'mi-linea');

  // El final: el inicio con todo enviado y en revisión.
  await d.goto('/driver/');
  await d.getByTestId('tus-papeles').first().waitFor({ timeout: 60_000 });
  await espera(2500);
  await foto(d, 'final-todo-en-revision');
} catch (e) {
  await ultimaPagina
    ?.screenshot({ path: join(SALIDA, '..', 'error-registro.png') })
    .catch(() => null);
  throw e;
} finally {
  await sql(`UPDATE zonas SET nombre = 'El Vigía' WHERE id = '${ZONA}'`).catch(() => null);
  for (const b of navegadores) await b.close().catch(() => null);
  console.log(lista.join('\n'));
}
