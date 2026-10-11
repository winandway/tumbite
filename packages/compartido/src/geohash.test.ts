import { describe, expect, it } from 'vitest';
import { celdasVecinas, decodificarGeohash, geohash } from './geohash';

describe('geohash', () => {
  it('codifica como el estándar (punto conocido)', () => {
    // Coordenada de referencia del algoritmo original: 57.64911, 10.40744 → u4pruydqqvj
    expect(geohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });

  it('dos lugares cercanos de Miami comparten celda o son vecinos', () => {
    const a = geohash(25.7617, -80.1918);
    const b = geohash(25.7701, -80.1937);
    expect(a.length).toBe(5);
    expect(celdasVecinas(a)).toContain(b);
  });

  it('las vecinas son 9 celdas distintas alrededor', () => {
    const v = celdasVecinas('dhwfz');
    expect(v).toHaveLength(9);
    expect(v).toContain('dhwfz');
  });

  it('decodifica el centro de la celda y rechaza textos inválidos', () => {
    const c = decodificarGeohash(geohash(25.7617, -80.1918));
    expect(Math.abs(c.lat - 25.7617)).toBeLessThan(0.05);
    expect(() => decodificarGeohash('aaa')).toThrow();
  });
});
