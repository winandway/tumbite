import { type Idioma, enIdioma } from '@tumbite/compartido';

/**
 * C-SIN-CODIGOS-CRUDOS (Richard, 25 nov 2026: en la ficha salían «vehiculo_incompatible» y
 * «proximamente») — todos los países. Un código del servidor (estado, motivo, tipo) NUNCA se pinta
 * tal cual: se dice en palabras con su tabla y, si llega uno que la tabla no conoce, se dice igual en
 * palabras («sin habilitacion» → «Sin habilitacion»), jamás con guiones bajos. Pieza pura.
 */

/** Un código desconocido dicho en palabras: sin guiones bajos y con mayúscula al empezar. */
export function codigoEnPalabras(codigo: string | null | undefined): string {
  const s = String(codigo ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** La palabra de un código según su tabla; si la tabla no lo tiene, el código en palabras. */
export function palabra(tabla: Record<string, string>, codigo: string | null | undefined): string {
  const clave = String(codigo ?? '');
  return new Map(Object.entries(tabla)).get(clave) ?? codigoEnPalabras(clave);
}

/**
 * Por qué un servicio no le llega a un conductor (el `motivo` del servidor, `MotivoSinComida`), dicho
 * para el equipo. `s` es el nombre del servicio («Moto», «Carro»).
 */
const T_MOTIVOS = {
  es: {
    habilitado: (s: string) => `No le falta nada para ${s}.`,
    proximamente: (s: string) => `${s} todavía no está abierto en su ciudad.`,
    en_pausa: (s: string) => `${s} está en pausa en su ciudad.`,
    no_disponible_zona: (s: string) => `${s} no se ofrece en su ciudad.`,
    actualizar_app: () => 'Tiene que actualizar Driver para recibirlo.',
    pendiente_aprobacion: (s: string) => `Pidió ${s}: espera que el equipo lo habilite.`,
    sin_habilitacion: (s: string) => `Todavía no está habilitado para ${s}.`,
    requisitos_faltantes: () => 'Le faltan requisitos por aprobar.',
    vehiculo_incompatible: (s: string) =>
      `Habilitado, pero sin ${s === 'Carro' ? 'carro aprobado' : 'moto aprobada'} en uso.`,
    preferencia_apagada: (s: string) => `Tiene ${s} apagado en sus servicios.`,
    bloqueado: (s: string) => `Está en pausa para ${s}.`,
  },
  en: {
    habilitado: (s: string) => `Nothing missing for ${s}.`,
    proximamente: (s: string) => `${s} isn’t open in their city yet.`,
    en_pausa: (s: string) => `${s} is paused in their city.`,
    no_disponible_zona: (s: string) => `${s} isn’t offered in their city.`,
    actualizar_app: () => 'They need to update Driver to get it.',
    pendiente_aprobacion: (s: string) => `Asked for ${s}: waiting for the team to enable it.`,
    sin_habilitacion: (s: string) => `Not enabled for ${s} yet.`,
    requisitos_faltantes: () => 'Requirements still waiting for approval.',
    vehiculo_incompatible: (s: string) =>
      `Enabled, but no approved ${s === 'Car' ? 'car' : 'motorcycle'} in use.`,
    preferencia_apagada: (s: string) => `They turned ${s} off in their services.`,
    bloqueado: (s: string) => `Paused for ${s}.`,
  },
};

export const MOTIVOS_SERVICIO = Object.keys(T_MOTIVOS.es) as (keyof typeof T_MOTIVOS.es)[];

export function motivoServicioEnPalabras(
  motivo: string | null | undefined,
  servicio: string,
  idioma: Idioma,
): string {
  const t = enIdioma(T_MOTIVOS, idioma);
  const f = new Map<string, (s: string) => string>(Object.entries(t)).get(String(motivo ?? ''));
  return f ? f(servicio) : codigoEnPalabras(motivo);
}

/** Estados de un vehículo (tabla `vehiculos`). */
export const T_ESTADOS_VEHICULO = {
  es: {
    registrado: 'Registrado, sin enviar',
    en_revision: 'En revisión',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    suspendido: 'Suspendido',
    vencido: 'Vencido',
    retirado: 'Retirado',
  } as Record<string, string>,
  en: {
    registrado: 'Registered, not sent',
    en_revision: 'Under review',
    aprobado: 'Approved',
    rechazado: 'Rejected',
    suspendido: 'Suspended',
    vencido: 'Expired',
    retirado: 'Removed',
  } as Record<string, string>,
};

/** Tipos de vehículo. */
export const T_TIPOS_VEHICULO = {
  es: {
    moto: 'Moto',
    carro: 'Carro',
    scooter: 'Scooter',
    bicicleta: 'Bicicleta',
    bici: 'Bicicleta',
    pie: 'A pie',
  } as Record<string, string>,
  en: {
    moto: 'Motorcycle',
    carro: 'Car',
    scooter: 'Scooter',
    bicicleta: 'Bicycle',
    bici: 'Bicycle',
    pie: 'On foot',
  } as Record<string, string>,
};
