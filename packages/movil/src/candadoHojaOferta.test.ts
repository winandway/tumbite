import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-HOJA-OFERTA (paquete 13, 19 nov 2026, emulador de Android con la Driver 0.1.45) — todos los
 * países. Con la línea del regalo de Divoox la hoja de la oferta de Moto crecía hasta el borde de
 * arriba y «Nuevo viaje en Moto» quedaba encima del reloj de la barra de estado: la ventana de Android
 * se dibuja de borde a borde y la hoja no respetaba el área segura. Con letra grande del sistema o en
 * una pantalla baja, además, los botones podían quedar fuera.
 *
 * Arreglo: una sola pieza, `HojaOferta`, para la oferta de viajes (moto, carro, envíos) y la de
 * comida: respeta el área segura de arriba y de abajo (con su propio `SafeAreaProvider`, porque la
 * ventana del Modal mide aparte), y si el contenido no cabe se desplaza POR DENTRO dejando siempre a
 * la vista el título, la cuenta atrás y lo que gana (arriba) y Aceptar y Rechazar (abajo).
 *
 * Prueba vista en ROJO antes del arreglo: fallaban las tres (no existía `HojaOferta.tsx`).
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-HOJA-OFERTA: la hoja de la oferta nunca se monta sobre la barra de estado', () => {
  it('la pieza respeta el área segura y desplaza solo el medio', () => {
    const s = leer('packages/movil/src/HojaOferta.tsx');
    expect(s).toMatch(/<SafeAreaProvider/);
    expect(s).toMatch(/paddingTop: bordes\.top/);
    expect(s).toMatch(/bordes\.bottom/);
    expect(s).toMatch(/statusBarTranslucent/);
    // Orden: arriba fijo, el medio se desplaza, abajo fijo.
    const arriba = s.indexOf('>{arriba}<');
    const medio = s.indexOf('<ScrollView');
    const abajo = s.indexOf('>{abajo}<');
    expect(arriba).toBeGreaterThan(0);
    expect(medio).toBeGreaterThan(arriba);
    expect(abajo).toBeGreaterThan(medio);
    expect(s).toMatch(/flexShrink: 1/);
  });

  for (const [archivo, ganancia] of [
    ['apps/repartidor/src/viajes/OfertaViaje.tsx', 'oferta-viaje-ganancia'],
    ['apps/repartidor/src/grandes/Oferta.tsx', 'oferta-ganancia'],
  ] as const)
    it(`${archivo}: lo que gana arriba y Aceptar/Rechazar abajo, fuera del desplazamiento`, () => {
      const s = leer(archivo);
      expect(s).toMatch(/<HojaOferta/);
      expect(s).not.toMatch(/<Modal\b/);
      const arriba = s.slice(s.indexOf('arriba={'), s.indexOf('abajo={'));
      expect(arriba).toContain(`testID="${ganancia}"`);
      const abajo = s.slice(s.indexOf('abajo={'));
      expect(abajo).toMatch(/<Boton texto=\{t\.aceptar\}/);
      expect(abajo).toMatch(/accessibilityLabel=\{t\.rechazar\}/);
    });
});
