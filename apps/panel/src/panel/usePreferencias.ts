import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  type ClavePreferencia,
  type PantallaPreferencias,
  type Preferencias,
  limpiarPreferencias,
} from '@tumbite/compartido';
import { pedir } from './api';
import { SesionArmazon } from './armazon/Armazon';

/**
 * C-FILTROS-GUARDADOS (15 nov 2026, pedido de Richard). Todos los países. Los filtros de una
 * pantalla del superadmin (ciudad, estado, orden…), guardados por empleado:
 * - Pinta al instante con la copia de este navegador y después toma la del servidor (que sigue al
 *   empleado de una computadora a otra).
 * - Mirar no escribe. Un cambio se guarda en el servidor 1,5 s después del último (una escritura por
 *   ajuste, no una por tecla), y solo si quedó distinto de lo guardado.
 * - Nunca el texto buscado ni datos personales: solo las claves de `CLAVES_PREFERENCIAS`.
 */
export const ESPERA_GUARDAR_MS = 1_500;

const llaveLocal = (usuario: string, pantalla: string) => `tumbite.filtros.${usuario}.${pantalla}`;

function leerLocal(llave: string): Preferencias | null {
  try {
    const crudo = window.localStorage.getItem(llave);
    return crudo ? limpiarPreferencias(JSON.parse(crudo)) : null;
  } catch {
    return null; // navegador privado o almacenamiento bloqueado: se sigue con el servidor
  }
}
function escribirLocal(llave: string, v: Preferencias | null) {
  try {
    if (v) window.localStorage.setItem(llave, JSON.stringify(v));
    else window.localStorage.removeItem(llave);
  } catch {
    // Sin almacenamiento local se pierde solo el pintado instantáneo; el servidor guarda igual.
  }
}
const iguales = (a: Preferencias, b: Preferencias) =>
  JSON.stringify(limpiarPreferencias(a)) === JSON.stringify(limpiarPreferencias(b));

export function usePreferencias<V extends Preferencias>(
  pantalla: PantallaPreferencias,
  porDefecto: V,
) {
  const usuario = useContext(SesionArmazon).usuario?.id ?? 'sin-sesion';
  const llave = llaveLocal(usuario, pantalla);
  const defecto = useRef(porDefecto);
  const [valores, setValores] = useState<V>(() => ({
    ...porDefecto,
    ...(leerLocal(llave) ?? {}),
  }));
  /** Lo último que el servidor tiene guardado (para no escribir lo mismo otra vez). */
  const enServidor = useRef<Preferencias | null>(null);
  const [listo, setListo] = useState(false);
  const pendiente = useRef<Preferencias | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tocado = useRef(false);
  const actuales = useRef(valores);

  useEffect(() => {
    let vivo = true;
    pedir<{ valor: Preferencias; guardada: boolean }>(
      'GET',
      `/datos/admin/preferencias/${pantalla}`,
    )
      .then((r) => {
        if (!vivo) return;
        const del = limpiarPreferencias(r.valor);
        enServidor.current = r.guardada ? del : {};
        // Si la persona ya tocó un filtro mientras llegaba la respuesta, manda lo que tocó.
        if (!tocado.current) {
          const v = { ...defecto.current, ...del } as V;
          actuales.current = v;
          setValores(v);
          escribirLocal(llave, r.guardada ? del : null);
        }
      })
      .catch((e: unknown) => console.warn('filtros guardados: no se pudieron leer', e))
      .finally(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, [pantalla, llave]);

  const enviar = useCallback(() => {
    reloj.current = null;
    const v = pendiente.current;
    pendiente.current = null;
    if (!v || (enServidor.current && iguales(v, enServidor.current))) return;
    enServidor.current = v;
    void pedir('PUT', `/datos/admin/preferencias/${pantalla}`, { valor: v }).catch((e: unknown) => {
      enServidor.current = null; // se reintenta con el próximo cambio
      console.warn('filtros guardados: no se pudieron guardar', e);
    });
  }, [pantalla]);

  // Al salir de la pantalla, lo que esperaba su 1,5 s se manda ya (no se pierde).
  useEffect(
    () => () => {
      if (reloj.current) {
        clearTimeout(reloj.current);
        enviar();
      }
    },
    [enviar],
  );

  const cambiar = useCallback(
    (clave: ClavePreferencia, valor: string) => {
      tocado.current = true;
      const v = { ...actuales.current, [clave]: valor } as V;
      actuales.current = v;
      setValores(v);
      const limpio = limpiarPreferencias(v);
      escribirLocal(llave, limpio);
      pendiente.current = limpio;
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(enviar, ESPERA_GUARDAR_MS);
    },
    [llave, enviar],
  );

  const restablecer = useCallback(() => {
    tocado.current = true;
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = null;
    pendiente.current = null;
    actuales.current = { ...defecto.current };
    setValores(actuales.current);
    escribirLocal(llave, null);
    enServidor.current = {};
    void pedir('DELETE', `/datos/admin/preferencias/${pantalla}`).catch((e: unknown) =>
      console.warn('filtros guardados: no se pudieron restablecer', e),
    );
  }, [llave, pantalla]);

  /** Hay filtros guardados a la vista (distintos de los de fábrica): se muestra «Restablecer». */
  const guardados = !iguales(valores, porDefecto);
  return { valores, cambiar, restablecer, guardados, listo };
}
