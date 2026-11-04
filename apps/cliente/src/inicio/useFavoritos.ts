import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import type { Api } from '@tumbite/compartido';
import type { Favoritos } from './Restaurantes';

/**
 * POR-1 (2 nov 2026): el corazón de las tarjetas de la portada guarda de verdad en Favoritos
 * (GET/PUT/DELETE /datos/favoritos), igual que la lista de Comida. Cambia al instante y, si el
 * servidor falla, vuelve a como estaba.
 */
export function useFavoritos(api: Api, conSesion: boolean): Favoritos {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!conSesion) return;
    let vivo = true;
    api
      .pedir<{ ids: string[] }>('GET', '/datos/favoritos')
      .then((r) => {
        if (vivo) setIds(new Set(r.ids));
      })
      .catch((e: unknown) => console.warn('favoritos: no se pudieron cargar', e));
    return () => {
      vivo = false;
    };
  }, [api, conSesion]);
  const cambiar = (id: string, poner: boolean) =>
    setIds((f) => {
      const n = new Set(f);
      if (poner) n.add(id);
      else n.delete(id);
      return n;
    });
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
