import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CARRITO-UNA-DIRECCION (31 oct 2026, visto por Richard en el iPhone): el carrito decía dos veces
 * «Dirección de entrega» (el título de la sección y la casilla) y el mapa no seguía a la dirección
 * elegida. La casilla se llama «Calle y número» y el mapa recibe si la casilla está vacía.
 */
const RAIZ = join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src');
const carrito = readFileSync(join(RAIZ, 'app', 'cart.tsx'), 'utf8');
const mapa = readFileSync(join(RAIZ, 'ElegirEnMapa.tsx'), 'utf8');

describe('carrito: una sola «Dirección de entrega»', () => {
  it('la casilla de la calle no repite el título de la sección', () => {
    const casilla = carrito.slice(carrito.indexOf('<CampoDireccion'));
    expect(casilla.slice(0, 200)).toContain('etiqueta={t.direccionCampo}');
  });
  it('el mapa sigue al punto elegido y llena la casilla vacía', () => {
    expect(mapa).toContain('animateToRegion');
    expect(mapa).toMatch(/direccionVacia[\s\S]*leerCalle\(punto\)/);
  });
  // C-PUNTO-EXACTO (16 nov 2026): al elegir una calle o avenida se abre el mapa con el pin fijo, y
  // lo confirmado (punto, dirección, referencia y casa) vuelve al carrito.
  it('al elegir una sugerencia se abre el punto exacto y lo confirmado vuelve al carrito', () => {
    const casilla = carrito.slice(carrito.indexOf('<CampoDireccion'));
    expect(casilla.slice(0, casilla.indexOf('/>'))).toContain('setMarcando(true)');
    expect(carrito).toMatch(/<PuntoExacto[\s\S]*b\.cambiar\('referencia', p\.referencia\)/);
    expect(carrito).toContain('testID="carrito-referencia"');
  });
});
