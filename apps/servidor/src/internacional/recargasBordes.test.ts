import { describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { guardarConfigPais } from './paises';
import {
  acreditarRecargaStripe,
  canjearCodigo,
  crearRecargaStripe,
  emitirCodigo,
} from './recargas';

/**
 * C-RECARGAS-PUNTO (COB-5, 2 nov 2026): los frenos de las recargas del repartidor que el recorrido
 * completo no toca: país apagado, montos fuera de los límites, tope semanal y un aviso de Stripe
 * que no trae monto. Todos los países.
 */
async function preparar(config: Record<string, unknown> = {}) {
  const m = mundo();
  const rep = await m.cuenta('repartidor', 'Rita Recarga');
  await m.DB.prepare(
    "INSERT INTO puntos_venta (id, nombre, pais, moneda) VALUES ('pv1', 'Tienda Esquina', 'US', 'USD')",
  ).run();
  if (Object.keys(config).length)
    await guardarConfigPais(m.DB, 'US', { comisionPb: 1000, cargoFijo: 0, ...config });
  return { m, rep };
}

describe('frenos de las recargas del repartidor', () => {
  it('con las recargas en punto de venta apagadas no se emite ningún código', async () => {
    const { m } = await preparar();
    await expect(
      emitirCodigo(m.DB, { puntoId: 'pv1', monto: 1000, emitidoPor: 'a' }),
    ).rejects.toMatchObject({ estado: 409 });
  });

  it('un monto fuera de los límites del país no se emite ni se cobra con tarjeta', async () => {
    const { m, rep } = await preparar({
      recargasPuntoVentaActivas: true,
      recargasStripeActivas: true,
      recargaMin: 500,
      recargaMax: 5000,
    });
    await expect(
      emitirCodigo(m.DB, { puntoId: 'pv1', monto: 100, emitidoPor: 'a' }),
    ).rejects.toMatchObject({ estado: 409, campo: 'monto' });
    await expect(
      crearRecargaStripe(m.DB, { repartidorId: rep.id, pais: 'US', moneda: 'USD', monto: 9000 }),
    ).rejects.toMatchObject({ estado: 409, campo: 'monto' });
  });

  it('con el tope semanal lleno no se canjea otro código', async () => {
    const { m, rep } = await preparar({ recargasPuntoVentaActivas: true, recargasSemanaMax: 1 });
    await m.DB.prepare(
      "INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado) VALUES ('r1', ?, 'US', 'USD', 1000, 'stripe', 'acreditada')",
    )
      .bind(rep.id)
      .run();
    await expect(
      canjearCodigo(m.DB, { codigo: 'XXXX-XXXX', repartidorId: rep.id, pais: 'US', moneda: 'USD' }),
    ).rejects.toMatchObject({ estado: 409 });
  });

  it('un aviso de Stripe sin monto ni id no acredita y abre la incidencia', async () => {
    const { m, rep } = await preparar();
    await m.DB.prepare(
      "INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado) VALUES ('r2', ?, 'US', 'USD', 1000, 'stripe', 'pendiente')",
    )
      .bind(rep.id)
      .run();
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await acreditarRecargaStripe(m.DB, { metadata: { recarga_id: 'r2' } })).toBe(false);
    errores.mockRestore();
    const estado = await m.DB.prepare("SELECT estado FROM recargas WHERE id = 'r2'").first<{
      estado: string;
    }>();
    expect(estado?.estado).toBe('pendiente');
  });
});
