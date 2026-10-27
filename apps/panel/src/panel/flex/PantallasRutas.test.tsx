import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelApp } from '../PanelApp';

/** Divoox Flex · Fase 2 en el panel (C-FLEX-PANEL-RUTAS): asignar, seguir, devoluciones y pruebas exigidas. */
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

describe('Divoox Flex · Fase 2 · panel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asigna la ruta a un conductor propio con Idempotency-Key y muestra el progreso en verde', async () => {
    let estado = 'borrador';
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${E}`]: json(ficha),
      [`/datos/v1/flex/empresas/${E}/conductores`]: json({
        conductores: [{ usuarioId: 'c1', nombre: 'Carlos', vinculo: 'propio', estado: 'activo' }],
      }),
      [`/datos/v1/flex/empresas/${E}/rutas/${R}/detalle`]: () =>
        new Response(JSON.stringify(detalle(estado))),
      [`POST /datos/v1/flex/empresas/${E}/rutas/${R}/asignar`]: () => {
        estado = 'asignada';
        return new Response(JSON.stringify(detalle('asignada')));
      },
    });
    render(<PanelApp ruta={`/panel/business/${E}/operativas/${R}`} />);
    expect(await screen.findByText(/Ruta Norte/)).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow', '25');
    await userEvent.selectOptions(await screen.findByLabelText('Conductor'), 'c1');
    await userEvent.click(screen.getByRole('button', { name: 'Asignar a un conductor propio' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/asignar'))).toBe(true),
    );
    const a = llamadas.find((l) => l.url.endsWith('/asignar'))!;
    expect(a.headers['idempotency-key']).toBeTruthy();
    expect(a.cuerpo).toMatchObject({ conductorId: 'c1' });
    // Un conductor propio no se ofrece (el botón de oferta no aparece).
    expect(screen.queryByRole('button', { name: 'Ofrecer a un conductor de la red' })).toBeNull();
    expect(await screen.findByText('Asignada')).toBeInTheDocument();
  });

  it('cancelar la ruta vive dentro de los tres puntos, no a la vista', async () => {
    servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${E}`]: json(ficha),
      [`/datos/v1/flex/empresas/${E}/conductores`]: json({ conductores: [] }),
      [`/datos/v1/flex/empresas/${E}/rutas/${R}/detalle`]: json(detalle('asignada')),
    });
    render(<PanelApp ruta={`/panel/business/${E}/operativas/${R}`} />);
    expect(await screen.findByText(/Ruta Norte/)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Cancelar la ruta' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Cancelar la ruta' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Retirar la ruta del conductor' }),
    ).toBeInTheDocument();
  });

  it('devoluciones: la recepción se confirma escribiendo o escaneando el código', async () => {
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${E}`]: json(ficha),
      [`/datos/v1/flex/empresas/${E}/devoluciones`]: json({
        devoluciones: [
          {
            paqueteId: 'p9',
            codigoSeguimiento: 'DVXABCDEFGHJK',
            codigoEtiqueta: 'ABCDEFGHJKMN',
            ruta: 'Ruta Norte',
            conductor: 'Carlos',
            referenciaExterna: 'A-2',
            motivo: 'ausente',
            proximaAccion: 'reprogramar',
            entregadoAlCentro: true,
          },
        ],
      }),
      [`POST /datos/v1/flex/empresas/${E}/devoluciones/recibir`]: json({
        ok: true,
        estado: 'registrado_centro',
      }),
    });
    render(<PanelApp ruta={`/panel/business/${E}/returns`} />);
    expect(await screen.findByText('DVXABCDEFGHJK')).toBeInTheDocument();
    expect(screen.getByText('El conductor ya lo dejó en el centro')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Código del paquete/), 'dvx:ABCDEFGHJKMN');
    // El botón del formulario (el de la fila confirma esa misma devolución sin escribir nada).
    await userEvent.click(screen.getAllByRole('button', { name: 'Confirmar recepción' })[0]!);
    await waitFor(() =>
      expect(llamadas.some((l) => l.url.endsWith('/devoluciones/recibir'))).toBe(true),
    );
    expect(llamadas.find((l) => l.url.endsWith('/devoluciones/recibir'))!.cuerpo).toEqual({
      codigo: 'dvx:ABCDEFGHJKMN',
      destino: 'centro',
    });
  });

  it('las pruebas exigidas se configuran en el perfil', async () => {
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${E}`]: json(ficha),
      [`/datos/v1/flex/empresas/${E}/auditoria`]: json({ eventos: [] }),
      [`/datos/v1/flex/empresas/${E}/config-entrega`]: json({
        config: { foto: true, pin: false, firma: false, sinContacto: false, reintentoEnRuta: true },
      }),
      [`PUT /datos/v1/flex/empresas/${E}/config-entrega`]: json({ config: {} }),
    });
    render(<PanelApp ruta={`/panel/business/${E}/profile`} />);
    await userEvent.click(await screen.findByLabelText('PIN del destinatario'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Guardar' }).at(-1)!);
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'PUT')!.cuerpo).toMatchObject({
      foto: true,
      pin: true,
    });
  });
});
