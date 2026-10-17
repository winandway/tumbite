import { describe, expect, it } from 'vitest';
import {
  type Poligono,
  poligonosSeSolapan,
  puntoEnPoligono,
  resolverArea,
  validarPoligono,
} from './territorio';

// Cuadrados de 0,1° alrededor de Miami (lng, lat).
const cuadro = (lng: number, lat: number, t = 0.1): Poligono => [
  [lng, lat],
  [lng + t, lat],
  [lng + t, lat + t],
  [lng, lat + t],
];
const NORTE = cuadro(-80.3, 25.8);
const SUR = cuadro(-80.3, 25.7); // comparte el borde lat 25.8 con NORTE

describe('territorio: geometría de las áreas', () => {
  it('un punto dentro, fuera y en el borde', () => {
    expect(puntoEnPoligono(25.85, -80.25, NORTE)).toBe(true);
    expect(puntoEnPoligono(25.95, -80.25, NORTE)).toBe(false);
    expect(puntoEnPoligono(25.8, -80.25, NORTE)).toBe(false);
  });

  it('valida los polígonos', () => {
    expect(validarPoligono(NORTE)).toBeNull();
    expect(
      validarPoligono([
        [0, 0],
        [1, 1],
      ]),
    ).toMatch(/3 puntos/);
    expect(
      validarPoligono([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toMatch(/superficie/);
    expect(
      validarPoligono([
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 1],
      ]),
    ).toMatch(/cruza/);
    expect(
      validarPoligono([
        [0, 0],
        [200, 1],
        [1, 0],
      ]),
    ).toMatch(/fuera del mapa/);
    expect(validarPoligono('x')).toMatch(/3 puntos/);
  });

  it('áreas vecinas con el borde compartido NO se pisan; superpuestas o una dentro de otra, sí', () => {
    expect(poligonosSeSolapan(NORTE, SUR)).toBe(false);
    expect(poligonosSeSolapan(NORTE, cuadro(-80.25, 25.85))).toBe(true);
    expect(poligonosSeSolapan(NORTE, cuadro(-80.28, 25.82, 0.02))).toBe(true); // adentro
    expect(poligonosSeSolapan(NORTE, NORTE)).toBe(true); // la misma
    expect(poligonosSeSolapan(NORTE, cuadro(-81, 26))).toBe(false); // lejos
  });

  it('regla de conflicto en el borde: mayor prioridad, luego la más antigua', () => {
    const a = {
      id: 'a',
      estado: 'activa' as const,
      prioridad: 0,
      creadoEn: '2026-01-02',
      poligono: NORTE,
    };
    const b = {
      id: 'b',
      estado: 'activa' as const,
      prioridad: 0,
      creadoEn: '2026-01-01',
      poligono: SUR,
    };
    expect(resolverArea(25.8, -80.25, [a, b])?.id).toBe('b'); // empate: la más antigua
    expect(resolverArea(25.8, -80.25, [{ ...a, prioridad: 5 }, b])?.id).toBe('a');
    expect(resolverArea(25.85, -80.25, [a, b])?.id).toBe('a');
    // Solo cuentan las activas.
    expect(resolverArea(25.85, -80.25, [{ ...a, estado: 'pausada' as const }, b])).toBeNull();
    expect(resolverArea(26.5, -80.25, [a, b])).toBeNull();
  });
});
