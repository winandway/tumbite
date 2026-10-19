import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

/**
 * C-BANDEJA-DINERO: la bandeja de soporte del cobro en mano. Los casos salen de los pedidos, del
 * libro, de las recargas y de las incidencias; aquí soporte los toma, deja notas con evidencia y
 * los resuelve. Lo que es una decisión de Richard (quién absorbe la comida, plazos, tolerancias)
 * no tiene botón: el caso queda abierto con su nota.
 */
type Caso = {
  clave: string;
  tipo: string;
  estado: 'abierto' | 'en_revision' | 'resuelto';
  responsable: { id: string; nombre: string } | null;
  pedidoId: string | null;
  pais: string | null;
  moneda: string;
  montos: Record<string, number>;
  participantes: { cliente: string | null; repartidor: string | null; restaurante: string | null };
  detalle: string;
  detalleEn?: string;
  creadoEn: string;
  acciones: string[];
  esperaDecision?: string | null;
};
type Detalle = {
  caso: Caso;
  historial: { accion: string; nota: string; autor: string | null; en: string }[];
  bitacora: { evento: string; detalle: string; en: string }[];
  libro: { concepto: string; monto: number; bolsillo?: string; moneda?: string }[];
  evidencias: string[];
};

const T = {
  es: {
    titulo: 'Cobro en mano: casos para soporte',
    ayuda:
      'Transferencias por verificar, diferencias, excedentes, comida pagada y no entregada, pagos en el local sin confirmar y recargas con incidencias. Nada se borra: cada acción queda escrita.',
    todos: 'Todos',
    resueltos: 'Ver también los resueltos',
    vacio: 'No hay casos abiertos.',
    volver: '← Casos',
    pedido: 'Pedido',
    cliente: 'Cliente',
    repartidor: 'Repartidor',
    restaurante: 'Restaurante',
    responsable: 'Responsable',
    sinResponsable: 'Sin asignar',
    historial: 'Historial de soporte',
    bitacora: 'Bitácora del pedido',
    libro: 'Libro del pedido',
    evidencias: 'Evidencias',
    nota: 'Qué pasó y con qué evidencia',
    sinHistorial: 'Todavía nadie tocó este caso.',
    esperaDecision: 'Espera la decisión de Richard',
    tipos: {
      transferencia: 'Transferencia por verificar',
      diferencia: 'Diferencia',
      excedente: 'Excedente del cliente',
      comida: 'Comida pagada y no entregada',
      local: 'Pago en el local sin confirmar',
      incidencia: 'Incidencia de dinero',
      recarga_disputada: 'Recarga disputada',
      recarga_pendiente: 'Recarga sin confirmar',
    } as Record<string, string>,
    estados: { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto' } as Record<
      string,
      string
    >,
    acciones: {
      tomar: 'Tomar el caso',
      nota: 'Guardar nota',
      resolver: 'Marcar resuelto',
      excedente_devuelto: 'El repartidor ya lo devolvió',
      confirmar_restaurante: 'El restaurante confirmó el pago',
    } as Record<string, string>,
    montos: {
      esperado: 'Esperado',
      recibido: 'Recibido',
      cobroEsperado: 'Cobro esperado',
      cobroRecibido: 'Cobro recibido',
      faltante: 'Faltante',
      pagoLocalEsperado: 'Pago en el local esperado',
      pagoLocalPagado: 'Pagado en el local',
      ticket: 'Ticket',
      comida: 'Comida',
      diferenciaPago: 'Diferencia del pago',
      diferenciaTicket: 'Diferencia del ticket',
      porDevolver: 'Por devolver al cliente',
      pagadoPorRepartidor: 'Pagado por el repartidor',
      pagado: 'Pagado',
      disputado: 'Disputado',
      recarga: 'Recarga',
      monto: 'Monto',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Paid in person: cases for support',
    ayuda:
      'Transfers to verify, differences, customer overpayments, food paid for and not delivered, unconfirmed store payments and top-ups with issues. Nothing is deleted: every action is recorded.',
    todos: 'All',
    resueltos: 'Also show resolved',
    vacio: 'No open cases.',
    volver: '← Cases',
    pedido: 'Order',
    cliente: 'Customer',
    repartidor: 'Driver',
    restaurante: 'Restaurant',
    responsable: 'Owner',
    sinResponsable: 'Unassigned',
    historial: 'Support history',
    bitacora: 'Order log',
    libro: 'Order ledger',
    evidencias: 'Evidence',
    nota: 'What happened and what evidence you have',
    sinHistorial: 'Nobody has worked on this case yet.',
    esperaDecision: 'Waiting for Richard’s decision',
    tipos: {
      transferencia: 'Transfer to verify',
      diferencia: 'Difference',
      excedente: 'Customer overpayment',
      comida: 'Food paid for, not delivered',
      local: 'Store payment not confirmed',
      incidencia: 'Money issue',
      recarga_disputada: 'Disputed top-up',
      recarga_pendiente: 'Unconfirmed top-up',
    } as Record<string, string>,
    estados: { abierto: 'Open', en_revision: 'In review', resuelto: 'Resolved' } as Record<
      string,
      string
    >,
    acciones: {
      tomar: 'Take the case',
      nota: 'Save note',
      resolver: 'Mark resolved',
      excedente_devuelto: 'The driver already returned it',
      confirmar_restaurante: 'The restaurant confirmed the payment',
    } as Record<string, string>,
    montos: {
      esperado: 'Expected',
      recibido: 'Received',
      cobroEsperado: 'Expected payment',
      cobroRecibido: 'Payment received',
      faltante: 'Missing',
      pagoLocalEsperado: 'Expected store payment',
      pagoLocalPagado: 'Paid at the store',
      ticket: 'Receipt',
      comida: 'Food',
      diferenciaPago: 'Payment difference',
      diferenciaTicket: 'Receipt difference',
      porDevolver: 'To return to the customer',
      pagadoPorRepartidor: 'Paid by the driver',
      pagado: 'Paid',
      disputado: 'Disputed',
      recarga: 'Top-up',
      monto: 'Amount',
    } as Record<string, string>,
  },
};

const enc = (clave: string) => encodeURIComponent(clave);
const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k) ?? k;

function Montos({ c, idioma }: { c: Caso; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  return (
    <dl className="bandeja-montos">
      {Object.entries(c.montos)
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{de(t.montos, k)}</dt>
            <dd>{formatearMonto(v, c.moneda, idioma)}</dd>
          </div>
        ))}
    </dl>
  );
}

