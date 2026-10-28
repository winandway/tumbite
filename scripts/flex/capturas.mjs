#!/usr/bin/env node
// Divoox Flex · capturas ORIGINALES de la app real para la página /flex y Docs (regla de Richard:
// la web solo muestra capturas de la app de verdad). Corre contra el sitio local del recorrido
// (node scripts/recorrido/preparar.mjs + wrangler dev en 8790): crea una empresa de ejemplo en
// Venezuela con datos neutros, envíos, un destinatario con la app, el enlace «confirma dónde
// recibes», una ruta y un conductor, y fotografía cada pantalla en español y en inglés.
// Salida: docs/capturas/flex/fase5-<pantalla>-<es|en>.png
// Uso: node scripts/flex/capturas.mjs
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

async function api(metodo, ruta, cuerpo, token, extra = {}) {
  ip++;
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      'cf-connecting-ip': `10.66.${Math.floor(ip / 250)}.${ip % 250}`,
      'idempotency-key': `cap-${corrida}-${ip}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
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
async function cuenta(nombre, rol, telefono = '') {
  const correo = `${nombre.toLowerCase().replace(/[^a-z]+/g, '')}.${corrida}@ejemplo.com`;
  const r = await api('POST', '/datos/cuentas/registro', { nombre, correo, clave, rol, telefono });
  sql(`UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`);
  return { token: r.token, id: r.usuario.id, correo };
}

// ── Datos de ejemplo (neutros, en Caracas) ──
const dueno = await cuenta('Ana Gomez', 'cliente');
const empresa = (
  await api(
    'POST',
    '/datos/v1/flex/empresas',
    { nombre: 'Repuestos Ejemplo', pais: 'VE', moneda: 'USD' },
    dueno.token,
  )
).empresa;
const E = `/datos/v1/flex/empresas/${empresa.id}`;
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
// Una destinataria que ya usa la app de Divoox con su casa marcada.
const cliente = await cuenta('Maria Perez', 'cliente', '04140000001');
await api(
  'POST',
  '/datos/mis-direcciones',
  {
    etiqueta: 'Casa',
    direccion: 'Calle 3, Los Palos Grandes, Caracas',
    lat: 10.4983,
    lng: -66.8445,
    instrucciones: 'Edificio rojo, piso 3',
  },
  cliente.token,
);
const base = { centroId: centro.id, paquetes: [{ descripcion: 'Repuestos de moto', pesoG: 2500 }] };
const envios = [];
for (const e of [
  {
    referenciaExterna: 'ORD-1001',
    destinatarioNombre: 'María Pérez',
    destinatarioTelefono: '0414-000.00.01',
    direccion: 'Los Palos Grandes, Caracas',
  },
  {
    referenciaExterna: 'ORD-1002',
    destinatarioNombre: 'Luis Rodríguez',
    destinatarioTelefono: '0412-000.00.02',
    destinatarioDocumento: 'V-10000002',
    direccion: 'Av. Libertador, Chacao',
    referencias: 'Frente a la farmacia',
  },
  {
    referenciaExterna: 'ORD-1003',
    destinatarioNombre: 'Carmen Díaz',
    destinatarioTelefono: '0424-000.00.03',
    destinatarioDocumento: 'V-10000003',
    direccion: 'Calle Real de Sabana Grande',
    referencias: 'Portón negro al lado de la panadería',
    lat: 10.4918,
    lng: -66.8726,
  },
  {
    referenciaExterna: 'ORD-1004',
    destinatarioNombre: 'José Martínez',
    destinatarioTelefono: '0416-000.00.04',
    direccion: 'Altamira, Caracas',
  },
])
  envios.push((await api('POST', `${E}/envios`, { ...base, ...e }, dueno.token)).envio);
const enlace = await api('POST', `${E}/envios/${envios[1].id}/enlace-ubicacion`, {}, dueno.token);
const codigoEnlace = String(enlace.url).split('/deliver/')[1];
await api('POST', `/datos/v1/flex/publico/ubicacion/${codigoEnlace}`, {
  lat: 10.4955,
  lng: -66.8531,
  referencias: 'Frente a la farmacia, edificio azul',
});
const enlacePendiente = await api(
  'POST',
  `${E}/envios/${envios[3].id}/enlace-ubicacion`,
  {},
  dueno.token,
);
const codigoPendiente = String(enlacePendiente.url).split('/deliver/')[1];

// El paquete de Carmen pasa por el centro y queda listo para salir (así el rastreo tiene historia).
for (const tipo of ['registrado_centro', 'preparado'])
  await api('POST', `${E}/paquetes/${envios[2].paquetes[0].id}/eventos`, { tipo }, dueno.token);

// Un conductor de la empresa con la ruta de la mañana (los tres envíos con ubicación confirmada).
const conductor = await cuenta('Pedro Conductor', 'repartidor');
await api('POST', `${E}/conductores`, { correo: conductor.correo, vinculo: 'propio' }, dueno.token);
const ruta = (
  await api(
    'POST',
    `${E}/rutas`,
    {
      nombre: 'Ruta Chacao mañana',
      centroId: centro.id,
      envioIds: envios.slice(0, 3).map((x) => x.id),
    },
    dueno.token,
  )
).ruta;
await api('POST', `${E}/rutas/${ruta.id}/asignar`, { conductorId: conductor.id }, dueno.token);

const navegador = await chromium.launch();
async function foto(pagina, nombre) {
  await pagina.waitForTimeout(1200);
  await pagina.screenshot({ path: join(salida, `fase5-${nombre}.png`), fullPage: false });
  console.log('captura', nombre);
}

for (const idioma of ['es', 'en']) {
  const pre = idioma === 'es' ? '/es' : '';
  // ── Panel de la empresa (escritorio) ──
  const ctx = await navegador.newContext({
    viewport: { width: 1280, height: 860 },
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
  });
  await ctx.request.post(`${URL}/datos/cuentas/entrar`, { data: { correo: dueno.correo, clave } });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctx.newPage();
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}`);
  await p.waitForLoadState('domcontentloaded');
  await foto(p, `panel-inicio-${idioma}`);
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments`);
  await foto(p, `panel-envios-${idioma}`);
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments/new`);
  await foto(p, `panel-nuevo-envio-${idioma}`);
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments/${envios[3].id}`);
  await p
    .getByRole('button', {
      name:
        idioma === 'es'
          ? 'Pedir la ubicación al destinatario'
          : 'Ask the recipient for their location',
    })
    .click();
  await foto(p, `panel-pedir-ubicacion-${idioma}`);
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments/${envios[0].id}`);
  await foto(p, `panel-ubicacion-app-${idioma}`);
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/labels`);
  await p.getByText('ORD-1003').click();
  await p.setViewportSize({ width: 1280, height: 1180 });
  await foto(p, `panel-etiquetas-${idioma}`);
  await p.setViewportSize({ width: 1280, height: 860 });
  // ── Lo que ve el destinatario (celular) ──
  const movil = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
  });
  const d = await movil.newPage();
  await d.goto(`${URL}${pre}/deliver/${codigoPendiente}`);
  await foto(d, `destinatario-confirmar-${idioma}`);
  const codigoSeguimiento = envios[2].paquetes[0].codigoSeguimiento;
  await d.goto(`${URL}${pre}/track/${codigoSeguimiento}`);
  await foto(d, `rastreo-${idioma}`);
  // ── App del cliente: «Mis paquetes» ──
  const app = await movil.newPage();
  await app.addInitScript(
    ([t, i]) => {
      localStorage.setItem('tumbite.sesion', t);
      localStorage.setItem('tumbite.idioma', i);
    },
    [cliente.token, idioma],
  );
  await app.goto(`${URL}/app/packages`);
  await app.waitForTimeout(2500);
  await foto(app, `app-mis-paquetes-${idioma}`);
  await p.goto(`${URL}${pre}/panel/business/${empresa.id}/routes`);
  await foto(p, `panel-rutas-${idioma}`);
  // ── App del conductor: «Mis rutas» y el detalle de la ruta ──
  const drv = await movil.newPage();
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
  await foto(drv, `driver-mis-rutas-${idioma}`);
  await drv
    .getByText(idioma === 'es' ? 'Ver detalles' : 'View details')
    .first()
    .click();
  await foto(drv, `driver-ruta-${idioma}`);
  await ctx.close();
  await movil.close();
}
await navegador.close();
// Para la web: WebP livianos en apps/panel/public/flex/ (las originales quedan en docs/capturas).
const web = join(raiz, 'apps', 'panel', 'public', 'flex');
mkdirSync(web, { recursive: true });
for (const n of execSync(`ls ${salida}`)
  .toString()
  .split('\n')
  .filter((x) => x.startsWith('fase5-')))
  execSync(
    `cwebp -quiet -q 82 "${join(salida, n)}" -o "${join(web, n.replace('fase5-', '').replace('.png', '.webp'))}"`,
  );
// Las que usan las guías de Docs van también a public/docs (la prueba de Docs las exige ahí).
for (const n of ['panel-pedir-ubicacion', 'destinatario-confirmar', 'rastreo'])
  for (const l of ['es', 'en'])
    execSync(
      `cp "${join(web, `${n}-${l}.webp`)}" "${join(raiz, 'apps', 'panel', 'public', 'docs', `flex-${n}-${l}.webp`)}"`,
    );
console.log(JSON.stringify({ ok: true, empresa: empresa.id }));
