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

/**
 * `alFrente`: si la app está a la vista cuando llega. Detrás (proceso vivo), la alarma de la hoja no
 * suena: todo aviso, la oferta también, sale arriba con el sonido de su canal
 * (C-OFERTA-SUENA-EN-SEGUNDO-PLANO).
 */
export function comoMostrarEnPrimerPlano(
  datos: Record<string, unknown> | null | undefined,
  alFrente = true,
): {
  esOferta: boolean;
  comportamiento: ComportamientoAviso;
} {
  const tipo = typeof datos?.tipo === 'string' ? datos.tipo : '';
  const esOferta = OFERTAS_CON_HOJA.has(tipo);
  const callado = esOferta && alFrente;
  return {
    esOferta,
    comportamiento: {
      shouldShowBanner: !callado,
      shouldShowList: true,
      shouldPlaySound: !callado,
      shouldSetBadge: false,
    },
  };
}
