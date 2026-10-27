import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelApp } from '../PanelApp';

/** Divoox Flex · Fase 3 en el panel (C-FLEX-PANEL-FASE3): operación, integraciones, capacidad y orden sugerido. */
const usuario = {
  id: 'u1',
  nombre: 'Dora Dueña',
  correo: 'dora@ejemplo.com',
  rol: 'cliente',
  idioma: 'es',
};
const E = '11111111-2222-3333-4444-555555555555';
const R = '22222222-2222-3333-4444-555555555555';
const TODOS = [
  'empresa.ver',
  'empresa.editar',
  'miembros.gestionar',
  'claves.gestionar',
  'centros.gestionar',
  'conductores.gestionar',
  'envios.crear',
  'envios.ver',
  'paquetes.eventos',
  'importar',
  'lotes.gestionar',
  'finanzas.ver',
  'devoluciones.recibir',
  'integraciones.gestionar',
];
const ficha = {
  empresa: {
    id: E,
    nombre: 'Paquetes Sur',
    razonSocial: '',
    pais: 'US',
    moneda: 'USD',
    estado: 'activa',
  },
  rol: 'dueno',
  permisos: TODOS,
  resumen: {},
};
const detalle = (estado: string) => ({
  ruta: {
    id: R,
    nombre: 'Ruta Norte',
    estado,
    modalidad: null,
    ofertaVenceEn: null,
    ofertaVencida: false,
    bloqueDesde: null,
    bloqueHasta: null,
    iniciadaEn: null,
    cerradaEn: null,
    conductor: estado === 'borrador' ? null : { id: 'c1', nombre: 'Carlos' },
    ubicacion: null,
    resumen: null,
    progreso: {
      total: 4,
      cargados: 0,
      entregados: 1,
      fallidos: 0,
      enDevolucion: 0,
      devueltos: 0,
      paradas: 2,
      paradasResueltas: 1,
      excluidos: 0,
    },
    paradas: [
      {
        id: 'p1',
        orden: 1,
        estado: 'entregada',
        envioId: 'e1',
        direccion: '100 Main St',
        referenciaExterna: 'A-1',
        destinatarioNombre: 'Ana',
        sinCoordenadas: false,
        paquetes: [],
      },
      {
        id: 'p2',
        orden: 2,
        estado: 'pendiente',
        envioId: 'e2',
        direccion: '200 Main St',
        referenciaExterna: 'A-2',
        destinatarioNombre: 'Luis',
        sinCoordenadas: false,
        paquetes: [],
      },
    ],
  },
  incidencias: [],
  pruebas: [],
});
type Llamada = { url: string; metodo: string; headers: Record<string, string>; cuerpo: unknown };
function servidor(respuestas: Record<string, (ll: Llamada) => Response>) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const ll: Llamada = {
      url,
      metodo: init?.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      ),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    llamadas.push(ll);
    const r = Object.entries(respuestas).find(([clave]) => {
      const [m, ruta] = clave.includes(' ') ? clave.split(' ') : ['GET', clave];
      return ll.metodo === m && url.split('?')[0]!.endsWith(ruta!);
    });
    return r ? r[1](ll) : new Response('{}', { status: 404 });
  });
  return llamadas;
}
const json =
  (d: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(d), { status });

const base = (extra: Record<string, (ll: Llamada) => Response>) => ({
  '/datos/cuentas/yo': json({ usuario }),
  '/datos/mi-franquicia': json({ ruta: null }),
  [`/datos/v1/flex/empresas/${E}`]: json(ficha),
  ...extra,
});

