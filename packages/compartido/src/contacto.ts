/**
 * C-CONTACTO (2 nov 2026, pedido de Richard por el gerente de correo): la puerta pública de contacto
 * de divoox.com. Lo comparten el formulario de la web y el servidor.
 */
export const SOY_CONTACTO = [
  'cliente',
  'restaurante',
  'repartidor',
  'franquicia',
  'prensa',
  'otro',
] as const;
export type SoyContacto = (typeof SOY_CONTACTO)[number];

// C-CORREO-SUGERENCIA (19 nov 2026): la sugerencia del correo vive en una sola pieza, sugerirCorreo.ts
// (la usan el contacto, el registro y los cambios de correo).
