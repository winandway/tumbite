import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inversionistas } from './Inversionistas';

/**
 * C-FORMULARIO-ANTES (25 oct 2026): en la página de los anuncios de franquicias el WhatsApp de
 * ventas sale SOLO después de enviar el formulario y solo a quien tiene el capital mínimo. Así no
 * escribe cualquiera que toca un botón (pasó en campañas anteriores de Richard).
 */
function servidor() {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/datos/publico'))
      return new Response(JSON.stringify({ whatsappVentas: '13055550100' }), { status: 200 });
    if (u.includes('/datos/franquicias') && init?.method === 'POST')
      return new Response(JSON.stringify({ ok: true, enlace: `/t/${'a'.repeat(44)}` }), {
        status: 201,
      });
    return new Response('{}', { status: 404 });
  });
}

async function llenar(capital: string) {
  await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Persona Inversionista');
  await userEvent.type(screen.getByLabelText('Correo'), 'persona@ejemplo.com');
  await userEvent.type(screen.getByLabelText('Teléfono (con código de país)'), '+573000000000');
  const pais = screen.getByLabelText('País') as HTMLSelectElement;
  await userEvent.selectOptions(pais, pais.options[1]!.value);
  await userEvent.type(screen.getByLabelText('Ciudad'), 'Ciudad de prueba');
  await userEvent.selectOptions(
    screen.getByLabelText('Capital disponible para el lanzamiento'),
    capital,
  );
  await userEvent.selectOptions(screen.getByLabelText('¿Cuándo quieres arrancar?'), 'ya');
}

describe('página de inversionistas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('el WhatsApp aparece solo después de enviar el formulario con capital', async () => {
    servidor();
    render(<Inversionistas idioma="es" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sea dueño de la app');
    // Antes de enviar: no hay forma de escribir por WhatsApp.
    expect(screen.queryByRole('link', { name: 'Escríbenos por WhatsApp' })).toBeNull();
    await llenar('50k-150k');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mi solicitud' }));
    const enlace = await screen.findByRole('link', { name: 'Escríbenos por WhatsApp' });
    expect(enlace.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/13055550100\?text=/);
    expect(decodeURIComponent(enlace.getAttribute('href')!)).toContain('Ciudad de prueba');
  });

  it('sin el capital mínimo no se ofrece el WhatsApp', async () => {
    servidor();
    render(<Inversionistas idioma="es" />);
    await llenar('menos-50k');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mi solicitud' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Escríbenos por WhatsApp' })).toBeNull();
  });
});
