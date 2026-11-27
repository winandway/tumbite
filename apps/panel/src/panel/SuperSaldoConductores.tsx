import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-SALDO-CONDUCTOR (17 nov 2026): los conductores de cada ciudad con su saldo y sus carreras, la
 * carga manual de saldo (con revisión y confirmación, y la firma de otra persona por encima del
 * límite) y el regalo de arranque para conductores nuevos de la ciudad, con su presupuesto.
 */
const T = {
  es: {
    titulo: 'Saldo de conductores',
    ayuda:
      'Cada conductor tiene su saldo (lo recarga él y de ahí sale la comisión de Divoox en cada carrera; sin saldo no recibe carreras) y sus ganancias (lo que Divoox le debe, por ejemplo por los regalos de sus pasajeros).',
    ciudad: 'Ciudad',
    conductores: 'Conductores',
    activos: 'Activos (7 días)',
    conectados: 'Conectados ahora',
    sinSaldo: 'Sin saldo',
    nombre: 'Conductor',
    estado: 'Estado',
    conectado: 'Conectado',
    activo: 'Activo',
    inactivo: 'Sin carreras recientes',
    saldo: 'Saldo',
    reservado: 'Apartado',
    ganancias: 'Ganancias',
    carreras: 'Carreras (7 días / total)',
    arranque: 'Regalo de arranque',
    cargar: 'Cargar',
    sinConductores: 'Esta ciudad todavía no tiene conductores.',
    cargarA: (n: string) => `Cargar saldo a ${n}`,
    monto: 'Monto (dólares)',
    motivo: 'Motivo',
    motivos: ['Regalo de arranque', 'Pagó por pago móvil', 'Corrección del equipo'],
    comprobante: 'Comprobante (opcional, por ejemplo la referencia del banco)',
    revisar: 'Revisar la carga',
    confirmarTexto: (m: string, n: string, mo: string) =>
      `Vas a cargar ${m} al saldo de ${n} por «${mo}». Queda en el libro con tu nombre.`,
    confirmar: 'Confirmar la carga',
    volver: 'Volver',
    cancelar: 'Cancelar',
    cargado: 'Saldo cargado.',
    pendiente:
      'Pasa tu límite de hoy: quedó en «Para aprobar» para que otra persona del equipo la firme.',
    tope: (m: string) => `Tope fijo de Divoox: hasta ${m} por carga.`,
    regaloTitulo: 'Regalo de arranque para conductores nuevos',
    regaloAyuda:
      'Cada conductor que se registre en esta ciudad desde que lo enciendas recibe este saldo una sola vez, solo, al quedar listo para trabajar. Quien ya estaba registrado no lo recibe. Si el tope del día se llena, el siguiente lo recibe al día siguiente. Cuando se gasta el presupuesto, se apaga solo.',
    regaloMonto: 'Saldo de regalo por conductor (dólares)',
    regaloPresupuesto: 'Presupuesto total (dólares)',
    regaloTope: 'Tope por día en la ciudad (dólares, cada 24 horas)',
    regaloVigencia: 'Vence si no lo usa (días)',
    regaloSinLimite: 'Vacío = sin límite',
    hoy: 'Últimas 24 horas',
    desde: (f: string) => `Encendido desde ${f}`,
    regaloActivo: 'Encendido',
    regaloGuardar: 'Guardar el regalo de arranque',
    dado: 'Entregado',
    queda: 'Queda',
    recibieron: (n: number) =>
      n === 1 ? '1 conductor lo recibió' : `${n} conductores lo recibieron`,
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Driver balances',
    ayuda:
      'Each driver has a balance (they top it up and the Divoox commission for each trip comes out of it; without balance they get no trips) and earnings (what Divoox owes them, for example for their riders’ gifts).',
    ciudad: 'City',
    conductores: 'Drivers',
    activos: 'Active (7 days)',
    conectados: 'Online now',
    sinSaldo: 'No balance',
    nombre: 'Driver',
    estado: 'Status',
    conectado: 'Online',
    activo: 'Active',
    inactivo: 'No recent trips',
    saldo: 'Balance',
    reservado: 'Set aside',
    ganancias: 'Earnings',
    carreras: 'Trips (7 days / total)',
    arranque: 'Starter gift',
    cargar: 'Top up',
    sinConductores: 'This city has no drivers yet.',
    cargarA: (n: string) => `Top up ${n}’s balance`,
    monto: 'Amount (dollars)',
    motivo: 'Reason',
    motivos: ['Starter gift', 'Paid by mobile payment', 'Team correction'],
    comprobante: 'Receipt (optional, for example the bank reference)',
    revisar: 'Review the top-up',
    confirmarTexto: (m: string, n: string, mo: string) =>
      `You’re adding ${m} to ${n}’s balance for “${mo}.” It’s recorded in the ledger under your name.`,
    confirmar: 'Confirm the top-up',
    volver: 'Back',
    cancelar: 'Cancel',
    cargado: 'Balance added.',
    pendiente:
      'It’s over your limit for today: it’s waiting in “To approve” for another team member to sign off.',
    tope: (m: string) => `Fixed Divoox limit: up to ${m} per top-up.`,
    regaloTitulo: 'Starter gift for new drivers',
    regaloAyuda:
      'Every driver who signs up in this city after you turn it on gets this balance once, automatically, when they are ready to drive. Drivers who were already signed up do not get it. If the daily cap fills up, the next driver gets it the following day. When the budget is used up, it turns off on its own.',
    regaloMonto: 'Gift balance per driver (dollars)',
    regaloPresupuesto: 'Total budget (dollars)',
    regaloTope: 'Daily cap for the city (dollars, every 24 hours)',
    regaloVigencia: 'Expires if unused (days)',
    regaloSinLimite: 'Empty = no limit',
    hoy: 'Last 24 hours',
    desde: (f: string) => `On since ${f}`,
    regaloActivo: 'On',
    regaloGuardar: 'Save the starter gift',
    dado: 'Given',
    queda: 'Left',
    recibieron: (n: number) => (n === 1 ? '1 driver got it' : `${n} drivers got it`),
    cargando: 'Loading…',
  },
};

