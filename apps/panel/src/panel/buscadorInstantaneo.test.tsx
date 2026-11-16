import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuscadorSuper, PAUSA_BUSCAR_MS } from './BuscadorSuper';
import { SuperPedidos } from './SuperPedido';
import { SesionArmazon } from './armazon/Armazon';
import { crearMemoria, TOPE_MEMORIA, VIGENCIA_MEMORIA_MS } from './memoriaBusqueda';

/**
 * C-BUSCADOR-INSTANTANEO (16 nov 2026, Richard en el sitio de pruebas: «7» y «73» no mostraban
 * #73C2E8 y «b4» decía «No encontramos nada»). Todos los países. El buscador de arriba y «Pedidos en
 * curso» sugieren desde la primera letra, dicen cuántos hay, llevan a «Ver todos», recuerdan lo ya
 * buscado y, si no hay nada, dicen qué se buscó y sugieren.
 */
const BASE = '/panel/control-x';
const ID_73 = '73c2e800-0000-4000-8000-000000000031';
const ID_7A = '7a000000-0000-4000-8000-000000000033';
const SESION = {
  usuario: { id: 'emp-1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' },
  idioma: 'es',
  cambiar: () => {},
  salir: () => {},
} as never;

const resultado = (id: string, estado: string) => ({
  id,
  titulo: `#${id.slice(0, 6).toUpperCase()}`,
  detalle: 'Prueba en vivo',
  estado,
  ciudad: 'Novi',
  enlace: `/orders/${id}`,
  coincide: '7',
  fecha: '2026-11-14 18:30:00',
  monto: 2800,
  moneda: 'USD',
});

function servidor(responder: (url: URL) => unknown) {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    llamadas.push(String(url));
    return Promise.resolve(
      new Response(JSON.stringify(responder(new URL(String(url), 'http://x')))),
    );
  });
  return llamadas;
}
const titulos = () =>
  [...document.querySelectorAll('.bs-principal strong')].map((x) => x.textContent);
const busquedas = (l: string[]) => l.filter((u) => u.includes('/admin/buscar'));

describe('C-BUSCADOR-INSTANTANEO · buscador de arriba', () => {
  beforeEach(() => window.history.pushState(null, '', BASE));
  afterEach(() => vi.unstubAllGlobals());

  it('con UNA letra ya busca, muestra cuántos hay y «Ver todos» lleva a Pedidos en curso', async () => {
    const llamadas = servidor((u) => ({
      q: u.searchParams.get('q'),
      salto: null,
      avisoMonto: false,
      grupos: [
        {
          tipo: 'pedidos',
          resultados: [resultado(ID_73, 'en_camino'), resultado(ID_7A, 'entregado')],
          total: 312,
          totalMas: false,
        },
      ],
    }));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    await userEvent.type(screen.getByRole('combobox'), '7');
    const lista = await screen.findByRole('listbox');
    expect(busquedas(llamadas)).toEqual(['/datos/admin/buscar?q=7']);
    expect(lista.querySelector('.bs-grupo')?.textContent).toBe('Pedidos · 312');
    expect(titulos()).toEqual(['#73C2E8', '#7A0000']);
    // Lo que coincidió va resaltado.
    expect(lista.querySelector('mark')?.textContent).toBe('7');
    const verTodos = within(lista).getByText(/Ver los 312 en Pedidos en curso/);
    expect(verTodos).toBeTruthy();
    // También se llega con el teclado: es una opción más.
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await userEvent.click(verTodos);
    expect(window.location.pathname + window.location.search).toBe(`${BASE}/orders?q=7`);
  });

  it('la pausa entre teclas es corta y lo ya buscado sale de la memoria sin pedirlo otra vez', async () => {
    expect(PAUSA_BUSCAR_MS).toBeLessThanOrEqual(150);
    const llamadas = servidor((u) => ({
      q: u.searchParams.get('q'),
      salto: null,
      avisoMonto: false,
      grupos: [{ tipo: 'pedidos', resultados: [resultado(ID_73, 'entregado')], total: 1 }],
    }));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    const casilla = screen.getByRole('combobox');
    await userEvent.type(casilla, '7');
    await waitFor(() => expect(busquedas(llamadas)).toHaveLength(1));
    await userEvent.type(casilla, '3');
    await waitFor(() => expect(busquedas(llamadas)).toHaveLength(2));
    // Se borra la última letra: «7» sale al instante de la memoria (no hay tercera petición).
    await userEvent.type(casilla, '{Backspace}');
    await waitFor(() => expect(titulos()).toEqual(['#73C2E8']));
    expect(screen.getByRole('combobox')).toHaveValue('7');
    await new Promise((r) => setTimeout(r, PAUSA_BUSCAR_MS + 50));
    expect(busquedas(llamadas)).toEqual(['/datos/admin/buscar?q=7', '/datos/admin/buscar?q=73']);
  });

  it('sin resultados dice qué se buscó y sugiere el código bien escrito', async () => {
    const llamadas = servidor((u) => ({
      q: u.searchParams.get('q'),
      salto: null,
      avisoMonto: false,
      grupos: [],
    }));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    await userEvent.type(screen.getByRole('combobox'), 'B429OC');
    expect(await screen.findByText('No encontramos «B429OC».')).toBeTruthy();
    expect(screen.getByText(/desde la primera letra/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '#B4290C' }));
    expect(screen.getByRole('combobox')).toHaveValue('#B4290C');
    await waitFor(() => expect(busquedas(llamadas)).toContain('/datos/admin/buscar?q=%23B4290C'));
  });
});

