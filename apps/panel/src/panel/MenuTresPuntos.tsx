import { useEffect, useRef, useState } from 'react';

/** Menú de 3 puntos. Las acciones de borrar viven SOLO aquí, nunca a la vista. */
export function MenuTresPuntos({
  etiqueta,
  opciones,
}: {
  etiqueta: string;
  opciones: { texto: string; peligro?: boolean; alTocar: () => void }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);
  return (
    <div className="tres-puntos" ref={caja}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        ⋮
      </button>
      {abierto && (
        <div role="menu" className="tres-puntos-menu">
          {opciones.map((o) => (
            <button
              key={o.texto}
              type="button"
              role="menuitem"
              className={o.peligro ? 'peligro' : undefined}
              onClick={() => {
                setAbierto(false);
                o.alTocar();
              }}
            >
              {o.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
