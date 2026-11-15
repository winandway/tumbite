#!/usr/bin/env node
// Divoox Flex · capturas ORIGINALES de la app real para la página /flex y Docs (regla de Richard:
// la web solo muestra capturas de la app de verdad). Corre contra el sitio local del recorrido
// (node scripts/recorrido/preparar.mjs + wrangler dev; URL_RECORRIDO, por defecto el puerto 8790):
// crea una empresa de ejemplo con datos neutros, envíos, un destinatario con la app, el enlace
// «confirma dónde recibes», una ruta y un conductor, y fotografía cada pantalla.
// C-CAPTURAS-POR-IDIOMA (15 nov 2026): cada idioma con SUS ejemplos. Español: Caracas (Venezuela).
// Inglés: Novi, Michigan (Estados Unidos), en dólares, nombres en inglés y sin nada de Venezuela;
// la pasada en inglés toma además las pantallas del tutorial «Empieza con Divoox Flex», el recorrido
// del panel, la billetera, Operación, Vehículos, Integraciones y la cadena de custodia.
// Salida: docs/capturas/flex/fase5-<pantalla>-<es|en>.png y docs/capturas/flex-tutorial/*-en.png
// (+ WebP en public/flex y public/docs). SOLO_IDIOMA=en (o es) corre una sola pasada.
// Uso: URL_RECORRIDO=http://localhost:8797 SOLO_IDIOMA=en node scripts/flex/capturas.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(raiz, '.recorrido', 'datos.json'), 'utf8'));
const URL = process.env.URL_RECORRIDO ?? 'http://localhost:8790';
const salida = join(raiz, 'docs', 'capturas', 'flex');
const tutorial = join(raiz, 'docs', 'capturas', 'flex-tutorial');
const web = join(raiz, 'apps', 'panel', 'public', 'flex');
const docs = join(raiz, 'apps', 'panel', 'public', 'docs');
mkdirSync(salida, { recursive: true });
mkdirSync(tutorial, { recursive: true });
mkdirSync(web, { recursive: true });
const corrida = Date.now().toString(36);
const clave = `Flex-${corrida}-Clave1`;
let ip = 0;

