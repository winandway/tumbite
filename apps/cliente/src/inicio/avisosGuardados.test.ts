import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-AVISOS-GUARDADOS (24 nov 2026, primera carrera real): la campana del cliente muestra todo aviso
 * que le llegó al teléfono (su conductor llegó, mensajes, viaje cancelado…) con su hora. La app nueva
 * lo pide con `historial=1`; la de la tienda no lo recibe (pintaría mal un tipo que no conoce).
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8');

describe('la campana del cliente trae lo que le llegó al teléfono', () => {
  it('la app pide lo guardado', () => {
    expect(leer('inicio/useAvisos.ts')).toMatch(/historial=1/);
  });
  it('la campana pinta el aviso guardado con su título, su texto y su hora', () => {
    const s = leer('app/notifications.tsx');
    expect(s).toMatch(/esAvisoGuardado\(a\)/);
    expect(s).toMatch(/testID="aviso-guardado"/);
    expect(s).toMatch(/a\.titulo/);
    expect(s).toMatch(/a\.cuerpo/);
    expect(s).toMatch(/horaAviso\(a\.en/);
  });
});
