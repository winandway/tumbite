// Capturas REALES de la pantalla «Método de pago» y del Saldo Divoox (C-METODO-PAGO-PANTALLA,
// C-SALDO-CLIENTE, 25 nov 2026) — Venezuela en español y Estados Unidos en inglés. Contra el servidor
// LOCAL del recorrido (.recorrido, armado con scripts/recorrido/preparar.mjs y encendido en el puerto
// 8790 con `npx wrangler dev -c .recorrido/wrangler.jsonc --port 8790 --persist-to .recorrido/estado`),
// con la app web real del cliente y el panel:
//   - es (El Vigía, con la ciudad neutra): sin saldo y con Pago Móvil apagado (nadie cerca lo recibe),
//     saldo que no alcanza (Pago Móvil para el resto) y saldo que cubre todo;
//   - en (Novi, Michigan, sin nombrar la ciudad): la misma pantalla con los métodos de Estados Unidos
//     (efectivo o tarjeta; el Saldo Divoox no se usa allí) — C-CAPTURAS-POR-IDIOMA;
//   - el panel «Saldo de clientes» (es y en) para la ayuda interna, en la carpeta privada.
// Originales en docs/capturas/recorrido/moto-{ve,us}-pago-*-<es|en>.png y WebP públicas en
// apps/panel/public/docs/recorrido-moto-{ve,us}-pago-*-v2-<es|en>.webp. Copias para la revisión en
// CAPTURAS_REVISION si se da esa variable.
// Uso: node scripts/recorrido/capturas-metodo-pago.mjs
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: escribe capturas */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { ciudadNeutra } from './neutro.mjs';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo.mjs';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const PUBLICAS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
const REVISION = process.env.CAPTURAS_REVISION ?? '';
for (const d of [SALIDA, ORIGINALES_PRIVADAS, CAPTURAS_PRIVADAS, ...(REVISION ? [REVISION] : [])])
  mkdirSync(d, { recursive: true });
