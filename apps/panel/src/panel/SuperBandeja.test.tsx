import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperBandeja } from './SuperBandeja';

/** C-BANDEJA-DINERO: la bandeja de soporte del cobro en mano en el superadmin. */
const CASO = {
  clave: 'excedente:11111111-2222-3333-4444-555555555555',
  tipo: 'excedente',
  estado: 'abierto',
  responsable: null,
  pedidoId: '11111111-2222-3333-4444-555555555555',
  pais: 'CO',
  moneda: 'COP',
  montos: { porDevolver: 12000 },
  participantes: { cliente: 'Ana', repartidor: 'Rafa', restaurante: 'Sabor' },
  detalle: 'El cliente pagó de más al repartidor.',
  detalleEn: 'The customer overpaid the driver.',
  creadoEn: '2026-10-19 10:00:00',
  acciones: ['tomar', 'nota', 'excedente_devuelto', 'resolver'],
};

function servidor(error = false) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    if (init?.method === 'POST')
      return error
        ? new Response(JSON.stringify({ error: 'Sin conexión' }), { status: 503 })
        : new Response(JSON.stringify({ repetida: false, caso: CASO }), { status: 200 });
    if (url.includes('/bandeja-dinero?'))
      return new Response(JSON.stringify({ casos: [CASO] }), { status: 200 });
    return new Response(
      JSON.stringify({
        caso: CASO,
        historial: [],
        bitacora: [{ evento: 'cobro_efectivo', detalle: '', en: '2026-10-19 10:00:00' }],
        libro: [{ concepto: 'excedente_cliente_por_devolver', monto: -12000, moneda: 'COP' }],
        evidencias: [`/datos/pedidos/${CASO.pedidoId}/evidencia/ticket`],
      }),
      { status: 200 },
    );
  });
  return llamadas;
}

describe('bandeja de soporte del cobro en mano', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('lista los casos con su importe en la moneda del pedido (pesos sin decimales)', async () => {
    servidor();
    render(<SuperBandeja base="/panel/control-x" idioma="es" clave={null} />);
    expect(
      await screen.findByText('Excedente del cliente', { selector: '.insignia' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/12\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Sin asignar/)).toBeInTheDocument();
  });

  it('el detalle muestra participantes, evidencias y libro; la acción manda nota e idempotencia, y si falla la nota se queda', async () => {
    const llamadas = servidor(true);
    render(<SuperBandeja base="/panel/control-x" idioma="en" clave={CASO.clave} />);
    expect(await screen.findByText(/Customer: Ana/)).toBeInTheDocument();
    expect(screen.getByText('The customer overpaid the driver.')).toBeInTheDocument();
    expect(screen.getByAltText('Evidence')).toHaveAttribute(
      'src',
      CASO.montos ? `/datos/pedidos/${CASO.pedidoId}/evidencia/ticket` : '',
    );
    await userEvent.type(screen.getByRole('textbox'), 'Returned in cash, receipt photo');
    await userEvent.click(screen.getByRole('button', { name: 'The driver already returned it' }));
    await waitFor(() => {
      const post = llamadas.find((l) => l.metodo === 'POST');
      expect(post?.url).toContain(`/bandeja-dinero/${encodeURIComponent(CASO.clave)}/acciones`);
      expect(post?.cuerpo).toMatchObject({
        accion: 'excedente_devuelto',
        nota: 'Returned in cash, receipt photo',
      });
      expect(
        String((post?.cuerpo as { idempotencia: string }).idempotencia).length,
      ).toBeGreaterThan(8);
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Returned in cash, receipt photo');
  });
});
