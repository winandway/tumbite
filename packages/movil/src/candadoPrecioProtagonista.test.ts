import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PRECIO-PROTAGONISTA (18 nov 2026, todos los países): en la tarjeta del viaje de Driver («Ve a
 * recoger», esperando, en curso y al terminar) el precio va grande y arriba: la cifra en dólares, debajo
 * los bolívares donde aplica, y aparte, en verde, lo que paga Divoox por el regalo. Con regalo dice
 * «Cobra al pasajero». En comida, lo que se cobra en mano también va grande.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-PRECIO-PROTAGONISTA: el precio grande en la tarjeta del viaje de Driver', () => {
  const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');

  it('la tarjeta del precio va antes que la dirección, con la cifra grande', () => {
    const precio = v.indexOf('testID="viaje-precio"');
    const direccion = v.indexOf('{direccion}</Text>');
    expect(precio).toBeGreaterThan(0);
    expect(precio).toBeLessThan(direccion);
    expect(v).toMatch(/testID="viaje-bs"[\s\S]{0,260}tamano="grande"/);
  });

  it('con regalo: «Cobra al pasajero» y lo de Divoox aparte, en verde', () => {
    expect(v).toMatch(/regaloDivoox > 0\s*\?\s*t\.cobraAlPasajero/);
    expect(v).toMatch(/testID="viaje-divoox-paga"[\s\S]{0,200}COLOR\.exitoSuave/);
    const textos = leer('apps/repartidor/src/viajes/textos.ts');
    expect(textos).toMatch(/cobraAlPasajero: 'Cobra al pasajero'/);
    expect(textos).toMatch(/cobraAlPasajero: 'Collect from the rider'/);
  });

  it('la cifra grande cabe en 360 de ancho y con letra grande: se achica en una línea', () => {
    const m = leer('packages/movil/src/MontoEnMano.tsx');
    expect(m).toMatch(/numberOfLines=\{1\}\s*adjustsFontSizeToFit/);
    expect(m).toMatch(/fontSize: grande \? 44/);
  });

  it('comida: lo que se cobra en mano también va grande con la pieza única', () => {
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(
      /<MontoEnMano\s+testID="cobro-directo-bs"[\s\S]{0,1400}tamano="grande"/,
    );
  });
});
