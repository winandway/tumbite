import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * Divoox Moto · M10: el mismo viaje de punta a punta que corre scripts/staging/probar-moto.mjs
 * contra el sitio de pruebas, aquí en local: armar pasajero y conductor temporales, viaje completo
 * por la API (cotizar, pedir, oferta, aceptar, llegué, código, terminar, calificar, compartir) y
 * limpiar sin dejar nada.
 */
const SEC = `reloj-${crypto.randomUUID()}`;
const ZONA = 'US-FL-MIAMI';

describe('M10: viaje de Moto de punta a punta con la herramienta del sitio de pruebas', () => {
  it('arma, hace el viaje completo por la API y limpia sin dejar nada', async () => {
    const m = mundo({ RELOJ_SECRETO: SEC }, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const interno = async (ruta: string, cuerpo: unknown) => {
      const r = await m.crudo(ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-reloj-secreto': SEC },
        body: JSON.stringify(cuerpo),
      });
      return { estado: r.status, datos: (await r.json()) as any };
    };
    // Sin el secreto, la herramienta no existe.
    expect(
      (
        await m.crudo('/datos/interno/diagnostico/moto/armar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(404);
    expect(
      (await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token))
        .estado,
    ).toBe(200);
    await m.llamar(
      'PUT',
      `/datos/admin/servicios/moto/zonas/${ZONA}`,
      { estado: 'disponible' },
      admin.token,
    );
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA,
        tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    const armado = await interno('/datos/interno/diagnostico/moto/armar', {});
    expect(armado.estado).toBe(200);
    const { tokens, punto, sufijo } = armado.datos;
    const cot = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'moto',
        origen: { ...punto, direccion: 'Centro de Miami' },
        destino: { lat: 25.79, lng: -80.13, direccion: 'Miami Beach' },
      },
      tokens.cliente,
    );
    expect(cot.estado).toBe(201);
    const viaje = await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo' },
      tokens.cliente,
    );
    const id = viaje.datos.viaje.id as string;
    const ofertas = await m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      tokens.conductor,
    );
    expect(ofertas.datos.ofertas[0]).toMatchObject({ operacionId: id });
    let n = 0;
    const paso = async (nombre: string, cuerpo: unknown = {}) =>
      (
        await m.crudo(`/datos/conductor/operaciones/${id}/${nombre}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${tokens.conductor}`,
            'content-type': 'application/json',
            'idempotency-key': `m10-${nombre}-${++n}-clave`,
          },
          body: JSON.stringify(cuerpo),
        })
      ).status;
    expect(await paso('aceptar')).toBe(200);
    const compartido = await m.llamar('POST', `/datos/viajes/${id}/compartir`, {}, tokens.cliente);
    expect(compartido.estado).toBe(201);
    expect(await paso('llegue')).toBe(200);
    const pin = (await m.llamar('GET', '/datos/viajes/actual', undefined, tokens.cliente)).datos
      .viaje.pin;
    expect(await paso('iniciar', { pin })).toBe(200);
    expect(await paso('terminar')).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/viajes/${id}/calificar`, { estrellas: 5 }, tokens.cliente))
        .estado,
    ).toBe(200);
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.viajes).toBe('ok');
    const limpio = await interno('/datos/interno/diagnostico/moto/limpiar', { sufijo });
    expect(limpio.datos).toEqual({ ok: true });
    expect(
      await m.DB.prepare('SELECT COUNT(*) AS n FROM operaciones WHERE id = ?').bind(id).first(),
    ).toEqual({ n: 0 });
  });
});
