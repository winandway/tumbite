import { LIBRE, type PermisoRuta } from './permisosInternos';

/**
 * C-PERMISOS-FINOS (MON-5, 15 nov 2026) — todos los países. EL MAPA ruta → permiso, en un solo lugar.
 *
 * Cada ruta `/datos/admin/*` declara aquí el permiso que exige, también las de lectura. El intermedio
 * `permisosInternos` (servidor) lo comprueba en cada petición y la prueba
 * `apps/servidor/src/rutas/permisosRutas.test.ts` recorre TODAS las rutas registradas bajo
 * `/datos/admin` y se pone en rojo si una no está aquí. Una ruta nueva sin su línea no se publica.
 *
 * Reglas para elegir el permiso (las fija la prueba de compatibilidad con los perfiles viejos):
 * - Una lectura (GET) usa un permiso de lectura (`*.ver`, `pedidos.fotos`, `repartidores.documentos`,
 *   `monitoreo.*`) y NUNCA uno que también abra un cambio: así «Solo lectura» sigue viendo todo y
 *   sin poder cambiar nada.
 * - Un cambio usa un permiso de acción que solo comparten familias con el mismo perfil viejo
 *   (Soporte, Finanzas, los dos o solo Total).
 * - `libre`: cualquier persona activa del equipo (sus propios filtros y avisos, la lista de ciudades).
 *
 * La clave es `MÉTODO /admin/...` (sin el `/datos`), tal como se registra en Hono.
 */
