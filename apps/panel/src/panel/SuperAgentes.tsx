import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  correoEjemplo,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';

/**
 * C-AGENTE-DIVOOX (18 nov 2026): Dinero → Agentes. El equipo enciende el servicio por ciudad, crea
 * y suspende agentes, les anota el fondo (lo que Divoox les transfiere por fuera), fija sus topes y
 * concilia: lo pagado, lo vendido y lo que debe cada parte. Todo queda en la auditoría.
 */
const T = {
  es: {
    titulo: 'Agentes',
    ayuda:
      'Un Agente Divoox paga en efectivo las ganancias de los conductores y les vende saldo. Paga con el fondo que tú le transfieres por fuera y anotas aquí; sin fondo su panel no deja pagar. Lo que vende queda como dinero que te debe.',
    cargando: 'Cargando…',
    guardado: 'Guardado.',
    ciudades: 'Ciudades',
    ciudadesAyuda:
      'El servicio está apagado en cada ciudad hasta que lo enciendas. Encendido, los conductores de esa ciudad ven «Cobrar en efectivo».',
    ciudad: 'Ciudad',
    encendido: 'Encendido',
    apagado: 'Apagado',
    pagaEn: 'Se paga en',
    dolares: 'Dólares (solo enteros)',
    bolivares: 'Bolívares (tasa del día)',
    minimo: 'Mínimo del cobro (dólares)',
    topeConductor: 'Tope diario por conductor (dólares)',
    agentesCiudad: 'Agentes',
    editar: 'Editar',
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    volver: 'Volver',
    agentes: 'Agentes',
    sinAgentes: 'Todavía no hay agentes.',
    agente: 'Agente',
    estado: 'Estado',
    estados: {
      activo: 'Activo',
      suspendido: 'Suspendido',
      sinClave: 'Falta que cree su contraseña',
      bloqueado: 'Pagos bloqueados',
    },
    fondo: 'Fondo',
    debe: 'Debe por saldo vendido',
    pagado: 'Pagado',
    vendido: 'Vendido',
    abrir: 'Abrir',
    crear: 'Crear un agente',
    nombre: 'Nombre del agente o del negocio',
    correo: 'Correo (con este entra a su panel)',
    telefono: 'Teléfono',
    direccion: 'Dirección del local',
    horario: 'Horario de atención',
    idioma: 'Idioma de su panel',
    topePago: 'Tope por pago (dólares)',
    topeDia: 'Tope de pagos por día (dólares)',
    topeVenta: 'Tope por venta de saldo (dólares)',
    topeDeuda: 'Tope de saldo vendido sin entregar (dólares)',
    avisoFondo: 'Avisarme cuando el fondo baje de (dólares)',
    crearBoton: 'Crear y mandarle el enlace',
    creado: (c: string) =>
      `Agente creado. Le mandamos a ${c} el enlace para crear su contraseña (vale 48 horas).`,
    enlacePrueba: 'Enlace de prueba (solo en el sitio de pruebas):',
    ficha: 'Ficha del agente',
    fondoRecibido: 'Fondo que le has dado',
    enLaMano: 'Dinero de Divoox que tiene en la mano',
    enLaManoAyuda: 'Su fondo sin usar más lo que cobró por saldo vendido.',
    operaciones: (n: number) => (n === 1 ? '1 operación' : `${n} operaciones`),
    anotar: 'Anotar un movimiento',
    concepto: 'Qué pasó',
    conceptos: {
      fondo: 'Le transferí fondo',
      devolucion_fondo: 'Me devolvió fondo que no usó',
      entrega: 'Me entregó el efectivo del saldo vendido',
      compensacion: 'Lo que debe por saldo vendido pasa a su fondo',
    } as Record<string, string>,
    monto: 'Monto (dólares)',
    comprobante: 'Comprobante (referencia de la transferencia o del recibo)',
    motivo: 'Nota (opcional)',
    revisar: 'Revisar',
    confirmarTexto: (c: string, m: string, n: string) =>
      `Vas a anotar «${c}» por ${m} a ${n}. Queda en su libro con tu nombre y no se borra.`,
    confirmar: 'Confirmar',
    anotado: 'Movimiento anotado.',
    datos: 'Datos y topes',
    opciones: 'Más opciones',
    suspender: 'Suspender al agente',
    reactivar: 'Reactivar al agente',
    desbloquear: 'Reactivar sus pagos',
    mandarEnlace: 'Mandarle el enlace de la contraseña',
    enlaceMandado: 'Enlace mandado a su correo.',
    suspenderTexto:
      'Al suspenderlo se cierra su sesión y su panel deja de servir. Su fondo y su libro se conservan.',
    historial: 'Movimientos',
    acciones: 'Lo que hizo en su panel',
    fecha: 'Fecha',
    tipo: 'Movimiento',
    conductor: 'Conductor',
    recibo: 'Recibo',
    accion: 'Acción',
    detalle: 'Detalle',
    tipos: {
      pago: 'Pago a conductor',
      venta: 'Venta de saldo',
      fondo: 'Fondo transferido',
      devolucion_fondo: 'Fondo devuelto',
      entrega: 'Entregó lo vendido',
      compensacion: 'Lo vendido pasó a su fondo',
    } as Record<string, string>,
    nombresAccion: {
      entrada: 'Entró',
      salida: 'Salió',
      entrada_fallida: 'Contraseña equivocada',
      codigo_entrada_fallido: 'Código de entrada equivocado',
      clave_creada: 'Creó su contraseña',
      codigo_visto: 'Vio un código de cobro',
      codigo_fallido: 'Código de cobro equivocado',
      pago: 'Pagó',
      pago_rechazado: 'Pago rechazado',
      conductor_buscado: 'Buscó a un conductor',
      conductor_no_encontrado: 'Buscó y no encontró',
      venta: 'Vendió saldo',
      venta_rechazada: 'Venta rechazada',
    } as Record<string, string>,
    topes: (m: string) => `Tope fijo de Divoox: hasta ${m}.`,
  },
  en: {
    titulo: 'Agents',
    ayuda:
      'A Divoox Agent pays drivers’ earnings in cash and sells them balance. They pay out of the float you transfer outside the system and record here; without float their panel won’t pay. What they sell becomes money they owe you.',
    cargando: 'Loading…',
    guardado: 'Saved.',
    ciudades: 'Cities',
    ciudadesAyuda:
      'The service is off in every city until you turn it on. Once on, drivers in that city see “Cash out”.',
    ciudad: 'City',
    encendido: 'On',
    apagado: 'Off',
    pagaEn: 'Paid out in',
    dolares: 'Dollars (whole amounts only)',
    bolivares: 'Bolívares (today’s rate)',
    minimo: 'Minimum cash-out (dollars)',
    topeConductor: 'Daily limit per driver (dollars)',
    agentesCiudad: 'Agents',
    editar: 'Edit',
    guardar: 'Save',
    cancelar: 'Cancel',
    volver: 'Back',
    agentes: 'Agents',
    sinAgentes: 'There are no agents yet.',
    agente: 'Agent',
    estado: 'Status',
    estados: {
      activo: 'Active',
      suspendido: 'Suspended',
      sinClave: 'Hasn’t set a password yet',
      bloqueado: 'Payouts locked',
    },
    fondo: 'Float',
    debe: 'Owes for balance sold',
    pagado: 'Paid out',
    vendido: 'Sold',
    abrir: 'Open',
    crear: 'Create an agent',
    nombre: 'Agent or business name',
    correo: 'Email (used to sign in to their panel)',
    telefono: 'Phone',
    direccion: 'Location address',
    horario: 'Business hours',
    idioma: 'Panel language',
    topePago: 'Limit per payout (dollars)',
    topeDia: 'Daily payout limit (dollars)',
    topeVenta: 'Limit per balance sale (dollars)',
    topeDeuda: 'Limit of balance sold but not handed over (dollars)',
    avisoFondo: 'Alert me when the float drops below (dollars)',
    crearBoton: 'Create and send the link',
    creado: (c: string) =>
      `Agent created. We sent ${c} the link to set their password (valid for 48 hours).`,
    enlacePrueba: 'Test link (staging only):',
    ficha: 'Agent file',
    fondoRecibido: 'Float you’ve given them',
    enLaMano: 'Divoox money they’re holding',
    enLaManoAyuda: 'Their unused float plus what they collected for balance sold.',
    operaciones: (n: number) => (n === 1 ? '1 transaction' : `${n} transactions`),
    anotar: 'Record an entry',
    concepto: 'What happened',
    conceptos: {
      fondo: 'I transferred float to them',
      devolucion_fondo: 'They returned unused float',
      entrega: 'They handed over the cash from balance sold',
      compensacion: 'What they owe for balance sold moves to their float',
    } as Record<string, string>,
    monto: 'Amount (dollars)',
    comprobante: 'Receipt (transfer or receipt reference)',
    motivo: 'Note (optional)',
    revisar: 'Review',
    confirmarTexto: (c: string, m: string, n: string) =>
      `You’re about to record “${c}” for ${m} for ${n}. It stays in their ledger under your name and can’t be deleted.`,
    confirmar: 'Confirm',
    anotado: 'Entry recorded.',
    datos: 'Details and limits',
    opciones: 'More options',
    suspender: 'Suspend the agent',
    reactivar: 'Reactivate the agent',
    desbloquear: 'Turn their payouts back on',
    mandarEnlace: 'Send the password link',
    enlaceMandado: 'Link sent to their email.',
    suspenderTexto:
      'Suspending closes their session and their panel stops working. Their float and ledger are kept.',
    historial: 'Activity',
    acciones: 'What they did in their panel',
    fecha: 'Date',
    tipo: 'Activity',
    conductor: 'Driver',
    recibo: 'Receipt',
    accion: 'Action',
    detalle: 'Detail',
    tipos: {
      pago: 'Driver payout',
      venta: 'Balance sale',
      fondo: 'Float transferred',
      devolucion_fondo: 'Float returned',
      entrega: 'Handed over sales',
      compensacion: 'Sales moved to their float',
    } as Record<string, string>,
    nombresAccion: {
      entrada: 'Signed in',
      salida: 'Signed out',
      entrada_fallida: 'Wrong password',
      codigo_entrada_fallido: 'Wrong sign-in code',
      clave_creada: 'Set their password',
      codigo_visto: 'Viewed a cash-out code',
      codigo_fallido: 'Wrong cash-out code',
      pago: 'Paid out',
      pago_rechazado: 'Payout rejected',
      conductor_buscado: 'Looked up a driver',
      conductor_no_encontrado: 'Looked up and found no one',
      venta: 'Sold balance',
      venta_rechazada: 'Sale rejected',
    } as Record<string, string>,
    topes: (m: string) => `Fixed Divoox maximum: up to ${m}.`,
  },
};
type Textos = (typeof T)['es'];

