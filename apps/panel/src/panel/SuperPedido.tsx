import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';

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
      cancelado: 'Cancelled and refunded',
      recordatorio_1: 'Reminder to the restaurant (3 min)',
      recordatorio_2: 'Second reminder to the restaurant (6 min)',
      cancelado_sin_respuesta: 'Auto-cancelled: no answer from the restaurant in 10 min',
      sin_repartidor: 'Alert: 15 min without a driver',
      cancelado_por_cliente: 'The customer cancelled it',
      rechazado_por_restaurante: 'The restaurant rejected it',
    } as Record<string, string>,
    estados: {
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid, waiting for the restaurant',
      aceptado: 'Being prepared',
      listo: 'Ready for pickup',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Cancelled',
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
              <Enlace a={`${base}/clientes/${p.cliente.id}`}>{p.cliente.nombre}</Enlace>
            </dd>
            <dt>{t.restaurante}</dt>
            <dd>
              <Enlace a={`${base}/restaurantes/${p.restaurante.id}`}>{p.restaurante.nombre}</Enlace>
            </dd>
            <dt>{t.repartidor}</dt>
            <dd>
              {p.repartidor ? (
                <Enlace a={`${base}/repartidores/${p.repartidor.id}`}>
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
