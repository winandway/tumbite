import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { olvidarCiudadesEnVivo } from './ciudadesEnVivo';

/**
 * C-MENU-MOVIL y C-DESFILE-FLOTA (4 nov 2026, Richard): en el celular el menú de la web va en la
 * hamburguesa; la avenida negra queda solo en «Cómo funciona» y el resto de las páginas lleva el
 * desfile de la flota sobre la línea roja.
 */
describe('menú del celular y banners', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarCiudadesEnVivo();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la hamburguesa abre el menú con todas las secciones y se cierra al elegir', async () => {
    window.history.pushState(null, '', '/');
    render(<App />);
    const boton = screen.getByRole('button', { name: 'Open menu' });
    await userEvent.click(boton);
    const menu = document.getElementById('menu-movil')!;
    for (const nombre of ['Order', 'Restaurants', 'Drivers', 'Flex', 'How it works', 'Docs'])
      expect(within(menu).getByRole('link', { name: nombre })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Download the apps' })).toHaveAttribute(
      'href',
      '/download',
    );
    await userEvent.click(within(menu).getByRole('link', { name: 'Docs' }));
    expect(document.getElementById('menu-movil')).toBeNull();
  });

  it('la portada lleva el desfile y «Cómo funciona» la avenida', () => {
    window.history.pushState(null, '', '/');
    const { unmount } = render(<App />);
    expect(document.querySelector('.desfile-con-lema')).not.toBeNull();
    expect(document.querySelector('.ld-carretera')).toBeNull();
    unmount();
    window.history.pushState(null, '', '/how-it-works');
    render(<App />);
    expect(document.querySelector('.ld-carretera')).not.toBeNull();
  });
});
