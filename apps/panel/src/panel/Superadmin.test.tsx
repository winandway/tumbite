import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperFranquicias, SuperResumen, SuperTickets } from './Superadmin';
import { PanelFranquicia } from './PanelFranquicia';
import { GestionFranquicia } from './GestionFranquicia';
import { TableroRestaurante } from './TableroRestaurante';
import { AyudaBurbuja } from './AyudaBurbuja';
import { ReportarPanel } from './ReportarPanel';

function servidor(manejar: (url: string, init?: RequestInit) => unknown) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const r = manejar(url, init);
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 });
  });
  return llamadas;
}

const METRICAS = {
  pedidosHoy: 2,
  pedidos30: 40,
  ventas30: 120000,
  ganancia30: 9000,
  restaurantes: 12,
  restaurantesAbiertos: 9,
  repartidores: 20,
  repartidoresConectados: 6,
  ticketsAbiertos: 1,
};
const FRANQUICIA = {
  id: 'f1',
  nombre: 'Miami Norte',
  areas: 1,
  zonaId: 'US-FL-MIAMI',
  ciudad: 'Miami',
  pais: 'US',
  estado: 'activa',
  duenoCorreo: 'socio@ejemplo.com',
  motos: 30,
  notas: '',
  ruta: 'franchise-miami-0123456789abcdef0123',
  metricas: METRICAS,
};
const RESUMEN = {
  totales: {
    franquicias: 1,
    vendidas: 1,
    activas: 1,
    interesados: 3,
    ticketsAbiertos: 4,
    motos: 30,
  },
  franquicias: [FRANQUICIA],
  ciudades: [
    {
      id: 'US-FL-MIAMI',
      ciudad: 'Miami',
      pais: 'US',
      activa: true,
      franquicias: 1,
      areas: 2,
      areasLibres: 1,
      metricas: METRICAS,
    },
    {
      id: 'US-FL-TAMPA',
      ciudad: 'Tampa',
      pais: 'US',
      activa: false,
      franquicias: 0,
      areas: 0,
      areasLibres: 0,
      metricas: METRICAS,
    },
  ],
  sinFranquicia: [
    { id: 'US-FL-TAMPA', ciudad: 'Tampa', pais: 'US', activa: false, metricas: METRICAS },
  ],
};
const usuario = {
  id: 'a1',
  nombre: 'Soporte Divoox',
  correo: 'soporte@ejemplo.com',
  rol: 'admin' as const,
  idioma: 'es' as const,
};

