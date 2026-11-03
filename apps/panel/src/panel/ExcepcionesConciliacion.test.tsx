import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExcepcionesConciliacion } from './ExcepcionesConciliacion';

// C-DINERO-30-DIAS (NXT-1) en el panel: la bandeja de los días que no cuadraron.
const DIA = {
  dia: '2026-10-15',
  pedidos: 1,
  vendido: 718,
  detalle: { cuadraStripe: 'NO' },
  excusado: false,
  motivo: null,
  excusadoPorNombre: null,
  excusadoEn: null,
};

function servidor(datos: Record<string, unknown>, falla = false) {
  const llamadas: { metodo: string; cuerpo?: unknown }[] = [];
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({ metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (metodo !== 'GET')
      return falla
        ? new Response(JSON.stringify({ error: 'La contraseña no es correcta.' }), { status: 403 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify(datos), { status: 200 });
  });
  return llamadas;
}

describe('C-DINERO-30-DIAS en el panel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('excusa un día con motivo y contraseña', async () => {
    const llamadas = servidor({ sinCuadrar: [DIA], puedoExcusar: true });
    render(<ExcepcionesConciliacion idioma="es" />);
    await screen.findByText('2026-10-15');
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Compra de prueba documentada');
    await userEvent.type(screen.getByLabelText('Tu contraseña para excusar'), 'clave-1');
    await userEvent.click(screen.getByRole('button', { name: 'Excusar este día' }));
    await screen.findByText(/quedó excusado/);
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
      dia: '2026-10-15',
      motivo: 'Compra de prueba documentada',
      clave: 'clave-1',
    });
  });

  it('si falla, lo escrito se queda en pantalla', async () => {
    servidor({ sinCuadrar: [DIA], puedoExcusar: true }, true);
    render(<ExcepcionesConciliacion idioma="en" />);
    await screen.findByText('2026-10-15');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Documented test purchase');
    await userEvent.click(screen.getByRole('button', { name: 'Excuse this day' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/Reason/)).toHaveValue('Documented test purchase');
  });

  it('sin perfil para excusar lo dice, y los días ya excusados muestran quién', async () => {
    servidor({
      sinCuadrar: [
        DIA,
        {
          ...DIA,
          dia: '2026-10-20',
          excusado: true,
          motivo: 'Ajuste documentado',
          excusadoPorNombre: 'Soporte Finanzas',
          excusadoEn: '2026-10-21 10:00:00',
        },
      ],
      puedoExcusar: false,
    });
    render(<ExcepcionesConciliacion idioma="es" />);
    await screen.findByText(/Tu perfil no excusa días/);
    expect(screen.getByText(/Soporte Finanzas/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Excusar este día' })).toBeNull();
  });

  it('sin días por excusar lo dice', async () => {
    servidor({ sinCuadrar: [], puedoExcusar: true });
    render(<ExcepcionesConciliacion idioma="es" />);
    await waitFor(() => expect(screen.getByText(/Todos los días/)).toBeTruthy());
  });
});
