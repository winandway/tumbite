import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { CIUDADES, COCINAS, PAISES } from './cobertura';
import { DOCS } from './docs/guias';

describe('pie de página y páginas por lugar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('el pie trae todos los países, ciudades y comidas como enlaces reales, y Estados Unidos es el único activo', () => {
    window.history.pushState(null, '', '/');
    render(<App />);
    const pie = screen.getByRole('contentinfo');
    for (const p of PAISES) expect(pie.querySelector(`a[href="/pais/${p.slug}"]`)).not.toBeNull();
    for (const c of CIUDADES)
      expect(pie.querySelector(`a[href="/ciudad/${c.slug}"]`)).not.toBeNull();
    for (const c of COCINAS)
      expect(pie.querySelector(`a[href="/comida/${c.slug}"]`)).not.toBeNull();
    expect(PAISES.filter((p) => p.estado === 'activo').map((p) => p.slug)).toEqual([
      'estados-unidos',
    ]);
    expect(pie.querySelector('a[href="https://windoce.com"]')).not.toBeNull();
  });

  it('la pestaña de países muestra «muy pronto» en los que no están activos', async () => {
    window.history.pushState(null, '', '/');
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: /Países|Countries/ }));
    const panel = screen.getByRole('tabpanel');
    const rumania = panel.querySelector('a[href="/pais/rumania"]')?.parentElement;
    expect(rumania).toHaveClass('pronto');
    expect(rumania).toHaveTextContent(/Muy pronto|Coming soon/);
    const eeuu = panel.querySelector('a[href="/pais/estados-unidos"]')?.parentElement;
    expect(eeuu).toHaveClass('activo');
  });

  it('cada país tiene su propia página con los tres formularios de lista de espera', async () => {
    window.history.pushState(null, '', '/pais/colombia');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Colombia/);
    expect(screen.getAllByRole('form')).toHaveLength(3);
    window.history.pushState(null, '', '/ciudad/miami');
  });

  it('una ciudad activa dice que está activa y de qué país es', () => {
    window.history.pushState(null, '', '/ciudad/miami');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Miami/);
    expect(screen.getAllByText(/Estados Unidos|United States/).length).toBeGreaterThan(0);
  });

  it('un lugar que no existe lo dice y no rompe', () => {
    window.history.pushState(null, '', '/pais/atlantida');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/no existe|doesn’t exist/);
  });

  it('ningún enlace del pie lleva a una página que no existe (C-PIE-ENLACES)', () => {
    window.history.pushState(null, '', '/');
    render(<App />);
    const pie = screen.getByRole('contentinfo');
    const existen = new Set([
      '/',
      '/como-funciona',
      '/privacidad',
      '/terminos',
      '/terminos-restaurantes',
      '/terminos-repartidores',
      '/borrar-cuenta',
      '/soporte',
      '/docs',
      '/panel',
      '/app/',
      '/repartidor/',
      ...DOCS.es.flatMap((sec) => [
        `/docs/${sec.id}`,
        ...sec.guias.map((g) => `/docs/${sec.id}/${g.id}`),
      ]),
      ...PAISES.map((p) => `/pais/${p.slug}`),
      ...CIUDADES.map((c) => `/ciudad/${c.slug}`),
      ...COCINAS.map((c) => `/comida/${c.slug}`),
    ]);
    const internos = [...pie.querySelectorAll('a[href^="/"]')].map(
      (a) => (a.getAttribute('href') ?? '').split('#')[0],
    );
    expect(internos.length).toBeGreaterThan(60);
    const rotos = internos.filter((h) => !existen.has(h || '/'));
    expect(rotos).toEqual([]);
  });

  it('cada país tiene texto propio: sus primeras ciudades, idioma y moneda', () => {
    for (const p of PAISES) {
      expect(p.primerasCiudades?.length).toBeGreaterThanOrEqual(2);
      expect(p.idioma?.es).toBeTruthy();
      expect(p.moneda?.en).toBeTruthy();
      expect(p.region).toBeTruthy();
    }
    expect(PAISES.length).toBeGreaterThanOrEqual(30);
    // Todos los de habla hispana, Brasil y España.
    for (const s of [
      'espana',
      'brasil',
      'argentina',
      'chile',
      'peru',
      'republica-dominicana',
      'guinea-ecuatorial',
    ])
      expect(PAISES.some((p) => p.slug === s)).toBe(true);
  });
});
