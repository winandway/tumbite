import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CARRITO-NO-SE-BORRA-SOLO (31 oct 2026): la pantalla del pedido vaciaba el carrito en cada vuelta
 * del seguimiento (cada 5 segundos). Abierta detrás, borraba lo que dejaba «Pedir otra vez» o un
 * carrito nuevo. Solo se vacía una vez y solo al llegar recién pagado (?nuevo=1).
 */
const fuente = readFileSync(
  join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src', 'app', 'order', '[id].tsx'),
  'utf8',
);

describe('el seguimiento no borra el carrito', () => {
  it('vacía una sola vez y solo recién pagado', () => {
    expect(fuente).not.toMatch(/if \(r\.pedido\.estado !== 'pago_pendiente'\) vaciar\(\);/);
    expect(fuente).toMatch(/nuevo && !carritoVaciado\.current/);
  });
});
