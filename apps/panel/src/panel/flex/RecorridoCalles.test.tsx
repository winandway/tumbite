import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textoDuracion, textoKm } from './RecorridoCalles';

/** C-FLEX-RUTA-CALLES en el panel: los números se leen como en la vida real. */
describe('C-FLEX-RUTA-CALLES · panel', () => {
  it('km con un decimal según el idioma y duración en horas y minutos', () => {
    expect(textoKm(18_250, 'es')).toBe('18,3');
    expect(textoKm(18_250, 'en')).toBe('18.3');
    expect(textoDuracion(2880)).toBe('48 minutos');
    expect(textoDuracion(5400)).toBe('1 hora y 30 minutos');
    expect(textoDuracion(5400, 'en')).toBe('1 hour and 30 minutes');
  });

  it('«Llegada estimada» numera las paradas una sola vez (la lista ya va numerada)', () => {
    const s = readFileSync(join(__dirname, 'PantallasRutas.tsx'), 'utf8');
    const bloque = s.slice(s.indexOf('<RecorridoCalles'), s.indexOf('puedeCalcular='));
    expect(bloque).not.toMatch(/p\.orden/);
  });
});
