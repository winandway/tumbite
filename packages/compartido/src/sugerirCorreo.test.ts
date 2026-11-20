import { describe, expect, it } from 'vitest';
import { sugerirCorreo } from './sugerirCorreo';

describe('C-CORREO-SUGERENCIA: «¿Quisiste decir…?» en los dominios comunes', () => {
  it('corrige los errores típicos de escritura', () => {
    expect(sugerirCorreo('ana@gmial.com')).toBe('ana@gmail.com');
    expect(sugerirCorreo('ana@gmail.con')).toBe('ana@gmail.com');
    expect(sugerirCorreo('ana@gmai.com')).toBe('ana@gmail.com');
    expect(sugerirCorreo('ana@gmail.co')).toBe('ana@gmail.com');
    expect(sugerirCorreo(' Ana@Hotmial.com ')).toBe('ana@hotmail.com');
    expect(sugerirCorreo('ana@yaho.com')).toBe('ana@yahoo.com');
    expect(sugerirCorreo('ana@outlok.com')).toBe('ana@outlook.com');
    expect(sugerirCorreo('ana@iclod.com')).toBe('ana@icloud.com');
  });
  it('C-REVISA-TUS-DATOS: corrige el final mal escrito también en dominios propios', () => {
    expect(sugerirCorreo('ana@miempresa.con')).toBe('ana@miempresa.com');
    expect(sugerirCorreo('ana@miempresa.cmo')).toBe('ana@miempresa.com');
    expect(sugerirCorreo('ana@red.nte')).toBe('ana@red.net');
    expect(sugerirCorreo('ana@fundacion.ogr')).toBe('ana@fundacion.org');
    expect(sugerirCorreo('ana@hotmial.con')).toBe('ana@hotmail.com');
    // «.co» existe (Colombia): nunca se «corrige».
    expect(sugerirCorreo('ana@miempresa.co')).toBeNull();
  });
  it('no molesta con dominios bien escritos ni con dominios propios', () => {
    expect(sugerirCorreo('ana@gmail.com')).toBeNull();
    expect(sugerirCorreo('ana@hotmail.es')).toBeNull();
    expect(sugerirCorreo('ana@miempresa.com')).toBeNull();
    expect(sugerirCorreo('ana@universidad.edu.co')).toBeNull();
    expect(sugerirCorreo('ana@gmx.com')).toBeNull();
    expect(sugerirCorreo('ana@att.net')).toBeNull();
    expect(sugerirCorreo('ana')).toBeNull();
    expect(sugerirCorreo('ana@')).toBeNull();
  });
});
