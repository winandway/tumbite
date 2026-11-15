import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Guia } from './guias';
import { DOCS } from './guias';
import { GUIAS_CARRO } from './carro';
import { GUIAS_SEMANA } from './semana';
import { GUIAS_MOTO } from './borradores/moto';
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

/** C-CAPTURAS-POR-IDIOMA: lo que una guía en inglés no nombra (solo se ve en las capturas de Venezuela). */
const AJENO_EN_INGLES = [
  'vigía',
  'bolívar',
  'bolivar',
  'mobile payment',
  'pago móvil',
  'venezuela',
  'zelle',
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

  it('C-CAPTURAS-POR-IDIOMA: en inglés, Carro se enseña con ejemplos de Estados Unidos', () => {
    // Regla de Richard (15 nov 2026): al cambiar el idioma cambia la captura Y sus ejemplos. Las guías
    // en inglés no hablan de lo que solo se ve en las capturas de Venezuela…
    const ingles = JSON.stringify(GUIAS_CARRO.en).toLowerCase();
    for (const ajeno of AJENO_EN_INGLES) expect(ingles, ajeno).not.toContain(ajeno);
    expect(ingles).toContain('novi');
    // …y el guion toma cada idioma en su ciudad: español en El Vigía, inglés en Novi, Michigan.
    const guion = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'scripts', 'recorrido', 'capturas-carro.mjs'),
      'utf8',
    );
    expect(guion).toMatch(/correr\(LUGARES\.ve, \['es'\]\)/);
    expect(guion).toMatch(/correr\(LUGARES\.us, \['en'\]\)/);
    expect(guion).toContain("id: 'US-MI-NOVI'");
  });

  it('C-CAPTURAS-POR-IDIOMA: en inglés, Moto, Comida, Envíos y Flex se enseñan con ejemplos de Estados Unidos', () => {
    // 15 nov 2026 (segunda parte): lo mismo que Carro para el resto de las guías con capturas del
    // recorrido. El inglés no habla de lo que solo existe en Venezuela (pago móvil, bolívares, El Vigía)…
    const moto = [...GUIAS_MOTO.en.pasajero, ...GUIAS_MOTO.en.conductor];
    const semana = Object.values(GUIAS_SEMANA.en).flat();
    for (const [nombre, guias] of [
      ['moto', moto],
      ['semana', semana],
    ] as const) {
      const ingles = JSON.stringify(guias.map((g) => ({ ...g, id: '' }))).toLowerCase();
      for (const ajeno of AJENO_EN_INGLES)
        expect(ingles, `${nombre}: ${ajeno}`).not.toContain(ajeno);
      // …y ninguna captura en inglés sale de una pasada de Venezuela.
      for (const g of guias)
        for (const c of g.capturas ?? []) expect(c.src, g.id).not.toMatch(/-ve-/);
    }
    expect(JSON.stringify(moto)).toContain('Novi');
    expect(JSON.stringify(semana)).toContain('Novi');
    // Las guías cuyo tema es propio de los países donde se cobra en mano dicen en inglés, con
    // honestidad, que eso no se usa en Estados Unidos (no enseñan una pantalla de otro país).
    const porId = new Map([...moto, ...semana].map((g) => [g.id, JSON.stringify(g)]));
    for (const id of [
      'pay-on-delivery-venezuela',
      'driver-cash-mobile-payment-venezuela',
      'driver-commission-balance-top-up',
      'drive-moto-saldo',
    ])
      expect(porId.get(id), id).toMatch(/in the United States/);
    // Cada guion toma el español en su ciudad y el inglés en Novi, Michigan.
    const guion = (nombre: string) =>
      readFileSync(
        join(__dirname, '..', '..', '..', '..', '..', 'scripts', 'recorrido', nombre),
        'utf8',
      );
    const motoGuion = guion('capturas-moto-venezuela.mjs');
    expect(motoGuion).toMatch(/correr\(LUGARES\.ve, \['es'\]\)/);
    expect(motoGuion).toMatch(/correr\(LUGARES\.us, \['en'\]\)/);
    expect(motoGuion).toContain("id: 'US-MI-NOVI'");
    const comidaGuion = guion('capturas-comida-venezuela.mjs');
    expect(comidaGuion).toMatch(/correrVe\(\['es'\]\)/);
    expect(comidaGuion).toMatch(/correrUs\(\['en'\]\)/);
    expect(comidaGuion).toContain("id: 'US-MI-NOVI'");
    // Divoox Flex: todas sus guías en inglés (las de la semana y las de siempre), igual.
    const flex = DOCS.en.flatMap((sec) => sec.guias.filter((g) => g.id.startsWith('flex-')));
    expect(flex.length).toBeGreaterThan(10);
    const flexIngles = JSON.stringify(flex.map((g) => ({ ...g, id: '' }))).toLowerCase();
    for (const ajeno of [...AJENO_EN_INGLES, 'caracas', 'bcv', 'national id'])
      expect(flexIngles, `flex: ${ajeno}`).not.toContain(ajeno);
    expect(guion('capturas-flex.mjs')).toMatch(
      /idiomaPasada === 'en' \? NOMBRES\.en : NOMBRES\.es/,
    );
    const flexGuion = (nombre: string) =>
      readFileSync(
        join(__dirname, '..', '..', '..', '..', '..', 'scripts', 'flex', nombre),
        'utf8',
      );
    expect(flexGuion('capturas.mjs')).toMatch(/correr\(LUGARES\.us, \['en'\]\)/);
    expect(flexGuion('capturas.mjs')).toContain('Novi, MI 48375');
    expect(flexGuion('capturas-cobro.mjs')).toMatch(/correrUs\(\['en'\]\)/);
    expect(flexGuion('capturas-cobro.mjs')).toContain('Novi, MI 48375');
    const enviosGuion = guion('capturas-envios.mjs');
    expect(enviosGuion).toContain("id: 'US-MI-NOVI'");
    expect(enviosGuion).not.toMatch(/'Test (Driver|Sender|recipient)'/);
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
    // C-CAPTURAS-POR-IDIOMA: en inglés la guía de pagos de Carro habla de tarjeta y efectivo.
    expect(buscar('en', 'pay cash')).toEqual(expect.arrayContaining(['ride-car-pay']));
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
