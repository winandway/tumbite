import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026) en las apps (no corren en vitest; el candado mira su
 * código): el cliente ve la retención y «peso estimado → peso real» en su recibo, y la tienda
 * escribe el peso en la app del restaurante. El panel tiene su propia prueba (PedidosPeso.test.tsx).
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', ...r), 'utf8');

describe('peso real en las apps (C-TIENDAS-PESO-REAL)', () => {
  it('el carrito del cliente avisa lo que se retiene con la cuenta compartida', () => {
    const carrito = leer('cliente', 'src', 'app', 'cart.tsx');
    expect(carrito).toMatch(/margenPesables\(carrito\.lineas, d\.totalCliente, d\.subtotal\)/);
    expect(carrito).toMatch(/tt\.retencion\.replace/);
    const textos = leer('cliente', 'src', 'tiendas', 'textos.ts');
    expect(textos.match(/retencion:/g)).toHaveLength(2);
  });

  it('el recibo del cliente muestra el peso estimado y el real', () => {
    const pedido = leer('cliente', 'src', 'app', 'order', '[id].tsx');
    expect(pedido).toMatch(/\.filter\(\(l\) => l\.pesoReal != null\)/);
    expect(pedido).toMatch(/textoPesoReal\(l, idioma === 'en' \? 'en' : 'es'\)/);
  });

  it('la app del restaurante manda el peso real mientras prepara', () => {
    const inicio = leer('restaurante', 'src', 'Inicio.tsx');
    expect(inicio).toMatch(/<PesoReal/);
    expect(inicio).toMatch(/\/datos\/restaurante\/pedidos\/\$\{p\.id\}\/pesos/);
    // SIG-3x: se pesa por línea (el mismo producto puede ir en dos líneas).
    expect(inicio).toMatch(/platoId: l\.platoId, linea: i, peso/);
    expect(inicio).toMatch(/editable=\{\['pagado', 'aceptado'\]\.includes\(p\.estado\)\}/);
  });
});
