import { describe, expect, it } from 'vitest';
import {
  MOVIMIENTO,
  PERIODO_MS,
  accionDeTarjeta,
  cruzaUmbral,
  debeConfirmar,
  estadoPapel,
  estiloPapel,
  estiloTarjeta,
  puedeConectar,
  tramosBucle,
  type EstadoServicio,
} from './serviciosLogica';
import { COLOR } from './tokens';

// C-SERVICIOS-CONECTADOS (DRIVER.md §3 y §5): las reglas de las piezas del panel de servicios.
describe('deslizar para desconectar', () => {
  it('por debajo del 85 % no desconecta; desde el 85 % sí', () => {
    expect(debeConfirmar(0, 200)).toBe(false);
    expect(debeConfirmar(169, 200)).toBe(false);
    expect(debeConfirmar(169.9, 200)).toBe(false);
    expect(debeConfirmar(170, 200)).toBe(true);
    expect(debeConfirmar(200, 200)).toBe(true);
  });

  it('sin ancho medido nunca confirma', () => {
    expect(debeConfirmar(50, 0)).toBe(false);
    expect(debeConfirmar(Number.NaN, 200)).toBe(false);
  });

  it('vibra una sola vez, al cruzar el 85 % hacia adelante', () => {
    expect(cruzaUmbral(160, 175, 200)).toBe(true);
    expect(cruzaUmbral(175, 190, 200)).toBe(false);
    expect(cruzaUmbral(190, 160, 200)).toBe(false);
  });
});

describe('la tarjeta de servicio', () => {
  const todos: EstadoServicio[] = [
    'conectado',
    'en_pausa',
    'haciendo',
    'desconectado',
    'bloqueado_flex',
    'en_revision',
    'agregar',
  ];

  it('solo un servicio aprobado y desconectado ofrece «Conectar»', () => {
    expect(todos.filter(puedeConectar)).toEqual(['desconectado']);
    expect(accionDeTarjeta('en_revision')).toBe('ver');
    expect(accionDeTarjeta('agregar')).toBe('agregar');
    expect(accionDeTarjeta('conectado')).toBe('deslizar');
    expect(accionDeTarjeta('bloqueado_flex')).toBeNull();
    expect(accionDeTarjeta('en_pausa')).toBeNull();
  });

  it('conectado en verde con su borde; agregar con borde punteado', () => {
    expect(estiloTarjeta('conectado')).toMatchObject({
      fondo: '#E6F4EC',
      borde: '#9FD3B3',
      anchoBorde: 1.5,
      textoEstado: '#0D7A3A',
    });
    expect(estiloTarjeta('agregar').punteado).toBe(true);
    expect(estiloTarjeta('en_pausa').fondo).toBe(COLOR.superficie);
    expect(estiloTarjeta('bloqueado_flex').icono).toBe(COLOR.iconoApagado);
  });
});

describe('píldoras de los papeles', () => {
  it('aprobado en verde y rechazado en el rojo de error, nunca el de la marca', () => {
    expect(estiloPapel('aprobado')).toEqual({
      fondo: '#E6F4EC',
      texto: '#0D7A3A',
      icono: 'checkmark',
    });
    expect(estiloPapel('rechazado')).toEqual({
      fondo: '#FDECEA',
      texto: '#B3261E',
      icono: 'close',
    });
    expect(estiloPapel('rechazado').texto).not.toBe('#F20D20');
    expect(estiloPapel('rechazado').texto).not.toBe(COLOR.marca);
    expect(estiloPapel('pendiente')).toEqual({
      fondo: '#EEEFF1',
      texto: '#666B73',
      icono: 'time-outline',
    });
  });

  it('cada estado del servidor cae en uno de los cuatro', () => {
    expect(estadoPapel('aprobado')).toBe('aprobado');
    expect(estadoPapel('aprobada')).toBe('aprobado');
    expect(estadoPapel('vencido')).toBe('rechazado');
    expect(estadoPapel('en_revision')).toBe('pendiente');
    expect(estadoPapel('sin_subir')).toBe('falta');
    expect(estadoPapel(undefined)).toBe('falta');
  });
});

describe('bucle continuo de 4,8 s', () => {
  it('cada duración del Driver divide el período exacto', () => {
    for (const ms of [
      MOVIMIENTO.luzViva,
      MOVIMIENTO.barrido,
      MOVIMIENTO.flechas,
      MOVIMIENTO.radar,
      MOVIMIENTO.brillo,
    ])
      expect(PERIODO_MS % ms, String(ms)).toBe(0);
  });

  it('una vuelta de 2,4 s cabe dos veces y empieza y termina en el mismo punto', () => {
    const r = tramosBucle(2400);
    expect(r.inputRange).toEqual([0, 0.5, 0.5, 1]);
    expect(r.outputRange).toEqual([0, 1, 0, 1]);
  });

  it('con retraso la pieza ya va avanzada y el corte cae donde toca', () => {
    const r = tramosBucle(2400, 800);
    expect(r.outputRange[0]).toBeCloseTo(1 / 3);
    expect(r.outputRange.at(-1)).toBeCloseTo(1 / 3);
    for (let i = 1; i < r.inputRange.length; i++)
      expect(r.inputRange[i]!).toBeGreaterThanOrEqual(r.inputRange[i - 1]!);
  });

  it('una duración que no divide el período se rechaza', () => {
    expect(() => tramosBucle(1900)).toThrow();
  });
});
