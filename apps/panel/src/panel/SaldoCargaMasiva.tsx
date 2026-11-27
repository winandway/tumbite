import { useEffect, useRef, useState } from 'react';
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
import { Insignia } from './diseno/Insignia';
import { pedir } from './api';

/**
 * C-SALDO-MASIVO (26 nov 2026, todos los países; Venezuela primero). «Carga masiva» dentro de «Saldo
 * de clientes» (Dinero): el equipo elige clientes con filtros (ciudad, registrados entre fechas, cuántos
 * viajes, celular confirmado), ve la vista previa (cuántos, el total y la lista por páginas), confirma
 * ESCRIBIENDO el total y la carga corre por tandas con su avance a la vista (si se cierra la ventana,
 * el reloj la sigue). Repetirla no le acredita dos veces a nadie. Todo queda en la auditoría. Lo escrito
 * no se pierde (borrador). Se explica en la ayuda interna «?», nunca en Docs públicos.
 */
const T = {
  es: {
    titulo: 'Carga masiva de Saldo Divoox',
    ayuda:
      'Regala Saldo Divoox a muchos clientes de una vez, sin cargarlos uno por uno. Es un regalo de Divoox: vence en los días que elijas y sale del total que confirmes.',
    ciudad: 'Ciudad',
    todas: 'Todas las ciudades',
    desde: 'Registrados desde',
    hasta: 'Registrados hasta',
    viajesMin: 'Con al menos (viajes)',
    viajesMax: 'Con como mucho (viajes)',
    viajesPista: 'Para «sin viajes», escribe 0 en «como mucho».',
    verificado: 'Solo con el celular confirmado',
    monto: 'Monto por cliente (dólares)',
    vigencia: 'Vence en (días)',
    motivo: 'Motivo (queda en la auditoría)',
    motivoPista: 'Por ejemplo: «Lanzamiento en la ciudad»',
    verPrevia: 'Ver la vista previa',
    previa: 'Vista previa',
    clientes: 'Clientes',
    total: 'Total',
    nadie: 'Ningún cliente cumple esos filtros.',
    masDe: (n: number) => `Son más de ${n} clientes: ajusta los filtros para cargas más pequeñas.`,
    nombre: 'Cliente',
    registrado: 'Registrado',
    viajes: 'Viajes',
    celular: 'Celular',
    confirmado: 'Confirmado',
    sinConfirmar: 'Sin confirmar',
    siguientes: 'Ver los siguientes',
    primeros: 'Volver al inicio',
    escribeTotal: (t: string) => `Para confirmar, escribe el total: ${t}`,
    totalEscrito: 'Total (dólares)',
    totalNoCoincide: 'El total escrito no coincide con el de la vista previa.',
    confirmar: (n: number, t: string) => `Cargar ${t} a ${n} ${n === 1 ? 'cliente' : 'clientes'}`,
    resumen: (n: number, m: string, d: number) =>
      `Cada cliente recibe ${m} de Saldo Divoox que vence en ${d} días, y un aviso en su celular.`,
    enCurso: 'Cargando…',
    progreso: (a: number, c: number) => `${a} de ${c} clientes con su regalo`,
    detener: 'Detener la carga',
    detenida: 'Detenida',
    terminada: 'Terminada',
    corriendo: 'En curso',
    historial: 'Cargas anteriores',
    sinHistorial: 'Todavía no hay cargas masivas.',
    fecha: 'Fecha',
    quien: 'Quién',
    entregado: 'Entregado',
    estado: 'Estado',
    topesTitulo: 'Topes de la carga masiva',
    topes: (c: string, t: string, p: string, g: string) =>
      `Hasta ${c} por cliente y ${t} por carga. En 24 horas: ${p} por persona del equipo y ${g} entre todo el equipo.`,
    porCliente: 'Por cliente (dólares)',
    porCarga: 'Por carga (dólares)',
    porDiaPersona: 'Por persona del equipo, en 24 horas (dólares)',
    porDiaGlobal: 'Todo el equipo, en 24 horas (dólares)',
    frenada:
      'La carga llegó al tope de 24 horas: sigue sola cuando vuelva a haber cupo. Nadie se queda sin su regalo.',
    maximo: (m: string) => `Máximo de Divoox: ${m}.`,
    guardar: 'Guardar los topes',
    guardado: 'Guardado.',
    hecho: 'Carga terminada. Le avisamos a cada cliente.',
    faltaMonto: 'Escribe el monto por cliente.',
    faltaMotivo: 'Escribe el motivo (al menos 5 letras).',
  },
  en: {
    titulo: 'Bulk Divoox Balance gift',
    ayuda:
      'Give Divoox Balance to many customers at once, without adding it one by one. It’s a Divoox gift: it expires after the days you choose and comes out of the total you confirm.',
    ciudad: 'City',
    todas: 'All cities',
    desde: 'Signed up from',
    hasta: 'Signed up to',
    viajesMin: 'With at least (rides)',
    viajesMax: 'With at most (rides)',
    viajesPista: 'For “no rides,” enter 0 in “at most.”',
    verificado: 'Only with a confirmed mobile number',
    monto: 'Amount per customer (dollars)',
    vigencia: 'Expires in (days)',
    motivo: 'Reason (recorded in the audit log)',
    motivoPista: 'For example: “City launch”',
    verPrevia: 'See the preview',
    previa: 'Preview',
    clientes: 'Customers',
    total: 'Total',
    nadie: 'No customers match those filters.',
    masDe: (n: number) =>
      `That’s more than ${n} customers: narrow the filters for smaller batches.`,
    nombre: 'Customer',
    registrado: 'Signed up',
    viajes: 'Rides',
    celular: 'Mobile',
    confirmado: 'Confirmed',
    sinConfirmar: 'Not confirmed',
    siguientes: 'See the next ones',
    primeros: 'Back to the start',
    escribeTotal: (t: string) => `To confirm, type the total: ${t}`,
    totalEscrito: 'Total (dollars)',
    totalNoCoincide: 'The total you typed doesn’t match the preview.',
    confirmar: (n: number, t: string) => `Give ${t} to ${n} ${n === 1 ? 'customer' : 'customers'}`,
    resumen: (n: number, m: string, d: number) =>
      `Each customer gets ${m} of Divoox Balance that expires in ${d} days, and a notice on their phone.`,
    enCurso: 'Adding…',
    progreso: (a: number, c: number) => `${a} of ${c} customers have their gift`,
    detener: 'Stop the batch',
    detenida: 'Stopped',
    terminada: 'Done',
    corriendo: 'In progress',
    historial: 'Previous batches',
    sinHistorial: 'No bulk gifts yet.',
    fecha: 'Date',
    quien: 'Who',
    entregado: 'Given',
    estado: 'Status',
    topesTitulo: 'Bulk gift limits',
    topes: (c: string, t: string, p: string, g: string) =>
      `Up to ${c} per customer and ${t} per batch. In 24 hours: ${p} per team member and ${g} for the whole team.`,
    porCliente: 'Per customer (dollars)',
    porCarga: 'Per batch (dollars)',
    porDiaPersona: 'Per team member, in 24 hours (dollars)',
    porDiaGlobal: 'Whole team, in 24 hours (dollars)',
    frenada:
      'The batch reached the 24-hour limit: it continues on its own when there’s room again. Nobody misses their gift.',
    maximo: (m: string) => `Divoox maximum: ${m}.`,
    guardar: 'Save the limits',
    guardado: 'Saved.',
    hecho: 'Batch done. We notified each customer.',
    faltaMonto: 'Enter the amount per customer.',
    faltaMotivo: 'Write the reason (at least 5 letters).',
  },
};
type Textos = (typeof T)['es'];

