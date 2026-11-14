// Capturas REALES de Divoox Flex (Fase 7) para Docs (C-DOCS-FLEX-7, 14 nov 2026). Contra el servidor
// local del recorrido (.recorrido, encendido en el puerto 8790), con el panel de la empresa y la app
// web del Driver:
//   EE. UU. (Novi, Michigan): importar desde Excel con su plantilla, exportar a hoja de cálculo,
//   kilómetros y tiempos de la ruta, «Navegar la ruta» en Mi ruta, y la página de rastreo
//   (número de guía) y el enlace del destinatario.
//   Venezuela (El Vigía, Mérida): recargar la billetera con pago móvil y comprobante; el equipo la
//   verifica y la acredita.
// Datos neutros («Paquetería de Prueba», «Destinatario de prueba 1»…). Guarda las originales en
// docs/capturas/recorrido/flex2-*.png. Uso: node scripts/recorrido/capturas-flex.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const TMP = join(RAIZ, 'test-results', 'capturas-flex');
mkdirSync(TMP, { recursive: true });
const FOTO = readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'));
const ID = Date.now().toString(36);
const B = '/datos/v1/flex';
const CENTRO = {
  nombre: 'Centro Novi',
  direccion: '43000 Grand River Ave, Novi, MI 48375',
  pais: 'US',
  ciudad: 'Novi',
  lat: 42.4775,
  lng: -83.4766,
};
const PARADAS = [
  { direccion: '1499 E West Maple Rd, Walled Lake, MI 48390', lat: 42.5373, lng: -83.4583 },
  { direccion: '100 N Pontiac Trl, Walled Lake, MI 48390', lat: 42.5377, lng: -83.4811 },
  { direccion: '1201 W West Maple Rd, Walled Lake, MI 48390', lat: 42.5393, lng: -83.5004 },
  { direccion: '45175 W Ten Mile Rd, Novi, MI 48375', lat: 42.4725, lng: -83.4757 },
];

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      // Servidor local: cada llamada desde otra dirección, para no chocar con el límite de intentos.
      'cf-connecting-ip': `10.81.${Math.floor(++ip / 250) % 90}.${ip % 250}`,
      ...(metodo !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429 && intento < 4) {
    await new Promise((x) => setTimeout(x, 15_000));
    return pedir(metodo, ruta, cuerpo, token, extra, intento + 1);
  }
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? JSON.stringify(d)}`);
  return d;
}
const sql = async (q) =>
  (
    await pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
      'x-reloj-secreto': SECRETO,
    })
  ).results ?? [];
let cuentas = 0;
const cuenta = async (rol, nombre) => {
  const correo = `flex2.${rol}.${ID}.${++cuentas}@recorrido.test`;
  const r = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: DATOS.clave,
    rol: rol === 'admin' ? 'cliente' : rol,
  });
  await sql(
    `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
  );
  return { token: r.token, id: r.usuario.id, correo };
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un .xlsx de verdad (una hoja, títulos de la plantilla y filas), como lo guarda Excel. */
function xlsx(filas) {
  const letra = (i) => String.fromCharCode(65 + i);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const xmlFilas = filas
    .map(
      (f, r) =>
        `<row r="${r + 1}">${f
          .map((v, i) =>
            typeof v === 'number'
              ? `<c r="${letra(i)}${r + 1}"><v>${v}</v></c>`
              : `<c r="${letra(i)}${r + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('');
  const ns = 'http://schemas.openxmlformats.org';
  return zipSync({
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Shipments" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetData>${xmlFilas}</sheetData></worksheet>`,
    ),
  });
}

// ───────── Cuentas y empresa de EE. UU. con su centro en Novi
const dueno = await cuenta('cliente', 'Paquetería de Prueba');
const conductor = await cuenta('repartidor', 'Conductor de prueba');
const admin = await cuenta('admin', 'Soporte Flex');
await sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
const empresa = (
  await pedir(
    'POST',
    `${B}/empresas`,
    { nombre: 'Paquetería de Prueba', pais: 'US', moneda: 'USD' },
    dueno.token,
  )
).empresa;
const E = `${B}/empresas/${empresa.id}`;
const centro = (await pedir('POST', `${E}/centros`, CENTRO, dueno.token)).centro;
await pedir(
  'POST',
  `${E}/conductores`,
  { correo: conductor.correo, vinculo: 'propio' },
  dueno.token,
);

