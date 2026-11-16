/**
 * Permisos finos del superadmin (paquete «equipo interno y permisos finos», en construcción en
 * paralelo). HOY toda cuenta del equipo ve todo lo que ya veía: esta función devuelve verdadero.
 * Cuando llegue la lista de permisos efectivos de la sesión, se decide AQUÍ y en ningún otro lugar
 * (por ejemplo, `pedidos.fotos` para el botón «Ver foto» de la ficha del pedido). El servidor es el
 * que frena de verdad: esto solo evita ofrecer lo que no se va a poder abrir.
 */
export type PermisoPanel = 'pedidos.fotos' | 'viajes.ver' | 'tickets.responder' | 'config.ver';

export function puedeVer(permiso: PermisoPanel): boolean {
  // Hoy: verdadero para cualquier permiso conocido (todas las cuentas del equipo ven lo de siempre).
  return permiso.length > 0;
}
