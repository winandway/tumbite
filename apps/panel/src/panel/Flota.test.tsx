import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Flota } from './Flota';

/** C-FLOTA-PROPIA (Chile y todos los países): el restaurante arma su equipo de reparto. */
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });

const BASE = {
  disponible: true,
  modo: 'divoox',
  respaldo: false,
  repartidores: [{ id: 'u1', nombre: 'Repartidor Uno', conectado: true, ocupado: false }],
  invitaciones: [],
  sinRepartidor: [],
};

function servidor(datos = BASE) {
  const llamadas: { metodo: string; url: string; cuerpo: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      llamadas.push({ metodo, url, cuerpo: JSON.parse(String(init?.body ?? '{}')) });
      if (metodo === 'POST')
        return json(
          { invitacion: { id: 'i1' }, enlace: 'https://divoox.com/driver/fleet/abc' },
          201,
        );
      if (metodo === 'PUT') return json({ ok: true });
      return json(datos);
    }),
  );
  return llamadas;
}

describe('pantalla «Mis repartidores» (C-FLOTA-PROPIA)', () => {
  it('elige flota propia con respaldo y lo guarda', async () => {
    const llamadas = servidor();
    render(<Flota idioma="es" />);
    await userEvent.click(await screen.findByLabelText(/Mis propios repartidores/));
    await userEvent.click(screen.getByLabelText(/pasar el pedido a los de Divoox/));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByText('Guardado.')).toBeTruthy());
    expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
      modo: 'propia',
      respaldo: true,
    });
  });

  it('invita a un repartidor y muestra el enlace para compartir, con WhatsApp', async () => {
    const llamadas = servidor();
    render(<Flota idioma="es" />);
    await userEvent.type(
      await screen.findByPlaceholderText('Nombre del repartidor'),
      'Repartidor Dos',
    );
    await userEvent.type(screen.getByPlaceholderText('correo@ejemplo.com'), 'dos@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));
    const caja = await screen.findByTestId('flota-enlace');
    expect(caja.textContent).toContain('https://divoox.com/driver/fleet/abc');
    expect(
      screen.getByRole('link', { name: 'Enviar por WhatsApp' }).getAttribute('href'),
    ).toContain('wa.me');
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({
      nombre: 'Repartidor Dos',
      correo: 'dos@ejemplo.com',
    });
  });

  it('quitar a un repartidor va dentro de los tres puntos, nunca a la vista', async () => {
    servidor();
    render(<Flota idioma="es" />);
    await screen.findByText('Repartidor Uno');
    expect(screen.queryByRole('button', { name: 'Quitar de mi equipo' })).toBeNull();
  });

  it('avisa de los pedidos que esperan a su equipo', async () => {
    servidor({ ...BASE, sinRepartidor: [{ id: 'abcd1234', codigo: 'abcd' }] } as typeof BASE);
    render(<Flota idioma="es" />);
    expect((await screen.findByTestId('flota-sin-repartidor')).textContent).toContain('ABCD');
  });
});
