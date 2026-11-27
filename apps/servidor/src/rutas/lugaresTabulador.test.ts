import { afterEach, describe, expect, it, vi } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { sembrarTabuladorVigia } from '../semillaTabuladorVigia';
import { PREFIJO_TABULADOR } from './lugares';

/**
 * C-DESTINO-TABULADOR (26 nov 2026, robot de aceptación P2: en El Vigía «KM 9» traía lugares de
 * Colombia, República Dominicana y Bolivia) — toda ciudad con tabulador. Los destinos del tabulador de
 * la ciudad de la persona salen primero, con su punto de la base, y Google busca solo en su país y
 * cerca de ella. Es el servidor de la app de clientes y de la web (las dos usan esta ruta).
 */
const LLAVE = 'llave-de-prueba-de-google-places-123';
type Sug = { id: string; principal?: string; texto: string };

async function elVigia(extra: Record<string, unknown> = { GOOGLE_PLACES_KEY: LLAVE }) {
  const m = mundo(extra, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const r = await m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'El Vigía para Moto',
    },
    admin.token,
  );
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  expect(await sembrarTabuladorVigia(m.DB)).not.toBeNull();
  const pasajero = await m.cuenta('cliente', 'Luis Pasajero');
  await m.DB.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?')
    .bind(EVG.id, pasajero.id)
    .run();
  // Google contesta con lugares de otros países, como lo vio el robot.
  const cuerpos: Record<string, unknown>[] = [];
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    if (!String(url).includes('googleapis.com')) return original(url, init);
    cuerpos.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
    return Response.json({
      suggestions: [1, 2, 3, 4, 5, 6].map((n) => ({
        placePrediction: { placeId: `ChIJ_lejos_${n}0000`, text: { text: `Km 9, otro país ${n}` } },
      })),
    });
  });
  const buscar = (q: string, token?: string, extraQ = '') =>
    m.llamar(
      'GET',
      `/datos/lugares/sugerencias?q=${encodeURIComponent(q)}&sesion=sesion-prueba-1${extraQ}`,
      undefined,
      token,
      { 'cf-ipcountry': 'US', 'cf-iplatitude': '42.48', 'cf-iplongitude': '-83.47' },
    );
  const ruta = async (nombre: string) =>
    (await m.DB.prepare(
      'SELECT id, hasta_lat, hasta_lng FROM rutas_precio_zona WHERE zona_id = ? AND hasta_nombre = ? AND activa = 1 ORDER BY precio LIMIT 1',
    )
      .bind(EVG.id, nombre)
      .first<{ id: string; hasta_lat: number; hasta_lng: number }>())!;
  return { m, pasajero, cuerpos, buscar, ruta };
}

describe('C-DESTINO-TABULADOR: los destinos del tabulador de su ciudad primero, y solo su país', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el pasajero de El Vigía escribe «KM 9» sin ubicación: KM 9 del tabulador arriba, Google solo en Venezuela y cerca de El Vigía', async () => {
    const e = await elVigia();
    const r = await e.buscar('KM 9', e.pasajero.token);
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const s = r.datos.sugerencias as Sug[];
    expect(s[0]?.principal).toBe('KM 9');
    expect(s[0]?.id.startsWith(PREFIJO_TABULADOR)).toBe(true);
    expect(s.length).toBe(6);
    expect(e.cuerpos[0]).toMatchObject({
      includedRegionCodes: ['ve'],
      locationBias: { circle: { center: { latitude: EVG.lat, longitude: EVG.lng } } },
    });
    // Elegirlo trae el punto de la base, sin llamar a Google.
    const km9 = await e.ruta('KM 9');
    const antes = e.cuerpos.length;
    const p = await e.m.llamar('GET', `/datos/lugares/punto/${encodeURIComponent(s[0]!.id)}`);
    expect(p.datos).toEqual({
      punto: { lat: Number(km9.hasta_lat), lng: Number(km9.hasta_lng) },
      direccion: `KM 9, ${EVG.nombre}`,
    });
    expect(e.cuerpos.length).toBe(antes);
  });

  it('con la ubicación dentro de El Vigía (la web sin sesión) también; «kilómetro 9» es KM 9; y un punto «revisar» nunca sale', async () => {
    const e = await elVigia();
    const r = await e.buscar('kilómetro 9', undefined, `&lat=${EVG.lat}&lng=${EVG.lng}`);
    expect((r.datos.sugerencias as Sug[])[0]?.principal).toBe('KM 9');
    expect(e.cuerpos[0]).toMatchObject({ includedRegionCodes: ['ve'] });
    const vega = await e.buscar('la vega', e.pasajero.token);
    const nombres = (vega.datos.sugerencias as Sug[]).map((x) => x.principal);
    expect(nombres).toContain('La Vega I');
    expect(nombres).not.toContain('La Vega II');
  });

  it('si Google falla o no hay llave, los destinos del tabulador igual salen', async () => {
    const e = await elVigia({});
    const r = await e.buscar('KM 9', e.pasajero.token);
    expect(r.estado).toBe(200);
    expect((r.datos.sugerencias as Sug[])[0]?.principal).toBe('KM 9');
  });

  it('fuera de toda ciudad y sin cuenta, se busca como siempre (sin tabulador ni país forzado)', async () => {
    const e = await elVigia();
    const r = await e.buscar('KM 9');
    expect((r.datos.sugerencias as Sug[]).some((x) => x.id.startsWith(PREFIJO_TABULADOR))).toBe(
      false,
    );
    expect(e.cuerpos[0]?.includedRegionCodes).toBeUndefined();
  });
});
