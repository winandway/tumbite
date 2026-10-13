import type { ReactNode } from 'react';
import { ir } from './ruta';
import { conIdioma, enEspanol } from './rutaIdioma';

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
  // Dentro de la versión en español (/es/...), los enlaces internos se quedan en español.
  const destino =
    typeof window !== 'undefined' && enEspanol(window.location.pathname) ? conIdioma(a, 'es') : a;
  return (
    <a
      href={destino}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || a.startsWith('#')) return;
        e.preventDefault();
        ir(destino);
      }}
    >
      {children}
    </a>
  );
}
