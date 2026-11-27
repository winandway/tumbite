// C-LUGARES-PROPIOS (27 nov 2026) — todos los países. Comprueba EN PANTALLA, contra un servidor LOCAL
// propio, que en «Viajes · Emergencias y tarifas» la tarjeta «Lugares propios de tu ciudad» lista los
// lugares de la ciudad elegida y ofrece el formulario de lugar nuevo, y toma las capturas de la ayuda
// interna. NO toca el sitio de pruebas ni producción. Datos neutros.
//   lugares-propios-lista-<es|en>      → la tarjeta con la ciudad, el buscador y la lista de lugares
//   lugares-propios-formulario-<es|en> → el formulario de lugar nuevo (nombres, mapa, precio atado)
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// En español: El Vigía (su tabulador y sus 83 lugares los siembra el servidor solo). En inglés: Novi,
// Michigan, con precios y lugares creados aquí por la API del panel (C-CAPTURAS-POR-IDIOMA).
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_LUGARES=8798 node scripts/recorrido/capturas-lugares-propios.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
// Otro puerto que el del recorrido (8790) y el de municipios (8797), por si otra sesión los usa.
const PUERTO = process.env.PUERTO_LUGARES ?? '8798';
const DIR = join(RAIZ, '.recorrido');
execSync('node scripts/recorrido/preparar.mjs', {
  cwd: RAIZ,
  stdio: 'inherit',
  env: { ...process.env, SOLO_SERVIDOR: '1', PUERTO_RECORRIDO: PUERTO },
});
cpSync(join(RAIZ, 'apps/panel/dist'), join(DIR, 'sitio'), { recursive: true });
const DATOS = JSON.parse(readFileSync(join(DIR, 'datos.json'), 'utf8'));
const URL = DATOS.url;
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });

let servidor;
const encender = () => {
  servidor = spawn(
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
};
const apagar = () => {
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
};
encender();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.87.0.${++ip % 250}`,
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
    'x-reloj-secreto': DATOS.relojSecreto,
  });
const comprobar = (ok, que) => {
  if (!ok) throw new Error(`NO: ${que}`);
  console.log(`ok: ${que}`);
};

const L = {
  es: {
    locale: 'es-US',
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      lat: 8.6159,
      lng: -71.6442,
      tz: 'America/Caracas',
    },
    // El tabulador y los 83 lugares de El Vigía los siembra el servidor al abrir Moto en la zona.
    buscar: 'kilómetro 1',
    esperados: ['KM 12', 'KM 15'],
    ajenos: [],
    nuevo: { nombre: 'Plaza de Armas', otros: 'la plaza, plaza central' },
  },
  en: {
    locale: 'en-US',
    zona: { id: 'US-MI-NOVI', nombre: 'Novi', lat: 42.4806, lng: -83.4755, tz: 'America/Detroit' },
    tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 700 },
    rutas: [
      { nombre: 'Twelve Oaks Mall', lat: 42.4989, lng: -83.4698, precio: 1200, grupo: 'Shopping' },
      { nombre: 'Novi Civic Center', lat: 42.4825, lng: -83.4752, precio: 900, grupo: 'City' },
    ],
    lugares: [
      { nombre: 'Twelve Oaks Mall', otros: ['12 Oaks', 'Twelve Oaks'], ruta: 0 },
      { nombre: 'Novi Civic Center', otros: ['City Hall', 'Civic Center'], ruta: 1 },
      { nombre: 'Lakeshore Park', otros: ['Lake Park'], ruta: null, lat: 42.4768, lng: -83.4931 },
    ],
    buscar: 'oaks',
    esperados: ['Twelve Oaks Mall'],
    ajenos: ['KM 9', 'Vigía', 'Bs'],
    nuevo: { nombre: 'Novi Public Library', otros: 'the library, Library' },
  },
};

let navegador;
try {
  const esperarServidor = async () => {
    for (let i = 0; ; i++) {
      // La salud puede decir «ok: false» por piezas de pago sin configurar aquí: basta con que responda.
      const ok = await fetch(`${URL}/datos/salud`)
        .then(() => true)
        .catch(() => false);
      if (ok) break;
      if (i > 90) throw new Error('el servidor local no encendió');
      await espera(2000);
    }
  };
  await esperarServidor();
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
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  navegador = await chromium.launch();

  // Moto abierto en cada ciudad. El Vigía: el paso del panel (la compuerta del país se abre solo en este
  // servidor local). Novi: en Estados Unidos el paso del panel no abre el país, así que la ciudad se arma
  // directo en esta base local, como hacen los guiones de Carro y Envíos.
  const V = L.es.zona;
  const abrirVigia = () =>
    pedir(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'moto',
        zona: {
          id: V.id,
          nombre: V.nombre,
          lat: V.lat,
          lng: V.lng,
          radioKm: 12,
          zonaHoraria: V.tz,
        },
        motivo: 'Capturas de la ayuda interna (servidor local)',
      },
      token,
    );
  await abrirVigia().catch(async () => {
    await pedir(
      'PUT',
      '/datos/admin/pasajeros-pais/VE/moto',
      { clave: DATOS.clave, abierto: true, solicitudMarca: 'LOCAL-0000', confirmo: true },
      token,
    );
    await abrirVigia();
  });
  const NZ = L.en.zona;
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${NZ.id}', '${NZ.nombre}', 'US', 'USD', '${NZ.tz}', ${NZ.lat}, ${NZ.lng}, 12, 1)`,
  );
  await sql("UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'");
  await sql(
    `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${NZ.id}', 'disponible')
     ON CONFLICT DO UPDATE SET estado = 'disponible'`,
  );
  // C-TABULADOR-VIGIA / C-LUGARES-PROPIOS: la semilla de El Vigía corre al ARRANCAR el servidor cuando su
  // zona ya existe. Aquí la zona se acaba de crear: se reinicia el servidor (la base local se conserva)
  // para que siembre el tabulador y los 83 lugares, como pasa en el sitio de pruebas al publicar.
  apagar();
  await espera(3000);
  encender();
  await esperarServidor();
  for (let i = 0; i < 30; i++) {
    const r = await pedir(
      'GET',
      `/datos/admin/lugares-propios?zona=${V.id}`,
      undefined,
      token,
    ).catch(() => null);
    if (r?.lugares?.length) break;
    await espera(2000);
  }
  // Novi: sus precios de zona y sus lugares propios, con nombres de allá.
  const N = L.en;
  await pedir(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'moto',
      zona: N.zona.id,
      tarifa: N.tarifa,
      dePrueba: false,
      motivo: 'Capturas de la ayuda interna',
    },
    token,
  ).catch((x) => console.log(`tarifa: ${x.message}`));
  const idsRuta = [];
  for (const r of N.rutas) {
    const d = await pedir(
      'POST',
      '/datos/admin/viajes/precios-zona',
      {
        zona: N.zona.id,
        servicio: 'moto',
        desde: null,
        hasta: { lat: r.lat, lng: r.lng, radioKm: 1, nombre: r.nombre },
        precio: r.precio,
        precioIdaVuelta: Math.round(r.precio * 1.8),
        grupo: r.grupo,
      },
      token,
    );
    idsRuta.push(d.ruta.id);
  }
  for (const l of N.lugares) {
    const ref = l.ruta === null ? null : N.rutas[l.ruta];
    await pedir(
      'POST',
      '/datos/admin/lugares-propios',
      {
        zona: N.zona.id,
        nombre: l.nombre,
        otrosNombres: l.otros,
        lat: ref ? ref.lat : l.lat,
        lng: ref ? ref.lng : l.lng,
        rutaId: ref ? idsRuta[l.ruta] : null,
      },
      token,
    );
  }

  for (const z of [L.es.zona.id, L.en.zona.id]) {
    const r = await pedir('GET', `/datos/admin/lugares-propios?zona=${z}`, undefined, token);
    console.log(`lugares de ${z}: ${r.lugares.length}`);
  }
  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1180, height: 1000 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    const privada = async (nombre, objeto) => {
      const png = join(ORIGINALES_PRIVADAS, `lugares-propios-${nombre}-${idioma}.png`);
      await (objeto ?? s).screenshot({ path: png });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `lugares-propios-${nombre}-${idioma}.webp`),
      ]);
      console.log(`captura: lugares-propios-${nombre}-${idioma}`);
    };

    await s.goto(`/panel/${ruta}/rides`);
    const tarjeta = s.getByTestId('lugares-propios');
    await tarjeta.waitFor({ timeout: 60_000 });
    await tarjeta.scrollIntoViewIfNeeded();
    await s.getByTestId('lugar-propio-ciudad').selectOption(T.zona.id);
    await s.getByTestId('lugar-propio-linea').first().waitFor({ timeout: 30_000 });

    // 1. La lista: con el buscador puesto, solo los lugares que coinciden (con otros nombres y precio).
    await s.getByTestId('lugar-propio-buscar').fill(T.buscar);
    await espera(600);
    const textoLista = await s.getByTestId('lugar-propio-linea').allInnerTexts();
    for (const esperado of T.esperados)
      comprobar(
        textoLista.some((x) => x.includes(esperado)),
        `${idioma}: la lista muestra «${esperado}»`,
      );
    // Solo lo que se ve en la foto: las líneas de la lista (el desplegable de ciudades trae todas).
    const cuerpo = textoLista.join('\n');
    for (const ajeno of T.ajenos)
      comprobar(!cuerpo.includes(ajeno), `${idioma}: no sale «${ajeno}» en esta ciudad`);
    if (idioma === 'en') {
      // En Novi se ve la lista entera antes de buscar (tres lugares) para que la foto la muestre completa.
      await s.getByTestId('lugar-propio-buscar').fill('');
      await espera(500);
      comprobar(
        (await s.getByTestId('lugar-propio-linea').count()) === 3,
        'en: Novi lista sus tres lugares propios',
      );
    } else {
      // El Vigía tiene 83: se deja el buscador en «kilómetro 1» y la foto muestra la búsqueda.
      comprobar(
        (await s.getByTestId('lugar-propio-linea').count()) >= 1,
        'es: el buscador de la tarjeta encuentra «kilómetro 1»',
      );
    }
    // La tarjeta baja hasta debajo de la barra fija de arriba, para que su título se vea en la foto.
    await tarjeta.evaluate((el) =>
      el.ownerDocument.defaultView.scrollBy(0, el.getBoundingClientRect().top - 90),
    );
    await espera(500);
    const caja = await tarjeta.boundingBox();
    const lineas = await s.getByTestId('lugar-propio-linea').count();
    const ultima = await s
      .getByTestId('lugar-propio-linea')
      .nth(lineas - 1)
      .boundingBox();
    const abajo = (ultima?.y ?? 0) + (ultima?.height ?? 0) + 16;
    await privada('lista', {
      screenshot: (o) =>
        s.screenshot({
          ...o,
          clip: {
            x: Math.max(0, (caja?.x ?? 0) - 12),
            y: Math.max(0, (caja?.y ?? 0) - 12),
            width: (caja?.width ?? 1000) + 24,
            height: abajo - (caja?.y ?? 0) + 12,
          },
        }),
    });

    // 2. El formulario de lugar nuevo, con nombres escritos, el mapa y el selector de precio.
    await s.getByTestId('lugar-propio-buscar').fill('');
    await s.getByTestId('lugar-propio-nombre').fill(T.nuevo.nombre);
    await s.getByTestId('lugar-propio-otros').fill(T.nuevo.otros);
    const form = s.locator('[data-testid="lugares-propios"] form');
    await form.scrollIntoViewIfNeeded();
    await espera(2_500); // el mapa carga sus piezas
    const opciones = await s
      .getByTestId('lugar-propio-ruta')
      .locator('option')
      .evaluateAll((os) => os.map((o) => o.textContent ?? ''));
    comprobar(opciones.length > 1, `${idioma}: el selector de precio trae las rutas de la ciudad`);
    if (idioma === 'en')
      comprobar(
        opciones.some((x) => x.includes('Twelve Oaks Mall')) &&
          !opciones.some((x) => x.includes('Vigía')),
        'en: el selector de precio trae solo las rutas de Novi',
      );
    await privada('formulario', form);
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('lugares propios comprobados en pantalla; capturas en la carpeta privada');
