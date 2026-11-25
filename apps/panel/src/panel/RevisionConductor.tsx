import { useCallback, useEffect, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';
import { Conductor, FilaMoto, FilaPapel, type Moto, type Papel, T_MOTO } from './SuperMoto';
import { EVENTO_CAMBIO, avisarDecision } from './sonarEvento';
import { VehiculoSinEnviar } from './VehiculoSinEnviar';
import { palabra } from './diseno/palabras';
import { type FaltaSinEnviar, faltaParaAprobarSinEnviar } from '@tumbite/compartido';
import { MandarWhatsappFalta } from './WhatsappFalta';
import './verificaciones.css';

/**
 * C-VERIFICACION-UNICA y C-BARRA-ACTIVACION (23 nov 2026, Richard: «pensaba que aceptando el KYC ya
 * estaba aceptando todo y no sabía que la moto se aceptaba por separado… al llegar al final, yo de mi
 * lado estaría seguro que su moto ya puede recibir carreras») — todos los países.
 *
 * UNA sola pieza con TODO lo que se decide de un conductor, la misma en Verificaciones y en su ficha:
 * 1. La barra de activación (los pasos mínimos, de quién depende cada uno y la frase final, con el
 *    veredicto de la misma vista del reparto, calculado en el servidor).
 * 2. Su vehículo por revisar (frente, placa, registro, póliza) con aprobar o pedir de nuevo.
 * 3. Sus papeles por revisar (licencia y lo que pida su país).
 * 4. Sus servicios y requisitos (habilitación, edad, casco).
 * 5. «Aprobar todo lo que está en verde», con una persona que decide (nunca la IA).
 */

export type ClavePaso =
  | 'telefono'
  | 'cara'
  | 'documento'
  | 'identidad'
  | 'vehiculo'
  | 'vehiculo_aprobado'
  | 'vehiculo_activo'
  | 'servicio'
  | 'zona'
  | 'saldo'
  | 'papeles'
  | 'papeles_pais'
  | 'requisitos'
  | 'conectado'
  | 'pago_movil';

export type Paso = {
  clave: ClavePaso;
  estado: 'hecho' | 'pendiente' | 'problema';
  quien: 'conductor' | 'equipo' | 'sistema';
  opcional: boolean;
  falta?: string;
  vehiculoId?: string;
  motivo?: string;
  /** C-PAPELES-POR-PAIS: los papeles de su país que «solo se piden» y faltan o esperan revisión. */
  papelesPais?: { tipo: string; es: string; en: string; estado: 'falta' | 'revision' }[];
};

export type Activacion = {
  pasos: Paso[];
  listo: boolean;
  recibiendo: boolean;
  servicios: string[];
  siguiente: Paso | null;
  hechos: number;
  total: number;
  vehiculo: { id: string; tipo: string; estado: string } | null;
};

export const T_ACTIVACION = {
  es: {
    titulo: 'Barra de activación',
    progreso: (h: number, t: number) => `${h} de ${t} pasos`,
    pasos: {
      telefono: 'Celular confirmado',
      cara: 'Foto de la cara',
      documento: 'Documento de identidad subido',
      identidad: 'Identidad aprobada',
      vehiculo: 'Vehículo registrado con su placa',
      vehiculo_aprobado: 'Vehículo aprobado',
      vehiculo_activo: 'Vehículo en uso',
      servicio: 'Servicio aprobado para él',
      zona: 'Servicio abierto en su zona',
      saldo: 'Saldo para la comisión',
      papeles: 'Papeles enviados',
      papeles_pais: 'Papeles del país (solo se piden)',
      requisitos: 'Requisitos del servicio aprobados (papeles del vehículo o habilitación)',
      conectado: 'Abre Driver y se conecta',
      pago_movil: 'Pago móvil cargado (recibe más carreras)',
    } as Record<string, string>,
    quien: {
      conductor: 'Le toca al conductor',
      equipo: 'Le toca al equipo',
      sistema: 'Lo hace el sistema solo',
    } as Record<string, string>,
    opcional: 'Opcional',
    noFrena: 'No lo frena',
    // C-BARRA-VEHICULO-COHERENTE: qué falta, en palabras, en los pasos del vehículo.
    falta: {
      sin_vehiculo: 'todavía no registra ninguno',
      sin_placa: 'falta la placa',
      vehiculo_sin_enviar: 'lo registró, falta enviarlo a revisión',
      vehiculo_sin_activar: 'aprobado, falta elegirlo para trabajar',
    } as Record<string, string>,
    faltaSubir: 'falta subir',
    enRevision: 'en revisión',
    hacerlo: 'Hacerlo aquí',
    abrirZona: 'Abrir el servicio en la zona',
    servicios: { moto: 'Moto', carro: 'Carro', comida: 'Comida', envios: 'Envíos' } as Record<
      string,
      string
    >,
    recibiendo: (s: string) => `Está recibiendo carreras de ${s} ahora mismo.`,
    listo: (s: string) =>
      `Ya puede recibir carreras de ${s}. Solo le falta abrir Driver y conectarse.`,
    todavia: (que: string, quien: string) =>
      `Todavía no: falta ${que.toLowerCase()} (${quien.toLowerCase()}).`,
    soloEfectivo: 'Sin pago móvil, por ahora solo le llegan carreras en efectivo.',
    cargando: 'Calculando la barra…',
    error: 'No pudimos calcular la barra. Revisa tu conexión.',
    reintentar: 'Reintentar',
    vehiculo: 'Vehículo por revisar',
    sinVehiculo: 'No tiene un vehículo esperando revisión.',
    papeles: 'Papeles por revisar',
    sinPapeles: 'No tiene papeles esperando revisión.',
    servicios_: 'Servicios y requisitos',
    aprobarTodo: 'Aprobar todo lo que está en verde',
    aprobarTodoAyuda:
      'Aprueba de una vez lo que espera aquí: su identidad (solo si todas sus comprobaciones están en verde), sus papeles y su vehículo. Antes mira las fotos: decides tú.',
    confirmar: (n: number) =>
      n === 1 ? '¿Aprobar 1 cosa de este conductor?' : `¿Aprobar ${n} cosas de este conductor?`,
    nadaQueAprobar: 'No hay nada en verde por aprobar.',
    aprobadoTodo: (n: number) => (n === 1 ? 'Aprobaste 1 cosa.' : `Aprobaste ${n} cosas.`),
    fallo: (n: number, e: string) => `Aprobaste ${n}; lo siguiente no se pudo: ${e}`,
    // C-FICHA-VEHICULO-SIN-ENVIAR: lo que espera una acción del equipo va arriba, en rojo.
    esperaEquipo: 'Espera al equipo',
    tareas: {
      vehiculo: (n: number) => (n === 1 ? '1 vehículo por revisar' : `${n} vehículos por revisar`),
      sinEnviar: (n: number) =>
        n === 1
          ? '1 vehículo sin enviar que ya puedes aprobar'
          : `${n} vehículos sin enviar que ya puedes aprobar`,
      papeles: (n: number) => (n === 1 ? '1 papel por revisar' : `${n} papeles por revisar`),
      identidad: 'Su identidad, por aprobar o rechazar',
    },
    irA: 'Ir',
    sinEnviarTitulo: 'Vehículo registrado sin enviar',
  },
  en: {
    titulo: 'Activation bar',
    progreso: (h: number, t: number) => `${h} of ${t} steps`,
    pasos: {
      telefono: 'Phone confirmed',
      cara: 'Face photo',
      documento: 'ID document uploaded',
      identidad: 'Identity approved',
      vehiculo: 'Vehicle registered with its plate',
      vehiculo_aprobado: 'Vehicle approved',
      vehiculo_activo: 'Vehicle in use',
      servicio: 'Service approved for them',
      zona: 'Service open in their area',
      saldo: 'Balance for the commission',
      papeles: 'Documents submitted',
      papeles_pais: 'Country documents (requested only)',
      requisitos: 'Service requirements approved (vehicle documents or service approval)',
      conectado: 'Opens Driver and goes online',
      pago_movil: 'Mobile payment added (gets more trips)',
    } as Record<string, string>,
    quien: {
      conductor: 'Driver’s turn',
      equipo: 'Team’s turn',
      sistema: 'Done automatically',
    } as Record<string, string>,
    opcional: 'Optional',
    noFrena: 'Doesn’t block',
    falta: {
      sin_vehiculo: 'none registered yet',
      sin_placa: 'plate missing',
      vehiculo_sin_enviar: 'registered, not sent for review yet',
      vehiculo_sin_activar: 'approved, not chosen to work with yet',
    } as Record<string, string>,
    faltaSubir: 'not uploaded',
    enRevision: 'under review',
    hacerlo: 'Do it here',
    abrirZona: 'Open the service in the area',
    servicios: { moto: 'Moto', carro: 'Car', comida: 'Food', envios: 'Delivery' } as Record<
      string,
      string
    >,
    recibiendo: (s: string) => `Receiving ${s} trips right now.`,
    listo: (s: string) =>
      `Ready to receive ${s} trips. They only need to open Driver and go online.`,
    todavia: (que: string, quien: string) =>
      `Not yet: missing ${que.toLowerCase()} (${quien.toLowerCase()}).`,
    soloEfectivo: 'Without mobile payment, for now they only get cash trips.',
    cargando: 'Working out the bar…',
    error: 'We couldn’t work out the bar. Check your connection.',
    reintentar: 'Try again',
    vehiculo: 'Vehicle to review',
    sinVehiculo: 'No vehicle waiting for review.',
    papeles: 'Documents to review',
    sinPapeles: 'No documents waiting for review.',
    servicios_: 'Services and requirements',
    aprobarTodo: 'Approve everything in green',
    aprobarTodoAyuda:
      'Approves at once what is waiting here: their identity (only if all its checks are green), their documents and their vehicle. Look at the photos first: you decide.',
    confirmar: (n: number) =>
      n === 1 ? 'Approve 1 item for this driver?' : `Approve ${n} items for this driver?`,
    nadaQueAprobar: 'Nothing in green to approve.',
    aprobadoTodo: (n: number) => (n === 1 ? 'You approved 1 item.' : `You approved ${n} items.`),
    fallo: (n: number, e: string) => `You approved ${n}; the next one failed: ${e}`,
    esperaEquipo: 'Waiting for the team',
    tareas: {
      vehiculo: (n: number) => (n === 1 ? '1 vehicle to review' : `${n} vehicles to review`),
      sinEnviar: (n: number) =>
        n === 1
          ? '1 unsent vehicle you can approve now'
          : `${n} unsent vehicles you can approve now`,
      papeles: (n: number) => (n === 1 ? '1 document to review' : `${n} documents to review`),
      identidad: 'Their identity, to approve or reject',
    },
    irA: 'Go',
    sinEnviarTitulo: 'Registered vehicle not sent',
  },
};

// C-SIN-CODIGOS-CRUDOS: lo que la tabla no conoce se dice en palabras, nunca el código.
const de = (tabla: Record<string, string>, clave: string) => palabra(tabla, clave);
const mensaje = (x: unknown) => (x instanceof Error ? x.message : String(x));

/** Dónde se hace, en esta misma pantalla, un paso que le toca al equipo. */
const ANCLA: Partial<Record<ClavePaso, string>> = {
  identidad: 'kyc-decision',
  vehiculo_aprobado: 'revision-vehiculo',
  servicio: 'revision-servicios',
  requisitos: 'revision-servicios',
};

/** La frase final, sin ambigüedad. La saca la ficha, la lista y Verificaciones. */
export function fraseActivacion(a: Activacion, idioma: Idioma): string {
  const t = enIdioma(T_ACTIVACION, idioma);
  const servicios = a.servicios.map((s) => de(t.servicios, s)).join(', ');
  if (a.recibiendo) return t.recibiendo(servicios);
  if (a.listo) return t.listo(servicios);
  const s = a.siguiente;
  return s ? t.todavia(de(t.pasos, s.clave), de(t.quien, s.quien)) : t.todavia('—', '—');
}

/** La barra verde de un conductor. `vuelta` cambia cuando algo se decidió (para recalcularla). */
export function BarraActivacion({
  id,
  base,
  idioma,
  vuelta = 0,
}: {
  id: string;
  base: string;
  idioma: Idioma;
  vuelta?: number;
}) {
  const t = enIdioma(T_ACTIVACION, idioma);
  const [a, setA] = useState<Activacion | null>(null);
  const [error, setError] = useState(false);
  const [otra, setOtra] = useState(0);
  useEffect(() => {
    let vivo = true;
    pedir<Activacion>('GET', `/datos/admin/conductores/${id}/activacion`)
      .then((x) => {
        if (!vivo) return;
        const bien = Array.isArray(x?.pasos);
        setA(bien ? x : null);
        setError(!bien);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [id, vuelta, otra]);
  if (error)
    return (
      <p className="error-general" role="alert">
        {t.error}{' '}
        <button type="button" className="enlace" onClick={() => setOtra((v) => v + 1)}>
          {t.reintentar}
        </button>
      </p>
    );
  if (!a) return <p role="status">{t.cargando}</p>;
  const pct = a.total ? Math.round((a.hechos / a.total) * 100) : 0;
  const soloEfectivo = a.pasos.some((p) => p.clave === 'pago_movil' && p.estado !== 'hecho');
  return (
    <section className="tarjeta-form barra-activacion" data-testid="barra-activacion">
      <h2>{t.titulo}</h2>
      <div
        className="barra-activacion-progreso"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={a.total}
        aria-valuenow={a.hechos}
        aria-label={t.titulo}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="suave">{t.progreso(a.hechos, a.total)}</p>
      <p
        className={a.listo || a.recibiendo ? 'texto-exito barra-frase' : 'barra-frase'}
        data-testid="barra-frase"
        role="status"
      >
        <strong>{fraseActivacion(a, idioma)}</strong>
      </p>
      {soloEfectivo && (a.listo || a.recibiendo) ? <p className="pista">{t.soloEfectivo}</p> : null}
      <ol className="barra-pasos">
        {a.pasos.map((p) => {
          const ancla = ANCLA[p.clave];
          return (
            <li key={p.clave} data-estado={p.estado} data-testid={`paso-${p.clave}`}>
              <Insignia
                tono={
                  p.estado === 'hecho' ? 'hecho' : p.estado === 'problema' ? 'problema' : 'apagado'
                }
              >
                {de(t.pasos, p.clave)}
              </Insignia>
              {p.estado !== 'hecho' ? (
                <span className="barra-quien">
                  {de(t.quien, p.quien)}
                  {p.falta && new Map(Object.entries(t.falta)).has(p.falta)
                    ? ` · ${de(t.falta, p.falta)}`
                    : ''}
                  {p.opcional ? ` · ${p.clave === 'pago_movil' ? t.opcional : t.noFrena}` : ''}
                  {p.motivo ? ` · ${p.motivo}` : ''}
                  {p.papelesPais?.length
                    ? ` · ${p.papelesPais
                        .map(
                          (x) =>
                            `${idioma === 'en' ? x.en : x.es} (${x.estado === 'falta' ? t.faltaSubir : t.enRevision})`,
                        )
                        .join(', ')}`
                    : ''}
                </span>
              ) : null}
              {p.estado !== 'hecho' && p.quien === 'equipo' && ancla ? (
                <a className="boton secundario chico" href={`#${ancla}`}>
                  {t.hacerlo}
                </a>
              ) : null}
              {p.estado !== 'hecho' && p.clave === 'zona' ? (
                <Enlace a={`${base}/moto`} className="boton secundario chico">
                  {t.abrirZona}
                </Enlace>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * C-FICHA-VEHICULO-SIN-ENVIAR (Richard, 25 nov 2026): lo que espera una acción del EQUIPO va arriba de
 * la ficha, en rojo y con su botón: la identidad por revisar, los vehículos por revisar, los sin enviar
 * que ya se pueden aprobar y los papeles por revisar. Se vuelve a contar al decidir algo.
 */
export function EsperaAlEquipo({
  id,
  idioma,
  identidad,
}: {
  id: string;
  idioma: Idioma;
  /** La identidad espera la decisión: a dónde lleva su botón («#kyc-decision» o su verificación). */
  identidad?: string | null;
}) {
  const t = enIdioma(T_ACTIVACION, idioma);
  const [vuelta, setVuelta] = useState(0);
  const [n, setN] = useState<{ vehiculos: number; aprobables: number; papeles: number } | null>(
    null,
  );
  useEffect(() => {
    const otra = () => setVuelta((v) => v + 1);
    window.addEventListener(EVENTO_CAMBIO, otra);
    return () => window.removeEventListener(EVENTO_CAMBIO, otra);
  }, []);
  useEffect(() => {
    let vivo = true;
    const q = encodeURIComponent(id);
    const lista = (estado: string) =>
      pedir<{ vehiculos?: (Moto & { faltaParaAprobar?: FaltaSinEnviar[] })[] }>(
        'GET',
        `/datos/admin/vehiculos?estado=${estado}&conductor=${q}`,
      ).then((r) => (Array.isArray(r?.vehiculos) ? r.vehiculos : []));
    Promise.all([
      lista('en_revision'),
      lista('registrado'),
      pedir<{ documentos?: unknown[] }>(
        'GET',
        `/datos/admin/papeles-conductor?estado=pendiente&conductor=${q}`,
      ).then((r) => (Array.isArray(r?.documentos) ? r.documentos.length : 0)),
    ])
      .then(([revision, registrados, papeles]) => {
        if (!vivo) return;
        setN({
          vehiculos: revision.length,
          aprobables: registrados.filter(
            (m) =>
              Array.isArray(m?.documentos) &&
              (m.faltaParaAprobar ?? faltaParaAprobarSinEnviar(m, m.documentos)).length === 0,
          ).length,
          papeles,
        });
      })
      .catch(() => vivo && setN(null));
    return () => {
      vivo = false;
    };
  }, [id, vuelta]);
  const tareas = [
    identidad ? { texto: t.tareas.identidad, ancla: identidad } : null,
    n?.vehiculos ? { texto: t.tareas.vehiculo(n.vehiculos), ancla: '#revision-vehiculo' } : null,
    n?.aprobables ? { texto: t.tareas.sinEnviar(n.aprobables), ancla: '#revision-vehiculo' } : null,
    n?.papeles ? { texto: t.tareas.papeles(n.papeles), ancla: '#revision-papeles' } : null,
  ].filter((x): x is { texto: string; ancla: string } => x !== null);
  if (!tareas.length) return null;
  return (
    <section className="espera-equipo" data-testid="espera-equipo" role="status">
      <Insignia tono="problema">{t.esperaEquipo}</Insignia>
      <ul>
        {tareas.map((x) => (
          <li key={x.texto}>
            <span>{x.texto}</span>{' '}
            <a className="boton chico" href={x.ancla}>
              {t.irA}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Lo que se decide del conductor fuera de su identidad, en su ficha de Verificaciones y en su ficha
 * de conductor: vehículo, papeles y servicios, más «Aprobar todo lo que está en verde».
 */
export function RevisionConductor({
  id,
  base,
  idioma,
  identidad,
  alCambiar,
  enFicha = false,
}: {
  id: string;
  base: string;
  idioma: Idioma;
  /** Aprobar su identidad (solo cuando todas sus comprobaciones están en verde). */
  identidad?: { enVerde: boolean; aprobar: () => Promise<void> } | null;
  alCambiar?: () => void;
  /** Dentro de la ficha del conductor (que ya trae «Cambiar ciudad» en sus tres puntos). */
  enFicha?: boolean;
}) {
  const t = enIdioma(T_ACTIVACION, idioma);
  const tm = enIdioma(T_MOTO, idioma);
  const [vuelta, setVuelta] = useState(0);
  const [motos, setMotos] = useState<Moto[] | null>(null);
  const [papeles, setPapeles] = useState<Papel[] | null>(null);
  // C-FICHA-VEHICULO-SIN-ENVIAR: lo que registró y no envió también sale en su ficha.
  const [sinEnviar, setSinEnviar] = useState<
    (Moto & { faltaParaAprobar?: FaltaSinEnviar[] })[] | null
  >(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambio = useCallback(() => {
    setVuelta((v) => v + 1);
    // C-VERIFICACIONES-VEHICULOS: el número del menú baja enseguida al decidir.
    avisarDecision();
    alCambiar?.();
  }, [alCambiar]);
  useEffect(() => {
    const q = encodeURIComponent(id);
    pedir<{ vehiculos: Moto[] }>('GET', `/datos/admin/vehiculos?estado=en_revision&conductor=${q}`)
      .then((r) =>
        setMotos(
          Array.isArray(r?.vehiculos)
            ? r.vehiculos.filter((m) => Array.isArray(m?.documentos))
            : [],
        ),
      )
      .catch((x: unknown) => setError(mensaje(x)));
    pedir<{ vehiculos: Moto[] }>('GET', `/datos/admin/vehiculos?estado=registrado&conductor=${q}`)
      .then((r) =>
        setSinEnviar(
          Array.isArray(r?.vehiculos)
            ? r.vehiculos.filter((m) => Array.isArray(m?.documentos))
            : [],
        ),
      )
      .catch((x: unknown) => setError(mensaje(x)));
    pedir<{ documentos: Papel[] }>(
      'GET',
      `/datos/admin/papeles-conductor?estado=pendiente&conductor=${q}`,
    )
      .then((r) => setPapeles(Array.isArray(r?.documentos) ? r.documentos : []))
      .catch((x: unknown) => setError(mensaje(x)));
  }, [id, vuelta]);

  /** Lo que «Aprobar todo» aprobaría, en orden: identidad, papeles, papeles del vehículo, vehículo. */
  const tareas: (() => Promise<unknown>)[] = [
    ...(identidad?.enVerde ? [identidad.aprobar] : []),
    ...(papeles ?? []).map(
      (d) => () => pedir('PUT', `/datos/admin/papeles-conductor/${d.id}`, { estado: 'aprobado' }),
    ),
    ...(motos ?? []).flatMap((m) => [
      ...m.documentos
        .filter((d) => d.estado !== 'aprobado')
        .map(
          (d) => () =>
            pedir('PUT', `/datos/admin/vehiculos/${m.id}/documentos/${d.id}`, {
              estado: 'aprobado',
              venceEn: d.venceEn?.slice(0, 10) || null,
            }),
        ),
      () => pedir('PUT', `/datos/admin/vehiculos/${m.id}`, { estado: 'aprobado' }),
    ]),
  ];

  async function aprobarTodo() {
    if (!tareas.length || ocupado) return;
    if (!window.confirm(t.confirmar(tareas.length))) return;
    setOcupado(true);
    setError('');
    setOk('');
    let hechas = 0;
    try {
      for (const tarea of tareas) {
        await tarea();
        hechas += 1;
      }
      setOk(t.aprobadoTodo(hechas));
    } catch (x) {
      setError(t.fallo(hechas, mensaje(x)));
    } finally {
      setOcupado(false);
      cambio();
    }
  }

  const aprobables = (sinEnviar ?? []).filter(
    (m) => (m.faltaParaAprobar ?? faltaParaAprobarSinEnviar(m, m.documentos)).length === 0,
  );
  return (
    <>
      <BarraActivacion id={id} base={base} idioma={idioma} vuelta={vuelta} />
      {/* C-WHATSAPP-FALTA: en la ficha y en Verificaciones, con vista previa y confirmación. */}
      <MandarWhatsappFalta id={id} idioma={idioma} alEnviar={alCambiar} />
      <div className="fila-botones">
        <button
          type="button"
          className="boton exito"
          disabled={!tareas.length || ocupado}
          onClick={() => void aprobarTodo()}
          data-testid="aprobar-todo"
        >
          {t.aprobarTodo}
        </button>
      </div>
      <p className="pista">{tareas.length ? t.aprobarTodoAyuda : t.nadaQueAprobar}</p>
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
      <section id="revision-vehiculo" data-testid="revision-vehiculo">
        <h2>{t.vehiculo}</h2>
        {motos && motos.length === 0 && !(sinEnviar ?? []).length ? (
          <p className="pista">{t.sinVehiculo}</p>
        ) : null}
        <ul className="lista">
          {(motos ?? []).map((m) => (
            <FilaMoto
              key={`${m.id}-${m.estado}-${m.documentos.map((d) => d.estado).join('')}`}
              m={m}
              idioma={idioma}
              t={tm}
              alCambiar={cambio}
            />
          ))}
        </ul>
        {/* Primero los que el equipo ya puede aprobar; después los que esperan al conductor. */}
        {[...aprobables, ...(sinEnviar ?? []).filter((m) => !aprobables.includes(m))].map((m) => (
          <div
            key={`${m.id}-${m.documentos.map((d) => d.estado).join('')}`}
            className="tarjeta-form"
          >
            <h3>{t.sinEnviarTitulo}</h3>
            <VehiculoSinEnviar v={m} idioma={idioma} alCambiar={cambio} />
          </div>
        ))}
      </section>
      <section id="revision-papeles" data-testid="revision-papeles">
        <h2>{t.papeles}</h2>
        {papeles && papeles.length === 0 ? <p className="pista">{t.sinPapeles}</p> : null}
        <ul className="lista">
          {(papeles ?? []).map((d) => (
            <FilaPapel
              key={`${d.id}-${d.estado}`}
              d={d}
              idioma={idioma}
              t={tm}
              alCambiar={cambio}
            />
          ))}
        </ul>
      </section>
      <section id="revision-servicios" data-testid="revision-servicios">
        <h2>{t.servicios_}</h2>
        <Conductor
          key={`${id}-${vuelta}`}
          id={id}
          base={base}
          idioma={idioma}
          t={tm}
          conCambiarCiudad={!enFicha}
        />
      </section>
    </>
  );
}
