import { describe, expect, it } from 'vitest';
import { filtrarRestaurantes } from './filtrosComida';

type R = {
  nombre: string;
  categoria: string;
  abierto: boolean;
  abiertoAhora?: boolean;
  distanciaKm?: number;
  tiempoPrepMin: number;
};
const lista: R[] = [
  {
    nombre: 'Lejos y rápido',
    categoria: 'Pizza',
    abierto: true,
    abiertoAhora: true,
    distanciaKm: 5,
    tiempoPrepMin: 10,
  },
  {
    nombre: 'Cerca y lento',
    categoria: 'Sushi',
    abierto: true,
    abiertoAhora: true,
    distanciaKm: 1,
    tiempoPrepMin: 40,
  },
  {
    nombre: 'Cerrado',
    categoria: 'Pizza',
    abierto: true,
    abiertoAhora: false,
    distanciaKm: 0.5,
    tiempoPrepMin: 5,
  },
  {
    nombre: 'Sin distancia',
    categoria: 'Tacos',
    abierto: true,
    abiertoAhora: true,
    tiempoPrepMin: 20,
  },
];

/** Filtros rápidos de Comida (como los de los grandes): solo abiertos, más cerca, más rápido. */
describe('filtros rápidos de Comida', () => {
  it('sin filtros devuelve la lista tal cual', () => {
    expect(filtrarRestaurantes(lista, {}).map((r) => r.nombre)).toEqual(lista.map((r) => r.nombre));
  });
  it('«solo abiertos» deja fuera los cerrados ahora', () => {
    expect(filtrarRestaurantes(lista, { soloAbiertos: true }).map((r) => r.nombre)).toEqual([
      'Lejos y rápido',
      'Cerca y lento',
      'Sin distancia',
    ]);
  });
  it('«más cerca» ordena por distancia y los sin distancia van al final', () => {
    expect(filtrarRestaurantes(lista, { orden: 'cerca' }).map((r) => r.nombre)).toEqual([
      'Cerrado',
      'Cerca y lento',
      'Lejos y rápido',
      'Sin distancia',
    ]);
  });
  it('«más rápido» ordena por tiempo de preparación', () => {
    expect(filtrarRestaurantes(lista, { orden: 'rapido' }).map((r) => r.nombre)).toEqual([
      'Cerrado',
      'Lejos y rápido',
      'Sin distancia',
      'Cerca y lento',
    ]);
  });
  it('busca por nombre o tipo de comida, sin importar mayúsculas ni acentos', () => {
    expect(filtrarRestaurantes(lista, { busqueda: 'PIZZA' }).map((r) => r.nombre)).toEqual([
      'Lejos y rápido',
      'Cerrado',
    ]);
    expect(filtrarRestaurantes(lista, { busqueda: 'rapido' }).map((r) => r.nombre)).toEqual([
      'Lejos y rápido',
    ]);
  });
  it('categoría y filtros se combinan', () => {
    expect(
      filtrarRestaurantes(lista, { categoria: 'Pizza', soloAbiertos: true }).map((r) => r.nombre),
    ).toEqual(['Lejos y rápido']);
  });
});

describe('C-ORDENAR-COMIDA', () => {
  type C = R & { calificacion?: { promedio: number; total: number } | null };
  const base = { categoria: 'Pizza', abierto: true, abiertoAhora: true };
  const l: C[] = [
    { ...base, nombre: 'Nuevo', tiempoPrepMin: 5, calificacion: null },
    { ...base, nombre: 'Bueno', tiempoPrepMin: 25, calificacion: { promedio: 4.6, total: 40 } },
    { ...base, nombre: 'Regular', tiempoPrepMin: 10, calificacion: { promedio: 4.1, total: 90 } },
    { ...base, nombre: 'Mejor', tiempoPrepMin: 15, calificacion: { promedio: 4.9, total: 12 } },
  ];
  const nombres = (x: C[]) => x.map((r) => r.nombre);

  it('mejor calificados primero y los nuevos al final', () => {
    expect(nombres(filtrarRestaurantes([...l], { orden: 'calificados' }))).toEqual([
      'Mejor',
      'Bueno',
      'Regular',
      'Nuevo',
    ]);
  });

  it('«4,5 o más» deja solo los que tienen esa calificación pública', () => {
    expect(nombres(filtrarRestaurantes(l, { calificacionMin: 4.5 }))).toEqual(['Bueno', 'Mejor']);
  });

  it('«Menos de 30 min» usa el tiempo más largo que promete la tarjeta', () => {
    expect(nombres(filtrarRestaurantes(l, { menos30: true }))).toEqual(['Nuevo', 'Regular']);
  });
});
