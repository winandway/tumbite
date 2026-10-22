import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearMonto,
  formatearTotales,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { ir } from '../ruta';
import { pedir } from './api';

/**
 * Superadmin a escala: ciudades → repartidores / clientes / restaurantes de cada ciudad, con
 * buscador (ID, nombre, correo, teléfono) y listas paginadas de a 50. Cada uno con su ficha completa.
 */
const T = {
  es: {
    ciudades: 'Ciudades',
    activa: 'Activa',
    inactiva: 'No activa',
    restaurantes: 'Restaurantes',
    repartidores: 'Repartidores',
    conectados: 'conectados',
    clientes: 'Clientes',
    pedidos30: 'Pedidos (30 días)',
    todas: 'Todas las ciudades',
    buscarRep: 'Buscar por ID (US-MIA-000123 o el número), nombre o correo',
    buscarCli: 'Buscar por nombre, correo, teléfono o ID',
    buscar: 'Buscar',
    mas: 'Cargar más',
    vacio: 'No hay resultados.',
    id: 'ID',
    nombre: 'Nombre',
    vehiculo: 'Vehículo',
    seguro: 'Seguro',
    licencia: 'Licencia',
    antecedentes: 'Antecedentes',
    estadoDoc: {
      vigente: 'Vigente',
      vencido: 'Vencido',
      por_vencer: 'Por vencer',
      sin_datos: 'Sin datos',
    } as Record<string, string>,
    estadoAnt: { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' } as Record<
      string,
      string
    >,
    vehiculos: {
      '': '—',
      carro: 'Carro',
      moto: 'Moto',
      scooter: 'Scooter',
      bicicleta: 'Bicicleta',
      a_pie: 'A pie',
    } as Record<string, string>,
    enLinea: 'En línea',
    fueraLinea: 'Desconectado',
    volver: '← Volver',
    datos: 'Datos personales',
    correo: 'Correo',
    telefono: 'Teléfono',
    nacimiento: 'Fecha de nacimiento',
    alta: 'Alta',
    ciudad: 'Ciudad',
    tipo: 'Tipo',
    tipos: { independiente: 'Independiente', empleado: 'Empleado' } as Record<string, string>,
    marcaModelo: 'Marca y modelo',
    anio: 'Año',
    color: 'Color',
    placa: 'Placa',
    licenciaNum: 'Número de licencia',
    vence: 'vence',
    aseguradora: 'Aseguradora',
    poliza: 'Póliza',
    seguroTumbite: 'Con el seguro de Divoox',
    ubicacion: 'Última ubicación',
    verMapa: 'Ver en el mapa',
    entregas: 'Entregas',
    ganado: 'Ganado',
    propinas: 'Propinas',
    saldo: 'Saldo',
    calificacion: 'Calificación',
    historial: 'Historial',
    quejas: 'Quejas y tickets',
    sinQuejas: 'Sin quejas.',
    revisar: 'Revisión',
    aprobar: 'Aprobar antecedentes',
    rechazar: 'Rechazar',
    darSeguro: 'Dar seguro de Divoox',
    quitarSeguro: 'Quitar seguro de Divoox',
    compras: 'Compras',
    gastado: 'Gastado',
    empresa: 'Empresa',
    nombreLegal: 'Nombre legal',
    tipoEmpresa: 'Tipo de empresa',
    direccionFiscal: 'Dirección fiscal',
    dueno: 'Dueño',
    manager: 'Manager',
    horario: 'Horario',
    web: 'Sitio web',
    cuenta: 'Cuenta en Divoox',
    menu: 'Menú',
    platos: 'platos',
    disponibles: 'disponibles',
    ventas30: 'Ventas (30 días)',
    comision30: 'Comisión (30 días)',
    plan: 'Plan',
    estado: 'Estado',
    ultimos: 'Últimos pedidos',
    sinEmpresa: 'El restaurante todavía no llenó los datos de su empresa.',
  },
  en: {
    ciudades: 'Cities',
    activa: 'Active',
    inactiva: 'Not active',
    restaurantes: 'Restaurants',
    repartidores: 'Drivers',
    conectados: 'online',
    clientes: 'Customers',
    pedidos30: 'Orders (30 days)',
    todas: 'All cities',
    buscarRep: 'Search by ID (US-MIA-000123 or the number), name, or email',
    buscarCli: 'Search by name, email, phone, or ID',
    buscar: 'Search',
    mas: 'Load more',
    vacio: 'No results.',
    id: 'ID',
    nombre: 'Name',
    vehiculo: 'Vehicle',
    seguro: 'Insurance',
    licencia: 'License',
    antecedentes: 'Background',
    estadoDoc: {
      vigente: 'Valid',
      vencido: 'Expired',
      por_vencer: 'Expiring soon',
      sin_datos: 'No data',
    } as Record<string, string>,
    estadoAnt: { pendiente: 'Pending', aprobado: 'Approved', rechazado: 'Rejected' } as Record<
      string,
      string
    >,
    vehiculos: {
      '': '—',
      carro: 'Car',
      moto: 'Motorbike',
      scooter: 'Scooter',
      bicicleta: 'Bicycle',
      a_pie: 'On foot',
    } as Record<string, string>,
    enLinea: 'Online',
    fueraLinea: 'Offline',
    volver: '← Back',
    datos: 'Personal details',
    correo: 'Email',
    telefono: 'Phone',
    nacimiento: 'Date of birth',
    alta: 'Joined',
    ciudad: 'City',
    tipo: 'Type',
    tipos: { independiente: 'Independent', empleado: 'Employee' } as Record<string, string>,
    marcaModelo: 'Make and model',
    anio: 'Year',
    color: 'Color',
    placa: 'Plate',
    licenciaNum: 'License number',
    vence: 'expires',
    aseguradora: 'Insurer',
    poliza: 'Policy',
    seguroTumbite: 'With Divoox insurance',
    ubicacion: 'Last location',
    verMapa: 'See on map',
    entregas: 'Deliveries',
    ganado: 'Earned',
    propinas: 'Tips',
    saldo: 'Balance',
    calificacion: 'Rating',
    historial: 'History',
    quejas: 'Complaints and tickets',
    sinQuejas: 'No complaints.',
    revisar: 'Review',
    aprobar: 'Approve background',
    rechazar: 'Reject',
    darSeguro: 'Give Divoox insurance',
    quitarSeguro: 'Remove Divoox insurance',
    compras: 'Purchases',
    gastado: 'Spent',
    empresa: 'Company',
    nombreLegal: 'Legal name',
    tipoEmpresa: 'Company type',
    direccionFiscal: 'Tax address',
    dueno: 'Owner',
    manager: 'Manager',
    horario: 'Hours',
    web: 'Website',
    cuenta: 'Divoox account',
    menu: 'Menu',
    platos: 'items',
    disponibles: 'available',
    ventas30: 'Sales (30 days)',
    comision30: 'Commission (30 days)',
    plan: 'Plan',
    estado: 'Status',
    ultimos: 'Latest orders',
    sinEmpresa: 'The restaurant hasn’t filled in its company details yet.',
  },
};

const consulta = () => new URLSearchParams(window.location.search);
const fechaCorta = (f: string | null | undefined, idioma: Idioma) =>
  f
    ? new Date(`${f.replace(' ', 'T')}${f.includes('T') ? '' : 'Z'}`).toLocaleDateString(idioma)
    : '—';

const T_SUSPENDER = {
  es: {
    suspender: 'Suspender la cuenta',
    reactivar: 'Reactivar la cuenta',
    suspendida: 'Cuenta suspendida: no puede entrar.',
    pregunta: 'Motivo de la suspensión (queda en el registro):',
    confirmarReactivar: '¿Reactivar esta cuenta?',
  },
  en: {
    suspender: 'Suspend account',
    reactivar: 'Reactivate account',
    suspendida: 'Account suspended: they can’t sign in.',
    pregunta: 'Reason for the suspension (kept in the log):',
    confirmarReactivar: 'Reactivate this account?',
  },
};

/** Suspender o reactivar una cuenta desde su ficha (auditoría final, punto 26). */
function BotonSuspender({
  id,
  activo,
  idioma,
  recargar,
}: {
  id: string;
  activo: boolean;
  idioma: Idioma;
  recargar: () => void;
}) {
  const t = enIdioma(T_SUSPENDER, idioma);
  const [error, setError] = useState('');
  async function cambiar() {
    let motivo = '';
    if (activo) {
      motivo = window.prompt(t.pregunta) ?? '';
      if (motivo.trim().length < 3) return;
    } else if (!window.confirm(t.confirmarReactivar)) return;
    setError('');
    try {
      await pedir('PATCH', `/datos/admin/usuarios/${id}`, { activo: !activo, motivo });
      recargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }
  return (
    <p className="super-suspender">
      {!activo ? <strong className="error-general">{t.suspendida}</strong> : null}{' '}
      <button type="button" className="enlace" onClick={() => void cambiar()}>
        {activo ? t.suspender : t.reactivar}
      </button>
      {error ? (
        <span className="error-general" role="alert">
          {' '}
          {error}
        </span>
      ) : null}
    </p>
  );
}

function useCargar<T>(url: string | null) {
  const [x, setX] = useState<T | null>(null);
  const [error, setError] = useState('');
  const recargar = useCallback(() => {
    if (!url) return;
    pedir<T>('GET', url)
      .then(setX)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [url]);
  useEffect(recargar, [recargar]);
  return { x, error, recargar };
}

type Ciudad = {
  id: string;
  nombre: string;
  pais: string;
  codigo: string;
  activa: boolean;
  restaurantes: number;
  repartidores: number;
  conectados: number;
  clientes: number;
  pedidos30: number;
};

export function SuperCiudades({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const { x, error } = useCargar<{ ciudades: Ciudad[] }>('/datos/admin/ciudades');
  if (!x) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  return (
    <section className="super">
      <h1>{t.ciudades}</h1>
      <ul className="super-franquicias">
        {x.ciudades.map((z) => (
          <li key={z.id} className="tarjeta-form">
            <h2>
              {z.nombre}{' '}
              <small>
                {z.pais}-{z.codigo} · {z.activa ? t.activa : t.inactiva}
              </small>
            </h2>
            <ul className="super-lista">
              <li>
                <Enlace a={`${base}/restaurants?zona=${z.id}`}>
                  {t.restaurantes}: {z.restaurantes}
                </Enlace>
              </li>
              <li>
                <Enlace a={`${base}/drivers?zona=${z.id}`}>
                  {t.repartidores}: {z.repartidores} ({z.conectados} {t.conectados})
                </Enlace>
              </li>
              <li>
                <Enlace a={`${base}/customers?zona=${z.id}`}>
                  {t.clientes}: {z.clientes}
                </Enlace>
              </li>
              <li>
                {t.pedidos30}: {z.pedidos30}
              </li>
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Buscador con lista paginada «cargar más» (por clave, sirve con millones). */
function useBuscador<T>(ruta: string, clave: 'repartidores' | 'clientes') {
  const q0 = consulta();
  const [zona, setZona] = useState(q0.get('zona') ?? '');
  const [q, setQ] = useState(q0.get('q') ?? '');
  const [filas, setFilas] = useState<T[] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pedirPagina = useCallback(
    async (despues: string | null, texto: string, z: string) => {
      const p = new URLSearchParams();
      if (z) p.set('zona', z);
      if (texto) p.set('q', texto);
      if (despues) p.set('despues', despues);
      try {
        const r = await pedir<Record<string, unknown>>('GET', `${ruta}?${p.toString()}`);
        const nuevas = (new Map(Object.entries(r)).get(clave) ?? []) as T[];
        setFilas((viejas) => (despues ? [...(viejas ?? []), ...nuevas] : nuevas));
        setSiguiente((r.siguiente as string | null) ?? null);
      } catch (e) {
        setError(e instanceof ErrorApi ? e.message : String(e));
      }
    },
    [ruta, clave],
  );
  useEffect(() => {
    void Promise.resolve().then(() => pedirPagina(null, q0.get('q') ?? '', q0.get('zona') ?? ''));
    // Solo al abrir: después busca el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    zona,
    setZona,
    q,
    setQ,
    filas,
    siguiente,
    error,
    buscar: () => void pedirPagina(null, q, zona),
    mas: () => void pedirPagina(siguiente, q, zona),
  };
}

export function SelectorCiudad({
  zona,
  cambiar,
  idioma,
}: {
  zona: string;
  cambiar: (z: string) => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const { x } = useCargar<{ ciudades: Ciudad[] }>('/datos/admin/ciudades');
  return (
    <select value={zona} onChange={(e) => cambiar(e.target.value)} aria-label={t.ciudad}>
      <option value="">{t.todas}</option>
      {x?.ciudades.map((z) => (
        <option key={z.id} value={z.id}>
          {z.nombre} ({z.repartidores + z.clientes})
        </option>
      ))}
    </select>
  );
}

type FilaRep = {
  id: string;
  codigo: string;
  nombre: string;
  correo: string;
  conectado: boolean;
  vehiculo: string;
  placa: string;
  seguro: string;
  licencia: string;
  antecedentes: string;
  entregas: number;
};

export function SuperRepartidores({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBuscador<FilaRep>('/datos/admin/repartidores', 'repartidores');
  return (
    <section className="super">
      <h1>{t.repartidores}</h1>
      <div className="super-busqueda" role="search">
        <SelectorCiudad zona={b.zona} cambiar={b.setZona} idioma={idioma} />
        <input
          value={b.q}
          onChange={(e) => b.setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') b.buscar();
          }}
          placeholder={t.buscarRep}
          aria-label={t.buscarRep}
        />
        <button type="button" className="boton" onClick={b.buscar}>
          {t.buscar}
        </button>
      </div>
      {b.error && (
        <p className="error-general" role="alert">
          {b.error}
        </p>
      )}
      {b.filas?.length === 0 && <p>{t.vacio}</p>}
      {b.filas && b.filas.length > 0 && (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.id}</th>
                <th>{t.nombre}</th>
                <th>{t.vehiculo}</th>
                <th>{t.licencia}</th>
                <th>{t.seguro}</th>
                <th>{t.antecedentes}</th>
                <th>{t.entregas}</th>
              </tr>
            </thead>
            <tbody>
              {b.filas.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Enlace a={`${base}/drivers/${r.id}`}>{r.codigo || '—'}</Enlace>
                  </td>
                  <td>
                    <span className={`punto ${r.conectado ? 'en-linea' : ''}`} aria-hidden="true" />{' '}
                    {r.nombre}
                  </td>
                  <td>
                    {t.vehiculos[r.vehiculo] ?? r.vehiculo} {r.placa}
                  </td>
                  <td className={`doc-${r.licencia}`}>{t.estadoDoc[r.licencia]}</td>
                  <td className={`doc-${r.seguro}`}>{t.estadoDoc[r.seguro]}</td>
                  <td>{t.estadoAnt[r.antecedentes]}</td>
                  <td>{r.entregas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {b.siguiente && (
        <button type="button" className="boton secundario" onClick={b.mas}>
          {t.mas}
        </button>
      )}
    </section>
  );
}

type Kyc = {
  usuarioId: string;
  estado: string;
  enviadoEn: string | null;
  revisadoEn: string | null;
};

const TK = {
  es: {
    titulo: 'Verificación de identidad',
    estados: {
      sin_enviar: 'Sin enviar',
      pendiente: 'Esperando revisión',
      aprobado: 'Verificado',
      rechazado: 'Rechazado: tiene que repetir las fotos',
    } as Record<string, string>,
    revisar: 'Ver las fotos y revisar',
  },
  en: {
    titulo: 'Identity verification',
    estados: {
      sin_enviar: 'Not sent',
      pendiente: 'Waiting for review',
      aprobado: 'Verified',
      rechazado: 'Rejected: needs to retake the photos',
    } as Record<string, string>,
    revisar: 'See the photos and review',
  },
};

/** Estado del KYC dentro de la ficha, con el enlace a la revisión cuando hay fotos. */
function KycFicha({ base, kyc, idioma }: { base: string; kyc: Kyc; idioma: Idioma }) {
  const t = enIdioma(TK, idioma);
  return (
    <p className="super-kyc">
      {t.titulo}:{' '}
      <span className={`insignia ${kyc.estado === 'aprobado' ? 'insignia-aprobado' : ''}`}>
        {t.estados[kyc.estado] ?? kyc.estado}
      </span>
      {kyc.estado !== 'sin_enviar' && (
        <>
          {' · '}
          <Enlace a={`${base}/verifications/${kyc.usuarioId}`}>{t.revisar}</Enlace>
        </>
      )}
    </p>
  );
}

type Repartidor = {
  activo?: boolean;
  kyc: Kyc;
  id: string;
  codigo: string;
  nombre: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string | null;
  alta: string;
  ciudad: string;
  tipo: string;
  conectado: boolean;
  puntos: number;
  ubicacion: { lat: number; lng: number; cuando: string | null } | null;
  datos: {
    vehiculoTipo: string;
    marca: string;
    modelo: string;
    anio: number | null;
    color: string;
    placa: string;
    licenciaNumero: string;
    licenciaEstado: string;
    licenciaVence: string | null;
    seguroAseguradora: string;
    seguroPoliza: string;
    seguroVence: string | null;
    seguroTumbite: boolean;
    antecedentes: string;
    estadoLicencia: string;
    estadoSeguro: string;
  };
  entregas: number;
  ganado: number;
  propinas: number;
  /** C-MONEDA-RECORRIDO: lo ganado por moneda (nunca se suman monedas distintas). */
  porMoneda?: { moneda: string; entregas: number; ganado: number; propinas: number }[];
  saldo: number;
  calificacion: number | null;
  calificaciones: number;
  historial: {
    id: string;
    estado: string;
    fecha: string;
    gana: number;
    propina: number;
    moneda?: string | null;
    km: number | null;
    restaurante: string;
  }[];
  quejas: { id: string; asunto: string; estado: string; fecha: string }[];
};

function Quejas({
  base,
  quejas,
  idioma,
}: {
  base: string;
  quejas: { id: string; asunto: string; estado: string; fecha: string }[];
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  return (
    <div className="tarjeta-form">
      <h2>{t.quejas}</h2>
      {quejas.length === 0 ? (
        <p>{t.sinQuejas}</p>
      ) : (
        <ul className="super-lista">
          {quejas.map((q) => (
            <li key={q.id}>
              <Enlace a={`${base}/tickets/${q.id}`}>{q.asunto}</Enlace> · {q.estado} ·{' '}
              {fechaCorta(q.fecha, idioma)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SuperRepartidor({
  base,
  id,
  idioma,
}: {
  base: string;
  id: string;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const { x, error, recargar } = useCargar<{ repartidor: Repartidor }>(
    `/datos/admin/repartidores/${id}`,
  );
  async function revisar(cambios: Record<string, unknown>) {
    await pedir('PATCH', `/datos/admin/repartidores/${id}`, cambios);
    recargar();
  }
  if (!x) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const r = x.repartidor;
  const d = r.datos;
  // C-MONEDA-RECORRIDO: lo ganado y las propinas por moneda; el saldo es de Stripe (dólares).
  const ganado = r.porMoneda
    ? formatearTotales(
        r.porMoneda.map((m) => ({ monto: m.ganado, moneda: m.moneda })),
        idioma,
      )
    : formatearMonto(r.ganado, 'USD', idioma);
  const propinas = r.porMoneda
    ? formatearTotales(
        r.porMoneda.map((m) => ({ monto: m.propinas, moneda: m.moneda })),
        idioma,
      )
    : formatearMonto(r.propinas, 'USD', idioma);
  return (
    <section className="super">
      <button type="button" className="enlace docs-volver" onClick={() => window.history.back()}>
        {t.volver}
      </button>
      <h1>
        {r.nombre} <small className="super-id">{r.codigo}</small>
      </h1>
      <BotonSuspender id={r.id} activo={r.activo !== false} idioma={idioma} recargar={recargar} />
      <p>
        <span className={`punto ${r.conectado ? 'en-linea' : ''}`} aria-hidden="true" />{' '}
        {r.conectado ? t.enLinea : t.fueraLinea} · {r.ciudad} · {t.tipos[r.tipo] ?? r.tipo}
      </p>
      <KycFicha base={base} kyc={r.kyc} idioma={idioma} />
      <ul className="super-tarjetas">
        <li className="super-tarjeta">
          <span>{t.entregas}</span>
          <strong>{r.entregas}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.ganado}</span>
          <strong>{ganado}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.propinas}</span>
          <strong>{propinas}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.saldo}</span>
          <strong>{formatearMonto(r.saldo, 'USD', idioma)}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.calificacion}</span>
          <strong>{r.calificacion ?? '—'}</strong>
          <small>({r.calificaciones})</small>
        </li>
      </ul>
      <div className="super-dos">
        <div className="tarjeta-form">
          <h2>{t.datos}</h2>
          <dl className="super-dl">
            <dt>{t.correo}</dt>
            <dd>{r.correo}</dd>
            <dt>{t.telefono}</dt>
            <dd>{r.telefono || '—'}</dd>
            <dt>{t.nacimiento}</dt>
            <dd>{r.fechaNacimiento ?? '—'}</dd>
            <dt>{t.alta}</dt>
            <dd>{fechaCorta(r.alta, idioma)}</dd>
            <dt>{t.ubicacion}</dt>
            <dd>
              {r.ubicacion ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${r.ubicacion.lat}&mlon=${r.ubicacion.lng}#map=16/${r.ubicacion.lat}/${r.ubicacion.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.verMapa}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        </div>
        <div className="tarjeta-form">
          <h2>{t.vehiculo}</h2>
          <dl className="super-dl">
            <dt>{t.tipo}</dt>
            <dd>{t.vehiculos[d.vehiculoTipo] ?? d.vehiculoTipo}</dd>
            <dt>{t.marcaModelo}</dt>
            <dd>{[d.marca, d.modelo].filter(Boolean).join(' ') || '—'}</dd>
            <dt>{t.anio}</dt>
            <dd>{d.anio ?? '—'}</dd>
            <dt>{t.color}</dt>
            <dd>{d.color || '—'}</dd>
            <dt>{t.placa}</dt>
            <dd>{d.placa || '—'}</dd>
          </dl>
        </div>
        <div className="tarjeta-form">
          <h2>
            {t.licencia}{' '}
            <span className={`insignia doc-${d.estadoLicencia}`}>
              {t.estadoDoc[d.estadoLicencia]}
            </span>
          </h2>
          <dl className="super-dl">
            <dt>{t.licenciaNum}</dt>
            <dd>
              {d.licenciaNumero || '—'} {d.licenciaEstado}
            </dd>
            <dt>{t.vence}</dt>
            <dd>{d.licenciaVence ?? '—'}</dd>
          </dl>
          <h2>
            {t.seguro}{' '}
            <span className={`insignia doc-${d.estadoSeguro}`}>{t.estadoDoc[d.estadoSeguro]}</span>
          </h2>
          <dl className="super-dl">
            <dt>{t.aseguradora}</dt>
            <dd>{d.seguroTumbite ? t.seguroTumbite : d.seguroAseguradora || '—'}</dd>
            <dt>{t.poliza}</dt>
            <dd>{d.seguroPoliza || '—'}</dd>
            <dt>{t.vence}</dt>
            <dd>{d.seguroVence ?? '—'}</dd>
          </dl>
        </div>
        <div className="tarjeta-form">
          <h2>{t.revisar}</h2>
          <p>
            {t.antecedentes}: <strong>{t.estadoAnt[d.antecedentes]}</strong>
          </p>
          <div className="fila-botones">
            <button
              type="button"
              className="boton"
              onClick={() => void revisar({ antecedentes: 'aprobado' })}
            >
              {t.aprobar}
            </button>
            <button
              type="button"
              className="boton secundario"
              onClick={() => void revisar({ antecedentes: 'rechazado' })}
            >
              {t.rechazar}
            </button>
          </div>
          <div className="fila-botones">
            <button
              type="button"
              className="boton secundario"
              onClick={() => void revisar({ seguroTumbite: !d.seguroTumbite })}
            >
              {d.seguroTumbite ? t.quitarSeguro : t.darSeguro}
            </button>
            <select
              value={r.tipo}
              onChange={(e) => void revisar({ tipo: e.target.value })}
              aria-label={t.tipo}
            >
              <option value="independiente">{t.tipos.independiente}</option>
              <option value="empleado">{t.tipos.empleado}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="tarjeta-form">
        <h2>{t.historial}</h2>
        <ul className="super-lista">
          {r.historial.map((h) => (
            <li key={h.id}>
              {fechaCorta(h.fecha, idioma)} · {h.restaurante} · {h.estado} ·{' '}
              {formatearMonto(h.gana, h.moneda ?? 'USD', idioma)}
              {h.km != null ? ` · ${h.km.toFixed(1)} km` : ''}
            </li>
          ))}
        </ul>
      </div>
      <Quejas base={base} quejas={r.quejas} idioma={idioma} />
    </section>
  );
}

type FilaCliente = { id: string; nombre: string; correo: string; telefono: string; alta: string };

export function SuperClientes({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBuscador<FilaCliente>('/datos/admin/clientes', 'clientes');
  return (
    <section className="super">
      <h1>{t.clientes}</h1>
      <div className="super-busqueda" role="search">
        <SelectorCiudad zona={b.zona} cambiar={b.setZona} idioma={idioma} />
        <input
          value={b.q}
          onChange={(e) => b.setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') b.buscar();
          }}
          placeholder={t.buscarCli}
          aria-label={t.buscarCli}
        />
        <button type="button" className="boton" onClick={b.buscar}>
          {t.buscar}
        </button>
      </div>
      {b.error && (
        <p className="error-general" role="alert">
          {b.error}
        </p>
      )}
      {b.filas?.length === 0 && <p>{t.vacio}</p>}
      <ul className="super-bandeja">
        {b.filas?.map((c) => (
          <li key={c.id}>
            <Enlace a={`${base}/customers/${c.id}`}>
              <strong>{c.nombre}</strong> · {c.correo}
              <small>
                {c.telefono || '—'} · {t.alta} {fechaCorta(c.alta, idioma)}
              </small>
            </Enlace>
          </li>
        ))}
      </ul>
      {b.siguiente && (
        <button type="button" className="boton secundario" onClick={b.mas}>
          {t.mas}
        </button>
      )}
    </section>
  );
}

type Cliente = {
  activo?: boolean;
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string | null;
  alta: string;
  ciudad: string | null;
  pedidos: number;
  gastado: number;
  /** C-MONEDA-RECORRIDO: lo gastado por moneda. */
  gastadoPorMoneda?: { moneda: string; monto: number }[];
  compras: {
    id: string;
    estado: string;
    total: number;
    moneda?: string | null;
    fecha: string;
    restaurante: string;
    repartidor: string | null;
    repartidorCodigo: string | null;
  }[];
  quejas: { id: string; asunto: string; estado: string; fecha: string }[];
};

export function SuperCliente({ base, id, idioma }: { base: string; id: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const { x, error, recargar } = useCargar<{ cliente: Cliente }>(`/datos/admin/clientes/${id}`);
  if (!x) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const c = x.cliente;
  return (
    <section className="super">
      <button type="button" className="enlace docs-volver" onClick={() => window.history.back()}>
        {t.volver}
      </button>
      <h1>{c.nombre}</h1>
      <BotonSuspender id={c.id} activo={c.activo !== false} idioma={idioma} recargar={recargar} />
      <ul className="super-tarjetas">
        <li className="super-tarjeta">
          <span>{t.compras}</span>
          <strong>{c.pedidos}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.gastado}</span>
          <strong>
            {c.gastadoPorMoneda
              ? formatearTotales(c.gastadoPorMoneda, idioma)
              : formatearMonto(c.gastado, 'USD', idioma)}
          </strong>
        </li>
      </ul>
      <div className="super-dos">
        <div className="tarjeta-form">
          <h2>{t.datos}</h2>
          <dl className="super-dl">
            <dt>{t.correo}</dt>
            <dd>{c.correo}</dd>
            <dt>{t.telefono}</dt>
            <dd>{c.telefono || '—'}</dd>
            <dt>{t.nacimiento}</dt>
            <dd>{c.fechaNacimiento ?? '—'}</dd>
            <dt>{t.ciudad}</dt>
            <dd>{c.ciudad ?? '—'}</dd>
            <dt>{t.alta}</dt>
            <dd>{fechaCorta(c.alta, idioma)}</dd>
          </dl>
        </div>
        <Quejas base={base} quejas={c.quejas} idioma={idioma} />
      </div>
      <div className="tarjeta-form">
        <h2>{t.historial}</h2>
        <ul className="super-lista">
          {c.compras.map((p) => (
            <li key={p.id}>
              <Enlace a={`${base}/orders/${p.id}`}>
                {fechaCorta(p.fecha, idioma)} · {p.restaurante} ·{' '}
                {formatearMonto(p.total, p.moneda ?? 'USD', idioma)} · {p.estado}
              </Enlace>
              {p.repartidorCodigo ? (
                <>
                  {' · '}
                  <span className="super-id">{p.repartidorCodigo}</span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

type Restaurante = {
  kyc: Kyc;
  id: string;
  nombre: string;
  categoria: string;
  direccion: string;
  telefono: string;
  ciudad: string;
  plan: string;
  estado: string;
  abierto: boolean;
  alta: string;
  cuenta: { nombre: string; correo: string; telefono: string };
  empresa: Record<string, string>;
  platos: number;
  platosDisponibles: number;
  /** C-MONEDA-RECORRIDO: la moneda del restaurante (ventas y comisión van en ella). */
  moneda?: string;
  pedidos30: number;
  ventas30: number;
  comision30: number;
  calificacion: number | null;
  calificaciones: number;
  ultimosPedidos: {
    id: string;
    estado: string;
    total: number;
    moneda?: string | null;
    fecha: string;
    cliente: string;
  }[];
  quejas: { id: string; asunto: string; estado: string; fecha: string }[];
};

export function SuperRestaurante({
  base,
  id,
  idioma,
}: {
  base: string;
  id: string;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const { x, error } = useCargar<{ restaurante: Restaurante }>(`/datos/admin/restaurantes/${id}`);
  if (!x) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const r = x.restaurante;
  const e = new Map(Object.entries(r.empresa));
  const tieneEmpresa = [...e.values()].some(Boolean);
  const dinero = (c: number, moneda = r.moneda ?? 'USD') => formatearMonto(c, moneda, idioma);
  return (
    <section className="super">
      <button
        type="button"
        className="enlace docs-volver"
        onClick={() => ir(`${base}/restaurants`)}
      >
        {t.volver}
      </button>
      <h1>{r.nombre}</h1>
      <p>
        {r.categoria} · {r.ciudad} · {t.plan} {r.plan} · {t.estado} {r.estado} ·{' '}
        {r.abierto ? t.enLinea : t.fueraLinea}
      </p>
      <KycFicha base={base} kyc={r.kyc} idioma={idioma} />
      <ul className="super-tarjetas">
        <li className="super-tarjeta">
          <span>{t.pedidos30}</span>
          <strong>{r.pedidos30}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.ventas30}</span>
          <strong>{dinero(r.ventas30)}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.comision30}</span>
          <strong>{dinero(r.comision30)}</strong>
        </li>
        <li className="super-tarjeta">
          <span>{t.calificacion}</span>
          <strong>{r.calificacion ?? '—'}</strong>
          <small>({r.calificaciones})</small>
        </li>
        <li className="super-tarjeta">
          <span>{t.menu}</span>
          <strong>{r.platos}</strong>
          <small>
            {r.platosDisponibles} {t.disponibles}
          </small>
        </li>
      </ul>
      <div className="super-dos">
        <div className="tarjeta-form">
          <h2>{t.empresa}</h2>
          {!tieneEmpresa ? (
            <p>{t.sinEmpresa}</p>
          ) : (
            <dl className="super-dl">
              <dt>{t.nombreLegal}</dt>
              <dd>{e.get('nombreLegal') || '—'}</dd>
              <dt>{t.tipoEmpresa}</dt>
              <dd>{e.get('tipoEmpresa') || '—'}</dd>
              <dt>{t.direccionFiscal}</dt>
              <dd>{e.get('direccionFiscal') || '—'}</dd>
              <dt>{t.horario}</dt>
              <dd>{e.get('horario') || '—'}</dd>
              <dt>{t.web}</dt>
              <dd>{e.get('sitioWeb') || '—'}</dd>
            </dl>
          )}
        </div>
        <div className="tarjeta-form">
          <h2>{t.dueno}</h2>
          <dl className="super-dl">
            <dt>{t.nombre}</dt>
            <dd>{e.get('duenoNombre') || '—'}</dd>
            <dt>{t.telefono}</dt>
            <dd>{e.get('duenoTelefono') || '—'}</dd>
            <dt>{t.correo}</dt>
            <dd>{e.get('duenoCorreo') || '—'}</dd>
          </dl>
          <h2>{t.manager}</h2>
          <dl className="super-dl">
            <dt>{t.nombre}</dt>
            <dd>{e.get('managerNombre') || '—'}</dd>
            <dt>{t.telefono}</dt>
            <dd>{e.get('managerTelefono') || '—'}</dd>
            <dt>{t.correo}</dt>
            <dd>{e.get('managerCorreo') || '—'}</dd>
          </dl>
        </div>
        <div className="tarjeta-form">
          <h2>{t.cuenta}</h2>
          <dl className="super-dl">
            <dt>{t.nombre}</dt>
            <dd>{r.cuenta.nombre}</dd>
            <dt>{t.correo}</dt>
            <dd>{r.cuenta.correo}</dd>
            <dt>{t.telefono}</dt>
            <dd>{r.cuenta.telefono || r.telefono || '—'}</dd>
            <dt>{t.direccionFiscal}</dt>
            <dd>{r.direccion || '—'}</dd>
            <dt>{t.alta}</dt>
            <dd>{fechaCorta(r.alta, idioma)}</dd>
          </dl>
        </div>
        <Quejas base={base} quejas={r.quejas} idioma={idioma} />
      </div>
      <div className="tarjeta-form">
        <h2>{t.ultimos}</h2>
        <ul className="super-lista">
          {r.ultimosPedidos.map((p) => (
            <li key={p.id}>
              <Enlace a={`${base}/orders/${p.id}`}>
                {fechaCorta(p.fecha, idioma)} · {p.cliente} · {dinero(p.total, p.moneda ?? 'USD')} ·{' '}
                {p.estado}
              </Enlace>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
