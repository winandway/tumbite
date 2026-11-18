/**
 * C-ZONA-CONDUCTOR-NUEVO (robot, 18 nov 2026; todos los países): la fila de repartidor nace con la
 * ciudad de su cuenta (`usuarios.zona_id`: la elegida o la de su invitación) y no con Miami, el
 * valor por defecto de la tabla. Sin ciudad en la cuenta queda el de siempre hasta su primera
 * ubicación real (conectarse la corrige).
 */
export const ALTA_REPARTIDOR = `INSERT OR IGNORE INTO repartidores (usuario_id, zona_id)
  SELECT id, COALESCE(zona_id, 'US-FL-MIAMI') FROM usuarios WHERE id = ?`;
