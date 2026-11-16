import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePreferencias, ESPERA_GUARDAR_MS } from './usePreferencias';
import { SesionArmazon } from './armazon/Armazon';
import { SuperPedidos } from './SuperPedido';

/**
 * C-FILTROS-GUARDADOS (15 nov 2026, pedido de Richard). Todos los países. Mirar no escribe; un
 * cambio (o varios seguidos) produce UNA escritura 1,5 s después; la copia local pinta al instante.
 */
type Llamada = { metodo: string; url: string; cuerpo?: unknown };
function servidor(
  guardado: Record<string, string> | null,
  extra: (url: string) => unknown = () => ({}),
) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({
      metodo,
      url: String(url),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (String(url).includes('/admin/preferencias/'))
      return new Response(
        JSON.stringify(
          metodo === 'GET' ? { valor: guardado ?? {}, guardada: Boolean(guardado) } : { ok: true },
        ),
      );
    return new Response(JSON.stringify(extra(String(url))));
  });
  return llamadas;
}
const escrituras = (l: Llamada[]) => l.filter((x) => x.metodo !== 'GET');

const SESION = {
  usuario: { id: 'emp-1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' },
  idioma: 'es',
  cambiar: () => {},
  salir: () => {},
} as never;

function Prueba() {
  const p = usePreferencias('pedidos', { zona: '', estado: 'vivos' });
  return (
    <div>
      <output aria-label="estado">{p.valores.estado}</output>
      <output aria-label="zona">{p.valores.zona}</output>
      <button type="button" onClick={() => p.cambiar('estado', 'cerrados')}>
        cerrados
      </button>
      <button type="button" onClick={() => p.cambiar('estado', 'todos')}>
        todos
      </button>
      <button type="button" onClick={() => p.cambiar('zona', 'US-MI-NOVI')}>
        novi
      </button>
      {p.guardados ? <span>guardados</span> : null}
      <button type="button" onClick={p.restablecer}>
        restablecer
      </button>
    </div>
  );
}
const montar = () =>
  render(
    <SesionArmazon.Provider value={SESION}>
      <Prueba />
    </SesionArmazon.Provider>,
  );

describe('C-FILTROS-GUARDADOS · usePreferencias', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mirar no escribe: abrir la pantalla solo lee', async () => {
    const llamadas = servidor({ estado: 'cerrados', zona: 'US-FL-MIAMI' });
    montar();
    await waitFor(() => expect(screen.getByLabelText('estado').textContent).toBe('cerrados'));
    expect(screen.getByLabelText('zona').textContent).toBe('US-FL-MIAMI');
    await new Promise((r) => setTimeout(r, ESPERA_GUARDAR_MS + 100));
    expect(escrituras(llamadas)).toEqual([]);
    expect(llamadas.map((l) => l.url)).toEqual(['/datos/admin/preferencias/pedidos']);
    expect(screen.getByText('guardados')).toBeTruthy();
  });

  it('varios cambios seguidos producen UNA sola escritura, 1,5 s después del último', async () => {
    const llamadas = servidor(null);
    montar();
    await waitFor(() => expect(llamadas).toHaveLength(1));
    vi.useFakeTimers();
    act(() => screen.getByRole('button', { name: 'cerrados' }).click());
    act(() => screen.getByRole('button', { name: 'novi' }).click());
    act(() => screen.getByRole('button', { name: 'todos' }).click());
    act(() => vi.advanceTimersByTime(ESPERA_GUARDAR_MS - 10));
    expect(escrituras(llamadas)).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(escrituras(llamadas)).toEqual([
      {
        metodo: 'PUT',
        url: '/datos/admin/preferencias/pedidos',
        cuerpo: { valor: { zona: 'US-MI-NOVI', estado: 'todos' } },
      },
    ]);
    // Volver a poner lo mismo no escribe otra vez.
    act(() => screen.getByRole('button', { name: 'todos' }).click());
    await act(async () => {
      vi.advanceTimersByTime(ESPERA_GUARDAR_MS + 10);
    });
    expect(escrituras(llamadas)).toHaveLength(1);
  });

  it('la copia de este navegador pinta al instante, antes de que conteste el servidor', async () => {
    localStorage.setItem('tumbite.filtros.emp-1.pedidos', JSON.stringify({ estado: 'todos' }));
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    montar();
    expect(screen.getByLabelText('estado').textContent).toBe('todos');
  });

  it('«Restablecer» vuelve a los filtros de fábrica y borra lo guardado', async () => {
    const llamadas = servidor({ estado: 'cerrados' });
    montar();
    await waitFor(() => expect(screen.getByLabelText('estado').textContent).toBe('cerrados'));
    await userEvent.click(screen.getByText('restablecer'));
    expect(screen.getByLabelText('estado').textContent).toBe('vivos');
    expect(screen.queryByText('guardados')).toBeNull();
    expect(escrituras(llamadas).map((l) => l.metodo)).toEqual(['DELETE']);
    expect(localStorage.getItem('tumbite.filtros.emp-1.pedidos')).toBeNull();
  });
});