type Zona = { id: string; nombre: string; pais: string };
type Topes = { porCliente: number; porCarga: number; porDiaPersona: number; porDiaGlobal: number };
type Carga = {
  id: string;
  autor: string | null;
  motivo: string;
  monto: number;
  vigenciaDias: number;
  clientes: number;
  total: number;
  estado: 'en_curso' | 'terminada' | 'detenida';
  /** La tanda se frenó por un tope de 24 horas (el reloj la sigue sola). */
  frenadaPorTope?: boolean;
  acreditados: number;
  entregado: number;
  creadoEn: string;
};
type Previa = {
  clientes: number;
  masDeLaCuenta: boolean;
  total: number;
  lista: {
    id: string;
    nombre: string;
    registrado: string;
    viajes: number;
    celularVerificado: boolean;
  }[];
  siguiente: string | null;
};

const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);
const entero = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.floor(Number(s) || 0)));
const claveNueva = () =>
  `masiva-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function SaldoCargaMasiva({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [topes, setTopes] = useState<{ topes: Topes; maximos: Topes } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    let vivo = true;
    Promise.all([
      pedir<{ zonas: Zona[] }>('GET', '/datos/admin/saldo-regalos/reglas'),
      pedir<{ cargas: Carga[]; topes: Topes; maximos: Topes }>(
        'GET',
        '/datos/admin/saldo-regalos/masiva',
      ),
    ])
      .then(([r, m]) => {
        if (!vivo) return;
        setZonas(r.zonas);
        setCargas(m.cargas);
        setTopes({ topes: m.topes, maximos: m.maximos });
      })
      .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  const enCurso = cargas.find((c) => c.estado === 'en_curso') ?? null;
  return (
    <section className="flex-tarjeta" data-testid="saldo-carga-masiva">
      <h3>
        {t.titulo}
        <AyudaAqui guia="customer-balance-bulk-gift" idioma={idioma} />
      </h3>
      <p className="pista">{t.ayuda}</p>
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
      {enCurso ? (
        <Avance
          carga={enCurso}
          t={t}
          alTerminar={(m) => {
            if (m) setOk(m);
            setVuelta((n) => n + 1);
          }}
          alError={setError}
        />
      ) : topes ? (
        <FormMasiva
          zonas={zonas}
          topes={topes.topes}
          t={t}
          idioma={idioma}
          dinero={dinero}
          alCrear={() => {
            setOk('');
            setVuelta((n) => n + 1);
          }}
        />
      ) : null}
      <Historial cargas={cargas} t={t} dinero={dinero} />
      {topes ? (
        <FormTopesMasiva
          key={JSON.stringify(topes.topes)}
          topes={topes.topes}
          maximos={topes.maximos}
          t={t}
          idioma={idioma}
          dinero={dinero}
          alGuardar={() => {
            setOk(t.guardado);
            setVuelta((n) => n + 1);
          }}
        />
      ) : null}
    </section>
  );
}

function FormMasiva({
  zonas,
  topes,
  t,
  idioma,
  dinero,
  alCrear,
}: {
  zonas: Zona[];
  topes: Topes;
  t: Textos;
  idioma: Idioma;
  dinero: (n: number) => string;
  alCrear: () => void;
}) {
  // Lo escrito no se pierde (regla de los formularios); la clave de la carga viaja con el borrador:
  // un doble toque o un reintento no crean dos cargas.
  const b = useBorrador({
    formulario: 'saldo-carga-masiva',
    cuenta: 'superadmin',
    inicial: {
      zonaId: '',
      desde: '',
      hasta: '',
      viajesMin: '',
      viajesMax: '',
      verificado: '1',
      monto: '',
      vigencia: '30',
      motivo: '',
      totalEscrito: '',
      clave: claveNueva(),
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pagina, setPagina] = useState<Previa['lista'] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const filtros = {
    zonaId: v.zonaId || null,
    desde: v.desde || null,
    hasta: v.hasta || null,
    viajesMin: entero(v.viajesMin),
    viajesMax: entero(v.viajesMax),
    celularVerificado: v.verificado === '1',
  };
  const monto = aCentavos(v.monto);
  const vigencia = Math.max(1, Math.min(365, Math.floor(Number(v.vigencia) || 30)));
  // Si se cambia un filtro o el monto, la vista previa de antes ya no vale.
  const firma = JSON.stringify([filtros, monto]);
  const firmaPrevia = useRef('');
  useEffect(() => {
    if (firmaPrevia.current && firmaPrevia.current !== firma) setPrevia(null);
  }, [firma]);
  async function verPrevia(cursor: string | null = null) {
    setError('');
    if (monto <= 0) return setError(t.faltaMonto);
    try {
      const r = await pedir<Previa>('POST', '/datos/admin/saldo-regalos/masiva/vista-previa', {
        filtros,
        monto,
        pagina: cursor,
      });
      if (!cursor) {
        setPrevia(r);
        firmaPrevia.current = firma;
      }
      setPagina(r.lista);
      setSiguiente(r.siguiente);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function confirmar() {
    setError('');
    if (!previa) return;
    if (v.motivo.trim().length < 5) return setError(t.faltaMotivo);
    if (aCentavos(v.totalEscrito) !== previa.total) return setError(t.totalNoCoincide);
    setEnviando(true);
    try {
      await pedir('POST', '/datos/admin/saldo-regalos/masiva', {
        filtros,
        monto,
        vigenciaDias: vigencia,
        motivo: v.motivo.trim(),
        totalEscrito: previa.total,
        idempotencia: v.clave || claveNueva(),
      });
      await b.limpiar();
      alCrear();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div data-testid="saldo-masiva-form">
      <p className="pista">
        {t.topes(
          dinero(topes.porCliente),
          dinero(topes.porCarga),
          dinero(topes.porDiaPersona),
          dinero(topes.porDiaGlobal),
        )}
      </p>
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
          void verPrevia();
        }}
      >
        <label className="campo">
          {t.ciudad}
          <select value={v.zonaId} onChange={(e) => b.cambiar('zonaId', e.target.value)}>
            <option value="">{t.todas}</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="fila-campos">
          <label className="campo">
            {t.desde}
            <input
              type="date"
              value={v.desde}
              onChange={(e) => b.cambiar('desde', e.target.value)}
            />
          </label>
          <label className="campo">
            {t.hasta}
            <input
              type="date"
              value={v.hasta}
              onChange={(e) => b.cambiar('hasta', e.target.value)}
            />
          </label>
        </div>
        <div className="fila-campos">
          <label className="campo">
            {t.viajesMin}
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={v.viajesMin}
              onChange={(e) => b.cambiar('viajesMin', e.target.value)}
            />
          </label>
          <label className="campo">
            {t.viajesMax}
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={v.viajesMax}
              onChange={(e) => b.cambiar('viajesMax', e.target.value)}
            />
          </label>
        </div>
        <small className="pista">{t.viajesPista}</small>
        <label className="campo-casilla">
          <input
            type="checkbox"
            checked={v.verificado === '1'}
            onChange={(e) => b.cambiar('verificado', e.target.checked ? '1' : '0')}
          />{' '}
          {t.verificado}
        </label>
        <div className="fila-campos">
          <label className="campo">
            {t.monto}
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={v.monto}
              onChange={(e) => b.cambiar('monto', e.target.value)}
              data-testid="masiva-monto"
            />
          </label>
          <label className="campo">
            {t.vigencia}
            <input
              type="number"
              min="1"
              max="365"
              step="1"
              inputMode="numeric"
              value={v.vigencia}
              onChange={(e) => b.cambiar('vigencia', e.target.value)}
            />
          </label>
        </div>
        <label className="campo">
          {t.motivo}
          <input
            value={v.motivo}
            placeholder={t.motivoPista}
            onChange={(e) => b.cambiar('motivo', e.target.value)}
            data-testid="masiva-motivo"
          />
        </label>
        <button type="submit" className="boton secundario" data-testid="masiva-ver-previa">
          {t.verPrevia}
        </button>
      </form>
      {previa ? (
        <div className="flex-tarjeta" data-testid="masiva-previa">
          <h4>{t.previa}</h4>
          <div className="flex-kpis">
            <div className="flex-kpi">
              <span>{t.clientes}</span>
              <strong data-testid="masiva-previa-clientes">{previa.clientes}</strong>
            </div>
            <div className="flex-kpi">
              <span>{t.total}</span>
              <strong data-testid="masiva-previa-total">{dinero(previa.total)}</strong>
            </div>
          </div>
          {previa.clientes === 0 ? <p className="pista">{t.nadie}</p> : null}
          {previa.masDeLaCuenta ? (
            <p className="error-general">{t.masDe(previa.clientes)}</p>
          ) : null}
          {pagina && pagina.length ? (
            <div className="tabla-ancha">
              <table className="tabla" aria-label={t.previa}>
                <thead>
                  <tr>
                    <th>{t.nombre}</th>
                    <th>{t.registrado}</th>
                    <th>{t.viajes}</th>
                    <th>{t.celular}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nombre}</td>
                      <td>{c.registrado.slice(0, 10)}</td>
                      <td>{c.viajes}</td>
                      <td>
                        <Insignia tono={c.celularVerificado ? 'hecho' : 'apagado'}>
                          {c.celularVerificado ? t.confirmado : t.sinConfirmar}
                        </Insignia>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="fila-botones">
            {siguiente ? (
              <button
                type="button"
                className="boton secundario"
                onClick={() => void verPrevia(siguiente)}
              >
                {t.siguientes}
              </button>
            ) : null}
            {pagina && previa.lista[0]?.id !== pagina[0]?.id ? (
              <button
                type="button"
                className="boton secundario"
                onClick={() => {
                  setPagina(previa.lista);
                  setSiguiente(previa.siguiente);
                }}
              >
                {t.primeros}
              </button>
            ) : null}
          </div>
          {previa.clientes > 0 && !previa.masDeLaCuenta ? (
            <div className="formulario" data-testid="masiva-confirmar">
              <p>{t.resumen(previa.clientes, dinero(monto), vigencia)}</p>
              <label className="campo">
                {t.escribeTotal(dinero(previa.total))}
                <input
                  type="text"
                  inputMode="decimal"
                  value={v.totalEscrito}
                  placeholder={t.totalEscrito}
                  onChange={(e) => b.cambiar('totalEscrito', e.target.value)}
                  data-testid="masiva-total-escrito"
                />
              </label>
              <button
                type="button"
                className="boton"
                disabled={enviando || aCentavos(v.totalEscrito) !== previa.total}
                onClick={() => void confirmar()}
                data-testid="masiva-confirmar-boton"
              >
                {t.confirmar(previa.clientes, dinero(previa.total))}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** El avance de la carga en curso: pide la siguiente tanda mientras la pantalla está abierta. */
function Avance({
  carga,
  t,
  alTerminar,
  alError,
}: {
  carga: Carga;
  t: Textos;
  alTerminar: (mensaje: string | null) => void;
  alError: (m: string) => void;
}) {
  const [actual, setActual] = useState(carga);
  useEffect(() => {
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const siguiente = async () => {
      try {
        const r = await pedir<{ carga: Carga }>(
          'POST',
          `/datos/admin/saldo-regalos/masiva/${encodeURIComponent(carga.id)}/tanda`,
        );
        if (!vivo) return;
        setActual(r.carga);
        // Frenada por el tope de 24 horas: no se insiste desde la pantalla (el reloj la sigue sola).
        if (r.carga.estado === 'en_curso' && !r.carga.frenadaPorTope)
          reloj = setTimeout(() => void siguiente(), 800);
        else if (r.carga.estado === 'en_curso') return;
        else alTerminar(r.carga.estado === 'terminada' ? t.hecho : null);
      } catch (x) {
        if (vivo) alError(x instanceof ErrorApi ? x.message : String(x));
      }
    };
    void siguiente();
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
    // Una sola vuelta por carga: el avance se pide solo mientras esté abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga.id]);
  const pct = actual.clientes ? Math.round((actual.acreditados / actual.clientes) * 100) : 0;
  return (
    <div className="formulario" data-testid="masiva-avance" role="status">
      <p>
        <strong>{actual.motivo}</strong> · {t.enCurso}
      </p>
      <div
        className="barra-activacion-progreso"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={actual.clientes}
        aria-valuenow={actual.acreditados}
        aria-label={t.progreso(actual.acreditados, actual.clientes)}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="pista">{t.progreso(actual.acreditados, actual.clientes)}</p>
      {actual.frenadaPorTope ? (
        <p className="pista" data-testid="masiva-frenada">
          {t.frenada}
        </p>
      ) : null}
      <button
        type="button"
        className="boton secundario"
        onClick={() =>
          void pedir(
            'POST',
            `/datos/admin/saldo-regalos/masiva/${encodeURIComponent(actual.id)}/detener`,
          )
            .then(() => alTerminar(null))
            .catch((x: unknown) => alError(x instanceof ErrorApi ? x.message : String(x)))
        }
      >
        {t.detener}
      </button>
    </div>
  );
}

function Historial({
  cargas,
  t,
  dinero,
}: {
  cargas: Carga[];
  t: Textos;
  dinero: (n: number) => string;
}) {
  return (
    <div data-testid="masiva-historial">
      <h4>{t.historial}</h4>
      {cargas.length === 0 ? (
        <p className="pista">{t.sinHistorial}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla" aria-label={t.historial}>
            <thead>
              <tr>
                <th>{t.fecha}</th>
                <th>{t.quien}</th>
                <th>{t.motivo}</th>
                <th>{t.clientes}</th>
                <th>{t.entregado}</th>
                <th>{t.estado}</th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((c) => (
                <tr key={c.id}>
                  <td>{c.creadoEn.slice(0, 16)}</td>
                  <td>{c.autor ?? '—'}</td>
                  <td>{c.motivo}</td>
                  <td>
                    {c.acreditados} / {c.clientes}
                  </td>
                  <td>
                    {dinero(c.entregado)} / {dinero(c.total)}
                  </td>
                  <td>
                    <Insignia
                      tono={
                        c.estado === 'terminada'
                          ? 'hecho'
                          : c.estado === 'en_curso'
                            ? 'pendiente'
                            : 'apagado'
                      }
                    >
                      {c.estado === 'terminada'
                        ? t.terminada
                        : c.estado === 'en_curso'
                          ? t.corriendo
                          : t.detenida}
                    </Insignia>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormTopesMasiva({
  topes,
  maximos,
  t,
  idioma,
  dinero,
  alGuardar,
}: {
  topes: Topes;
  maximos: Topes;
  t: Textos;
  idioma: Idioma;
  dinero: (n: number) => string;
  alGuardar: () => void;
}) {
  const b = useBorrador({
    formulario: 'topes-saldo-masiva',
    cuenta: 'superadmin',
    inicial: {
      porCliente: String(topes.porCliente / 100),
      porCarga: String(topes.porCarga / 100),
      porDiaPersona: String(topes.porDiaPersona / 100),
      porDiaGlobal: String(topes.porDiaGlobal / 100),
    },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PUT', '/datos/admin/saldo-regalos/masiva-topes', {
        porCliente: aCentavos(b.valores.porCliente),
        porCarga: aCentavos(b.valores.porCarga),
        porDiaPersona: aCentavos(b.valores.porDiaPersona),
        porDiaGlobal: aCentavos(b.valores.porDiaGlobal),
      });
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div data-testid="masiva-topes">
      <h4>{t.topesTitulo}</h4>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void guardar(e)}>
        {(
          [
            ['porCliente', t.porCliente, b.valores.porCliente, maximos.porCliente],
            ['porCarga', t.porCarga, b.valores.porCarga, maximos.porCarga],
            ['porDiaPersona', t.porDiaPersona, b.valores.porDiaPersona, maximos.porDiaPersona],
            ['porDiaGlobal', t.porDiaGlobal, b.valores.porDiaGlobal, maximos.porDiaGlobal],
          ] as const
        ).map(([k, etiqueta, valor, maximo]) => (
          <label key={k} className="campo">
            {etiqueta}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={valor}
              onChange={(e) => b.cambiar(k, e.target.value)}
            />
            <small className="pista">{t.maximo(dinero(maximo))}</small>
          </label>
        ))}
        <button type="submit" className="boton secundario">
          {t.guardar}
        </button>
      </form>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
