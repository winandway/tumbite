import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { GUIAS_MOTO } from './borradores/moto';

/**
 * C-DOCS-MOTO (13 nov 2026, Venezuela): las guías de Divoox Moto publicadas en Docs, con capturas
 * REALES, en los dos idiomas, sin «Pronto» y diciendo que Moto se abre ciudad por ciudad.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');

describe('C-DOCS-MOTO: guías de Moto publicadas', () => {
  it('están en «Para pedir» y en «Repartidores», en español y en inglés', () => {
    for (const idioma of ['es', 'en'] as const) {
      const secciones = idioma === 'es' ? DOCS.es : DOCS.en;
      const ids = (id: string) => secciones.find((s) => s.id === id)?.guias.map((g) => g.id) ?? [];
      expect(ids('ordering')).toEqual(expect.arrayContaining(['ride-moto', 'ride-moto-pago']));
      expect(ids('drivers')).toEqual(
        expect.arrayContaining(['drive-moto', 'drive-moto-alta', 'drive-moto-saldo']),
      );
    }
  });

  it('cada guía lleva tres o más capturas reales que existen', () => {
    for (const lista of [GUIAS_MOTO.es, GUIAS_MOTO.en])
      for (const g of [...lista.pasajero, ...lista.conductor]) {
        expect(g.capturas?.length ?? 0).toBeGreaterThanOrEqual(3);
        for (const c of g.capturas ?? []) {
          expect(c.src).toMatch(/^\/docs\/recorrido-moto-ve-/);
          expect(existsSync(join(PUBLICO, c.src))).toBe(true);
          expect(c.alt.length).toBeGreaterThan(10);
        }
      }
  });

  it('dicen que Moto se abre por ciudad, sin «Pronto» ni nada interno', () => {
    const es = JSON.stringify(GUIAS_MOTO.es);
    const en = JSON.stringify(GUIAS_MOTO.en);
    expect(es).toContain('donde Divoox Moto esté abierto');
    expect(en).toContain('where Divoox Moto is open');
    for (const t of [es.toLowerCase(), en.toLowerCase()])
      for (const prohibido of [
        'pronto',
        'coming soon',
        'tumbite',
        '/datos',
        'superadmin',
        'checkr',
      ])
        expect(t).not.toContain(prohibido);
  });
});
