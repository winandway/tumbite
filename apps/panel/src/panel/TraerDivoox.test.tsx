import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TraerDivoox } from './TraerDivoox';

/** C-DISPONIBLE-MUNDO (todos los países): la web deja pedir la ciudad (sin enumerar dónde funciona). */
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });

describe('disponible en todo el mundo (web)', () => {
  it('el restaurante fuera de cobertura pide su ciudad y ve la confirmación en la misma pantalla', async () => {
    const llamadas: { url: string; cuerpo: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        llamadas.push({ url, cuerpo: JSON.parse(String(init?.body ?? '{}')) });
        return responder({ ok: true, zona: null }, 201);
      }),
    );
    render(
      <TraerDivoox
        idioma="es"
        cuenta="u1"
        nombre="Persona"
        correo="correo@ejemplo.com"
        negocio="Restaurante"
        telefono="0000000000"
        punto={{ lat: -33.45, lng: -70.67 }}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Ciudad, país'), 'Santiago, Chile');
    await userEvent.click(screen.getByRole('button', { name: 'Quiero traer Divoox a mi ciudad' }));
    await waitFor(() => expect(screen.getByTestId('traer-divoox-listo')).toBeTruthy());
    expect(llamadas[0]?.url).toContain('/datos/lista-espera');
    expect(llamadas[0]?.cuerpo).toMatchObject({
      tipo: 'restaurante',
      ciudad: 'Santiago, Chile',
      negocio: 'Restaurante',
      lat: -33.45,
    });
  });
});
