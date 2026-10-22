import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SuperCiudades,
  SuperCliente,
  SuperClientes,
  SuperRepartidor,
  SuperRepartidores,
  SuperRestaurante,
} from './SuperFichas';
import { SuperKyc } from './SuperKyc';
import { MiEmpresa } from './MiEmpresa';
import { VerificacionPanel } from './VerificacionPanel';

function servidor(manejar: (url: string, init?: RequestInit) => unknown) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    let cuerpo: unknown;
    try {
      cuerpo = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    } catch {
      cuerpo = undefined;
    }
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    const r = manejar(url, init);
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 });
  });
  return llamadas;
}

const CIUDADES = {
  ciudades: [
    {
      id: 'US-FL-MIAMI',
      nombre: 'Miami',
      pais: 'US',
      codigo: 'MIA',
      activa: true,
      restaurantes: 3,
      repartidores: 6,
      conectados: 2,
      clientes: 9,
      pedidos30: 40,
    },
  ],
};
const REP_ID = '11111111-1111-1111-1111-111111111111';
const usuario = {
  id: 'u1',
  nombre: 'Rosa',
  correo: 'rosa@ejemplo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};

describe('superadmin: ciudades, repartidores, clientes y restaurantes', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, '', '/panel/control-x/drivers');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('las ciudades enlazan a sus repartidores, clientes y restaurantes', async () => {
    servidor(() => CIUDADES);
    render(<SuperCiudades base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('Miami')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Repartidores: 6/ })).toHaveAttribute(
      'href',
      '/panel/control-x/drivers?zona=US-FL-MIAMI',
    );
  });

  it('busca repartidores, muestra seguro vencido y carga la página siguiente', async () => {
    const fila = (n: number) => ({
      id: `${REP_ID.slice(0, -2)}${String(n).padStart(2, '0')}`,
      codigo: `US-MIA-0000${String(n).padStart(2, '0')}`,
      nombre: `Rep ${n}`,
      correo: `r${n}@ejemplo.com`,
      conectado: n === 1,
      vehiculo: 'moto',
      placa: 'ABC123',
      seguro: n === 1 ? 'vencido' : 'vigente',
      licencia: 'vigente',
      antecedentes: 'pendiente',
      entregas: n,
    });
    const llamadas = servidor((url) => {
      if (url.includes('/admin/ciudades')) return CIUDADES;
      if (url.includes('despues=')) return { repartidores: [fila(2)], siguiente: null };
      return { repartidores: [fila(1)], siguiente: 'US-MIA-000001' };
    });
    render(<SuperRepartidores base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('US-MIA-000001')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('US-MIA-000002')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'US-MIA-0000{Enter}');
    await waitFor(() => expect(llamadas.some((l) => l.url.includes('q=US-MIA-0000'))).toBe(true));
  });

  it('la ficha del repartidor muestra vehículo, licencia, seguro y deja aprobar antecedentes', async () => {
    const llamadas = servidor((_url, init) =>
      init?.method === 'PATCH'
        ? { ok: true }
        : {
            repartidor: {
              kyc: {
                usuarioId: REP_ID,
                estado: 'pendiente',
                enviadoEn: '2026-10-12 10:00:00',
                revisadoEn: null,
              },
              id: REP_ID,
              codigo: 'US-MIA-000001',
              nombre: 'Carla Veloz',
              correo: 'carla@ejemplo.com',
              telefono: '3055550000',
              fechaNacimiento: '1990-01-01',
              alta: '2026-10-01 10:00:00',
              ciudad: 'Miami',
              tipo: 'independiente',
              conectado: true,
              puntos: 50,
              ubicacion: { lat: 25.77, lng: -80.19, cuando: '2026-10-12 10:00:00' },
              datos: {
                vehiculoTipo: 'moto',
                marca: 'Honda',
                modelo: 'Navi',
                anio: 2023,
                color: 'Rojo',
                placa: 'ABC123',
                licenciaNumero: 'L000',
                licenciaEstado: 'FL',
                licenciaVence: '2030-01-01',
                seguroAseguradora: 'Aseguradora Ejemplo',
                seguroPoliza: 'P-1',
                seguroVence: '2020-01-01',
                seguroTumbite: false,
                antecedentes: 'pendiente',
                estadoLicencia: 'vigente',
                estadoSeguro: 'vencido',
              },
              entregas: 3,
              ganado: 2400,
              propinas: 600,
              saldo: 1800,
              calificacion: 4.8,
              calificaciones: 3,
              historial: [
                {
                  id: 'p1',
                  estado: 'entregado',
                  fecha: '2026-10-11 10:00:00',
                  gana: 800,
                  propina: 200,
                  km: 2.5,
                  restaurante: 'Sabor',
                },
              ],
              quejas: [
                { id: 't1', asunto: 'Llegó frío', estado: 'abierto', fecha: '2026-10-11 10:00:00' },
              ],
            },
          },
    );
    render(<SuperRepartidor base="/panel/control-x" id={REP_ID} idioma="es" />);
    expect(await screen.findByText('Carla Veloz')).toBeInTheDocument();
    expect(screen.getByText('Esperando revisión')).toBeInTheDocument();
    expect(screen.getByText('Ver las fotos y revisar').closest('a')?.getAttribute('href')).toBe(
      `/panel/control-x/verifications/${REP_ID}`,
    );
    expect(screen.getByText('Honda Navi')).toBeInTheDocument();
    expect(screen.getByText('Llegó frío')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar antecedentes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dar seguro de Divoox' }));
    await waitFor(() => expect(llamadas.filter((l) => l.metodo === 'PATCH')).toHaveLength(2));
  });

  it('busca clientes y abre su ficha con sus compras', async () => {
    servidor((url) => {
      if (url.includes('/admin/ciudades')) return CIUDADES;
      if (url.includes('/admin/clientes/'))
        return {
          cliente: {
            id: REP_ID,
            nombre: 'Diego',
            correo: 'diego@ejemplo.com',
            telefono: '',
            fechaNacimiento: null,
            alta: '2026-10-01 10:00:00',
            ciudad: 'Miami',
            pedidos: 2,
            gastado: 3000,
            compras: [
              {
                id: 'p1',
                estado: 'entregado',
                total: 1500,
                fecha: '2026-10-11 10:00:00',
                restaurante: 'Sabor',
                repartidor: 'Carla',
                repartidorCodigo: 'US-MIA-000001',
              },
            ],
            quejas: [],
          },
        };
      return {
        clientes: [
          {
            id: REP_ID,
            nombre: 'Diego',
            correo: 'diego@ejemplo.com',
            telefono: '',
            alta: '2026-10-01 10:00:00',
          },
        ],
        siguiente: null,
      };
    });
    const { unmount } = render(<SuperClientes base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('Diego')).toBeInTheDocument();
    unmount();
    render(<SuperCliente base="/panel/control-x" id={REP_ID} idioma="es" />);
    expect(await screen.findByText('$30.00')).toBeInTheDocument();
    expect(screen.getByText('US-MIA-000001')).toBeInTheDocument();
  });

  it('la ficha del restaurante muestra empresa, dueño y manager, o avisa si faltan', async () => {
    const empresa = {
      nombreLegal: 'Sabor LLC',
      tipoEmpresa: 'LLC',
      direccionFiscal: '1 Main',
      duenoNombre: 'Rosa',
      duenoTelefono: '',
      duenoCorreo: '',
      managerNombre: 'Leo',
      managerTelefono: '',
      managerCorreo: '',
      horario: '9-5',
      sitioWeb: '',
    };
    const base = {
      kyc: { usuarioId: 'dueno-1', estado: 'sin_enviar', enviadoEn: null, revisadoEn: null },
      id: REP_ID,
      nombre: 'Sabor',
      categoria: 'Cubana',
      direccion: '1 Main',
      telefono: '',
      ciudad: 'Miami',
      plan: 'inicial',
      estado: 'aprobado',
      abierto: true,
      alta: '2026-10-01 10:00:00',
      cuenta: { nombre: 'Rosa', correo: 'rosa@ejemplo.com', telefono: '' },
      platos: 5,
      platosDisponibles: 4,
      pedidos30: 3,
      ventas30: 4500,
      comision30: 300,
      calificacion: 4.5,
      calificaciones: 2,
      ultimosPedidos: [
        {
          id: 'p1',
          estado: 'entregado',
          total: 1500,
          fecha: '2026-10-11 10:00:00',
          cliente: 'Diego',
        },
      ],
      quejas: [],
    };
    servidor(() => ({ restaurante: { ...base, empresa } }));
    const { unmount } = render(
      <SuperRestaurante base="/panel/control-x" id={REP_ID} idioma="es" />,
    );
    expect(await screen.findByText('Sabor LLC')).toBeInTheDocument();
    expect(screen.getByText('Leo')).toBeInTheDocument();
    // Sin fotos enviadas no hay nada que revisar: se dice y no hay enlace.
    expect(screen.getByText('Sin enviar')).toBeInTheDocument();
    expect(screen.queryByText('Ver las fotos y revisar')).toBeNull();
    unmount();
    servidor(() => ({
      restaurante: {
        ...base,
        empresa: {
          ...empresa,
          nombreLegal: '',
          tipoEmpresa: '',
          direccionFiscal: '',
          duenoNombre: '',
          managerNombre: '',
          horario: '',
        },
      },
    }));
    render(<SuperRestaurante base="/panel/control-x" id={REP_ID} idioma="es" />);
    expect(await screen.findByText(/todavía no llenó/)).toBeInTheDocument();
  });
});

