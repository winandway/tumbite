import { MARCA } from '@tumbite/compartido';
import type { Punto } from '../piezas/mapaWeb';

/** Estado visual de un punto del mapa de la ruta Flex. */
export type TonoPunto = 'hecho' | 'actual' | 'pendiente' | 'fallida' | 'centro';
export type PuntoRuta = {
  id: string;
  punto: Punto;
  numero: string;
  tono: TonoPunto;
  nombre: string;
};

/** Hecho en verde (lo que salió bien va en verde), la parada actual en rojo, el resto en gris. */
export const COLOR_TONO: Record<TonoPunto, string> = {
  hecho: MARCA.colores.exito,
  actual: MARCA.colores.primario,
  pendiente: '#8E9198',
  fallida: MARCA.colores.acento,
  centro: MARCA.colores.secundario,
};
