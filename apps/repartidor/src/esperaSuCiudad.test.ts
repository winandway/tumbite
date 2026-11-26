import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ErrorApi } from '@tumbite/compartido';
import { esperaSuCiudad } from './esperaSuCiudad';

describe('C-REGISTRO-TODO-EL-PAIS: conectarse mientras espera su ciudad', () => {
  it('reconoce el 409 «en_espera_ciudad» y nada más', () => {
    expect(esperaSuCiudad(new ErrorApi('x', 409, 'ciudad', { codigo: 'en_espera_ciudad' }))).toBe(
      true,
    );
    expect(esperaSuCiudad(new ErrorApi('x', 409, 'ciudad', { codigo: 'otro' }))).toBe(false);
    expect(esperaSuCiudad(new ErrorApi('x', 422, 'ciudad', { codigo: 'en_espera_ciudad' }))).toBe(
      false,
    );
  });

  it('Driver lo muestra con calma en las dos formas de conectarse (no como error rojo)', () => {
    const inicio = readFileSync(join(__dirname, 'Inicio.tsx'), 'utf8');
    expect(inicio.match(/esperaSuCiudad\(x\)/g)?.length).toBe(2);
    expect(inicio).toContain("testID={motivoConexion.calma ? 'motivo-espera-ciudad' : undefined}");
  });
});
