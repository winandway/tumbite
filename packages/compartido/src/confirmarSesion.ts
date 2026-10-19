import type { Usuario } from './esquemas';
import { ErrorApi } from './api';

/**
 * C-SESION-CON-LIMITE (hito 1 del cliente; docs/incidencias/2026-10-16-pantalla-de-carga.md).
 *
 * La comprobación de la sesión guardada tiene un tiempo máximo. Antes no lo tenía: si el servidor
 * no contestaba, la app se quedaba para siempre en la pantalla de carga (sitio de pruebas, 16 oct).
 *   - válida: el servidor la confirmó;
 *   - inválida: el servidor la rechazó (401 o 403): se borra y se pide entrar;
 *   - sin confirmar: no se supo (tiempo vencido, sin conexión o fallo del servidor). La sesión
 *     guardada SE CONSERVA para reintentar, pero no cuenta como abierta.
 */
export type Confirmacion =
  | { estado: 'valida'; usuario: Usuario }
  | { estado: 'invalida' }
  | { estado: 'sin_confirmar'; motivo: 'tiempo' | 'red' | 'servidor' };

export const LIMITE_SESION_MS = 8000;

export function confirmarSesion(
  yo: () => Promise<{ usuario: Usuario }>,
  limiteMs = LIMITE_SESION_MS,
): Promise<Confirmacion> {
  return new Promise<Confirmacion>((resolver) => {
    const reloj = setTimeout(
      () => resolver({ estado: 'sin_confirmar', motivo: 'tiempo' }),
      limiteMs,
    );
    yo().then(
      (r) => {
        clearTimeout(reloj);
        resolver({ estado: 'valida', usuario: r.usuario });
      },
      (e: unknown) => {
        clearTimeout(reloj);
        if (e instanceof ErrorApi && (e.estado === 401 || e.estado === 403))
          return resolver({ estado: 'invalida' });
        if (e instanceof ErrorApi && e.estado >= 500)
          return resolver({ estado: 'sin_confirmar', motivo: 'servidor' });
        if (e instanceof ErrorApi && e.estado > 0)
          return resolver({ estado: 'sin_confirmar', motivo: 'servidor' });
        resolver({ estado: 'sin_confirmar', motivo: 'red' });
      },
    );
  });
}

/**
 * C-SESION-REINTENTA (19 oct 2026): un corte puntual de la red o del servidor no deja a la persona
 * en «No pudimos confirmar tu sesión». Se reintenta sola (con una espera creciente) antes de
 * mostrarlo. Un 401 o 403 no se reintenta: la sesión ya no sirve. Pasó en staging: un corte de
 * conexión dejó la app del cliente detenida en esa pantalla.
 */
export async function confirmarSesionConReintentos(
  yo: () => Promise<{ usuario: Usuario }>,
  esperasMs: readonly number[] = [800, 2500],
  limiteMs = LIMITE_SESION_MS,
  dormir: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Confirmacion> {
  let r = await confirmarSesion(yo, limiteMs);
  for (const espera of esperasMs) {
    if (r.estado !== 'sin_confirmar') return r;
    await dormir(espera);
    r = await confirmarSesion(yo, limiteMs);
  }
  return r;
}