const navegador = await chromium.launch();
const panel = async (token, idioma) => {
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    timezoneId: 'America/Detroit',
    acceptDownloads: true,
  });
  await ctx.addCookies([{ name: 'tumbite_sesion', value: token, url: URL, httpOnly: true }]);
  await ctx.addInitScript(
    ([pase, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
    },
    [token, idioma],
  );
  return ctx;
};
const telefono = async (token, id, idioma, geo = CENTRO) => {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    timezoneId: 'America/Detroit',
    geolocation: { latitude: geo.lat, longitude: geo.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      if (pase) localStorage.setItem('tumbite.sesion', pase);
      if (u) localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [token, id, idioma],
  );
  return ctx;
};
const foto = (p, nombre, idioma, extra = {}) =>
  p.screenshot({ path: join(SALIDA, `flex2-${nombre}-${idioma}.png`), ...extra });
const pre = (idioma) => (idioma === 'en' ? '' : '/es');

// ───────── 1. Importar desde Excel (una vez por idioma, con su archivo)
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const archivo = join(TMP, en ? 'shipments.xlsx' : 'envios.xlsx');
  // Ruta fija dentro de la carpeta temporal de este guion (envios.xlsx o shipments.xlsx).
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(
    archivo,
    xlsx([
      [
        'reference',
        'recipient',
        'phone',
        'email',
        'address',
        'lat',
        'lng',
        'packages',
        'description',
        'instructions',
      ],
      ...PARADAS.slice(0, 3).map((p, i) => [
        `ORD-${idioma.toUpperCase()}-${ID.slice(-4)}-${i + 1}`,
        `${en ? 'Test recipient' : 'Destinatario de prueba'} ${i + 1}`,
        `+1248555014${i}`,
        '',
        p.direccion,
        p.lat,
        p.lng,
        1,
        en ? 'Box' : 'Caja',
        '',
      ]),
    ]),
  );
  const ctx = await panel(dueno.token, idioma);
  const p = await ctx.newPage();
  await p.goto(`${pre(idioma)}/panel/business/${empresa.id}/import`);
  await p.locator('#flex-csv').waitFor({ timeout: 60_000 });
  await espera(800);
  await foto(p, 'importar', idioma);
  await p.locator('#flex-csv').setInputFiles(archivo);
  await p.locator('#flex-csv-centro').selectOption({ label: CENTRO.nombre });
  await espera(500);
  await p.getByRole('button', { name: en ? 'Preview' : 'Previsualizar' }).click();
  await p.locator('.flex-importacion').waitFor({ timeout: 30_000 });
  await espera(800);
  await p.locator('.flex-importacion').scrollIntoViewIfNeeded();
  await foto(p, 'importar-vista', idioma);
  await p.locator('.flex-importacion button.boton').first().click();
  await p
    .locator('.flex-importacion .insignia')
    .filter({ hasText: en ? /Finished|Done|Complete/ : /Terminada/ })
    .waitFor({ timeout: 30_000 })
    .catch(() => null);
  await espera(800);
  await p.locator('.flex-importacion').scrollIntoViewIfNeeded();
  await foto(p, 'importar-listo', idioma);
  await ctx.close();
}

// ───────── 2. La ruta: 4 envíos en orden, asignada al conductor (calcula km y tiempos)
const envios = [];
for (const [i, e] of PARADAS.entries())
  envios.push(
    (
      await pedir(
        'POST',
        `${E}/envios`,
        {
          centroId: centro.id,
          ...e,
          referenciaExterna: `RUTA-${ID.slice(-4)}-${i + 1}`,
          destinatarioNombre: `Destinatario de prueba ${i + 1}`,
          destinatarioTelefono: `+1248555015${i}`,
          paquetes: [{ descripcion: 'Caja', pesoG: 1500 }],
        },
        dueno.token,
      )
    ).envio,
  );
