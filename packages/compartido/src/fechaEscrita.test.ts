import { describe, expect, it } from 'vitest';
import {
  DIA_MES_ANIO,
  escribirFecha,
  leerFecha,
  marcadorFecha,
  mostrarFecha,
  ordenDePais,
  ordenFecha,
  regionDe,
} from './fechaEscrita';

/** C-FECHA-MODERNA (19 nov 2026, Richard): la casilla única de fecha. Comprobado en ROJO. */
const MES_DIA = ['mes', 'dia', 'anio'] as const;
/** Teclea una a una las cifras, como en el teléfono. */
const teclear = (cifras: string, orden = DIA_MES_ANIO) =>
  [...cifras].reduce((texto, c) => escribirFecha(texto, texto + c, orden), '');

describe('C-FECHA-MODERNA: el orden lo decide el país, con los formatos del sistema', () => {
  it('Estados Unidos escribe el mes primero; Venezuela, Perú, Colombia y México, el día', () => {
    expect(ordenDePais('US')).toEqual(MES_DIA);
    for (const pais of ['VE', 'PE', 'CO', 'MX', 'CL', 'AR', 'EC', 'BR', 'ES'])
      expect(ordenDePais(pais), pais).toEqual(DIA_MES_ANIO);
  });
  it('manda la región del teléfono, no el idioma; después la ciudad; si no hay nada, día primero', () => {
    // Un hispanohablante en Estados Unidos y un teléfono en inglés en Perú.
    expect(ordenFecha({ regionSistema: regionDe('es-US') })).toEqual(MES_DIA);
    expect(ordenFecha({ regionSistema: regionDe('en-PE') })).toEqual(DIA_MES_ANIO);
    expect(ordenFecha({ regionSistema: null, paisCiudad: 'US' })).toEqual(MES_DIA);
    expect(ordenFecha({ regionSistema: null, paisCiudad: null })).toEqual(DIA_MES_ANIO);
    expect(ordenFecha({ regionSistema: 'VE', paisCiudad: 'US' })).toEqual(DIA_MES_ANIO);
    expect(regionDe('es-419')).toBeNull();
    expect(regionDe('en_US.UTF-8')).toBe('US');
  });
  it('el marcador enseña el orden que toca, traducido', () => {
    expect(marcadorFecha(DIA_MES_ANIO, 'es')).toBe('DD/MM/AAAA');
    expect(marcadorFecha(MES_DIA, 'es')).toBe('MM/DD/AAAA');
    expect(marcadorFecha(MES_DIA, 'en')).toBe('MM/DD/YYYY');
  });
});

describe('C-FECHA-MODERNA: se escriben solo números y los separadores salen solos', () => {
  it('las barras aparecen al completar el día y el mes', () => {
    expect(teclear('31')).toBe('31/');
    expect(teclear('3101')).toBe('31/01/');
    expect(teclear('31012000')).toBe('31/01/2000');
    expect(teclear('01312000', MES_DIA)).toBe('01/31/2000');
  });
  it('un primer dígito imposible se completa solo y salta', () => {
    expect(teclear('4')).toBe('04/');
    expect(teclear('45')).toBe('04/05/');
    expect(teclear('452001')).toBe('04/05/2001');
    // En mes/día/año, un «2» en el mes es febrero.
    expect(teclear('2', MES_DIA)).toBe('02/');
    expect(teclear('1', MES_DIA)).toBe('1');
  });
  it('borrar hacia atrás se come el separador sin trabarse', () => {
    expect(escribirFecha('31/', '31', DIA_MES_ANIO)).toBe('3');
    expect(escribirFecha('31/01/', '31/01', DIA_MES_ANIO)).toBe('31/0');
    expect(escribirFecha('31/0', '31/', DIA_MES_ANIO)).toBe('31');
    expect(escribirFecha('3', '', DIA_MES_ANIO)).toBe('');
  });
  it('pegar una fecha entera o con otros separadores también queda bien', () => {
    expect(escribirFecha('', '31-01-2000', DIA_MES_ANIO)).toBe('31/01/2000');
    expect(escribirFecha('', '31012000999', DIA_MES_ANIO)).toBe('31/01/2000');
  });
});

describe('C-FECHA-MODERNA: al servidor va «AAAA-MM-DD» y lo opcional nunca bloquea', () => {
  it('convierte según el orden del país, ida y vuelta', () => {
    expect(leerFecha('31/01/2000', DIA_MES_ANIO)).toEqual({ iso: '2000-01-31', fallo: null });
    expect(leerFecha('01/31/2000', MES_DIA)).toEqual({ iso: '2000-01-31', fallo: null });
    expect(mostrarFecha('2000-01-31', DIA_MES_ANIO)).toBe('31/01/2000');
    expect(mostrarFecha('2000-01-31', MES_DIA)).toBe('01/31/2000');
    expect(mostrarFecha('', DIA_MES_ANIO)).toBe('');
  });
  it('vacía no es un fallo; a medias y las fechas imposibles se dicen, sin inventar una fecha', () => {
    expect(leerFecha('', DIA_MES_ANIO)).toEqual({ iso: null, fallo: null });
    expect(leerFecha('31/01/', DIA_MES_ANIO)).toEqual({ iso: null, fallo: 'incompleta' });
    expect(leerFecha('31/04/2000', DIA_MES_ANIO)).toEqual({ iso: null, fallo: 'imposible' });
    expect(leerFecha('29/02/2001', DIA_MES_ANIO)).toEqual({ iso: null, fallo: 'imposible' });
    expect(leerFecha('29/02/2000', DIA_MES_ANIO).iso).toBe('2000-02-29');
    expect(leerFecha('13/13/2000', MES_DIA)).toEqual({ iso: null, fallo: 'imposible' });
    expect(leerFecha('01/01/1800', DIA_MES_ANIO)).toEqual({ iso: null, fallo: 'antigua' });
    expect(leerFecha('01/01/2030', DIA_MES_ANIO, { hoy: '2026-11-19', sinFuturo: true })).toEqual({
      iso: null,
      fallo: 'futura',
    });
    expect(leerFecha('01/01/2030', DIA_MES_ANIO).iso).toBe('2030-01-01');
  });
});
