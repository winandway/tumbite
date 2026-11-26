import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  MOTIVOS_CARGA_SALDO,
  type MotivoCargaSaldo,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela): «Saldo de clientes». El equipo busca al cliente con el
 * buscador serio (nombre, apellido, celular, correo o código), ve su Saldo Divoox y sus movimientos,
 * y le carga saldo con motivo obligatorio (carrera de regalo, recarga de regalo o el prepago del
 * cliente con su referencia), dentro de los topes por carga y por día. Revisa lo dudoso (viajes
 * pagados con saldo que no parecen reales) y cambia los topes. Todo queda en la auditoría.
 * Se explica en la ayuda interna «?» (nunca en Docs públicos).
 */
const T = {
  es: {
    titulo: 'Saldo de clientes',
    ayuda:
      'El Saldo Divoox es crédito en dólares del cliente para pagar sus viajes. Entra solo por aquí: una carrera de regalo, una recarga de regalo o lo que el cliente prepagó (con su referencia).',
    buscar: 'Buscar cliente',
    buscarPista: 'Nombre, apellido, celular, correo o código del cliente',
    sinResultados: 'No encontramos clientes con eso.',
    disponible: 'Saldo disponible en clientes',
    apartado: 'Apartado en viajes',
    enRevision: 'Viajes en revisión',
    saldo: 'Saldo Divoox',
    movimientos: 'Movimientos',
    sinMovimientos: 'Todavía no tiene movimientos.',
    fecha: 'Fecha',
    concepto: 'Concepto',
    monto: 'Monto',
    detalle: 'Detalle',
    conceptos: {
      regalo: 'Regalo',
      recarga: 'Prepago',
      uso_viaje: 'Pagó un viaje',
      devolucion: 'Devolución',
      ajuste: 'Ajuste',
    } as Record<string, string>,
    cargarA: (n: string) => `Cargar saldo a ${n}`,
    montoDolares: 'Monto (dólares)',
    motivo: 'Motivo',
    motivos: {
      carrera_regalo: 'Carrera de regalo',
      recarga_regalo: 'Recarga de regalo',
      prepago: 'Prepago del cliente',
    } as Record<MotivoCargaSaldo, string>,
    nota: 'Nota (opcional)',
    comprobante: 'Referencia del pago (obligatoria en un prepago)',
    revisar: 'Revisar la carga',
    confirmarTexto: (m: string, n: string, mo: string) =>
      `Vas a cargar ${m} de Saldo Divoox a ${n} por «${mo}». Le llega un aviso y queda en la auditoría con tu nombre.`,
    confirmar: 'Confirmar la carga',
    volver: 'Volver',
    cargado: 'Saldo cargado. Le avisamos al cliente.',
    topesTitulo: 'Topes de las cargas',
    topes: (c: string, d: string, cl: string) =>
      `Hasta ${c} por carga, ${d} por persona del equipo al día y ${cl} por cliente al día.`,
    porCarga: 'Por carga (dólares)',
    porDiaEquipo: 'Por persona del equipo, al día (dólares)',
    porDiaCliente: 'Por cliente, al día (dólares)',
    guardarTopes: 'Guardar los topes',
    maximo: (m: string) => `Máximo de Divoox: ${m}.`,
    guardado: 'Guardado.',
    revisionesTitulo: 'Viajes pagados con saldo en revisión',
    revisionesAyuda:
      'El viaje no parece real (no se pudo comprobar el recorrido). Aprobado: Divoox le paga al conductor. Rechazado: el saldo vuelve al cliente.',
    sinRevisiones: 'No hay nada en revisión.',
    notaRevision: 'Nota de la revisión',
    aprobar: 'Aprobar y pagar al conductor',
    rechazar: 'Rechazar y devolver al cliente',
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Customer balances',
    ayuda:
      'Divoox Balance is a customer’s credit in US dollars to pay for their rides. It only comes in here: a gift ride, a gift top-up or what the customer prepaid (with its reference).',
    buscar: 'Find a customer',
    buscarPista: 'First or last name, mobile, email or customer code',
    sinResultados: 'No customers match that.',
    disponible: 'Balance held by customers',
    apartado: 'Set aside on rides',
    enRevision: 'Rides under review',
    saldo: 'Divoox Balance',
    movimientos: 'Activity',
    sinMovimientos: 'No activity yet.',
    fecha: 'Date',
    concepto: 'Type',
    monto: 'Amount',
    detalle: 'Details',
    conceptos: {
      regalo: 'Gift',
      recarga: 'Prepaid',
      uso_viaje: 'Paid a ride',
      devolucion: 'Refund',
      ajuste: 'Adjustment',
    } as Record<string, string>,
    cargarA: (n: string) => `Add balance to ${n}`,
    montoDolares: 'Amount (dollars)',
    motivo: 'Reason',
    motivos: {
      carrera_regalo: 'Gift ride',
      recarga_regalo: 'Gift top-up',
      prepago: 'Customer prepayment',
    } as Record<MotivoCargaSaldo, string>,
    nota: 'Note (optional)',
    comprobante: 'Payment reference (required for a prepayment)',
    revisar: 'Review the top-up',
    confirmarTexto: (m: string, n: string, mo: string) =>
      `You’re adding ${m} of Divoox Balance to ${n} for “${mo}.” They get a notice and it’s recorded in the audit log under your name.`,
    confirmar: 'Confirm the top-up',
    volver: 'Back',
    cargado: 'Balance added. We notified the customer.',
    topesTitulo: 'Top-up limits',
    topes: (c: string, d: string, cl: string) =>
      `Up to ${c} per top-up, ${d} per team member per day and ${cl} per customer per day.`,
    porCarga: 'Per top-up (dollars)',
    porDiaEquipo: 'Per team member, per day (dollars)',
    porDiaCliente: 'Per customer, per day (dollars)',
    guardarTopes: 'Save the limits',
    maximo: (m: string) => `Divoox maximum: ${m}.`,
    guardado: 'Saved.',
    revisionesTitulo: 'Rides paid with balance under review',
    revisionesAyuda:
      'The ride doesn’t look real (the route couldn’t be confirmed). Approved: Divoox pays the driver. Declined: the balance goes back to the customer.',
    sinRevisiones: 'Nothing under review.',
    notaRevision: 'Review note',
    aprobar: 'Approve and pay the driver',
    rechazar: 'Decline and refund the customer',
    cargando: 'Loading…',
  },
};
type Textos = (typeof T)['es'];

