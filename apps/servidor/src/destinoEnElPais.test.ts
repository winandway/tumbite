import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { olvidarPaisesDePuntos } from './destinoEnElPais';

/**
 * C-DESTINO-EN-EL-PAIS (25 nov 2026, Richard en la prueba real de Tucaní a Caja Seca) — todos los
 * países, Moto, Carro y Envíos. La recogida en una ciudad abierta; el destino y las paradas, en
 * cualquier punto del mismo país. Google (búsqueda cercana) se simula: nunca se llama de verdad.
 */
const LLAVE = 'llave-de-prueba-de-google-places-0001';
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const OTRA_CIUDAD_MISMO_PAIS = { lat: 28.54, lng: -81.38, direccion: 'Otra ciudad del país' };
const OTRO_PAIS = { lat: 4.65, lng: -74.05, direccion: 'Otro país' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

let paises: Record<string, string> = {};
let googleCaido = false;
let consultas = 0;

beforeEach(() => {
  olvidarPaisesDePuntos();
  paises = { '28.54,-81.38': 'US', '4.65,-74.05': 'CO' };
  googleCaido = false;
  consultas = 0;
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url instanceof Request ? url.url : url);
    if (!u.includes('places:searchNearby')) return new Response('no', { status: 500 });
    consultas++;
    if (googleCaido) return new Response('caído', { status: 503 });
    const c = (
      JSON.parse(String(init?.body)) as {
        locationRestriction: { circle: { center: { latitude: number; longitude: number } } };
      }
    ).locationRestriction.circle.center;
    const pais = paises[`${c.latitude.toFixed(2)},${c.longitude.toFixed(2)}`];
    return Response.json(
      pais
        ? {
            places: [{ addressComponents: [{ shortText: pais, types: ['country', 'political'] }] }],
          }
        : {},
    );
  });
});
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  const m = mundo({ GOOGLE_PLACES_KEY: LLAVE }, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  for (const servicio of ['moto', 'envios']) {
    await m.llamar(
      'PUT',
      `/datos/admin/servicios/${servicio}`,
      { estado: 'disponible' },
      admin.token,
    );
    await m.llamar(
      'PUT',
      `/datos/admin/servicios/${servicio}/zonas/${ZONA}`,
      { estado: 'disponible' },
      admin.token,
    );
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      { servicio, zona: ZONA, tarifa: TARIFA, motivo: 'Tarifa de prueba' },
      admin.token,
    );
  }
  const cotizar = (cuerpo: object) =>
    m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, ...cuerpo },
      cliente.token,
    );
  return { m, cotizar };
}

describe('C-DESTINO-EN-EL-PAIS · el destino puede salir de la ciudad, no del país', () => {
  it('destino en otra ciudad del mismo país: se puede pedir, con la tarifa por km y minuto', async () => {
    const { cotizar } = await escenario();
    const r = await cotizar({ destino: OTRA_CIUDAD_MISMO_PAIS });
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    expect(r.datos.cotizacion.distanciaM ?? r.datos.cotizacion.distancia_m ?? 1).toBeGreaterThan(0);
    const envio = await cotizar({ servicio: 'envios', destino: OTRA_CIUDAD_MISMO_PAIS });
    expect(envio.estado, JSON.stringify(envio.datos)).toBe(201);
  });

  it('destino en otro país: no se puede pedir, con el mensaje claro', async () => {
    const { cotizar } = await escenario();
    const r = await cotizar({ destino: OTRO_PAIS });
    expect(r.estado).toBe(422);
    expect(r.datos.error).toMatch(/mismo país|same country/);
  });

  it('una parada en otro país tampoco; en el mismo país, sí', async () => {
    const { cotizar } = await escenario();
    const destino = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
    expect((await cotizar({ destino, paradas: [OTRO_PAIS] })).estado).toBe(422);
    const ok = await cotizar({ destino, paradas: [OTRA_CIUDAD_MISMO_PAIS] });
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(201);
  });

  it('dentro de la ciudad no se le pregunta nada a Google, y lo ya preguntado se recuerda', async () => {
    const { cotizar } = await escenario();
    expect(
      (await cotizar({ destino: { lat: 25.79, lng: -80.13, direccion: 'Cerca' } })).estado,
    ).toBe(201);
    expect(consultas).toBe(0);
    await cotizar({ destino: OTRA_CIUDAD_MISMO_PAIS });
    await cotizar({ destino: OTRA_CIUDAD_MISMO_PAIS });
    expect(consultas).toBe(1);
  });

  it('si Google no responde, no deja pasar (podría ser otro país) y queda en el registro de errores', async () => {
    const { m, cotizar } = await escenario();
    googleCaido = true;
    const r = await cotizar({ destino: OTRA_CIUDAD_MISMO_PAIS });
    expect(r.estado).toBe(503);
    const e = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM errores_servidor WHERE mensaje LIKE 'destino-en-el-pais%'",
    ).first<{ n: number }>();
    expect(e?.n).toBe(1);
  });

  it('el tope de km es alto por defecto y cada ciudad lo puede bajar en su tarifa', async () => {
    const { m, cotizar } = await escenario();
    const admin = await m.cuenta('admin', 'Soporte Tarifas');
    const r = await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA,
        tarifa: { ...TARIFA, kmMaximo: 100 },
        motivo: 'Tope de la ciudad',
      },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const lejos = await cotizar({ destino: OTRA_CIUDAD_MISMO_PAIS });
    expect(lejos.estado).toBe(422);
    expect(lejos.datos.error).toMatch(/demasiado lejos|too far/);
  });

  it('el panel deja escribir el tope de km de cada ciudad (es/en) y lo manda en la tarifa', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const panel = readFileSync(
      join(import.meta.dirname, '..', '..', 'panel', 'src', 'panel', 'SuperViajes.tsx'),
      'utf8',
    );
    expect(panel).toContain('data-testid="tarifa-km-maximo"');
    expect(panel).toContain('tarifa.kmMaximo = Math.round(veces(v.kmMaximo))');
    expect(panel).toMatch(/kmMaximo:\s*'Distancia máxima/);
    expect(panel).toMatch(/kmMaximo:\s*'Maximum trip distance/);
  });

  it('el servidor ya no manda el error viejo «fuera de la ciudad del viaje»', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const f of ['rutas/viajesPasajero.ts', 'rutas/viajesFijos.ts'])
      expect(readFileSync(join(import.meta.dirname, f), 'utf8')).not.toContain(
        'fuera de la ciudad del viaje',
      );
  });
});
