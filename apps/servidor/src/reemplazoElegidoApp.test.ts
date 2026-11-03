import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ETP-4 (C-TIENDAS-REEMPLAZO-ELEGIDO): la app del cliente deja elegir en el carrito el reemplazo de
 * la misma tienda y lo manda al pedir; la app de la tienda y el panel lo muestran al preparar.
 * Las apps de Expo no corren en esta suite: se comprueba su código, como en heicApps.test.ts.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(RAIZ, ...r), 'utf8');

describe('reemplazo elegido en las apps', () => {
  it('el carrito ofrece «Elegir uno», busca en la tienda y manda reemplazoId', () => {
    const carrito = leer('apps', 'cliente', 'src', 'app', 'cart.tsx');
    expect(carrito).toContain('<ElegirReemplazo');
    expect(carrito).toContain('reemplazoId: l.reemplazo.platoId');
    expect(carrito).toContain('tt.faltaReemplazo');
    const pieza = leer('apps', 'cliente', 'src', 'tiendas', 'ElegirReemplazo.tsx');
    expect(pieza).toContain('/datos/tiendas/${tiendaId}/productos?');
    expect(pieza).toContain('p.id !== platoId');
    const textos = leer('apps', 'cliente', 'src', 'tiendas', 'textos.ts');
    expect(textos).toContain("especifico: 'Elegir uno'");
    expect(textos).toContain("especifico: 'Choose one'");
  });

  it('la tienda lo ve en la preparación (panel y app) con la nota que trae el nombre', () => {
    for (const r of [
      ['apps', 'panel', 'src', 'panel', 'Pedidos.tsx'],
      ['apps', 'restaurante', 'src', 'Inicio.tsx'],
    ]) {
      const s = leer(...r);
      expect(s).toContain('notaSustitucion(l, idioma)');
      expect(s).toContain('reemplazo?: { nombreEs?: string; nombreEn?: string } | null;');
    }
  });
});
