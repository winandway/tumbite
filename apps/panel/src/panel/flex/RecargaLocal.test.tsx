import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelApp } from '../PanelApp';

vi.mock('../SubirFoto', async (original) => ({
  ...(await original<typeof import('../SubirFoto')>()),
  reducirFoto: async () => new Blob(['x'], { type: 'image/webp' }),
}));

/** C-FLEX-RECARGA-LOCAL en el panel (Venezuela): declarar con foto y referencia; nunca acredita. */
const E = '11111111-2222-3333-4444-555555555555';
const ficha = {
  empresa: {
    id: E,
    nombre: 'Encomiendas',
    razonSocial: '',
    pais: 'VE',
    moneda: 'USD',
    estado: 'activa',
  },
  rol: 'dueno',
  permisos: ['empresa.ver', 'finanzas.ver', 'finanzas.gestionar'],
  resumen: {},
};
const config = {
  activas: true,
  minimo: 500,
  maximo: 200000,
  metodos: ['pago_movil', 'transferencia', 'zelle', 'efectivo'],
  instrucciones: 'Pago móvil a la cuenta de Divoox indicada por soporte.',
  moneda: 'USD',
};

type Ll = { url: string; metodo: string; headers: Record<string, string>; cuerpo: unknown };
function servidor(declaradas: unknown[] = []) {
  const llamadas: Ll[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    );
    const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    llamadas.push({ url, metodo, headers, cuerpo });
    const r = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s });
    const ruta = url.split('?')[0]!;
    if (ruta.endsWith('/datos/cuentas/yo'))
      return r({
        usuario: {
          id: 'u1',
          nombre: 'Dora',
          correo: 'd@ejemplo.com',
          rol: 'cliente',
          idioma: 'es',
        },
      });
    if (ruta.endsWith('/datos/mi-franquicia')) return r({ ruta: null });
    if (ruta.endsWith(`/empresas/${E}`)) return r(ficha);
    if (ruta.endsWith('/recargas-locales/comprobante'))
      return r({ comprobanteId: '9b2f7c1e-1111-4222-8333-444455556666' }, 201);
    if (ruta.endsWith('/billetera/recargas-locales') && metodo === 'POST')
      return r({ recarga: { id: 'r1', estado: 'pendiente' } }, 201);
    if (ruta.endsWith('/billetera/recargas-locales')) return r({ config, recargas: declaradas });
    return r({}, 404);
  });
  return llamadas;
}

describe('C-FLEX-RECARGA-LOCAL · panel de la empresa', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x' }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('pide la foto (archivos o cámara), manda referencia y monto con Idempotency-Key y limpia al confirmar', async () => {
    const ll = servidor();
    const u = userEvent.setup();
    render(<PanelApp ruta={`/panel/business/${E}/wallet/local`} />);
    expect(
      await screen.findByText('Pago móvil a la cuenta de Divoox indicada por soporte.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir desde archivos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tomar foto/ })).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Monto pagado/), '50');
    await u.type(screen.getByLabelText('Número de referencia'), '00123456789');
    // Sin foto no se manda.
    await u.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    expect(await screen.findByText('Falta la foto del comprobante.')).toBeInTheDocument();
    expect(
      ll.some((x) => x.metodo === 'POST' && x.url.endsWith('/billetera/recargas-locales')),
    ).toBe(false);
    await u.upload(
      screen.getByLabelText('Subir desde archivos', { selector: 'input' }),
      new File(['x'], 'recibo.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByText('Foto lista')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    expect(await screen.findByText(/Recibimos tu recarga/)).toBeInTheDocument();
    const post = ll.find(
      (x) => x.metodo === 'POST' && x.url.endsWith('/billetera/recargas-locales'),
    )!;
    expect(post.cuerpo).toMatchObject({
      monto: 5000,
      metodo: 'pago_movil',
      referencia: '00123456789',
      comprobanteId: '9b2f7c1e-1111-4222-8333-444455556666',
    });
    expect(post.headers['idempotency-key']).toBeTruthy();
    expect(screen.getByLabelText('Número de referencia')).toHaveValue('');
  });

  it('apagado en el país: lo dice y no muestra el formulario; el historial dice el motivo del rechazo', async () => {
    servidor([
      {
        id: 'r0',
        monto: 2000,
        moneda: 'USD',
        metodo: 'zelle',
        referencia: 'ZL-1',
        estado: 'rechazada',
        motivo: 'La referencia no aparece.',
        creadoEn: '2026-11-13 10:00:00',
      },
    ]);
    config.activas = false;
    render(<PanelApp ruta={`/panel/business/${E}/wallet/local`} />);
    expect(await screen.findByText(/todavía no están activas en tu país/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar para revisión' })).toBeNull();
    expect(screen.getByText(/La referencia no aparece/)).toBeInTheDocument();
    config.activas = true;
  });
});
