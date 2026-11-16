import {
  type Alcance,
  type Idioma,
  NOMBRES_PERMISOS,
  type PermisoInterno,
  enIdioma,
} from '@tumbite/compartido';

/** C-PERMISOS-FINOS: los textos de «Equipo interno» en los dos idiomas (inglés principal). */
export const TEXTOS_EQUIPO = {
  es: {
    titulo: 'Equipo interno',
    detalle:
      'Quién entra al panel, con qué plantilla de puesto, en qué ciudades y servicios, y qué hizo y qué vio cada persona.',
    pestanas: {
      personas: 'Personas',
      plantillas: 'Plantillas de puesto',
      registro: 'Registro',
      avisos: 'Mis avisos',
    },
    agregar: 'Agregar empleado',
    buscar: 'Buscar por nombre o correo',
    columnas: {
      persona: 'Persona',
      estado: 'Estado',
      plantillas: 'Plantillas',
      alcance: 'Alcance',
      ultima: 'Última entrada',
      vence: 'Vence',
    },
    estados: {
      activo: 'Activo',
      invitado: 'Invitado',
      suspendido: 'Suspendido',
      vencido: 'Vencido',
      retirado: 'Sin acceso',
    },
    sinMiembros: 'No hay nadie con ese nombre o correo.',
    cargarMas: 'Cargar más',
    tu: '(tú)',
    dueno: 'Dueño',
    perfilViejo: 'Perfil anterior',
    perfiles: { total: 'Total', soporte: 'Soporte', finanzas: 'Finanzas', lectura: 'Solo lectura' },
    todo: 'Todo',
    nunca: 'Nunca',
    sinVencimiento: 'Sin vencimiento',
    masAcciones: 'Más acciones',
    suspender: 'Suspender',
    reactivar: 'Reactivar',
    quitar: 'Quitar acceso',
    cancelarInvitacion: 'Cancelar invitación',
    invitaciones: 'Invitaciones pendientes',
    invitadoPor: 'Invitó',
    expira: 'Vence la invitación',
    confirmarTitulo: {
      suspender: '¿Suspender a esta persona?',
      reactivar: '¿Reactivar a esta persona?',
      quitar: '¿Quitarle el acceso?',
    },
    confirmarTexto: {
      suspender: 'Se cierran sus sesiones al instante en todos sus aparatos. Podrás reactivarla.',
      reactivar: 'Vuelve a entrar con su contraseña y sus mismas plantillas.',
      quitar: 'Se cierran sus sesiones al instante y ya no puede entrar. Su registro se conserva.',
    },
    motivo: 'Motivo',
    motivoAyuda: 'Queda en el registro con tu nombre.',
    confirmar: 'Confirmar',
    cancelar: 'Cancelar',
    cerrar: 'Cerrar',
    guardado: 'Guardado.',
    segundoFactor: 'Segundo factor para lo delicado',
    segundoFactorAyuda:
      'Pide un código por correo antes de ver fotos, datos personales, mover dinero o gestionar el equipo. Apagado de fábrica: lo decide la dirección.',
    encendido: 'Encendido',
    apagado: 'Apagado',
    // Agregar empleado
    nuevo: 'Agregar empleado',
    nuevoAyuda:
      'Le llega una invitación de un solo uso que vence en 7 días. Crea su contraseña y entra con lo que le des aquí.',
    correo: 'Correo de trabajo',
    nombre: 'Nombre completo',
    soporteRegla: 'Las cuentas de @windoce.com llevan «Soporte» en el nombre.',
    eligePlantillas: 'Plantillas de puesto',
    noPuedesDar: 'Tiene permisos que tú no tienes',
    alcance: 'Alcance',
    alcanceAyuda: 'Sin marcar nada, trabaja en todas las ciudades y servicios.',
    paises: 'Países',
    ciudades: 'Ciudades',
    servicios: 'Servicios',
    nombresServicio: {
      comida: 'Comida',
      tiendas: 'Tiendas',
      carro: 'Viajes en auto',
      moto: 'Viajes en moto',
      envios: 'Envíos',
    },
    venceEn: 'Vence el (opcional)',
    idiomaInvitacion: 'Idioma de la invitación',
    enviar: 'Mandar invitación',
    enviando: 'Mandando…',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezarDeNuevo: 'Empezar de nuevo',
    enlaceTitulo: 'Enlace de invitación (solo tú lo ves)',
    enlaceAyuda:
      'En el sitio de pruebas y en la computadora no salen correos: pásale este enlace a la persona. Sirve una vez.',
    copiar: 'Copiar enlace',
    copiado: 'Copiado',
    correoMandado: 'Listo: le mandamos la invitación por correo.',
    // Ficha
    volver: '← Equipo interno',
    acceso: 'Su acceso',
    editarAcceso: 'Cambiar su acceso',
    guardarAcceso: 'Guardar acceso',
    permisosEfectivos: 'Permisos efectivos',
    deDonde: 'Viene de',
    sinEfecto: 'No aplican con su zona de trabajo',
    sinEfectoNota:
      'Su acceso está limitado a ciertas ciudades o servicios. Estos permisos son de toda la empresa (dinero, auditoría, configuración), así que solo valen con acceso a todas las ciudades.',
    extra: 'Permiso extra',
    loQueHizo: 'Lo que hizo',
    loQueVio: 'Lo que vio',
    cambios: 'Cambios de su acceso',
    nadaAun: 'Todavía nada.',
    rechazado: 'rechazado',
    // Plantillas
    nuevaPlantilla: 'Nueva plantilla',
    deFabrica: 'De fábrica',
    personas: 'personas',
    permisos: 'permisos',
    editar: 'Editar',
    borrar: 'Borrar plantilla',
    nombreEs: 'Nombre en español',
    nombreEn: 'Nombre en inglés',
    descripcionEs: 'Descripción en español',
    descripcionEn: 'Descripción en inglés',
    topes: 'Tope de dinero sin segunda firma (por moneda, en centavos)',
    guardar: 'Guardar plantilla',
    totalNoEdita: 'Total es todo, siempre: no se edita.',
    // Registro
    tipoRegistro: 'Qué mirar',
    tiposRegistro: {
      acciones: 'Cambios del equipo',
      permisos: 'Altas, bajas y permisos',
      accesos: 'Lo que se vio',
    },
    persona: 'Persona',
    todas: 'Todas',
    desde: 'Desde',
    hasta: 'Hasta',
    exportar: 'Exportar CSV',
    columnasRegistro: { fecha: 'Fecha', persona: 'Persona', que: 'Qué', detalle: 'Detalle' },
    sinRegistro: 'No hay nada con esos filtros.',
    tiposAcceso: {
      foto_recogida: 'Foto de recogida',
      foto_entrega: 'Foto de entrega',
      foto_ticket: 'Foto del ticket',
      telefono: 'Teléfono completo',
      correo: 'Correo completo',
      chat_pedido: 'Chat del pedido',
    },
    objetos: {
      pedido: 'Pedido',
      viaje: 'Viaje',
      cliente: 'Cliente',
      repartidor: 'Repartidor',
      restaurante: 'Comercio',
      ticket: 'Ticket',
      cuenta: 'Cuenta',
    },
    acciones: {
      'equipo.alta': 'Entró al equipo por invitación',
      'equipo.permisos': 'Cambio de plantillas o permisos',
      'equipo.suspendido': 'Suspendida',
      'equipo.activo': 'Reactivada',
      'equipo.retirado': 'Sin acceso',
      'equipo.invitacion': 'Invitación enviada',
      'equipo.invitacion_cancelada': 'Invitación cancelada',
      'equipo.plantilla': 'Plantilla editada',
      'equipo.plantilla_nueva': 'Plantilla nueva',
      'equipo.plantilla_borrada': 'Plantilla borrada',
      'equipo.segundo_factor': 'Segundo factor',
    },
    // Mis avisos
    misAvisos: 'Mis avisos por correo',
    misAvisosAyuda:
      'Elige qué avisos te llegan. El aviso de sistema (algo dejó de funcionar) no se apaga para los correos fijos del sitio.',
    tiposAviso: {
      pedidos: 'Pedidos (sin repartidor, repartidor perdido, comercio sin señal)',
      dinero: 'Dinero (conciliación, abonos fallidos, disputas)',
      verificaciones: 'Verificaciones (comercios nuevos, identidad, antecedentes)',
      sistema: 'Sistema (algo dejó de funcionar, emergencias)',
    },
  },
  en: {
    titulo: 'Internal team',
    detalle:
      'Who can sign in to the panel, with which role template, in which cities and services, and what each person did and viewed.',
    pestanas: {
      personas: 'People',
      plantillas: 'Role templates',
      registro: 'Log',
      avisos: 'My alerts',
    },
    agregar: 'Add employee',
    buscar: 'Search by name or email',
    columnas: {
      persona: 'Person',
      estado: 'Status',
      plantillas: 'Templates',
      alcance: 'Scope',
      ultima: 'Last sign-in',
      vence: 'Expires',
    },
    estados: {
      activo: 'Active',
      invitado: 'Invited',
      suspendido: 'Suspended',
      vencido: 'Expired',
      retirado: 'No access',
    },
    sinMiembros: 'Nobody matches that name or email.',
    cargarMas: 'Load more',
    tu: '(you)',
    dueno: 'Owner',
    perfilViejo: 'Previous profile',
    perfiles: { total: 'Full', soporte: 'Support', finanzas: 'Finance', lectura: 'Read only' },
    todo: 'Everything',
    nunca: 'Never',
    sinVencimiento: 'No expiration',
    masAcciones: 'More actions',
    suspender: 'Suspend',
    reactivar: 'Reactivate',
    quitar: 'Remove access',
    cancelarInvitacion: 'Cancel invitation',
    invitaciones: 'Pending invitations',
    invitadoPor: 'Invited by',
    expira: 'Invitation expires',
    confirmarTitulo: {
      suspender: 'Suspend this person?',
      reactivar: 'Reactivate this person?',
      quitar: 'Remove their access?',
    },
    confirmarTexto: {
      suspender: 'Their sessions end right away on every device. You can reactivate them.',
      reactivar: 'They sign in again with their password and the same templates.',
      quitar: 'Their sessions end right away and they can’t sign in anymore. Their log is kept.',
    },
    motivo: 'Reason',
    motivoAyuda: 'It’s saved in the log with your name.',
    confirmar: 'Confirm',
    cancelar: 'Cancel',
    cerrar: 'Close',
    guardado: 'Saved.',
    segundoFactor: 'Two-step verification for sensitive actions',
    segundoFactorAyuda:
      'Asks for an emailed code before viewing photos or personal data, moving money or managing the team. Off by default: leadership decides.',
    encendido: 'On',
    apagado: 'Off',
    nuevo: 'Add employee',
    nuevoAyuda:
      'They get a one-time invitation that expires in 7 days. They create their password and sign in with what you give them here.',
    correo: 'Work email',
    nombre: 'Full name',
    soporteRegla: 'Accounts at @windoce.com carry “Soporte” in the name.',
    eligePlantillas: 'Role templates',
    noPuedesDar: 'Has permissions you don’t have',
    alcance: 'Scope',
    alcanceAyuda: 'Leave everything unchecked to work in every city and service.',
    paises: 'Countries',
    ciudades: 'Cities',
    servicios: 'Services',
    nombresServicio: {
      comida: 'Food',
      tiendas: 'Stores',
      carro: 'Car rides',
      moto: 'Moto rides',
      envios: 'Deliveries',
    },
    venceEn: 'Expires on (optional)',
    idiomaInvitacion: 'Invitation language',
    enviar: 'Send invitation',
    enviando: 'Sending…',
    recuperado: 'We recovered what you were typing.',
    empezarDeNuevo: 'Start over',
    enlaceTitulo: 'Invitation link (only you can see it)',
    enlaceAyuda:
      'On the test site and on your computer no emails go out: share this link with the person. It works once.',
    copiar: 'Copy link',
    copiado: 'Copied',
    correoMandado: 'Done: we emailed them the invitation.',
    volver: '← Internal team',
    acceso: 'Their access',
    editarAcceso: 'Change their access',
    guardarAcceso: 'Save access',
    permisosEfectivos: 'Effective permissions',
    deDonde: 'From',
    sinEfecto: 'Not active with their work area',
    sinEfectoNota:
      'Their access is limited to certain cities or services. These permissions cover the whole company (money, audit, settings), so they only apply with access to every city.',
    extra: 'Extra permission',
    loQueHizo: 'What they did',
    loQueVio: 'What they viewed',
    cambios: 'Changes to their access',
    nadaAun: 'Nothing yet.',
    rechazado: 'rejected',
    nuevaPlantilla: 'New template',
    deFabrica: 'Built-in',
    personas: 'people',
    permisos: 'permissions',
    editar: 'Edit',
    borrar: 'Delete template',
    nombreEs: 'Name in Spanish',
    nombreEn: 'Name in English',
    descripcionEs: 'Description in Spanish',
    descripcionEn: 'Description in English',
    topes: 'Money limit without a second signature (per currency, in cents)',
    guardar: 'Save template',
    totalNoEdita: 'Full access is everything, always: it can’t be edited.',
    tipoRegistro: 'What to look at',
    tiposRegistro: {
      acciones: 'Team changes',
      permisos: 'Hires, removals and permissions',
      accesos: 'What was viewed',
    },
    persona: 'Person',
    todas: 'Everyone',
    desde: 'From',
    hasta: 'To',
    exportar: 'Export CSV',
    columnasRegistro: { fecha: 'Date', persona: 'Person', que: 'What', detalle: 'Detail' },
    sinRegistro: 'Nothing matches those filters.',
    tiposAcceso: {
      foto_recogida: 'Pickup photo',
      foto_entrega: 'Drop-off photo',
      foto_ticket: 'Receipt photo',
      telefono: 'Full phone',
      correo: 'Full email',
      chat_pedido: 'Order chat',
    },
    objetos: {
      pedido: 'Order',
      viaje: 'Ride',
      cliente: 'Customer',
      repartidor: 'Driver',
      restaurante: 'Store',
      ticket: 'Ticket',
      cuenta: 'Account',
    },
    acciones: {
      'equipo.alta': 'Joined the team by invitation',
      'equipo.permisos': 'Templates or permissions changed',
      'equipo.suspendido': 'Suspended',
      'equipo.activo': 'Reactivated',
      'equipo.retirado': 'Access removed',
      'equipo.invitacion': 'Invitation sent',
      'equipo.invitacion_cancelada': 'Invitation canceled',
      'equipo.plantilla': 'Template edited',
      'equipo.plantilla_nueva': 'New template',
      'equipo.plantilla_borrada': 'Template deleted',
      'equipo.segundo_factor': 'Two-step verification',
    },
    misAvisos: 'My email alerts',
    misAvisosAyuda:
      'Choose which alerts you get. The system alert (something stopped working) can’t be turned off for the site’s fixed emails.',
    tiposAviso: {
      pedidos: 'Orders (no driver, lost driver, store without signal)',
      dinero: 'Money (reconciliation, failed payouts, disputes)',
      verificaciones: 'Verifications (new stores, identity, background checks)',
      sistema: 'System (something stopped working, emergencies)',
    },
  },
};
export type TextosEquipo = (typeof TEXTOS_EQUIPO)['es'];
export const textosEquipo = (idioma: Idioma): TextosEquipo => enIdioma(TEXTOS_EQUIPO, idioma);