describe('C-BUSCADOR-INSTANTANEO · «Pedidos en curso»', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, '', `${BASE}/orders?q=7`);
  });
  afterEach(() => vi.unstubAllGlobals());

  const fila = (id: string, estado: string) => ({
    id,
    tipo: 'pedido',
    servicio: 'comida',
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
  });

  it('llega con lo buscado («Ver todos»), dice cuántos empiezan así y subraya el comienzo del código', async () => {
    const llamadas = servidor((u) => {
      if (u.pathname.includes('/admin/preferencias/')) return { valor: {}, guardada: false };
      if (u.pathname.includes('/admin/ciudades')) return { ciudades: [] };
      if (u.pathname.includes('/contadores'))
        return { contadores: {}, limitado: false, hayEnvios: false };
      return {
        pedidos: [fila(ID_73, 'en_camino'), fila(ID_7A, 'entregado')],
        siguiente: null,
        porCodigo: true,
        total: 312,
        totalMas: false,
        encontrado: null,
      };
    });
    render(
      <SesionArmazon.Provider value={SESION}>
        <SuperPedidos base={BASE} idioma="es" />
      </SesionArmazon.Provider>,
    );
    expect(await screen.findByText(/312 pedidos y viajes empiezan por «7»/)).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: /Código, nombre/ })).toHaveValue('7');
    expect(llamadas.some((u) => u.startsWith('/datos/admin/pedidos?') && u.includes('q=7'))).toBe(
      true,
    );
    const marcas = [...document.querySelectorAll('.codigo-pedido mark')].map((m) => m.textContent);
    expect(marcas).toEqual(['7', '7']);
  });
});

describe('C-BUSCADOR-INSTANTANEO · memoria de lo buscado', () => {
  it('vence a los 15 segundos y guarda como mucho las últimas búsquedas', () => {
    let ahora = 1_000;
    const m = crearMemoria<number>(() => ahora);
    m.guardar('7', 1);
    expect(m.leer('7')).toEqual({ valor: 1, vigente: true });
    ahora += VIGENCIA_MEMORIA_MS;
    expect(m.leer('7')).toEqual({ valor: 1, vigente: false });
    for (let i = 0; i < TOPE_MEMORIA + 5; i++) m.guardar(`q${i}`, i);
    expect(m.leer('7')).toBeNull();
    expect(m.leer(`q${TOPE_MEMORIA + 4}`)?.valor).toBe(TOPE_MEMORIA + 4);
  });
});
