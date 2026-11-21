import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS } from './guias';
import { datosDeCaptura } from './lupaVisor';
import MEDIDAS from './capturasMedidas.json';

const abrirLupa = vi.fn();
vi.mock('./lupaVisor', async (original) => ({
  ...(await original<typeof import('./lupaVisor')>()),
  abrirLupa: (...a: unknown[]) => abrirLupa(...a),
}));

// Cada prueba dibuja la web entera con las 348 guías: con la máquina cargada pasa de 5 s.
describe('Docs', { timeout: 30_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('cada guía tiene su propia dirección y el menú de la izquierda nunca se pierde', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Docs');
    const barra = screen.getByRole('navigation', { name: /Secciones de Docs|Docs sections/ });
    expect(barra).toBeInTheDocument();
    // ETP-3x: con todas las guías, `getAllByRole('link', { name })` calcula el nombre accesible de
    // cada nodo de Docs y pasaba de 5 s con la máquina cargada (falló el pre-push). El enlace se
    // busca por su texto dentro de la barra: el mismo clic, sin recorrer toda la página.
    const enlace = [...barra.querySelectorAll('a')].find((a) =>
      /Cómo hacer tu primer pedido|How to place your first order/.test(a.textContent ?? ''),
    );
    expect(enlace).toBeTruthy();
    await userEvent.click(enlace!);
    expect(window.location.pathname).toBe('/docs/ordering/first-order');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /primer pedido|first order/,
    );
    // La barra sigue ahí, con la guía activa resaltada.
    expect(
      screen.getByRole('navigation', { name: /Secciones de Docs|Docs sections/ }),
    ).toBeInTheDocument();
    const activo = document.querySelector('.docs-barra a.activo');
    expect(activo).toHaveAttribute('href', '/docs/ordering/first-order');
  });

  it('C-DOCS-AL-GRANO: la guía va al grano — el título y el paso a paso antes que el menú y que la explicación larga', () => {
    window.history.pushState(null, '', '/docs/ordering/ride-moto');
    const { container } = render(<App />);
    const html = container.innerHTML;
    const titulo = html.indexOf('<h1');
    const pasos = html.indexOf('<ol');
    const menu = html.indexOf('docs-barra');
    expect(titulo).toBeGreaterThan(-1);
    expect(pasos).toBeGreaterThan(titulo);
    // El menú de todas las guías va DESPUÉS del contenido en la página (en pantallas anchas la hoja
    // de estilos lo muestra a la izquierda): el celular y Google llegan directo a la guía.
    expect(menu).toBeGreaterThan(pasos);
    // Y el paso a paso va antes que la explicación larga y que las capturas.
    const guia = container.querySelector('.docs-guia')!;
    const orden = [...guia.children].map((e) => e.tagName);
    expect(orden.indexOf('OL')).toBeLessThan(
      orden.findIndex((t, i) => t === 'H2' && i > orden.indexOf('OL')),
    );
    expect(orden.slice(0, orden.indexOf('OL')).filter((t) => t === 'P').length).toBeLessThanOrEqual(
      2,
    );
  });

  it('el buscador filtra mientras se escribe', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(
      screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ }),
      'alarm',
    );
    const tarjetas = document.querySelectorAll('.docs-contenido .docs-tarjeta');
    expect(tarjetas.length).toBeGreaterThanOrEqual(1);
    expect(tarjetas[0]).toHaveTextContent(/alarma|alarm/i);
    await userEvent.clear(screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ }));
    await userEvent.type(
      screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ }),
      'zzzzqqq',
    );
    expect(screen.getByText(/No encontramos nada|Nothing matched/)).toBeInTheDocument();
  });

  it('«¿Cómo hago…?» junta las preguntas y cada una lleva a su guía', async () => {
    window.history.pushState(null, '', '/docs/how-to');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/How do I|Cómo hago/);
    await userEvent.click(screen.getByRole('link', { name: 'How do I cancel an order?' }));
    expect(window.location.pathname).toBe('/docs/ordering/cancel-order');
    expect(screen.getByText('This guide answers')).toBeInTheDocument();
    // Pinta la App entera con todas las guías: con la máquina cargada pasaba de 5 s y frenaba el
    // envío a main sin que nada fallara de verdad (15 nov 2026).
  }, 20_000);

  it('el buscador también encuentra por pregunta', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(
      screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ }),
      'fixed schedule',
    );
    expect(document.querySelector('.docs-contenido .docs-tarjeta')).toHaveTextContent(
      /Start delivering/,
    );
  });

  it('las dos lenguas tienen las mismas guías', () => {
    const ids = (i: 'es' | 'en') => DOCS[i].flatMap((s) => s.guias.map((g) => `${s.id}/${g.id}`));
    expect(ids('en')).toEqual(ids('es'));
  });
  // C-DOCS-ENCONTRAR (29 oct 2026, Richard: «le doy clic, no abre nada», «no lo encontré»).
  it('al tocar un resultado se abre la guía y la búsqueda se limpia', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(
      screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ }),
      'salespeople',
    );
    await userEvent.click(
      document.querySelector<HTMLAnchorElement>('.docs-contenido .docs-tarjeta')!,
    );
    expect(window.location.pathname).toBe('/docs/courses/salespeople-presentation');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Course for salespeople');
    expect(screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ })).toHaveValue('');
  });

  it('Enter en el buscador abre el primer resultado', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(
      screen.getByRole('combobox', { name: /Buscar en Docs|Search Docs/ }),
      'driver presentation{Enter}',
    );
    expect(window.location.pathname).toBe('/docs/courses/drivers-presentation');
  });

  it('la guía abre aunque la dirección traiga otra sección o ninguna', () => {
    for (const ruta of ['/docs/restaurants/presentations', '/docs/presentations']) {
      window.history.pushState(null, '', ruta);
      const { unmount } = render(<App />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All presentations');
      unmount();
    }
  });

  it('una guía que no existe lo dice, no muestra el inicio como si nada', () => {
    window.history.pushState(null, '', '/docs/ordering/no-such-guide');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/doesn’t exist|no existe/);
  });

  it('los cursos y presentaciones van primero, con su PDF publicado en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const cursos = DOCS[idioma][0]!;
      expect(cursos.id).toBe('courses');
      const pdfs = cursos.guias.flatMap((g) => (g.descargas ?? []).map((d) => d.href));
      expect(new Set(pdfs).size).toBe(4);
      // C-PAQUETE-DIETA: los PDF ya no van en el paquete; el servidor los sirve desde el almacén en
      // esta misma dirección y el original vive en docs/presentaciones-pdf/.
      for (const href of pdfs) {
        expect(href).toMatch(/^\/docs\/presentaciones\/[a-z0-9-]+\.pdf$/);
        const nombre = href.split('/').pop()!;
        expect(existsSync(join(process.cwd(), 'docs', 'presentaciones-pdf', nombre)), href).toBe(
          true,
        );
        expect(existsSync(join(process.cwd(), 'apps', 'panel', 'public', href)), href).toBe(false);
      }
    }
  });

  // C-DOCS-BUSCADOR-MOTOR (15 nov 2026): la lista de sugerencias desde la primera letra.
  it('el buscador abre la lista de sugerencias desde la primera letra, con teclado', async () => {
    window.history.pushState(null, '', '/es/docs');
    render(<App />);
    const campo = screen.getByRole('combobox', { name: 'Buscar en Docs' });
    await userEvent.type(campo, 'w');
    expect(campo).toHaveAttribute('aria-expanded', 'true');
    const lista = screen.getByRole('listbox', { name: 'Guías que coinciden' });
    expect(lista.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    await userEvent.type(campo, 'allet');
    const opciones = [...lista.querySelectorAll('[role="option"]')];
    expect(opciones.length).toBeGreaterThan(3);
    expect(opciones.length).toBeLessThanOrEqual(20);
    // «wallet» en español trae la billetera, con la palabra resaltada.
    expect(opciones.slice(0, 5).some((o) => /billetera/i.test(o.textContent ?? ''))).toBe(true);
    expect(lista.querySelector('mark')).toHaveTextContent(/billetera/i);
    // Flecha abajo marca la primera y Enter la abre.
    await userEvent.keyboard('{ArrowDown}');
    expect(opciones[0]).toHaveAttribute('aria-selected', 'true');
    expect(campo).toHaveAttribute('aria-activedescendant', opciones[0]?.id);
    const titulo = opciones[0]?.querySelector('.docs-sugerencia-titulo')?.textContent ?? '';
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(titulo);
    // Escape cierra la lista sin borrar lo escrito.
    await userEvent.type(campo, 'moto');
    expect(campo).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
  });

  it('una búsqueda vieja guardada no tapa la guía que se abre por su enlace', async () => {
    window.history.pushState(null, '', '/es/docs');
    const { unmount } = render(<App />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar en Docs' }), 'tracking');
    await new Promise((r) => setTimeout(r, 700)); // el borrador se guarda al medio segundo
    unmount();
    window.history.pushState(null, '', '/es/docs/business/flex-wallet');
    render(<App />);
    // El borrador vuelve un instante después de dibujar: se espera a que llegue.
    await new Promise((r) => setTimeout(r, 100));
    await vi.waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/billetera/i),
    );
  }, 20_000);

  // C-DOCS-LUPA (15 nov 2026): cada captura es un botón «Ampliar la imagen» que abre la lupa.
  it('cada captura de una guía se abre en grande con la lupa', async () => {
    abrirLupa.mockClear();
    window.history.pushState(null, '', '/es/docs/business/flex-wallet');
    render(<App />);
    const botones = screen.getAllByRole('button', { name: /^Ampliar la imagen/ });
    const guia = DOCS.es.flatMap((s) => s.guias).find((g) => g.id === 'flex-wallet');
    expect(botones).toHaveLength(guia?.capturas?.length ?? -1);
    await userEvent.click(botones[0]!);
    await vi.waitFor(() => expect(abrirLupa).toHaveBeenCalledTimes(1));
    expect(abrirLupa).toHaveBeenCalledWith(guia?.capturas, 0, 'es', botones);
  });

  it('en inglés el botón dice «Enlarge image»', () => {
    window.history.pushState(null, '', '/docs/business/flex-wallet');
    render(<App />);
    expect(screen.getAllByRole('button', { name: /^Enlarge image/ }).length).toBeGreaterThan(0);
  });

  it('la lupa usa la versión grande cuando existe, y toda captura de Docs tiene sus medidas', () => {
    const medidas = MEDIDAS as Record<string, number[]>;
    const todas = (['es', 'en'] as const).flatMap((i) =>
      DOCS[i].flatMap((s) => s.guias.flatMap((g) => g.capturas ?? [])),
    );
    const sinMedidas = todas
      .map((c) => c.src.replace(/^.*\//, '').replace(/\.webp$/, ''))
      .filter((n) => !medidas[n]);
    expect(sinMedidas, 'corre node scripts/docs/capturas-grandes.mjs').toEqual([]);
    for (const c of todas) {
      const d = datosDeCaptura(c);
      // La liviana existe en el paquete; la nítida, si hay, va al almacén con su huella.
      expect(existsSync(join(__dirname, '../../../public', String(d.liviana.src))), c.src).toBe(
        true,
      );
      expect(String(d.src)).toMatch(
        /^\/docs\/|^\/media\/docs-grande\/[a-z0-9-]+-[0-9a-f]{8}\.webp$/,
      );
    }
    // C-DOCS-LUPA: las nítidas NO van en el paquete (lo hicieron imposible de publicar).
    expect(existsSync(join(__dirname, '../../../public/docs/grande'))).toBe(false);
    const billetera = datosDeCaptura({ src: '/docs/flex-billetera-es.webp', alt: 'x', pie: 'y' });
    expect(billetera.src).toMatch(/^\/media\/docs-grande\/flex-billetera-es-[0-9a-f]{8}\.webp$/);
    expect(Number(billetera.width)).toBeGreaterThan(960);
    expect(billetera.msrc).toBe('/docs/flex-billetera-es.webp');
  });
});
