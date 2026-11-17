import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textoFijarEnMapa } from './puntoExacto';

// C-FIJAR-EN-MAPA (17 nov 2026) — todos los países. En Moto, Carro y Envíos salían dos tarjetas
// iguales, «Marcar mi puerta en el mapa», una para la recogida y otra para el destino: parecía un
// botón repetido y «mi puerta» no sirve para un destino. Como Uber y DiDi, la opción de fijar en el
// mapa vive DENTRO de cada casilla de dirección, con su propio texto.
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

describe('C-FIJAR-EN-MAPA', () => {
  it('cada casilla dice lo suyo, en los dos idiomas', () => {
    expect(textoFijarEnMapa('es', 'recogida', false)).toBe('Fijar recogida en el mapa');
    expect(textoFijarEnMapa('es', 'destino', false)).toBe('Fijar destino en el mapa');
    expect(textoFijarEnMapa('en', 'recogida', false)).toBe('Set pickup on map');
    expect(textoFijarEnMapa('en', 'destino', false)).toBe('Set destination on map');
    expect(textoFijarEnMapa('es', 'recogida', true)).toBe('Recogida fijada en el mapa');
    expect(textoFijarEnMapa('en', 'destino', true)).toBe('Destination set on map');
    // Nunca dos casillas con el mismo texto, y nunca «puerta» en un destino.
    for (const idioma of ['es', 'en'] as const) {
      const todos = (['recogida', 'destino', 'entrega', 'casa'] as const).flatMap((p) => [
        textoFijarEnMapa(idioma, p, false),
        textoFijarEnMapa(idioma, p, true),
      ]);
      expect(new Set(todos).size).toBe(todos.length);
    }
    expect(textoFijarEnMapa('es', 'destino', false)).not.toMatch(/puerta/i);
    expect(textoFijarEnMapa('en', 'destino', false)).not.toMatch(/door/i);
  });

  it('la casilla de dirección trae su propia fila «Fijar en el mapa»', () => {
    const s = leer('packages/movil/src/CampoDireccion.tsx');
    expect(s).toMatch(/enMapa\?:/);
    expect(s).toMatch(/testID=\{enMapa\.testID/);
    // Contraste AA (el recorrido de accesibilidad lo exige): el texto nunca en el rojo vivo.
    expect(s).toMatch(/enMapa\.marcado \? C\.exito : C\.acento/);
  });

  it('Moto, Carro y Envíos: sin tarjetas gemelas, una fila por casilla', () => {
    const s = leer('apps/cliente/src/viajes/PedirMoto.tsx');
    expect(s).not.toMatch(/<ResumenPunto\b/);
    expect(s).toMatch(/textoFijarEnMapa\(idioma, 'recogida'/);
    expect(s).toMatch(/textoFijarEnMapa\(idioma, 'destino'/);
    expect((s.match(/enMapa=\{/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('comida (carrito) y la casa de «Mis paquetes» también fijan desde su casilla', () => {
    const c = leer('apps/cliente/src/app/cart.tsx');
    expect(c).not.toMatch(/<ResumenPunto\b/);
    expect(c).toMatch(/textoFijarEnMapa\(idioma, 'entrega'/);
    const p = leer('apps/cliente/src/app/packages.tsx');
    expect(p).toMatch(/textoFijarEnMapa\(idioma, 'casa'/);
    // Solo queda la tarjeta de cada paquete (una por paquete, sin casilla al lado).
    expect((p.match(/<ResumenPunto\b/g) ?? []).length).toBe(1);
  });
});

// C-FILA-SIN-MODO-OSCURO (17 nov 2026): en la pantalla de Moto y Carro, «Viajes fijos» y «Conductores
// de confianza» salían con el título invisible (letra negra de FilaLista sobre la tarjeta negra del
// modo oscuro). La pantalla es siempre clara: la tarjeta va con el blanco fijo.
describe('C-FILA-SIN-MODO-OSCURO', () => {
  it('la tarjeta de accesos de la pantalla del servicio no usa el fondo del modo oscuro', () => {
    const s = leer('apps/cliente/src/app/ride.tsx');
    expect(s).not.toMatch(/useColores\(\)/);
    expect(s).toMatch(/backgroundColor: COLOR\.fondo/);
  });
});
