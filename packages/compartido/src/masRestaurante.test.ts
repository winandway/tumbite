import { describe, expect, it } from 'vitest';
import { opcionesMasRestaurante } from './masRestaurante';

describe('C-MAS-RESTAURANTE: la pestaña «Más» de la app del restaurante', () => {
  it('trae lo que trae DoorDash Merchant: local y horario, dinero, reseñas, equipo, ajustes y ayuda', () => {
    const ids = opcionesMasRestaurante('es').flatMap((g) => g.opciones.map((o) => o.id));
    expect(ids).toEqual([
      'restaurante',
      'ganancias',
      'resenas',
      'equipo',
      'configuracion',
      'guias',
      'soporte',
      'legales',
    ]);
  });

  it('cada opción va a una página que existe y nunca a una dirección interna', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const g of opcionesMasRestaurante(idioma))
        for (const o of g.opciones) {
          expect(o.titulo.length).toBeGreaterThan(2);
          expect(o.ayuda.length).toBeGreaterThan(5);
          if (o.destino)
            expect(o.destino).toMatch(/^\/(panel\/[a-z]+|docs|es\/docs|privacy|es\/privacy)$/);
          expect(o.destino ?? '').not.toMatch(/control-x|admin/);
        }
  });

  it('en inglés todo sale en inglés', () => {
    const en = opcionesMasRestaurante('en');
    expect(en.map((g) => g.titulo)).toEqual(['Your restaurant', 'Help']);
    expect(en[1]!.opciones.find((o) => o.id === 'guias')!.destino).toBe('/docs');
    expect(opcionesMasRestaurante('es')[1]!.opciones.find((o) => o.id === 'guias')!.destino).toBe(
      '/es/docs',
    );
  });
});
