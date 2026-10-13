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
      // Recordatorios a los 3 y 6 minutos; a los 10 el Manager lo cancela.
      const m = desde(p.pagadoEn);
      return { luz: luz(m, 3, 6), minutos: m, motivo: 'restaurante' };
    }
    case 'aceptado': {
      const m = desde(p.aceptadoEn);
      const prep = p.tiempoPrepMin ?? 20;
      return { luz: luz(m, prep + 1, prep + 10), minutos: m, motivo: 'cocina' };
    }
    case 'listo': {
      const m = desde(p.listoEn);
      return { luz: luz(m, 5, 15), minutos: m, motivo: 'repartidor' };
    }
    case 'en_camino': {
      const m = desde(p.recogidoEn);
      return { luz: luz(m, 30, 45), minutos: m, motivo: 'entrega' };
    }
    default:
      return null;
  }
}
