import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Guia } from './guias';
import { DOCS } from './guias';
import { GUIAS_CARRO } from './carro';
import { GUIAS_SEMANA } from './semana';
import { coincide, palabrasDeBusqueda } from './buscar';
import { iconoDeGuia } from './iconosGuia';

/**
 * C-DOCS-CARRO y C-DOCS-SEMANA (14 nov 2026) — todos los países: lo construido esta semana tiene su
 * guía pública con capturas REALES que existen, en los dos idiomas con los mismos ids y pasos, sin
 * «Pronto» ni nada interno, y el buscador de Docs la encuentra con palabras normales.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');
const PROHIBIDAS = [
  'pronto',
  'coming soon',
  'tumbite',
  '/datos',
  'superadmin',
  'checkr',
  'stripe',
  'twilio',
  'precio de prueba',
  'test price',
  'caracas',
  'miami',
];

const todas = (idioma: 'es' | 'en'): Guia[] => [
  ...GUIAS_CARRO[idioma].pasajero,
  ...GUIAS_CARRO[idioma].conductor,
  ...Object.values(GUIAS_SEMANA[idioma]).flat(),
];
const publicadas = (idioma: 'es' | 'en') =>
  new Map(DOCS[idioma].flatMap((s) => s.guias.map((g) => [g.id, s.id] as const)));

describe('C-DOCS-SEMANA: guías nuevas publicadas con capturas reales', () => {
  it('están publicadas en Docs, en su sección, en español y en inglés con los mismos ids', () => {
    const es = todas('es');
    const en = todas('en');
    expect(en.map((g) => g.id)).toEqual(es.map((g) => g.id));
    for (const idioma of ['es', 'en'] as const) {
      const mapa = publicadas(idioma);
      for (const g of todas(idioma)) expect(mapa.has(g.id), g.id).toBe(true);
    }
    expect(publicadas('es').get('ride-car')).toBe('ordering');
    expect(publicadas('es').get('drive-car')).toBe('drivers');
    expect(publicadas('es').get('drive-car-signup')).toBe('drivers');
  });

  it('cada guía lleva sus capturas (tres o más si tiene varios pasos) y existen', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const g of todas(idioma)) {
        const minimo = g.pasos.length > 2 ? 3 : 1;
        expect(g.capturas?.length ?? 0, g.id).toBeGreaterThanOrEqual(minimo);
        for (const c of g.capturas ?? []) {
          expect(c.src).toMatch(/^\/docs\/recorrido-[a-z0-9-]+\.webp$/);
          expect(c.src.endsWith(`-${idioma}.webp`), c.src).toBe(true);
          expect(existsSync(join(PUBLICO, c.src)), c.src).toBe(true);
          expect(c.alt.length).toBeGreaterThan(10);
        }
      }
  });

  it('los dos idiomas van completos: mismos pasos, explicación y capturas', () => {
    const es = todas('es');
    const en = todas('en');
    es.forEach((g, i) => {
      const otra = en.at(i);
      expect(otra?.pasos.length, g.id).toBe(g.pasos.length);
      expect(otra?.explicacion?.length, g.id).toBe(g.explicacion?.length);
      expect(otra?.capturas?.length, g.id).toBe(g.capturas?.length);
    });
  });

  it('sin «Pronto», sin nada interno y sin ciudades que no son las de las capturas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const texto = JSON.stringify(todas(idioma)).toLowerCase();
      for (const p of PROHIBIDAS) expect(texto, p).not.toContain(p);
    }
  });

  it('Carro dice que se abre por ciudad', () => {
    expect(JSON.stringify(GUIAS_CARRO.es)).toContain('donde Divoox Carro esté abierto');
    expect(JSON.stringify(GUIAS_CARRO.en)).toContain('where Divoox Car is open');
  });

  it('cada guía nueva tiene su propio ícono, no la hoja genérica', () => {
    const hoja = iconoDeGuia('zz-nada');
    for (const g of todas('es')) expect(iconoDeGuia(g.id), g.id).not.toBe(hoja);
  });
});

describe('C-DOCS-BUSCADOR: el buscador encuentra con palabras normales', () => {
  const buscar = (idioma: 'es' | 'en', q: string) =>
    DOCS[idioma]
      .flatMap((s) => s.guias.filter((g) => coincide(g, palabrasDeBusqueda(q))))
      .map((g) => g.id);

  it('sin acentos, sin mayúsculas y por palabras sueltas', () => {
    expect(palabrasDeBusqueda('¿Cómo pago con Pago Móvil?')).toEqual(['pago', 'pago', 'movil']);
    expect(buscar('es', 'taxi')).toEqual(expect.arrayContaining(['ride-car', 'drive-car']));
    expect(buscar('es', 'carro')).toEqual(expect.arrayContaining(['ride-car', 'drive-car-signup']));
    expect(buscar('es', 'pago movil')).toEqual(expect.arrayContaining(['ride-car-pay']));
    expect(buscar('en', 'taxi')).toEqual(expect.arrayContaining(['ride-car', 'drive-car']));
    expect(buscar('en', 'mobile payment')).toEqual(expect.arrayContaining(['ride-car-pay']));
    expect(buscar('es', 'recarga')).toEqual(
      expect.arrayContaining(['driver-commission-balance-top-up', 'flex-wallet-local-topup']),
    );
    expect(buscar('es', 'Excel')).toEqual(expect.arrayContaining(['flex-import-excel']));
    expect(buscar('es', 'exportar')).toEqual(expect.arrayContaining(['flex-export-spreadsheet']));
    expect(buscar('es', 'Zelle')).toEqual(expect.arrayContaining(['flex-wallet-local-topup']));
    expect(buscar('es', 'rastrear paquete')).toEqual(
      expect.arrayContaining(['flex-tracking-page']),
    );
    expect(buscar('es', 'enviar un paquete')).toEqual(expect.arrayContaining(['send-package']));
    expect(buscar('es', 'cliente no aparece')).toEqual(
      expect.arrayContaining(['driver-cash-mobile-payment-venezuela', 'order-not-delivered']),
    );
    expect(buscar('en', 'track package')).toEqual(expect.arrayContaining(['flex-tracking-page']));
  });
});
