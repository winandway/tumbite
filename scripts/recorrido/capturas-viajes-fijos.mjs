// Capturas REALES del conductor de confianza y de los viajes fijos para Docs (C-CONDUCTOR-CONFIANZA y
// C-VIAJES-FIJOS, 16 nov 2026) — todos los países. Contra el servidor LOCAL del recorrido (.recorrido,
// armado con scripts/recorrido/preparar.mjs y encendido en el puerto 8790), con las apps web reales
// del pasajero (/app) y del Driver (/driver). NO toca el sitio de pruebas ni las cuentas demo.
//
// 1. corre probar-moto-venezuela.mjs: pasajero y mototaxista de prueba con viajes TERMINADOS juntos
//    (es lo que pide el servidor para marcar a alguien de confianza);
// 2. por idioma (español en El Vigía, inglés en Novi; C-CAPTURAS-POR-IDIOMA):
//    confianza-marcar (Mis viajes, tres puntos de un viaje terminado), confianza-lista,
//    pedir-confianza («Pedir primero a»), fijos-lista, fijos-acciones (los tres puntos de un viaje
//    fijo), fijos-formulario, fijos-menor (formulario con menor y PIN), driver-agenda (Clientes fijos)
//    y driver-oferta (oferta «Cliente de confianza · solo para ti» con menor).
// Los viajes fijos de las fotos se escriben directo en ESTA base local (datos neutros: «Escuela de
// Sofía», «Al trabajo»). En inglés, los viajes terminados de la lista toman direcciones de Novi.
// Guarda las originales en docs/capturas/viajes-fijos/<nombre>-<es|en>.png y su versión liviana en
// apps/panel/public/docs/recorrido-viajes-fijos-<nombre>-<es|en>.webp.
// Uso: node scripts/recorrido/capturas-viajes-fijos.mjs   (SOLO_IDIOMA=es|en para un solo idioma)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'viajes-fijos');
const DOCS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
mkdirSync(SALIDA, { recursive: true });

const LUGARES = {
  es: {
    zona: 'VE-MER-ELVIGIA',
    tz: 'America/Caracas',
    locale: 'es-VE',
    casa: { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' },
    escuela: { lat: 8.6262, lng: -71.6612, direccion: 'Escuela Básica del centro, El Vigía' },
    trabajo: { lat: 8.624, lng: -71.672, direccion: 'Aeropuerto de El Vigía' },
    servicioTrabajo: 'moto',
    escuelaNombre: 'Escuela de Sofía',
    trabajoNombre: 'Al trabajo',
  },
  en: {
    zona: 'US-MI-NOVI',
    tz: 'America/Detroit',
    locale: 'en-US',
    casa: { lat: 42.4806, lng: -83.4755, direccion: 'Novi Town Center, Novi, MI' },
    escuela: { lat: 42.4722, lng: -83.478, direccion: 'Novi Public Library, Novi, MI' },
    trabajo: { lat: 42.4915, lng: -83.4706, direccion: 'Twelve Oaks Mall, Novi, MI' },
    servicioTrabajo: 'carro',
    escuelaNombre: 'Sofía’s school',
    trabajoNombre: 'To work',
  },
};

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.81.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const txt = (s) => String(s).replace(/'/g, "''");
const huella = (t) => createHash('sha256').update(t).digest('hex');

// 1. Pasajero y mototaxista con viajes terminados juntos (El Vigía).
execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const navegador = await chromium.launch();

async function webp(nombre, idioma) {
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    '-resize',
    '540',
    '0',
    join(SALIDA, `${nombre}-${idioma}.png`),
    '-o',
    join(DOCS, `recorrido-viajes-fijos-${nombre}-${idioma}.webp`),
  ]);
}