export function SuperBandeja({
  base,
  idioma,
  clave,
}: {
  base: string;
  idioma: Idioma;
  clave: string | null;
}) {
  const t = enIdioma(T, idioma);
  const [tipo, setTipo] = useState('');
  const [resueltos, setResueltos] = useState(false);
  const [lista, setLista] = useState<Caso[] | null>(null);
  useEffect(() => {
    if (clave) return;
    pedir<{ casos: Caso[] }>(
      'GET',
      `/datos/admin/bandeja-dinero?tipo=${tipo}${resueltos ? '&resueltos=1' : ''}`,
    )
      .then((r) => setLista(r.casos))
      .catch(() => setLista([]));
  }, [tipo, resueltos, clave]);
  if (clave) return <CasoDinero base={base} idioma={idioma} clave={clave} />;
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p className="como-nota">{t.ayuda}</p>
      <div className="super-filtros" role="tablist">
        {['', ...Object.keys(t.tipos)].map((v) => (
          <button
            key={v || 'todos'}
            type="button"
            role="tab"
            aria-selected={tipo === v}
            className={tipo === v ? 'activa' : undefined}
            onClick={() => setTipo(v)}
          >
            {v ? de(t.tipos, v) : t.todos}
          </button>
        ))}
      </div>
      <label className="casilla">
        <input
          type="checkbox"
          checked={resueltos}
          onChange={(e) => setResueltos(e.target.checked)}
        />{' '}
        {t.resueltos}
      </label>
      {lista?.length === 0 && <p>{t.vacio}</p>}
      <ul className="super-bandeja" data-testid="bandeja-dinero">
        {lista?.map((c) => (
          <li key={c.clave}>
            <Enlace a={`${base}/cash/${enc(c.clave)}`}>
              <span className="insignia">{de(t.tipos, c.tipo)}</span>{' '}
              <strong>{c.pedidoId ? `#${c.pedidoId.slice(0, 4).toUpperCase()}` : c.moneda}</strong>{' '}
              · {de(t.estados, c.estado)} · {c.responsable?.nombre ?? t.sinResponsable}
              {c.esperaDecision ? ` · ${t.esperaDecision}` : ''}
            </Enlace>
            <Montos c={c} idioma={idioma} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CasoDinero({ base, idioma, clave }: { base: string; idioma: Idioma; clave: string }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'bandeja-dinero-nota',
    cuenta: clave,
    inicial: { nota: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<Detalle>('GET', `/datos/admin/bandeja-dinero/${enc(clave)}`)
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [clave]);
  useEffect(cargar, [cargar]);

  async function hacer(accion: string) {
    setError('');
    try {
      await pedir('POST', `/datos/admin/bandeja-dinero/${enc(clave)}/acciones`, {
        accion,
        nota: b.valores.nota,
        // Una clave por intento: si la red repite la petición, el servidor no repite la acción.
        idempotencia: `${accion}-${crypto.randomUUID()}`,
      });
      if (accion !== 'tomar') await b.limpiar();
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!d) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const c = d.caso;
  return (
    <section className="super" data-testid="caso-dinero">
      <Enlace a={`${base}/cash`} className="docs-volver">
        {t.volver}
      </Enlace>
      <h1>
        {de(t.tipos, c.tipo)} · {de(t.estados, c.estado)}
      </h1>
      <p>{idioma === 'en' ? (c.detalleEn ?? c.detalle) : c.detalle}</p>
      {c.esperaDecision ? <p className="como-nota">{t.esperaDecision}</p> : null}
      <p>
        {c.pedidoId ? (
          <>
            {t.pedido}{' '}
            <Enlace a={`${base}/orders/${c.pedidoId}`}>
              #{c.pedidoId.slice(0, 4).toUpperCase()}
            </Enlace>
            {' · '}
          </>
        ) : null}
        {t.cliente}: {c.participantes.cliente ?? '—'} · {t.repartidor}:{' '}
        {c.participantes.repartidor ?? '—'} · {t.restaurante}: {c.participantes.restaurante ?? '—'}
      </p>
      <p>
        {t.responsable}: {c.responsable?.nombre ?? t.sinResponsable} · {c.moneda}
        {c.pais ? ` · ${c.pais}` : ''}
      </p>
      <Montos c={c} idioma={idioma} />
      {d.evidencias.length ? (
        <>
          <h2>{t.evidencias}</h2>
          <div className="kyc-fotos">
            {d.evidencias.map((u) => (
              <figure key={u}>
                <img src={u} alt={t.evidencias} loading="lazy" />
              </figure>
            ))}
          </div>
        </>
      ) : null}
      <h2>{t.historial}</h2>
      {d.historial.length ? (
        <ul>
          {d.historial.map((h, i) => (
            <li key={i}>
              {h.en} · {de(t.acciones, h.accion)} · {h.autor ?? '—'}
              {h.nota ? ` · ${h.nota}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="suave">{t.sinHistorial}</p>
      )}
      {d.bitacora.length ? (
        <>
          <h2>{t.bitacora}</h2>
          <ul>
            {d.bitacora.map((x, i) => (
              <li key={i}>
                {x.en} · {x.evento}
                {x.detalle ? ` · ${x.detalle}` : ''}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {d.libro.length ? (
        <>
          <h2>{t.libro}</h2>
          <ul>
            {d.libro.map((m, i) => (
              <li key={i}>
                {m.concepto} · {formatearMonto(Number(m.monto), m.moneda ?? c.moneda, idioma)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {c.estado !== 'resuelto' && (
        <form className="formulario tarjeta-form" onSubmit={(e) => e.preventDefault()} noValidate>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <label className="campo">
            <span>{t.nota}</span>
            <textarea
              rows={3}
              value={b.valores.nota}
              onChange={(e) => b.cambiar('nota', e.target.value)}
            />
          </label>
          {error && (
            <p className="error-general" role="alert">
              {error}
            </p>
          )}
          <div className="fila-botones">
            {c.acciones.map((a) => (
              <button
                key={a}
                type="button"
                className={a === 'resolver' ? 'boton' : 'boton secundario'}
                onClick={() => void hacer(a)}
              >
                {de(t.acciones, a)}
              </button>
            ))}
          </div>
        </form>
      )}
    </section>
  );
}
