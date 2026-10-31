import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-LIKE-CORTO (31 oct 2026, visto cancelando un envío en el sitio de pruebas): la base de
 * producción (D1) rechaza patrones LIKE de más de 50 caracteres con «LIKE or GLOB pattern too
 * complex». Cancelar un viaje o un envío armaba «reserva_viaje:<id>:%:reservado» (60) y fallaba
 * siempre. Ningún LIKE se arma con un id largo.
 */
describe('ningún patrón LIKE pasa de 50 caracteres', () => {
  it('devolver las reservas de un viaje no usa LIKE con el id', () => {
    const f = readFileSync(join(__dirname, 'finanzas', 'conductor.ts'), 'utf8');
    const bloque = f.slice(f.indexOf('export async function devolverReservasViaje'));
    expect(bloque.slice(0, 900)).not.toMatch(/LIKE \?/);
    expect(bloque.slice(0, 900)).toContain("substr(referencia, -10) = ':reservado'");
  });
  it('el patrón viejo medía más de 50 (por eso fallaba)', () => {
    expect(`reserva_viaje:${'0'.repeat(36)}:%:reservado`.length).toBeGreaterThan(50);
  });
});
