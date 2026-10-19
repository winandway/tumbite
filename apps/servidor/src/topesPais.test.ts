import { describe, expect, it, vi } from 'vitest';
import { BONO_OFERTA_ABIERTA } from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { TARIFAS_PRUEBA_COP, TOPES_PRUEBA } from './pruebas/paisPrueba';
import { topesDePais, topesDeZona } from './internacional/tarifas';

/**
 * C-TOPES-PAIS (19 oct 2026): bono de la oferta abierta, precio máximo de una opción, propina
 * máxima, propina posterior, monto de cupones y reembolso automático de quejas salen del país.
 * Estados Unidos: las cifras de siempre. Un país sin tarifas o sin topes no se enciende.
 */
async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 's', status: 'requires_capture' }), {
        status: 200,
      }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = (
    await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Arepa', precioCentavos: 1500 },
      dueno.token,
    )
  ).datos.plato.id as string;
  await m.abrir(dueno.token);
  const opciones = (precio: number) =>
    m.llamar(
      'PUT',
      `/datos/mi-restaurante/platos/${plato}/opciones`,
      {
        grupos: [
          {
            nombreEs: 'Extra',
            minimo: 0,
            maximo: 1,
            opciones: [{ nombreEs: 'Queso', precioCentavos: precio }],
          },
        ],
      },
      dueno.token,
    );
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato, cantidad: 2 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      cliente.token,
    );
  const cupon = (datos: Record<string, unknown>) =>
    m.llamar('POST', '/datos/admin/cupones', datos, admin.token);
  async function aColombia() {
    await m.DB.prepare(
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('CO-BOG-PRUEBA','Prueba','CO','COP','America/Bogota',25.77,-80.19,30,0)",
    ).run();
    await m.DB.prepare("UPDATE restaurantes SET zona_id = 'CO-BOG-PRUEBA' WHERE id = ?")
      .bind(rid)
      .run();
  }
  return { m, admin, cliente, dueno, rid, plato, opciones, pedir, cupon, aColombia };
}