const AREAS = {
  es: {
    monitoreo: 'Monitoreo',
    pedidos: 'Pedidos',
    viajes: 'Viajes',
    clientes: 'Clientes',
    repartidores: 'Repartidores y conductores',
    kyc: 'Verificaciones',
    tickets: 'Tickets',
    restaurantes: 'Comercios',
    dinero: 'Dinero',
    equipo: 'Equipo',
    avisos: 'Avisos',
    auditoria: 'Auditoría',
    config: 'Configuración',
  },
  en: {
    monitoreo: 'Monitoring',
    pedidos: 'Orders',
    viajes: 'Rides',
    clientes: 'Customers',
    repartidores: 'Drivers',
    kyc: 'Verifications',
    tickets: 'Tickets',
    restaurantes: 'Stores',
    dinero: 'Money',
    equipo: 'Team',
    avisos: 'Alerts',
    auditoria: 'Audit',
    config: 'Settings',
  },
};

export function nombreArea(area: string, idioma: Idioma): string {
  return new Map(Object.entries(enIdioma(AREAS, idioma))).get(area) ?? area;
}
export function nombrePermiso(p: string, idioma: Idioma): string {
  const n = new Map(Object.entries(NOMBRES_PERMISOS)).get(p) as
    { es: string; en: string } | undefined;
  return n ? enIdioma(n, idioma) : p;
}
/** Los permisos agrupados por área, en el orden de la lista. */
export function porArea(permisos: readonly string[]): [string, string[]][] {
  const m = new Map<string, string[]>();
  for (const p of permisos) {
    const area = p.split('.')[0] ?? p;
    m.set(area, [...(m.get(area) ?? []), p]);
  }
  return [...m.entries()];
}
export type Plantilla = {
  id: string;
  nombre: { es: string; en: string };
  descripcion: { es: string; en: string };
  permisos: PermisoInterno[];
  topes: Record<string, number> | null;
  sistema: boolean;
  editable: boolean;
  borrable: boolean;
  personas: number;
};
export type Zona = { id: string; nombre: string; pais: string };

