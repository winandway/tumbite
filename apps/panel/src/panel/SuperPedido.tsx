import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto, textoAMonto } from '@tumbite/compartido';
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
    excepcion: 'El repartidor no puede confirmar su ubicación',
    motivo: 'Motivo',
    pedidaEn: 'Pedida',
    autorizar: 'Autorizar la entrega sin GPS',
    autorizada: 'Autorizada por',
    autorizadaOk: 'Autorizada. El repartidor ya puede entregar.',
    soporte: 'Acciones de soporte',
    cancelar: 'Cancelar y devolver el dinero',
    motivoCancelar: 'Motivo de la cancelación (le queda en la bitácora):',
    canceladoOk: 'Cancelado. El dinero vuelve a la tarjeta del cliente.',
    soltar: 'Quitar al repartidor y volver a ofrecer',
    motivoSoltar: 'Motivo (opcional):',
    soltadoOk: 'El pedido volvió a la fila: se le ofrece a otro repartidor.',
    devolver: 'Devolver parte del dinero',
    montoDevolver: 'Monto a devolver, en dólares (por ejemplo 5.00):',
    montoDevolverMoneda: 'Monto a devolver, en {m} (por ejemplo {ej}):',
    motivoDevolver: 'Motivo de la devolución (queda en la bitácora):',
    devueltoOk: 'Devolución enviada a Stripe. El cliente la ve en su tarjeta en unos días.',
    eventos: {
      creado: 'Pedido creado',
      pago_pendiente: 'Esperando el pago',
      pagado: 'Pagado',
      aceptado: 'El restaurante lo aceptó',
      listo: 'Comida lista',
      en_camino: 'Repartidor en camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado y dinero devuelto',
      recordatorio_1: 'Recordatorio al restaurante (1 min)',
      recordatorio_2: 'Segundo recordatorio al restaurante (3 min)',
      cancelado_sin_respuesta: 'Cancelado solo: el restaurante no respondió en 6 min',
      sin_repartidor: 'Alerta: 15 min sin repartidor',
      cancelado_por_cliente: 'El cliente lo canceló',
      rechazado_por_restaurante: 'El restaurante lo rechazó',
      gps_salto: 'GPS sospechoso: salto imposible (no se contó)',
      ubicacion_sin_confirmar: 'El repartidor pidió entregar sin confirmación del GPS',
      ubicacion_autorizada: 'Soporte autorizó la entrega sin GPS',
      cancelado_por_soporte: 'Soporte lo canceló y devolvió el dinero',
      repartidor_quitado_por_soporte: 'Soporte le quitó el pedido al repartidor',
      devolucion_parcial: 'Soporte devolvió parte del dinero',
      disputa_abierta: 'El cliente disputó el cobro con su banco',
      disputa_cerrada: 'La disputa se cerró',
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
    excepcion: 'The driver can’t confirm their location',
    motivo: 'Reason',
    pedidaEn: 'Requested',
    autorizar: 'Authorize delivery without GPS',
    autorizada: 'Authorized by',
    autorizadaOk: 'Authorized. The driver can now deliver.',
    soporte: 'Support actions',
    cancelar: 'Cancel and refund',
    motivoCancelar: 'Reason for the cancellation (it stays in the log):',
    canceladoOk: 'Canceled. The money goes back to the customer’s card.',
    soltar: 'Remove the driver and offer it again',
    motivoSoltar: 'Reason (optional):',
    soltadoOk: 'The order went back to the queue: it’s offered to another driver.',
    devolver: 'Refund part of the money',
    montoDevolver: 'Amount to refund, in dollars (for example 5.00):',
    montoDevolverMoneda: 'Amount to refund, in {m} (for example {ej}):',
    motivoDevolver: 'Reason for the refund (it stays in the log):',
    devueltoOk: 'Refund sent to Stripe. The customer sees it on their card in a few days.',
    eventos: {
      creado: 'Order created',
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid',
      aceptado: 'Restaurant accepted it',
      listo: 'Food ready',
      en_camino: 'Driver on the way',
      entregado: 'Delivered',
      cancelado: 'Canceled and refunded',
      recordatorio_1: 'Reminder to the restaurant (1 min)',
      recordatorio_2: 'Second reminder to the restaurant (3 min)',
      cancelado_sin_respuesta: 'Auto-canceled: no answer from the restaurant in 6 min',
      sin_repartidor: 'Alert: 15 min without a driver',
      cancelado_por_cliente: 'The customer canceled it',
      rechazado_por_restaurante: 'The restaurant rejected it',
      gps_salto: 'Suspicious GPS: impossible jump (not counted)',
      ubicacion_sin_confirmar: 'Driver asked to deliver without GPS confirmation',
      ubicacion_autorizada: 'Support authorized delivery without GPS',
      cancelado_por_soporte: 'Support canceled it and refunded the money',
      repartidor_quitado_por_soporte: 'Support removed the order from the driver',
      devolucion_parcial: 'Support refunded part of the money',
      disputa_abierta: 'The customer disputed the charge with their bank',
      disputa_cerrada: 'The dispute was closed',
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
  /** C-MONEDA-RECORRIDO: la moneda del pedido. */
  moneda?: string;
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
  excepcionUbicacion: {
    motivo: string;
    pedidaEn: string;
    autorizadaEn: string | null;
    autorizadaPor: string | null;
  } | null;
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
  const [aviso, setAviso] = useState('');
  const cargar = () =>
    pedir<{ pedido: Pedido }>('GET', `/datos/admin/pedidos/${id}`)
      .then((r) => setP(r.pedido))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  useEffect(() => {
    void cargar();
    // Solo al abrir la ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  async function autorizar() {
    setError('');
    try {
      await pedir('POST', `/datos/admin/pedidos/${id}/autorizar-ubicacion`);
      setAviso(t.autorizadaOk);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }
  // Acciones de soporte (auditoría final, punto 26): cancelar con devolución y quitar al repartidor.
  async function accion(ruta: string, pregunta: string, ok: string, obligatorio: boolean) {
    const motivo = window.prompt(pregunta) ?? '';
    if (obligatorio && motivo.trim().length < 3) return;
    setError('');
    try {
      await pedir('POST', `/datos/admin/pedidos/${id}/${ruta}`, { motivo });
      setAviso(ok);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }
  const vivo = ['pago_pendiente', 'pagado', 'aceptado', 'listo', 'en_camino'].includes(
    p?.estado ?? '',
  );
  async function devolver() {
    // C-MONEDA-RECORRIDO: el monto se escribe en la moneda del pedido (en dólares, como siempre).
    const moneda = p?.moneda ?? 'USD';
    const pregunta =
      moneda === 'USD'
        ? t.montoDevolver
        : t.montoDevolverMoneda
            .replace('{m}', moneda)
            .replace('{ej}', moneda === 'COP' ? '5000' : '5.00');
    const texto = window.prompt(pregunta) ?? '';
    const monto = textoAMonto(texto, moneda);
    if (!Number.isFinite(monto) || monto <= 0) return;
    const motivo = window.prompt(t.motivoDevolver) ?? '';
    if (motivo.trim().length < 3) return;
    setError('');
    try {
      await pedir('POST', `/datos/admin/pedidos/${id}/devolver`, { montoCentavos: monto, motivo });
      setAviso(t.devueltoOk);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }
  if (!p) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const dinero = (c: number) => formatearMonto(c, p.moneda ?? 'USD', idioma);
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
          {p.estado === 'entregado' ? (
            <div className="super-acciones">
              <h2>{t.soporte}</h2>
              {aviso && (
                <p className="ok" role="status">
                  {aviso}
                </p>
              )}
              {error && (
                <p className="error-general" role="alert">
                  {error}
                </p>
              )}
              <button type="button" className="boton secundario" onClick={() => void devolver()}>
                {t.devolver}
              </button>
            </div>
          ) : null}
          {vivo ? (
            <div className="super-acciones">
              <h2>{t.soporte}</h2>
              {aviso && (
                <p className="ok" role="status">
                  {aviso}
                </p>
              )}
              {error && (
                <p className="error-general" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="boton secundario"
                onClick={() => void accion('cancelar', t.motivoCancelar, t.canceladoOk, true)}
              >
                {t.cancelar}
              </button>{' '}
              {p.repartidor && ['aceptado', 'listo'].includes(p.estado) ? (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() =>
                    void accion('soltar-repartidor', t.motivoSoltar, t.soltadoOk, false)
                  }
                >
                  {t.soltar}
                </button>
              ) : null}
            </div>
          ) : null}
          {p.excepcionUbicacion ? (
            <div className="super-excepcion">
              <h2>{t.excepcion}</h2>
              <p>
                <strong>{t.motivo}:</strong> {p.excepcionUbicacion.motivo}
              </p>
              <p className="suave">
                {t.pedidaEn}: {hora(p.excepcionUbicacion.pedidaEn, idioma)}
              </p>
              {p.excepcionUbicacion.autorizadaEn ? (
                <p className="ok">
                  {t.autorizada} {p.excepcionUbicacion.autorizadaPor} ·{' '}
                  {hora(p.excepcionUbicacion.autorizadaEn, idioma)}
                </p>
              ) : (
                <button type="button" className="boton" onClick={() => void autorizar()}>
                  {t.autorizar}
                </button>
              )}
              {aviso && (
                <p className="ok" role="status">
                  {aviso}
                </p>
              )}
              {error && (
                <p className="error-general" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : null}
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
    cerrados: 'Ver los pedidos cerrados (entregados y cancelados)',
    buscar: 'Buscar por número, cliente o restaurante',
    rojos: 'en problemas',
    amarillos: 'atrasándose',
    sinRepartidor: 'sin repartidor',
  },
  en: {
    titulo: 'Live orders',
    ayuda: 'Every live order, the ones in trouble first. Refreshes every 15 seconds.',
    vacio: 'No live orders.',
    cerrados: 'Show closed orders (delivered and canceled)',
    buscar: 'Search by number, customer or restaurant',
    rojos: 'in trouble',
    amarillos: 'running late',
    sinRepartidor: 'no driver',
  },
};

type EnCurso = Parameters<typeof LuzSemaforo>[0]['pedido'] & {
  id: string;
  total: number;
  moneda?: string;
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
  const [cerrados, setCerrados] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      pedir<{ pedidos: EnCurso[] }>(
        'GET',
        `/datos/admin/pedidos?zona=${encodeURIComponent(zona)}${cerrados ? '&cerrados=1' : ''}&q=${encodeURIComponent(q)}`,
      )
        .then((r) => vivo && (setLista(r.pedidos), setError('')))
        .catch((e: unknown) => vivo && setError(e instanceof ErrorApi ? e.message : String(e)));
    void cargar();
    const reloj = setInterval(() => void cargar(), 15000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [zona, cerrados, q]);
  const rojos = lista?.filter((p) => p.luz === 'rojo').length ?? 0;
  const amarillos = lista?.filter((p) => p.luz === 'amarillo').length ?? 0;
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      <div className="super-filtros">
        <SelectorCiudad zona={zona} cambiar={setZona} idioma={idioma} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.buscar}
          aria-label={t.buscar}
        />
        <label>
          <input
            type="checkbox"
            checked={cerrados}
            onChange={(e) => setCerrados(e.target.checked)}
          />{' '}
          {t.cerrados}
        </label>
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
                {formatearMonto(p.total, p.moneda ?? 'USD', idioma)}
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
