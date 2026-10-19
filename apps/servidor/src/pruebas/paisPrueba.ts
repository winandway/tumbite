/**
 * Topes FICTICIOS de un país de prueba (C-TOPES-PAIS). Solo existen dentro de las pruebas: no son
 * cifras de Tumbite ni propuestas para Colombia o Venezuela (esas las fija Richard).
 */
export const TOPES_PRUEBA = {
  bonoOfertaAbierta: 3000,
  opcionPrecioMax: 40_000,
  propinaMax: 200_000,
  propinaExtraMin: 1000,
  propinaExtraMax: 40_000,
  cuponMontoMax: 50_000,
  quejaReembolsoMax: 60_000,
};

import { CONFIG_DINERO_INICIAL } from '@tumbite/compartido';

/** Tarifas FICTICIAS en pesos, solo para pruebas (las reales las fija Richard). */
export const TARIFAS_PRUEBA_COP = {
  ...CONFIG_DINERO_INICIAL,
  envioBase: 5000,
  envioPorKm: 1000,
  envioMaximo: 12000,
  servicioMinimo: 1000,
  servicioMaximo: 5000,
  pedidoMinimo: 0,
  cargoPedidoPequeno: 0,
  pagoMinimoRepartidor: 4000,
};
