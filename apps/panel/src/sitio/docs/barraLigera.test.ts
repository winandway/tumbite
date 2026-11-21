import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error guion de compilación en JavaScript, sin tipos
import { barraLigera } from '../../../scripts/barraLigera.mjs';

/**
 * C-BARRA-LIGERA (21 nov 2026, segunda parte de C-PAQUETE-DIETA) — todos los países. La barra
 * lateral de Docs se repetía entera (más de 200 enlaces, unos 48 KB) en cada una de las páginas
 * prearmadas: decenas de megas del paquete del sitio. En la página prearmada, las secciones CERRADAS
 * viajan como un enlace a su página; la sección abierta va completa. Al cargar, la app dibuja la
 * barra entera de siempre (el menú izquierdo nunca se pierde).
 */
const ICONO = '<svg class="lucide icono"><path d="M1 1"></path></svg>';
const seccion = (id: string, titulo: string, abierta: boolean, pre = '') =>
  `<details${abierta ? ' open=""' : ''}><summary${abierta ? ' class="activo"' : ''}>${ICONO} <!-- -->${titulo}</summary><ul>` +
  [1, 2, 3]
    .map(
      (n) =>
        `<li><a href="${pre}/docs/${id}/guia-${n}"><svg class="icono icono-guia"><use href="#ig-Bell"></use></svg><span>Guía ${n} de ${titulo}</span></a></li>`,
    )
    .join('') +
  '</ul></details>';
const pagina = (pre = '') =>
  `<main><aside class="docs-barra"><div class="docs-barra-cuerpo"><a href="${pre}/docs" class="docs-inicio">Docs</a>` +
  `<nav aria-label="Docs sections">${seccion('ordering', 'Ordering', false, pre)}${seccion('drivers', 'For drivers', true, pre)}${seccion('account', 'Your account', false, pre)}</nav></div></aside>` +
  '<article><details class="docs-video-texto"><summary>Texto</summary><p>Queda igual</p></details></article></main>';

describe('C-BARRA-LIGERA: la barra de Docs prearmada no repite todas las guías', () => {
  it('las secciones cerradas quedan como un enlace a su página y la abierta va completa', () => {
    const html = barraLigera(pagina());
    expect(html).toContain(
      `<a class="docs-seccion-cerrada" href="/docs/ordering">${ICONO} <!-- -->Ordering</a>`,
    );
    expect(html).toContain('<a class="docs-seccion-cerrada" href="/docs/account">');
    expect(html).not.toContain('/docs/ordering/guia-1');
    expect(html).not.toContain('/docs/account/guia-3');
    // La sección donde está la persona sigue entera, con sus guías.
    expect(html).toContain('<details open=""><summary class="activo">');
    for (const n of [1, 2, 3]) expect(html).toContain(`/docs/drivers/guia-${n}`);
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.length).toBeLessThan(pagina().length * 0.75);
  });

  it('respeta el prefijo del español y no toca nada fuera de la barra', () => {
    const html = barraLigera(pagina('/es'));
    expect(html).toContain('<a class="docs-seccion-cerrada" href="/es/docs/ordering">');
    expect(html).toContain(
      '<details class="docs-video-texto"><summary>Texto</summary><p>Queda igual</p></details>',
    );
    const sinBarra = '<main><details><summary>Pregunta</summary><p>Respuesta</p></details></main>';
    expect(barraLigera(sinBarra)).toBe(sinBarra);
  });

  it('de la lámina de íconos solo viajan los que la página usa', () => {
    const lamina = (ids: string[]) =>
      `<svg aria-hidden="true"><defs>${ids.map((i) => `<symbol id="ig-${i}" viewBox="0 0 24 24"><svg class="lucide"><path d="M1 1"></path></svg></symbol>`).join('')}</defs></svg>`;
    // «Bell» lo usan las guías de la sección abierta; «Search», el artículo; «Truck» y «Gift», nadie.
    const html = barraLigera(
      `<div class="docs">${lamina(['Bell', 'Truck', 'Search', 'Gift'])}${pagina()}<svg><use href="#ig-Search"></use></svg></div>`,
    );
    expect(html).toContain('<symbol id="ig-Bell"');
    expect(html).toContain('<symbol id="ig-Search"');
    expect(html).not.toContain('ig-Truck');
    expect(html).not.toContain('ig-Gift');
    expect(html.match(/<symbol /g)).toHaveLength(2);
    // Ningún ícono usado se queda sin su dibujo.
    for (const [, id] of html.matchAll(/href="#(ig-[A-Za-z0-9]+)"/g))
      expect(html).toContain(`<symbol id="${id}"`);
  });

  it('una sección que no se entiende detiene la compilación en vez de perder enlaces en silencio', () => {
    const rara = pagina().replace(/<li>.*?<\/li>/g, '');
    expect(() => barraLigera(rara)).toThrow(/barra/);
  });

  it('el prearmado la usa y la barra ligera tiene su estilo', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const prerender = readFileSync(join(raiz, 'scripts', 'prerender.mjs'), 'utf8');
    expect(prerender).toContain("from './barraLigera.mjs'");
    expect(prerender).toContain('barraLigera(renderToString(');
    expect(readFileSync(join(raiz, 'src', 'estilos.css'), 'utf8')).toMatch(
      /\.docs-barra \.docs-seccion-cerrada\b/,
    );
  });
});
