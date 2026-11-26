import { describe, expect, it } from 'vitest';
import { precioConRegalo } from './regaloDivoox';

/**
 * C-PRECIO-CON-REGALO (18 nov 2026): toda pantalla del viaje (buscando, en camino, terminado, cancelado,
 * «Mis viajes» y el recibo) muestra el precio con el regalo como la tarjeta del precio: el precio de
 * siempre tachado, el regalo en verde y lo que se paga de verdad. Nunca «Precio fijo $1,42» a secas.
 */
describe('el precio de un viaje con regalo', () => {
  it('sin regalo: el precio tal cual, sin tachar', () => {
    expect(precioConRegalo(142, null)).toEqual({
      total: 142,
      tachado: false,
      regalo: 0,
      saldo: 0,
      aPagar: 142,
      gratis: false,
    });
  });
  it('con regalo que lo cubre todo: tachado y gratis', () => {
    expect(precioConRegalo(142, { monto: 142 })).toEqual({
      total: 142,
      tachado: true,
      regalo: 142,
      saldo: 0,
      aPagar: 0,
      gratis: true,
    });
  });
  it('con regalo parcial: tachado y el resto a pagar', () => {
    expect(precioConRegalo(142, { monto: 100 })).toMatchObject({
      tachado: true,
      aPagar: 42,
      gratis: false,
    });
  });
  it('un regalo mayor que el precio no deja un saldo negativo', () => {
    expect(precioConRegalo(100, { monto: 500 })).toMatchObject({ aPagar: 0, gratis: true });
  });
  // Revisor (18 nov): un viaje cancelado con el regalo devuelto no es «Gratis»: nadie viajó.
  it('con el regalo devuelto (no hubo viaje) el precio va normal, sin tachar ni «Gratis»', () => {
    expect(precioConRegalo(142, { monto: 142, devuelto: true })).toEqual({
      total: 142,
      tachado: false,
      regalo: 0,
      saldo: 0,
      aPagar: 142,
      gratis: false,
      devuelto: true,
    });
  });
  it('un regalo de cero o un precio desconocido no tacha nada', () => {
    expect(precioConRegalo(142, { monto: 0 })?.tachado).toBe(false);
    expect(precioConRegalo(null, { monto: 100 })).toBeNull();
  });
});
