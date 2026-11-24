import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-AVISOS-VIAJE (24 nov 2026) — todos los países. Tocar un aviso de viaje (tu conductor aceptó,
 * llegó, empezó, terminó, canceló) abre ESE viaje, desde la bandeja del teléfono y desde la campana.
 * Antes solo se atendían el pedido de comida y el paquete de Flex: el de viaje abría la app y nada más.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, r), 'utf8');

describe('C-AVISOS-VIAJE · tocar el aviso abre el viaje', () => {
  it('AbrirAvisos lleva un aviso con viajeId a la pantalla del viaje', () => {
    const s = leer('AbrirAvisos.tsx');
    expect(s).toMatch(/datos\.viajeId/);
    expect(s).toMatch(/rutaDelViaje\(/);
  });

  it('la pantalla del viaje abre el viaje que le pasan (y solo ids con forma de id)', () => {
    const s = leer('app/ride.tsx');
    expect(s).toMatch(/viaje\?: string/);
    expect(s).toMatch(/ID_VIAJE\.test/);
  });

  it('en la campana, el aviso guardado de un viaje se toca y lleva su punto si es nuevo', () => {
    const s = leer('app/notifications.tsx');
    expect(s).toMatch(/rutaDelViaje\(a\.datos\)/);
    expect(s).toMatch(/punto=\{a\.leido === false\}/);
  });
});
