import { describe, expect, it } from 'vitest';
import {
  abiertoPorHorario,
  esHora,
  proximaApertura,
  textoApertura,
  textoNoDisponible,
} from './horarios';

// Miércoles 14 oct 2026, 3:00 p. m. en Miami (19:00 UTC). Miércoles = día 3.
const miercoles3pm = new Date('2026-10-14T19:00:00Z');
const MIAMI = 'America/New_York';

describe('horarios del restaurante (C-HORARIOS)', () => {
  it('abierto dentro del turno, cerrado fuera, y sin turnos no se dice cerrado', () => {
    expect(
      abiertoPorHorario([{ dia: 3, abre: '11:00', cierra: '22:00' }], MIAMI, miercoles3pm),
    ).toBe(true);
    expect(
      abiertoPorHorario([{ dia: 3, abre: '18:00', cierra: '22:00' }], MIAMI, miercoles3pm),
    ).toBe(false);
    expect(
      abiertoPorHorario([{ dia: 4, abre: '11:00', cierra: '22:00' }], MIAMI, miercoles3pm),
    ).toBe(false);
    expect(abiertoPorHorario([], MIAMI, miercoles3pm)).toBe(true);
  });

  it('un turno que cierra después de medianoche sigue abierto en la madrugada', () => {
    const martesNoche = [{ dia: 2, abre: '18:00', cierra: '02:00' }];
    const miercoles1am = new Date('2026-10-14T05:00:00Z');
    expect(abiertoPorHorario(martesNoche, MIAMI, miercoles1am)).toBe(true);
    const miercoles3am = new Date('2026-10-14T07:00:00Z');
    expect(abiertoPorHorario(martesNoche, MIAMI, miercoles3am)).toBe(false);
  });

  it('dice cuándo abre: hoy más tarde, mañana, u otro día', () => {
    expect(
      proximaApertura([{ dia: 3, abre: '18:00', cierra: '22:00' }], MIAMI, miercoles3pm),
    ).toEqual({ enDias: 0, abre: '18:00' });
    expect(
      proximaApertura([{ dia: 4, abre: '11:00', cierra: '22:00' }], MIAMI, miercoles3pm),
    ).toEqual({ enDias: 1, abre: '11:00' });
    expect(
      proximaApertura([{ dia: 6, abre: '11:00', cierra: '22:00' }], MIAMI, miercoles3pm),
    ).toEqual({ enDias: 3, abre: '11:00' });
    expect(proximaApertura([], MIAMI, miercoles3pm)).toBeNull();
    expect(textoApertura({ enDias: 0, abre: '18:00' }, 'es')).toMatch(/Abre hoy a las 6:00/);
    expect(textoApertura({ enDias: 1, abre: '11:00' }, 'en')).toMatch(/Opens tomorrow at 11:00/);
  });

  it('solo acepta horas HH:MM', () => {
    expect(esHora('09:30')).toBe(true);
    expect(esHora('24:00')).toBe(false);
    expect(esHora('9:30')).toBe(false);
  });
});

describe('restaurante que no recibe (C-NO-RECIBE-AHORA)', () => {
  const todoElDia = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' }));
  // Sábado 31 oct 2026, 8:06 a. m. en Detroit.
  const manana = new Date('2026-10-31T12:06:00Z');
  it('en horario pero sin recibir: no inventa la próxima apertura', () => {
    const r = { abierto: true, horarios: todoElDia, zonaHoraria: 'America/Detroit' };
    expect(textoNoDisponible(r, 'es', manana)).toBe('No recibe pedidos ahora');
    expect(textoNoDisponible(r, 'en', manana)).toBe('Not taking orders right now');
  });
  it('fuera de horario: dice cuándo abre', () => {
    const tarde = [{ dia: 6, abre: '18:00', cierra: '22:00' }];
    const r = { abierto: true, horarios: tarde, zonaHoraria: 'America/Detroit' };
    expect(textoNoDisponible(r, 'es', manana)).toMatch(/^Abre hoy a las/);
  });
  it('cerrado a mano o sin horario: el «Cerrado» de siempre', () => {
    expect(textoNoDisponible({ abierto: false, horarios: todoElDia }, 'es', manana)).toBeNull();
    expect(textoNoDisponible({ abierto: true, horarios: [] }, 'es', manana)).toBeNull();
  });
});
