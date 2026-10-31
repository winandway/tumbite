import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PAGO-APPLE-PAY (31 oct 2026): en el iPhone, pedir Apple Pay en la hoja de Stripe sin el
 * identificador de comercio rompía la hoja entera y no se podía pagar ni con tarjeta.
 */
const fuente = readFileSync(
  join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src', 'PagoTarjeta.tsx'),
  'utf8',
);

describe('hoja de pago del iPhone', () => {
  it('Apple Pay solo con identificador de comercio', () => {
    expect(fuente).not.toMatch(/^\s*applePay:/m);
    expect(fuente).toContain('COMERCIO_APPLE ? { applePay:');
    expect(fuente).toContain('COMERCIO_APPLE ? { merchantIdentifier: COMERCIO_APPLE }');
  });
});
