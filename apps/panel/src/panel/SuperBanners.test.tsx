import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperBanners, aCasilla, deCasilla } from './SuperBanners';

/**
 * C-BANNERS en el superadmin — todos los países. Se crea en borrador con vista previa del teléfono,
 * «Tomar foto» junto a «Subir desde archivos», y nada se publica sin «Aprobar y publicar». Borrar va
 * dentro de los tres puntos y pide confirmación. Comprobado en rojo quitando el paso de
 * confirmación (borraba al primer toque) y quitando el botón de la cámara.
 */
const BANNER = {
  id: 'b1',
  lugar: 'cabecera',
  estado: 'borrador',
  imagen: '/media/fotos/banners/x.webp',
  tituloEs: 'Tu carrera, te llevamos a donde quieras',
  tituloEn: 'Your ride, anywhere you want to go',
  textoEs: '',
  textoEn: '',
  destinoTipo: 'servicio',
  destinoValor: 'moto',
  codigo: '',
  zonas: ['VE-MER-ELVIGIA'],
  paises: [],
  inicio: null,
  fin: null,
  peso: 1,
  orden: 0,
  idea: '',
  aprobadoEn: null,
};
const RESPUESTA = {
  banners: [BANNER],
  opciones: {
    zonas: [
      { id: 'VE-MER-ELVIGIA', nombre: 'El Vigía', pais: 'VE', activa: true },
      { id: 'US-MI-NOVI', nombre: 'Novi', pais: 'US', activa: true },
    ],
    servicios: ['comida', 'moto', 'mercado'],
    comercios: [],
    cupones: [],
  },
  ia: { disponible: true, hoy: 3, tope: 30 },
};

function servidor() {
  const llamadas: { metodo: string; url: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({
      metodo,
      url,
      cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    if (metodo === 'POST' && url === '/datos/admin/banners')
      return Response.json({ banner: { ...BANNER, id: 'b2' } }, { status: 201 });
    if (metodo !== 'GET') return Response.json({ banner: BANNER, ok: true });
    return Response.json(RESPUESTA);
  });
  return llamadas;
}

describe('C-BANNERS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('las fechas van y vuelven de la casilla sin correrse', () => {
    const iso = '2026-11-20T15:30:00.000Z';
    expect(deCasilla(aCasilla(iso))).toBe(iso);
    expect(deCasilla('')).toBeNull();
    expect(aCasilla(null)).toBe('');
  });

  it('lista por lugar; un borrador se aprueba solo con «Aprobar y publicar»', async () => {
    const llamadas = servidor();
    render(<SuperBanners idioma="es" />);
    const cabecera = await screen.findByRole('region', { name: 'Cabecera' });
    expect(within(cabecera).getByText('Tu carrera, te llevamos a donde quieras')).toBeTruthy();
    expect(within(cabecera).getByText('Borrador')).toBeTruthy();
    expect(within(cabecera).getByText(/El Vigía/)).toBeTruthy();
    await userEvent.click(within(cabecera).getByRole('button', { name: 'Aprobar y publicar' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.url === '/datos/admin/banners/b1/publicar')).toBe(true),
    );
  });

  it('borrar está en los tres puntos y pide confirmación antes de borrar', async () => {
    const llamadas = servidor();
    render(<SuperBanners idioma="es" />);
    const cabecera = await screen.findByRole('region', { name: 'Cabecera' });
    expect(within(cabecera).queryByRole('button', { name: 'Borrar banner' })).toBeNull();
    await userEvent.click(
      within(cabecera).getByRole('button', { name: 'Más opciones del banner' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Borrar banner' }));
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
    const aviso = screen.getByRole('alertdialog', { name: 'Borrar banner' });
    await userEvent.click(within(aviso).getByRole('button', { name: 'Sí, borrar' }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.metodo === 'DELETE' && l.url === '/datos/admin/banners/b1'),
      ).toBe(true),
    );
  });

  it('nuevo banner: cámara, vista previa del teléfono, y guardar queda en borrador', async () => {
    const llamadas = servidor();
    render(<SuperBanners idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo banner' }));
    expect(screen.getByTestId('boton-camara')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Subir desde archivos' })).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Titular en español'), 'Tu súper en minutos');
    await userEvent.type(screen.getByLabelText('Titular en inglés'), 'Groceries in minutes');
    expect(screen.getByTestId('vista-cabecera')).toHaveTextContent('Tu súper en minutos');
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByTestId('vista-cabecera')).toHaveTextContent('Groceries in minutes');
    await userEvent.click(screen.getByRole('radio', { name: 'Promociones' }));
    await userEvent.type(screen.getByLabelText(/Código que se muestra/), 'super 10');
    expect(screen.getByTestId('vista-promo')).toHaveTextContent('SUPER10');
    await userEvent.selectOptions(screen.getByLabelText('Un servicio'), 'mercado');
    await userEvent.click(screen.getByLabelText('El Vigía'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => {
      const crear = llamadas.find((l) => l.metodo === 'POST' && l.url === '/datos/admin/banners');
      expect(crear?.cuerpo).toMatchObject({
        lugar: 'promociones',
        tituloEs: 'Tu súper en minutos',
        tituloEn: 'Groceries in minutes',
        codigo: 'super10',
        destinoTipo: 'servicio',
        destinoValor: 'mercado',
        zonas: ['VE-MER-ELVIGIA'],
      });
    });
    expect(llamadas.some((l) => l.url.endsWith('/publicar'))).toBe(false);
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado como borrador');
  });

  it('lo escrito no se pierde: al volver, el formulario sale con lo que había', async () => {
    servidor();
    const { unmount } = render(<SuperBanners idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo banner' }));
    await userEvent.type(screen.getByLabelText('Titular en español'), 'Pizza a domicilio');
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(<SuperBanners idioma="es" />);
    const titular = await screen.findByLabelText('Titular en español');
    expect((titular as HTMLInputElement).value).toBe('Pizza a domicilio');
  });
});
