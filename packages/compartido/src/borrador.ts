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
};

export function useBorrador<T extends Record<string, unknown>>(op: OpcionesBorrador<T>) {
  const { formulario, cuenta, inicial, almacen, sensibles = [], esperaMs = 500 } = op;
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

  useEffect(() => {
    if (!listo.current) return;
    const t = setTimeout(() => {
      const copia: Record<string, unknown> = { ...valores };
      for (const campo of sensiblesRef.current) delete copia[campo as string];
      Promise.resolve(almacen.guardar(llave, JSON.stringify(copia))).catch((e) =>
        console.warn('borrador: no se pudo guardar', e),
      );
    }, esperaMs);
    return () => clearTimeout(t);
  }, [valores, almacen, llave, esperaMs]);

  const cambiar = useCallback(<K extends keyof T>(campo: K, valor: T[K]) => {
    setValores((v) => ({ ...v, [campo]: valor }));
  }, []);

  /** Al guardar con éxito, al cancelar a propósito o al cerrar sesión. */
  const limpiar = useCallback(async () => {
    listo.current = false;
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
