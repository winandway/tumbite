import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PLUS-SOLO-EEUU (14 nov 2026, Venezuela y EE. UU.): Plus y el saldo de regalo valen solo en
 * Estados Unidos (el servidor usa enEeuu). Venezuela también cobra en dólares: si la app los decidiera
 * por la moneda, en El Vigía mostraría un descuento que el servidor no aplica.
 */
describe('C-PLUS-SOLO-EEUU: el carrito decide Plus y regalo por el país, no por la moneda', () => {
  const cart = readFileSync(
    join(__dirname, '..', '..', 'cliente', 'src', 'app', 'cart.tsx'),
    'utf8',
  );
  it('usa lo que dice el servidor (tarjetaActiva = Estados Unidos)', () => {
    expect(cart).toContain("const enEeuu = pais?.tarjetaActiva ?? moneda === 'USD';");
  });
  it('ni Plus ni el saldo de regalo miran la moneda', () => {
    expect(cart).not.toMatch(/plusVigente &&\s*moneda === 'USD'/);
    expect(cart).not.toMatch(/saldoRegaloCli > 0 && moneda === 'USD'/);
  });
});
