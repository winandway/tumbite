import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CARRO,
  FARO_X,
  GIRO_RUEDA_GRADOS,
  PILOTO_X,
  capas,
  debeAnimar,
  velocidadRueda,
} from './escenaBuscando';

// C-ESPERA-ADELANTE (corrección de Richard, 16 nov 2026): el carro de «Buscando tu conductor»
// tiene que leerse yendo HACIA ADELANTE, nunca en retroceso.
describe('escena de «Buscando tu conductor»', () => {
  it('el carro mira a la derecha: faro adelante, piloto atrás', () => {
    expect(FARO_X).toBeGreaterThan(CARRO.lienzo / 2);
    expect(PILOTO_X).toBeLessThan(CARRO.lienzo / 2);
  });

  it('las ruedas giran en el sentido del reloj (avanzar a la derecha)', () => {
    expect(GIRO_RUEDA_GRADOS).toBeGreaterThan(0);
  });

  it('la ciudad, los postes, la carretera y las nubes pasan hacia atrás (a la izquierda)', () => {
    const c = capas(390);
    for (const [nombre, capa] of Object.entries(c))
      expect(capa.hasta, nombre).toBeLessThan(capa.desde);
  });

  it('el suelo pasa a la misma velocidad que el borde de la rueda (la rueda no patina)', () => {
    const v = velocidadRueda();
    const c = capas(390);
    for (const capa of [c.carretera, c.postes]) {
      const vSuelo = (capa.desde - capa.hasta) / (capa.ms / 1000);
      expect(Math.abs(vSuelo - v) / v).toBeLessThan(0.02);
    }
    // La ciudad va lejos: más despacio que el suelo.
    expect((c.ciudad.desde - c.ciudad.hasta) / (c.ciudad.ms / 1000)).toBeLessThan(v);
  });

  it('con «reducir movimiento» la escena queda quieta', () => {
    expect(debeAnimar(true)).toBe(false);
    expect(debeAnimar(false)).toBe(true);
    // Y el componente lo pregunta al teléfono y no arranca las animaciones.
    const fuente = readFileSync(join(__dirname, 'BuscandoConductor.tsx'), 'utf8');
    expect(fuente).toContain('isReduceMotionEnabled');
    expect(fuente).toContain('reduceMotionChanged');
    expect(fuente).toMatch(/if \(!animar\) return;/);
  });

  it('la pantalla de espera del viaje usa la escena', () => {
    const fuente = readFileSync(join(__dirname, 'ViajeEnCurso.tsx'), 'utf8');
    expect(fuente).toContain('<BuscandoConductor');
  });
});
