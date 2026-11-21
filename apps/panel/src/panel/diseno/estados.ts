/**
 * C-PANEL-DISENO (21 nov 2026, Gerencia) — todos los países. El código de colores de los estados,
 * siempre igual en TODO el panel:
 *   verde «hecho»     → salió bien, está aprobado, vigente, activo, entregado, pagado;
 *   ámbar «pendiente» → espera a alguien: por revisar, enviado, en plazo, por vencer, programado;
 *   rojo «problema»   → hay que actuar: rechazado, vencido, rebotó, falló, cancelado, urgente;
 *   gris «apagado»    → no aplica o está quieto: apagado, pausado, sin datos, sin plazo, desconectado.
 * Una sola tabla: ninguna pantalla decide su propio color para un estado.
 */
export type Tono = 'hecho' | 'pendiente' | 'problema' | 'apagado';

export const TONOS: readonly Tono[] = ['hecho', 'pendiente', 'problema', 'apagado'];

const TABLA: Record<Tono, readonly string[]> = {
  hecho: [
    'aprobado',
    'aprobada',
    'activo',
    'activa',
    'vigente',
    'entregado',
    'entregada',
    'pagado',
    'pagada',
    'completado',
    'completada',
    'aceptado',
    'aceptada',
    'confirmado',
    'confirmada',
    'verde',
    'en_linea',
    'conectado',
    'listo',
    'lista',
    'resuelto',
    'cerrado_ok',
    'terminada',
    'terminado',
    'acreditada',
    'acreditado',
    'habilitado',
    'habilitada',
  ],
  pendiente: [
    'pendiente',
    'por_aprobar',
    'por_revisar',
    'en_revision',
    'enviado',
    'enviada',
    'en_plazo',
    'por_vencer',
    'programado',
    'programada',
    'abierto',
    'abierta',
    'esperando',
    'sin_confirmar',
    'frenado',
    'amarillo',
    'repetir',
    'en_curso',
    'ejecutando',
    'creado',
    'creada',
    'en_proceso',
    'parcial',
    'ofrecida',
    'asignada',
    'asignado',
    'en_carga',
    'previsualizada',
    'en_espera',
  ],
  problema: [
    'rechazado',
    'rechazada',
    'vencido',
    'vencida',
    'rebote',
    'reboto',
    'fallido',
    'fallida',
    'error',
    'cancelado',
    'cancelada',
    'rojo',
    'urgente',
    'suspendido',
    'suspendida',
    'bloqueado',
    'bloqueada',
    'con_incidencia',
    'con_incidencias',
    'devuelto',
    'devuelta',
  ],
  apagado: [
    'apagado',
    'apagada',
    'pausado',
    'pausada',
    'inactivo',
    'inactiva',
    'sin_datos',
    'sin_plazo',
    'sin_enviar',
    'desconectado',
    'sin_ia',
    'cerrado',
    'cerrada',
    'reemplazada',
    'borrador',
    'desactivado',
    'desactivada',
    'agotado',
    'oculto',
  ],
};

const POR_ESTADO = new Map<string, Tono>(
  (Object.entries(TABLA) as [Tono, readonly string[]][]).flatMap(([tono, estados]) =>
    estados.map((e) => [e, tono] as const),
  ),
);

/** El tono de un estado (en minúsculas, con guion bajo). Lo desconocido va en gris, nunca en rojo. */
export function tonoDeEstado(estado: string | null | undefined): Tono {
  const clave = String(estado ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');
  return POR_ESTADO.get(clave) ?? 'apagado';
}

/** Las clases de la insignia de un estado (la forma y el color salen de `diseno.css`). */
export const claseInsignia = (estado: string | null | undefined) =>
  `insignia insignia-${tonoDeEstado(estado)}`;

/**
 * Horas enteras desde una fecha del servidor («2026-11-20 17:52:05», en UTC). Sin fecha válida, 0.
 * Lo que espera a una persona del equipo más de `HORAS_URGENTE` pasa a rojo (igual que el menú).
 */
export const HORAS_URGENTE = 24;
export function horasDesde(fecha: string | null | undefined, ahora = Date.now()): number {
  if (!fecha) return 0;
  const iso = /T/.test(fecha) ? fecha : `${fecha.replace(' ', 'T')}Z`;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((ahora - t) / 3_600_000));
}
