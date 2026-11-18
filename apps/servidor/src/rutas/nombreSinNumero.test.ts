import { describe, expect, it } from 'vitest';
import { nombreSinNumero } from './lugares';

/**
 * C-DESTINO-POPULARES (segunda revisión de calidad, 18 nov): el nombre de un lugar popular nunca lleva
 * el número de una casa ni el de un apartamento, oficina o piso.
 */
describe('nombreSinNumero', () => {
  it('quita el número de la casa', () => {
    expect(nombreSinNumero('43381 Grand River Ave, Novi, MI').titulo).toBe('Grand River Ave');
    expect(nombreSinNumero('Av. Bolívar #25, Centro').titulo).toBe('Av. Bolívar');
    expect(nombreSinNumero('Calle 3, El Vigía').titulo).toBe('Calle 3');
  });

  it('quita apartamento, unidad, oficina o piso con su número', () => {
    expect(nombreSinNumero('100 Main St Apt 4B, Novi').titulo).toBe('Main St');
    expect(nombreSinNumero('Ocean Dr Unit 12, Miami').titulo).toBe('Ocean Dr');
    expect(nombreSinNumero('Brickell Ave Suite 300').titulo).toBe('Brickell Ave');
    expect(nombreSinNumero('Av. Libertador Apto 5-2').titulo).toBe('Av. Libertador');
    expect(nombreSinNumero('Torre Norte Piso 8').titulo).toBe('Torre Norte');
    // Tercera revisión: las palabras completas también.
    expect(nombreSinNumero('Av. Andrés Bello Apartamento 3').titulo).toBe('Av. Andrés Bello');
    expect(nombreSinNumero('Lake St Apartment 7').titulo).toBe('Lake St');
    expect(nombreSinNumero('Main St Floor 2').titulo).toBe('Main St');
    expect(nombreSinNumero('Calle Bolívar Dept 4').titulo).toBe('Calle Bolívar');
    expect(nombreSinNumero('Calle Bolívar Depto 4').titulo).toBe('Calle Bolívar');
  });
});
