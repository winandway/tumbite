// Capturas REALES de Divoox Carro (taxi) para Docs (C-DOCS-CARRO, 14 nov 2026). Venezuela (El Vigía,
// estado Mérida, zona VE-MER-ELVIGIA): efectivo y pago móvil. Contra el servidor local del recorrido
// (.recorrido, armado con scripts/recorrido/preparar.mjs y encendido en el puerto 8790), con las apps
// web reales del pasajero y del Driver y el panel del equipo:
//   1. corre probar-moto-venezuela.mjs (conductor de prueba aprobado con saldo en El Vigía);
//   2. abre Carro en El Vigía con el paso del panel (tarifa de mercado, no «de prueba»);
//   3. el conductor registra su carro y sus papeles desde la app; el equipo lo revisa y lo aprueba;
//   4. viaje en Carro (pago móvil) y en Carro XL (efectivo), propina, «Mis viajes» con su recibo y
//      «Olvidé algo en el vehículo».
// Datos neutros («Pasajero de prueba», «Conductor de prueba»). Guarda las originales en
// docs/capturas/recorrido/carro-*.png (y las del panel interno en docs/capturas/ciudad-*.png para la
// guía interna COMO-ABRIR-UNA-CIUDAD). Uso: node scripts/recorrido/capturas-carro.mjs
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
const INTERNAS = join(RAIZ, 'docs', 'capturas');
const CIUDAD = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
  zonaHoraria: 'America/Caracas',
};
const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' };
const DESTINO = { lat: 8.624, lng: -71.672, direccion: 'Aeropuerto de El Vigía' };
const FOTO = readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
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
  if (r.status === 429 && intento < 4) {
    await new Promise((x) => setTimeout(x, 15_000));
    return pedir(metodo, ruta, cuerpo, token, extra, intento + 1);
  }
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const intentar = (p) => p.catch((x) => ({ error: String(x) }));
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const subir = async (ruta, token) => {
  const r = await fetch(`${URL}${ruta}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: FOTO,
  });
  if (!r.ok) throw new Error(`subir ${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
};

execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const armado = await pedir('POST', '/datos/interno/diagnostico/moto-ve/armar', {}, undefined, {
  'x-reloj-secreto': SECRETO,
});
const { ids: IDS, clave } = armado;
const tokens = armado.tokens;
for (const t of Object.values(tokens))
  await sql(
    `UPDATE sesiones SET expira_en = datetime('now', '+90 minutes') WHERE id = '${createHash('sha256').update(t).digest('hex')}'`,
  );
const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
let n = 0;
const paso = (op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
    'idempotency-key': `capturas-carro-${nombre}-${++n}-${Date.now().toString(36)}`,
  });
const cerrarColgado = async () => {
  const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
  if (!v) return;
  if (v.estado === 'en_curso') await paso(v.id, 'terminar');
  else
    await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
      'idempotency-key': `capturas-carro-cancelar-${Date.now().toString(36)}`,
    });
};
await cerrarColgado();

// ───────── 1. Carro en El Vigía, con el paso del panel (compuerta del país solo en este servidor local)
const abrir = () =>
  equipo('POST', '/datos/admin/viajes/ciudades', {
    servicio: 'carro',
    zona: CIUDAD,
    motivo: 'Ciudad de las capturas de Carro (servidor local)',
  });
