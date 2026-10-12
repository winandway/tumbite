import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-PAGO-SIN-SALTO: regla de Richard, el pago queda dentro de la app.
 * El carrito nunca abre una página de pago afuera; usa el formulario de Stripe incrustado.
 */
const CLIENTE = join(__dirname, '..', '..', 'cliente', 'src');
const leer = (r: string) => readFileSync(join(CLIENTE, r), 'utf8');

describe('pago dentro de la app', () => {
  it('el carrito no salta a una página de pago', () => {
    const carrito = leer('app/carrito.tsx');
    expect(carrito).not.toMatch(/Linking\.openURL|urlPago/);
    expect(carrito).toMatch(/<PagoTarjeta/);
  });

  it('la web usa el formulario incrustado y el celular la hoja de pago', () => {
    expect(leer('PagoTarjeta.web.tsx')).toMatch(/PaymentElement[\s\S]*redirect: 'if_required'/);
    expect(leer('PagoTarjeta.tsx')).toMatch(/presentPaymentSheet/);
  });
});
