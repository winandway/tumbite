import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { PAISES } from './cobertura';
import { olvidarCiudadesEnVivo } from './ciudadesEnVivo';
import { PaginaLugar } from './Lugar';
import { PAISES_ABIERTOS_PUBLICADOS, estadoDePais, olvidarPaisesAbiertos } from './paisesAbiertos';

/**
 * C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026, salieron noticias del lanzamiento) — Venezuela y todos
 * los países. Un país con al menos un servicio abierto al público NUNCA dice «muy pronto» ni
 * «coming soon» en ninguna parte de su página (título, etiqueta, texto, lema del desfile y su
 * descripción para lectores), ni en el pie; y el HTML que se prearma (de donde salen el título, la
 * descripción y la tarjeta social) tampoco. El estado sale del servidor, no de un texto fijo.
 */
const PRONTO = /pronto|pr[oó]ximamente|coming soon|\bsoon\b|is coming|llega muy/i;
const VENEZUELA = { VE: [{ id: 'moto', es: 'Moto', en: 'Moto' }] };

/** Todo lo que lee una persona o un buscador: el texto y las descripciones (aria-label, alt). */
function todoElTexto(raiz: ParentNode) {
  const etiquetas = [...raiz.querySelectorAll('[aria-label],[alt],[title]')].map((e) =>
    ['aria-label', 'alt', 'title'].map((a) => e.getAttribute(a) ?? '').join(' '),
  );
  return `${(raiz as Element).textContent ?? ''} ${etiquetas.join(' ')}`;
}

const servidor = (paises: Record<string, unknown> | null) =>
  vi.stubGlobal('fetch', async (url: string) =>
    String(url).includes('/datos/web/paises') && paises
      ? new Response(JSON.stringify({ paises }), { status: 200 })
      : new Response('{}', { status: 404 }),
  );

