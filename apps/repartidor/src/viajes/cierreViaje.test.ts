import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { viajeEnPantalla } from './cierreViaje';

/**
 * C-CIERRE-VIAJE-QUEDA (paquete 13, 19 nov 2026, emulador de Android con la Driver 0.1.45) — todos
 * los países. «Viaje terminado» (y «Envío entregado»), con el cobro en efectivo y la calificación del
 * pasajero, duraba unos tres segundos y volvía sola al inicio sin que el conductor tocara «Listo».
 * Causa: la consulta periódica del inicio (`cargar`, el sondeo) pregunta por el viaje en curso; al
 * terminar, el servidor ya contesta `null`, el inicio deja de pintar `ViajeActivo` y su pantalla de
 * cierre (estado local) se desmonta. Además, si el conductor estaba abajo (en el deslizador), el cierre
 * aparecía fuera de la vista.
 *
 * Arreglo: al entrar al cierre `ViajeActivo` avisa (`alCerrar(true)`) y el inicio guarda ese viaje en
 * memoria y lo sigue pintando hasta que el conductor toca «Listo» (`alCerrar(false)`), aunque el
 * sondeo diga que ya no hay viaje; un viaje NUEVO manda sobre el que se cierra. La pantalla sube sola
 * al principio. Vive solo en memoria: si la app se reinicia, el conductor no queda atrapado.
 *
 * Prueba vista en ROJO antes del arreglo: fallaban todas (no existía `cierreViaje.ts`).
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8');
const v = (id: string) => ({ id });

describe('C-CIERRE-VIAJE-QUEDA: el cierre se queda hasta «Listo»', () => {
  it('sin cierre, manda el viaje en curso', () => {
    expect(viajeEnPantalla(v('a'), null)).toEqual(v('a'));
    expect(viajeEnPantalla(null, null)).toBeNull();
  });

  it('el sondeo dice que ya no hay viaje: sigue el que se está cerrando', () => {
    expect(viajeEnPantalla(null, v('a'))).toEqual(v('a'));
    expect(viajeEnPantalla(v('a'), v('a'))).toEqual(v('a'));
  });

  it('llegó un viaje nuevo (aceptó otra oferta): manda el nuevo', () => {
    expect(viajeEnPantalla(v('b'), v('a'))).toEqual(v('b'));
  });

  it('el inicio lo usa, le da a cada viaje su propia pantalla y sube al principio', () => {
    const i = leer('Inicio.tsx');
    expect(i).toMatch(/viajeEnPantalla\(viajeActivo, viajeEnCierre\)/);
    expect(i).toMatch(/<ViajeActivo\s+key=\{viajeMostrado\.id\}/);
    expect(i).toMatch(/alCerrar=\{/);
    expect(i).toMatch(/scrollLienzo\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/);
  });

  it('ViajeActivo avisa al entrar al cierre y al tocar «Listo»', () => {
    const a = leer('viajes/ViajeActivo.tsx');
    expect(a).toMatch(/if \(final\) \{\s*setCierre\(final\);\s*alCerrar\?\.\(true\);/);
    expect(a).toMatch(/alCerrar\?\.\(false\);\s*alCambiar\(\);/);
  });
});
