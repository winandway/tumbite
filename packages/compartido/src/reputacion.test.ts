import { describe, expect, it } from 'vitest';
import {
  type OfertaRep,
  type Unidad,
  UMBRALES,
  calcularReputacion,
  elegibilidad,
  nivelPorPuntaje,
  pesoUnidad,
  puntosFinalizacion,
  siguienteNivel,
  ventanaPonderada,
} from './reputacion';

// C-REWARDS-REPUTACION (30 oct 2026, Fase 2 en modo sombra): motor de reputación común.
const fecha = (i: number) =>
  `2026-10-${String(1 + Math.floor(i / 10)).padStart(2, '0')} ${String(10 + (i % 10)).padStart(2, '0')}:00:00`;
const comida = (i: number, o: Partial<Unidad> = {}): Unidad => ({
  servicio: 'comida',
  fecha: fecha(i),
  finalizacion: { ok: 1, total: 1 },
  puntualidad: { ok: 1, total: 1 },
  incidentes: { menores: 0, mayores: 0, base: 1 },
  estrellas: 5,
  ...o,
});
const ofertas = (n: number, aceptadas: number): OfertaRep[] =>
  Array.from({ length: n }, (_, i) => ({ fecha: fecha(i), aceptada: i < aceptadas }));

describe('escala de finalización (sin precipicio en 90 %)', () => {
  it('89, 90 y 91 % dan puntos distintos y continuos', () => {
    expect(puntosFinalizacion(0.85)).toBe(0);
    expect(puntosFinalizacion(0.89)).toBeCloseTo(9.6, 5);
    expect(puntosFinalizacion(0.9)).toBeCloseTo(12, 5);
    expect(puntosFinalizacion(0.91)).toBeCloseTo(14.4, 5);
    expect(puntosFinalizacion(0.95)).toBeCloseTo(24, 5);
    expect(puntosFinalizacion(1)).toBe(30);
    // Un abandono más a 90 % cuesta 2,4 puntos, no 3 de golpe ni 12 por caer a 89.
    expect(puntosFinalizacion(0.9) - puntosFinalizacion(0.89)).toBeCloseTo(2.4, 5);
  });
});

describe('ventana ponderada y Flex', () => {
  it('una ruta de 30 paquetes pesa 10; una de 600 también; una de 1 pesa 1', () => {
    expect(pesoUnidad({ servicio: 'flex', paquetes: 30 })).toBe(10);
    expect(pesoUnidad({ servicio: 'flex', paquetes: 600 })).toBe(10);
    expect(pesoUnidad({ servicio: 'flex', paquetes: 1 })).toBe(1);
    expect(pesoUnidad({ servicio: 'comida' })).toBe(1);
  });

  it('la ventana suma exactamente 100 y la última unidad entra con el peso que falta', () => {
    const us: Unidad[] = [
      ...Array.from({ length: 95 }, (_, i) => comida(200 - i)),
      { ...comida(10), servicio: 'flex', paquetes: 30 },
    ];
    const v = ventanaPonderada(us);
    expect(v.reduce((s, x) => s + x.w, 0)).toBe(100);
    expect(v.at(-1)).toMatchObject({ w: 5 });
  });

  it('una ruta mala no domina: 90 pedidos perfectos y una ruta de 30 con 10 fallas propias', () => {
    const us: Unidad[] = [
      ...Array.from({ length: 90 }, (_, i) => comida(i)),
      {
        servicio: 'flex',
        fecha: fecha(95),
        paquetes: 30,
        finalizacion: { ok: 20, total: 30 },
        puntualidad: { ok: 25, total: 30 },
        incidentes: { menores: 0, mayores: 0, base: 30 },
        estrellas: null,
      },
    ];
    const r = calcularReputacion(us, ofertas(100, 80));
    // 90·1 + 10·0,667 sobre 100 = 96,7 %: baja, pero no se hunde.
    expect(r.componentes.finalizacion.valor).toBeCloseTo(0.9667, 3);
    expect(r.porServicio).toEqual({ comida: 90, flex: 10 });
  });

  it('ruta con todo excusado (denominador cero): no cuenta en finalización ni rompe nada', () => {
    const r = calcularReputacion(
      [
        {
          servicio: 'flex',
          fecha: fecha(1),
          paquetes: 12,
          finalizacion: { ok: 0, total: 0 },
          puntualidad: null,
          incidentes: { menores: 0, mayores: 0, base: 0 },
          estrellas: null,
        },
      ],
      [],
    );
    expect(Number.isFinite(r.puntaje)).toBe(true);
    expect(r.componentes.finalizacion.peso).toBe(0);
    expect(r.componentes.finalizacion.suficiente).toBe(false);
    expect(r.provisional).toBe(true);
  });
});

