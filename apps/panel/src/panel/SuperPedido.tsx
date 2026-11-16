import { SolicitudCancelacion } from './SolicitudCancelacion';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ErrorApi,
  FILTROS_ESTADO_PEDIDO,
  type FiltroEstadoPedido,
  type Idioma,
  LETRAS_CODIGO_APPS,
  codigoCorto,
  enIdioma,
  formatearMonto,
  textoAMonto,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { textoPendiente } from './SuperAprobaciones';
import { LuzSemaforo } from './LuzSemaforo';
import { SelectorCiudad } from './SuperFichas';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { fechaYHora, tonoEstado } from './BuscadorSuper';
import { usePreferencias } from './usePreferencias';

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
      const r = await pedir('POST', `/datos/admin/pedidos/${id}/devolver`, {
        montoCentavos: monto,
        motivo,
      });
      // C-CONTROL-DUAL: por encima del límite queda esperando la firma de otra persona.
      setAviso(textoPendiente(r, idioma) ?? t.devueltoOk);
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
        {/* C-CANCELAR-LISTO: la cancelación que pidió el restaurante, para aprobar o rechazar. */}
        <SolicitudCancelacion pedidoId={id} idioma={idioma} alResolver={() => void cargar()} />
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
      'Los pedidos de la ciudad y el estado que elijas, los que están en problemas primero. Se actualiza solo cada 15 segundos.',
    vacio: 'No hay pedidos con estos filtros.',
    vacioBusqueda: 'No encontramos pedidos con eso.',
    estado: 'Estado',
    estados: { vivos: 'Vivos', cerrados: 'Cerrados', todos: 'Todos' } as Record<string, string>,
    orden: 'Orden',
    ordenes: {
      '': 'Lo que necesita atención primero',
      recientes: 'Más recientes primero',
      antiguos: 'Más antiguos primero',
    } as Record<string, string>,
    buscar: 'Código, nombre, teléfono o monto',
    rojos: 'en problemas',
    amarillos: 'atrasándose',
    sinRepartidor: 'Sin repartidor',
    cuentaEliminada: 'Cuenta eliminada',
    mas: 'Cargar más',
    cargando: 'Cargando…',
    encontradoCerrados: 'Encontrado entre los cerrados.',
    encontradoVivos: 'Encontrado entre los vivos.',
    encontradoCiudad: 'Encontrado en otra ciudad:',
    porCodigo: 'Buscado por código en todos los estados y ciudades, el más reciente primero.',
    masCoincidencias: 'Hay más pedidos que empiezan así: escribe más letras del código.',
    avisoMonto: 'Los montos se buscan solo en los últimos 30 días.',
  },
  en: {
    titulo: 'Live orders',
    ayuda:
      'Orders for the city and status you choose, the ones in trouble first. Refreshes every 15 seconds.',
    vacio: 'No orders match these filters.',
    vacioBusqueda: 'No orders match that.',
    estado: 'Status',
    estados: { vivos: 'Live', cerrados: 'Closed', todos: 'All' } as Record<string, string>,
    orden: 'Sort',
    ordenes: {
      '': 'Needs attention first',
      recientes: 'Newest first',
      antiguos: 'Oldest first',
    } as Record<string, string>,
    buscar: 'Code, name, phone, or amount',
    rojos: 'in trouble',
    amarillos: 'running late',
    sinRepartidor: 'No driver',
    cuentaEliminada: 'Deleted account',
    mas: 'Load more',
    cargando: 'Loading…',
    encontradoCerrados: 'Found among closed orders.',
    encontradoVivos: 'Found among live orders.',
    encontradoCiudad: 'Found in another city:',
    porCodigo: 'Searched by code across every status and city, newest first.',
    masCoincidencias: 'More orders start like this: type more of the code.',
    avisoMonto: 'Amounts are searched in the last 30 days only.',
  },
};

type EnCurso = Parameters<typeof LuzSemaforo>[0]['pedido'] & {
  id: string;
  total: number;
  moneda?: string;
  restaurante: string;
  cliente: string | null;
  repartidor?: string | null;
  repartidorCodigo: string | null;
  ciudad: string | null;
  zonaId?: string | null;
  luz: 'verde' | 'amarillo' | 'rojo';
};
type RespuestaLista = {
  pedidos: EnCurso[];
  siguiente?: string | null;
  porCodigo?: boolean;
  masCoincidencias?: boolean;
  encontrado?: { cerrados: boolean; vivos: boolean; otrasCiudades: string[] } | null;
  avisoMonto?: boolean;
};

