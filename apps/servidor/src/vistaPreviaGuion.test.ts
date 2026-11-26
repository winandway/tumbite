import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nombreVistaPrevia as nombreCompartido } from '@tumbite/compartido';
// @ts-expect-error módulo .mjs sin tipos (lo usa el guion de vistas previas)
import * as reglas from '../../../scripts/vista-previa/reglas.mjs';

/**
 * C-VISTA-PREVIA-RAMA (26 nov 2026): el guion que abre y cierra las vistas previas por rama nunca
 * toca la base de producción ni la del sitio de pruebas compartido, y cada rama tiene la suya.
 */
const r = reglas as {
  BASES_PROHIBIDAS: { nombre: string; id: string }[];
  nombreVistaPrevia: (rama: string) => string;
  validarBaseVistaPrevia: (b: { nombre: string; id?: string }) => true;
  configWorker: (p: { nombre: string; idBase: string; paquete: string; commit: string }) => {
    d1_databases: { database_name: string; database_id: string }[];
    vars: Record<string, string>;
    name: string;
    account_id: string;
  };
};

describe('C-VISTA-PREVIA-RAMA: reglas del guion', () => {
  it('se niega con la base de producción y con la del sitio compartido (por nombre o por id)', () => {
    for (const p of r.BASES_PROHIBIDAS) {
      expect(() => r.validarBaseVistaPrevia({ nombre: p.nombre })).toThrow();
      expect(() =>
        r.validarBaseVistaPrevia({ nombre: 'divoox-preview-x', id: p.id.toUpperCase() }),
      ).toThrow(/PROHIBIDO/);
    }
    expect(() => r.validarBaseVistaPrevia({ nombre: 'site-tumbite-db' })).toThrow();
    expect(() => r.validarBaseVistaPrevia({ nombre: 'otra-base' })).toThrow();
    expect(r.validarBaseVistaPrevia({ nombre: 'divoox-preview-textos', id: 'abc' })).toBe(true);
  });

  it('las dos bases prohibidas son las de verdad (producción y el sitio compartido)', () => {
    expect(r.BASES_PROHIBIDAS.map((b) => b.nombre).sort()).toEqual([
      'site-tumbite-db',
      'site-tumbite-pruebas-db',
    ]);
  });

  it('el worker queda atado a SU base y sin variables de producción', () => {
    const c = r.configWorker({
      nombre: 'divoox-preview-textos',
      idBase: '11111111-2222-3333-4444-555555555555',
      paquete: '/tmp/x',
      commit: 'abc1234',
    });
    expect(c.name).toBe('divoox-preview-textos');
    expect(c.account_id).toBe('4d9e131f2c18bc10ac4700d689d5556c');
    expect(c.d1_databases).toEqual([
      expect.objectContaining({ database_name: 'divoox-preview-textos' }),
    ]);
    expect(c.vars.VISTA_PREVIA_BASE).toBe('divoox-preview-textos');
    expect(c.vars.SITIO_URL).toBe('https://divoox-preview-textos.windoce1.workers.dev');
    expect(JSON.stringify(c)).not.toMatch(/sk_live|pk_live|divoox\.com|staging\.tumbite/);
    expect(() =>
      r.configWorker({
        nombre: 'divoox-preview-textos',
        idBase: r.BASES_PROHIBIDAS[0]?.id ?? '',
        paquete: '/tmp/x',
        commit: 'abc1234',
      }),
    ).toThrow(/PROHIBIDO/);
  });

  it('el nombre del guion y el del servidor salen iguales de la misma rama', () => {
    for (const rama of [
      'fase-licencia-una-cara',
      'fase-A_B',
      `fase-${'x'.repeat(70)}`,
      'fase-tres--guiones-',
    ])
      expect(r.nombreVistaPrevia(rama)).toBe(nombreCompartido(rama));
  });

  it('el flujo de ramas apaga la fila compartida y no empuja a ningún sitio publicado', () => {
    const y = readFileSync(
      new URL('../../../.github/workflows/vista-previa-rama.yml', import.meta.url),
      'utf8',
    );
    expect(y).toContain('group: vista-previa-${{ github.ref_name }}');
    const sinComentarios = y
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    expect(sinComentarios).not.toMatch(/yapanel-pruebas|yapanel-build|group: publicar/);
    const viejo = readFileSync(
      new URL('../../../.github/workflows/pruebas-rama.yml', import.meta.url),
      'utf8',
    );
    expect(viejo).toContain("if: ${{ vars.VISTA_PREVIA_POR_RAMA != 'si' }}");
  });
});
