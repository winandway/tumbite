/**
 * Fase 2 · Protocolo del tiempo real y conexión de las apps (docs/FASE-2-TIEMPO-REAL.md).
 *
 * El Worker externo guarda posiciones y reparte mensajes; NUNCA decide nada de dinero ni de
 * estado. Las apps hablan con él por WebSocket con un pase corto (15 min) que emite el servidor.
 *
 * Recuperación:
 *   - Cada aviso del servidor lleva un número de orden (`seq`) por zona. La app recuerda el último
 *     que vio y, al reconectar, lo manda en «hola»: el Worker reenvía lo que se perdió.
 *   - La app descarta un `seq` que ya vio (avisos duplicados).
 *   - Mientras no hay conexión, la app guarda SOLO la última posición (la más nueva manda).
 *   - Tras varios intentos fallidos, la app pasa a «respaldo»: vuelve a la consulta normal al
 *     servidor y a la ruta de ubicación de siempre, y sigue intentando reconectar más despacio.
 */

export const PROTOCOLO_TIEMPO_REAL = 'tumbite-v1';

export type MensajeApp =
  | { tipo: 'hola'; desde?: number }
  | { tipo: 'ubicacion'; id: string; lat: number; lng: number; t: number; precision?: number }
  | { tipo: 'ping' };

export type MensajeServidor =
  | { tipo: 'bienvenida'; zona: string; ultimoSeq: number }
  | { tipo: 'aviso'; seq: number; datos: Record<string, unknown> }
  | { tipo: 'posicion'; c: string; lat: number; lng: number; t: number }
  | { tipo: 'ack'; id: string; resultado: 'ok' | 'duplicada' | 'salto' | 'invalida' }
  | { tipo: 'pase_vencido' }
  | { tipo: 'error'; codigo: string }
  | { tipo: 'pong' };

