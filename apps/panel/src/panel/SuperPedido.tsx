import { SolicitudCancelacion } from './SolicitudCancelacion';
import { ResolverAutorizacion } from './ResolverAutorizacion';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Detenido,
  textoDetenido,
  ErrorApi,
  FILTROS_ESTADO_PEDIDO,
  type FiltroEstadoPedido,
  type Idioma,
  LETRAS_CODIGO_APPS,
  codigoCorto,
  enIdioma,
  formatearMonto,
  textoAMonto,
  type Tramo,
  type ServicioMonitoreo,
  esServicioMonitoreo,
  nombreServicioMonitoreo,
  ESTADO_CANCELADA,
  interpretarBusqueda,
  quisoDecirCodigo,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { RastreoVivo } from './RastreoVivo';
import { textoPendiente } from './SuperAprobaciones';
import { LuzSemaforo, haceTanto } from './LuzSemaforo';
import { SelectorCiudad } from './SuperFichas';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { nombreEstado, tonoEstado } from './BuscadorSuper';
import { usePreferencias } from './usePreferencias';
import { PAUSA_TECLAS_MS, crearMemoria } from './memoriaBusqueda';
import { Hora, useHora } from './horario';
import {
  FotoEvidencia,
  IconoServicio,
  LineaTiempo,
  MapaFicha,
  type Paso,
  type PuntoFicha,
  TarjetaTiempos,
  metrosEntre,
  textoMetros,
} from './FichaPiezas';

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

/** Textos nuevos de la ficha (C-FICHA-OPERACION). */
const TF = {
  es: {
    servicio: 'Servicio',
    creado: 'Creado',
    dondeCompro: 'Dónde compró',
    dondeEntrego: 'Dónde entregó',
    fotoRecogida: 'Foto de la recogida',
    fotoEntrega: 'Foto de la entrega',
    tomada: 'Tomada',
    confirmo: 'Confirmó',
    confirmada: 'Confirmada',
    aDistancia: 'a {d} del restaurante',
    aDistanciaCasa: 'a {d} de la dirección',
    modo: 'Cómo se entregó',
    nota: 'Nota',
    seGuarda: 'Se guarda 30 días (hasta el {f}).',
    retenida: 'Se guarda mientras el reclamo siga abierto.',
    borrada: 'Foto borrada por retención ({f}).',
    sinFotoMano: 'Sin foto: entrega en mano.',
    sinFotoLocal: 'Sin foto: el cliente lo recogió en el local.',
    sinFoto: 'Sin foto todavía.',
    todaviaNo: 'Todavía no se recoge.',
    todaviaNoEntrega: 'Todavía no se entrega.',
    modos: {
      puerta: 'En la puerta',
      mano: 'En mano',
      seguro: 'En un lugar seguro',
      ausente: 'Cliente ausente: dejado con nota',
      local: 'Recogido en el local',
    } as Record<string, string>,
    roles: {
      restaurante: 'el restaurante',
      repartidor: 'el repartidor',
      cliente: 'el cliente',
      soporte: 'soporte',
      sistema: 'el sistema',
    } as Record<string, string>,
    cierre: 'Cierre',
    entregadoPor: 'Entregado por',
    canceladoPor: 'Cancelado por',
    motivo: 'Motivo',
    abierto: 'El pedido sigue abierto.',
    cobro: 'Cobro',
    metodos: {
      tarjeta: 'Tarjeta (Stripe)',
      efectivo: 'Efectivo al repartidor',
      transferencia_repartidor: 'Transferencia al repartidor',
    } as Record<string, string>,
    estadosCobro: {
      no_aplica: 'Cobrado con tarjeta',
      pendiente: 'Pendiente de confirmar',
      confirmado: 'Confirmado',
      parcial: 'Pagó una parte',
      no_pagado: 'No pagó',
    } as Record<string, string>,
    recibido: 'Recibido',
    distancias: 'Distancias',
    restCasa: 'Del restaurante a la casa',
    mapa: 'Restaurante, fotos y dirección en el mapa',
    reclamos: 'Reclamos y tickets',
    sinReclamos: 'Este pedido no tiene reclamos.',
    personas: 'Personas',
    cuentaEliminada: 'Cuenta eliminada',
    detalle: 'Detalle del pedido',
    estadosTicket: { abierto: 'Abierto', respondido: 'Respondido', cerrado: 'Cerrado' } as Record<
      string,
      string
    >,
  },
  en: {
    servicio: 'Service',
    creado: 'Created',
    dondeCompro: 'Where it was picked up',
    dondeEntrego: 'Where it was delivered',
    fotoRecogida: 'Pickup photo',
    fotoEntrega: 'Delivery photo',
    tomada: 'Taken',
    confirmo: 'Confirmed by',
    confirmada: 'Confirmed',
    aDistancia: '{d} from the restaurant',
    aDistanciaCasa: '{d} from the address',
    modo: 'How it was delivered',
    nota: 'Note',
    seGuarda: 'Kept for 30 days (until {f}).',
    retenida: 'Kept while the claim stays open.',
    borrada: 'Photo deleted by the retention rule ({f}).',
    sinFotoMano: 'No photo: handed to the customer.',
    sinFotoLocal: 'No photo: the customer picked it up at the store.',
    sinFoto: 'No photo yet.',
    todaviaNo: 'Not picked up yet.',
    todaviaNoEntrega: 'Not delivered yet.',
    modos: {
      puerta: 'At the door',
      mano: 'Hand to customer',
      seguro: 'In a safe place',
      ausente: 'Customer absent: left with a note',
      local: 'Picked up at the store',
    } as Record<string, string>,
    roles: {
      restaurante: 'the restaurant',
      repartidor: 'the driver',
      cliente: 'the customer',
      soporte: 'support',
      sistema: 'the system',
    } as Record<string, string>,
    cierre: 'Closing',
    entregadoPor: 'Delivered by',
    canceladoPor: 'Canceled by',
    motivo: 'Reason',
    abierto: 'The order is still open.',
    cobro: 'Payment',
    metodos: {
      tarjeta: 'Card (Stripe)',
      efectivo: 'Cash to the driver',
      transferencia_repartidor: 'Transfer to the driver',
    } as Record<string, string>,
    estadosCobro: {
      no_aplica: 'Charged to the card',
      pendiente: 'Waiting for confirmation',
      confirmado: 'Confirmed',
      parcial: 'Paid in part',
      no_pagado: 'Not paid',
    } as Record<string, string>,
    recibido: 'Received',
    distancias: 'Distances',
    restCasa: 'Restaurant to the home',
    mapa: 'Restaurant, photos, and address on the map',
    reclamos: 'Claims and tickets',
    sinReclamos: 'This order has no claims.',
    personas: 'People',
    cuentaEliminada: 'Deleted account',
    detalle: 'Order details',
    estadosTicket: { abierto: 'Open', respondido: 'Replied', cerrado: 'Closed' } as Record<
      string,
      string
    >,
  },
};

