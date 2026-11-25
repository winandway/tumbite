import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type ListaPapelesPais,
  listaPapelesDeFabrica,
  normalizarLista,
  perfilPasajeros,
  politicaPlazoDeFabrica,
} from '@tumbite/compartido';
import { PapelesDelPais } from './PapelesDelPais';

/** C-PAPELES-POR-PAIS (24 nov 2026): la lista de papeles del país en Ajustes. */
const lista = (): ListaPapelesPais =>
  normalizarLista(
    listaPapelesDeFabrica(perfilPasajeros('VE')),
    perfilPasajeros('VE'),
    politicaPlazoDeFabrica('VE').exentos,
  );

afterEach(() => localStorage.clear());

describe('C-PAPELES-POR-PAIS: los papeles del país en Ajustes', () => {
  it('viene apagada, dice qué frena y qué solo se pide, y guarda la lista entera', async () => {
    const guardar = vi.fn(async (l: ListaPapelesPais) => l);
    render(<PapelesDelPais pais="VE" lista={lista()} guardar={guardar} idioma="es" />);
    expect(screen.getByTestId('papeles-pais-activa')).not.toBeChecked();
    expect(screen.getByText(/el conductor ve los papeles de siempre/)).toBeInTheDocument();
    expect(screen.getByTestId('papel-pais-frena-certificado_medico')).toHaveTextContent(
      'Solo se pide',
    );
    expect(screen.getByTestId('papel-pais-frena-registro')).toHaveTextContent('Frena las carreras');
    await userEvent.click(screen.getByTestId('papeles-pais-activa'));
    await userEvent.click(screen.getByTestId('papeles-pais-guardar'));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const enviado = guardar.mock.calls[0]?.[0];
    expect(enviado?.activa).toBe(true);
    expect(enviado?.papeles.map((p) => p.es)).toContain('Certificado médico');
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();
  });

  it('no pierde lo escrito: al volver lo recupera, y si el servidor falla se queda en pantalla', async () => {
    const guardar = vi.fn(async () => {
      throw new Error('Sin conexión');
    });
    const { unmount } = render(
      <PapelesDelPais pais="VE" lista={lista()} guardar={guardar} idioma="es" />,
    );
    const casilla = screen.getByLabelText('Nombre en español · certificado_medico');
    await userEvent.clear(casilla);
    await userEvent.type(casilla, 'Certificado médico vigente');
    await userEvent.click(screen.getByTestId('papeles-pais-guardar'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(casilla).toHaveValue('Certificado médico vigente');
    unmount();
    render(<PapelesDelPais pais="VE" lista={lista()} guardar={guardar} idioma="es" />);
    expect(await screen.findByText(/Recuperamos lo que estabas escribiendo/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre en español · certificado_medico')).toHaveValue(
      'Certificado médico vigente',
    );
  });

  it('en inglés, y quitar un papel vive en los tres puntos', async () => {
    const guardar = vi.fn(async (l: ListaPapelesPais) => l);
    render(<PapelesDelPais pais="VE" lista={lista()} guardar={guardar} idioma="en" />);
    expect(screen.getByText('Documents drivers are asked for in this country')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove from the list' })).toBeNull();
    const fila = screen.getByTestId('papel-pais-certificado_medico');
    await userEvent.click(fila.querySelector('button[aria-label="More options"]') as HTMLElement);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from the list' }));
    expect(screen.queryByTestId('papel-pais-certificado_medico')).toBeNull();
  });
});
