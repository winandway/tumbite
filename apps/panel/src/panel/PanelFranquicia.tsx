import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Tu franquicia en {ciudad}',
    estados: { prospecto: 'Prospecto', vendida: 'Vendida', activa: 'Activa', pausada: 'Pausada' },
    hoy: 'Pedidos hoy',
    pedidos30: 'Pedidos entregados (30 días)',
    ventas30: 'Ventas (30 días)',
    motos: 'Motos de la flota',
    restaurantes: 'Restaurantes',
    abiertos: 'abiertos ahora',
    repartidores: 'Repartidores',
    conectados: 'conectados ahora',
    quejas: 'Quejas y pedidos de ayuda',
    sinQuejas: 'No hay quejas en tu ciudad. ¡Bien!',
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    puntos: 'puntos',
    noExiste: 'Esta página no existe.',
  },
  en: {
    titulo: 'Your franchise in {ciudad}',
    estados: { prospecto: 'Prospect', vendida: 'Sold', activa: 'Active', pausada: 'Paused' },
    hoy: 'Orders today',
    pedidos30: 'Delivered orders (30 days)',
    ventas30: 'Sales (30 days)',
    motos: 'Fleet motorbikes',
    restaurantes: 'Restaurants',
    abiertos: 'open now',
    repartidores: 'Drivers',
    conectados: 'online now',
    quejas: 'Complaints and help requests',
    sinQuejas: 'No complaints in your city. Nice!',
    abierto: 'Open',
    cerrado: 'Closed',
    puntos: 'points',
    noExiste: 'This page doesn’t exist.',
  },
};

type Resumen = {
  franquicia: {
    ciudad: string;
    pais: string;
    estado: keyof (typeof T)['es']['estados'];
    motos: number;
  };
  metricas: {
    pedidosHoy: number;
    pedidos30: number;
    ventas30: number;
    restaurantes: number;
    restaurantesAbiertos: number;
    repartidores: number;
    repartidoresConectados: number;
    ticketsAbiertos: number;
  };
  restaurantes: { nombre: string; estado: string; abierto: boolean; plan: string }[];
  repartidores: { nombre: string; conectado: boolean; puntos: number }[];
  quejas: { tipo: string; estado: string; asunto: string; fecha: string }[];
};

/**
 * Panel del franquiciado: su ciudad completa, en /panel/franquicia-<ciudad>-<codigo>. Si la cuenta
 * no es la dueña (o el admin), el servidor dice que no existe y aquí también.
 */
export function PanelFranquicia({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedirResumen(ruta)
      .then(setR)
      .catch((x: unknown) =>
        setError(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [ruta, t.noExiste]);
  if (!r) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const m = r.metricas;
  return (
    <section className="super">
      <h1>{t.titulo.replace('{ciudad}', r.franquicia.ciudad)}</h1>
      <p>
        <span className="insignia">{t.estados[r.franquicia.estado]}</span>
      </p>
      <ul className="super-tarjetas">
        <li className="super-tarjeta">
          <span>{t.hoy}</span>
          <strong>{m.pedidosHoy}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.pedidos30}</span>
          <strong>{m.pedidos30}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.ventas30}</span>
          <strong>{formatearDolares(m.ventas30, idioma)}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.motos}</span>
          <strong>{r.franquicia.motos}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.restaurantes}</span>
          <strong>{m.restaurantes}</strong>
          <small>
            {m.restaurantesAbiertos} {t.abiertos}
          </small>
        </li>
        <li className="super-tarjeta">
          <span>{t.repartidores}</span>
          <strong>{m.repartidores}</strong>
          <small>
            {m.repartidoresConectados} {t.conectados}
          </small>
        </li>
      </ul>
      <div className="super-dos">
        <div>
          <h2>{t.restaurantes}</h2>
          <ul className="super-lista">
            {r.restaurantes.map((x) => (
              <li key={x.nombre}>
                <strong>{x.nombre}</strong> · {x.abierto ? t.abierto : t.cerrado} · {x.plan}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t.repartidores}</h2>
          <ul className="super-lista">
            {r.repartidores.map((x, i) => (
              <li key={`${x.nombre}-${i}`}>
                <strong>{x.nombre}</strong> · {x.conectado ? t.conectados : '—'} · {x.puntos}{' '}
                {t.puntos}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h2>{t.quejas}</h2>
      {r.quejas.length === 0 ? (
        <p>{t.sinQuejas}</p>
      ) : (
        <ul className="super-lista">
          {r.quejas.map((q, i) => (
            <li key={`${q.fecha}-${i}`}>
              <strong>{q.asunto}</strong> · {q.estado} · {q.fecha}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const pedirResumen = (ruta: string) => pedir<Resumen>('GET', `/datos/franquicia/${ruta}/resumen`);
