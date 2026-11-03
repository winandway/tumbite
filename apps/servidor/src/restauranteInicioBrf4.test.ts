import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candados C-PRUEBA-SIN-CODIGO (BRF-4) y C-INICIO-COLUMNAS (BRF-4b), 2 nov 2026: el inicio de la
 * app del restaurante. La app no corre en vitest; el candado mira su código, y el recorrido del
 * sitio de pruebas mira la pantalla (posición del título de la cocina, e2e/recorrido).
 */
const inicio = readFileSync(
  join(__dirname, '..', '..', 'restaurante', 'src', 'Inicio.tsx'),
  'utf8',
);

describe('inicio de la app del restaurante (BRF-4, BRF-4b)', () => {
  it('BRF-4: el pedido de prueba listo no habla de un código de recogida que no tiene', () => {
    // La línea de ayuda del QR («muestra el código al repartidor») solo sale en un pedido real.
    const ayuda =
      /\{([^{}]*)\?\s*\(\s*<Text[^>]*>\s*\{p\.repartidor\?\.verificado \? t\.verificado : t\.qrAyuda\}/.exec(
        inicio,
      );
    expect(ayuda, 'no se encontró la ayuda del código de recogida').not.toBeNull();
    expect(ayuda![1]).toMatch(/p\.entrega !== 'recoger'/);
    expect(ayuda![1]).toMatch(/!p\.prueba/);
  });

  it('BRF-4b: las columnas del inicio solo se estiran (flex) en la tableta, nunca en el celular', () => {
    expect(inicio).toMatch(/const columna = ancha \? \{ flex: 1 \} : null;/);
    const tramos = {
      columnaNuevos: /const columnaNuevos = [^<]*<View style=\{([^}]*)\}/,
      columnaCocina: /const columnaCocina = [^<]*<View style=\{([^}]*)\}/,
    };
    for (const [nombre, re] of Object.entries(tramos)) {
      const tramo = re.exec(inicio);
      expect(tramo, `no se encontró ${nombre}`).not.toBeNull();
      expect(tramo![1]).toBe('columna');
    }
  });
});
