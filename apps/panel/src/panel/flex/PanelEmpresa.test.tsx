import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelApp } from '../PanelApp';

/**
 * Divoox Flex · panel de empresas (C-FLEX-PANEL). El servidor se simula: aquí se prueba que la
 * pantalla manda lo correcto (Idempotency-Key en lo que crea), muestra lo que vuelve y respeta
 * los permisos que el servidor declara.
 */
const usuario = {
  id: 'u1',
  nombre: 'Dora Dueña',
  correo: 'dora@ejemplo.com',
  rol: 'cliente',
  idioma: 'es',
};
const EMPRESA = {
  id: '11111111-2222-3333-4444-555555555555',
  nombre: 'Paquetes Sur',
  razonSocial: '',
  pais: 'US',
  moneda: 'USD',
  estado: 'activa',
};
const ficha = (permisos: string[]) => ({
  empresa: EMPRESA,
  rol: 'dueno',
  permisos,
  actor: 'usuario',
  resumen: {
    centros: 1,
    miembros: 2,
    conductores: 0,
    envios: 3,
    paquetes: 5,
    entregados: 1,
    pendientes: 4,
  },
});
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
];

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

describe('Divoox Flex · panel de empresas', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
    vi.stubGlobal('crypto', { ...crypto, randomUUID: () => 'clave-fija-0000' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lista mis empresas y crea una nueva con Idempotency-Key', async () => {
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      '/datos/v1/flex/empresas': json({ empresas: [{ ...EMPRESA, rol: 'dueno' }] }),
      'POST /datos/v1/flex/empresas': json(
        {
          empresa: { ...EMPRESA, id: '22222222-2222-3333-4444-555555555555', nombre: 'Nueva' },
          rol: 'dueno',
        },
        201,
      ),
      [`/datos/v1/flex/empresas/22222222-2222-3333-4444-555555555555`]: json(ficha(TODOS)),
    });
    window.history.pushState(null, '', '/panel/business');
    render(<PanelApp ruta="/panel/business" />);
    expect(await screen.findByRole('heading', { name: 'Mis empresas' })).toBeInTheDocument();
    expect(await screen.findByText('Paquetes Sur')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre comercial'), 'Nueva');
    await userEvent.click(screen.getByRole('button', { name: 'Crear empresa' }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/datos/v1/flex/empresas')),
      ).toBe(true),
    );
    const creacion = llamadas.find(
      (l) => l.metodo === 'POST' && l.url.endsWith('/datos/v1/flex/empresas'),
    )!;
    expect(creacion.headers['idempotency-key']).toBe('clave-fija-0000');
    expect(creacion.cuerpo).toMatchObject({ nombre: 'Nueva', pais: 'US', moneda: 'USD' });
  });

  it('el inicio de la empresa muestra el resumen y el menú según los permisos del servidor', async () => {
    servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}`]: json({
        ...ficha(['empresa.ver', 'envios.ver']),
        rol: 'finanzas',
      }),
    });
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}`} />);
    expect(await screen.findByRole('heading', { name: 'Paquetes Sur' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Divoox Flex' });
    expect(within(menu).getByText('Envíos')).toBeInTheDocument();
    expect(within(menu).queryByText('Equipo')).toBeNull();
    expect(within(menu).queryByText('API')).toBeNull();
    expect(
      screen.getByText('Paquetes', { selector: '.super-tarjeta span' }).closest('li'),
    ).toHaveTextContent('5');
  });

  it('una invitación se acepta solo cuando el correo coincide y está confirmado', async () => {
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      '/datos/v1/flex/invitaciones/tok-1': json({
        invitacion: {
          empresa: 'Paquetes Sur',
          rol: 'operador',
          estado: 'pendiente',
          correoCoincide: true,
          correoConfirmado: true,
        },
      }),
      'POST /datos/v1/flex/invitaciones/tok-1/aceptar': json({
        ok: true,
        empresaId: EMPRESA.id,
        rol: 'operador',
      }),
    });
    render(<PanelApp ruta="/panel/business/invite/tok-1" />);
    expect(await screen.findByText('Paquetes Sur')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar la invitación' }));
    expect(await screen.findByText('Ya eres parte del equipo.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.url.endsWith('/invitaciones/tok-1/aceptar'))).toBe(true);
  });

  it('con el correo sin confirmar no aparece el botón de aceptar', async () => {
    servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      '/datos/v1/flex/invitaciones/tok-2': json({
        invitacion: {
          empresa: 'Paquetes Sur',
          rol: 'operador',
          estado: 'pendiente',
          correoCoincide: true,
          correoConfirmado: false,
        },
      }),
    });
    render(<PanelApp ruta="/panel/business/invite/tok-2" />);
    expect(await screen.findByText(/Confirma tu correo antes de aceptar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar la invitación' })).toBeNull();
  });

  it('la importación previsualiza los errores por fila y confirma solo si hay válidas', async () => {
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}`]: json(ficha(TODOS)),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/centros`]: json({ centros: [] }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/importaciones`]: json({ importaciones: [] }),
      [`POST /datos/v1/flex/empresas/${EMPRESA.id}/importaciones/previsualizar`]: json(
        {
          importacion: {
            id: 'imp-1',
            estado: 'previsualizada',
            total: 2,
            validas: 1,
            procesadas: 0,
            nombreArchivo: '',
          },
          errores: [{ fila: 2, error: 'direccion: Too small' }],
          vista: [
            {
              fila: 1,
              datos: {
                referenciaExterna: 'A-1',
                destinatarioNombre: 'Ana',
                direccion: 'Calle 1',
                paquetes: [{}, {}],
              },
              error: null,
            },
          ],
        },
        201,
      ),
      [`POST /datos/v1/flex/empresas/${EMPRESA.id}/importaciones/imp-1/confirmar`]: json({
        importacion: {
          id: 'imp-1',
          estado: 'terminada',
          total: 2,
          validas: 1,
          procesadas: 1,
          nombreArchivo: '',
        },
        errores: [],
        vista: [],
        creadasAhora: 1,
        quedan: 0,
      }),
    });
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}/import`} />);
    const area = await screen.findByLabelText('CSV');
    await userEvent.type(area, 'reference,recipient,address{enter}A-1,Ana,Calle 1');
    await userEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    expect(await screen.findByText(/Fila 2: direccion/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e importar las válidas' }));
    expect(await screen.findByText(/Importación terminada/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.url.endsWith('/importaciones/imp-1/confirmar'))).toBe(true);
  });

  it('la etiqueta trae el QR opaco y el código de barras, sin teléfono', async () => {
    servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}`]: json(ficha(TODOS)),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes`]: json({
        paquetes: [
          {
            id: 'p1',
            envioId: 'e1',
            codigoSeguimiento: 'DVXABCDEFGHJK',
            codigoEtiqueta: 'ABCDEFGHJKMN',
            estado: 'creado',
            descripcion: '',
            referenciaExterna: 'A-1',
            destinatarioNombre: 'Ana',
          },
        ],
        hayMas: false,
      }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes/p1/etiqueta`]: json({
        etiqueta: {
          paqueteId: 'p1',
          codigoEtiqueta: 'ABCDEFGHJKMN',
          codigoSeguimiento: 'DVXABCDEFGHJK',
          qr: 'dvx:ABCDEFGHJKMN',
          referenciaExterna: 'A-1',
          destinatarioNombre: 'Ana',
          direccion: 'Calle 1',
          instrucciones: '',
          centro: null,
          empresa: 'Paquetes Sur',
          pieza: 1,
          total: 2,
          descripcion: '',
        },
      }),
    });
    window.history.pushState(null, '', `/panel/business/${EMPRESA.id}/labels?paquete=p1`);
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}/labels`} />);
    expect(await screen.findByRole('img', { name: 'ABCDEFGHJKMN' })).toBeInTheDocument(); // código de barras
    expect(await screen.findByText('Pieza 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('3051112222');
  });
});
