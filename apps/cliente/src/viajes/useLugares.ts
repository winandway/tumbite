import { useCallback, useEffect, useState } from 'react';
import type { Api, LugarGuardado } from '@tumbite/compartido';

export type LugarAGuardar = {
  etiqueta: string;
  icono: string;
  direccion: string;
  lat: number;
  lng: number;
  referencia: string;
  apto: string;
};

/**
 * C-LUGARES-GUARDADOS: una sola lista de lugares para todos los servicios (la de «Tus direcciones»
 * de Comida, GET /datos/mis-direcciones), con nombre e ícono. Guardar, editar por id y borrar.
 */
export function useLugares(api: Api, conCuenta: boolean) {
  const [lista, setLista] = useState<LugarGuardado[]>([]);
  const cargar = useCallback(async () => {
    if (!conCuenta) return;
    const r = await api
      .pedir<{ direcciones: LugarGuardado[] }>('GET', '/datos/mis-direcciones')
      .catch(() => null);
    if (r) setLista(r.direcciones);
  }, [api, conCuenta]);
  useEffect(() => {
    if (!conCuenta) return;
    let vivo = true;
    void api
      .pedir<{ direcciones: LugarGuardado[] }>('GET', '/datos/mis-direcciones')
      .then((r) => vivo && setLista(r.direcciones))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, conCuenta]);
  /** Guarda (nuevo o por id). Lanza el error del servidor: el formulario no se limpia si falla. */
  const guardar = useCallback(
    async (datos: LugarAGuardar, id?: string) => {
      const r = await api.pedir<{ direccion: LugarGuardado }>(
        id ? 'PUT' : 'POST',
        id ? `/datos/mis-direcciones/${id}` : '/datos/mis-direcciones',
        datos,
      );
      await cargar();
      return r.direccion;
    },
    [api, cargar],
  );
  const borrar = useCallback(
    async (id: string) => {
      await api.pedir('DELETE', `/datos/mis-direcciones/${id}`);
      await cargar();
    },
    [api, cargar],
  );
  return { lista, guardar, borrar, recargar: cargar };
}