const ZONA = 'VE-MER-ELVIGIA';
const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Central' };
const DESTINO = { lat: 8.6105, lng: -71.6672, direccion: 'Avenida Principal 12' };
const NOVI = {
  id: 'US-MI-NOVI',
  nombre: 'Novi',
  lat: 42.4806,
  lng: -83.4755,
  radioKm: 15,
  zonaHoraria: 'America/Detroit',
  origen: { lat: 42.4915, lng: -83.4706, direccion: 'Central Plaza' },
  destino: { lat: 42.4712, lng: -83.4745, direccion: '12 Main Avenue' },
};
const IDS = { cliente: 'zz-mtve-c', conductor: 'zz-mtve-k', equipo: 'zz-mtve-a' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.79.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
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

// 1. El guion de Moto en Venezuela deja al conductor aprobado, con saldo y su Pago Móvil cargado.
execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const tokens = {
  cliente: await sesion(IDS.cliente),
  conductor: await sesion(IDS.conductor),
  equipo: await sesion(IDS.equipo),
};
await sql(SQL_TASA_EJEMPLO);
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${ZONA}' AND activa = 1`);
await sql(
  `UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id IN ('${IDS.cliente}', '${IDS.conductor}')`,
);
// Un viaje colgado de una vuelta anterior se cancela antes de las fotos.
const colgado = (await pedir('GET', '/datos/viajes/actual', undefined, tokens.cliente)).viaje;
if (colgado)
  await pedir('POST', `/datos/viajes/${colgado.id}/cancelar`, {}, tokens.cliente, {
    'idempotency-key': `capturas-pago-${Date.now().toString(36)}`,
  }).catch(() => null);
const conectar = () =>
  sql(
    `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now', '+20 minutes') WHERE usuario_id = '${IDS.conductor}'`,
  );
const pagoMovil = (activa) =>
  sql(
    `UPDATE cuentas_cobro SET activa = ${activa ? 1 : 0} WHERE usuario_id = '${IDS.conductor}' AND tipo = 'pago_movil'`,
  );
let n = 0;
const cargar = (monto) =>
  pedir(
    'POST',
    `/datos/admin/saldo-clientes/${IDS.cliente}/cargas`,
    {
      monto,
      motivo: 'carrera_regalo',
      idempotencia: `capturas-pago-${Date.now().toString(36)}-${++n}`,
    },
    tokens.equipo,
  );
const saldoActual = async () =>
  (await pedir('GET', '/datos/cliente/saldo-divoox', undefined, tokens.cliente)).disponible;

// Novi (Estados Unidos) para la pasada en inglés: la ciudad con Moto y su tarifa, solo en local.
await sql(
  `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
   VALUES ('${NOVI.id}', '${NOVI.nombre}', 'US', 'USD', '${NOVI.zonaHoraria}', ${NOVI.lat}, ${NOVI.lng}, ${NOVI.radioKm}, 1)`,
);
await sql(
  `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${NOVI.id}', 'disponible')
   ON CONFLICT DO UPDATE SET estado = 'disponible'`,
);
await pedir(
  'POST',
  '/datos/admin/viajes/tarifas',
  {
    servicio: 'moto',
    zona: NOVI.id,
    tarifa: {
      base: 200,
      porKm: 90,
      porMinuto: 20,
      minimo: 500,
      esperaGratisS: 300,
      porMinutoEspera: 20,
      cancelacionGratisS: 120,
      cargoCancelacion: 200,
      cargoNoSePresento: 300,
    },
    dePrueba: false,
    motivo: 'Tarifa de las capturas de la pantalla de pago (servidor local)',
  },
  tokens.equipo,
).catch(() => null);
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${NOVI.id}' AND activa = 1`);

const navegador = await chromium.launch();
const telefono = async (idioma, lugar) => {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
    geolocation: { latitude: lugar.origen.lat, longitude: lugar.origen.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i, b]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
      localStorage.setItem(`tumbite.borrador.moto.${u}`, b);
    },
    [
      tokens.cliente,
      IDS.cliente,
      idioma,
      JSON.stringify({
        recogida: lugar.origen.direccion,
        recogidaLat: String(lugar.origen.lat),
        recogidaLng: String(lugar.origen.lng),
        destino: lugar.destino.direccion,
        destinoLat: String(lugar.destino.lat),
        destinoLng: String(lugar.destino.lng),
        metodo: lugar.metodo,
        usarSaldo: true,
      }),
    ],
  );
  return ctx;
};
const fotos = [];
/** Abre Pedir moto, toca «Continuar» y fotografía «Método de pago». */
async function pantallaDePago(idioma, lugar, nombre, antes) {
  const ctx = await telefono(idioma, lugar);
  const c = await ctx.newPage();
  await c.goto('/app/ride');
  await c.getByTestId('moto-precio').waitFor({ timeout: 60_000 });
  await c.getByTestId('pedir-boton').click();
  const pantalla = c.getByTestId('metodo-pago');
  await pantalla.waitFor({ timeout: 30_000 });
  if (antes) await antes(c);
  await espera(900);
  const prefijo = lugar.pais === 'US' ? 'us' : 've';
  const archivo = join(SALIDA, `moto-${prefijo}-pago-${nombre}-${idioma}.png`);
  await c.screenshot({ path: archivo });
  fotos.push({
    archivo,
    publica: join(PUBLICAS, `recorrido-moto-${prefijo}-pago-${nombre}-v2-${idioma}.webp`),
  });
  await ctx.close();
}

