import { type PerfilInterno, permiteAccionInterna } from './perfilesInternos';

/**
 * C-PERMISOS-FINOS (MON-5, 15 nov 2026) — todos los países.
 *
 * Los permisos del equipo interno con nombre fino `área.acción`, agrupados en plantillas de puesto
 * (como los roles de Stripe [DOC]: se asignan varias y se suman). Una sola pieza: la usa el servidor
 * para frenar y el panel para no ofrecer lo que la persona no puede usar (`puedeVer`).
 *
 * Ficha: /Users/windocellc/Gerencia/informes/MONITOREO-SUPERADMIN-DIVOOX.md, secciones 4.7 y 8.
 */
export const PERMISOS_INTERNOS = [
  // Monitoreo
  'monitoreo.ver',
  'monitoreo.buscar',
  'monitoreo.exportar',
  // Pedidos
  'pedidos.ver',
  'pedidos.fotos',
  'pedidos.chat',
  'pedidos.cancelar',
  'pedidos.reasignar',
  'pedidos.autorizar_ubicacion',
  'pedidos.devolver',
  // Viajes (Moto, Carro y envíos de paquete)
  'viajes.ver',
  'viajes.emergencias',
  'viajes.ubicacion_en_vivo',
  'viajes.configurar',
  // Clientes
  'clientes.ver',
  'clientes.datos_personales',
  'clientes.suspender',
  // Repartidores y conductores
  'repartidores.ver',
  'repartidores.documentos',
  'repartidores.editar',
  'repartidores.habilitar',
  'repartidores.gestionar',
  // Verificaciones
  'kyc.ver',
  'kyc.decidir',
  // Tickets
  'tickets.ver',
  'tickets.responder',
  'tickets.asignar',
  'tickets.plantillas',
  'tickets.configurar',
  // Comercios
  'restaurantes.ver',
  'restaurantes.editar',
  // Dinero
  'dinero.ver',
  'dinero.solicitar',
  'dinero.reembolsar',
  'dinero.aprobar',
  'dinero.conciliar',
  'dinero.configurar',
  'dinero.limites',
  // Equipo, avisos y auditoría
  'equipo.ver',
  'equipo.gestionar',
  'avisos.recibir',
  'auditoria.ver',
  'auditoria.accesos',
  // Configuración del negocio (territorio, servicios, promociones, pilotos)
  'config.ver',
  'config.editar',
] as const;
export type PermisoInterno = (typeof PERMISOS_INTERNOS)[number];

/** Una ruta que puede usar cualquier persona activa del equipo (sus filtros, su propia ficha). */
export const LIBRE = 'libre' as const;
export type PermisoRuta = PermisoInterno | typeof LIBRE;

const TODOS = new Set<string>(PERMISOS_INTERNOS);
export function esPermisoInterno(p: string): p is PermisoInterno {
  return TODOS.has(p);
}

/**
 * Permisos delicados: con el segundo factor encendido piden el código por correo (una vez cada
 * `horasSegundoFactor`). Ver `CONFIG_PERMISOS`.
 */
export const PERMISOS_DELICADOS: readonly PermisoInterno[] = [
  'pedidos.fotos',
  'clientes.datos_personales',
  'dinero.solicitar',
  'dinero.reembolsar',
  'dinero.aprobar',
  'dinero.conciliar',
  'dinero.configurar',
  'dinero.limites',
  'pedidos.devolver',
  'equipo.gestionar',
];
export function esDelicado(p: string): boolean {
  return (PERMISOS_DELICADOS as readonly string[]).includes(p);
}

/** Los permisos que mueven dinero a mano: a ellos se aplica el tope de la plantilla. */
export const PERMISOS_QUE_MUEVEN_DINERO: readonly string[] = [
  'pedidos.devolver',
  'dinero.reembolsar',
  'dinero.solicitar',
];
export function mueveDinero(permisos: readonly string[]): boolean {
  return permisos.some((p) => PERMISOS_QUE_MUEVEN_DINERO.includes(p));
}

/** Monto máximo por moneda (unidad menor) que la persona mueve sin segunda firma. */
export type Topes = Partial<Record<string, number>>;

