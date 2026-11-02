import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-VOLVER-AL-ORIGEN (1 nov 2026, visto por Richard en el iPhone): desde Mi cuenta → un pedido, la
 * flecha mandaba al inicio y sacaba a la persona de Mi cuenta. Ahora vuelve a donde estaba; solo un
 * pedido recién hecho vuelve al inicio.
 */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('La flecha de volver regresa a donde estaba la persona', () => {
  it('el detalle del pedido vuelve atrás y solo va al inicio con un pedido nuevo', () => {
    const pedido = leer('apps', 'cliente', 'src', 'app', 'order', '[id].tsx');
    expect(pedido).toContain('router.canGoBack() ? router.back() : irInicio()');
    expect(pedido).toContain('alVolver={volver}');
    expect(pedido).not.toContain('alVolver={irInicio}');
  });

  it('ninguna pantalla del cliente con flecha manda siempre al inicio sin mirar de dónde se vino', () => {
    for (const archivo of [
      'orders.tsx',
      'favorites.tsx',
      'account.tsx',
      'notifications.tsx',
      'packages.tsx',
    ])
      expect(leer('apps', 'cliente', 'src', 'app', archivo)).not.toContain(
        "alVolver={() => router.replace('/')}",
      );
  });
});
