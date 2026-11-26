// Capturas REALES de Divoox en Perú para Docs (C-PERFIL-PERU, C-PAGO-A-CELULAR, 19 nov 2026). Perú.
// Contra el servidor LOCAL del recorrido (armado con scripts/recorrido/preparar.mjs y encendido con
// wrangler), con las apps web reales del pasajero y del conductor:
//   1. corre el guion de punta a punta (probar-moto-peru.mjs): conductor aprobado, con saldo en soles
//      y su Yape confirmado;
//   2. toma las pantallas en español: el pasajero elige Yape, ve el número del conductor, el conductor
//      confirma «Sí, me llegó», su saldo en soles, «Recargar con tarjeta», «Dónde te pagan los
//      pasajeros» y sus papeles con los nombres de Perú.
// C-CAPTURAS-POR-IDIOMA: Yape, Plin y los soles son de Perú, así que estas capturas existen SOLO en
// español. Las guías en inglés enseñan las pantallas de Estados Unidos (capturas-moto-venezuela.mjs,
// pasada «us»). C-DOCS-SIN-DATOS-REALES: mapa sin rótulos, ciudad «de ejemplo», direcciones genéricas
// y un celular que no existe (900 000 000).
// Guarda las originales en docs/capturas/recorrido/peru-*-es.png y sus versiones livianas en
// apps/panel/public/docs/recorrido-peru-*-es.webp.
// Uso: node scripts/recorrido/capturas-peru.mjs   (CARPETA_RECORRIDO=.recorrido por defecto)
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas del repositorio */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { deslizar } from './deslizar.mjs';
import { abrirAlta } from './altaDriver.mjs';
import { ciudadNeutra, mapaSinRotulos } from './neutro.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const CARPETA = process.env.CARPETA_RECORRIDO ?? '.recorrido';
const DATOS = JSON.parse(readFileSync(join(RAIZ, CARPETA, 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const DOCS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
const ZONA = 'PE-ICA-ICA';
// Las coordenadas son reales (el precio y la ruta salen del servidor); las direcciones, genéricas.
const ORIGEN = { lat: -14.0648, lng: -75.7296, direccion: 'Plaza Central' };
const DESTINO = { lat: -14.0875, lng: -75.7633, direccion: 'Avenida Principal 12' };
const IDS = { cliente: 'zz-mtpe-c', conductor: 'zz-mtpe-k', equipo: 'zz-mtpe-a' };

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      // Servidor local: cada llamada desde otra dirección, para no chocar con el límite de intentos.
      'cf-connecting-ip': `10.78.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const sesion = async (id) => {
  const token = randomBytes(24).toString('hex');
  await sql(
    `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
  );
  return token;
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. El guion de punta a punta deja al conductor aprobado, con saldo en soles y su Yape confirmado.
execFileSync('node', ['scripts/staging/probar-moto-peru.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const tokens = {
  cliente: await sesion(IDS.cliente),
  conductor: await sesion(IDS.conductor),
  equipo: await sesion(IDS.equipo),
};
// Solo en este servidor local: la tarifa pasa a «no de prueba» para que la captura pública no diga
// «Precio de prueba», y los viajes del guion dejan de nombrar lugares.
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${ZONA}' AND activa = 1`);
await sql(
  `UPDATE viajes SET origen_direccion = '${ORIGEN.direccion}', destino_direccion = '${DESTINO.direccion}'
    WHERE operacion_id IN (SELECT id FROM operaciones WHERE zona_id = '${ZONA}')`,
).catch(() => null);
// En local Stripe es simulado y la recarga con tarjeta no se confirma: para que la foto del saldo
// muestre lo que deja una recarga de 30 soles, el punto de venta del equipo vende ese código.
const codigo = (await pedir('POST', '/datos/punto-venta/codigos', { monto: 3000 }, tokens.equipo))
  .codigo;
const saldo = await pedir('POST', '/datos/repartidor/recargar', { codigo }, tokens.conductor);
if (!(saldo.disponible >= 3000))
  throw new Error(`el saldo no quedó recargado (${saldo.disponible})`);

// C-DOCS-SIN-DATOS-REALES: el mapa sin rótulos y la ciudad con nombre de ejemplo.
const navegador = mapaSinRotulos(await chromium.launch());
const restaurarCiudad = await ciudadNeutra(sql, ZONA, 'es');
let n = 0;
const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
const paso = (op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
    'idempotency-key': `capturas-pe-${nombre}-${++n}-${Date.now().toString(36)}`,
  });
const telefono = async (token, id) => {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u]) => {
      localStorage.setItem('tumbite.idioma', 'es');
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [token, id],
  );
  return ctx;
};
const hechas = [];
const archivo = (nombre) => join(SALIDA, `peru-${nombre}-es.png`);
const foto = async (p, nombre, opciones = {}) => {
  await p.screenshot({ path: archivo(nombre), ...opciones });
  hechas.push(nombre);
};
const alCentro = (l, block = 'center') =>
  l.evaluate((x, b) => x.scrollIntoView({ block: b }), block);