describe('verificaciones (KYC) y empresa', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('el superadmin ve la cola, abre una solicitud con sus fotos y rechaza con motivo', async () => {
    const llamadas = servidor((url, init) => {
      if (init?.method === 'PATCH') return { ok: true };
      if (url.includes('/admin/kyc?'))
        return {
          solicitudes: [
            {
              id: REP_ID,
              nombre: 'Carla',
              correo: 'carla@ejemplo.com',
              rol: 'repartidor',
              codigo: 'US-MIA-000001',
              restaurante: null,
              enviado: '2026-10-12',
              lejos: true,
            },
          ],
        };
      return {
        persona: {
          nombre: 'Carla',
          correo: 'carla@ejemplo.com',
          telefono: '',
          fecha_nacimiento: '1990-01-01',
          rol: 'repartidor',
          restaurante: null,
          direccion: null,
        },
        kyc: {
          estado: 'pendiente',
          docTipo: 'licencia',
          tiene: { doc_frente: true, doc_reverso: true, selfie: true, local: false },
          localDistanciaM: 900,
          lejos: true,
        },
      };
    });
    const { unmount } = render(<SuperKyc base="/panel/control-x" idioma="es" id={null} />);
    expect(await screen.findByText('Carla')).toBeInTheDocument();
    expect(screen.getByText(/lejos de su dirección/)).toBeInTheDocument();
    unmount();
    render(<SuperKyc base="/panel/control-x" idioma="es" id={REP_ID} />);
    expect(await screen.findByAltText('Cara')).toHaveAttribute(
      'src',
      `/datos/admin/kyc/${REP_ID}/foto/selfie`,
    );
    await userEvent.type(screen.getByRole('textbox'), 'La foto está borrosa');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toMatchObject({
        estado: 'rechazado',
        motivo: 'La foto está borrosa',
      }),
    );
  });

  it('el restaurante guarda los datos de su empresa y ve su verificación', async () => {
    const llamadas = servidor((url, init) => {
      if (url.includes('/datos/kyc'))
        return {
          kyc: {
            estado: 'rechazado',
            motivo: 'Falta el letrero',
            tiene: { doc_frente: true, doc_reverso: false, selfie: true, local: false },
            proximaRevision: null,
          },
        };
      if (init?.method === 'PUT') return { ok: true };
      return {
        empresa: {
          nombreLegal: '',
          tipoEmpresa: '',
          direccionFiscal: '',
          horario: '',
          sitioWeb: '',
          duenoNombre: '',
          duenoTelefono: '',
          duenoCorreo: '',
          managerNombre: '',
          managerTelefono: '',
          managerCorreo: '',
        },
      };
    });
    render(<MiEmpresa usuario={usuario} idioma="es" />);
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Nombre legal de la empresa' }),
      'Sabor LLC',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
        nombreLegal: 'Sabor LLC',
      }),
    );
    expect(await screen.findByText('Falta el letrero')).toBeInTheDocument();
  });

  it('enviar la verificación sin fotos muestra el error del servidor', async () => {
    servidor((url, init) => {
      if (init?.method === 'POST')
        return new Response(
          JSON.stringify({ error: 'Faltan fotos por tomar antes de enviar.', campo: 'doc_frente' }),
          { status: 422 },
        );
      return {
        kyc: {
          estado: 'sin_enviar',
          motivo: '',
          tiene: { doc_frente: false, doc_reverso: false, selfie: false, local: false },
          proximaRevision: null,
        },
      };
    });
    render(<VerificacionPanel idioma="es" />);
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'pasaporte');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    expect(await screen.findByText('Faltan fotos por tomar antes de enviar.')).toBeInTheDocument();
  });
});
