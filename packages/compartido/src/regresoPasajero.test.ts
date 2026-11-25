import { describe, expect, it } from 'vitest';
import {
  AJUSTES_REGRESO_INICIALES,
  diferenciaRumbo,
  elegirConRegreso,
  rumboHaciaCasa,
} from './modoDestino';

/**
 * C-REGRESO-PASAJERO, prueba de aceptación 1 de la ficha: el viaje tiene que ir HACIA su casa (45° o
 * menos) y acercarlo 5 km o más. En el ecuador un grado son ~111 km y el plano local no se deforma,
 * así los ángulos de la prueba son exactos.
 */
const conductor = { lat: 0, lng: 0 };
const casa = { lat: 0, lng: 1 }; // ~111 km al este
const KM = 1 / 111.195; // un kilómetro en grados, en el ecuador

describe('rumbo hacia casa (C-REGRESO-PASAJERO)', () => {
  it('un viaje hacia casa que lo acerca 6 km pasa; uno que lo acerca 3 km, no', () => {
    const recogida = { lat: 0, lng: 0.005 };
    expect(rumboHaciaCasa(conductor, recogida, { lat: 0, lng: 6 * KM }, casa)).toBe(true);
    expect(rumboHaciaCasa(conductor, recogida, { lat: 0, lng: 3 * KM }, casa)).toBe(false);
  });

  it('casi perpendicular (68°) no pasa aunque lo deje más cerca; en contra, tampoco', () => {
    // Lo deja a 55 km de casa (acerca más de 50 km), pero el viaje va casi hacia el norte.
    expect(rumboHaciaCasa(conductor, { lat: -0.5, lng: 0.3 }, { lat: 0, lng: 0.5 }, casa)).toBe(
      false,
    );
    expect(rumboHaciaCasa(conductor, conductor, { lat: 0.5, lng: 0 }, casa)).toBe(false);
    expect(rumboHaciaCasa(conductor, conductor, { lat: 0, lng: -0.5 }, casa)).toBe(false);
  });

  it('justo en 45° pasa; con un tope de 44° ya no', () => {
    const destino = { lat: 0.5, lng: 0.5 };
    expect(rumboHaciaCasa(conductor, conductor, destino, casa)).toBe(true);
    expect(
      rumboHaciaCasa(conductor, conductor, destino, casa, {
        ...AJUSTES_REGRESO_INICIALES,
        anguloMaximo: 44,
      }),
    ).toBe(false);
  });

  it('la diferencia de rumbos da la vuelta por el norte', () => {
    expect(diferenciaRumbo(350, 10)).toBe(20);
    expect(diferenciaRumbo(-170, 170)).toBe(20);
    expect(diferenciaRumbo(0, 180)).toBe(180);
  });
});

describe('prioridad al que va de regreso (C-REGRESO-PASAJERO)', () => {
  type C = { id: string; km: number; visto?: boolean; regreso?: boolean };
  const va = (c: C) => Boolean(c.regreso);
  it('pasa adelante si su recogida está a no más de la del más cercano + 3 km', () => {
    const lista: C[] = [
      { id: 'cerca', km: 1 },
      { id: 'regreso', km: 3, regreso: true },
    ];
    expect(elegirConRegreso(lista, va, () => 3)?.id).toBe('regreso');
  });
  it('más lejos que eso, manda la cercanía', () => {
    const lista: C[] = [
      { id: 'cerca', km: 1 },
      { id: 'regreso', km: 6, regreso: true },
    ];
    expect(elegirConRegreso(lista, va, () => 3)?.id).toBe('cerca');
  });
  it('no salta a quien todavía no vio la oferta', () => {
    const lista: C[] = [
      { id: 'nuevo', km: 2 },
      { id: 'regreso', km: 1, regreso: true, visto: true },
    ];
    expect(elegirConRegreso(lista, va, () => 3)?.id).toBe('nuevo');
  });
  it('sin nadie de regreso, el orden de siempre; sin nadie, nada', () => {
    const lista: C[] = [
      { id: 'a', km: 1 },
      { id: 'b', km: 2 },
    ];
    expect(elegirConRegreso(lista, va, () => 3)?.id).toBe('a');
    expect(elegirConRegreso<C>([], va, () => 3)).toBeUndefined();
  });
});
