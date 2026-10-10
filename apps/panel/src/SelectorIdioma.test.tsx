import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectorIdioma } from './SelectorIdioma';

describe('selector de idioma estilo Amazon', () => {
  it('botón con bandera y código; ventanita con opciones de círculo', async () => {
    const cambiar = vi.fn();
    render(<SelectorIdioma idioma="es" cambiar={cambiar} />);
    const boton = screen.getByRole('button', { name: 'Cambiar idioma' });
    expect(boton).toHaveTextContent('🇪🇸 ES');
    expect(boton).toHaveTextContent('▾');
    await userEvent.click(boton);
    expect(screen.getByText('Cambiar idioma', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /español - ES/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /English - EN/ }));
    expect(cambiar).toHaveBeenCalledWith('en');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la bandera del español es la de España, nunca la de México', () => {
    render(<SelectorIdioma idioma="es" cambiar={() => {}} />);
    expect(screen.getByRole('button')).not.toHaveTextContent('🇲🇽');
  });

  it('se cierra con Escape', async () => {
    render(<SelectorIdioma idioma="en" cambiar={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
