/**
 * C-ROLES-INTERNOS (29 oct 2026): qué puede hacer cada perfil del equipo interno en el superadmin,
 * como los roles de soporte, finanzas y solo lectura de las plataformas grandes. Una sola regla,
 * la usa el servidor para frenar y el panel para no ofrecer lo que no se puede.
 */
export const PERFILES_INTERNOS = ['total', 'soporte', 'finanzas', 'lectura'] as const;
export type PerfilInterno = (typeof PERFILES_INTERNOS)[number];

/** Familias de rutas de soporte (pedidos, casos, clientes, comercios, repartidores). */
const SOPORTE = [
  'pedidos',
  'tickets',
  'clientes',
  'restaurantes',
  'repartidores',
  'kyc',
  'lista-espera',
  'quejas-config',
  'bandeja-dinero',
  'disputas',
  'viajes',
  'vehiculos',
  'habilitaciones',
  'solicitudes-franquicia',
  'errores',
  'auditoria',
  'mis-avisos',
  'seguridad',
];
/** Familias de dinero y configuración de países. */
const FINANZAS = [
  'finanzas',
  'retiros',
  'liquidaciones',
  'libro',
  'conciliacion',
  'abonos-fallidos',
  'cuentas-cobro',
  'config-dinero',
  'paises',
  'puntos-venta',
  'codigos-recarga',
  'cupones',
  'stripe',
  'bandeja-dinero',
  'disputas',
  'auditoria',
  'mis-avisos',
];

/** `ruta` = la ruta completa de la petición (/datos/admin/…). */
export function permiteAccionInterna(perfil: PerfilInterno, metodo: string, ruta: string) {
  if (perfil === 'total') return true;
  const lee = metodo === 'GET' || metodo === 'HEAD';
  if (lee) return true;
  if (perfil === 'lectura') return false;
  const familia = /^\/datos\/admin\/([a-z-]+)/.exec(ruta)?.[1] ?? '';
  // Los perfiles y el equipo solo los toca una cuenta total.
  if (familia === 'equipo') return false;
  return (perfil === 'soporte' ? SOPORTE : FINANZAS).includes(familia);
}
