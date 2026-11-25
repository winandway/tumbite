import type { ReactNode } from 'react';
import { Insignia } from './Insignia';
import { type Tono, tonoDeEstado } from './estados';

/**
 * C-FICHA-ESTADOS-CON-COLOR (Richard, 25 nov 2026) — todos los países. En la ficha del conductor cada
 * estado lleva su color según QUIÉN tiene que actuar:
 *   verde  → ya está (aprobado, vigente, habilitado): el verde de éxito de la marca;
 *   rojo   → espera al equipo (por revisar) o hay un problema (rechazado, vencido), con su botón;
 *   gris   → le toca al conductor o no aplica todavía (sin enviar, falta subir).
 * Una sola pieza sobre la insignia de siempre; ninguna pantalla decide su color a mano.
 */
export type Quien = 'equipo' | 'conductor' | 'nadie';

export function tonoFicha(estado: string | null | undefined, quien: Quien = 'nadie'): Tono {
  const base = tonoDeEstado(estado);
  if (base === 'hecho' || base === 'problema') return base;
  return quien === 'equipo' ? 'problema' : 'apagado';
}

export function EtiquetaEstado({
  estado,
  quien = 'nadie',
  children,
  testId,
}: {
  /** El estado tal como lo dice el servidor. */
  estado: string | null | undefined;
  /** Quién tiene que hacer algo para que avance. */
  quien?: Quien;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Insignia tono={tonoFicha(estado, quien)} testId={testId}>
      {children}
    </Insignia>
  );
}
