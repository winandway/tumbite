import { describe, expect, it } from 'vitest';
import { DOCS } from './docs/guias';
import { TEXTOS_SITIO } from './textos';
import comoFunciona from './ComoFunciona.tsx?raw';
import flex from './Flex.tsx?raw';
import banner from './BannerCarretera.tsx?raw';
import landing from './Landing.tsx?raw';

/**
 * C-TEXTOS-PUBLICOS (13 nov 2026, orden de Richard) — todos los países. Lo que lee el público en la
 * web y en Docs: sin «Tumbite» (es el nombre interno), sin «Pronto / Muy pronto / En construcción»
 * fuera del aviso real de cobertura de una ciudad o zona (C-SOLO-LO-TERMINADO), sin anunciar Viajes
 * mientras está apagado, y sin nombrar Miami como si ya se lanzara (se prueba en Michigan y ninguna
 * ciudad está abierta al público). Las guías de Moto son de otro paquete y quedan fuera.
 */
const sinComentarios = (fuente: string) =>
  fuente
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
    .join('\n');

const docs = (['es', 'en'] as const).flatMap((i) =>
  DOCS[i].flatMap((s) =>
    s.guias
      .filter((g) => !/moto/.test(g.id))
      .map((g) => ({ id: `${i} ${s.id}/${g.id}`, texto: JSON.stringify(g) })),
  ),
);

describe('textos públicos (C-TEXTOS-PUBLICOS)', () => {
  it('ninguna página pública ni guía dice «Tumbite»', () => {
    expect(JSON.stringify(TEXTOS_SITIO)).not.toMatch(/tumbite/i);
    for (const g of docs) expect(g.texto, g.id).not.toMatch(/tumbite/i);
  });

  it('Docs no promete con «pronto»: solo el aviso real de zonas sin cobertura', () => {
    for (const g of docs) {
      const texto = g.texto.replace(/qué zonas abren pronto/g, '');
      expect(texto, g.id).not.toMatch(
        /\bpronto\b|coming soon|en construcción|under construction|We’re coming to more soon/i,
      );
    }
  });

  it('«Cómo funciona», Flex y el banner no prometen lo que viene ni anuncian Viajes', () => {
    for (const fuente of [comoFunciona, flex, landing].map(sinComentarios))
      expect(fuente).not.toMatch(/muy pronto|coming soon|Lo que viene|What’s next/i);
    // El banner sí dice «Muy pronto en <ciudad>» en la página de una ciudad: es el aviso de cobertura.
    for (const fuente of [comoFunciona, flex, banner, landing].map(sinComentarios))
      expect(fuente).not.toMatch(/Comida · Viajes · Envíos|Food · Rides · Delivery/);
  });

  it('la portada y «Cómo funciona» no nombran Miami como lanzamiento', () => {
    const portada = JSON.stringify([
      TEXTOS_SITIO.es.hero,
      TEXTOS_SITIO.en.hero,
      TEXTOS_SITIO.es.mapa,
      TEXTOS_SITIO.en.mapa,
      TEXTOS_SITIO.es.preguntas,
      TEXTOS_SITIO.en.preguntas,
    ]);
    expect(portada).not.toMatch(/Miami/);
    expect(sinComentarios(comoFunciona)).not.toMatch(/Empezamos en Miami|We start in Miami/);
    expect(sinComentarios(banner)).not.toMatch(/lugar = 'Miami'/);
  });

  it('la portada se presenta como «la startup Divoox»', () => {
    expect(TEXTOS_SITIO.es.hero.etiqueta).toMatch(/la startup Divoox/i);
    expect(TEXTOS_SITIO.en.hero.etiqueta).toMatch(/Divoox, a .*startup/);
  });
});
