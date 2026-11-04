import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { GOOGLE_PLAY } from '@tumbite/compartido';
import { olvidarCiudadesEnVivo } from './ciudadesEnVivo';

/**
 * C-ENLACES-TIENDAS (4 nov 2026, Richard: «en el buscador no está apareciendo… coloque el link con un
 * logo visible en la cabecera, en el pie y en 3 o 4 sitios»). Las tres apps ya están publicadas en
 * Google Play, pero el buscador tarda días en mostrarlas y confunde «Divoox» con «iVoox». La web las
 * enlaza directo: cabecera, portada, cada sección (clientes, restaurantes, repartidores) y el pie.
 * El App Store no se muestra hasta que Apple apruebe (solo lo terminado). Todos los países.
 */
describe('enlaces a las apps en Google Play', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarCiudadesEnVivo();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la cabecera, la portada, las secciones y el pie llevan a las tres apps', () => {
    window.history.pushState(null, '', '/');
    render(<App />);
    const cabecera = screen.getByRole('banner');
    // C-DESCARGAS: la cabecera lleva a la zona de descarga, donde cada quien elige su app.
    expect(within(cabecera).getByRole('link', { name: /Get the app/ })).toHaveAttribute(
      'href',
      '/download',
    );
    const pie = screen.getByRole('contentinfo');
    for (const url of Object.values(GOOGLE_PLAY))
      expect(pie.querySelector(`a[href="${url}"]`), url).not.toBeNull();
    for (const id of ['customers', 'restaurants', 'drivers']) {
      const seccion = document.getElementById(id);
      expect(seccion?.querySelector('a[href^="https://play.google.com/"]'), id).not.toBeNull();
    }
    // Se abren en una pestaña nueva, sin pasar quién los abrió.
    for (const a of document.querySelectorAll('a[href^="https://play.google.com/"]'))
      expect(a.getAttribute('rel')).toContain('noopener');
    // Lo que no está terminado no se muestra: nada de «Coming soon» de las tiendas.
    expect(document.body.textContent).not.toMatch(/Coming soon to the App Store/);
  });

  it('la zona de descarga trae las tres apps, con su ícono, para qué es cada una y su botón', () => {
    window.history.pushState(null, '', '/es/download');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Descarga las apps de Divoox',
    );
    for (const [app, url] of Object.entries(GOOGLE_PLAY)) {
      const tarjeta = screen.getByTestId(`descarga-${app}`);
      expect(tarjeta.querySelector(`a[href="${url}"]`), app).not.toBeNull();
      expect(tarjeta.querySelector('img')?.getAttribute('src')).toBe(`/marca/app-${app}.webp`);
    }
  });
});
