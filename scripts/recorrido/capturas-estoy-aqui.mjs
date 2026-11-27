// C-ESTOY-AQUI (27 nov 2026) — todas las ciudades. Prueba EN PANTALLA, contra un servidor LOCAL propio,
// el recorrido completo de «Estoy aquí» y toma las capturas:
//   Driver (Docs públicos, apps/panel/public/docs): puntos-por-medir-lista, estoy-aqui-esperar,
//     estoy-aqui-listo, estoy-aqui-enviada (-es y -en). Lugares NEUTROS de ejemplo y sin ciudad en
//     pantalla (C-DOCS-SIN-DATOS-REALES).
//   Panel (ayuda interna, carpeta privada): medir-lugares-pendiente y medir-lugares-tareas (-es, -en).
// Cada paso lleva su comprobación: con 40 m de precisión NO aparece «Estoy aquí»; con 6 m sí; la medición
// queda pendiente y el lugar NO se mueve hasta aprobarla en el panel; un conductor sin asignar no la ve.
// NO toca el sitio de pruebas ni producción.
// Antes: npm run build -w @tumbite/panel && URL_API=http://localhost:8799 npm run build:repartidor-web
// Uso: node scripts/recorrido/capturas-estoy-aqui.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const PUERTO = process.env.PUERTO_ESTOY_AQUI ?? '8799';
const DIR = join(RAIZ, '.recorrido');
execSync('node scripts/recorrido/preparar.mjs', {
  cwd: RAIZ,
  stdio: 'inherit',
  env: { ...process.env, SOLO_SERVIDOR: '1', PUERTO_RECORRIDO: PUERTO },
});
cpSync(join(RAIZ, 'apps/panel/dist'), join(DIR, 'sitio'), { recursive: true });
cpSync(join(RAIZ, 'apps/repartidor/dist-web'), join(DIR, 'sitio', 'driver'), { recursive: true });
const DATOS = JSON.parse(readFileSync(join(DIR, 'datos.json'), 'utf8'));
const URL = DATOS.url;
const PUBLICAS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'recorrido');
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });
mkdirSync(ORIGINALES, { recursive: true });

const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    PUERTO,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);
const apagar = () => {
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.88.0.${++ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const secreto = { 'x-reloj-secreto': DATOS.relojSecreto };
const sql = (q) => pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, secreto);
const comprobar = (ok, que) => {
  if (!ok) throw new Error(`NO: ${que}`);
  console.log(`ok: ${que}`);
};
const webp = (png, destino) => execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', destino]);

// Lugares de EJEMPLO, cerca del centro de cada ciudad de pruebas (los nombres no son de ningún sitio real).
const L = {
  es: {
    locale: 'es-VE',
    quien: 've',
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      lat: 8.6159,
      lng: -71.6442,
      tz: 'America/Caracas',
    },
    titulo: 'Puntos de la vía principal',
    nota: 'Mide donde se deja al pasajero, no en medio de la vía.',
    lugares: ['Plaza Central', 'Entrada del Mercado', 'Parada del Puente'],
  },
  en: {
    locale: 'en-US',
    quien: 'us',
    zona: { id: 'US-MI-NOVI', nombre: 'Novi', lat: 42.4806, lng: -83.4755, tz: 'America/Detroit' },
    titulo: 'Points along the main road',
    nota: 'Measure where riders get dropped off, not in the middle of the road.',
    lugares: ['Main Square', 'Market Entrance', 'Bridge Stop'],
  },
};

