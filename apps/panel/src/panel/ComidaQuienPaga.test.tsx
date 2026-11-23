import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComidaQuienPaga, ejemploComida, type VistaComidaQuienPaga } from './ComidaQuienPaga';

/**
 * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026) — Venezuela. La tarjeta «Comida: quién paga qué» de Dinero:
 * enseña lo que rige, el ejemplo vivo en la moneda del país, manda SOLO lo que cambió (una
 * comisión de restaurante igual a la vigente no se reescribe), pide la referencia legal solo para
 * más de 0 %, y lo escrito no se pierde (se queda si falla; se borra al guardar con éxito).
 */
const vista = (over: Partial<VistaComidaQuienPaga['restaurante']> = {}): VistaComidaQuienPaga => ({
  pais: 'VE',
  moneda: 'USD',
  pagoDirecto: true,
  tarifasEscritas: true,
  cliente: {
    servicioPb: 0,
    servicioMinimo: 0,
    servicioMaximo: 0,
    pedidoMinimo: 0,
    cargoPedidoPequeno: 0,
  },
  restaurante: {
    comisionPb: 0,
    regla: null,
    preparadaPb: 1000,
    revisionLegalAprobada: false,
    politicaId: null,
    global: false,
    ...over,
  },
  conductor: { comisionEnvioPb: 0 },
  deFabrica: { restaurante: { preparadaPb: 1000 } },
  paises: [{ pais: 'VE', moneda: 'USD' }],
});

type Llamada = { url: string; metodo: string; cuerpo: unknown };
function servidor(opciones: { get?: VistaComidaQuienPaga; put?: () => Response } = {}) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ url, metodo, cuerpo });
    if (metodo === 'PUT' && opciones.put) return opciones.put();
    if (metodo === 'PUT')
      return new Response(
        JSON.stringify(vista({ comisionPb: cuerpo.restaurante?.comisionPb ?? 0 })),
        { status: 200 },
      );
    return new Response(JSON.stringify(opciones.get ?? vista()), { status: 200 });
  });
  return llamadas;
}

describe('C-COMIDA-VE-QUIEN-PAGA: la tarjeta «Comida: quién paga qué»', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('el ejemplo cuenta el modelo de hoy: el cliente solo comida y envío, cero al restaurante y al conductor', async () => {
    servidor();
    render(<ComidaQuienPaga idioma="es" />);
    const ej = await screen.findByTestId('cqp-ejemplo');
    expect(ej.textContent).toMatch(/El cliente paga \$11\.50: \$10\.00 de comida/);
    expect(ej.textContent).toContain('$1.50 al conductor');
    expect(ej.textContent).toContain('no le sale nada de su saldo');
    expect(ej.textContent).toContain('El conductor recibe $1.50');
    expect(ej.textContent).toContain('Divoox gana $0.00');
    expect(screen.getByTestId('cqp-rest-vigente').textContent).toContain('0 %');
    // Sin comisión no se pide referencia legal.
    expect(screen.queryByLabelText('Referencia de la revisión legal aprobada')).toBeNull();
  });

  it('el valor preparado (10 %) pide la referencia legal y manda solo la comisión del restaurante', async () => {
    const llamadas = servidor();
    render(<ComidaQuienPaga idioma="es" />);
    await screen.findByTestId('cqp-ejemplo');
    await userEvent.click(screen.getByRole('button', { name: 'Usar el valor preparado (10 %)' }));
    expect(screen.getByTestId('cqp-ejemplo').textContent).toContain('le salen $1.00 de su saldo');
    expect(screen.getByTestId('cqp-ejemplo').textContent).toContain('Divoox gana $1.00');
    await userEvent.type(
      screen.getByLabelText('Referencia de la revisión legal aprobada'),
      'Dictamen legal 2026-11',
    );
    await userEvent.type(screen.getByLabelText('Motivo (queda en el registro)'), 'Primer mes');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
        pais: 'VE',
        motivo: 'Primer mes',
        restaurante: { comisionPb: 1000, revisionLegalNota: 'Dictamen legal 2026-11' },
      }),
    );
    const exito = await screen.findByRole('status');
    expect(exito.className).toBe('texto-exito');
    // Guardado con éxito: el borrador ya no está.
    await waitFor(() =>
      expect(
        Object.keys(localStorage).filter((k) => k.includes('super-fin-comida-quien-paga')),
      ).toEqual([]),
    );
  });

  it('cambiar solo al conductor no reescribe la comisión del restaurante; si falla, lo escrito se queda', async () => {
    const llamadas = servidor({
      put: () =>
        new Response(JSON.stringify({ error: 'Escribe el motivo del cambio.' }), { status: 422 }),
    });
    render(<ComidaQuienPaga idioma="es" />);
    await screen.findByTestId('cqp-ejemplo');
    const conductor = screen.getByLabelText('Comisión sobre el envío (%)');
    await userEvent.clear(conductor);
    await userEvent.type(conductor, '10');
    expect(screen.getByTestId('cqp-ejemplo').textContent).toContain('El conductor recibe $1.35');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('alert');
    expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
      pais: 'VE',
      motivo: '',
      conductor: { comisionEnvioPb: 1000 },
    });
    expect(screen.getByLabelText('Comisión sobre el envío (%)')).toHaveValue('10');
  });

  it('sin cambios no llama al servidor, y avisa si rige una política de todos los países', async () => {
    const llamadas = servidor({ get: vista({ comisionPb: 1500, global: true, politicaId: 'g1' }) });
    render(<ComidaQuienPaga idioma="en" />);
    expect((await screen.findByTestId('cqp-global')).textContent).toContain('all-countries');
    expect(screen.getByTestId('cqp-rest-vigente').textContent).toContain('15%');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You did not change anything.');
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
  });

  it('la cuenta del ejemplo: servicio con mínimo y máximo, y cargo por pedido pequeño', () => {
    expect(
      ejemploComida({
        servicioPb: 500,
        servicioMinimo: 20,
        servicioMaximo: 40,
        pedidoMinimo: 1500,
        cargoPedidoPequeno: 100,
        restPb: 1000,
        conductorPb: 0,
      }),
    ).toEqual({
      total: 1000 + 150 + 40 + 100,
      comida: 1000,
      alConductor: 290,
      comisionRest: 100,
      conductorRecibe: 290,
      divoox: 100,
    });
  });
});
