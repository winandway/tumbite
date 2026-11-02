import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ETIQUETAS_CALIFICACION,
  etiquetasValidas,
  resumenEtiquetas,
  textoEtiqueta,
  tipoEtiquetas,
} from './etiquetasCalificacion';

/**
 * C-ELOGIOS-MOTIVOS (BRE-3, 2 nov 2026): con 5 estrellas se eligen elogios ya escritos (Uber Eats
 * «compliments»); con 3 o menos, «¿Qué salió mal?» con motivos (DoorDash y Uber Eats). Con 4, nada.
 */
describe('elogios y motivos al calificar (C-ELOGIOS-MOTIVOS)', () => {
  it('5 estrellas abre elogios, 3 o menos abre motivos y 4 no abre nada', () => {
    expect(tipoEtiquetas(5)).toBe('elogios');
    expect(tipoEtiquetas(4)).toBeNull();
    expect(tipoEtiquetas(3)).toBe('motivos');
    expect(tipoEtiquetas(1)).toBe('motivos');
    expect(tipoEtiquetas(0)).toBeNull();
  });

  it('los elogios del repartidor y del restaurante son los del estándar', () => {
    expect(Object.keys(ETIQUETAS_CALIFICACION.repartidor.elogios)).toEqual(
      expect.arrayContaining(['amable', 'rapido', 'cuido_comida', 'instrucciones']),
    );
    expect(Object.keys(ETIQUETAS_CALIFICACION.restaurante.elogios)).toEqual(
      expect.arrayContaining(['bien_empacado', 'porciones']),
    );
    expect(textoEtiqueta('repartidor', 'cuido_comida', 'es')).toBe('Cuidó la comida');
    expect(textoEtiqueta('repartidor', 'cuido_comida', 'en')).toBe('Handled the food with care');
    expect(textoEtiqueta('restaurante', 'fria', 'en')).toBe('Arrived cold');
    expect(textoEtiqueta('restaurante', 'inventada', 'es')).toBe('');
  });

  it('solo valen las etiquetas del tipo que tocan las estrellas, sin repetir', () => {
    expect(etiquetasValidas('repartidor', 5, ['amable', 'tarde', 'amable', 'x'])).toEqual([
      { tipo: 'elogio', etiqueta: 'amable' },
    ]);
    expect(etiquetasValidas('restaurante', 2, ['fria', 'bien_empacado'])).toEqual([
      { tipo: 'motivo', etiqueta: 'fria' },
    ]);
    expect(etiquetasValidas('restaurante', 4, ['fria', 'bien_empacado'])).toEqual([]);
    expect(etiquetasValidas('repartidor', null, ['amable'])).toEqual([]);
  });

  it('el resumen pone primero las más elegidas y descarta códigos viejos', () => {
    expect(
      resumenEtiquetas('repartidor', 'elogios', [
        { etiqueta: 'rapido', n: 2 },
        { etiqueta: 'amable', n: 7 },
        { etiqueta: 'ya_no_existe', n: 9 },
      ]),
    ).toEqual([
      { etiqueta: 'amable', n: 7, es: 'Amable', en: 'Friendly' },
      { etiqueta: 'rapido', n: 2, es: 'Rápido', en: 'Fast' },
    ]);
  });
});

const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('C-ELOGIOS-MOTIVOS en las apps y el panel', () => {
  it('el cliente elige etiquetas, el repartidor ve sus elogios y el restaurante sus motivos', () => {
    const cliente = leer('apps', 'cliente', 'src', 'app', 'order', '[id].tsx');
    expect(cliente).toContain('<Etiquetas');
    expect(cliente).toContain('etiquetasRestaurante: etqRest');
    expect(cliente).toContain('etiquetasRepartidor:');
    expect(leer('apps', 'repartidor', 'src', 'grandes', 'Calificaciones.tsx')).toContain(
      '<Elogios',
    );
    expect(leer('apps', 'repartidor', 'src', 'grandes', 'MiNivel.tsx')).toContain('<Elogios');
    expect(leer('apps', 'restaurante', 'src', 'Resenas.tsx')).toContain('textoEtiqueta(');
    expect(leer('apps', 'panel', 'src', 'panel', 'Resenas.tsx')).toContain('resenas-etiquetas');
  });
});