describe('C-TOPES-PAIS: topes por país y moneda', () => {
  it('Estados Unidos sigue con sus cifras de siempre', async () => {
    const e = await escenario();
    const t = await topesDePais(e.m.DB, 'US');
    expect(t).toMatchObject({
      bonoOfertaAbierta: BONO_OFERTA_ABIERTA,
      opcionPrecioMax: 10_000,
      propinaMax: 50_000,
      propinaExtraMin: 100,
      propinaExtraMax: 10_000,
      cuponMontoMax: 1_000_000,
      quejaReembolsoMax: 1500,
    });
    expect((await e.opciones(10_000)).estado).toBe(200);
    expect((await e.opciones(10_001)).estado).toBe(422);
    expect((await e.pedir({ propinaCentavos: 50_001 })).estado).toBe(400);
    expect((await e.pedir({ propinaCentavos: 50_000 })).estado).toBe(201);
    expect((await e.cupon({ codigo: 'USMAX', tipo: 'monto', valor: 1_000_001 })).estado).toBe(400);
    expect((await e.cupon({ codigo: 'USOK', tipo: 'monto', valor: 1_000_000 })).estado).toBe(201);
  });

  it('un país incompleto no se enciende ni activa ciudades; con tarifas y topes, sí', async () => {
    const e = await escenario();
    const put = (d: Record<string, unknown>) =>
      e.m.llamar('PUT', '/datos/admin/paises/CO', d, e.admin.token);
    const sinTarifas = await put({ efectivoActivo: true });
    expect(sinTarifas.estado).toBe(409);
    expect(sinTarifas.datos.campo).toBe('tarifas');
    const sinTopes = await put({ tarifas: TARIFAS_PRUEBA_COP, efectivoActivo: true });
    expect(sinTopes.estado).toBe(409);
    expect(sinTopes.datos.campo).toBe('topes');
    const ciudad = {
      id: 'CO-BOG-BOGOTA',
      nombre: 'Bogotá',
      pais: 'CO',
      moneda: 'COP',
      zonaHoraria: 'America/Bogota',
      lat: 4.65,
      lng: -74.08,
      activa: true,
    };
    expect((await e.m.llamar('PUT', '/datos/admin/zonas', ciudad, e.admin.token)).estado).toBe(409);
    // Un intento rechazado no guarda nada a medias: se mandan tarifas y topes juntos.
    expect((await put({ topes: TOPES_PRUEBA, efectivoActivo: true })).estado).toBe(409);
    expect(
      (await put({ tarifas: TARIFAS_PRUEBA_COP, topes: TOPES_PRUEBA, efectivoActivo: true }))
        .estado,
    ).toBe(200);
    expect((await e.m.llamar('PUT', '/datos/admin/zonas', ciudad, e.admin.token)).estado).toBe(200);
    // Topes mal escritos no se guardan.
    expect(
      (await put({ topes: { ...TOPES_PRUEBA, propinaMax: 0 } })).estado,
    ).toBeGreaterThanOrEqual(400);
  });

  it('un país con sus topes: opciones, propina, cupones, bono y quejas usan los suyos, en su moneda', async () => {
    const e = await escenario();
    await e.aColombia();
    await e.m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      { tarifas: TARIFAS_PRUEBA_COP, topes: TOPES_PRUEBA, efectivoActivo: true },
      e.admin.token,
    );
    // Una opción de 30 000 pesos vale aquí (en EE. UU. pasaría del tope); 50 000 no.
    expect((await e.opciones(30_000)).estado).toBe(200);
    expect((await e.opciones(40_001)).estado).toBe(422);
    expect((await e.pedir({ metodoPago: 'efectivo', propinaCentavos: 200_001 })).estado).toBe(400);
    expect((await e.pedir({ metodoPago: 'efectivo', propinaCentavos: 150_000 })).estado).toBe(201);
    // Un cupón sin ciudad (en dólares) no vale en Colombia; uno de la ciudad respeta el tope.
    await e.cupon({ codigo: 'DOLARES', tipo: 'monto', valor: 300 });
    const sinCiudad = await e.pedir({ metodoPago: 'efectivo', cupon: 'DOLARES' });
    expect(sinCiudad.estado).toBe(409);
    expect(String(sinCiudad.datos.error)).toMatch(/city|ciudad/);
    expect(
      (await e.cupon({ codigo: 'PESOSMAX', tipo: 'monto', valor: 50_001, zonaId: 'CO-BOG-PRUEBA' }))
        .estado,
    ).toBe(400);
    expect(
      (await e.cupon({ codigo: 'PESOS', tipo: 'monto', valor: 5000, zonaId: 'CO-BOG-PRUEBA' }))
        .estado,
    ).toBe(201);
    expect((await e.pedir({ metodoPago: 'efectivo', cupon: 'PESOS' })).estado).toBe(201);
    expect((await topesDeZona(e.m.DB, 'CO-BOG-PRUEBA')).topes?.bonoOfertaAbierta).toBe(3000);
    expect((await topesDePais(e.m.DB, 'CO'))?.quejaReembolsoMax).toBe(60_000);
    // Venezuela sin escribir: sin topes.
    expect(await topesDePais(e.m.DB, 'VE')).toBeNull();
  });

  it('el carrito pregunta las formas de pago del país del RESTAURANTE, no de la ciudad guardada del cliente (C-PAIS-DEL-RESTAURANTE)', async () => {
    const e = await escenario();
    await e.aColombia();
    await e.m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      { tarifas: TARIFAS_PRUEBA_COP, topes: TOPES_PRUEBA, efectivoActivo: true },
      e.admin.token,
    );
    const sinRest = await e.m.llamar('GET', '/datos/pais', undefined, e.cliente.token);
    expect(sinRest.datos.pais).toBe('US');
    const conRest = await e.m.llamar(
      'GET',
      `/datos/pais?restauranteId=${e.rid}`,
      undefined,
      e.cliente.token,
    );
    expect(conRest.datos).toMatchObject({ pais: 'CO', moneda: 'COP', efectivoActivo: true });
  });

  it('las tarifas de un país aceptan montos de su moneda (bolívares, pesos) sin el tope de centavos de dólar', async () => {
    const e = await escenario();
    const r = await e.m.llamar(
      'PUT',
      '/datos/admin/paises/VE',
      { tarifas: { ...TARIFAS_PRUEBA_COP, envioMaximo: 120_000, servicioMaximo: 50_000 } },
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    // La configuración global de EE. UU. sigue con su tope de siempre.
    const cfg = await e.m.llamar('GET', '/datos/config-dinero', undefined, e.admin.token);
    expect(
      (
        await e.m.llamar(
          'PUT',
          '/datos/admin/config-dinero',
          { ...cfg.datos.config, envioMaximo: 120_000 },
          e.admin.token,
        )
      ).estado,
    ).toBe(400);
  });
});
