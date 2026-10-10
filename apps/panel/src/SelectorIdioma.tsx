import { IDIOMAS, type Idioma } from '@tumbite/compartido';

export function SelectorIdioma({
  idioma,
  cambiar,
}: {
  idioma: Idioma;
  cambiar: (i: Idioma) => void;
}) {
  return (
    <nav aria-label="Idioma / Language" className="idiomas">
      {IDIOMAS.map((i) => (
        <button
          key={i.codigo}
          type="button"
          onClick={() => cambiar(i.codigo)}
          aria-pressed={idioma === i.codigo}
          aria-label={i.nombre}
          title={i.nombre}
        >
          {i.bandera}
        </button>
      ))}
    </nav>
  );
}
