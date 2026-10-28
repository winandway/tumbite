import { useId, useState } from 'react';
import { type DireccionElegida, useSugerenciasDireccion } from '@tumbite/compartido';
import { pedir } from '../panel/api';

/**
 * C-DIRECCION-SUGERENCIAS en la web: la casilla de dirección de TODA la web y los paneles. Mientras
 * se escribe salen direcciones reales; al elegir una llega con sus coordenadas exactas. Se navega
 * con las flechas y se elige con Enter; Escape cierra la lista.
 */
export function CampoDireccion({
  valor,
  cambiar,
  alElegir,
  pais,
  placeholder,
  etiqueta,
  id,
  className,
}: {
  valor: string;
  cambiar: (texto: string) => void;
  alElegir: (d: DireccionElegida) => void;
  pais?: string | null;
  placeholder: string;
  etiqueta?: string;
  id?: string;
  className?: string;
}) {
  const s = useSugerenciasDireccion({ pedir: pedir as never, pais });
  const [activa, setActiva] = useState(-1);
  const propio = useId();
  const idCampo = id ?? `direccion-${propio}`;
  const idLista = `${idCampo}-lista`;

  async function elegir(i: number) {
    const sug = s.sugerencias.at(i);
    if (!sug) return;
    cambiar(sug.texto);
    setActiva(-1);
    const d = await s.elegir(sug.id);
    if (d) {
      cambiar(d.direccion || sug.texto);
      alElegir(d);
    }
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!s.sugerencias.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiva((x) => Math.min(s.sugerencias.length - 1, x + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiva((x) => Math.max(0, x - 1));
    } else if (e.key === 'Enter' && activa >= 0) {
      e.preventDefault();
      void elegir(activa);
    } else if (e.key === 'Escape') {
      s.cerrar();
    }
  }

  const abierta = s.sugerencias.length > 0;
  return (
    <span className="campo-direccion">
      {etiqueta ? <label htmlFor={idCampo}>{etiqueta}</label> : null}
      <input
        id={idCampo}
        className={className}
        value={valor}
        onChange={(e) => {
          cambiar(e.target.value);
          setActiva(-1);
          s.buscar(e.target.value);
        }}
        onKeyDown={teclas}
        onBlur={() => setTimeout(s.cerrar, 200)}
        placeholder={placeholder}
        aria-label={etiqueta ? undefined : placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={abierta}
        aria-controls={idLista}
        aria-autocomplete="list"
      />
      {abierta && (
        <ul className="sugerencias-direccion" role="listbox" id={idLista}>
          {s.sugerencias.map((x, i) => (
            <li
              key={x.id}
              role="option"
              aria-selected={i === activa}
              className={i === activa ? 'activa' : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                void elegir(i);
              }}
            >
              {x.texto}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