describe('superadmin', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('el resumen muestra totales, la producción de cada franquicia y las ciudades libres', async () => {
    servidor(() => RESUMEN);
    render(<SuperResumen base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('Miami Norte')).toBeInTheDocument();
    // Resultados por ciudad: también las que todavía no tienen franquicia.
    expect(screen.getAllByText(/Tampa/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1,200.00').length).toBeGreaterThan(0);
  });

  it('C-ERRORES-VISIBLES: el resumen lista los errores del servidor con su ruta y mensaje', async () => {
    servidor((url) =>
      url.includes('/admin/errores')
        ? {
            errores: [
              {
                id: 1,
                metodo: 'POST',
                ruta: '/datos/repartidor/pedidos/:id/foto-recogida',
                mensaje: 'D1_ERROR: prueba',
                creadoEn: '2026-10-19 21:43:17',
              },
            ],
          }
        : RESUMEN,
    );
    render(<SuperResumen base="/panel/control-x" idioma="en" />);
    expect(await screen.findByText('D1_ERROR: prueba')).toBeInTheDocument();
    expect(
      screen.getByText('POST /datos/repartidor/pedidos/:id/foto-recogida'),
    ).toBeInTheDocument();
    expect(screen.getByText('Server errors')).toBeInTheDocument();
  });

  it('C-REVISORES: el botón crea las cuentas del revisor y muestra las contraseñas una vez', async () => {
    const llamadas = servidor((url, init) =>
      url.includes('/admin/revisores') && init?.method === 'POST'
        ? {
            cuentas: [
              { rol: 'cliente', correo: 'revisor.cliente@windoce.com', clave: 'AbC123' },
              { rol: 'repartidor', correo: 'revisor.driver@windoce.com', clave: 'DeF456' },
            ],
          }
        : RESUMEN,
    );
    render(<SuperResumen base="/panel/control-x" idioma="es" />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Crear las cuentas del revisor' }),
    );
    expect(await screen.findByText('DeF456')).toBeInTheDocument();
    expect(screen.getByText('revisor.cliente@windoce.com')).toBeInTheDocument();
    expect(screen.getByText(/no se vuelven a mostrar/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.url.includes('/datos/admin/revisores'))).toBe(true);
  });

  it('C-REVISORES: conserva la clave visible al repetir y exige confirmar para renovarla', async () => {
    let creada = false;
    const llamadas = servidor((url, init) => {
      if (url.includes('/admin/revisores/repartidor/clave'))
        return {
          rol: 'repartidor',
          correo: 'revisor.driver@windoce.com',
          clave: 'Nueva-clave-local',
        };
      if (url.includes('/admin/revisores') && init?.method === 'POST') {
        const clave = creada ? null : 'Clave-local-inicial';
        creada = true;
        return { cuentas: [{ rol: 'repartidor', correo: 'revisor.driver@windoce.com', clave }] };
      }
      return RESUMEN;
    });
    render(<SuperResumen base="/panel/control-x" idioma="es" />);
    const crear = await screen.findByRole('button', { name: 'Crear las cuentas del revisor' });
    await userEvent.click(crear);
    expect(await screen.findByText('Clave-local-inicial')).toBeInTheDocument();
    await userEvent.click(crear);
    expect(screen.getByText('Clave-local-inicial')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Más opciones de la cuenta'));
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar esta contraseña' }));
    expect(llamadas.some((l) => l.url.includes('/repartidor/clave'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(llamadas.some((l) => l.url.includes('/repartidor/clave'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar esta contraseña' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de contraseña' }));
    expect(await screen.findByText('Nueva-clave-local')).toBeInTheDocument();
    expect(screen.queryByText('Clave-local-inicial')).not.toBeInTheDocument();
    expect(llamadas.filter((l) => l.url.includes('/repartidor/clave'))).toHaveLength(1);
  });

  it('C-REVISORES: bloquea el botón mientras se está creando y explica las cuentas existentes', async () => {
    let completar: ((r: Response) => void) | undefined;
    let creaciones = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/admin/revisores')) {
        creaciones++;
        return new Promise<Response>((resolver) => {
          completar = resolver;
        });
      }
      return new Response(JSON.stringify(RESUMEN));
    });
    render(<SuperResumen base="/panel/control-x" idioma="es" />);
    const crear = await screen.findByRole('button', { name: 'Crear las cuentas del revisor' });
    await userEvent.click(crear);
    expect(crear).toBeDisabled();
    await userEvent.click(crear);
    expect(creaciones).toBe(1);
    completar!(
      new Response(
        JSON.stringify({
          cuentas: [{ rol: 'cliente', correo: 'revisor.cliente@windoce.com', clave: null }],
        }),
      ),
    );
    expect(
      await screen.findByText('Cuenta existente: conserva su contraseña.'),
    ).toBeInTheDocument();
    expect(crear).toBeEnabled();
  });

  it('la bandeja filtra por estado y el ticket se responde y se cierra', async () => {
    const llamadas = servidor((url, init) => {
      if (url.includes('/datos/admin/tickets?'))
        return {
          tickets: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              tipo: 'franquicia',
              estado: 'abierto',
              nombre: 'Marta',
              correo: 'marta@ejemplo.com',
              asunto: 'Franquicia en Medellín',
              ciudad: 'Medellín',
              pais: 'Colombia',
              actualizado: '2026-10-12 20:00:00',
              ultimo: 'Me interesa',
            },
          ],
        };
      if (init?.method === 'POST' || init?.method === 'PATCH') return { ok: true };
      return {
        ticket: {
          id: '11111111-1111-1111-1111-111111111111',
          tipo: 'franquicia',
          estado: 'abierto',
          nombre: 'Marta',
          correo: 'marta@ejemplo.com',
          telefono: '+57 300',
          asunto: 'Franquicia en Medellín',
          ciudad: 'Medellín',
          pais: 'Colombia',
          actualizado: '',
          ultimo: '',
          datos: {},
          enlace: '/t/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
          mensajes: [{ autor: 'persona', texto: 'Me interesa', fecha: '2026-10-12 20:00:00' }],
        },
      };
    });
    const { unmount } = render(
      <SuperTickets base="/panel/control-x" idioma="es" ticketId={null} />,
    );
    expect(await screen.findByText('Franquicia en Medellín')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Cerrados' }));
    await waitFor(() => expect(llamadas.some((l) => l.url.includes('estado=cerrado'))).toBe(true));
    unmount();

    render(
      <SuperTickets
        base="/panel/control-x"
        idioma="es"
        ticketId="11111111-1111-1111-1111-111111111111"
      />,
    );
    expect(await screen.findByText('Me interesa')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'Te mando los números');
    await userEvent.click(screen.getByRole('button', { name: 'Responder' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/mensajes'))).toBe(true),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar ticket' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(true));
  });

  it('crea una franquicia en una ciudad libre y edita las motos de una existente', async () => {
    const llamadas = servidor((url, init) => {
      if (url.includes('/datos/admin/zonas'))
        return {
          zonas: [
            { id: 'US-FL-MIAMI', nombre: 'Miami' },
            { id: 'US-FL-TAMPA', nombre: 'Tampa' },
          ],
        };
      if (init?.method === 'POST' || init?.method === 'PATCH') return { franquicia: FRANQUICIA };
      return RESUMEN;
    });
    render(<SuperFranquicias usuario={usuario} idioma="es" />);
    await screen.findByText(/Miami Norte/, { selector: 'h2' });
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Ciudad (zona)' }),
      'US-FL-TAMPA',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear franquicia' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({
        zonaId: 'US-FL-TAMPA',
      }),
    );
    const motos = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
    await userEvent.clear(motos);
    await userEvent.type(motos, '40');
    motos.blur();
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toMatchObject({ motos: 40 }),
    );
  });
});