if ((await intentar(abrir())).error) {
  await equipo('PUT', '/datos/admin/pasajeros-pais/VE/carro', {
    clave,
    abierto: true,
    solicitudMarca: 'LOCAL-0000',
    confirmo: true,
  });
  await abrir();
}
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${CIUDAD.id}' AND activa = 1`);
await pedir('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 240 }, tokens.equipo);

// Un carro anterior de estas cuentas fijas se retira para que el alta empiece de cero.
await sql(
  `UPDATE vehiculos SET estado = 'retirado' WHERE conductor_id = '${IDS.conductor}' AND tipo = 'carro'`,
);
await sql(
  `DELETE FROM habilitaciones WHERE conductor_id = '${IDS.conductor}' AND servicio_id = 'carro'`,
);

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
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [token, id, idioma],
  );
  return ctx;
};
const foto = (p, nombre, idioma) =>
  p.screenshot({ path: join(SALIDA, `carro-${nombre}-${idioma}.png`) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const arribaDe = (l) => l.evaluate((x) => x.scrollIntoView({ block: 'start' }));
// El estado va al final del alta: se deja abajo de la pantalla para que se vea el carro encima.
const abajoDe = (l) =>
  l.evaluate((x) => {
    x.scrollIntoView({ block: 'end' });
    globalThis.scrollBy(0, 40);
  });

/** Abre «Divoox Carro» en el perfil del Driver y saca la foto de lo que pida `que`. */
async function altaCarro(idioma, nombre, que) {
  const en = idioma === 'en';
  const ctx = await telefono(tokens.conductor, IDS.conductor, idioma);
  const d = await ctx.newPage();
  await d.goto('/driver/');
  await d.getByRole('tab', { name: en ? 'Profile' : 'Perfil' }).click({ timeout: 60_000 });
  await d
    .getByText(en ? 'Divoox Car' : 'Divoox Carro', { exact: true })
    .first()
    .click();
  await d.getByTestId('alta-carro').waitFor({ timeout: 30_000 });
  await espera(1_200);
  await que(d, en);
  await espera(600);
  await foto(d, nombre, idioma);
  await ctx.close();
}

// ───────── 2. Driver: el alta antes de registrar el carro
for (const idioma of ['es', 'en'])
  await altaCarro(idioma, 'driver-alta', (d) => arribaDe(d.getByTestId('alta-carro')));

const carro = (
  await conductor('POST', '/datos/conductor/vehiculos', {
    tipo: 'carro',
    marca: 'Toyota',
    modelo: 'Corolla',
    anio: 2019,
    color: 'Gris',
    placa: `AB${Math.floor(Math.random() * 9e4 + 1e4)}`,
    plazas: 4,
  })
).id;
for (const t of [
  'registro',
  'seguro',
  'seguro_pasajeros',
  'foto_frente',
  'foto_lado',
  'foto_placa',
  'foto_interior',
])
  await intentar(
    subir(`/datos/conductor/vehiculos/${carro}/documentos?tipo=${t}`, tokens.conductor),
  );
await conductor('POST', `/datos/conductor/vehiculos/${carro}/enviar`);
// La licencia de conducir de carro (la de moto no sirve para Carro).
const licencia = await intentar(
  subir('/datos/conductor/papeles?tipo=licencia&vence=2030-01-01', tokens.conductor),
);

// ───────── 3. Driver: el carro en revisión, y el panel del equipo con la cola por revisar
for (const idioma of ['es', 'en'])
  await altaCarro(idioma, 'driver-revision', (d) => abajoDe(d.getByTestId('estado-carro')));

const ruta = (await equipo('GET', '/datos/admin/ruta')).ruta;
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const ctxP = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
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
  await espera(1_500);
  // Se fotografía cada tarjeta entera, sin depender del desplazamiento del panel.
  await p
    .locator('.tarjeta-form')
    .filter({
      has: p.getByText(
        en ? 'Open a ride service in a city' : 'Abrir un servicio de viajes en una ciudad',
        { exact: true },
      ),
    })
    .first()
    .screenshot({ path: join(INTERNAS, `ciudad-abrir-servicio-${idioma}.png`) });
  await p.getByTestId(`moto-${carro}`).waitFor({ timeout: 30_000 });
  await p
    .getByTestId(`moto-${carro}`)
    .screenshot({ path: join(INTERNAS, `ciudad-vehiculos-por-revisar-${idioma}.png`) });
  await ctxP.close();
}

// El equipo aprueba los papeles del carro, el carro y la habilitación (como en el panel).
const veh = (await equipo('GET', '/datos/admin/vehiculos?estado=en_revision')).vehiculos.find(
  (x) => x.id === carro,
);
for (const d of veh?.documentos ?? [])
  await equipo('PUT', `/datos/admin/vehiculos/${carro}/documentos/${d.id}`, {
    estado: 'aprobado',
    venceEn: '2030-01-01',
  });
await equipo('PUT', `/datos/admin/vehiculos/${carro}`, { estado: 'aprobado' });
if (licencia?.id)
  await intentar(
    equipo('PUT', `/datos/admin/papeles-conductor/${licencia.id}`, { estado: 'aprobado' }),
  );
await conductor('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: carro });
const faltan = (await conductor('GET', '/datos/conductor/servicios')).servicios.find(
  (s) => s.servicioId === 'carro',
);
for (const req of faltan?.requisitosFaltantes ?? [])
  await intentar(
    equipo('PUT', `/datos/admin/cumplimientos/${IDS.conductor}/${req}`, {
      estado: 'aprobado',
      vehiculoId: carro,
    }),
  );
await equipo('PUT', `/datos/admin/habilitaciones/${IDS.conductor}/carro`, { estado: 'aprobada' });
await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'carro', activa: true });
await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: false });