/**
 * LAS DECISIONES PENDIENTES DE RICHARD, EN UN SOLO LUGAR (sección 8 de la ficha). Se aplica lo
 * recomendado y se cambia aquí:
 * - 2: las fotos de entrega desde Soporte nivel 1 hacia arriba (Monitor no), con registro.
 * - 3: teléfono y correo completos desde Soporte nivel 2 (con «Ver dato» y registro).
 * - 4: segundo factor para los permisos delicados: construido, APAGADO de fábrica. Lo enciende una
 *   cuenta con `equipo.gestionar` en «Equipo interno»; aquí queda el valor inicial.
 * - 5: el registro de lo que se vio se guarda 90 días.
 * - 6: topes de dinero por plantilla (unidad menor de cada moneda). Por encima del tope de la
 *   persona, el movimiento queda esperando la segunda firma aunque esté bajo el umbral general.
 */
export const CONFIG_PERMISOS = {
  fotosDesde: 'soporte_1',
  datosPersonalesDesde: 'soporte_2',
  segundoFactorInicial: false,
  horasSegundoFactor: 12,
  minutosCodigoSegundoFactor: 10,
  diasRegistroAccesos: 90,
  diasInvitacion: 7,
  topes: {
    soporte_2: { USD: 5_000, MXN: 100_000, COP: 200_000, VES: 2_000_000 },
    supervisor: { USD: 20_000, MXN: 400_000, COP: 800_000, VES: 8_000_000 },
  } as Readonly<Record<string, Topes>>,
} as const;

export type PlantillaSistema = {
  id: string;
  nombre: { es: string; en: string };
  descripcion: { es: string; en: string };
  permisos: readonly PermisoInterno[];
  topes?: Topes;
};

const VER: readonly PermisoInterno[] = PERMISOS_INTERNOS.filter((p) => p.endsWith('.ver'));
const MONITOR: readonly PermisoInterno[] = [
  'monitoreo.ver',
  'monitoreo.buscar',
  'pedidos.ver',
  'viajes.ver',
  'restaurantes.ver',
  'avisos.recibir',
];
const SOPORTE_1: readonly PermisoInterno[] = [
  ...MONITOR,
  'pedidos.chat',
  'tickets.ver',
  'tickets.responder',
  'clientes.ver',
  'repartidores.ver',
];
const SOPORTE_2: readonly PermisoInterno[] = [
  ...SOPORTE_1,
  'pedidos.cancelar',
  'pedidos.reasignar',
  'pedidos.autorizar_ubicacion',
  'pedidos.devolver',
  'dinero.solicitar',
  'tickets.asignar',
  'tickets.plantillas',
  'restaurantes.editar',
  'repartidores.editar',
];
const SUPERVISOR: readonly PermisoInterno[] = [
  ...SOPORTE_2,
  'dinero.ver',
  'dinero.aprobar',
  'tickets.configurar',
  'viajes.emergencias',
  'kyc.ver',
  'equipo.ver',
  'auditoria.ver',
  'monitoreo.exportar',
];

/** Agrega `pedidos.fotos` y `clientes.datos_personales` según `CONFIG_PERMISOS` (desde qué nivel). */
const ORDEN_NIVELES = ['monitor', 'soporte_1', 'soporte_2', 'supervisor'];
function conDecisiones(id: string, permisos: readonly PermisoInterno[]): PermisoInterno[] {
  const nivel = ORDEN_NIVELES.indexOf(id);
  const extra: PermisoInterno[] = [];
  if (nivel >= 0 && nivel >= ORDEN_NIVELES.indexOf(CONFIG_PERMISOS.fotosDesde))
    extra.push('pedidos.fotos');
  if (nivel >= 0 && nivel >= ORDEN_NIVELES.indexOf(CONFIG_PERMISOS.datosPersonalesDesde))
    extra.push('clientes.datos_personales');
  return [...new Set([...permisos, ...extra])];
}

/**
 * Plantillas de puesto de fábrica. No se borran. Una cuenta con `equipo.gestionar` crea otras
 * (tabla `plantillas_internas`); «Total» es todo y no se edita.
 */
