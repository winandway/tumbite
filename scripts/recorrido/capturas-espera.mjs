// Capturas REALES de la espera «Buscando tu conductor» por servicio para Docs (C-ESPERA-VEHICULO,
// fase cero, 16 nov 2026) — todos los países. Contra el servidor LOCAL del recorrido (.recorrido,
// armado con scripts/recorrido/preparar.mjs), con la app web real del pasajero. NO toca el sitio de
// pruebas ni las cuentas demo de Novi.
//
// Por idioma (C-CAPTURAS-POR-IDIOMA): español en El Vigía (Venezuela) e inglés en Novi, Michigan.
// En cada uno, las cuatro esperas: carro con pasajero, moto con pasajero, envío en moto (paquete
// pequeño) y envío en carro (paquete grande). Sin conductores conectados, el viaje se queda buscando;
// después de la foto se cancela (gratis mientras busca).
// Guarda las originales en docs/capturas/recorrido/espera-<vehículo>-<idioma>.png; `npm run
// recorrido:docs` las pasa a apps/panel/public/docs/recorrido-espera-*.webp.
// Uso: node scripts/recorrido/capturas-espera.mjs   (SOLO_IDIOMA=es|en para un solo idioma)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const ID = Date.now().toString(36);

const LUGARES = {
  es: {
    pais: 'VE',
    ciudad: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      lat: 8.6219,
      lng: -71.6506,
      radioKm: 15,
      zonaHoraria: 'America/Caracas',
    },
    origen: { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' },
    destino: { lat: 8.6195, lng: -71.6585, direccion: 'Terminal de pasajeros de El Vigía' },
    tarifa: { base: 100, porKm: 50, porMinuto: 10, minimo: 200, valorMaximo: 20_000 },
    cliente: 'Pasajero de prueba',
    destinatario: 'Destinatario de prueba',
    telefono: '0414-5550134',
    paquete: { pequeno: 'Llaves de la casa', grande: 'Caja con libros' },
  },
  en: {
    pais: 'US',
    ciudad: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      lat: 42.4806,
      lng: -83.4755,
      radioKm: 25,
      zonaHoraria: 'America/Detroit',
    },
    origen: { lat: 42.4915, lng: -83.4706, direccion: 'Twelve Oaks Mall, Novi, MI' },
    destino: { lat: 42.4712, lng: -83.4745, direccion: 'Novi Civic Center, 45175 W 10 Mile Rd' },
    tarifa: { base: 300, porKm: 110, porMinuto: 20, minimo: 800, valorMaximo: 50_000 },
    cliente: 'Jamie Lee',
    destinatario: 'Alex Morgan',
    telefono: '(248) 555-0134',
    paquete: { pequeno: 'House keys', grande: 'Box of books' },
  },
};

/** Las cuatro esperas: el servicio pedido y, en envíos, el tamaño que decide moto o carro. */
const ESPERAS = [
  { nombre: 'carro', servicio: 'carro' },
  { nombre: 'moto-pasajero', servicio: 'moto' },
  { nombre: 'moto-envio', servicio: 'envios', tamano: 'pequeno' },
  { nombre: 'carro-envio', servicio: 'envios', tamano: 'grande' },
];

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      // Servidor local: cada llamada desde otra dirección, para no chocar con el límite de intentos.
      'cf-connecting-ip': `10.83.${100 + (Math.floor(++ip / 250) % 100)}.${ip % 250}`,
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
let cuentas = 0;
const cuenta = async (rol, nombre) => {
  const correo = `espera.${rol}.${ID}.${++cuentas}@recorrido.test`;
  const r = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: DATOS.clave,
    rol: rol === 'admin' ? 'cliente' : rol,
  });
  await sql(
    `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
  );
  return { token: r.token, id: r.usuario.id };
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const clave = () => `capturas-espera-${Date.now().toString(36)}-${++ip}`;

const admin = await cuenta('admin', 'Soporte Espera');
await sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);

/** Carro, Moto y Envíos encendidos en la ciudad con su tarifa (solo en este servidor local). */
async function abrirCiudad(M) {
  const c = M.ciudad;
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${c.id}', '${c.nombre}', '${M.pais}', 'USD', '${c.zonaHoraria}', ${c.lat}, ${c.lng}, ${c.radioKm}, 1)`,
  );
  for (const servicio of ['carro', 'moto', 'envios']) {
    await sql(
      `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('${servicio}', 1)`,
    );
    await sql(`UPDATE servicios SET estado = 'disponible' WHERE id = '${servicio}'`);
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('${servicio}', '${c.id}', 'disponible')
       ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await pedir(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio,
        zona: c.id,
        tarifa: M.tarifa,
        dePrueba: false,
        motivo: 'Tarifa de las capturas de la espera (servidor local)',
      },
      admin.token,
    );
  }
  await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${c.id}' AND activa = 1`);
  // Sin conductores conectados: el viaje se queda buscando para la foto.
  await sql(`UPDATE repartidores SET conectado = 0 WHERE zona_id = '${c.id}'`).catch(() => null);
  if (M.pais === 'VE')
    await pedir('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 240 }, admin.token);
}

const navegador = await chromium.launch();
const idiomas = process.env.SOLO_IDIOMA ? [process.env.SOLO_IDIOMA] : ['es', 'en'];
for (const idioma of idiomas) {
  const M = idioma === 'en' ? LUGARES.en : LUGARES.es;
  await abrirCiudad(M);
  const cli = await cuenta('cliente', M.cliente);
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
    timezoneId: M.ciudad.zonaHoraria,
    geolocation: { latitude: M.origen.lat, longitude: M.origen.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [cli.token, cli.id, idioma],
  );
  for (const e of ESPERAS) {
    const { cotizacion } = await pedir(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: e.servicio,
        categoria: 'estandar',
        origen: M.origen,
        destino: M.destino,
      },
      cli.token,
    );
    const { viaje } = await pedir(
      'POST',
      '/datos/viajes',
      {
        cotizacionId: cotizacion.id,
        metodoPago: 'efectivo',
        ...(e.servicio === 'envios'
          ? {
              paquete: {
                descripcion: e.tamano === 'grande' ? M.paquete.grande : M.paquete.pequeno,
                tamano: e.tamano,
                valorDeclarado: 1500,
                destinatario: { nombre: M.destinatario, telefono: M.telefono },
                sinProhibidos: true,
              },
            }
          : {}),
      },
      cli.token,
      { 'idempotency-key': clave() },
    );
    const p = await ctx.newPage();
    await p.goto(`/app/ride?servicio=${e.servicio}`);
    await p.getByTestId(`buscando-vehiculo-${e.nombre}`).waitFor({ timeout: 60_000 });
    await espera(1_200);
    await p.screenshot({ path: join(SALIDA, `espera-${e.nombre}-${idioma}.png`) });
    console.log(`espera: ${e.nombre} (${idioma}) lista`);
    await p.close();
    await pedir('POST', `/datos/viajes/${viaje.id}/cancelar`, {}, cli.token, {
      'idempotency-key': clave(),
    });
  }
  await ctx.close();
}
await navegador.close();
// Moto y Carro de pasajeros vuelven a quedar como estaban (el canario de este servidor local exige
// que no estén encendidos sin país abierto, y los demás guiones los abren cuando los necesitan).
await sql(`UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro')`);
await sql(
  `UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro')`,
);