describe('Divoox Flex · Fase 3 · panel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('operación: muestra los indicadores y «Sin dato» cuando no hay ventanas, sin dinero', async () => {
    servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/operaciones`]: json({
          periodo: { desde: '2026-10-21', hasta: '2026-10-27', centroId: null },
          rutas: { completada: 2 },
          ahora: { enCurso: 1, ofertasAbiertas: 2, porSalir: 3 },
          paquetes: { total: 40, entregados: 36, fallidos: 3, devueltos: 1 },
          tasas: {
            entregaPct: 90,
            primerIntentoPct: 94.4,
            aTiempoPct: null,
            entregasConVentana: 0,
          },
          incidenciasPorMotivo: [{ motivo: 'ausente', cantidad: 3 }],
          rutasCerradas: { cantidad: 2, duracionMediaMin: 185, paradasPorRuta: 20, conductores: 2 },
          integraciones: { pendientes: 0, fallidas: 0 },
        }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/operations`} />);
    expect(await screen.findByText('90 %')).toBeInTheDocument();
    expect(screen.getByText('94,4 %')).toBeInTheDocument();
    expect(screen.getByText('Sin dato')).toBeInTheDocument();
    expect(screen.getByText('185 min')).toBeInTheDocument();
    expect(screen.getByText(/Ninguna entrega del periodo tenía ventana/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\$|USD|precio|comisión/i);
  });

  it('integraciones: el secreto se ve una sola vez; desactivar vive dentro de los tres puntos', async () => {
    let lista: unknown[] = [];
    const llamadas = servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/integraciones`]: () =>
          new Response(
            JSON.stringify({
              integraciones: lista,
              eventosDisponibles: ['package.delivered', 'route.started'],
              activadas: true,
            }),
          ),
        [`POST /datos/v1/flex/empresas/${E}/integraciones`]: () => {
          lista = [
            {
              id: 'w1',
              url: 'https://erp.cliente-ejemplo.com/divoox',
              eventos: ['*'],
              descripcion: 'ERP',
              secretoPrefijo: 'whsec_dvx_abcd',
              estado: 'activo',
              fallosSeguidos: 0,
              ultimoExitoEn: null,
              motivo: '',
              cola: { pendientes: 0, entregados: 0, fallidos: 0 },
            },
          ];
          return new Response(
            JSON.stringify({ integracion: lista[0], secreto: 'whsec_dvx_abcdSECRETO' }),
            { status: 201 },
          );
        },
        [`POST /datos/v1/flex/empresas/${E}/integraciones/w1/probar`]: json({
          ok: true,
          http: 200,
          error: '',
        }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/integrations`} />);
    expect(await screen.findByText('Todavía no tienes integraciones.')).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText('Dirección HTTPS de tu sistema'),
      'https://erp.cliente-ejemplo.com/divoox',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear integración' }));
    expect(await screen.findByText('whsec_dvx_abcdSECRETO')).toBeInTheDocument();
    const alta = llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/integraciones'))!;
    expect(alta.cuerpo).toMatchObject({
      url: 'https://erp.cliente-ejemplo.com/divoox',
      eventos: ['*'],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Ya lo guardé' }));
    expect(screen.queryByText('whsec_dvx_abcdSECRETO')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Desactivar' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar prueba' }));
    expect(await screen.findByText(/Tu sistema respondió bien/)).toBeInTheDocument();
  });

  it('al asignar avisa que la ruta no cabe y solo manda la confirmación si la empresa la marca', async () => {
    const llamadas = servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/conductores`]: json({
          conductores: [{ usuarioId: 'c1', nombre: 'Carlos', vinculo: 'propio', estado: 'activo' }],
        }),
        [`/datos/v1/flex/empresas/${E}/vehiculos`]: json({
          vehiculos: [
            {
              id: 'v1',
              tipo: 'carro',
              descripcion: 'Sedán',
              placa: 'FLX123',
              conductorId: 'c1',
              conductor: 'Carlos',
              capacidad: {
                maxPaquetes: 2,
                maxPesoKg: null,
                maxVolumenLitros: null,
                maxLadoCm: null,
              },
            },
          ],
        }),
        [`/datos/v1/flex/empresas/${E}/rutas/${R}/capacidad`]: json({
          capacidad: {
            estado: 'excede',
            paquetes: 4,
            excesos: [{ campo: 'paquetes', limite: 2, valor: 4 }],
            desconocidos: [],
          },
        }),
        [`/datos/v1/flex/empresas/${E}/rutas/${R}/detalle`]: json(detalle('borrador')),
        [`POST /datos/v1/flex/empresas/${E}/rutas/${R}/asignar`]: json(detalle('asignada')),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/operativas/${R}`} />);
    await userEvent.selectOptions(await screen.findByLabelText('Conductor'), 'c1');
    await userEvent.selectOptions(await screen.findByLabelText('Vehículo'), 'v1');
    expect(
      await screen.findByText(/La ruta no cabe en este vehículo: paquetes 4 de 2/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Lo sé, asignar igual'));
    await userEvent.click(screen.getByRole('button', { name: 'Asignar a un conductor propio' }));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith('/asignar'))).toBe(true));
    expect(llamadas.find((l) => l.url.endsWith('/asignar'))!.cuerpo).toMatchObject({
      conductorId: 'c1',
      vehiculoId: 'v1',
      confirmarCapacidad: true,
    });
  });

  it('sugiere el orden sin cambiar nada y lo aplica solo al tocar «Aplicar»', async () => {
    const llamadas = servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/conductores`]: json({ conductores: [] }),
        [`/datos/v1/flex/empresas/${E}/rutas/${R}/detalle`]: json(detalle('asignada')),
        [`POST /datos/v1/flex/empresas/${E}/rutas/${R}/optimizar`]: json({
          sugerencia: {
            orden: ['p2', 'p1'],
            distanciaActualM: 5400,
            distanciaSugeridaM: 3100,
            mejoraPct: 42.6,
            cambia: true,
            avisos: [],
          },
          aplicable: true,
        }),
        [`PUT /datos/v1/flex/empresas/${E}/rutas/${R}/orden`]: json({ ok: true }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/operativas/${R}`} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sugerir orden' }));
    expect(await screen.findByText(/5,4 km aprox.*3,1 km aprox.*42,6 %/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar este orden' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'PUT')!.cuerpo).toEqual({ paradaIds: ['p2', 'p1'] });
  });

  it('capacidad del vehículo: se guarda en kilos y litros; lo vacío queda «sin dato»', async () => {
    const llamadas = servidor(
      base({
        [`/datos/v1/flex/empresas/${E}/vehiculos`]: json({
          vehiculos: [
            {
              id: 'v1',
              tipo: 'carro',
              descripcion: 'Sedán',
              placa: 'FLX123',
              conductorId: 'c1',
              conductor: 'Carlos',
              capacidad: null,
            },
          ],
        }),
        [`PUT /datos/v1/flex/empresas/${E}/vehiculos/v1/capacidad`]: json({ ok: true }),
      }),
    );
    render(<PanelApp ruta={`/panel/business/${E}/vehicles`} />);
    expect(await screen.findByText('Sin capacidad declarada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar capacidad' }));
    await userEvent.type(screen.getByLabelText('Máximo de paquetes'), '40');
    await userEvent.type(screen.getByLabelText('Peso máximo (kg)'), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'PUT')!.cuerpo).toEqual({
      maxPaquetes: 40,
      maxPesoKg: 300,
      maxVolumenLitros: null,
      maxLadoCm: null,
    });
  });
});
