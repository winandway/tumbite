import { describe, expect, it } from 'vitest';
import {
  segundosPorKm,
  textoDiferencia,
  textoDuracion,
  tiemposPedido,
  tiemposViaje,
} from './tiemposOperacion';
import { minutosDeViaje } from './despacho';
import { minutosRestauranteACasa } from './seguimientoHonesto';
import { semaforoViaje } from './semaforo';

// Restaurante y casa en Novi, Michigan (unos 3 km en línea recta).
const RESTAURANTE = { lat: 42.4806, lng: -83.4755 };
const CASA = { lat: 42.4806, lng: -83.4392 };
const f = (min: number) => {
  const d = new Date(Date.UTC(2026, 10, 15, 18, 0, 0) + min * 60_000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
const porClave = <T extends { clave: string }>(xs: T[], c: string) => xs.find((x) => x.clave === c);

describe('C-TIEMPOS-OPERACION · pedido', () => {
  const entregado = {
    estado: 'entregado',
    creadoEn: f(0),
    pagadoEn: f(1),
    aceptadoEn: f(2),
    listoEn: f(20), // 18 min de cocina con 20 prometidos: más rápido
    repartidorAceptoEn: f(10),
    kmRepartidorRestaurante: 2,
    llegoRestauranteEn: f(19),
    recogidoEn: f(25), // esperó 6 min (la comida debía estar a las 22: le tocaba esperar 3)
    entregadoEn: f(37),
    tiempoPrepMin: 20,
    restaurante: RESTAURANTE,
    casa: CASA,
  };

  it('mide los cinco tramos contra lo previsto con las fórmulas del sistema', () => {
    const t = tiemposPedido(entregado, Date.UTC(2026, 10, 15, 20));
    expect(t.map((x) => x.clave)).toEqual(['preparacion', 'ida', 'espera', 'entrega', 'total']);

    const prep = porClave(t, 'preparacion');
    expect(prep).toMatchObject({
      realS: 18 * 60,
      previstoS: 20 * 60,
      diferenciaMin: -2,
      resultado: 'cumplio',
    });

    const ida = porClave(t, 'ida');
    expect(ida?.realS).toBe(9 * 60);
    expect(ida?.previstoS).toBe(minutosDeViaje(2) * 60);
    expect(ida?.resultado).toBe('se_paso'); // 2 km son 5 min; tardó 9

    const espera = porClave(t, 'espera');
    expect(espera).toMatchObject({
      realS: 6 * 60,
      previstoS: 3 * 60,
      diferenciaMin: 3,
      resultado: 'se_paso',
    });

    const entrega = porClave(t, 'entrega');
    expect(entrega?.realS).toBe(12 * 60);
    expect(entrega?.previstoS).toBe(minutosRestauranteACasa(RESTAURANTE, CASA) * 60);
    expect(entrega?.previstoPorDefecto).toBeUndefined();

    // «A más tardar» = aceptado (2) + 20 + viaje a la casa + 10; desde el pago (1).
    const total = porClave(t, 'total');
    expect(total?.realS).toBe(36 * 60);
    expect(total?.previstoS).toBe((1 + 20 + minutosRestauranteACasa(RESTAURANTE, CASA) + 10) * 60);
    expect(total?.resultado).toBe('cumplio');
  });

  it('menos de medio minuto de más sigue siendo a tiempo (verde)', () => {
    const t = tiemposPedido({ ...entregado, listoEn: '2026-11-15 18:22:20' });
    expect(porClave(t, 'preparacion')).toMatchObject({ diferenciaMin: 0, resultado: 'cumplio' });
  });

  it('gris y con el dato que falta cuando no se puede medir', () => {
    const t = tiemposPedido({
      ...entregado,
      repartidorAceptoEn: null,
      kmRepartidorRestaurante: null,
      llegoRestauranteEn: null,
      tiempoPrepMin: null,
    });
    expect(porClave(t, 'ida')).toMatchObject({ resultado: 'sin_dato' });
    expect(porClave(t, 'ida')?.falta).toEqual(
      expect.arrayContaining(['repartidor_acepto', 'llego_restaurante', 'distancia_repartidor']),
    );
    expect(porClave(t, 'preparacion')).toMatchObject({ realS: 18 * 60, resultado: 'sin_dato' });
    expect(porClave(t, 'preparacion')?.falta).toEqual(['tiempo_prometido']);
    expect(porClave(t, 'espera')?.falta).toContain('llego_restaurante');
  });

  it('sin ubicaciones usa el viaje de fábrica y lo dice', () => {
    const t = tiemposPedido({ ...entregado, restaurante: null, casa: null });
    expect(porClave(t, 'entrega')).toMatchObject({ previstoS: 15 * 60, previstoPorDefecto: true });
    expect(porClave(t, 'total')?.previstoPorDefecto).toBe(true);
  });

  it('un pedido vivo muestra lo que lleva y se pone rojo si ya pasó lo previsto', () => {
    const ahora = Date.UTC(2026, 10, 15, 18, 30); // minuto 30, en cocina desde el 2
    const t = tiemposPedido(
      {
        ...entregado,
        estado: 'aceptado',
        listoEn: null,
        recogidoEn: null,
        entregadoEn: null,
        llegoRestauranteEn: null,
      },
      ahora,
    );
    expect(porClave(t, 'preparacion')).toMatchObject({
      realS: 28 * 60,
      resultado: 'se_paso',
      falta: [],
    });
    const vivoATiempo = tiemposPedido(
      { ...entregado, estado: 'aceptado', listoEn: null },
      Date.UTC(2026, 10, 15, 18, 10),
    );
    expect(porClave(vivoATiempo, 'preparacion')).toMatchObject({ resultado: 'en_curso' });
  });

  it('un pedido cancelado dice «cancelado» en lo que no llegó a pasar', () => {
    const t = tiemposPedido({
      estado: 'cancelado',
      creadoEn: f(0),
      pagadoEn: f(1),
      tiempoPrepMin: 20,
    });
    expect(porClave(t, 'total')?.falta).toContain('cancelado');
    expect(t.every((x) => x.resultado === 'sin_dato')).toBe(true);
  });
});

describe('C-TIEMPOS-OPERACION · viaje', () => {
  const tarifa = { factorCallePb: 13_000, velocidadKmh: 24, esperaGratisS: 300 };
  const terminado = {
    estado: 'terminado',
    buscandoDesde: f(0),
    asignadoEn: f(2),
    llegoEn: f(9),
    iniciadoEn: f(12),
    terminadoEn: f(30),
    topeBusquedaS: 600,
    kmRecogida: 1.5,
    tarifa,
    duracionCotizadaS: 20 * 60,
  };

  it('espera hasta asignar, llegada, espera del pasajero, recorrido y total', () => {
    const t = tiemposViaje(terminado);
    expect(t.map((x) => x.clave)).toEqual([
      'asignacion',
      'llegada',
      'espera_pasajero',
      'recorrido',
      'total',
    ]);
    expect(porClave(t, 'asignacion')).toMatchObject({
      realS: 120,
      previstoS: 600,
      resultado: 'cumplio',
    });
    expect(porClave(t, 'llegada')?.previstoS).toBe(segundosPorKm(1.5, tarifa));
    expect(porClave(t, 'llegada')?.resultado).toBe('se_paso');
    expect(porClave(t, 'espera_pasajero')).toMatchObject({
      realS: 180,
      previstoS: 300,
      resultado: 'cumplio',
    });
    expect(porClave(t, 'recorrido')).toMatchObject({
      realS: 18 * 60,
      previstoS: 20 * 60,
      resultado: 'cumplio',
    });
    expect(porClave(t, 'total')?.previstoS).toBe(segundosPorKm(1.5, tarifa) + 20 * 60);
  });

  it('sin la distancia del conductor, la llegada queda gris y dice por qué', () => {
    const t = tiemposViaje({ ...terminado, kmRecogida: null });
    expect(porClave(t, 'llegada')).toMatchObject({
      resultado: 'sin_dato',
      falta: ['distancia_conductor'],
    });
    expect(porClave(t, 'total')?.falta).toContain('distancia_conductor');
  });

  it('cancelado antes de empezar: lo que falta dice «cancelado»', () => {
    const t = tiemposViaje({
      ...terminado,
      estado: 'cancelado',
      llegoEn: null,
      iniciadoEn: null,
      terminadoEn: null,
    });
    expect(porClave(t, 'llegada')?.falta).toEqual(['cancelado']);
  });
});

describe('textos de la tarjeta de tiempos', () => {
  it('duraciones y diferencias', () => {
    expect(textoDuracion(45)).toBe('45 s');
    expect(textoDuracion(12 * 60)).toBe('12 min');
    expect(textoDuracion(65 * 60)).toBe('1 h 05 min');
    expect(textoDuracion(null)).toBe('—');
    expect(textoDiferencia(4, 'es')).toBe('+4 min');
    expect(textoDiferencia(-2, 'en')).toBe('−2 min');
    expect(textoDiferencia(0, 'es')).toBe('justo a tiempo');
  });
});

describe('C-MONITOREO-SERVICIOS · semáforo de los viajes', () => {
  const ahora = Date.UTC(2026, 10, 15, 18, 20);
  it('buscando: amarillo a los 5 min y rojo a los 8', () => {
    expect(semaforoViaje({ estado: 'buscando', creadoEn: f(17) }, ahora)?.luz).toBe('verde');
    expect(semaforoViaje({ estado: 'buscando', creadoEn: f(14) }, ahora)?.luz).toBe('amarillo');
    expect(
      semaforoViaje({ estado: 'buscando', creadoEn: f(0), buscandoDesde: f(11) }, ahora)?.luz,
    ).toBe('rojo');
  });
  it('una emergencia abierta pone el viaje en rojo', () => {
    expect(
      semaforoViaje(
        { estado: 'en_curso', creadoEn: f(0), iniciadoEn: f(19), emergenciaAbierta: true },
        ahora,
      ),
    ).toMatchObject({ luz: 'rojo', motivo: 'emergencia' });
  });
  it('el pasajero que no sale pasa la espera gratis', () => {
    expect(
      semaforoViaje(
        { estado: 'conductor_llego', creadoEn: f(0), llegoEn: f(13), esperaGratisMin: 5 },
        ahora,
      ),
    ).toMatchObject({ luz: 'amarillo', motivo: 'pasajero' });
  });
  it('terminado o en espera de pago no lleva semáforo', () => {
    expect(semaforoViaje({ estado: 'terminado', creadoEn: f(0) }, ahora)).toBeNull();
    expect(semaforoViaje({ estado: 'pago_pendiente', creadoEn: f(0) }, ahora)).toBeNull();
  });
});
