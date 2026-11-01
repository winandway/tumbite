import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, llamar } from '../pruebas/flex';

/**
 * C-FLEX-ENCUENTRO (31 oct 2026, LG2, pedido de Richard): un envío se puede entregar en un punto de
 * encuentro de la vía («Estación Doña María»), con su nombre y su lugar en el mapa.
 */
describe('entrega en un punto de encuentro', () => {
  const base = {
    destinatarioNombre: 'Julio Montes',
    destinatarioTelefono: '+584140000000',
    direccion: 'Autopista Regional del Centro, km 12',
    paquetes: [{ descripcion: 'Caja' }],
  };
  it('guarda el nombre del punto y el envío lo devuelve', async () => {
    const m = mundo();
    const e = await empresa(m);
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios`,
      {
        ...base,
        centroId: e.centroId,
        entrega: 'encuentro',
        puntoEncuentro: 'Estación Doña María',
        lat: 25.8,
        lng: -80.2,
      },
      e.dueno.token,
    );
    expect(r.estado).toBe(201);
    expect(r.datos.envio.entrega).toBe('encuentro');
    expect(r.datos.envio.puntoEncuentro).toBe('Estación Doña María');
  });
  it('sin el nombre o sin el punto en el mapa no se acepta', async () => {
    const m = mundo();
    const e = await empresa(m);
    const sinNombre = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios`,
      { ...base, centroId: e.centroId, entrega: 'encuentro', lat: 25.8, lng: -80.2 },
      e.dueno.token,
    );
    expect(sinNombre.datos.campo).toBe('puntoEncuentro');
    const sinMapa = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios`,
      { ...base, centroId: e.centroId, entrega: 'encuentro', puntoEncuentro: 'Peaje' },
      e.dueno.token,
    );
    expect(sinMapa.datos.campo).toBe('lat');
  });
});
