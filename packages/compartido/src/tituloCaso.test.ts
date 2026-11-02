import { describe, expect, it } from 'vitest';
import { tituloCaso } from './tituloCaso';

// C-CASO-EN-SU-IDIOMA: el título fijo del caso se ve en el idioma de la app.
describe('tituloCaso', () => {
  it('traduce los títulos fijos y conserva el número de pedido', () => {
    expect(tituloCaso('Help request', 'es')).toBe('Pedido de ayuda');
    expect(tituloCaso('Problem report · #AB12', 'es')).toBe('Reporte de un problema · #AB12');
    expect(tituloCaso('Pedido de ayuda', 'en')).toBe('Help request');
    expect(tituloCaso('Pedido de ayuda', 'es')).toBe('Pedido de ayuda');
  });
  it('lo que escribió la persona no se toca', () => {
    expect(tituloCaso('La app no abre', 'en')).toBe('La app no abre');
  });
});
