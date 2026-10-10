import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

describe('sitio público', () => {
  it('muestra la landing en los dos idiomas con enlaces legales', async () => {
    window.history.pushState(null, '', '/');
    localStorage.clear();
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Comida rica');
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacidad');
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
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
