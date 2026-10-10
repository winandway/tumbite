import { useEffect, useId, useRef, useState } from 'react';
import { IDIOMAS, type Idioma } from '@tumbite/compartido';

/**
 * Selector de idioma estilo Amazon (pedido de Richard, regla global):
 * botón con bandera + código + flechita, y una ventanita con «Cambiar idioma»
 * y las opciones con círculo de selección, separadas por una línea.
 * El español lleva la bandera de España; el inglés, la de EE.UU.
 */
const TITULO: Record<Idioma, string> = { es: 'Cambiar idioma', en: 'Change language' };

export function SelectorIdioma({
  idioma,
  cambiar,
}: {
  idioma: Idioma;
  cambiar: (i: Idioma) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  const actual = IDIOMAS.find((i) => i.codigo === idioma) ?? IDIOMAS[0];

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div className="selector-idioma" ref={caja}>
      <button
        type="button"
        className="selector-idioma-boton"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={TITULO[idioma === 'en' ? 'en' : 'es']}
        onClick={() => setAbierto((a) => !a)}
      >
        <span aria-hidden="true">{actual.bandera}</span> {actual.codigo.toUpperCase()}{' '}
        <span className="flechita" aria-hidden="true">
          ▾
        </span>
      </button>
      {abierto && (
        <div
          id={id}
          className="selector-idioma-caja"
          role="dialog"
          aria-label={TITULO[idioma === 'en' ? 'en' : 'es']}
        >
          <span className="selector-idioma-pico" aria-hidden="true" />
          <p className="selector-idioma-titulo">{TITULO[idioma === 'en' ? 'en' : 'es']}</p>
          <div role="radiogroup" aria-label={TITULO[idioma === 'en' ? 'en' : 'es']}>
            {[...IDIOMAS].reverse().map((i, n) => (
              <label key={i.codigo} className={n > 0 ? 'con-linea' : undefined}>
                <input
                  type="radio"
                  name={`${id}-idioma`}
                  checked={idioma === i.codigo}
                  onChange={() => {
                    cambiar(i.codigo);
                    setAbierto(false);
                  }}
                />
                <span aria-hidden="true">{i.bandera}</span>{' '}
                {i.codigo === 'en' ? 'English' : 'español'} - {i.codigo.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
