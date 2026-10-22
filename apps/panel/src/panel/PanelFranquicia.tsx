import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { pedir } from './api';

const T = {
  es: {
    titulo: '{nombre}',
    subtitulo: 'Franquicia de Divoox en {ciudad}',
    estados: {
      prospecto: 'Prospecto',
      vendida: 'Vendida',
      activa: 'Activa',
      pausada: 'Pausada',
      cerrada: 'Cerrada',
    },
    roles: { dueno: 'Dueño', manager: 'Manager', admin: 'Superadmin' },
    territorio: 'Tu territorio',
    sinTerritorio:
      'Todavía no tienes áreas asignadas. Nuestro equipo te las asigna desde la central.',
    pedidos: 'Pedidos de tu territorio (30 días)',
    sinPedidos: 'Todavía no hay pedidos en tu territorio.',
    marcarRespondida: 'Marcar respondida',
    cerrarIncidencia: 'Cerrar',
    reabrir: 'Reabrir',
    estadosPedido: {
      pagado: 'Esperando al restaurante',
      aceptado: 'En preparación',
      listo: 'Listo para recoger',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
      rechazado: 'Rechazado',
    } as Record<string, string>,
    estadosArea: {
      borrador: 'Borrador',
      proximamente: 'Próximamente',
      activa: 'Activa',
      pausada: 'Pausada',
      cerrada: 'Cerrada',
    } as Record<string, string>,
    hoy: 'Pedidos hoy',
    pedidos30: 'Pedidos entregados (30 días)',
    ventas30: 'Ventas (30 días)',
    motos: 'Motos de la flota',
    restaurantes: 'Restaurantes',
    abiertos: 'abiertos ahora',
    repartidores: 'Repartidores',
    conectados: 'conectados ahora',
    quejas: 'Quejas y pedidos de ayuda',
    sinQuejas: 'No hay quejas en tu territorio. ¡Bien!',
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    puntos: 'puntos',
    noExiste: 'Esta página no existe.',
  },
  en: {
    titulo: '{nombre}',
    subtitulo: 'Divoox franchise in {ciudad}',
    estados: {
      prospecto: 'Prospect',
      vendida: 'Sold',
      activa: 'Active',
      pausada: 'Paused',
      cerrada: 'Closed',
    },
    roles: { dueno: 'Owner', manager: 'Manager', admin: 'Superadmin' },
    territorio: 'Your territory',
    sinTerritorio: 'You don’t have areas assigned yet. Our team assigns them from headquarters.',
    pedidos: 'Orders in your territory (30 days)',
    sinPedidos: 'No orders in your territory yet.',
    marcarRespondida: 'Mark answered',
    cerrarIncidencia: 'Close',
    reabrir: 'Reopen',
    estadosPedido: {
      pagado: 'Waiting for the restaurant',
      aceptado: 'Being prepared',
      listo: 'Ready for pickup',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
      rechazado: 'Declined',
    } as Record<string, string>,
    estadosArea: {
      borrador: 'Draft',
      proximamente: 'Coming soon',
      activa: 'Live',
      pausada: 'Paused',
      cerrada: 'Closed',
    } as Record<string, string>,
    hoy: 'Orders today',
    pedidos30: 'Delivered orders (30 days)',
    ventas30: 'Sales (30 days)',
    motos: 'Fleet motorbikes',
    restaurantes: 'Restaurants',
    abiertos: 'open now',
    repartidores: 'Drivers',
    conectados: 'online now',
    quejas: 'Complaints and help requests',
    sinQuejas: 'No complaints in your territory. Nice!',
    abierto: 'Open',
    cerrado: 'Closed',
    puntos: 'points',
    noExiste: 'This page doesn’t exist.',
  },
};

type Resumen = {
  rol: keyof (typeof T)['es']['roles'];
  areas: { id: string; nombre: string; estado: string }[];
  pedidos: {
    codigo: string;
    estado: string;
    total: number;
    moneda?: string;
    creado: string;
    restaurante: string;
    area: string | null;
  }[];
  franquicia: {
    nombre: string;
    ciudad: string;
    pais: string;
    estado: keyof (typeof T)['es']['estados'];
    motos: number;
  };
  metricas: {
    pedidosHoy: number;
    pedidos30: number;
    ventas30: number;
    /** C-MONEDA-RECORRIDO: la moneda de la ciudad. */
    moneda?: string;
    restaurantes: number;
    restaurantesAbiertos: number;
    repartidores: number;
    repartidoresConectados: number;
    ticketsAbiertos: number;
  };
  restaurantes: { nombre: string; estado: string; abierto: boolean; plan: string }[];
  repartidores: { nombre: string; conectado: boolean; puntos: number }[];
  quejas: {
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    asunto: string;
    fecha: string;
  }[];
};

