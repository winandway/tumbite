import { useCallback, useEffect, useState } from 'react';
import {
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';
import { type TarifasPais, type TopesPais, TarifasTopesPais } from './TarifasTopesPais';

const T = {
  es: {
    retiros: 'Retiros a banco',
    retirosOn: 'Encendidos: restaurantes y repartidores pueden retirar.',
    retirosOff: 'Apagados: la app dice «en pausa». Se encienden solo por orden de Richard.',
    porVariable:
      'Apagados por la variable RETIROS_APAGADOS del sitio (manda sobre este interruptor).',
    encender: 'Encender retiros',
    apagar: 'Apagar retiros',
    confirmarEncender:
      '¿Encender los retiros? A partir de ahora saldrá dinero real a los bancos de restaurantes y repartidores.',
    confirmarApagar: '¿Apagar los retiros? Nadie podrá retirar hasta volver a encenderlos.',
    porEstado: 'Retiros por estado',
    liquidaciones: 'Cobros en revisión',
    sinLiquidaciones: 'Ningún cobro en revisión ni atrasado.',
    revision: 'En revisión',
    atrasadas: 'Atrasadas (más de 2 horas)',
    pedido: 'Pedido',
    monto: 'Monto',
    intentos: 'Intentos',
    error: 'Último error',
    reintentar: 'Reintentar ahora',
    confirmar: 'Ya está cobrado en Stripe',
    resultado: 'Resultado',
    abonos: 'Abonos rechazados por el banco',
    sinAbonos: 'Ningún abono rechazado.',
    quien: 'Quién',
    motivo: 'Motivo',
    fecha: 'Fecha',
    resuelto: 'Resuelto',
    marcarResuelto: 'Marcar resuelto',
    disputas: 'Disputas (contracargos)',
    sinDisputas: 'Ninguna disputa.',
    disputasAyuda:
      'La evidencia (foto de entrega, bitácora, chat) se responde en el panel de Stripe → Pagos → Disputas, antes de la fecha de vencimiento.',
    vence: 'Responder antes de',
    paises: 'Países y cobro directo',
    paisesAyuda:
      'Interruptores del modelo internacional. Todo nace apagado: en Estados Unidos se cobra con tarjeta por Stripe. Las cifras comerciales (comisión, tope de efectivo, límites de recarga) son decisiones de Richard.',
    pais: 'País',
    efectivo: 'Efectivo al recibir',
    transferencia: 'Transferencia al repartidor',
    recargasPunto: 'Recargas en puntos de venta',
    recargasStripe: 'Recargas con tarjeta',
    comisionPais: 'Comisión por pedido (%; vacío = la del plan)',
    cargoFijo: 'Cargo fijo por pedido',
    topeEfectivo: 'Tope de efectivo sin conciliar (vacío = sin tope)',
    guardarPais: 'Guardar país',
    comisionesCobradas: 'Comisiones cobradas',
    puntos: 'Puntos de venta de recargas',
    puntosAyuda:
      'Cada punto compra saldo a Divoox por adelantado (el comprobante del pago queda escrito) y lo vende en códigos. Su dueño entra con su cuenta y emite los códigos.',
    nombrePunto: 'Nombre del punto',
    usuarioPunto: 'Correo del dueño del punto (cuenta ya registrada)',
    crearPunto: 'Crear punto',
    fondo: 'Fondo',
    emitidos: 'Códigos emitidos',
    fondear: 'Cargar fondo',
    montoFondo: 'Monto',
    comprobante: 'Comprobante del pago',
    quejas: 'Quejas con artículo faltante',
    quejasAyuda:
      'Si está encendido, cuando un cliente marca que faltó un plato en un pedido entregado y cobrado, se le devuelve solo el valor de esos platos (lo absorbe Divoox) hasta el tope. Apagado, la queja llega al ticket con el monto propuesto.',
    quejasAuto: 'Reembolso automático por faltante',
    quejasTope: 'Tope por queja (dólares)',
    guardarQuejas: 'Guardar',
    cupones: 'Cupones y promociones',
    cuponesAyuda:
      'El descuento lo absorbe Divoox (baja su ganancia). Los destacados salen en «Ofertas del día» del inicio de la app.',
    codigo: 'Código',
    tipo: 'Tipo',
    valor: 'Valor',
    tipos: {
      monto: 'Monto fijo',
      porcentaje: 'Porcentaje',
      envio_gratis: 'Envío gratis',
    } as Record<string, string>,
    valorAyuda: 'Monto en dólares (5.00) o porcentaje (10) según el tipo',
    descripcionEs: 'Descripción en español',
    descripcionEn: 'Descripción en inglés',
    minimo: 'Pedido mínimo (comida, en dólares)',
    usosMax: 'Usos totales (vacío = sin tope)',
    primerPedido: 'Solo primer pedido',
    destacado: 'Destacado en el inicio',
    venceCupon: 'Vence (AAAA-MM-DD, vacío = nunca)',
    crear: 'Crear cupón',
    creado: 'Cupón creado.',
    usos: 'Usos',
    descontado: 'Descontado',
    activar: 'Activar',
    desactivar: 'Desactivar',
    destacar: 'Destacar',
    quitarDestacado: 'Quitar del inicio',
    sinCupones: 'Ningún cupón todavía.',
    // C-MONEDA-RECORRIDO: la conciliación cuenta solo la tarjeta (Stripe), que hoy solo cobra en USD.
    conciliacion: 'Conciliación diaria con tarjeta, en USD (últimos 14 días)',
    recalcularHoy: 'Recalcular hoy',
    dia: 'Día',
    pedidos: 'Pedidos',
    vendido: 'Vendido',
    capturado: 'Cobrado',
    devuelto: 'Devuelto',
    abonado: 'Abonado',
    retirado: 'Retirado',
    cuadra: 'Cuadra',
    noCuadra: 'NO cuadra',
    detalle: 'Ver detalle',
    sinConciliar: 'Todavía no hay conciliaciones.',
    cargando: 'Cargando…',
  },
  en: {
    retiros: 'Bank withdrawals',
    retirosOn: 'On: restaurants and drivers can withdraw.',
    retirosOff: 'Off: the app says “paused”. They are turned on only by Richard’s order.',
    porVariable: 'Off by the site variable RETIROS_APAGADOS (it overrides this switch).',
    encender: 'Turn withdrawals on',
    apagar: 'Turn withdrawals off',
    confirmarEncender:
      'Turn withdrawals on? From now on real money will go out to restaurants’ and drivers’ banks.',
    confirmarApagar: 'Turn withdrawals off? Nobody can withdraw until they are turned on again.',
    porEstado: 'Withdrawals by status',
    liquidaciones: 'Charges under review',
    sinLiquidaciones: 'No charge under review or delayed.',
    revision: 'Under review',
    atrasadas: 'Delayed (over 2 hours)',
    pedido: 'Order',
    monto: 'Amount',
    intentos: 'Attempts',
    error: 'Last error',
    reintentar: 'Retry now',
    confirmar: 'Already charged in Stripe',
    resultado: 'Result',
    abonos: 'Payouts rejected by the bank',
    sinAbonos: 'No rejected payouts.',
    quien: 'Who',
    motivo: 'Reason',
    fecha: 'Date',
    resuelto: 'Resolved',
    marcarResuelto: 'Mark resolved',
    disputas: 'Disputes (chargebacks)',
    sinDisputas: 'No disputes.',
    disputasAyuda:
      'Evidence (delivery photo, log, chat) is submitted in the Stripe dashboard → Payments → Disputes, before the due date.',
    vence: 'Respond by',
    paises: 'Countries and direct payment',
    paisesAyuda:
      'Switches of the international model. Everything starts off: in the United States cards are charged through Stripe. The commercial figures (fee, cash cap, top-up limits) are Richard’s decisions.',
    pais: 'Country',
    efectivo: 'Cash on delivery',
    transferencia: 'Transfer to the driver',
    recargasPunto: 'Sales-point top-ups',
    recargasStripe: 'Card top-ups',
    comisionPais: 'Fee per order (%; empty = the plan’s)',
    cargoFijo: 'Fixed charge per order',
    topeEfectivo: 'Unsettled cash cap (empty = no cap)',
    guardarPais: 'Save country',
    comisionesCobradas: 'Fees collected',
    puntos: 'Top-up sales points',
    puntosAyuda:
      'Each point buys balance from Divoox in advance (the payment proof is recorded) and sells it as codes. Its owner signs in with their account and issues the codes.',
    nombrePunto: 'Point name',
    usuarioPunto: 'Email of the point’s owner (existing account)',
    crearPunto: 'Create point',
    fondo: 'Fund',
    emitidos: 'Codes issued',
    fondear: 'Add funds',
    montoFondo: 'Amount',
    comprobante: 'Payment proof',
    quejas: 'Complaints with missing items',
    quejasAyuda:
      'When on, if a customer marks a missing item on a delivered and charged order, the value of those items is refunded automatically (absorbed by Divoox) up to the cap. When off, the complaint reaches the ticket with the proposed amount.',
    quejasAuto: 'Automatic refund for missing items',
    quejasTope: 'Cap per complaint (dollars)',
    guardarQuejas: 'Save',
    cupones: 'Coupons and promotions',
    cuponesAyuda:
      'Divoox absorbs the discount (lowers its margin). Featured ones show under “Today’s deals” on the app’s home.',
    codigo: 'Code',
    tipo: 'Type',
    valor: 'Value',
    tipos: {
      monto: 'Fixed amount',
      porcentaje: 'Percentage',
      envio_gratis: 'Free delivery',
    } as Record<string, string>,
    valorAyuda: 'Amount in dollars (5.00) or percentage (10) depending on the type',
    descripcionEs: 'Description in Spanish',
    descripcionEn: 'Description in English',
    minimo: 'Minimum order (food, in dollars)',
    usosMax: 'Total uses (empty = no cap)',
    primerPedido: 'First order only',
    destacado: 'Featured on home',
    venceCupon: 'Expires (YYYY-MM-DD, empty = never)',
    crear: 'Create coupon',
    creado: 'Coupon created.',
    usos: 'Uses',
    descontado: 'Discounted',
    activar: 'Activate',
    desactivar: 'Deactivate',
    destacar: 'Feature',
    quitarDestacado: 'Remove from home',
    sinCupones: 'No coupons yet.',
    conciliacion: 'Daily card reconciliation, in USD (last 14 days)',
    recalcularHoy: 'Recalculate today',
    dia: 'Day',
    pedidos: 'Orders',
    vendido: 'Sold',
    capturado: 'Charged',
    devuelto: 'Refunded',
    abonado: 'Credited',
    retirado: 'Withdrawn',
    cuadra: 'Balanced',
    noCuadra: 'NOT balanced',
    detalle: 'See detail',
    sinConciliar: 'No reconciliations yet.',
    cargando: 'Loading…',
  },
};

type Retiros = {
  activos: boolean;
  apagadosPorVariable: boolean;
  porEstado: { estado: string; n: number; monto: number }[];
};
type Liquidacion = {
  pedidoId: string;
  estado: string;
  monto: number;
  intentos: number;
  error: string | null;
  entregadoEn: string | null;
};
type Abono = {
  id: string;
  usuarioId: string | null;
  nombre: string | null;
  correo: string | null;
  rol: string | null;
  motivo: string;
  creadoEn: string;
  resueltoEn: string | null;
};
type Disputa = {
  id: string;
  pedidoId: string | null;
  cliente: string | null;
  monto: number;
  motivo: string;
  estado: string;
  venceEn: string | null;
  creadoEn: string;
};
type Cupon = {
  codigo: string;
  tipo: 'monto' | 'porcentaje' | 'envio_gratis';
  valor: number;
  descripcionEs: string;
  descripcionEn: string;
  minimoSubtotal: number;
  usosMax: number | null;
  soloPrimerPedido: boolean;
  destacado: boolean;
  venceEn: string | null;
  activo: boolean;
  usos: number;
  descontado: number;
  /** C-MONEDA-RECORRIDO: moneda del cupón (de su zona o de su restaurante; sin ninguno, USD). */
  moneda?: string;
};
type ConfigPais = {
  moneda: string;
  decimales: number;
  efectivoActivo: boolean;
  transferenciaRepartidorActiva: boolean;
  recargasPuntoVentaActivas: boolean;
  recargasStripeActivas: boolean;
  comisionPb: number | null;
  cargoFijo: number;
  topeEfectivoDiario: number | null;
  tarifas: TarifasPais | null;
  topes: TopesPais | null;
};
type Punto = {
  id: string;
  nombre: string;
  pais: string;
  moneda: string;
  usuarioId: string | null;
  activo: boolean;
  fondo: number;
  emitidos: number;
};
type Conciliacion = {
  dia: string;
  pedidos: number;
  vendido: number;
  capturado: number;
  devuelto: number;
  abonado: number;
  retirado: number;
  cuadra: boolean;
  detalle: Record<string, unknown>;
};

/**
 * Lo que el superadmin no veía del dinero (auditoría final, punto 7): el interruptor de retiros,
 * los cobros en revisión con sus dos salidas, los abonos rechazados por el banco y el historial de
 * la conciliación con su detalle y el recálculo. Todo con rutas que ya existían o se agregaron hoy.
 */
export function ControlDinero({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [retiros, setRetiros] = useState<Retiros | null>(null);
  const [liq, setLiq] = useState<{ revision: Liquidacion[]; atrasadas: Liquidacion[] } | null>(
    null,
  );
  const [abonos, setAbonos] = useState<Abono[] | null>(null);
  const [conc, setConc] = useState<Conciliacion[] | null>(null);
  const [disputas, setDisputas] = useState<Disputa[] | null>(null);
  const [cupones, setCupones] = useState<Cupon[] | null>(null);
  // Regla global: ningún formulario pierde lo escrito (borrador en el navegador).
  const bc = useBorrador({
    formulario: 'cupon-nuevo',
    inicial: {
      codigo: '',
      tipo: 'monto',
      valor: '',
      descripcionEs: '',
      descripcionEn: '',
      minimo: '',
      usosMax: '',
      soloPrimerPedido: 'no',
      destacado: 'no',
      venceEn: '',
    },
    almacen: almacenNavegador,
  });
  const nuevo = {
    ...bc.valores,
    tipo: bc.valores.tipo as Cupon['tipo'],
    soloPrimerPedido: bc.valores.soloPrimerPedido === 'si',
    destacado: bc.valores.destacado === 'si',
  };
  const setNuevo = (x: Partial<typeof nuevo>) => {
    for (const [k, v] of Object.entries(x))
      bc.cambiar(
        k as keyof typeof bc.valores,
        typeof v === 'boolean' ? (v ? 'si' : 'no') : String(v ?? ''),
      );
  };
  const [avisoCupon, setAvisoCupon] = useState('');
  const [quejas, setQuejas] = useState<{ reembolsoAuto: boolean; topeCentavos: number } | null>(
    null,
  );
  // Modelo internacional: interruptores por país y puntos de venta (solo API hasta hoy).
  const PAISES = ['US', 'CO', 'VE', 'MX'] as const;
  const [paisElegido, setPaisElegido] = useState<(typeof PAISES)[number]>('US');
  const [pais, setPais] = useState<ConfigPais | null>(null);
  const [comisionesPais, setComisionesPais] = useState<number | null>(null);
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [nuevoPunto, setNuevoPunto] = useState({ nombre: '', correo: '' });
  const [fondoPunto, setFondoPunto] = useState<
    Record<string, { monto: string; comprobante: string }>
  >({});
  const [recargaPuntos, setRecargaPuntos] = useState(0);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [c, k, p] = await Promise.all([
        pedir<{ config: ConfigPais }>('GET', `/datos/admin/paises/${paisElegido}`).catch(
          () => null,
        ),
        pedir<{ comisiones: number }>('GET', `/datos/admin/libro/comisiones/${paisElegido}`).catch(
          () => null,
        ),
        pedir<{ puntos: Punto[] }>('GET', '/datos/admin/puntos-venta').catch(() => null),
      ]);
      if (!vivo) return;
      setPais(c?.config ?? null);
      setComisionesPais(k?.comisiones ?? null);
      setPuntos(p?.puntos ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, [paisElegido, recargaPuntos]);
  const dinero = (n: number) => (pais?.decimales === 0 ? String(n) : (n / 100).toFixed(2));
  const [base, setBase] = useState('');
  const [resultado, setResultado] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const [r, l, a, c, d, k, q] = await Promise.all([
      pedir<Retiros>('GET', '/datos/admin/retiros').catch(() => null),
      pedir<{ revision: Liquidacion[]; atrasadas: Liquidacion[] }>(
        'GET',
        '/datos/admin/liquidaciones',
      ).catch(() => null),
      pedir<{ abonos: Abono[] }>('GET', '/datos/admin/abonos-fallidos').catch(() => null),
      pedir<{ conciliaciones: Conciliacion[] }>('GET', '/datos/admin/conciliacion').catch(
        () => null,
      ),
      pedir<{ disputas: Disputa[] }>('GET', '/datos/admin/disputas').catch(() => null),
      pedir<{ cupones: Cupon[] }>('GET', '/datos/admin/cupones').catch(() => null),
      pedir<{ config: { reembolsoAuto: boolean; topeCentavos: number } }>(
        'GET',
        '/datos/admin/quejas-config',
      ).catch(() => null),
    ]);
    setDisputas(d?.disputas ?? []);
    setCupones(k?.cupones ?? []);
    setQuejas(q?.config ?? null);
    setRetiros(r);
    setLiq(l);
    setAbonos(a?.abonos ?? []);
    setConc(c?.conciliaciones ?? []);
  }, []);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      await cargar();
      const r = await pedir<{ ruta: string | null }>('GET', '/datos/admin/ruta').catch(() => null);
      if (vivo && r) setBase(r.ruta ? `/panel/${r.ruta}` : '');
    })();
    return () => {
      vivo = false;
    };
  }, [cargar]);

  async function hacer(accion: () => Promise<unknown>) {
    setError('');
    try {
      await accion();
      await cargar();
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    }
  }

  const fecha = (s: string | null) => (s ? s.slice(0, 16) : '—');
  const enlacePedido = (id: string) =>
    base ? <a href={`${base}/orders/${id}`}>{id.slice(0, 8)}</a> : <span>{id.slice(0, 8)}</span>;

  return (
    <div className="control-dinero">
      <h2>{t.retiros}</h2>
      {retiros ? (
        <div className={`estado ${retiros.activos ? 'estado-aprobado' : 'estado-pausado'}`}>
          <span>
            {retiros.apagadosPorVariable
              ? t.porVariable
              : retiros.activos
                ? t.retirosOn
                : t.retirosOff}
          </span>
          {!retiros.apagadosPorVariable && (
            <button
              type="button"
              className={retiros.activos ? 'boton secundario' : 'boton'}
              onClick={() => {
                if (!window.confirm(retiros.activos ? t.confirmarApagar : t.confirmarEncender))
                  return;
                void hacer(() =>
                  pedir('PUT', '/datos/admin/retiros', { activos: !retiros.activos }),
                );
              }}
            >
              {retiros.activos ? t.apagar : t.encender}
            </button>
          )}
        </div>
      ) : (
        <p className="suave">{t.cargando}</p>
      )}
      {retiros?.porEstado.length ? (
        <p className="suave">
          {t.porEstado}:{' '}
          {retiros.porEstado
            .map((e) => `${e.estado} ${e.n} (${formatearMonto(e.monto, 'USD', idioma)})`)
            .join(' · ')}
        </p>
      ) : null}

      <h2>{t.liquidaciones}</h2>
      {liq && !liq.revision.length && !liq.atrasadas.length ? (
        <p className="suave">{t.sinLiquidaciones}</p>
      ) : null}
      {liq &&
        (
          [
            [t.revision, liq.revision],
            [t.atrasadas, liq.atrasadas],
          ] as const
        ).map(([titulo, lista]) =>
          lista.length ? (
            <div className="tabla-ancha" key={titulo}>
              <h3>{titulo}</h3>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>{t.pedido}</th>
                    <th>{t.monto}</th>
                    <th>{t.intentos}</th>
                    <th>{t.error}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l) => (
                    <tr key={l.pedidoId}>
                      <td>{enlacePedido(l.pedidoId)}</td>
                      <td>{formatearMonto(l.monto, 'USD', idioma)}</td>
                      <td>{l.intentos}</td>
                      <td className="suave">{l.error ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="enlace"
                          onClick={() =>
                            void hacer(async () => {
                              const r = await pedir<{ estado: string }>(
                                'POST',
                                `/datos/admin/liquidaciones/${l.pedidoId}/reintentar`,
                              );
                              setResultado((x) => ({ ...x, [l.pedidoId]: r.estado }));
                            })
                          }
                        >
                          {t.reintentar}
                        </button>{' '}
                        <button
                          type="button"
                          className="enlace"
                          onClick={() =>
                            void hacer(async () => {
                              const r = await pedir<{ estado: string }>(
                                'POST',
                                `/datos/admin/liquidaciones/${l.pedidoId}/confirmar`,
                              );
                              setResultado((x) => ({ ...x, [l.pedidoId]: r.estado }));
                            })
                          }
                        >
                          {t.confirmar}
                        </button>
                        {new Map(Object.entries(resultado)).get(l.pedidoId) ? (
                          <span className="suave">
                            {' '}
                            {t.resultado}: {new Map(Object.entries(resultado)).get(l.pedidoId)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null,
        )}

      <h2>{t.abonos}</h2>
      {abonos && !abonos.length ? <p className="suave">{t.sinAbonos}</p> : null}
      {abonos?.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.quien}</th>
                <th>{t.motivo}</th>
                <th>{t.fecha}</th>
                <th>{t.resuelto}</th>
              </tr>
            </thead>
            <tbody>
              {abonos.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.nombre ?? '—'}{' '}
                    {a.correo ? <span className="suave">({a.correo})</span> : null}
                  </td>
                  <td>{a.motivo || '—'}</td>
                  <td>{fecha(a.creadoEn)}</td>
                  <td>
                    {a.resueltoEn ? (
                      fecha(a.resueltoEn)
                    ) : (
                      <button
                        type="button"
                        className="enlace"
                        onClick={() =>
                          void hacer(() =>
                            pedir('PATCH', `/datos/admin/abonos-fallidos/${a.id}`, {
                              resuelto: true,
                            }),
                          )
                        }
                      >
                        {t.marcarResuelto}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2>{t.paises}</h2>
      <p className="suave">{t.paisesAyuda}</p>
      <div className="super-filtros" role="tablist">
        {PAISES.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={paisElegido === p}
            className={paisElegido === p ? 'activa' : undefined}
            onClick={() => setPaisElegido(p)}
          >
            {p}
          </button>
        ))}
      </div>
      {pais ? (
        <div className="estado" aria-label={t.pais}>
          <span>
            {paisElegido} · {pais.moneda}
            {comisionesPais != null ? ` · ${t.comisionesCobradas}: ${dinero(comisionesPais)}` : ''}
          </span>
          {(
            [
              ['efectivoActivo', t.efectivo],
              ['transferenciaRepartidorActiva', t.transferencia],
              ['recargasPuntoVentaActivas', t.recargasPunto],
              ['recargasStripeActivas', t.recargasStripe],
            ] as const
          ).map(([clave, etiqueta]) => (
            <label key={clave}>
              <input
                type="checkbox"
                checked={Boolean(new Map(Object.entries(pais)).get(clave))}
                onChange={(ev) => setPais({ ...pais, [clave]: ev.target.checked })}
              />{' '}
              {etiqueta}
            </label>
          ))}
          <label className="campo campo-num">
            <span>{t.comisionPais}</span>
            <input
              inputMode="decimal"
              value={pais.comisionPb == null ? '' : String(pais.comisionPb / 100)}
              onChange={(ev) =>
                setPais({
                  ...pais,
                  comisionPb:
                    ev.target.value === ''
                      ? null
                      : Math.round(Number(ev.target.value.replace(',', '.')) * 100),
                })
              }
              aria-label={t.comisionPais}
            />
          </label>
          <label className="campo campo-num">
            <span>{t.cargoFijo}</span>
            <input
              inputMode="decimal"
              value={dinero(pais.cargoFijo)}
              onChange={(ev) =>
                setPais({
                  ...pais,
                  cargoFijo: Math.round(
                    Number(ev.target.value.replace(',', '.') || '0') *
                      (pais.decimales === 0 ? 1 : 100),
                  ),
                })
              }
              aria-label={t.cargoFijo}
            />
          </label>
          <label className="campo campo-num">
            <span>{t.topeEfectivo}</span>
            <input
              inputMode="decimal"
              value={pais.topeEfectivoDiario == null ? '' : dinero(pais.topeEfectivoDiario)}
              onChange={(ev) =>
                setPais({
                  ...pais,
                  topeEfectivoDiario:
                    ev.target.value === ''
                      ? null
                      : Math.round(
                          Number(ev.target.value.replace(',', '.')) *
                            (pais.decimales === 0 ? 1 : 100),
                        ),
                })
              }
              aria-label={t.topeEfectivo}
            />
          </label>
          <button
            type="button"
            className="boton secundario"
            onClick={() =>
              void hacer(() => pedir('PUT', `/datos/admin/paises/${paisElegido}`, pais))
            }
          >
            {t.guardarPais}
          </button>
          <TarifasTopesPais
            key={paisElegido}
            pais={paisElegido}
            moneda={pais.moneda}
            tarifas={pais.tarifas}
            topes={pais.topes}
            idioma={idioma}
            guardar={async (cambios) => {
              await pedir('PUT', `/datos/admin/paises/${paisElegido}`, cambios);
              setRecargaPuntos((n) => n + 1);
            }}
          />
        </div>
      ) : null}
      <h3>{t.puntos}</h3>
      <p className="suave">{t.puntosAyuda}</p>
      {puntos?.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.nombrePunto}</th>
                <th>{t.pais}</th>
                <th>{t.fondo}</th>
                <th>{t.emitidos}</th>
                <th>{t.fondear}</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((p) => {
                const f = new Map(Object.entries(fondoPunto)).get(p.id) ?? {
                  monto: '',
                  comprobante: '',
                };
                return (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>
                      {p.pais} · {p.moneda}
                    </td>
                    <td>{p.moneda === 'COP' ? String(p.fondo) : (p.fondo / 100).toFixed(2)}</td>
                    <td>{p.emitidos}</td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder={t.montoFondo}
                        aria-label={`${t.montoFondo} ${p.nombre}`}
                        value={f.monto}
                        onChange={(ev) =>
                          setFondoPunto({ ...fondoPunto, [p.id]: { ...f, monto: ev.target.value } })
                        }
                      />{' '}
                      <input
                        placeholder={t.comprobante}
                        aria-label={`${t.comprobante} ${p.nombre}`}
                        value={f.comprobante}
                        onChange={(ev) =>
                          setFondoPunto({
                            ...fondoPunto,
                            [p.id]: { ...f, comprobante: ev.target.value },
                          })
                        }
                      />{' '}
                      <button
                        type="button"
                        className="enlace"
                        onClick={() =>
                          void hacer(async () => {
                            await pedir('POST', `/datos/admin/puntos-venta/${p.id}/fondo`, {
                              monto: Math.round(
                                Number(f.monto.replace(',', '.')) * (p.moneda === 'COP' ? 1 : 100),
                              ),
                              comprobante: f.comprobante,
                            });
                            setFondoPunto({
                              ...fondoPunto,
                              [p.id]: { monto: '', comprobante: '' },
                            });
                            setRecargaPuntos((n) => n + 1);
                          })
                        }
                      >
                        {t.fondear}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <form
        className="dinero"
        onSubmit={(ev) => {
          ev.preventDefault();
          void hacer(async () => {
            const u = nuevoPunto.correo
              ? await pedir<{ clientes: { id: string }[] }>(
                  'GET',
                  `/datos/admin/clientes?q=${encodeURIComponent(nuevoPunto.correo)}`,
                ).catch(() => null)
              : null;
            await pedir('POST', '/datos/admin/puntos-venta', {
              nombre: nuevoPunto.nombre,
              pais: paisElegido,
              usuarioId: u?.clientes?.[0]?.id ?? null,
            });
            setNuevoPunto({ nombre: '', correo: '' });
            setRecargaPuntos((n) => n + 1);
          });
        }}
      >
        <fieldset>
          <legend>{t.crearPunto}</legend>
          <label className="campo">
            <span>{t.nombrePunto}</span>
            <input
              value={nuevoPunto.nombre}
              onChange={(ev) => setNuevoPunto({ ...nuevoPunto, nombre: ev.target.value })}
              aria-label={t.nombrePunto}
              required
            />
          </label>
          <label className="campo">
            <span>{t.usuarioPunto}</span>
            <input
              type="email"
              value={nuevoPunto.correo}
              onChange={(ev) => setNuevoPunto({ ...nuevoPunto, correo: ev.target.value })}
              aria-label={t.usuarioPunto}
            />
          </label>
        </fieldset>
        <button type="submit" className="boton secundario">
          {t.crearPunto}
        </button>
      </form>

      <h2>{t.quejas}</h2>
      <p className="suave">{t.quejasAyuda}</p>
      {quejas ? (
        <div className="estado">
          <label>
            <input
              type="checkbox"
              checked={quejas.reembolsoAuto}
              onChange={(ev) => setQuejas({ ...quejas, reembolsoAuto: ev.target.checked })}
            />{' '}
            {t.quejasAuto}
          </label>{' '}
          <label className="campo campo-num">
            <span>{t.quejasTope}</span>
            <input
              inputMode="decimal"
              value={String(quejas.topeCentavos / 100)}
              onChange={(ev) =>
                setQuejas({
                  ...quejas,
                  topeCentavos: Math.round(Number(ev.target.value.replace(',', '.') || '0') * 100),
                })
              }
              aria-label={t.quejasTope}
            />
          </label>{' '}
          <button
            type="button"
            className="boton secundario"
            onClick={() => void hacer(() => pedir('PUT', '/datos/admin/quejas-config', quejas))}
          >
            {t.guardarQuejas}
          </button>
        </div>
      ) : null}

      <h2>{t.cupones}</h2>
      <p className="suave">{t.cuponesAyuda}</p>
      <form
        className="dinero"
        onSubmit={(ev) => {
          ev.preventDefault();
          setAvisoCupon('');
          const esPct = nuevo.tipo === 'porcentaje';
          const valor = esPct
            ? Math.round(Number(nuevo.valor.replace(',', '.')) * 100)
            : Math.round(Number(nuevo.valor.replace(',', '.')) * 100);
          void hacer(async () => {
            await pedir('POST', '/datos/admin/cupones', {
              codigo: nuevo.codigo,
              tipo: nuevo.tipo,
              valor: nuevo.tipo === 'envio_gratis' ? 0 : valor,
              descripcionEs: nuevo.descripcionEs,
              descripcionEn: nuevo.descripcionEn,
              minimoSubtotal: Math.round(Number(nuevo.minimo.replace(',', '.') || '0') * 100),
              usosMax: nuevo.usosMax ? Number(nuevo.usosMax) : null,
              soloPrimerPedido: nuevo.soloPrimerPedido,
              destacado: nuevo.destacado,
              venceEn: nuevo.venceEn ? `${nuevo.venceEn} 23:59:59` : null,
            });
            setAvisoCupon(t.creado);
            await bc.limpiar();
          });
        }}
      >
        <AvisoBorrador
          visible={bc.recuperado}
          idioma={idioma}
          empezar={() => void bc.empezarDeNuevo()}
        />
        <fieldset>
          <legend>{t.crear}</legend>
          <label className="campo">
            <span>{t.codigo}</span>
            <input
              value={nuevo.codigo}
              onChange={(ev) => setNuevo({ codigo: ev.target.value.toUpperCase() })}
              aria-label={t.codigo}
              required
            />
          </label>
          <label className="campo">
            <span>{t.tipo}</span>
            <select
              value={nuevo.tipo}
              onChange={(ev) => setNuevo({ tipo: ev.target.value as Cupon['tipo'] })}
              aria-label={t.tipo}
            >
              {(['monto', 'porcentaje', 'envio_gratis'] as const).map((x) => (
                <option key={x} value={x}>
                  {new Map(Object.entries(t.tipos)).get(x)}
                </option>
              ))}
            </select>
          </label>
          {nuevo.tipo !== 'envio_gratis' ? (
            <label className="campo">
              <span>{t.valor}</span>
              <input
                value={nuevo.valor}
                onChange={(ev) => setNuevo({ valor: ev.target.value })}
                aria-label={t.valor}
                inputMode="decimal"
                placeholder={t.valorAyuda}
              />
            </label>
          ) : null}
          <label className="campo">
            <span>{t.descripcionEs}</span>
            <input
              value={nuevo.descripcionEs}
              onChange={(ev) => setNuevo({ descripcionEs: ev.target.value })}
              aria-label={t.descripcionEs}
            />
          </label>
          <label className="campo">
            <span>{t.descripcionEn}</span>
            <input
              value={nuevo.descripcionEn}
              onChange={(ev) => setNuevo({ descripcionEn: ev.target.value })}
              aria-label={t.descripcionEn}
            />
          </label>
          <label className="campo">
            <span>{t.minimo}</span>
            <input
              value={nuevo.minimo}
              onChange={(ev) => setNuevo({ minimo: ev.target.value })}
              aria-label={t.minimo}
              inputMode="decimal"
            />
          </label>
          <label className="campo">
            <span>{t.usosMax}</span>
            <input
              value={nuevo.usosMax}
              onChange={(ev) => setNuevo({ usosMax: ev.target.value })}
              aria-label={t.usosMax}
              inputMode="numeric"
            />
          </label>
          <label className="campo">
            <span>{t.venceCupon}</span>
            <input
              value={nuevo.venceEn}
              onChange={(ev) => setNuevo({ venceEn: ev.target.value })}
              aria-label={t.venceCupon}
              placeholder="2026-12-31"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={nuevo.soloPrimerPedido}
              onChange={(ev) => setNuevo({ soloPrimerPedido: ev.target.checked })}
            />{' '}
            {t.primerPedido}
          </label>{' '}
          <label>
            <input
              type="checkbox"
              checked={nuevo.destacado}
              onChange={(ev) => setNuevo({ destacado: ev.target.checked })}
            />{' '}
            {t.destacado}
          </label>
        </fieldset>
        <button type="submit" className="boton">
          {t.crear}
        </button>
        {avisoCupon ? (
          <p className="ok" role="status">
            {avisoCupon}
          </p>
        ) : null}
      </form>
      {cupones && !cupones.length ? <p className="suave">{t.sinCupones}</p> : null}
      {cupones?.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.codigo}</th>
                <th>{t.tipo}</th>
                <th>{t.valor}</th>
                <th>{t.usos}</th>
                <th>{t.descontado}</th>
                <th>{t.vence}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cupones.map((k) => (
                <tr key={k.codigo} className={k.activo ? '' : 'suave'}>
                  <td>
                    <strong>{k.codigo}</strong>
                    {k.destacado ? ' ★' : ''}
                    <div className="suave">
                      {idioma === 'en' ? k.descripcionEn || k.descripcionEs : k.descripcionEs}
                    </div>
                  </td>
                  <td>{new Map(Object.entries(t.tipos)).get(k.tipo)}</td>
                  <td>
                    {k.tipo === 'porcentaje'
                      ? `${k.valor / 100}%`
                      : k.tipo === 'monto'
                        ? formatearMonto(k.valor, k.moneda ?? 'USD', idioma)
                        : '—'}
                  </td>
                  <td>
                    {k.usos}
                    {k.usosMax != null ? ` / ${k.usosMax}` : ''}
                  </td>
                  <td>{formatearMonto(k.descontado, k.moneda ?? 'USD', idioma)}</td>
                  <td>{fecha(k.venceEn)}</td>
                  <td>
                    <button
                      type="button"
                      className="enlace"
                      onClick={() =>
                        void hacer(() =>
                          pedir('PATCH', `/datos/admin/cupones/${k.codigo}`, { activo: !k.activo }),
                        )
                      }
                    >
                      {k.activo ? t.desactivar : t.activar}
                    </button>{' '}
                    <button
                      type="button"
                      className="enlace"
                      onClick={() =>
                        void hacer(() =>
                          pedir('PATCH', `/datos/admin/cupones/${k.codigo}`, {
                            destacado: !k.destacado,
                          }),
                        )
                      }
                    >
                      {k.destacado ? t.quitarDestacado : t.destacar}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2>{t.disputas}</h2>
      <p className="suave">{t.disputasAyuda}</p>
      {disputas && !disputas.length ? <p className="suave">{t.sinDisputas}</p> : null}
      {disputas?.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.pedido}</th>
                <th>{t.quien}</th>
                <th>{t.monto}</th>
                <th>{t.motivo}</th>
                <th>{t.resultado}</th>
                <th>{t.vence}</th>
              </tr>
            </thead>
            <tbody>
              {disputas.map((d) => (
                <tr key={d.id} className={d.estado.includes('needs_response') ? 'fila-alerta' : ''}>
                  <td>{d.pedidoId ? enlacePedido(d.pedidoId) : '—'}</td>
                  <td>{d.cliente ?? '—'}</td>
                  <td>{formatearMonto(d.monto, 'USD', idioma)}</td>
                  <td>{d.motivo || '—'}</td>
                  <td>{d.estado}</td>
                  <td>{fecha(d.venceEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2>{t.conciliacion}</h2>
      <button
        type="button"
        className="boton secundario"
        onClick={() =>
          void hacer(() =>
            pedir('GET', `/datos/admin/conciliacion?dia=${new Date().toISOString().slice(0, 10)}`),
          )
        }
      >
        {t.recalcularHoy}
      </button>
      {conc && !conc.length ? <p className="suave">{t.sinConciliar}</p> : null}
      {conc?.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.dia}</th>
                <th>{t.pedidos}</th>
                <th>{t.vendido}</th>
                <th>{t.capturado}</th>
                <th>{t.devuelto}</th>
                <th>{t.abonado}</th>
                <th>{t.retirado}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conc.map((c) => (
                <tr key={c.dia} className={c.cuadra ? '' : 'fila-alerta'}>
                  <td>{c.dia}</td>
                  <td>{c.pedidos}</td>
                  <td>{formatearMonto(c.vendido, 'USD', idioma)}</td>
                  <td>{formatearMonto(c.capturado, 'USD', idioma)}</td>
                  <td>{formatearMonto(c.devuelto, 'USD', idioma)}</td>
                  <td>{formatearMonto(c.abonado, 'USD', idioma)}</td>
                  <td>{formatearMonto(c.retirado, 'USD', idioma)}</td>
                  <td>
                    <strong className={c.cuadra ? 'ok' : 'error-general'}>
                      {c.cuadra ? t.cuadra : t.noCuadra}
                    </strong>
                    <details>
                      <summary className="suave">{t.detalle}</summary>
                      <pre className="suave">{JSON.stringify(c.detalle, null, 1)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
