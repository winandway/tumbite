import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Regla de la casa: NINGÚN formulario pierde lo escrito.
 * Se guarda solo mientras se escribe (medio segundo después de la última tecla),
 * se devuelve al volver, se borra al guardar con éxito o al cancelar, y los campos
 * sensibles (contraseñas, códigos, tarjetas) nunca se guardan.
 */
export type Almacen = {
  leer: (llave: string) => Promise<string | null> | string | null;
  guardar: (llave: string, valor: string) => Promise<void> | void;
  borrar: (llave: string) => Promise<void> | void;
};

export const PREFIJO_BORRADOR = 'tumbite.borrador.';

export function llaveBorrador(formulario: string, cuenta?: string | null): string {
  return `${PREFIJO_BORRADOR}${formulario}.${cuenta || 'anonimo'}`;
}

export type OpcionesBorrador<T extends Record<string, unknown>> = {
  formulario: string;
  cuenta?: string | null;
  inicial: T;
  almacen: Almacen;
  sensibles?: (keyof T)[];
  esperaMs?: number;
  /**
   * Avisa cuando la app se va a segundo plano o la página se cierra, para guardar YA
   * sin esperar el medio segundo. En el navegador se usa solo; en el celular se pasa AppState.
   */
  alSalir?: (guardarYa: () => void) => () => void;
};

type Escuchable = {
  addEventListener?: (evento: string, f: () => void) => void;
  removeEventListener?: (evento: string, f: () => void) => void;
};

function alSalirNavegador(guardarYa: () => void): () => void {
  // Sin tipos del navegador a propósito: este paquete también corre en el servidor y en el celular.
  const ventana = globalThis as unknown as Escuchable & {
    document?: Escuchable & { visibilityState?: string };
  };
  const doc = ventana.document;
  if (
    typeof ventana.addEventListener !== 'function' ||
    !doc ||
    typeof doc.addEventListener !== 'function'
  )
    return () => {};
  const oculto = () => {
    if (doc.visibilityState === 'hidden') guardarYa();
  };
  ventana.addEventListener('pagehide', guardarYa);
  ventana.addEventListener('beforeunload', guardarYa);
  doc.addEventListener('visibilitychange', oculto);
  return () => {
    ventana.removeEventListener?.('pagehide', guardarYa);
    ventana.removeEventListener?.('beforeunload', guardarYa);
    doc.removeEventListener?.('visibilitychange', oculto);
  };
}

/** Un valor tal como cuenta para el borrador: el texto sin espacios de más (solo espacios = vacío). */
const normal = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
const mismo = (a: unknown, b: unknown) => {
  const [x, y] = [normal(a), normal(b)];
  if (Object.is(x, y)) return true;
  // Listas u objetos (casillas marcadas, por ejemplo): iguales si se escriben igual.
  return typeof x === 'object' && typeof y === 'object' && JSON.stringify(x) === JSON.stringify(y);
};

/**
 * C-BORRADOR-SIN-AVISO-VACIO (Richard, 25 nov 2026: «Recuperamos lo que estabas escribiendo» sin haber
 * escrito nada) — todos los formularios. ¿Lo guardado es igual a lo que ya estaba (en blanco, o lo que
 * vino del servidor)? Entonces no es un borrador: ni se guarda ni se avisa. Los campos sensibles no
 * cuentan. Pura (lleva su prueba).
 */
/** Lo guardado, solo con los campos que el formulario tiene hoy (si los declara). */
export function soloCamposDe<T extends Record<string, unknown>>(
  datos: Partial<T>,
  base: T,
): Partial<T> {
  const campos = new Set(Object.keys(base));
  if (!campos.size) return datos;
  return Object.fromEntries(Object.entries(datos).filter(([k]) => campos.has(k))) as Partial<T>;
}

