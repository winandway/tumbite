import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuperPedido, SuperPedidos } from './SuperPedido';
import { Pedidos } from './Pedidos';

const ID = '11111111-2222-3333-4444-555555555555';

describe('bitácora del pedido en el superadmin (C-MANAGER-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra los datos, enlaza a las fichas y cuenta lo que hizo el Manager', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            pedido: {
              id: ID,
              estado: 'cancelado',
              total: 3400,
              propina: 400,
              direccion: '200 Calle Prueba',
              notas: 'Sin cebolla',
              ciudad: 'Miami',
              pagoStripe: 'pi_1',
              lineas: [{ nombre: 'Cubano', cantidad: 2 }],
              cliente: { id: 'c1', nombre: 'Ana Cliente' },
              restaurante: { id: 'r1', nombre: 'La Esquina' },
              repartidor: null,
              bitacora: [
                {
                  evento: 'creado',
                  fecha: '2026-10-12 20:00:00',
                  quien: 'Ana Cliente',
                  tipo: 'estado',
                },
                {
                  evento: 'recordatorio_1',
                  fecha: '2026-10-12 20:04:00',
                  quien: '4 min',
                  tipo: 'manager',
                },
                { evento: 'cancelado', fecha: '2026-10-12 20:11:00', quien: null, tipo: 'estado' },
                {
                  evento: 'cancelado_sin_respuesta',
                  fecha: '2026-10-12 20:11:00',
                  quien: '11 min',
                  tipo: 'manager',
                },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    render(<SuperPedido base="/panel/control-x" id={ID} idioma="es" />);
    expect(await screen.findByText('#111111')).toBeTruthy();
    expect(screen.getAllByText('Ana Cliente')[0]?.closest('a')?.getAttribute('href')).toBe(
      '/panel/control-x/customers/c1',
    );
    expect(screen.getByText('Sin repartidor')).toBeTruthy();
    expect(screen.getByText(/Recordatorio al restaurante/)).toBeTruthy();
    expect(screen.getByText(/Cancelado solo: el restaurante no respondió/)).toBeTruthy();
    expect(screen.getByText('2 × Cubano')).toBeTruthy();
  });

  it('si el pedido no existe, lo dice', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ error: 'Ese pedido no existe.' }), { status: 404 }),
    );
    render(<SuperPedido base="/panel/control-x" id={ID} idioma="en" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

describe('pedidos en curso y semáforo (C-MANAGER-1)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const hace = (min: number) =>
    new Date(Date.now() - min * 60000).toISOString().slice(0, 19).replace('T', ' ');

  it('lista los pedidos vivos con su semáforo, cuenta los rojos y enlaza a la bitácora', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).includes('/admin/ciudades')
        ? new Response(JSON.stringify({ ciudades: [] }), { status: 200 })
        : new Response(
            JSON.stringify({
              pedidos: [
                {
                  id: ID,
                  estado: 'pagado',
                  creadoEn: hace(7),
                  pagadoEn: hace(7),
                  aceptadoEn: null,
                  listoEn: null,
                  recogidoEn: null,
                  tiempoPrepMin: null,
                  total: 2000,
                  restaurante: 'La Esquina',
                  cliente: 'Ana',
                  repartidorCodigo: null,
                  ciudad: 'Miami',
                  luz: 'rojo',
                },
              ],
            }),
            { status: 200 },
          ),
    );
    render(<SuperPedidos base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText(/En problemas · hace 7 min · sin aceptar/)).toBeTruthy();
    expect(screen.getByText(/1 en problemas/)).toBeTruthy();
    expect(
      screen
        .getByText(/La Esquina/)
        .closest('a')
        ?.getAttribute('href'),
    ).toBe(`/panel/control-x/orders/${ID}`);
  });

  it('el restaurante ve el semáforo en su lista de pedidos', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            pedidos: [
              {
                id: ID,
                estado: 'aceptado',
                subtotal: 1500,
                notas: '',
                creadoEn: hace(40),
                pagadoEn: hace(40),
                aceptadoEn: hace(35),
                listoEn: null,
                recogidoEn: null,
                tiempoPrepMin: 15,
                lineas: [],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    render(<Pedidos idioma="es" />);
    expect(await screen.findByText(/En problemas · hace 35 min · la cocina pasó/)).toBeTruthy();
  });

  it('soporte puede cancelar con devolución y quitar al repartidor desde la ficha (C-SUPER-OPERACION)', async () => {
    const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({
        url,
        metodo: init?.method ?? 'GET',
        cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (init?.method === 'POST') return new Response('{"ok":true}', { status: 200 });
      return new Response(
        JSON.stringify({
          pedido: {
            id: ID,
            estado: 'aceptado',
            total: 3400,
            propina: 400,
            direccion: 'x',
            notas: '',
            ciudad: 'Miami',
            pagoStripe: 'pi_1',
            lineas: [],
            cliente: { id: 'c1', nombre: 'Ana Cliente' },
            restaurante: { id: 'r1', nombre: 'La Esquina' },
            repartidor: { id: 'd1', nombre: 'Rafa', codigo: 'US-MIA-000001' },
            bitacora: [],
            excepcionUbicacion: null,
          },
        }),
        { status: 200 },
      );
    });
    vi.spyOn(window, 'prompt').mockReturnValue('El cliente llamó');
    render(<SuperPedido base="/panel/control-x" id={ID} idioma="es" />);
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Quitar al repartidor y volver a ofrecer' }),
    );
    expect(await screen.findByText(/volvió a la fila/)).toBeTruthy();
    expect(
      llamadas.find((l) => l.url.endsWith(`/datos/admin/pedidos/${ID}/soltar-repartidor`))?.cuerpo,
    ).toEqual({ motivo: 'El cliente llamó' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar y devolver el dinero' }));
    expect(await screen.findByText(/vuelve a la tarjeta/)).toBeTruthy();
    expect(
      llamadas.find((l) => l.url.endsWith(`/datos/admin/pedidos/${ID}/cancelar`))?.cuerpo,
    ).toEqual({ motivo: 'El cliente llamó' });
  });
});
