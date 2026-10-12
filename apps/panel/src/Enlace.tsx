import type { ReactNode } from 'react';
import { ir } from './ruta';
import { conIdioma, enIngles } from './rutaIdioma';

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
  // Dentro de la versión en inglés (/en/...), los enlaces internos se quedan en inglés.
  const destino =
    typeof window !== 'undefined' && enIngles(window.location.pathname) ? conIdioma(a, 'en') : a;
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