export const PERMISOS_RUTAS_ADMIN: Readonly<Record<string, PermisoRuta>> = {
  // ─── Monitoreo, pedidos y buscador
  'GET /admin/resumen': 'monitoreo.ver',
  'GET /admin/tablero': 'monitoreo.ver',
  'GET /admin/buscar': 'monitoreo.buscar',
  'GET /admin/informes': 'monitoreo.exportar',
  'GET /admin/pedidos': 'pedidos.ver',
  'GET /admin/pedidos/:id': 'pedidos.ver',
  'POST /admin/pedidos/:id/cancelar': 'pedidos.cancelar',
  'POST /admin/pedidos/:id/soltar-repartidor': 'pedidos.reasignar',
  'POST /admin/pedidos/:id/autorizar-ubicacion': 'pedidos.autorizar_ubicacion',
  'POST /admin/pedidos/:id/devolver': 'pedidos.devolver',
  'GET /admin/cancelaciones': 'pedidos.ver',
  'POST /admin/cancelaciones/:id/:decision': 'config.editar',
  // ─── Viajes (Moto, Carro, envíos)
  'GET /admin/viajes': 'viajes.ver',
  // La ficha del viaje (paquete 2/3, otra rama): declarada de antemano para que al unir ya exija su permiso.
  'GET /admin/viajes/:id': 'viajes.ver',
  'GET /admin/viajes/tarifas': 'viajes.ver',
  'GET /admin/viajes/ajustes': 'viajes.ver',
  'GET /admin/viajes/dinamica/:servicio/:zona': 'viajes.ver',
  'POST /admin/viajes/tarifas': 'viajes.configurar',
  'POST /admin/viajes/ciudades': 'viajes.configurar',
  'PUT /admin/viajes/ajustes': 'viajes.configurar',
  'PUT /admin/viajes/dinamica/:servicio/:zona': 'viajes.configurar',
  'POST /admin/viajes/emergencias/:id/atender': 'viajes.emergencias',
  'GET /admin/conductores/:id/pasajeros': 'repartidores.ver',
  'PUT /admin/conductores/:id/ciudad': 'repartidores.gestionar',
  // ─── Clientes
  'GET /admin/clientes': 'clientes.ver',
  'GET /admin/clientes/:id': 'clientes.ver',
  'PATCH /admin/usuarios/:id': 'clientes.suspender',
  'POST /admin/usuarios/:id/borrar': 'clientes.suspender',
  'GET /admin/datos-personales/:tipo/:id/:campo': 'clientes.datos_personales',
  // ─── Repartidores, vehículos y papeles
  'GET /admin/repartidores': 'repartidores.ver',
  'GET /admin/repartidores/:id': 'repartidores.ver',
  'PATCH /admin/repartidores/:id': 'repartidores.editar',
  'GET /admin/vehiculos': 'repartidores.ver',
  'GET /admin/vehiculos/:id/documentos/:doc/archivo': 'repartidores.documentos',
  'PUT /admin/vehiculos/:id': 'repartidores.editar',
  'PUT /admin/vehiculos/:id/categoria': 'repartidores.editar',
  'PUT /admin/vehiculos/:id/documentos/:doc': 'repartidores.editar',
  'GET /admin/habilitaciones': 'repartidores.ver',
  'PUT /admin/habilitaciones/:conductor/:servicio': 'repartidores.habilitar',
  'PUT /admin/cumplimientos/:conductor/:requisito': 'repartidores.gestionar',
  'GET /admin/papeles-conductor': 'repartidores.ver',
  'GET /admin/papeles-conductor/:id/archivo': 'repartidores.documentos',
  'PUT /admin/papeles-conductor/:id': 'repartidores.gestionar',
  // ─── Verificaciones
  'GET /admin/kyc': 'kyc.ver',
  'GET /admin/kyc/:id': 'kyc.ver',
  'GET /admin/kyc/:id/control/:cid': 'kyc.ver',
  'GET /admin/kyc/:id/foto/:pieza': 'repartidores.documentos',
  'PATCH /admin/kyc/:id': 'kyc.decidir',
  'PATCH /admin/kyc/:id/control/:cid': 'kyc.decidir',
  'POST /admin/kyc/:id/liberar-foto': 'kyc.decidir',
  'POST /admin/kyc/:id/miniatura': 'kyc.decidir',
  // ─── Tickets
  'GET /admin/tickets': 'tickets.ver',
  'GET /admin/tickets/:id': 'tickets.ver',
  'GET /admin/tickets/plantillas': 'tickets.ver',
  'PATCH /admin/tickets/:id': 'tickets.asignar',
  'POST /admin/tickets/:id/mensajes': 'tickets.responder',
  'POST /admin/tickets/plantillas': 'tickets.plantillas',
  'DELETE /admin/tickets/plantillas/:pid': 'tickets.plantillas',
  'GET /admin/quejas-config': 'tickets.ver',
  'PUT /admin/quejas-config': 'tickets.configurar',
  'GET /admin/lista-espera': 'restaurantes.ver',
  'GET /admin/errores': 'config.ver',
  'GET /admin/seguridad': 'auditoria.ver',
  'GET /admin/solicitudes-franquicia': 'config.ver',
  // ─── Comercios
  'GET /admin/restaurantes': 'restaurantes.ver',
  'GET /admin/restaurantes/:id': 'restaurantes.ver',
  'PATCH /admin/restaurantes/:id': 'restaurantes.editar',
  'POST /admin/restaurantes/:id/platos/importar': 'restaurantes.editar',
  // ─── Dinero
  'GET /admin/aprobaciones-dinero': LIBRE,
  'POST /admin/aprobaciones-dinero/:id/aprobar': 'dinero.aprobar',
  'POST /admin/aprobaciones-dinero/:id/rechazar': 'dinero.solicitar',
  'PUT /admin/aprobaciones-dinero/umbrales': 'dinero.limites',
  'GET /admin/bandeja-dinero': 'dinero.ver',
  'GET /admin/bandeja-dinero/:clave': 'dinero.ver',
  'POST /admin/bandeja-dinero/:clave/acciones': 'dinero.solicitar',
  'GET /admin/disputas': 'dinero.ver',
  'GET /admin/disputas/:id/pruebas': 'dinero.ver',
  'POST /admin/disputas/:id/pruebas': 'dinero.solicitar',
  'GET /admin/abonos-fallidos': 'dinero.ver',
  'PATCH /admin/abonos-fallidos/:id': 'dinero.conciliar',
  'GET /admin/conciliacion': 'dinero.ver',
  'GET /admin/conciliacion/excepciones': 'dinero.ver',
  'POST /admin/conciliacion/excepciones': 'dinero.conciliar',
  'GET /admin/config-dinero/historial': 'dinero.ver',
  'PUT /admin/config-dinero': 'dinero.configurar',
  'PATCH /admin/cuentas-cobro/:id': 'dinero.configurar',
  'GET /admin/cupones': 'dinero.ver',
  'POST /admin/cupones': 'dinero.configurar',
  'PATCH /admin/cupones/:codigo': 'dinero.configurar',
  'POST /admin/codigos-recarga/:id/anular': 'dinero.reembolsar',
  'GET /admin/fiscal/1099': 'dinero.ver',
  'GET /admin/libro/comisiones/:pais': 'dinero.ver',
  'GET /admin/libro/pedido/:id': 'dinero.ver',
  'GET /admin/liquidaciones': 'dinero.ver',
  'POST /admin/liquidaciones/:id/confirmar': 'dinero.conciliar',
  'POST /admin/liquidaciones/:id/reintentar': 'dinero.conciliar',
  'GET /admin/paises/:pais': 'dinero.ver',
  'PUT /admin/paises/:pais': 'dinero.configurar',
  'GET /admin/puntos-venta': 'dinero.ver',
  'POST /admin/puntos-venta': 'dinero.reembolsar',
  'POST /admin/puntos-venta/:id/fondo': 'dinero.reembolsar',
  'GET /admin/retiros': 'dinero.ver',
  'PUT /admin/retiros': 'dinero.configurar',
  'POST /admin/stripe/dominio': 'dinero.configurar',
  'GET /admin/finanzas/cancelaciones': 'dinero.ver',
  'POST /admin/finanzas/cancelaciones': 'dinero.configurar',
  'GET /admin/finanzas/conciliacion': 'dinero.ver',
  'POST /admin/finanzas/conciliacion': 'dinero.conciliar',
  'GET /admin/finanzas/empresas': 'dinero.ver',
  'GET /admin/finanzas/empresas/:eid/movimientos': 'dinero.ver',
  'POST /admin/finanzas/empresas/:eid/ajuste': 'dinero.reembolsar',
  'GET /admin/finanzas/politicas': 'dinero.ver',
  'POST /admin/finanzas/politicas': 'dinero.configurar',
  'POST /admin/finanzas/politicas/:pid/cerrar': 'dinero.configurar',
  'POST /admin/finanzas/politicas/:pid/revision-legal': 'dinero.configurar',
  'GET /admin/finanzas/recargas-config/:pais': 'dinero.ver',
  'PUT /admin/finanzas/recargas-config/:pais': 'dinero.configurar',
  'GET /admin/finanzas/recargas-locales': 'dinero.ver',
  'GET /admin/finanzas/recargas-locales/:rid/comprobante': 'dinero.ver',
  'GET /admin/finanzas/recargas-locales/config/:pais': 'dinero.ver',
  'PUT /admin/finanzas/recargas-locales/config/:pais': 'dinero.configurar',
  'POST /admin/finanzas/recargas-locales/:rid/acreditar': 'dinero.reembolsar',
  'POST /admin/finanzas/recargas-locales/:rid/rechazar': 'dinero.reembolsar',
  'POST /admin/finanzas/recargas/:rid/reembolsar': 'dinero.reembolsar',
  'POST /admin/finanzas/simular-logistico': 'dinero.configurar',
  // ─── Equipo interno, avisos y auditoría
  'GET /admin/equipo': 'equipo.ver',
  'GET /admin/equipo/acciones': 'auditoria.ver',
  'PUT /admin/equipo/:id': 'equipo.gestionar',
  'GET /admin/equipo/yo': LIBRE,
  'GET /admin/equipo/miembros': 'equipo.ver',
  'GET /admin/equipo/miembros/:id': 'equipo.ver',
  'PUT /admin/equipo/miembros/:id': 'equipo.gestionar',
  'POST /admin/equipo/miembros/:id/suspender': 'equipo.gestionar',
  'POST /admin/equipo/miembros/:id/reactivar': 'equipo.gestionar',
  'POST /admin/equipo/miembros/:id/quitar': 'equipo.gestionar',
  'GET /admin/equipo/plantillas': 'equipo.ver',
  'POST /admin/equipo/plantillas': 'equipo.gestionar',
  'PUT /admin/equipo/plantillas/:id': 'equipo.gestionar',
  'DELETE /admin/equipo/plantillas/:id': 'equipo.gestionar',
  'GET /admin/equipo/invitaciones': 'equipo.ver',
  'POST /admin/equipo/invitaciones': 'equipo.gestionar',
  'DELETE /admin/equipo/invitaciones/:id': 'equipo.gestionar',
  'GET /admin/equipo/registro': 'auditoria.ver',
  'GET /admin/equipo/ajustes/segundo-factor': 'equipo.ver',
  'PUT /admin/equipo/ajustes/segundo-factor': 'equipo.gestionar',
  'GET /admin/mis-avisos': LIBRE,
  'PUT /admin/mis-avisos': 'avisos.recibir',
  'GET /admin/preferencias/:pantalla': LIBRE,
  'PUT /admin/preferencias/:pantalla': LIBRE,
  'DELETE /admin/preferencias/:pantalla': LIBRE,
  'GET /admin/auditoria': 'auditoria.ver',
  'GET /admin/ruta': LIBRE,
  // ─── Territorio, servicios y configuración
  'GET /admin/zonas': LIBRE,
  'GET /admin/ciudades': LIBRE,
  'PUT /admin/zonas': 'config.editar',
  'PATCH /admin/zonas/:id': 'config.editar',
  'GET /admin/zonas/:id/areas': 'config.ver',
  'POST /admin/zonas/:id/areas': 'config.editar',
  'PATCH /admin/areas/:id': 'config.editar',
  'POST /admin/comida/ciudades': 'config.editar',
  'GET /admin/web/ciudades': 'config.ver',
  'PUT /admin/web/ciudades/:slug': 'config.editar',
  'GET /admin/servicios': 'config.ver',
  'PUT /admin/servicios/:id': 'config.editar',
  'PUT /admin/servicios/:id/zonas/:zona': 'config.editar',
  'GET /admin/despacho-catalogo': 'config.ver',
  'PUT /admin/despacho-catalogo/:zona': 'config.editar',
  'GET /admin/interruptores-repartidor': 'config.ver',
  'PUT /admin/interruptores-repartidor': 'config.editar',
  'GET /admin/ganar-por-tiempo': 'config.ver',
  'PUT /admin/ganar-por-tiempo': 'config.editar',
  'GET /admin/pago-pico': 'config.ver',
  'PUT /admin/pago-pico': 'config.editar',
  'GET /admin/pasajeros-pais': 'config.ver',
  'PUT /admin/pasajeros-pais/:pais/:servicio': 'config.editar',
  'GET /admin/tasas-referencia': 'config.ver',
  'PUT /admin/tasas-referencia/:pais': 'config.editar',
  'PUT /admin/tasas-referencia/:pais/modo': 'config.editar',
  'GET /admin/ciudad-pruebas': 'config.ver',
  'POST /admin/ciudad-pruebas/encender': 'config.editar',
  'POST /admin/ciudad-pruebas/apagar': 'config.editar',
  'POST /admin/ciudad-pruebas/parar': 'config.editar',
  'POST /admin/ciudad-pruebas/latido': 'config.editar',
  'GET /admin/piloto': 'config.ver',
  'GET /admin/piloto/limites': 'config.ver',
  'GET /admin/piloto/servicios': 'config.ver',
  'POST /admin/piloto': 'config.editar',
  'PUT /admin/piloto/limites': 'config.editar',
  'PUT /admin/piloto/servicios': 'config.editar',
  'DELETE /admin/piloto/:usuarioId': 'config.editar',
  'GET /admin/rewards/ajustes': 'config.ver',
  'GET /admin/rewards/apelaciones': 'config.ver',
  'GET /admin/rewards/sombra/:repartidorId': 'config.ver',
  'PUT /admin/rewards/ajustes': 'config.editar',
  'PUT /admin/rewards/apelaciones/:id': 'config.editar',
  'POST /admin/rewards/sombra/:repartidorId/calcular': 'config.editar',
  'GET /admin/anuncios': 'config.ver',
  'PUT /admin/anuncios': 'config.editar',
  'GET /admin/promociones': 'config.ver',
  'PUT /admin/promociones': 'config.editar',
  'GET /admin/plus': 'config.ver',
  'PUT /admin/plus': 'config.editar',
  'GET /admin/referidos': 'config.ver',
  'PUT /admin/referidos': 'config.editar',
  'GET /admin/tarjetas-regalo': 'config.ver',
  'PUT /admin/tarjetas-regalo': 'config.editar',
  'GET /admin/franquicias/:id': 'config.ver',
  'POST /admin/franquicias': 'config.editar',
  'PATCH /admin/franquicias/:id': 'config.editar',
  'PUT /admin/franquicias/:id/areas': 'config.editar',
  'POST /admin/franquicias/:id/miembros': 'config.editar',
  'DELETE /admin/franquicias/:id/miembros/:correo': 'config.editar',
  'POST /admin/franquicias/desde-solicitud/:ticketId': 'config.editar',
  'POST /admin/revisores': 'config.editar',
  'POST /admin/revisores/:rol/clave': 'config.editar',
};

