import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermisosContexto, filtrarMenu, seccionPermitida } from './permisosPanel';
import { VerDato, VerFoto } from './DatoProtegido';

/**
 * C-PERMISOS-FINOS en el panel: el menú y los botones se esconden según `puedeVer`; «Ver dato» y
 * «Ver foto» solo con su permiso; el segundo factor se pide donde hace falta. Comprobado en rojo
 * mostrando «Ver foto» sin mirar el permiso.
 */
const conPermisos = (ui: React.ReactNode, permisos: string[], segundo = false) => (
  <PermisosContexto.Provider
    value={{
      acceso: {
        id: 'yo',
        permisos,
        fuentes: {},
        alcance: { paises: null, zonas: null, servicios: null },
        dueno: false,
        origen: 'asignaciones',
        segundoFactor: { activo: segundo, vigente: false },
      },
      cargando: false,
      puedeVer: (p) => p === 'libre' || permisos.includes(p),
      recargar: () => undefined,
    }}
  >
    {ui}
  </PermisosContexto.Provider>
);

afterEach(() => vi.unstubAllGlobals());

describe('puedeVer en el menú', () => {
  it('cada sección pide su permiso; una sección desconocida se muestra (el servidor frena igual)', () => {
    const puede = (lista: string[]) => (p: string) => p === 'libre' || lista.includes(p);
    const grupos = [
      {
        titulo: 'Operación',
        items: [
          { clave: 'orders', texto: 'Pedidos', a: '/x/orders' },
          { clave: 'money', texto: 'Dinero', a: '/x/money' },
          { clave: 'nueva-seccion', texto: 'Nueva', a: '/x/nueva' },
        ],
      },
      { titulo: 'Territorio', items: [{ clave: 'zones', texto: 'Zonas', a: '/x/zones' }] },
    ];
    const r = filtrarMenu(grupos, puede(['pedidos.ver']));
    expect(r).toHaveLength(1);
    expect(r[0]?.items.map((i) => i.clave)).toEqual(['orders', 'nueva-seccion']);
    expect(seccionPermitida('team', puede(['avisos.recibir']))).toBe(true);
    expect(seccionPermitida('approvals', puede(['dinero.solicitar']))).toBe(true);
    expect(seccionPermitida('settings', puede([]))).toBe(true);
  });
});

describe('Ver dato', () => {
  it('sin el permiso solo se ve enmascarado; con él, «Ver dato» lo muestra completo', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ valor: '+1 313 555 0142' })));
    const { unmount } = render(
      conPermisos(
        <VerDato tipo="cliente" id="c1" campo="telefono" mascara="+1 ••• ••• 0142" idioma="es" />,
        ['clientes.ver'],
      ),
    );
    expect(screen.getByText('+1 ••• ••• 0142')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver dato' })).toBeNull();
    unmount();
    render(
      conPermisos(
        <VerDato tipo="cliente" id="c1" campo="telefono" mascara="+1 ••• ••• 0142" idioma="es" />,
        ['clientes.ver', 'clientes.datos_personales'],
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver dato' }));
    expect(await screen.findByText('+1 313 555 0142')).toBeInTheDocument();
  });

  it('si el servidor pide el segundo factor, aparece «Mandarme el código»', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ error: 'código', campo: 'segundo_factor' }), { status: 403 }),
    );
    render(
      conPermisos(
        <VerDato tipo="cliente" id="c1" campo="correo" mascara="a•••@ejemplo.com" idioma="es" />,
        ['clientes.datos_personales'],
        true,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver dato' }));
    expect(await screen.findByRole('button', { name: 'Mandarme el código' })).toBeInTheDocument();
  });
});

describe('Ver foto', () => {
  it('borrosa sin botón y con aviso si no tiene permiso', () => {
    render(conPermisos(<VerFoto pedidoId="p1" tipo="entrega" idioma="es" />, ['pedidos.ver']));
    expect(screen.queryByRole('button', { name: 'Ver foto' })).toBeNull();
    expect(screen.getByText('Tu acceso no incluye ver fotos de entrega.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('con permiso: borrosa hasta «Ver foto», y la pide UNA vez al servidor', async () => {
    const pedidas: string[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
    );
    vi.stubGlobal('fetch', async (url: string) => {
      pedidas.push(String(url));
      return new Response(new Blob(['x'], { type: 'image/webp' }), { status: 200 });
    });
    render(conPermisos(<VerFoto pedidoId="p1" tipo="entrega" idioma="en" />, ['pedidos.fotos']));
    expect(screen.queryByRole('img')).toBeNull();
    expect(pedidas).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'View photo' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Drop-off photo' })).toBeInTheDocument(),
    );
    expect(pedidas).toEqual(['/datos/pedidos/p1/evidencia/entrega']);
    expect(screen.getByText('Every view is logged · Kept for 30 days')).toBeInTheDocument();
  });

  it('entrega en mano sin foto y foto borrada por retención no parecen un fallo', () => {
    const { rerender } = render(
      conPermisos(<VerFoto pedidoId="p1" tipo="entrega" idioma="es" estado="sin_foto" />, [
        'pedidos.fotos',
      ]),
    );
    expect(screen.getByText('Sin foto: entrega en mano')).toBeInTheDocument();
    rerender(
      conPermisos(<VerFoto pedidoId="p1" tipo="entrega" idioma="es" estado="borrada" />, [
        'pedidos.fotos',
      ]),
    );
    expect(screen.getByText('Foto borrada por retención')).toBeInTheDocument();
  });
});