type Topes = { porCarga: number; porDiaEquipo: number; porDiaCliente: number };
type Resultado = {
  id: string;
  titulo: string;
  detalle: string;
  ciudad: string | null;
  saldo: number;
};
type Datos = {
  clientes: Resultado[];
  resumen: { disponible: number; apartado: number; enRevision: number; moneda: string };
  revisiones: {
    operacionId: string;
    monto: number;
    moneda: string;
    detalle: string;
    cliente: string;
    conductor: string;
    creadoEn: string;
  }[];
  topes: Topes;
  maximos: Topes;
};
type Ficha = {
  cliente: { id: string; nombre: string; ciudad: string | null };
  saldo: number;
  movimientos: {
    id: string;
    monto: number;
    concepto: string;
    motivo: string;
    comprobante: string;
    autor: string | null;
    creadoEn: string;
  }[];
};

const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);
const claveNueva = () =>
  `carga-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function SuperSaldoClientes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);
  const [q, setQ] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);
  // C-BUSCADOR-SERIO: sugiere mientras se escribe (con un respiro), desde la primera letra.
  useEffect(() => {
    let vivo = true;
    const r = setTimeout(() => {
      pedir<Datos>('GET', `/datos/admin/saldo-clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then((d) => {
          if (vivo) setDatos(d);
        })
        .catch((x: unknown) => {
          if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
        });
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(r);
    };
  }, [q, vuelta]);
  const recargar = () => setVuelta((n) => n + 1);
  return (
    <div className="super" data-testid="super-saldo-clientes">
      <h2>
        {t.titulo}
        <AyudaAqui guia="customer-balance-top-up" idioma={idioma} />
      </h2>
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
      {!datos ? (
        <p className="pista">{t.cargando}</p>
      ) : (
        <>
          <div className="flex-kpis" data-testid="saldo-clientes-kpis">
            {(
              [
                [t.disponible, dinero(datos.resumen.disponible)],
                [t.apartado, dinero(datos.resumen.apartado)],
                [t.enRevision, String(datos.resumen.enRevision)],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex-kpi">
                <span>{etiqueta}</span>
                <strong>{valor}</strong>
              </div>
            ))}
          </div>
          <label className="campo">
            {t.buscar}
            <input
              type="search"
              value={q}
              placeholder={t.buscarPista}
              onChange={(e) => setQ(e.target.value)}
              data-testid="saldo-clientes-buscar"
            />
          </label>
          {q && datos.clientes.length === 0 ? <p className="pista">{t.sinResultados}</p> : null}
          {datos.clientes.length ? (
            <ul className="lista-simple" data-testid="saldo-clientes-resultados">
              {datos.clientes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={elegido === r.id ? 'boton' : 'boton secundario'}
                    onClick={() => {
                      setOk('');
                      setElegido(r.id);
                    }}
                  >
                    {r.titulo} · {dinero(r.saldo)}
                  </button>{' '}
                  <small className="pista">
                    {[r.detalle, r.ciudad].filter(Boolean).join(' · ')}
                  </small>
                </li>
              ))}
            </ul>
          ) : null}
          {elegido ? (
            <FichaCliente
              key={`${elegido}-${vuelta}`}
              id={elegido}
              t={t}
              idioma={idioma}
              dinero={dinero}
              topes={datos.topes}
              alCargar={(m) => {
                setOk(m);
                recargar();
              }}
            />
          ) : null}
          <Revisiones datos={datos} t={t} dinero={dinero} alResolver={recargar} />
          <FormTopes
            key={JSON.stringify(datos.topes)}
            topes={datos.topes}
            maximos={datos.maximos}
            t={t}
            idioma={idioma}
            dinero={dinero}
            alGuardar={() => {
              setOk(t.guardado);
              recargar();
            }}
          />
        </>
      )}
    </div>
  );
}