type Ag = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  idioma: string;
  zonaId: string;
  ciudad: string;
  direccion: string;
  horario: string;
  estado: string;
  conClave: boolean;
  pagosBloqueados: boolean;
  topePago: number;
  topeDia: number;
  topeVenta: number;
  topeDeuda: number;
  avisoFondo: number;
  fondo: number;
  fondoBajo: boolean;
  deuda: number;
  fondoRecibido: number;
  pagado: number;
  pagos: number;
  vendido: number;
  ventas: number;
};
type Ciudad = {
  zonaId: string;
  nombre: string;
  pais: string;
  moneda: string;
  activo: boolean;
  pagaEn: 'USD' | 'VES';
  minimo: number;
  topeConductorDia: number;
  agentes: number;
};
type Topes = Record<string, number>;
type Datos = { agentes: Ag[]; ciudades: Ciudad[]; topes: Topes };
type Ficha = {
  agente: Ag;
  historial: {
    tipo: string;
    numero: string;
    monto: number;
    cuando: string;
    conductor: string;
    concepto: string;
    motivo: string;
  }[];
  acciones: { accion: string; objeto: string; detalle: string; ip: string; creadoEn: string }[];
};

const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);
const aDolares = (c: number) => String(c / 100);
const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
const cuando = (sql: string, idioma: Idioma) => {
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? sql
    : d.toLocaleString(idioma === 'es' ? 'es' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
};

export function SuperAgentes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [editarCiudad, setEditarCiudad] = useState<Ciudad | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    let vivo = true;
    pedir<Datos>('GET', '/datos/admin/agentes')
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((x: unknown) => {
        if (vivo) setError(mensaje(x));
      });
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  const recargar = () => setVuelta((n) => n + 1);
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);
  if (!datos)
    return (
      <div className="super" data-testid="super-agentes">
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
  const estadoDe = (a: Ag) =>
    a.estado !== 'activo'
      ? t.estados.suspendido
      : !a.conClave
        ? t.estados.sinClave
        : a.pagosBloqueados
          ? t.estados.bloqueado
          : t.estados.activo;
  if (abierto)
    return (
      <FichaAgente
        id={abierto}
        t={t}
        idioma={idioma}
        dinero={dinero}
        datos={datos}
        estadoDe={estadoDe}
        alVolver={() => {
          setAbierto(null);
          recargar();
        }}
      />
    );
  // Primero las ciudades encendidas o con agentes; el resto queda a mano más abajo.
  const ciudades = [...datos.ciudades].sort(
    (a, b) => Number(b.activo) - Number(a.activo) || b.agentes - a.agentes,
  );
  return (
    <div className="super" data-testid="super-agentes">
      <h2>
        {t.titulo}
        <AyudaAqui guia="divoox-agents" idioma={idioma} />
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
      <h3>{t.agentes}</h3>
      {datos.agentes.length === 0 ? (
        <p className="pista">{t.sinAgentes}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla" aria-label={t.agentes} data-testid="agentes-tabla">
            <thead>
              <tr>
                <th>{t.agente}</th>
                <th>{t.ciudad}</th>
                <th>{t.estado}</th>
                <th>{t.fondo}</th>
                <th>{t.debe}</th>
                <th>{t.pagado}</th>
                <th>{t.vendido}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {datos.agentes.map((a) => (
                <tr key={a.id}>
                  <td>{a.nombre}</td>
                  <td>{a.ciudad}</td>
                  <td>{estadoDe(a)}</td>
                  <td className={a.fondoBajo ? 'peligro' : undefined}>{dinero(a.fondo)}</td>
                  <td>{dinero(a.deuda)}</td>
                  <td>{dinero(a.pagado)}</td>
                  <td>{dinero(a.vendido)}</td>
                  <td>
                    <button
                      type="button"
                      className="boton secundario"
                      onClick={() => {
                        setOk('');
                        setAbierto(a.id);
                      }}
                    >
                      {t.abrir}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FormAgente
        t={t}
        idioma={idioma}
        ciudades={ciudades}
        topes={datos.topes}
        dinero={dinero}
        alGuardar={(m) => {
          setOk(m);
          recargar();
        }}
      />
      <h3>{t.ciudades}</h3>
      <p className="pista">{t.ciudadesAyuda}</p>
      {editarCiudad ? (
        <FormCiudad
          key={editarCiudad.zonaId}
          c={editarCiudad}
          t={t}
          idioma={idioma}
          alGuardar={() => {
            setEditarCiudad(null);
            setOk(t.guardado);
            recargar();
          }}
          alCancelar={() => setEditarCiudad(null)}
        />
      ) : null}
      <div className="tabla-ancha">
        <table className="tabla" aria-label={t.ciudades} data-testid="agentes-ciudades">
          <thead>
            <tr>
              <th>{t.ciudad}</th>
              <th>{t.estado}</th>
              <th>{t.pagaEn}</th>
              <th>{t.minimo}</th>
              <th>{t.topeConductor}</th>
              <th>{t.agentesCiudad}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ciudades.map((c) => (
              <tr key={c.zonaId}>
                <td>{c.nombre}</td>
                <td>
                  <span
                    className={`regalo-estado ${c.activo ? 'regalo-encendido' : 'regalo-apagado'}`}
                  >
                    {c.activo ? t.encendido : t.apagado}
                  </span>
                </td>
                <td>{c.pagaEn === 'VES' ? t.bolivares : t.dolares}</td>
                <td>{dinero(c.minimo)}</td>
                <td>{dinero(c.topeConductorDia)}</td>
                <td>{c.agentes}</td>
                <td>
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => {
                      setOk('');
                      setEditarCiudad(c);
                    }}
                  >
                    {t.editar}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormCiudad({
  c,
  t,
  idioma,
  alGuardar,
  alCancelar,
}: {
  c: Ciudad;
  t: Textos;
  idioma: Idioma;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const b = useBorrador({
    formulario: `agentes-ciudad-${c.zonaId}`,
    cuenta: 'superadmin',
    inicial: {
      activo: c.activo,
      pagaEn: c.pagaEn as string,
      minimo: aDolares(c.minimo),
      tope: aDolares(c.topeConductorDia),
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await pedir('PUT', `/datos/admin/agentes-ciudad/${encodeURIComponent(c.zonaId)}`, {
        activo: v.activo,
        pagaEn: v.pagaEn,
        minimo: aCentavos(v.minimo),
        topeConductorDia: aCentavos(v.tope),
      });
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="agentes-ciudad-form">
      <h3>{c.nombre}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={guardar}>
        <label className="casilla">
          <input
            type="checkbox"
            checked={v.activo}
            onChange={(e) => b.cambiar('activo', e.target.checked)}
          />{' '}
          {t.encendido}
        </label>
        <label className="campo">
          {t.pagaEn}
          <select value={v.pagaEn} onChange={(e) => b.cambiar('pagaEn', e.target.value)}>
            <option value="USD">{t.dolares}</option>
            {c.pais === 'VE' ? <option value="VES">{t.bolivares}</option> : null}
          </select>
        </label>
        <label className="campo">
          {t.minimo}
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={v.minimo}
            onChange={(e) => b.cambiar('minimo', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.topeConductor}
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={v.tope}
            onChange={(e) => b.cambiar('tope', e.target.value)}
          />
        </label>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={enviando}>
            {t.guardar}
          </button>
          <button type="button" className="boton secundario" onClick={alCancelar}>
            {t.cancelar}
          </button>
        </div>
      </form>
    </div>
  );
}

const CAMPOS_TOPE = [
  ['topePago', 'pagoMaximo'],
  ['topeDia', 'diaMaximo'],
  ['topeVenta', 'ventaMaxima'],
  ['topeDeuda', 'deudaMaxima'],
  ['avisoFondo', 'anotacionMaxima'],
] as const;

/** Crear un agente o editar sus datos y topes (la misma pieza). */
function FormAgente({
  t,
  idioma,
  ciudades,
  topes,
  dinero,
  agente,
  alGuardar,
}: {
  t: Textos;
  idioma: Idioma;
  ciudades: Ciudad[];
  topes: Topes;
  dinero: (c: number) => string;
  agente?: Ag;
  alGuardar: (mensaje: string) => void;
}) {
  const b = useBorrador({
    formulario: agente ? `agente-editar-${agente.id}` : 'agente-crear',
    cuenta: 'superadmin',
    inicial: {
      nombre: agente?.nombre ?? '',
      correo: agente?.correo ?? '',
      telefono: agente?.telefono ?? '',
      zonaId: agente?.zonaId ?? ciudades[0]?.zonaId ?? '',
      direccion: agente?.direccion ?? '',
      horario: agente?.horario ?? '',
      idioma: agente?.idioma ?? 'es',
      topePago: aDolares(agente?.topePago ?? 10_000),
      topeDia: aDolares(agente?.topeDia ?? 50_000),
      topeVenta: aDolares(agente?.topeVenta ?? 10_000),
      topeDeuda: aDolares(agente?.topeDeuda ?? 50_000),
      avisoFondo: aDolares(agente?.avisoFondo ?? 5_000),
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [enlace, setEnlace] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnlace('');
    setEnviando(true);
    const cuerpo = {
      nombre: v.nombre,
      telefono: v.telefono,
      zonaId: v.zonaId,
      direccion: v.direccion,
      horario: v.horario,
      idioma: v.idioma,
      topePago: aCentavos(v.topePago),
      topeDia: aCentavos(v.topeDia),
      topeVenta: aCentavos(v.topeVenta),
      topeDeuda: aCentavos(v.topeDeuda),
      avisoFondo: aCentavos(v.avisoFondo),
    };
    try {
      if (agente) {
        await pedir('PATCH', `/datos/admin/agentes/${agente.id}`, cuerpo);
        await b.limpiar();
        alGuardar(t.guardado);
      } else {
        const r = await pedir<{ enlace?: { enlacePrueba?: string } }>(
          'POST',
          '/datos/admin/agentes',
          { ...cuerpo, correo: v.correo },
        );
        const correo = v.correo;
        await b.limpiar();
        setEnlace(r.enlace?.enlacePrueba ?? '');
        alGuardar(t.creado(correo));
      }
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }
  // Lectura por nombre de casilla sin indexar el objeto con una variable (regla de seguridad).
  const valorDe = (clave: string) =>
    String(new Map<string, unknown>(Object.entries(v)).get(clave) ?? '');
  const texto = (
    clave: 'nombre' | 'correo' | 'telefono' | 'direccion' | 'horario',
    etiqueta: string,
    tipo = 'text',
    marcador = etiqueta,
  ) => (
    <label className="campo">
      {etiqueta}
      <input
        type={tipo}
        value={valorDe(clave)}
        placeholder={marcador}
        onChange={(e) => b.cambiar(clave, e.target.value)}
      />
    </label>
  );
  return (
    <div className="flex-tarjeta" data-testid={agente ? 'agente-editar' : 'agente-crear'}>
      <h3>{agente ? t.datos : t.crear}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={guardar}>
        {texto('nombre', t.nombre)}
        {agente ? null : texto('correo', t.correo, 'email', correoEjemplo(idioma))}
        {texto('telefono', t.telefono, 'tel')}
        <label className="campo">
          {t.ciudad}
          <select value={v.zonaId} onChange={(e) => b.cambiar('zonaId', e.target.value)}>
            {ciudades.map((c) => (
              <option key={c.zonaId} value={c.zonaId}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        {texto('direccion', t.direccion)}
        {texto('horario', t.horario)}
        <label className="campo">
          {t.idioma}
          <select value={v.idioma} onChange={(e) => b.cambiar('idioma', e.target.value)}>
            <option value="es">español - ES</option>
            <option value="en">English - EN</option>
          </select>
        </label>
        {CAMPOS_TOPE.map(([clave, maximo]) => (
          <label className="campo" key={clave}>
            {String(new Map<string, unknown>(Object.entries(t)).get(clave) ?? '')}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={valorDe(clave)}
              onChange={(e) => b.cambiar(clave, e.target.value)}
            />
            <small className="pista">
              {t.topes(dinero(new Map(Object.entries(topes)).get(maximo) ?? 0))}
            </small>
          </label>
        ))}
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={enviando}>
            {agente ? t.guardar : t.crearBoton}
          </button>
        </div>
      </form>
      {enlace ? (
        <p className="pista" data-testid="agente-enlace-prueba">
          {t.enlacePrueba} <code>{enlace}</code>
        </p>
      ) : null}
    </div>
  );
}

function FichaAgente({
  id,
  t,
  idioma,
  dinero,
  datos,
  estadoDe,
  alVolver,
}: {
  id: string;
  t: Textos;
  idioma: Idioma;
  dinero: (c: number) => string;
  datos: Datos;
  estadoDe: (a: Ag) => string;
  alVolver: () => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [suspendiendo, setSuspendiendo] = useState(false);
  useEffect(() => {
    let vivo = true;
    pedir<Ficha>('GET', `/datos/admin/agentes/${id}`)
      .then((d) => {
        if (vivo) setFicha(d);
      })
      .catch((x: unknown) => {
        if (vivo) setError(mensaje(x));
      });
    return () => {
      vivo = false;
    };
  }, [id, vuelta]);
  const recargar = () => setVuelta((n) => n + 1);
  async function cambiar(cuerpo: Record<string, unknown>) {
    setError('');
    setOk('');
    try {
      await pedir('PATCH', `/datos/admin/agentes/${id}`, cuerpo);
      setSuspendiendo(false);
      setOk(t.guardado);
      recargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }
  async function mandarEnlace() {
    setError('');
    setOk('');
    try {
      await pedir('POST', `/datos/admin/agentes/${id}/enlace`, {});
      setOk(t.enlaceMandado);
    } catch (x) {
      setError(mensaje(x));
    }
  }
  const a = ficha?.agente;
  return (
    <div className="super" data-testid="agente-ficha">
      <button type="button" className="enlace" onClick={alVolver}>
        ← {t.agentes}
      </button>
      <h2>{a ? a.nombre : t.ficha}</h2>
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
      {!ficha || !a ? (
        <p className="pista">{t.cargando}</p>
      ) : (
        <>
          <div className="fila-botones">
            <span className="pista">{`${a.ciudad} · ${a.correo} · ${estadoDe(a)}`}</span>
            <MenuTresPuntos
              etiqueta={t.opciones}
              opciones={[
                { texto: t.mandarEnlace, alTocar: () => void mandarEnlace() },
                ...(a.pagosBloqueados
                  ? [
                      {
                        texto: t.desbloquear,
                        alTocar: () => void cambiar({ desbloquearPagos: true }),
                      },
                    ]
                  : []),
                a.estado === 'activo'
                  ? { texto: t.suspender, peligro: true, alTocar: () => setSuspendiendo(true) }
                  : { texto: t.reactivar, alTocar: () => void cambiar({ estado: 'activo' }) },
              ]}
            />
          </div>
          {suspendiendo ? (
            <div className="flex-tarjeta" data-testid="agente-suspender">
              <p>{t.suspenderTexto}</p>
              <div className="fila-botones">
                <button
                  type="button"
                  className="boton"
                  onClick={() => void cambiar({ estado: 'suspendido' })}
                >
                  {t.suspender}
                </button>
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => setSuspendiendo(false)}
                >
                  {t.cancelar}
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex-kpis" data-testid="agente-conciliacion">
            {(
              [
                [t.fondo, dinero(a.fondo), a.fondoBajo],
                [t.debe, dinero(a.deuda), false],
                [t.enLaMano, dinero(a.fondo + a.deuda), false],
                [t.fondoRecibido, dinero(a.fondoRecibido), false],
                [`${t.pagado} · ${t.operaciones(a.pagos)}`, dinero(a.pagado), false],
                [`${t.vendido} · ${t.operaciones(a.ventas)}`, dinero(a.vendido), false],
              ] as const
            ).map(([etiqueta, valor, rojo]) => (
              <div key={etiqueta} className="flex-kpi">
                <span>{etiqueta}</span>
                <strong className={rojo ? 'peligro' : undefined}>{valor}</strong>
              </div>
            ))}
          </div>
          <p className="pista">{t.enLaManoAyuda}</p>
          <FormLibro
            a={a}
            t={t}
            idioma={idioma}
            dinero={dinero}
            tope={datos.topes.anotacionMaxima ?? 0}
            alAnotar={() => {
              setOk(t.anotado);
              recargar();
            }}
          />
          <FormAgente
            key={`${a.id}-${vuelta}`}
            t={t}
            idioma={idioma}
            ciudades={datos.ciudades}
            topes={datos.topes}
            dinero={dinero}
            agente={a}
            alGuardar={(m) => {
              setOk(m);
              recargar();
            }}
          />
          <h3>{t.historial}</h3>
          <div className="tabla-ancha">
            <table className="tabla" aria-label={t.historial} data-testid="agente-historial">
              <thead>
                <tr>
                  <th>{t.fecha}</th>
                  <th>{t.tipo}</th>
                  <th>{t.conductor}</th>
                  <th>{t.monto}</th>
                  <th>{t.recibo}</th>
                </tr>
              </thead>
              <tbody>
                {ficha.historial.map((m, i) => (
                  <tr key={`${m.cuando}-${i}`}>
                    <td>{cuando(m.cuando, idioma)}</td>
                    <td>
                      {t.tipos[m.tipo === 'pago' || m.tipo === 'venta' ? m.tipo : m.concepto] ??
                        m.concepto}
                    </td>
                    <td>{m.conductor}</td>
                    <td>{dinero(Math.abs(m.monto))}</td>
                    <td>{m.numero || m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>{t.acciones}</h3>
          <div className="tabla-ancha">
            <table className="tabla" aria-label={t.acciones} data-testid="agente-acciones">
              <thead>
                <tr>
                  <th>{t.fecha}</th>
                  <th>{t.accion}</th>
                  <th>{t.detalle}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {ficha.acciones.map((x, i) => (
                  <tr key={`${x.creadoEn}-${i}`}>
                    <td>{cuando(x.creadoEn, idioma)}</td>
                    <td>{t.nombresAccion[x.accion] ?? x.accion}</td>
                    <td>{x.detalle}</td>
                    <td>{x.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FormLibro({
  a,
  t,
  idioma,
  dinero,
  tope,
  alAnotar,
}: {
  a: Ag;
  t: Textos;
  idioma: Idioma;
  dinero: (c: number) => string;
  tope: number;
  alAnotar: () => void;
}) {
  const b = useBorrador({
    formulario: `agente-libro-${a.id}`,
    cuenta: 'superadmin',
    inicial: { concepto: 'fondo', monto: '', comprobante: '', motivo: '' },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const monto = aCentavos(v.monto);
  async function confirmar() {
    setError('');
    setEnviando(true);
    try {
      await pedir('POST', `/datos/admin/agentes/${a.id}/libro`, {
        concepto: v.concepto,
        monto,
        comprobante: v.comprobante,
        motivo: v.motivo,
      });
      await b.limpiar();
      setRevisando(false);
      alAnotar();
    } catch (x) {
      setRevisando(false);
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="agente-libro">
      <h3>{t.anotar}</h3>
      <p className="pista">{t.topes(dinero(tope))}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {revisando ? (
        <>
          <p data-testid="agente-libro-confirmar">
            {t.confirmarTexto(t.conceptos[v.concepto] ?? v.concepto, dinero(monto), a.nombre)}
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
            if (v.comprobante.trim().length < 3) return setError(t.comprobante);
            setRevisando(true);
          }}
        >
          <label className="campo">
            {t.concepto}
            <select value={v.concepto} onChange={(e) => b.cambiar('concepto', e.target.value)}>
              {Object.entries(t.conceptos).map(([clave, nombre]) => (
                <option key={clave} value={clave}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            {t.monto}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={v.monto}
              onChange={(e) => b.cambiar('monto', e.target.value)}
            />
          </label>
          <label className="campo">
            {t.comprobante}
            <input
              value={v.comprobante}
              onChange={(e) => b.cambiar('comprobante', e.target.value)}
            />
          </label>
          <label className="campo">
            {t.motivo}
            <input value={v.motivo} onChange={(e) => b.cambiar('motivo', e.target.value)} />
          </label>
          <div className="fila-botones">
            <button type="submit" className="boton">
              {t.revisar}
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
