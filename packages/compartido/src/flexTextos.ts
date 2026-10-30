import type { Idioma } from './idiomas';

/**
 * C-FLEX-ACTIVIDAD (30 oct 2026): frases para la actividad reciente del panel de Flex y nombres
 * claros para los permisos de las claves de la API. El servidor guarda códigos («empresa.crear»);
 * la persona lee «Creó la empresa».
 */
const ACCIONES: [string, string, string][] = [
  ['empresa.crear', 'Creó la empresa', 'Created the company'],
  ['empresa.editar', 'Cambió los datos de la empresa', 'Updated the company details'],
  [
    'empresa.config_entrega',
    'Cambió las pruebas de entrega',
    'Changed the delivery proof settings',
  ],
  ['centro.crear', 'Agregó un centro', 'Added a hub'],
  ['centro.editar', 'Cambió un centro', 'Updated a hub'],
  ['clave.crear', 'Creó una clave de la API', 'Created an API key'],
  ['clave.revocar', 'Anuló una clave de la API', 'Revoked an API key'],
  [
    'cobros.recibir',
    'Recibió el dinero cobrado por un conductor',
    'Received cash collected by a driver',
  ],
  ['conductor.vincular', 'Sumó un conductor', 'Added a driver'],
  ['conductor.cambiar', 'Cambió un conductor', 'Updated a driver'],
  ['devolucion.recibir', 'Recibió una devolución', 'Received a return'],
  ['envio.crear', 'Creó un envío', 'Created a shipment'],
  ['envio.corregir', 'Corrigió un envío', 'Corrected a shipment'],
  [
    'envio.enlace_ubicacion',
    'Pidió la ubicación al destinatario',
    'Asked the recipient for their location',
  ],
  ['envio.pin', 'Cambió el PIN de un envío', 'Changed a shipment PIN'],
  ['importacion.previsualizar', 'Revisó una importación', 'Previewed an import'],
  ['importacion.confirmar', 'Confirmó una importación', 'Confirmed an import'],
  ['importacion.terminar', 'Terminó una importación', 'Finished an import'],
  ['importacion.cancelar', 'Canceló una importación', 'Canceled an import'],
  [
    'incidencia.autorizar_reintento',
    'Autorizó un nuevo intento de entrega',
    'Approved a delivery retry',
  ],
  ['integracion.crear', 'Conectó una integración', 'Connected an integration'],
  ['integracion.cambiar', 'Cambió una integración', 'Updated an integration'],
  [
    'integracion.rotar_secreto',
    'Cambió el secreto de una integración',
    'Rotated an integration secret',
  ],
  ['invitacion.crear', 'Invitó a una persona', 'Invited someone'],
  ['invitacion.aceptar', 'Aceptó la invitación', 'Accepted the invitation'],
  ['invitacion.revocar', 'Anuló una invitación', 'Revoked an invitation'],
  ['miembro.cambiar', 'Cambió el rol de una persona del equipo', 'Changed a team member’s role'],
  ['lote.crear', 'Creó un lote', 'Created a batch'],
  ['lote.agregar', 'Agregó paquetes a un lote', 'Added packages to a batch'],
  ['lote.cambiar', 'Cambió un lote', 'Updated a batch'],
  ['retiro.disponible', 'Dejó un paquete listo para retirar', 'Made a package ready for pickup'],
  [
    'retiro.entregar',
    'Entregó un paquete en el punto de retiro',
    'Handed over a package at the pickup point',
  ],
  ['retiro.devolver', 'Devolvió un paquete no retirado', 'Returned an uncollected package'],
  ['ruta.crear', 'Creó una ruta', 'Created a route'],
  ['ruta.cambiar', 'Cambió una ruta', 'Updated a route'],
  ['ruta.orden', 'Cambió el orden de las paradas', 'Reordered the stops'],
  ['ruta.asignar', 'Asignó una ruta a un conductor', 'Assigned a route to a driver'],
  ['ruta.ofrecer', 'Ofreció una ruta a los conductores', 'Offered a route to drivers'],
  ['ruta.retirar', 'Retiró la oferta de una ruta', 'Withdrew a route offer'],
  ['ruta.cancelar', 'Canceló una ruta', 'Canceled a route'],
  ['servicio.editar', 'Cambió un servicio', 'Updated a service'],
  ['servicio.zona', 'Cambió un servicio en una ciudad', 'Updated a service in a city'],
  ['tasa.guardar', 'Guardó una tasa de cambio', 'Saved an exchange rate'],
  ['vehiculo.capacidad', 'Cambió la capacidad de un vehículo', 'Updated a vehicle’s capacity'],
  ['vehiculo.documento', 'Subió un documento de un vehículo', 'Uploaded a vehicle document'],
  ['vehiculo.revision', 'Revisó un vehículo', 'Reviewed a vehicle'],
];
const POR_ACCION = new Map(ACCIONES.map(([a, es, en]) => [a, { es, en }]));

export function textoAccionFlex(accion: string, idioma: Idioma): string {
  const t = POR_ACCION.get(accion);
  if (t) return idioma === 'en' ? t.en : t.es;
  return idioma === 'en' ? 'Company change' : 'Cambio en la empresa';
}

const PERMISOS = new Map<string, { es: string; en: string }>([
  ['empresa.ver', { es: 'Ver los datos de la empresa', en: 'View company details' }],
  ['centros.gestionar', { es: 'Manejar centros', en: 'Manage hubs' }],
  ['envios.crear', { es: 'Crear envíos', en: 'Create shipments' }],
  ['envios.ver', { es: 'Ver envíos', en: 'View shipments' }],
  [
    'paquetes.eventos',
    { es: 'Ver el recorrido de los paquetes', en: 'View package tracking events' },
  ],
  ['importar', { es: 'Importar envíos', en: 'Import shipments' }],
  ['lotes.gestionar', { es: 'Manejar lotes', en: 'Manage batches' }],
]);

export function textoPermisoClave(permiso: string, idioma: Idioma): string {
  const t = PERMISOS.get(permiso);
  return t ? (idioma === 'en' ? t.en : t.es) : permiso;
}

/** Fecha y hora de la base (UTC, «2026-10-30 12:23:05») en la hora de quien mira, en su idioma. */
export function fechaHoraLocal(sql: string, idioma: Idioma, zona?: string): string {
  const d = new Date(`${sql.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(sql) ? '' : 'Z'}`);
  if (Number.isNaN(d.getTime())) return sql;
  return d.toLocaleString(idioma === 'en' ? 'en-US' : 'es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(zona ? { timeZone: zona } : {}),
  });
}
