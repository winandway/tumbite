import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import type { Api } from '@tumbite/compartido';
import type { Favoritos } from './Restaurantes';
import { mezclarFavoritos } from './favoritosEstado';

/**
 * POR-1 (2 nov 2026): el corazón de las tarjetas de la portada guarda de verdad en Favoritos
 * (GET/PUT/DELETE /datos/favoritos), igual que la lista de Comida. Cambia al instante y, si el
 * servidor falla, vuelve a como estaba.
 */
export function useFavoritos(api: Api, conSesion: boolean): Favoritos {
  const [ids, setIds] = useState<Set<string>>(new Set());
  // C-FAVORITOS-SIN-CARRERA: lo que la persona tocó mientras cargaba la lista manda sobre ella.
  const cambios = useRef(new Map<string, boolean>());
  useEffect(() => {
    if (!conSesion) return;
    let vivo = true;
    api
      .pedir<{ ids: string[] }>('GET', '/datos/favoritos')
      .then((r) => {
        if (vivo) setIds(mezclarFavoritos(r.ids, cambios.current));
      })
      .catch((e: unknown) => console.warn('favoritos: no se pudieron cargar', e));
    return () => {
      vivo = false;
    };
  }, [api, conSesion]);
  const cambiar = (id: string, poner: boolean) => {
    cambios.current.set(id, poner);
    setIds((f) => {
      const n = new Set(f);
      if (poner) n.add(id);
      else n.delete(id);
      return n;
    });
  };
  const alternar = useCallback(
    (id: string) => {
      // C-MIRAR-SIN-CUENTA: sin cuenta, el corazón lleva a entrar.
      if (!conSesion) {
        router.push('/sign-in');
        return;
      }
      const era = ids.has(id);
      cambiar(id, !era);
      api.pedir(era ? 'DELETE' : 'PUT', `/datos/favoritos/${id}`).catch((e: unknown) => {
        console.warn('favoritos: no se pudo guardar', e);
        cambiar(id, era);
      });
    },
    [api, ids, conSesion],
  );
  return useMemo(() => ({ ids, alternar }), [ids, alternar]);
}
