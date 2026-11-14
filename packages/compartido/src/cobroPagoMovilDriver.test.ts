import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PAGO-MOVIL-UNA-CORRECCION (14 nov 2026, Venezuela): en Driver, un pedido por pago móvil muestra
 * solo «Sí, me llegó» / «No me llegó»; «Cobré» y la casilla del monto son del efectivo. Antes salían
 * los dos a la vez y el «Cobré» servía para saltarse la corrección única del «no me llegó».
 */
describe('C-PAGO-MOVIL-UNA-CORRECCION en Driver', () => {
  it('«Cobré» va solo cuando NO es pago móvil, y el pago móvil solo con su sí o no', () => {
    const s = readFileSync(
      join(__dirname, '..', '..', '..', 'apps', 'repartidor', 'src', 'Inicio.tsx'),
      'utf8',
    );
    const bloque = s.slice(s.indexOf('testID="cobro-directo"'));
    const efectivo = bloque.indexOf('{!pagoMovilActivo ? (');
    const cobre = bloque.indexOf('texto={tg.pedido.cobre}');
    const pagoMovil = bloque.indexOf('{pagoMovilActivo ? (');
    const si = bloque.indexOf('texto={tg.pedido.pagoMovilSi}');
    expect(efectivo).toBeGreaterThan(-1);
    expect(cobre).toBeGreaterThan(efectivo);
    expect(pagoMovil).toBeGreaterThan(cobre);
    expect(si).toBeGreaterThan(pagoMovil);
  });
});
