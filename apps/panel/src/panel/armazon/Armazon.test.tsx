import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Armazon, SesionArmazon } from './Armazon';
import { ICONOS_MENU, gruposAdmin, gruposRestaurante } from './menus';
import { TEXTOS_PANEL } from '../textos';

const usuario = {
  id: 'u1',
  nombre: 'Rosa Dueña',
  correo: 'rosa@correo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};

const grupos = [
  {
    titulo: 'Operación',
    items: [
      { clave: 'inicio', texto: 'Inicio', a: '/panel', activo: true },
      { clave: 'orders', texto: 'Pedidos', a: '/panel/orders' },
    ],
  },
  { titulo: 'Dinero', items: [{ clave: 'earnings', texto: 'Beneficios', a: '/panel/earnings' }] },
];

function montar(extra: Partial<React.ComponentProps<typeof Armazon>> = {}) {
  const salir = vi.fn();
  render(
    <SesionArmazon.Provider value={{ usuario, idioma: 'es', cambiar: vi.fn(), salir }}>
      <Armazon grupos={grupos} {...extra}>
        <h1>Contenido</h1>
      </Armazon>
    </SesionArmazon.Provider>,
  );
  return { salir };
}

/** C-PANEL-ARMAZON: un solo armazón para todos los paneles web. */
describe('armazón del panel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('el menú lateral agrupa los ítems bajo títulos y cada ítem lleva su ícono', () => {
    montar();
    const menu = screen.getByRole('navigation', { name: 'Panel' });
    expect(within(menu).getByText('Operación')).toBeInTheDocument();
    expect(within(menu).getByText('Dinero')).toBeInTheDocument();
    for (const enlace of within(menu).getAllByRole('link'))
      expect(enlace.querySelector('svg')).not.toBeNull();
  });

  it('el ítem activo queda marcado para la vista y para los lectores de pantalla', () => {
    montar();
    const activo = screen.getByRole('link', { name: 'Inicio' });
    expect(activo).toHaveClass('activo');
    expect(activo).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Pedidos' })).not.toHaveClass('activo');
  });

  it('la cabecera trae buscador, campana, idioma y la cuenta con cerrar sesión', async () => {
    const { salir } = montar();
    expect(screen.getByRole('combobox', { name: 'Buscar en el panel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avisos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ES · Cambiar idioma/ })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Rosa'));
    const cuenta = document.querySelector('.cuenta-menu') as HTMLElement;
    expect(within(cuenta).getByText('rosa@correo.com')).toBeInTheDocument();
    await userEvent.click(within(cuenta).getByRole('button', { name: 'Cerrar sesión' }));
    expect(salir).toHaveBeenCalled();
  });

  it('C-AYUDA-INTERNA: el «?» junto a la campana abre la ayuda del equipo, y solo si se la pasan', () => {
    montar({ ayuda: '/panel/control-abc/help' });
    const boton = screen.getByRole('link', { name: 'Ayuda del equipo' });
    expect(boton).toHaveAttribute('href', '/panel/control-abc/help');
    // Va junto a la campana, en la cabecera (no en el menú lateral).
    expect(boton.closest('.pd-cabecera-derecha')).not.toBeNull();
  });

  it('C-AYUDA-INTERNA: sin dirección de ayuda (restaurante, Flex, franquicia) no hay «?»', () => {
    montar();
    expect(screen.queryByTestId('ayuda-interna')).toBeNull();
  });

  it('la salida también está al final del menú lateral (C-SALIR-A-LA-VISTA)', async () => {
    const { salir } = montar();
    await userEvent.click(screen.getByTestId('menu-salir'));
    expect(salir).toHaveBeenCalled();
  });

  it('el buscador encuentra una sección por su nombre, sin importar acentos ni mayúsculas', async () => {
    montar();
    await userEvent.type(screen.getByRole('combobox'), 'benef');
    const resultados = screen.getByRole('listbox');
    expect(within(resultados).getByRole('option', { name: /Beneficios/ })).toBeInTheDocument();
    expect(within(resultados).queryByRole('option', { name: /Pedidos/ })).toBeNull();
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByText('No encontramos esa sección.')).toBeInTheDocument();
  });

  it('el buscador se maneja con el teclado: flechas para elegir y Enter para ir', async () => {
    montar();
    const casilla = screen.getByRole('combobox');
    expect(casilla).toHaveAttribute('aria-expanded', 'false');
    await userEvent.type(casilla, 'e');
    expect(casilla).toHaveAttribute('aria-expanded', 'true');
    const opciones = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(opciones.length).toBeGreaterThan(1);
    expect(opciones[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(opciones[1]).toHaveAttribute('aria-selected', 'true');
    expect(casilla).toHaveAttribute('aria-activedescendant', opciones[1]?.id);
    await userEvent.keyboard('{Enter}');
    // «e» encuentra Inicio, Pedidos y Beneficios; la segunda es Pedidos.
    expect(window.location.pathname).toBe('/panel/orders');
    expect(casilla).toHaveValue('');
  });

  it('la campana muestra los avisos reales y, si no hay, lo dice', async () => {
    montar({
      avisos: [{ clave: 't', texto: 'Tickets abiertos', cantidad: 4, a: '/panel/tickets' }],
    });
    const campana = screen.getByRole('button', { name: 'Avisos: 4' });
    await userEvent.click(campana);
    expect(screen.getByRole('link', { name: /Tickets abiertos/ })).toBeInTheDocument();
  });

  it('sin avisos la campana no inventa números', async () => {
    montar({ avisos: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Avisos' }));
    expect(screen.getByText('No hay avisos nuevos.')).toBeInTheDocument();
  });

  it('en celular el menú se abre y se cierra con su botón', async () => {
    montar();
    const boton = screen.getByRole('button', { name: 'Abrir el menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('armazon')).not.toHaveClass('pd-menu-abierto');
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(boton).toHaveAccessibleName('Cerrar el menú');
    expect(screen.getByTestId('armazon')).toHaveClass('pd-menu-abierto');
  });

  it('en logística dice Divoox Flex y deja salir a la vista (C-FLEX-MARCA, C-FLEX-SALIR)', async () => {
    const { salir } = montar({ variante: 'logistica' });
    expect(screen.getByTestId('flex-marca')).toHaveTextContent('Divoox Flex');
    await userEvent.click(screen.getByTestId('flex-salir'));
    expect(salir).toHaveBeenCalled();
    expect(screen.getByTestId('armazon')).toHaveClass('flex-panel');
  });

  it('en inglés todo el armazón sale en inglés', () => {
    render(
      <SesionArmazon.Provider value={{ usuario, idioma: 'en', cambiar: vi.fn(), salir: vi.fn() }}>
        <Armazon grupos={grupos}>
          <p>x</p>
        </Armazon>
      </SesionArmazon.Provider>,
    );
    expect(screen.getByRole('combobox', { name: 'Search the dashboard' })).toBeInTheDocument();
    expect(screen.getByTestId('menu-salir')).toHaveTextContent('Sign out');
  });
});

describe('menús por rol', () => {
  it('todas las secciones del superadmin y del restaurante están en un grupo y tienen ícono', () => {
    for (const idioma of ['es', 'en'] as const) {
      const t = TEXTOS_PANEL[idioma];
      const admin = gruposAdmin(t, idioma, '/panel/control-x', '/panel/control-x', true);
      const clavesAdmin = admin.flatMap((g) => g.items.map((i) => i.clave));
      for (const clave of Object.keys(t.menuAdmin)) expect(clavesAdmin).toContain(clave);
      const rest = gruposRestaurante(t, idioma, '/panel', true);
      const clavesRest = rest.flatMap((g) => g.items.map((i) => i.clave));
      for (const clave of Object.keys(t.menuRest)) expect(clavesRest).toContain(clave);
      for (const clave of [...clavesAdmin, ...clavesRest])
        expect(Object.keys(ICONOS_MENU)).toContain(clave);
      for (const g of [...admin, ...rest]) expect(g.titulo.length).toBeGreaterThan(2);
    }
  });

  it('la ciudad de pruebas no aparece en producción y la flota solo donde ya se puede usar', () => {
    const t = TEXTOS_PANEL.es;
    const claves = (g: ReturnType<typeof gruposAdmin>) =>
      g.flatMap((x) => x.items.map((i) => i.clave));
    expect(claves(gruposAdmin(t, 'es', '/panel/c', '/panel/c', false))).not.toContain('test-city');
    expect(claves(gruposRestaurante(t, 'es', '/panel', false))).not.toContain('fleet');
  });

  it('una ficha de detalle deja resaltada su sección', () => {
    const t = TEXTOS_PANEL.es;
    const g = gruposAdmin(t, 'es', '/panel/c', '/panel/c/tickets/abc', true);
    const activo = g.flatMap((x) => x.items).filter((i) => i.activo);
    expect(activo.map((i) => i.clave)).toEqual(['tickets']);
  });
});
