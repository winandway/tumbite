import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
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
  },
};

type Periodo = { pedidos: number; ventas: number; neto: number; ticketPromedio: number };
type Tablero = {
  semana: Periodo;
  mes: Periodo;
  topPlatos: { nombreEs: string; nombreEn: string; cantidad: number }[];
  minutosCocina: number | null;
  minutosPrometidos: number | null;
  calificacion: number | null;
  calificaciones: number;
  pedidosAhora: number;
};

/** Inicio del panel del restaurante: cómo le va, de un vistazo. */
export function TableroRestaurante({ nombre, idioma }: { nombre: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [x, setX] = useState<Tablero | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ tablero: Tablero }>('GET', '/datos/restaurante/tablero')
      .then((r) => setX(r.tablero))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);
  const d = (c: number) => formatearDolares(c, idioma);
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
            <Enlace a="/panel/pedidos">{t.verPedidos}</Enlace>
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
                      ({x.calificaciones} {t.opiniones})
                    </small>
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