/** Lo que se lee en la línea de tiempo de un pedido (estados, hitos, fotos y el Manager). */
export const EVENTOS_PEDIDO = {
  es: {
    repartidor_acepto: 'El repartidor aceptó la oferta',
    llego_restaurante: 'El repartidor llegó al restaurante',
    verificado: 'Código del pedido verificado en el restaurante',
    foto_recogida: 'Foto de la recogida',
    recogida_confirmada: 'Recogida confirmada',
    casi_llega: 'El repartidor está por llegar',
    llego_cliente: 'El repartidor llegó a la dirección',
    espera_evitable: 'El repartidor esperó en el restaurante',
    no_aparece: 'El cliente no aparece',
    foto_entrega: 'Foto de la entrega',
    entrega_sin_foto: 'Entregado sin foto (en mano)',
    entrega_en_local: 'El cliente lo recogió en el local',
    reclamo_abierto: 'Se abrió un reclamo',
    agrupado: 'Agrupado con otro pedido del mismo restaurante',
    pago_pico: 'Pago extra por hora pico',
    oferta_abierta: 'Ofrecido a todos con bono',
    plato_agotado: 'Un plato se agotó',
    tiempo_ajustado: 'El restaurante ajustó el tiempo',
    cliente_ausente: 'Cliente ausente: dejado con nota',
    cliente_no_aparece: 'El repartidor avisó que el cliente no aparece',
    repartidor_solto: 'El repartidor soltó el pedido',
    foto_ticket: 'Foto del ticket del local',
    gps_simulado: 'GPS simulado detectado (no se contó)',
    autorizacion_por_vencer: 'Aviso: la autorización de la tarjeta está por vencer',
    autorizacion_cobrada:
      'Soporte volvió a cobrar con la tarjeta guardada (la autorización venció)',
    autorizacion_sin_cobro: 'Soporte lo cerró sin cobro (la autorización venció)',
    cobro_reautorizado: 'La tarjeta se volvió a autorizar con un pago nuevo',
    recobro_en_curso: 'El banco está procesando el cobro de reemplazo',
    recobro_intento: 'Un intento de volver a cobrar no se completó',
  },
  en: {
    repartidor_acepto: 'The driver accepted the offer',
    llego_restaurante: 'The driver arrived at the restaurant',
    verificado: 'Order code verified at the restaurant',
    foto_recogida: 'Pickup photo',
    recogida_confirmada: 'Pickup confirmed',
    casi_llega: 'The driver is almost there',
    llego_cliente: 'The driver arrived at the address',
    espera_evitable: 'The driver waited at the restaurant',
    no_aparece: 'The customer doesn’t show up',
    foto_entrega: 'Delivery photo',
    entrega_sin_foto: 'Delivered without a photo (by hand)',
    entrega_en_local: 'The customer picked it up at the store',
    reclamo_abierto: 'A claim was opened',
    agrupado: 'Batched with another order from the same restaurant',
    pago_pico: 'Peak pay',
    oferta_abierta: 'Offered to everyone with a bonus',
    plato_agotado: 'An item ran out',
    tiempo_ajustado: 'The restaurant adjusted the time',
    cliente_ausente: 'Customer absent: left with a note',
    cliente_no_aparece: 'The driver reported the customer doesn’t show up',
    repartidor_solto: 'The driver released the order',
    foto_ticket: 'Photo of the store receipt',
    gps_simulado: 'Simulated GPS detected (not counted)',
    autorizacion_por_vencer: 'Alert: the card authorization is about to expire',
    autorizacion_cobrada: 'Support charged the saved card again (the authorization expired)',
    autorizacion_sin_cobro: 'Support closed it without charging (the authorization expired)',
    cobro_reautorizado: 'The card was authorized again with a new payment',
    recobro_en_curso: 'The bank is processing the replacement charge',
    recobro_intento: 'An attempt to charge again didn’t go through',
  },
};

type Evidencia = {
  tipo: 'recogida' | 'entrega';
  conFoto: boolean;
  creadaEn: string | null;
  confirmadaEn: string | null;
  confirmadaPor: { nombre: string | null; rol: string | null } | null;
  modo: string | null;
  nota: string;
  distanciaM: number | null;
  lugar: { lat: number; lng: number } | null;
  borradaEn: string | null;
  seGuardaHasta: string | null;
  retenidaPorReclamo: boolean;
  foto: string | null;
};

type Pedido = {
  /** C-MONEDA-RECORRIDO: la moneda del pedido. */
  moneda?: string;
  id: string;
  estado: string;
  vivo?: boolean;
  servicio?: string;
  total: number;
  propina: number;
  direccion: string;
  notas: string;
  ciudad: string | null;
  zonaHoraria?: string | null;
  pais?: string | null;
  creadoEn?: string;
  metodoPago?: string;
  pagoStripe: string | null;
  lineas: { nombre: string; cantidad: number }[];
  cliente: { id: string; nombre: string | null };
  restaurante: {
    id: string;
    nombre: string;
    direccion?: string;
    lugar?: { lat: number; lng: number } | null;
  };
  repartidor: { id: string; nombre: string | null; codigo: string | null } | null;
  entregaLugar?: { lat: number; lng: number } | null;
  distanciaKm?: number | null;
  recogida?: Evidencia | null;
  entrega?: Evidencia | null;
  tiempos?: Tramo[];
  linea?: Paso[];
  cierre?: {
    tipo: 'entregado' | 'cancelado';
    en: string | null;
    por: { nombre: string | null; rol: string | null } | null;
    motivo?: string | null;
  } | null;
  cobro?: {
    metodo: string;
    estado: string;
    montoRecibido: number | null;
    confirmadoEn: string | null;
    confirmadoPor: string | null;
  };
  tickets?: { id: string; asunto: string; estado: string; creadoEn: string }[];
  /** C-AUTORIZACION-VENCIDA: el cobro de la entrega (capturada, en revisión, sin cobro…). */
  liquidacion?: { estado: string; error: string | null } | null;
  excepcionUbicacion: {
    motivo: string;
    pedidaEn: string;
    autorizadaEn: string | null;
    autorizadaPor: string | null;
  } | null;
};

