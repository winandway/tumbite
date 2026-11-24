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

/**
 * C-CLIENTE-FIJO-ROTULO (24 nov 2026, primera carrera real): la oferta de un cliente fijo lo dice en
 * grande y arriba (siempre a la vista, junto a la cuenta atrás): «Cliente fijo: Marta».
 */
describe('rótulo «Cliente fijo: nombre» en la oferta', () => {
  it('con nombre, sin nombre y en los dos idiomas; nada si no es de confianza', async () => {
    const { rotuloClienteFijo } = await import('./agendaFijos');
    expect(rotuloClienteFijo({ deConfianza: true, clienteNombre: 'Marta' }, 'es')).toBe(
      'Cliente fijo: Marta',
    );
    expect(rotuloClienteFijo({ deConfianza: true, clienteNombre: 'Marta' }, 'en')).toBe(
      'Regular rider: Marta',
    );
    expect(rotuloClienteFijo({ deConfianza: true }, 'es')).toBe('Cliente fijo');
    expect(rotuloClienteFijo({ deConfianza: false, clienteNombre: 'Marta' }, 'es')).toBeNull();
  });
  it('la hoja de la oferta lo pinta grande en la parte de arriba (siempre visible)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const s = readFileSync(join(import.meta.dirname, 'OfertaViaje.tsx'), 'utf8');
    const arriba = s.slice(s.indexOf('arriba={'), s.indexOf('abajo={'));
    expect(arriba).toMatch(/testID="oferta-cliente-fijo"/);
    expect(arriba).toMatch(/\{rotulo \?/);
    expect(s).toMatch(/const rotulo = rotuloClienteFijo\(oferta,/);
  });
});