/**
 * Panel de la franquicia, en /panel/franchise-<ciudad>-<codigo>: su dueño y sus managers ven SOLO
 * su territorio (las áreas asignadas). Si la cuenta no entra, el servidor dice que no existe y
 * aquí también (C-TERRITORIO).
 */
export function PanelFranquicia({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedirResumen(ruta)
      .then(setR)
      .catch((x: unknown) =>
        setError(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [ruta, t.noExiste]);
  useEffect(cargar, [cargar]);
  async function incidencia(id: string, estado: string) {
    setError('');
    try {
      await pedir('PATCH', `/datos/franquicia/${ruta}/incidencias/${id}`, { estado });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const nombreDe = (mapa: Record<string, string>, k: string) =>
    new Map(Object.entries(mapa)).get(k) ?? k;
  if (!r) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const m = r.metricas;
  return (
    <section className="super">
      <h1>{t.titulo.replace('{nombre}', r.franquicia.nombre)}</h1>
      <p>
        {t.subtitulo.replace('{ciudad}', r.franquicia.ciudad)} ·{' '}
        <span className={`insignia ${r.franquicia.estado === 'activa' ? 'insignia-aprobado' : ''}`}>
          {t.estados[r.franquicia.estado]}
        </span>{' '}
        <span className="insignia">{t.roles[r.rol]}</span>
      </p>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <h2>{t.territorio}</h2>
      {r.areas.length === 0 ? (
        <p className="pista">{t.sinTerritorio}</p>
      ) : (
        <ul className="super-lista">
          {r.areas.map((a) => (
            <li key={a.id}>
              <strong>{a.nombre}</strong> ·{' '}
              <span className={`insignia ${a.estado === 'activa' ? 'insignia-aprobado' : ''}`}>
                {nombreDe(t.estadosArea, a.estado)}
              </span>
            </li>
          ))}
        </ul>
      )}
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
          <strong>{formatearMonto(m.ventas30, m.moneda ?? 'USD', idioma)}</strong>
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
      <h2>{t.pedidos}</h2>
      {r.pedidos.length === 0 ? (
        <p>{t.sinPedidos}</p>
      ) : (
        <ul className="super-lista">
          {r.pedidos.map((p) => (
            <li key={p.codigo}>
              <strong>#{p.codigo}</strong> · {p.restaurante} ·{' '}
              <span className={`insignia ${p.estado === 'entregado' ? 'insignia-aprobado' : ''}`}>
                {nombreDe(t.estadosPedido, p.estado)}
              </span>{' '}
              · {formatearMonto(p.total, p.moneda ?? 'USD', idioma)} · {p.creado}
              {p.area ? ` · ${p.area}` : ''}
            </li>
          ))}
        </ul>
      )}
      <h2>{t.quejas}</h2>
      {r.quejas.length === 0 ? (
        <p>{t.sinQuejas}</p>
      ) : (
        <ul className="super-lista">
          {r.quejas.map((q) => (
            <li key={q.id}>
              <strong>{q.asunto}</strong> · {q.estado} · {q.fecha}{' '}
              {q.estado === 'abierto' && (
                <button
                  type="button"
                  className="enlace"
                  onClick={() => void incidencia(q.id, 'respondido')}
                >
                  {t.marcarRespondida}
                </button>
              )}{' '}
              {q.estado !== 'cerrado' ? (
                <button
                  type="button"
                  className="enlace"
                  onClick={() => void incidencia(q.id, 'cerrado')}
                >
                  {t.cerrarIncidencia}
                </button>
              ) : (
                <button
                  type="button"
                  className="enlace"
                  onClick={() => void incidencia(q.id, 'abierto')}
                >
                  {t.reabrir}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const pedirResumen = (ruta: string) => pedir<Resumen>('GET', `/datos/franquicia/${ruta}/resumen`);