/** Una tarjeta «Dónde compró» o «Dónde entregó»: lugar, foto borrosa, hora, quién y distancia. */
function TarjetaLugar({
  titulo,
  lugar,
  evidencia,
  tipo,
  zona,
  idioma,
  estado,
}: {
  titulo: string;
  lugar: string;
  evidencia: Evidencia | null | undefined;
  tipo: 'recogida' | 'entrega';
  zona: string | null;
  idioma: Idioma;
  estado: string;
}) {
  const t = enIdioma(TF, idioma);
  const h = useHora(idioma);
  const modos = new Map(Object.entries(t.modos));
  const roles = new Map(Object.entries(t.roles));
  const e = evidencia;
  const sinFoto = () => {
    if (!e) return tipo === 'recogida' ? t.todaviaNo : t.todaviaNoEntrega;
    if (e.borradaEn) return t.borrada.replace('{f}', h.fecha(e.borradaEn, zona, 'fecha'));
    if (e.modo === 'mano') return t.sinFotoMano;
    if (e.modo === 'local') return t.sinFotoLocal;
    return t.sinFoto;
  };
  const yaPaso =
    tipo === 'recogida' ? ['en_camino', 'entregado'].includes(estado) : estado === 'entregado';
  return (
    <section className="tarjeta-form ficha-lugar">
      <h2>{titulo}</h2>
      <p className="ficha-lugar-direccion">{lugar}</p>
      {e?.conFoto && e.foto ? (
        <FotoEvidencia
          url={e.foto}
          alt={tipo === 'recogida' ? t.fotoRecogida : t.fotoEntrega}
          idioma={idioma}
        />
      ) : (
        <p className={e?.modo === 'mano' || e?.modo === 'local' ? 'ficha-nota' : 'ficha-nota'}>
          {e || yaPaso ? sinFoto() : tipo === 'recogida' ? t.todaviaNo : t.todaviaNoEntrega}
        </p>
      )}
      {e ? (
        <dl className="super-dl ficha-dl">
          {e.creadaEn ? (
            <>
              <dt>{t.tomada}</dt>
              <dd>
                <Hora fecha={e.creadaEn} zona={zona} idioma={idioma} />
                {e.distanciaM != null
                  ? ` · ${(tipo === 'recogida' ? t.aDistancia : t.aDistanciaCasa).replace('{d}', textoMetros(e.distanciaM, idioma))}`
                  : ''}
              </dd>
            </>
          ) : null}
          {e.confirmadaEn ? (
            <>
              <dt>{t.confirmada}</dt>
              <dd>
                <Hora fecha={e.confirmadaEn} zona={zona} idioma={idioma} />
                {e.confirmadaPor
                  ? ` · ${t.confirmo.toLowerCase()} ${[
                      e.confirmadaPor.nombre,
                      e.confirmadaPor.rol
                        ? `(${roles.get(e.confirmadaPor.rol) ?? e.confirmadaPor.rol})`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}`
                  : ''}
              </dd>
            </>
          ) : null}
          {tipo === 'entrega' && e.modo ? (
            <>
              <dt>{t.modo}</dt>
              <dd>{modos.get(e.modo) ?? e.modo}</dd>
            </>
          ) : null}
          {e.nota ? (
            <>
              <dt>{t.nota}</dt>
              <dd>{e.nota}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {e?.conFoto ? (
        <p className="ficha-nota">
          {e.retenidaPorReclamo
            ? t.retenida
            : e.seGuardaHasta
              ? t.seGuarda.replace('{f}', h.fecha(e.seGuardaHasta, zona, 'fecha'))
              : ''}
        </p>
      ) : null}
    </section>
  );
}

export function SuperPedido({ base, id, idioma }: { base: string; id: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const tf = enIdioma(TF, idioma);
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
  const zona = p.zonaHoraria ?? null;
  const eventos = { ...t.eventos, ...enIdioma(EVENTOS_PEDIDO, idioma) };
  const roles = new Map(Object.entries(tf.roles));
  const metodos = new Map(Object.entries(tf.metodos));
  const estadosCobro = new Map(Object.entries(tf.estadosCobro));
  const estadosTicket = new Map(Object.entries(tf.estadosTicket));
  const puntos: PuntoFicha[] = [
    p.restaurante.lugar
      ? { id: 'rest', ...p.restaurante.lugar, color: '#101010', etiqueta: p.restaurante.nombre }
      : null,
    p.recogida?.lugar
      ? { id: 'foto-r', ...p.recogida.lugar, color: '#666b73', etiqueta: tf.fotoRecogida }
      : null,
    p.entrega?.lugar
      ? { id: 'foto-e', ...p.entrega.lugar, color: '#0d7a3a', etiqueta: tf.fotoEntrega }
      : null,
    p.entregaLugar
      ? { id: 'casa', ...p.entregaLugar, color: '#f20d20', etiqueta: p.direccion }
      : null,
  ].filter((x): x is PuntoFicha => x !== null);
  const restCasa = metrosEntre(p.restaurante.lugar, p.entregaLugar);
  const quien = (x: { nombre: string | null; rol: string | null } | null | undefined) =>
    x ? [x.nombre, x.rol ? `(${roles.get(x.rol) ?? x.rol})` : ''].filter(Boolean).join(' ') : '—';
  return (
    <section className="super ficha-op">
      <button type="button" className="enlace docs-volver" onClick={() => window.history.back()}>
        {t.volver}
      </button>
      <header className="ficha-cabecera">
        <h1>
          {t.pedido} <CodigoPedido id={p.id} />
        </h1>
        <div className="ficha-chips">
          <IconoServicio servicio={p.servicio ?? 'comida'} idioma={idioma} conTexto />
          <span className={`bs-estado bs-${tonoEstado(p.estado)}`}>
            {t.estados[p.estado] ?? p.estado}
          </span>
          <strong>{dinero(p.total)}</strong>
          {p.ciudad ? <span>{p.ciudad}</span> : null}
          {p.creadoEn ? (
            <span>
              {tf.creado} <Hora fecha={p.creadoEn} zona={zona} idioma={idioma} />
            </span>
          ) : null}
        </div>
      </header>
      {/* C-RASTREO-VIVO: el repartidor en el mapa, la hora de llegada y si está detenido. */}
      <RastreoVivo
        tipo="pedido"
        id={p.id}
        idioma={idioma}
        zona={zona}
        pais={p.pais}
        fijos={puntos.filter((x) => x.id === 'rest' || x.id === 'casa')}
        vivo={Boolean(p.vivo) && p.repartidor != null}
      />
      {p.tiempos?.length ? <TarjetaTiempos tiempos={p.tiempos} idioma={idioma} /> : null}
      {p.linea?.length ? (
        <LineaTiempo
          pasos={p.linea}
          idioma={idioma}
          zona={zona}
          eventos={eventos}
          cuentaEliminada={tf.cuentaEliminada}
        />
      ) : null}
      <div className="ficha-dos">
        <TarjetaLugar
          titulo={tf.dondeCompro}
          lugar={[p.restaurante.nombre, p.restaurante.direccion].filter(Boolean).join(' · ')}
          evidencia={p.recogida}
          tipo="recogida"
          zona={zona}
          idioma={idioma}
          estado={p.estado}
        />
        <TarjetaLugar
          titulo={tf.dondeEntrego}
          lugar={p.direccion}
          evidencia={p.entrega}
          tipo="entrega"
          zona={zona}
          idioma={idioma}
          estado={p.estado}
        />
      </div>
      <section className="tarjeta-form ficha-distancias">
        <h2>{tf.distancias}</h2>
        <ul className="ficha-lista-simple">
          <li>
            {tf.restCasa}: <strong>{textoMetros(restCasa, idioma)}</strong>
          </li>
          {p.recogida?.distanciaM != null ? (
            <li>
              {tf.fotoRecogida}:{' '}
              <strong>
                {tf.aDistancia.replace('{d}', textoMetros(p.recogida.distanciaM, idioma))}
              </strong>
            </li>
          ) : null}
          {p.entrega?.distanciaM != null ? (
            <li>
              {tf.fotoEntrega}:{' '}
              <strong>
                {tf.aDistanciaCasa.replace('{d}', textoMetros(p.entrega.distanciaM, idioma))}
              </strong>
            </li>
          ) : null}
        </ul>
        <MapaFicha puntos={puntos} idioma={idioma} etiqueta={tf.mapa} />
      </section>
      <div className="ficha-dos">
        <section className="tarjeta-form ficha-cierre">
          <h2>{tf.cierre}</h2>
          {p.cierre ? (
            <dl className="super-dl">
              <dt>{p.cierre.tipo === 'entregado' ? tf.entregadoPor : tf.canceladoPor}</dt>
              <dd>
                {quien(p.cierre.por)}
                {p.cierre.en ? (
                  <>
                    {' · '}
                    <Hora fecha={p.cierre.en} zona={zona} idioma={idioma} />
                  </>
                ) : null}
              </dd>
              {p.cierre.motivo ? (
                <>
                  <dt>{tf.motivo}</dt>
                  <dd>
                    {new Map<string, string>(Object.entries(eventos)).get(p.cierre.motivo) ??
                      p.cierre.motivo}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="ficha-nota">{tf.abierto}</p>
          )}
          {p.cobro ? (
            <>
              <h3>{tf.cobro}</h3>
              <dl className="super-dl">
                <dt>{t.total}</dt>
                <dd>
                  {dinero(p.total)} ({t.propina} {dinero(p.propina)})
                </dd>
                <dt>{tf.cobro}</dt>
                <dd>
                  {metodos.get(p.cobro.metodo) ?? p.cobro.metodo} ·{' '}
                  {estadosCobro.get(p.cobro.estado) ?? p.cobro.estado}
                </dd>
                {p.cobro.montoRecibido != null ? (
                  <>
                    <dt>{tf.recibido}</dt>
                    <dd>
                      {dinero(p.cobro.montoRecibido)}
                      {p.cobro.confirmadoEn ? (
                        <>
                          {' · '}
                          <Hora fecha={p.cobro.confirmadoEn} zona={zona} idioma={idioma} />
                        </>
                      ) : null}
                    </dd>
                  </>
                ) : null}
                <dt>{t.pago}</dt>
                <dd className="super-id">{p.pagoStripe ?? '—'}</dd>
              </dl>
            </>
          ) : null}
        </section>
        <section className="tarjeta-form">
          <h2>{tf.personas}</h2>
          <dl className="super-dl">
            <dt>{t.cliente}</dt>
            <dd>
              <Enlace a={`${base}/customers/${p.cliente.id}`}>
                {p.cliente.nombre ?? tf.cuentaEliminada}
              </Enlace>
            </dd>
            <dt>{t.restaurante}</dt>
            <dd>
              <Enlace a={`${base}/restaurants/${p.restaurante.id}`}>{p.restaurante.nombre}</Enlace>
            </dd>
            <dt>{t.repartidor}</dt>
            <dd>
              {p.repartidor ? (
                <Enlace a={`${base}/drivers/${p.repartidor.id}`}>
                  {p.repartidor.codigo ?? ''} {p.repartidor.nombre ?? ''}
                </Enlace>
              ) : (
                t.sinRepartidor
              )}
            </dd>
            <dt>{t.ciudad}</dt>
            <dd>{p.ciudad ?? '—'}</dd>
            {p.notas ? (
              <>
                <dt>{t.notas}</dt>
                <dd>{p.notas}</dd>
              </>
            ) : null}
          </dl>
          <h3>{tf.detalle}</h3>
          <ul className="super-lista">
            {p.lineas.map((l, i) => (
              <li key={i}>
                {l.cantidad} × {l.nombre}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {p.liquidacion?.estado === 'revision' ? (
        <ResolverAutorizacion
          pedidoId={id}
          zona={zona}
          idioma={idioma}
          alResolver={() => void cargar()}
        />
      ) : null}
      {/* C-CANCELAR-LISTO: la cancelación que pidió el restaurante, para aprobar o rechazar. */}
      <SolicitudCancelacion pedidoId={id} idioma={idioma} alResolver={() => void cargar()} />
      {p.estado === 'entregado' || vivo || p.excepcionUbicacion ? (
        <section className="tarjeta-form">
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
                {t.pedidaEn}:{' '}
                <Hora fecha={p.excepcionUbicacion.pedidaEn} zona={zona} idioma={idioma} />
              </p>
              {p.excepcionUbicacion.autorizadaEn ? (
                <p className="ok">
                  {t.autorizada} {p.excepcionUbicacion.autorizadaPor} ·{' '}
                  <Hora fecha={p.excepcionUbicacion.autorizadaEn} zona={zona} idioma={idioma} />
                </p>
              ) : (
                <button type="button" className="boton" onClick={() => void autorizar()}>
                  {t.autorizar}
                </button>
              )}
              {aviso && !vivo && p.estado !== 'entregado' && (
                <p className="ok" role="status">
                  {aviso}
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="tarjeta-form">
        <h2>{tf.reclamos}</h2>
        {p.tickets?.length ? (
          <ul className="ficha-lista-simple">
            {p.tickets.map((x) => (
              <li key={x.id}>
                <Enlace a={`${base}/tickets/${x.id}`}>{x.asunto}</Enlace> ·{' '}
                <span className={`bs-estado bs-${x.estado === 'cerrado' ? 'exito' : 'vivo'}`}>
                  {estadosTicket.get(x.estado) ?? x.estado}
                </span>{' '}
                · <Hora fecha={x.creadoEn} zona={zona} idioma={idioma} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="ficha-nota">{tf.sinReclamos}</p>
        )}
      </section>
    </section>
  );
}

const TL = {
  es: {
    titulo: 'Pedidos en curso',
    ayuda:
      'Pedidos de comida y de tiendas, viajes en auto y en moto, de la ciudad, el estado y el servicio que elijas, los que están en problemas primero. Se actualiza solo cada 15 segundos.',
    vacio: 'No hay nada con estos filtros.',
    vacioBusqueda: 'No encontramos pedidos ni viajes con eso.',
    noEncontramos: (q: string) => `No encontramos pedidos ni viajes con «${q}».`,
    quisoDecir: '¿Quisiste decir',
    pistaCodigo:
      'El código se busca desde la primera letra, en todos los estados, ciudades y servicios.',
    totalCodigo: (n: string, q: string) =>
      `${n} ${n === '1' ? 'pedido o viaje empieza' : 'pedidos y viajes empiezan'} por «${q}»: los que están en curso arriba, después del más reciente al más viejo.`,
    estado: 'Estado',
    estados: { vivos: 'Vivos', cerrados: 'Cerrados', todos: 'Todos' } as Record<string, string>,
    servicio: 'Servicio',
    orden: 'Orden',
    ordenes: {
      '': 'Lo que necesita atención primero',
      recientes: 'Más recientes primero',
      antiguos: 'Más antiguos primero',
    } as Record<string, string>,
    buscar: 'Código, nombre, teléfono o monto',
    rojos: 'en problemas',
    amarillos: 'atrasándose',
    vivosCorto: 'vivos',
    sinRepartidor: 'Sin repartidor',
    sinConductor: 'Sin conductor',
    cuentaEliminada: 'Cuenta eliminada',
    mas: 'Cargar más',
    cargando: 'Cargando…',
    encontradoCerrados: 'Encontrado entre los cerrados.',
    encontradoVivos: 'Encontrado entre los vivos.',
    encontradoCiudad: 'Encontrado en otra ciudad:',
    porCodigo:
      'Buscado por código en todos los estados, ciudades y servicios, el más reciente primero.',
    masCoincidencias: 'Hay más pedidos que empiezan así: escribe más letras del código.',
    avisoMonto: 'Los montos se buscan solo en los últimos 30 días.',
    soloPedidos:
      'Los nombres, teléfonos y montos se buscan en los pedidos; los viajes, por su código.',
    emergencia: 'Emergencia abierta',
    luzViaje: { verde: 'A tiempo', amarillo: 'Atrasándose', rojo: 'En problemas' } as Record<
      string,
      string
    >,
    motivosViaje: {
      buscando: 'buscando conductor',
      llegada: 'el conductor tarda en llegar',
      pasajero: 'el pasajero no ha salido',
      recorrido: 'el viaje está tardando',
      emergencia: 'emergencia abierta',
    } as Record<string, string>,
    hace: 'hace',
    min: 'min',
  },
  en: {
    titulo: 'Live orders',
    ayuda:
      'Food and store orders, car and moto rides, for the city, status, and service you choose, the ones in trouble first. Refreshes every 15 seconds.',
    vacio: 'Nothing matches these filters.',
    vacioBusqueda: 'No orders or rides match that.',
    noEncontramos: (q: string) => `We couldn't find orders or rides for "${q}".`,
    quisoDecir: 'Did you mean',
    pistaCodigo:
      'Codes are searched from the first character, across every status, city, and service.',
    totalCodigo: (n: string, q: string) =>
      `${n} ${n === '1' ? 'order or ride starts' : 'orders and rides start'} with "${q}": live ones on top, then newest to oldest.`,
    estado: 'Status',
    estados: { vivos: 'Live', cerrados: 'Closed', todos: 'All' } as Record<string, string>,
    servicio: 'Service',
    orden: 'Sort',
    ordenes: {
      '': 'Needs attention first',
      recientes: 'Newest first',
      antiguos: 'Oldest first',
    } as Record<string, string>,
    buscar: 'Code, name, phone, or amount',
    rojos: 'in trouble',
    amarillos: 'running late',
    vivosCorto: 'live',
    sinRepartidor: 'No driver',
    sinConductor: 'No driver',
    cuentaEliminada: 'Deleted account',
    mas: 'Load more',
    cargando: 'Loading…',
    encontradoCerrados: 'Found among closed orders.',
    encontradoVivos: 'Found among live orders.',
    encontradoCiudad: 'Found in another city:',
    porCodigo: 'Searched by code across every status, city, and service, newest first.',
    masCoincidencias: 'More orders start like this: type more of the code.',
    avisoMonto: 'Amounts are searched in the last 30 days only.',
    soloPedidos: 'Names, phones, and amounts are searched in orders; rides, by their code.',
    emergencia: 'Open emergency',
    luzViaje: { verde: 'On time', amarillo: 'Running late', rojo: 'In trouble' } as Record<
      string,
      string
    >,
    motivosViaje: {
      buscando: 'finding a driver',
      llegada: 'the driver is taking long to arrive',
      pasajero: 'the rider hasn’t come out',
      recorrido: 'the trip is taking long',
      emergencia: 'open emergency',
    } as Record<string, string>,
    hace: '',
    min: 'min ago',
  },
};

/** C-RASTREO-VIVO: la marca de la fila cuando el repartidor o conductor no avanza o no da señal. */
function MarcaDetenido({ d, idioma }: { d: Detenido; idioma: Idioma }) {
  return (
    <>
      {' '}
      <span className="bs-estado bs-problema" data-testid="fila-detenido">
        {textoDetenido(d, idioma === 'en' ? 'en' : 'es')}
      </span>
    </>
  );
}

type FilaPedido = Parameters<typeof LuzSemaforo>[0]['pedido'] & {
  id: string;
  tipo?: 'pedido';
  servicio?: string;
  total: number;
  moneda?: string;
  restaurante: string;
  cliente: string | null;
  repartidor?: string | null;
  repartidorCodigo: string | null;
  ciudad: string | null;
  zonaId?: string | null;
  zonaHoraria?: string | null;
  luz: 'verde' | 'amarillo' | 'rojo';
  /** C-RASTREO-VIVO: detenido o sin señal (lo marca el servidor, solo lectura). */
  detenido?: Detenido | null;
};
type FilaViaje = {
  id: string;
  tipo: 'viaje';
  servicio: string;
  estado: string;
  creadoEn: string;
  total: number;
  moneda: string;
  origen: string;
  destino: string;
  pasajero: string | null;
  conductor: string | null;
  conductorCodigo: string | null;
  ciudad: string | null;
  zonaHoraria: string | null;
  emergencia: boolean;
  luz: 'verde' | 'amarillo' | 'rojo';
  semaforo: { luz: string; minutos: number; motivo: string } | null;
  detenido?: Detenido | null;
};
type Fila = FilaPedido | FilaViaje;
type RespuestaLista = {
  pedidos: Fila[];
  siguiente?: string | null;
  porCodigo?: boolean;
  /** C-BUSCADOR-INSTANTANEO: cuántos empiezan así (pedidos y viajes), con tope. */
  total?: number | null;
  totalMas?: boolean;
  masCoincidencias?: boolean;
  encontrado?: { cerrados: boolean; vivos: boolean; otrasCiudades: string[] } | null;
  avisoMonto?: boolean;
};
type Contadores = {
  contadores: Record<string, { vivos: number; problemas: number }>;
  limitado: boolean;
  hayEnvios: boolean;
};

const VIVOS = new Set(['pagado', 'aceptado', 'listo', 'en_camino']);
const VIVOS_VIAJE = new Set(['buscando', 'asignado', 'conductor_llego', 'en_curso']);
const PAUSA_TEXTO_MS = PAUSA_TECLAS_MS;
/** C-BUSCADOR-INSTANTANEO: la primera página de cada búsqueda, en la memoria de esta pestaña. */
const MEMORIA_LISTA = crearMemoria<RespuestaLista>();
const PESTANAS: ServicioMonitoreo[] = ['todos', 'comida', 'tiendas', 'auto', 'moto', 'envios'];
const esViaje = (f: Fila): f is FilaViaje => f.tipo === 'viaje';

/**
 * El código del pedido: 6 letras, las 4 primeras (las que muestran las apps) en negrita, y lo que
 * coincidió con lo buscado subrayado (C-BUSCADOR-INSTANTANEO).
 */
function CodigoPedido({ id, buscado = '' }: { id: string; buscado?: string }) {
  const c = codigoCorto(id);
  const largo = Math.min(buscado.length, c.length);
  const coincide = largo > 0 && c.startsWith(buscado.toUpperCase().slice(0, largo)) ? largo : 0;
  const tramo = (desde: number, hasta: number) => {
    const corte = Math.min(Math.max(coincide, desde), hasta);
    return (
      <>
        {corte > desde ? <mark>{c.slice(desde, corte)}</mark> : null}
        {c.slice(corte, hasta)}
      </>
    );
  };
  return (
    <span className="codigo-pedido">
      #<b>{tramo(0, LETRAS_CODIGO_APPS)}</b>
      {tramo(LETRAS_CODIGO_APPS, c.length)}
    </span>
  );
}

/** El semáforo de un viaje (C-MONITOREO-SERVICIOS), con el mismo dibujo que el de los pedidos. */
function LuzViaje({ v, idioma }: { v: FilaViaje; idioma: Idioma }) {
  const t = enIdioma(TL, idioma);
  const s = v.semaforo;
  if (!s) return null;
  const luz = new Map(Object.entries(t.luzViaje)).get(s.luz);
  const motivo = new Map(Object.entries(t.motivosViaje)).get(s.motivo);
  return (
    <span className={`semaforo semaforo-${s.luz}`} role="status">
      <span className="semaforo-punto" aria-hidden="true" />
      <span>
        {luz} · {haceTanto(s.minutos, idioma)}
        {s.luz === 'verde' ? '' : ` · ${motivo}`}
      </span>
    </span>
  );
}

/** La pestaña de servicio que trae la dirección (?servicio=moto), si es válida. */
function servicioDeDireccion(): ServicioMonitoreo | null {
  const v = new URLSearchParams(window.location.search).get('servicio');
  return esServicioMonitoreo(v) ? v : null;
}

/**
 * «Pedidos en curso» del superadmin (C-MANAGER-1, C-BUSCADOR-SERIO, C-FILTROS-GUARDADOS,
 * C-MONITOREO-SERVICIOS): pestañas por servicio con su contador de vivos y en problemas (guardadas
 * por empleado y en la dirección), estado Vivos · Cerrados · Todos, ciudad y orden guardados; lo
 * escrito se busca con la misma pieza que el buscador de arriba; pedidos y viajes en la misma lista,
 * de a 50 con «Cargar más»; semáforo y refresco de 15 segundos.
 */
export function SuperPedidos({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(TL, idioma);
  const te = enIdioma(T, idioma);
  const pref = usePreferencias('pedidos', {
    zona: '',
    estado: 'vivos',
    orden: '',
    servicio: 'todos',
  });
  // Un enlace con ?zona= (desde Ciudades) manda en esta visita, sin cambiar lo guardado.
  const [zonaDeEnlace, setZonaDeEnlace] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('zona') || null,
  );
  const [servicioDeEnlace, setServicioDeEnlace] = useState<ServicioMonitoreo | null>(
    servicioDeDireccion,
  );
  const zona = zonaDeEnlace ?? pref.valores.zona ?? '';
  const servicio: ServicioMonitoreo =
    servicioDeEnlace ??
    (esServicioMonitoreo(pref.valores.servicio) ? pref.valores.servicio : 'todos');
  const filtro = (FILTROS_ESTADO_PEDIDO as readonly string[]).includes(pref.valores.estado ?? '')
    ? (pref.valores.estado as FiltroEstadoPedido)
    : 'vivos';
  const orden = pref.valores.orden ?? '';
  // «Ver todos» del buscador de arriba llega con ?q= (C-BUSCADOR-INSTANTANEO).
  const [texto, setTexto] = useState(
    () => new URLSearchParams(window.location.search).get('q')?.slice(0, 80) ?? '',
  );
  const [q, setQ] = useState(() => texto.trim());
  useEffect(() => {
    const r = setTimeout(() => setQ(texto.trim()), PAUSA_TEXTO_MS);
    return () => clearTimeout(r);
  }, [texto]);
  const [guardados, setDatos] = useState<(RespuestaLista & { clave: string }) | null>(null);
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [error, setError] = useState('');
  const [cargandoMas, setCargandoMas] = useState(false);
  const primeraPagina = useRef(0);

  function elegirServicio(s: ServicioMonitoreo) {
    setServicioDeEnlace(null);
    pref.cambiar('servicio', s);
    // La pestaña también queda en la dirección (para compartir el enlace o volver atrás).
    const u = new URL(window.location.href);
    if (s === 'todos') u.searchParams.delete('servicio');
    else u.searchParams.set('servicio', s);
    window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
  }

  const consulta = useCallback(
    (despues?: string) => {
      const p = new URLSearchParams({ estado: filtro });
      if (zona) p.set('zona', zona);
      if (orden) p.set('orden', orden);
      if (servicio !== 'todos') p.set('servicio', servicio);
      if (q) p.set('q', q);
      if (despues) p.set('despues', despues);
      return `/datos/admin/pedidos?${p.toString()}`;
    },
    [filtro, zona, orden, servicio, q],
  );

  const clave = consulta();
  // Lo que se ve es de estos filtros: si cambiaron, se muestra «Cargando…» hasta que llegue.
  const enMemoria = MEMORIA_LISTA.leer(clave)?.valor;
  const datos = guardados?.clave === clave ? guardados : enMemoria ? { ...enMemoria, clave } : null;

  useEffect(() => {
    let vivo = true;
    const url = consulta();
    // C-BUSCADOR-INSTANTANEO: lo ya pedido sale al instante; la petición anterior se cancela.
    // Lo guardado se dibuja directo (ver `datos`); si está vigente, no se pide hasta el refresco.
    const guardada = MEMORIA_LISTA.leer(url);
    let control: AbortController | null = null;
    const cargar = (refresco: boolean) => {
      control?.abort();
      const este = new AbortController();
      control = este;
      return pedir<RespuestaLista>('GET', url, undefined, { senal: este.signal })
        .then((r) => {
          if (!vivo || este.signal.aborted) return;
          if (!refresco) MEMORIA_LISTA.guardar(url, r);
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
        .catch((e: unknown) => {
          if (!vivo || este.signal.aborted) return;
          if (e instanceof ErrorApi && e.estado === ESTADO_CANCELADA) return;
          setError(e instanceof ErrorApi ? e.message : String(e));
        });
    };
    if (!guardada?.vigente) void cargar(false);
    const reloj = setInterval(() => void cargar(true), 15000);
    return () => {
      vivo = false;
      control?.abort();
      clearInterval(reloj);
    };
  }, [consulta]);

  // Los números de cada pestaña: su propia consulta (acotada), cada 30 segundos.
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      pedir<Contadores>(
        'GET',
        `/datos/admin/pedidos/contadores${zona ? `?zona=${encodeURIComponent(zona)}` : ''}`,
      )
        .then((r) => vivo && setContadores(r?.contadores ? r : null))
        .catch((e: unknown) => console.warn('contadores del monitoreo:', e));
    void cargar();
    const reloj = setInterval(() => void cargar(), 30000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [zona]);

  async function cargarMas() {
    if (!datos?.siguiente) return;
    setCargandoMas(true);
    try {
      const r = await pedir<RespuestaLista>('GET', consulta(datos.siguiente));
      // Sobre lo que se ve (puede venir de la memoria), no sobre lo último guardado en el estado.
      const ya = new Set(datos.pedidos.map((x) => x.id));
      setDatos({
        ...r,
        clave,
        pedidos: [...datos.pedidos, ...r.pedidos.filter((x) => !ya.has(x.id))],
      });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    } finally {
      setCargandoMas(false);
    }
  }

  const lista = datos?.pedidos;
  const codigoBuscado = datos?.porCodigo ? (interpretarBusqueda(q).codigo ?? '') : '';
  const vivoFila = (f: Fila) => (esViaje(f) ? VIVOS_VIAJE.has(f.estado) : VIVOS.has(f.estado));
  const rojos = lista?.filter((p) => vivoFila(p) && p.luz === 'rojo').length ?? 0;
  const amarillos = lista?.filter((p) => vivoFila(p) && p.luz === 'amarillo').length ?? 0;
  const encontrado = datos?.encontrado;
  const pestanas = PESTANAS.filter(
    (s) => s !== 'envios' || contadores?.hayEnvios || servicio === 'envios',
  );
  const numero = (n: number) => (contadores?.limitado && n >= 50 ? '50+' : String(n));
  const textoBuscado =
    q &&
    !datos?.porCodigo &&
    (servicio === 'todos' || servicio === 'auto' || servicio === 'moto' || servicio === 'envios');
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      <div className="monitoreo-pestanas" role="tablist" aria-label={t.servicio}>
        {pestanas.map((s) => {
          const c = contadores ? new Map(Object.entries(contadores.contadores)).get(s) : undefined;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={servicio === s}
              className={servicio === s ? 'activa' : undefined}
              onClick={() => elegirServicio(s)}
            >
              {s === 'todos' ? null : <IconoServicio servicio={s} idioma={idioma} />}
              <span>{nombreServicioMonitoreo(s, idioma === 'en' ? 'en' : 'es')}</span>
              {c ? (
                <span className="monitoreo-cuenta" title={`${numero(c.vivos)} ${t.vivosCorto}`}>
                  {numero(c.vivos)}
                  {c.problemas ? (
                    <span className="monitoreo-problemas" title={`${c.problemas} ${t.rojos}`}>
                      {numero(c.problemas)}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
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
          setServicioDeEnlace(null);
          const u = new URL(window.location.href);
          u.searchParams.delete('servicio');
          window.history.replaceState(
            window.history.state,
            '',
            `${u.pathname}${u.search}${u.hash}`,
          );
          pref.restablecer();
        }}
      />
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {datos?.porCodigo ? (
        <p className="super-nota" role="status">
          {datos.total != null
            ? t.totalCodigo(
                `${datos.total.toLocaleString(idioma === 'en' ? 'en-US' : 'es-US')}${datos.totalMas ? '+' : ''}`,
                q.replace(/^#\s*/, '').toUpperCase(),
              )
            : t.porCodigo}
        </p>
      ) : null}
      {textoBuscado ? <p className="super-nota">{t.soloPedidos}</p> : null}
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
      {lista?.length === 0 &&
        (q ? (
          <div className="super-nota super-vacio-busqueda" role="status">
            <p>
              <strong>{t.noEncontramos(q)}</strong>
            </p>
            {quisoDecirCodigo(q) ? (
              <p>
                {t.quisoDecir}{' '}
                <button
                  type="button"
                  className="bs-sugerencia"
                  onClick={() => setTexto(quisoDecirCodigo(q) ?? '')}
                >
                  {quisoDecirCodigo(q)}
                </button>
                ?
              </p>
            ) : null}
            <p>{t.pistaCodigo}</p>
          </div>
        ) : (
          <p>{t.vacio}</p>
        ))}
      <ul className="super-bandeja super-encurso">
        {lista?.map((p) =>
          esViaje(p) ? (
            <li key={p.id}>
              <Enlace a={`${base}/rides/${p.id}`}>
                <strong>
                  <IconoServicio servicio={p.servicio} idioma={idioma} />{' '}
                  <CodigoPedido id={p.id} buscado={codigoBuscado} /> · {p.origen} → {p.destino} ·{' '}
                  {formatearMonto(p.total, p.moneda, idioma)}
                </strong>
                <span>
                  {p.pasajero ?? t.cuentaEliminada}
                  {p.ciudad ? ` · ${p.ciudad}` : ''} ·{' '}
                  {p.conductor || p.conductorCodigo ? (
                    <>
                      {p.conductor ?? ''}
                      {p.conductor && p.conductorCodigo ? ' ' : ''}
                      {p.conductorCodigo ? (
                        <span className="codigo-repartidor">({p.conductorCodigo})</span>
                      ) : null}
                    </>
                  ) : (
                    t.sinConductor
                  )}{' '}
                  · <Hora fecha={p.creadoEn} zona={p.zonaHoraria} idioma={idioma} />
                </span>
                <span className="encurso-estado">
                  <span className={`bs-estado bs-${tonoEstado(p.estado)}`}>
                    {nombreEstado(p.estado, idioma)}
                  </span>{' '}
                  {p.emergencia ? (
                    <span className="bs-estado bs-problema">{t.emergencia}</span>
                  ) : null}{' '}
                  {VIVOS_VIAJE.has(p.estado) ? <LuzViaje v={p} idioma={idioma} /> : null}
                  {p.detenido ? <MarcaDetenido d={p.detenido} idioma={idioma} /> : null}
                </span>
              </Enlace>
            </li>
          ) : (
            <li key={p.id}>
              <Enlace a={`${base}/orders/${p.id}`}>
                <strong>
                  <IconoServicio servicio={p.servicio ?? 'comida'} idioma={idioma} />{' '}
                  <CodigoPedido id={p.id} buscado={codigoBuscado} /> · {p.restaurante} ·{' '}
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
                  · <Hora fecha={p.creadoEn} zona={p.zonaHoraria} idioma={idioma} />
                </span>
                <span className="encurso-estado">
                  <span className={`bs-estado bs-${tonoEstado(p.estado)}`}>
                    {te.estados[p.estado] ?? p.estado}
                  </span>{' '}
                  {VIVOS.has(p.estado) ? <LuzSemaforo pedido={p} idioma={idioma} /> : null}
                  {p.detenido ? <MarcaDetenido d={p.detenido} idioma={idioma} /> : null}
                </span>
              </Enlace>
            </li>
          ),
        )}
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