let navegador;
try {
  for (let i = 0; ; i++) {
    const ok = await fetch(`${URL}/datos/salud`).then(
      () => true,
      () => false,
    );
    if (ok) break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2000);
  }
  // El equipo (superadmin local) y los conductores listos del guion de Carro (uno por país).
  const reg = await pedir('POST', '/datos/cuentas/registro', {
    nombre: 'Divoox Soporte',
    correo: DATOS.correoEquipo,
    clave: DATOS.clave,
    rol: 'cliente',
    idioma: 'es',
  }).catch(() =>
    pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave }),
  );
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token).catch(
    () => null,
  );
  const admin = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, admin)).ruta;
  const NZ = L.en.zona;
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${NZ.id}', '${NZ.nombre}', 'US', 'USD', '${NZ.tz}', ${NZ.lat}, ${NZ.lng}, 12, 1)`,
  );
  const VZ = L.es.zona;
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${VZ.id}', '${VZ.nombre}', 'VE', 'USD', '${VZ.tz}', ${VZ.lat}, ${VZ.lng}, 12, 1)`,
  );
  // El panel lista en «Ciudad» las que tienen tarifa de viaje: Moto en las dos ciudades locales.
  await sql("UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'");
  for (const z of [VZ, NZ]) {
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${z.id}', 'disponible')
       ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await pedir(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: z.id,
        tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 700 },
        dePrueba: false,
        motivo: 'Capturas de la guía de medición (servidor local)',
      },
      admin,
    ).catch((x) => console.log(`tarifa ${z.id}: ${x.message}`));
  }
  const armado = await pedir(
    'POST',
    '/datos/interno/diagnostico/carro/armar',
    {},
    undefined,
    secreto,
  );
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    const token = idioma === 'es' ? armado.tokens.conductorVe : armado.tokens.conductorUs;
    const conductorId = idioma === 'es' ? armado.ids.conductorVe : armado.ids.conductorUs;
    await pedir(
      'POST',
      '/datos/interno/diagnostico/carro/conductor',
      { quien: T.quien, zonaId: T.zona.id },
      undefined,
      secreto,
    );
    await sql(`UPDATE usuarios SET zona_id = '${T.zona.id}' WHERE id = '${conductorId}'`);
    // Ya leyó y aceptó el aviso de revisión de documentos (pantalla de entrada, no es de esta guía).
    await pedir('POST', '/datos/conductor/verificacion/permiso-ia', { acepto: true }, token);
    // Y ya eligió su ciudad («¿Dónde vives?»).
    const lugar =
      idioma === 'es'
        ? {
            pais: 'VE',
            estado: 'L',
            municipio: 'Alberto Adriani',
            ciudad: 'El Vigía',
            lugarId: 'gn:3830307',
            lat: 8.6219,
            lng: -71.6506,
          }
        : {
            pais: 'US',
            estado: 'MI',
            municipio: 'Oakland County',
            ciudad: 'Novi',
            lugarId: 'gn:5004005',
            lat: 42.4806,
            lng: -83.4755,
          };
    await pedir('PUT', '/datos/cuentas/lugar', { lugar }, token);
    // Tres lugares de ejemplo, a 300-700 m del centro.
    const ids = [];
    const puntos = T.lugares.map((_, i) => ({
      lat: T.zona.lat + 0.003 * (i + 1),
      lng: T.zona.lng + 0.002 * i,
    }));
    for (const [i, nombre] of T.lugares.entries()) {
      const d = await pedir(
        'POST',
        '/datos/admin/lugares-propios',
        { zona: T.zona.id, nombre, otrosNombres: [], ...puntos[i], rutaId: null },
        admin,
      );
      ids.push(d.lugar.id);
    }
    const tarea = await pedir(
      'POST',
      '/datos/admin/mediciones',
      { zona: T.zona.id, titulo: T.titulo, nota: T.nota, lugares: ids, conductores: [conductorId] },
      admin,
    );
    // Uno ya medido y aprobado, para que la lista muestre los estados.
    const ya = await pedir(
      'POST',
      `/datos/conductor/mediciones/${tarea.tarea.id}/lugares/${ids[2]}`,
      { lat: puntos[2].lat + 0.0003, lng: puntos[2].lng, precisionM: 5, tomadaEn: Date.now() },
      token,
    );
    await pedir('POST', `/datos/admin/mediciones/medicion/${ya.medicion.id}/aprobar`, {}, admin);
    // Un conductor sin asignar no la ve.
    const otro = await pedir('POST', '/datos/cuentas/registro', {
      nombre: idioma === 'es' ? 'Luis Pérez' : 'Alex Rivera',
      correo: `otro-${idioma}-${Date.now()}@recorrido.test`,
      clave: DATOS.clave,
      rol: 'repartidor',
    });
    comprobar(
      (await pedir('GET', '/datos/conductor/mediciones', undefined, otro.token)).tareas.length ===
        0,
      `${idioma}: un conductor sin asignar no ve la tarea`,
    );

    // ─── Driver
    const destino = { lat: puntos[0].lat + 0.0009, lng: puntos[0].lng }; // a ~100 m del punto guardado
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: T.locale,
      timezoneId: T.zona.tz,
      geolocation: { latitude: destino.lat, longitude: destino.lng, accuracy: 40 },
      permissions: ['geolocation', 'camera'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [token, conductorId, idioma],
    );
    const d = await ctx.newPage();
    const foto = async (nombre) => {
      const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
      await espera(800);
      await d.screenshot({ path: png });
      webp(png, join(PUBLICAS, `${nombre}-${idioma}.webp`));
      console.log(`captura: ${nombre}-${idioma}`);
    };
    await d.goto('/driver/');
    // Las pantallas de entrada de una cuenta nueva (permiso de revisión de documentos, «¿Dónde vives?»)
    // no son parte de esta guía: se pasan como lo haría el conductor.
    const pestana = d.getByText(idioma === 'es' ? 'Cuenta' : 'Account', { exact: true }).last();
    for (let i = 0; i < 8 && !(await pestana.isVisible().catch(() => false)); i++) {
      const aceptar = d.getByText(idioma === 'es' ? 'Aceptar y continuar' : 'Accept and continue', {
        exact: true,
      });
      const ahoraNo = d.getByText(idioma === 'es' ? 'Ahora no' : 'Not now', { exact: true });
      if (await aceptar.isVisible().catch(() => false)) {
        await d
          .getByText(idioma === 'es' ? 'Doy mi permiso' : 'I give', { exact: false })
          .first()
          .click();
        await aceptar.click();
      } else if (await ahoraNo.isVisible().catch(() => false)) await ahoraNo.click();
      await espera(2500);
    }
    const cuenta = idioma === 'es' ? 'Cuenta' : 'Account';
    await d
      .getByText(cuenta, { exact: true })
      .last()
      .click({ timeout: 90_000 })
      .catch(async (x) => {
        await d.screenshot({ path: join(DIR, `fallo-driver-${idioma}.png`) });
        throw x;
      });
    const fila = d.getByTestId('cuenta-puntos-por-medir');
    await fila.waitFor({ timeout: 30_000 });
    comprobar(
      (await fila.innerText()).includes(
        idioma === 'es' ? '2 lugares por confirmar en la calle' : '2 places to check on the street',
      ),
      `${idioma}: la cuenta dice cuántos lugares faltan`,
    );
    await fila.click();
    await d.getByTestId('puntos-por-medir').waitFor();
    comprobar(
      await d
        .getByText(idioma === 'es' ? 'Aprobada' : 'Approved', { exact: true })
        .waitFor({ timeout: 20_000 })
        .then(
          () => true,
          () => false,
        ),
      `${idioma}: la lista muestra el lugar ya aprobado`,
    );
    await foto('puntos-por-medir-lista');
    await d.getByTestId(`medir-${ids[0]}`).click();
    await d
      .getByTestId('gps-esperar')
      .waitFor({ timeout: 30_000 })
      .catch(async (x) => {
        await d.screenshot({ path: join(DIR, `fallo-driver-${idioma}.png`) });
        throw x;
      });
    comprobar(
      (await d.getByTestId('estoy-aqui').count()) === 0,
      `${idioma}: con 40 m no aparece «Estoy aquí»`,
    );
    await espera(2500); // el mapa carga sus piezas
    await foto('estoy-aqui-esperar');
    await ctx.setGeolocation({ latitude: destino.lat, longitude: destino.lng, accuracy: 6 });
    await d.getByTestId('estoy-aqui').waitFor({ timeout: 30_000 });
    await foto('estoy-aqui-listo');
    await d.getByTestId('estoy-aqui').click();
    await d
      .getByText(idioma === 'es' ? 'Medición enviada' : 'Measurement sent', { exact: false })
      .waitFor();
    await foto('estoy-aqui-enviada');
    await ctx.close();
    const antes = await pedir(
      'GET',
      `/datos/admin/lugares-propios?zona=${T.zona.id}`,
      undefined,
      admin,
    );
    comprobar(
      antes.lugares.find((l) => l.id === ids[0])?.lat === puntos[0].lat,
      `${idioma}: el lugar NO se movió sin aprobación`,
    );

    // ─── Panel (ayuda interna, privada)
    const p = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1180, height: 1100 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await p.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await p.addCookies([
      { name: 'tumbite_sesion', value: admin, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await p.newPage();
    const privada = async (nombre, objeto) => {
      const png = join(ORIGINALES_PRIVADAS, `medir-lugares-${nombre}-${idioma}.png`);
      await objeto.screenshot({ path: png });
      webp(png, join(CAPTURAS_PRIVADAS, `medir-lugares-${nombre}-${idioma}.webp`));
      console.log(`captura: medir-lugares-${nombre}-${idioma}`);
    };
    await s.goto(`/panel/${ruta}/rides`);
    const tarjeta = s.getByTestId('mediciones-lugares');
    await tarjeta.waitFor({ timeout: 60_000 });
    await tarjeta.scrollIntoViewIfNeeded();
    await s.getByTestId('medicion-ciudad').selectOption(T.zona.id);
    const pendiente = s.getByTestId('medicion-pendiente').first();
    await pendiente.waitFor({ timeout: 30_000 });
    comprobar(
      (await pendiente.innerText()).includes(T.lugares[0]),
      `${idioma}: el panel muestra la medición nueva de «${T.lugares[0]}»`,
    );
    await s.getByTestId('medicion-mapa-libre').first().waitFor();
    await espera(3000); // los cuadros del mapa
    await pendiente.scrollIntoViewIfNeeded();
    await privada('pendiente', pendiente);
    // Aprobar desde el panel mueve el lugar.
    s.once('dialog', (x) => void x.accept());
    await pendiente.getByTestId('medicion-aprobar').click();
    await s.getByRole('status').waitFor();
    const r = await pedir(
      'GET',
      `/datos/admin/lugares-propios?zona=${T.zona.id}`,
      undefined,
      admin,
    );
    const movido = r.lugares.find((l) => l.id === ids[0]);
    comprobar(
      Math.abs(movido.lat - destino.lat) < 1e-6,
      `${idioma}: al aprobar, el lugar quedó en el punto medido`,
    );
    // Las tareas y el formulario de tarea nueva, con un lugar y el nombre escritos.
    await s
      .getByTestId('medicion-titulo')
      .fill(idioma === 'es' ? 'Puntos del centro' : 'Downtown points');
    await s.getByTestId('medicion-lugares').getByText(T.lugares[1]).click();
    await espera(800);
    await privada('tareas', tarjeta);
    await p.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('«Estoy aquí» comprobado en pantalla; capturas públicas y privadas listas');