describe('muestras pequeñas', () => {
  it('un nuevo con una sola mala nota no se hunde: se mezcla con la referencia', () => {
    const r = calcularReputacion([comida(1, { estrellas: 1 })], ofertas(1, 1));
    // (1·1 + 19·4,8) / 20 = 4,61
    expect(r.componentes.satisfaccion.valor).toBeCloseTo(4.61, 2);
    expect(r.componentes.satisfaccion.suficiente).toBe(false);
    expect(r.provisional).toBe(true);
    expect(elegibilidad(r).estado).toBe('sin_datos');
  });

  it('sin ofertas, la aceptación usa la referencia y no penaliza', () => {
    const r = calcularReputacion([comida(1)], []);
    expect(r.componentes.aceptacion.valor).toBe(0.65);
  });

  it('las ofertas excusadas no cuentan en la aceptación', () => {
    const lista: OfertaRep[] = [
      ...ofertas(40, 40),
      ...Array.from({ length: 30 }, (_, i) => ({
        fecha: fecha(50 + i),
        aceptada: false,
        excusada: true,
      })),
    ];
    expect(calcularReputacion([comida(1)], lista).componentes.aceptacion.valor).toBe(1);
  });
});

describe('puntaje y elegibilidad', () => {
  it('un repartidor excelente llega a Diamante; uno con 89 % de finalización no queda en riesgo de reputación cero', () => {
    const excelente = calcularReputacion(
      Array.from({ length: 100 }, (_, i) => comida(i)),
      ofertas(100, 80),
    );
    expect(excelente.puntaje).toBeGreaterThanOrEqual(UMBRALES.diamante);
    expect(excelente.nivelCalculado).toBe('diamante');
    const flojo = calcularReputacion(
      Array.from({ length: 100 }, (_, i) =>
        comida(i, { finalizacion: { ok: i < 11 ? 0 : 1, total: 1 } }),
      ),
      ofertas(100, 80),
    );
    expect(flojo.componentes.finalizacion.valor).toBe(0.89);
    expect(flojo.componentes.finalizacion.puntos).toBeCloseTo(9.6, 1);
    expect(elegibilidad(flojo)).toEqual({ estado: 'en_riesgo', motivos: ['finalizacion'] });
  });
});

describe('nivel con gracia (sube al momento, baja tras 7 días y 3 puntos de margen)', () => {
  it('sube de inmediato', () => {
    expect(siguienteNivel({ nivel: 'plata', debajoDesde: null }, 90, '2026-10-30')).toEqual({
      nivel: 'diamante',
      debajoDesde: null,
    });
  });
  it('84 siendo Diamante (umbral 85, margen 3) no empieza a contar', () => {
    expect(siguienteNivel({ nivel: 'diamante', debajoDesde: null }, 84, '2026-10-30')).toEqual({
      nivel: 'diamante',
      debajoDesde: null,
    });
  });
  it('81 empieza a contar; a los 7 días baja', () => {
    const d1 = siguienteNivel({ nivel: 'diamante', debajoDesde: null }, 81, '2026-10-01');
    expect(d1).toEqual({ nivel: 'diamante', debajoDesde: '2026-10-01' });
    expect(siguienteNivel(d1, 81, '2026-10-07')).toEqual(d1);
    expect(siguienteNivel(d1, 81, '2026-10-08')).toEqual({ nivel: 'oro', debajoDesde: null });
  });
  it('si se recupera antes de 7 días, el contador se borra', () => {
    const d1 = siguienteNivel({ nivel: 'oro', debajoDesde: null }, 70, '2026-10-01');
    expect(siguienteNivel(d1, 76, '2026-10-03')).toEqual({ nivel: 'oro', debajoDesde: null });
  });
});

// C-REWARDS-AJUSTES (30 oct 2026): umbrales cambiados desde el superadmin.
describe('umbrales ajustables', () => {
  it('con umbrales más bajos, el mismo puntaje da un nivel más alto', () => {
    expect(nivelPorPuntaje(70)).toBe('plata');
    expect(nivelPorPuntaje(70, { plata: 50, oro: 65, diamante: 80 })).toBe('oro');
    expect(siguienteNivel(null, 70, '2026-10-30', { plata: 50, oro: 65, diamante: 80 }).nivel).toBe(
      'oro',
    );
  });
});
