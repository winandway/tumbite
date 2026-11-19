import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-AGENTE-DIVOOX (18 nov 2026): «Cobrar en efectivo» vive en Ganancias de Divoox Driver, no aparece
 * si la ciudad no tiene el servicio (C-SOLO-LO-TERMINADO) y el borrador del monto es del conductor.
 */
describe('Cobrar en efectivo en Divoox Driver', () => {
  const s = readFileSync(join(import.meta.dirname, 'CobrarEfectivo.tsx'), 'utf8');
  const inicio = readFileSync(join(import.meta.dirname, '..', 'Inicio.tsx'), 'utf8');
  it('está en Ganancias y refresca el saldo al cambiar', () => {
    expect(inicio).toMatch(/<CobrarEfectivo\s/);
    expect(inicio).toMatch(/alCambiar=\{\(\) => void cargarPrepago\(\)\}/);
  });
  it('sin el servicio en la ciudad y sin cobros anteriores no muestra nada', () => {
    expect(s).toMatch(
      /if \(!e \|\| \(!e\.disponible && !e\.vivo && e\.historial\.length === 0\)\) return null;/,
    );
  });
  it('en dólares solo deja pedir montos enteros y el borrador es de la cuenta', () => {
    expect(s).toMatch(/e\.pagaEn === 'VES' \|\| monto % 100 === 0/);
    expect(s).toMatch(/formulario: 'driver-cobrar-efectivo',\s+cuenta,/);
  });
  it('cancelar el código pide confirmación', () => {
    expect(s).toMatch(/setCancelando\(true\)/);
    expect(s).toMatch(/siCancelar/);
  });
});
