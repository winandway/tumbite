import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminRestaurantes } from './AdminRestaurantes';
import { MiRestaurante } from './MiRestaurante';

const base = {
  id: 'r1',
  nombre: 'Sabor',
  descripcionEs: '',
  descripcionEn: '',
  categoria: 'Cubana',
  telefono: '',
  direccion: '100 Calle',
  lat: null,
  lng: null,
  imagen: null,
  plan: 'inicial',
  estado: 'pendiente',
  abierto: false,
  tiempoPrepMin: 20,
  regalosPb: 300,
};
const usuario = {
  id: 'u1',
  nombre: 'Rosa',
  correo: 'rosa@ejemplo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};

function servidor(manejar: (url: string, init?: RequestInit) => unknown) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const r = manejar(url, init);
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 });
  });
  return llamadas;
}

describe('administración de restaurantes', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('el admin aprueba un restaurante y cambia su plan', async () => {
    const llamadas = servidor((url, init) => {
      if (init?.method === 'PATCH')
        return { restaurante: { ...base, ...JSON.parse(String(init.body)) } };
      return { restaurantes: [{ ...base, duenoCorreo: 'rosa@ejemplo.com', duenoNombre: 'Rosa' }] };
    });
    render(<AdminRestaurantes idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText(/Aprobado/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'elite');
    await waitFor(() =>
      expect(llamadas.some((l) => (l.cuerpo as { plan?: string })?.plan === 'elite')).toBe(true),
    );
  });

  it('muestra el error del servidor si algo falla', async () => {
    servidor(
      () =>
        new Response(JSON.stringify({ error: 'Tu cuenta no tiene permiso para esto.' }), {
          status: 403,
        }),
    );
    render(<AdminRestaurantes idioma="es" />);
    expect(await screen.findByText('Tu cuenta no tiene permiso para esto.')).toBeInTheDocument();
  });
});

describe('mi restaurante', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('carga los datos, guarda y muestra el estado de revisión', async () => {
    const llamadas = servidor((_url, init) =>
      init?.method === 'PUT'
        ? { restaurante: { ...base, ...JSON.parse(String(init.body)) } }
        : { restaurante: base },
    );
    render(<MiRestaurante usuario={usuario} idioma="es" />);
    const nombre = await screen.findByLabelText('Nombre del restaurante');
    expect(nombre).toHaveValue('Sabor');
    expect(screen.getByText(/En revisión/)).toBeInTheDocument();
    await userEvent.clear(nombre);
    await userEvent.type(nombre, 'Sabor Nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado');
    expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
      nombre: 'Sabor Nuevo',
    });
  });

  it('un restaurante aprobado puede abrir y cerrar', async () => {
    servidor((url, init) =>
      url.endsWith('/abierto')
        ? { abierto: JSON.parse(String(init?.body)).abierto }
        : { restaurante: { ...base, estado: 'aprobado' } },
    );
    render(<MiRestaurante usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir y recibir pedidos' }));
    expect(await screen.findByRole('button', { name: /Recibiendo pedidos/ })).toBeInTheDocument();
  });

  it('si el servidor rechaza un campo, se marca ese campo', async () => {
    servidor((_url, init) =>
      init?.method === 'PUT'
        ? new Response(
            JSON.stringify({ error: 'Escribe la dirección del restaurante.', campo: 'direccion' }),
            { status: 400 },
          )
        : { restaurante: null },
    );
    render(<MiRestaurante usuario={usuario} idioma="es" />);
    await userEvent.type(await screen.findByLabelText('Nombre del restaurante'), 'Nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Escribe la dirección del restaurante.')).toBeInTheDocument();
  });
});
