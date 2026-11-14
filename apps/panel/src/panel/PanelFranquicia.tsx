import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { pedir } from './api';
import {
  Dona,
  EncabezadoPagina,
  EstadoVacio,
  GraficaBarras,
  Metricas,
  Pastilla,
  Tabla,
  Tarjeta,
  TarjetaMetrica,
  type Tono,
} from './armazon/Piezas';

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
    sinQuejas: 'No hay quejas en tu territorio.',
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    puntos: 'puntos',
    noExiste: 'Esta página no existe.',
    porEstado: 'Tus pedidos de 30 días, por estado',
    abiertosAhora: 'Restaurantes abiertos ahora',
    conectadosAhora: 'Repartidores conectados ahora',
    sinRestaurantes: 'Todavía no hay restaurantes en tu territorio.',
    sinRepartidores: 'Todavía no hay repartidores en tu territorio.',
    enLinea: 'Conectado',
    fueraDeLinea: 'Sin conectar',
    colPedido: 'Pedido',
    colRestaurante: 'Restaurante',
    colEstado: 'Estado',
    colTotal: 'Total',
    colFecha: 'Fecha',
    colArea: 'Área',
    estadosQueja: { abierto: 'Abierta', respondido: 'Respondida', cerrado: 'Cerrada' } as Record<
      string,
      string
    >,
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
    sinQuejas: 'No complaints in your territory.',
    abierto: 'Open',
    cerrado: 'Closed',
    puntos: 'points',
    noExiste: 'This page doesn’t exist.',
    porEstado: 'Your 30-day orders, by status',
    abiertosAhora: 'Restaurants open now',
    conectadosAhora: 'Drivers online now',
    sinRestaurantes: 'No restaurants in your territory yet.',
    sinRepartidores: 'No drivers in your territory yet.',
    enLinea: 'Online',
    fueraDeLinea: 'Offline',
    colPedido: 'Order',
    colRestaurante: 'Restaurant',
    colEstado: 'Status',
    colTotal: 'Total',
    colFecha: 'Date',
    colArea: 'Area',
    estadosQueja: { abierto: 'Open', respondido: 'Answered', cerrado: 'Closed' } as Record<
      string,
      string
    >,
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
  const porEstado = (
    ['pagado', 'aceptado', 'listo', 'en_camino', 'entregado', 'cancelado'] as const
  )
    .map((estado) => ({
      etiqueta: nombreDe(t.estadosPedido, estado),
      valor: r.pedidos.filter((p) => p.estado === estado).length,
    }))
    .filter((e) => e.valor > 0);
  const tonoPedido = (estado: string): Tono =>
    estado === 'entregado'
      ? 'exito'
      : estado === 'cancelado' || estado === 'rechazado'
        ? 'problema'
        : 'espera';
  return (
    <section className="super">
      <EncabezadoPagina
        titulo={t.titulo.replace('{nombre}', r.franquicia.nombre)}
        detalle={
          <>
            {t.subtitulo.replace('{ciudad}', r.franquicia.ciudad)}{' '}
            <Pastilla tono={r.franquicia.estado === 'activa' ? 'exito' : 'neutro'}>
              {t.estados[r.franquicia.estado]}
            </Pastilla>{' '}
            <Pastilla>{t.roles[r.rol]}</Pastilla>
          </>
        }
      />
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <Metricas>
        <TarjetaMetrica icono="orders" tono="marca" etiqueta={t.hoy} valor={m.pedidosHoy} />
        <TarjetaMetrica icono="reports" etiqueta={t.pedidos30} valor={m.pedidos30} />
        <TarjetaMetrica
          icono="money"
          tono="exito"
          etiqueta={t.ventas30}
          valor={formatearMonto(m.ventas30, m.moneda ?? 'USD', idioma)}
        />
        <TarjetaMetrica
          icono="restaurants"
          etiqueta={t.restaurantes}
          valor={m.restaurantes}
          detalle={`${m.restaurantesAbiertos} ${t.abiertos}`}
        />
        <TarjetaMetrica
          icono="drivers"
          etiqueta={t.repartidores}
          valor={m.repartidores}
          detalle={`${m.repartidoresConectados} ${t.conectados}`}
        />
        <TarjetaMetrica icono="moto" etiqueta={t.motos} valor={r.franquicia.motos} />
      </Metricas>
      <div className="pd-rejilla">
        <Tarjeta titulo={t.porEstado} className="pd-ancho-6">
          <GraficaBarras titulo={t.porEstado} vacio={t.sinPedidos} datos={porEstado} />
        </Tarjeta>
        <Tarjeta titulo={t.abiertosAhora} className="pd-ancho-3">
          <Dona
            titulo={t.abiertosAhora}
            vacio={t.sinRestaurantes}
            partes={[
              { etiqueta: t.abierto, valor: m.restaurantesAbiertos, tono: 'exito' },
              {
                etiqueta: t.cerrado,
                valor: Math.max(0, m.restaurantes - m.restaurantesAbiertos),
                tono: 'suave',
              },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo={t.conectadosAhora} className="pd-ancho-3">
          <Dona
            titulo={t.conectadosAhora}
            vacio={t.sinRepartidores}
            partes={[
              { etiqueta: t.enLinea, valor: m.repartidoresConectados, tono: 'exito' },
              {
                etiqueta: t.fueraDeLinea,
                valor: Math.max(0, m.repartidores - m.repartidoresConectados),
                tono: 'suave',
              },
            ]}
          />
        </Tarjeta>
      </div>
      <div className="pd-rejilla">
        <Tarjeta titulo={t.territorio} className="pd-ancho-4">
          {r.areas.length === 0 ? (
            <EstadoVacio titulo={t.sinTerritorio} />
          ) : (
            <ul className="super-lista">
              {r.areas.map((a) => (
                <li key={a.id}>
                  <strong>{a.nombre}</strong>{' '}
                  <Pastilla tono={a.estado === 'activa' ? 'exito' : 'neutro'}>
                    {nombreDe(t.estadosArea, a.estado)}
                  </Pastilla>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo={t.restaurantes} className="pd-ancho-4">
          {r.restaurantes.length === 0 ? (
            <EstadoVacio titulo={t.sinRestaurantes} />
          ) : (
            <ul className="super-lista">
              {r.restaurantes.map((x) => (
                <li key={x.nombre}>
                  <strong>{x.nombre}</strong>{' '}
                  <Pastilla tono={x.abierto ? 'exito' : 'neutro'}>
                    {x.abierto ? t.abierto : t.cerrado}
                  </Pastilla>{' '}
                  <small>{x.plan}</small>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo={t.repartidores} className="pd-ancho-4">
          {r.repartidores.length === 0 ? (
            <EstadoVacio titulo={t.sinRepartidores} />
          ) : (
            <ul className="super-lista">
              {r.repartidores.map((x, i) => (
                <li key={`${x.nombre}-${i}`}>
                  <strong>{x.nombre}</strong>{' '}
                  <Pastilla tono={x.conectado ? 'exito' : 'neutro'}>
                    {x.conectado ? t.enLinea : t.fueraDeLinea}
                  </Pastilla>{' '}
                  <small>
                    {x.puntos} {t.puntos}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
      <h2>{t.pedidos}</h2>
      {r.pedidos.length === 0 ? (
        <Tarjeta>
          <EstadoVacio titulo={t.sinPedidos} />
        </Tarjeta>
      ) : null}
      <Tabla
        vacio=""
        columnas={[
          { clave: 'codigo', titulo: t.colPedido },
          { clave: 'restaurante', titulo: t.colRestaurante },
          { clave: 'estado', titulo: t.colEstado },
          { clave: 'total', titulo: t.colTotal, numero: true },
          { clave: 'creado', titulo: t.colFecha },
          { clave: 'area', titulo: t.colArea },
        ]}
        filas={r.pedidos.map((p) => ({
          id: p.codigo,
          codigo: <strong>#{p.codigo}</strong>,
          restaurante: p.restaurante,
          estado: (
            <Pastilla tono={tonoPedido(p.estado)}>{nombreDe(t.estadosPedido, p.estado)}</Pastilla>
          ),
          total: formatearMonto(p.total, p.moneda ?? 'USD', idioma),
          creado: p.creado,
          area: p.area ?? '',
        }))}
      />
      <h2>{t.quejas}</h2>
      {r.quejas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio titulo={t.sinQuejas} />
        </Tarjeta>
      ) : (
        <ul className="super-lista pd-tarjeta">
          {r.quejas.map((q) => (
            <li key={q.id}>
              <strong>{q.asunto}</strong>{' '}
              <Pastilla
                tono={
                  q.estado === 'abierto' ? 'espera' : q.estado === 'respondido' ? 'exito' : 'neutro'
                }
              >
                {nombreDe(t.estadosQueja, q.estado)}
              </Pastilla>{' '}
              <small>{q.fecha}</small>{' '}
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
