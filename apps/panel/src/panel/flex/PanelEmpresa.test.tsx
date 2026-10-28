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
          pesoG: 2500,
          largoCm: 30,
          anchoCm: 20,
          altoCm: 15,
          ruta: { id: 'r1', nombre: 'R-4582', parada: 4, paradas: 12 },
        },
      }),
    });
    window.history.pushState(null, '', `/panel/business/${EMPRESA.id}/labels?paquete=p1`);
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}/labels`} />);
    expect(await screen.findByRole('img', { name: 'ABCDEFGHJKMN' })).toBeInTheDocument(); // código de barras
    expect(await screen.findByText('Paquete 1 de 2')).toBeInTheDocument();
    const en = within(document.querySelector('.flex-etiqueta') as HTMLElement);
    expect(en.getByText('Ana')).toBeInTheDocument();
    expect(en.getByText('DVXABCDEFGHJK')).toBeInTheDocument();
    expect(en.getByText('Escanear para seguimiento')).toBeInTheDocument();
    expect(en.getByText('R-4582')).toBeInTheDocument();
    expect(en.getByText('4 / 12')).toBeInTheDocument();
    expect(en.getByText('2.5 kg')).toBeInTheDocument();
    expect(en.getByText('30 x 20 x 15 cm')).toBeInTheDocument();
    expect(en.getByText('Conectando personas y oportunidades')).toBeInTheDocument();
    expect(en.getAllByRole('img', { name: 'Divoox' })).toHaveLength(2); // logo claro y franja negra
    expect(document.body.textContent).not.toContain('3051112222');
  });

  it('sin ruta, la etiqueta muestra «—» en ruta y parada; varias van a la hoja compacta', async () => {
    const base = {
      codigoEtiqueta: 'ABCDEFGHJKMN',
      qr: 'dvx:ABCDEFGHJKMN',
      referenciaExterna: null,
      direccion: '1234 NW 72nd Ave, Miami, FL 33126',
      instrucciones: '',
      centro: null,
      empresa: 'Paquetes Sur',
      pieza: 1,
      total: 1,
      descripcion: '',
      ruta: null,
    };
    servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}`]: json(ficha(TODOS)),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes`]: json({ paquetes: [], hayMas: false }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes/p1/etiqueta`]: json({
        etiqueta: {
          ...base,
          paqueteId: 'p1',
          codigoSeguimiento: 'DVX1',
          destinatarioNombre: 'Ana',
        },
      }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes/p2/etiqueta`]: json({
        etiqueta: {
          ...base,
          paqueteId: 'p2',
          codigoSeguimiento: 'DVX2',
          destinatarioNombre: 'Luis',
        },
      }),
    });
    window.history.pushState(null, '', `/panel/business/${EMPRESA.id}/labels?paquetes=p1,p2`);
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}/labels`} />);
    expect(
      await screen.findByRole('heading', { name: 'Etiquetas para impresión' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelectorAll('.flex-etiqueta-compacta')).toHaveLength(2),
    );
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.getAllByText('1234 NW 72nd Ave')).toHaveLength(2);
    expect(screen.getAllByText('Miami, FL 33126')).toHaveLength(2);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeEnabled();
  });

  it('paquetes: tabla con selección, asignar a lote y etiquetas en bloque', async () => {
    const fila = (id: string, codigo: string, estado: string, nombre: string) => ({
      id,
      envioId: `e-${id}`,
      codigoSeguimiento: codigo,
      codigoEtiqueta: `ET${id}`,
      estado,
      descripcion: '',
      referenciaExterna: `ORD-${id}`,
      destinatarioNombre: nombre,
      direccion: '8985 NW 25th St, Miami, FL 33172',
      centroId: 'c1',
    });
    const llamadas = servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}`]: json(ficha(TODOS)),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/centros`]: json({
        centros: [{ id: 'c1', nombre: 'Bodega Norte', estado: 'activo' }],
      }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes`]: json({
        paquetes: [
          fila('p1', 'DVX-7H3K-9M2L', 'creado', 'María'),
          fila('p2', 'DVX-4P8N-1Q7Z', 'en_transito', 'Carlos'),
          fila('p3', 'DVX-6M9L-1Q2W', 'entregado', 'Oficina'),
        ],
        hayMas: false,
      }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/lotes`]: json({
        lotes: [
          { id: 'l1', nombre: 'Lunes', estado: 'abierto', paquetes: 0 },
          { id: 'l2', nombre: 'Viejo', estado: 'cerrado', paquetes: 3 },
        ],
      }),
      [`POST /datos/v1/flex/empresas/${EMPRESA.id}/lotes/l1/paquetes`]: json({
        agregados: 1,
        rechazados: ['p2'],
      }),
    });
    window.history.pushState(null, '', `/panel/business/${EMPRESA.id}/packages`);
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}/packages`} />);
    expect(await screen.findByText('DVX-7H3K-9M2L')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Buscar por código, destinatario o referencia…'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Importar CSV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Crear paquete' })).toBeInTheDocument();
    // Entregado en verde; en tránsito en verde suave; nunca rojo para lo que salió bien.
    expect(screen.getByText('Entregado', { selector: '.flex-pildora' })).toHaveClass(
      'insignia-aprobado',
    );
    expect(screen.getByText('En tránsito', { selector: '.flex-pildora' })).not.toHaveClass(
      'insignia-rechazado',
    );
    expect(screen.getAllByText('8985 NW 25th St')).toHaveLength(3);
    // El menú de tres puntos de la fila no tiene nada destructivo.
    await userEvent.click(screen.getByLabelText('Acciones del paquete DVX-7H3K-9M2L'));
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual([
      'Ver detalle',
      'Ver etiqueta',
    ]);
    await userEvent.click(screen.getByLabelText('Acciones del paquete DVX-7H3K-9M2L'));
    // Filtro por centro: va al servidor.
    await userEvent.selectOptions(await screen.findByLabelText('Centro de origen'), 'c1');
    await waitFor(() => expect(llamadas.some((l) => l.url.includes('centro=c1'))).toBe(true));
    // Sin selección, las acciones en bloque están apagadas.
    expect(screen.getByRole('button', { name: 'Imprimir etiquetas' })).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Seleccionar el paquete DVX-7H3K-9M2L'));
    await userEvent.click(screen.getByLabelText('Seleccionar el paquete DVX-4P8N-1Q7Z'));
    expect(screen.getByText(/2 paquetes seleccionados/)).toBeInTheDocument();
    // Asignar a lote: solo ofrece los lotes abiertos y avisa lo que no entró.
    await userEvent.click(screen.getByRole('button', { name: 'Asignar a lote' }));
    const lote = await screen.findByLabelText('Lote abierto');
    expect(within(lote).queryByText('Viejo')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/lotes/l1/paquetes'))?.cuerpo,
      ).toEqual({ paqueteIds: ['p1', 'p2'] }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      '1 paquetes agregados al lote. 1 no se agregaron',
    );
    expect(screen.getByText(/0 paquetes seleccionados/)).toBeInTheDocument();
    // Seleccionar todo y pasar a la hoja de impresión con los tres.
    await userEvent.click(
      screen.getAllByLabelText('Seleccionar todos los paquetes de esta página')[0]!,
    );
    expect(screen.getByText(/3 paquetes seleccionados/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir etiquetas' }));
    expect(window.location.pathname).toBe(`/panel/business/${EMPRESA.id}/labels`);
    expect(window.location.search).toBe('?paquetes=p1,p2,p3');
  });

  it('descargar PDF abre la ventana de impresión una sola vez, ya con las etiquetas', async () => {
    const impresion = vi.fn();
    vi.stubGlobal('print', impresion);
    servidor({
      '/datos/cuentas/yo': json({ usuario }),
      '/datos/mi-franquicia': json({ ruta: null }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}`]: json(ficha(TODOS)),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes`]: json({ paquetes: [], hayMas: false }),
      [`/datos/v1/flex/empresas/${EMPRESA.id}/paquetes/p1/etiqueta`]: json({
        etiqueta: {
          paqueteId: 'p1',
          codigoEtiqueta: 'ABCDEFGHJKMN',
          codigoSeguimiento: 'DVX1',
          qr: 'dvx:ABCDEFGHJKMN',
          referenciaExterna: null,
          destinatarioNombre: 'Ana',
          direccion: 'Calle 1',
          instrucciones: '',
          centro: null,
          empresa: 'Paquetes Sur',
          pieza: 1,
          total: 1,
          descripcion: '',
          ruta: null,
        },
      }),
    });
    window.history.pushState(null, '', `/panel/business/${EMPRESA.id}/labels?paquetes=p1&pdf=1`);
    render(<PanelApp ruta={`/panel/business/${EMPRESA.id}/labels`} />);
    expect(await screen.findByText('Paquete 1 de 1')).toBeInTheDocument();
    await waitFor(() => expect(impresion).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Guardar como PDF/)).toBeInTheDocument();
  });
});
