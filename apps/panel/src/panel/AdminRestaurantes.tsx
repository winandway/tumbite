import { useEffect, useState } from 'react';
import {
  ErrorApi,
  PLANES,
  type Idioma,
  type Plan,
  type Restaurante,
  enIdioma,
} from '@tumbite/compartido';
import { pedir } from './api';
import { Enlace } from '../Enlace';

function nombrePlan(n: Record<Plan, string>, p: Plan): string {
  return p === 'elite' ? n.elite : p === 'crece' ? n.crece : n.inicial;
}

type Fila = Restaurante & { duenoCorreo: string; duenoNombre: string };

const T = {
  es: {
    titulo: 'Restaurantes',
    vacio: 'Todavía no hay restaurantes registrados.',
    aprobar: 'Aprobar',
    pausar: 'Pausar',
    rechazar: 'No aprobar',
    reactivar: 'Reactivar',
    plan: 'Plan',
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    planes: { inicial: 'Inicial', crece: 'Crece', elite: 'Élite' },
    estados: {
      pendiente: 'En revisión',
      aprobado: 'Aprobado',
      pausado: 'Pausado',
      rechazado: 'No aprobado',
    },
  },
  en: {
    titulo: 'Restaurants',
    vacio: 'No restaurants have signed up yet.',
    aprobar: 'Approve',
    pausar: 'Pause',
    rechazar: 'Decline',
    reactivar: 'Reactivate',
    plan: 'Plan',
    abierto: 'Open',
    cerrado: 'Closed',
    planes: { inicial: 'Starter', crece: 'Growth', elite: 'Pro' },
    estados: {
      pendiente: 'Under review',
      aprobado: 'Approved',
      pausado: 'Paused',
      rechazado: 'Declined',
    },
  },
};

export function AdminRestaurantes({ idioma, base }: { idioma: Idioma; base?: string }) {
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const zona = new URLSearchParams(window.location.search).get('zona');
    pedir<{ restaurantes: Fila[] }>(
      'GET',
      `/datos/admin/restaurantes${zona ? `?zona=${encodeURIComponent(zona)}` : ''}`,
    )
      .then((r) => setLista(r.restaurantes))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);

  async function cambiar(r: Fila, cambio: { estado?: Restaurante['estado']; plan?: Plan }) {
    setError('');
    try {
      const x = await pedir<{ restaurante: Restaurante }>(
        'PATCH',
        `/datos/admin/restaurantes/${r.id}`,
        cambio,
      );
      setLista((l) => (l ?? []).map((f) => (f.id === r.id ? { ...f, ...x.restaurante } : f)));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }

  if (!lista) return error ? <p className="error-general">{error}</p> : null;
  return (
    <section>
      <h1>{t.titulo}</h1>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {lista.length === 0 && <p>{t.vacio}</p>}
      <ul className="lista">
        {lista.map((r) => (
          <li key={r.id}>
            <div className="lista-texto">
              <strong>
                {base ? <Enlace a={`${base}/restaurantes/${r.id}`}>{r.nombre}</Enlace> : r.nombre}
              </strong>
              <span>
                {r.duenoNombre} · {r.duenoCorreo}
              </span>
              <span>{r.direccion}</span>
              <span className={`insignia insignia-${r.estado}`}>
                {t.estados[r.estado]}
                {r.estado === 'aprobado' ? ` · ${r.abierto ? t.abierto : t.cerrado}` : ''}
              </span>
            </div>
            <label className="campo-compacto">
              {t.plan}
              <select
                value={r.plan}
                onChange={(e) => void cambiar(r, { plan: e.target.value as Plan })}
              >
                {PLANES.map((p) => (
                  <option key={p} value={p}>
                    {nombrePlan(t.planes, p)}
                  </option>
                ))}
              </select>
            </label>
            <div className="fila-botones">
              {r.estado !== 'aprobado' && (
                <button
                  type="button"
                  className="boton"
                  onClick={() => void cambiar(r, { estado: 'aprobado' })}
                >
                  {r.estado === 'pendiente' ? t.aprobar : t.reactivar}
                </button>
              )}
              {r.estado === 'aprobado' && (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => void cambiar(r, { estado: 'pausado' })}
                >
                  {t.pausar}
                </button>
              )}
              {r.estado === 'pendiente' && (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => void cambiar(r, { estado: 'rechazado' })}
                >
                  {t.rechazar}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
