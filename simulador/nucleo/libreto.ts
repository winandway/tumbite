import { type Actor, type OpcionesActor, type Peticion, crearActor } from './actor.ts';
import { type Azar, crearAzar } from './azar.ts';
import { type OpcionesEspera, type Reloj, esperarHasta, resumir } from './reloj.ts';

/**
 * El libreto: escenarios con nombre, hechos de pasos con nombre. Cada paso guarda cuánto tardó, qué
 * peticiones hizo cada actor y, si falló, por qué y qué respondió el servidor en ese momento.
 *
 * Un escenario puede llevar `falloConocido`: es un fallo del producto que ya se encontró y todavía
 * no se arregló. Sigue corriendo y sale en rojo en el reporte con esa explicación; la corrida no se
 * da por buena mientras exista (no se esconde), pero el reporte separa lo nuevo de lo ya conocido.
 */
export type Escenario<C> = {
  nombre: string;
  descripcion: string;
  /** Para elegir subconjuntos (por ejemplo, «diario» para la pasada contra el sitio de pruebas). */
  etiquetas?: readonly string[];
  /** Candados o reglas que este escenario vigila (aparecen en el reporte). */
  vigila?: readonly string[];
  falloConocido?: string;
  /** Tope de tiempo del escenario entero. */
  topeMs?: number;
  correr(e: Ejecucion, ctx: C): Promise<void>;
};

export type Paso = {
  nombre: string;
  t: number;
  ms: number;
  ok: boolean;
  error?: string;
  /** Lo último que respondió el servidor dentro del paso que falló. */
  ultimaRespuesta?: Peticion;
  peticiones: Peticion[];
  notas: string[];
};

export type ResultadoEscenario = {
  nombre: string;
  descripcion: string;
  vigila: readonly string[];
  etiquetas: readonly string[];
  ok: boolean;
  falloConocido?: string;
  ms: number;
  error?: string;
  pasos: Paso[];
  filas?: { leidas: number; escritas: number } | null;
  comprobaciones: { texto: string; ok: boolean }[];
};

export type ResultadoCorrida = {
  corrida: string;
  semilla: number;
  destino: string;
  inicio: string;
  ms: number;
  ok: boolean;
  escenarios: ResultadoEscenario[];
  filas?: { leidas: number; escritas: number } | null;
  notas: string[];
};

export class ErrorComprobacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorComprobacion';
  }
}

export type Ejecucion = {
  azar: Azar;
  reloj: Reloj;
  /** Un actor nuevo cuyas peticiones caen en la línea de tiempo de este escenario. */
  actor(op: Omit<OpcionesActor, 'reloj' | 'anotar'>): Actor;
  paso<T>(nombre: string, hacer: () => Promise<T>): Promise<T>;
  /** Si no se cumple, el paso (y el escenario) fallan con ese mensaje. */
  comprobar(condicion: unknown, mensaje: string, visto?: unknown): void;
  esperar<T>(
    que: string,
    intento: () => Promise<T | undefined | null | false | { listo: false; visto: unknown }>,
    op?: OpcionesEspera,
  ): Promise<T>;
  nota(texto: string): void;
};

export type OpcionesLibreto<C> = {
  corrida: string;
  semilla: number;
  destino: string;
  reloj: Reloj;
  escenarios: readonly Escenario<C>[];
  /** Arma lo que cada escenario necesita (cuentas, cabeceras…). Recibe el número del escenario. */
  contexto(e: Ejecucion, indice: number, escenario: Escenario<C>): Promise<C> | C;
  /** Lo que se hace al final de cada escenario, aunque haya fallado (desconectar, cerrar). */
  despues?(e: Ejecucion, ctx: C): Promise<void>;
  /** Filas leídas y escritas por el servidor en este escenario (si el paquete sabe medirlas). */
  filas?(ctx: C, indice: number): Promise<{ leidas: number; escritas: number } | null>;
  alEmpezar?(escenario: Escenario<C>, indice: number, total: number): void;
  alTerminar?(r: ResultadoEscenario): void;
};