type Conductor = {
  id: string;
  nombre: string;
  conectado: boolean;
  activo: boolean;
  saldo: number;
  reservado: number;
  ganancias: number;
  carreras: number;
  carreras7d: number;
  regaloArranque: boolean;
};
type Datos = {
  zonas: { id: string; nombre: string; pais: string; moneda: string }[];
  ciudad: {
    zonaId: string;
    moneda: string;
    total: number;
    activos: number;
    conectados: number;
    sinSaldo: number;
    conductores: Conductor[];
  } | null;
  regalosNuevos: {
    zonaId: string;
    monto: number;
    presupuesto: number;
    activo: boolean;
    dado: number;
    restante: number;
    conductores: number;
    topeDiario: number | null;
    vigenciaDias: number | null;
    dadoUltimas24h: number;
    encendidoEn: string | null;
  }[];
  topes: { cargaMaxima: number; regaloNuevoMaximo: number; presupuestoRegaloNuevoMaximo: number };
};

const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);

export function SuperSaldoConductores({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [zona, setZona] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargarA, setCargarA] = useState<Conductor | null>(null);
  useEffect(() => {
    let vivo = true;
    pedir<Datos>(
      'GET',
      `/datos/admin/conductores-ciudad${zona ? `?zona=${encodeURIComponent(zona)}` : ''}`,
    )
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [zona, vuelta]);
  const recargar = () => setVuelta((n) => n + 1);
  if (!datos)
    return (
      <div className="super" data-testid="super-saldo-conductores">
        <h2>{t.titulo}</h2>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : (
          <p className="pista">{t.cargando}</p>
        )}
      </div>
    );
  const ciudad = datos.ciudad;
  const moneda = ciudad?.moneda ?? 'USD';
  const dinero = (c: number) => formatearMonto(c, moneda, idioma);
  const regalo = datos.regalosNuevos.find((r) => r.zonaId === ciudad?.zonaId) ?? null;
  return (
    <div className="super" data-testid="super-saldo-conductores">
      <h2>
        {t.titulo}
        <AyudaAqui guia="driver-balance-top-up" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      <div className="fila-botones" role="tablist" aria-label={t.ciudad}>
        {datos.zonas.map((z) => (
          <button
            key={z.id}
            type="button"
            role="tab"
            aria-selected={z.id === ciudad?.zonaId}
            className={z.id === ciudad?.zonaId ? 'boton' : 'boton secundario'}
            onClick={() => setZona(z.id)}
          >
            {z.nombre}
          </button>
        ))}
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      {ciudad ? (
        <>
          <div className="flex-kpis" data-testid="saldo-kpis">
            {(
              [
                [t.conductores, ciudad.total],
                [t.activos, ciudad.activos],
                [t.conectados, ciudad.conectados],
                [t.sinSaldo, ciudad.sinSaldo],
              ] as const
            ).map(([etiqueta, n]) => (
              <div key={etiqueta} className="flex-kpi">
                <span>{etiqueta}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
          {cargarA ? (
            <FormCarga
              key={cargarA.id}
              c={cargarA}
              t={t}
              idioma={idioma}
              dinero={dinero}
              tope={datos.topes.cargaMaxima}
              alTerminar={(mensaje) => {
                setCargarA(null);
                setOk(mensaje);
                recargar();
              }}
              alCancelar={() => setCargarA(null)}
            />
          ) : null}
          {ciudad.conductores.length === 0 ? (
            <p className="pista">{t.sinConductores}</p>
          ) : (
            <div className="tabla-ancha">
              <table className="tabla" aria-label={t.conductores} data-testid="saldo-tabla">
                <thead>
                  <tr>
                    <th>{t.nombre}</th>
                    <th>{t.estado}</th>
                    <th>{t.saldo}</th>
                    <th>{t.ganancias}</th>
                    <th>{t.carreras}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ciudad.conductores.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.nombre}
                        {c.regaloArranque ? (
                          <span className="regalo-estado regalo-encendido">{t.arranque}</span>
                        ) : null}
                      </td>
                      <td>{c.conectado ? t.conectado : c.activo ? t.activo : t.inactivo}</td>
                      <td className={c.saldo <= 0 ? 'peligro' : undefined}>
                        {dinero(c.saldo)}
                        {c.reservado > 0 ? (
                          <small className="pista">
                            {' '}
                            ({t.reservado} {dinero(c.reservado)})
                          </small>
                        ) : null}
                      </td>
                      <td>{dinero(c.ganancias)}</td>
                      <td>
                        {c.carreras7d} / {c.carreras}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="boton secundario"
                          onClick={() => {
                            setOk('');
                            setCargarA(c);
                          }}
                        >
                          {t.cargar}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <RegaloArranque
            key={ciudad.zonaId}
            zonaId={ciudad.zonaId}
            regalo={regalo}
            t={t}
            idioma={idioma}
            dinero={dinero}
            alGuardar={() => {
              setOk(idioma === 'en' ? 'Saved.' : 'Guardado.');
              recargar();
            }}
            setError={setError}
          />
        </>
      ) : null}
    </div>
  );
}

function FormCarga({
  c,
  t,
  idioma,
  dinero,
  tope,
  alTerminar,
  alCancelar,
}: {
  c: Conductor;
  t: (typeof T)['es'];
  idioma: Idioma;
  dinero: (n: number) => string;
  tope: number;
  alTerminar: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  // Lo escrito no se pierde si se cierra la ventana (regla de los formularios).
  const b = useBorrador({
    formulario: `carga-saldo-${c.id}`,
    cuenta: 'superadmin',
    inicial: { monto: '', motivo: t.motivos[0] ?? '', comprobante: '' },
    almacen: almacenNavegador,
  });
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const monto = aCentavos(b.valores.monto);
  async function confirmar() {
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<{ id?: string; pendiente?: boolean }>(
        'POST',
        `/datos/admin/conductores-ciudad/${c.id}/saldo`,
        { monto, motivo: b.valores.motivo, comprobante: b.valores.comprobante },
      );
      await b.limpiar();
      alTerminar(r.id ? t.cargado : t.pendiente);
    } catch (x) {
      setRevisando(false);
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="saldo-carga">
      <h3>{t.cargarA(c.nombre)}</h3>
      <p className="pista">{t.tope(dinero(tope))}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {revisando ? (
        <>
          <p data-testid="saldo-confirmar-texto">
            {t.confirmarTexto(dinero(monto), c.nombre, b.valores.motivo)}
          </p>
          <div className="fila-botones">
            <button
              type="button"
              className="boton exito"
              disabled={enviando}
              onClick={() => void confirmar()}
            >
              {t.confirmar}
            </button>
            <button type="button" className="boton secundario" onClick={() => setRevisando(false)}>
              {t.volver}
            </button>
          </div>
        </>
      ) : (
        <form
          className="formulario"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (monto <= 0) return setError(t.monto);
            if (b.valores.motivo.trim().length < 3) return setError(t.motivo);
            setRevisando(true);
          }}
        >
          <label className="campo">
            {t.monto}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={b.valores.monto}
              onChange={(e) => b.cambiar('monto', e.target.value)}
            />
          </label>
          <label className="campo">
            {t.motivo}
            <select value={b.valores.motivo} onChange={(e) => b.cambiar('motivo', e.target.value)}>
              {t.motivos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            {t.comprobante}
            <input
              value={b.valores.comprobante}
              onChange={(e) => b.cambiar('comprobante', e.target.value)}
            />
          </label>
          <div className="fila-botones">
            <button type="submit" className="boton">
              {t.revisar}
            </button>
            <button type="button" className="boton secundario" onClick={alCancelar}>
              {t.cancelar}
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RegaloArranque({
  zonaId,
  regalo,
  t,
  idioma,
  dinero,
  alGuardar,
  setError,
}: {
  zonaId: string;
  regalo: Datos['regalosNuevos'][number] | null;
  t: (typeof T)['es'];
  idioma: Idioma;
  dinero: (n: number) => string;
  alGuardar: () => void;
  setError: (s: string) => void;
}) {
  const b = useBorrador({
    formulario: `regalo-arranque-${zonaId}`,
    cuenta: 'superadmin',
    inicial: {
      monto: regalo ? String(regalo.monto / 100) : '',
      presupuesto: regalo ? String(regalo.presupuesto / 100) : '',
      topeDiario: regalo?.topeDiario != null ? String(regalo.topeDiario / 100) : '',
      vigenciaDias: regalo?.vigenciaDias != null ? String(regalo.vigenciaDias) : '',
      activo: regalo?.activo ?? false,
    },
    almacen: almacenNavegador,
  });
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PUT', `/datos/admin/regalo-conductor-nuevo/${zonaId}`, {
        monto: aCentavos(b.valores.monto),
        presupuesto: aCentavos(b.valores.presupuesto),
        topeDiario: b.valores.topeDiario.trim() ? aCentavos(b.valores.topeDiario) : null,
        vigenciaDias: b.valores.vigenciaDias.trim()
          ? Math.round(Number(b.valores.vigenciaDias))
          : null,
        activo: b.valores.activo,
      });
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const pct = regalo
    ? `${Math.min(100, (regalo.dado / Math.max(1, regalo.presupuesto)) * 100)}%`
    : '0%';
  return (
    <div className="flex-tarjeta" data-testid="saldo-regalo-arranque">
      <h3>{t.regaloTitulo}</h3>
      <p className="pista">{t.regaloAyuda}</p>
      {regalo ? (
        <>
          <div className="regalo-barra" role="img" aria-label={`${t.dado} ${dinero(regalo.dado)}`}>
            <i className="regalo-gastado" style={{ width: pct }} />
          </div>
          <p>
            {t.dado}: {dinero(regalo.dado)} · {t.queda}: {dinero(regalo.restante)} ·{' '}
            {t.recibieron(regalo.conductores)}
          </p>
          {regalo.topeDiario != null ? (
            <p>
              {t.hoy}: {dinero(regalo.dadoUltimas24h)} / {dinero(regalo.topeDiario)}
            </p>
          ) : null}
          {regalo.activo && regalo.encendidoEn ? (
            <p className="pista">
              {t.desde(
                new Date(`${regalo.encendidoEn.replace(' ', 'T')}Z`).toLocaleString(
                  idioma === 'es' ? 'es' : 'en-US',
                  { dateStyle: 'medium', timeStyle: 'short' },
                ),
              )}
            </p>
          ) : null}
        </>
      ) : null}
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void guardar(e)}>
        <label className="campo">
          {t.regaloMonto}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={b.valores.monto}
            onChange={(e) => b.cambiar('monto', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.regaloPresupuesto}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={b.valores.presupuesto}
            onChange={(e) => b.cambiar('presupuesto', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.regaloTope}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder={t.regaloSinLimite}
            value={b.valores.topeDiario}
            onChange={(e) => b.cambiar('topeDiario', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.regaloVigencia}
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            placeholder={t.regaloSinLimite}
            value={b.valores.vigenciaDias}
            onChange={(e) => b.cambiar('vigenciaDias', e.target.value)}
          />
        </label>
        <label className="casilla-fila">
          <input
            type="checkbox"
            checked={b.valores.activo}
            onChange={(e) => b.cambiar('activo', e.target.checked)}
          />
          {t.regaloActivo}
        </label>
        <button type="submit" className="boton">
          {t.regaloGuardar}
        </button>
      </form>
    </div>
  );
}