const VE = { pais: 'VE', origen: ORIGEN, destino: DESTINO, metodo: 'pago_movil' };
const US = { pais: 'US', origen: NOVI.origen, destino: NOVI.destino, metodo: 'efectivo' };
const restaurarCiudad = await ciudadNeutra(sql, ZONA, 'es');
try {
  // ── Español (Venezuela).
  await conectar();
  // a) Sin saldo y sin nadie cerca con Pago Móvil: la tarjeta apagada y la opción apagada.
  if ((await saldoActual()) === 0) {
    await pagoMovil(false);
    await pantallaDePago('es', VE, 'sin-saldo', null);
    await pagoMovil(true);
  }
  // b) Saldo que no alcanza: usa lo que hay y el resto por Pago Móvil.
  const s = await saldoActual();
  if (s < 100) await cargar(100 - s);
  await conectar();
  await pantallaDePago('es', VE, 'saldo-parcial', (c) =>
    c.getByTestId('pago-metodo-pago_movil').click(),
  );
  // c) Saldo que cubre todo: no hace falta elegir cómo pagar el resto.
  await cargar(1900);
  await pantallaDePago('es', VE, 'saldo-todo', null);
  // d) El interruptor apagado: las formas de pago de siempre.
  await pantallaDePago('es', VE, 'metodos', (c) => c.getByTestId('pago-saldo-usar').click());

  // ── Inglés (Estados Unidos): efectivo o tarjeta; el Saldo Divoox no se usa allí.
  await pantallaDePago('en', US, 'metodos', null);
  await pantallaDePago('en', US, 'tarjeta', (c) => c.getByTestId('pago-metodo-tarjeta').click());
  await pantallaDePago('en', US, 'efectivo', (c) => c.getByTestId('pago-metodo-efectivo').click());

  // ── Panel «Saldo de clientes» (ayuda interna, carpeta privada).
  const { ruta } = await pedir('GET', '/datos/admin/ruta', undefined, tokens.equipo);
  for (const idioma of ['es', 'en']) {
    const ctx = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
    });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: tokens.equipo, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto(`${idioma === 'es' ? '/es' : ''}/panel${ruta ? `/${ruta}` : ''}/customer-balance`);
    await p.getByTestId('saldo-clientes-buscar').waitFor({ timeout: 60_000 });
    await p.getByTestId('saldo-clientes-buscar').fill('Pasajero');
    await p.getByTestId('saldo-clientes-resultados').waitFor({ timeout: 30_000 });
    await espera(800);
    for (const [nombre, antes] of [
      ['buscar', null],
      [
        'carga',
        async () => {
          await p.getByTestId('saldo-clientes-resultados').getByRole('button').first().click();
          await p.getByTestId('saldo-cliente-ficha').waitFor({ timeout: 30_000 });
          await p.getByTestId('saldo-cliente-ficha').scrollIntoViewIfNeeded();
        },
      ],
    ]) {
      if (antes) await antes();
      await espera(800);
      const original = join(ORIGINALES_PRIVADAS, `saldo-clientes-${nombre}-${idioma}.png`);
      await p.screenshot({ path: original });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        original,
        '-o',
        join(CAPTURAS_PRIVADAS, `saldo-clientes-${nombre}-${idioma}.webp`),
      ]);
      if (REVISION)
        copyFileSync(original, join(REVISION, `panel-saldo-clientes-${nombre}-${idioma}.png`));
    }
    await ctx.close();
  }
} finally {
  await navegador.close();
  await restaurarCiudad();
  await pagoMovil(true).catch(() => null);
  // Novi se apaga otra vez: la salud del servidor local (servicios y zonas de pánico) queda como estaba.
  await sql(`UPDATE servicios_zona SET estado = 'proximamente' WHERE zona_id = '${NOVI.id}'`).catch(
    () => null,
  );
  await sql(`UPDATE zonas SET activa = 0 WHERE id = '${NOVI.id}'`).catch(() => null);
}
for (const f of fotos) {
  execFileSync('cwebp', ['-quiet', '-q', '82', f.archivo, '-o', f.publica]);
  if (REVISION) copyFileSync(f.archivo, join(REVISION, f.archivo.split('/').pop()));
}
console.log(`capturas de la pantalla de pago listas: ${fotos.length}`);
