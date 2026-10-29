import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';

const T = {
  es: {
    hola: 'Hola',
    ahora: 'Pedidos esperando ahora',
    verPedidos: 'Ver pedidos →',
    semana: 'Últimos 7 días',
    mes: 'Últimos 30 días',
    pedidos: 'Pedidos',
    ventas: 'Ventas',
    neto: 'Lo que recibes',
    ticket: 'Ticket promedio',
    top: 'Lo que más se vende (30 días)',
    sinTop: 'Cuando entreguemos tus primeros pedidos, aquí verás tus platos estrella.',
    cocina: 'Tiempo real de cocina',
    prometido: 'prometido',
    min: 'min',
    calificacion: 'Calificación de tus clientes',
    sinCalificacion: 'Todavía no hay calificaciones.',
    opiniones: 'opiniones',
    opinion: 'opinión',
  },
  en: {
    hola: 'Hi',
    ahora: 'Orders waiting now',
    verPedidos: 'See orders →',
    semana: 'Last 7 days',
    mes: 'Last 30 days',
    pedidos: 'Orders',
    ventas: 'Sales',
    neto: 'What you receive',
    ticket: 'Average order',
    top: 'Best sellers (30 days)',
    sinTop: 'Once we deliver your first orders, your star dishes will show up here.',
    cocina: 'Real kitchen time',
    prometido: 'promised',
    min: 'min',
    calificacion: 'Your customers’ rating',
    sinCalificacion: 'No ratings yet.',
    opiniones: 'reviews',
    opinion: 'review',
  },
};

type Periodo = { pedidos: number; ventas: number; neto: number; ticketPromedio: number };
type Tablero = {
  /** C-MONEDA-RECORRIDO: la moneda del restaurante (todas las cifras van en ella). */
  moneda?: string;
  semana: Periodo;
  mes: Periodo;
  topPlatos: { nombreEs: string; nombreEn: string; cantidad: number }[];
  minutosCocina: number | null;
  minutosPrometidos: number | null;
  calificacion: number | null;
  calificaciones: number;
  pedidosAhora: number;
  /** C-RENDIMIENTO-REST (últimos 30 días, hora del restaurante). */
  porHora?: { pedidos: number; ventas: number }[];
  porDia?: { pedidos: number; ventas: number }[];
  clientes?: { nuevos: number; recurrentes: number; nuevosQueVolvieron: number };
  canceladosMes?: number;
};

const TR = {
  es: {
    porHora: 'Pedidos por hora (últimos 30 días)',
    porDia: 'Pedidos por día (últimos 30 días)',
    dias: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    clientes: 'Clientes (últimos 30 días)',
    nuevos: 'Nuevos',
    repiten: 'Repiten',
    cancelados: 'Cancelados',
  },
  en: {
    porHora: 'Orders by hour (last 30 days)',
    porDia: 'Orders by day (last 30 days)',
    dias: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    clientes: 'Customers (last 30 days)',
    nuevos: 'New',
    repiten: 'Returning',
    cancelados: 'Canceled',
  },
};

/** Barras simples con CSS (sin librerías). */
function Barras({ valores, etiquetas }: { valores: number[]; etiquetas: string[] }) {
  const max = Math.max(1, ...valores);
  return (
    <div
      className="barras"
      role="img"
      aria-label={valores.map((v, i) => `${etiquetas.at(i) ?? i}: ${v}`).join(', ')}
    >
      {valores.map((v, i) => (
        <div key={etiquetas.at(i) ?? i} className="barra">
          <span
            style={{ height: `${Math.max(2, Math.round((v / max) * 100))}%` }}
            className={v ? 'con' : ''}
          />
          <small>{etiquetas.at(i)}</small>
        </div>
      ))}
    </div>
  );
}

