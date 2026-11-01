import { describe, expect, it } from 'vitest';
import { numeroFiscalDe, numeroFiscalValido } from './flexPaises';

/** C-EMPRESA-LEGAL (LG1): el número fiscal de la empresa se valida según su país. */
describe('número fiscal por país', () => {
  it('EE. UU. pide el EIN de 9 dígitos', () => {
    expect(numeroFiscalDe('US').nombre).toBe('EIN');
    expect(numeroFiscalValido('US', '12-3456789')).toBe(true);
    expect(numeroFiscalValido('US', '12345')).toBe(false);
  });
  it('Venezuela pide el RIF', () => {
    expect(numeroFiscalValido('VE', 'J-12345678-9')).toBe(true);
    expect(numeroFiscalValido('VE', 'X-12345678-9')).toBe(false);
  });
  it('Colombia pide el NIT y México el RFC', () => {
    expect(numeroFiscalValido('CO', '900.123.456-7')).toBe(true);
    expect(numeroFiscalValido('MX', 'ABC123456XY1')).toBe(true);
    expect(numeroFiscalValido('MX', '123')).toBe(false);
  });
});