export async function correrLibreto<C>(op: OpcionesLibreto<C>): Promise<ResultadoCorrida> {
  const inicioCorrida = op.reloj.ahora();
  const resultados: ResultadoEscenario[] = [];
  for (const [indice, esc] of op.escenarios.entries()) {
    op.alEmpezar?.(esc, indice, op.escenarios.length);
    const r = await correrEscenario(op, esc, indice);
    resultados.push(r);
    op.alTerminar?.(r);
  }
  const conFilas = resultados.filter((r) => r.filas);
  return {
    corrida: op.corrida,
    semilla: op.semilla,
    destino: op.destino,
    inicio: new Date(Date.now() - (op.reloj.ahora() - inicioCorrida)).toISOString(),
    ms: op.reloj.ahora() - inicioCorrida,
    ok: resultados.every((r) => r.ok),
    escenarios: resultados,
    filas: conFilas.length
      ? {
          leidas: conFilas.reduce((s, r) => s + (r.filas?.leidas ?? 0), 0),
          escritas: conFilas.reduce((s, r) => s + (r.filas?.escritas ?? 0), 0),
        }
      : null,
    notas: [],
  };
}

/**
 * Una SESIÓN con varias historias a la vez (el «modo ciudad»): `siguiente` va dando historias nuevas
 * (o null cuando ya no hay que empezar más), con hasta `concurrencia` corriendo a la vez y una pausa
 * creíble entre una y otra. `alAvanzar` se llama cada vez que termina una: si devuelve false, no se
 * empiezan más y se espera a que terminen las que están en curso. Nada aquí sabe de qué app es.
 */
export type OpcionesSesion<C> = Omit<OpcionesLibreto<C>, 'escenarios' | 'alEmpezar'> & {
  siguiente(n: number): Escenario<C> | null;
  concurrencia: number;
  pausaMs(): number;
  alAvanzar?(hechos: readonly ResultadoEscenario[]): Promise<boolean>;
};

export async function correrSesion<C>(op: OpcionesSesion<C>): Promise<ResultadoCorrida> {
  const inicio = op.reloj.ahora();
  const resultados: ResultadoEscenario[] = [];
  const enCurso = new Set<Promise<void>>();
  let seguir = true;
  for (let n = 0; seguir; n++) {
    while (enCurso.size >= op.concurrencia) await Promise.race(enCurso);
    if (!seguir) break;
    const esc = op.siguiente(n);
    if (!esc) break;
    const p: Promise<void> = correrEscenario({ ...op, escenarios: [] }, esc, n).then(async (r) => {
      resultados.push(r);
      op.alTerminar?.(r);
      if (op.alAvanzar && !(await op.alAvanzar(resultados))) seguir = false;
      enCurso.delete(p);
    });
    enCurso.add(p);
    await op.reloj.dormir(op.pausaMs());
  }
  await Promise.all(enCurso);
  const conFilas = resultados.filter((r) => r.filas);
  return {
    corrida: op.corrida,
    semilla: op.semilla,
    destino: op.destino,
    inicio: new Date(Date.now() - (op.reloj.ahora() - inicio)).toISOString(),
    ms: op.reloj.ahora() - inicio,
    ok: resultados.every((r) => r.ok),
    escenarios: resultados,
    filas: conFilas.length
      ? {
          leidas: conFilas.reduce((s, r) => s + (r.filas?.leidas ?? 0), 0),
          escritas: conFilas.reduce((s, r) => s + (r.filas?.escritas ?? 0), 0),
        }
      : null,
    notas: [],
  };
}

