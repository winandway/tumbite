import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, nivelDe } from '@tumbite/compartido';
import { pedir } from './api';

type Fila = {
  id: string;
  nombre: string;
  correo: string;
  tipo: 'independiente' | 'empleado' | null;
  conectado: number | null;
  puntos: number | null;
  entregas: number;
  estrellas: number | null;
};

const T = {
  es: {
    titulo: 'Repartidores',
    vacio: 'Todavía no hay repartidores.',
    entregas: 'entregas',
    puntos: 'puntos',
    conectado: 'Conectado',
    independiente: 'Independiente',
    empleado: 'Empleado',
    sinNota: 'Sin calificaciones',
  },
  en: {
    titulo: 'Drivers',
    vacio: 'No drivers yet.',
    entregas: 'deliveries',
    puntos: 'points',
    conectado: 'Online',
    independiente: 'Independent',
    empleado: 'Employee',
    sinNota: 'No ratings yet',
  },
};

export function AdminRepartidores({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pedir<{ repartidores: Fila[] }>('GET', '/datos/admin/repartidores')
      .then((r) => setLista(r.repartidores))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);

  async function tipo(f: Fila, nuevo: 'independiente' | 'empleado') {
    try {
      await pedir('PATCH', `/datos/admin/repartidores/${f.id}`, { tipo: nuevo });
      setLista((l) => (l ?? []).map((x) => (x.id === f.id ? { ...x, tipo: nuevo } : x)));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }

  if (!lista) return error ? <p className="error-general">{error}</p> : null;
  return (
    <section>
      <h1>{t.titulo}</h1>
      {error && <p className="error-general">{error}</p>}
      {lista.length === 0 && <p>{t.vacio}</p>}
      <ul className="lista">
        {lista.map((f) => {
          const n = nivelDe(Number(f.puntos ?? 0));
          return (
            <li key={f.id}>
              <div className="lista-texto">
                <strong>
                  {f.nombre}
                  {f.conectado ? ` · 🟢 ${t.conectado}` : ''}
                </strong>
                <span>{f.correo}</span>
                <span>
                  {enIdioma({ es: n.es, en: n.en }, idioma)} · {n.puntos} {t.puntos} · {f.entregas}{' '}
                  {t.entregas} · {f.estrellas ? `★ ${f.estrellas}` : t.sinNota}
                </span>
              </div>
              <select
                value={f.tipo ?? 'independiente'}
                onChange={(e) => void tipo(f, e.target.value as 'independiente' | 'empleado')}
                aria-label={f.nombre}
              >
                <option value="independiente">{t.independiente}</option>
                <option value="empleado">{t.empleado}</option>
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
