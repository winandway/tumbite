import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlDinero } from './ControlDinero';

function servidor(estado: { activos: boolean }) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const r = url.includes('/admin/retiros')
      ? init?.method === 'PUT'
        ? ((estado.activos = (init.body && JSON.parse(String(init.body)).activos) as boolean),
          { activos: estado.activos })
        : {
            activos: estado.activos,
            apagadosPorVariable: false,
            porEstado: [{ estado: 'enviado', n: 2, monto: 5000 }],
          }
      : url.includes('/admin/liquidaciones/')
        ? { estado: 'capturada' }
        : url.includes('/admin/liquidaciones')
          ? {
              revision: [
                {
                  pedidoId: 'p-revision-1',
                  estado: 'revision',
                  monto: 3400,
                  intentos: 6,
                  error: 'card_declined',
                  entregadoEn: null,
                },
              ],
              atrasadas: [],
            }
          : url.includes('/admin/abonos-fallidos')
            ? {
                abonos: [
                  {
                    id: 'a1',
                    usuarioId: 'u1',
                    nombre: 'Rosa',
                    correo: 'rosa@ejemplo.com',
                    rol: 'restaurante',
                    motivo: 'account_closed',
                    creadoEn: '2026-10-18 10:00:00',
                    resueltoEn: null,
                  },
                ],
              }
            : url.includes('/admin/conciliacion')
              ? {
                  conciliaciones: [
                    {
                      dia: '2026-10-17',
                      pedidos: 3,
                      vendido: 9000,
                      capturado: 9000,
                      devuelto: 0,
                      abonado: 7000,
                      retirado: 0,
                      cuadra: false,
                      detalle: { diferencia: 100 },
                    },
                  ],
                }
              : { ruta: 'control-x' };
    return new Response(JSON.stringify(r), { status: 200 });
  });
  return llamadas;
}

describe('control de dinero del superadmin (C-SUPER-DINERO)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra retiros, cobros en revisión, abonos rechazados y la conciliación con su detalle', async () => {
    servidor({ activos: false });
    render(<ControlDinero idioma="es" />);
    expect(await screen.findByText(/Apagados: la app dice/)).toBeInTheDocument();
    expect(screen.getByText('p-revisi')).toBeInTheDocument();
    expect(screen.getByText('card_declined')).toBeInTheDocument();
    expect(screen.getByText('account_closed')).toBeInTheDocument();
    expect(screen.getByText('NO cuadra')).toBeInTheDocument();
    expect(screen.getByText('p-revisi').closest('a')?.getAttribute('href')).toBe(
      '/panel/control-x/orders/p-revision-1',
    );
  });

  it('el interruptor de retiros pide confirmación y llama a la ruta; reintentar y resolver llaman a las suyas', async () => {
    const llamadas = servidor({ activos: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ControlDinero idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Encender retiros' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.metodo === 'PUT' && l.url.endsWith('/datos/admin/retiros'))?.cuerpo,
      ).toEqual({ activos: true }),
    );
    expect(await screen.findByRole('button', { name: 'Apagar retiros' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar ahora' }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.url.endsWith('/datos/admin/liquidaciones/p-revision-1/reintentar')),
      ).toBe(true),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Marcar resuelto' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.url.endsWith('/datos/admin/abonos-fallidos/a1'))?.cuerpo,
      ).toEqual({ resuelto: true }),
    );
  });

  it('si el interruptor se cancela, no llama a nada', async () => {
    const llamadas = servidor({ activos: false });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ControlDinero idioma="en" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Turn withdrawals on' }));
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
  });
});
