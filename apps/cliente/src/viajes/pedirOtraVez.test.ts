import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rellenoDeEsteViaje } from './mismaRuta';

/**
 * C-PEDIR-OTRA-VEZ (18 nov 2026, robot de Android): «Pedir otra vez» abría el formulario con el
 * destino o la recogida vacíos; trae los dos (y las paradas, la categoría y la forma de pago).
 * «Empezar de nuevo» sí vacía, y la recogida se llena AL INSTANTE con la última ubicación conocida
 * (antes tardaba unos 5 s esperando una lectura nueva del GPS).
 */
const viaje = {
  servicio: 'carro',
  categoria: 'comfort',
  metodoPago: 'efectivo',
  origen: { direccion: 'Calle 9-a, El Vigía', lat: 8.61, lng: -71.65 },
  destino: { direccion: 'Terminal de Pasajeros, El Vigía', lat: 8.62, lng: -71.64 },
  paradas: [
    { orden: 1, lat: 8.615, lng: -71.645, direccion: 'Farmacia', estado: 'pendiente' as const },
  ],
};

describe('pedir otra vez', () => {
  it('trae la recogida, el destino, las paradas, la categoría y la forma de pago', () => {
    expect(rellenoDeEsteViaje(viaje)).toEqual({
      recogida: 'Calle 9-a, El Vigía',
      recogidaLat: '8.61',
      recogidaLng: '-71.65',
      destino: 'Terminal de Pasajeros, El Vigía',
      destinoLat: '8.62',
      destinoLng: '-71.64',
      paradas: JSON.stringify([{ direccion: 'Farmacia', lat: 8.615, lng: -71.645 }]),
      categoria: 'comfort',
      metodo: 'efectivo',
      cuando: '',
    });
  });
  it('sin puntos (un viaje viejo sin coordenadas) no inventa nada', () => {
    expect(
      rellenoDeEsteViaje({ ...viaje, origen: { ...viaje.origen, lat: Number.NaN } }),
    ).toBeNull();
  });
  it('la pantalla del viaje lo deja escrito antes de volver al formulario', () => {
    const s = readFileSync(join(__dirname, '..', 'app', 'ride.tsx'), 'utf8');
    expect(s).toContain('rellenoDeEsteViaje(');
    expect(s).toContain('marcarRelleno(');
  });
  it('la recogida se llena al instante con la última ubicación conocida', () => {
    const s = readFileSync(join(__dirname, 'PedirMoto.tsx'), 'utf8');
    expect(s).toContain('ultimaUbicacionConocida()');
  });
});
