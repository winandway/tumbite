import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Docs, guiasRelacionadas } from './Docs';
import { DOCS } from './guias';

/**
 * C-DOCS-AL-GRANO (18 nov 2026, Richard: «en vez de salir directamente el dato, uno tiene que
 * navegar y pasar por arriba de toda la información»). En el celular el menú de Docs va plegado y
 * la guía abre en su título, con los pasos antes que la explicación larga. La medida real en
 * pantalla (375 de ancho) la vigila e2e/docs-al-grano.spec.ts; esto cuida la estructura.
 */
describe('Docs al grano', () => {
  const html = (ruta: string, idioma: 'es' | 'en' = 'es') =>
    renderToString(<Docs ruta={ruta} idioma={idioma} />);

  it('el menú llega plegado: el botón dice cerrado y la barra no va «abierta»', () => {
    for (const ruta of ['/docs', '/docs/how-to', '/docs/ordering', '/docs/ordering/ride-moto']) {
      const pagina = html(ruta);
      expect(pagina).toMatch(/class="docs-menu-boton"[^>]*aria-expanded="false"/);
      expect(pagina).toContain('<aside class="docs-barra">');
      // La barra nunca se pierde: sus enlaces siguen en la página para la gente y los buscadores.
      expect(pagina).toContain('class="docs-barra-cuerpo"');
    }
  });

  it('la hoja de estilos esconde el menú plegado en el celular y lo muestra en escritorio', () => {
    const css = readFileSync(join(__dirname, '..', '..', 'estilos.css'), 'utf8');
    const [celular = '', escritorio = ''] = css.split('@media (min-width: 900px) {\n  .docs {');
    expect(celular).toMatch(
      /\.docs-barra:not\(\.abierta\) \.docs-barra-cuerpo \{\s*display: none;/,
    );
    expect(escritorio.slice(0, 900)).toMatch(/\.docs-menu-boton \{\s*display: none;/);
    expect(escritorio.slice(0, 900)).toMatch(/\.docs-barra-cuerpo \{\s*display: block;/);
  });

  it('el botón abre el menú y lo vuelve a plegar', async () => {
    render(<Docs ruta="/docs/ordering/ride-moto" idioma="es" />);
    const boton = screen.getByRole('button', { name: 'Menú de Docs' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.docs-barra')).toHaveClass('abierta');
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('en TODAS las guías, en los dos idiomas: migas, título, resumen y pasos antes que lo demás', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const s of DOCS[idioma])
        for (const g of s.guias) {
          const pagina = html(`/docs/${s.id}/${g.id}`, idioma);
          const articulo = pagina.slice(pagina.indexOf('<article class="docs-guia">'));
          const en = (trozo: string) => articulo.indexOf(trozo);
          const donde = `${idioma} ${s.id}/${g.id}`;
          expect(en('class="docs-migas"'), donde).toBeGreaterThan(-1);
          expect(en('class="docs-migas"'), donde).toBeLessThan(en('<h1'));
          expect(en('<h1'), donde).toBeLessThan(en('class="docs-resumen"'));
          // Las pocas guías que solo explican (sin pasos) pasan del resumen a su explicación.
          if (g.pasos.length === 0) continue;
          expect(en('<ol'), donde).toBeGreaterThan(en('class="docs-resumen"'));
          for (const despues of ['class="docs-capturas"', 'class="docs-explicacion"'])
            if (en(despues) > -1)
              expect(en('<ol'), `${donde} ${despues}`).toBeLessThan(en(despues));
        }
  }, 60_000);

  it('cada guía enlaza guías relacionadas, y nunca a sí misma', () => {
    const ordering = DOCS.es.find((s) => s.id === 'ordering')!;
    const moto = ordering.guias.find((g) => g.id === 'ride-moto')!;
    const relacionadas = guiasRelacionadas(DOCS.es, moto);
    expect(relacionadas.length).toBeGreaterThan(0);
    expect(relacionadas.map((r) => r.guia.id)).not.toContain('ride-moto');
    const pagina = html('/docs/ordering/ride-moto');
    expect(pagina).toContain('Guías relacionadas');
    // Sin navegador el enlace sale sin el prefijo del idioma; en la página publicada lo lleva.
    for (const r of relacionadas) expect(pagina).toContain(`/docs/${r.seccion.id}/${r.guia.id}"`);
  });
});
