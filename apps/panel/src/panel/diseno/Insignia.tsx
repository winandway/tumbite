import type { ReactNode } from 'react';
import { type Tono, tonoDeEstado } from './estados';

/**
 * C-PANEL-DISENO: la insignia de estado de cada fila y de cada ficha. El color lo decide el estado
 * (verde hecho, ámbar pendiente, rojo problema, gris apagado), nunca la pantalla.
 */
export function Insignia({
  estado,
  tono,
  children,
  testId,
  clase,
}: {
  /** El estado tal como lo dice el servidor («aprobado», «por_vencer»…). */
  estado?: string | null;
  /** Para lo que no es un estado del servidor (por ejemplo «sin zona»): el tono directo. */
  tono?: Tono;
  children: ReactNode;
  testId?: string;
  /** Una clase más para la pantalla (nunca cambia el color del estado). */
  clase?: string;
}) {
  const t = tono ?? tonoDeEstado(estado);
  return (
    <span
      className={`insignia insignia-${t}${clase ? ` ${clase}` : ''}`}
      data-tono={t}
      data-testid={testId}
    >
      <span className="insignia-punto" aria-hidden="true" />
      {children}
    </span>
  );
}
