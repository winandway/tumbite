import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Plan,
  compararConOtras,
  planesEquivalentes,
  type Usuario,
  almacenNavegador,
  dolaresACentavos,
  enIdioma,
  formatearDolares,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
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
type Datos = {
  saldo: number;
  movimientos: Mov[];
  cuentaConectada: boolean;
  pagosActivos: boolean;
  retirosActivos?: boolean;
  retirosEnProceso?: { id: string; monto: number; estado: string; fecha: string }[];
};

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
    retiroEnProceso: 'Retiro en proceso: Stripe lo está confirmando. Ya salió de tu saldo.',
    enProcesoTitulo: 'Retiros en proceso',
    enProceso: 'En proceso',
    pausa: 'Los retiros están en pausa por mantenimiento. Tu saldo está a salvo.',
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
    comparaTitulo: 'Comparado con otras apps',
    comparaMes: (n: number) =>
      `Con tus ventas de los últimos 30 días (${n} ${n === 1 ? 'pedido' : 'pedidos'}), esto es lo que te queda en cada app:`,
    comparaEjemplo: 'Por cada 1.000 dólares de ventas, esto es lo que te queda en cada app:',
    conTumbite: (plan: string) => `Tumbite, plan ${plan}`,
    planes: { inicial: 'Inicial', crece: 'Crece', elite: 'Élite' } as Record<string, string>,
    masQue: (a: string, b: string) =>
      `Con Tumbite te quedan ${a} más que con DoorDash y ${b} más que con Uber Eats.`,
    fuente:
      'Comisiones que DoorDash y Uber Eats publican en sus páginas oficiales (octubre de 2026), con el plan equivalente al tuyo.',
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
    retiroEnProceso:
      'Withdrawal in progress: Stripe is confirming it. It already left your balance.',
    enProcesoTitulo: 'Withdrawals in progress',
    enProceso: 'In progress',
    pausa: 'Withdrawals are paused for maintenance. Your balance is safe.',
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
    comparaTitulo: 'Compared with other apps',
    comparaMes: (n: number) =>
      `With your sales from the last 30 days (${n} ${n === 1 ? 'order' : 'orders'}), here’s what you keep on each app:`,
    comparaEjemplo: 'For every $1,000 in sales, here’s what you keep on each app:',
    conTumbite: (plan: string) => `Tumbite, ${plan} plan`,
    planes: { inicial: 'Starter', crece: 'Growth', elite: 'Elite' } as Record<string, string>,
    masQue: (a: string, b: string) =>
      `With Tumbite you keep ${a} more than with DoorDash and ${b} more than with Uber Eats.`,
    fuente:
      'Commissions DoorDash and Uber Eats publish on their official pages (October 2026), on the plan equivalent to yours.',
  },
};

