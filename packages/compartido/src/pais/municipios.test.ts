import { describe, expect, it } from 'vitest';
import { claveMunicipio, resolverMunicipio, sugerenciasMunicipio } from './territorio';

/** C-ZONA-MUNICIPIO (24 nov 2026): la lista sugerida de municipios de cada país y cómo se lee lo escrito. */
describe('C-ZONA-MUNICIPIO · municipios sugeridos por país', () => {
  it('Venezuela sugiere los municipios oficiales, con El Vigía y Tucaní de Mérida primero', () => {
    const s = sugerenciasMunicipio('VE', 'MER');
    const etiquetas = s.map((x) => x.etiqueta);
    expect(etiquetas).toContain('Alberto Adriani (El Vigía), Mérida');
    expect(etiquetas).toContain('Caracciolo Parra Olmedo (Tucaní), Mérida');
    // La región de la zona va primero: las dos primeras son de Mérida.
    expect(s.slice(0, 2).every((x) => x.entidad === 'Mérida')).toBe(true);
    expect(s.length).toBeGreaterThan(300);
  });

  it('un país sin territorio cargado no inventa sugerencias', () => {
    expect(sugerenciasMunicipio('US')).toEqual([]);
  });

  it('lo escrito se reconoce por el nombre oficial, el pueblo o la etiqueta; si no, queda a mano', () => {
    expect(resolverMunicipio('VE', 'el vigia')).toEqual({
      nombre: 'Alberto Adriani',
      pcode: 'VE1401',
    });
    expect(resolverMunicipio('VE', 'Tucaní')).toEqual({
      nombre: 'Caracciolo Parra Olmedo',
      pcode: 'VE1407',
    });
    expect(resolverMunicipio('VE', 'Alberto Adriani (El Vigía), Mérida').pcode).toBe('VE1401');
    expect(resolverMunicipio('VE', '  Municipio   Nuevo ')).toEqual({
      nombre: 'Municipio Nuevo',
      pcode: null,
    });
    expect(resolverMunicipio('US', 'Oakland County')).toEqual({
      nombre: 'Oakland County',
      pcode: null,
    });
    expect(resolverMunicipio('VE', '')).toEqual({ nombre: '', pcode: null });
  });

  it('la clave del filtro no lleva espacios ni acentos (cabe en los filtros guardados)', () => {
    expect(claveMunicipio('Caracciolo Parra Olmedo')).toBe('caracciolo-parra-olmedo');
    expect(claveMunicipio('Rivas Dávila')).toBe('rivas-davila');
  });
});
