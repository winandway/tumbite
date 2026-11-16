import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PLANTILLAS_SISTEMA } from '@tumbite/compartido';
import { SuperEquipo } from './SuperEquipo';
import { PermisosContexto } from './permisosPanel';

/**
 * C-PERMISOS-FINOS y C-EQUIPO-INVITACION en el panel (MON-5, 15 nov 2026): «Equipo interno».
 * Comprobado en rojo: sin el chequeo de «Soporte» se manda la invitación; sin `useBorrador` lo
 * escrito no vuelve; con la acción de quitar fuera de los tres puntos falla la prueba del menú.
 */
type Llamada = { url: string; metodo: string; cuerpo?: unknown };
const PLANTILLAS = PLANTILLAS_SISTEMA.map((p) => ({
  ...p,
  permisos: [...p.permisos],
  topes: p.topes ?? null,
  sistema: true,
  editable: p.id !== 'total',
  borrable: false,
  personas: 0,
}));
const MIEMBROS = [
  {
    id: 'yo',
    nombre: 'Soporte Jefe',
    correo: 'jefe@ejemplo.com',
    estado: 'activo',
    dueno: true,
    perfilViejo: null,
    plantillas: ['total'],
    alcance: { paises: null, zonas: null, servicios: null },
    ultimaEntrada: '2026-11-15 14:00:00',
    venceEn: null,
  },
  {
    id: 'ana',
    nombre: 'Ana Monitor',
    correo: 'a•••@ejemplo.com',
    estado: 'activo',
    dueno: false,
    perfilViejo: null,
    plantillas: ['soporte_1'],
    alcance: { paises: null, zonas: ['US-MI-NOVI'], servicios: null },
    ultimaEntrada: null,
    venceEn: '2026-12-31 23:59:59',
  },
];

let llamadas: Llamada[] = [];
function servidor(extra: (url: string, init?: RequestInit) => Response | null = () => null) {
  llamadas = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const r = extra(String(url), init);
    if (r) return r;
    const u = String(url);
    const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
    if (u.includes('/equipo/miembros')) return json({ miembros: MIEMBROS, siguiente: null });
    if (u.includes('/equipo/plantillas')) return json({ plantillas: PLANTILLAS });
    if (u.includes('/equipo/invitaciones') && init?.method === 'POST')
      return json(
        {
          ok: true,
          id: 'i1',
          enlace: 'http://localhost/team-invite?code=abc',
          correoEnviado: false,
        },
        201,
      );
    if (u.includes('/equipo/invitaciones')) return json({ invitaciones: [] });
    if (u.includes('/admin/zonas'))
      return json({ zonas: [{ id: 'US-MI-NOVI', nombre: 'Novi', pais: 'US' }] });
    if (u.includes('/segundo-factor')) return json({ activo: false });
    if (u.includes('/mis-avisos') && init?.method !== 'PUT')
      return json({
        avisos: [
          { tipo: 'pedidos', activo: false, fijo: false },
          { tipo: 'sistema', activo: true, fijo: true },
        ],
      });
    return json({ ok: true });
  });
}