async function correrEscenario<C>(
  op: OpcionesLibreto<C>,
  esc: Escenario<C>,
  indice: number,
): Promise<ResultadoEscenario> {
  const { reloj } = op;
  const t0 = reloj.ahora();
  // Cada escenario tiene su propio azar derivado de la semilla: correr uno solo repite lo mismo.
  const azar = crearAzar((op.semilla ^ Math.imul(indice + 1, 2654435761)) >>> 0);
  const pasos: Paso[] = [];
  const comprobaciones: { texto: string; ok: boolean }[] = [];
  const sueltas: Paso = {
    nombre: '(preparación)',
    t: 0,
    ms: 0,
    ok: true,
    peticiones: [],
    notas: [],
  };
  let actual: Paso = sueltas;

  const e: Ejecucion = {
    azar,
    reloj,
    actor: (o) =>
      crearActor({
        ...o,
        reloj,
        anotar: (p) => actual.peticiones.push({ ...p, t: reloj.ahora() - t0 }),
      }),
    paso: async (nombre, hacer) => {
      const paso: Paso = {
        nombre,
        t: reloj.ahora() - t0,
        ms: 0,
        ok: true,
        peticiones: [],
        notas: [],
      };
      const anterior = actual;
      actual = paso;
      pasos.push(paso);
      try {
        return await hacer();
      } catch (err) {
        paso.ok = false;
        paso.error = mensajeDe(err);
        paso.ultimaRespuesta = paso.peticiones.at(-1);
        throw new ErrorPaso(nombre, err);
      } finally {
        paso.ms = reloj.ahora() - t0 - paso.t;
        actual = anterior;
      }
    },
    comprobar(condicion, mensaje, visto) {
      comprobaciones.push({ texto: mensaje, ok: Boolean(condicion) });
      if (!condicion)
        throw new ErrorComprobacion(
          visto === undefined ? mensaje : `${mensaje} (visto: ${resumir(visto, 500)})`,
        );
    },
    esperar: (que, intento, o) => esperarHasta(reloj, que, intento, o),
    nota: (texto) => actual.notas.push(texto),
  };

  let ctx: C | undefined;
  let error: string | undefined;
  try {
    ctx = await op.contexto(e, indice, esc);
    const tope = esc.topeMs ?? 180_000;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      esc.correr(e, ctx).finally(() => clearTimeout(temporizador)),
      new Promise<never>((_, no) => {
        temporizador = setTimeout(
          () => no(new Error(`el escenario pasó de su tope de ${Math.round(tope / 1000)} s`)),
          tope,
        );
      }),
    ]);
  } catch (err) {
    error = mensajeDe(err);
  }
  if (ctx !== undefined && op.despues)
    await op.despues(e, ctx).catch((err: unknown) => {
      sueltas.notas.push(`al cerrar: ${mensajeDe(err)}`);
    });
  const filas =
    ctx !== undefined && op.filas ? await op.filas(ctx, indice).catch(() => null) : null;
  if (sueltas.peticiones.length || sueltas.notas.length) pasos.unshift(sueltas);
  return {
    nombre: esc.nombre,
    descripcion: esc.descripcion,
    vigila: esc.vigila ?? [],
    etiquetas: esc.etiquetas ?? [],
    ok: !error,
    ...(esc.falloConocido ? { falloConocido: esc.falloConocido } : {}),
    ms: reloj.ahora() - t0,
    ...(error ? { error } : {}),
    pasos,
    filas,
    comprobaciones,
  };
}

class ErrorPaso extends Error {
  constructor(paso: string, causa: unknown) {
    super(`${paso}: ${mensajeDe(causa)}`);
    this.name = 'ErrorPaso';
  }
}

function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  return resumir(e);
}

/** Elige escenarios por nombre (parte del nombre) o por etiqueta. Sin filtro, todos. */
export function filtrar<C>(
  escenarios: readonly Escenario<C>[],
  { solo, etiqueta }: { solo?: string | null; etiqueta?: string | null },
): Escenario<C>[] {
  return escenarios.filter(
    (e) =>
      (!solo ||
        solo.split(',').some((s) => e.nombre.toLowerCase().includes(s.trim().toLowerCase()))) &&
      (!etiqueta || (e.etiquetas ?? []).includes(etiqueta)),
  );
}
