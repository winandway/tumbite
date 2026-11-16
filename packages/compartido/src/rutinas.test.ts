import { describe, expect, it } from 'vitest';
import {
  diaSemana,
  enPausa,
  esquemaRutina,
  instanteLocal,
  proximasSalidas,
  siguienteSalida,
} from './rutinas';

/** C-VIAJES-FIJOS (16 nov 2026, todos los países): los horarios de los viajes fijos. */
describe('C-VIAJES-FIJOS · horarios', () => {
  it('la hora local de la ciudad, con y sin horario de verano', () => {
    // Venezuela no cambia la hora: 07:00 en El Vigía = 11:00 UTC.
    expect(instanteLocal('2026-11-17', '07:00', 'America/Caracas').toISOString()).toBe(
      '2026-11-17T11:00:00.000Z',
    );
    // Novi (Michigan): en noviembre UTC-5, en julio UTC-4.
    expect(instanteLocal('2026-11-17', '07:00', 'America/Detroit').toISOString()).toBe(
      '2026-11-17T12:00:00.000Z',
    );
    expect(instanteLocal('2026-07-15', '07:00', 'America/Detroit').toISOString()).toBe(
      '2026-07-15T11:00:00.000Z',
    );
  });

  it('día de la semana ISO (lunes = 1)', () => {
    expect(diaSemana('2026-11-16')).toBe(1);
    expect(diaSemana('2026-11-22')).toBe(7);
  });

  it('de lunes a viernes, ida a las 07:00 y vuelta a las 12:00, en orden', () => {
    const r = { dias: [1, 2, 3, 4, 5], horaIda: '07:00', horaVuelta: '12:00' };
    // Domingo 16 nov 2026 a las 20:00 en Caracas.
    const desde = new Date('2026-11-16T00:00:00Z');
    const s = proximasSalidas(r, 'America/Caracas', desde, new Date('2026-11-18T00:00:00Z'));
    expect(s.map((x) => `${x.fecha} ${x.sentido}`)).toEqual([
      '2026-11-16 ida',
      '2026-11-16 vuelta',
      '2026-11-17 ida',
      '2026-11-17 vuelta',
    ]);
    // El sábado y el domingo no hay.
    const finde = proximasSalidas(
      r,
      'America/Caracas',
      new Date('2026-11-21T00:00:00Z'),
      new Date('2026-11-23T03:00:00Z'),
    );
    expect(finde).toHaveLength(0);
    expect(siguienteSalida(r, 'America/Caracas', new Date('2026-11-21T00:00:00Z'))?.fecha).toBe(
      '2026-11-23',
    );
  });

  it('la pausa con fecha incluye ese día; sin fecha, hasta reanudar', () => {
    expect(enPausa('pausada', '2026-11-20', '2026-11-20')).toBe(true);
    expect(enPausa('pausada', '2026-11-20', '2026-11-21')).toBe(false);
    expect(enPausa('pausada', null, '2027-01-01')).toBe(true);
    expect(enPausa('activa', null, '2026-11-20')).toBe(false);
  });

  it('valida: la vuelta después de la ida, el envío con paquete y sin menor, días sin repetir', () => {
    const base = {
      nombre: 'Al trabajo',
      servicio: 'moto',
      origen: { lat: 8.6, lng: -71.6, direccion: 'Casa' },
      destino: { lat: 8.61, lng: -71.61, direccion: 'Trabajo' },
      dias: [5, 1, 1],
      horaIda: '07:30',
    };
    expect(esquemaRutina.parse(base).dias).toEqual([1, 5]);
    expect(esquemaRutina.safeParse({ ...base, horaVuelta: '07:00' }).success).toBe(false);
    expect(esquemaRutina.safeParse({ ...base, servicio: 'envios' }).success).toBe(false);
    expect(esquemaRutina.safeParse({ ...base, horaIda: '25:00' }).success).toBe(false);
    expect(
      esquemaRutina.safeParse({ ...base, menor: { nombre: 'Sofía', pin: '12a4' } }).success,
    ).toBe(false);
  });
});
