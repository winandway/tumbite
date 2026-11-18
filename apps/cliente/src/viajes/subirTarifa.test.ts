import { describe, expect, it } from 'vitest';
import { estadoBotonesSubida, textoPaso, textosSubida } from './subirTarifa';

/**
 * C-SUBIR-TARIFA (app del cliente, versión siguiente): si nadie acepta, «Buscando…» ofrece subir la
 * tarifa con los montos que da el servidor para la ciudad, pasados los segundos que él dice.
 */
const subida = { pasos: [25, 50, 100], enSegundos: 30, quedan: 3, moneda: 'USD' };

describe('estadoBotonesSubida', () => {
  it('sin subida del servidor (apagado, tarjeta, tope), no hay botones', () => {
    expect(estadoBotonesSubida(null, 0, 99_000)).toEqual({ visible: false, enSegundos: 0 });
  });
  it('antes de la espera no se muestran; después, sí', () => {
    const recibido = 1_000_000;
    expect(estadoBotonesSubida(subida, recibido, recibido + 10_000)).toEqual({
      visible: false,
      enSegundos: 20,
    });
    expect(estadoBotonesSubida(subida, recibido, recibido + 30_000)).toEqual({
      visible: true,
      enSegundos: 0,
    });
  });
});

describe('los botones dicen el monto en la moneda de la ciudad', () => {
  it('«+$0.25» y «+$1.00», como el resto de los precios de la app', () => {
    expect(textoPaso(25, 'USD', 'en')).toBe('+$0.25');
    expect(textoPaso(100, 'USD', 'en')).toBe('+$1.00');
    expect(textoPaso(50, 'USD', 'es')).toBe('+$0.50');
  });
  it('los textos existen en los dos idiomas', () => {
    expect(textosSubida('es').titulo).toMatch(/tarifa/);
    expect(textosSubida('en').titulo).toMatch(/fare/);
  });
});
