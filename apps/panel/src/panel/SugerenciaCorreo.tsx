import { sugerirCorreo, textoSugerenciaCorreo, type Idioma } from '@tumbite/compartido';

/**
 * C-CORREO-SUGERENCIA: «¿Quisiste decir …@gmail.com?» debajo de la casilla del correo. Se toca y
 * se corrige; si no, no pasa nada (solo sugiere).
 */
export function SugerenciaCorreo({
  correo,
  idioma,
  aceptar,
}: {
  correo: string;
  idioma: Idioma;
  aceptar: (correo: string) => void;
}) {
  const sugerido = sugerirCorreo(correo);
  if (!sugerido) return null;
  return (
    <p className="pista" role="status" data-testid="sugerencia-correo">
      <button type="button" className="enlace" onClick={() => aceptar(sugerido)}>
        {textoSugerenciaCorreo(idioma === 'en' ? 'en' : 'es', sugerido)}
      </button>
    </p>
  );
}
