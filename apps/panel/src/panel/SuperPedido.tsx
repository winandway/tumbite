import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { LuzSemaforo } from './LuzSemaforo';
import { SelectorCiudad } from './SuperFichas';

/** Bitácora de un pedido en el superadmin: quién hizo qué y a qué hora, incluido el Manager. */
const T = {
  es: {
    volver: '← Volver',
    pedido: 'Pedido',
    cliente: 'Cliente',
    restaurante: 'Restaurante',
    repartidor: 'Repartidor',
    sinRepartidor: 'Sin repartidor',
    total: 'Total',
    propina: 'Propina',
    direccion: 'Entrega en',
    notas: 'Notas',
    ciudad: 'Ciudad',
    pago: 'Pago en Stripe',
    bitacora: 'Bitácora',
    manager: 'Manager',
    eventos: {
      creado: 'Pedido creado',
      pago_pendiente: 'Esperando el pago',
      pagado: 'Pagado',
      aceptado: 'El restaurante lo aceptó',
      listo: 'Comida lista',
      en_camino: 'Repartidor en camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado y dinero devuelto',
      recordatorio_1: 'Recordatorio al restaurante (3 min)',
      recordatorio_2: 'Segundo recordatorio al restaurante (6 min)',
      cancelado_sin_respuesta: 'Cancelado solo: el restaurante no respondió en 10 min',
      sin_repartidor: 'Alerta: 15 min sin repartidor',
      cancelado_por_cliente: 'El cliente lo canceló',
      rechazado_por_restaurante: 'El restaurante lo rechazó',
    } as Record<string, string>,
    estados: {
      pago_pendiente: 'Esperando pago',
      pagado: 'Pagado, esperando al restaurante',
      aceptado: 'En cocina',
      listo: 'Listo para recoger',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
  },
  en: {
    volver: '← Back',
    pedido: 'Order',
    cliente: 'Customer',
    restaurante: 'Restaurant',
    repartidor: 'Driver',
    sinRepartidor: 'No driver',
    total: 'Total',
    propina: 'Tip',
    direccion: 'Deliver to',
    notas: 'Notes',
    ciudad: 'City',
    pago: 'Stripe payment',
    bitacora: 'Timeline',
    manager: 'Manager',
    eventos: {
      creado: 'Order created',
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid',
      aceptado: 'Restaurant accepted it',
      listo: 'Food ready',
      en_camino: 'Driver on the way',
      entregado: 'Delivered',
      cancelado: 'Canceled and refunded',
      recordatorio_1: 'Reminder to the restaurant (3 min)',
      recordatorio_2: 'Second reminder to the restaurant (6 min)',
      cancelado_sin_respuesta: 'Auto-canceled: no answer from the restaurant in 10 min',
      sin_repartidor: 'Alert: 15 min without a driver',
      cancelado_por_cliente: 'The customer canceled it',
      rechazado_por_restaurante: 'The restaurant rejected it',
    } as Record<string, string>,
    estados: {
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid, waiting for the restaurant',
      aceptado: 'Being prepared',
      listo: 'Ready for pickup',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
  },
};

type Pedido = {
  id: string;
  estado: string;
  total: number;
  propina: number;
  direccion: string;
  notas: string;
  ciudad: string | null;
  pagoStripe: string | null;
  lineas: { nombre: string; cantidad: number }[];
  cliente: { id: string; nombre: string };
  restaurante: { id: string; nombre: string };
  repartidor: { id: string; nombre: string; codigo: string | null } | null;
  bitacora: { evento: string; fecha: string; quien: string | null; tipo: string }[];
};

const hora = (f: string, idioma: Idioma) =>
  new Date(`${f.replace(' ', 'T')}${f.includes('T') ? '' : 'Z'}`).toLocaleString(idioma, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function SuperPedido({ base, id, idioma }: { base: string; id: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [p, setP] = useState<Pedido | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ pedido: Pedido }>('GET', `/datos/admin/pedidos/${id}`)
      .then((r) => setP(r.pedido))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [id]);
  if (!p) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const dinero = (c: number) => formatearDolares(c, idioma);
  return (
    <section className="super">
      <button type="button" className="enlace docs-volver" onClick={() => window.history.back()}>
        {t.volver}
      </button>
      <h1>
        {t.pedido} <span className="super-id">#{p.id.slice(0, 6).toUpperCase()}</span>
      </h1>
      <p>
        <span className={`insignia ${p.estado === 'entregado' ? 'insignia-aprobado' : ''}`}>
          {t.estados[p.estado] ?? p.estado}
        </span>
      </p>
      <div className="super-dos">
        <div className="tarjeta-form">
          <dl className="super-dl">
            <dt>{t.cliente}</dt>
            <dd>
              <Enlace a={`${base}/customers/${p.cliente.id}`}>{p.cliente.nombre}</Enlace>
            </dd>
            <dt>{t.restaurante}</dt>
            <dd>
              <Enlace a={`${base}/restaurants/${p.restaurante.id}`}>{p.restaurante.nombre}</Enlace>
            </dd>
            <dt>{t.repartidor}</dt>
            <dd>
              {p.repartidor ? (
                <Enlace a={`${base}/drivers/${p.repartidor.id}`}>
                  {p.repartidor.codigo ?? ''} {p.repartidor.nombre}
                </Enlace>
              ) : (
                t.sinRepartidor
              )}
            </dd>
            <dt>{t.ciudad}</dt>
            <dd>{p.ciudad ?? '—'}</dd>
            <dt>{t.direccion}</dt>
            <dd>{p.direccion}</dd>
            {p.notas ? (
              <>
                <dt>{t.notas}</dt>
                <dd>{p.notas}</dd>
              </>
            ) : null}
            <dt>{t.total}</dt>
            <dd>
              {dinero(p.total)} ({t.propina} {dinero(p.propina)})
            </dd>
            <dt>{t.pago}</dt>
            <dd className="super-id">{p.pagoStripe ?? '—'}</dd>
          </dl>
          <ul className="super-lista">
            {p.lineas.map((l, i) => (
              <li key={i}>
                {l.cantidad} × {l.nombre}
              </li>
            ))}
          </ul>
        </div>
        <div className="tarjeta-form">
          <h2>{t.bitacora}</h2>
          <ol className="super-bitacora">
            {p.bitacora.map((b, i) => (
              <li key={i} className={b.tipo === 'manager' ? 'super-bitacora-manager' : ''}>
                <time>{hora(b.fecha, idioma)}</time>
                <strong>
                  {b.tipo === 'manager' ? `${t.manager}: ` : ''}
                  {t.eventos[b.evento] ?? b.evento}
                </strong>
                {b.quien && b.tipo !== 'manager' ? <span>{b.quien}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const TL = {
  es: {
    titulo: 'Pedidos en curso',
    ayuda:
      'Todos los pedidos vivos, los que están en problemas primero. Se actualiza solo cada 15 segundos.',
    vacio: 'No hay pedidos en curso.',
    rojos: 'en problemas',
    amarillos: 'atrasándose',
    sinRepartidor: 'sin repartidor',
  },
  en: {
    titulo: 'Live orders',
    ayuda: 'Every live order, the ones in trouble first. Refreshes every 15 seconds.',
    vacio: 'No live orders.',
    rojos: 'in trouble',
    amarillos: 'running late',
    sinRepartidor: 'no driver',
  },
};

type EnCurso = Parameters<typeof LuzSemaforo>[0]['pedido'] & {
  id: string;
  total: number;
  restaurante: string;
  cliente: string;
  repartidorCodigo: string | null;
  ciudad: string | null;
  luz: 'verde' | 'amarillo' | 'rojo';
};

/** Tablero del Manager para el superadmin: cada pedido vivo con su semáforo. Candado C-MANAGER-1. */
export function SuperPedidos({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(TL, idioma);
  const te = enIdioma(T, idioma);
  const [zona, setZona] = useState(
    () => new URLSearchParams(window.location.search).get('zona') ?? '',
  );
  const [lista, setLista] = useState<EnCurso[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      pedir<{ pedidos: EnCurso[] }>('GET', `/datos/admin/pedidos?zona=${encodeURIComponent(zona)}`)
        .then((r) => vivo && (setLista(r.pedidos), setError('')))
        .catch((e: unknown) => vivo && setError(e instanceof ErrorApi ? e.message : String(e)));
    void cargar();
    const reloj = setInterval(() => void cargar(), 15000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [zona]);
  const rojos = lista?.filter((p) => p.luz === 'rojo').length ?? 0;
  const amarillos = lista?.filter((p) => p.luz === 'amarillo').length ?? 0;
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      <div className="super-filtros">
        <SelectorCiudad zona={zona} cambiar={setZona} idioma={idioma} />
      </div>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {lista && (
        <p>
          <strong>{lista.length}</strong> · {rojos} {t.rojos} · {amarillos} {t.amarillos}
        </p>
      )}
      {lista?.length === 0 && <p>{t.vacio}</p>}
      <ul className="super-bandeja super-encurso">
        {lista?.map((p) => (
          <li key={p.id}>
            <Enlace a={`${base}/orders/${p.id}`}>
              <strong>
                #{p.id.slice(0, 6).toUpperCase()} · {p.restaurante} ·{' '}
                {formatearDolares(p.total, idioma)}
              </strong>
              <span>
                {te.estados[p.estado] ?? p.estado} · {p.cliente}
                {p.ciudad ? ` · ${p.ciudad}` : ''} · {p.repartidorCodigo ?? t.sinRepartidor}
              </span>
              <LuzSemaforo pedido={p} idioma={idioma} />
            </Enlace>
          </li>
        ))}
      </ul>
    </section>
  );
}