/** El alcance en palabras: «Todo», o «Miami, Novi · Comida». */
export function alcanceEnPalabras(a: Alcance, zonas: Zona[], idioma: Idioma): string {
  const t = textosEquipo(idioma);
  const partes: string[] = [];
  const nombre = (id: string) => zonas.find((z) => z.id === id)?.nombre ?? id;
  const donde = [...(a.paises ?? []), ...(a.zonas ?? []).map(nombre)];
  if (donde.length) partes.push(donde.join(', '));
  if (a.servicios?.length)
    partes.push(
      a.servicios.map((s) => new Map(Object.entries(t.nombresServicio)).get(s) ?? s).join(', '),
    );
  return partes.length ? partes.join(' · ') : t.todo;
}

/** «pedido:407f2f…» → «Pedido #407F2F» (el registro guarda el id, nunca el dato). */
export function objetoEnPalabras(objeto: string, t: TextosEquipo): string {
  const [tipo = '', id = ''] = objeto.split(':');
  const nombre = new Map(Object.entries(t.objetos)).get(tipo) ?? tipo;
  return `${nombre} #${id.slice(0, 6).toUpperCase()}`;
}
export function accionEnPalabras(accion: string, t: TextosEquipo): string {
  return new Map(Object.entries(t.acciones)).get(accion) ?? accion;
}