const VIVOS = new Set(['pagado', 'aceptado', 'listo', 'en_camino']);
const PAUSA_TEXTO_MS = 300;

/** El código del pedido: 6 letras, las 4 primeras (las que muestran las apps) resaltadas. */
function CodigoPedido({ id }: { id: string }) {
  const c = codigoCorto(id);
  return (
    <span className="codigo-pedido">
      #<b>{c.slice(0, LETRAS_CODIGO_APPS)}</b>
      {c.slice(LETRAS_CODIGO_APPS)}
    </span>
  );
}

/**
 * «Pedidos en curso» del superadmin (C-MANAGER-1, C-BUSCADOR-SERIO, C-FILTROS-GUARDADOS): estado
 * Vivos · Cerrados · Todos, ciudad y orden guardados por empleado; lo escrito se busca con la
 * misma pieza que el buscador de arriba (un código aparece aunque esté cerrado o en otra ciudad);
 * de a 50 con «Cargar más»; semáforo y refresco de 15 segundos.
 */
export function SuperPedidos({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(TL, idioma);
  const te = enIdioma(T, idioma);
  const pref = usePreferencias('pedidos', { zona: '', estado: 'vivos', orden: '' });
  // Un enlace con ?zona= (desde Ciudades) manda en esta visita, sin cambiar lo guardado.
  const [zonaDeEnlace, setZonaDeEnlace] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('zona') || null,
  );
  const zona = zonaDeEnlace ?? pref.valores.zona ?? '';
  const filtro = (FILTROS_ESTADO_PEDIDO as readonly string[]).includes(pref.valores.estado ?? '')
    ? (pref.valores.estado as FiltroEstadoPedido)
    : 'vivos';
  const orden = pref.valores.orden ?? '';
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const r = setTimeout(() => setQ(texto.trim()), PAUSA_TEXTO_MS);
    return () => clearTimeout(r);
  }, [texto]);
  const [guardados, setDatos] = useState<(RespuestaLista & { clave: string }) | null>(null);
  const [error, setError] = useState('');
  const [cargandoMas, setCargandoMas] = useState(false);
  const primeraPagina = useRef(0);

  const consulta = useCallback(
    (despues?: string) => {
      const p = new URLSearchParams({ estado: filtro });
      if (zona) p.set('zona', zona);
      if (orden) p.set('orden', orden);
      if (q) p.set('q', q);
      if (despues) p.set('despues', despues);
      return `/datos/admin/pedidos?${p.toString()}`;
    },
    [filtro, zona, orden, q],
  );

  const clave = consulta();
  // Lo que se ve es de estos filtros: si cambiaron, se muestra «Cargando…» hasta que llegue.
  const datos = guardados?.clave === clave ? guardados : null;

  useEffect(() => {
    let vivo = true;
    const url = consulta();
    const cargar = (refresco: boolean) =>
      pedir<RespuestaLista>('GET', url)
        .then((r) => {
          if (!vivo) return;
          setError('');
          setDatos((antes) => {
            if (!refresco || !antes || antes.clave !== url) {
              primeraPagina.current = r.pedidos.length;
              return { ...r, clave: url };
            }
            // Refresco con más páginas cargadas: la primera se renueva y lo cargado después se queda.
            const nuevos = new Set(r.pedidos.map((x) => x.id));
            const resto = antes.pedidos
              .slice(primeraPagina.current)
              .filter((x) => !nuevos.has(x.id));
            primeraPagina.current = r.pedidos.length;
            return {
              ...r,
              clave: url,
              pedidos: [...r.pedidos, ...resto],
              siguiente: resto.length ? antes.siguiente : r.siguiente,
            };
          });
        })
        .catch((e: unknown) => vivo && setError(e instanceof ErrorApi ? e.message : String(e)));
    void cargar(false);
    const reloj = setInterval(() => void cargar(true), 15000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [consulta]);

  async function cargarMas() {
    if (!datos?.siguiente) return;
    setCargandoMas(true);
    try {
      const r = await pedir<RespuestaLista>('GET', consulta(datos.siguiente));
      setDatos((antes) => {
        const ya = new Set((antes?.pedidos ?? []).map((x) => x.id));
        return {
          ...r,
          clave,
          pedidos: [...(antes?.pedidos ?? []), ...r.pedidos.filter((x) => !ya.has(x.id))],
        };
      });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    } finally {
      setCargandoMas(false);
    }
  }

  const lista = datos?.pedidos;
  const rojos = lista?.filter((p) => VIVOS.has(p.estado) && p.luz === 'rojo').length ?? 0;
  const amarillos = lista?.filter((p) => VIVOS.has(p.estado) && p.luz === 'amarillo').length ?? 0;
  const encontrado = datos?.encontrado;
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      <div className="super-busqueda super-pedidos-filtros" role="search">
        <SelectorCiudad
          zona={zona}
          cambiar={(z) => {
            setZonaDeEnlace(null);
            pref.cambiar('zona', z);
          }}
          idioma={idioma}
        />
        <div className="super-filtros" role="group" aria-label={t.estado}>
          {FILTROS_ESTADO_PEDIDO.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              className={filtro === f ? 'activa' : undefined}
              onClick={() => pref.cambiar('estado', f)}
            >
              {new Map(Object.entries(t.estados)).get(f)}
            </button>
          ))}
        </div>
        <select
          value={orden}
          aria-label={t.orden}
          onChange={(e) => pref.cambiar('orden', e.target.value)}
        >
          {Object.entries(t.ordenes).map(([v, texto]) => (
            <option key={v} value={v}>
              {texto}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t.buscar}
          aria-label={t.buscar}
          maxLength={80}
        />
      </div>
      <AvisoFiltrosGuardados
        visible={pref.guardados}
        idioma={idioma}
        restablecer={() => {
          setZonaDeEnlace(null);
          pref.restablecer();
        }}
      />
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {datos?.porCodigo ? <p className="super-nota">{t.porCodigo}</p> : null}
      {encontrado &&
      (encontrado.cerrados || encontrado.vivos || encontrado.otrasCiudades.length) ? (
        <p className="super-nota" role="status">
          {[
            encontrado.cerrados ? t.encontradoCerrados : '',
            encontrado.vivos ? t.encontradoVivos : '',
            encontrado.otrasCiudades.length
              ? `${t.encontradoCiudad} ${encontrado.otrasCiudades.join(', ')}.`
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      ) : null}
      {datos?.masCoincidencias ? <p className="super-nota">{t.masCoincidencias}</p> : null}
      {datos?.avisoMonto ? <p className="super-nota">{t.avisoMonto}</p> : null}
      {!lista && !error ? <p>{t.cargando}</p> : null}
      {lista && (
        <p>
          <strong>
            {lista.length}
            {datos?.siguiente ? '+' : ''}
          </strong>
          {filtro !== 'cerrados' ? ` · ${rojos} ${t.rojos} · ${amarillos} ${t.amarillos}` : ''}
        </p>
      )}
      {lista?.length === 0 && <p>{q ? t.vacioBusqueda : t.vacio}</p>}
      <ul className="super-bandeja super-encurso">
        {lista?.map((p) => (
          <li key={p.id}>
            <Enlace a={`${base}/orders/${p.id}`}>
              <strong>
                <CodigoPedido id={p.id} /> · {p.restaurante} ·{' '}
                {formatearMonto(p.total, p.moneda ?? 'USD', idioma)}
              </strong>
              <span>
                {p.cliente ?? t.cuentaEliminada}
                {p.ciudad ? ` · ${p.ciudad}` : ''} ·{' '}
                {p.repartidor || p.repartidorCodigo ? (
                  <>
                    {p.repartidor ?? ''}
                    {p.repartidor && p.repartidorCodigo ? ' ' : ''}
                    {p.repartidorCodigo ? (
                      <span className="codigo-repartidor">({p.repartidorCodigo})</span>
                    ) : null}
                  </>
                ) : (
                  t.sinRepartidor
                )}{' '}
                · <time dateTime={p.creadoEn}>{fechaYHora(p.creadoEn, idioma)}</time>
              </span>
              {VIVOS.has(p.estado) ? (
                <span className="encurso-estado">
                  <span className={`bs-estado bs-${tonoEstado(p.estado)}`}>
                    {te.estados[p.estado] ?? p.estado}
                  </span>{' '}
                  <LuzSemaforo pedido={p} idioma={idioma} />
                </span>
              ) : (
                <span className="encurso-estado">
                  <span className={`bs-estado bs-${tonoEstado(p.estado)}`}>
                    {te.estados[p.estado] ?? p.estado}
                  </span>
                </span>
              )}
            </Enlace>
          </li>
        ))}
      </ul>
      {datos?.siguiente ? (
        <button
          type="button"
          className="boton secundario"
          onClick={() => void cargarMas()}
          disabled={cargandoMas}
        >
          {cargandoMas ? t.cargando : t.mas}
        </button>
      ) : null}
    </section>
  );
}