describe('panel del franquiciado', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra su ciudad, y si no es suya dice que no existe', async () => {
    servidor(() => ({
      franquicia: {
        nombre: 'Miami Norte',
        ciudad: 'Miami',
        pais: 'US',
        estado: 'activa',
        motos: 30,
      },
      rol: 'manager',
      areas: [{ id: 'a1', nombre: 'Miami Norte', estado: 'activa' }],
      pedidos: [],
      metricas: METRICAS,
      restaurantes: [{ nombre: 'Sabor', estado: 'aprobado', abierto: true, plan: 'inicial' }],
      repartidores: [{ nombre: 'Leo', conectado: true, puntos: 120 }],
      quejas: [],
    }));
    const { unmount } = render(<PanelFranquicia ruta="franchise-miami-x" idioma="es" />);
    expect(await screen.findByText('Miami Norte', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText(/No hay quejas/)).toBeInTheDocument();
    unmount();
    servidor(
      () => new Response(JSON.stringify({ error: 'Esta página no existe.' }), { status: 404 }),
    );
    render(<PanelFranquicia ruta="franchise-miami-y" idioma="es" />);
    expect(await screen.findByText('Esta página no existe.')).toBeInTheDocument();
  });
});

describe('tablero y ayuda del restaurante', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('el tablero muestra sus números, sus platos estrella y su calificación', async () => {
    const periodo = { pedidos: 3, ventas: 4500, neto: 4100, ticketPromedio: 1500 };
    servidor(() => ({
      tablero: {
        semana: periodo,
        mes: periodo,
        topPlatos: [{ nombreEs: 'Cubano', nombreEn: 'Cuban', cantidad: 5 }],
        minutosCocina: 14,
        minutosPrometidos: 15,
        calificacion: 4.6,
        calificaciones: 8,
        pedidosAhora: 2,
      },
    }));
    render(<TableroRestaurante nombre="Rosa" idioma="es" />);
    expect(await screen.findByText('Cubano')).toBeInTheDocument();
    expect(screen.getByText(/4.6 \/ 5/)).toBeInTheDocument();
  });

  it('la burbuja dice por qué no puede cobrar y, con banco, cuánto tiene', async () => {
    let conectado = false;
    servidor(() => ({ saldo: 1225, cuentaConectada: conectado, pagosActivos: conectado }));
    render(<AyudaBurbuja idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }));
    await userEvent.click(screen.getByRole('button', { name: '¿Cuándo y cómo cobro?' }));
    expect(await screen.findByText(/te falta conectar tu cuenta bancaria/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otra pregunta' }));
    conectado = true;
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Escribe tu pregunta' }),
      'cuando me pagan{Enter}',
    );
    expect(await screen.findByText(/Tu banco ya está conectado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otra pregunta' }));
    await userEvent.click(screen.getByRole('button', { name: '¿Cuánto me cobran?' }));
    expect(await screen.findByText(/Inicial 7,5 %/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otra pregunta' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Escribe tu pregunta' }),
      'xyz{Enter}',
    );
    expect(await screen.findByText(/No tengo esa respuesta a mano/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hablar con una persona' }));
    expect(screen.getByText('Cuéntanos qué pasó')).toBeInTheDocument();
  });

  it('reportar un problema abre un ticket y da el enlace de la conversación', async () => {
    const llamadas = servidor(() => ({ ok: true, enlace: '/t/abc' }));
    render(
      <ReportarPanel
        pedidoId="22222222-2222-2222-2222-222222222222"
        idioma="es"
        alCerrar={() => {}}
      />,
    );
    await userEvent.type(screen.getByRole('textbox'), 'El repartidor no llegó');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/Recibimos tu mensaje/)).toBeInTheDocument();
    expect(llamadas[0]?.cuerpo).toMatchObject({ tipo: 'queja', texto: 'El repartidor no llegó' });
  });
});

