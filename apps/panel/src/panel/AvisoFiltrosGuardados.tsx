import { type Idioma, enIdioma } from '@tumbite/compartido';

const T = {
  es: { mostrando: 'Mostrando tus filtros guardados', restablecer: 'Restablecer' },
  en: { mostrando: 'Showing your saved filters', restablecer: 'Reset' },
};

/** C-FILTROS-GUARDADOS: la línea discreta de los filtros guardados. Nunca una ventana. */
export function AvisoFiltrosGuardados({
  visible,
  idioma,
  restablecer,
}: {
  visible: boolean;
  idioma: Idioma;
  restablecer: () => void;
}) {
  if (!visible) return null;
  const t = enIdioma(T, idioma);
  return (
    <p className="aviso-borrador filtros-guardados">
      {t.mostrando} ·{' '}
      <button type="button" className="enlace" onClick={restablecer}>
        {t.restablecer}
      </button>
    </p>
  );
}