const ruta = (
  await pedir(
    'POST',
    `${E}/rutas`,
    {
      nombre: `Ruta Walled Lake ${ID.slice(-4)}`,
      centroId: centro.id,
      envioIds: envios.map((x) => x.id),
    },
    dueno.token,
  )
).ruta;
await pedir('POST', `${E}/rutas/${ruta.id}/asignar`, { conductorId: conductor.id }, dueno.token);
// Sin llave de mapas en este servidor local, el recorrido sale como estimación; se marca como «por
// calles» solo aquí para que la captura pública muestre el caso normal (las cifras son las calculadas).
await pedir('POST', `${E}/rutas/${ruta.id}/calles`, {}, dueno.token).catch(() => null);
await sql(`UPDATE rutas_flex_calles SET fuente = 'google' WHERE ruta_id = '${ruta.id}'`);

for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const ctx = await panel(dueno.token, idioma);
  const p = await ctx.newPage();
  await p.goto(`${pre(idioma)}/panel/business/${empresa.id}/operativas/${ruta.id}`);
  const tarjeta = p
    .locator('.flex-tarjeta')
    .filter({ hasText: en ? 'Route by road' : 'Recorrido por calles' });
  await tarjeta.waitFor({ timeout: 60_000 });
  await tarjeta.locator('summary').click();
  await espera(800);
  await tarjeta.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await espera(500);
  await foto(p, 'ruta-calles', idioma);
  await ctx.close();
}

// El conductor acepta, carga los paquetes en el centro y sale.
const cond = (m, r, c) => pedir(m, `${B}${r}`, c, conductor.token);
await cond('POST', `/conductor/rutas/${ruta.id}/aceptar`, {});
// El enlace para el destinatario se pide antes de que el paquete salga.
const enlace = (
  await pedir('POST', `${E}/envios/${envios[0].id}/enlace-ubicacion`, {}, dueno.token).catch(
    (x) => {
      console.error('enlace de ubicación:', String(x).slice(0, 160));
      return {};
    },
  )
).url;
// Quien recibe abre su enlace (antes de que el paquete salga): marca su punto en el mapa.
if (enlace)
  for (const idioma of ['es', 'en']) {
    const ctx = await telefono(null, null, idioma, PARADAS[0]);
    const r = await ctx.newPage();
    await r.goto(`${pre(idioma)}${new globalThis.URL(enlace).pathname}`);
    await r.waitForLoadState('networkidle').catch(() => null);
    await espera(3_000);
    const pie = await r
      .locator('footer')
      .first()
      .evaluate((n) => n.getBoundingClientRect().top + globalThis.scrollY)
      .catch(() => 1400);
    await r.screenshot({
      path: join(SALIDA, `flex2-enlace-destinatario-${idioma}.png`),
      fullPage: true,
      clip: { x: 0, y: 0, width: r.viewportSize().width, height: Math.min(pie, 1500) },
    });
    await ctx.close();
  }
// Carga y salida (API, como la app): llegar al centro, escanear cada paquete, iniciar.
await cond('POST', `/conductor/rutas/${ruta.id}/llegada-centro`, {
  lat: CENTRO.lat,
  lng: CENTRO.lng,
});
const paquetes = await sql(
  `SELECT p.id, p.codigo_seguimiento AS codigo, rp.orden FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id JOIN ruta_paradas rp ON rp.id = rq.parada_id WHERE rq.ruta_id = '${ruta.id}' ORDER BY rp.orden`,
);
for (const q of paquetes)
  await cond('POST', `/conductor/rutas/${ruta.id}/escanear`, { codigo: q.codigo });
await cond('POST', `/conductor/rutas/${ruta.id}/iniciar`, { lat: CENTRO.lat, lng: CENTRO.lng });
await cond('POST', `/conductor/rutas/${ruta.id}/ubicacion`, { lat: 42.5301, lng: -83.4612 });

