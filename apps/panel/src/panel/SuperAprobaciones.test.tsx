import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperAprobaciones, textoPendiente } from './SuperAprobaciones';

// C-CONTROL-DUAL en el panel: la bandeja «Para aprobar» y el aviso de la segunda firma.
const PENDIENTE = {
  id: 'a1',
  tipo: 'ajuste_billetera',
  objeto: 'e1',
  monto: 15000,
  moneda: 'USD',
  motivo: 'compensación acordada',
  estado: 'pendiente',
  nota: null,
  error: null,
  pedidoPor: 'otro',
  pedidoPorNombre: 'Soporte Pide',
  creadoEn: '2026-11-02 10:00:00',
  revisadoPorNombre: null,
};

function servidor(bandeja: Record<string, unknown>) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if ((init?.method ?? 'GET') !== 'GET')
      return new Response(JSON.stringify({ estado: 'aprobada', umbrales: {} }), { status: 200 });
    return new Response(
      JSON.stringify({
        pendientes: [],
        recientes: [],
        umbrales: { USD: 10000, COP: 400000 },
        miPerfil: 'total',
        puedoAprobar: true,
        aprobadoresAparte: 1,
        ...bandeja,
      }),
      { status: 200 },
    );
  });
  return llamadas;
}

describe('C-CONTROL-DUAL en el panel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('aprueba lo de otra persona con la contraseña y guarda los límites', async () => {
    const llamadas = servidor({
      pendientes: [PENDIENTE],
      recientes: [{ ...PENDIENTE, id: 'a0', estado: 'fallida', error: 'sin saldo' }],
    });
    render(<SuperAprobaciones idioma="es" miId="yo" />);
    expect(await screen.findAllByText(/Ajuste de billetera/)).toHaveLength(2);
    expect(screen.getByText(/Soporte Pide/, { selector: 'p' })).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Tu contraseña para aprobar'), 'clave-segura-1');
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith('/a1/aprobar'))).toBe(true));
    expect(llamadas.find((l) => l.url.endsWith('/a1/aprobar'))!.cuerpo).toEqual({
      clave: 'clave-segura-1',
    });
    expect(await screen.findByText('Aprobado: el movimiento ya se hizo.')).toBeTruthy();

    const usd = screen.getByLabelText('USD');
    await userEvent.clear(usd);
    await userEvent.type(usd, '250');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar límites' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'PUT')!.cuerpo).toEqual({
      umbrales: { USD: 25000, COP: 400000 },
    });
  });

  it('rechaza con motivo; lo propio solo se retira', async () => {
    const llamadas = servidor({
      pendientes: [PENDIENTE, { ...PENDIENTE, id: 'a2', pedidoPor: 'yo' }],
    });
    render(<SuperAprobaciones idioma="en" miId="yo" />);
    await screen.findByText('It’s yours: someone else approves it.');
    await userEvent.type(screen.getByLabelText('Reason for rejecting'), 'Not agreed');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith('/a1/rechazar'))).toBe(true));
    expect(llamadas.find((l) => l.url.endsWith('/a1/rechazar'))!.cuerpo).toEqual({
      nota: 'Not agreed',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw my request' }));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith('/a2/rechazar'))).toBe(true));
  });

  it('sin otra persona que apruebe, o sin perfil, la pantalla lo explica', async () => {
    servidor({ puedoAprobar: false, aprobadoresAparte: 0, miPerfil: 'soporte' });
    render(<SuperAprobaciones idioma="es" miId="yo" />);
    expect(await screen.findByText(/Tu perfil no aprueba dinero/)).toBeTruthy();
    expect(screen.getByText(/No hay otra cuenta con perfil Total o Finanzas/)).toBeTruthy();
    expect(screen.getByText('No hay nada esperando aprobación.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar límites' })).toBeNull();
  });

  it('el aviso de la segunda firma, en los dos idiomas', () => {
    expect(textoPendiente({ ok: true }, 'es')).toBeNull();
    expect(textoPendiente({ pendiente: true, aprobadores: 1 }, 'es')).toMatch(/Para aprobar/);
    expect(textoPendiente({ pendiente: true, aprobadores: 0 }, 'es')).toMatch(/no hay otra/);
    expect(textoPendiente({ pendiente: true, aprobadores: 1 }, 'en')).toMatch(/Approvals/);
    expect(textoPendiente({ pendiente: true }, 'en')).toMatch(/no other/);
  });
});