// C-CAPTURAS-POR-IDIOMA: los datos de cada pasada.
const LUGARES = {
  ve: {
    pais: 'VE',
    locale: 'es-VE',
    zona: 'America/Caracas',
    dueno: 'Ana Gomez',
    empresa: 'Repuestos Ejemplo',
    centro: {
      nombre: 'Centro de acopio Chacao',
      direccion: 'Av. Principal, Chacao',
      ciudad: 'Caracas',
      lat: 10.4961,
      lng: -66.8533,
    },
    destinatarioApp: {
      nombre: 'Maria Perez',
      telefono: '04140000001',
      casa: {
        etiqueta: 'Casa',
        direccion: 'Calle 3, Los Palos Grandes, Caracas',
        lat: 10.4983,
        lng: -66.8445,
        instrucciones: 'Edificio rojo, piso 3',
      },
    },
    paquete: 'Repuestos de moto',
    envios: [
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
    ],
    enlaceConfirmado: {
      lat: 10.4955,
      lng: -66.8531,
      referencias: 'Frente a la farmacia, edificio azul',
    },
    geoDestinatario: { lat: 10.4983, lng: -66.8445 },
    conductor: 'Pedro Conductor',
    ruta: 'Ruta Chacao mañana',
  },
  us: {
    pais: 'US',
    locale: 'en-US',
    zona: 'America/Detroit',
    dueno: 'Sam Carter',
    empresa: 'Lakeside Parts',
    centro: {
      nombre: 'Novi Warehouse',
      direccion: '43000 Grand River Ave, Novi, MI 48375',
      ciudad: 'Novi',
      lat: 42.4775,
      lng: -83.4766,
    },
    destinatarioApp: {
      nombre: 'Jamie Lee',
      telefono: '2485550101',
      casa: {
        etiqueta: 'Home',
        direccion: '24600 Taft Rd, Novi, MI 48375',
        lat: 42.4705,
        lng: -83.488,
        instrucciones: 'Gray house with a red door',
      },
    },
    paquete: 'Auto parts',
    envios: [
      {
        referenciaExterna: 'ORD-1001',
        destinatarioNombre: 'Jamie Lee',
        destinatarioTelefono: '(248) 555-0101',
        direccion: '24600 Taft Rd, Novi, MI 48375',
      },
      {
        referenciaExterna: 'ORD-1002',
        destinatarioNombre: 'Chris Miller',
        destinatarioTelefono: '(248) 555-0102',
        direccion: '43100 Crescent Blvd, Novi, MI 48375',
        referencias: 'Suite 200, front desk',
      },
      {
        referenciaExterna: 'ORD-1003',
        destinatarioNombre: 'Taylor Brooks',
        destinatarioTelefono: '(248) 555-0103',
        direccion: '45255 W 10 Mile Rd, Novi, MI 48375',
        referencias: 'Staff entrance on the east side',
        lat: 42.4722,
        lng: -83.478,
      },
      {
        referenciaExterna: 'ORD-1004',
        destinatarioNombre: 'Morgan Davis',
        destinatarioTelefono: '(248) 555-0104',
        direccion: '27500 Novi Rd, Novi, MI 48377',
      },
    ],
    enlaceConfirmado: { lat: 42.481, lng: -83.4735, referencias: 'Suite 200, front desk' },
    // Twelve Oaks Mall: lo que el teléfono de quien recibe dice que es «mi ubicación».
    geoDestinatario: { lat: 42.4915, lng: -83.4706 },
    conductor: 'Alex Turner',
    ruta: 'Novi morning route',
    // Solo la pasada en inglés: el tutorial, el recorrido del panel y las demás pantallas.
    extras: {
      envios: [
        {
          referenciaExterna: 'ORD-1005',
          destinatarioNombre: 'Riley Johnson',
          destinatarioTelefono: '(248) 555-0105',
          direccion: '1499 E West Maple Rd, Walled Lake, MI 48390',
          lat: 42.5373,
          lng: -83.4583,
        },
        {
          referenciaExterna: 'ORD-1006',
          destinatarioNombre: 'Avery Wilson',
          destinatarioTelefono: '(248) 555-0106',
          direccion: '100 N Pontiac Trl, Walled Lake, MI 48390',
          lat: 42.5377,
          lng: -83.4811,
        },
        {
          referenciaExterna: 'ORD-1007',
          destinatarioNombre: 'Jordan Smith',
          destinatarioTelefono: '(248) 555-0107',
          direccion: '45175 W 10 Mile Rd, Novi, MI 48375',
          lat: 42.4712,
          lng: -83.4745,
        },
      ],
      rutaTarde: 'Walled Lake afternoon route',
      invitado: { nombre: 'Casey Morgan', correo: 'casey.morgan@example.com' },
    },
  },
};

/**
 * En la foto, la dirección pública: en esta computadora el sitio vive en localhost y los enlaces que
 * el panel muestra (invitar a un conductor, pedir la ubicación) saldrían con esa dirección.
 */
const direccionPublica = (pagina) =>
  pagina.evaluate(() => {
    const doc = globalThis.document;
    const publica = (texto) =>
      texto
        .replace(/https?:\/\/localhost:\d+/g, 'https://divoox.com')
        .replace(/localhost:\d+/g, 'divoox.com');
    const w = doc.createTreeWalker(doc.body, 4);
    while (w.nextNode()) {
      const n = w.currentNode;
      if ((n.nodeValue ?? '').includes('localhost')) n.nodeValue = publica(n.nodeValue);
    }
    for (const c of doc.querySelectorAll('input, textarea'))
      if (c.value.includes('localhost')) c.value = publica(c.value);
  });

