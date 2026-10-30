import { useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-MENU-HORARIO: franja diaria de cada categoría (desayuno de 07:00 a 11:00), como los menús por
 * horario de DoorDash y Uber Eats. Sin franja, la categoría se sirve todo el horario del restaurante.
 */
const T = {
  es: {
    titulo: 'Horarios del menú',
    ayuda:
      'Si una categoría solo se sirve en una parte del día (desayuno, almuerzo), ponle su franja. Fuera de ella, sus platos no aparecen. Déjala vacía para servirla todo el día.',
    desde: 'Desde',
    hasta: 'Hasta',
    guardar: 'Guardar horarios del menú',
    guardado: 'Horarios del menú guardados.',
    incompleto: 'Pon las dos horas, o deja las dos vacías.',
  },
  en: {
    titulo: 'Menu hours',
    ayuda:
      'If a category is only served part of the day (breakfast, lunch), give it its window. Outside it, its items don’t show. Leave it empty to serve it all day.',
    desde: 'From',
    hasta: 'To',
    guardar: 'Save menu hours',
    guardado: 'Menu hours saved.',
    incompleto: 'Enter both times, or leave both empty.',
  },
};

type Ventana = { categoria: string; abre: string; cierra: string };

export function HorariosMenu({
  categorias,
  iniciales,
  idioma,
}: {
  categorias: string[];
  iniciales: Ventana[];
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const [v, setV] = useState<Map<string, { abre: string; cierra: string }>>(
    () => new Map(iniciales.map((x) => [x.categoria, { abre: x.abre, cierra: x.cierra }])),
  );
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const cambiar = (cat: string, campo: 'abre' | 'cierra', valor: string) =>
    setV((m) => {
      const n = new Map(m);
      n.set(cat, { abre: '', cierra: '', ...m.get(cat), [campo]: valor });
      return n;
    });
  async function guardar() {
    setAviso('');
    setError('');
    const ventanas = categorias
      .map((categoria) => ({
        categoria,
        abre: v.get(categoria)?.abre ?? '',
        cierra: v.get(categoria)?.cierra ?? '',
      }))
      .filter((x) => x.abre || x.cierra);
    if (ventanas.some((x) => !x.abre || !x.cierra)) return setError(t.incompleto);
    try {
      await pedir('PUT', '/datos/mi-restaurante/horarios-categoria', { ventanas });
      setAviso(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  if (!categorias.length) return null;
  return (
    <section className="flex-tarjeta" data-testid="horarios-menu">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {categorias.map((cat) => (
        <div key={cat} className="fila-campos">
          <strong style={{ minWidth: 120 }}>{cat}</strong>
          <label className="campo">
            <span>
              {t.desde} · {cat}
            </span>
            <input
              type="time"
              value={v.get(cat)?.abre ?? ''}
              onChange={(e) => cambiar(cat, 'abre', e.target.value)}
            />
          </label>
          <label className="campo">
            <span>
              {t.hasta} · {cat}
            </span>
            <input
              type="time"
              value={v.get(cat)?.cierra ?? ''}
              onChange={(e) => cambiar(cat, 'cierra', e.target.value)}
            />
          </label>
        </div>
      ))}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? <p className="texto-exito">{aviso}</p> : null}
      <button type="button" className="boton" onClick={() => void guardar()}>
        {t.guardar}
      </button>
    </section>
  );
}