/** Lo mínimo que la conexión necesita de un WebSocket (el del navegador o el de React Native). */
export interface SocketMinimo {
  readyState: number;
  send(datos: string): void;
  close(codigo?: number, motivo?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code?: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type OpcionesConexion = {
  /** Pide un pase nuevo al servidor (POST /datos/tiempo-real/pase). null = no disponible. */
  obtenerPase: () => Promise<{ pase: string; vence: number; url: string } | null>;
  /** Crea el socket: `new WebSocket(url, protocolos)`. */
  abrir: (url: string, protocolos: string[]) => SocketMinimo;
  /** Ruta del WebSocket en el Worker: '/v1/conexion' o '/v1/seguir/<pedido>'. */
  ruta: string;
  alAviso?: (datos: Record<string, unknown>, seq: number) => void;
  alPosicion?: (p: { c: string; lat: number; lng: number; t: number }) => void;
  /** true = sin tiempo real: la app vuelve a la consulta y a la ruta de ubicación de siempre. */
  alRespaldo?: (enRespaldo: boolean) => void;
  /** Para pruebas: reloj y temporizador. */
  ahora?: () => number;
  esperar?: (ms: number, fn: () => void) => unknown;
  cancelar?: (id: unknown) => void;
  azar?: () => number;
};

/** Intentos seguidos sin éxito antes de pasar a respaldo. */
export const INTENTOS_ANTES_DE_RESPALDO = 3;
const ESPERA_MIN_MS = 1000;
const ESPERA_MAX_MS = 30_000;

/** Espera exponencial con ruido (1 s, 2 s, 4 s… hasta 30 s), para no reconectar todos a la vez. */
export function esperaReconexion(intento: number, azar = Math.random): number {
  const base = Math.min(ESPERA_MAX_MS, ESPERA_MIN_MS * 2 ** Math.max(0, intento - 1));
  return Math.round(base / 2 + azar() * (base / 2));
}

export class ConexionTiempoReal {
  private socket: SocketMinimo | null = null;
  private ultimoSeq = 0;
  private vistos = new Set<number>();
  private ultimaPosicion: Extract<MensajeApp, { tipo: 'ubicacion' }> | null = null;
  private fallos = 0;
  private enRespaldo = false;
  private cerrada = false;
  private temporizador: unknown = null;
  private paseVence = 0;
  private readonly o: Required<Pick<OpcionesConexion, 'ahora' | 'esperar' | 'cancelar' | 'azar'>> &
    OpcionesConexion;

  constructor(opciones: OpcionesConexion) {
    this.o = {
      ahora: () => Date.now(),
      esperar: (ms, fn) => setTimeout(fn, ms),
      cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      azar: Math.random,
      ...opciones,
    };
  }

  get estado() {
    return {
      conectada: this.socket?.readyState === 1,
      enRespaldo: this.enRespaldo,
      ultimoSeq: this.ultimoSeq,
      fallos: this.fallos,
    };
  }

  async iniciar(): Promise<void> {
    this.cerrada = false;
    await this.conectar();
  }

  cerrar(): void {
    this.cerrada = true;
    if (this.temporizador) this.o.cancelar(this.temporizador);
    this.socket?.close(1000, 'cerrada');
    this.socket = null;
  }

  /** Manda la ubicación; sin conexión, se queda solo con la última (la más nueva manda). */
  enviarUbicacion(lat: number, lng: number, precision?: number): void {
    const t = this.o.ahora();
    this.ultimaPosicion = {
      tipo: 'ubicacion',
      id: `${t}`,
      lat,
      lng,
      t,
      ...(precision != null ? { precision } : {}),
    };
    this.vaciarPosicion();
  }

  private vaciarPosicion() {
    if (!this.ultimaPosicion || this.socket?.readyState !== 1) return;
    this.socket.send(JSON.stringify(this.ultimaPosicion));
  }

  private cambiarRespaldo(v: boolean) {
    if (this.enRespaldo === v) return;
    this.enRespaldo = v;
    this.o.alRespaldo?.(v);
  }

  private programar() {
    if (this.cerrada) return;
    this.fallos++;
    if (this.fallos >= INTENTOS_ANTES_DE_RESPALDO) this.cambiarRespaldo(true);
    this.temporizador = this.o.esperar(esperaReconexion(this.fallos, this.o.azar), () => {
      void this.conectar();
    });
  }

  private async conectar(): Promise<void> {
    if (this.cerrada) return;
    let datos: Awaited<ReturnType<OpcionesConexion['obtenerPase']>>;
    try {
      datos = await this.o.obtenerPase();
    } catch {
      datos = null;
    }
    if (!datos) return this.programar();
    this.paseVence = datos.vence * 1000;
    let s: SocketMinimo;
    try {
      s = this.o.abrir(new URL(this.o.ruta, datos.url).toString(), [
        PROTOCOLO_TIEMPO_REAL,
        datos.pase,
      ]);
    } catch {
      return this.programar();
    }
    this.socket = s;
    s.onopen = () => {
      this.fallos = 0;
      this.cambiarRespaldo(false);
      s.send(JSON.stringify({ tipo: 'hola', desde: this.ultimoSeq } satisfies MensajeApp));
      this.vaciarPosicion();
    };
    s.onmessage = (ev) => this.recibir(ev.data);
    s.onerror = () => undefined;
    s.onclose = () => {
      if (this.socket === s) this.socket = null;
      this.programar();
    };
  }

  private recibir(crudo: unknown) {
    if (typeof crudo !== 'string' || crudo.length > 64_000) return;
    let m: MensajeServidor;
    try {
      m = JSON.parse(crudo) as MensajeServidor;
    } catch {
      return;
    }
    if (m.tipo === 'aviso') {
      if (this.vistos.has(m.seq)) return; // duplicado: ya se mostró
      this.vistos.add(m.seq);
      if (this.vistos.size > 500) this.vistos = new Set([...this.vistos].slice(-250));
      this.ultimoSeq = Math.max(this.ultimoSeq, m.seq);
      this.o.alAviso?.(m.datos, m.seq);
    } else if (m.tipo === 'posicion') this.o.alPosicion?.(m);
    else if (m.tipo === 'ack' && this.ultimaPosicion?.id === m.id) this.ultimaPosicion = null;
    else if (m.tipo === 'pase_vencido') this.socket?.close(4001, 'pase_vencido');
  }

  /** Para la app: cuánto falta para que venza el pase (renovarlo antes con otra conexión). */
  msParaVencer(): number {
    return this.paseVence - this.o.ahora();
  }
}
