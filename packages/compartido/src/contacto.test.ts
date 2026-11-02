import { describe, expect, it } from 'vitest';
import { sugerirCorreo } from './contacto';

describe('C-CONTACTO: sugerir el correo bien escrito', () => {
  it('corrige los dominios comunes mal escritos', () => {
    expect(sugerirCorreo('ana@gmial.com')).toBe('ana@gmail.com');
    expect(sugerirCorreo('Ana@Hotmial.com')).toBe('ana@hotmail.com');
    expect(sugerirCorreo('ana@gmail.con')).toBe('ana@gmail.com');
    expect(sugerirCorreo('ana@yaho.com')).toBe('ana@yahoo.com');
  });
  it('no toca los correos bien escritos ni los de empresa', () => {
    expect(sugerirCorreo('ana@gmail.com')).toBeNull();
    expect(sugerirCorreo('ana@windoce.com')).toBeNull();
    expect(sugerirCorreo('sin-arroba')).toBeNull();
  });
});
