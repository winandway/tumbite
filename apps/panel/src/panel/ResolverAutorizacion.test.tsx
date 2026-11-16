import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResolverAutorizacion } from './ResolverAutorizacion';
import { PermisosContexto } from './permisosPanel';

/**
 * C-AUTORIZACION-VENCIDA (16 nov 2026): la acción de la ficha muestra el pago real de Stripe, ofrece
 * volver a cobrar solo con el permiso del cliente, exige la nota para cerrar sin cobro y no deja ver
 * los botones a quien no tiene el permiso.
 */
const ESTADO = {
  liquidacion: { estado: 'revision', monto: 3400, moneda: 'USD' },
  stripe: {
    estado: 'canceled',
    montoAutorizado: 3400,
    vencida: true,
    canceladaEn: '2026-11-15T12:00:00.000Z',
    capturarAntesDe: '2026-11-15T06:00:00.000Z',
    consentimiento: true,
    tarjeta: { marca: 'visa', ultimos4: '4242', vence: '12/2034' },
  },
  aviso: null,
  sePuedeResolver: true,
  sePuedeCobrar: true,
  motivoSinCobro: null,
};

function conPermisos(permisos: string[], hijo: React.ReactNode) {
  return (
    <PermisosContexto.Provider
      value={{
        acceso: {
          id: 'u1',
          permisos,
          fuentes: {},
          alcance: { paises: null, zonas: null, servicios: null },
          dueno: false,
          origen: 'asignaciones',
          segundoFactor: { activo: false, vigente: true },
        },
        cargando: false,
        puedeVer: (p) => permisos.includes(p),
        recargar: () => undefined,
      }}
    >
      {hijo}
    </PermisosContexto.Provider>
  );
}

describe('Resolver autorización vencida (ficha del pedido)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('muestra el pago en Stripe, confirma antes de cobrar y avisa al terminar', async () => {
    const llamadas: { url: string; metodo: string; cuerpo: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo: String(init?.body ?? '') });
      return new Response(
        JSON.stringify(init?.method === 'POST' ? { estado: 'capturada' } : ESTADO),
        { status: 200 },
      );
    });
    const alResolver = vi.fn();
    render(
      conPermisos(
        ['dinero.resolver_autorizacion', 'pedidos.ver'],
        <ResolverAutorizacion pedidoId="p1" zona={null} idioma="es" alResolver={alResolver} />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resolver autorización vencida' }));
    expect(await screen.findByText('Vencido (ya no se puede capturar)')).toBeTruthy();
    expect(screen.getByText('Visa ···· 4242')).toBeTruthy();
    expect(screen.getByText('Sí, lo dio al pagar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar $34.00 a la tarjeta guardada' }));
    // Nada se cobra hasta confirmar.
    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cobrar $34.00' }));
    expect(await screen.findByText('Cobrado. La entrega salió de revisión.')).toBeTruthy();
    const post = llamadas.find((l) => l.metodo === 'POST');
    expect(post?.url).toContain('/datos/admin/liquidaciones/p1/autorizacion/cobrar');
    expect(alResolver).toHaveBeenCalled();
  });

  it('sin el permiso del cliente no ofrece cobrar y dice por qué; cerrar sin cobro pide la nota', async () => {
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ estado: 'no_aplica' }), { status: 200 })
        : new Response(
            JSON.stringify({
              ...ESTADO,
              stripe: { ...ESTADO.stripe, consentimiento: false },
              sePuedeCobrar: false,
              motivoSinCobro: 'sin_consentimiento',
            }),
            { status: 200 },
          ),
    );
    render(
      conPermisos(
        ['dinero.resolver_autorizacion'],
        <ResolverAutorizacion pedidoId="p2" zona={null} idioma="es" alResolver={() => {}} />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resolver autorización vencida' }));
    expect(await screen.findByText(/no dejó su tarjeta guardada para cobros futuros/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Cobrar/ })).toBeNull();
    const cerrar = screen.getByRole('button', { name: 'Cerrar sin cobro' }) as HTMLButtonElement;
    expect(cerrar.disabled).toBe(true);
    expect(screen.getByText('Escribe una nota de al menos 5 letras.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nota \(obligatoria\)/), {
      target: { value: 'Pedido de prueba, no se cobra' },
    });
    expect(cerrar.disabled).toBe(false);
    fireEvent.click(cerrar);
    expect(
      await screen.findByText('Cerrada sin cobro. La entrega salió de revisión.'),
    ).toBeTruthy();
  });

  it('quien no tiene el permiso ve el estado pero no los botones, y sabe a quién pedirlo', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(ESTADO), { status: 200 }));
    render(
      conPermisos(
        ['pedidos.ver'],
        <ResolverAutorizacion pedidoId="p3" zona={null} idioma="en" alResolver={() => {}} />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resolve expired authorization' }));
    expect(await screen.findByText('Expired (it can no longer be captured)')).toBeTruthy();
    expect(screen.getByText(/Resolve expired card authorizations/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Charge/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close without charging' })).toBeNull();
  });
});