/**
 * Rutas declaradas de antemano que todavía no existen en esta rama (las construye otra rama que se
 * une después). La prueba no las cuenta como sobrantes.
 */
export const RUTAS_ADMIN_PREVISTAS = new Set(['GET /admin/viajes/:id']);

type Patron = { metodo: string; partes: string[]; literales: number; permiso: PermisoRuta };
const PATRONES: Patron[] = Object.entries(PERMISOS_RUTAS_ADMIN).map(([clave, permiso]) => {
  const [metodo = 'GET', ruta = ''] = clave.split(' ');
  const partes = ruta.split('/').filter(Boolean);
  return { metodo, partes, literales: partes.filter((p) => !p.startsWith(':')).length, permiso };
});

/**
 * El permiso de una petición (`ruta` con o sin `/datos`), o null si la ruta no está declarada.
 * Si varias encajan, gana la que tiene más partes fijas (como el enrutador: `/tickets/plantillas`
 * antes que `/tickets/:id`).
 */
export function permisoDeRuta(
  metodo: string,
  ruta: string,
): { permiso: PermisoRuta; patron: string } | null {
  const m = metodo === 'HEAD' ? 'GET' : metodo;
  const partes = ruta
    .replace(/^\/datos(?=\/)/, '')
    .split('/')
    .filter(Boolean);
  let mejor: Patron | null = null;
  for (const p of PATRONES) {
    if (p.metodo !== m || p.partes.length !== partes.length) continue;
    const encaja = p.partes.every((x, i) => x.startsWith(':') || x === partes.at(i));
    if (encaja && (!mejor || p.literales > mejor.literales)) mejor = p;
  }
  return mejor ? { permiso: mejor.permiso, patron: `/${mejor.partes.join('/')}` } : null;
}

/** Las entradas del mapa como pares (para traducir los perfiles viejos y para las pruebas). */
export const LISTA_RUTAS_ADMIN = Object.entries(PERMISOS_RUTAS_ADMIN) as ReadonlyArray<
  readonly [string, PermisoRuta]
>;