export const PLANTILLAS_SISTEMA: readonly PlantillaSistema[] = [
  {
    id: 'monitor',
    nombre: { es: 'Monitor', en: 'Monitor' },
    descripcion: {
      es: 'Vigila los pedidos y viajes en curso y usa el buscador. No ve fotos ni datos personales ni cambia nada.',
      en: 'Watches live orders and rides and uses search. Can’t see photos or personal data and can’t change anything.',
    },
    permisos: conDecisiones('monitor', MONITOR),
  },
  {
    id: 'soporte_1',
    nombre: { es: 'Soporte nivel 1', en: 'Support level 1' },
    descripcion: {
      es: 'Atiende tickets y el chat de los pedidos, y ve las fotos de recogida y entrega (cada vista queda registrada). Teléfonos y correos enmascarados.',
      en: 'Handles tickets and order chat, and sees pickup and drop-off photos (every view is logged). Phones and emails stay masked.',
    },
    permisos: conDecisiones('soporte_1', SOPORTE_1),
  },
  {
    id: 'soporte_2',
    nombre: { es: 'Soporte nivel 2', en: 'Support level 2' },
    descripcion: {
      es: 'Lo de nivel 1, más cancelar, soltar repartidor, autorizar la ubicación y devolver hasta su tope. Puede ver el teléfono y el correo completos.',
      en: 'Level 1, plus cancel, release a driver, approve a location and refund up to its limit. Can reveal full phones and emails.',
    },
    permisos: conDecisiones('soporte_2', SOPORTE_2),
    topes: CONFIG_PERMISOS.topes.soporte_2,
  },
  {
    id: 'verificador',
    nombre: { es: 'Verificador de identidad', en: 'Identity verifier' },
    descripcion: {
      es: 'Revisa la identidad y los documentos de repartidores y conductores, y decide las verificaciones.',
      en: 'Reviews driver identity and documents and decides verifications.',
    },
    permisos: [
      'monitoreo.buscar',
      'kyc.ver',
      'kyc.decidir',
      'repartidores.ver',
      'repartidores.documentos',
      'repartidores.habilitar',
      'avisos.recibir',
    ],
  },
  {
    id: 'emergencias',
    nombre: { es: 'Emergencias de viaje', en: 'Ride emergencies' },
    descripcion: {
      es: 'Atiende las emergencias de Moto y Carro: ve la ubicación en vivo y el contacto de quien pidió ayuda.',
      en: 'Handles Moto and Car emergencies: sees the live location and the contact of whoever asked for help.',
    },
    permisos: [
      'monitoreo.ver',
      'monitoreo.buscar',
      'viajes.ver',
      'viajes.emergencias',
      'viajes.ubicacion_en_vivo',
      'clientes.ver',
      'repartidores.ver',
      'avisos.recibir',
    ],
  },
  {
    id: 'finanzas',
    nombre: { es: 'Finanzas', en: 'Finance' },
    descripcion: {
      es: 'Dinero, conciliación, retiros y configuración de países. Aprueba con segunda firma lo que pide otra persona.',
      en: 'Money, reconciliation, payouts and country settings. Gives the second signature on what someone else requested.',
    },
    permisos: [
      'monitoreo.buscar',
      'monitoreo.exportar',
      'pedidos.ver',
      'dinero.ver',
      'dinero.solicitar',
      'dinero.reembolsar',
      'dinero.aprobar',
      'dinero.conciliar',
      'dinero.configurar',
      'auditoria.ver',
      'avisos.recibir',
    ],
  },
  {
    id: 'supervisor',
    nombre: { es: 'Supervisor', en: 'Supervisor' },
    descripcion: {
      es: 'Lo de Soporte nivel 2, más aprobar dinero con segunda firma, emergencias, verificaciones a la vista y el equipo a la vista.',
      en: 'Support level 2, plus second-signature money approvals, emergencies, verifications and the team in view.',
    },
    permisos: conDecisiones('supervisor', SUPERVISOR),
    topes: CONFIG_PERMISOS.topes.supervisor,
  },
  {
    id: 'auditor',
    nombre: { es: 'Auditor', en: 'Auditor' },
    descripcion: {
      es: 'Mira todo sin cambiar nada, incluido el registro de lo que hizo y lo que vio cada persona. No ve fotos ni datos personales.',
      en: 'Sees everything without changing anything, including the log of what each person did and saw. No photos or personal data.',
    },
    permisos: [...VER, 'monitoreo.buscar', 'monitoreo.exportar', 'auditoria.accesos'],
  },
  {
    id: 'total',
    nombre: { es: 'Total', en: 'Full access' },
    descripcion: {
      es: 'Todos los permisos, también gestionar el equipo y los límites de dinero. Para el dueño y muy pocas personas más.',
      en: 'Every permission, including managing the team and money limits. For the owner and very few others.',
    },
    permisos: PERMISOS_INTERNOS,
  },
];

