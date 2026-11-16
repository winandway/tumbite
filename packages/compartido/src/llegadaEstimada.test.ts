import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTOS_MOTO } from '../../../apps/cliente/src/viajes/textos';
import {
  tiempoHumano,
  type CalculoLlegada,
  DETENIDO_S,
  INTERVALO_LLEGADA_S,
  REFRESCO_QUIETO_S,
  decodificarRuta,
  detenido,
  faseDePedido,
  faseDeViaje,
  hayQueRecalcular,
  llegadaVigente,
  minutosDeLlegada,
  textoDetenido,
  textoFase,
  textoHoraLlegada,
  textoUltimaSenal,
} from './llegadaEstimada';

// Novi, Michigan.
const A = { lat: 42.4806, lng: -83.4755 };
const LEJOS = { lat: 42.49, lng: -83.4755 }; // ~1 km al norte
const CERQUITA = { lat: 42.4807, lng: -83.4755 }; // ~11 m
const T0 = Date.UTC(2026, 10, 16, 18, 0);

const calculo = (x: Partial<CalculoLlegada> = {}): CalculoLlegada => ({
  fase: 'llevando',
  duracionS: 600,
  tramoS: null,
  distanciaM: 3200,
  fuente: 'trafico',
  desde: A,
  calculadaEn: T0,
  ...x,
});

describe('C-HORA-LLEGADA · tramos', () => {
  it('el tramo del pedido sale del estado y del hito de llegada al local', () => {
    const base = { conRepartidor: true, llegoAlRestaurante: false };
    expect(faseDePedido({ ...base, estado: 'aceptado' })).toBe('al_restaurante');
    expect(faseDePedido({ ...base, estado: 'listo', llegoAlRestaurante: true })).toBe('esperando');
    expect(faseDePedido({ ...base, estado: 'en_camino' })).toBe('llevando');
    expect(faseDePedido({ ...base, estado: 'entregado' })).toBeNull();
    expect(faseDePedido({ ...base, estado: 'aceptado', conRepartidor: false })).toBeNull();
    expect(faseDeViaje('asignado')).toBe('a_recogida');
    expect(faseDeViaje('conductor_llego')).toBe('esperando_pasajero');
    expect(faseDeViaje('en_curso')).toBe('en_viaje');
    expect(faseDeViaje('terminado')).toBeNull();
  });

  it('los textos del tramo existen en los dos idiomas y cambian para un paquete', () => {
    expect(textoFase('al_restaurante', 'es')).toBe('En camino al restaurante');
    expect(textoFase('esperando', 'es')).toBe('Esperando en el restaurante');
    expect(textoFase('llevando', 'en')).toBe('Delivering the order');
    expect(textoFase('en_viaje', 'es', true)).toBe('Llevando el paquete');
    expect(textoUltimaSenal(190, 'es')).toBe('Última señal hace 3 minutos');
    expect(textoUltimaSenal(20, 'en')).toBe('Last signal 20 seconds ago');
    const d = new Date(2026, 10, 16, 15, 28);
    expect(textoHoraLlegada(d.toISOString(), 'es')).toBe('3:28 p. m.');
    expect(textoHoraLlegada(d.toISOString(), 'en')).toBe('3:28 PM');
  });
});

describe('C-HORA-LLEGADA · cuándo se le pregunta a Google (dinero)', () => {
  it('sin cálculo previo o al cambiar de tramo, se calcula', () => {
    expect(hayQueRecalcular(null, { fase: 'llevando', posicion: A, ms: T0 })).toBe(true);
    expect(
      hayQueRecalcular(calculo({ fase: 'al_restaurante' }), {
        fase: 'esperando',
        posicion: A,
        ms: T0 + 5_000,
      }),
    ).toBe(true);
  });

  it('NUNCA antes del intervalo, aunque se haya movido mucho', () => {
    expect(
      hayQueRecalcular(calculo(), {
        fase: 'llevando',
        posicion: LEJOS,
        ms: T0 + (INTERVALO_LLEGADA_S - 1) * 1000,
      }),
    ).toBe(false);
  });

  it('pasado el intervalo, solo si se movió; quieto, hasta los 5 minutos', () => {
    const despues = T0 + INTERVALO_LLEGADA_S * 1000;
    expect(hayQueRecalcular(calculo(), { fase: 'llevando', posicion: LEJOS, ms: despues })).toBe(
      true,
    );
    expect(hayQueRecalcular(calculo(), { fase: 'llevando', posicion: CERQUITA, ms: despues })).toBe(
      false,
    );
    expect(
      hayQueRecalcular(calculo(), {
        fase: 'llevando',
        posicion: CERQUITA,
        ms: T0 + REFRESCO_QUIETO_S * 1000,
      }),
    ).toBe(true);
  });
});

describe('C-HORA-LLEGADA · lo que falta ahora (mirar no calcula)', () => {
  it('en movimiento se descuenta el tiempo que pasó, sin bajar de un minuto', () => {
    const v = llegadaVigente(calculo(), T0 + 120_000);
    expect(v.faltanS).toBe(480);
    expect(v.llegaEnMs).toBe(T0 + 600_000);
    expect(v.calculadaHaceS).toBe(120);
    expect(llegadaVigente(calculo(), T0 + 3_600_000).faltanS).toBe(60);
    expect(minutosDeLlegada(480)).toBe(8);
    expect(minutosDeLlegada(10)).toBe(1);
  });

  it('esperando en el local no avanza y suma lo que falta de cocina', () => {
    const v = llegadaVigente(calculo({ fase: 'esperando', duracionS: 600 }), T0 + 300_000, 240);
    expect(v.faltanS).toBe(840);
  });
});

