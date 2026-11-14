// Capturas REALES de Divoox Moto en Venezuela para Docs (C-MOTO-VE-CAPTURAS, 13 nov 2026). Venezuela.
// Desde el 13 nov 2026 se toman en El Vigía, estado Mérida (zona VE-MER-ELVIGIA), no en Caracas, con
// una tarifa que no es de prueba (sin la etiqueta «Precio de prueba» en Docs públicos), y también
// las de seguridad: contactos de confianza, «¿Todo bien?», compartir y emergencia, y el descanso.
// Contra el servidor local del recorrido (.recorrido, armado con scripts/recorrido/preparar.mjs y
// encendido en el puerto 8790), con las apps web reales del cliente y del Driver y el panel:
//   1. corre el guion de punta a punta (probar-moto-venezuela.mjs): conductor aprobado con saldo;
//   2. el equipo escribe una tasa de referencia;
//   3. toma las pantallas en español e inglés, con datos neutros («Conductor de prueba»).
// Guarda las originales en docs/capturas/recorrido/moto-ve-*.png; luego `npm run recorrido:docs`
// las pasa a WebP para Docs. Uso: node scripts/recorrido/capturas-moto-venezuela.mjs
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const ZONA = 'VE-MER-ELVIGIA';
const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' };
const DESTINO = { lat: 8.624, lng: -71.672, direccion: 'Aeropuerto de El Vigía' };
const IDS = { cliente: 'zz-mtve-c', conductor: 'zz-mtve-k', equipo: 'zz-mtve-a' };

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      // Servidor local: cada llamada desde otra dirección, para no chocar con el límite de intentos.
      'cf-connecting-ip': `10.77.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
// Si una vuelta anterior se cortó en la captura del descanso, sus horas al volante se deshacen.
await sql(
  `UPDATE viajes SET asignado_en = datetime('now', '-15 minutes') WHERE asignado_en < datetime('now', '-12 hours') AND operacion_id IN (SELECT id FROM operaciones WHERE conductor_id = '${IDS.conductor}')`,
).catch(() => null);
execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

// Pases de sesión de una hora para las cuentas fijas (el guion borró los suyos al terminar).
const tokens = Object.fromEntries(
  Object.keys(IDS).map((k) => [k, randomBytes(24).toString('hex')]),
);
for (const [token, id] of [
  [tokens.cliente, IDS.cliente],
  [tokens.conductor, IDS.conductor],
  [tokens.equipo, IDS.equipo],
])
  await sql(
    `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+60 minutes'))`,
  );
const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
let n = 0;
const paso = (op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
    'idempotency-key': `capturas-${nombre}-${++n}-${Date.now().toString(36)}`,
  });
const cerrarColgado = async () => {
  const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (!v) return;
  if (v.estado === 'en_curso') await paso(v.id, 'terminar');
  else
    await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
      'idempotency-key': `capturas-cancelar-${Date.now().toString(36)}`,
    });
};
await pedir('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 240 }, tokens.equipo);
// Solo en este servidor local: la tarifa de la ciudad pasa a «no de prueba» para que la captura
// pública no diga «Precio de prueba (sitio de pruebas)». En el sitio de pruebas sigue siendo de prueba.
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${ZONA}' AND activa = 1`);
// Un contacto de confianza neutro y «solo de noche», para la guía de seguridad.
const seg = await pasajero('GET', '/datos/seguridad');
if (!(seg.contactos ?? []).length)
  await pasajero('POST', '/datos/seguridad/contactos', {
    nombre: 'Contacto de confianza',
    telefono: '+58 414 000 0000',
  });
await pasajero('PUT', '/datos/seguridad/compartir', { compartir: 'noche' });
await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });

const navegador = await chromium.launch();
const telefono = async (token, id, idioma) => {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i, borrador]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
      if (borrador) localStorage.setItem(`tumbite.borrador.moto.${u}`, borrador);
    },
    [token, id, idioma, null],
  );
  return ctx;
};
const foto = (p, nombre, idioma) =>
  p.screenshot({ path: join(SALIDA, `moto-ve-${nombre}-${idioma}.png`) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  await cerrarColgado();
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false });

  // ───────── Driver: Divoox Moto (ciudad, moto, papeles, estado) y el saldo
  const ctxD = await telefono(tokens.conductor, IDS.conductor, idioma);
  const d = await ctxD.newPage();
  await d.goto('/driver/');
  await d.getByRole('tab', { name: en ? 'Profile' : 'Perfil' }).click({ timeout: 60_000 });
  await d.getByText('Divoox Moto', { exact: true }).first().click();
  await d.getByTestId('mi-moto').waitFor({ timeout: 30_000 });
  await d.getByTestId('mi-moto').scrollIntoViewIfNeeded();
  await espera(800);
  await foto(d, 'driver-moto', idioma);
  await d
    .getByText(en ? 'Your documents' : 'Tus papeles', { exact: true })
    .first()
    .evaluate((n) => n.scrollIntoView({ block: 'start' }));
  await espera(600);
  await foto(d, 'driver-moto-papeles', idioma);
  // La identidad verificada, en «Documentos» del mismo perfil.
  await d.getByText('Divoox Moto', { exact: true }).first().click();
  await d
    .getByText(en ? 'Documents' : 'Documentos', { exact: true })
    .first()
    .click();
  await espera(1_500);
  await d
    .getByText(en ? 'Documents' : 'Documentos', { exact: true })
    .first()
    .evaluate((n) => n.scrollIntoView({ block: 'start' }));
  await espera(600);
  await foto(d, 'driver-identidad', idioma);
  await d.getByRole('tab', { name: en ? 'Earnings' : 'Ganancias' }).click();
  await d.getByTestId('saldo-prepago').waitFor({ timeout: 30_000 });
  await d.getByTestId('saldo-prepago').scrollIntoViewIfNeeded();
  await espera(800);
  await foto(d, 'driver-saldo', idioma);

  // ───────── Cliente: pedir moto con precio, equivalente en bolívares y forma de pago
  await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
  await conductor('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng });
  const ctxC = await telefono(tokens.cliente, IDS.cliente, idioma);
  await ctxC.addInitScript(
    ([u, b]) => localStorage.setItem(`tumbite.borrador.moto.${u}`, b),
    [
      IDS.cliente,
      JSON.stringify({
        recogida: ORIGEN.direccion,
        recogidaLat: String(ORIGEN.lat),
        recogidaLng: String(ORIGEN.lng),
        destino: DESTINO.direccion,
        destinoLat: String(DESTINO.lat),
        destinoLng: String(DESTINO.lng),
      }),
    ],
  );
  const c = await ctxC.newPage();
  await c.goto('/app/ride');
  // El mapa web arranca en la ciudad por defecto y aquí no hay buscador de direcciones (sin llave de
  // Google en local): el destino se deja escrito como lo guarda la app (su borrador) y se recorta el
  // aviso «Recuperamos lo que estabas escribiendo» de la imagen (lo de abajo es la pantalla real).
  await c.getByRole('button', { name: en ? 'See price' : 'Ver precio' }).click({ timeout: 60_000 });
  await c
    .getByTestId('moto-precio')
    .waitFor({ timeout: 30_000 })
    .catch(async (x) => {
      await c.screenshot({
        path: join(RAIZ, 'test-results', 'moto-ve-sin-precio.png'),
        fullPage: true,
      });
      throw x;
    });
  await c.getByTestId('moto-precio-bs').waitFor({ timeout: 10_000 });
  await c
    .getByText(en ? 'Mobile payment' : 'Pago móvil', { exact: true })
    .first()
    .click();
  await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
  await espera(600);
  // Coordenadas de página: desde «Punto de recogida» hasta el final de la tarjeta del precio.
  const caja = (l) =>
    l.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { y: r.top + globalThis.scrollY, fin: r.bottom + globalThis.scrollY };
    });
  const arriba = await caja(c.getByText(en ? 'Pickup point' : 'Punto de recogida').first());
  const precio = await caja(c.getByTestId('moto-precio'));
  const desde = arriba.y - 16;
  await c.screenshot({
    path: join(SALIDA, `moto-ve-cliente-pedir-${idioma}.png`),
    fullPage: true,
    clip: { x: 0, y: desde, width: c.viewportSize().width, height: precio.fin + 90 - desde },
  });
  // Seguridad del pasajero: los contactos de confianza, debajo de la pantalla de Moto.
  await c
    .getByText(en ? 'Trusted contacts' : 'Contactos de confianza', { exact: true })
    .first()
    .evaluate((n) => n.scrollIntoView({ block: 'start' }));
  await espera(600);
  await foto(c, 'cliente-contactos', idioma);
  await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
  await c
    .getByRole('button', { name: en ? /Request/ : /Pedir/ })
    .last()
    .click();
  await espera(2_500);
  const viaje = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (!viaje) throw new Error('el pasajero no quedó con un viaje');

  // ───────── Driver: la oferta
  await d.getByRole('tab', { name: en ? 'Home' : 'Inicio' }).click();
  await d.reload();
  await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
  await espera(800);
  await foto(d, 'driver-oferta', idioma);
  await paso(viaje.id, 'aceptar');
  await paso(viaje.id, 'llegue');
  const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
  await paso(viaje.id, 'iniciar', { pin });

  // ───────── Cliente: viaje en curso con los datos de pago móvil
  await c.reload();
  await c.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
  await espera(800);
  await foto(c, 'cliente-viaje', idioma);
  // Compartir y emergencia, al final del viaje en curso.
  await c
    .getByText(en ? 'Share my ride' : 'Compartir mi viaje', { exact: true })
    .first()
    .evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await espera(600);
  await foto(c, 'cliente-compartir', idioma);
  // «¿Todo bien?»: el servidor la levanta cuando el viaje se sale de la ruta; aquí se simula la alerta.
  await sql(
    `INSERT OR IGNORE INTO alertas_viaje (id, operacion_id, tipo, lat, lng) VALUES ('zz-alerta-${viaje.id}', '${viaje.id}', 'desvio', ${ORIGEN.lat}, ${ORIGEN.lng})`,
  );
  await c.reload();
  await c
    .getByText(en ? 'Everything OK?' : '¿Todo bien?', { exact: true })
    .waitFor({ timeout: 60_000 });
  await espera(800);
  await foto(c, 'cliente-todo-bien', idioma);
  await c.getByText(en ? 'I’m OK' : 'Estoy bien', { exact: true }).click();
  await espera(1_000);

  // ───────── Driver: viaje activo con pago móvil, «sí me llegó» y la pantalla de cobro
  await d.reload();
  await d.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
  await d.getByTestId('viaje-pago-movil').scrollIntoViewIfNeeded();
  await espera(800);
  await foto(d, 'driver-viaje-pago-movil', idioma);
  await d
    .getByText(en ? 'Emergency' : 'Emergencia', { exact: true })
    .last()
    .evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await espera(600);
  await foto(d, 'driver-emergencia', idioma);
  await d.getByTestId('viaje-pago-movil').scrollIntoViewIfNeeded();
  await d.getByText(en ? 'Yes, it arrived' : 'Sí, me llegó', { exact: true }).click();
  await d.getByText(en ? 'End ride' : 'Terminar viaje', { exact: true }).click();
  await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
  await espera(800);
  await foto(d, 'driver-cobro-pago-movil', idioma);

  // ───────── Driver: viaje en efectivo y su cobro
  const cot = (
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    })
  ).cotizacion;
  const v2 = (
    await pasajero('POST', '/datos/viajes', { cotizacionId: cot.id, metodoPago: 'efectivo' })
  ).viaje;
  await paso(v2.id, 'aceptar');
  await paso(v2.id, 'llegue');
  await paso(v2.id, 'iniciar', {
    pin: (await pasajero('GET', `/datos/viajes/${v2.id}`)).viaje.pin,
  });
  await d.reload();
  await d.getByText(en ? 'End ride' : 'Terminar viaje', { exact: true }).click({ timeout: 60_000 });
  await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
  await espera(800);
  await foto(d, 'driver-cobro-efectivo', idioma);

  // ───────── Driver: con 12 horas al volante, descansa (se simula alargando el viaje recién hecho)
  await sql(
    `UPDATE viajes SET asignado_en = datetime('now', '-13 hours'), terminado_en = datetime('now', '-5 minutes') WHERE operacion_id = '${v2.id}'`,
  );
  const cot3 = (
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    })
  ).cotizacion;
  const v3 = (
    await pasajero('POST', '/datos/viajes', { cotizacionId: cot3.id, metodoPago: 'efectivo' })
  ).viaje;
  await d.reload();
  await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
  await d.getByText(en ? 'Accept ride' : 'Aceptar viaje', { exact: true }).click();
  await espera(1_500);
  await pedir('POST', `/datos/viajes/${v3.id}/cancelar`, {}, tokens.cliente, {
    'idempotency-key': `capturas-cancelar-descanso-${Date.now().toString(36)}`,
  });
  await d.getByTestId('oferta-viaje').waitFor({ state: 'detached', timeout: 30_000 });
  await d
    .getByText(en ? /been driving/ : /horas manejando/)
    .first()
    .waitFor({ timeout: 30_000 });
  await espera(600);
  await foto(d, 'driver-descanso', idioma);
  await sql(
    `UPDATE viajes SET asignado_en = datetime('now', '-15 minutes') WHERE operacion_id = '${v2.id}'`,
  );
  await ctxC.close();
  await ctxD.close();

  // ───────── Panel: Moto · Abrir y aprobar
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, tokens.equipo)).ruta;
  const ctxP = await navegador.newContext({
    viewport: { width: 1280, height: 1000 },
    baseURL: URL,
    locale: en ? 'en-US' : 'es-US',
  });
  await ctxP.addCookies([
    { name: 'tumbite_sesion', value: tokens.equipo, url: URL, httpOnly: true },
  ]);
  await ctxP.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctxP.newPage();
  await p.goto(`${en ? '' : '/es'}/panel/${ruta}/moto`);
  await p.getByTestId('super-moto').waitFor({ timeout: 60_000 });
  await p.getByTestId('tasa-referencia').waitFor({ timeout: 30_000 });
  await espera(1_000);
  await foto(p, 'panel', idioma);
  await p.getByTestId('tasa-referencia').scrollIntoViewIfNeeded();
  await espera(500);
  await foto(p, 'panel-tasa', idioma);
  await ctxP.close();
}
await conductor('POST', '/datos/repartidor/conectar', { conectado: false });
await navegador.close();
console.log('capturas de Moto Venezuela listas en docs/capturas/recorrido/moto-ve-*.png');
