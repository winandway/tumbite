import { type Reloj, resumir } from './reloj.ts';

/**
 * Un actor es una persona falsa (cliente, comercio, repartidor, soporte…) que le habla al servidor
 * por HTTP con su propia cuenta. No sabe nada del negocio: el paquete de cada app le pone las rutas.
 *
 * Reintenta SOLO los cortes de red (la conexión se cayó antes de tener respuesta). Una respuesta
 * 4xx o 5xx nunca se reintenta: es lo que el simulador vino a ver.
 *
 * Las «manías humanas» (doble toque, repetir tras un corte, tardar, hacer algo fuera de orden)
 * reproducen lo que hace la gente con un celular en la calle, que es donde salen los fallos que
 * las pruebas ordenadas no ven.
 */
export type Respuesta = {
  estado: number;
  ok: boolean;
  /** El cuerpo leído como JSON (o null si no era JSON). */
  datos: unknown;
  texto: string;
  ms: number;
};

export type Peticion = {
  /** Milisegundos desde el inicio del escenario. */
  t: number;
  actor: string;
  metodo: string;
  ruta: string;
  estado: number | 'red';
  ms: number;
  enviado?: string;
  respuesta?: string;
  /** Si la petición fue parte de una manía (doble toque, repetir tras corte, fuera de orden). */
  mania?: string;
};

export type OpcionesActor = {
  nombre: string;
  base: string;
  reloj: Reloj;
  /** Cabeceras que van en TODAS las peticiones (por ejemplo, la etiqueta de la vuelta de pruebas). */
  cabeceras?: Record<string, string>;
  /** Dónde se anota cada petición (la línea de tiempo del escenario). */
  anotar?: (p: Omit<Peticion, 't'>) => void;
  reintentosRed?: number;
  /** Para las pruebas del núcleo: otro fetch. */
  fetch?: typeof fetch;
};

export type Cuerpo = unknown | { bytes: Uint8Array; tipo: string };

export type Actor = {
  nombre: string;
  /** Pone el token de su sesión (Authorization: Bearer). */
  entrar(token: string): void;
  token(): string | null;
  pedir(
    metodo: string,
    ruta: string,
    cuerpo?: Cuerpo,
    extra?: { cabeceras?: Record<string, string>; mania?: string },
  ): Promise<Respuesta>;
  get(ruta: string): Promise<Respuesta>;
  post(ruta: string, cuerpo?: Cuerpo): Promise<Respuesta>;
  put(ruta: string, cuerpo?: Cuerpo): Promise<Respuesta>;
  patch(ruta: string, cuerpo?: Cuerpo): Promise<Respuesta>;
  manias: Manias;
};

export type Manias = {
  /** Toca dos veces el mismo botón: la MISMA petición dos veces a la vez. */
  dobleToque(metodo: string, ruta: string, cuerpo?: Cuerpo): Promise<[Respuesta, Respuesta]>;
  /**
   * La señal se cortó después de mandar: el servidor recibió la petición pero la respuesta se
   * perdió, y la app la manda otra vez. Devuelve las dos respuestas (la primera «perdida»).
   */
  repetirTrasCorte(metodo: string, ruta: string, cuerpo?: Cuerpo): Promise<[Respuesta, Respuesta]>;
  /** Se distrae: espera antes de seguir. */
  tardar(ms: number): Promise<void>;
  /** Hace algo antes de tiempo (por ejemplo, entregar sin haber recogido): se anota como manía. */
  fueraDeOrden(metodo: string, ruta: string, cuerpo?: Cuerpo): Promise<Respuesta>;
};

const esCuerpoBinario = (c: unknown): c is { bytes: Uint8Array; tipo: string } =>
  !!c &&
  typeof c === 'object' &&
  'bytes' in c &&
  (c as { bytes: unknown }).bytes instanceof Uint8Array;

export function crearActor(op: OpcionesActor): Actor {
  const { nombre, base, reloj, cabeceras = {}, anotar = () => {}, reintentosRed = 3 } = op;
  const hacerFetch = op.fetch ?? fetch;
  let token: string | null = null;

  const pedir: Actor['pedir'] = async (metodo, ruta, cuerpo, extra = {}) => {
    const h: Record<string, string> = { ...cabeceras, ...(extra.cabeceras ?? {}) };
    if (token) h.authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    let enviado: string | undefined;
    if (esCuerpoBinario(cuerpo)) {
      h['content-type'] = cuerpo.tipo;
      body = cuerpo.bytes as unknown as BodyInit;
      enviado = `(${cuerpo.tipo}, ${cuerpo.bytes.byteLength} bytes)`;
    } else if (cuerpo !== undefined) {
      h['content-type'] = 'application/json';
      body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
      enviado = resumir(body, 300);
    }
    const url = /^https?:/.test(ruta) ? ruta : `${base}${ruta}`;
    for (let intento = 1; ; intento++) {
      const inicio = reloj.ahora();
      try {
        const r = await hacerFetch(url, { method: metodo, headers: h, body });
        const texto = await r.text();
        let datos: unknown = null;
        try {
          datos = texto ? JSON.parse(texto) : null;
        } catch {
          datos = null;
        }
        const ms = reloj.ahora() - inicio;
        anotar({
          actor: nombre,
          metodo,
          ruta: ruta.split('?')[0] ?? ruta,
          estado: r.status,
          ms,
          ...(enviado ? { enviado } : {}),
          respuesta: resumir(texto, 600),
          ...(extra.mania ? { mania: extra.mania } : {}),
        });
        return { estado: r.status, ok: r.ok, datos, texto, ms };
      } catch (e) {
        const ms = reloj.ahora() - inicio;
        anotar({
          actor: nombre,
          metodo,
          ruta: ruta.split('?')[0] ?? ruta,
          estado: 'red',
          ms,
          respuesta: `corte de red: ${String(e)}`,
          ...(extra.mania ? { mania: extra.mania } : {}),
        });
        if (intento > reintentosRed) throw e;
        await reloj.dormir(500 * intento);
      }
    }
  };

  const manias: Manias = {
    dobleToque: async (metodo, ruta, cuerpo) => {
      const [a, b] = await Promise.all([
        pedir(metodo, ruta, cuerpo, { mania: 'doble toque' }),
        pedir(metodo, ruta, cuerpo, { mania: 'doble toque' }),
      ]);
      return [a, b];
    },
    repetirTrasCorte: async (metodo, ruta, cuerpo) => {
      const perdida = await pedir(metodo, ruta, cuerpo, { mania: 'respuesta perdida' });
      const otra = await pedir(metodo, ruta, cuerpo, { mania: 'reintento tras el corte' });
      return [perdida, otra];
    },
    tardar: (ms) => reloj.dormir(ms),
    fueraDeOrden: (metodo, ruta, cuerpo) =>
      pedir(metodo, ruta, cuerpo, { mania: 'fuera de orden' }),
  };

  return {
    nombre,
    entrar: (t) => {
      token = t;
    },
    token: () => token,
    pedir,
    get: (r) => pedir('GET', r),
    post: (r, c) => pedir('POST', r, c ?? {}),
    put: (r, c) => pedir('PUT', r, c ?? {}),
    patch: (r, c) => pedir('PATCH', r, c ?? {}),
    manias,
  };
}
