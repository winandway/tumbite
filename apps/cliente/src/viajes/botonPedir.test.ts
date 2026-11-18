import { describe, expect, it } from 'vitest';
import { estadoBotonPedir } from './botonPedir';

/**
 * C-SERVICIO-SIN-TARIFA (18 nov 2026): con «Este servicio todavía no tiene precio en tu ciudad.» el
 * botón «Solicitar envío» quedaba activo y cada toque volvía a cotizar y a fallar.
 */
describe('estadoBotonPedir', () => {
  it('sin destino, lleva a elegirlo', () => {
    expect(estadoBotonPedir({ sinDestino: true, conCotizacion: false, sinServicio: false })).toBe(
      'elegir_destino',
    );
  });
  it('sin precio todavía, cotiza; con precio, pide', () => {
    expect(estadoBotonPedir({ sinDestino: false, conCotizacion: false, sinServicio: false })).toBe(
      'cotizar',
    );
    expect(estadoBotonPedir({ sinDestino: false, conCotizacion: true, sinServicio: false })).toBe(
      'pedir',
    );
  });
  it('si el servicio no tiene precio o no está en la ciudad, el botón queda apagado', () => {
    expect(estadoBotonPedir({ sinDestino: false, conCotizacion: false, sinServicio: true })).toBe(
      'apagado',
    );
  });
});