try {
  const colgado = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (colgado) {
    if (colgado.estado === 'en_curso') await paso(colgado.id, 'terminar');
    else
      await pedir('POST', `/datos/viajes/${colgado.id}/cancelar`, {}, tokens.cliente, {
        'idempotency-key': `capturas-pe-cancelar-${Date.now().toString(36)}`,
      });
  }
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false });
  await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });

  // ───────── Driver: sus papeles con los nombres de Perú
  const ctxD = await telefono(tokens.conductor, IDS.conductor);
  const d = await ctxD.newPage();
  await d.goto('/driver/');
  await abrirAlta(d, 'moto', false);
  await espera(1_200);
  await alCentro(d.getByTestId('alta-moto'), 'start');
  await espera(800);
  await foto(d, 'driver-vehiculo');
  await alCentro(d.getByText('Tus papeles', { exact: true }).first(), 'start');
  await espera(800);
  await foto(d, 'driver-papeles');

  // ───────── Driver: Ganancias (saldo en soles, recargar con tarjeta, dónde te pagan)
  await d.goto('/driver/');
  await d.getByRole('tab', { name: 'Ganancias' }).click({ timeout: 60_000 });
  await d.getByTestId('saldo-prepago').waitFor({ timeout: 30_000 });
  await alCentro(d.getByTestId('saldo-prepago'), 'start');
  await espera(800);
  await foto(d, 'driver-saldo');
  await d.getByTestId('recarga-tarjeta').waitFor({ timeout: 30_000 });
  await alCentro(d.getByTestId('recarga-tarjeta'));
  await espera(800);
  await foto(d, 'driver-recarga-tarjeta');
  await d.getByTestId('cuenta-cobro').waitFor({ timeout: 30_000 });
  await alCentro(d.getByTestId('cuenta-cobro'));
  await espera(800);
  await foto(d, 'driver-cuenta-cobro');
  // El formulario para cambiar el número, con Yape elegido (no se guarda nada).
  await d.getByText('Cambiar mi número', { exact: true }).first().click();
  await d.getByTestId('cuenta-cobro-formulario').waitFor({ timeout: 20_000 });
  await d.getByTestId('cuenta-cobro-tipo-yape').click();
  await alCentro(d.getByTestId('cuenta-cobro-formulario'));
  await espera(800);
  await foto(d, 'driver-cuenta-cobro-formulario');
  await d.getByText('Cancelar', { exact: true }).first().click();

  // ───────── Pasajero: pide su mototaxi y elige Yape
  await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
  await conductor('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng });
  const ctxC = await telefono(tokens.cliente, IDS.cliente);
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
  await c.getByTestId('moto-precio').waitFor({ timeout: 60_000 });
  await c.getByText('Yape', { exact: true }).first().click();
  await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
  await espera(600);
  // Desde «Recoger en» hasta el final de la tarjeta del precio (sin el aviso del borrador recuperado).
  const caja = (l) =>
    l.evaluate((x) => {
      const r = x.getBoundingClientRect();
      return { y: r.top + globalThis.scrollY, fin: r.bottom + globalThis.scrollY };
    });
  const arriba = await caja(c.getByText('Recoger en').first());
  const precio = await caja(c.getByTestId('moto-precio'));
  const desde = arriba.y - 16;
  await foto(c, 'cliente-pedir', {
    fullPage: true,
    clip: { x: 0, y: desde, width: c.viewportSize().width, height: precio.fin + 90 - desde },
  });
  // C-METODO-PAGO-PANTALLA: «Continuar» abre «Método de pago» y ahí se solicita.
  await c.getByTestId('pedir-boton').click();
  await c.getByTestId('pago-solicitar').click();
  await espera(2_500);
  const viaje = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (!viaje) throw new Error('el pasajero no quedó con un viaje');
  if (viaje.metodoPago !== 'yape')
    throw new Error(`el viaje no quedó con Yape (${viaje.metodoPago})`);
  await paso(viaje.id, 'aceptar');
  await paso(viaje.id, 'llegue');
  const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
  await paso(viaje.id, 'iniciar', { pin });

  // ───────── Pasajero: el viaje en curso con el Yape del conductor
  await c.reload();
  await c.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
  await alCentro(c.getByTestId('viaje-pago-movil'));
  await espera(1_500);
  await foto(c, 'cliente-viaje');

  // ───────── Conductor: «¿Te llegó?» y el cobro
  await d.goto('/driver/');
  await d.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
  await alCentro(d.getByTestId('viaje-pago-movil'));
  await espera(800);
  await foto(d, 'driver-viaje');
  await d.getByText('Sí, me llegó', { exact: true }).click();
  await espera(800);
  await deslizar(d, 'viaje-terminar');
  await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
  await espera(300);
  await foto(d, 'driver-cobro');
  if (!(await d.getByTestId('viaje-cobra-efectivo').isVisible()))
    throw new Error('la captura del cobro salió sin el cobro en pantalla');
  await ctxC.close();
  await ctxD.close();
} finally {
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false }).catch(() => null);
  await restaurarCiudad();
  await navegador.close();
}

// Las versiones livianas de Docs (como scripts/recorrido/a-docs.mjs, solo las de Perú).
for (const nombre of hechas)
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    '-resize',
    '540',
    '0',
    archivo(nombre),
    '-o',
    join(DOCS, `recorrido-peru-${nombre}-es.webp`),
  ]);
console.log(`capturas de Perú listas: ${hechas.join(', ')}`);
