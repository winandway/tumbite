import { crearApi } from '@tumbite/compartido';
import { leerIdioma } from '../idioma';

/** El panel vive en el mismo sitio que el servidor: la sesión viaja en una cookie segura. */
export const api = crearApi({
  base: '',
  idioma: leerIdioma,
  pase: () => (window as unknown as { tumbitePase?: string }).tumbitePase,
});

export async function pedir<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: unknown,
): Promise<T> {
  return api.pedir<T>(metodo, ruta, cuerpo);
}