function conPermisos(ui: React.ReactNode, permisos: string[]) {
  return (
    <PermisosContexto.Provider
      value={{
        acceso: {
          id: 'yo',
          permisos,
          fuentes: {},
          alcance: { paises: null, zonas: null, servicios: null },
          dueno: false,
          origen: 'asignaciones',
          segundoFactor: { activo: false, vigente: false },
        },
        cargando: false,
        puedeVer: (p) => p === 'libre' || permisos.includes(p),
        recargar: () => undefined,
      }}
    >
      {ui}
    </PermisosContexto.Provider>
  );
}
const TODO = PLANTILLAS_SISTEMA.find((p) => p.id === 'total')!.permisos.slice();

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Equipo interno · personas', () => {
  it('lista con estado, plantilla, alcance y enlace a su ficha; suspender pide confirmar con motivo desde los tres puntos', async () => {
    servidor();
    render(conPermisos(<SuperEquipo idioma="es" miId="yo" base="/panel/control-x" />, TODO));
    const ana = await screen.findByRole('link', { name: 'Ana Monitor' });
    expect(ana).toHaveAttribute('href', '/panel/control-x/team/ana');
    const fila = ana.closest('li')!;
    expect(within(fila).getByText('Soporte nivel 1')).toBeInTheDocument();
    expect(within(fila).getByText('Novi')).toBeInTheDocument();
    // Ninguna acción destructiva a la vista: viven en los tres puntos.
    expect(screen.queryByRole('button', { name: 'Quitar acceso' })).toBeNull();
    // A sí mismo y al dueño no se le ofrece suspender.
    expect(screen.queryByRole('button', { name: 'Más acciones: Soporte Jefe' })).toBeNull();
    await userEvent.click(within(fila).getByRole('button', { name: 'Más acciones: Ana Monitor' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Suspender' }));
    const dialogo = screen.getByRole('dialog', { name: '¿Suspender a esta persona?' });
    const confirmar = within(dialogo).getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Investigación interna');
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/miembros/ana/suspender'))?.cuerpo).toEqual({
        motivo: 'Investigación interna',
      }),
    );
  });

  it('sin `equipo.gestionar` no hay «Agregar empleado» ni tres puntos; sin `equipo.ver` solo «Mis avisos»', async () => {
    servidor();
    const { unmount } = render(
      conPermisos(<SuperEquipo idioma="es" miId="yo" base="/b" />, [
        'equipo.ver',
        'avisos.recibir',
      ]),
    );
    await screen.findByRole('link', { name: 'Ana Monitor' });
    expect(screen.queryByRole('button', { name: 'Agregar empleado' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Más acciones/ })).toBeNull();
    unmount();
    render(conPermisos(<SuperEquipo idioma="es" miId="yo" base="/b" />, ['avisos.recibir']));
    expect(await screen.findByRole('checkbox', { name: /^Pedidos/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Personas' })).toBeNull();
  });

  it('C-AVISOS-EQUIPO: marcar un tipo de aviso lo guarda; el de sistema fijo no se puede quitar', async () => {
    servidor();
    render(conPermisos(<SuperEquipo idioma="es" miId="yo" base="/b" />, ['avisos.recibir']));
    const pedidos = await screen.findByRole('checkbox', { name: /^Pedidos/ });
    expect(screen.getByRole('checkbox', { name: /^Sistema/ })).toBeDisabled();
    await userEvent.click(pedidos);
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
        tipo: 'pedidos',
        activo: true,
      }),
    );
  });
});

describe('Equipo interno · agregar empleado', () => {
  it('@windoce.com sin «Soporte» no se manda; lo escrito vuelve al reabrir; manda plantillas, alcance y motivo', async () => {
    servidor();
    const { unmount } = render(conPermisos(<SuperEquipo idioma="es" miId="yo" base="/b" />, TODO));
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar empleado' }));
    await userEvent.type(screen.getByLabelText('Correo de trabajo'), 'jose@windoce.com');
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'José');
    expect(screen.getAllByText(/llevan «Soporte» en el nombre/).length).toBeGreaterThan(0);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Soporte nivel 1/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Novi' }));
    await userEvent.type(screen.getByLabelText('Motivo'), 'Turno de noche');
    // Se cierra sin mandar: al volver, todo está ahí.
    await new Promise((r) => setTimeout(r, 650));
    unmount();
    render(conPermisos(<SuperEquipo idioma="es" miId="yo" base="/b" />, TODO));
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar empleado' }));
    expect(await screen.findByText('Recuperamos lo que estabas escribiendo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo de trabajo')).toHaveValue('jose@windoce.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar invitación' }));
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
    await userEvent.clear(screen.getByLabelText('Nombre completo'));
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'José (Soporte)');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar invitación' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({
      correo: 'jose@windoce.com',
      nombre: 'José (Soporte)',
      plantillas: ['soporte_1'],
      alcance: { zonas: ['US-MI-NOVI'] },
      motivo: 'Turno de noche',
    });
    // En local el enlace se ve solo aquí, para quien invitó.
    expect(await screen.findByText('Enlace de invitación (solo tú lo ves)')).toBeInTheDocument();
    expect(screen.getByText('http://localhost/team-invite?code=abc')).toBeInTheDocument();
  });

  it('las plantillas con permisos que quien invita no tiene salen apagadas', async () => {
    servidor();
    const soporte2 = PLANTILLAS_SISTEMA.find((p) => p.id === 'soporte_2')!.permisos.slice();
    render(
      conPermisos(<SuperEquipo idioma="es" miId="yo" base="/b" />, [
        ...soporte2,
        'equipo.ver',
        'equipo.gestionar',
      ]),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar empleado' }));
    expect(await screen.findByRole('checkbox', { name: /Soporte nivel 1/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /^Finanzas/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^Total/ })).toBeDisabled();
  });
});
