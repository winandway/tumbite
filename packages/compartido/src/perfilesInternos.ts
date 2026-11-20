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
  // C-CAMILA: la bandeja de la asistente de soporte (responder, devolver, aprender, líderes).
  'camila',
  'clientes',
  'restaurantes',
  'repartidores',
  'kyc',
  'lista-espera',
  'quejas-config',
  'bandeja-dinero',
  'aprobaciones-dinero',
  'disputas',
  'viajes',
  'vehiculos',
  'habilitaciones',
  'solicitudes-franquicia',
  'errores',
  'auditoria',
  'mis-avisos',
  'seguridad',
  // C-MODERACION: la bandeja de reportes (mensajes y reseñas) es trabajo de soporte.
  'reportes',
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
  // C-CUPON-DIVOOX: los regalos que paga Divoox (presupuesto y pago al conductor) son de finanzas.
  'regalos-divoox',
  // C-SALDO-CONDUCTOR: el saldo de los conductores y el regalo de arranque.
  'conductores-ciudad',
  // C-REFERIDOS-EQUIPOS: los programas de referidos y los equipos.
  'referidos-programas',
  'equipos',
  // C-LINEAS-TAXI: las líneas de taxi y mototaxi y sus solicitudes, como los equipos.
  'lineas',
  'lineas-solicitudes',
  'lineas-invitaciones',
  'regalo-conductor-nuevo',
  // C-AGENTE-DIVOOX: los agentes (fondo, topes y conciliación) son de finanzas.
  'agentes',
  'agentes-ciudad',
  'stripe',
  'bandeja-dinero',
  'aprobaciones-dinero',
  'disputas',
  'auditoria',
  'mis-avisos',
];

/** `ruta` = la ruta completa de la petición (/datos/admin/…). */
export function permiteAccionInterna(perfil: PerfilInterno, metodo: string, ruta: string) {
  if (perfil === 'total') return true;
  const lee = metodo === 'GET' || metodo === 'HEAD';
  if (lee) return true;
  const familia = /^\/datos\/admin\/([a-z-]+)/.exec(ruta)?.[1] ?? '';
  // C-FILTROS-GUARDADOS: cada persona del equipo guarda SUS filtros (no cambia nada del negocio).
  if (familia === 'preferencias') return true;
  if (perfil === 'lectura') return false;
  // Los perfiles y el equipo solo los toca una cuenta total.
  if (familia === 'equipo') return false;
  return (perfil === 'soporte' ? SOPORTE : FINANZAS).includes(familia);
}
