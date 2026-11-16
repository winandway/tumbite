import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { textoPendiente } from './SuperAprobaciones';
import { Hora } from './horario';
import { usePermisos } from './permisosPanel';
import { AyudaAqui } from './AyudaAqui';

/**
 * C-AUTORIZACION-VENCIDA (16 nov 2026) — todos los países con tarjeta. En la ficha del pedido, solo
 * cuando la entrega quedó en revisión: el estado REAL del pago en Stripe y las dos salidas, volver a
 * cobrar con la tarjeta guardada (si el cliente lo permitió al pagar) o cerrar sin cobro con nota.
 * El servidor decide (permiso, zona, control dual); aquí solo se ofrece lo que se puede usar.
 */
const T = {
  es: {
    titulo: 'El cobro de esta entrega quedó en revisión',
    ayuda:
      'La tarjeta se autorizó al pedir y se cobra al entregar. Si pasan más días de los que el banco guarda la autorización, ya no se puede capturar. Revisa el estado real del pago y decide.',
    abrir: 'Resolver autorización vencida',
    cargando: 'Consultando el pago…',
    estadoStripe: 'Estado del pago con tarjeta',
    estados: {
      canceled: 'Vencido (ya no se puede capturar)',
      requires_capture: 'Autorizado, todavía vigente',
      succeeded: 'Cobrado',
    } as Record<string, string>,
    autorizado: 'Autorizado',
    vencioEn: 'Se soltó',
    capturarAntes: 'Había que capturarlo antes de',
    tarjeta: 'Tarjeta guardada',
    sinTarjeta: 'No hay tarjeta guardada',
    permiso: 'Permiso del cliente para cobros futuros',
    si: 'Sí, lo dio al pagar',
    no: 'No',
    monto: 'Monto de la entrega',
    avisos: {
      vigente: 'La autorización sigue vigente: no venció. Reintenta la captura desde «Dinero».',
      ya_cobrada: 'El pago ya figura cobrado: confírmalo desde «Dinero».',
      otro_estado: 'El pago está en un estado que no se resuelve aquí. Revísalo en «Dinero».',
      sin_pago: 'Esta entrega no tiene un pago con tarjeta.',
      sin_stripe: 'Los pagos con tarjeta no están configurados.',
      stripe_no_responde: 'No pudimos consultar el pago. Intenta de nuevo en un momento.',
      cobro_en_curso:
        'El banco está procesando el cobro de reemplazo. Vuelve a abrir la ficha en unos minutos: no lo repitas ni lo cierres sin cobro.',
    } as Record<string, string>,
    motivos: {
      no_es_tarjeta: 'Este pedido no se pagó con tarjeta.',
      sin_consentimiento:
        'No se puede volver a cobrar: cuando pagó, el cliente no dejó su tarjeta guardada para cobros futuros.',
      tarjeta_no_guardada:
        'No se puede volver a cobrar: el cliente ya no tiene guardada esa tarjeta.',
      otra_cuenta: 'No se puede volver a cobrar: la tarjeta no es de la cuenta de este cliente.',
      tarjeta_vencida: 'No se puede volver a cobrar: la tarjeta guardada ya venció.',
    } as Record<string, string>,
    opcionA: 'Volver a cobrar',
    opcionAAyuda:
      'Se cobra el monto de la entrega a la tarjeta guardada, sin pedirle nada al cliente. Por encima del límite del control dual, lo aprueba otra persona.',
    cobrar: 'Cobrar {m} a la tarjeta guardada',
    confirmarCobro: 'Sí, cobrar {m}',
    cancelar: 'Cancelar',
    opcionB: 'Cerrar sin cobro',
    opcionBAyuda:
      'Divoox asume el monto: no se le cobra al cliente y el restaurante y el repartidor conservan lo suyo. Queda en la bitácora con tu nombre y la nota.',
    nota: 'Nota (obligatoria): por qué se cierra sin cobro',
    notaCorta: 'Escribe una nota de al menos 5 letras.',
    cerrar: 'Cerrar sin cobro',
    cobroApagado:
      'Volver a cobrar está apagado hasta confirmar el texto legal; usa Cerrar sin cobro o habla con el cliente.',
    enCursoOk:
      'El banco está procesando el cobro. Vuelve a abrir la ficha en unos minutos para ver cómo terminó.',
    cobradoOk: 'Cobrado. La entrega salió de revisión y le avisamos al cliente por correo.',
    cobradoSinCorreo:
      'Cobrado. La entrega salió de revisión, pero el correo al cliente no salió: avísale tú del cobro.',
    cerradoOk: 'Cerrada sin cobro. La entrega salió de revisión.',
    sinPermiso:
      'Resolverla lo hace una cuenta con el permiso «Resolver autorizaciones de tarjeta vencidas» (Finanzas, Supervisor o Total).',
  },
  en: {
    titulo: 'This delivery’s charge is under review',
    ayuda:
      'The card is authorized when ordering and charged on delivery. If more days pass than the bank keeps the authorization, it can no longer be captured. Check the real payment status and decide.',
    abrir: 'Resolve expired authorization',
    cargando: 'Checking the payment…',
    estadoStripe: 'Card payment status',
    estados: {
      canceled: 'Expired (it can no longer be captured)',
      requires_capture: 'Authorized, still valid',
      succeeded: 'Charged',
    } as Record<string, string>,
    autorizado: 'Authorized',
    vencioEn: 'Released',
    capturarAntes: 'Had to be captured before',
    tarjeta: 'Saved card',
    sinTarjeta: 'No saved card',
    permiso: 'Customer permission for future charges',
    si: 'Yes, given when paying',
    no: 'No',
    monto: 'Delivery amount',
    avisos: {
      vigente:
        'The authorization is still valid: it didn’t expire. Retry the capture from «Money».',
      ya_cobrada: 'The payment already shows as charged: confirm it from «Money».',
      otro_estado: 'The payment is in a state that isn’t resolved here. Check it in «Money».',
      sin_pago: 'This delivery has no card payment.',
      sin_stripe: 'Card payments aren’t set up.',
      stripe_no_responde: 'We couldn’t check the payment. Try again in a moment.',
      cobro_en_curso:
        'The bank is processing the replacement charge. Reopen the order in a few minutes: don’t repeat it or close it without charging.',
    } as Record<string, string>,
    motivos: {
      no_es_tarjeta: 'This order wasn’t paid by card.',
      sin_consentimiento:
        'It can’t be charged again: when paying, the customer didn’t save their card for future charges.',
      tarjeta_no_guardada: 'It can’t be charged again: the customer no longer has that card saved.',
      otra_cuenta: 'It can’t be charged again: the card doesn’t belong to this customer’s account.',
      tarjeta_vencida: 'It can’t be charged again: the saved card has expired.',
    } as Record<string, string>,
    opcionA: 'Charge again',
    opcionAAyuda:
      'The delivery amount is charged to the saved card, without asking the customer for anything. Above the dual-control limit, someone else approves it.',
    cobrar: 'Charge {m} to the saved card',
    confirmarCobro: 'Yes, charge {m}',
    cancelar: 'Cancel',
    opcionB: 'Close without charging',
    opcionBAyuda:
      'Divoox covers the amount: the customer isn’t charged and the restaurant and the driver keep their share. It stays in the timeline with your name and the note.',
    nota: 'Note (required): why it’s closed without a charge',
    notaCorta: 'Write a note of at least 5 letters.',
    cerrar: 'Close without charging',
    cobroApagado:
      'Charge again is turned off until the legal wording is confirmed; use Close without charging or talk to the customer.',
    enCursoOk:
      'The bank is processing the charge. Reopen the order in a few minutes to see how it ended.',
    cobradoOk: 'Charged. The delivery is no longer under review and we emailed the customer.',
    cobradoSinCorreo:
      'Charged. The delivery is no longer under review, but the email to the customer didn’t go out: let them know about the charge.',
    cerradoOk: 'Closed without charging. The delivery is no longer under review.',
    sinPermiso:
      'It’s resolved by an account with the «Resolve expired card authorizations» permission (Finance, Supervisor or Full access).',
  },
};

