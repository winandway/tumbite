// Capturas REALES de la «Tarifa de servicio de Divoox» en los viajes (C-QUIEN-PAGA-VIAJES, 23 nov
// 2026) — Venezuela. Contra el servidor LOCAL del recorrido (.recorrido, armado con
// scripts/recorrido/preparar.mjs y encendido en el puerto 8790), con las apps web reales del cliente y
// del Driver: el guion de Moto en Venezuela deja al conductor aprobado y con saldo; la palanca se pone
// en «cliente» y se toman, en español y en inglés:
//   - tarifa-pedir: el precio antes de pedir, con el viaje, la tarifa y el total;
//   - tarifa-oferta: la oferta del conductor, «Cobras X · Y son tuyos · Z son de Divoox»;
//   - tarifa-viaje-driver: el viaje en curso del conductor con la misma cuenta;
//   - tarifa-viaje-cliente: el viaje en curso del pasajero con la línea de la tarifa.
// C-CAPTURAS-POR-IDIOMA: la tarifa de servicio solo existe donde la comisión sale del saldo (hoy no en
// Estados Unidos), así que la pasada en inglés usa la misma cuenta en inglés y recorta lo que muestra
// la tarifa (solo dólares; sin bolívares ni ciudad). C-DOCS-SIN-DATOS-REALES: ciudad y mapa neutros.
// Guarda las originales en docs/capturas/recorrido/tarifa-*-<es|en>.png y las WebP en
// apps/panel/public/docs/recorrido-tarifa-*-<es|en>.webp.
// Uso: node scripts/recorrido/capturas-tarifa-servicio.mjs
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
      'cf-connecting-ip': `10.78.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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

// 1. El guion de punta a punta deja al conductor aprobado y con saldo en la ciudad de las fotos.
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
// La palanca, como queda en Venezuela: la paga el cliente.
await pedir(
  'PUT',
  '/datos/admin/finanzas/quien-paga',
  { pais: 'VE', valor: 'cliente' },
  tokens.equipo,
);
const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
let n = 0;
const paso = (op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
    'idempotency-key': `capturas-tarifa-${nombre}-${++n}-${Date.now().toString(36)}`,
  });
const cerrarColgado = async () => {
  const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (!v) return;
  if (v.estado === 'en_curso') await paso(v.id, 'terminar');
  else
    await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
      'idempotency-key': `capturas-tarifa-cancelar-${Date.now().toString(36)}`,
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
async function recorte(p, nombre, idioma, desdeL, hastaL, margen = 16, abajo = margen) {
  const a = await caja(desdeL);
  const b = await caja(hastaL);
  const archivo = join(SALIDA, `tarifa-${nombre}-${idioma}.png`);
  await p.screenshot({
    path: archivo,
    fullPage: true,
    clip: {
      x: 0,
      y: Math.max(0, a.y - margen),
      width: p.viewportSize().width,
      height: b.fin - a.y + margen + abajo,
    },
  });
  fotos.push({ archivo, publica: join(PUBLICAS, `recorrido-tarifa-${nombre}-${idioma}.webp`) });
}

const restaurarCiudad = await ciudadNeutra(sql, ZONA, 'es');
try {
  for (const idioma of ['es', 'en']) {
    const en = idioma === 'en';
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
    const tarifa = c.getByTestId('moto-tarifa-servicio');
    await tarifa.waitFor({ timeout: 60_000 });
    await c
      .getByText(en ? 'Cash' : 'Efectivo', { exact: true })
      .first()
      .click()
      .catch(() => null);
    await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
    await espera(800);
    // La tarjeta del precio: el total arriba; el viaje y la tarifa de servicio, cada uno en su línea.
    // En inglés, sin la línea de bolívares (se recorta en la tarifa).
    await recorte(
      c,
      'pedir',
      idioma,
      c.getByTestId('moto-precio'),
      en ? tarifa : c.getByTestId('moto-precio'),
      16,
      en ? 6 : 16,
    );
    await c
      .getByRole('button', { name: en ? /Request/ : /Pedir|Solicitar/ })
      .last()
      .click();
    await espera(2_500);
    const viaje = (await pasajero('GET', '/datos/viajes/actual')).viaje;
    if (!viaje) throw new Error('el pasajero no quedó con un viaje');

    // El conductor: la oferta con «Cobras · tuyos · de Divoox».
    await d.reload();
    const cuenta = d.getByTestId('oferta-cuenta-tarifa');
    await cuenta.waitFor({ timeout: 60_000 });
    await espera(800);
    // En inglés, solo la cuenta (sin los bolívares de Venezuela).
    await recorte(
      d,
      'oferta',
      idioma,
      en ? cuenta : d.getByTestId('oferta-viaje-ganancia'),
      cuenta,
      en ? 4 : 16,
      16,
    );
    await paso(viaje.id, 'aceptar');
    await paso(viaje.id, 'llegue');
    const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
    await paso(viaje.id, 'iniciar', { pin });
    await d.reload();
    const cuentaViaje = d.getByTestId('viaje-cuenta-tarifa');
    await cuentaViaje.waitFor({ timeout: 60_000 });
    await cuentaViaje.scrollIntoViewIfNeeded();
    await espera(800);
    await recorte(
      d,
      'viaje-driver',
      idioma,
      en ? cuentaViaje : d.getByTestId('viaje-precio'),
      cuentaViaje,
      en ? 4 : 16,
      16,
    );

    // El pasajero: su viaje en curso con la línea de la tarifa.
    await c.reload();
    const lineaC = c.getByTestId('viaje-tarifa-servicio');
    await lineaC.waitFor({ timeout: 60_000 });
    await lineaC.scrollIntoViewIfNeeded();
    await espera(800);
    // En inglés no: la tarjeta lleva la dirección de Venezuela (C-CAPTURAS-POR-IDIOMA).
    if (!en) await recorte(c, 'viaje-cliente', idioma, lineaC, lineaC, 120, 120);
    await paso(viaje.id, 'terminar');
    await ctxC.close();
    await ctxD.close();
  }
} finally {
  await navegador.close();
  await restaurarCiudad();
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false }).catch(() => null);
}
for (const f of fotos) execFileSync('cwebp', ['-quiet', '-q', '82', f.archivo, '-o', f.publica]);
console.log(`capturas de la tarifa de servicio listas: ${fotos.length}`);