describe('territorio y equipo de una franquicia (C-TERRITORIO)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('guarda sus áreas, no deja tomar las de otra y da acceso a un manager', async () => {
    const llamadas = servidor((url, init) => {
      if (init?.method && init.method !== 'GET') return { ok: true };
      return {
        franquicia: {
          id: 'f1',
          nombre: 'Miami Norte',
          ciudad: 'Miami',
          condiciones: {
            cuotaEntradaCentavos: null,
            porcentajeIngresos: null,
            cuotaMensualCentavos: null,
            plazoMeses: null,
            exclusividadTerritorial: null,
            observaciones: '',
          },
        },
        areas: [
          { id: 'a1', nombre: 'Norte', estado: 'activa', asignada: true, deOtra: false },
          { id: 'a2', nombre: 'Sur', estado: 'activa', asignada: false, deOtra: true },
          { id: 'a3', nombre: 'Playa', estado: 'borrador', asignada: false, deOtra: false },
        ],
        miembros: [],
      };
    });
    render(<GestionFranquicia id="f1" usuario={usuario} idioma="es" />);
    const sur = await screen.findByRole('checkbox', { name: /Sur/ });
    expect(sur).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /Playa/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar territorio' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({ areaIds: ['a1', 'a3'] }),
    );
    // Las condiciones comerciales nacen pendientes, sin números inventados.
    expect(screen.getAllByPlaceholderText('Pendiente de definición comercial').length).toBe(4);
    await userEvent.type(screen.getByRole('textbox', { name: 'Correo' }), 'manager@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Dar acceso' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/miembros'))?.cuerpo,
      ).toEqual({ correo: 'manager@ejemplo.com', rol: 'manager' }),
    );
  });
});
