import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { palabraDeHoy } from './resumenDiaLogica';
import { textosDriver } from './textos';

/**
 * C-HOY-VIAJES (22 nov 2026, Gerencia) — todos los países. Un conductor de moto con pasajero veía
 * «4 entregas» en su inicio: no entregó nada, hizo viajes. La tarjeta «Hoy» dice «Viajes» cuando lo
 * de hoy fueron solo viajes de pasajeros. Visto en ROJO: sin `resumenDiaLogica.ts` no compilaba.
 */
describe('C-HOY-VIAJES', () => {
  it('solo viajes de pasajeros: «Viajes»', () => {
    expect(palabraDeHoy(0, 4)).toBe('viajes');
  });
  it('solo entregas, las dos cosas o nada todavía: «Entregas»', () => {
    expect(palabraDeHoy(3, 0)).toBe('entregas');
    expect(palabraDeHoy(2, 2)).toBe('entregas');
    expect(palabraDeHoy(0, 0)).toBe('entregas');
  });
  it('la palabra existe en los dos idiomas y el inicio la usa', () => {
    expect(textosDriver('es').viajes).toBe('Viajes');
    expect(textosDriver('en').viajes).toBe('Trips');
    const inicio = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
    expect(inicio).toContain('palabraDeHoy(hoyConEnMano.entregas, hoyConEnMano.carreras)');
    expect(inicio.match(/palabra=\{palabraHoy\}/g)).toHaveLength(2);
  });
});
