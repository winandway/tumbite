import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** C-TELEFONO-VUELTA (D8): la app Driver muestra la tarjeta del código cuando el servidor la pide. */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('Driver: confirmar el teléfono al volver', () => {
  it('la tarjeta pide el código por SMS y lo confirma', () => {
    const tarjeta = leer('apps', 'repartidor', 'src', 'ConfirmarTelefono.tsx');
    expect(tarjeta).toContain('/datos/repartidor/telefono/codigo');
    expect(tarjeta).toContain('/datos/repartidor/telefono/verificar');
    expect(tarjeta).toContain('textContentType="oneTimeCode"');
  });
  it('el inicio la muestra con telefonoPorVerificar', () => {
    const inicio = leer('apps', 'repartidor', 'src', 'Inicio.tsx');
    expect(inicio).toMatch(/estado\?\.telefonoPorVerificar \? \(\s*<ConfirmarTelefono/);
  });
});
