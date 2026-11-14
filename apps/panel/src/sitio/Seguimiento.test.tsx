import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Seguimiento, teselasOsm } from './Seguimiento';

/** C-FLEX-SEGUIMIENTO-PLUS: la página pública de rastreo, sin datos privados. */
function servidor(seguimiento: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ seguimiento }), { status: 200 }),
  );
}

describe('C-FLEX-SEGUIMIENTO-PLUS · página pública', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('en camino: próxima parada, hora estimada y el mapa del conductor con su atribución', async () => {
    servidor({
      codigo: 'DVXABCDEFGHJK',
      estado: 'en_transito',
      final: false,
      eventos: [{ tipo: 'en_transito', creadoEn: '2026-11-13 14:00:00' }],
      llegadaEstimada: '2026-11-13T15:10:00.000Z',
      paradasAntes: 0,
      cerca: { lat: 42.48, lng: -83.476, actualizadoEn: '2026-11-13 15:00:00' },
      entrega: null,
    });
    render(<Seguimiento codigo="DVXABCDEFGHJK" idioma="es" />);
    expect(await screen.findByText('Eres la próxima parada.')).toBeInTheDocument();
    expect(screen.getByText('Llegada estimada:')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Dónde va el conductor/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toBeInTheDocument();
    expect(screen.getByText(/¿No vas a estar\?/)).toBeInTheDocument();
  });

  it('entregado: dónde quedó; la foto se ve en el enlace, no aquí', async () => {
    servidor({
      codigo: 'DVXABCDEFGHJK',
      estado: 'entregado',
      final: true,
      eventos: [{ tipo: 'entregado', creadoEn: '2026-11-13 15:12:00' }],
      llegadaEstimada: null,
      paradasAntes: null,
      cerca: null,
      entrega: { lugar: 'puerta', fotoEnEnlace: true, entregadoEn: '2026-11-13 15:12:00' },
    });
    render(<Seguimiento codigo="DVXABCDEFGHJK" idioma="en" />);
    expect(await screen.findByText('At the door')).toBeInTheDocument();
    // La foto no se muestra con solo el número de guía: se dice dónde verla.
    expect(
      screen.getByText('You can see the delivery photo in the link we sent you.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /photo/i })).toBeNull();
    expect(screen.queryByText(/Won’t be home/)).toBeNull();
  });

  it('las teselas rodean el punto: el del centro contiene la posición', () => {
    const { teselas, punto } = teselasOsm(42.48, -83.476, 15);
    expect(teselas).toHaveLength(9);
    expect(punto.x).toBeGreaterThanOrEqual(256);
    expect(punto.x).toBeLessThan(512);
    expect(punto.y).toBeGreaterThanOrEqual(256);
    expect(punto.y).toBeLessThan(512);
    expect(teselas[4]!.url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/);
  });
});
