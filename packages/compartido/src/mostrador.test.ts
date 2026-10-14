import { describe, expect, it } from 'vitest';
import { avisoLlegada, fotoSinConfirmar, lineaRepartidor } from './mostrador';

const ahora = Date.parse('2026-10-14T15:00:00Z');
const base = {
  nombre: 'Luis',
  minutosParaLlegar: null,
  llego: false,
  esperandoDesde: null,
  esperaEvitableSeg: null,
  verificado: false,
  salio: false,
};

describe('el mostrador del restaurante (C-MOSTRADOR)', () => {
  it('la foto sin confirmar pasa a amarillo a los 2 minutos, y solo mientras el pedido está listo', () => {
    const foto = { tomadaEn: '2026-10-14 14:57:00', confirmadaEn: null };
    expect(fotoSinConfirmar({ estado: 'listo', fotoRecogida: foto }, ahora)).toBe(true);
    expect(
      fotoSinConfirmar(
        { estado: 'listo', fotoRecogida: { ...foto, tomadaEn: '2026-10-14 14:59:00' } },
        ahora,
      ),
    ).toBe(false);
    expect(
      fotoSinConfirmar(
        { estado: 'listo', fotoRecogida: { ...foto, confirmadaEn: '2026-10-14 14:58:00' } },
        ahora,
      ),
    ).toBe(false);
    expect(fotoSinConfirmar({ estado: 'en_camino', fotoRecogida: foto }, ahora)).toBe(false);
  });

  it('dice en cuánto llega, que ya llegó, o cuánto lleva esperando después de la hora de listo', () => {
    expect(lineaRepartidor({ ...base, minutosParaLlegar: 4 }, 'es', ahora)).toBe(
      'Luis llega en 4 min',
    );
    expect(
      lineaRepartidor(
        { ...base, llego: true, esperandoDesde: '2026-10-14T15:03:00Z' },
        'es',
        ahora,
      ),
    ).toBe('Luis ya llegó · listo en 3 min');
    expect(
      lineaRepartidor(
        { ...base, llego: true, esperandoDesde: '2026-10-14T14:56:30Z' },
        'en',
        ahora,
      ),
    ).toBe('Luis is waiting · 3 min past your ready time');
    expect(lineaRepartidor({ ...base, salio: true }, 'es', ahora)).toBeNull();
    expect(lineaRepartidor(null, 'es', ahora)).toBeNull();
  });

  it('avisa con sonido a 5 minutos y al llegar, no antes', () => {
    expect(avisoLlegada({ ...base, minutosParaLlegar: 9 })).toBeNull();
    expect(avisoLlegada({ ...base, minutosParaLlegar: 5 })).toBe('cerca');
    expect(avisoLlegada({ ...base, llego: true })).toBe('llego');
  });
});