/** Inicio del panel del restaurante: cómo le va, de un vistazo. */
export function TableroRestaurante({ nombre, idioma }: { nombre: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const tr = enIdioma(TR, idioma);
  const [x, setX] = useState<Tablero | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ tablero: Tablero }>('GET', '/datos/restaurante/tablero')
      .then((r) => setX(r.tablero))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);
  const d = (c: number) => formatearMonto(c, x?.moneda ?? 'USD', idioma);
  const periodo = (titulo: string, p: Periodo) => (
    <div className="tarjeta-form">
      <h2>{titulo}</h2>
      <ul className="super-tarjetas">
        <li className="super-tarjeta">
          <span>{t.pedidos}</span>
          <strong>{p.pedidos}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.ventas}</span>
          <strong>{d(p.ventas)}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.neto}</span>
          <strong>{d(p.neto)}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.ticket}</span>
          <strong>{d(p.ticketPromedio)}</strong>
        </li>
      </ul>
    </div>
  );
  return (
    <section className="super tablero">
      <h1>
        {t.hola}, {nombre}
      </h1>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {x && (
        <>
          <div className={`tablero-ahora ${x.pedidosAhora > 0 ? 'hay' : ''}`}>
            <span>{t.ahora}</span>
            <strong>{x.pedidosAhora}</strong>
            <Enlace a="/panel/orders">{t.verPedidos}</Enlace>
          </div>
          <div className="super-dos">
            {periodo(t.semana, x.semana)}
            {periodo(t.mes, x.mes)}
          </div>
          <div className="super-dos">
            <div className="tarjeta-form">
              <h2>{t.top}</h2>
              {x.topPlatos.length === 0 ? (
                <p>{t.sinTop}</p>
              ) : (
                <ol className="tablero-top">
                  {x.topPlatos.map((p) => (
                    <li key={p.nombreEs}>
                      <span>{idioma === 'en' && p.nombreEn ? p.nombreEn : p.nombreEs}</span>
                      <strong>× {p.cantidad}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="tarjeta-form">
              <h2>{t.cocina}</h2>
              <p className="tablero-grande">
                {x.minutosCocina == null ? '—' : `${x.minutosCocina} ${t.min}`}
                {x.minutosPrometidos != null && (
                  <small>
                    {' '}
                    ({t.prometido}: {x.minutosPrometidos} {t.min})
                  </small>
                )}
              </p>
              <h2>{t.calificacion}</h2>
              <p className="tablero-grande">
                {x.calificacion == null ? (
                  <small>{t.sinCalificacion}</small>
                ) : (
                  <>
                    {x.calificacion} / 5{' '}
                    <small>
                      ({x.calificaciones} {x.calificaciones === 1 ? t.opinion : t.opiniones})
                    </small>
                  </>
                )}
              </p>
            </div>
          </div>
          {x.porHora && x.porHora.some((h) => h.pedidos) ? (
            <div className="super-dos">
              <div className="tarjeta-form">
                <h2>{tr.porHora}</h2>
                {(() => {
                  const con = x.porHora.map((h, i) => (h.pedidos ? i : -1)).filter((i) => i >= 0);
                  const desde = Math.min(...con);
                  const horas = x.porHora.slice(desde, Math.max(...con) + 1);
                  return (
                    <Barras
                      valores={horas.map((h) => h.pedidos)}
                      etiquetas={horas.map((_, i) => String(desde + i))}
                    />
                  );
                })()}
              </div>
              <div className="tarjeta-form">
                <h2>{tr.porDia}</h2>
                <Barras valores={(x.porDia ?? []).map((d) => d.pedidos)} etiquetas={tr.dias} />
              </div>
            </div>
          ) : null}
          {x.clientes ? (
            <div className="tarjeta-form">
              <h2>{tr.clientes}</h2>
              <ul className="super-tarjetas">
                <li className="super-tarjeta">
                  <span>{tr.nuevos}</span>
                  <strong>{x.clientes.nuevos}</strong>
                </li>
                <li className="super-tarjeta">
                  <span>{tr.repiten}</span>
                  <strong>{x.clientes.recurrentes + x.clientes.nuevosQueVolvieron}</strong>
                </li>
                <li className="super-tarjeta">
                  <span>{tr.cancelados}</span>
                  <strong>{x.canceladosMes ?? 0}</strong>
                </li>
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
