import { describe, expect, it } from 'vitest';
import type { CotizacionViaje } from '@tumbite/compartido';
import {
  type ViajeHistorial,
  agruparPorMes,
  cuerpoCotizarMismaRuta,
  metodoParaRepetir,
  pedidoMismaRuta,
  proyectarRuta,
  puntosEnOrden,
  rellenoPedirViaje,
  resumenConfirmacion,
} from './mismaRuta';

/** C-MISMA-RUTA (15 nov 2026) — todos los países. «Pedir la misma ruta» y el mapita de Mis viajes. */
const VIAJE: ViajeHistorial = {
  id: 'viaje-1',
  servicio: 'carro',
  categoria: 'xl',
  estado: 'cancelado',
  origen: 'Punto de recogida',
  destino: 'Destino del viaje',
  total: 1240,
  moneda: 'USD',
  metodoPago: 'tarjeta',
  creadoEn: '2026-11-14 13:12:00',
  puntos: {
    origen: { lat: 42.48, lng: -83.47 },
    destino: { lat: 42.52, lng: -83.4 },
    paradas: [{ lat: 42.5, lng: -83.45, direccion: 'Parada intermedia' }],
  },
};

const cotizacion = (x: Partial<CotizacionViaje> = {}): CotizacionViaje => ({
  id: 'cot-nueva',
  servicio: 'carro',
  categoria: 'xl',
  zona: { id: 'US-MI-NOVI', nombre: 'Novi' },
  moneda: 'USD',
  distanciaM: 7000,
  duracionS: 900,
  desglose: { total: 1395 } as CotizacionViaje['desglose'],
  total: 1395,
  venceEn: '2026-11-15 13:20:00',
  dePrueba: true,
  metodosPago: ['efectivo', 'tarjeta'],
  ...x,
});

describe('C-MISMA-RUTA: repetir un viaje', () => {
  it('cotiza con el mismo origen, paradas en orden, destino, servicio y categoría', () => {
    expect(cuerpoCotizarMismaRuta(VIAJE)).toEqual({
      servicio: 'carro',
      categoria: 'xl',
      origen: { lat: 42.48, lng: -83.47, direccion: 'Punto de recogida' },
      paradas: [{ lat: 42.5, lng: -83.45, direccion: 'Parada intermedia' }],
      destino: { lat: 42.52, lng: -83.4, direccion: 'Destino del viaje' },
    });
    // Moto no tiene categorías; un envío o un viaje sin puntos no se repite.
    expect(cuerpoCotizarMismaRuta({ ...VIAJE, servicio: 'moto' })?.categoria).toBe('estandar');
    expect(cuerpoCotizarMismaRuta({ ...VIAJE, servicio: 'envios' })).toBeNull();
    expect(cuerpoCotizarMismaRuta({ ...VIAJE, puntos: null })).toBeNull();
  });

  it('pide con la cotización NUEVA y la misma forma de pago; nunca con el precio viejo', () => {
    const p = pedidoMismaRuta(VIAJE, cotizacion());
    expect(p).toEqual({
      cuerpo: { cotizacionId: 'cot-nueva', metodoPago: 'tarjeta' },
      cambioPago: false,
    });
    expect(JSON.stringify(p)).not.toContain('1240');
    const r = resumenConfirmacion(VIAJE, cotizacion());
    expect(r.precio).toBe(1395);
    expect(r.precioAntes).toBe(1240);
    expect(r.minutos).toBe(15);
    expect(r.paradas).toEqual(['Parada intermedia']);
    // Una cotización de otro servicio o categoría no sirve para repetir.
    expect(pedidoMismaRuta(VIAJE, cotizacion({ categoria: 'estandar' }))).toBeNull();
    expect(pedidoMismaRuta(VIAJE, cotizacion({ servicio: 'moto' }))).toBeNull();
  });

  it('si la ciudad ya no acepta esa forma de pago, usa la que acepte y lo avisa', () => {
    expect(metodoParaRepetir('tarjeta', ['pago_movil', 'efectivo'])).toEqual({
      metodo: 'pago_movil',
      cambio: true,
    });
    expect(metodoParaRepetir('efectivo', undefined)).toEqual({ metodo: 'efectivo', cambio: false });
  });

  it('«Cambiar algo» deja escritas las mismas casillas de Pedir viaje', () => {
    const r = rellenoPedirViaje(VIAJE);
    expect(r).toMatchObject({
      recogida: 'Punto de recogida',
      recogidaLat: '42.48',
      destino: 'Destino del viaje',
      destinoLng: '-83.4',
      categoria: 'xl',
      metodo: 'tarjeta',
    });
    expect(JSON.parse(r?.paradas ?? '[]')).toEqual([
      { direccion: 'Parada intermedia', lat: 42.5, lng: -83.45 },
    ]);
  });
});

describe('C-MISMA-RUTA: el mapita', () => {
  it('proyecta los puntos reales dentro del recuadro, con el norte arriba y el este a la derecha', () => {
    const [o, p, d] = proyectarRuta(puntosEnOrden(VIAJE), 320, 96, 16);
    for (const q of [o, p, d]) {
      expect(q?.x).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(q?.x).toBeLessThanOrEqual(304 + 1e-9);
      expect(q?.y).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(q?.y).toBeLessThanOrEqual(80 + 1e-9);
    }
    // El destino queda al noreste de la recogida: más a la derecha y más arriba.
    expect(d?.x ?? 0).toBeGreaterThan(o?.x ?? 0);
    expect(d?.y ?? 0).toBeLessThan(o?.y ?? 0);
    // La ruta ocupa el alto disponible (la escala la decide el eje más justo) y no se deforma.
    expect(Math.abs((o?.y ?? 0) - (d?.y ?? 0))).toBeCloseTo(64, 5);
  });

  it('un solo punto queda en el centro y sin puntos no dibuja nada', () => {
    expect(proyectarRuta([{ lat: 1, lng: 1 }], 100, 50)).toEqual([{ x: 50, y: 25 }]);
    expect(proyectarRuta([], 100, 50)).toEqual([]);
  });
});

describe('C-MISMA-RUTA: agrupado por mes', () => {
  it('junta los viajes por mes y dice el año solo si no es el actual', () => {
    const g = agruparPorMes(
      [
        { creadoEn: '2026-11-14 15:00:00' },
        { creadoEn: '2026-11-02 15:00:00' },
        { creadoEn: '2025-12-20 15:00:00' },
      ],
      'es',
      new Date('2026-11-15T12:00:00Z'),
    );
    expect(g.map((x) => [x.titulo, x.viajes.length])).toEqual([
      ['Noviembre', 2],
      ['Diciembre 2025', 1],
    ]);
  });
});
