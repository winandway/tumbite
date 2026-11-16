import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';

/**
 * C-DOCS-SIN-INTERNO (16 nov 2026, Richard) — todos los países. Docs públicos son solo para
 * clientes, restaurantes, repartidores y empresas (terceros). Nada que explique NUESTRO panel de
 * operaciones (el superadmin): ni la sección «Operations team», ni sus pantallas, rutas, búsquedas o
 * bandejas, ni sus capturas. Eso vive en la ayuda interna «?» (C-AYUDA-INTERNA), dentro del
 * superadmin. Si una guía pública vuelve a mencionarlo, esta prueba se pone en rojo.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public', 'docs');
const CAPTURA_INTERNA = /^(monitoreo-|recorrido-moderacion-computadora-bandeja-|doble-firma-)/;
const IDS_INTERNOS = [
  'search-orders-rides-people',
  'monitor-live-orders-rides',
  'read-order-ride-file',
  'link-support-ticket',
  'time-zone-clock',
  'add-team-members-permissions',
  'resolve-expired-card-authorization',
  'flagged-content',
  'two-person-approval',
  'how-divoox-works',
  'traffic-light-stuck',
];
const PROHIBIDAS = [
  /super ?admin/i,
  // «nuestro equipo de operaciones» (en minúsculas) se puede decir; la SECCIÓN del equipo, no.
  /Operations team/,
  /Equipo de operaciones/,
  /operations panel/i,
  /panel de operaciones/i,
  /control-[0-9a-f]/i,
  /\/panel\/(control|orders|rides|tickets|moderation|approvals|verifications|configuration|team|cash|help)\b/i,
  /«Para aprobar»|“Approvals”|«Approvals»|“Flagged content”|«Reportes» en el menú/i,
  /Live orders|Pedidos en curso/,
  /\/datos\/admin/,
];

const todas = () =>
  (['es', 'en'] as const).flatMap((i) => DOCS[i].flatMap((s) => s.guias.map((g) => ({ i, s, g }))));

describe('C-DOCS-SIN-INTERNO: Docs públicos no explican nuestro panel de operaciones', () => {
  it('no hay sección del equipo de operaciones ni guías del panel interno', () => {
    for (const i of ['es', 'en'] as const)
      expect(DOCS[i].map((s) => s.id as string)).not.toContain('operations');
    const ids = todas().map((x) => x.g.id);
    for (const id of IDS_INTERNOS) expect(ids, id).not.toContain(id);
  });

  it('ninguna guía pública nombra el superadmin, sus pantallas o sus rutas', () => {
    for (const { i, s, g } of todas()) {
      const texto = JSON.stringify(g);
      for (const p of PROHIBIDAS) expect(texto, `${i} ${s.id}/${g.id} ${p}`).not.toMatch(p);
    }
  });

  it('ninguna captura del panel interno está en Docs ni se sirve desde /public', () => {
    for (const { g } of todas())
      for (const c of g.capturas ?? [])
        expect(c.src.replace(/^.*\//, ''), g.id).not.toMatch(CAPTURA_INTERNA);
    const sueltas = readdirSync(PUBLICO).filter((f) => CAPTURA_INTERNA.test(f));
    expect(sueltas).toEqual([]);
  });
});
