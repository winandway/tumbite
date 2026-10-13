import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARCA } from '@tumbite/compartido';

/**
 * Candado C-VERDE-EXITO (regla de Richard, 13 oct 2026): lo que salió bien va en verde. Nunca rojo
 * en una barra de progreso ni en un «entregado», «aprobado» o «respondido».
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

describe('verde para el éxito', () => {
  it('la marca tiene su verde de éxito', () => {
    expect(MARCA.colores.exito).toBe('#0D7A3A');
  });
  it('la barra de seguimiento del pedido avanza en verde y el entregado sale en verde', () => {
    const pedido = leer('apps', 'cliente', 'src', 'app', 'order', '[id].tsx');
    expect(pedido).toMatch(/backgroundColor: i <= paso \? C\.exito/);
    expect(pedido).not.toMatch(/backgroundColor: i <= paso \? C\.primario/);
    expect(leer('apps', 'cliente', 'src', 'app', 'account.tsx')).toMatch(
      /'entregado' \? \{ color: C\.exito/,
    );
  });
  it('el plato ya en el carrito y el regalo aplicado salen en verde', () => {
    expect(leer('apps', 'cliente', 'src', 'app', 'restaurant', '[id].tsx')).toMatch(
      /enCarrito\s*\? C\.exito/,
    );
    const carrito = leer('apps', 'cliente', 'src', 'app', 'cart.tsx');
    expect(carrito).toMatch(/borderColor: regaloElegido === r\.tipo \? C\.exito/);
    expect(carrito).not.toMatch(/regaloElegido === r\.tipo \? C\.acento/);
  });
  it('la barra de nivel del repartidor avanza en verde', () => {
    expect(leer('apps', 'repartidor', 'src', 'Inicio.tsx')).toMatch(
      /accessibilityRole="progressbar"[\s\S]*backgroundColor: C\.exito/,
    );
  });

  it('en el panel, respondido y cerrado son verdes y la insignia neutra no es roja', () => {
    const css = leer('apps', 'panel', 'src', 'estilos.css');
    expect(css).toMatch(/\.ticket-respondido,\s*\.ticket-cerrado \{\s*background: #e3f6ea/);
    expect(css).toMatch(/\.insignia \{[^}]*background: #f1f1f1/);
    // Lo que le toca al restaurante en el día también va en verde.
    expect(css).toMatch(/\.metrica-fuerte \{[^}]*background: #0d7a3a/);
  });
});
