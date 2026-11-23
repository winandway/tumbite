import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperCliente } from './SuperFichas';
import { PermisosContexto } from './permisosPanel';

/**
 * C-CORREGIR-CORREO (20 nov 2026): la ficha del cliente dice si el correo rebotó y, en los tres
 * puntos, deja corregirlo (con «¿Quisiste decir…?») y reenviar la confirmación. Sin el permiso,
 * las opciones no salen.
 */
const ID = '22222222-2222-2222-2222-222222222222';
const CLIENTE = {
  cliente: {
    id: ID,
    nombre: 'Jhon',
    correo: 'jh…@gmail.com',
    telefono: '',
    fechaNacimiento: null,
    idioma: 'es',
    alta: '2026-11-20 01:16:00',
    correoConfirmado: false,
    correoEstado: 'rebotado',
    historialCorreo: [],
    activo: true,
    ciudad: null,
    pedidos: 0,
    gastado: 0,
    gastadoPorMoneda: [],
    compras: [],
    quejas: [],
  },
};

function servidor(estado = 'rebotado') {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  const datos = {
    cliente: {
      ...CLIENTE.cliente,
      correoEstado: estado,
      correoConfirmado: estado === 'confirmado',
    },
  };
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const cuerpo = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    if (url.endsWith('/correo'))
      return new Response(
        JSON.stringify({ ok: true, correoEnviado: true, aviso: null, estado: 'sin_confirmar' }),
      );
    if (url.endsWith('/rebote/quitar'))
      return new Response(JSON.stringify({ ok: true, estado: 'sin_confirmar' }));
    return new Response(JSON.stringify(datos));
  });
  return llamadas;
}

function conPermisos(permisos: string[], hijo: React.ReactNode) {
  return (
    <PermisosContexto.Provider
      value={{
        acceso: null,
        cargando: false,
        puedeVer: (p) => permisos.includes(p),
        recargar: () => undefined,
      }}
    >
      {hijo}
    </PermisosContexto.Provider>
  );
}

describe('C-CORREGIR-CORREO en la ficha', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra que rebotó y corrige el correo aceptando la sugerencia', async () => {
    const llamadas = servidor();
    const u = userEvent.setup();
    render(
      conPermisos(
        ['clientes.ver', 'clientes.corregir_correo', 'clientes.datos_personales'],
        <SuperCliente base="/panel/control-x" id={ID} idioma="es" />,
      ),
    );
    expect(await screen.findByText(/El correo rebotó: el buzón no existe/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Corregir correo' }));
    await u.click(await screen.findByRole('menuitem', { name: 'Corregir correo' }));
    await u.type(screen.getByLabelText('Correo nuevo'), 'jhon@gmial.com');
    await u.click(screen.getByRole('button', { name: '¿Quisiste decir jhon@gmail.com?' }));
    await u.click(screen.getByRole('button', { name: 'Guardar y mandar la confirmación' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
        url: `/datos/admin/usuarios/${ID}/correo`,
        cuerpo: { correo: 'jhon@gmail.com', motivo: '' },
      }),
    );
    expect(
      await screen.findByText('Correo corregido. Le mandamos el enlace de confirmación.'),
    ).toBeInTheDocument();
  });

  it('cuenta confirmada: no ofrece corregir y explica por qué (seguridad, 20 nov)', async () => {
    servidor('confirmado');
    render(
      conPermisos(
        ['clientes.ver', 'clientes.corregir_correo'],
        <SuperCliente base="/panel/control-x" id={ID} idioma="es" />,
      ),
    );
    expect(await screen.findByTestId('correo-ya-confirmado')).toHaveTextContent(
      /ya confirmó su correo; el cambio lo hace la persona desde su app/,
    );
    expect(screen.queryByRole('button', { name: 'Corregir correo' })).toBeNull();
  });

  it('con rebote, «Quitar el rebote» llama al servidor y lo dice', async () => {
    const llamadas = servidor('rebotado');
    const u = userEvent.setup();
    render(
      conPermisos(
        ['clientes.ver', 'clientes.corregir_correo'],
        <SuperCliente base="/panel/control-x" id={ID} idioma="es" />,
      ),
    );
    await u.click(await screen.findByRole('button', { name: 'Corregir correo' }));
    await u.click(
      await screen.findByRole('menuitem', { name: 'Quitar el rebote (el buzón ya recibe)' }),
    );
    await waitFor(() =>
      expect(llamadas.some((l) => l.url === `/datos/admin/usuarios/${ID}/rebote/quitar`)).toBe(
        true,
      ),
    );
    expect(await screen.findByText(/Quitamos el rebote/)).toBeInTheDocument();
  });

  it('sin el permiso no salen las opciones', async () => {
    servidor();
    render(
      conPermisos(['clientes.ver'], <SuperCliente base="/panel/control-x" id={ID} idioma="es" />),
    );
    expect(await screen.findByText(/El correo rebotó/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corregir correo' })).toBeNull();
  });
});
