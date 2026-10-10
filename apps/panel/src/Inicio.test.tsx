import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inicio } from './Inicio';

describe('Inicio del panel', () => {
  beforeEach(() => localStorage.clear());

  it('cambia de idioma con las banderas y lo recuerda', async () => {
    render(<Inicio />);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tumbite Dashboard');
    expect(localStorage.getItem('tumbite.idioma')).toBe('en');
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Panel de Tumbite');
  });

  it('lleva el crédito de Windoce LLC en el pie, en pestaña nueva', () => {
    render(<Inicio />);
    const enlace = screen.getByRole('link', { name: 'Windoce LLC' });
    expect(enlace).toHaveAttribute('href', 'https://windoce.com');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
