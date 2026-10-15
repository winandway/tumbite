import {
  type LlaveFirma,
  type PaseTiempoReal,
  firmarPeticion,
} from '@tumbite/compartido/src/firmaInterna';
import { type MensajeServidor } from '@tumbite/compartido/src/tiempoReal';

/**
 * Fase 2 · El corazón del Durable Object de una zona (docs/FASE-2-TIEMPO-REAL.md).
 * Sin nada de Cloudflare adentro: recibe interfaces mínimas, así se prueba igual en la
 * computadora. El objeto real (zona.ts) solo lo conecta con Cloudflare.
 *
 * Qué hace: guarda posiciones EN MEMORIA, reparte avisos y manda al servidor, cada 15 s, la
 * última posición de cada repartidor. Qué NO hace: decidir nada de dinero ni de pedidos.
 */

export interface SocketZona {
  send(datos: string): void;
  close(codigo?: number, motivo?: string): void;
  serializeAttachment(v: unknown): void;
  deserializeAttachment(): unknown;
}
export interface CursorSql {
  toArray(): Record<string, unknown>[];
}
export interface EstadoZona {
  acceptWebSocket(ws: SocketZona, etiquetas: string[]): void;
  getWebSockets(etiqueta?: string): SocketZona[];
  sql: { exec(consulta: string, ...valores: unknown[]): CursorSql };
  setAlarm(cuando: number): void | Promise<void>;
  getAlarm(): number | null | Promise<number | null>;
}
export type EntornoZona = {
  BACKEND_URL: string;
  INTERNO_LLAVE_ID?: string;
  INTERNO_SECRETO?: string;
};

/** Lo que cada socket recuerda (sobrevive a la hibernación del objeto). */
type Ficha = {
  u: string;
  rol: PaseTiempoReal['rol'];
  p?: string;
  r?: string;
  exp: number;
  /** hora (ms) de la última ubicación aceptada de este repartidor por este socket */
  ultimoT: number;
  /** límite de mensajes: inicio de la ventana y cuántos van */
  vIni: number;
  vN: number;
  avisosLimite: number;
};

export const LOTE_CADA_MS = 15_000;
export const MAX_POR_LOTE = 500;
/** Más de 20 mensajes en 10 s por conexión se descartan (un repartidor normal manda 1 o 2). */
export const LIMITE_MENSAJES = 20;
export const VENTANA_LIMITE_MS = 10_000;
/** Más rápido que esto (≈ 250 km/h) es un salto de GPS, no un viaje. */
export const VELOCIDAD_MAX_MS = 70;
const MAX_MENSAJE = 2048;
const AVISOS_GUARDADOS_MIN = 10;

type Posicion = { lat: number; lng: number; t: number };

