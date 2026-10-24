import { describe, expect, it } from 'vitest';
import {
  BORRAR_CUENTA,
  PRIVACIDAD,
  SOPORTE,
  TERMINOS,
  TERMINOS_REPARTIDORES,
  TERMINOS_RESTAURANTES,
} from './legales';

/**
 * Candado C-LEGALES-TIENDAS: lo que Apple (5.1.1) y Google Play (datos de usuario y borrado
 * de cuenta) revisan. Si alguien recorta un texto y quita una pieza exigida, esto se pone rojo.
 */
const texto = (d: { secciones: { titulo: string; parrafos: string[] }[]; intro?: string }) =>
  [d.intro ?? '', ...d.secciones.flatMap((s) => [s.titulo, ...s.parrafos])].join(' ');

describe('política de privacidad lista para las tiendas', () => {
  for (const idioma of ['es', 'en'] as const) {
    const p = texto(PRIVACIDAD[idioma]);
    it(`(${idioma}) nombra a la empresa y un contacto de privacidad`, () => {
      expect(p).toContain('Windoce LLC');
      expect(p).toContain('support@divoox.com');
    });
    it(`(${idioma}) dice cuánto tiempo se guardan los datos y cómo borrarlos`, () => {
      expect(PRIVACIDAD[idioma].secciones.some((s) => s.id && /tiempo|long/i.test(s.titulo))).toBe(
        true,
      );
      expect(p).toContain('/delete-account');
      expect(p).toMatch(/30 (días|days)/);
    });
    it(`(${idioma}) explica ubicación, terceros con igual protección y que no se venden datos`, () => {
      expect(p).toMatch(/Stripe/);
      expect(p).toMatch(/igual o mayor|at least as well/);
      expect(p).toMatch(/no vendemos|don’t sell/i);
      expect(p).toMatch(/ubicación|location/i);
    });
  }
});

describe('página pública para borrar la cuenta (Google Play)', () => {
  for (const idioma of ['es', 'en'] as const) {
    const b = BORRAR_CUENTA[idioma];
    it(`(${idioma}) tiene el botón directo, el pedido por correo y qué se borra y qué se guarda`, () => {
      expect(b.accion?.href).toBe('/panel/settings');
      const t = texto(b);
      expect(t).toContain('Divoox');
      expect(t).toContain('support@divoox.com');
      expect(b.secciones.length).toBeGreaterThanOrEqual(4);
    });
  }
});

describe('términos para cada público, en los dos idiomas', () => {
  it('existen y tienen contenido', () => {
    for (const doc of [TERMINOS, TERMINOS_RESTAURANTES, TERMINOS_REPARTIDORES, SOPORTE])
      for (const idioma of ['es', 'en'] as const)
        expect(doc[idioma].secciones.length).toBeGreaterThanOrEqual(3);
  });
  it('el repartidor queda como contratista independiente', () => {
    expect(texto(TERMINOS_REPARTIDORES.es)).toMatch(/contratista independiente/);
    expect(texto(TERMINOS_REPARTIDORES.en)).toMatch(/independent contractor/);
  });
});
