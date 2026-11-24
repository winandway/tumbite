import { Insignia } from './diseno/Insignia';
import { ActividadCuenta } from './ActividadCuenta';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fechaSuper } from './horario';
import { ImportarMenu } from './ImportarMenu';
import {
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearMonto,
  formatearTotales,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { VerDato } from './DatoProtegido';
import { ir } from '../ruta';
import { pedir } from './api';
import { MenuTresPuntos } from './MenuTresPuntos';
import { UnirCuentas } from './UnirCuentas';
import { SuspenderCuenta } from './SuspenderCuenta';
import { AyudaAqui } from './AyudaAqui';
import { EtiquetaPrueba, FiltroCuentas, opcionMarcarPrueba } from './CuentasPrueba';
import {
  AccionesCorreo,
  type CambioCorreo,
  type EstadoCorreo,
  HistorialCorreo,
} from './CorregirCorreo';
import { CambiarCiudadConductor } from './CambiarCiudadConductor';
import { EnviarMensaje } from './EnviarMensaje';
import { usePermisos } from './permisosPanel';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { AvisoNoElegibles } from './AvisoNoElegibles';
import { usePreferencias } from './usePreferencias';
import { FiltroPapeles, InsigniaPapeles, PapelesConductor } from './SuperPapeles';
import { RevisionConductor } from './RevisionConductor';

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
    papeles: 'Papeles',
    activacion: 'Activación',
    listo: 'Listo para recibir carreras',
    todaviaNo: 'Todavía no',
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
    sinZona: 'Sin zona',
    avisoSinZona: (n: number) =>
      n === 1
        ? 'Hay 1 conductor sin zona: no sabemos su ciudad. Ábrelo y, en sus tres puntos, toca «Cambiar ciudad».'
        : `Hay ${n} conductores sin zona: no sabemos su ciudad. Ábrelos y, en sus tres puntos, toca «Cambiar ciudad».`,
    verSinZona: 'Ver los que no tienen zona',
    conectadoSinViajes: 'Conectado, todavía no recibe viajes',
    // C-QUE-TE-FALTA: lo mismo que ve el conductor en Driver, dicho para el equipo.
    faltas: {
      desconectado: 'Le falta conectarse.',
      cara: 'Le falta tomarse la foto de la cara.',
      telefono: 'Le falta confirmar su celular.',
      sin_vehiculo: 'Le falta registrar su vehículo en Driver.',
      sin_placa: 'Tiene el vehículo registrado, pero le falta la placa.',
      vehiculo_rechazado: 'Rechazamos su vehículo: le falta corregirlo.',
      vehiculo_sin_enviar: 'Tiene el vehículo registrado; le falta enviarlo a revisión.',
      papeles_sin_enviar: 'Tomó todas las fotos de sus papeles; le falta enviarlas a revisión.',
      sin_restaurantes: 'Solo podría hacer Comida y su zona todavía no tiene restaurantes.',
      vehiculo_en_revision: 'Falta que aprobemos su vehículo (está en revisión).',
      vehiculo_sin_aprobar: 'Le falta que aprobemos su vehículo.',
      vehiculo_sin_activar: 'Tiene el vehículo; le falta activarlo en Driver.',
      sin_servicio_encendido: 'Le falta encender un servicio en Driver.',
      sin_habilitacion: 'Le falta que aprobemos sus papeles del servicio.',
      servicio_no_disponible: 'Su servicio no está abierto en su ciudad.',
      sin_saldo: 'No le alcanza el saldo para la comisión.',
      sin_pago_movil: 'Le falta cargar su cuenta de pago móvil.',
      ubicacion_vieja: 'Conectado, pero su ubicación no se actualiza (GPS o señal).',
    } as Record<string, string>,
    tambien: 'Además:',
    vehiculosReales: 'Vehículos',
    sinVehiculos: 'Todavía no registró ningún vehículo.',
    enUso: 'En uso',
    estadosVehiculo: {
      registrado: 'Registrado, sin enviar',
      en_revision: 'En revisión',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
      suspendido: 'Suspendido',
    } as Record<string, string>,
    sinPlaca: 'Sin placa',
    motivoRechazo: 'Motivo',
    liderDe: (l: string) => `Líder de ${l}`,
    miembroDe: (l: string) => `En la línea ${l}`,
    contrato: 'Contrato',
    idAnterior: 'Antes',
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
    entregas: 'Viajes y entregas',
    saldoPrepago: 'Saldo prepago',
    datosReparto: 'Datos de reparto declarados',
    ganado: 'Ganado',
    propinas: 'Propinas',
    saldo: 'Saldo',
    calificacion: 'Calificación',
    elogios: 'Elogios de los clientes',
    motivos: 'Motivos de las malas notas (solo los ve el equipo)',
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
    papeles: 'Documents',
    activacion: 'Activation',
    listo: 'Ready to receive trips',
    todaviaNo: 'Not yet',
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
    sinZona: 'No zone',
    avisoSinZona: (n: number) =>
      n === 1
        ? 'There is 1 driver with no zone: we don’t know their city. Open them and, in the three-dot menu, tap “Change city”.'
        : `There are ${n} drivers with no zone: we don’t know their city. Open them and, in the three-dot menu, tap “Change city”.`,
    verSinZona: 'See the ones with no zone',
    conectadoSinViajes: 'Connected, can’t get trips yet',
    faltas: {
      desconectado: 'They need to go online.',
      cara: 'They need to take their face photo.',
      telefono: 'They need to confirm their phone.',
      sin_vehiculo: 'They need to add their vehicle in Driver.',
      sin_placa: 'Their vehicle is saved, but the license plate is missing.',
      vehiculo_rechazado: 'We rejected their vehicle: they need to fix it.',
      vehiculo_sin_enviar: 'Their vehicle is saved; they need to send it for review.',
      papeles_sin_enviar: 'They took all their document photos; they need to send them for review.',
      sin_restaurantes: 'They could only do Food and their area has no restaurants yet.',
      vehiculo_en_revision: 'We need to approve their vehicle (under review).',
      vehiculo_sin_aprobar: 'We need to approve their vehicle.',
      vehiculo_sin_activar: 'They have the vehicle; they need to turn it on in Driver.',
      sin_servicio_encendido: 'They need to turn on a service in Driver.',
      sin_habilitacion: 'We need to approve their documents for the service.',
      servicio_no_disponible: 'Their service isn’t open in their city.',
      sin_saldo: 'Their balance doesn’t cover the commission.',
      sin_pago_movil: 'They need to add their mobile payment account.',
      ubicacion_vieja: 'Online, but their location isn’t updating (GPS or signal).',
    } as Record<string, string>,
    tambien: 'Also:',
    vehiculosReales: 'Vehicles',
    sinVehiculos: 'No vehicle registered yet.',
    enUso: 'In use',
    estadosVehiculo: {
      registrado: 'Saved, not sent',
      en_revision: 'Under review',
      aprobado: 'Approved',
      rechazado: 'Rejected',
      suspendido: 'Suspended',
    } as Record<string, string>,
    sinPlaca: 'No plate',
    motivoRechazo: 'Reason',
    liderDe: (l: string) => `Leader of ${l}`,
    miembroDe: (l: string) => `In the ${l} line`,
    contrato: 'Contract',
    idAnterior: 'Formerly',
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
    entregas: 'Rides and deliveries',
    saldoPrepago: 'Prepaid balance',
    datosReparto: 'Declared delivery details',
    ganado: 'Earned',
    propinas: 'Tips',
    saldo: 'Balance',
    calificacion: 'Rating',
    elogios: 'Customer compliments',
    motivos: 'Reasons for low ratings (team only)',
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
// C-HORARIO-EMPLEADO: con el reloj y la zona del empleado (la misma pieza de todo el superadmin).
const fechaCorta = (f: string | null | undefined, idioma: Idioma) =>
  fechaSuper(f, idioma, { estilo: 'fecha' });

const T_SUSPENDER = {
  es: {
    suspender: 'Suspender la cuenta',
    reactivar: 'Reactivar la cuenta',
    suspendida: 'Cuenta suspendida: no puede entrar.',
    pregunta: 'Motivo de la suspensión (queda en el registro):',
    confirmarReactivar: '¿Reactivar esta cuenta?',
    malaConducta: 'Cerrar por mala conducta',
    preguntaMala:
      'Motivo de la mala conducta. Su correo y su teléfono no podrán volver a registrarse, de ninguna forma:',
    mas: 'Más acciones de la cuenta',
    borrarCuenta: 'Borrar la cuenta',
    cambiarCiudad: 'Cambiar ciudad',
    enviarMensaje: 'Enviar mensaje',
    confirmarBorrar:
      'Se borran sus datos personales (igual que cuando la persona la borra desde la app) y no se puede deshacer. Escribe BORRAR para confirmar:',
    motivoBorrar: 'Motivo del borrado (queda en el registro, con tu nombre y la hora):',
    borrada: 'Cuenta borrada.',
    palabra: 'BORRAR',
  },
  en: {
    suspender: 'Suspend account',
    reactivar: 'Reactivate account',
    suspendida: 'Account suspended: they can’t sign in.',
    pregunta: 'Reason for the suspension (kept in the log):',
    confirmarReactivar: 'Reactivate this account?',
    malaConducta: 'Close for misconduct',
    preguntaMala:
      'Reason for the misconduct. Their email and phone number won’t be able to sign up again, in any form:',
    mas: 'More account actions',
    borrarCuenta: 'Delete the account',
    cambiarCiudad: 'Change city',
    enviarMensaje: 'Send message',
    confirmarBorrar:
      'Their personal data is deleted (the same as when the person deletes it from the app) and this can’t be undone. Type DELETE to confirm:',
    motivoBorrar: 'Reason for the deletion (kept in the log, with your name and the time):',
    borrada: 'Account deleted.',
    palabra: 'DELETE',
  },
};

/** Suspender o reactivar una cuenta desde su ficha (auditoría final, punto 26). */
function BotonSuspender({
  id,
  activo,
  idioma,
  recargar,
  ciudad,
  esPrueba,
  rol,
  alMensaje,
}: {
  id: string;
  activo: boolean;
  idioma: Idioma;
  recargar: () => void;
  /** C-REZAGADOS: «Enviar mensaje» a esta cuenta (y qué hacer después de enviarlo). */
  rol?: 'repartidor' | 'cliente';
  alMensaje?: () => void;
  /** C-CUENTA-PRUEBA: la marca de cuenta de prueba de hoy. */
  esPrueba?: boolean;
  /** C-CAMBIAR-CIUDAD-ADMIN: solo en la ficha del repartidor (su ciudad de hoy). */
  ciudad?: string;
}) {
  const t = enIdioma(T_SUSPENDER, idioma);
  const [error, setError] = useState('');
  const [cambiandoCiudad, setCambiandoCiudad] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  // C-CUENTA-UNICA-SUSPENSION: suspender abre el formulario que pide el por qué.
  const [suspendiendo, setSuspendiendo] = useState(false);
  const puedeEscribir = usePermisos().puedeVer('tickets.responder') && Boolean(rol);
  const [aviso, setAviso] = useState('');
  const [borrada, setBorrada] = useState(false);
  // C-BORRAR-DESDE-SUPERADMIN: el mismo borrado de la app, escondido en los tres puntos.
  async function borrar() {
    const palabra = (window.prompt(t.confirmarBorrar) ?? '').trim().toUpperCase();
    if (palabra !== t.palabra) return;
    const motivo = (window.prompt(t.motivoBorrar) ?? '').trim();
    if (motivo.length < 5) return;
    setError('');
    try {
      await pedir('POST', `/datos/admin/usuarios/${id}/borrar`, { confirmar: palabra, motivo });
      setBorrada(true);
      recargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }
  async function cambiar(malaConducta = false) {
    let motivo = '';
    if (activo) {
      motivo = window.prompt(malaConducta ? t.preguntaMala : t.pregunta) ?? '';
      if (motivo.trim().length < (malaConducta ? 5 : 3)) return;
    } else if (!window.confirm(t.confirmarReactivar)) return;
    setError('');
    try {
      // C-IDENTIDAD-UNICA: por mala conducta, su correo y su teléfono quedan bloqueados para siempre.
      await pedir('PATCH', `/datos/admin/usuarios/${id}`, {
        activo: !activo,
        motivo,
        malaConducta,
        // C-CUENTA-UNICA-SUSPENSION: la mala conducta es de la persona entera.
        ...(activo && malaConducta ? { motivoTipo: 'fraude' } : {}),
      });
      recargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }
  return (
    <div className="super-suspender">
      {!activo ? <strong className="error-general">{t.suspendida}</strong> : null}{' '}
      <button
        type="button"
        className="enlace"
        onClick={() => (activo ? setSuspendiendo(true) : void cambiar())}
      >
        {activo ? t.suspender : t.reactivar}
      </button>
      {activo ? (
        <>
          {' · '}
          <button type="button" className="enlace" onClick={() => void cambiar(true)}>
            {t.malaConducta}
          </button>
        </>
      ) : null}
      {borrada ? <strong> {t.borrada}</strong> : null}
      {activo && !borrada ? (
        <MenuTresPuntos
          etiqueta={t.mas}
          opciones={[
            ...(puedeEscribir
              ? [{ texto: t.enviarMensaje, alTocar: () => setEscribiendo(true) }]
              : []),
            ...(ciudad !== undefined
              ? [{ texto: t.cambiarCiudad, alTocar: () => setCambiandoCiudad(true) }]
              : []),
            opcionMarcarPrueba(id, esPrueba === true, idioma, recargar, setError),
            { texto: t.borrarCuenta, peligro: true, alTocar: () => void borrar() },
          ]}
        />
      ) : null}
      {error ? (
        <span className="error-general" role="alert">
          {' '}
          {error}
        </span>
      ) : null}
      {aviso ? <strong role="status"> {aviso}</strong> : null}
      {suspendiendo && activo ? (
        <SuspenderCuenta
          id={id}
          esConductor={rol === 'repartidor'}
          idioma={idioma}
          alCerrar={() => setSuspendiendo(false)}
          alSuspender={() => {
            setSuspendiendo(false);
            recargar();
          }}
        />
      ) : null}
      {escribiendo && rol ? (
        <EnviarMensaje
          id={id}
          rol={rol}
          idioma={idioma}
          alCerrar={() => setEscribiendo(false)}
          alEnviar={() => alMensaje?.()}
        />
      ) : null}
      {cambiandoCiudad && ciudad !== undefined ? (
        <CambiarCiudadConductor
          id={id}
          idioma={idioma}
          alCerrar={() => setCambiandoCiudad(false)}
          alCambiar={(texto) => {
            setCambiandoCiudad(false);
            setAviso(texto);
            recargar();
          }}
        />
      ) : null}
    </div>
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

/**
 * Buscador con lista paginada «cargar más» (por clave, sirve con millones). La ciudad se guarda
 * por empleado (C-FILTROS-GUARDADOS); el texto buscado no se guarda nunca.
 */
function useBuscador<T>(ruta: string, clave: 'repartidores' | 'clientes') {
  const [q0] = useState(consulta);
  // «estado» guarda el filtro de papeles de la lista de conductores (C-PLAZO-PAPELES).
  // C-CUENTA-PRUEBA: «Cuentas: reales» por defecto, recordado como los demás filtros.
  const pref = usePreferencias(clave, { zona: '', estado: '', cuentas: 'reales' });
  const cuentas = pref.valores.cuentas || 'reales';
  // Un enlace con ?zona= (desde Ciudades) manda en esta visita, sin cambiar lo guardado.
  const [zonaDeEnlace, setZonaDeEnlace] = useState<string | null>(q0.get('zona') || null);
  const zona = zonaDeEnlace ?? pref.valores.zona ?? '';
  const [plazoDeEnlace, setPlazoDeEnlace] = useState<string | null>(q0.get('plazo') || null);
  const plazo = clave === 'repartidores' ? (plazoDeEnlace ?? pref.valores.estado ?? '') : '';
  const [q, setQ] = useState(q0.get('q') ?? '');
  const textoActual = useRef(q);
  useEffect(() => {
    textoActual.current = q;
  }, [q]);
  const [filas, setFilas] = useState<T[] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [error, setError] = useState('');
  // C-SIN-ZONA-VISIBLE: cuántas cuentas reales siguen sin ciudad (solo conductores).
  const [sinZona, setSinZona] = useState(0);
  const pedirPagina = useCallback(
    async (despues: string | null, texto: string, z: string, pl: string, cu: string) => {
      const p = new URLSearchParams();
      p.set('cuentas', cu);
      if (z) p.set('zona', z);
      if (pl) p.set('plazo', pl);
      if (texto) p.set('q', texto);
      if (despues) p.set('despues', despues);
      try {
        const r = await pedir<Record<string, unknown>>('GET', `${ruta}?${p.toString()}`);
        const nuevas = (new Map(Object.entries(r)).get(clave) ?? []) as T[];
        setFilas((viejas) => (despues ? [...(viejas ?? []), ...nuevas] : nuevas));
        setSiguiente((r.siguiente as string | null) ?? null);
        if (typeof r.sinZona === 'number') setSinZona(r.sinZona);
        setError('');
      } catch (e) {
        setError(e instanceof ErrorApi ? e.message : String(e));
      }
    },
    [ruta, clave],
  );
  // Al abrir, al cambiar la ciudad y cuando llegan los filtros guardados: la primera página.
  useEffect(() => {
    void pedirPagina(null, textoActual.current, zona, plazo, cuentas);
  }, [pedirPagina, zona, plazo, cuentas]);
  return {
    zona,
    setZona: (z: string) => {
      setZonaDeEnlace(null);
      pref.cambiar('zona', z);
    },
    cuentas,
    setCuentas: (v: string) => pref.cambiar('cuentas', v),
    plazo,
    setPlazo: (v: string) => {
      setPlazoDeEnlace(null);
      pref.cambiar('estado', v);
    },
    q,
    setQ,
    filas,
    siguiente,
    error,
    sinZona,
    guardados: pref.guardados,
    restablecer: () => {
      setZonaDeEnlace(null);
      setPlazoDeEnlace(null);
      pref.restablecer();
    },
    buscar: () => void pedirPagina(null, q, zona, plazo, cuentas),
    mas: () => void pedirPagina(siguiente, q, zona, plazo, cuentas),
  };
}

export function SelectorCiudad({
  zona,
  cambiar,
  idioma,
  conSinZona = false,
}: {
  zona: string;
  cambiar: (z: string) => void;
  idioma: Idioma;
  /** C-SIN-ZONA-VISIBLE: los conductores sin ciudad real, como una opción más. */
  conSinZona?: boolean;
}) {
  const t = enIdioma(T, idioma);
  const { x } = useCargar<{ ciudades: Ciudad[] }>('/datos/admin/ciudades');
  return (
    <select value={zona} onChange={(e) => cambiar(e.target.value)} aria-label={t.ciudad}>
      <option value="">{t.todas}</option>
      {conSinZona ? <option value="sin_zona">{t.sinZona}</option> : null}
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
  /** C-SIN-ZONA-VISIBLE: sin ciudad real todavía. */
  sinZona?: boolean;
  nombre: string;
  esPrueba?: boolean;
  correo: string;
  conectado: boolean;
  vehiculo: string;
  placa: string;
  seguro: string;
  licencia: string;
  antecedentes: string;
  entregas: number;
  /** C-PLAZO-PAPELES: estado de sus papeles y días que le quedan (null = sin plazo o ya cerrado). */
  papeles?: string;
  diasPlazo?: number | null;
  /** C-BARRA-ACTIVACION: el reparto lo tomaría con solo conectarse (misma vista del reparto). */
  listo?: boolean;
};

export function SuperRepartidores({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBuscador<FilaRep>('/datos/admin/repartidores', 'repartidores');
  return (
    <section className="super">
      <h1>{t.repartidores}</h1>
      <div className="super-busqueda" role="search">
        <SelectorCiudad zona={b.zona} cambiar={b.setZona} idioma={idioma} conSinZona />
        <FiltroCuentas valor={b.cuentas} cambiar={b.setCuentas} idioma={idioma} />
        <FiltroPapeles valor={b.plazo} cambiar={b.setPlazo} idioma={idioma} />
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
      <AvisoFiltrosGuardados visible={b.guardados} idioma={idioma} restablecer={b.restablecer} />
      <AvisoNoElegibles base={base} idioma={idioma} />
      {b.sinZona > 0 && b.zona !== 'sin_zona' ? (
        <p className="aviso-alarma" role="status" data-testid="aviso-sin-zona">
          {t.avisoSinZona(b.sinZona)}{' '}
          <button type="button" className="enlace" onClick={() => b.setZona('sin_zona')}>
            {t.verSinZona}
          </button>
        </p>
      ) : null}
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
                <th>{t.papeles}</th>
                <th>{t.activacion}</th>
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
                    {r.nombre} <EtiquetaPrueba si={r.esPrueba} idioma={idioma} />
                    {r.sinZona ? <Insignia tono="pendiente">{t.sinZona}</Insignia> : null}
                  </td>
                  <td>
                    {t.vehiculos[r.vehiculo] ?? r.vehiculo} {r.placa}
                  </td>
                  <td>
                    <Insignia estado={r.licencia}>{t.estadoDoc[r.licencia]}</Insignia>
                  </td>
                  <td>
                    <Insignia estado={r.seguro}>{t.estadoDoc[r.seguro]}</Insignia>
                  </td>
                  <td>
                    <Insignia estado={r.antecedentes}>{t.estadoAnt[r.antecedentes]}</Insignia>
                  </td>
                  <td>
                    <InsigniaPapeles
                      papeles={r.papeles ?? 'sin_plazo'}
                      dias={r.diasPlazo ?? null}
                      idioma={idioma}
                    />
                  </td>
                  <td>
                    <Insignia tono={r.listo ? 'hecho' : 'apagado'}>
                      {r.listo ? t.listo : t.todaviaNo}
                    </Insignia>
                  </td>
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
      {t.titulo}: <Insignia estado={kyc.estado}>{t.estados[kyc.estado] ?? kyc.estado}</Insignia>
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
  esPrueba?: boolean;
  activo?: boolean;
  correoEstado?: EstadoCorreo;
  historialCorreo?: CambioCorreo[];
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
  /** C-EN-LINEA-DE-VERDAD: puede recibir viajes ahora (servicio aprobado o plazo abierto). */
  recibeViajes?: boolean;
  /** C-FICHA-SIN-CONTRADICCION: el primer paso que le falta para recibir viajes, según la regla. */
  falta?: string | null;
  /** C-QUE-TE-FALTA: todo lo que le falta, en orden (la misma pieza que ve Driver). */
  faltas?: { clave: string; quien: string; motivo?: string }[];
  /** C-QUE-TE-FALTA: los vehículos de la tabla real (un servidor de antes no lo manda). */
  vehiculos?: {
    id: string;
    tipo: string;
    marca: string;
    modelo: string;
    anio: number | null;
    color: string;
    placa: string;
    estado: string;
    motivo: string;
    activo: boolean;
  }[];
  linea?: { nombre: string; rol: 'lider' | 'miembro' } | null;
  /** C-ID-DEL-PAIS: los ID que tuvo antes. */
  codigosAnteriores?: string[];
  /** C-SIN-ZONA-VISIBLE: todavía no se sabe su ciudad. */
  sinZona?: boolean;
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
  /** C-FICHA-TODOS-LOS-SERVICIOS: su saldo prepago (libro), en la moneda de su país. */
  saldoPrepago?: { monto: number; moneda: string };
  calificacion: number | null;
  calificaciones: number;
  /** C-ELOGIOS-MOTIVOS: conteo de elogios y de motivos de las malas notas. */
  elogios?: { etiqueta: string; n: number; es: string; en: string }[];
  motivos?: { etiqueta: string; n: number; es: string; en: string }[];
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
  // C-REZAGADOS: después de «Enviar mensaje» la actividad se vuelve a leer.
  const [vueltaActividad, setVueltaActividad] = useState(0);
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
        {r.nombre} <small className="super-id">{r.codigo}</small>{' '}
        {r.codigosAnteriores?.length ? (
          <small className="super-id">
            ({t.idAnterior}: {r.codigosAnteriores.join(', ')})
          </small>
        ) : null}{' '}
        <EtiquetaPrueba si={r.esPrueba} idioma={idioma} />
      </h1>
      <BotonSuspender
        id={r.id}
        activo={r.activo !== false}
        idioma={idioma}
        recargar={recargar}
        ciudad={r.ciudad}
        esPrueba={r.esPrueba}
        rol="repartidor"
        alMensaje={() => setVueltaActividad((n) => n + 1)}
      />
      <HistorialCorreo lista={r.historialCorreo} idioma={idioma} />
      <p>
        <span
          className={`punto ${r.conectado && r.recibeViajes !== false ? 'en-linea' : ''}`}
          aria-hidden="true"
        />{' '}
        {r.conectado ? (r.recibeViajes === false ? t.conectadoSinViajes : t.enLinea) : t.fueraLinea}
        {' · '}
        {r.sinZona ? t.sinZona : r.ciudad}
        {r.linea ? ` · ${(r.linea.rol === 'lider' ? t.liderDe : t.miembroDe)(r.linea.nombre)}` : ''}
      </p>
      {r.recibeViajes === false && r.falta ? (
        <p className="pista" data-testid="ficha-falta">
          {t.faltas[r.falta] ?? r.falta}
          {(r.faltas ?? []).length > 1
            ? ` ${t.tambien} ${(r.faltas ?? [])
                .slice(1)
                .map((x) => t.faltas[x.clave] ?? x.clave)
                .join(' ')}`
            : ''}
        </p>
      ) : null}
      <p className="pista">
        {t.contrato}: {t.tipos[r.tipo] ?? r.tipo}
      </p>
      <KycFicha base={base} kyc={r.kyc} idioma={idioma} />
      <PapelesConductor id={id} idioma={idioma} />
      {/* C-VERIFICACION-UNICA: la misma pieza que en Verificaciones (barra, vehículo, papeles). */}
      <RevisionConductor id={id} base={base} idioma={idioma} enFicha />
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
        {r.saldoPrepago ? (
          <li className="super-tarjeta" data-testid="ficha-saldo-prepago">
            <span>{t.saldoPrepago}</span>
            <strong>{formatearMonto(r.saldoPrepago.monto, r.saldoPrepago.moneda, idioma)}</strong>
          </li>
        ) : null}
        {/* La billetera de Stripe (pedidos con tarjeta, en dólares): solo si tiene algo. */}
        {!r.saldoPrepago || r.saldo !== 0 ? (
          <li className="super-tarjeta">
            <span>{t.saldo}</span>
            <strong>{formatearMonto(r.saldo, 'USD', idioma)}</strong>
          </li>
        ) : null}
        <li className="super-tarjeta">
          <span>{t.calificacion}</span>
          <strong>{r.calificacion ?? '—'}</strong>
          <small>({r.calificaciones})</small>
        </li>
      </ul>
      {[
        { k: 'elogios', titulo: t.elogios, lista: r.elogios ?? [] },
        { k: 'motivos', titulo: t.motivos, lista: r.motivos ?? [] },
      ].map((x) =>
        x.lista.length ? (
          <p key={x.k} className="super-etiquetas" data-testid={`super-${x.k}`}>
            <strong>{x.titulo}:</strong>{' '}
            {x.lista.map((y) => `${idioma === 'en' ? y.en : y.es} (${y.n})`).join(' · ')}
          </p>
        ) : null,
      )}
      <div className="super-dos">
        <div className="tarjeta-form">
          <h2>{t.datos}</h2>
          <dl className="super-dl">
            <dt>{t.correo}</dt>
            <dd>
              <VerDato
                tipo="repartidor"
                id={id}
                campo="correo"
                mascara={r.correo}
                idioma={idioma}
              />
              <AccionesCorreo
                usuarioId={id}
                estado={r.correoEstado}
                idioma={idioma}
                recargar={recargar}
              />
            </dd>
            <dt>{t.telefono}</dt>
            <dd>
              <VerDato
                tipo="repartidor"
                id={id}
                campo="telefono"
                mascara={r.telefono || '—'}
                idioma={idioma}
              />
            </dd>
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
        {r.vehiculos ? (
          // C-QUE-TE-FALTA: los vehículos de verdad, con su estado (antes salía vacía con una moto guardada).
          <div className="tarjeta-form" data-testid="ficha-vehiculos">
            <h2>{t.vehiculosReales}</h2>
            {r.vehiculos.length ? (
              r.vehiculos.map((v) => (
                <dl className="super-dl" key={v.id} data-vehiculo={v.id}>
                  <dt>{t.tipo}</dt>
                  <dd>
                    {t.vehiculos[v.tipo] ?? v.tipo}{' '}
                    <Insignia estado={v.estado}>{t.estadosVehiculo[v.estado] ?? v.estado}</Insignia>{' '}
                    {v.activo ? <Insignia tono="hecho">{t.enUso}</Insignia> : null}
                  </dd>
                  <dt>{t.marcaModelo}</dt>
                  <dd>{[v.marca, v.modelo, v.anio, v.color].filter(Boolean).join(' · ') || '—'}</dd>
                  <dt>{t.placa}</dt>
                  <dd>{v.placa || t.sinPlaca}</dd>
                  {v.estado === 'rechazado' && v.motivo ? (
                    <>
                      <dt>{t.motivoRechazo}</dt>
                      <dd>{v.motivo}</dd>
                    </>
                  ) : null}
                </dl>
              ))
            ) : (
              <p>{t.sinVehiculos}</p>
            )}
          </div>
        ) : null}
        {/* C-FICHA-UN-BLOQUE (24 nov 2026): un solo bloque de vehículos. Los datos de reparto viejos
            (comida, sin tabla de vehículos) salen solo si existen y no hay vehículos registrados. */}
        {!r.vehiculos?.length && (d.marca || d.modelo || d.placa) ? (
          <div className="tarjeta-form" data-testid="ficha-datos-reparto">
            <h2>{t.datosReparto}</h2>
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
        ) : null}
        {/* C-FICHA-UN-BLOQUE: la licencia y el seguro viejos (datos de reparto) solo si existen; los
            papeles de verdad van en «Papeles» y en la Verificación única. */}
        {d.licenciaNumero ||
        d.licenciaVence ||
        d.seguroPoliza ||
        d.seguroAseguradora ||
        d.seguroVence ||
        d.seguroTumbite ? (
          <div className="tarjeta-form">
            <h2>
              {t.licencia}{' '}
              <Insignia estado={d.estadoLicencia}>{t.estadoDoc[d.estadoLicencia]}</Insignia>
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
              {t.seguro} <Insignia estado={d.estadoSeguro}>{t.estadoDoc[d.estadoSeguro]}</Insignia>
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
        ) : null}
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
      {/* C-RASTRO: de dónde vino el alta, qué pasos dio y todo lo que ha hecho. */}
      <ActividadCuenta
        ruta={`/datos/admin/repartidores/${id}/actividad`}
        idioma={idioma}
        recarga={vueltaActividad}
      />
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

type FilaCliente = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  alta: string;
  esPrueba?: boolean;
};

export function SuperClientes({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBuscador<FilaCliente>('/datos/admin/clientes', 'clientes');
  return (
    <section className="super">
      <h1>
        {t.clientes}
        <AyudaAqui guia="test-accounts" idioma={idioma} />
      </h1>
      <div className="super-busqueda" role="search">
        <SelectorCiudad zona={b.zona} cambiar={b.setZona} idioma={idioma} />
        <FiltroCuentas valor={b.cuentas} cambiar={b.setCuentas} idioma={idioma} />
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
      <AvisoFiltrosGuardados visible={b.guardados} idioma={idioma} restablecer={b.restablecer} />
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
              <strong>{c.nombre}</strong> <EtiquetaPrueba si={c.esPrueba} idioma={idioma} /> ·{' '}
              {c.correo}
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
      {/* C-CUENTA-UNICA-UNIR: unir dos cuentas de la misma persona (solo el equipo central). */}
      <UnirCuentas idioma={idioma} />
    </section>
  );
}

type Cliente = {
  activo?: boolean;
  esPrueba?: boolean;
  correoEstado?: EstadoCorreo;
  historialCorreo?: CambioCorreo[];
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
  /** C-CALIFICA-CLIENTE: lo que dicen los repartidores (solo soporte). */
  notaRepartidores?: { promedio: number | null; cuantas: number };
};

export function SuperCliente({ base, id, idioma }: { base: string; id: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const { x, error, recargar } = useCargar<{ cliente: Cliente }>(`/datos/admin/clientes/${id}`);
  const [vueltaActividad, setVueltaActividad] = useState(0);
  if (!x) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const c = x.cliente;
  return (
    <section className="super">
      <button type="button" className="enlace docs-volver" onClick={() => window.history.back()}>
        {t.volver}
      </button>
      <h1>
        {c.nombre} <EtiquetaPrueba si={c.esPrueba} idioma={idioma} />
      </h1>
      <BotonSuspender
        id={c.id}
        activo={c.activo !== false}
        idioma={idioma}
        recargar={recargar}
        esPrueba={c.esPrueba}
        rol="cliente"
        alMensaje={() => setVueltaActividad((n) => n + 1)}
      />
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
        {c.notaRepartidores?.cuantas ? (
          <li className="super-tarjeta">
            <span>{idioma === 'en' ? 'Driver rating' : 'Nota de los repartidores'}</span>
            <strong>
              {c.notaRepartidores.promedio} ★ ({c.notaRepartidores.cuantas})
            </strong>
          </li>
        ) : null}
      </ul>
      <div className="super-dos">
        <div className="tarjeta-form">
          <h2>{t.datos}</h2>
          <dl className="super-dl">
            <dt>{t.correo}</dt>
            <dd>
              <VerDato tipo="cliente" id={id} campo="correo" mascara={c.correo} idioma={idioma} />
              <AccionesCorreo
                usuarioId={id}
                estado={c.correoEstado}
                idioma={idioma}
                recargar={recargar}
              />
            </dd>
            <dt>{t.telefono}</dt>
            <dd>
              <VerDato
                tipo="cliente"
                id={id}
                campo="telefono"
                mascara={c.telefono || '—'}
                idioma={idioma}
              />
            </dd>
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
      <HistorialCorreo lista={c.historialCorreo} idioma={idioma} />
      {/* C-RASTRO: de dónde vino el alta, qué pasos dio y todo lo que ha hecho. */}
      <ActividadCuenta
        ruta={`/datos/admin/clientes/${id}/actividad`}
        idioma={idioma}
        recarga={vueltaActividad}
      />
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
  duenoId?: string;
  correoEstado?: EstadoCorreo;
  historialCorreo?: CambioCorreo[];
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
  const { x, error, recargar } = useCargar<{ restaurante: Restaurante }>(
    `/datos/admin/restaurantes/${id}`,
  );
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
      <HistorialCorreo lista={r.historialCorreo} idioma={idioma} />
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
            <dd>
              <VerDato
                tipo="restaurante"
                id={id}
                campo="correo"
                mascara={r.cuenta.correo}
                idioma={idioma}
              />
              {r.duenoId ? (
                <AccionesCorreo
                  usuarioId={r.duenoId}
                  estado={r.correoEstado}
                  idioma={idioma}
                  recargar={recargar}
                />
              ) : null}
            </dd>
            <dt>{t.telefono}</dt>
            <dd>
              {r.cuenta.telefono ? (
                <VerDato
                  tipo="restaurante"
                  id={id}
                  campo="telefono"
                  mascara={r.cuenta.telefono}
                  idioma={idioma}
                />
              ) : (
                r.telefono || '—'
              )}
            </dd>
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
      {/* C-MENU-PLANILLA: alta asistida, el equipo carga el menú por el restaurante. */}
      <ImportarMenu ruta={`/datos/admin/restaurantes/${id}/platos/importar`} idioma={idioma} />
    </section>
  );
}
