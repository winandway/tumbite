import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import {
  GUIA_REGISTRO_CIUDAD,
  PASOS_CAPTURA_REGISTRO_CIUDAD,
  REGISTRO_CIUDAD_PUBLICADA,
  conRegistroCiudad,
} from './registroCiudad';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). La guía pública
 * «Cómo registrarte desde cualquier ciudad» existe en los dos idiomas con la misma dirección, lleva
 * sus capturas de cada paso en su idioma, no enumera dónde funciona Divoox (C-SIN-LISTA-DE-CIUDADES)
 * ni nada interno, y al publicarse entra en «Tu cuenta» y las guías viejas del registro la nombran.
 */
const PROHIBIDO = [
  // C-SIN-LISTA-DE-CIUDADES: frases que enumeran dónde funciona o abre Divoox.
  /ya funciona en/i,
  /already works in/i,
  /ya estamos en/i,
  /abrimos pronto en/i,
  /opening soon in/i,
  /próximas aperturas/i,
  /¿tu ciudad no está\?/i,
  /don’t see your city\?/i,
  // Ninguna ciudad concreta ni zona interna (las que tenemos o tendremos).
  /el vig[ií]a|tucan[ií]|miami|novi\b|maracaibo|caracas|gilroy|san jos[eé]|los [aá]ngeles|nueva york|new york/i,
  // Nada técnico ni interno.
  /superadmin|panel de control|lugarId|geonames|\/datos\/|zona_id|camila/i,
];

const textoDe = (g: (typeof GUIA_REGISTRO_CIUDAD)['es']) =>
  [
    g.titulo,
    g.resumen,
    ...(g.explicacion ?? []),
    ...(g.preguntas ?? []),
    ...g.pasos,
    g.nota ?? '',
    ...(g.capturas ?? []).flatMap((c) => [c.alt, c.pie]),
  ].join('\n');

describe('C-REGISTRO-TODO-EL-PAIS (parte C): la guía pública del registro desde cualquier ciudad', () => {
  it('existe en español y en inglés, con la misma dirección y completa', () => {
    const es = GUIA_REGISTRO_CIUDAD.es;
    const en = GUIA_REGISTRO_CIUDAD.en;
    expect(es.id).toBe('sign-up-from-any-city');
    expect(en.id).toBe(es.id);
    expect(es.titulo).toBe('Cómo registrarte desde cualquier ciudad');
    expect(en.titulo).toBe('How to sign up from any city');
    for (const g of [es, en]) {
      expect(g.explicacion?.length ?? 0).toBeGreaterThanOrEqual(5);
      expect(g.pasos.length).toBeGreaterThanOrEqual(4);
      expect(g.preguntas?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
    // País → Estado → Ciudad, y que la cuenta se crea aunque no haya viajes.
    expect(textoDe(es)).toMatch(/país.*estado.*ciudad/is);
    expect(textoDe(es)).toMatch(/tu cuenta (se crea|queda creada)/i);
    expect(textoDe(en)).toMatch(/country.*state.*city/is);
    expect(textoDe(en)).toMatch(/account is (always |still )?created/i);
  });

  it('lleva una captura de cada paso, en su idioma, sin maquetas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const srcs = (GUIA_REGISTRO_CIUDAD[idioma].capturas ?? []).map((c) => c.src);
      expect(srcs).toEqual(
        PASOS_CAPTURA_REGISTRO_CIUDAD.map((p) => `/docs/registro-ciudad-${p}-${idioma}.webp`),
      );
      for (const c of GUIA_REGISTRO_CIUDAD[idioma].capturas ?? [])
        expect(c.alt.length).toBeGreaterThan(40);
    }
  });

  it('no enumera dónde funciona Divoox, no nombra ciudades y no trae nada interno', () => {
    for (const idioma of ['es', 'en'] as const) {
      const texto = textoDe(GUIA_REGISTRO_CIUDAD[idioma]);
      for (const r of PROHIBIDO) expect(texto, `${idioma}: ${r}`).not.toMatch(r);
    }
  });

  it('al publicarse entra en «Tu cuenta» y las guías viejas del registro la nombran', () => {
    for (const idioma of ['es', 'en'] as const) {
      const antes = DOCS[idioma];
      const despues = conRegistroCiudad(antes, idioma, true);
      const cuenta = despues.find((s) => s.id === 'account');
      expect(cuenta?.guias.map((g) => g.id)).toContain('sign-up-from-any-city');
      const titulo = GUIA_REGISTRO_CIUDAD[idioma].titulo;
      for (const [seccion, guia] of [
        ['account', 'create-account'],
        ['drivers', 'get-started'],
      ] as const) {
        const g = despues.find((s) => s.id === seccion)?.guias.find((x) => x.id === guia);
        expect(g?.explicacion?.join(' '), `${idioma} ${seccion}/${guia}`).toContain(titulo);
      }
      const zona = despues
        .find((s) => s.id === 'ordering')
        ?.guias.find((x) => x.id === 'where-divoox-works');
      expect(zona?.explicacion?.at(-1)).toMatch(/espera de tu ciudad|waits for your city/);
      // La guía del restaurante que se llama igual («get-started») no se toca.
      const rest = despues
        .find((s) => s.id === 'restaurants')
        ?.guias.find((x) => x.id === 'get-started');
      const restAntes = antes
        .find((s) => s.id === 'restaurants')
        ?.guias.find((x) => x.id === 'get-started');
      expect(rest).toEqual(restAntes);
    }
  });

  it('publicada, cada captura es REAL y está: original en docs/capturas y WebP en lo público', () => {
    if (!REGISTRO_CIUDAD_PUBLICADA) return;
    const raiz = join(__dirname, '..', '..', '..', '..', '..');
    const faltan = (['es', 'en'] as const).flatMap((idioma) =>
      PASOS_CAPTURA_REGISTRO_CIUDAD.flatMap((paso) => [
        `docs/capturas/registro-ciudad-${paso}-${idioma}.png`,
        `apps/panel/public/docs/registro-ciudad-${paso}-${idioma}.webp`,
      ]).filter((r) => !existsSync(join(raiz, r))),
    );
    expect(faltan).toEqual([]);
    for (const idioma of ['es', 'en'] as const)
      expect(DOCS[idioma].flatMap((s) => s.guias.map((g) => g.id))).toContain(
        'sign-up-from-any-city',
      );
  });

  it('mientras faltan sus capturas reales, Docs sigue igual (ninguna guía sin capturas)', () => {
    if (REGISTRO_CIUDAD_PUBLICADA) return;
    for (const idioma of ['es', 'en'] as const) {
      expect(DOCS[idioma].flatMap((s) => s.guias.map((g) => g.id))).not.toContain(
        'sign-up-from-any-city',
      );
      expect(conRegistroCiudad(DOCS[idioma], idioma)).toEqual(DOCS[idioma]);
    }
  });
});
