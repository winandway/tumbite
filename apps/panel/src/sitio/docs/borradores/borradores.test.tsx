import { describe, expect, it } from 'vitest';
import { DOCS } from '../guias';
import { BORRADORES_MOTO } from './moto';

/**
 * C-DOCS-MOTO-BORRADOR (30 oct 2026): las guías de Moto están escritas en los dos idiomas y guardadas
 * SIN publicar hasta que Richard encienda Moto. Si alguien las publica antes, o les falta un idioma,
 * esta prueba se pone en rojo.
 */
describe('guías de Moto guardadas sin publicar (C-DOCS-MOTO-BORRADOR)', () => {
  it('están completas en español e inglés, con los mismos ids y pasos', () => {
    for (const rol of ['pasajero', 'conductor'] as const) {
      const es = BORRADORES_MOTO.es[rol];
      const en = BORRADORES_MOTO.en[rol];
      expect(en.map((g) => g.id)).toEqual(es.map((g) => g.id));
      es.forEach((g, i) => {
        const otra = en.at(i);
        expect(g.titulo && g.resumen && otra?.titulo && otra.resumen).toBeTruthy();
        expect(otra?.pasos.length).toBe(g.pasos.length);
        expect(otra?.explicacion?.length).toBe(g.explicacion?.length);
      });
    }
  });

  it('todavía no están publicadas en Docs', () => {
    const publicadas = new Set(
      Object.values(DOCS).flatMap((secciones) =>
        secciones.flatMap((s) => s.guias.map((g) => g.id)),
      ),
    );
    for (const rol of ['pasajero', 'conductor'] as const)
      for (const g of BORRADORES_MOTO.es[rol]) expect(publicadas.has(g.id)).toBe(false);
  });

  it('no dicen nada interno', () => {
    const texto = JSON.stringify(BORRADORES_MOTO).toLowerCase();
    for (const prohibido of ['tumbite', '/datos', 'superadmin', 'stripe', 'twilio', 'sql'])
      expect(texto).not.toContain(prohibido);
  });
});
