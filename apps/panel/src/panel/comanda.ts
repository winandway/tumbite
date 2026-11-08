import {
  type AnchoComanda,
  type PedidoComanda,
  escposComanda,
  estructuraComanda,
  htmlComanda,
} from '@tumbite/compartido';
import { type ConexionImpresora, impresoraActual } from './impresora';

/**
 * C-COMANDA y C-COMANDA-COMPLETA: la comanda del panel usa la pieza compartida
 * (`packages/compartido/src/comanda.ts`, la misma de la app del restaurante, C-COMANDA-APP).
 * C-IMPRESORA-NAVEGADOR: con la impresora conectada (USB o puerto serie) va directo en ESC/POS;
 * si no hay o falla, sale por la impresión del navegador con el ancho elegido (58 u 80 mm).
 */
export { htmlComanda, type PedidoComanda };

/** Abre la comanda en una ventana y lanza la impresión del navegador. */
function porNavegador(
  p: PedidoComanda,
  restaurante: string,
  idioma: 'es' | 'en',
  ancho: AnchoComanda,
) {
  const v = window.open('', '_blank', 'width=360,height=600');
  if (!v) return false;
  v.document.open();
  v.document.write(
    htmlComanda(p, restaurante, idioma, new Date(), { imprimirAlAbrir: true, ancho }),
  );
  v.document.close();
  return true;
}

export type ResultadoImpresion = 'impresora' | 'navegador' | 'navegador-por-fallo' | 'bloqueada';

export async function imprimirComanda(
  p: PedidoComanda,
  restaurante: string,
  idioma: 'es' | 'en',
  opciones: { ancho?: AnchoComanda; impresora?: ConexionImpresora | null } = {},
): Promise<ResultadoImpresion> {
  const ancho: AnchoComanda = opciones.ancho === 58 ? 58 : 80;
  const impresora = opciones.impresora === undefined ? impresoraActual() : opciones.impresora;
  if (impresora) {
    try {
      await impresora.enviar(escposComanda(estructuraComanda(p, restaurante, idioma), ancho));
      return 'impresora';
    } catch (e) {
      // Nunca se pierde una comanda: si la impresora no responde, sale por el navegador y se avisa.
      console.error('impresora: no se pudo imprimir la comanda', e);
      return porNavegador(p, restaurante, idioma, ancho) ? 'navegador-por-fallo' : 'bloqueada';
    }
  }
  return porNavegador(p, restaurante, idioma, ancho) ? 'navegador' : 'bloqueada';
}
