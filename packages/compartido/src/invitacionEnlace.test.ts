import { describe, expect, it } from 'vitest';
import { tokenDeEnlace } from './invitacionEnlace';

// C-INVITAR-LIDER-UN-PASO: Driver reconoce el enlace personal del líder invitado.
describe('tokenDeEnlace', () => {
  it('saca el token del enlace de la web o de la app', () => {
    expect(tokenDeEnlace('https://divoox.com/driver/?invitacion=EJEMPLO01EJEMPLO01EJ')).toBe(
      'EJEMPLO01EJEMPLO01EJ',
    );
    expect(
      tokenDeEnlace('tumbite-repartidor://registro?x=1&invitacion=EJEMPLO01EJEMPLO01EJ#a'),
    ).toBe('EJEMPLO01EJEMPLO01EJ');
  });
  it('sin enlace, o con uno raro, no hay invitación', () => {
    expect(tokenDeEnlace(null)).toBeNull();
    expect(tokenDeEnlace('https://divoox.com/driver/')).toBeNull();
    expect(tokenDeEnlace('https://divoox.com/driver/?invitacion=corto')).toBeNull();
  });
});
