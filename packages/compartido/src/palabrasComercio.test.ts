import { describe, expect, it } from 'vitest';
import { TIPOS_ALTA, conMenu, nombreTipoComercio, palabrasComercio } from './palabrasComercio';
import { NOMBRES_COMERCIO, TIPOS_COMERCIO, servicioDeComercio } from './tiendas';

/**
 * C-MERCHANT-PALABRAS (27 nov 2026) · todos los países. El texto de Divoox Merchant se adapta al
 * tipo de negocio: el restaurante ve «Menú» y «platos»; los demás, «Catálogo» y «productos».
 */
describe('C-MERCHANT-PALABRAS · las palabras según el tipo de negocio', () => {
  it('el restaurante (y el de siempre, sin tipo) ve Menú y platos', () => {
    for (const tipo of ['restaurante', null, undefined, '']) {
      expect(palabrasComercio(tipo, 'es')).toMatchObject({
        menu: 'Menú',
        articulos: 'platos',
        miNegocio: 'Mi restaurante',
      });
      expect(palabrasComercio(tipo, 'en')).toMatchObject({ menu: 'Menu', articulos: 'dishes' });
    }
  });

  it('todo comercio que no es restaurante ve Catálogo y productos, nunca «plato»', () => {
    for (const tipo of TIPOS_COMERCIO.filter((t) => t !== 'restaurante')) {
      expect(conMenu(tipo)).toBe(false);
      for (const idioma of ['es', 'en'] as const) {
        const p = palabrasComercio(tipo, idioma);
        expect(p.menu).toBe(idioma === 'es' ? 'Catálogo' : 'Catalog');
        expect(Object.values(p).join(' ')).not.toMatch(/plato|dish|restaurant|comida|cuisine/i);
      }
    }
  });

  it('el alta ofrece Restaurante, Mercado, Farmacia, Licorería, Ferretería, Tienda y Otro', () => {
    expect(TIPOS_ALTA.map((t) => nombreTipoComercio(t, 'es'))).toEqual([
      'Restaurante',
      'Mercado',
      'Farmacia',
      'Licorería',
      'Ferretería',
      'Tienda',
      'Otro',
    ]);
    for (const t of TIPOS_COMERCIO) {
      expect(NOMBRES_COMERCIO[t].es.length).toBeGreaterThan(1);
      expect(servicioDeComercio(t)).toBeTruthy();
    }
    expect(servicioDeComercio('otro')).toBe('mas');
  });
});
