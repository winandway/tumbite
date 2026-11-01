import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { descuentoPlus } from './plus';

// C-PLUS: la app y el servidor descuentan lo mismo; solo desde el mínimo.
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('C-PLUS: descuento de Divoox Plus', () => {
  const a = { minimoSubtotal: 1200, servicioDescuentoPct: 50 };
  it('quita el envío y la mitad del servicio desde el mínimo', () => {
    expect(descuentoPlus({ subtotal: 1500, envio: 399, servicio: 225 }, a)).toBe(399 + 113);
  });
  it('por debajo del mínimo no descuenta nada', () => {
    expect(descuentoPlus({ subtotal: 1100, envio: 399, servicio: 225 }, a)).toBe(0);
  });
  it('el carrito de la app usa la misma cuenta y la muestra aparte', () => {
    const carrito = leer('apps', 'cliente', 'src', 'app', 'cart.tsx');
    expect(carrito).toContain('descuentoPlus(sinPlus, plusVigente)');
    expect(carrito).toContain("fila('Divoox Plus', -descPlus)");
    expect(leer('apps', 'cliente', 'src', 'app', 'plus.tsx')).toContain(
      "'/datos/plus/suscribirse'",
    );
  });
});
