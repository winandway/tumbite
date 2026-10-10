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
  const listo = useRef(false);
  const inicialRef = useRef(inicial);
  const sensiblesRef = useRef(sensibles);

  useEffect(() => {
    let vivo = true;
    listo.current = false;
    Promise.resolve(almacen.leer(llave))
      .then((guardado) => {
        if (!vivo || !guardado) return;
        try {
          const datos = JSON.parse(guardado) as Partial<T>;
          setValores({ ...inicialRef.current, ...datos });
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
    // Un formulario que quedó igual que al empezar no es un borrador: no se guarda.
    const inicialSinSensibles: Record<string, unknown> = { ...inicialRef.current };
    for (const campo of sensiblesRef.current) delete inicialSinSensibles[campo as string];
    const valoresIniciales = new Map(Object.entries(inicialSinSensibles));
    const vacio = Object.entries(copia).every(([k, val]) =>
      Object.is(val, valoresIniciales.get(k)),
    );
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

  /** Al guardar con éxito, al cancelar a propósito o al cerrar sesión. */
  const limpiar = useCallback(async () => {
    listo.current = false;
    pendiente.current = null;
    await almacen.borrar(llave);
    setValores(inicialRef.current);
    setRecuperado(false);
    listo.current = true;
  }, [almacen, llave]);

  return { valores, cambiar, setValores, recuperado, limpiar, empezarDeNuevo: limpiar };
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
