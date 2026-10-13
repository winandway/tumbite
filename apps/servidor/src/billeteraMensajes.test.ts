import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-BILLETERA-MENSAJES (13 oct 2026, lo destapó el recorrido): en la billetera del
 * repartidor, «Retirar a mi banco» no mostraba ni la confirmación ni el error; solo salían en la
 * pantalla de inicio. El resultado de un botón se ve donde se tocó.
 */
describe('billetera del repartidor', () => {
  it('muestra el aviso y el error en la misma pantalla de la billetera', () => {
    const inicio = readFileSync(
      join(__dirname, '..', '..', 'repartidor', 'src', 'Inicio.tsx'),
      'utf8',
    );
    expect(inicio).toMatch(/\{menuCabecera\}\s*\{mensajes\}\s*<BilleteraRepartidor/);
  });
});
