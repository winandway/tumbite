import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperReportes } from './SuperReportes';
import { ReportarResenaWeb } from './ReportarWeb';

/** C-MODERACION: la bandeja de reportes del superadmin y «Reportar» en las reseñas del panel. */
const REPORTE = {
  id: 'r1',
  ref: '7',
  tipo: 'mensaje_pedido',
  objeto: 'pedido',
  objetoId: 'abcdef123456',
  motivo: 'acoso',
  nota: 'Me escribió de más',
  texto: 'Mensaje reportado',
  estado: 'abierto',
  accion: null,
  creadoEn: '2026-11-16 10:00:00',
  oculto: false,
  veces: 2,
  autor: { id: 'u1', nombre: 'Luis Repartidor', rol: 'repartidor', activo: true },
  reporta: { nombre: 'Ana', rol: 'cliente' },
};

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    if (init?.method === 'POST') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ reportes: [REPORTE] }), { status: 200 });
  });
  return llamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('C-MODERACION · bandeja de reportes', () => {
  it('muestra el texto, quién lo escribió, quién reportó y el motivo; ocultar llama a la ruta', async () => {
    const llamadas = servidor();
    render(<SuperReportes idioma="es" />);
    expect(await screen.findByText('Mensaje reportado')).toBeTruthy();
    expect(screen.getByText('Acoso o amenaza')).toBeTruthy();
    expect(screen.getByText(/Luis Repartidor/)).toBeTruthy();
    expect(screen.getByText(/Lo reportó: Ana \(cliente\)/)).toBeTruthy();
    expect(screen.getByText(/2 reportes/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    await waitFor(() =>
      expect(llamadas.find((x) => x.metodo === 'POST')).toMatchObject({
        url: '/datos/admin/reportes/r1/accion',
        cuerpo: { accion: 'ocultar' },
      }),
    );
  });

  it('suspender vive dentro de los tres puntos y pide confirmación', async () => {
    const llamadas = servidor();
    vi.stubGlobal('confirm', () => true);
    render(<SuperReportes idioma="en" />);
    await screen.findByText('Mensaje reportado');
    expect(screen.queryByRole('menuitem')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Suspend the author’s account' }));
    await waitFor(() =>
      expect(llamadas.find((x) => x.metodo === 'POST')?.cuerpo).toEqual({ accion: 'suspender' }),
    );
  });
});

describe('C-MODERACION · reportar una reseña desde el panel del restaurante', () => {
  it('elige el motivo, escribe la nota y la envía; la nota se guarda mientras se escribe', async () => {
    const llamadas = servidor();
    render(<ReportarResenaWeb id={42} idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Reportar' }));
    await userEvent.click(screen.getByLabelText('Es spam, publicidad o falsa'));
    await userEvent.type(screen.getByLabelText('Cuéntanos más (opcional)'), 'Nunca pidió');
    await waitFor(() => expect(localStorage.length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(await screen.findByText(/Recibimos tu reporte/)).toBeTruthy();
    expect(llamadas.find((x) => x.metodo === 'POST')).toMatchObject({
      url: '/datos/reportes',
      cuerpo: { tipo: 'resena', id: 42, motivo: 'spam', nota: 'Nunca pidió' },
    });
  });
});
