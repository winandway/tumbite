import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { GUIAS_OPERACIONES } from './operaciones';
import { coincide, palabrasDeBusqueda } from './buscar';
import { iconoDeGuia } from './iconosGuia';

/**
 * C-DOCS-OPERACIONES (15 nov 2026) — todos los países: las guías del monitoreo del panel de
 * operaciones, para entrenar al equipo. Inglés principal con direcciones en inglés, español como
 * traducción con las mismas direcciones, capturas reales que existen, nada interno ni privado, y el
 * buscador de Docs las encuentra con palabras normales.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');
const IDS = [
  'search-orders-rides-people',
  'monitor-live-orders-rides',
  'read-order-ride-file',
  'link-support-ticket',
  'time-zone-clock',
  'add-team-members-permissions',
  'resolve-expired-card-authorization',
];
const PROHIBIDAS = [
  /superadmin/i,
  /control-[0-9a-f]/i,
  /\/datos/,
  /\bSQL\b/,
  /endpoint/i,
  /webhook/i,
  /ADMIN_/,
  /tumbite/i,
  /stripe/i,
  /twilio/i,
  /pronto|coming soon/i,
  /\w_\w/, // nombres de tablas o de variables
  /preferencias_internas|ofertas|operaciones_/i,
];
const AJENO_EN_INGLES = [/vigía/i, /bolívar/i, /venezuela/i, /caracas/i];

describe('C-DOCS-OPERACIONES: guías del equipo de operaciones', () => {
  it('son siete, con direcciones en inglés y los mismos ids en los dos idiomas', () => {
    for (const i of ['es', 'en'] as const) {
      expect(GUIAS_OPERACIONES[i].map((g) => g.id)).toEqual(IDS);
      for (const g of GUIAS_OPERACIONES[i])
        expect(g.id.split('-').every((p) => /^[a-z]+$/.test(p))).toBe(true);
    }
  });

  it('están en la sección «operations» de Docs, con título en cada idioma', () => {
    for (const i of ['es', 'en'] as const) {
      const s = DOCS[i].find((x) => x.id === 'operations');
      // C-MODERACION: la guía de la bandeja de reportes se suma al final (vive en moderacion.ts).
      expect(s?.guias.map((g) => g.id)).toEqual([...IDS, 'flagged-content']);
    }
    expect(DOCS.en.find((x) => x.id === 'operations')?.titulo).toBe('Operations team');
    expect(DOCS.es.find((x) => x.id === 'operations')?.titulo).toBe('Equipo de operaciones');
  });

  it('cada guía tiene resumen, explicación, pasos, preguntas y capturas reales de su idioma', () => {
    for (const i of ['es', 'en'] as const)
      for (const g of GUIAS_OPERACIONES[i]) {
        expect(g.resumen.length, `${i} ${g.id}`).toBeGreaterThan(40);
        expect(g.explicacion?.length ?? 0, `${i} ${g.id}`).toBeGreaterThanOrEqual(3);
        expect(g.pasos.length, `${i} ${g.id}`).toBeGreaterThanOrEqual(5);
        expect(g.preguntas?.length ?? 0).toBeGreaterThan(0);
        expect(g.capturas?.length ?? 0, `${i} ${g.id}`).toBeGreaterThan(0);
        for (const c of g.capturas ?? []) {
          expect(c.alt.length).toBeGreaterThan(30);
          expect(c.src).toContain(`-${i}.webp`);
          const ruta = join(PUBLICO, c.src);
          expect(existsSync(ruta), c.src).toBe(true);
          // Capturas grandes pero razonables para una página web.
          expect(statSync(ruta).size, c.src).toBeLessThan(400_000);
        }
      }
  });

  it('nada interno ni privado en ninguna guía', () => {
    for (const i of ['es', 'en'] as const)
      for (const g of GUIAS_OPERACIONES[i]) {
        // Se quitan las pistas de búsqueda («tel:», «id:»…) que no tienen guion bajo; el texto va entero.
        const texto = JSON.stringify(g);
        for (const p of PROHIBIDAS) expect(texto, `${i} ${g.id} ${p}`).not.toMatch(p);
      }
  });

  it('las guías en inglés no nombran lo que solo se ve en las capturas de Venezuela', () => {
    for (const g of GUIAS_OPERACIONES.en)
      for (const p of AJENO_EN_INGLES) expect(JSON.stringify(g)).not.toMatch(p);
  });

  it('el buscador de Docs las encuentra con palabras normales, y cada una tiene su ícono', () => {
    const busca = (i: 'es' | 'en', q: string) =>
      GUIAS_OPERACIONES[i].filter((g) => coincide(g, palabrasDeBusqueda(q))).map((g) => g.id);
    expect(busca('en', 'short code')).toContain('search-orders-rides-people');
    expect(busca('en', 'traffic light')).toContain('monitor-live-orders-rides');
    expect(busca('en', 'blurred photo')).toContain('read-order-ride-file');
    expect(busca('en', 'claim')).toContain('link-support-ticket');
    expect(busca('en', '24-hour clock')).toContain('time-zone-clock');
    expect(busca('es', 'código corto')).toContain('search-orders-rides-people');
    expect(busca('es', 'foto borrosa')).toContain('read-order-ride-file');
    expect(busca('es', 'zona horaria')).toContain('time-zone-clock');
    const iconos = IDS.map((id) => iconoDeGuia(id));
    expect(busca('en', 'expired authorization')).toContain('resolve-expired-card-authorization');
    expect(busca('es', 'autorización vencida')).toContain('resolve-expired-card-authorization');
    expect(new Set(iconos).size).toBe(IDS.length);
  });
});