export function plantillaSistema(id: string): PlantillaSistema | undefined {
  return PLANTILLAS_SISTEMA.find((p) => p.id === id);
}

// ─────────────────────────────── Alcance (ciudad, país, servicio) ───────────────────────────────

/** Servicios en los que se puede acotar a una persona. Comida y tiendas salen del comercio. */
export const SERVICIOS_ALCANCE = ['comida', 'tiendas', 'carro', 'moto', 'envios'] as const;
export type ServicioAlcance = (typeof SERVICIOS_ALCANCE)[number];

/** `null` en un campo = sin límite en ese campo. */
export type Alcance = {
  paises: string[] | null;
  zonas: string[] | null;
  servicios: ServicioAlcance[] | null;
};
export const ALCANCE_TOTAL: Alcance = { paises: null, zonas: null, servicios: null };

export function alcanceEsTotal(a: Alcance): boolean {
  return a.paises === null && a.zonas === null && a.servicios === null;
}

/**
 * El alcance de la persona es la UNIÓN de los de sus asignaciones (los permisos se suman, el
 * alcance también). Un campo sin límite en cualquier asignación queda sin límite.
 */
export function unirAlcances(lista: Alcance[]): Alcance {
  if (!lista.length) return ALCANCE_TOTAL;
  const unir = <T>(campo: (a: Alcance) => T[] | null): T[] | null => {
    const vals = lista.map(campo);
    if (vals.some((v) => v === null)) return null;
    return [...new Set(vals.flatMap((v) => v ?? []))];
  };
  // País y ciudad juntos dicen «dónde»: si una asignación limita por país y otra por ciudad, la
  // persona ve las ciudades de la segunda y todo el país de la primera.
  const sinDonde = lista.some((a) => a.paises === null && a.zonas === null);
  return {
    paises: sinDonde ? null : [...new Set(lista.flatMap((a) => a.paises ?? []))],
    zonas: sinDonde ? null : [...new Set(lista.flatMap((a) => a.zonas ?? []))],
    servicios: unir((a) => a.servicios),
  };
}

/** ¿El alcance `a` cabe dentro de `b`? (quien invita no da más de lo que tiene). */
export function alcanceDentroDe(a: Alcance, b: Alcance): boolean {
  const dondeLibreB = b.paises === null && b.zonas === null;
  if (!dondeLibreB) {
    if (a.paises === null && a.zonas === null) return false;
    const paisesB = new Set(b.paises ?? []);
    const zonasB = new Set(b.zonas ?? []);
    if ((a.paises ?? []).some((p) => !paisesB.has(p))) return false;
    // Una ciudad cabe si está en sus ciudades; con país ya no se puede comprobar aquí: el servidor
    // compara con el país de la ciudad (`zonasFuera`).
    if (!paisesB.size && (a.zonas ?? []).some((z) => !zonasB.has(z))) return false;
  }
  if (b.servicios !== null) {
    if (a.servicios === null) return false;
    const sB = new Set(b.servicios);
    if (a.servicios.some((s) => !sB.has(s))) return false;
  }
  return true;
}

/** El servicio de un pedido según el tipo de comercio (comida = restaurante; lo demás, tiendas). */
export function servicioAlcanceDePedido(tipoComercio: string | null | undefined): ServicioAlcance {
  return !tipoComercio || tipoComercio === 'restaurante' ? 'comida' : 'tiendas';
}

/** El servicio de una operación (viaje o envío) según `operaciones.servicio_id`. */
export function servicioAlcanceDeOperacion(servicioId: string | null | undefined): ServicioAlcance {
  if (servicioId === 'carro' || servicioId === 'moto') return servicioId;
  return 'envios';
}

// ─────────────────────────────── Permisos efectivos ───────────────────────────────

/** Lo que el servidor guarda en la sesión y le manda al panel. */
export type AccesoInterno = {
  /** activo | suspendido | retirado | vencido (los tres últimos no entran). */
  estado: 'activo' | 'suspendido' | 'retirado' | 'vencido';
  /** El dueño (`ADMIN_CORREOS`): siempre Total, ni se suspende ni vence (rompe-cristales). */
  dueno: boolean;
  /** `legado:<perfil>` si la cuenta todavía no tiene asignaciones nuevas. */
  origen: string;
  permisos: PermisoInterno[];
  /** De qué plantilla sale cada permiso (para la ficha del empleado). */
  fuentes: Record<string, string[]>;
  alcance: Alcance;
  topes: Topes | null;
  /** Cuándo vence la primera asignación (para recalcular la sesión ese día). */
  revisarEn: string | null;
};

