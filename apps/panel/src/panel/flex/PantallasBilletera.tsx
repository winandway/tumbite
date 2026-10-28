/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  almacenNavegador,
  formatearMonto,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { Campo } from '../CampoClave';
import { pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';

/**
 * Divoox Flex · Fase 4: la billetera de la empresa en el panel (C-FIN-PANEL). El saldo y los
 * movimientos salen SIEMPRE del servidor (el libro contable); el navegador nunca acredita nada: tras
 * pagar, la pantalla espera a que el servidor confirme la recarga con el aviso de Stripe.
 */

export const TEXTOS_BILLETERA = {
  es: {
    titulo: 'Mi billetera',
    pestanas: {
      '': 'Resumen',
      topup: 'Recargar',
      commissions: 'Comisiones',
      receipts: 'Comprobantes',
      settings: 'Configuración',
    } as Record<string, string>,
    disponible: 'Saldo disponible',
    reservado: 'Reservado para rutas',
    total: 'Saldo total',
    deuda: 'Saldo pendiente de pago',
    suspendida:
      'Tu billetera tiene un saldo pendiente. Las rutas nuevas no salen hasta que recargues; las que ya salieron terminan normal.',
    saldoBajo: 'Tu saldo disponible está por debajo de tu alerta.',
    tarifa: 'Tarifa aplicable',
    sinTarifa:
      'Tu empresa no tiene una tarifa activa: por ahora Divoox Flex no te cobra comisiones.',
    porPaquete: 'por paquete entregado',
    porRuta: 'por ruta',
    porcentaje: 'del valor de la operación',
    volumen: 'por paquete, según el volumen del mes',
    exenta: 'Sin comisión (exención)',
    descuento: 'Descuento vigente',
    recargar: 'Recargar saldo',
    movimientos: 'Movimientos recientes',
    sinMovimientos: 'Todavía no hay movimientos.',
    tipos: {
      recarga: 'Recarga',
      reserva: 'Reserva de una ruta',
      reserva_apartada: 'Reserva de una ruta',
      comision: 'Comisión por paquete',
      liberacion: 'Reserva devuelta',
      reembolso: 'Reembolso',
      disputa: 'Disputa',
      ajuste: 'Ajuste',
      otro: 'Movimiento',
    } as Record<string, string>,
    bolsillos: {
      prepago: 'Disponible',
      reservado: 'Reservado',
      deuda_cliente: 'Pendiente',
    } as Record<string, string>,
    noActivas: 'Las recargas todavía no están activas en tu país.',
    importe: 'Importe',
    otroImporte: 'Otro importe',
    limites: 'Entre {min} y {max}.',
    guardarTarjeta: 'Guardar la tarjeta para la recarga automática',
    continuar: 'Continuar al pago',
    pagar: 'Pagar',
    pagando: 'Procesando…',
    cambiarImporte: 'Cambiar el importe',
    esperando: 'Pago enviado. Esperando la confirmación de Stripe…',
    acreditada: 'Recarga acreditada. Tu nuevo saldo disponible es',
    pendienteLargo:
      'El pago se está procesando. Se acreditará en cuanto Stripe lo confirme; puedes cerrar esta pantalla.',
    rechazada: 'El pago no se pudo completar',
    sinFormulario: 'El formulario de pago no cargó. Revisa tu conexión e intenta de nuevo.',
    reintentar: 'Intentar de nuevo',
    pagoSeguro: 'El pago lo procesa Stripe. Divoox nunca ve ni guarda el número de tu tarjeta.',
    recargasRecientes: 'Tus recargas',
    estadosRecarga: {
      pendiente: 'Pendiente',
      acreditada: 'Acreditada',
      fallida: 'Fallida',
      cancelada: 'Cancelada',
    } as Record<string, string>,
    automatica: 'Automática',
    comisiones: 'Comisiones del periodo',
    desde: 'Desde',
    hasta: 'Hasta',
    ver: 'Ver',
    totalCobrado: 'Total cobrado',
    paquetesFacturados: 'Paquetes facturados',
    ruta: 'Ruta',
    estadoCobro: { reservada: 'En curso', liberada: 'Sin cobro', cerrada: 'Cerrada' } as Record<
      string,
      string
    >,
    sinComisiones: 'No hay comisiones en este periodo.',
    comprobantes: 'Comprobantes',
    tiposComprobante: {
      recarga: 'Recarga',
      reembolso: 'Reembolso',
      comisiones_ruta: 'Comisiones de ruta',
      ajuste: 'Ajuste',
    } as Record<string, string>,
    todos: 'Todos',
    sinComprobantes: 'No hay comprobantes en este periodo.',
    numero: 'Número',
    fecha: 'Fecha',
    monto: 'Monto',
    detalle: 'Ver',
    imprimir: 'Imprimir o descargar PDF',
    noFiscal: 'Comprobante de movimiento de la billetera. No es una factura fiscal.',
    emitido: 'Emitido por',
    cliente: 'Empresa',
    volver: '← Comprobantes',
    configuracion: 'Configuración',
    alerta: 'Avisarme cuando el disponible baje de',
    avisosCorreo: 'Recibir también los avisos de dinero por correo',
    auto: 'Recarga automática',
    autoAyuda:
      'Cuando el disponible baje del umbral, recargamos el importe con tu tarjeta guardada. Como mucho una vez por hora.',
    autoNoPermitida: 'La recarga automática no está disponible en tu país.',
    activar: 'Activar la recarga automática',
    umbral: 'Cuando el disponible baje de',
    montoAuto: 'Recargar',
    tarjeta: 'Tarjeta guardada',
    sinTarjeta: 'No tienes una tarjeta guardada. Haz una recarga marcando «Guardar la tarjeta».',
    guardar: 'Guardar',
    guardado: 'Guardado.',
    masOpciones: 'Más opciones',
    quitarTarjeta: 'Quitar la tarjeta guardada',
    confirmarQuitar: '¿Quitar la tarjeta? La recarga automática se apaga.',
  },
  en: {
    titulo: 'My wallet',
    pestanas: {
      '': 'Overview',
      topup: 'Top up',
      commissions: 'Commissions',
      receipts: 'Receipts',
      settings: 'Settings',
    } as Record<string, string>,
    disponible: 'Available balance',
    reservado: 'Reserved for routes',
    total: 'Total balance',
    deuda: 'Outstanding balance',
    suspendida:
      'Your wallet has an outstanding balance. New routes won’t go out until you top up; routes already on the street finish normally.',
    saldoBajo: 'Your available balance is below your alert.',
    tarifa: 'Your rate',
    sinTarifa:
      'Your company has no active rate: Divoox Flex doesn’t charge you commissions for now.',
    porPaquete: 'per delivered package',
    porRuta: 'per route',
    porcentaje: 'of the operation value',
    volumen: 'per package, by monthly volume',
    exenta: 'No commission (exempt)',
    descuento: 'Current discount',
    recargar: 'Top up',
    movimientos: 'Recent activity',
    sinMovimientos: 'No activity yet.',
    tipos: {
      recarga: 'Top-up',
      reserva: 'Route reservation',
      reserva_apartada: 'Route reservation',
      comision: 'Package commission',
      liberacion: 'Reservation returned',
      reembolso: 'Refund',
      disputa: 'Dispute',
      ajuste: 'Adjustment',
      otro: 'Activity',
    } as Record<string, string>,
    bolsillos: {
      prepago: 'Available',
      reservado: 'Reserved',
      deuda_cliente: 'Outstanding',
    } as Record<string, string>,
    noActivas: 'Top-ups aren’t available in your country yet.',
    importe: 'Amount',
    otroImporte: 'Other amount',
    limites: 'Between {min} and {max}.',
    guardarTarjeta: 'Save the card for automatic top-up',
    continuar: 'Continue to payment',
    pagar: 'Pay',
    pagando: 'Processing…',
    cambiarImporte: 'Change amount',
    esperando: 'Payment sent. Waiting for Stripe to confirm…',
    acreditada: 'Top-up credited. Your new available balance is',
    pendienteLargo:
      'The payment is processing. It will be credited as soon as Stripe confirms it; you can close this screen.',
    rechazada: 'The payment couldn’t be completed',
    sinFormulario: 'The payment form didn’t load. Check your connection and try again.',
    reintentar: 'Try again',
    pagoSeguro: 'Payments are processed by Stripe. Divoox never sees or stores your card number.',
    recargasRecientes: 'Your top-ups',
    estadosRecarga: {
      pendiente: 'Pending',
      acreditada: 'Credited',
      fallida: 'Failed',
      cancelada: 'Canceled',
    } as Record<string, string>,
    automatica: 'Automatic',
    comisiones: 'Commissions in this period',
    desde: 'From',
    hasta: 'To',
    ver: 'View',
    totalCobrado: 'Total charged',
    paquetesFacturados: 'Billed packages',
    ruta: 'Route',
    estadoCobro: { reservada: 'In progress', liberada: 'Not charged', cerrada: 'Closed' } as Record<
      string,
      string
    >,
    sinComisiones: 'No commissions in this period.',
    comprobantes: 'Receipts',
    tiposComprobante: {
      recarga: 'Top-up',
      reembolso: 'Refund',
      comisiones_ruta: 'Route commissions',
      ajuste: 'Adjustment',
    } as Record<string, string>,
    todos: 'All',
    sinComprobantes: 'No receipts in this period.',
    numero: 'Number',
    fecha: 'Date',
    monto: 'Amount',
    detalle: 'View',
    imprimir: 'Print or download PDF',
    noFiscal: 'Wallet activity receipt. This is not a tax invoice.',
    emitido: 'Issued by',
    cliente: 'Company',
    volver: '← Receipts',
    configuracion: 'Settings',
    alerta: 'Alert me when the available balance drops below',
    avisosCorreo: 'Also send money alerts by email',
    auto: 'Automatic top-up',
    autoAyuda:
      'When the available balance drops below the threshold, we top up the amount with your saved card. At most once an hour.',
    autoNoPermitida: 'Automatic top-up isn’t available in your country.',
    activar: 'Turn on automatic top-up',
    umbral: 'When the available balance drops below',
    montoAuto: 'Top up',
    tarjeta: 'Saved card',
    sinTarjeta: 'You don’t have a saved card. Make a top-up checking “Save the card”.',
    guardar: 'Save',
    guardado: 'Saved.',
    masOpciones: 'More options',
    quitarTarjeta: 'Remove saved card',
    confirmarQuitar: 'Remove the card? Automatic top-up turns off.',
  },
};
type TB = (typeof TEXTOS_BILLETERA)['es'];
const textos = (ctx: Contexto): TB => TEXTOS_BILLETERA[ctx.idioma === 'en' ? 'en' : 'es'];

type Regla =
  | { tipo: 'por_paquete'; monto: number }
  | { tipo: 'por_ruta'; monto: number }
  | { tipo: 'porcentaje'; pb: number }
  | { tipo: 'volumen'; tramos: { desde: number; monto: number }[] }
  | { tipo: 'exenta' };

type Billetera = {
  saldo: { disponible: number; reservado: number; deuda: number; total: number; moneda: string };
  alertaSaldoBajo: boolean;
  suspendida: boolean;
  recargas: {
    activas: boolean;
    minimo: number;
    maximo: number;
    sugeridos: number[];
    automaticaPermitida: boolean;
    pendientes: number;
  };
  tarifa: { modalidad: string; regla: Regla; descuentoPb: number } | null;
  config: {
    alertaSaldo: number | null;
    avisosCorreo: boolean;
    recargaAutomatica: { activa: boolean; umbral: number | null; monto: number | null };
    metodoGuardado: string | null;
  };
  clavePublica: string;
};

function Aviso({ error }: { error: string }) {
  return error ? (
    <p className="error-general" role="alert">
      {error}
    </p>
  ) : null;
}

function useBilletera(ctx: Contexto) {
  const [b, setB] = useState<Billetera | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<Billetera>('GET', `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera`)
      .then((r) => {
        setB(r);
        setError('');
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [ctx.empresa.id]);
  useEffect(cargar, [cargar]);
  return { b, error, cargar };
}

function textoTarifa(t: TB, regla: Regla, moneda: string, idioma: 'es' | 'en') {
  const m = (x: number) => formatearMonto(x, moneda, idioma);
  switch (regla.tipo) {
    case 'por_paquete':
      return `${m(regla.monto)} ${t.porPaquete}`;
    case 'por_ruta':
      return `${m(regla.monto)} ${t.porRuta}`;
    case 'porcentaje':
      return `${(regla.pb / 100).toLocaleString(idioma === 'en' ? 'en-US' : 'es-ES')} % ${t.porcentaje}`;
    case 'volumen':
      return `${regla.tramos.map((x) => `${x.desde}+: ${m(x.monto)}`).join(' · ')} (${t.volumen})`;
    case 'exenta':
      return t.exenta;
  }
}

/** Contenedor con las pestañas de la billetera (cada una tiene su propia dirección). */
export function BilleteraEmpresa({ ctx, sub }: { ctx: Contexto; sub: string }) {
  const t = textos(ctx);
  const resto = sub.replace(/^wallet\/?/, '');
  const pestana = resto.split('/')[0] ?? '';
  const raiz = `${ctx.raiz}/wallet`;
  const puedeGestionar = ctx.permisos.includes('finanzas.gestionar');
  const pestanas = [
    '',
    'topup',
    'commissions',
    'receipts',
    ...(puedeGestionar ? ['settings'] : []),
  ].filter((p) => p !== 'topup' || puedeGestionar);
  const reciboId = /^receipts\/([0-9a-f-]{36})$/.exec(resto)?.[1];
  let contenido: React.ReactNode;
  if (reciboId) contenido = <Comprobante ctx={ctx} id={reciboId} />;
  else if (pestana === 'topup' && puedeGestionar) contenido = <Recargar ctx={ctx} />;
  else if (pestana === 'commissions') contenido = <Comisiones ctx={ctx} />;
  else if (pestana === 'receipts') contenido = <Comprobantes ctx={ctx} />;
  else if (pestana === 'settings' && puedeGestionar) contenido = <ConfigBilletera ctx={ctx} />;
  else contenido = <Resumen ctx={ctx} />;
  return (
    <section className="super flex-billetera">
      <h1>{t.titulo}</h1>
      <nav className="flex-pestanas" aria-label={t.titulo}>
        {pestanas.map((p) => (
          <Enlace
            key={p || 'inicio'}
            a={p ? `${raiz}/${p}` : raiz}
            className={pestana === p && !reciboId ? 'activa' : ''}
          >
            {t.pestanas[p]}
          </Enlace>
        ))}
      </nav>
      {contenido}
    </section>
  );
}

function Tarjeta({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className={`flex-kpi${destacado ? ' flex-kpi-grande' : ''}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function Resumen({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const { b, error } = useBilletera(ctx);
  const [mov, setMov] = useState<
    { id: string; bolsillo: string; monto: number; tipo: string; creadoEn: string }[] | null
  >(null);
  useEffect(() => {
    void pedir<{ movimientos: NonNullable<typeof mov> }>(
      'GET',
      `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/movimientos?limite=20`,
    )
      .then((r) => setMov(r.movimientos))
      .catch(() => setMov([]));
  }, [ctx.empresa.id]);
  if (!b) return <p role={error ? 'alert' : 'status'}>{error || ctx.t.cargando}</p>;
  const m = (x: number) => formatearMonto(x, b.saldo.moneda, ctx.idioma === 'en' ? 'en' : 'es');
  return (
    <>
      {b.suspendida ? (
        <p className="flex-alerta" role="alert">
          {t.suspendida}
        </p>
      ) : b.alertaSaldoBajo ? (
        <p className="flex-alerta">{t.saldoBajo}</p>
      ) : null}
      <div className="flex-kpis">
        <Tarjeta titulo={t.disponible} valor={m(b.saldo.disponible)} destacado />
        <Tarjeta titulo={t.reservado} valor={m(b.saldo.reservado)} />
        <Tarjeta titulo={t.total} valor={m(b.saldo.total)} />
        {b.saldo.deuda > 0 ? <Tarjeta titulo={t.deuda} valor={m(b.saldo.deuda)} /> : null}
      </div>
      {ctx.permisos.includes('finanzas.gestionar') && b.recargas.activas ? (
        <div className="fila-botones">
          <Enlace a={`${ctx.raiz}/wallet/topup`} className="boton">
            {t.recargar}
          </Enlace>
        </div>
      ) : null}
      <h2>{t.tarifa}</h2>
      <p>
        {b.tarifa
          ? textoTarifa(t, b.tarifa.regla, b.saldo.moneda, ctx.idioma === 'en' ? 'en' : 'es')
          : t.sinTarifa}
        {b.tarifa && b.tarifa.descuentoPb > 0
          ? ` · ${t.descuento}: ${b.tarifa.descuentoPb / 100} %`
          : ''}
      </p>
      <h2>{t.movimientos}</h2>
      {mov === null ? (
        <p role="status">{ctx.t.cargando}</p>
      ) : mov.length === 0 ? (
        <p>{t.sinMovimientos}</p>
      ) : (
        <ul className="flex-movimientos">
          {mov.map((x) => (
            <li key={x.id}>
              <span>
                <strong>{t.tipos[x.tipo] ?? x.tipo}</strong>
                <small>
                  {x.creadoEn} · {t.bolsillos[x.bolsillo] ?? x.bolsillo}
                </small>
              </span>
              <span className={x.monto >= 0 && x.bolsillo === 'prepago' ? 'texto-exito' : ''}>
                {x.monto >= 0 ? '+' : '−'}
                {m(Math.abs(x.monto))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type Cobro = { recargaId: string; clientSecret: string; clavePublica: string; monto: number };

function Recargar({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const { b, error: errorCarga, cargar } = useBilletera(ctx);
  const moneda = b?.saldo.moneda ?? ctx.empresa.moneda;
  const idioma = ctx.idioma === 'en' ? 'en' : 'es';
  const fb = useBorrador({
    formulario: `flex-recarga-${ctx.empresa.id}`,
    inicial: { elegido: '', otro: '', guardar: '' },
    almacen: almacenNavegador,
  });
  const [cobro, setCobro] = useState<Cobro | null>(null);
  // Una clave por intento de recarga: un doble clic no abre dos cobros.
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [final, setFinal] = useState<{
    tipo: 'esperando' | 'acreditada' | 'pendiente';
    saldo?: number;
  } | null>(null);
  if (!b) return <p role={errorCarga ? 'alert' : 'status'}>{errorCarga || ctx.t.cargando}</p>;
  if (!b.recargas.activas) return <p className="pista">{t.noActivas}</p>;
  const m = (x: number) => formatearMonto(x, moneda, idioma);
  const monto =
    fb.valores.elegido === 'otro'
      ? textoAMonto(fb.valores.otro, moneda)
      : Number(fb.valores.elegido);
  const valido =
    Number.isSafeInteger(monto) && monto >= b.recargas.minimo && monto <= b.recargas.maximo;

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!valido)
      return setError(
        t.limites.replace('{min}', m(b!.recargas.minimo)).replace('{max}', m(b!.recargas.maximo)),
      );
    try {
      const r = await pedir<{
        recarga: { id: string };
        clientSecret: string;
        clavePublica: string;
      }>(
        'POST',
        `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/recargas`,
        { monto, guardarMetodo: fb.valores.guardar === '1' },
        { cabeceras: { 'idempotency-key': clave } },
      );
      setCobro({
        recargaId: r.recarga.id,
        clientSecret: r.clientSecret,
        clavePublica: r.clavePublica,
        monto,
      });
    } catch (x) {
      setError(mensajeDe(x));
    }
  }

  /** Tras pagar, se pregunta al SERVIDOR (que solo acredita con el aviso de Stripe). */
  async function esperarConfirmacion(recargaId: string) {
    setFinal({ tipo: 'esperando' });
    for (let i = 0; i < 30; i++) {
      const r = await pedir<{ recarga: { estado: string } }>(
        'GET',
        `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/recargas/${recargaId}`,
      ).catch(() => null);
      if (r?.recarga.estado === 'acreditada') {
        const nb = await pedir<Billetera>(
          'GET',
          `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera`,
        ).catch(() => null);
        await fb.limpiar();
        setFinal({ tipo: 'acreditada', saldo: nb?.saldo.disponible });
        cargar();
        return;
      }
      await new Promise((ok) => setTimeout(ok, 2000));
    }
    setFinal({ tipo: 'pendiente' });
  }

  if (final)
    return (
      <div className="flex-tarjeta" role="status">
        {final.tipo === 'esperando' ? (
          <p>{t.esperando}</p>
        ) : final.tipo === 'acreditada' ? (
          <p className="texto-exito">
            {t.acreditada} {final.saldo !== undefined ? m(final.saldo) : ''}
          </p>
        ) : (
          <p>{t.pendienteLargo}</p>
        )}
        {final.tipo !== 'esperando' ? (
          <div className="fila-botones">
            <Enlace a={`${ctx.raiz}/wallet`} className="boton secundario">
              {t.pestanas['']}
            </Enlace>
          </div>
        ) : null}
      </div>
    );

  if (cobro)
    return (
      <div className="flex-tarjeta">
        <p>
          <strong>
            {t.importe}: {m(cobro.monto)}
          </strong>
        </p>
        <FormularioPago
          cobro={cobro}
          t={t}
          idioma={idioma}
          moneda={moneda}
          alPagar={() => void esperarConfirmacion(cobro.recargaId)}
        />
        <div className="fila-botones">
          <button
            type="button"
            className="boton secundario"
            onClick={() => {
              setCobro(null);
              setClave(crypto.randomUUID());
            }}
          >
            {t.cambiarImporte}
          </button>
        </div>
        <p className="pista">{t.pagoSeguro}</p>
      </div>
    );

  return (
    <>
      {fb.recuperado && (
        <p className="aviso-borrador">
          {ctx.t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void fb.empezarDeNuevo()}>
            {ctx.t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form className="flex-form" noValidate onSubmit={(e) => void continuar(e)}>
        <fieldset className="flex-importes">
          <legend>{t.importe}</legend>
          {b.recargas.sugeridos.map((s) => (
            <label
              key={s}
              className={`flex-importe${fb.valores.elegido === String(s) ? ' activo' : ''}`}
            >
              <input
                type="radio"
                name="importe"
                value={String(s)}
                checked={fb.valores.elegido === String(s)}
                onChange={() => fb.cambiar('elegido', String(s))}
              />
              {m(s)}
            </label>
          ))}
          <label className={`flex-importe${fb.valores.elegido === 'otro' ? ' activo' : ''}`}>
            <input
              type="radio"
              name="importe"
              value="otro"
              checked={fb.valores.elegido === 'otro'}
              onChange={() => fb.cambiar('elegido', 'otro')}
            />
            {t.otroImporte}
          </label>
        </fieldset>
        {fb.valores.elegido === 'otro' ? (
          <Campo
            etiqueta={t.otroImporte}
            valor={fb.valores.otro}
            cambiar={(v) => fb.cambiar('otro', v)}
            placeholder={montoATexto(b.recargas.minimo, moneda)}
          />
        ) : null}
        <p className="pista">
          {t.limites.replace('{min}', m(b.recargas.minimo)).replace('{max}', m(b.recargas.maximo))}
        </p>
        {b.recargas.automaticaPermitida ? (
          <label>
            <input
              type="checkbox"
              checked={fb.valores.guardar === '1'}
              onChange={(e) => fb.cambiar('guardar', e.target.checked ? '1' : '')}
            />{' '}
            {t.guardarTarjeta}
          </label>
        ) : null}
        <Aviso error={error} />
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={!fb.valores.elegido}>
            {t.continuar}
          </button>
        </div>
      </form>
      <RecargasRecientes ctx={ctx} />
    </>
  );
}

function FormularioPago(p: {
  cobro: Cobro;
  t: TB;
  idioma: 'es' | 'en';
  moneda: string;
  alPagar: () => void;
}) {
  const [intento, setIntento] = useState(0);
  const stripe = useMemo(
    () =>
      loadStripe(p.cobro.clavePublica).catch((e: unknown) => {
        console.error('pago: Stripe no cargó', e);
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- «intento» fuerza la recarga
    [p.cobro.clavePublica, intento],
  );
  return (
    <Elements
      key={intento}
      stripe={stripe}
      options={{
        clientSecret: p.cobro.clientSecret,
        locale: p.idioma,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#F20D20',
            colorText: '#101010',
            colorBackground: '#FFFFFF',
            borderRadius: '10px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          },
        },
      }}
    >
      <PagoInterno {...p} reintentar={() => setIntento((n) => n + 1)} />
    </Elements>
  );
}

function PagoInterno({
  cobro,
  t,
  idioma,
  moneda,
  alPagar,
  reintentar,
}: {
  cobro: Cobro;
  t: TB;
  idioma: 'es' | 'en';
  moneda: string;
  alPagar: () => void;
  reintentar: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (listo || error) return;
    const reloj = setTimeout(() => setError(t.sinFormulario), 20_000);
    return () => clearTimeout(reloj);
  }, [listo, error, t.sinFormulario]);
  async function pagar() {
    if (!stripe || !elements) return;
    setError('');
    setPagando(true);
    const r = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.href.split('?')[0]}?recarga=${cobro.recargaId}`,
      },
    });
    setPagando(false);
    if (r.error) return setError(`${t.rechazada}: ${r.error.message ?? ''}`);
    alPagar();
  }
  return (
    <>
      <div className="flex-pago">
        <PaymentElement
          onReady={() => setListo(true)}
          onLoadError={() => setError(t.sinFormulario)}
        />
      </div>
      <Aviso error={error} />
      <div className="fila-botones">
        {error === t.sinFormulario ? (
          <button type="button" className="boton secundario" onClick={reintentar}>
            {t.reintentar}
          </button>
        ) : null}
        <button
          type="button"
          className="boton"
          disabled={!listo || pagando}
          onClick={() => void pagar()}
        >
          {pagando ? t.pagando : `${t.pagar} ${formatearMonto(cobro.monto, moneda, idioma)}`}
        </button>
      </div>
    </>
  );
}

