import { crearApi } from '@tumbite/compartido';
import { leerIdioma } from '../idioma';

/** El panel vive en el mismo sitio que el servidor: la sesión viaja en una cookie segura. */
export const api = crearApi({
  base: '',
  idioma: leerIdioma,
  pase: () => (window as unknown as { tumbitePase?: string }).tumbitePase,
});