/**
 * Lo de hoy, traducido: una cuenta sin asignaciones nuevas sigue EXACTAMENTE con su perfil viejo.
 * Los permisos salen de las rutas que su perfil deja usar (C-ROLES-INTERNOS), más lo que hoy puede
 * ver cualquier admin (fotos, chat, contactos, ubicación). Lo que el perfil viejo frenaba dentro de
 * la propia ruta (aprobar dinero, límites, el equipo) se quita aquí.
 */
const DATOS_QUE_HOY_VE_TODO_ADMIN: PermisoInterno[] = [
  'pedidos.fotos',
  'pedidos.chat',
  'clientes.datos_personales',
  'viajes.ubicacion_en_vivo',
];
const QUITAR_EN_LEGADO: Record<PerfilInterno, readonly PermisoInterno[]> = {
  total: [],
  // En la propia ruta, solo Total y Finanzas aprobaban; solo Total tocaba límites y el equipo.
  soporte: ['dinero.aprobar', 'dinero.limites', 'equipo.gestionar'],
  finanzas: ['dinero.limites', 'equipo.gestionar'],
  lectura: ['dinero.aprobar', 'dinero.limites', 'equipo.gestionar'],
};

export function permisosDeLegado(
  perfil: PerfilInterno,
  rutas: ReadonlyArray<readonly [string, PermisoRuta]>,
): PermisoInterno[] {
  if (perfil === 'total') return [...PERMISOS_INTERNOS];
  const quitar = new Set<string>(new Map(Object.entries(QUITAR_EN_LEGADO)).get(perfil) ?? []);
  const s = new Set<PermisoInterno>(DATOS_QUE_HOY_VE_TODO_ADMIN);
  for (const [clave, permiso] of rutas) {
    if (permiso === LIBRE) continue;
    const [metodo = 'GET', ruta = ''] = clave.split(' ');
    if (permiteAccionInterna(perfil, metodo, `/datos${ruta}`)) s.add(permiso);
  }
  return PERMISOS_INTERNOS.filter((p) => s.has(p) && !quitar.has(p));
}

export type AsignacionInterna = {
  plantillaId: string;
  nombre: string;
  permisos: readonly string[];
  topes?: Topes | null;
  alcance: Alcance;
  venceEn: string | null;
};
export type AjustePersona = { permiso: string; tipo: 'extra' | 'quitado' };

