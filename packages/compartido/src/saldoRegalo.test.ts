import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { saldoAplicable } from './saldoRegalo';

// C-TARJETAS-REGALO: el saldo nunca paga la propina y deja el mínimo de Stripe a la tarjeta.
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('C-TARJETAS-REGALO: saldo aplicable', () => {
  it('cubre hasta el total sin propina', () => {
    expect(saldoAplicable({ totalCliente: 3000, propina: 300 }, 5000)).toBe(2700);
    expect(saldoAplicable({ totalCliente: 3000, propina: 300 }, 1000)).toBe(1000);
  });
  it('sin propina deja 50 centavos para la tarjeta', () => {
    expect(saldoAplicable({ totalCliente: 2000, propina: 0 }, 5000)).toBe(1950);
  });
  it('el carrito usa la misma cuenta y manda usarSaldoRegalo', () => {
    const carrito = leer('apps', 'cliente', 'src', 'app', 'cart.tsx');
    expect(carrito).toContain('saldoAplicable(conPlus, saldoRegaloCli)');
    expect(carrito).toContain('usarSaldoRegalo: usoRegalo > 0');
    expect(leer('apps', 'cliente', 'src', 'app', 'gift-cards.tsx')).toContain(
      "'/datos/tarjetas-regalo/canjear'",
    );
  });
});
