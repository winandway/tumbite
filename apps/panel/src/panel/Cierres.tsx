import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Festivos y cierres',
    ayuda:
      'Los días que marques aquí tu restaurante aparece cerrado aunque estén dentro de tu horario (Navidad, vacaciones, un cierre por obras). No hace falta tocar el horario.',
    fecha: 'Fecha (AAAA-MM-DD)',
    motivo: 'Motivo (lo ve solo tu equipo)',
    agregar: 'Agregar cierre',
    quitar: 'Quitar',
    sin: 'Sin cierres programados.',
    guardado: 'Cierre guardado.',
  },
  en: {
    titulo: 'Holidays and closures',
    ayuda:
      'On the days you mark here your restaurant shows as closed even if they fall within your hours (Christmas, vacation, a closure for repairs). No need to touch the schedule.',
    fecha: 'Date (YYYY-MM-DD)',
    motivo: 'Reason (only your team sees it)',
    agregar: 'Add closure',
    quitar: 'Remove',
    sin: 'No closures scheduled.',
    guardado: 'Closure saved.',
  },
};

/** Festivos y cierres excepcionales (auditoría final, punto 20). */
export function Cierres({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<{ id: string; fecha: string; motivo: string }[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'cierre-nuevo',
    inicial: { fecha: '', motivo: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ cierres: { id: string; fecha: string; motivo: string }[] }>(
      'GET',
      '/datos/mi-restaurante/cierres',
    )
      .then((r) => setLista(r.cierres))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);
  useEffect(cargar, [cargar]);
  return (
    <form
      className="formulario tarjeta-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        setError('');
        setAviso('');
        pedir('POST', '/datos/mi-restaurante/cierres', {
          fecha: b.valores.fecha,
          motivo: b.valores.motivo,
        })
          .then(async () => {
            await b.limpiar();
            setAviso(t.guardado);
            cargar();
          })
          .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
      }}
      noValidate
    >
      <h2>{t.titulo}</h2>
      <p className="suave">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {lista && !lista.length ? <p className="suave">{t.sin}</p> : null}
      <ul className="lista">
        {lista?.map((c) => (
          <li key={c.id}>
            <div className="lista-texto">
              <strong>{c.fecha}</strong>
              <span>{c.motivo}</span>
            </div>
            <button
              type="button"
              className="enlace"
              onClick={() =>
                pedir('DELETE', `/datos/mi-restaurante/cierres/${c.id}`)
                  .then(cargar)
                  .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)))
              }
            >
              {t.quitar}
            </button>
          </li>
        ))}
      </ul>
      <label className="campo">
        <span>{t.fecha}</span>
        <input
          type="date"
          value={b.valores.fecha}
          onChange={(ev) => b.cambiar('fecha', ev.target.value)}
          aria-label={t.fecha}
          required
        />
      </label>
      <label className="campo">
        <span>{t.motivo}</span>
        <input
          value={b.valores.motivo}
          onChange={(ev) => b.cambiar('motivo', ev.target.value)}
          aria-label={t.motivo}
          maxLength={80}
        />
      </label>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p className="ok" role="status">
          {aviso}
        </p>
      ) : null}
      <button type="submit" className="boton secundario">
        {t.agregar}
      </button>
    </form>
  );
}
