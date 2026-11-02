import { type Api, patronVibracionOferta } from '@tumbite/compartido';

/**
 * C-AUDITIVA-REPARTIDOR: lo que marcó el repartidor en Seguridad, a mano para la oferta (que vibra
 * más fuerte si no oye el sonido). Se carga al abrir la app y se actualiza al cambiar el interruptor.
 */
let auditiva = false;

export function fijarAuditiva(v: boolean) {
  auditiva = v;
}

export function vibracionOferta(): number[] {
  return patronVibracionOferta(auditiva);
}

export async function cargarAccesibilidad(api: Api): Promise<boolean> {
  const r = await api.pedir<{ dificultadAuditiva: boolean }>(
    'GET',
    '/datos/repartidor/accesibilidad',
  );
  fijarAuditiva(r.dificultadAuditiva);
  return r.dificultadAuditiva;
}
