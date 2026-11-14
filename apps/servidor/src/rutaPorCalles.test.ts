import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { contarFilas, type CuentaFilas } from './presupuestoFilas';
import {
  TOPE_RUTAS_CALLES_DIA,
  URL_RUTAS,
  claveContadorRutas,
  reiniciarEstadoRutas,
} from './rutaPorCalles';

/**
 * C-RUTA-POR-CALLES (13 nov 2026, todos los países): la cotización de un viaje usa la distancia y
 * el tiempo REALES por calles de Google Routes (básico, sin tráfico) y, si no se puede, la fórmula
 * de siempre sin error para el pasajero. Google va SIMULADO: ninguna prueba le pega de verdad.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };
const LLAVE = 'llave-de-prueba-0123456789abcdef';

type Llamada = { url: string; cuerpo: Record<string, unknown>; cabeceras: Record<string, string> };
let llamadas: Llamada[] = [];
let respuesta: () => Promise<Response> = async () =>
  Response.json({ routes: [{ distanceMeters: 9_400, duration: '1260s' }] });

beforeEach(() => {
  llamadas = [];
  reiniciarEstadoRutas();
  respuesta = async () => Response.json({ routes: [{ distanceMeters: 9_400, duration: '1260s' }] });
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u !== URL_RUTAS) throw new Error(`fetch inesperado en la prueba: ${u}`);
    llamadas.push({
      url: u,
      cuerpo: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      cabeceras: Object.fromEntries(new Headers(init?.headers).entries()),
    });
    return respuesta();
  });
});
afterEach(() => vi.unstubAllGlobals());

async function escenario(extra: Record<string, unknown> = { GOOGLE_PLACES_KEY: LLAVE }) {
  let cuenta: CuentaFilas = { leidas: 0, escritas: 0 };
  const m = mundo(extra, {
    host: 'staging.tumbite.com',
    envolver: (db) => {
      const c = contarFilas(db);
      cuenta = c.cuenta;
      return c.db;
    },
  });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    admin.token,
  );
  const t = await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: ZONA, tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  expect(t.estado).toBe(201);
  const cotizar = (cuerpo: object = {}) =>
    m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO, ...cuerpo },
      cliente.token,
    );
  return { m, cliente, cotizar, filas: () => ({ ...cuenta }) };
}

describe('C-RUTA-POR-CALLES: distancia por calles en la cotización', () => {
  it('usa la distancia y el tiempo de Google cuando responde, y lo guarda en la cotización', async () => {
    const e = await escenario();
    const r = await e.cotizar();
    expect(r.estado).toBe(201);
    expect(r.datos.cotizacion.distanciaM).toBe(9_400);
    expect(r.datos.cotizacion.duracionS).toBe(1_260);
    expect(r.datos.cotizacion.fuenteDistancia).toBe('calles');
    // El precio sale de la distancia por calles: base + 9,4 km + 21 min, sobre el mínimo.
    expect(r.datos.cotizacion.desglose.distancia).toBe(Math.round(9.4 * 60));
    const f = await e.m.DB.prepare(
      'SELECT fuente_distancia, distancia_m FROM cotizaciones_viaje WHERE id = ?',
    )
      .bind(r.datos.cotizacion.id)
      .first<{ fuente_distancia: string; distancia_m: number }>();
    expect(f).toEqual({ fuente_distancia: 'calles', distancia_m: 9_400 });
  });

  it('pide a Google SOLO lo básico: sin tráfico, sin hora de salida y con la máscara mínima', async () => {
    const e = await escenario();
    await e.cotizar();
    expect(llamadas).toHaveLength(1);
    const l = llamadas[0]!;
    expect(l.cabeceras['x-goog-fieldmask']).toBe('routes.distanceMeters,routes.duration');
    expect(l.cabeceras['x-goog-api-key']).toBe(LLAVE);
    expect(l.cuerpo.travelMode).toBe('DRIVE');
    expect(l.cuerpo.routingPreference).toBe('TRAFFIC_UNAWARE');
    const texto = JSON.stringify(l.cuerpo);
    for (const prohibido of [
      'departureTime',
      'arrivalTime',
      'TRAFFIC_AWARE',
      'trafficModel',
      'extraComputations',
      'routeModifiers',
      'intermediates',
    ])
      expect(texto).not.toContain(prohibido);
  });

  it('GOOGLE_ROUTES_KEY manda sobre la llave de Places', async () => {
    const otra = 'llave-de-rutas-fedcba9876543210';
    const e = await escenario({ GOOGLE_PLACES_KEY: LLAVE, GOOGLE_ROUTES_KEY: otra });
    await e.cotizar();
    expect(llamadas[0]!.cabeceras['x-goog-api-key']).toBe(otra);
  });

  const caidas: [string, () => Promise<Response>][] = [
    ['403 (API no habilitada)', async () => new Response('{}', { status: 403 })],
    ['429 (sin cuota)', async () => new Response('{}', { status: 429 })],
    [
      'tiempo agotado',
      async () => {
        throw new DOMException('se acabó el tiempo', 'TimeoutError');
      },
    ],
    ['respuesta sin ruta', async () => Response.json({})],
  ];
  for (const [nombre, falla] of caidas)
    it(`cae a la fórmula sin error para el pasajero con ${nombre}`, async () => {
      const e = await escenario();
      respuesta = falla;
      const r = await e.cotizar();
      expect(r.estado).toBe(201);
      expect(r.datos.cotizacion.fuenteDistancia).toBe('estimada');
      expect(r.datos.cotizacion.distanciaM).not.toBe(9_400);
      expect(r.datos.cotizacion.distanciaM).toBeGreaterThan(0);
    });

  it('sin llave no llama a Google y usa la fórmula', async () => {
    const e = await escenario({});
    const r = await e.cotizar();
    expect(r.estado).toBe(201);
    expect(r.datos.cotizacion.fuenteDistancia).toBe('estimada');
    expect(llamadas).toHaveLength(0);
  });

  it('no vuelve a preguntar a Google en la recotización de la misma ruta (unos 50 m)', async () => {
    const e = await escenario();
    const a = await e.cotizar();
    // Recotiza moviendo el pin unos 20 m: misma ruta, misma distancia, sin otra consulta.
    const b = await e.cotizar({
      origen: { ...ORIGEN, lat: ORIGEN.lat + 0.0002 },
    });
    expect(b.estado).toBe(201);
    expect(b.datos.cotizacion.id).not.toBe(a.datos.cotizacion.id);
    expect(b.datos.cotizacion.distanciaM).toBe(9_400);
    expect(b.datos.cotizacion.fuenteDistancia).toBe('calles');
    expect(llamadas).toHaveLength(1);
    // Otro destino de verdad sí es otra consulta.
    await e.cotizar({ destino: { ...DESTINO, lat: DESTINO.lat + 0.01 } });
    expect(llamadas).toHaveLength(2);
  });

  it('el contador del día nunca pasa del tope y, alcanzado, se usa la fórmula', async () => {
    const e = await escenario({ GOOGLE_PLACES_KEY: LLAVE, TOPE_RUTAS_CALLES_DIA: '2' });
    for (let i = 0; i < 4; i++)
      expect(
        (await e.cotizar({ destino: { ...DESTINO, lat: DESTINO.lat + 0.01 * (i + 1) } })).estado,
      ).toBe(201);
    expect(llamadas).toHaveLength(2);
    const n = await e.m.DB.prepare('SELECT n FROM contadores WHERE clave = ?')
      .bind(claveContadorRutas())
      .first<{ n: number }>();
    expect(n?.n).toBe(2);
    const ultima = await e.cotizar({ destino: { ...DESTINO, lat: DESTINO.lat + 0.07 } });
    expect(ultima.datos.cotizacion.fuenteDistancia).toBe('estimada');
  });

  it('el tope por defecto es 320 consultas al día', () => {
    expect(TOPE_RUTAS_CALLES_DIA).toBe(320);
  });

  it('presupuesto: una cotización escribe la cotización y, con Google, una sola fila más (el contador)', async () => {
    const e = await escenario();
    const antes = e.filas();
    await e.cotizar();
    const conGoogle = e.filas().escritas - antes.escritas;
    const antes2 = e.filas();
    await e.cotizar({ origen: { ...ORIGEN, lat: ORIGEN.lat + 0.0002 } });
    const reutilizada = e.filas().escritas - antes2.escritas;
    const sin = await escenario({});
    const antes3 = sin.filas();
    await sin.cotizar();
    const sinGoogle = sin.filas().escritas - antes3.escritas;
    expect(conGoogle).toBe(sinGoogle + 1);
    expect(reutilizada).toBe(sinGoogle);
    expect(sinGoogle).toBeLessThanOrEqual(2);
  });

  it('el canario informa la pieza rutas y las consultas de hoy, sin escribir por mirar', async () => {
    const e = await escenario();
    let s = await e.m.llamar('GET', '/datos/salud');
    expect(s.datos.piezas.rutas).toBe('ok');
    expect(s.datos.rutas).toEqual({ consultasHoy: 0, tope: 320 });
    await e.cotizar();
    s = await e.m.llamar('GET', '/datos/salud');
    expect(s.datos.rutas.consultasHoy).toBe(1);
    respuesta = async () => new Response('{}', { status: 403 });
    await e.cotizar({ destino: { ...DESTINO, lat: DESTINO.lat + 0.01 } });
    s = await e.m.llamar('GET', '/datos/salud');
    expect(s.datos.piezas.rutas).toBe('estimada');
    const sin = await escenario({});
    expect((await sin.m.llamar('GET', '/datos/salud')).datos.piezas.rutas).toBe('estimada');
  });

  it('es mundial: Carro y Envíos abiertos desde el panel en Detroit cotizan por calles (una sola consulta)', async () => {
    const m = mundo({ GOOGLE_PLACES_KEY: LLAVE }, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cliente = await m.cuenta('cliente', 'Pasajero Michigan');
    const zona = {
      id: 'US-MI-DETROIT',
      nombre: 'Detroit',
      lat: 42.3314,
      lng: -83.0458,
      radioKm: 60,
      zonaHoraria: 'America/Detroit',
    };
    for (const servicio of ['carro', 'envios'])
      expect(
        (
          await m.llamar(
            'POST',
            '/datos/admin/viajes/ciudades',
            {
              servicio,
              zona,
              tarifa: { base: 250, porKm: 110, porMinuto: 30, minimo: 700, valorMaximo: 10_000 },
              motivo: 'Pruebas en Michigan',
            },
            admin.token,
          )
        ).estado,
      ).toBe(201);
    respuesta = async () =>
      Response.json({ routes: [{ distanceMeters: 46_930, duration: '1948s' }] });
    const novi = { lat: 42.4806, lng: -83.4755, direccion: 'Novi' };
    const detroit = { lat: 42.3314, lng: -83.0458, direccion: 'Detroit' };
    const carro = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: novi, destino: detroit },
      cliente.token,
    );
    expect(carro.estado).toBe(201);
    expect(carro.datos.cotizacion).toMatchObject({
      distanciaM: 46_930,
      duracionS: 1_948,
      fuenteDistancia: 'calles',
    });
    const envio = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'envios', origen: novi, destino: detroit },
      cliente.token,
    );
    expect(envio.datos.cotizacion).toMatchObject({ distanciaM: 46_930, fuenteDistancia: 'calles' });
    expect(llamadas).toHaveLength(1);
  });
});
