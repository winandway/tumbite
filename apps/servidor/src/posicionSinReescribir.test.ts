import { describe, expect, it } from 'vitest';
import { hayQueReescribirPosicion } from './rutas/operacion';

// C-POSICION-SIN-REESCRIBIR: la ficha del repartidor no se reescribe con cada lectura del GPS.
describe('C-POSICION-SIN-REESCRIBIR', () => {
  const ahora = Date.parse('2026-11-09T12:00:00Z');
  const ficha = { lat: 42.5254, lng: -83.4662, ubicacion_en: '2026-11-09 11:59:50' };

  it('quieto y con posición reciente: no escribe', () => {
    expect(hayQueReescribirPosicion(ficha, { lat: 42.52541, lng: -83.46621 }, ahora)).toBe(false);
  });
  it('se movió 25 m o más: escribe', () => {
    expect(hayQueReescribirPosicion(ficha, { lat: 42.5258, lng: -83.4662 }, ahora)).toBe(true);
  });
  it('quieto pero la última posición tiene un minuto: escribe para seguir vivo', () => {
    const vieja = { ...ficha, ubicacion_en: '2026-11-09 11:58:59' };
    expect(hayQueReescribirPosicion(vieja, { lat: 42.5254, lng: -83.4662 }, ahora)).toBe(true);
  });
  it('sin posición previa: escribe', () => {
    expect(hayQueReescribirPosicion({}, { lat: 42.5254, lng: -83.4662 }, ahora)).toBe(true);
  });
});