/** Suma las plantillas, aplica los permisos extra y los quitados por persona, y une los alcances. */
export function calcularAcceso(entrada: {
  dueno: boolean;
  perfilViejo: PerfilInterno | null;
  estado: AccesoInterno['estado'];
  asignaciones: AsignacionInterna[];
  ajustes: AjustePersona[];
  rutas: ReadonlyArray<readonly [string, PermisoRuta]>;
  ahora?: Date;
}): AccesoInterno {
  if (entrada.dueno)
    return {
      estado: 'activo',
      dueno: true,
      origen: 'dueno',
      permisos: [...PERMISOS_INTERNOS],
      fuentes: Object.fromEntries(PERMISOS_INTERNOS.map((p) => [p, ['total']])),
      alcance: ALCANCE_TOTAL,
      topes: null,
      revisarEn: null,
    };
  const ahora = (entrada.ahora ?? new Date()).toISOString().replace('T', ' ').slice(0, 19);
  const vigentes = entrada.asignaciones.filter((a) => !a.venceEn || a.venceEn > ahora);
  const tieneNuevas = entrada.asignaciones.length > 0;
  // Todas sus asignaciones vencieron: la cuenta queda «vencida» (no entra) hasta que la renueven.
  const estado =
    entrada.estado === 'activo' && tieneNuevas && !vigentes.length ? 'vencido' : entrada.estado;
  if (estado !== 'activo')
    return {
      estado,
      dueno: false,
      origen: tieneNuevas ? 'asignaciones' : `legado:${entrada.perfilViejo ?? 'total'}`,
      permisos: [],
      fuentes: {},
      alcance: ALCANCE_TOTAL,
      topes: null,
      revisarEn: null,
    };
  const fuentes = new Map<string, Set<string>>();
  const anotar = (p: string, de: string) => {
    if (!esPermisoInterno(p)) return;
    const f = fuentes.get(p) ?? new Set<string>();
    f.add(de);
    fuentes.set(p, f);
  };
  let topes: Topes | null = null;
  let alcance = ALCANCE_TOTAL;
  let revisarEn: string | null = null;
  if (!tieneNuevas) {
    const perfil = entrada.perfilViejo ?? 'total';
    for (const p of permisosDeLegado(perfil, entrada.rutas)) anotar(p, `legado:${perfil}`);
  } else {
    // El tope de la persona: el más alto de sus plantillas con dinero; una plantilla con permiso de
    // dinero y SIN tope deja solo el umbral general del control dual.
    let sinTope = false;
    const porMoneda = new Map<string, number>();
    for (const a of vigentes) {
      for (const p of a.permisos) anotar(p, a.plantillaId);
      if (mueveDinero(a.permisos)) {
        if (!a.topes) sinTope = true;
        else
          for (const [m, v] of Object.entries(a.topes))
            if (typeof v === 'number') porMoneda.set(m, Math.max(porMoneda.get(m) ?? 0, v));
      }
      if (a.venceEn && (!revisarEn || a.venceEn < revisarEn)) revisarEn = a.venceEn;
    }
    topes = sinTope || !porMoneda.size ? null : Object.fromEntries(porMoneda);
    alcance = unirAlcances(vigentes.map((a) => a.alcance));
  }
  for (const a of entrada.ajustes) if (a.tipo === 'extra') anotar(a.permiso, 'extra');
  for (const a of entrada.ajustes) if (a.tipo === 'quitado') fuentes.delete(a.permiso);
  const permisos = PERMISOS_INTERNOS.filter((p) => fuentes.has(p));
  return {
    estado: 'activo',
    dueno: false,
    origen: tieneNuevas ? 'asignaciones' : `legado:${entrada.perfilViejo ?? 'total'}`,
    permisos,
    fuentes: Object.fromEntries(permisos.map((p) => [p, [...(fuentes.get(p) ?? [])]])),
    alcance,
    topes,
    revisarEn,
  };
}

/** `puedeVer(acceso, permiso)`: la pregunta que hacen el servidor y el panel. */
export function puedeVer(
  acceso: Pick<AccesoInterno, 'permisos' | 'estado'> | null | undefined,
  permiso: PermisoRuta,
): boolean {
  if (!acceso || acceso.estado !== 'activo') return false;
  if (permiso === LIBRE) return true;
  return acceso.permisos.includes(permiso);
}

/** ¿Los permisos `pedidos` caben en los de quien los da? (nadie da más de lo que tiene). */
export function permisosFuera(pedidos: readonly string[], propios: readonly string[]): string[] {
  const s = new Set(propios);
  return [...new Set(pedidos)].filter((p) => !s.has(p));
}

/** ¿Los topes pedidos caben en los de quien los da? `null` = sin tope (solo el control dual). */
export function topesDentroDe(pedidos: Topes | null, propios: Topes | null): boolean {
  if (propios === null) return true;
  if (pedidos === null) return false;
  return Object.entries(pedidos).every(([m, v]) => {
    const tope = new Map(Object.entries(propios)).get(m);
    return typeof v !== 'number' || (typeof tope === 'number' && v <= tope);
  });
}

/**
 * Regla de la casa «Nuestras cuentas SIEMPRE se llaman Soporte»: una cuenta de nuestro dominio
 * (@windoce.com) lleva «Soporte» en el nombre visible. La aplican el panel y el servidor.
 */
export function nombreCumpleSoporte(correo: string, nombre: string): boolean {
  return !correo.trim().toLowerCase().endsWith('@windoce.com') || /soporte/i.test(nombre);
}

