// Capturas REALES del «Precio de la zona» (C-PRECIO-ZONA, 24 nov 2026) — todos los países. Contra el
// servidor LOCAL del recorrido (.recorrido, armado con scripts/recorrido/preparar.mjs y encendido),
// con las apps web reales del cliente y del Driver. El guion de Moto en Venezuela deja al conductor
// aprobado y con saldo; el equipo agrega UNA ruta con precio de la zona y de ida y vuelta (solo en
// esta base local, que se arma nueva en cada corrida) y se toman, en español y en inglés:
//   - precio-zona-pedir: la tarjeta del precio con «Precio de la zona» y su lugar;
//   - precio-zona-ida-vuelta: la misma tarjeta con «Solo ida» e «Ida y vuelta» elegida;
//   - precio-zona-oferta: la oferta del conductor con el recuadro «Precio de la zona».
// C-CAPTURAS-POR-IDIOMA y C-DOCS-SIN-DATOS-REALES: se recorta solo la tarjeta del precio (dólares,
// sin bolívares, sin direcciones ni ciudad) y el lugar de la ruta tiene un nombre genérico.
// Guarda las originales en docs/capturas/recorrido/precio-zona-*-<es|en>.png y las WebP en
// apps/panel/public/docs/recorrido-precio-zona-*-<es|en>.webp.
// Uso: node scripts/recorrido/capturas-precio-zona.mjs
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { ciudadNeutra, mapaSinRotulos } from './neutro.mjs';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const PUBLICAS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
mkdirSync(SALIDA, { recursive: true });
const ZONA = 'VE-MER-ELVIGIA';
const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Central' };
const DESTINO = { lat: 8.6105, lng: -71.6672, direccion: 'Avenida Principal 12' };
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
await pedir(
  'POST',
  '/datos/conductor/aviso-ia',
  { acepto: true, plataforma: 'web', desde: 'aviso' },
  tokens.conductor,
);
// La ruta con precio de la zona: un 60 % del calculado (a la decena), y la ida y vuelta, el doble
// menos un poco (siempre más barata que dos viajes por distancia).
const cot = await pedir(
  'POST',
  '/datos/viajes/cotizar',
  { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
  tokens.cliente,
);
const calculado = Number(cot.cotizacion.total);
const precio = Math.max(50, Math.round((calculado * 0.6) / 10) * 10);
await pedir(
  'POST',
  '/datos/admin/viajes/precios-zona',
  {
    zona: ZONA,
    servicio: 'moto',
    desde: null,
    hasta: { lat: DESTINO.lat, lng: DESTINO.lng, radioKm: 1, nombre: 'Avenida Principal' },
    precio,
    precioIdaVuelta: Math.round((precio * 1.8) / 10) * 10,
  },
  tokens.equipo,
);
const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
let n = 0;
const paso = (op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
    'idempotency-key': `capturas-zona-${nombre.replace(/[^a-z0-9]/gi, '-')}-${++n}-${Date.now().toString(36)}`,
  });
// La ida y vuelta lleva la vuelta como parada: el conductor llega a la parada y sigue antes de terminar.
const terminar = async (id) => {
  const ubicar = (p) =>
    sql(
      `UPDATE repartidores SET lat = ${p.lat}, lng = ${p.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
  await ubicar(DESTINO);
  await paso(id, 'paradas/1/llegue');
  await paso(id, 'paradas/1/seguir');
  await ubicar(ORIGEN);
  await paso(id, 'terminar');
};
const cerrarColgado = async () => {
  const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (!v) return;
  if (v.estado === 'en_curso') await terminar(v.id);
  else
    await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
      'idempotency-key': `capturas-zona-cancelar-${Date.now().toString(36)}`,
    });
};
await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });

const navegador = mapaSinRotulos(await chromium.launch());
const telefono = async (token, id, idioma) => {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [token, id, idioma],
  );
  return ctx;
};
const caja = (l) =>
  l.evaluate((x) => {
    const r = x.getBoundingClientRect();
    return { y: r.top + globalThis.scrollY, fin: r.bottom + globalThis.scrollY };
  });
const fotos = [];
async function recorte(p, nombre, idioma, desdeL, hastaL, margen = 16) {
  // Sin el anillo de foco del navegador (no es parte de la app).
  await p.addStyleTag({ content: '*:focus, *:focus-visible { outline: none !important; }' });
  await p.evaluate(() => globalThis.document.activeElement?.blur?.());
  const a = await caja(desdeL);
  const b = await caja(hastaL);
  const archivo = join(SALIDA, `precio-zona-${nombre}-${idioma}.png`);
  await p.screenshot({
    path: archivo,
    fullPage: true,
    clip: {
      x: 0,
      y: Math.max(0, a.y - margen),
      width: p.viewportSize().width,
      height: b.fin - a.y + margen + 10,
    },
  });
  fotos.push({
    archivo,
    publica: join(PUBLICAS, `recorrido-precio-zona-${nombre}-${idioma}.webp`),
  });
}

const restaurarCiudad = await ciudadNeutra(sql, ZONA, 'es');
try {
  for (const idioma of ['es', 'en']) {
    await cerrarColgado();
    await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
    const ctxD = await telefono(tokens.conductor, IDS.conductor, idioma);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
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
    const zona = c.getByTestId('moto-precio-zona');
    await zona.waitFor({ timeout: 60_000 });
    await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
    await espera(800);
    // 1) La tarjeta del precio con «Precio de la zona» y las dos opciones (Solo ida elegida).
    await recorte(
      c,
      'pedir',
      idioma,
      c.getByTestId('moto-precio'),
      c.getByTestId('moto-ida-vuelta'),
    );
    // 2) Ida y vuelta elegida: el precio de la ida y vuelta y su explicación.
    await c.getByTestId('moto-ida-vuelta-si').click();
    await c.getByTestId('moto-ida-vuelta-ayuda').waitFor({ timeout: 30_000 });
    await espera(1_200);
    await recorte(
      c,
      'ida-vuelta',
      idioma,
      c.getByTestId('moto-precio'),
      c.getByTestId('moto-ida-vuelta-ayuda'),
      16,
    );
    // 3) Pide (ida y vuelta) y el conductor ve la oferta con «Precio de la zona».
    // C-METODO-PAGO-PANTALLA: «Continuar» abre «Método de pago» y ahí se solicita.
    await c.getByTestId('pedir-boton').click();
    await c.getByTestId('pago-solicitar').click();
    await espera(2_500);
    const viaje = (await pasajero('GET', '/datos/viajes/actual')).viaje;
    if (!viaje) throw new Error('el pasajero no quedó con un viaje');
    await d.reload();
    const caja2 = d.getByTestId('oferta-viaje-precio-zona');
    await caja2.waitFor({ timeout: 60_000 });
    await caja2.scrollIntoViewIfNeeded();
    await espera(800);
    // Solo el recuadro, en los dos idiomas: sin bolívares ni tasa (solo dólares).
    await recorte(d, 'oferta', idioma, caja2, caja2, 12);
    await paso(viaje.id, 'aceptar');
    await paso(viaje.id, 'llegue');
    const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
    await paso(viaje.id, 'iniciar', { pin });
    await terminar(viaje.id);
    await ctxC.close();
    await ctxD.close();
  }
} finally {
  await navegador.close();
  await restaurarCiudad();
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false }).catch(() => null);
}
for (const f of fotos) execFileSync('cwebp', ['-quiet', '-q', '82', f.archivo, '-o', f.publica]);
console.log(`capturas del precio de la zona listas: ${fotos.length}`);