function FichaCliente({
  id,
  t,
  idioma,
  dinero,
  topes,
  alCargar,
}: {
  id: string;
  t: Textos;
  idioma: Idioma;
  dinero: (n: number) => string;
  topes: Topes;
  alCargar: (mensaje: string) => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    pedir<Ficha>('GET', `/datos/admin/saldo-clientes/${encodeURIComponent(id)}`)
      .then((f) => {
        if (vivo) setFicha(f);
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [id]);
  if (error)
    return (
      <p className="error-general" role="alert">
        {error}
      </p>
    );
  if (!ficha) return <p className="pista">{t.cargando}</p>;
  return (
    <div className="flex-tarjeta" data-testid="saldo-cliente-ficha">
      <h3>
        {ficha.cliente.nombre}
        {ficha.cliente.ciudad ? <small className="pista"> · {ficha.cliente.ciudad}</small> : null}
      </h3>
      <p>
        {t.saldo}: <strong data-testid="saldo-cliente-saldo">{dinero(ficha.saldo)}</strong>
      </p>
      <FormCarga
        clienteId={ficha.cliente.id}
        nombre={ficha.cliente.nombre}
        t={t}
        idioma={idioma}
        dinero={dinero}
        topes={topes}
        alTerminar={alCargar}
      />
      <h4>{t.movimientos}</h4>
      {ficha.movimientos.length === 0 ? (
        <p className="pista">{t.sinMovimientos}</p>
      ) : (
        <div className="tabla-ancha">
          <table
            className="tabla"
            aria-label={t.movimientos}
            data-testid="saldo-cliente-movimientos"
          >
            <thead>
              <tr>
                <th>{t.fecha}</th>
                <th>{t.concepto}</th>
                <th>{t.monto}</th>
                <th>{t.detalle}</th>
              </tr>
            </thead>
            <tbody>
              {ficha.movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{m.creadoEn}</td>
                  <td>{new Map(Object.entries(t.conceptos)).get(m.concepto) ?? m.concepto}</td>
                  <td className={m.monto > 0 ? 'texto-exito' : undefined}>
                    {m.monto > 0 ? '+' : '−'}
                    {dinero(Math.abs(m.monto))}
                  </td>
                  <td>{[m.motivo, m.comprobante, m.autor].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormCarga({
  clienteId,
  nombre,
  t,
  idioma,
  dinero,
  topes,
  alTerminar,
}: {
  clienteId: string;
  nombre: string;
  t: Textos;
  idioma: Idioma;
  dinero: (n: number) => string;
  topes: Topes;
  alTerminar: (mensaje: string) => void;
}) {
  // Lo escrito no se pierde si se cierra la ventana (regla de los formularios). La clave de la carga
  // viaja con el borrador: un doble toque o un reintento no cargan dos veces.
  const b = useBorrador({
    formulario: `carga-saldo-cliente-${clienteId}`,
    cuenta: 'superadmin',
    inicial: {
      monto: '',
      motivo: 'carrera_regalo',
      nota: '',
      comprobante: '',
      clave: claveNueva(),
    },
    almacen: almacenNavegador,
  });
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const monto = aCentavos(b.valores.monto);
  const motivo = (
    MOTIVOS_CARGA_SALDO.includes(b.valores.motivo as MotivoCargaSaldo)
      ? b.valores.motivo
      : 'carrera_regalo'
  ) as MotivoCargaSaldo;
  async function confirmar() {
    setError('');
    setEnviando(true);
    try {
      await pedir('POST', `/datos/admin/saldo-clientes/${encodeURIComponent(clienteId)}/cargas`, {
        monto,
        motivo,
        nota: b.valores.nota,
        comprobante: b.valores.comprobante,
        idempotencia: b.valores.clave || claveNueva(),
      });
      await b.limpiar();
      alTerminar(t.cargado);
    } catch (x) {
      setRevisando(false);
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="saldo-cliente-carga">
      <h4>{t.cargarA(nombre)}</h4>
      <p className="pista">
        {t.topes(dinero(topes.porCarga), dinero(topes.porDiaEquipo), dinero(topes.porDiaCliente))}
      </p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {revisando ? (
        <>
          <p data-testid="saldo-cliente-confirmar-texto">
            {t.confirmarTexto(
              dinero(monto),
              nombre,
              new Map(Object.entries(t.motivos)).get(motivo) ?? motivo,
            )}
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
            if (monto <= 0) return setError(t.montoDolares);
            if (monto > topes.porCarga) return setError(t.topes(dinero(topes.porCarga), '', ''));
            if (motivo === 'prepago' && b.valores.comprobante.trim().length < 3)
              return setError(t.comprobante);
            setRevisando(true);
          }}
        >
          <label className="campo">
            {t.montoDolares}
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
            <select value={motivo} onChange={(e) => b.cambiar('motivo', e.target.value)}>
              {MOTIVOS_CARGA_SALDO.map((m) => (
                <option key={m} value={m}>
                  {new Map(Object.entries(t.motivos)).get(m) ?? m}
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
          <label className="campo">
            {t.nota}
            <input value={b.valores.nota} onChange={(e) => b.cambiar('nota', e.target.value)} />
          </label>
          <button type="submit" className="boton">
            {t.revisar}
          </button>
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

function Revisiones({
  datos,
  t,
  dinero,
  alResolver,
}: {
  datos: Datos;
  t: Textos;
  dinero: (n: number) => string;
  alResolver: () => void;
}) {
  const [nota, setNota] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');
  async function resolver(op: string, aprobar: boolean) {
    setError('');
    try {
      await pedir('POST', `/datos/admin/saldo-clientes/revisiones/${encodeURIComponent(op)}`, {
        aprobar,
        nota: nota.get(op) ?? '',
      });
      alResolver();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="saldo-clientes-revisiones">
      <h3>{t.revisionesTitulo}</h3>
      <p className="pista">{t.revisionesAyuda}</p>
      {datos.revisiones.length === 0 ? <p className="pista">{t.sinRevisiones}</p> : null}
      {datos.revisiones.map((r) => (
        <div key={r.operacionId} className="formulario">
          <p>
            <strong>{dinero(r.monto)}</strong> · {r.cliente} → {r.conductor} · {r.creadoEn}
          </p>
          <p className="pista">{r.detalle}</p>
          <label className="campo">
            {t.notaRevision}
            <input
              value={nota.get(r.operacionId) ?? ''}
              onChange={(e) => setNota((n) => new Map(n).set(r.operacionId, e.target.value))}
            />
          </label>
          <div className="fila-botones">
            <button
              type="button"
              className="boton exito"
              onClick={() => void resolver(r.operacionId, true)}
            >
              {t.aprobar}
            </button>
            <button
              type="button"
              className="boton secundario"
              onClick={() => void resolver(r.operacionId, false)}
            >
              {t.rechazar}
            </button>
          </div>
        </div>
      ))}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FormTopes({
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
    formulario: 'topes-saldo-clientes',
    cuenta: 'superadmin',
    inicial: {
      porCarga: String(topes.porCarga / 100),
      porDiaEquipo: String(topes.porDiaEquipo / 100),
      porDiaCliente: String(topes.porDiaCliente / 100),
    },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PUT', '/datos/admin/saldo-clientes/topes', {
        porCarga: aCentavos(b.valores.porCarga),
        porDiaEquipo: aCentavos(b.valores.porDiaEquipo),
        porDiaCliente: aCentavos(b.valores.porDiaCliente),
      });
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="saldo-clientes-topes">
      <h3>{t.topesTitulo}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void guardar(e)}>
        {(
          [
            ['porCarga', t.porCarga, b.valores.porCarga, maximos.porCarga],
            ['porDiaEquipo', t.porDiaEquipo, b.valores.porDiaEquipo, maximos.porDiaEquipo],
            ['porDiaCliente', t.porDiaCliente, b.valores.porDiaCliente, maximos.porDiaCliente],
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
        <button type="submit" className="boton">
          {t.guardarTopes}
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
