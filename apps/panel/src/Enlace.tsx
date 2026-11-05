import type { ReactNode } from 'react';
import { ir } from './ruta';
import { conIdioma, enEspanol } from './rutaIdioma';

/** Enlace interno: cambia de página sin recargar. */
export function Enlace({
  a,
  children,
  className,
  onClick,
}: {
  a: string;
  children: ReactNode;
  className?: string;
  /** Además de navegar (por ejemplo, cerrar el menú del celular). */
  onClick?: () => void;
}) {
  // Dentro de la versión en español (/es/...), los enlaces internos se quedan en español.
  const destino =
    typeof window !== 'undefined' && enEspanol(window.location.pathname) ? conIdioma(a, 'es') : a;
  return (
    <a
      href={destino}
      className={className}
      onClick={(e) => {
        onClick?.();
        if (e.metaKey || e.ctrlKey || e.shiftKey || a.startsWith('#')) return;
        e.preventDefault();
        ir(destino);
      }}
    >
      {children}
    </a>
  );
}
