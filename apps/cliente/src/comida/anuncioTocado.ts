import type { Restaurante } from '@tumbite/compartido';

/**
 * C-ANUNCIOS: el anuncio que el cliente tocó para entrar a un restaurante. Si después pide ahí, el
 * pedido lleva ese anuncio (el servidor solo lo cobra si la campaña sigue vigente y es de ese
 * restaurante). Vive mientras la app está abierta, como la atribución de DoorDash al tocar.
 */
const tocados = new Map<string, string>();

type ConPedir = { pedir: (metodo: 'POST', ruta: string, cuerpo?: unknown) => Promise<unknown> };

export function recordarAnuncio(api: ConPedir, r: Pick<Restaurante, 'id' | 'anuncioId'>): void {
  if (!r.anuncioId) return;
  tocados.set(r.id, r.anuncioId);
  // Solo estadística: si falla, el pedido sigue igual.
  api.pedir('POST', `/datos/anuncios/${r.anuncioId}/toque`, {}).catch(() => undefined);
}

export function anuncioPara(restauranteId: string | null | undefined): string | undefined {
  return restauranteId ? tocados.get(restauranteId) : undefined;
}

/** Solo para pruebas. */
export function olvidarAnuncios(): void {
  tocados.clear();
}
