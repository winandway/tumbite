import { ErrorDatos } from './validar';

/**
 * C-TIENDAS-FOTO-PROPIA para todos (NXT-8x, 3 nov 2026): una foto subida a Divoox vive en
 * `/media/fotos/<comercio>/<archivo>`. Un negocio solo guarda en su ficha, sus platos o sus
 * productos las fotos que subió ÉL; nunca la dirección de la foto de otro comercio.
 */
const COMERCIO_DE_LA_FOTO = /^\/media\/fotos\/([a-z0-9-]{1,64})\//;

export function exigirFotoPropia(
  imagen: string | null | undefined,
  comercioId: string | null | undefined,
  mensaje = 'Esa foto no es de tu negocio. Súbela otra vez.',
) {
  if (!imagen) return;
  const m = COMERCIO_DE_LA_FOTO.exec(imagen);
  if (m && m[1] !== comercioId) throw new ErrorDatos(mensaje, 'imagen', 422);
}
