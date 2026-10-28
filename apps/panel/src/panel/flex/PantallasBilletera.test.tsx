import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelApp } from '../PanelApp';

// Stripe simulado: el formulario de tarjeta se dibuja y «paga» sin salir a internet.
const confirmar = vi.fn(async () => ({}));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => ({}) }));
vi.mock('@stripe/react-stripe-js', async () => {
  const React = await import('react');
  return {
    Elements: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    PaymentElement: ({ onReady }: { onReady?: () => void }) => {
      React.useEffect(() => onReady?.(), [onReady]);
      return React.createElement('div', { 'data-testid': 'formulario-tarjeta' });
    },
    useStripe: () => ({ confirmPayment: confirmar }),
    useElements: () => ({}),
  };
});

/** Divoox Flex · Fase 4 en el panel (C-FIN-PANEL): billetera, recarga, comisiones, comprobantes y configuración. */
const usuario = {
  id: 'u1',
  nombre: 'Dora Dueña',
  correo: 'dora@ejemplo.com',
  rol: 'cliente',
  idioma: 'es',
};
const E = '11111111-2222-3333-4444-555555555555';
const TODOS = [
  'empresa.ver',
  'empresa.editar',
  'miembros.gestionar',
  'claves.gestionar',
  'centros.gestionar',
  'conductores.gestionar',
  'envios.crear',
  'envios.ver',
  'paquetes.eventos',
  'importar',
  'lotes.gestionar',
  'finanzas.ver',
  'devoluciones.recibir',
  'integraciones.gestionar',
  'finanzas.gestionar',
];
const ficha = {
  empresa: {
    id: E,
    nombre: 'Paquetes Sur',
    razonSocial: '',
    pais: 'US',
    moneda: 'USD',
    estado: 'activa',
  },
  rol: 'dueno',
  permisos: TODOS,
  resumen: {},
};

type Llamada = { url: string; metodo: string; headers: Record<string, string>; cuerpo: unknown };
function servidor(respuestas: Record<string, (ll: Llamada) => Response>) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const ll: Llamada = {
      url,
      metodo: init?.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      ),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    llamadas.push(ll);
    const r = Object.entries(respuestas).find(([clave]) => {
      const [m, ruta] = clave.includes(' ') ? clave.split(' ') : ['GET', clave];
      return ll.metodo === m && url.split('?')[0]!.endsWith(ruta!);
    });
    return r ? r[1](ll) : new Response('{}', { status: 404 });
  });
  return llamadas;
}
const json =
  (d: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(d), { status });

const base = (extra: Record<string, (ll: Llamada) => Response>) => ({
  '/datos/cuentas/yo': json({ usuario }),
  '/datos/mi-franquicia': json({ ruta: null }),
  [`/datos/v1/flex/empresas/${E}`]: json(ficha),
  ...extra,
});

const billetera = (
  saldo: Partial<{ disponible: number; reservado: number; deuda: number }> = {},
  extra = {},
) => ({
  saldo: {
    disponible: 4000,
    reservado: 1000,
    deuda: 0,
    total: 5000,
    moneda: 'USD',
    pais: 'US',
    ...saldo,
  },
  alertaSaldoBajo: false,
  suspendida: Boolean(saldo.deuda),
  recargas: {
    activas: true,
    minimo: 500,
    maximo: 100000,
    sugeridos: [1000, 2000, 5000, 10000],
    automaticaPermitida: true,
    pendientes: 0,
  },
  tarifa: {
    modalidad: 'prepago',
    regla: { tipo: 'por_paquete', monto: 25 },
    descuentoPb: 0,
    vigenteHasta: null,
  },
  config: {
    alertaSaldo: null,
    avisosCorreo: true,
    recargaAutomatica: { activa: false, umbral: null, monto: null },
    metodoGuardado: null,
  },
  clavePublica: 'pk_test_x',
  ...extra,
});

