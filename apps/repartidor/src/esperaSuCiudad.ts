import type { ErrorApi } from '@tumbite/compartido';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026; Venezuela y Estados Unidos): el servidor no deja conectarse a
 * quien espera que abramos su ciudad (409 con código `en_espera_ciudad`). Es la espera, no un fallo:
 * Driver lo dice con calma (texto normal, sin rojo) y la persona sigue subiendo sus papeles.
 */
export const esperaSuCiudad = (x: Pick<ErrorApi, 'estado' | 'datos'>) =>
  x.estado === 409 && x.datos?.codigo === 'en_espera_ciudad';