export function distanciaM(a: Posicion, b: Posicion): number {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class NucleoZona {
  /** Última posición conocida de cada repartidor (memoria; se pierde si el objeto se apaga). */
  readonly posiciones = new Map<string, Posicion>();
  /** Lo que todavía no llegó al servidor (la más nueva reemplaza a la vieja). */
  readonly pendientes = new Map<string, Posicion>();
  private enviando = false;

  constructor(
    private readonly estado: EstadoZona,
    private readonly env: EntornoZona,
    readonly zona: string,
    private readonly ahora: () => number = () => Date.now(),
    private readonly hacer: typeof fetch = (...a) => fetch(...a),
  ) {
    this.estado.sql.exec(
      `CREATE TABLE IF NOT EXISTS avisos (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
         usuarios TEXT NOT NULL, pedido TEXT NOT NULL, datos TEXT NOT NULL, creado INTEGER NOT NULL)`,
    );
    this.estado.sql.exec(
      'CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, recibido INTEGER NOT NULL)',
    );
  }

  // ------------------------------------------------------------ conexiones

  /** Acepta un socket ya autorizado (el Worker verificó el pase). */
  conectar(ws: SocketZona, pase: PaseTiempoReal): void {
    const etiquetas = [`u:${pase.u}`];
    if (pase.rol === 'cliente' && pase.p) {
      etiquetas.push(`p:${pase.p}`);
      if (pase.r) etiquetas.push(`sigue:${pase.r}`);
    }
    this.estado.acceptWebSocket(ws, etiquetas);
    const ficha: Ficha = {
      u: pase.u,
      rol: pase.rol,
      ...(pase.p ? { p: pase.p } : {}),
      ...(pase.r ? { r: pase.r } : {}),
      exp: pase.exp,
      ultimoT: 0,
      vIni: this.ahora(),
      vN: 0,
      avisosLimite: 0,
    };
    ws.serializeAttachment(ficha);
  }

  private enviar(ws: SocketZona, m: MensajeServidor) {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      // socket cerrado: el cliente reconecta y pide lo que le falta
    }
  }

  async mensaje(ws: SocketZona, crudo: string | ArrayBuffer): Promise<void> {
    const ficha = ws.deserializeAttachment() as Ficha | null;
    if (!ficha) return ws.close(1011, 'sin_ficha');
    const ahora = this.ahora();
    if (ficha.exp * 1000 <= ahora) {
      this.enviar(ws, { tipo: 'pase_vencido' });
      return ws.close(4001, 'pase_vencido');
    }
    // Límite de mensajes por conexión.
    if (ahora - ficha.vIni > VENTANA_LIMITE_MS) {
      ficha.vIni = ahora;
      ficha.vN = 0;
    }
    ficha.vN++;
    ws.serializeAttachment(ficha);
    if (ficha.vN > LIMITE_MENSAJES) {
      if (ficha.vN > LIMITE_MENSAJES * 3) ws.close(1008, 'demasiados_mensajes');
      else if (ficha.vN === LIMITE_MENSAJES + 1)
        this.enviar(ws, { tipo: 'error', codigo: 'demasiados_mensajes' });
      return;
    }
    if (typeof crudo !== 'string' || crudo.length > MAX_MENSAJE)
      return this.enviar(ws, { tipo: 'error', codigo: 'mensaje_invalido' });
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(crudo) as Record<string, unknown>;
    } catch {
      return this.enviar(ws, { tipo: 'error', codigo: 'mensaje_invalido' });
    }
    if (m.tipo === 'ping') return this.enviar(ws, { tipo: 'pong' });
    if (m.tipo === 'hola') return this.hola(ws, ficha, Number(m.desde) || 0);
    if (m.tipo === 'ubicacion') return this.ubicacion(ws, ficha, m);
    this.enviar(ws, { tipo: 'error', codigo: 'tipo_desconocido' });
  }

  /** Al (re)conectar: bienvenida y todo aviso guardado posterior al último que vio. */
  private hola(ws: SocketZona, ficha: Ficha, desde: number) {
    const corte = this.ahora() - AVISOS_GUARDADOS_MIN * 60_000;
    const filas = this.estado.sql
      .exec(
        `SELECT seq, datos FROM avisos WHERE seq > ? AND creado >= ?
           AND (instr(usuarios, ?) > 0 OR (pedido != '' AND pedido = ?)) ORDER BY seq LIMIT 100`,
        desde,
        corte,
        `|${ficha.u}|`,
        ficha.p ?? '',
      )
      .toArray();
    const ultimo = this.estado.sql
      .exec('SELECT COALESCE(MAX(seq), 0) AS s FROM avisos')
      .toArray()[0];
    this.enviar(ws, { tipo: 'bienvenida', zona: this.zona, ultimoSeq: Number(ultimo?.s ?? 0) });
    for (const f of filas)
      this.enviar(ws, {
        tipo: 'aviso',
        seq: Number(f.seq),
        datos: JSON.parse(String(f.datos)) as Record<string, unknown>,
      });
  }

  private ubicacion(ws: SocketZona, ficha: Ficha, m: Record<string, unknown>) {
    const id = typeof m.id === 'string' ? m.id.slice(0, 64) : '';
    if (ficha.rol !== 'repartidor')
      return this.enviar(ws, { tipo: 'error', codigo: 'no_permitido' });
    const lat = Number(m.lat);
    const lng = Number(m.lng);
    const t = Number(m.t);
    const ahora = this.ahora();
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(t) ||
      t > ahora + 60_000 ||
      t < ahora - 10 * 60_000
    )
      return this.enviar(ws, { tipo: 'ack', id, resultado: 'invalida' });
    const previa = this.posiciones.get(ficha.u);
    // Duplicada o fuera de orden: la más nueva manda.
    if (previa && t <= previa.t)
      return this.enviar(ws, { tipo: 'ack', id, resultado: 'duplicada' });
    const nueva = { lat, lng, t };
    if (previa && distanciaM(previa, nueva) / Math.max(1, (t - previa.t) / 1000) > VELOCIDAD_MAX_MS)
      return this.enviar(ws, { tipo: 'ack', id, resultado: 'salto' });
    this.posiciones.set(ficha.u, nueva);
    this.pendientes.set(ficha.u, nueva);
    ficha.ultimoT = t;
    ws.serializeAttachment(ficha);
    // A quien sigue a este repartidor (el cliente de su pedido). Efímero: no se guarda.
    for (const s of this.estado.getWebSockets(`sigue:${ficha.u}`))
      this.enviar(s, { tipo: 'posicion', c: ficha.u, lat, lng, t });
    this.enviar(ws, { tipo: 'ack', id, resultado: 'ok' });
    void this.asegurarAlarma();
  }

  private async asegurarAlarma() {
    if ((await this.estado.getAlarm()) == null)
      await this.estado.setAlarm(this.ahora() + LOTE_CADA_MS);
  }

  // ------------------------------------------------------------ desde el servidor (ya firmado)

  /** ¿Es nuevo este nonce? Lo anota en la misma sentencia (una petición firmada vale una vez). */
  nonceNuevo(nonce: string): boolean {
    const r = this.estado.sql
      .exec(
        'INSERT OR IGNORE INTO nonces (nonce, recibido) VALUES (?, ?) RETURNING nonce',
        nonce,
        this.ahora(),
      )
      .toArray();
    return r.length > 0;
  }

  /** Avisos del servidor (ofertas, cambios de estado). Un mismo id se entrega una sola vez. */
  avisar(
    avisos: {
      id: string;
      para: { usuarios?: string[]; pedido?: string };
      datos: Record<string, unknown>;
    }[],
  ): { entregados: number; repetidos: number } {
    let entregados = 0;
    let repetidos = 0;
    for (const a of avisos.slice(0, 100)) {
      const usuarios = (a.para.usuarios ?? []).slice(0, 200);
      const pedido = a.para.pedido ?? '';
      const fila = this.estado.sql
        .exec(
          `INSERT OR IGNORE INTO avisos (id, usuarios, pedido, datos, creado) VALUES (?, ?, ?, ?, ?) RETURNING seq`,
          String(a.id).slice(0, 64),
          `|${usuarios.join('|')}|`,
          pedido,
          JSON.stringify(a.datos ?? {}),
          this.ahora(),
        )
        .toArray()[0];
      if (!fila) {
        repetidos++;
        continue;
      }
      const m: MensajeServidor = { tipo: 'aviso', seq: Number(fila.seq), datos: a.datos ?? {} };
      const destinos = new Set<SocketZona>();
      for (const u of usuarios)
        for (const s of this.estado.getWebSockets(`u:${u}`)) destinos.add(s);
      if (pedido) for (const s of this.estado.getWebSockets(`p:${pedido}`)) destinos.add(s);
      for (const s of destinos) this.enviar(s, m);
      entregados += destinos.size;
    }
    return { entregados, repetidos };
  }

  /** Los repartidores más cercanos a un punto (solo id y distancia), para el despacho futuro. */
  candidatos(lat: number, lng: number, limite = 10): { c: string; km: number }[] {
    const vigente = this.ahora() - 2 * 60_000;
    return [...this.posiciones]
      .filter(([, p]) => p.t >= vigente)
      .map(([c, p]) => ({ c, km: Math.round(distanciaM({ lat, lng, t: 0 }, p) / 10) / 100 }))
      .sort((a, b) => a.km - b.km)
      .slice(0, Math.min(50, Math.max(1, limite)));
  }

  // ------------------------------------------------------------ alarma: lote al servidor y limpieza

  async alarma(): Promise<{ enviadas: number; ok: boolean }> {
    const ahora = this.ahora();
    this.estado.sql.exec(
      'DELETE FROM avisos WHERE creado < ?',
      ahora - AVISOS_GUARDADOS_MIN * 60_000,
    );
    this.estado.sql.exec('DELETE FROM nonces WHERE recibido < ?', ahora - 10 * 60_000);
    let enviadas = 0;
    let ok = true;
    if (!this.enviando && this.pendientes.size) {
      this.enviando = true;
      try {
        const lista = [...this.pendientes].slice(0, MAX_POR_LOTE);
        const cuerpo = JSON.stringify({
          loteId: `${this.zona}-${ahora}-${Math.random().toString(36).slice(2, 8)}`
            .replace(/[^A-Za-z0-9_-]/g, '-')
            .slice(0, 64),
          zona: this.zona,
          muestras: lista.map(([c, p]) => ({ c, lat: p.lat, lng: p.lng, t: p.t })),
        });
        ok = await this.mandarAlServidor('/datos/interno/ubicaciones/lote', cuerpo);
        if (ok) {
          // Se borra solo lo que se mandó y no cambió mientras tanto (lo nuevo va en el próximo).
          for (const [c, p] of lista)
            if (this.pendientes.get(c)?.t === p.t) this.pendientes.delete(c);
          enviadas = lista.length;
        }
      } finally {
        this.enviando = false;
      }
    }
    // Mientras haya conexiones o algo por mandar, la alarma sigue.
    if (this.pendientes.size || this.estado.getWebSockets().length)
      await this.estado.setAlarm(ahora + LOTE_CADA_MS);
    return { enviadas, ok };
  }

  private async mandarAlServidor(ruta: string, cuerpo: string): Promise<boolean> {
    if (!this.env.INTERNO_LLAVE_ID || !this.env.INTERNO_SECRETO) return false;
    const llave: LlaveFirma = { id: this.env.INTERNO_LLAVE_ID, secreto: this.env.INTERNO_SECRETO };
    try {
      const h = await firmarPeticion(llave, 'POST', ruta, cuerpo, Math.floor(this.ahora() / 1000));
      const r = await this.hacer(new URL(ruta, this.env.BACKEND_URL).toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...h },
        body: cuerpo,
        signal: AbortSignal.timeout(5000),
      });
      return r.ok;
    } catch (e) {
      console.error('tiempo real: lote', e);
      return false;
    }
  }
}
