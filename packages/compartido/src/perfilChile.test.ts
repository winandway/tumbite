import { describe, expect, it } from 'vitest';
import { DECIMALES_MONEDA, formatearMonto } from './dinero';
import { numeroFiscalDe, numeroFiscalValido } from './flexPaises';
import { PERFIL_CHILE, rutValido, telefonoChileValido } from './perfilChile';

/**
 * C-PERFIL-CHILE (10 nov 2026, punto B4) — Chile. El perfil del país en una sola pieza, APAGADO:
 * no enciende nada hasta que Richard abra la cuenta de cobro local.
 * Ficha: docs/investigaciones-rea/2026-11-10-perfil-chile.md.
 */
describe('perfil de Chile (apagado)', () => {
  it('nace apagado y sin procesador de cobro: no se puede encender por accidente', () => {
    expect(PERFIL_CHILE.activo).toBe(false);
    expect(PERFIL_CHILE.cobro.procesador).toBeNull();
    expect(PERFIL_CHILE.codigo).toBe('CL');
  });

  it('el peso chileno no lleva decimales', () => {
    expect(PERFIL_CHILE.moneda).toBe('CLP');
    expect(DECIMALES_MONEDA.get('CLP')).toBe(0);
    expect(formatearMonto(12990, 'CLP', 'es').replace(/\s/g, ' ')).toMatch(/12\.990/);
    expect(() => formatearMonto(1.5, 'CLP', 'es')).toThrow();
  });

  it('valida el RUT con su dígito verificador', () => {
    expect(rutValido('11.111.111-1')).toBe(true);
    expect(rutValido('12345678-5')).toBe(true);
    expect(rutValido('6-K')).toBe(true);
    expect(rutValido('12345678-9')).toBe(false);
    expect(rutValido('abc')).toBe(false);
    expect(numeroFiscalDe('CL').nombre).toBe('RUT');
    expect(numeroFiscalValido('CL', '76.086.428-5')).toBe(true);
    expect(numeroFiscalValido('CL', '76.086.428-0')).toBe(false);
  });

  it('el celular es +56 9 y ocho cifras', () => {
    expect(telefonoChileValido('+56 9 1234 5678')).toBe(true);
    expect(telefonoChileValido('912345678')).toBe(true);
    expect(telefonoChileValido('+56 2 1234 5678')).toBe(false);
    expect(PERFIL_CHILE.telefono.prefijo).toBe('+56');
  });

  it('pide comuna y región en la dirección, y lista los documentos de restaurante y repartidor', () => {
    expect(PERFIL_CHILE.direccion.campos).toEqual(['calle', 'numero', 'comuna', 'region']);
    expect(PERFIL_CHILE.documentos.restaurante.map((d) => d.id)).toContain('resolucion_sanitaria');
    expect(PERFIL_CHILE.documentos.repartidor.map((d) => d.id)).toContain('cedula');
    expect(PERFIL_CHILE.impuesto).toEqual({
      nombre: 'IVA',
      porcentaje: 19,
      incluidoEnPrecio: true,
    });
  });
});
