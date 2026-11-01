import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Acceso } from './Acceso';

/**
 * C-FLEX-CUENTA-EMPRESA (1 nov 2026): quien entra por el panel de empresas (Divoox Flex) crea una
 * cuenta de empresa (rol cliente), nunca una de restaurante. El de restaurantes sigue igual.
 */
describe('C-FLEX-CUENTA-EMPRESA', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  async function registrar(tipo?: 'empresa') {
    const cuerpos: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('/registro')) {
        cuerpos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({ token: 't', usuario: { id: 'u', nombre: 'Ana', rol: 'cliente' } }),
          { status: 201 },
        );
      }
      return new Response('{}', { status: 200 });
    });
    render(<Acceso idioma="es" alEntrar={() => undefined} tipo={tipo} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana Prueba');
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getAllByRole('button', { name: /Crear/ }).at(-1)!);
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    return cuerpos[0]!;
  }

  it('desde el panel de empresas crea una cuenta de empresa', async () => {
    expect((await registrar('empresa')).rol).toBe('cliente');
    expect(screen.getByRole('heading').textContent).toMatch(/empresa/i);
    expect(screen.queryByText('Términos para restaurantes')).toBeNull();
  });

  it('desde el panel de siempre sigue creando la de restaurante', async () => {
    expect((await registrar()).rol).toBe('restaurante');
  });
});