type Estado = {
  liquidacion: { estado: string; monto: number; moneda: string };
  stripe: {
    estado: string;
    montoAutorizado: number;
    vencida: boolean;
    canceladaEn: string | null;
    capturarAntesDe: string | null;
    consentimiento: boolean;
    tarjeta: { marca: string; ultimos4: string; vence: string } | null;
  } | null;
  aviso: string | null;
  /** «Volver a cobrar» está detrás de un interruptor del servidor, apagado por defecto. */
  cobroEncendido: boolean;
  sePuedeResolver: boolean;
  sePuedeCobrar: boolean;
  motivoSinCobro: string | null;
};

const MARCAS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
};

export function ResolverAutorizacion({
  pedidoId,
  zona,
  idioma,
  alResolver,
}: {
  pedidoId: string;
  zona: string | null;
  idioma: Idioma;
  alResolver: () => void;
}) {
  const t = enIdioma(T, idioma);
  const { acceso, puedeVer } = usePermisos();
  const puede = puedeVer('dinero.resolver_autorizacion');
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: `cierre-sin-cobro-${pedidoId}`,
    cuenta: acceso?.id ?? 'equipo',
    inicial: { nota: '' },
    almacen: almacenNavegador,
  });
  const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : String(e));

  async function abrir() {
    setError('');
    setCargando(true);
    try {
      setEstado(
        await pedir<Estado>(
          'GET',
          `/datos/admin/liquidaciones/${encodeURIComponent(pedidoId)}/autorizacion`,
        ),
      );
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setCargando(false);
    }
  }

  async function decidir(accion: 'cobrar' | 'sin-cobro') {
    setError('');
    setOcupado(true);
    try {
      const r = await pedir(
        'POST',
        `/datos/admin/liquidaciones/${encodeURIComponent(pedidoId)}/autorizacion/${accion}`,
        accion === 'cobrar' ? {} : { nota: b.valores.nota },
      );
      const pendiente = textoPendiente(r, idioma);
      if (accion === 'sin-cobro') await b.limpiar();
      setConfirmar(false);
      const res = (r ?? {}) as { estado?: string; correoCliente?: boolean };
      setAviso(
        pendiente ??
          (res.estado === 'en_curso'
            ? t.enCursoOk
            : accion === 'sin-cobro'
              ? t.cerradoOk
              : res.correoCliente === false
                ? t.cobradoSinCorreo
                : t.cobradoOk),
      );
      if (!pendiente) alResolver();
    } catch (e) {
      // Lo escrito se queda: el servidor no confirmó (regla «ningún formulario pierde lo escrito»).
      setError(mensaje(e));
    } finally {
      setOcupado(false);
    }
  }

  const m = estado
    ? formatearMonto(estado.liquidacion.monto, estado.liquidacion.moneda, idioma)
    : '';
  const notaValida = b.valores.nota.trim().length >= 5;
  const s = estado?.stripe;
  const avisos = new Map(Object.entries(t.avisos));
  const motivos = new Map(Object.entries(t.motivos));
  const estados = new Map(Object.entries(t.estados));
  const marcas = new Map(Object.entries(MARCAS));
  return (
    <section className="tarjeta-form resolver-autorizacion" aria-labelledby="resolver-aut-titulo">
      <h2 id="resolver-aut-titulo">
        {t.titulo}
        <AyudaAqui guia="resolve-expired-card-authorization" idioma={idioma} />
      </h2>
      <p className="ficha-nota">{t.ayuda}</p>
      {aviso ? (
        <p className="ok" role="status">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {!estado ? (
        <button type="button" className="boton" disabled={cargando} onClick={() => void abrir()}>
          {cargando ? t.cargando : t.abrir}
        </button>
      ) : (
        <>
          <dl className="super-dl">
            <dt>{t.monto}</dt>
            <dd>{m}</dd>
            {s ? (
              <>
                <dt>{t.estadoStripe}</dt>
                <dd>{estados.get(s.estado) ?? s.estado}</dd>
                <dt>{t.autorizado}</dt>
                <dd>{formatearMonto(s.montoAutorizado, estado.liquidacion.moneda, idioma)}</dd>
                {s.capturarAntesDe ? (
                  <>
                    <dt>{t.capturarAntes}</dt>
                    <dd>
                      <Hora fecha={s.capturarAntesDe} zona={zona} idioma={idioma} />
                    </dd>
                  </>
                ) : null}
                {s.canceladaEn ? (
                  <>
                    <dt>{t.vencioEn}</dt>
                    <dd>
                      <Hora fecha={s.canceladaEn} zona={zona} idioma={idioma} />
                    </dd>
                  </>
                ) : null}
                <dt>{t.tarjeta}</dt>
                <dd>
                  {s.tarjeta
                    ? `${marcas.get(s.tarjeta.marca) ?? s.tarjeta.marca} ···· ${s.tarjeta.ultimos4}`
                    : t.sinTarjeta}
                </dd>
                <dt>{t.permiso}</dt>
                <dd>{s.consentimiento ? t.si : t.no}</dd>
              </>
            ) : null}
          </dl>
          {estado.aviso ? (
            <p className="ficha-nota" role="status">
              {avisos.get(estado.aviso) ?? estado.aviso}
            </p>
          ) : null}
          {estado.sePuedeResolver && !puede ? <p className="ficha-nota">{t.sinPermiso}</p> : null}
          {estado.sePuedeResolver && puede && !aviso ? (
            <div className="resolver-opciones">
              <div className="resolver-opcion">
                <h3>{t.opcionA}</h3>
                {!estado.cobroEncendido ? (
                  <p className="ficha-nota">{t.cobroApagado}</p>
                ) : estado.sePuedeCobrar ? (
                  <>
                    <p className="ficha-nota">{t.opcionAAyuda}</p>
                    {confirmar ? (
                      <div className="super-acciones-fila">
                        <button
                          type="button"
                          className="boton"
                          disabled={ocupado}
                          onClick={() => void decidir('cobrar')}
                        >
                          {t.confirmarCobro.replace('{m}', m)}
                        </button>{' '}
                        <button
                          type="button"
                          className="boton secundario"
                          disabled={ocupado}
                          onClick={() => setConfirmar(false)}
                        >
                          {t.cancelar}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="boton" onClick={() => setConfirmar(true)}>
                        {t.cobrar.replace('{m}', m)}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="ficha-nota">
                    {motivos.get(estado.motivoSinCobro ?? '') ?? estado.motivoSinCobro}
                  </p>
                )}
              </div>
              <div className="resolver-opcion">
                <h3>{t.opcionB}</h3>
                <p className="ficha-nota">{t.opcionBAyuda}</p>
                <AvisoBorrador
                  visible={b.recuperado}
                  idioma={idioma}
                  empezar={() => void b.empezarDeNuevo()}
                />
                <form
                  className="formulario"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (notaValida) void decidir('sin-cobro');
                  }}
                >
                  <label>
                    {t.nota}
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={b.valores.nota}
                      onChange={(e) => b.cambiar('nota', e.target.value)}
                    />
                  </label>
                  {!notaValida ? <p className="ficha-nota">{t.notaCorta}</p> : null}
                  <button
                    type="submit"
                    className="boton secundario"
                    disabled={ocupado || !notaValida}
                  >
                    {t.cerrar}
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
