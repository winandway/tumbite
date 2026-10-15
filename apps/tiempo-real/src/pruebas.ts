import { DatabaseSync } from 'node:sqlite';
import type { CursorSql, EstadoZona, SocketZona } from './nucleo';

/** Socket de mentira: guarda lo que recibe, sus etiquetas y su ficha (como la hibernación). */
export class SocketPrueba implements SocketZona {
  recibidos: Record<string, unknown>[] = [];
  cerrado: { codigo?: number; motivo?: string } | null = null;
  etiquetas: string[] = [];
  private ficha: unknown = null;
  send(d: string) {
    if (this.cerrado) throw new Error('cerrado');
    this.recibidos.push(JSON.parse(d) as Record<string, unknown>);
  }
  close(codigo?: number, motivo?: string) {
    this.cerrado = { ...(codigo != null ? { codigo } : {}), ...(motivo != null ? { motivo } : {}) };
  }
  serializeAttachment(v: unknown) {
    this.ficha = structuredClone(v);
  }
  deserializeAttachment() {
    return structuredClone(this.ficha);
  }
  de(tipo: string) {
    return this.recibidos.filter((m) => m.tipo === tipo);
  }
}

/** Estado de un Durable Object de mentira, con el SQLite real de Node como almacén. */
export function estadoPrueba() {
  const db = new DatabaseSync(':memory:');
  const sockets: SocketPrueba[] = [];
  let alarma: number | null = null;
  const estado: EstadoZona & {
    sockets: SocketPrueba[];
    alarma: () => number | null;
    quitarAlarma: () => void;
  } = {
    sockets,
    alarma: () => alarma,
    quitarAlarma: () => {
      alarma = null;
    },
    acceptWebSocket(ws, etiquetas) {
      const s = ws as SocketPrueba;
      s.etiquetas = etiquetas;
      sockets.push(s);
    },
    getWebSockets(etiqueta) {
      return sockets.filter((s) => !s.cerrado && (!etiqueta || s.etiquetas.includes(etiqueta)));
    },
    sql: {
      exec(consulta: string, ...valores: unknown[]): CursorSql {
        const st = db.prepare(consulta);
        const filas = /^\s*(SELECT|INSERT[\s\S]*RETURNING)/i.test(consulta)
          ? (st.all(...(valores as never[])) as Record<string, unknown>[])
          : (st.run(...(valores as never[])), []);
        return { toArray: () => filas.map((f) => ({ ...f })) };
      },
    },
    setAlarm(t) {
      alarma = t;
    },
    getAlarm() {
      return alarma;
    },
  };
  return estado;
}