export function borradorSinCambios<T extends Record<string, unknown>>(
  valores: Partial<T>,
  base: T,
  sensibles: readonly (keyof T)[] = [],
): boolean {
  const fuera = new Set<string>(sensibles.map(String));
  // Un campo que el formulario ya no tiene (de una versión vieja) no cuenta como escrito. Solo en un
  // formulario de campos libres (base sin campos) cuenta todo lo guardado.
  const deBase = Object.keys(base);
  const claves = new Set(deBase.length ? deBase : Object.keys(valores));
  const v = new Map(Object.entries(valores));
  const b = new Map(Object.entries(base));
  return [...claves].every((k) => fuera.has(k) || !v.has(k) || mismo(v.get(k), b.get(k)));
}

export function useBorrador<T extends Record<string, unknown>>(op: OpcionesBorrador<T>) {
  const {
    formulario,
    cuenta,
    inicial,
    almacen,
    sensibles = [],
    esperaMs = 500,
    alSalir = alSalirNavegador,
  } = op;
  const llave = llaveBorrador(formulario, cuenta);
  const [valores, setValores] = useState<T>(inicial);
  const [recuperado, setRecuperado] = useState(false);
  const recuperadoRef = useRef(false);
  const listo = useRef(false);
  const inicialRef = useRef(inicial);
  // Lo que ya está guardado de verdad (en blanco, o lo que vino del servidor). Igual a esto = no es borrador.
  const baseRef = useRef<T>(inicial);
  // C-BORRADOR-SIN-AVISO-VACIO: la base también como estado, para decidir el aviso al dibujar (cuando
  // la base llega tarde del servidor, el aviso se va solo si lo recuperado resultó igual).
  const [base, setBase] = useState<T>(inicial);
  const sensiblesRef = useRef(sensibles);
  const valoresRef = useRef<T>(inicial);
  useEffect(() => {
    valoresRef.current = valores;
  }, [valores]);

  useEffect(() => {
    let vivo = true;
    listo.current = false;
    Promise.resolve(almacen.leer(llave))
      .then((guardado) => {
        if (!vivo || !guardado) return;
        try {
          const datos = JSON.parse(guardado) as Partial<T>;
          // Un borrador igual a lo que ya estaba (vacío o viejo) se tira sin avisar nada.
          if (
            !datos ||
            typeof datos !== 'object' ||
            borradorSinCambios(datos, baseRef.current, sensiblesRef.current)
          ) {
            void Promise.resolve(almacen.borrar(llave)).catch(() => {});
            return;
          }
          setValores({ ...baseRef.current, ...soloCamposDe(datos, baseRef.current) });
          recuperadoRef.current = true;
          setRecuperado(true);
        } catch {
          void almacen.borrar(llave);
        }
      })
      .catch((e) => console.warn('borrador: no se pudo leer', e))
      .finally(() => {
        if (vivo) listo.current = true;
      });
    return () => {
      vivo = false;
    };
  }, [almacen, llave]);

  // Lo último escrito, pendiente de guardar (null = ya guardado).
  const pendiente = useRef<T | null>(null);

  const guardarYa = useCallback(() => {
    const v = pendiente.current;
    if (!v) return;
    pendiente.current = null;
    const copia: Record<string, unknown> = { ...v };
    for (const campo of sensiblesRef.current) delete copia[campo as string];
    // Un formulario igual a lo ya guardado (en blanco o lo que vino del servidor) no es borrador.
    const vacio = borradorSinCambios(copia as Partial<T>, baseRef.current, sensiblesRef.current);
    Promise.resolve(
      vacio ? almacen.borrar(llave) : almacen.guardar(llave, JSON.stringify(copia)),
    ).catch((e) => console.warn('borrador: no se pudo guardar', e));
  }, [almacen, llave]);

  useEffect(() => {
    if (!listo.current) return;
    pendiente.current = valores;
    const t = setTimeout(guardarYa, esperaMs);
    return () => clearTimeout(t);
  }, [valores, esperaMs, guardarYa]);

  // Si la página se cierra, la app se va a segundo plano o la pantalla se desmonta: se guarda ya.
  useEffect(() => {
    const quitar = alSalir(guardarYa);
    return () => {
      quitar();
      guardarYa();
    };
  }, [alSalir, guardarYa]);

  const cambiar = useCallback(<K extends keyof T>(campo: K, valor: T[K]) => {
    setValores((v) => ({ ...v, [campo]: valor }));
  }, []);

  /**
   * Llena el formulario con lo que YA está guardado (lo que vino del servidor, o lo recién
   * guardado). Eso no es un borrador: solo cuenta como borrador lo que la persona cambie después.
   */
  const cargar = useCallback(
    (v: T) => {
      baseRef.current = v;
      setBase(v);
      pendiente.current = null;
      void Promise.resolve(almacen.borrar(llave)).catch(() => {});
      setValores(v);
      recuperadoRef.current = false;
      setRecuperado(false);
    },
    [almacen, llave],
  );

  /**
   * Lo que vino del servidor al abrir la pantalla. Si la persona tenía algo a medio escribir,
   * eso manda y se queda encima; si no, el formulario se llena con lo guardado.
   */
  const cargarBase = useCallback(
    (v: T) => {
      baseRef.current = v;
      setBase(v);
      if (!recuperadoRef.current) {
        setValores(v);
        return;
      }
      // Lo recuperado resultó igual a lo que vino del servidor: no hay nada que avisar.
      if (borradorSinCambios(valoresRef.current, v, sensiblesRef.current)) {
        recuperadoRef.current = false;
        setRecuperado(false);
        void Promise.resolve(almacen.borrar(llave)).catch(() => {});
        setValores(v);
      }
    },
    [almacen, llave],
  );

  /** Al guardar con éxito, al cancelar a propósito o al cerrar sesión. */
  const limpiar = useCallback(async () => {
    listo.current = false;
    pendiente.current = null;
    await almacen.borrar(llave);
    baseRef.current = inicialRef.current;
    setBase(inicialRef.current);
    setValores(inicialRef.current);
    recuperadoRef.current = false;
    setRecuperado(false);
    listo.current = true;
  }, [almacen, llave]);

  /**
   * «Empezar de nuevo»: tira solo el borrador y vuelve a lo que ya estaba guardado (lo que vino
   * del servidor), no a un formulario vacío. Vaciarlo haría creer que se perdieron los datos y
   * se podrían guardar casillas en blanco encima. Si no hay nada guardado, queda vacío.
   */
  const empezarDeNuevo = useCallback(async () => {
    pendiente.current = null;
    await almacen.borrar(llave);
    setValores(baseRef.current);
    recuperadoRef.current = false;
    setRecuperado(false);
  }, [almacen, llave]);

  return {
    valores,
    cambiar,
    setValores,
    cargar,
    cargarBase,
    // El aviso sale solo si lo recuperado difiere de lo que el formulario tendría sin borrador.
    recuperado: recuperado && !borradorSinCambios(valores, base, sensibles),
    limpiar,
    empezarDeNuevo,
  };
}

/** Al cerrar sesión: borra todos los borradores de esa cuenta. */
export async function borrarBorradoresDe(
  almacen: Almacen & { llaves?: () => Promise<string[]> | string[] },
  cuenta: string,
) {
  const llaves = (await almacen.llaves?.()) ?? [];
  await Promise.all(
    llaves
      .filter((k) => k.startsWith(PREFIJO_BORRADOR) && k.endsWith(`.${cuenta}`))
      .map((k) => almacen.borrar(k)),
  );
}

/** Almacén del navegador. Si el navegador lo bloquea, no rompe el formulario. */
export const almacenNavegador: Almacen & { llaves: () => string[] } = {
  leer: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  guardar: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      console.warn('borrador: el navegador no deja guardar');
    }
  },
  borrar: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* sin almacenamiento: nada que borrar */
    }
  },
  llaves: () => {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  },
};