describe('Divoox Flex · Fase 4 · billetera en el panel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
    confirmar.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('el resumen muestra disponible, reservado, total, la tarifa y los movimientos del servidor', async () => {
    servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/billetera`]: json(billetera()),
        [`/datos/v1/flex/empresas/${E}/billetera/movimientos`]: json({
          movimientos: [
            {
              id: '2',
              bolsillo: 'reservado',
              monto: -25,
              tipo: 'comision',
              creadoEn: '2026-10-27 12:00:00',
            },
            {
              id: '1',
              bolsillo: 'prepago',
              monto: 5000,
              tipo: 'recarga',
              creadoEn: '2026-10-27 10:00:00',
            },
          ],
        }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/wallet`} />);
    expect(await screen.findByText('$40.00')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$0.25 por paquete entregado')).toBeInTheDocument();
    expect(await screen.findByText('Comisión por paquete')).toBeInTheDocument();
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recargar saldo' })).toBeInTheDocument();
  });

  it('con deuda avisa que las rutas nuevas no salen', async () => {
    servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/billetera`]: json(billetera({ disponible: 0, deuda: 1000 })),
        [`/datos/v1/flex/empresas/${E}/billetera/movimientos`]: json({ movimientos: [] }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/wallet`} />);
    expect(
      await screen.findByText(/Las rutas nuevas no salen hasta que recargues/),
    ).toBeInTheDocument();
  });

  it('recarga: la clave de idempotencia viaja, se paga dentro de la pantalla y SOLO el servidor confirma el saldo', async () => {
    let consultas = 0;
    const llamadas = servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/billetera`]: json(billetera()),
        [`/datos/v1/flex/empresas/${E}/billetera/recargas`]: json({ recargas: [] }),
        [`POST /datos/v1/flex/empresas/${E}/billetera/recargas`]: json(
          {
            recarga: { id: 'r1', estado: 'pendiente' },
            clientSecret: 'pi_1_secret',
            clavePublica: 'pk_test_x',
          },
          201,
        ),
        [`/datos/v1/flex/empresas/${E}/billetera/recargas/r1`]: () => {
          consultas++;
          return new Response(
            JSON.stringify({
              recarga: { id: 'r1', estado: consultas < 2 ? 'pendiente' : 'acreditada' },
            }),
          );
        },
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/wallet/topup`} />);
    await userEvent.click(await screen.findByLabelText('$50.00'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }));
    expect(await screen.findByTestId('formulario-tarjeta')).toBeInTheDocument();
    const alta = llamadas.find(
      (l) => l.metodo === 'POST' && l.url.endsWith('/billetera/recargas'),
    )!;
    expect(alta.headers['idempotency-key']).toBeTruthy();
    expect(alta.cuerpo).toEqual({ monto: 5000, guardarMetodo: false });
    await userEvent.click(screen.getByRole('button', { name: 'Pagar $50.00' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    // Mientras el servidor no confirme, NO se dice «acreditada».
    expect(await screen.findByText(/Esperando la confirmación de Stripe/)).toBeInTheDocument();
    expect(
      await screen.findByText(/Recarga acreditada/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(consultas).toBeGreaterThanOrEqual(2);
  }, 15_000);

  it('comprobantes con descarga, y el comprobante dice que no es una factura fiscal', async () => {
    servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/comprobantes`]: json({
          comprobantes: [
            {
              id: 'c1c1c1c1-2222-3333-4444-555555555555',
              numero: 'DVX-2026-000001',
              tipo: 'recarga',
              monto: 5000,
              moneda: 'USD',
              creadoEn: '2026-10-27 10:00:00',
              datos: {},
            },
          ],
        }),
        [`/datos/v1/flex/empresas/${E}/comprobantes/c1c1c1c1-2222-3333-4444-555555555555`]: json({
          comprobante: {
            id: 'c1',
            numero: 'DVX-2026-000001',
            tipo: 'recarga',
            monto: 5000,
            moneda: 'USD',
            creadoEn: '2026-10-27 10:00:00',
            datos: {},
          },
          empresa: { nombre: 'Paquetes Sur', razon_social: '', pais: 'US' },
          emisor: { nombre: 'Windoce LLC (Divoox)' },
        }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/wallet/receipts`} />);
    expect(await screen.findByText('DVX-2026-000001')).toBeInTheDocument();
    render(
      <PanelApp
        ruta={`/panel/business/${E}/wallet/receipts/c1c1c1c1-2222-3333-4444-555555555555`}
      />,
    );
    expect(await screen.findByText(/No es una factura fiscal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir o descargar PDF' })).toBeInTheDocument();
  });

  it('configuración: la recarga automática pide una tarjeta guardada; quitarla vive en los tres puntos', async () => {
    servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/billetera`]: json(
          billetera(
            {},
            {
              config: {
                alertaSaldo: 1000,
                avisosCorreo: true,
                recargaAutomatica: { activa: false, umbral: null, monto: null },
                metodoGuardado: 'visa •••• 4242',
              },
            },
          ),
        ),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/wallet/settings`} />);
    expect(await screen.findByText('visa •••• 4242')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Quitar la tarjeta guardada' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(
      screen.getByRole('menuitem', { name: 'Quitar la tarjeta guardada' }),
    ).toBeInTheDocument();
  });
});
