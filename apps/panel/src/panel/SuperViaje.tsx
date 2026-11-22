import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Tramo,
  codigoCorto,
  enIdioma,
  formatearMonto,
  LETRAS_CODIGO_APPS,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { RastreoVivo } from './RastreoVivo';
import { nombreEstado, tonoEstado } from './BuscadorSuper';
import { Hora } from './horario';
import {
  FotoEvidencia,
  IconoServicio,
  LineaTiempo,
  puntosDeLinea,
  MapaFicha,
  type Paso,
  type PuntoFicha,
  TarjetaTiempos,
  metrosEntre,
  textoMetros,
} from './FichaPiezas';
import { NuevoReclamo, TEXTO_RECLAMO_ABIERTO } from './NuevoReclamo';

const T = {
  es: {
    volver: '← Volver',
    viaje: 'Viaje',
    envio: 'Envío',
    creado: 'Pedido',
    programado: 'Programado para',
    origen: 'Recogida',
    destino: 'Destino',
    pasajero: 'Pasajero',
    remitente: 'Quien envía',
    conductor: 'Conductor',
    sinConductor: 'Sin conductor',
    vehiculo: 'Vehículo',
    placa: 'Placa',
    pin: 'PIN de recogida',
    pinUsado: 'Se empezó con el PIN correcto',
    pinNoUsado: 'Todavía no se usa',
    pinNoPide: 'Esta ciudad no pide PIN para empezar',
    intentos: '{n} intentos fallidos',
    sinIntentos: 'sin intentos fallidos',
    importe: 'Importe',
    cotizado: 'Cotizado',
    final: 'Cobrado',
    metodo: 'Forma de pago',
    metodos: {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      pago_movil: 'Pago móvil',
      yape: 'Yape',
      plin: 'Plin',
    } as Record<string, string>,
    distancia: 'Distancia',
    cotizada: 'cotizada',
    real: 'real',
    emergencias: 'Emergencias',
    sinEmergencias: 'Este viaje no tuvo emergencias.',
    emergenciaDe: 'Emergencia del {rol}',
    roles: { pasajero: 'pasajero', conductor: 'conductor' } as Record<string, string>,
    atendida: 'Atendida por {p}',
    sinAtender: 'Sin atender',
    paquete: 'El paquete',
    destinatario: 'Lo recibe',
    tamano: 'Tamaño',
    tamanos: { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' } as Record<string, string>,
    fotoRecogida: 'Foto del paquete al recogerlo',
    fotoEntrega: 'Foto del paquete al entregarlo',
    sinFotoPaquete: 'Sin foto del paquete todavía.',
    sinFotos: 'Los viajes de personas no llevan fotos del pasajero.',
    reclamos: 'Reclamos y tickets',
    sinReclamos: 'Este viaje no tiene reclamos.',
    cuentaEliminada: 'Cuenta eliminada',
    mapa: 'Recogida y destino en el mapa',
    recorrido: 'De la recogida al destino (en línea recta)',
    personas: 'Personas',
    dondeEmpezo: 'Recogida y destino',
    eventos: {
      creado: 'Viaje pedido',
      pago_pendiente: 'Esperando el pago',
      buscando: 'Buscando conductor',
      asignado: 'Conductor asignado',
      conductor_llego: 'El conductor llegó a la recogida',
      en_curso: 'Viaje en curso',
      terminado: 'Viaje terminado',
      cancelado: 'Viaje cancelado',
      no_show: 'El pasajero no se presentó',
      sin_conductor: 'No se encontró conductor',
      emergencia: 'Emergencia',
      paquete_recogido: 'Paquete recogido',
      reclamo_abierto: 'Se abrió un reclamo',
    } as Record<string, string>,
    estadosTicket: { abierto: 'Abierto', respondido: 'Respondido', cerrado: 'Cerrado' } as Record<
      string,
      string
    >,
  },
  en: {
    volver: '← Back',
    viaje: 'Ride',
    envio: 'Delivery',
    creado: 'Requested',
    programado: 'Scheduled for',
    origen: 'Pickup',
    destino: 'Destination',
    pasajero: 'Rider',
    remitente: 'Sender',
    conductor: 'Driver',
    sinConductor: 'No driver',
    vehiculo: 'Vehicle',
    placa: 'Plate',
    pin: 'Pickup PIN',
    pinUsado: 'Started with the right PIN',
    pinNoUsado: 'Not used yet',
    pinNoPide: 'This city doesn’t ask for a PIN to start',
    intentos: '{n} failed attempts',
    sinIntentos: 'no failed attempts',
    importe: 'Amount',
    cotizado: 'Quoted',
    final: 'Charged',
    metodo: 'Payment method',
    metodos: {
      efectivo: 'Cash',
      tarjeta: 'Card',
      pago_movil: 'Mobile payment',
      yape: 'Yape',
      plin: 'Plin',
    } as Record<string, string>,
    distancia: 'Distance',
    cotizada: 'quoted',
    real: 'actual',
    emergencias: 'Emergencies',
    sinEmergencias: 'This ride had no emergencies.',
    emergenciaDe: 'Emergency from the {rol}',
    roles: { pasajero: 'rider', conductor: 'driver' } as Record<string, string>,
    atendida: 'Handled by {p}',
    sinAtender: 'Not handled',
    paquete: 'The package',
    destinatario: 'Recipient',
    tamano: 'Size',
    tamanos: { pequeno: 'Small', mediano: 'Medium', grande: 'Large' } as Record<string, string>,
    fotoRecogida: 'Photo of the package at pickup',
    fotoEntrega: 'Photo of the package at drop-off',
    sinFotoPaquete: 'No photo of the package yet.',
    sinFotos: 'Rides don’t take photos of the rider.',
    reclamos: 'Claims and tickets',
    sinReclamos: 'This ride has no claims.',
    cuentaEliminada: 'Deleted account',
    mapa: 'Pickup and destination on the map',
    recorrido: 'Pickup to destination (straight line)',
    personas: 'People',
    dondeEmpezo: 'Pickup and destination',
    eventos: {
      creado: 'Ride requested',
      pago_pendiente: 'Awaiting payment',
      buscando: 'Finding a driver',
      asignado: 'Driver assigned',
      conductor_llego: 'The driver arrived at the pickup',
      en_curso: 'Ride in progress',
      terminado: 'Ride finished',
      cancelado: 'Ride canceled',
      no_show: 'The rider didn’t show up',
      sin_conductor: 'No driver was found',
      emergencia: 'Emergency',
      paquete_recogido: 'Package picked up',
      reclamo_abierto: 'A claim was opened',
    } as Record<string, string>,
    estadosTicket: { abierto: 'Open', respondido: 'Replied', cerrado: 'Closed' } as Record<
      string,
      string
    >,
  },
};

type Punto = { lat: number; lng: number } | null;
type Viaje = {
  id: string;
  servicio: string | null;
  esEnvio: boolean;
  estado: string;
  categoria: string | null;
  creadoEn: string;
  programadoPara: string | null;
  ciudad: string | null;
  zonaHoraria: string | null;
  pais?: string | null;
  vivo?: boolean;
  origen: { direccion: string; lugar: Punto };
  destino: { direccion: string; lugar: Punto };
  pasajero: { id: string; nombre: string | null };
  conductor: { id: string; nombre: string | null; codigo: string | null } | null;
  vehiculo: { tipo: string | null; descripcion: string; placa: string | null } | null;
  pin: { requerido: boolean; usado: boolean; intentosFallidos: number };
  importe: { cotizado: number | null; final: number | null; moneda: string; metodo: string };
  distancia: { cotizadaM: number | null; realM: number | null };
  envio: {
    descripcion: string;
    destinatario: string | null;
    tamano: string | null;
    fotoRecogida: string | null;
    fotoEntrega: string | null;
  } | null;
  emergencias: {
    id: string;
    rol: string;
    creadoEn: string;
    atendidaEn: string | null;
    atendidaPor: string | null;
    nota: string;
  }[];
  tiempos: Tramo[];
  linea: Paso[];
  tickets: { id: string; asunto: string; estado: string; creadoEn: string }[];
};

/**
 * C-FICHA-OPERACION (15 nov 2026). Todos los países. La ficha de un viaje de auto o de moto (o de un
 * envío de paquete) en el superadmin: tiempos contra lo previsto, línea de tiempo con el actor de
 * cada paso, recogida y destino, conductor y vehículo con placa, el PIN (sin mostrar el número),
 * emergencias, importe y reclamos. Sin fotos del pasajero; un envío muestra la del paquete.
 */
export function SuperViaje({ base, id, idioma }: { base: string; id: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [v, setV] = useState<Viaje | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(
    () =>
      pedir<{ viaje: Viaje }>('GET', `/datos/admin/viajes/${encodeURIComponent(id)}`)
        .then((r) => setV(r.viaje))
        .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e))),
    [id],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
  if (!v) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const zona = v.zonaHoraria;
  const dinero = (c: number | null) =>
    c == null ? '—' : formatearMonto(c, v.importe.moneda, idioma);
  const c = codigoCorto(v.id);
  const metodos = new Map(Object.entries(t.metodos));
  const roles = new Map(Object.entries(t.roles));
  const tamanos = new Map(Object.entries(t.tamanos));
  const estadosTicket = new Map(Object.entries(t.estadosTicket));
  const puntos: PuntoFicha[] = [
    v.origen.lugar
      ? { id: 'o', ...v.origen.lugar, color: '#101010', etiqueta: v.origen.direccion }
      : null,
    v.destino.lugar
      ? { id: 'd', ...v.destino.lugar, color: '#f20d20', etiqueta: v.destino.direccion }
      : null,
  ].filter((x): x is PuntoFicha => x !== null);
  // C-RASTRO: dónde estaba el conductor en cada paso, numerado en el mapa.
  const puntosConPasos = [...puntos, ...puntosDeLinea(v.linea, t.eventos)];
  return (
    <section className="super ficha-op">
      <button type="button" className="enlace docs-volver" onClick={() => window.history.back()}>
        {t.volver}
      </button>
      <header className="ficha-cabecera">
        <h1>
          {v.esEnvio ? t.envio : t.viaje}{' '}
          <span className="codigo-pedido">
            #<b>{c.slice(0, LETRAS_CODIGO_APPS)}</b>
            {c.slice(LETRAS_CODIGO_APPS)}
          </span>
        </h1>
        <div className="ficha-chips">
          <IconoServicio servicio={v.servicio} idioma={idioma} conTexto />
          <span className={`bs-estado bs-${tonoEstado(v.estado)}`}>
            {nombreEstado(v.estado, idioma)}
          </span>
          <strong>{dinero(v.importe.final ?? v.importe.cotizado)}</strong>
          {v.ciudad ? <span>{v.ciudad}</span> : null}
          <span>
            {t.creado} <Hora fecha={v.creadoEn} zona={zona} idioma={idioma} />
          </span>
          {v.programadoPara ? (
            <span>
              {t.programado} <Hora fecha={v.programadoPara} zona={zona} idioma={idioma} />
            </span>
          ) : null}
        </div>
      </header>
      {/* C-RASTREO-VIVO: el conductor en el mapa, la hora de llegada y si está detenido. */}
      <RastreoVivo
        tipo="viaje"
        id={v.id}
        idioma={idioma}
        zona={zona}
        pais={v.pais}
        fijos={puntos}
        vivo={Boolean(v.vivo) && v.conductor != null}
      />
      <TarjetaTiempos tiempos={v.tiempos} idioma={idioma} />
      <LineaTiempo
        pasos={v.linea}
        idioma={idioma}
        zona={zona}
        eventos={t.eventos}
        cuentaEliminada={t.cuentaEliminada}
      />
      <div className="ficha-dos">
        <section className="tarjeta-form">
          <h2>{t.dondeEmpezo}</h2>
          <dl className="super-dl">
            <dt>{t.origen}</dt>
            <dd>{v.origen.direccion}</dd>
            <dt>{t.destino}</dt>
            <dd>{v.destino.direccion}</dd>
            <dt>{t.recorrido}</dt>
            <dd>{textoMetros(metrosEntre(v.origen.lugar, v.destino.lugar), idioma)}</dd>
            <dt>{t.distancia}</dt>
            <dd>
              {textoMetros(v.distancia.cotizadaM, idioma)} {t.cotizada}
              {v.distancia.realM != null
                ? ` · ${textoMetros(v.distancia.realM, idioma)} ${t.real}`
                : ''}
            </dd>
          </dl>
          <MapaFicha puntos={puntosConPasos} idioma={idioma} etiqueta={t.mapa} />
          {v.esEnvio ? null : <p className="ficha-nota">{t.sinFotos}</p>}
        </section>
        <section className="tarjeta-form">
          <h2>{t.personas}</h2>
          <dl className="super-dl">
            <dt>{v.esEnvio ? t.remitente : t.pasajero}</dt>
            <dd>
              <Enlace a={`${base}/customers/${v.pasajero.id}`}>
                {v.pasajero.nombre ?? t.cuentaEliminada}
              </Enlace>
            </dd>
            <dt>{t.conductor}</dt>
            <dd>
              {v.conductor ? (
                <Enlace a={`${base}/drivers/${v.conductor.id}`}>
                  {v.conductor.codigo ?? ''} {v.conductor.nombre ?? ''}
                </Enlace>
              ) : (
                t.sinConductor
              )}
            </dd>
            {v.vehiculo ? (
              <>
                <dt>{t.vehiculo}</dt>
                <dd>{v.vehiculo.descripcion || v.vehiculo.tipo || '—'}</dd>
                <dt>{t.placa}</dt>
                <dd className="super-id">{v.vehiculo.placa ?? '—'}</dd>
              </>
            ) : null}
            {v.esEnvio ? null : (
              <>
                <dt>{t.pin}</dt>
                <dd>
                  {!v.pin.requerido ? t.pinNoPide : v.pin.usado ? t.pinUsado : t.pinNoUsado}
                  {v.pin.requerido
                    ? ` · ${v.pin.intentosFallidos ? t.intentos.replace('{n}', String(v.pin.intentosFallidos)) : t.sinIntentos}`
                    : ''}
                </dd>
              </>
            )}
            <dt>{t.importe}</dt>
            <dd>
              {t.cotizado} {dinero(v.importe.cotizado)}
              {v.importe.final != null ? ` · ${t.final} ${dinero(v.importe.final)}` : ''}
            </dd>
            <dt>{t.metodo}</dt>
            <dd>{metodos.get(v.importe.metodo) ?? v.importe.metodo}</dd>
          </dl>
        </section>
      </div>
      {v.envio ? (
        <div className="ficha-dos">
          <section className="tarjeta-form ficha-lugar">
            <h2>{t.paquete}</h2>
            <dl className="super-dl">
              <dt>{t.paquete}</dt>
              <dd>{v.envio.descripcion}</dd>
              <dt>{t.destinatario}</dt>
              <dd>{v.envio.destinatario ?? '—'}</dd>
              {v.envio.tamano ? (
                <>
                  <dt>{t.tamano}</dt>
                  <dd>{tamanos.get(v.envio.tamano) ?? v.envio.tamano}</dd>
                </>
              ) : null}
            </dl>
          </section>
          <section className="tarjeta-form ficha-lugar">
            <h2>{t.fotoRecogida}</h2>
            {v.envio.fotoRecogida ? (
              <FotoEvidencia url={v.envio.fotoRecogida} alt={t.fotoRecogida} idioma={idioma} />
            ) : (
              <p className="ficha-nota">{t.sinFotoPaquete}</p>
            )}
            {v.envio.fotoEntrega ? (
              <>
                <h3>{t.fotoEntrega}</h3>
                <FotoEvidencia url={v.envio.fotoEntrega} alt={t.fotoEntrega} idioma={idioma} />
              </>
            ) : null}
          </section>
        </div>
      ) : null}
      <section className="tarjeta-form">
        <h2>{t.emergencias}</h2>
        {v.emergencias.length ? (
          <ul className="ficha-lista-simple">
            {v.emergencias.map((e) => (
              <li key={e.id}>
                <strong>{t.emergenciaDe.replace('{rol}', roles.get(e.rol) ?? e.rol)}</strong> ·{' '}
                <Hora fecha={e.creadoEn} zona={zona} idioma={idioma} /> ·{' '}
                {e.atendidaEn ? (
                  <span className="bs-estado bs-exito">
                    {t.atendida.replace('{p}', e.atendidaPor ?? '—')}
                  </span>
                ) : (
                  <span className="bs-estado bs-problema">{t.sinAtender}</span>
                )}
                {e.nota ? ` · ${e.nota}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ficha-nota">{t.sinEmergencias}</p>
        )}
      </section>
      <section className="tarjeta-form">
        <h2>{t.reclamos}</h2>
        {aviso ? (
          <p className="ok" role="status">
            {aviso}
          </p>
        ) : null}
        {v.tickets.length ? (
          <ul className="ficha-lista-simple">
            {v.tickets.map((x) => (
              <li key={x.id}>
                <Enlace a={`${base}/tickets/${x.id}`}>{x.asunto}</Enlace> ·{' '}
                <span className={`bs-estado bs-${x.estado === 'cerrado' ? 'exito' : 'vivo'}`}>
                  {estadosTicket.get(x.estado) ?? x.estado}
                </span>{' '}
                · <Hora fecha={x.creadoEn} zona={zona} idioma={idioma} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="ficha-nota">{t.sinReclamos}</p>
        )}
        <NuevoReclamo
          idioma={idioma}
          enlaceFijo={v.id}
          alAbrir={() => {
            setAviso(enIdioma(TEXTO_RECLAMO_ABIERTO, idioma).abierto);
            void cargar();
          }}
        />
      </section>
    </section>
  );
}