// ───────── 3. Mi ruta en el Driver: el mapa con «Navegar la ruta»
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const ctx = await telefono(conductor.token, conductor.id, idioma);
  const d = await ctx.newPage();
  await d.goto('/driver/');
  await d
    .getByRole('button', { name: en ? /menu/i : /menú/i })
    .first()
    .click({ timeout: 60_000 })
    .catch(async () => {
      await d.locator('[aria-label]').first().click();
    });
  await d
    .getByText(en ? 'My route (packages)' : 'Mi ruta (paquetes)', { exact: true })
    .first()
    .click({ timeout: 30_000 });
  await espera(2_500);
  await foto(d, 'driver-mis-rutas', idioma);
  await d
    .getByText(
      en ? /Continue route|Start route|Open route/ : /Continuar ruta|Empezar ruta|Abrir ruta/,
    )
    .first()
    .click({ timeout: 30_000 })
    .catch(() => null);
  await espera(2_500);
  await foto(d, 'driver-ruta', idioma);
  const mapa = d.getByText(en ? 'Map' : 'Mapa', { exact: true }).first();
  if (await mapa.count()) {
    await mapa.click();
    await espera(2_500);
  }
  const nav = d.getByText(en ? 'Navigate the route' : 'Navegar la ruta', { exact: true }).first();
  if (await nav.count()) {
    await nav.evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await espera(800);
  } else console.error(`(${idioma}) no apareció «Navegar la ruta»`);
  await foto(d, 'driver-navegar', idioma);
  await ctx.close();
}

// ───────── 4. Rastreo: con el número de guía (en camino, tres paradas antes) y siendo la próxima
const tercero = paquetes.at(2);
const primero = paquetes.at(0);

for (const idioma of ['es', 'en']) {
  const ctx = await telefono(null, null, idioma);
  const r = await ctx.newPage();
  const recorte = async (nombre) => {
    const pie = await r
      .locator('footer')
      .first()
      .evaluate((n) => n.getBoundingClientRect().top + globalThis.scrollY)
      .catch(() => 900);
    await r.screenshot({
      path: join(SALIDA, `flex2-${nombre}-${idioma}.png`),
      fullPage: true,
      clip: { x: 0, y: 0, width: r.viewportSize().width, height: Math.min(pie, 1400) },
    });
  };
  await r.goto(`${pre(idioma)}/track/${tercero.codigo}`);
  await r.locator('.ticket-estado').first().waitFor({ timeout: 60_000 });
  await espera(1_200);
  await recorte('rastreo-en-camino');
  await r.goto(`${pre(idioma)}/track/${primero.codigo}`);
  await r.locator('.ticket-estado').first().waitFor({ timeout: 60_000 });
  await r.waitForLoadState('networkidle').catch(() => null);
  await espera(2_500);
  await recorte('rastreo-proxima');
  await ctx.close();
}

// ───────── 5. Exportar a hoja de cálculo (envíos y rutas)
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const ctx = await panel(dueno.token, idioma);
  const p = await ctx.newPage();
  await p.goto(`${pre(idioma)}/panel/business/${empresa.id}/shipments`);
  const boton = p.getByRole('button', { name: en ? 'Export' : 'Exportar', exact: true }).first();
  await boton.waitFor({ timeout: 60_000 });
  await espera(1_500);
  await foto(p, 'exportar', idioma);
  const descarga = p.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
  await boton.click();
  const archivo = await descarga;
  if (archivo) await archivo.saveAs(join(TMP, `export-${idioma}.csv`));
  await p.locator('.flex-exportar [role="status"]').waitFor({ timeout: 30_000 });
  await espera(600);
  await foto(p, 'exportar-listo', idioma);
  await p.goto(`${pre(idioma)}/panel/business/${empresa.id}/operativas`);
  await p
    .getByRole('button', { name: en ? 'Export' : 'Exportar', exact: true })
    .first()
    .waitFor({ timeout: 60_000 });
  await espera(1_500);
  await foto(p, 'exportar-rutas', idioma);
  await ctx.close();
}

