import { describe, expect, it } from 'vitest';
import {
  evaluarCapacidad,
  optimizarRuta,
  ordenRespetaReglas,
  vaAntes,
  type ParadaOptimizable,
} from './flexOptimizar';

const centro = { lat: 25.77, lng: -80.19 };
/** Paradas en línea hacia el norte (cada una ~1,1 km de la anterior), puestas en desorden. */
const enLinea = (ids: number[]): ParadaOptimizable[] =>
  ids.map((n) => ({ id: `p${n}`, lat: 25.77 + n * 0.01, lng: -80.19 }));

describe('C-FLEX-OPTIMIZAR · optimizador básico', () => {
  it('ordena por cercanía y dice cuánto se ahorra (en línea recta, estimado)', () => {
    const r = optimizarRuta(enLinea([3, 1, 4, 2, 5]), centro);
    expect(r.orden).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(r.cambia).toBe(true);
    expect(r.distanciaEstimada).toBe(true);
    expect(r.distanciaSugeridaM).toBeLessThan(r.distanciaActualM ?? 0);
    expect(r.mejoraPct).toBeGreaterThan(0);
    // Nunca inventa tiempos de manejo.
    expect(Object.keys(r)).not.toContain('duracion');
    expect(Object.keys(r).join()).not.toMatch(/minutos|tiempo|eta/i);
  });

  it('si el orden de la empresa ya es el mejor, no lo cambia', () => {
    const r = optimizarRuta(enLinea([1, 2, 3, 4]), centro);
    expect(r.cambia).toBe(false);
    expect(r.orden).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(r.mejoraPct).toBe(0);
  });

  it('2-opt deshace cruces que el vecino más cercano deja', () => {
    // Un cuadrado recorrido en cruz.
    const ps: ParadaOptimizable[] = [
      { id: 'a', lat: 0, lng: 0 },
      { id: 'c', lat: 0.01, lng: 0.01 },
      { id: 'b', lat: 0, lng: 0.01 },
      { id: 'd', lat: 0.01, lng: 0 },
    ];
    const r = optimizarRuta(ps, { lat: -0.001, lng: 0 });
    expect(r.distanciaSugeridaM).toBeLessThan(r.distanciaActualM ?? 0);
    expect(new Set(r.orden)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('respeta las ventanas: la que vence antes va primero aunque quede más lejos', () => {
    const ps: ParadaOptimizable[] = [
      ...enLinea([1, 2]),
      {
        id: 'lejos',
        lat: 25.9,
        lng: -80.19,
        ventanaDesde: '2026-10-28T09:00:00Z',
        ventanaHasta: '2026-10-28T10:00:00Z',
      },
      { id: 'p3', lat: 25.8, lng: -80.19, ventanaDesde: '2026-10-28T11:00:00Z' },
    ];
    const r = optimizarRuta(ps, centro);
    expect(r.orden.indexOf('lejos')).toBeLessThan(r.orden.indexOf('p3'));
  });

  it('las obligatorias van antes que las opcionales, salvo que una ventana diga lo contrario', () => {
    const ps: ParadaOptimizable[] = [
      ...enLinea([1, 2, 3]),
      { id: 'urgente', lat: 25.9, lng: -80.19, obligatoria: true },
    ];
    const r = optimizarRuta(ps, centro);
    expect(r.orden[0]).toBe('urgente');
    expect(ordenRespetaReglas(r.orden.map((id) => ps.find((p) => p.id === id)!))).toBe(true);

    const opcionalTemprana: ParadaOptimizable = {
      id: 'temprana',
      lat: 25.78,
      lng: -80.19,
      ventanaHasta: '2026-10-28T09:00:00Z',
    };
    const obligatoriaTarde: ParadaOptimizable = {
      id: 'tarde',
      lat: 25.9,
      lng: -80.19,
      obligatoria: true,
      ventanaDesde: '2026-10-28T12:00:00Z',
    };
    expect(vaAntes(obligatoriaTarde, opcionalTemprana)).toBe(false);
    expect(vaAntes(opcionalTemprana, obligatoriaTarde)).toBe(true);
  });

  it('las paradas sin coordenadas quedan al final y se avisan', () => {
    const ps: ParadaOptimizable[] = [{ id: 'sin', lat: null, lng: null }, ...enLinea([2, 1])];
    const r = optimizarRuta(ps, centro);
    expect(r.orden).toEqual(['p1', 'p2', 'sin']);
    expect(r.sinCoordenadas).toEqual(['sin']);
    expect(r.avisos).toContain('sin_coordenadas');
  });

  it('sin centro con coordenadas igual ordena, y avisa', () => {
    const r = optimizarRuta(enLinea([3, 1, 2]), null);
    expect(r.avisos).toContain('sin_origen');
    expect(r.orden).toHaveLength(3);
  });

  it('150 paradas en menos de un segundo, con un orden válido', () => {
    const ps: ParadaOptimizable[] = Array.from({ length: 150 }, (_, i) => ({
      id: `x${i}`,
      lat: 25.7 + ((i * 7919) % 150) / 1000,
      lng: -80.3 + ((i * 104729) % 150) / 1000,
      ventanaHasta: i % 10 === 0 ? '2026-10-28T10:00:00Z' : null,
      ventanaDesde: i % 15 === 0 ? '2026-10-28T12:00:00Z' : null, // i=0,30… quedan al revés: se ignoran
      obligatoria: i % 7 === 0,
    }));
    const t = Date.now();
    const r = optimizarRuta(ps, centro);
    // C-FLEX-OPTIMIZAR-TIEMPO (29 oct 2026): en la máquina de GitHub, con todas las pruebas a la vez,
    // tardó 1,3 s una vez (en esta computadora, unos 0,3 s). Allí se le da margen; aquí sigue en 1 s.
    expect(Date.now() - t).toBeLessThan(
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI
        ? 2500
        : 1000,
    );
    expect(new Set(r.orden).size).toBe(150);
    expect(ordenRespetaReglas(r.orden.map((id) => ps.find((p) => p.id === id)!))).toBe(true);
  });
});

describe('C-FLEX-CAPACIDAD · capacidad del vehículo', () => {
  const caja = { pesoG: 2000, largoCm: 40, anchoCm: 30, altoCm: 20 };
  it('sin capacidad declarada: desconocida, nunca «cabe»', () => {
    const r = evaluarCapacidad(null, [caja]);
    expect(r.estado).toBe('desconocida');
    expect(r.desconocidos).toContain('capacidad');
  });
  it('avisa cada exceso con su límite y su valor', () => {
    const r = evaluarCapacidad({ maxPaquetes: 2, maxPesoG: 5000, maxLadoCm: 35 }, [
      caja,
      caja,
      caja,
    ]);
    expect(r.estado).toBe('excede');
    expect(r.excesos.map((e) => e.campo).sort()).toEqual(['lado', 'paquetes', 'peso']);
    expect(r.excesos.find((e) => e.campo === 'peso')).toEqual({
      campo: 'peso',
      limite: 5000,
      valor: 6000,
    });
  });
  it('paquetes sin peso o sin medidas se marcan como desconocidos, no como cero', () => {
    const r = evaluarCapacidad({ maxPesoG: 100000, maxVolumenCm3: 10_000_000 }, [caja, {}]);
    expect(r.paquetesSinPeso).toBe(1);
    expect(r.paquetesSinMedidas).toBe(1);
    expect(r.estado).toBe('desconocida');
    expect(r.desconocidos).toEqual(expect.arrayContaining(['peso', 'medidas', 'max_paquetes']));
  });
  it('cabe con todo conocido', () => {
    const r = evaluarCapacidad(
      { maxPaquetes: 40, maxPesoG: 300000, maxVolumenCm3: 3_000_000, maxLadoCm: 120 },
      [caja, caja],
    );
    expect(r.estado).toBe('ok');
    expect(r.volumenCm3).toBe(48000);
  });
});
