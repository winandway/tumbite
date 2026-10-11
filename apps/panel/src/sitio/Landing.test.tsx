import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

async function cambiarIdioma(i: 'es' | 'en') {
  await userEvent.click(screen.getByRole('button', { name: /Cambiar idioma|Change language/ }));
  await userEvent.click(
    screen.getByRole('radio', { name: i === 'es' ? /español - ES/ : /English - EN/ }),
  );
}

describe('sitio público', () => {
  it('muestra la landing en los dos idiomas con enlaces legales', async () => {
    window.history.pushState(null, '', '/');
    localStorage.clear();
    render(<App />);
    await cambiarIdioma('es');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Comida rica');
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacidad');
    await cambiarIdioma('en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Great food');
  });

  it('navega a la política de privacidad sin recargar', async () => {
    window.history.pushState(null, '', '/');
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: /Privacy|Privacidad/ }));
    expect(window.location.pathname).toBe('/privacidad');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Privacy Policy|Política de privacidad/,
    );
  });

  it('las páginas de términos y soporte existen', () => {
    for (const ruta of ['/terminos', '/soporte']) {
      window.history.pushState(null, '', ruta);
      const { unmount } = render(<App />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('soporte por WhatsApp', () => {
  it('el botón aparece solo cuando el servidor da el número', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { vi } = await import('vitest');
    const { Landing } = await import('./Landing');
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).includes('/datos/publico')
        ? new Response(JSON.stringify({ whatsapp: '13055550100' }), { status: 200 })
        : new Response('{}', { status: 404 }),
    );
    render(<Landing idioma="es" />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveAttribute(
        'href',
        'https://wa.me/13055550100',
      ),
    );
    vi.unstubAllGlobals();
  });
});
