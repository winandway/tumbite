import { useCallback, useEffect, useState } from 'react';
import { type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
import { pedir } from './api';

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
    conciliacion: 'Conciliación diaria (últimos 14 días)',
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
    conciliacion: 'Daily reconciliation (last 14 days)',
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
  const [base, setBase] = useState('');
  const [resultado, setResultado] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const [r, l, a, c] = await Promise.all([
      pedir<Retiros>('GET', '/datos/admin/retiros').catch(() => null),
      pedir<{ revision: Liquidacion[]; atrasadas: Liquidacion[] }>(
        'GET',
        '/datos/admin/liquidaciones',
      ).catch(() => null),
      pedir<{ abonos: Abono[] }>('GET', '/datos/admin/abonos-fallidos').catch(() => null),
      pedir<{ conciliaciones: Conciliacion[] }>('GET', '/datos/admin/conciliacion').catch(
        () => null,
      ),
    ]);
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
            .map((e) => `${e.estado} ${e.n} (${formatearDolares(e.monto, idioma)})`)
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
                      <td>{formatearDolares(l.monto, idioma)}</td>
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
                  <td>{formatearDolares(c.vendido, idioma)}</td>
                  <td>{formatearDolares(c.capturado, idioma)}</td>
                  <td>{formatearDolares(c.devuelto, idioma)}</td>
                  <td>{formatearDolares(c.abonado, idioma)}</td>
                  <td>{formatearDolares(c.retirado, idioma)}</td>
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
