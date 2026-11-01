import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alcoholPermitido, estadoDeZona } from './horarioAlcohol';

/**
 * C-ALCOHOL-HORARIO (1 nov 2026): como DoorDash y Uber Eats, el alcohol solo se pide en las horas
 * legales del estado. Florida (§ 562.14): de 7:00 a medianoche. Michigan (MCL 436.2113/2114): de 7:00
 * a 2:00; el domingo desde el mediodía (la mañana pide permiso aparte). Otro lugar: de 8:00 a 22:00.
 */
const en = (iso: string) => new Date(iso);

describe('horario legal del alcohol', () => {
  it('saca el estado de la zona', () => {
    expect(estadoDeZona('US-FL-MIAMI')).toBe('US-FL');
    expect(estadoDeZona('US-MI-NOVI')).toBe('US-MI');
  });
  it('Florida: de 7:00 a medianoche', () => {
    const z = 'America/New_York';
    expect(alcoholPermitido('US-FL-MIAMI', z, en('2026-11-04T11:30:00Z')).ok).toBe(false); // 6:30
    expect(alcoholPermitido('US-FL-MIAMI', z, en('2026-11-04T12:05:00Z')).ok).toBe(true); // 7:05
    expect(alcoholPermitido('US-FL-MIAMI', z, en('2026-11-05T04:59:00Z')).ok).toBe(true); // 23:59
    const tarde = alcoholPermitido('US-FL-MIAMI', z, en('2026-11-05T05:30:00Z')); // 0:30
    expect(tarde.ok).toBe(false);
    expect(tarde.abre).toBe('07:00');
  });
  it('Michigan: hasta las 2:00 y el domingo desde el mediodía', () => {
    const z = 'America/Detroit';
    expect(alcoholPermitido('US-MI-NOVI', z, en('2026-11-05T06:30:00Z')).ok).toBe(true); // jue 1:30
    expect(alcoholPermitido('US-MI-NOVI', z, en('2026-11-05T07:30:00Z')).ok).toBe(false); // 2:30
    const domingo = alcoholPermitido('US-MI-NOVI', z, en('2026-11-08T15:00:00Z')); // dom 10:00
    expect(domingo.ok).toBe(false);
    expect(domingo.abre).toBe('12:00');
    expect(alcoholPermitido('US-MI-NOVI', z, en('2026-11-08T17:30:00Z')).ok).toBe(true);
  });
  it('un lugar sin reglas cargadas usa el horario prudente de 8:00 a 22:00', () => {
    const z = 'America/Bogota';
    expect(alcoholPermitido('CO-BOG-BOGOTA', z, en('2026-11-04T12:30:00Z')).ok).toBe(false); // 7:30
    expect(alcoholPermitido('CO-BOG-BOGOTA', z, en('2026-11-04T20:00:00Z')).ok).toBe(true);
  });
});

describe('la tienda en la app respeta la hora legal', () => {
  const tienda = readFileSync(
    join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src', 'app', 'store', '[id].tsx'),
    'utf8',
  );
  it('fuera de hora, el alcohol dice desde cuándo y no se puede agregar', () => {
    expect(tienda).toContain('ficha?.alcohol?.ok === false');
    expect(tienda).toContain("p.restriccion === 'alcohol' && sinAlcohol");
    expect(tienda).toContain('testID="alcohol-desde"');
  });
});