export function Billetera({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Datos | null>(null);
  const [hoy, setHoy] = useState<Resumen | null>(null);
  const [mes, setMes] = useState<{ ventas: number; regalos: number; pedidos: number } | null>(null);
  // C-MONEDA-RECORRIDO: las ventas del día y del mes van en la moneda del restaurante. El saldo, los
  // retiros y los movimientos son de Stripe (solo pedidos con tarjeta, que hoy solo existen en USD).
  const [moneda, setMoneda] = useState('USD');
  const [plan, setPlan] = useState<Plan>('inicial');
  const b = useBorrador({
    formulario: 'retiro',
    cuenta: usuario.id,
    inicial: { monto: '' },
    almacen: almacenNavegador,
  });
  const monto = b.valores.monto;
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = () =>
    pedir<Datos>('GET', '/datos/billetera')
      .then(setD)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  useEffect(() => {
    void cargar();
    pedir<{
      resumen: Resumen;
      mes?: { ventas: number; regalos: number; pedidos: number };
      plan?: Plan;
      moneda?: string;
    }>('GET', '/datos/restaurante/resumen')
      .then((r) => {
        setHoy(r.resumen);
        setMoneda(r.moneda ?? 'USD');
        setMes(r.mes ?? null);
        if (r.plan) setPlan(r.plan);
      })
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
      const r = await pedir<{ retiro?: { estado?: string } }>('POST', '/datos/billetera/retirar', {
        montoCentavos: c,
      });
      await b.limpiar();
      // Fase 0: si Stripe todavía no confirmó, se dice «en proceso», no «retirado».
      setAviso(r.retiro?.estado === 'en_proceso' ? t.retiroEnProceso : t.retirado);
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
              <strong>{formatearMonto(hoy.ventas, moneda, idioma)}</strong>
            </div>
            <div>
              <span>{t.regalos}</span>
              <strong>
                {hoy.regalos > 0 ? '−' : ''}
                {formatearMonto(hoy.regalos, moneda, idioma)}
              </strong>
            </div>
            <div>
              <span>{t.comision}</span>
              <strong>
                {hoy.comision > 0 ? '−' : ''}
                {formatearMonto(hoy.comision, moneda, idioma)}
              </strong>
            </div>
            <div className="metrica-fuerte">
              <span>{t.neto}</span>
              <strong>{formatearMonto(hoy.neto, moneda, idioma)}</strong>
            </div>
          </div>
        </>
      )}
      {mes && <Comparar mes={mes} plan={plan} idioma={idioma} t={t} moneda={moneda} />}
      <div className="saldo">
        <span>{t.saldo}</span>
        <strong>{formatearDolares(d.saldo, idioma)}</strong>
      </div>
      {d.retirosEnProceso?.length ? (
        <div className="tarjeta-form" aria-label={t.enProcesoTitulo}>
          <h2>{t.enProcesoTitulo}</h2>
          <ul>
            {d.retirosEnProceso.map((r) => (
              <li key={r.id}>
                {formatearDolares(r.monto, idioma)} · <strong>{t.enProceso}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {d.pagosActivos && d.retirosActivos === false ? (
        <p className="tarjeta-form">{t.pausa}</p>
      ) : !d.pagosActivos ? (
        <div className="tarjeta-form">
          <p>{t.conectarAyuda}</p>
          <button type="button" className="boton" onClick={() => void conectar()}>
            {d.cuentaConectada ? t.continuar : t.conectar}
          </button>
        </div>
      ) : (
        <form onSubmit={retirar} className="tarjeta-form fila-botones">
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <label className="campo" style={{ flex: 1 }}>
            <span>{t.monto}</span>
            <input
              inputMode="decimal"
              value={monto}
              onChange={(e) => b.cambiar('monto', e.target.value)}
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
                  {/* Igual que en la billetera del repartidor: «13 oct, 19:27», sin segundos. */}
                  {new Date(`${m.fecha.replace(' ', 'T')}Z`).toLocaleString(idioma, {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {m.pedidoId ? ` · ${t.pedido} #${m.pedidoId.slice(0, 4).toUpperCase()}` : ''}
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

/**
 * «Cuánto te queda con Tumbite y con otras apps», con las ventas reales del restaurante de los
 * últimos 30 días (o con 1.000 dólares de ejemplo si todavía no vendió). Candado C-COMPARA-REST.
 */
function Comparar({
  mes,
  plan,
  idioma,
  t,
  moneda,
}: {
  mes: { ventas: number; regalos: number; pedidos: number };
  plan: Plan;
  idioma: Idioma;
  t: (typeof T)['es'];
  moneda: string;
}) {
  const conVentas = mes.ventas > 0;
  const c = compararConOtras(conVentas ? mes.ventas : 100000, conVentas ? mes.regalos : 0, plan);
  const $ = (x: number) => formatearMonto(x, moneda, idioma);
  const equivalentes = planesEquivalentes(plan);
  const nombrePlan = new Map(Object.entries(t.planes)).get(plan) ?? plan;
  const filas: [string, number, boolean][] = [
    [t.conTumbite(nombrePlan), c.tumbite, true],
    [`DoorDash ${equivalentes.doordash}`, c.doordash, false],
    [`Uber Eats ${equivalentes.ubereats}`, c.ubereats, false],
  ];
  return (
    <section className="tarjeta comparar" aria-label={t.comparaTitulo}>
      <h2>{t.comparaTitulo}</h2>
      <p>{conVentas ? t.comparaMes(mes.pedidos) : t.comparaEjemplo}</p>
      <ul>
        {filas.map(([nombre, monto, propio]) => (
          <li key={nombre} className={propio ? 'propio' : undefined}>
            <span>{nombre}</span>
            <strong>{$(monto)}</strong>
          </li>
        ))}
      </ul>
      <p className="comparar-resultado">
        {t.masQue($(c.tumbite - c.doordash), $(c.tumbite - c.ubereats))}
      </p>
      <p className="ayuda">{t.fuente}</p>
    </section>
  );
}
