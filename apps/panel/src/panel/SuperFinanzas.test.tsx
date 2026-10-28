import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperFinanzas } from './SuperFinanzas';

/** Divoox · Fase 4: superadmin financiero (C-FIN-SUPERADMIN). */
type Llamada = { url: string; metodo: string; cuerpo: unknown };
function servidor(respuestas: Record<string, () => Response>) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const ll = {
      url,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    llamadas.push(ll);
    const r = Object.entries(respuestas).find(([clave]) => {
      const [m, ruta] = clave.includes(' ') ? clave.split(' ') : ['GET', clave];
      return ll.metodo === m && url.split('?')[0]!.endsWith(ruta!);
    });
    return r ? r[1]() : new Response('{}', { status: 404 });
  });
  return llamadas;
}
const json =
  (d: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(d), { status });

describe('superadmin financiero de Flex', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('crea una política por paquete con su monto en centavos; cerrar vive en los tres puntos', async () => {
    const llamadas = servidor({
      '/datos/admin/finanzas/politicas': json({
        politicas: [
          {
            id: 'p1',
            nombre: 'Flex EE. UU.',
            servicio: 'flex',
            tipoCuenta: 'empresa',
            pais: 'US',
            ciudad: null,
            empresaId: null,
            modalidad: 'prepago',
            moneda: 'USD',
            regla: { tipo: 'por_paquete', monto: 25 },
            descuentoPb: 0,
            vigenteDesde: '2026-10-27 12:00:00',
            vigenteHasta: null,
            activa: true,
            revisionLegalAprobada: false,
            motivo: 'Tarifa inicial',
          },
        ],
      }),
      'POST /datos/admin/finanzas/politicas': json({ politica: {} }, 201),
      '/datos/admin/finanzas/empresas': json({ empresas: [] }),
      '/datos/admin/finanzas/conciliacion': json({
        ultima: { cuando: 'hoy', ok: true, problemas: [] },
      }),
    });
    render(<SuperFinanzas base="/panel/control-x" idioma="es" empresaId={null} />);
    expect(await screen.findByText('Monto por paquete entregado: $0.25')).toBeInTheDocument();
    expect(screen.getByText(/Todo cuadra/)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Cerrar desde ahora' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Cerrar desde ahora' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Flex Miami');
    await userEvent.type(screen.getByLabelText('Monto'), '0.30');
    await userEvent.type(screen.getByLabelText('Motivo'), 'Tarifa de lanzamiento');
    await userEvent.click(screen.getByRole('button', { name: 'Crear política' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST')!.cuerpo).toMatchObject({
      nombre: 'Flex Miami',
      servicio: 'flex',
      tipoCuenta: 'empresa',
      modalidad: 'prepago',
      regla: { tipo: 'por_paquete', monto: 30 },
    });
  });
});