describe('C-PAIS-ABIERTO-SIN-PRONTO: un país abierto no dice «muy pronto»', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarCiudadesEnVivo();
    olvidarPaisesAbiertos();
  });
  afterEach(() => vi.unstubAllGlobals());

  for (const [ruta, idioma, titulo] of [
    ['/country/venezuela', 'en', 'Now in Venezuela'],
    ['/es/country/venezuela', 'es', 'Ya estamos en Venezuela'],
  ] as const) {
    it(`${ruta}: «${titulo}» con Moto, sin «pronto» en ningún texto ni descripción`, async () => {
      servidor(VENEZUELA);
      window.history.pushState(null, '', ruta);
      const { container } = render(<App />);
      const h1 = screen.getByRole('heading', { level: 1 });
      await waitFor(() => expect(h1).toHaveTextContent(titulo));
      const main = container.querySelector('main.lugar');
      expect(main).not.toBeNull();
      expect(todoElTexto(main!)).not.toMatch(PRONTO);
      // El lema del desfile y su descripción para lectores de pantalla.
      const desfile = screen.getByRole('img', { name: (n) => n.includes(titulo) });
      expect(desfile.getAttribute('aria-label')).toMatch(/Moto/);
      expect(todoElTexto(desfile)).not.toMatch(PRONTO);
      // La etiqueta dice «Live» / «Activo» y el texto nombra lo abierto, sin prometer comida.
      expect(main!.querySelector('.ld-etiqueta')).toHaveClass('lugar-activo');
      expect(main!.querySelector('.ld-entrada')?.textContent).toMatch(
        idioma === 'en' ? /motorbike rides/ : /viajes en moto/,
      );
      expect(main!.textContent).not.toMatch(/comida|food|restaurant/i);
      // Cambio de regla (25 nov 2026, orden de Richard): la WEB PÚBLICA sí enlaza las páginas de
      // ciudad desde la página del país (las apps siguen sin listar ciudades, C-SIN-LISTA-DE-CIUDADES).
      // Lo que se prueba ahora es que cada ciudad vaya a su página (C-CIUDAD-ABIERTA-SIN-PRONTO).
      expect(main!.querySelector('a[href$="/city/el-vigia"]')).not.toBeNull();
      expect(main!.querySelector('a[href$="/city/caracas"]')).not.toBeNull();
    });
  }

  it('el pie muestra Venezuela en verde, no «muy pronto»', async () => {
    servidor(VENEZUELA);
    window.history.pushState(null, '', '/');
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: /Países|Countries/ }));
    const ve = screen
      .getByRole('tabpanel')
      .querySelector('a[href="/country/venezuela"]')?.parentElement;
    await waitFor(() => expect(ve).toHaveClass('activo'));
    expect(ve?.textContent).not.toMatch(PRONTO);
  });

  it('manda el servidor: si Venezuela se cierra, vuelve a su página de siempre', async () => {
    servidor({});
    window.history.pushState(null, '', '/country/venezuela');
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Divoox is coming soon to Venezuela',
      ),
    );
  });

  it('Estados Unidos y los países sin nada abierto no cambian', () => {
    servidor(VENEZUELA);
    const eeuu = PAISES.find((p) => p.slug === 'united-states')!;
    const colombia = PAISES.find((p) => p.slug === 'colombia')!;
    expect(estadoDePais(eeuu, VENEZUELA)).toEqual({
      estado: 'activo',
      abierto: false,
      servicios: [],
    });
    expect(estadoDePais(colombia, VENEZUELA).estado).toBe('pronto');
    window.history.pushState(null, '', '/country/united-states');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Food delivery in the United States with Divoox',
    );
  });

  it('el HTML prearmado (título, descripción y tarjeta social salen de aquí) de cada país abierto', () => {
    // Sin consultas: es lo que escribe la publicación con el estado guardado de producción.
    for (const p of PAISES.filter((x) => estadoDePais(x, PAISES_ABIERTOS_PUBLICADOS).abierto))
      for (const idioma of ['es', 'en'] as const) {
        const html = renderToString(<PaginaLugar ruta={`/country/${p.slug}`} idioma={idioma} />);
        const visible = html.replace(/<[^>]+>/g, ' ');
        const atributos = [...html.matchAll(/(?:aria-label|alt|title)="([^"]*)"/g)].map(
          (m) => m[1],
        );
        expect(`${visible} ${atributos.join(' ')}`).not.toMatch(PRONTO);
      }
  });
});

/** Barre los textos fuente: ninguna frase junta Venezuela con «pronto» / «coming soon». */
describe('C-PAIS-ABIERTO-SIN-PRONTO: los textos fuente no anuncian Venezuela como «próximamente»', () => {
  const raiz = join(__dirname, '..', '..', '..', '..');
  const carpetas = [
    'apps/panel/src',
    'apps/cliente/src',
    'apps/repartidor/src',
    'apps/restaurante/src',
    'packages/movil/src',
    'packages/compartido/src',
    'apps/servidor/src',
  ];
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(d)) {
      const ruta = join(d, n);
      if (n === 'node_modules' || n.startsWith('.')) continue;
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(tsx?|json|md)$/.test(n) && !/\.test\.tsx?$/.test(n)) archivos.push(ruta);
    }
  };
  for (const c of carpetas) recorrer(join(raiz, c));

  it('sin «Venezuela … muy pronto / coming soon / próximamente» en ninguna línea', () => {
    const malas: string[] = [];
    const frase =
      /venezuela.{0,160}(muy pronto|pr[oó]ximamente|coming soon|llega(rá|mos)? pronto)|(muy pronto|pr[oó]ximamente|coming soon|llega(rá|mos)? pronto).{0,160}venezuela/i;
    for (const a of archivos)
      readFileSync(a, 'utf8')
        .split('\n')
        .forEach((l, i) => {
          // Los comentarios que explican esta misma regla no son texto para el público.
          if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
          if (frase.test(l)) malas.push(`${a.slice(raiz.length + 1)}:${i + 1}`);
        });
    expect(malas).toEqual([]);
    expect(archivos.length).toBeGreaterThan(100);
  });
});
