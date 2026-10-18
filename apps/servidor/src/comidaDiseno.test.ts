import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-COMIDA-DISENO (14 oct 2026): las pantallas de Comida del cliente siguen el diseño
 * aprobado sin perder ninguna función, y lo que no existe no se dibuja como si funcionara.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');
const CLIENTE = ['apps', 'cliente', 'src'];

describe('pantallas de Comida con el diseño aprobado', () => {
  it('«Comida» y «Ver todos» abren la lista de restaurantes, que existe', () => {
    expect(
      existsSync(join(__dirname, '..', '..', 'cliente', 'src', 'app', 'restaurants.tsx')),
    ).toBe(true);
    // Desde el 18 oct (inicio «como los grandes»): Comida disponible abre los restaurantes.
    expect(leer(...CLIENTE, 'Inicio.tsx')).toMatch(
      /s\.id === 'comida' && \(s\.accion === 'abrir' \|\| !servicios\)\)\s*return router\.push\('\/restaurants'\)/,
    );
    expect(leer(...CLIENTE, 'inicio', 'Restaurantes.tsx')).toMatch(
      /router\.push\('\/restaurants'\)/,
    );
  });
  it('la lista filtra por las categorías de los restaurantes reales y el corazón dice «Muy pronto»', () => {
    const lista = leer(...CLIENTE, 'app', 'restaurants.tsx');
    expect(lista).toMatch(/new Set\(\(lista \?\? \[\]\)\.map\(\(r\) => r\.categoria\)/);
    expect(lista).toMatch(/onPress=\{\(\) => setPronto\(true\)\}/);
  });
  it('el menú tiene Menú e Información con datos reales, sin una pestaña de opiniones vacía', () => {
    const menu = leer(...CLIENTE, 'app', 'restaurant', '[id].tsx');
    expect(menu).toMatch(/\['menu', 'info'\] as const/);
    expect(menu).not.toMatch(/Opiniones'|Reviews'/);
    expect(menu).toMatch(/r\.direccion/);
    // El detalle del producto conserva tamaños (radio), extras (casillas) y cantidad.
    expect(menu).toMatch(/accessibilityRole="radio"/);
    expect(menu).toMatch(/accessibilityRole="checkbox"/);
    expect(menu).toMatch(/meter\(p, opciones, cantidad\)/);
  });
  it('al pagar se ve «¡Pedido realizado!» y el seguimiento conserva llamar, chat y reportar', () => {
    expect(leer(...CLIENTE, 'app', 'cart.tsx')).toMatch(
      /router\.replace\(`\/order\/\$\{cobro\.pedidoId\}\?nuevo=1`\)/,
    );
    // También cuando Stripe vuelve a la app después de verificar la tarjeta.
    expect(leer(...CLIENTE, 'PagoTarjeta.web.tsx')).toMatch(
      /\/app\/order\/\$\{cobro\.pedidoId\}\?nuevo=1/,
    );
    const pedido = leer(...CLIENTE, 'app', 'order', '[id].tsx');
    expect(pedido).toMatch(/nuevo &&\s*!verSeguimiento/);
    expect(pedido).toMatch(/\/llamar`/);
    expect(pedido).toMatch(/<ChatPedido pedidoId=\{p\.id\}/);
    expect(pedido).toMatch(/<FotoPedido\s+pedidoId=\{p\.id\}\s+tipo="entrega"/);
    expect(pedido).toMatch(/\/calificar`/);
  });
});