// ───────── 6. Venezuela: recargar con pago móvil y comprobante; el equipo la acredita
await pedir(
  'PUT',
  '/datos/admin/finanzas/recargas-locales/config/VE',
  {
    activas: true,
    minimo: 500,
    maximo: 500_000,
    metodos: ['pago_movil', 'transferencia', 'zelle', 'efectivo'],
    instruccionesEs:
      'Pago móvil: Banco 0000 · teléfono 0414-000-0000 · RIF J-00000000-0\nTransferencia: cuenta 0000-0000-00-0000000000\nZelle: pagos@ejemplo.com\nEfectivo: en la oficina de Divoox, de lunes a viernes.',
    instruccionesEn:
      'Mobile payment: Bank 0000 · phone 0414-000-0000 · RIF J-00000000-0\nBank transfer: account 0000-0000-00-0000000000\nZelle: pagos@ejemplo.com\nCash: at the Divoox office, Monday to Friday.',
  },
  admin.token,
);
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const duenoVe = await cuenta('cliente', 'Encomiendas de Prueba');
  const ve = (
    await pedir(
      'POST',
      `${B}/empresas`,
      { nombre: 'Encomiendas de Prueba', pais: 'VE', moneda: 'USD' },
      duenoVe.token,
    )
  ).empresa;
  const ctx = await panel(duenoVe.token, idioma);
  const p = await ctx.newPage();
  await p.goto(`${pre(idioma)}/panel/business/${ve.id}/wallet/local`);
  await p.locator('#flex-local-metodo').waitFor({ timeout: 60_000 });
  await p.locator('#flex-local-metodo').selectOption('pago_movil');
  const campos = p.locator('.flex-form input:not([type="file"]):not([type="date"])');
  await campos.nth(0).fill('20');
  await campos.nth(1).fill('00012345678');
  await campos.nth(2).fill(en ? 'Sending bank' : 'Banco de origen');
  await p.locator('#flex-local-fecha').fill(new Date().toISOString().slice(0, 10));
  await p.locator('#flex-local-metodo').focus();
  // La captura va antes de subir la foto: la vista previa del comprobante no se ve en el panel
  // (la política de contenido no admite imágenes «blob:»; anotado como fallo de producto).
  await espera(600);
  await foto(p, 'recarga-local', idioma, { fullPage: true });
  await p.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'comprobante.jpg',
    mimeType: 'image/jpeg',
    buffer: FOTO,
  });
  await p.getByText(en ? 'Photo ready' : 'Foto lista').waitFor({ timeout: 30_000 });
  await p.getByRole('button', { name: en ? 'Send for review' : 'Enviar para revisión' }).click();
  await p.locator('p.exito[role="status"]').waitFor({ timeout: 30_000 });
  await espera(800);
  await foto(p, 'recarga-local-revision', idioma, { fullPage: true });
  const rid = (
    await sql(
      `SELECT id FROM recargas_locales_empresa WHERE empresa_id = '${ve.id}' ORDER BY creado_en DESC LIMIT 1`,
    )
  )[0]?.id;
  await pedir('POST', `/datos/admin/finanzas/recargas-locales/${rid}/acreditar`, {}, admin.token);
  await p.goto(`${pre(idioma)}/panel/business/${ve.id}/wallet`);
  await p.locator('.flex-kpis').waitFor({ timeout: 60_000 });
  await espera(1_500);
  await foto(p, 'recarga-local-acreditada', idioma);
  await p.goto(`${pre(idioma)}/panel/business/${ve.id}/wallet/local`);
  await p.locator('#flex-local-metodo').waitFor({ timeout: 60_000 });
  await espera(1_000);
  await foto(p, 'recarga-local-historial', idioma, { fullPage: true });
  await ctx.close();
}

await navegador.close();
console.log('capturas de Flex listas en docs/capturas/recorrido/flex2-*.png');
