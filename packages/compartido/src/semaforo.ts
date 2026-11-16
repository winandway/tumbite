import { MARGEN_ATASCADO_MIN } from './duracion';

/**
 * Semáforo del Manager: dice de un vistazo si un pedido va bien, se está atrasando o ya está en
 * problemas. Las mismas reglas que vigila el servidor (candado C-MANAGER-1), para que la pantalla
 * y los avisos nunca se contradigan.
 */
export type Luz = 'verde' | 'amarillo' | 'rojo';
export type Semaforo = {
  luz: Luz;
  minutos: number;
  motivo: 'restaurante' | 'cocina' | 'repartidor' | 'entrega';
};

type PedidoParaSemaforo = {
  estado: string;
  creadoEn: string;
  pagadoEn?: string | null;
  aceptadoEn?: string | null;
  listoEn?: string | null;
  recogidoEn?: string | null;
  tiempoPrepMin?: number | null;
};

/** Las fechas de la base vienen como «2026-10-12 20:00:00» en hora UTC. */
export function fechaBase(f: string): number {
  return Date.parse(`${f.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(f) ? '' : 'Z'}`);
}

const luz = (minutos: number, amarillo: number, rojo: number): Luz =>
  minutos >= rojo ? 'rojo' : minutos >= amarillo ? 'amarillo' : 'verde';

export function semaforoPedido(p: PedidoParaSemaforo, ahora = Date.now()): Semaforo | null {
  const desde = (f: string | null | undefined) =>
    Math.max(0, Math.floor((ahora - fechaBase(f ?? p.creadoEn)) / 60000));
  switch (p.estado) {
    case 'pagado': {
      // Recordatorios al minuto y a los 3; a los 6 el Manager lo cancela (tiempos de los grandes).
      const m = desde(p.pagadoEn);
      return { luz: luz(m, 1, 3), minutos: m, motivo: 'restaurante' };
    }
    case 'aceptado': {
      const m = desde(p.aceptadoEn);
      const prep = p.tiempoPrepMin ?? 20;
      // C-DURACION-EN-PALABRAS: rojo (atascado) a los pocos minutos de pasar lo previsto.
      return { luz: luz(m, prep + 1, prep + MARGEN_ATASCADO_MIN), minutos: m, motivo: 'cocina' };
    }
    case 'listo': {
      const m = desde(p.listoEn);
      return { luz: luz(m, 5, 15), minutos: m, motivo: 'repartidor' };
    }
    case 'en_camino': {
      const m = desde(p.recogidoEn);
      return { luz: luz(m, 30, 30 + MARGEN_ATASCADO_MIN), minutos: m, motivo: 'entrega' };
    }
    default:
      return null;
  }
}

/**
 * C-MONITOREO-SERVICIOS (15 nov 2026): el mismo semáforo para los viajes de auto, de moto y los
 * envíos, en el mismo monitoreo que los pedidos. Una emergencia abierta pone el viaje en rojo pase
 * lo que pase. Los umbrales siguen las reglas del propio viaje: a los 10 minutos buscando, el viaje
 * queda «sin conductor» (amarillo a los 5, rojo a los 8); el conductor en camino, sobre su llegada
 * prevista; el pasajero, sobre la espera gratis de la tarifa; el recorrido, sobre la duración
 * cotizada.
 */
export type SemaforoViaje = {
  luz: Luz;
  minutos: number;
  motivo: 'buscando' | 'llegada' | 'pasajero' | 'recorrido' | 'emergencia';
};

type ViajeParaSemaforo = {
  estado: string;
  creadoEn: string;
  buscandoDesde?: string | null;
  asignadoEn?: string | null;
  llegoEn?: string | null;
  iniciadoEn?: string | null;
  /** Minutos previstos de la llegada del conductor (si se conocen). */
  llegadaPrevistaMin?: number | null;
  /** Espera gratis de la tarifa, en minutos. */
  esperaGratisMin?: number | null;
  /** Duración cotizada del recorrido, en minutos. */
  duracionMin?: number | null;
  emergenciaAbierta?: boolean;
};

export function semaforoViaje(v: ViajeParaSemaforo, ahora = Date.now()): SemaforoViaje | null {
  const desde = (f: string | null | undefined) =>
    Math.max(0, Math.floor((ahora - fechaBase(f ?? v.creadoEn)) / 60000));
  const vivo = ['buscando', 'asignado', 'conductor_llego', 'en_curso'].includes(v.estado);
  if (v.emergenciaAbierta && vivo)
    return { luz: 'rojo', minutos: desde(v.asignadoEn ?? v.creadoEn), motivo: 'emergencia' };
  switch (v.estado) {
    case 'buscando': {
      const m = desde(v.buscandoDesde);
      return { luz: luz(m, 5, 8), minutos: m, motivo: 'buscando' };
    }
    case 'asignado': {
      const m = desde(v.asignadoEn);
      const previsto = v.llegadaPrevistaMin ?? 10;
      return { luz: luz(m, previsto + 5, previsto + 15), minutos: m, motivo: 'llegada' };
    }
    case 'conductor_llego': {
      const m = desde(v.llegoEn);
      const gratis = v.esperaGratisMin ?? 5;
      return { luz: luz(m, gratis, gratis * 2), minutos: m, motivo: 'pasajero' };
    }
    case 'en_curso': {
      const m = desde(v.iniciadoEn);
      const dura = v.duracionMin ?? 20;
      return { luz: luz(m, dura + 10, dura + 20), minutos: m, motivo: 'recorrido' };
    }
    default:
      return null;
  }
}