async function api(metodo, ruta, cuerpo, token) {
  ip++;
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      'cf-connecting-ip': `10.66.${Math.floor(ip / 250) % 250}.${ip % 250}`,
      'idempotency-key': `cap-${corrida}-${ip}`,
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
async function cuenta(nombre, rol, telefono = '') {
  // El correo sale en el menú de la cuenta: nombre.apellido@example.com; si ya existe de otra
  // corrida, se le suma la marca de esta.
  const slug = nombre.toLowerCase().replace(/[^a-z]+/g, '.');
  let correo = `${slug}@example.com`;
  // La cuenta de una corrida anterior de este guion con ese mismo correo se aparta (solo en el
  // servidor local del recorrido), para que el correo de la foto quede limpio.
  await sql(
    `UPDATE usuarios SET correo = '${slug}.anterior.' || substr(id, 1, 8) || '@example.com' WHERE correo = '${correo}'`,
  );
  // El correo «canónico» (C-IDENTIDAD-UNICA) también se aparta, o el registro lo sigue viendo ocupado.
  await sql(
    `UPDATE usuarios SET correo_canonico = correo WHERE correo LIKE '${slug}.anterior.%@example.com'`,
  );
  // El teléfono de la destinataria de una corrida anterior de ESTE guion (mismo nombre) se libera:
  // el teléfono es único y el envío nuevo tiene que encontrar a la cuenta nueva.
  if (telefono)
    await sql(
      `UPDATE usuarios SET telefono = NULL, telefono_canonico = NULL WHERE (correo LIKE '${slug}%' OR correo LIKE '${slug.replace(/\./g, '')}.%@recorrido.test') AND (telefono IS NOT NULL OR telefono_canonico IS NOT NULL)`,
    );
  const registro = () =>
    api('POST', '/datos/cuentas/registro', { nombre, correo, clave, rol, telefono });
  const r = await registro().catch(() => {
    correo = `${slug}.${corrida}@example.com`;
    return registro();
  });
  await sql(
    `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
  );
  return { token: r.token, id: r.usuario.id, correo };
}
const aWebp = (png, webp, ancho) =>
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    ...(ancho ? ['-resize', String(ancho), '0'] : []),
    png,
    '-o',
    webp,
  ]);

const navegador = await chromium.launch();

async function correr(L, idiomas) {
  const dueno = await cuenta(L.dueno, 'cliente');
  const empresa = (
    await api(
      'POST',
      '/datos/v1/flex/empresas',
      { nombre: L.empresa, pais: L.pais, moneda: 'USD' },
      dueno.token,
    )
  ).empresa;
  const E = `/datos/v1/flex/empresas/${empresa.id}`;
  const centro = (await api('POST', `${E}/centros`, { ...L.centro, pais: L.pais }, dueno.token))
    .centro;
  // Una destinataria que ya usa la app de Divoox con su casa marcada.
  const cliente = await cuenta(L.destinatarioApp.nombre, 'cliente', L.destinatarioApp.telefono);
  await api('POST', '/datos/mis-direcciones', L.destinatarioApp.casa, cliente.token);
  const base = { centroId: centro.id, paquetes: [{ descripcion: L.paquete, pesoG: 2500 }] };
  const envios = [];
  for (const e of L.envios)
    envios.push((await api('POST', `${E}/envios`, { ...base, ...e }, dueno.token)).envio);
  const enlace = await api('POST', `${E}/envios/${envios[1].id}/enlace-ubicacion`, {}, dueno.token);
  const codigoEnlace = String(enlace.url).split('/deliver/')[1];
  await api('POST', `/datos/v1/flex/publico/ubicacion/${codigoEnlace}`, L.enlaceConfirmado);
  const enlacePendiente = await api(
    'POST',
    `${E}/envios/${envios[3].id}/enlace-ubicacion`,
    {},
    dueno.token,
  );
  const codigoPendiente = String(enlacePendiente.url).split('/deliver/')[1];

  // El tercer paquete pasa por el centro y queda listo para salir (así el rastreo tiene historia).
  for (const tipo of ['registrado_centro', 'preparado'])
    await api('POST', `${E}/paquetes/${envios[2].paquetes[0].id}/eventos`, { tipo }, dueno.token);

  // Un conductor de la empresa con la ruta de la mañana (los tres envíos con ubicación confirmada).
  const conductor = await cuenta(L.conductor, 'repartidor');
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
      { nombre: L.ruta, centroId: centro.id, envioIds: envios.slice(0, 3).map((x) => x.id) },
      dueno.token,
    )
  ).ruta;
  await api('POST', `${E}/rutas/${ruta.id}/asignar`, { conductorId: conductor.id }, dueno.token);

  // Solo en inglés: tres envíos más y una ruta en borrador para el tutorial.
  let rutaTarde = null;
  const extras = [];
  if (L.extras) {
    for (const e of L.extras.envios)
      extras.push((await api('POST', `${E}/envios`, { ...base, ...e }, dueno.token)).envio);
    rutaTarde = (
      await api(
        'POST',
        `${E}/rutas`,
        { nombre: L.extras.rutaTarde, centroId: centro.id, envioIds: extras.map((x) => x.id) },
        dueno.token,
      )
    ).ruta;
  }

  async function foto(pagina, nombre, opciones = {}) {
    await pagina.waitForTimeout(1200);
    await direccionPublica(pagina);
    await pagina.screenshot({
      path: join(salida, `fase5-${nombre}.png`),
      fullPage: false,
      ...opciones,
    });
    console.log('captura', nombre);
  }
  const panel = async (idioma, viewport = { width: 1280, height: 860 }) => {
    const ctx = await navegador.newContext({ viewport, locale: L.locale, timezoneId: L.zona });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: dueno.token, url: URL, httpOnly: true },
    ]);
    await ctx.addInitScript(
      ([i, t]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', t);
      },
      [idioma, dueno.token],
    );
    return ctx;
  };
  const telefono = (geo) =>
    navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: L.locale,
      timezoneId: L.zona,
      ...(geo
        ? { geolocation: { latitude: geo.lat, longitude: geo.lng }, permissions: ['geolocation'] }
        : {}),
    });

  for (const idioma of idiomas) {
    const pre = idioma === 'es' ? '/es' : '';
    const t = (es, en) => (idioma === 'es' ? es : en);
    const R = `${URL}${pre}/panel/business/${empresa.id}`;
    // ── Panel de la empresa (escritorio) ──
    const ctx = await panel(idioma);
    const p = await ctx.newPage();
    await p.goto(R);
    await p.waitForLoadState('domcontentloaded');
    await foto(p, `panel-inicio-${idioma}`);
    await p.goto(`${R}/shipments`);
    await foto(p, `panel-envios-${idioma}`);
    await p.goto(`${R}/shipments/new`);
    await foto(p, `panel-nuevo-envio-${idioma}`);
    await p.goto(`${R}/shipments/${envios[3].id}`);
    await p
      .getByRole('button', {
        name: t('Pedir la ubicación al destinatario', 'Ask the recipient for their location'),
      })
      .click();
    await foto(p, `panel-pedir-ubicacion-${idioma}`);
    await p.goto(`${R}/shipments/${envios[0].id}`);
    await foto(p, `panel-ubicacion-app-${idioma}`);
    // La pantalla de las llaves de la API (guía «flex-api»).
    await p.goto(`${R}/keys`);
    await foto(p, `panel-claves-${idioma}`);
    await p.goto(`${R}/labels`);
    await p.getByText('ORD-1003').first().click();
    await p.setViewportSize({ width: 1280, height: 1180 });
    await foto(p, `panel-etiquetas-${idioma}`);
    await p.setViewportSize({ width: 1280, height: 860 });
    // ── Lo que ve el destinatario (celular) ──
    const movil = await telefono(L.geoDestinatario);
    const d = await movil.newPage();
    await d.goto(`${URL}${pre}/deliver/${codigoPendiente}`);
    await d.waitForTimeout(1500);
    // En Estados Unidos quien recibe toca «Usar mi ubicación actual»: el mapa se pone en su puerta
    // (sin punto, el mapa abre en el centro por defecto del país, que no es Novi).
    if (L.pais === 'US')
      await d
        .getByRole('button', { name: t('Usar mi ubicación actual', 'Use my current location') })
        .click()
        .catch(() => null);
    await d.waitForTimeout(1500);
    await foto(d, `destinatario-confirmar-${idioma}`);
    const codigoSeguimiento = envios[2].paquetes[0].codigoSeguimiento;
    await d.goto(`${URL}${pre}/track/${codigoSeguimiento}`);
    await foto(d, `rastreo-${idioma}`);
    // ── App del cliente: «Mis paquetes» ──
    const app = await movil.newPage();
    await app.addInitScript(
      ([tk, i]) => {
        localStorage.setItem('tumbite.sesion', tk);
        localStorage.setItem('tumbite.idioma', i);
      },
      [cliente.token, idioma],
    );
    await app.goto(`${URL}/app/packages`);
    await app.waitForTimeout(2500);
    await foto(app, `app-mis-paquetes-${idioma}`);
    // La lista de rutas con su estado (en Estados Unidos, la pantalla «Rutas» de hoy).
    await p.goto(`${R}/${L.pais === 'US' ? 'operativas' : 'routes'}`);
    await foto(p, `panel-rutas-${idioma}`);
    // ── App del conductor: «Mis rutas» y el detalle de la ruta ──
    const drv = await movil.newPage();
    await drv.addInitScript(
      ([tk, u, i]) => {
        localStorage.setItem('tumbite.sesion', tk);
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [conductor.token, conductor.id, idioma],
    );
    await drv.goto(`${URL}/driver/`);
    await drv.waitForTimeout(3500);
    await drv
      .getByRole('button', { name: t(/menú/i, /menu/i) })
      .first()
      .click({ timeout: 30_000 });
    await drv
      .getByText(t('Mi ruta (paquetes)', 'My route (packages)'), { exact: true })
      .first()
      .click({ timeout: 30_000 });
    await drv.waitForTimeout(2000);
    await foto(drv, `driver-mis-rutas-${idioma}`);
    await drv.getByText(t('Ver detalles', 'View details')).first().click();
    await foto(drv, `driver-ruta-${idioma}`);

    if (L.extras)
      await capturasExtra({
        idioma,
        pre,
        t,
        R,
        p,
        ctx,
        empresa,
        envios,
        extras,
        rutaTarde,
        dueno,
        E,
      });
    await ctx.close();
    await movil.close();
  }
}

/** Solo la pasada en inglés: tutorial, recorrido del panel, billetera y las demás pantallas. */
async function capturasExtra({
  idioma,
  pre,
  t,
  R,
  p,
  empresa,
  envios,
  extras,
  rutaTarde,
  E,
  dueno,
}) {
  const L = LUGARES.us;
  // La cadena de custodia de un paquete (guía «crear envíos, importar y etiquetar»).
  await p.goto(`${R}/shipments/${envios[2].id}`);
  await p.getByText(t('Cadena de custodia', 'Chain of custody')).first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await p
    .getByText(t('Cadena de custodia', 'Chain of custody'))
    .first()
    .evaluate((n) => n.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => globalThis.scrollBy(0, -120));
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(salida, `fase5-panel-custodia-${idioma}.png`) });
  console.log('captura panel-custodia');

  // La billetera con saldo (ajuste del equipo en este servidor local) y las pantallas de operación.
  const admin = await cuenta('Support Team', 'cliente');
  await sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
  await api(
    'POST',
    `/datos/admin/finanzas/empresas/${empresa.id}/ajuste`,
    { monto: 5000, motivo: 'Opening balance for the wallet', clave },
    admin.token,
  ).catch((x) => console.error('ajuste de billetera:', String(x).slice(0, 200)));
  const grande = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    locale: L.locale,
    timezoneId: L.zona,
  });
  await grande.addCookies([
    { name: 'tumbite_sesion', value: dueno.token, url: URL, httpOnly: true },
  ]);
  await grande.addInitScript(
    ([i, tk]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', tk);
    },
    [idioma, dueno.token],
  );
  const g = await grande.newPage();
  const fotoG = async (nombre, opciones = {}) => {
    await g.waitForTimeout(1500);
    await g.screenshot({ path: join(salida, `fase5-${nombre}-${idioma}.png`), ...opciones });
    console.log('captura', nombre);
  };
  for (const [ruta, nombre] of [
    ['wallet', 'billetera'],
    ['operations', 'operacion'],
    ['vehicles', 'vehiculos'],
    ['integrations', 'integraciones'],
  ]) {
    await g.goto(`${R}/${ruta}`);
    await g.waitForLoadState('networkidle').catch(() => null);
    await fotoG(nombre);
  }
  // El recorrido del panel: inicio, el menú de la cuenta abierto y el menú en el celular.
  await g.goto(R);
  await g.waitForLoadState('networkidle').catch(() => null);
  await fotoG('tour-inicio');
  await g
    .getByRole('button', { name: /^S\b|Sam/ })
    .first()
    .click()
    .catch((x) => console.error('menú de la cuenta:', String(x).slice(0, 160)));
  await fotoG('tour-cuenta');
  await grande.close();
  const cel = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: L.locale,
    timezoneId: L.zona,
  });
  await cel.addCookies([{ name: 'tumbite_sesion', value: dueno.token, url: URL, httpOnly: true }]);
  await cel.addInitScript(
    ([i, tk]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', tk);
    },
    [idioma, dueno.token],
  );
  const c = await cel.newPage();
  await c.goto(R);
  await c.waitForLoadState('networkidle').catch(() => null);
  await c.waitForTimeout(1200);
  await c
    .getByRole('button', { name: t(/menú/i, /menu/i) })
    .first()
    .click()
    .catch((x) => console.error('menú del celular:', String(x).slice(0, 160)));
  await c.waitForTimeout(1200);
  await c.screenshot({ path: join(salida, `fase5-tour-menu-celular-${idioma}.png`) });
  console.log('captura tour-menu-celular');

  // El tutorial «Empieza con Divoox Flex», paso a paso.
  const tut = await navegador.newContext({
    viewport: { width: 1366, height: 860 },
    locale: L.locale,
    timezoneId: L.zona,
  });
  await tut.addCookies([{ name: 'tumbite_sesion', value: dueno.token, url: URL, httpOnly: true }]);
  await tut.addInitScript(
    ([i, tk]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', tk);
    },
    [idioma, dueno.token],
  );
  const q = await tut.newPage();
  const fotoT = async (nombre, entera = false) => {
    await q.waitForTimeout(1500);
    await direccionPublica(q);
    await q.screenshot({ path: join(tutorial, `${nombre}-${idioma}.png`), fullPage: entera });
    console.log('captura tutorial', nombre);
  };
  const ir = (r) => q.goto(`${URL}${pre}${r}`, { waitUntil: 'networkidle' }).catch(() => null);
  const raizT = `/panel/business/${empresa.id}`;
  await ir('/panel/business');
  await fotoT('01-registro', true);
  await ir(raizT);
  await fotoT('02-inicio', true);
  await ir(`${raizT}/hubs`);
  await fotoT('03-centros');
  await ir(`${raizT}/drivers`);
  await q.getByLabel(t('Nombre del conductor', 'Driver name')).fill(L.extras.invitado.nombre);
  await q.getByLabel(t('Correo (opcional)', 'Email (optional)')).fill(L.extras.invitado.correo);
  await q.getByRole('button', { name: t('Invitar conductor', 'Invite a driver') }).click();
  await q.getByRole('link', { name: t('Mandar por WhatsApp', 'Send by WhatsApp') }).waitFor();
  const enlaceInvitacion = (await q.locator('.flex-enlace-invitacion code').textContent()) ?? '';
  await fotoT('04-invitar-conductor', true);
  await ir(`${raizT}/shipments/new`);
  await fotoT('05-nuevo-envio', true);
  await ir(`${raizT}/import`);
  await fotoT('06-importar');
  await ir(`${raizT}/labels`);
  await fotoT('07-etiquetas');
  await ir(`${raizT}/operativas`);
  await fotoT('08-rutas');
  await ir(`${raizT}/routes`);
  // El nombre de la ruta, escrito como lo haría la empresa (la casilla sugiere «Ruta 1» en los dos idiomas).
  if (idioma === 'en')
    await q
      .getByPlaceholder('Ruta 1')
      .first()
      .fill('Morning route')
      .catch(() => null);
  await fotoT('09-nueva-ruta', true);
  await ir(`${raizT}/operativas/${rutaTarde.id}`);
  await fotoT('10-asignar-ruta', true);
  await tut.close();
  const pub = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: L.locale,
    timezoneId: L.zona,
  });
  await pub.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const u = await pub.newPage();
  const fotoU = async (nombre) => {
    await u.waitForTimeout(1500);
    await u.screenshot({ path: join(tutorial, `${nombre}-${idioma}.png`) });
    console.log('captura tutorial', nombre);
  };
  const token = enlaceInvitacion.trim().split('/').at(-1);
  await u.goto(`${URL}${pre}/driver/join/${token}`, { waitUntil: 'networkidle' }).catch(() => null);
  await fotoU('11-invitacion-conductor');
  await u
    .goto(`${URL}${pre}/track/${extras[0].paquetes[0].codigoSeguimiento}`, {
      waitUntil: 'networkidle',
    })
    .catch(() => null);
  await fotoU('12-rastreo');
  await pub.close();
  // La invitación de ejemplo (a un correo que no existe) se cancela: solo era para la foto.
  const { invitaciones } = await api('GET', `${E}/conductores`, undefined, dueno.token);
  for (const i of invitaciones ?? [])
    await api('DELETE', `${E}/conductores/invitaciones/${i.id}`, undefined, dueno.token).catch(
      () => null,
    );
}

const SOLO = process.env.SOLO_IDIOMA;
const idiomas = [];
if (SOLO !== 'en') {
  await correr(LUGARES.ve, ['es']);
  idiomas.push('es');
}
if (SOLO !== 'es') {
  await correr(LUGARES.us, ['en']);
  idiomas.push('en');
}
await navegador.close();

// Para la web: WebP livianos en apps/panel/public/flex/ (solo los idiomas de esta corrida).
for (const l of idiomas)
  for (const n of [
    'app-mis-paquetes',
    'destinatario-confirmar',
    'driver-mis-rutas',
    'driver-ruta',
    'panel-claves',
    'panel-envios',
    'panel-etiquetas',
    'panel-inicio',
    'panel-nuevo-envio',
    'panel-pedir-ubicacion',
    'panel-rutas',
    'panel-ubicacion-app',
    'rastreo',
  ]) {
    const png = join(salida, `fase5-${n}-${l}.png`);
    // Ruta fija dentro de docs/capturas/flex (nombre de la lista de arriba).
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(png)) continue;
    aWebp(png, join(web, `${n}-${l}.webp`));
    // Las que usan las guías de Docs van también a public/docs (la prueba de Docs las exige ahí).
    if (n !== 'panel-inicio' && n !== 'panel-envios') aWebp(png, join(docs, `flex-${n}-${l}.webp`));
  }
// Las de la pasada en inglés que solo van a Docs (las del panel, a su ancho; las del celular, a 540).
if (idiomas.includes('en')) {
  for (const [n, destino, ancho] of [
    ['panel-custodia', 'flex-panel-custodia', 0],
    ['billetera', 'flex-billetera', 0],
    ['operacion', 'flex-operacion', 0],
    ['vehiculos', 'flex-vehiculos', 0],
    ['integraciones', 'flex-integraciones', 0],
    ['tour-inicio', 'flex-panel-inicio', 0],
    ['tour-cuenta', 'flex-panel-cuenta', 0],
    ['tour-menu-celular', 'flex-panel-menu-celular', 540],
  ])
    aWebp(join(salida, `fase5-${n}-en.png`), join(docs, `${destino}-en.webp`), ancho);
  for (const n of [
    '01-registro',
    '02-inicio',
    '03-centros',
    '04-invitar-conductor',
    '05-nuevo-envio',
    '06-importar',
    '07-etiquetas',
    '08-rutas',
    '09-nueva-ruta',
    '10-asignar-ruta',
    '11-invitacion-conductor',
    '12-rastreo',
  ])
    aWebp(join(tutorial, `${n}-en.png`), join(docs, `flex-tutorial-${n}-en.webp`));
}
console.log(JSON.stringify({ ok: true, idiomas }));
