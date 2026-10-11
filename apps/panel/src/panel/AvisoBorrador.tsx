import { type Idioma, enIdioma } from '@tumbite/compartido';

const T = {
  es: { recuperado: 'Recuperamos lo que estabas escribiendo.', empezar: 'Empezar de nuevo' },
  en: { recuperado: 'We restored what you were typing.', empezar: 'Start over' },
};

/** La línea discreta que avisa que se recuperó un borrador. Nunca una ventana. */
export function AvisoBorrador({
  visible,
  idioma,
  empezar,
}: {
  visible: boolean;
  idioma: Idioma;
  empezar: () => void;
}) {
  if (!visible) return null;
  const t = enIdioma(T, idioma);
  return (
    <p className="aviso-borrador">
      {t.recuperado}{' '}
      <button type="button" className="enlace" onClick={empezar}>
        {t.empezar}
      </button>
    </p>
  );
}
