import { describe, expect, it } from 'vitest';
import { calificacionPublica, textoCalificacion } from './calificacionPublica';

describe('C-CALIFICACION-PUBLICA', () => {
  it('con menos de 10 opiniones no se muestra promedio: el restaurante es «Nuevo»', () => {
    expect(calificacionPublica(5, 9)).toBeNull();
    expect(calificacionPublica(null, 40)).toBeNull();
    expect(textoCalificacion(null, 'es')).toBe('Nuevo');
    expect(textoCalificacion(null, 'en')).toBe('New');
  });
  it('desde 10, el promedio con un decimal y la cuenta', () => {
    const c = calificacionPublica(4.6666, 12);
    expect(c).toEqual({ promedio: 4.7, total: 12 });
    expect(textoCalificacion(c, 'es')).toBe('4.7 (12)');
    expect(textoCalificacion({ promedio: 5, total: 2345 }, 'en')).toBe('5.0 (2,000+)');
  });
});
