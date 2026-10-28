import { describe, expect, it } from 'vitest';
import {
  codigoPlus,
  documentoValido,
  perfilFlex,
  puedeEntrarARuta,
  telefonoInternacional,
} from './flexPaises';

describe('Flex · cada país es su propio sistema', () => {
  it('Venezuela exige ubicación confirmada, cédula y referencias; EE. UU. no', () => {
    expect(perfilFlex('VE')).toMatchObject({
      ubicacion: 'confirmada',
      appDestinatario: 'esperada',
      referenciasObligatorias: true,
      cobroContraEntrega: true,
    });
    expect(documentoValido('VE', 'V-12345678')).toBe(true);
    expect(documentoValido('VE', 'J-12345678-9')).toBe(true);
    expect(documentoValido('VE', '12345678')).toBe(false);
    expect(documentoValido('US', '')).toBe(true);
    expect(perfilFlex('US')).toMatchObject({ ubicacion: 'recomendada', cobroContraEntrega: false });
    expect(perfilFlex('XX').pais).toBe('US');
  });

  it('en Venezuela un envío sin ubicación confirmada no entra a ruta', () => {
    expect(puedeEntrarARuta('VE', { ubicacionEstado: 'pendiente', lat: null, lng: null })).toEqual({
      ok: false,
      motivo: 'sin_ubicacion_confirmada',
    });
    // La dirección escrita con coordenadas sueltas no basta: tiene que estar confirmada.
    expect(
      puedeEntrarARuta('VE', { ubicacionEstado: 'sin_coordenadas', lat: 10, lng: -66 }).ok,
    ).toBe(false);
    expect(puedeEntrarARuta('VE', { ubicacionEstado: 'confirmada', lat: 10, lng: -66 }).ok).toBe(
      true,
    );
    expect(puedeEntrarARuta('US', { ubicacionEstado: 'pendiente', lat: null, lng: null }).ok).toBe(
      true,
    );
  });

  it('encuentra el mismo teléfono escrito de varias formas', () => {
    expect(telefonoInternacional('0414-123.45.67', 'VE')).toBe('584141234567');
    expect(telefonoInternacional('+58 414 1234567', 'VE')).toBe('584141234567');
    expect(telefonoInternacional('4141234567', 'VE')).toBe('584141234567');
    expect(telefonoInternacional('(305) 555-0100', 'US')).toBe('13055550100');
    expect(telefonoInternacional('', 'US')).toBe('');
  });
});

describe('código plus en la etiqueta', () => {
  it('coincide con los valores de prueba del estándar abierto', () => {
    expect(codigoPlus(20.3700625, 2.7821875)).toBe('7FG49QCJ+2V');
    expect(codigoPlus(47.0000625, 8.0000625)).toBe('8FVC2222+22');
    expect(codigoPlus(-41.2730625, 174.7859375)).toBe('4VCPPQGP+Q9');
  });
  it('da un código válido en Caracas', () => {
    expect(codigoPlus(10.4806, -66.9036)).toMatch(
      /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/,
    );
  });
});
