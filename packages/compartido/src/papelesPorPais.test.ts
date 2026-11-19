import { describe, expect, it } from 'vitest';
import { ayudaSeguroPais, nombrePapelPais, nombreRequisitoPais } from './papelesPorPais';
import { perfilPasajeros } from './perfilPasajeros';

/** C-PAPELES-POR-PAIS (19 nov 2026 — Perú). */
describe('C-PAPELES-POR-PAIS: los papeles se llaman como en el país del conductor', () => {
  it('en Perú se piden SOAT, tarjeta de identificación vehicular, CITV y licencia por clase', () => {
    expect(nombrePapelPais('PE', 'moto', 'seguro', 'es')).toBe('SOAT o CAT vigente');
    expect(nombrePapelPais('pe', 'carro', 'registro', 'es')).toBe(
      'Tarjeta de identificación vehicular',
    );
    expect(nombrePapelPais('PE', 'carro', 'inspeccion', 'es')).toContain('CITV');
    expect(nombrePapelPais('PE', 'moto', 'licencia_moto', 'es')).toContain('B-IIc');
    expect(nombrePapelPais('PE', 'carro', 'licencia_conducir', 'en')).toContain('A-IIa');
    expect(nombreRequisitoPais('PE', 'carro', 'inspeccion_vehiculo', 'es')).toContain('CITV');
    expect(ayudaSeguroPais('PE', 'moto', 'en')).toContain('SOAT');
  });
  it('todo papel que el perfil de Perú le pide al conductor tiene su nombre peruano, en los dos idiomas', () => {
    const p = perfilPasajeros('PE');
    for (const [servicio, tipos] of [
      ['moto', p.documentosConductor],
      ['carro', p.documentosCarro],
    ] as const)
      for (const tipo of tipos)
        for (const idioma of ['es', 'en'])
          expect(nombrePapelPais('PE', servicio, tipo, idioma), `${servicio} ${tipo}`).toBeTruthy();
  });
  it('un país sin nombres propios deja el de siempre (null), y nada de Perú se cuela en Venezuela', () => {
    expect(nombrePapelPais('VE', 'moto', 'seguro', 'es')).toBeNull();
    expect(nombrePapelPais('US', 'carro', 'registro', 'en')).toBeNull();
    expect(nombrePapelPais(null, 'moto', 'seguro', 'es')).toBeNull();
    expect(nombrePapelPais('PE', 'moto', 'papel_que_no_existe', 'es')).toBeNull();
    expect(ayudaSeguroPais('VE', 'moto', 'es')).toBeNull();
  });
});
