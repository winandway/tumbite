import { describe, expect, it, vi } from 'vitest';
import { ORIGEN_CCS, abrirCaracas, escenarioVe } from '../pruebas/motoVe';

/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela): el camino exacto «tu saldo cambió mientras pedías». El
 * servidor lee el saldo (aquí, a propósito, uno que ya no está) y la sentencia que aparta lo frena en
 * el mismo paso: 409 en palabras, sin viaje, sin regalo apartado y sin tocar el saldo.
 */
vi.mock('../saldoCliente', async (original) => {
  const real = await original<typeof import('../saldoCliente')>();
  return {
    ...real,
    // Lo que el servidor «vio» al leer: un saldo que entre medio otro pedido ya gastó.
    saldoDeCliente: async () => 50_000,
  };
});

describe('C-SALDO-CLIENTE: el saldo cambió mientras pedías', () => {
  it('responde 409 con su mensaje y no crea el viaje', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const cot = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'moto',
        origen: ORIGEN_CCS,
        destino: { lat: 10.4806, lng: -66.8406, direccion: 'Destino' },
      },
      e.cliente.token,
    );
    expect(cot.estado).toBe(201);
    const r = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'saldo', usarSaldo: true },
      e.cliente.token,
      { 'x-idioma': 'es' },
    );
    expect(r.estado).toBe(409);
    expect(r.datos.error).toBe(
      'Tu Saldo Divoox cambió mientras pedías. Revisa cómo pagas y vuelve a pedir.',
    );
    expect(r.datos.campo).toBe('metodoPago');
    const viajes = await e.m.DB.prepare(
      'SELECT COUNT(*) AS n FROM operaciones WHERE cliente_id = ?',
    )
      .bind(e.cliente.id)
      .first<{ n: number }>();
    expect(viajes?.n).toBe(0);
    const movs = await e.m.DB.prepare(
      'SELECT COUNT(*) AS n FROM saldo_cliente_movimientos WHERE cliente_id = ?',
    )
      .bind(e.cliente.id)
      .first<{ n: number }>();
    expect(movs?.n).toBe(0);
  });
});
