import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-STRIPE-ES419 (31 oct 2026, visto por Richard en TestFlight): la hoja de pago en español latino
 * decía «permites que {Divoox} cargue en tu tarjeta». Es la traducción del SDK de Stripe; el
 * complemento plugins/stripe-espanol.js la corrige al instalar los Pods.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const requerir = createRequire(import.meta.url);
const { conPaso } = requerir(join(RAIZ, 'plugins', 'stripe-espanol.js')) as {
  conPaso: (p: string) => string;
};

describe('mandato de Stripe en español', () => {
  it('la app del cliente usa el complemento', () => {
    const app = JSON.parse(readFileSync(join(RAIZ, 'apps', 'cliente', 'app.json'), 'utf8')) as {
      expo: { plugins: unknown[] };
    };
    expect(app.expo.plugins).toContain('../../plugins/stripe-espanol');
  });
  it('el Podfile quita las llaves una sola vez', () => {
    const base = "target 'Divoox' do\n  post_install do |installer|\n  end\nend\n";
    const una = conPaso(base);
    expect(una).toContain("gsub('{%@}', '%@')");
    expect(conPaso(una)).toBe(una);
  });
});
