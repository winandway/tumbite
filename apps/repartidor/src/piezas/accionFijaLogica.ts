/**
 * C-BOTON-SOBRE-BARRA (27 nov 2026) — todos los países. La acción principal de cada hoja de trabajo
 * de Driver (llegar, escanear el código del restaurante, foto de recogida, cómo llegar, entregar,
 * iniciar o terminar un viaje, la parada de Flex, «Estoy aquí») va FIJA arriba de la barra de abajo,
 * como el botón de abajo de DoorDash Dasher y Uber Driver; el contenido se desplaza detrás de ella.
 *
 * Lo que se rompió: el botón verde «Escanear el código del restaurante» quedaba debajo de la barra de
 * pestañas y el conductor no lo podía tocar. Estas cuentas son la única fuente del margen: el borde de
 * abajo de la acción nunca queda por debajo del borde de arriba de la barra (alto de la barra más el
 * área segura de abajo del teléfono). Lógica pura, sin React Native, para que la prueba la exija.
 */

/** Alto mínimo de la barra de abajo (ALTO.barraInferior de packages/movil/src/tokens.ts). */
export const ALTO_MINIMO_BARRA = 64;
/** Aire entre lo último del contenido y la acción fija. */
export const HOLGURA_ACCION = 12;

const positivo = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

export type MedidasAccion = {
  /** Alto medido de la barra de pestañas (0 o nada mientras no se mide). */
  altoBarra: number | null | undefined;
  /** Área segura de abajo (useSafeAreaInsets().bottom; en Android llega en cero, ya descontada). */
  areaSeguraAbajo: number | null | undefined;
  /** Alto medido de la acción fija (0 mientras no se mide). */
  altoAccion?: number | null;
};

/**
 * Dónde va la acción fija, medido desde el borde de abajo de la pantalla de la app, y cuánto espacio
 * deja el contenido al final para que lo último se pueda leer por encima de la acción.
 * - `abajo`: nunca menos que el alto de la barra (como mínimo, su alto de diseño) más el área segura.
 * - `rellenoContenido`: el contenido termina en el borde de arriba de la barra; le falta el alto de
 *   la acción y la holgura (sin acción, nada).
 */
export function colocarAccionFija(m: MedidasAccion): { abajo: number; rellenoContenido: number } {
  const barra = Math.max(positivo(m.altoBarra), ALTO_MINIMO_BARRA);
  const abajo = barra + positivo(m.areaSeguraAbajo);
  const accion = positivo(m.altoAccion);
  return { abajo, rellenoContenido: accion ? accion + HOLGURA_ACCION : 0 };
}

/** ¿La acción, puesta a `abajo` del borde de la pantalla, queda tapada (aunque sea un poco) por la barra? */
export function accionTapadaPorBarra(
  abajo: number,
  m: Pick<MedidasAccion, 'altoBarra' | 'areaSeguraAbajo'>,
): boolean {
  return abajo < positivo(m.altoBarra) + positivo(m.areaSeguraAbajo);
}

/** Lo que el pedido de comida en curso necesita para saber cuál es su acción principal. */
export type PedidoParaAccion = {
  estado: string;
  llegoRestaurante?: boolean | null;
  verificado?: boolean | null;
  fotoRecogida?: unknown;
  llegoCliente?: boolean | null;
  excepcionUbicacion?: string | null;
  entrega?: string | null;
  pinRequerido?: boolean | null;
  requiereEdad?: boolean | null;
};

export type AccionPedido =
  'llegue' | 'escanear' | 'fotoRecogida' | 'comoLlegar' | 'puerta' | 'enMano' | null;

/**
 * La ÚNICA acción del pedido de comida que va fija sobre la barra (las demás siguen en la hoja), en
 * el orden de DoorDash Dasher: llegar al restaurante, escanear su código, la foto de la recogida, ir
 * a la casa y, en la puerta, la foto con «Desliza para completar» o la entrega en mano.
 */
export function accionDelPedido(p: PedidoParaAccion, nativo: boolean): AccionPedido {
  if (p.estado === 'en_camino') {
    const enPuerta = Boolean(p.llegoCliente) || p.excepcionUbicacion === 'autorizada';
    if (!enPuerta) return 'comoLlegar';
    const enMano = p.entrega === 'mano';
    return !p.pinRequerido && !p.requiereEdad && !enMano ? 'puerta' : 'enMano';
  }
  if (!p.llegoRestaurante) return 'llegue';
  if (p.estado !== 'listo') return null;
  if (!p.verificado && nativo) return 'escanear';
  if (!p.fotoRecogida) return 'fotoRecogida';
  return null;
}
