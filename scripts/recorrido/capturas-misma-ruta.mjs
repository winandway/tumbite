// Capturas REALES de «Mis viajes» y «Pedir la misma ruta» para Docs (C-MISMA-RUTA, 15 nov 2026) —
// todos los países. Igual que capturas-carro.mjs: contra el servidor LOCAL del recorrido (.recorrido,
// armado con scripts/recorrido/preparar.mjs y encendido en el puerto 8790), con la app web real del
// pasajero. NO toca el sitio de pruebas ni las cuentas demo, y no crea pedidos en Novi fuera de este
// servidor local.
//
// Va DESPUÉS de capturas-carro.mjs: usa las mismas cuentas de prueba, cuyos viajes de Carro (hechos de
// punta a punta por ese guion) llenan «Mis viajes». Por idioma (español en El Vigía, inglés en Novi,
// C-CAPTURAS-POR-IDIOMA):
//   1. «Mis viajes» (pestaña Pedidos → Viajes) con los viajes agrupados por mes;
//   2. «Pedir la misma ruta» → la hoja «¿confirmas?» con el precio de ahora;
//   3. «Sí, pedir ahora» → la pantalla de espera de siempre (el viaje se cancela después, gratis);
//   4. el inicio con «Tu último viaje» y «Repetir» (si el inicio ya lo monta).
// Guarda las originales en docs/capturas/recorrido/misma-ruta-*.png; `npm run recorrido:docs` las pasa
// a apps/panel/public/docs/recorrido-misma-ruta-*.webp. Con las ocho listas, se cambia
// MISMA_RUTA_PUBLICADA a true en apps/panel/src/sitio/docs/mismaRuta.ts.
// Uso: node scripts/recorrido/capturas-misma-ruta.mjs   (SOLO_IDIOMA=es|en para un solo idioma)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');

// Los mismos lugares que capturas-carro.mjs (la recogida, para la ubicación del teléfono).
const LUGARES = {
  ve: {
    pais: 'VE',
    ciudad: 'VE-MER-ELVIGIA',
    origen: { lat: 8.6219, lng: -71.6506 },
  },
  us: {
    pais: 'US',
    ciudad: 'US-MI-NOVI',
    origen: { lat: 42.4915, lng: -83.4706 },
  },
};

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
const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const sql = (q) => interno('sql', { sql: q });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Las cuentas de capturas-carro.mjs: el pasajero de cada país y su id. */
async function pasajeroDe(pais) {
  if (pais === 'VE') {
    execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
      cwd: RAIZ,
      env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const a = await interno('moto-ve/armar');
    return { token: a.tokens.cliente, id: a.ids.cliente };
  }
  const a = await interno('carro/armar');
  return { token: a.tokens.cliente, id: a.ids.cliente };
}

/** Carro abierto en la ciudad de las fotos (en Estados Unidos, solo en este servidor local). */
async function abrirCarro(M) {
  await sql(
    `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('carro', '${M.ciudad}', 'disponible')
     ON CONFLICT DO UPDATE SET estado = 'disponible'`,
  );
  await sql("UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'");
}

const navegador = await chromium.launch();

