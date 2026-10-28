#!/usr/bin/env node
// Divoox Flex · Fase 6 (C-FLEX-COBRO): capturas ORIGINALES del cobro contra entrega en Venezuela,
// de la app real, para Docs y la página /flex. Corre contra el sitio local del recorrido
// (node scripts/recorrido/preparar.mjs + wrangler dev en 8790). Arma una empresa de ejemplo en
// Caracas con datos neutros, dos envíos que se cobran al entregar y una ruta en curso; fotografía
// el formulario de cobro del conductor, registra las entregas y fotografía la caja de la ruta, el
// detalle del envío y la etiqueta, en español y en inglés.
// Salida: docs/capturas/flex/fase6-<pantalla>-<es|en>.png (+ WebP en public/flex y public/docs).
// Uso: node scripts/flex/capturas-cobro.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = join(import.meta.dirname, '..', '..');
const URL = process.env.URL_RECORRIDO ?? 'http://localhost:8790';
const salida = join(raiz, 'docs', 'capturas', 'flex');
mkdirSync(salida, { recursive: true });
const corrida = Date.now().toString(36);
const clave = `Flex-${corrida}-Clave1`;
let ip = 0;

async function api(metodo, ruta, cuerpo, token) {
  ip++;
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      'cf-connecting-ip': `10.67.${Math.floor(ip / 250)}.${ip % 250}`,
      'idempotency-key': `cob-${corrida}-${ip}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (s) =>
  execSync(
    `npx wrangler d1 execute tumbite-local --local --persist-to .recorrido/estado -c .recorrido/wrangler.jsonc --command ${JSON.stringify(s)}`,
    { cwd: raiz, stdio: 'ignore' },
  );
async function cuenta(nombre, rol) {
  const correo = `${nombre.toLowerCase().replace(/[^a-z]+/g, '')}.${corrida}@ejemplo.com`;
  const r = await api('POST', '/datos/cuentas/registro', { nombre, correo, clave, rol });
  sql(`UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`);
  return { token: r.token, id: r.usuario.id, correo };
}

// ── Datos de ejemplo (neutros, en Caracas) ──
const dueno = await cuenta('Ana Gomez', 'cliente');
const empresa = (
  await api(
    'POST',
    '/datos/v1/flex/empresas',
    { nombre: 'Tienda Ejemplo', pais: 'VE', moneda: 'USD' },
    dueno.token,
  )
).empresa;
const E = `/datos/v1/flex/empresas/${empresa.id}`;
// La empresa de ejemplo no pide foto, para registrar las entregas desde aquí.
sql(`UPDATE empresas SET config_entrega_json = '{"foto":false}' WHERE id = '${empresa.id}'`);
const centro = (
  await api(
    'POST',
    `${E}/centros`,
    {
      nombre: 'Centro de acopio Chacao',
      direccion: 'Av. Principal, Chacao',
      pais: 'VE',
      ciudad: 'Caracas',
      lat: 10.4961,
      lng: -66.8533,
    },
    dueno.token,
  )
).centro;
const envios = [];
for (const e of [
  {
    referenciaExterna: 'PED-2001',
    destinatarioNombre: 'María Pérez',
    destinatarioTelefono: '0414-000.00.01',
    destinatarioDocumento: 'V-10000001',
    direccion: 'Calle 3, Los Palos Grandes, Caracas',
    referencias: 'Edificio rojo, piso 3',
    lat: 10.4983,
    lng: -66.8445,
    cobro: { monto: 2500, moneda: 'USD' },
  },
  {
    referenciaExterna: 'PED-2002',
    destinatarioNombre: 'Luis Rodríguez',
    destinatarioTelefono: '0412-000.00.02',
    destinatarioDocumento: 'V-10000002',
    direccion: 'Av. Libertador, Chacao',
    referencias: 'Frente a la farmacia',
    lat: 10.4955,
    lng: -66.8531,
    cobro: { monto: 92_000, moneda: 'VES' },
  },
])
  envios.push(
    (
      await api(
        'POST',
        `${E}/envios`,
        { centroId: centro.id, paquetes: [{ descripcion: 'Ropa', pesoG: 800 }], ...e },
        dueno.token,
      )
    ).envio,
  );

const conductor = await cuenta('Carlos Conductor', 'repartidor');
await api('POST', `${E}/conductores`, { correo: conductor.correo, vinculo: 'propio' }, dueno.token);
const ruta = (
  await api(
    'POST',
    `${E}/rutas`,
    { nombre: 'Ruta Chacao tarde', centroId: centro.id, envioIds: envios.map((x) => x.id) },
    dueno.token,
  )
).ruta;
await api('POST', `${E}/rutas/${ruta.id}/asignar`, { conductorId: conductor.id }, dueno.token);
const C = `/datos/v1/flex/conductor/rutas/${ruta.id}`;
await api('POST', `${C}/aceptar`, {}, conductor.token);
await api('POST', `${C}/llegada-centro`, { lat: 10.4961, lng: -66.8533 }, conductor.token);
for (const e of envios)
  for (const p of e.paquetes)
    await api('POST', `${C}/escanear`, { codigo: `dvx:${p.codigoEtiqueta}` }, conductor.token);
await api('POST', `${C}/iniciar`, { lat: 10.4961, lng: -66.8533 }, conductor.token);
const paradas = (await api('GET', C, undefined, conductor.token)).ruta.paradas;

const navegador = await chromium.launch();
async function foto(pagina, nombre, testId) {
  await pagina.waitForTimeout(1200);
  if (testId) await pagina.getByTestId(testId).first().scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: join(salida, `fase6-${nombre}.png`), fullPage: false });
  console.log('captura', nombre);
}
const movil = (idioma) =>
  navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
    geolocation: { latitude: 10.4983, longitude: -66.8445 },
    permissions: ['geolocation'],
  });

// ── 1. El conductor ante la parada que se cobra (antes de entregar) ──
for (const idioma of ['es', 'en']) {
  const m = await movil(idioma);
  const drv = await m.newPage();
  await drv.addInitScript(
    ([t, i]) => {
      localStorage.setItem('tumbite.sesion', t);
      localStorage.setItem('tumbite.idioma', i);
    },
    [conductor.token, idioma],
  );
  await drv.goto(`${URL}/driver/`);
  await drv.waitForTimeout(3500);
  await drv
    .getByText(idioma === 'es' ? 'Pedidos' : 'Orders', { exact: true })
    .last()
    .click();
  await drv.waitForTimeout(1200);
  await drv
    .getByText(idioma === 'es' ? /Mi ruta/ : /My route/)
    .first()
    .click();
  await drv.waitForTimeout(1200);
  await drv
    .getByText(idioma === 'es' ? /Continuar ruta/ : /Continue route/)
    .first()
    .click();
  await drv.waitForTimeout(1200);
  await drv
    .getByText(idioma === 'es' ? 'Lista' : 'List', { exact: true })
    .first()
    .click()
    .catch(() => undefined);
  await drv.screenshot({ path: join(process.env.TMPDIR ?? '/tmp', 'cobro-debug.png') });
  await drv.getByText('Calle 3, Los Palos Grandes, Caracas').first().click();
  await foto(drv, `driver-cobrar-${idioma}`, 'cobro-entrega');
  await m.close();
}

// ── 2. Las entregas con su cobro: efectivo en dólares y pago móvil en bolívares ──
await api(
  'POST',
  `${C}/paradas/${paradas[0].id}/entregar`,
  {
    recibio: 'María Pérez',
    recibioDocumento: 'V-10000001',
    recibioRelacion: 'titular',
    cobro: { metodo: 'efectivo_usd', monto: 2500, moneda: 'USD' },
  },
  conductor.token,
);
await api(
  'POST',
  `${C}/paradas/${paradas[1].id}/entregar`,
  {
    recibio: 'Luis Rodríguez',
    recibioDocumento: 'V-10000002',
    recibioRelacion: 'titular',
    cobro: { metodo: 'pago_movil', monto: 92_000, moneda: 'VES', referencia: '000123' },
  },
  conductor.token,
);

// ── 3. La empresa: la caja de la ruta, el detalle del envío y la etiqueta ──
for (const idioma of ['es', 'en']) {
  const pre = idioma === 'es' ? '/es' : '';
  const ctx = await navegador.newContext({
    viewport: { width: 1280, height: 860 },
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
  });
  await ctx.request.post(`${URL}/datos/cuentas/entrar`, { data: { correo: dueno.correo, clave } });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctx.newPage();
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/operativas/${ruta.id}`);
  await foto(p, `panel-caja-${idioma}`, 'caja-ruta');
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments/${envios[1].id}`);
  await foto(p, `panel-cobro-envio-${idioma}`, 'cobro-envio');
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/labels`);
  await p.getByText('PED-2001').click();
  await p.setViewportSize({ width: 1280, height: 1180 });
  await foto(p, `panel-etiqueta-cobro-${idioma}`);
  await ctx.close();
}
await navegador.close();

// Para la web y Docs: WebP livianos (las originales quedan en docs/capturas).
const web = join(raiz, 'apps', 'panel', 'public', 'flex');
mkdirSync(web, { recursive: true });
for (const n of execSync(`ls ${salida}`)
  .toString()
  .split('\n')
  .filter((x) => x.startsWith('fase6-')))
  execSync(
    `cwebp -quiet -q 82 "${join(salida, n)}" -o "${join(web, n.replace('fase6-', '').replace('.png', '.webp'))}"`,
  );
for (const n of ['driver-cobrar', 'panel-caja'])
  for (const l of ['es', 'en'])
    execSync(
      `cp "${join(web, `${n}-${l}.webp`)}" "${join(raiz, 'apps', 'panel', 'public', 'docs', `flex-${n}-${l}.webp`)}"`,
    );
console.log(JSON.stringify({ ok: true, empresa: empresa.id, ruta: ruta.id }));
