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

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const cuerpo = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    if (url.endsWith('/correo'))
      return new Response(
        JSON.stringify({ ok: true, correoEnviado: true, aviso: null, estado: 'sin_confirmar' }),
      );
    return new Response(JSON.stringify(CLIENTE));
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
    expect(await screen.findByText(/Rebotó: el buzón no existe/)).toBeInTheDocument();
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

  it('sin el permiso no salen las opciones', async () => {
    servidor();
    render(
      conPermisos(['clientes.ver'], <SuperCliente base="/panel/control-x" id={ID} idioma="es" />),
    );
    expect(await screen.findByText(/Rebotó/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corregir correo' })).toBeNull();
  });
});
