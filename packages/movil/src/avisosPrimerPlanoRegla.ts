/**
 * C-AVISOS-PRIMER-PLANO: la regla pura (sin react-native) de cómo se muestra un aviso con la app
 * abierta. La usa `useAvisosPrimerPlano` (avisosPrimerPlano.ts).
 */

/** Los tipos de oferta que tienen hoja con alarma propia en Driver. */
export const OFERTAS_CON_HOJA = new Set(['oferta_operacion', 'oferta_pedido']);

export type ComportamientoAviso = {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
};

export function comoMostrarEnPrimerPlano(datos: Record<string, unknown> | null | undefined): {
  esOferta: boolean;
  comportamiento: ComportamientoAviso;
} {
  const tipo = typeof datos?.tipo === 'string' ? datos.tipo : '';
  const esOferta = OFERTAS_CON_HOJA.has(tipo);
  return {
    esOferta,
    comportamiento: {
      shouldShowBanner: !esOferta,
      shouldShowList: true,
      shouldPlaySound: !esOferta,
      shouldSetBadge: false,
    },
  };
}
