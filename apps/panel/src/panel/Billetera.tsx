import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  dolaresACentavos,
  enIdioma,
  formatearDolares,
} from '@tumbite/compartido';
import { pedir } from './api';

type Mov = { id: string; pedidoId: string | null; monto: number; concepto: string; fecha: string };
type Resumen = {
  entregados: number;
  enCurso: number;
  cancelados: number;
  ventas: number;
  regalos: number;
  comision: number;
  neto: number;
};
type Datos = { saldo: number; movimientos: Mov[]; cuentaConectada: boolean; pagosActivos: boolean };

const T = {
  es: {
    titulo: 'Beneficios',
    saldo: 'Saldo disponible',
    conectar: 'Conectar mi cuenta bancaria',
    continuar: 'Terminar de conectar mi cuenta',
    conectarAyuda:
      'Tus datos bancarios se escriben en la página segura de Stripe. Tumbite nunca los ve.',
    retirar: 'Retirar',
    monto: 'Monto a retirar',
    retirado: 'Listo: el retiro va en camino a tu banco.',
    movimientos: 'Movimientos',
    vacio: 'Todavía no hay movimientos.',
    conceptos: {
      venta: 'Venta',
      entrega: 'Entrega',
      propina: 'Propina',
      retiro: 'Retiro',
      ajuste: 'Ajuste',
      regalo: 'Regalo a cliente',
    } as Record<string, string>,
    pedido: 'Pedido',
    montoMal: 'Escribe un monto como 25.00',
    hoy: 'Hoy',
    entregados: 'Pedidos entregados',
    ventas: 'Ventas',
    regalos: 'Regalos a clientes',
    comision: 'Comisión de Tumbite',
    neto: 'Te toca',
    enCurso: 'en curso',
    cancelados: 'cancelados',
  },
  en: {
    titulo: 'Earnings',
    saldo: 'Available balance',
    conectar: 'Connect my bank account',
    continuar: 'Finish connecting my account',
    conectarAyuda: 'You enter your bank details on Stripe’s secure page. Tumbite never sees them.',
    retirar: 'Cash out',
    monto: 'Amount to cash out',
    retirado: 'Done: your cash-out is on its way to your bank.',
    movimientos: 'Activity',
    vacio: 'No activity yet.',
    conceptos: {
      venta: 'Sale',
      entrega: 'Delivery',
      propina: 'Tip',
      retiro: 'Cash-out',
      ajuste: 'Adjustment',
      regalo: 'Customer gift',
    } as Record<string, string>,
    pedido: 'Order',
    montoMal: 'Enter an amount like 25.00',
    hoy: 'Today',
    entregados: 'Orders delivered',
    ventas: 'Sales',
    regalos: 'Customer gifts',
    comision: 'Tumbite commission',
    neto: 'Your payout',
    enCurso: 'in progress',
    cancelados: 'canceled',
  },
};

export function Billetera({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Datos | null>(null);
  const [hoy, setHoy] = useState<Resumen | null>(null);
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = () =>
    pedir<Datos>('GET', '/datos/billetera')
      .then(setD)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  useEffect(() => {
    void cargar();
    pedir<{ resumen: Resumen }>('GET', '/datos/restaurante/resumen')
      .then((r) => setHoy(r.resumen))
      .catch(() => setHoy(null));
  }, []);

  async function conectar() {
    setError('');
    try {
      const r = await pedir<{ url: string }>('POST', '/datos/billetera/conectar', {});
      window.location.href = r.url;
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function retirar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    const c = dolaresACentavos(monto);
    if (c === null) return setError(t.montoMal);
    try {
      await pedir('POST', '/datos/billetera/retirar', { montoCentavos: c });
      setMonto('');
      setAviso(t.retirado);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!d) return error ? <p className="error-general">{error}</p> : null;
  return (
    <section>
      <h1>{t.titulo}</h1>
      {hoy && (
        <>
          <h2>{t.hoy}</h2>
          <div className="metricas">
            <div>
              <span>{t.entregados}</span>
              <strong>{hoy.entregados}</strong>
              <small>
                {hoy.enCurso} {t.enCurso} · {hoy.cancelados} {t.cancelados}
              </small>
            </div>
            <div>
              <span>{t.ventas}</span>
              <strong>{formatearDolares(hoy.ventas, idioma)}</strong>
            </div>
            <div>
              <span>{t.regalos}</span>
              <strong>−{formatearDolares(hoy.regalos, idioma)}</strong>
            </div>
            <div>
              <span>{t.comision}</span>
              <strong>−{formatearDolares(hoy.comision, idioma)}</strong>
            </div>
            <div className="metrica-fuerte">
              <span>{t.neto}</span>
              <strong>{formatearDolares(hoy.neto, idioma)}</strong>
            </div>
          </div>
        </>
      )}
      <div className="saldo">
        <span>{t.saldo}</span>
        <strong>{formatearDolares(d.saldo, idioma)}</strong>
      </div>
      {!d.pagosActivos ? (
        <div className="tarjeta-form">
          <p>{t.conectarAyuda}</p>
          <button type="button" className="boton" onClick={() => void conectar()}>
            {d.cuentaConectada ? t.continuar : t.conectar}
          </button>
        </div>
      ) : (
        <form onSubmit={retirar} className="tarjeta-form fila-botones">
          <label className="campo" style={{ flex: 1 }}>
            <span>{t.monto}</span>
            <input
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <button type="submit" className="boton">
            {t.retirar}
          </button>
        </form>
      )}
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="ok" role="status">
          {aviso}
        </p>
      )}
      <h2>{t.movimientos}</h2>
      {d.movimientos.length === 0 ? (
        <p>{t.vacio}</p>
      ) : (
        <ul className="lista">
          {d.movimientos.map((m) => (
            <li key={m.id}>
              <div className="lista-texto">
                <strong>{t.conceptos[m.concepto] ?? m.concepto}</strong>
                <span>
                  {new Date(`${m.fecha}Z`).toLocaleString(idioma === 'en' ? 'en-US' : 'es-US')}
                  {m.pedidoId ? ` · ${t.pedido} ${m.pedidoId.slice(0, 6)}` : ''}
                </span>
              </div>
              <strong className={m.monto < 0 ? 'negativo' : 'positivo'}>
                {formatearDolares(Math.abs(m.monto), idioma).replace(/^/, m.monto < 0 ? '−' : '+')}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
