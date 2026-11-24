import { describe, expect, it } from 'vitest';
import {
  fraccionDeAvance,
  indiceDePaso,
  pasoAnterior,
  pasoDeCasilla,
  pasoSiguiente,
  pasoVigente,
  textosPasos,
} from './formularioPorPasos';

/** C-FORMULARIO-POR-PASOS: la lógica pura del carrusel de pasos de las apps. */
const PASOS = [
  { clave: 'nombre', casillas: ['nombre', 'fechaNacimiento'] },
  { clave: 'correo', casillas: ['correo'] },
  { clave: 'clave', casillas: ['clave'] },
];

describe('C-FORMULARIO-POR-PASOS', () => {
  it('vuelve al paso guardado en el borrador; uno vacío o que ya no existe, al primero', () => {
    expect(pasoVigente(PASOS, 'correo')).toBe('correo');
    expect(pasoVigente(PASOS, '')).toBe('nombre');
    expect(pasoVigente(PASOS, 'viejo')).toBe('nombre');
    expect(indiceDePaso(PASOS, 'clave')).toBe(2);
  });
  it('avanza y retrocede de a un paso, sin pasarse de los extremos', () => {
    expect(pasoSiguiente(PASOS, 'nombre')).toBe('correo');
    expect(pasoSiguiente(PASOS, 'clave')).toBeNull();
    expect(pasoAnterior(PASOS, 'correo')).toBe('nombre');
    expect(pasoAnterior(PASOS, 'nombre')).toBeNull();
  });
  it('un error del servidor lleva al paso de su casilla', () => {
    expect(pasoDeCasilla(PASOS, 'fechaNacimiento')).toBe('nombre');
    expect(pasoDeCasilla(PASOS, 'clave')).toBe('clave');
    expect(pasoDeCasilla(PASOS, 'otra')).toBeNull();
    expect(pasoDeCasilla(PASOS, undefined)).toBeNull();
  });
  it('la barra nunca sale vacía ni pasa del todo', () => {
    expect(fraccionDeAvance(0, 4)).toBe(0.25);
    expect(fraccionDeAvance(3, 4)).toBe(1);
    expect(fraccionDeAvance(9, 4)).toBe(1);
    expect(fraccionDeAvance(0, 0)).toBe(0);
  });
  it('dice el paso y los botones en los dos idiomas', () => {
    expect(textosPasos('es').paso(2, 5)).toBe('Paso 2 de 5');
    expect(textosPasos('en').paso(2, 5)).toBe('Step 2 of 5');
    expect([textosPasos('es').siguiente, textosPasos('en').siguiente]).toEqual([
      'Siguiente',
      'Next',
    ]);
    expect([textosPasos('es').atras, textosPasos('en').atras]).toEqual(['Atrás', 'Back']);
  });
});