describe('C-RASTREO-VIVO · detenido', () => {
  const base = {
    fase: 'llevando' as const,
    posicion: CERQUITA,
    posicionEn: T0 + 400_000,
    ancla: { ...A, en: T0 },
    puntos: [LEJOS],
    ahoraMs: T0 + 400_000,
  };
  it('quieto más de 3 minutos lejos del local y la casa = detenido', () => {
    expect(detenido(base)).toEqual({ motivo: 'quieto', desdeS: 400 });
    expect(textoDetenido({ motivo: 'quieto', desdeS: 400 }, 'es')).toBe('Detenido hace 6 minutos');
  });
  it('no es detenido: recién se paró, está junto a un punto, o está esperando en el local', () => {
    expect(detenido({ ...base, ahoraMs: T0 + DETENIDO_S * 1000 })).toBeNull();
    expect(detenido({ ...base, puntos: [A] })).toBeNull();
    expect(detenido({ ...base, fase: 'esperando' })).toBeNull();
    expect(detenido({ ...base, posicion: LEJOS })).toBeNull();
  });
  it('sin señal hace más de 3 minutos se dice como tal', () => {
    expect(detenido({ ...base, posicionEn: T0, ahoraMs: T0 + 200_000 })).toEqual({
      motivo: 'sin_senal',
      desdeS: 200,
    });
  });
});

describe('C-RASTREO-VIVO · la línea de la ruta de Google', () => {
  it('decodifica el ejemplo publicado por Google', () => {
    expect(decodificarRuta('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
    expect(decodificarRuta(null)).toEqual([]);
  });
});

describe('C-HORA-LLEGADA · la misma pieza alimenta las apps del cliente', () => {
  const leer = (...r: string[]) =>
    readFileSync(join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src', ...r), 'utf8');
  it('pedido: «Tu pedido llega a las…» y «Tu repartidor está a… min», en los dos idiomas', () => {
    const s = leer('app', 'order', '[id].tsx');
    expect(s).toContain("llegaALas: 'Tu pedido llega a las {h}'");
    expect(s).toContain("llegaALas: 'Your order arrives at {h}'");
    expect(s).toContain("estaA: 'Tu repartidor está a {m} min'");
    expect(s).toContain("estaA: 'Your driver is {m} min away'");
    expect(s).toMatch(
      /testID="llegada-en-vivo"[\s\S]{0,300}textoHoraLlegada\(p\.llegadaEnVivo\.llegaEn/,
    );
  });
  it('viaje y envío: la hora de la recogida o del destino con la pieza del servidor', () => {
    const s = leer('viajes', 'ViajeEnCurso.tsx');
    expect(s).toMatch(
      /viaje\.llegadaEnVivo[\s\S]{0,300}textoHoraLlegada\(viaje\.llegadaEnVivo\.llegaEn/,
    );
    for (const i of ['es', 'en'] as const) {
      expect(TEXTOS_MOTO[i].llegaALas('3:28 PM', 5)).toContain('3:28 PM');
      expect(TEXTOS_MOTO[i].destinoALas('3:28 PM', 5)).toContain('5');
      expect(TEXTOS_MOTO[i].envio.destinoALas('3:28 PM', 5)).not.toMatch(/pasajero|rider/i);
    }
  });
});

describe('C-DURACION-EN-PALABRAS · cuánto tiempo, en palabras y en la unidad que corresponde', () => {
  it('segundos, minutos, horas, días, meses y años, en español y en inglés', () => {
    expect(tiempoHumano(1, 'es')).toBe('1 segundo');
    expect(tiempoHumano(40, 'es')).toBe('40 segundos');
    expect(tiempoHumano(9 * 60, 'es')).toBe('9 minutos');
    expect(tiempoHumano(60 * 60, 'es')).toBe('1 hora');
    expect(tiempoHumano(80 * 60, 'es')).toBe('1 hora y 20 minutos');
    expect(tiempoHumano(80 * 60, 'en')).toBe('1 hour and 20 minutes');
    expect(tiempoHumano(23 * 3600 + 59 * 60, 'es')).toBe('23 horas y 59 minutos');
    expect(tiempoHumano(27 * 3600, 'es')).toBe('1 día y 3 horas');
    expect(tiempoHumano(29 * 86400, 'en')).toBe('29 days');
    expect(tiempoHumano(31 * 86400, 'es')).toBe('1 mes y 1 día');
    expect(tiempoHumano(45805 * 60, 'en')).toBe('1 month and 1 day');
    expect(tiempoHumano(400 * 86400, 'es')).toBe('1 año y 1 mes');
    expect(textoDetenido({ motivo: 'sin_senal', desdeS: 45805 * 60 }, 'es')).toBe(
      'Sin señal hace 1 mes y 1 día',
    );
    expect(textoDetenido({ motivo: 'quieto', desdeS: 240 }, 'en')).toBe('Stopped for 4 minutes');
  });
});
