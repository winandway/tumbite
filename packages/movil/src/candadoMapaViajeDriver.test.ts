import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MAPA-VIAJE-DRIVER (18 nov 2026, todos los países): como las apps de conductores, la oferta y la
 * pantalla del viaje de Driver (moto, carro y envíos; comida ya lo tenía) llevan el mapa con la
 * recogida, el destino y el conductor, con la pieza única de mapa. El precio va primero y la
 * navegación externa se mantiene.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-MAPA-VIAJE-DRIVER: mapa en la oferta y en el viaje', () => {
  it('el viaje: mapa con recogida, destino y conductor, debajo del precio, y sigue «Abrir navegación»', () => {
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    expect(v).toMatch(/import \{ Mapa \} from '\.\.\/piezas\/Mapa'/);
    const precio = v.indexOf('testID="viaje-precio"');
    const mapa = v.indexOf('testID="viaje-mapa"');
    expect(mapa).toBeGreaterThan(precio);
    expect(v).toMatch(/<Mapa\s+yo=\{yo\}\s+restaurante=\{\{ lat: viaje\.origen_lat/);
    expect(v).toMatch(/casa=\{\{ lat: viaje\.destino_lat/);
    expect(v).toMatch(/texto=\{t\.navegar\}/);
  });

  it('la oferta: mapa pequeño con la recogida y el destino', () => {
    const o = leer('apps/repartidor/src/viajes/OfertaViaje.tsx');
    expect(o).toMatch(/testID="oferta-viaje-mapa"[\s\S]{0,200}<Mapa/);
    expect(o).toMatch(/restaurante=\{oferta\.origenPunto\}/);
  });

  it('el inicio le pasa la ubicación del conductor a los dos', () => {
    const i = leer('apps/repartidor/src/Inicio.tsx');
    // C-CIERRE-VIAJE-QUEDA: el inicio pinta `viajeMostrado` (el viaje en curso o el que se cierra).
    expect(i).toMatch(/viaje=\{viajeMostrado\}[\s\S]{0,80}yo=\{aqui\}/);
    expect(i).toMatch(/oferta=\{ofertaViaje\}[\s\S]{0,60}yo=\{aqui\}/);
  });

  it('C-MAPA-PRECIO-PEDIR: el precio antes de pedir lleva un mapa pequeño con la ruta (en la web, al tocarlo)', () => {
    const p = leer('apps/cliente/src/viajes/PedirMoto.tsx');
    expect(p).toMatch(/testID="moto-precio-mapa"[\s\S]{0,400}alto=\{160\}\s+bajoDemanda/);
    expect(p.indexOf('testID="moto-precio-mapa"')).toBeLessThan(p.indexOf('testID="moto-precio"'));
  });
});