// ───────── 4. Driver: aprobado, con el interruptor para recibir viajes de Carro
for (const idioma of ['es', 'en'])
  await altaCarro(idioma, 'driver-aprobado', (d) => abajoDe(d.getByTestId('estado-carro')));

for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  await cerrarColgado();
  await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
  await conductor('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng });

  // ───────── Pasajero: Carro y Carro XL, precio fijo y forma de pago
  const ctxC = await telefono(tokens.cliente, IDS.cliente, idioma);
  await ctxC.addInitScript(
    ([u, b]) => localStorage.setItem(`tumbite.borrador.carro.${u}`, b),
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
  await c.goto('/app/ride?servicio=carro');
  await c.getByRole('button', { name: en ? 'See price' : 'Ver precio' }).click({ timeout: 60_000 });
  await c.getByTestId('moto-precio').waitFor({ timeout: 30_000 });
  await c
    .getByText(en ? 'Mobile payment' : 'Pago móvil', { exact: true })
    .first()
    .click();
  await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
  await espera(800);
  await foto(c, 'pasajero-precio', idioma);
  await c
    .getByText(en ? 'Car XL (6 seats)' : 'Carro XL (6 plazas)', { exact: true })
    .first()
    .click();
  await c.getByRole('button', { name: en ? 'See price' : 'Ver precio' }).click();
  await c.getByTestId('moto-precio').waitFor({ timeout: 30_000 });
  await arribaDe(
    c.getByText(en ? 'Car XL (6 seats)' : 'Carro XL (6 plazas)', { exact: true }).first(),
  );
  await c.evaluate(() => globalThis.scrollBy(0, -120));
  await espera(800);
  await foto(c, 'pasajero-xl', idioma);
  // Vuelve a Carro normal y pide con pago móvil.
  await c
    .getByText(en ? 'Car' : 'Carro', { exact: true })
    .first()
    .click()
    .catch(() => null);
  const cot = (
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'carro',
      origen: ORIGEN,
      destino: DESTINO,
    })
  ).cotizacion;
  const viaje = (
    await pasajero('POST', '/datos/viajes', { cotizacionId: cot.id, metodoPago: 'pago_movil' })
  ).viaje;

  // ───────── Driver: la oferta de Carro
  const ctxD = await telefono(tokens.conductor, IDS.conductor, idioma);
  const d = await ctxD.newPage();
  await d.goto('/driver/');
  await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
  await espera(800);
  await foto(d, 'driver-oferta', idioma);
  await paso(viaje.id, 'aceptar');

  // ───────── Pasajero: conductor asignado con foto, carro, placa, llegada y código
  await c.reload();
  await c.getByTestId('viaje-conductor').waitFor({ timeout: 60_000 });
  // El mapa termina de cargar sus cuadros antes de la foto.
  await espera(4_000);
  await foto(c, 'pasajero-conductor', idioma);
  await arribaDe(c.getByTestId('viaje-codigo'));
  await c.evaluate(() => globalThis.scrollBy(0, -200));
  await espera(600);
  await foto(c, 'pasajero-codigo', idioma);

  await paso(viaje.id, 'llegue');
  const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
  // ───────── Driver: el código del pasajero para empezar
  await d.reload();
  await d.getByTestId('viaje-pin').waitFor({ timeout: 60_000 });
  await d.getByTestId('viaje-pin').fill(pin);
  await espera(600);
  await foto(d, 'driver-codigo', idioma);
  await paso(viaje.id, 'iniciar', { pin });
  await d.reload();
  await d.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
  await d.getByTestId('viaje-pago-movil').scrollIntoViewIfNeeded();
  await espera(800);
  await foto(d, 'driver-viaje', idioma);
  await d.getByText(en ? 'Yes, it arrived' : 'Sí, me llegó', { exact: true }).click();
  await d.getByText(en ? 'End ride' : 'Terminar viaje', { exact: true }).click();
  await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
  await espera(800);
  await foto(d, 'driver-cobro', idioma);

  // ───────── Pasajero: llegó, califica y deja propina (la pantalla abierta se pone al día sola)
  await c.getByTestId('viaje-calificar').waitFor({ timeout: 60_000 });
  await c.getByTestId('estrella-5').click();
  await espera(600);
  await arribaDe(c.getByTestId('viaje-calificar'));
  await c.evaluate(() => globalThis.scrollBy(0, -160));
  await espera(600);
  await foto(c, 'pasajero-propina', idioma);
  await ctxC.close();

  // ───────── Pasajero: «Mis viajes», el recibo y «Olvidé algo en el vehículo»
  const ctxH = await telefono(tokens.cliente, IDS.cliente, idioma);
  const h = await ctxH.newPage();
  await h.goto('/app/ride?servicio=carro');
  await h.getByTestId('mis-viajes').waitFor({ timeout: 60_000 });
  await arribaDe(h.getByTestId('mis-viajes'));
  await espera(800);
  await foto(h, 'pasajero-mis-viajes', idioma);
  await h.getByTestId('mis-viajes').getByRole('button').first().click();
  await h.getByTestId('recibo-viaje').waitFor({ timeout: 30_000 });
  await arribaDe(h.getByTestId('recibo-viaje'));
  await espera(800);
  await foto(h, 'pasajero-recibo', idioma);
  await h
    .getByText(en ? 'I left something in the vehicle' : 'Olvidé algo en el vehículo', {
      exact: true,
    })
    .click();
  await espera(400);
  await h
    .getByText(en ? 'Help with this ride' : 'Ayuda con este viaje', { exact: true })
    .evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await espera(600);
  await foto(h, 'pasajero-olvide', idioma);
  await ctxH.close();

  // ───────── Driver: viaje en efectivo (Carro XL no: el carro es de 4 plazas) y su cobro
  const cot2 = (
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'carro',
      origen: ORIGEN,
      destino: DESTINO,
    })
  ).cotizacion;
  const v2 = (
    await pasajero('POST', '/datos/viajes', { cotizacionId: cot2.id, metodoPago: 'efectivo' })
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
  await ctxD.close();
}
// Vuelve a dejarlo con su moto para el guion de Moto.
await intentar(
  conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'carro', activa: false }),
);
await conductor('POST', '/datos/repartidor/conectar', { conectado: false });
await navegador.close();
console.log('capturas de Carro listas en docs/capturas/recorrido/carro-*.png');
