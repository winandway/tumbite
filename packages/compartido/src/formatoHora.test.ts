import { describe, expect, it } from 'vitest';
import {
  abreviaturaZona,
  formatearFechaHora,
  formatoEfectivo,
  formatoPorDefecto,
  mismaHora,
  nombreZona,
  zonaDelEmpleado,
  zonaEfectiva,
  zonaValida,
} from './formatoHora';
import { limpiarPreferencias, PANTALLAS_PREFERENCIAS } from './busquedaInterna';
import {
  servicioDeOperacion,
  servicioDePedido,
  servicioIdDeOperacion,
  nombreServicioMonitoreo,
} from './monitoreoServicios';

// 15 nov 2026 19:05 UTC = 2:05 p. m. en Novi (Detroit, EST) y 3:05 p. m. en Caracas.
const FECHA = '2026-11-15 19:05:00';
const AHORA = Date.UTC(2026, 10, 15, 20);

describe('C-HORARIO-EMPLEADO · formato de hora', () => {
  it('12 horas con AM/PM en inglés y a. m./p. m. en español; 24 horas', () => {
    const base = { zona: 'America/Detroit', ahora: AHORA } as const;
    expect(formatearFechaHora(FECHA, { ...base, idioma: 'en', formato: '12' })).toBe(
      'Nov 15, 2:05 PM',
    );
    expect(formatearFechaHora(FECHA, { ...base, idioma: 'es', formato: '12' })).toBe(
      '15 nov, 2:05 p. m.',
    );
    expect(formatearFechaHora(FECHA, { ...base, idioma: 'es', formato: '24' })).toBe(
      '15 nov, 14:05',
    );
    expect(
      formatearFechaHora('2026-11-15 05:07:00', {
        ...base,
        idioma: 'es',
        formato: '12',
        estilo: 'hora',
      }),
    ).toBe('12:07 a. m.');
    expect(
      formatearFechaHora(FECHA, { ...base, idioma: 'en', formato: '12', estilo: 'fecha' }),
    ).toBe('Nov 15');
    expect(
      formatearFechaHora('2026-11-15 19:05:09', {
        ...base,
        idioma: 'en',
        formato: '12',
        estilo: 'hora_segundos',
      }),
    ).toBe('2:05:09 PM');
    expect(
      formatearFechaHora('2026-11-15 19:05:09', {
        ...base,
        idioma: 'es',
        formato: '24',
        estilo: 'hora_segundos',
      }),
    ).toBe('14:05:09');
    expect(
      formatearFechaHora(FECHA, { ...base, idioma: 'es', formato: '24', estilo: 'fecha_larga' }),
    ).toBe('15 nov 2026');
  });

  it('la misma hora en otra zona y el año solo si no es el de ahora', () => {
    expect(
      formatearFechaHora(FECHA, {
        idioma: 'es',
        formato: '12',
        zona: 'America/Caracas',
        ahora: AHORA,
        estilo: 'hora',
      }),
    ).toBe('3:05 p. m.');
    expect(
      formatearFechaHora('2025-03-02 12:00:00', {
        idioma: 'en',
        formato: '24',
        zona: 'UTC',
        ahora: AHORA,
      }),
    ).toBe('Mar 2, 2025, 12:00');
    expect(
      formatearFechaHora(FECHA, {
        idioma: 'en',
        formato: '12',
        zona: 'UTC',
        estilo: 'fecha_hora_larga',
        ahora: AHORA,
      }),
    ).toBe('Nov 15, 2026, 7:05 PM');
  });

  it('acepta ISO, número y fechas raras sin romperse', () => {
    const o = { idioma: 'en', formato: '24', zona: 'UTC', estilo: 'hora' } as const;
    expect(formatearFechaHora('2026-11-15T19:05:00Z', o)).toBe('19:05');
    expect(formatearFechaHora(Date.UTC(2026, 10, 15, 19, 5), o)).toBe('19:05');
    expect(formatearFechaHora(null, o)).toBe('');
    expect(formatearFechaHora('no es fecha', o)).toBe('no es fecha');
  });

  it('por defecto 12 horas en Estados Unidos; 24 donde se usa así', () => {
    expect(formatoPorDefecto('US')).toBe('12');
    expect(formatoPorDefecto(null)).toBe('12');
    expect(formatoPorDefecto('ES')).toBe('24');
    expect(formatoEfectivo('auto', 'ES')).toBe('24');
    expect(formatoEfectivo('12', 'ES')).toBe('12');
    expect(formatoEfectivo(undefined, 'US')).toBe('12');
  });

  it('zona: fija si el empleado eligió una; en automático, la de la ciudad del dato', () => {
    expect(zonaEfectiva('America/Caracas', 'America/Detroit', 'America/Bogota')).toBe(
      'America/Caracas',
    );
    expect(zonaEfectiva('auto', 'America/Detroit', 'America/Bogota')).toBe('America/Detroit');
    expect(zonaEfectiva('auto', null, 'America/Bogota')).toBe('America/Bogota');
    expect(zonaEfectiva('Marte/Base', 'nada', 'America/Bogota')).toBe('America/Bogota');
    expect(zonaDelEmpleado('auto', 'America/Bogota')).toBe('America/Bogota');
    expect(zonaDelEmpleado('America/Caracas', 'America/Bogota')).toBe('America/Caracas');
  });

  it('dice si dos zonas marcan la misma hora y su abreviatura', () => {
    expect(zonaValida('America/New_York')).toBe(true);
    expect(zonaValida('../etc')).toBe(false);
    expect(mismaHora('America/New_York', 'America/Detroit', AHORA)).toBe(true);
    expect(mismaHora('America/New_York', 'America/Caracas', AHORA)).toBe(false);
    expect(abreviaturaZona('America/Detroit', FECHA, 'en')).toBe('EST');
    expect(nombreZona('America/New_York')).toBe('New York');
  });

  it('la zona y el reloj del empleado se guardan como preferencias de la pantalla «horario»', () => {
    expect(PANTALLAS_PREFERENCIAS).toContain('horario');
    expect(
      limpiarPreferencias({ formato: '24', zonaHoraria: 'America/Argentina/Buenos_Aires', q: 'x' }),
    ).toEqual({
      formato: '24',
      zonaHoraria: 'America/Argentina/Buenos_Aires',
    });
    expect(limpiarPreferencias({ zonaHoraria: 'José Pérez' })).toEqual({});
  });
});

describe('C-MONITOREO-SERVICIOS · de qué servicio es cada cosa', () => {
  it('comida o tienda según el comercio; auto, moto o envío según la operación', () => {
    expect(servicioDePedido('restaurante')).toBe('comida');
    expect(servicioDePedido(null)).toBe('comida');
    expect(servicioDePedido('mercado')).toBe('tiendas');
    expect(servicioDePedido('farmacia')).toBe('tiendas');
    expect(servicioDeOperacion('carro')).toBe('auto');
    expect(servicioDeOperacion('moto')).toBe('moto');
    expect(servicioDeOperacion('envios')).toBe('envios');
    expect(servicioDeOperacion('comida')).toBeNull();
    expect(servicioIdDeOperacion('auto')).toBe('carro');
    expect(servicioIdDeOperacion('comida')).toBeNull();
    expect(nombreServicioMonitoreo('auto', 'en')).toBe('Car rides');
    expect(nombreServicioMonitoreo('tiendas', 'es')).toBe('Tiendas');
  });
});
