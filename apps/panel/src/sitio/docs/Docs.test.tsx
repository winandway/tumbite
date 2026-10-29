import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS } from './guias';

describe('Docs', () => {
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
    await userEvent.click(
      screen.getAllByRole('link', {
        name: /Cómo hacer tu primer pedido|How to place your first order/,
      })[0]!,
    );
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

  it('el buscador filtra mientras se escribe', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(screen.getByRole('searchbox'), 'alarm');
    const tarjetas = document.querySelectorAll('.docs-contenido .docs-tarjeta');
    expect(tarjetas.length).toBeGreaterThanOrEqual(1);
    expect(tarjetas[0]).toHaveTextContent(/alarma|alarm/i);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzzzqqq');
    expect(screen.getByText(/No encontramos nada|Nothing matched/)).toBeInTheDocument();
  });

  it('«¿Cómo hago…?» junta las preguntas y cada una lleva a su guía', async () => {
    window.history.pushState(null, '', '/docs/how-to');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/How do I|Cómo hago/);
    await userEvent.click(screen.getByRole('link', { name: 'How do I cancel an order?' }));
    expect(window.location.pathname).toBe('/docs/ordering/cancel-order');
    expect(screen.getByText('This guide answers')).toBeInTheDocument();
  });

  it('el buscador también encuentra por pregunta', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(screen.getByRole('searchbox'), 'fixed schedule');
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
    await userEvent.type(screen.getByRole('searchbox'), 'salespeople');
    await userEvent.click(
      document.querySelector<HTMLAnchorElement>('.docs-contenido .docs-tarjeta')!,
    );
    expect(window.location.pathname).toBe('/docs/courses/salespeople-presentation');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Course for salespeople');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('Enter en el buscador abre el primer resultado', async () => {
    window.history.pushState(null, '', '/docs');
    render(<App />);
    await userEvent.type(screen.getByRole('searchbox'), 'driver presentation{Enter}');
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
      for (const href of pdfs)
        expect(existsSync(join(process.cwd(), 'apps', 'panel', 'public', href)), href).toBe(true);
    }
  });
});
