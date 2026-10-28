import { ErrorApi } from './api';

/**
 * Cola sin señal de la app del repartidor: la foto de la entrega (o «entregado en mano») se guarda
 * en el celular si no hay red y se reintenta sola; mientras tanto la pantalla dice «pendiente de
 * confirmar». Lo que el servidor rechaza (409, 422…) sale de la cola y se muestra el motivo.
 */
export type Pendiente = {
  id: string;
  ruta: string;
  tipo: 'foto' | 'json';
  /** La foto como «data:…» o el cuerpo JSON como texto. */
  cuerpo: string;
  creadoEn: number;
};

export type AlmacenCola = {
  leer(): Promise<string | null>;
  escribir(valor: string): Promise<void>;
};

/** Sin respuesta del servidor (la app marca estado 0 cuando no hay red). */
export const esFalloDeRed = (x: unknown) => x instanceof ErrorApi && x.estado === 0;

/**
 * C-COLA-ERROR-PASAJERO (28 oct 2026, visto en el recorrido de producción): sin red, un error del
 * servidor (5xx), «demasiados intentos» (429) o «se agotó el tiempo» (408) son pasajeros: la entrega
 * se queda guardada y se reintenta. Antes un 500 la botaba de la cola y la foto se perdía.
 */
export const sePuedeReintentar = (x: unknown) =>
  x instanceof ErrorApi &&
  (x.estado === 0 || x.estado >= 500 || x.estado === 429 || x.estado === 408);

export function crearCola(almacen: AlmacenCola) {
  async function listar(): Promise<Pendiente[]> {
    try {
      const v = JSON.parse((await almacen.leer()) ?? '[]') as unknown;
      return Array.isArray(v) ? (v as Pendiente[]) : [];
    } catch {
      return [];
    }
  }
  const guardar = (lista: Pendiente[]) => almacen.escribir(JSON.stringify(lista));
  return {
    listar,
    async agregar(p: Omit<Pendiente, 'id' | 'creadoEn'>): Promise<Pendiente> {
      const nuevo: Pendiente = {
        ...p,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        creadoEn: Date.now(),
      };
      await guardar([...(await listar()), nuevo]);
      return nuevo;
    },
    async quitar(id: string) {
      await guardar((await listar()).filter((p) => p.id !== id));
    },
    /**
     * Manda lo pendiente en orden. Sin red o con un error pasajero se detiene y lo deja para el
     * próximo intento; si el servidor lo rechaza de verdad (409, 422…), lo saca y devuelve el motivo.
     */
    async reintentar(enviar: (p: Pendiente) => Promise<void>) {
      const enviados: Pendiente[] = [];
      const rechazados: { pendiente: Pendiente; error: string }[] = [];
      for (const p of await listar()) {
        try {
          await enviar(p);
          enviados.push(p);
          await this.quitar(p.id);
        } catch (x) {
          if (sePuedeReintentar(x)) break;
          rechazados.push({ pendiente: p, error: x instanceof Error ? x.message : String(x) });
          await this.quitar(p.id);
        }
      }
      return { enviados, rechazados };
    },
  };
}