/** Etiquetas de cada permiso para la ficha del empleado y el editor de plantillas. */
export const NOMBRES_PERMISOS: Record<PermisoInterno, { es: string; en: string }> = {
  'monitoreo.ver': { es: 'Ver pedidos y viajes en curso', en: 'See live orders and rides' },
  'monitoreo.buscar': { es: 'Usar el buscador', en: 'Use search' },
  'monitoreo.exportar': { es: 'Exportar informes', en: 'Export reports' },
  'pedidos.ver': { es: 'Ver pedidos', en: 'See orders' },
  'pedidos.fotos': {
    es: 'Ver fotos de recogida y entrega',
    en: 'See pickup and drop-off photos',
  },
  'pedidos.chat': { es: 'Leer el chat del pedido', en: 'Read order chat' },
  'pedidos.cancelar': { es: 'Cancelar pedidos', en: 'Cancel orders' },
  'pedidos.reasignar': { es: 'Soltar al repartidor', en: 'Release the driver' },
  'pedidos.autorizar_ubicacion': {
    es: 'Autorizar una ubicación',
    en: 'Approve a location',
  },
  'pedidos.devolver': { es: 'Devolver dinero de un pedido', en: 'Refund an order' },
  'viajes.ver': { es: 'Ver viajes', en: 'See rides' },
  'viajes.emergencias': { es: 'Atender emergencias de viaje', en: 'Handle ride emergencies' },
  'viajes.ubicacion_en_vivo': { es: 'Ver la ubicación en vivo', en: 'See live location' },
  'viajes.configurar': { es: 'Tarifas y ciudades de viajes', en: 'Ride fares and cities' },
  'clientes.ver': { es: 'Ver clientes', en: 'See customers' },
  'clientes.datos_personales': {
    es: 'Ver teléfono y correo completos',
    en: 'Reveal full phone and email',
  },
  'clientes.suspender': { es: 'Suspender o borrar cuentas', en: 'Suspend or delete accounts' },
  'repartidores.ver': { es: 'Ver repartidores y conductores', en: 'See drivers' },
  'repartidores.documentos': { es: 'Ver documentos', en: 'See documents' },
  'repartidores.editar': { es: 'Editar repartidores y vehículos', en: 'Edit drivers and vehicles' },
  'repartidores.habilitar': { es: 'Habilitar servicios', en: 'Enable services' },
  'repartidores.gestionar': {
    es: 'Requisitos, papeles y ciudad del conductor',
    en: 'Driver requirements, papers and city',
  },
  'kyc.ver': { es: 'Ver verificaciones', en: 'See verifications' },
  'kyc.decidir': { es: 'Decidir verificaciones', en: 'Decide verifications' },
  'tickets.ver': { es: 'Ver tickets', en: 'See tickets' },
  'tickets.responder': { es: 'Responder tickets', en: 'Reply to tickets' },
  'tickets.asignar': { es: 'Asignar y cerrar tickets', en: 'Assign and close tickets' },
  'tickets.plantillas': { es: 'Respuestas guardadas', en: 'Saved replies' },
  'tickets.configurar': { es: 'Configurar quejas y lista de espera', en: 'Complaint settings' },
  'restaurantes.ver': { es: 'Ver comercios', en: 'See stores' },
  'restaurantes.editar': { es: 'Aprobar y editar comercios', en: 'Approve and edit stores' },
  'dinero.ver': { es: 'Ver dinero', en: 'See money' },
  'dinero.solicitar': { es: 'Pedir movimientos de dinero', en: 'Request money moves' },
  'dinero.reembolsar': { es: 'Reembolsos y ajustes', en: 'Refunds and adjustments' },
  'dinero.aprobar': { es: 'Aprobar con segunda firma', en: 'Give the second signature' },
  'dinero.conciliar': { es: 'Conciliar', en: 'Reconcile' },
  'dinero.configurar': { es: 'Configurar dinero y países', en: 'Money and country settings' },
  'dinero.limites': { es: 'Límites del control dual', en: 'Two-person limits' },
  'equipo.ver': { es: 'Ver el equipo', en: 'See the team' },
  'equipo.gestionar': { es: 'Gestionar el equipo', en: 'Manage the team' },
  'avisos.recibir': { es: 'Elegir sus avisos por correo', en: 'Choose email alerts' },
  'auditoria.ver': { es: 'Ver el registro de cambios', en: 'See the change log' },
  'auditoria.accesos': { es: 'Ver lo que vio cada persona', en: 'See what each person viewed' },
  'config.ver': { es: 'Ver la configuración', en: 'See settings' },
  'config.editar': {
    es: 'Cambiar territorio, servicios y promociones',
    en: 'Change territory, services and promotions',
  },
};
