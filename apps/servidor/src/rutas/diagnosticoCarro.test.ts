import { describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { CARRO_GUION, DETROIT_PRUEBAS } from './diagnosticoCarro';

/**
 * C-CARRO-GUION (14 nov 2026) — Venezuela y EE. UU. La herramienta del sitio de pruebas que usa
 * scripts/staging/probar-carro.mjs: cuentas fijas, Detroit con Carro y tarifa de prueba, el taxista
 * de cada país listo para Carro y conectado, y la limpieza. Sin el secreto, o en producción, no existe.
 */
const SEC = `reloj-${crypto.randomUUID()}`;

function escenario(host = 'staging.tumbite.com') {
  const m = mundo({ RELOJ_SECRETO: SEC }, { host });
  const interno = async (ruta: string, cuerpo: unknown = {}, conSecreto = true) => {
    const r = await m.crudo(`/datos/interno/diagnostico/carro/${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(conSecreto ? { 'x-reloj-secreto': SEC } : {}),
      },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: (await r.json()) as any };
  };
  return { m, interno };
}

describe('C-CARRO-GUION: la herramienta del guion de Carro', () => {
  it('sin el secreto no existe; en producción tampoco', async () => {
    expect((await escenario().interno('armar', {}, false)).estado).toBe(404);
    expect((await escenario('divoox.com').interno('armar')).estado).toBe(404);
  });

  it('Detroit queda con Carro: el pasajero cotiza, el taxista recibe la oferta y la acepta', async () => {
    const { m, interno } = escenario();
    const a = await interno('armar');
    expect(a.estado).toBe(200);
    // Repetir el armado no duplica nada (cuentas fijas).
    expect((await interno('armar')).estado).toBe(200);
    const { tokens } = (await interno('armar')).datos;
    expect((await interno('conductor', { quien: 'us' })).estado).toBe(200);
    const origen = {
      lat: DETROIT_PRUEBAS.lat,
      lng: DETROIT_PRUEBAS.lng,
      direccion: 'Campus Martius',
    };
    const cot = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen, destino: { lat: 42.36, lng: -83.07, direccion: 'Midtown' } },
      tokens.cliente,
    );
    expect(cot.estado).toBe(201);
    expect(cot.datos.cotizacion.moneda).toBe('USD');
    const v = await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo' },
      tokens.cliente,
    );
    expect(v.estado).toBe(201);
    const ofertas = await m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      tokens.conductorUs,
    );
    expect(ofertas.datos.ofertas.map((o: { operacionId: string }) => o.operacionId)).toContain(
      v.datos.viaje.id,
    );
    const r = await m.crudo(`/datos/conductor/operaciones/${v.datos.viaje.id}/aceptar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokens.conductorUs}`,
        'content-type': 'application/json',
        'idempotency-key': 'car-aceptar-prueba-1',
      },
      body: '{}',
    });
    expect(r.status).toBe(200);
  });

  it('el taxista de El Vigía queda listo para Carro en la zona única; la limpieza lo desconecta', async () => {
    const { m, interno } = escenario();
    const { tokens } = (await interno('armar')).datos;
    expect((await interno('conductor', { quien: 've' })).estado).toBe(409); // ciudad sin abrir
    const abrir = await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'carro',
        zona: {
          id: EVG.id,
          nombre: EVG.nombre,
          lat: EVG.lat,
          lng: EVG.lng,
          radioKm: EVG.radioKm,
          zonaHoraria: EVG.zonaHoraria,
        },
        motivo: 'Carro de pruebas',
      },
      tokens.equipo,
    );
    expect(abrir.estado).toBe(201);
    expect((await interno('conductor', { quien: 've' })).estado).toBe(200);
    const s = await m.llamar('GET', '/datos/conductor/servicios', undefined, tokens.conductorVe);
    const carro = s.datos.servicios.find((x: { servicioId: string }) => x.servicioId === 'carro');
    expect(carro?.puedeActivar, JSON.stringify(carro?.requisitosFaltantes)).toBe(true);
    const zona = await m.DB.prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
      .bind(CARRO_GUION.conductorVe)
      .first<{ zona_id: string }>();
    expect(zona?.zona_id).toBe('VE-MER-ELVIGIA');
    expect((await interno('limpiar')).datos.ok).toBe(true);
    const conectados = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM repartidores WHERE conectado = 1 AND usuario_id IN (?, ?)',
    )
      .bind(CARRO_GUION.conductorVe, CARRO_GUION.conductorUs)
      .first<{ n: number }>();
    expect(conectados?.n).toBe(0);
  });

  it('C-CARRO-GUION-ZONA: el taxista queda en la zona y en el punto que manda el guion, no en el centro de la zona', async () => {
    const { m, interno } = escenario();
    await interno('armar');
    // Como en el sitio de pruebas: Detroit ya existía con su centro a unos 21 km de la recogida.
    await m.DB.prepare('UPDATE zonas SET lat = 42.42, lng = -83.27, radio_km = 50 WHERE id = ?')
      .bind(DETROIT_PRUEBAS.id)
      .run();
    const r = await interno('conductor', {
      quien: 'us',
      zonaId: DETROIT_PRUEBAS.id,
      lat: 42.3314,
      lng: -83.0458,
    });
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({
      zonaId: 'US-MI-DETROIT',
      punto: { lat: 42.3314, lng: -83.0458 },
    });
    const f = await m.DB.prepare('SELECT zona_id, lat, lng FROM repartidores WHERE usuario_id = ?')
      .bind(CARRO_GUION.conductorUs)
      .first<{ zona_id: string; lat: number; lng: number }>();
    expect(f).toEqual({ zona_id: 'US-MI-DETROIT', lat: 42.3314, lng: -83.0458 });
    // Una zona de otro país no vale para el taxista de EE. UU.
    expect((await interno('conductor', { quien: 'us', zonaId: 'VE-MER-ELVIGIA' })).estado).toBe(
      409,
    );
  });
});
