// C-ESTOY-AQUI (27 nov 2026; C-ESTOY-AQUI-300, C-TRES-FOTOS y C-FOTOS-PUBLICAS el mismo día) — todas
// las ciudades. Prueba EN PANTALLA, contra un servidor LOCAL propio, el recorrido completo de «Estoy
// aquí» y toma las capturas:
//   Driver (Docs públicos, apps/panel/public/docs): puntos-por-medir-lista, estoy-aqui-lejos (a ~420 m:
//     botón gris «Acércate al punto (faltan …)»), estoy-aqui-esperar (a ~100 m con 40 m de precisión:
//     botón gris «Esperando precisión»), estoy-aqui-listo (6 m), estoy-aqui-fotos (las tres fotos, a
//     mitad), estoy-aqui-enviada (-es y -en).
//   App de clientes (Docs públicos, guía de Moto): recorrido-moto-{ve,us}-lugar-fotos-v2 (un viaje
//     en curso cuyo destino es un lugar medido con sus fotos aprobadas: «Así se ve el lugar»).
//   Panel (ayuda interna, carpeta privada): medir-lugares-pendiente (con sus tres fotos),
//     medir-lugares-fotos («Así se ve el lugar» con «Quitar de las apps») y medir-lugares-tareas.
// Lugares NEUTROS de ejemplo, sin ciudad en pantalla; las fotos son dibujos sin personas ni placas
// (e2e/recorrido/fotos/lugar-*.jpg, de scripts/recorrido/fotos-lugar-dibujos.mjs) (C-DOCS-SIN-DATOS-REALES).
// Cada paso lleva su comprobación: lejos el botón está gris y dice cuánto falta; con 40 m de precisión
// NO aparece «Estoy aquí»; con 6 m sí; sin las tres fotos no hay «enviada» ni se puede aprobar; las
// fotos llevan el GPS (por eso el contexto tiene geolocalización); la medición queda pendiente y el
// lugar NO se mueve hasta aprobarla; al aprobar, sus fotos pasan a las apps y «Quitar de las apps» las
// saca; un conductor sin asignar no ve la tarea.
// NO toca el sitio de pruebas ni producción.
// Antes: npm run build -w @tumbite/panel && URL_API=http://localhost:8799 npm run build:repartidor-web
//        && URL_API=http://localhost:8799 npm run build:app-web
// Uso: node scripts/recorrido/capturas-estoy-aqui.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
cpSync(join(RAIZ, 'apps/cliente/dist-web'), join(DIR, 'sitio', 'app'), { recursive: true });
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
// C-TRES-FOTOS: las tres fotos de ejemplo (dibujos neutros) y su subida por la API, con el GPS y la
// hora en cabeceras, como las manda Driver.
const FOTOS = join(RAIZ, 'e2e', 'recorrido', 'fotos');
const TIPOS = ['entrada', 'letrero', 'calle'];
const fotoDe = (tipo) => join(FOTOS, `lugar-${tipo}.jpg`);
async function subirTresFotos(token, medicionId, punto) {
  let faltan;
  for (const tipo of TIPOS) {
    const r = await fetch(
      `${URL}/datos/conductor/mediciones/medicion/${medicionId}/fotos/${tipo}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'image/jpeg',
          'cf-connecting-ip': `10.88.1.${++ip % 250}`,
          'x-foto-lat': String(punto.lat),
          'x-foto-lng': String(punto.lng),
          'x-foto-precision': '5',
          'x-foto-hora': String(Date.now()),
        },
        body: readFileSync(fotoDe(tipo)),
      },
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`foto ${tipo}: ${r.status} ${d.error ?? ''}`);
    faltan = d.faltan;
  }
  return faltan;
}

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

// «Así se ve el lugar» en la app de clientes: una ciudad NEUTRA de ejemplo (como las demás guías de
// viajes) con un lugar medido por idioma, a más de 1 km uno del otro.
const ZONA_EJ = 'US-ZZ-EJEMPLO';
const CENTRO_EJ = { lat: 42.6006, lng: -84.1955 };
const EJEMPLO = {
  es: {
    ciudad: 'Ciudad de ejemplo',
    lugar: 'Plaza de Ejemplo',
    conductor: 'José Rojas',
    cliente: 'Laura Pérez',
    origen: { lat: 42.5922, lng: -84.198 },
    punto: { lat: 42.6052, lng: -84.1889 },
    direccionOrigen: 'Calle de Ejemplo 120',
    direccionDestino: 'Plaza de Ejemplo',
  },
  en: {
    ciudad: 'Example city',
    lugar: 'Example Plaza',
    conductor: 'Sam Carter',
    cliente: 'Jamie Lee',
    origen: { lat: 42.5922, lng: -84.198 },
    punto: { lat: 42.5925, lng: -84.1798 },
    direccionOrigen: '120 Example Street',
    direccionDestino: 'Example Plaza',
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
  navegador = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

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
    // Sin sus tres fotos no se aprueba (C-TRES-FOTOS).
    const sinFotos = await pedir(
      'POST',
      `/datos/admin/mediciones/medicion/${ya.medicion.id}/aprobar`,
      {},
      admin,
    ).then(
      () => 'aprobada',
      (x) => x.message,
    );
    comprobar(
      sinFotos.includes('409') && sinFotos.includes('Faltan fotos'),
      `${idioma}: sin las tres fotos el servidor no deja aprobar`,
    );
    const faltanYa = await subirTresFotos(token, ya.medicion.id, {
      lat: puntos[2].lat + 0.0003,
      lng: puntos[2].lng,
    });
    comprobar(faltanYa?.length === 0, `${idioma}: con las tres fotos ya no falta ninguna`);
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
    const lejos = { lat: puntos[0].lat + 0.00378, lng: puntos[0].lng }; // a ~420 m: fuera de los 300 m
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: T.locale,
      timezoneId: T.zona.tz,
      geolocation: { latitude: lejos.lat, longitude: lejos.lng, accuracy: 6 },
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
    // 1) A ~420 m: botón gris que dice cuánto falta (C-ESTOY-AQUI-300), aunque el GPS sea preciso.
    const gris = d.getByTestId('estoy-aqui-lejos');
    await gris.waitFor({ timeout: 30_000 }).catch(async (x) => {
      await d.screenshot({ path: join(DIR, `fallo-driver-${idioma}.png`) });
      throw x;
    });
    const textoGris = await gris.innerText();
    comprobar(
      textoGris.includes(idioma === 'es' ? 'faltan' : 'to go') && /\d/.test(textoGris),
      `${idioma}: a ~420 m el botón está gris y dice cuánto falta («${textoGris}»)`,
    );
    comprobar(
      (await d.getByTestId('estoy-aqui').count()) === 0,
      `${idioma}: a más de 300 m no hay «Estoy aquí»`,
    );
    await espera(2500); // el mapa carga sus piezas
    await foto('estoy-aqui-lejos');
    // 2) A ~100 m con 40 m de precisión: gris «Esperando precisión».
    await ctx.setGeolocation({ latitude: destino.lat, longitude: destino.lng, accuracy: 40 });
    await d.getByTestId('estoy-aqui-esperando').waitFor({ timeout: 30_000 });
    comprobar(
      (await d.getByTestId('estoy-aqui').count()) === 0,
      `${idioma}: con 40 m no aparece «Estoy aquí»`,
    );
    await espera(1500);
    await foto('estoy-aqui-esperar');
    // 3) Con 6 m: «Estoy aquí».
    await ctx.setGeolocation({ latitude: destino.lat, longitude: destino.lng, accuracy: 6 });
    await d.getByTestId('estoy-aqui').waitFor({ timeout: 30_000 });
    await foto('estoy-aqui-listo');
    await d.getByTestId('estoy-aqui').click();
    // 4) Las tres fotos, con la cámara (en la web, el selector de archivo).
    await d.getByTestId('tres-fotos').waitFor({ timeout: 30_000 });
    comprobar(
      (await d.getByTestId('medicion-enviada').count()) === 0,
      `${idioma}: sin las tres fotos la medición no sale como enviada`,
    );
    const tomar = idioma === 'es' ? 'Tomar foto' : 'Take photo';
    // Una foto lista cambia su botón a «Tomar otra».
    const lista = idioma === 'es' ? 'Tomar otra' : 'Retake';
    for (const [i, tipo] of TIPOS.entries()) {
      const filaFoto = d.getByTestId(`foto-${tipo}`);
      const [selector] = await Promise.all([
        d.waitForEvent('filechooser', { timeout: 30_000 }),
        filaFoto.getByText(tomar, { exact: true }).click(),
      ]);
      await selector.setFiles(fotoDe(tipo));
      if (i < TIPOS.length - 1) {
        await filaFoto.getByText(lista, { exact: true }).waitFor({ timeout: 30_000 });
        if (i === 0) {
          comprobar(
            (await d.getByTestId('foto-letrero').getByText(lista, { exact: true }).count()) === 0,
            `${idioma}: tras la primera foto, las otras dos siguen pendientes`,
          );
          await d.getByTestId('tres-fotos').scrollIntoViewIfNeeded();
          await foto('estoy-aqui-fotos');
        }
      }
    }
    await d
      .getByTestId('medicion-enviada')
      .waitFor({ timeout: 30_000 })
      .catch(async (x) => {
        await d.screenshot({ path: join(DIR, `fallo-driver-${idioma}.png`) });
        throw x;
      });
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
    const imagenes = async (donde) =>
      donde.locator('img').evaluateAll(
        (xs) =>
          // Solo las fotos del lugar (no los cuadros del mapa), y ya cargadas.
          xs.filter(
            (x) =>
              x.complete &&
              x.naturalWidth > 0 &&
              /mediciones\/fotos\/|lugares\/fotos\/|^blob:|^data:image/.test(x.src),
          ).length,
      );
    for (let i = 0; i < 20 && (await imagenes(pendiente)) < 3; i++) await espera(500);
    comprobar(
      (await imagenes(pendiente)) === 3 &&
        (await pendiente.getByTestId('medicion-faltan-fotos').count()) === 0 &&
        (await pendiente.getByTestId('medicion-aprobar').isEnabled()),
      `${idioma}: el panel muestra las tres fotos y deja aprobar`,
    );
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
    const asiSeVe = (punto) =>
      pedir('GET', `/datos/lugares/asi-se-ve?lat=${punto.lat}&lng=${punto.lng}`);
    comprobar(
      (await asiSeVe(destino)).fotos.length === 3,
      `${idioma}: al aprobar, sus tres fotos se ven en las apps («Así se ve el lugar»)`,
    );
    // «Así se ve el lugar (fotos en las apps)»: las de los dos lugares aprobados, cada una con su menú.
    await s.reload();
    await tarjeta.waitFor({ timeout: 60_000 });
    await s.getByTestId('medicion-ciudad').selectOption(T.zona.id);
    const publicas = s.getByTestId('foto-publica');
    await publicas.nth(5).waitFor({ timeout: 30_000 });
    comprobar(
      (await publicas.count()) === 6,
      `${idioma}: el panel lista las seis fotos públicas (dos lugares)`,
    );
    for (let i = 0; i < 20 && (await imagenes(publicas.first().locator('xpath=..'))) < 6; i++)
      await espera(500);
    const titulo = s.getByRole('heading', {
      name:
        idioma === 'es'
          ? 'Así se ve el lugar (fotos en las apps)'
          : 'What the place looks like (photos in the apps)',
    });
    const deYa = publicas.filter({ hasText: T.lugares[2] }).first();
    await deYa
      .getByRole('button', { name: idioma === 'es' ? 'Opciones de la tarea' : 'Task options' })
      .click();
    await s
      .getByRole('menuitem', {
        name: idioma === 'es' ? 'Quitar de las apps' : 'Remove from the apps',
      })
      .waitFor();
    await titulo.scrollIntoViewIfNeeded();
    await espera(600);
    {
      const a = await titulo.boundingBox();
      const b = await publicas.first().locator('xpath=..').boundingBox();
      const png = join(ORIGINALES_PRIVADAS, `medir-lugares-fotos-${idioma}.png`);
      await s.screenshot({
        path: png,
        clip: {
          x: b.x - 16,
          y: a.y - 12,
          width: Math.min(1100, b.width + 32),
          height: b.y + b.height - a.y + 140,
        },
      });
      webp(png, join(CAPTURAS_PRIVADAS, `medir-lugares-fotos-${idioma}.webp`));
      console.log(`captura: medir-lugares-fotos-${idioma}`);
    }
    // «Quitar de las apps» la saca de verdad.
    s.once('dialog', (x) => void x.accept());
    await s
      .getByRole('menuitem', {
        name: idioma === 'es' ? 'Quitar de las apps' : 'Remove from the apps',
      })
      .click();
    for (let i = 0; i < 20 && (await publicas.count()) !== 5; i++) await espera(500);
    comprobar(
      (await asiSeVe({ lat: puntos[2].lat + 0.0003, lng: puntos[2].lng })).fotos.length === 2,
      `${idioma}: «Quitar de las apps» deja de mostrar esa foto (quedan dos de «${T.lugares[2]}»)`,
    );
    // Las tareas y el formulario de tarea nueva, con un lugar y el nombre escritos.
    await s
      .getByTestId('medicion-titulo')
      .fill(idioma === 'es' ? 'Puntos del centro' : 'Downtown points');
    await s.getByTestId('medicion-lugares').getByText(T.lugares[1]).click();
    await espera(800);
    await privada('tareas', tarjeta);
    await p.close();

    // ─── App de clientes: «Así se ve el lugar» en un viaje cuyo destino es un lugar medido
    // Ciudad NEUTRA de ejemplo (sin nombre real en pantalla); un lugar por idioma, lejos uno del otro.
    const C = EJEMPLO[idioma];
    await sql(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('${ZONA_EJ}', '${C.ciudad}', 'US', 'USD', 'America/Detroit', ${CENTRO_EJ.lat}, ${CENTRO_EJ.lng}, 15, 1)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre`,
    );
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${ZONA_EJ}', 'disponible') ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await pedir(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA_EJ,
        tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
        motivo: 'Capturas de «Así se ve el lugar» (servidor local)',
      },
      admin,
    ).catch((x) => console.log(`tarifa ${ZONA_EJ}: ${x.message}`));
    await pedir(
      'PUT',
      '/datos/admin/viajes/ajustes',
      { zona: ZONA_EJ, servicio: 'moto', pin: 'nunca', selfieCasco: false },
      admin,
    );
    const m = await pedir('POST', '/datos/interno/diagnostico/moto/armar', {}, undefined, secreto);
    const moto = { id: m.ids.conductor, token: m.tokens.conductor };
    await sql(
      `UPDATE usuarios SET nombre = '${C.conductor}', idioma = '${idioma}' WHERE id = '${moto.id}'`,
    );
    // Su moto con datos de ejemplo (placa imposible, C-DOCS-SIN-DATOS-REALES).
    await sql(
      `UPDATE vehiculos SET marca = 'Moto', modelo = '150', color = '${idioma === 'es' ? 'Negra' : 'Black'}', placa = '${idioma === 'es' ? 'EJEMPLO01' : 'EJEMPLO02'}' WHERE conductor_id = '${moto.id}'`,
    );
    const ubicar = (donde) =>
      sql(
        `UPDATE repartidores SET conectado = 1, zona_id = '${ZONA_EJ}', lat = ${donde.lat}, lng = ${donde.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${moto.id}'`,
      );
    // El lugar, medido con sus tres fotos y aprobado (lo mismo que hizo el conductor arriba).
    const lugarEj = (
      await pedir(
        'POST',
        '/datos/admin/lugares-propios',
        { zona: ZONA_EJ, nombre: C.lugar, otrosNombres: [], ...C.punto, rutaId: null },
        admin,
      )
    ).lugar;
    const tareaEj = await pedir(
      'POST',
      '/datos/admin/mediciones',
      { zona: ZONA_EJ, titulo: C.lugar, nota: '', lugares: [lugarEj.id], conductores: [moto.id] },
      admin,
    );
    const medEj = await pedir(
      'POST',
      `/datos/conductor/mediciones/${tareaEj.tarea.id}/lugares/${lugarEj.id}`,
      { ...C.punto, precisionM: 5, tomadaEn: Date.now() },
      moto.token,
    );
    await subirTresFotos(moto.token, medEj.medicion.id, C.punto);
    await pedir('POST', `/datos/admin/mediciones/medicion/${medEj.medicion.id}/aprobar`, {}, admin);
    // Un pasajero pide un mototaxi hasta ese lugar y el conductor lo recoge.
    const reg2 = await pedir('POST', '/datos/cuentas/registro', {
      nombre: C.cliente,
      correo: `pasajero.${idioma}.${randomBytes(4).toString('hex')}@recorrido.test`,
      clave: DATOS.clave,
      rol: 'cliente',
      idioma,
    });
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now'), telefono_verificado_en = datetime('now'), fecha_nacimiento = '1990-03-15', idioma = '${idioma}' WHERE id = '${reg2.usuario.id}'`,
    );
    const cli = { token: reg2.token, id: reg2.usuario.id };
    // Ya eligió su ciudad («¿Dónde vives?» es la pantalla de entrada, no es de esta guía).
    await pedir(
      'PUT',
      '/datos/cuentas/lugar',
      {
        lugar: {
          pais: 'US',
          estado: 'MI',
          municipio: 'Oakland County',
          ciudad: 'Novi',
          lugarId: 'gn:5004005',
          ...C.origen,
        },
      },
      cli.token,
    );
    await ubicar(C.origen);
    const cot = (
      await pedir(
        'POST',
        '/datos/viajes/cotizar',
        {
          servicio: 'moto',
          origen: { ...C.origen, direccion: C.direccionOrigen },
          destino: { ...C.punto, direccion: C.direccionDestino },
        },
        cli.token,
      )
    ).cotizacion;
    const viajeId = (
      await pedir(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        cli.token,
      )
    ).viaje.id;
    const paso = (nombre) =>
      pedir('POST', `/datos/conductor/operaciones/${viajeId}/${nombre}`, {}, moto.token, {
        'idempotency-key': `asi-se-ve-${nombre}-${randomBytes(8).toString('hex')}`,
      });
    for (let i = 0; ; i++) {
      await ubicar(C.origen);
      await pedir('GET', '/datos/viajes/actual', undefined, cli.token);
      if (
        await paso('aceptar').then(
          () => true,
          () => false,
        )
      )
        break;
      if (i > 20) throw new Error('el conductor no pudo aceptar el viaje');
      await espera(1500);
    }
    await paso('llegue');
    await paso('iniciar');
    const cx = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
      timezoneId: 'America/Detroit',
      geolocation: { latitude: C.origen.lat, longitude: C.origen.lng },
      permissions: ['geolocation'],
    });
    await cx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [cli.token, cli.id, idioma],
    );
    const q = await cx.newPage();
    await q.goto('/app/ride');
    const asi = q.getByTestId('asi-se-ve-destino');
    await asi.waitFor({ timeout: 60_000 }).catch(async (x) => {
      await q.screenshot({ path: join(DIR, `fallo-cliente-${idioma}.png`) });
      throw x;
    });
    // Si igual sale una pantalla de entrada encima, se pasa como lo haría el pasajero.
    const ahoraNo = q.getByText(idioma === 'es' ? 'Ahora no' : 'Not now', { exact: true });
    if (await ahoraNo.isVisible().catch(() => false)) await ahoraNo.click();
    for (let i = 0; i < 20 && (await imagenes(asi)) < 3; i++) await espera(500);
    comprobar(
      await asi.isVisible(),
      `${idioma}: «Así se ve el lugar» está a la vista (nada lo tapa)`,
    );
    comprobar(
      (await asi.innerText()).includes(
        idioma === 'es' ? 'Así se ve el lugar' : 'What the place looks like',
      ) && (await imagenes(asi)) === 3,
      `${idioma}: el pasajero ve «Así se ve el lugar» con las tres fotos del destino`,
    );
    await asi.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await espera(900);
    {
      // Va en la guía de Moto: lleva su nombre de captura de Moto (C-DOCS-MOTO).
      const nombre = `recorrido-moto-${idioma === 'en' ? 'us' : 've'}-lugar-fotos-v2-${idioma}`;
      const png = join(ORIGINALES, `${nombre}.png`);
      await q.screenshot({ path: png });
      webp(png, join(PUBLICAS, `${nombre}.webp`));
      console.log(`captura: ${nombre}`);
    }
    await cx.close();
    await ubicar(C.punto);
    await paso('terminar').catch(() => null);
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('«Estoy aquí» comprobado en pantalla; capturas públicas y privadas listas');
