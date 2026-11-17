import { describe, expect, it } from 'vitest';
import {
  direccionDelSitio,
  esPlusCode,
  limpiarDetalles,
  lineaReferencia,
  seMovio,
  textosPuntoExacto,
} from './puntoExacto';

// C-PUNTO-EXACTO (16 nov 2026): la dirección que sale del pin y los textos de la pantalla.
describe('C-PUNTO-EXACTO', () => {
  it('nunca muestra un plus code como dirección (El Vigía devolvía «CQPG+7F2»)', () => {
    expect(esPlusCode('CQPG+7F2')).toBe(true);
    expect(esPlusCode('Av. Don Pepe Rojas')).toBe(false);
    expect(direccionDelSitio({ name: 'CQPG+7F2', city: 'El Vigía', region: 'Mérida' })).toBe(
      'El Vigía, Mérida',
    );
  });

  it('arma calle y número, sector, ciudad y estado, sin repetir', () => {
    expect(
      direccionDelSitio({
        street: 'Avenida Don Pepe Rojas',
        streetNumber: '45',
        district: 'Centro',
        city: 'El Vigía',
        subregion: 'El Vigía',
        region: 'Mérida',
      }),
    ).toBe('Avenida Don Pepe Rojas 45, Centro, El Vigía, Mérida');
    expect(direccionDelSitio(null)).toBe('');
  });

  it('solo vuelve a leer la calle si el mapa se movió de verdad', () => {
    expect(seMovio(null, { lat: 1, lng: 1 })).toBe(true);
    expect(seMovio({ lat: 1, lng: 1 }, { lat: 1.00001, lng: 1 })).toBe(false);
    expect(seMovio({ lat: 1, lng: 1 }, { lat: 1.0002, lng: 1 })).toBe(true);
  });

  it('referencia y casa son opcionales, limpias y con su largo', () => {
    expect(limpiarDetalles({})).toEqual({ referencia: '', apto: '' });
    expect(
      limpiarDetalles({ referencia: '  frente a la   panadería ', apto: 'x'.repeat(80) }),
    ).toEqual({ referencia: 'frente a la panadería', apto: 'x'.repeat(60) });
    expect(lineaReferencia({ referencia: 'Frente a la panadería', apto: 'Casa 12' })).toBe(
      'Casa 12 · Frente a la panadería',
    );
    expect(lineaReferencia({ referencia: '', apto: null })).toBe('');
  });

  it('los textos están en los dos idiomas y el botón no dice «ubicación»', () => {
    for (const i of ['es', 'en'] as const) {
      const t = textosPuntoExacto(i);
      expect(t.confirmar).toBeTruthy();
      expect(t.estoyAqui.toLowerCase()).not.toMatch(/ubicaci|location/);
    }
    expect(textosPuntoExacto('es').confirmar).toBe('Confirmar este punto');
    expect(textosPuntoExacto('es').estoyAqui).toBe('Estoy aquí');
  });
});
