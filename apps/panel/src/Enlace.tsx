import type { ReactNode } from 'react';
import { ir } from './ruta';

/** Enlace interno: cambia de página sin recargar. */
export function Enlace({
  a,
  children,
  className,
}: {
  a: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={a}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || a.startsWith('#')) return;
        e.preventDefault();
        ir(a);
      }}
    >
      {children}
    </a>
  );
}
