import { useCallback, useEffect, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';
import { Conductor, FilaMoto, FilaPapel, type Moto, type Papel, T_MOTO } from './SuperMoto';
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
  },
};

const de = (tabla: Record<string, string>, clave: string) =>
  new Map(Object.entries(tabla)).get(clave) ?? clave;
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
                  {p.opcional ? ` · ${p.clave === 'pago_movil' ? t.opcional : t.noFrena}` : ''}
                  {p.motivo ? ` · ${p.motivo}` : ''}
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
 * Lo que se decide del conductor fuera de su identidad, en su ficha de Verificaciones y en su ficha
 * de conductor: vehículo, papeles y servicios, más «Aprobar todo lo que está en verde».
 */
export function RevisionConductor({
  id,
  base,
  idioma,
  identidad,
  alCambiar,
}: {
  id: string;
  base: string;
  idioma: Idioma;
  /** Aprobar su identidad (solo cuando todas sus comprobaciones están en verde). */
  identidad?: { enVerde: boolean; aprobar: () => Promise<void> } | null;
  alCambiar?: () => void;
}) {
  const t = enIdioma(T_ACTIVACION, idioma);
  const tm = enIdioma(T_MOTO, idioma);
  const [vuelta, setVuelta] = useState(0);
  const [motos, setMotos] = useState<Moto[] | null>(null);
  const [papeles, setPapeles] = useState<Papel[] | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambio = useCallback(() => {
    setVuelta((v) => v + 1);
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

  return (
    <>
      <BarraActivacion id={id} base={base} idioma={idioma} vuelta={vuelta} />
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
        {motos && motos.length === 0 ? <p className="pista">{t.sinVehiculo}</p> : null}
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
      </section>
      <section data-testid="revision-papeles">
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
        <Conductor key={`${id}-${vuelta}`} id={id} base={base} idioma={idioma} t={tm} />
      </section>
    </>
  );
}