/** Novi abierta para Moto y Carro en ESTE servidor local (solo para las fotos en inglés). */
async function abrirNovi(L) {
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${L.zona}', 'Novi', 'US', 'USD', '${L.tz}', ${L.casa.lat}, ${L.casa.lng}, 15, 1)`,
  );
  for (const s of ['moto', 'carro']) {
    await sql(`UPDATE servicios SET estado = 'disponible' WHERE id = '${s}'`);
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('${s}', '${L.zona}', 'disponible')
       ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await sql(
      `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
         espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento,
         tope_dinamico_pb, redondeo, de_prueba, motivo)
       SELECT 'zz-fijos-t-${s}', '${s}', '${L.zona}', 'USD', 250, 110, 30, 800, 300, 30, 120, 300, 400, 10000, 1, 0,
              'Tarifa de las capturas de viajes fijos (servidor local)'
        WHERE NOT EXISTS (SELECT 1 FROM tarifas_viaje WHERE servicio_id = '${s}' AND zona_id = '${L.zona}' AND activa = 1)`,
    );
  }
}

async function correr(idioma) {
  const L = idioma === 'en' ? LUGARES.en : LUGARES.es;
  const en = idioma === 'en';
  const a = await interno('moto-ve/armar');
  const cliente = { token: a.tokens.cliente, id: a.ids.cliente };
  const conductor = { token: a.tokens.conductor, id: a.ids.conductor };
  for (const t of [cliente.token, conductor.token])
    await sql(
      `UPDATE sesiones SET expira_en = datetime('now', '+60 minutes') WHERE id = '${huella(t)}'`,
    );
  if (en) await abrirNovi(L);
  // Empezar limpio: sin confianza, sin viajes fijos y sin viaje en curso.
  await sql(
    `DELETE FROM rutina_salidas WHERE rutina_id IN (SELECT id FROM rutinas_viaje WHERE cliente_id = '${cliente.id}')`,
  );
  await sql(`DELETE FROM rutinas_viaje WHERE cliente_id = '${cliente.id}'`);
  await sql(`DELETE FROM conductores_confianza WHERE cliente_id = '${cliente.id}'`);
  await sql(
    `UPDATE usuarios SET idioma = '${idioma}' WHERE id IN ('${cliente.id}', '${conductor.id}')`,
  );
  // Nombres de pila neutros para las fotos (en esta base local): así se leen la oferta y la agenda.
  await sql(
    `UPDATE usuarios SET nombre = '${en ? 'Laura Smith' : 'Laura Pérez'}' WHERE id = '${cliente.id}'`,
  );
  await sql(
    `UPDATE usuarios SET nombre = '${en ? 'Mike Brown' : 'José Rojas'}' WHERE id = '${conductor.id}'`,
  );
  await sql(
    `UPDATE vehiculos SET color = '${en ? 'Black' : 'Negro'}' WHERE conductor_id = '${conductor.id}'`,
  );
  if (en)
    // En inglés, los viajes terminados de la lista con direcciones de Novi (C-CAPTURAS-POR-IDIOMA).
    await sql(
      `UPDATE viajes SET origen_direccion = '${txt(L.casa.direccion)}', origen_lat = ${L.casa.lat}, origen_lng = ${L.casa.lng},
         destino_direccion = '${txt(L.trabajo.direccion)}', destino_lat = ${L.trabajo.lat}, destino_lng = ${L.trabajo.lng}
       WHERE operacion_id IN (SELECT id FROM operaciones WHERE cliente_id = '${cliente.id}')`,
    );

  // El mototaxista conectado en la recogida de esta ciudad (para «Conectado ahora» y su oferta).
  const conectar = async () => {
    await sql(`DELETE FROM conductor_ocupacion WHERE conductor_id = '${conductor.id}'`);
    await sql(
      `UPDATE repartidores SET lat = ${L.casa.lat}, lng = ${L.casa.lng}, ubicacion_en = datetime('now'),
         pausado = 0, conectado = 1, zona_id = '${L.zona}' WHERE usuario_id = '${conductor.id}'`,
    );
  };
  await conectar();

  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: L.locale,
    timezoneId: L.tz,
    geolocation: { latitude: L.casa.lat, longitude: L.casa.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [cliente.token, cliente.id, idioma],
  );
  const c = await ctx.newPage();
  const errores = [];
  c.on('pageerror', (e) => errores.push(String(e)));
  const foto = async (nombre, pagina = c) => {
    await pagina.screenshot({ path: join(SALIDA, `${nombre}-${idioma}.png`) });
    await webp(nombre, idioma);
  };

  // ───────── confianza-marcar: Mis viajes → tres puntos de un viaje terminado con conductor
  const historial = await pedir('GET', '/datos/viajes/historial', undefined, cliente.token);
  const terminado = historial.viajes.find((v) => v.estado === 'terminado' && v.conductor);
  if (!terminado) throw new Error(`${idioma}: no hay un viaje terminado con conductor`);
  await c.goto('/app/rides');
  await c.getByTestId(`viaje-opciones-${terminado.id}`).click({ timeout: 60_000 });
  await c.getByTestId('viaje-opcion-confianza').waitFor({ timeout: 20_000 });
  await espera(900);
  await foto('confianza-marcar');
  await c.getByTestId('viaje-opcion-confianza').click();
  await c.getByTestId('aviso-confianza').waitFor({ timeout: 20_000 });

  // ───────── confianza-lista
  await c.goto('/app/trusted-drivers');
  await c.getByTestId(`confianza-${conductor.id}`).waitFor({ timeout: 60_000 });
  await espera(900);
  await foto('confianza-lista');

  // ───────── pedir-confianza: «Pedir primero a» en la pantalla de Moto
  await c.goto('/app/ride?servicio=moto');
  const primero = c.getByTestId('pedir-primero-a');
  await primero.waitFor({ timeout: 60_000 });
  await primero.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await espera(900);
  await foto('pedir-confianza');

  // ───────── viajes fijos (escritos directo en esta base local)
  const dias = '1,2,3,4,5';
  const fila = (id, nombre, servicio, de, a, ida, vuelta, menor, pin, conConductor) =>
    sql(
      `INSERT INTO rutinas_viaje (id, cliente_id, nombre, servicio_id, zona_id, origen_lat, origen_lng, origen_direccion,
         destino_lat, destino_lng, destino_direccion, dias, hora_ida, hora_vuelta, metodo_pago, conductor_id, menor_nombre, pin_menor)
       VALUES ('${id}', '${cliente.id}', '${txt(nombre)}', '${servicio}', '${L.zona}', ${de.lat}, ${de.lng}, '${txt(de.direccion)}',
         ${a.lat}, ${a.lng}, '${txt(a.direccion)}', '${dias}', '${ida}', ${vuelta ? `'${vuelta}'` : 'NULL'}, 'efectivo',
         ${conConductor ? `'${conductor.id}'` : 'NULL'}, ${menor ? `'${menor}'` : 'NULL'}, ${pin ? `'${pin}'` : 'NULL'})`,
    );
  const escuela = `zz-fijo-escuela-${idioma}`;
  const trabajo = `zz-fijo-trabajo-${idioma}`;
  await fila(
    escuela,
    L.escuelaNombre,
    'moto',
    L.casa,
    L.escuela,
    '07:00',
    '12:30',
    'Sofía',
    '4821',
    true,
  );
  await fila(
    trabajo,
    L.trabajoNombre,
    L.servicioTrabajo,
    L.casa,
    L.trabajo,
    '06:45',
    '17:30',
    null,
    null,
    true,
  );

  // La ida de mañana de la escuela ya nació (como lo hace el reloj 24 horas antes): «No puedo».
  const manana = new Intl.DateTimeFormat('en-CA', { timeZone: L.tz }).format(
    new Date(Date.now() + 86_400_000),
  );
  const desfase = en ? 5 : 4; // Detroit en noviembre (UTC-5) y Caracas (UTC-4).
  await sql(
    `INSERT OR REPLACE INTO rutina_salidas (rutina_id, fecha, sentido, hora, estado, conductor_id)
     VALUES ('${escuela}', '${manana}', 'ida', datetime('${manana} 07:00:00', '+${desfase} hours'), 'creada', '${conductor.id}')`,
  );

  await c.goto('/app/fixed-rides');
  await c.getByTestId(`fijo-${escuela}`).waitFor({ timeout: 60_000 });
  await espera(900);
  await foto('fijos-lista');
  await c.getByTestId(`fijo-opciones-${escuela}`).click();
  await c.getByTestId('fijo-pausar').waitFor({ timeout: 20_000 });
  await espera(700);
  await foto('fijos-acciones');

  await c.goto(`/app/fixed-ride?id=${trabajo}`);
  await c.getByTestId('formulario-viaje-fijo').waitFor({ timeout: 60_000 });
  await c
    .getByText(en ? 'Today’s price' : 'Precio de hoy', { exact: false })
    .waitFor({ timeout: 30_000 })
    .catch(() => null);
  await espera(900);
  await foto('fijos-formulario');

  await c.goto(`/app/fixed-ride?id=${escuela}`);
  const pin = c.getByTestId('fijo-pin');
  await pin.waitFor({ timeout: 60_000 });
  await pin.scrollIntoViewIfNeeded();
  await c.evaluate(() => globalThis.scrollBy(0, 120));
  await espera(900);
  await foto('fijos-menor');
  if (errores.length) console.warn(`${idioma}: errores en la página del pasajero:`, errores);

  // ───────── Driver: Clientes fijos
  const dctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: L.locale,
    timezoneId: L.tz,
    geolocation: { latitude: L.casa.lat, longitude: L.casa.lng },
    permissions: ['geolocation'],
  });
  await dctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [conductor.token, conductor.id, idioma],
  );
  const d = await dctx.newPage();
  await d.goto('/driver/');
  await d
    .getByLabel(en ? 'Menu' : 'Menú')
    .first()
    .click({ timeout: 60_000 })
    .catch(async () => {
      await d
        .getByRole('button', { name: /men[uú]/i })
        .first()
        .click({ timeout: 30_000 });
    });
  await d
    .getByText(en ? 'Regular riders' : 'Clientes fijos', { exact: true })
    .first()
    .click({ timeout: 30_000 });
  await d.getByTestId('clientes-fijos').waitFor({ timeout: 30_000 });
  await d.getByText(en ? 'Next 7 days' : 'Próximos 7 días').waitFor({ timeout: 30_000 });
  await espera(1_000);
  await foto('driver-agenda', d);

  // ───────── Driver: la oferta de un cliente de confianza que lleva a un menor
  await conectar();
  const cot = await pedir(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: { ...L.casa }, destino: { ...L.escuela } },
    cliente.token,
  ).catch((e) => ({ error: String(e) }));
  if (cot.cotizacion) {
    const v = await pedir(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.cotizacion.id, metodoPago: 'efectivo', confianza: conductor.id },
      cliente.token,
      { 'idempotency-key': `capturas-fijos-${idioma}-${Date.now().toString(36)}` },
    ).catch((e) => ({ error: String(e) }));
    if (v.viaje) {
      await sql(
        `UPDATE viajes SET menor_nombre = 'Sofía', rutina_id = '${escuela}' WHERE operacion_id = '${v.viaje.id}'`,
      );
      await d.goto('/driver/');
      const oferta = d.getByTestId('oferta-viaje-confianza');
      if (
        await oferta.waitFor({ timeout: 45_000 }).then(
          () => true,
          () => false,
        )
      ) {
        await espera(1_000);
        await foto('driver-oferta', d);
      } else
        console.warn(`${idioma}: la oferta de confianza no llegó al Driver; falta driver-oferta`);
      await pedir('POST', `/datos/viajes/${v.viaje.id}/cancelar`, {}, cliente.token, {
        'idempotency-key': `capturas-fijos-fin-${idioma}-${Date.now().toString(36)}`,
      }).catch(() => null);
    } else console.warn(`${idioma}: no se pudo pedir el viaje para la oferta:`, v.error);
  } else console.warn(`${idioma}: no se pudo cotizar para la oferta:`, cot.error);
  await dctx.close();
  await ctx.close();
}

const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'en') await correr('es');
  if (SOLO !== 'es') await correr('en');
} finally {
  await sql(
    "UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro') AND zona_id IN (SELECT id FROM zonas WHERE pais = 'US')",
  ).catch(() => null);
  // Y el servicio que no quedó encendido en ninguna ciudad vuelve a «próximamente» (el canario lo pide).
  await sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro') AND NOT EXISTS (SELECT 1 FROM servicios_zona z WHERE z.servicio_id = servicios.id AND z.estado = 'disponible')",
  ).catch(() => null);
  await navegador.close();
}
console.log('capturas de viajes fijos listas en docs/capturas/viajes-fijos/');
