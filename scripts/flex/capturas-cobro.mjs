#!/usr/bin/env node
// Divoox Flex · Fase 6 (C-FLEX-COBRO): capturas ORIGINALES del cobro contra entrega y del retiro en
// el centro, de la app real, para Docs y la página /flex. Corre contra el sitio local del recorrido
// (node scripts/recorrido/preparar.mjs + wrangler dev; URL_RECORRIDO, por defecto el puerto 8790).
// C-CAPTURAS-POR-IDIOMA (15 nov 2026): cada idioma con SUS ejemplos.
//   Español, Venezuela (Caracas): dos envíos que se cobran al entregar y una ruta en curso; el
//   formulario de cobro del conductor, la caja de la ruta, el detalle del envío, el retiro en el
//   centro y la etiqueta con el cobro.
//   Inglés, Estados Unidos (Novi, Michigan): allí NO hay cobro contra entrega (perfil de Flex del
//   país): la parada del conductor sin nada que cobrar, la ruta con las paradas entregadas, el
//   detalle de un envío entregado y el retiro en el centro, en dólares y con nombres en inglés.
// Salida: docs/capturas/flex/fase6-<pantalla>-<es|en>.png (+ WebP en public/docs; las de español
// también en public/flex). SOLO_IDIOMA=en (o es) corre una sola pasada.
// Uso: URL_RECORRIDO=http://localhost:8797 SOLO_IDIOMA=en node scripts/flex/capturas-cobro.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(raiz, '.recorrido', 'datos.json'), 'utf8'));
const URL = process.env.URL_RECORRIDO ?? 'http://localhost:8790';
const salida = join(raiz, 'docs', 'capturas', 'flex');
const web = join(raiz, 'apps', 'panel', 'public', 'flex');
const docs = join(raiz, 'apps', 'panel', 'public', 'docs');
mkdirSync(salida, { recursive: true });
mkdirSync(web, { recursive: true });
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
      'cf-connecting-ip': `10.67.${Math.floor(ip / 250) % 250}.${ip % 250}`,
      'idempotency-key': `cob-${corrida}-${ip}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? JSON.stringify(d)}`);
  return d;
}
const sql = async (q) =>
  (
    await fetch(`${URL}/datos/interno/diagnostico/sql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-reloj-secreto': DATOS.relojSecreto },
      body: JSON.stringify({ sql: q }),
    }).then((r) => r.json())
  ).results ?? [];
async function cuenta(nombre, rol) {
  // El correo sale en algunas pantallas: nombre.apellido@example.com; la cuenta de una corrida
  // anterior de este guion con ese correo se aparta (solo en el servidor local del recorrido).
  const slug = nombre.toLowerCase().replace(/[^a-z]+/g, '.');
  const correo = `${slug}@example.com`;
  await sql(
    `UPDATE usuarios SET correo = '${slug}.anterior.' || substr(id, 1, 8) || '@example.com' WHERE correo = '${correo}'`,
  );
  await sql(
    `UPDATE usuarios SET correo_canonico = correo WHERE correo LIKE '${slug}.anterior.%@example.com'`,
  );
  const r = await api('POST', '/datos/cuentas/registro', { nombre, correo, clave, rol });
  await sql(
    `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
  );
  return { token: r.token, id: r.usuario.id, correo };
}
const aWebp = (png, webp) => execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', webp]);

const navegador = await chromium.launch();
async function foto(pagina, nombre, testId) {
  await pagina.waitForTimeout(1200);
  if (testId) await pagina.getByTestId(testId).first().scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: join(salida, `fase6-${nombre}.png`), fullPage: false });
  console.log('captura', nombre);
}
const movil = (idioma, geo) =>
  navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
    geolocation: { latitude: geo.lat, longitude: geo.lng },
    permissions: ['geolocation'],
  });
