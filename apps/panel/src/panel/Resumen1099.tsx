import { useEffect, useState } from 'react';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * G5 (2 nov 2026): quién pasa el umbral del 1099-NEC en el año. Solo informa; la emisión de los
 * formularios está apagada hasta que el contador lo decida.
 */
const T = {
  es: {
    titulo: 'Formulario 1099-NEC (EE. UU.)',
    ayuda:
      'Repartidores que este año pasan el umbral de 2.000 dólares. Solo informa: la emisión de los formularios está apagada hasta que el contador lo decida.',
    nadie: 'Nadie pasa el umbral este año.',
    quien: 'Repartidor',
    correo: 'Correo',
    entregas: 'Entregas',
    total: 'Ganado en el año',
  },
  en: {
    titulo: 'Form 1099-NEC (U.S.)',
    ayuda:
      'Drivers who pass the $2,000 threshold this year. For information only: issuing the forms is off until the accountant decides.',
    nadie: 'No one passes the threshold this year.',
    quien: 'Driver',
    correo: 'Email',
    entregas: 'Deliveries',
    total: 'Earned this year',
  },
};

type Fila = { id: string; nombre: string; correo: string; entregas: number; total: number };

export function Resumen1099({ idioma }: { idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ repartidores: Fila[] }>('GET', '/datos/admin/fiscal/1099')
      .then((r) => setFilas(r.repartidores))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return (
    <section aria-label={t.titulo}>
      <h2>{t.titulo}</h2>
      <p className="suave">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {filas && !filas.length ? <p className="suave">{t.nadie}</p> : null}
      {filas?.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.quien}</th>
                <th>{t.correo}</th>
                <th>{t.entregas}</th>
                <th>{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>{f.nombre}</td>
                  <td>{f.correo}</td>
                  <td>{f.entregas}</td>
                  <td>{formatearMonto(f.total, 'USD', idioma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