function RecargasRecientes({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const [lista, setLista] = useState<
    | {
        id: string;
        monto: number;
        moneda: string;
        estado: string;
        automatica: boolean;
        motivo: string;
        creadoEn: string;
      }[]
    | null
  >(null);
  useEffect(() => {
    void pedir<{ recargas: NonNullable<typeof lista> }>(
      'GET',
      `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/recargas`,
    )
      .then((r) => setLista(r.recargas.slice(0, 10)))
      .catch(() => setLista([]));
  }, [ctx.empresa.id]);
  if (!lista?.length) return null;
  return (
    <>
      <h2>{t.recargasRecientes}</h2>
      <ul className="flex-movimientos">
        {lista.map((r) => (
          <li key={r.id}>
            <span>
              <strong>
                {formatearMonto(r.monto, r.moneda, ctx.idioma === 'en' ? 'en' : 'es')}
              </strong>
              <small>
                {r.creadoEn}
                {r.automatica ? ` · ${t.automatica}` : ''}
                {r.motivo ? ` · ${r.motivo}` : ''}
              </small>
            </span>
            <span
              className={`insignia ${r.estado === 'acreditada' ? 'insignia-aprobado' : r.estado === 'fallida' ? 'insignia-rechazado' : ''}`}
            >
              {t.estadosRecarga[r.estado] ?? r.estado}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function FiltroFechas({
  ctx,
  formulario,
  alVer,
  extra,
}: {
  ctx: Contexto;
  formulario: string;
  alVer: (desde: string, hasta: string, tipo: string) => void;
  extra?: { opciones: [string, string][] };
}) {
  const t = textos(ctx);
  const fb = useBorrador({
    formulario,
    inicial: { desde: '', hasta: '', tipo: '' },
    almacen: almacenNavegador,
  });
  return (
    <>
      {fb.recuperado && (
        <p className="aviso-borrador">
          {ctx.t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void fb.empezarDeNuevo()}>
            {ctx.t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form
        className="flex-form flex-inline"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          alVer(fb.valores.desde, fb.valores.hasta, fb.valores.tipo);
        }}
      >
        <Campo
          etiqueta={t.desde}
          tipo="date"
          valor={fb.valores.desde}
          cambiar={(v) => fb.cambiar('desde', v)}
        />
        <Campo
          etiqueta={t.hasta}
          tipo="date"
          valor={fb.valores.hasta}
          cambiar={(v) => fb.cambiar('hasta', v)}
        />
        {extra ? (
          <div className="campo">
            <label htmlFor={`${formulario}-tipo`}>{t.todos}</label>
            <select
              id={`${formulario}-tipo`}
              value={fb.valores.tipo}
              onChange={(e) => fb.cambiar('tipo', e.target.value)}
            >
              <option value="">{t.todos}</option>
              {extra.opciones.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.ver}
          </button>
        </div>
      </form>
    </>
  );
}

function Comisiones({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const idioma = ctx.idioma === 'en' ? 'en' : 'es';
  const [d, setD] = useState<{
    periodo: { desde: string; hasta: string };
    totalCobrado: number;
    paquetesFacturados: number;
    rutas: {
      cobroId: string;
      rutaId: string;
      ruta: string;
      tarifaUnitaria: number;
      moneda: string;
      estado: string;
      cobrado: number;
      paquetesFacturados: number;
      creadoEn: string;
    }[];
  } | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(
    (desde = '', hasta = '') => {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      pedir<NonNullable<typeof d>>(
        'GET',
        `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/comisiones?${q.toString()}`,
      )
        .then(setD)
        .catch((x: unknown) => setError(mensajeDe(x)));
    },
    [ctx.empresa.id],
  );
  useEffect(() => cargar(), [cargar]);
  const moneda = ctx.empresa.moneda;
  const m = (x: number) => formatearMonto(x, moneda, idioma);
  return (
    <>
      <FiltroFechas
        ctx={ctx}
        formulario={`flex-comisiones-${ctx.empresa.id}`}
        alVer={(a, b) => cargar(a, b)}
      />
      <Aviso error={error} />
      {!d ? (
        <p role="status">{ctx.t.cargando}</p>
      ) : (
        <>
          <p className="pista">
            {d.periodo.desde} → {d.periodo.hasta}
          </p>
          <div className="flex-kpis">
            <Tarjeta titulo={t.totalCobrado} valor={m(d.totalCobrado)} destacado />
            <Tarjeta titulo={t.paquetesFacturados} valor={String(d.paquetesFacturados)} />
          </div>
          {d.rutas.length === 0 ? (
            <p>{t.sinComisiones}</p>
          ) : (
            <ul className="flex-movimientos">
              {d.rutas.map((r) => (
                <li key={r.cobroId}>
                  <span>
                    <Enlace a={`${ctx.raiz}/operativas/${r.rutaId}`}>
                      <strong>{r.ruta || r.rutaId.slice(0, 8)}</strong>
                    </Enlace>
                    <small>
                      {r.creadoEn} · {r.paquetesFacturados} × {m(r.tarifaUnitaria)} ·{' '}
                      {t.estadoCobro[r.estado] ?? r.estado}
                    </small>
                  </span>
                  <span>{m(r.cobrado)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

type FilaComprobante = {
  id: string;
  numero: string;
  tipo: string;
  monto: number;
  moneda: string;
  creadoEn: string;
  datos: Record<string, unknown>;
};

function Comprobantes({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const idioma = ctx.idioma === 'en' ? 'en' : 'es';
  const [lista, setLista] = useState<FilaComprobante[] | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(
    (desde = '', hasta = '', tipo = '') => {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (tipo) q.set('tipo', tipo);
      pedir<{ comprobantes: FilaComprobante[] }>(
        'GET',
        `${BASE_FLEX}/empresas/${ctx.empresa.id}/comprobantes?${q.toString()}`,
      )
        .then((r) => setLista(r.comprobantes))
        .catch((x: unknown) => setError(mensajeDe(x)));
    },
    [ctx.empresa.id],
  );
  useEffect(() => cargar(), [cargar]);
  return (
    <>
      <FiltroFechas
        ctx={ctx}
        formulario={`flex-comprobantes-${ctx.empresa.id}`}
        alVer={cargar}
        extra={{ opciones: Object.entries(t.tiposComprobante) }}
      />
      <Aviso error={error} />
      {lista === null ? (
        <p role="status">{ctx.t.cargando}</p>
      ) : lista.length === 0 ? (
        <p>{t.sinComprobantes}</p>
      ) : (
        <ul className="flex-movimientos">
          {lista.map((x) => (
            <li key={x.id}>
              <span>
                <strong>{x.numero}</strong>
                <small>
                  {x.creadoEn} · {t.tiposComprobante[x.tipo] ?? x.tipo}
                </small>
              </span>
              <span>
                {formatearMonto(x.monto, x.moneda, idioma)}{' '}
                <Enlace a={`${ctx.raiz}/wallet/receipts/${x.id}`}>{t.detalle}</Enlace>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Comprobante({ ctx, id }: { ctx: Contexto; id: string }) {
  const t = textos(ctx);
  const idioma = ctx.idioma === 'en' ? 'en' : 'es';
  const [d, setD] = useState<{
    comprobante: FilaComprobante;
    empresa: { nombre: string; razon_social: string; pais: string };
    emisor: { nombre: string };
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void pedir<NonNullable<typeof d>>(
      'GET',
      `${BASE_FLEX}/empresas/${ctx.empresa.id}/comprobantes/${id}`,
    )
      .then(setD)
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [ctx.empresa.id, id]);
  if (!d) return <p role={error ? 'alert' : 'status'}>{error || ctx.t.cargando}</p>;
  const c = d.comprobante;
  return (
    <>
      <p className="flex-no-imprimir">
        <Enlace a={`${ctx.raiz}/wallet/receipts`}>{t.volver}</Enlace>
      </p>
      <article className="flex-comprobante">
        <header>
          <img src="/marca/divoox-logo.svg" alt="Divoox" width={130} height={32} />
          <div>
            <strong>{t.tiposComprobante[c.tipo] ?? c.tipo}</strong>
            <span>{c.numero}</span>
          </div>
        </header>
        <dl>
          <dt>{t.fecha}</dt>
          <dd>{c.creadoEn} UTC</dd>
          <dt>{t.cliente}</dt>
          <dd>{d.empresa.razon_social || d.empresa.nombre}</dd>
          <dt>{t.emitido}</dt>
          <dd>{d.emisor.nombre}</dd>
          {typeof c.datos.ruta === 'string' && c.datos.ruta ? (
            <>
              <dt>{t.ruta}</dt>
              <dd>{c.datos.ruta}</dd>
            </>
          ) : null}
          {typeof c.datos.paquetesFacturados === 'number' ? (
            <>
              <dt>{t.paquetesFacturados}</dt>
              <dd>{c.datos.paquetesFacturados}</dd>
            </>
          ) : null}
          <dt>{t.monto}</dt>
          <dd className="flex-comprobante-monto">{formatearMonto(c.monto, c.moneda, idioma)}</dd>
        </dl>
        <p className="pista">{t.noFiscal}</p>
      </article>
      <div className="fila-botones flex-no-imprimir">
        <button type="button" className="boton" onClick={() => window.print()}>
          {t.imprimir}
        </button>
      </div>
    </>
  );
}

function ConfigBilletera({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const { b, error: errorCarga, cargar } = useBilletera(ctx);
  const moneda = b?.saldo.moneda ?? ctx.empresa.moneda;
  const fb = useBorrador({
    formulario: `flex-billetera-config-${ctx.empresa.id}`,
    inicial: { alerta: '', correo: '1', auto: '', umbral: '', monto: '' },
    almacen: almacenNavegador,
  });
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const { cargarBase } = fb;
  useEffect(() => {
    if (!b) return;
    const c = b.config;
    const txt = (x: number | null) => (x === null ? '' : montoATexto(x, moneda));
    cargarBase({
      alerta: txt(c.alertaSaldo),
      correo: c.avisosCorreo ? '1' : '',
      auto: c.recargaAutomatica.activa ? '1' : '',
      umbral: txt(c.recargaAutomatica.umbral),
      monto: txt(c.recargaAutomatica.monto),
    });
  }, [b, moneda, cargarBase]);
  if (!b) return <p role={errorCarga ? 'alert' : 'status'}>{errorCarga || ctx.t.cargando}</p>;
  const aMonto = (s: string) => (s.trim() === '' ? null : textoAMonto(s, moneda));
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('PUT', `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/config`, {
        alertaSaldo: aMonto(fb.valores.alerta),
        avisosCorreo: fb.valores.correo === '1',
        recargaAutomatica: {
          activa: fb.valores.auto === '1',
          umbral: aMonto(fb.valores.umbral),
          monto: aMonto(fb.valores.monto),
        },
      });
      await fb.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <>
      {fb.recuperado && (
        <p className="aviso-borrador">
          {ctx.t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void fb.empezarDeNuevo()}>
            {ctx.t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form className="flex-form" noValidate onSubmit={(e) => void guardar(e)}>
        <Campo
          etiqueta={t.alerta}
          valor={fb.valores.alerta}
          cambiar={(v) => fb.cambiar('alerta', v)}
          placeholder="0.00"
        />
        <label>
          <input
            type="checkbox"
            checked={fb.valores.correo === '1'}
            onChange={(e) => fb.cambiar('correo', e.target.checked ? '1' : '')}
          />{' '}
          {t.avisosCorreo}
        </label>
        <h2>{t.auto}</h2>
        {!b.recargas.automaticaPermitida ? (
          <p className="pista">{t.autoNoPermitida}</p>
        ) : (
          <>
            <p className="pista">{t.autoAyuda}</p>
            <p>
              {t.tarjeta}: <strong>{b.config.metodoGuardado ?? '—'}</strong>
            </p>
            {!b.config.metodoGuardado ? <p className="pista">{t.sinTarjeta}</p> : null}
            <label>
              <input
                type="checkbox"
                disabled={!b.config.metodoGuardado}
                checked={fb.valores.auto === '1'}
                onChange={(e) => fb.cambiar('auto', e.target.checked ? '1' : '')}
              />{' '}
              {t.activar}
            </label>
            {fb.valores.auto === '1' ? (
              <div className="flex-inline">
                <Campo
                  etiqueta={t.umbral}
                  valor={fb.valores.umbral}
                  cambiar={(v) => fb.cambiar('umbral', v)}
                  placeholder="0.00"
                />
                <Campo
                  etiqueta={t.montoAuto}
                  valor={fb.valores.monto}
                  cambiar={(v) => fb.cambiar('monto', v)}
                  placeholder="0.00"
                />
              </div>
            ) : null}
          </>
        )}
        <Aviso error={error} />
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.guardar}
          </button>
          {b.config.metodoGuardado ? (
            <div className="menu-tres-puntos">
              <button
                type="button"
                className="boton secundario"
                aria-label={t.masOpciones}
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                ⋮
              </button>
              {menu ? (
                <div role="menu" className="cuenta-menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="peligro"
                    onClick={() => {
                      setMenu(false);
                      if (window.confirm(t.confirmarQuitar))
                        void pedir(
                          'POST',
                          `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/metodo/quitar`,
                          {},
                        )
                          .then(cargar)
                          .catch((x: unknown) => setError(mensajeDe(x)));
                    }}
                  >
                    {t.quitarTarjeta}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>
    </>
  );
}
