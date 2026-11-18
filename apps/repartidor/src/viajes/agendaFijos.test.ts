import { describe, expect, it } from 'vitest';
import {
  type SalidaAgenda,
  agruparPorDia,
  puedeDecirNoPuedo,
  textoOfertaConfianza,
} from './agendaFijos';

const salida = (x: Partial<SalidaAgenda> = {}): SalidaAgenda => ({
  rutinaId: 'r1',
  fecha: '2026-11-17',
  sentido: 'ida',
  hora: '2026-11-17T11:00:00.000Z',
  zonaHoraria: 'America/Caracas',
  servicio: 'moto',
  cliente: 'Laura',
  menor: null,
  origen: 'Avenida Bolívar',
  destino: 'Calle 5',
  metodoPago: 'efectivo',
  creada: true,
  noPuedo: false,
  ...x,
});

describe('agenda de clientes fijos', () => {
  it('se agrupa por día, en orden de hora', () => {
    const g = agruparPorDia([
      salida({ fecha: '2026-11-18', hora: '2026-11-18T11:00:00.000Z' }),
      salida({ sentido: 'vuelta', hora: '2026-11-17T16:30:00.000Z' }),
      salida(),
    ]);
    expect(g.map((d) => d.fecha)).toEqual(['2026-11-17', '2026-11-18']);
    expect(g[0]?.salidas.map((s) => s.sentido)).toEqual(['ida', 'vuelta']);
  });

  it('«No puedo» solo en las de hoy y mañana que ya nacieron y no se marcaron', () => {
    const ahora = new Date('2026-11-17T10:00:00.000Z'); // 6:00 en El Vigía
    expect(puedeDecirNoPuedo(salida(), ahora)).toBe(true);
    expect(puedeDecirNoPuedo(salida({ fecha: '2026-11-18' }), ahora)).toBe(true);
    expect(puedeDecirNoPuedo(salida({ fecha: '2026-11-19' }), ahora)).toBe(false);
    expect(puedeDecirNoPuedo(salida({ creada: false }), ahora)).toBe(false);
    expect(puedeDecirNoPuedo(salida({ noPuedo: true }), ahora)).toBe(false);
    // Ya pasó la hora: no tiene sentido.
    expect(puedeDecirNoPuedo(salida(), new Date('2026-11-17T12:00:00.000Z'))).toBe(false);
  });

  it('la oferta dice confianza, viaje fijo y menor', () => {
    expect(
      textoOfertaConfianza({ deConfianza: true, viajeFijo: true, menor: 'Sofía' }, 'es'),
    ).toEqual([
      'Cliente de confianza · solo para ti',
      'Viaje fijo',
      'Recoges a un menor: Sofía. Pide su PIN',
    ]);
    expect(
      textoOfertaConfianza({ deConfianza: true, viajeFijo: false, menor: null }, 'en'),
    ).toEqual(['Trusted rider · just for you']);
    expect(textoOfertaConfianza({ menor: 'Sofía' }, 'en')).toEqual([
      'You’re picking up a minor: Sofía. Ask for their PIN',
    ]);
    expect(textoOfertaConfianza({}, 'es')).toEqual([]);
  });
});

describe('C-SUBIR-TARIFA: la oferta dice que el pasajero subió la tarifa', () => {
  it('«Tarifa subida por el pasajero» / «Fare raised by the rider»', () => {
    expect(textoOfertaConfianza({ tarifaSubida: true }, 'es')).toContain(
      'Tarifa subida por el pasajero',
    );
    expect(textoOfertaConfianza({ tarifaSubida: true }, 'en')).toContain(
      'Fare raised by the rider',
    );
    expect(textoOfertaConfianza({}, 'es')).toEqual([]);
  });
});