/** El conductor abre «Mi ruta (paquetes)», continúa la ruta y toca la parada. */
async function abrirParada(drv, idioma, direccion) {
  const es = idioma === 'es';
  await drv.goto(`${URL}/driver/`);
  await drv.waitForTimeout(3500);
  await drv
    .getByRole('button', { name: es ? /menú/i : /menu/i })
    .first()
    .click({ timeout: 30_000 });
  await drv
    .getByText(es ? 'Mi ruta (paquetes)' : 'My route (packages)', { exact: true })
    .first()
    .click({ timeout: 30_000 });
  await drv.waitForTimeout(1500);
  await drv
    .getByText(es ? /Continuar ruta/ : /Continue route/)
    .first()
    .click();
  await drv.waitForTimeout(1200);
  await drv
    .getByText(es ? 'Lista' : 'List', { exact: true })
    .first()
    .click()
    .catch(() => undefined);
  await drv.getByText(direccion).first().click();
}
const sesionPanel = async (idioma, dueno) => {
  const ctx = await navegador.newContext({
    viewport: { width: 1280, height: 860 },
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
  });
  await ctx.addCookies([{ name: 'tumbite_sesion', value: dueno.token, url: URL, httpOnly: true }]);
  await ctx.addInitScript(
    ([i, t]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', t);
    },
    [idioma, dueno.token],
  );
  return ctx;
};
const conductorEnLaApp = (drv, conductor, idioma) =>
  drv.addInitScript(
    ([t, u, i]) => {
      localStorage.setItem('tumbite.sesion', t);
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [conductor.token, conductor.id, idioma],
  );

/** Español: Venezuela (Caracas), con cobro contra entrega en dólares y bolívares. */
async function correrVe(idiomas) {
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
  await sql(
    `UPDATE empresas SET config_entrega_json = '{"foto":false}' WHERE id = '${empresa.id}'`,
  );
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

  // C-FLEX-RETIRO: un envío que se retira en el centro, con cobro, ya disponible para retirar.
  const retiro = (
    await api(
      'POST',
      `${E}/envios`,
      {
        centroId: centro.id,
        entrega: 'punto',
        referenciaExterna: 'PED-2003',
        destinatarioNombre: 'Carmen Díaz',
        destinatarioTelefono: '0424-000.00.03',
        destinatarioDocumento: 'V-10000003',
        direccion: 'Retiro en el centro',
        cobro: { monto: 1800, moneda: 'USD' },
        paquetes: [{ descripcion: 'Zapatos', pesoG: 1200 }],
      },
      dueno.token,
    )
  ).envio;
  await api('POST', `${E}/envios/${retiro.id}/retiro/disponible`, {}, dueno.token);

  const conductor = await cuenta('Carlos Conductor', 'repartidor');
  await api(
    'POST',
    `${E}/conductores`,
    { correo: conductor.correo, vinculo: 'propio' },
    dueno.token,
  );
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

  // ── 1. El conductor ante la parada que se cobra (antes de entregar) ──
  for (const idioma of idiomas) {
    const m = await movil(idioma, { lat: 10.4983, lng: -66.8445 });
    const drv = await m.newPage();
    await conductorEnLaApp(drv, conductor, idioma);
    await abrirParada(drv, idioma, 'Calle 3, Los Palos Grandes, Caracas');
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
  for (const idioma of idiomas) {
    const pre = idioma === 'es' ? '/es' : '';
    const ctx = await sesionPanel(idioma, dueno);
    const p = await ctx.newPage();
    await p.goto(`${URL}${pre}/panel/business/${empresa.id}/operativas/${ruta.id}`);
    await foto(p, `panel-caja-${idioma}`, 'caja-ruta');
    await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments/${envios[1].id}`);
    await foto(p, `panel-cobro-envio-${idioma}`, 'cobro-envio');
    await p.goto(`${URL}${pre}/panel/business/${empresa.id}/shipments/${retiro.id}`);
    await foto(p, `panel-retiro-${idioma}`, 'retiro-en-punto');
    await p.goto(`${URL}${pre}/panel/business/${empresa.id}/labels`);
    await p.getByText('PED-2001').click();
    await p.setViewportSize({ width: 1280, height: 1180 });
    await foto(p, `panel-etiqueta-cobro-${idioma}`);
    await ctx.close();
  }
}

/**
 * Inglés: Estados Unidos (Novi, Michigan). El perfil de Flex del país no tiene cobro contra entrega
 * (packages/compartido/src/flexPaises.ts, `cobroContraEntrega: false`): se fotografía lo que SÍ pasa
 * allí con las mismas pantallas.
 */
async function correrUs(idiomas) {
  const NOVI = { lat: 42.4775, lng: -83.4766 };
  const dueno = await cuenta('Drew Parker', 'cliente');
  const empresa = (
    await api(
      'POST',
      '/datos/v1/flex/empresas',
      { nombre: 'Maple Street Goods', pais: 'US', moneda: 'USD' },
      dueno.token,
    )
  ).empresa;
  const E = `/datos/v1/flex/empresas/${empresa.id}`;
  // La empresa de ejemplo no pide foto, para registrar las entregas desde aquí.
  await sql(
    `UPDATE empresas SET config_entrega_json = '{"foto":false}' WHERE id = '${empresa.id}'`,
  );
  const centro = (
    await api(
      'POST',
      `${E}/centros`,
      {
        nombre: 'Novi Town Center Store',
        direccion: '43100 Crescent Blvd, Novi, MI 48375',
        pais: 'US',
        ciudad: 'Novi',
        ...NOVI,
      },
      dueno.token,
    )
  ).centro;
  const envios = [];
  for (const e of [
    {
      referenciaExterna: 'ORD-2001',
      destinatarioNombre: 'Chris Miller',
      destinatarioTelefono: '(248) 555-0112',
      direccion: '24600 Taft Rd, Novi, MI 48375',
      referencias: 'Gray house with a red door',
      lat: 42.4705,
      lng: -83.488,
    },
    {
      referenciaExterna: 'ORD-2002',
      destinatarioNombre: 'Taylor Brooks',
      destinatarioTelefono: '(248) 555-0113',
      direccion: '45255 W 10 Mile Rd, Novi, MI 48375',
      referencias: 'Staff entrance on the east side',
      lat: 42.4722,
      lng: -83.478,
    },
  ])
    envios.push(
      (
        await api(
          'POST',
          `${E}/envios`,
          { centroId: centro.id, paquetes: [{ descripcion: 'Clothing', pesoG: 800 }], ...e },
          dueno.token,
        )
      ).envio,
    );
  // C-FLEX-RETIRO: un envío que se retira en el centro, ya disponible para retirar (sin cobro).
  const retiro = (
    await api(
      'POST',
      `${E}/envios`,
      {
        centroId: centro.id,
        entrega: 'punto',
        referenciaExterna: 'ORD-2003',
        destinatarioNombre: 'Morgan Davis',
        destinatarioTelefono: '(248) 555-0114',
        direccion: 'Pickup at the store',
        paquetes: [{ descripcion: 'Shoes', pesoG: 1200 }],
      },
      dueno.token,
    )
  ).envio;
  await api('POST', `${E}/envios/${retiro.id}/retiro/disponible`, {}, dueno.token);

  const conductor = await cuenta('Robin Hayes', 'repartidor');
  await api(
    'POST',
    `${E}/conductores`,
    { correo: conductor.correo, vinculo: 'propio' },
    dueno.token,
  );
  const ruta = (
    await api(
      'POST',
      `${E}/rutas`,
      {
        nombre: 'Novi afternoon route',
        centroId: centro.id,
        envioIds: envios.map((x) => x.id),
      },
      dueno.token,
    )
  ).ruta;
  await api('POST', `${E}/rutas/${ruta.id}/asignar`, { conductorId: conductor.id }, dueno.token);
  // Sin llave de mapas en este servidor local, el recorrido sale como estimación; se marca como «por
  // calles» solo aquí para que la captura pública muestre el caso normal (como capturas-flex.mjs).
  await api('POST', `${E}/rutas/${ruta.id}/calles`, {}, dueno.token).catch(() => null);
  await sql(`UPDATE rutas_flex_calles SET fuente = 'google' WHERE ruta_id = '${ruta.id}'`);
  const C = `/datos/v1/flex/conductor/rutas/${ruta.id}`;
  await api('POST', `${C}/aceptar`, {}, conductor.token);
  await api('POST', `${C}/llegada-centro`, NOVI, conductor.token);
  for (const e of envios)
    for (const p of e.paquetes)
      await api('POST', `${C}/escanear`, { codigo: `dvx:${p.codigoEtiqueta}` }, conductor.token);
  await api('POST', `${C}/iniciar`, NOVI, conductor.token);
  const paradas = (await api('GET', C, undefined, conductor.token)).ruta.paradas;

  // ── 1. El conductor ante la parada (en Estados Unidos no hay nada que cobrar) ──
  for (const idioma of idiomas) {
    const m = await movil(idioma, { lat: 42.4705, lng: -83.488 });
    const drv = await m.newPage();
    await conductorEnLaApp(drv, conductor, idioma);
    await abrirParada(drv, idioma, '24600 Taft Rd, Novi, MI 48375');
    await foto(drv, `driver-cobrar-${idioma}`);
    await m.close();
  }

  // ── 2. Las dos entregas, sin cobro ──
  for (const [i, nombre] of ['Chris Miller', 'Taylor Brooks'].entries())
    await api(
      'POST',
      `${C}/paradas/${paradas.at(i).id}/entregar`,
      { recibio: nombre, recibioRelacion: 'titular' },
      conductor.token,
    );

  // ── 3. La empresa: la ruta con sus paradas entregadas, el detalle del envío y el retiro ──
  for (const idioma of idiomas) {
    const ctx = await sesionPanel(idioma, dueno);
    const p = await ctx.newPage();
    const R = `${URL}${idioma === 'es' ? '/es' : ''}/panel/business/${empresa.id}`;
    await p.goto(`${R}/operativas/${ruta.id}`);
    await foto(p, `panel-caja-${idioma}`);
    await p.goto(`${R}/shipments/${envios[1].id}`);
    await foto(p, `panel-cobro-envio-${idioma}`);
    await p.goto(`${R}/shipments/${retiro.id}`);
    await foto(p, `panel-retiro-${idioma}`, 'retiro-en-punto');
    await ctx.close();
  }
}

const SOLO = process.env.SOLO_IDIOMA;
if (SOLO !== 'en') await correrVe(['es']);
if (SOLO !== 'es') await correrUs(['en']);
await navegador.close();

// Para Docs (y, en español, para la página /flex): WebP livianos (las originales quedan en
// docs/capturas). La página /flex en inglés solo lleva de aquí la parada del conductor (`driver-entrega-en`).
const idiomas = SOLO === 'en' ? ['en'] : SOLO === 'es' ? ['es'] : ['es', 'en'];
for (const l of idiomas) {
  const nombres =
    l === 'es'
      ? ['driver-cobrar', 'panel-caja', 'panel-cobro-envio', 'panel-etiqueta-cobro', 'panel-retiro']
      : ['driver-cobrar', 'panel-caja', 'panel-cobro-envio', 'panel-retiro'];
  for (const n of nombres) {
    const png = join(salida, `fase6-${n}-${l}.png`);
    if (l === 'es') aWebp(png, join(web, `${n}-${l}.webp`));
    // La página /flex en inglés enseña la parada sin nada que cobrar (allá no hay cobro contra entrega).
    if (l === 'en' && n === 'driver-cobrar') aWebp(png, join(web, 'driver-entrega-en.webp'));
    if (n !== 'panel-etiqueta-cobro') aWebp(png, join(docs, `flex-${n}-${l}.webp`));
  }
}
console.log(JSON.stringify({ ok: true, idiomas }));