async function correr(M, idioma) {
  const en = idioma === 'en';
  const p = await pasajeroDe(M.pais);
  await sql(
    `UPDATE sesiones SET expira_en = datetime('now', '+60 minutes') WHERE id = '${createHash('sha256').update(p.token).digest('hex')}'`,
  );
  await abrirCarro(M);
  const historial = await pedir('GET', '/datos/viajes/historial', undefined, p.token);
  if (!historial.viajes.some((v) => v.puntos))
    throw new Error(`${M.pais}: «Mis viajes» está vacío; corre antes capturas-carro.mjs`);
  // Un viaje colgado de antes se cancela (la pantalla de pedir no se ve con un viaje en curso).
  const actual = (await pedir('GET', '/datos/viajes/actual', undefined, p.token)).viaje;
  if (actual)
    await pedir('POST', `/datos/viajes/${actual.id}/cancelar`, {}, p.token, {
      'idempotency-key': `capturas-misma-ruta-${Date.now().toString(36)}`,
    });

  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: en ? 'en-US' : 'es-VE',
    ...(M.pais === 'US' ? { timezoneId: 'America/Detroit' } : { timezoneId: 'America/Caracas' }),
    geolocation: { latitude: M.origen.lat, longitude: M.origen.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [p.token, p.id, idioma],
  );
  const c = await ctx.newPage();
  const foto = (nombre) =>
    c.screenshot({ path: join(SALIDA, `misma-ruta-${nombre}-${idioma}.png`) });

  // ───────── 1. Mis viajes, desde la pestaña Pedidos → Viajes
  await c.goto('/app/orders');
  await c.getByTestId('chip-viajes').click({ timeout: 60_000 });
  await c.getByTestId('mis-viajes').waitFor({ timeout: 30_000 });
  const primero = historial.viajes.find((v) => v.puntos && ['moto', 'carro'].includes(v.servicio));
  await c.getByTestId(`viaje-${primero.id}`).waitFor({ timeout: 30_000 });
  await espera(1_200);
  await foto('mis-viajes');

  // ───────── 2. «Pedir la misma ruta» → la confirmación con el precio de ahora
  await c.getByTestId(`pedir-misma-ruta-${primero.id}`).click();
  await c.getByTestId('misma-ruta-confirmar').waitFor({ timeout: 30_000 });
  await espera(1_000);
  await foto('confirmar');

  // ───────── 3. «Sí, pedir ahora» → la pantalla de espera de siempre (el viaje es en efectivo o
  // tarjeta según el viaje anterior; con tarjeta se queda en la autorización y no se fotografía)
  await c.getByTestId('misma-ruta-confirmar').click();
  // C-METODO-PAGO-PANTALLA: también pasa por «Método de pago».
  await c.getByTestId('metodo-pago').waitFor({ timeout: 30_000 });
  // Estas fotos son de pago en mano: si la cuenta tiene Saldo Divoox, se apaga.
  if (await c.getByTestId('pago-saldo-desglose').isVisible())
    await c.getByTestId('pago-saldo-usar').click();
  await c.getByTestId('pago-solicitar').click();
  await c.waitForURL(/\/ride\?/, { timeout: 30_000 });
  await espera(2_500);
  await foto('espera');
  const nuevo = (await pedir('GET', '/datos/viajes/actual', undefined, p.token)).viaje;
  if (nuevo)
    await pedir('POST', `/datos/viajes/${nuevo.id}/cancelar`, {}, p.token, {
      'idempotency-key': `capturas-misma-ruta-fin-${Date.now().toString(36)}`,
    });

  // ───────── 4. El inicio con «Tu último viaje» (cuando el inicio ya monta RepetirUltimoViaje)
  await c.goto('/app/');
  const tarjeta = c.getByTestId('repetir-ultimo-viaje');
  if (
    await tarjeta.waitFor({ timeout: 20_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await tarjeta.scrollIntoViewIfNeeded();
    await espera(800);
    await foto('inicio-repetir');
  } else console.warn(`${idioma}: el inicio todavía no muestra «Tu último viaje»; falta esa foto`);
  await ctx.close();
}

// Como capturas-carro.mjs: Carro de Estados Unidos vuelve a quedar apagado en este servidor local.
const apagarPasajerosUs = async () => {
  await sql(
    "UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro') AND zona_id IN (SELECT id FROM zonas WHERE pais = 'US')",
  ).catch(() => null);
  await sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro') AND NOT EXISTS (SELECT 1 FROM servicios_zona z WHERE z.servicio_id = servicios.id AND z.estado = 'disponible')",
  ).catch(() => null);
};

const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'en') await correr(LUGARES.ve, 'es');
  if (SOLO !== 'es') await correr(LUGARES.us, 'en');
} finally {
  await apagarPasajerosUs();
  await navegador.close();
}
console.log('capturas de «Pedir la misma ruta» listas en docs/capturas/recorrido/misma-ruta-*.png');