const ID = '407f2f00-0000-4000-8000-000000000001';
const fila = (id: string, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  estado,
  creadoEn: '2026-11-14 18:30:00',
  pagadoEn: null,
  aceptadoEn: null,
  listoEn: null,
  recogidoEn: null,
  tiempoPrepMin: null,
  total: 2800,
  moneda: 'USD',
  restaurante: 'Prueba en vivo',
  cliente: 'Ángela Ruiz',
  repartidor: null,
  repartidorCodigo: null,
  ciudad: 'Novi',
  luz: 'verde',
  ...extra,
});

describe('C-BUSCADOR-SERIO · «Pedidos en curso»', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('el estado se elige con Vivos · Cerrados · Todos y se guarda; «Esperando pago» tiene su estado', async () => {
    const llamadas = servidor(null, (url) =>
      url.includes('/admin/ciudades')
        ? { ciudades: [] }
        : {
            pedidos: url.includes('estado=cerrados')
              ? [fila(ID, 'entregado')]
              : [fila(ID, 'pago_pendiente', { cliente: null })],
            siguiente: null,
          },
    );
    render(
      <SesionArmazon.Provider value={SESION}>
        <SuperPedidos base="/panel/control-x" idioma="es" />
      </SesionArmazon.Provider>,
    );
    expect(await screen.findByText('Esperando pago')).toBeTruthy();
    expect(screen.getByText(/Cuenta eliminada/)).toBeTruthy();
    // El código: 6 letras, las 4 de las apps resaltadas.
    expect(document.querySelector('.codigo-pedido b')?.textContent).toBe('407F');
    expect(document.querySelector('.codigo-pedido')?.textContent).toBe('#407F2F');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrados' }));
    expect(await screen.findByText('Entregado')).toBeTruthy();
    expect(screen.getByText('Entregado').className).toContain('bs-exito');
    expect(llamadas.some((l) => l.url.includes('/admin/pedidos?estado=cerrados'))).toBe(true);
    expect(screen.getByText(/Mostrando tus filtros guardados/)).toBeTruthy();
    await waitFor(
      () =>
        expect(escrituras(llamadas)).toEqual([
          {
            metodo: 'PUT',
            url: '/datos/admin/preferencias/pedidos',
            cuerpo: { valor: { zona: '', estado: 'cerrados', orden: '' } },
          },
        ]),
      { timeout: 3000 },
    );
  });

  it('un código encontrado fuera del filtro lo dice, y «Cargar más» pide la página siguiente', async () => {
    const llamadas = servidor(null, (url) => {
      if (url.includes('/admin/ciudades')) return { ciudades: [] };
      if (url.includes('q=407f'))
        return {
          pedidos: [fila(ID, 'entregado')],
          porCodigo: true,
          encontrado: { cerrados: true, vivos: false, otrasCiudades: ['Novi'] },
        };
      if (url.includes('despues='))
        return { pedidos: [fila('bbbb', 'pagado', { restaurante: 'Otro' })], siguiente: null };
      return { pedidos: [fila('aaaa', 'pagado')], siguiente: '2026-11-14 18:30:00~7' };
    });
    render(
      <SesionArmazon.Provider value={SESION}>
        <SuperPedidos base="/panel/control-x" idioma="es" />
      </SesionArmazon.Provider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText(/Otro/)).toBeTruthy();
    expect(llamadas.some((l) => l.url.includes('despues=2026-11-14+18%3A30%3A00%7E7'))).toBe(true);
    await userEvent.type(screen.getByRole('searchbox'), '407f');
    expect(
      await screen.findByText('Encontrado entre los cerrados. Encontrado en otra ciudad: Novi.'),
    ).toBeTruthy();
    // El texto buscado nunca se guarda.
    await new Promise((r) => setTimeout(r, 1700));
    expect(escrituras(llamadas)).toEqual([]);
  });
});
