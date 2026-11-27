import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ErrorApi,
  FOTOS_MEDICION,
  type Idioma,
  type TipoFotoMedicion,
  almacenNavegador,
  distanciaLegible,
  enIdioma,
  llanoLugar,
  nombreFotoMedicion,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { MenuTresPuntos } from './MenuTresPuntos';
import { MapaFicha } from './FichaPiezas';
import { elegirMapaWeb } from '@tumbite/compartido/src/mapaWebGoogle';
import { seguirTemaEnLeaflet } from '@tumbite/compartido/src/temaMapa';

/**
 * C-ESTOY-AQUI (27 nov 2026) — todas las ciudades. «Medir lugares en la calle»: el equipo arma una
 * tarea con lugares propios de UNA ciudad y la asigna a conductores (de confianza o cuentas de
 * Soporte). En Driver tocan «Estoy aquí» en cada lugar. Cada medición llega aquí pendiente, con el
 * punto guardado y el medido en el mapa, y no cambia nada hasta que el equipo toca Aprobar.
 */
const T = {
  es: {
    titulo: 'Medir lugares en la calle',
    intro:
      'Arma una tarea con los lugares que hay que confirmar y asígnala a conductores de confianza. En Driver ven «Puntos por medir» y, al llegar a cada lugar, tocan «Estoy aquí». Nada cambia hasta que apruebas la medición.',
    ciudad: 'Ciudad',
    elegirCiudad: 'Elige una ciudad',
    porAprobar: 'Mediciones por aprobar',
    sinPendientes: 'No hay mediciones esperando tu revisión.',
    medicionNueva: (lugar: string, movido: string) => `Medición nueva: ${lugar}, movido ${movido}`,
    detalle: (quien: string, precision: number, cuando: string) =>
      `Tomada por ${quien} · precisión ${Math.round(precision)} m · ${cuando}`,
    guardado: 'Punto guardado',
    medido: 'Punto medido',
    fotos: 'Las tres fotos del lugar',
    falta: 'Falta',
    faltanFotos: (cuales: string) =>
      `Faltan fotos: ${cuales}. No se puede aprobar sin las tres; pide al conductor que las tome en el lugar.`,
    publicas: 'Así se ve el lugar (fotos en las apps)',
    publicasAyuda:
      'Las fotos de las mediciones aprobadas se ven en la app de clientes y en Driver cuando el lugar es la recogida o el destino. Quita cualquiera que no deba verse.',
    sinPublicas: 'Todavía no hay fotos aprobadas en esta ciudad.',
    quitarFoto: 'Quitar de las apps',
    opcionesFoto: 'Opciones de la foto',
    seguroQuitar: 'Esta foto deja de verse en la app de clientes y en Driver. ¿Quitarla?',
    quitada: 'Foto quitada de las apps.',
    aprobar: 'Aprobar',
    rechazar: 'Rechazar',
    seguroAprobar: (lugar: string) =>
      `¿Mover «${lugar}» al punto medido? Cambia para todos en unos minutos, y su precio del tabulador se mueve con él.`,
    motivo: 'Motivo del rechazo (opcional)',
    confirmarRechazo: 'Rechazar la medición',
    cancelar: 'Cancelar',
    aprobada: 'Medición aprobada. El lugar ya se movió.',
    rechazada: 'Medición rechazada. El lugar no cambió.',
    tareas: 'Tareas de medición',
    sinTareas: 'Esta ciudad todavía no tiene tareas de medición.',
    progreso: (hechos: number, total: number) => `${hechos} de ${total} lugares medidos`,
    asignadaA: 'Asignada a',
    sinAsignar: 'Sin asignar: ningún conductor la ve todavía.',
    cerrada: 'Cerrada',
    opciones: 'Opciones de la tarea',
    cambiarConductores: 'Cambiar conductores',
    cerrar: 'Cerrar tarea',
    seguroCerrar:
      '¿Cerrar esta tarea? Los conductores dejan de verla. Lo pendiente se puede aprobar igual.',
    estados: {
      sin: 'Sin medir',
      pendiente: 'Por aprobar',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
    } as Record<string, string>,
    nueva: 'Nueva tarea de medición',
    nombreTarea: 'Nombre de la tarea',
    ejemploTarea: 'Ejemplo: puntos de la vía a Mérida',
    nota: 'Nota para el conductor (opcional)',
    lugares: 'Lugares que hay que medir',
    buscarLugar: 'Buscar un lugar',
    elegidos: (n: number) => `${n} ${n === 1 ? 'lugar elegido' : 'lugares elegidos'}`,
    conductores: 'Conductores asignados',
    buscarConductor: 'Buscar conductor por nombre o correo',
    sinCandidatos: 'Ningún conductor de esta ciudad coincide.',
    agregar: 'Agregar',
    quitar: 'Quitar',
    sinConductores: 'Puedes crearla sin asignar y elegir a los conductores después.',
    crear: 'Crear tarea',
    creada: 'Tarea creada. Los conductores asignados ya la ven en Driver.',
    guardarConductores: 'Guardar conductores',
    conductoresGuardados: 'Conductores guardados.',
    faltaTitulo: 'Escribe el nombre de la tarea.',
    faltanLugares: 'Elige al menos un lugar.',
    ilegible: 'No se pudo leer la lista. Recarga la página.',
  },
  en: {
    titulo: 'Measure places on the street',
    intro:
      'Build a task with the places that need checking and assign it to trusted drivers. In Driver they see «Points to measure» and tap «I’m here» at each place. Nothing changes until you approve the measurement.',
    ciudad: 'City',
    elegirCiudad: 'Choose a city',
    porAprobar: 'Measurements to approve',
    sinPendientes: 'No measurements are waiting for review.',
    medicionNueva: (lugar: string, movido: string) => `New measurement: ${lugar}, moved ${movido}`,
    detalle: (quien: string, precision: number, cuando: string) =>
      `Taken by ${quien} · accuracy ${Math.round(precision)} m · ${cuando}`,
    guardado: 'Saved point',
    medido: 'Measured point',
    fotos: 'The three photos of the place',
    falta: 'Missing',
    faltanFotos: (cuales: string) =>
      `Missing photos: ${cuales}. It can’t be approved without all three; ask the driver to take them at the place.`,
    publicas: 'What the place looks like (photos in the apps)',
    publicasAyuda:
      'Photos from approved measurements show in the customer app and in Driver when the place is the pickup or the destination. Remove any that shouldn’t show.',
    sinPublicas: 'No approved photos in this city yet.',
    quitarFoto: 'Remove from the apps',
    opcionesFoto: 'Photo options',
    seguroQuitar: 'This photo will stop showing in the customer app and in Driver. Remove it?',
    quitada: 'Photo removed from the apps.',
    aprobar: 'Approve',
    rechazar: 'Reject',
    seguroAprobar: (lugar: string) =>
      `Move «${lugar}» to the measured point? It changes for everyone within minutes, and its fixed price moves with it.`,
    motivo: 'Reason for rejecting (optional)',
    confirmarRechazo: 'Reject the measurement',
    cancelar: 'Cancel',
    aprobada: 'Measurement approved. The place has moved.',
    rechazada: 'Measurement rejected. The place didn’t change.',
    tareas: 'Measuring tasks',
    sinTareas: 'This city doesn’t have measuring tasks yet.',
    progreso: (hechos: number, total: number) => `${hechos} of ${total} places measured`,
    asignadaA: 'Assigned to',
    sinAsignar: 'Unassigned: no driver sees it yet.',
    cerrada: 'Closed',
    opciones: 'Task options',
    cambiarConductores: 'Change drivers',
    cerrar: 'Close task',
    seguroCerrar:
      'Close this task? Drivers stop seeing it. Pending measurements can still be approved.',
    estados: {
      sin: 'Not measured',
      pendiente: 'To approve',
      aprobada: 'Approved',
      rechazada: 'Rejected',
    } as Record<string, string>,
    nueva: 'New measuring task',
    nombreTarea: 'Task name',
    ejemploTarea: 'Example: points along the highway',
    nota: 'Note for the driver (optional)',
    lugares: 'Places to measure',
    buscarLugar: 'Search a place',
    elegidos: (n: number) => `${n} ${n === 1 ? 'place chosen' : 'places chosen'}`,
    conductores: 'Assigned drivers',
    buscarConductor: 'Search a driver by name or email',
    sinCandidatos: 'No driver in this city matches.',
    agregar: 'Add',
    quitar: 'Remove',
    sinConductores: 'You can create it unassigned and choose drivers later.',
    crear: 'Create task',
    creada: 'Task created. Assigned drivers already see it in Driver.',
    guardarConductores: 'Save drivers',
    conductoresGuardados: 'Drivers saved.',
    faltaTitulo: 'Write the task name.',
    faltanLugares: 'Choose at least one place.',
    ilegible: 'The list couldn’t be read. Reload the page.',
  },
};

type Persona = { id: string; nombre: string; correo?: string };
type Medicion = {
  id: string;
  lugarId: string;
  lugar: string;
  conductor: string;
  lat: number;
  lng: number;
  precisionM: number;
  tomadaEn: string;
  antes: { lat: number; lng: number };
  distanciaM: number;
  /** C-TRES-FOTOS: las fotos tomadas y las que faltan. */
  fotos: { id: string; tipo: TipoFotoMedicion; publica: boolean; quitada: boolean }[];
  faltanFotos: TipoFotoMedicion[];
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  motivo: string | null;
};
type Tarea = {
  id: string;
  titulo: string;
  nota: string;
  estado: 'abierta' | 'cerrada';
  creadaEn: string;
  lugares: { id: string; nombre: string; lat: number; lng: number }[];
  asignados: Persona[];
  mediciones: Medicion[];
};
type LugarCiudad = { id: string; nombre: string; otrosNombres: string[]; activo: boolean };

const VACIO: { titulo: string; nota: string; lugares: string[]; conductores: Persona[] } = {
  titulo: '',
  nota: '',
  lugares: [],
  conductores: [],
};

/** La hora de la base (UTC) en la hora de quien mira. */
const horaLocal = (sql: string, idioma: Idioma) => {
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? sql
    : d.toLocaleString(idioma === 'en' ? 'en-US' : 'es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
};

type P = { lat: number; lng: number };

/**
 * Sin la llave del mapa de Google (servidor local, otra dirección), los dos puntos van en OpenStreetMap:
 * el guardado en gris y el medido en rojo, con la línea entre ellos. Siempre se ven los dos.
 */
function MapaDosPuntosLibre({
  antes,
  medido,
  etiquetas,
}: {
  antes: P;
  medido: P;
  etiquetas: [string, string];
}) {
  const caja = useRef<HTMLDivElement>(null);
  // Una clave de texto: el mapa se rehace solo si cambian los puntos (no en cada dibujo).
  const clave = JSON.stringify([antes, medido, etiquetas]);
  useEffect(() => {
    const [a0, m0, e0] = JSON.parse(clave) as [P, P, [string, string]];
    let vivo = true;
    let quitar: (() => void) | null = null;
    void (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !caja.current || typeof L.map !== 'function') return;
      const m = L.map(caja.current, { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(m);
      const puntos: [P, string, string][] = [
        [a0, '#666B73', e0[0]],
        [m0, '#F20D20', e0[1]],
      ];
      for (const [p, color, texto] of puntos)
        L.circleMarker([p.lat, p.lng], {
          radius: 9,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        })
          .bindTooltip(texto, { permanent: true, direction: 'top' })
          .addTo(m);
      L.polyline(
        [
          [a0.lat, a0.lng],
          [m0.lat, m0.lng],
        ],
        { color: '#101010', weight: 2, dashArray: '6 6' },
      ).addTo(m);
      m.fitBounds(
        L.latLngBounds([
          [a0.lat, a0.lng],
          [m0.lat, m0.lng],
        ]).pad(0.6),
        { maxZoom: 18 },
      );
      m.on('unload', seguirTemaEnLeaflet(m, m0));
      window.setTimeout(() => m.invalidateSize(), 200);
      quitar = () => m.remove();
    })();
    return () => {
      vivo = false;
      quitar?.();
    };
  }, [clave]);
  return (
    <div ref={caja} data-testid="medicion-mapa-libre" style={{ height: 240, borderRadius: 12 }} />
  );
}

const LLAVE_MAPA = (import.meta.env.VITE_GOOGLE_MAPS_WEB_KEY as string | undefined) ?? '';

const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/** Buscar y elegir conductores (cuentas de conductor de la ciudad y de Soporte). */
function ElegirConductores({
  zona,
  idioma,
  elegidos,
  cambiar,
}: {
  zona: string;
  idioma: Idioma;
  elegidos: Persona[];
  cambiar: (p: Persona[]) => void;
}) {
  const t = enIdioma(T, idioma);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Persona[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const espera = setTimeout(() => {
      api
        .pedir<{ candidatos: Persona[] }>(
          'GET',
          `/datos/admin/mediciones/candidatos?zona=${encodeURIComponent(zona)}&q=${encodeURIComponent(q.trim())}`,
        )
        .then((r) => vivo && setLista(Array.isArray(r?.candidatos) ? r.candidatos : []))
        .catch(() => vivo && setLista([]));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [zona, q]);
  const ya = new Set(elegidos.map((e) => e.id));
  return (
    <div className="campo" data-testid="medicion-conductores">
      <span>{t.conductores}</span>
      {elegidos.length ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {elegidos.map((p) => (
            <li
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
            >
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                <strong>{p.nombre}</strong>
                {p.correo ? <span style={{ color: '#666B73' }}> · {p.correo}</span> : null}
              </span>
              <button
                type="button"
                className="boton secundario"
                onClick={() => cambiar(elegidos.filter((x) => x.id !== p.id))}
              >
                {t.quitar}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <small style={{ color: '#666B73' }}>{t.sinConductores}</small>
      )}
      <input
        type="search"
        data-testid="medicion-buscar-conductor"
        placeholder={t.buscarConductor}
        aria-label={t.buscarConductor}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {lista && !lista.filter((p) => !ya.has(p.id)).length ? (
        <small style={{ color: '#666B73' }}>{t.sinCandidatos}</small>
      ) : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 200, overflowY: 'auto' }}>
        {(lista ?? [])
          .filter((p) => !ya.has(p.id))
          .slice(0, 8)
          .map((p) => (
            <li
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
            >
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                {p.nombre}
                {p.correo ? <span style={{ color: '#666B73' }}> · {p.correo}</span> : null}
              </span>
              <button
                type="button"
                className="boton secundario"
                onClick={() => cambiar([...elegidos, p])}
              >
                {t.agregar}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function MedicionesLugares({
  idioma,
  zonas,
}: {
  idioma: Idioma;
  zonas: { id: string; nombre: string }[];
}) {
  const t = enIdioma(T, idioma);
  const [zona, setZona] = useState('');
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [lugares, setLugares] = useState<LugarCiudad[]>([]);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [editando, setEditando] = useState<{ tarea: string; conductores: Persona[] } | null>(null);
  const b = useBorrador({
    formulario: 'medicion-tarea',
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const v = b.valores;

  const cargar = useCallback(() => {
    if (!zona) return;
    const z = encodeURIComponent(zona);
    Promise.all([
      api.pedir<{ tareas: Tarea[] }>('GET', `/datos/admin/mediciones?zona=${z}`),
      api.pedir<{ lugares: LugarCiudad[] }>('GET', `/datos/admin/lugares-propios?zona=${z}`),
    ])
      .then(([m, l]) => {
        if (!Array.isArray(m?.tareas)) return setFalla(t.ilegible);
        setTareas(m.tareas);
        setLugares(Array.isArray(l?.lugares) ? l.lugares.filter((x) => x.activo) : []);
      })
      .catch((x: unknown) => setFalla(mensaje(x)));
  }, [zona, t.ilegible]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = useMemo(
    () => (tareas ?? []).flatMap((x) => x.mediciones.filter((m) => m.estado === 'pendiente')),
    [tareas],
  );
  // C-FOTOS-PUBLICAS: las fotos que hoy se ven en las apps (de mediciones aprobadas, sin quitar).
  const publicas = useMemo(
    () =>
      (tareas ?? []).flatMap((x) =>
        x.mediciones.flatMap((m) =>
          m.fotos.filter((f) => f.publica && !f.quitada).map((f) => ({ ...f, lugar: m.lugar })),
        ),
      ),
    [tareas],
  );
  const lugaresVisibles = useMemo(() => {
    const q = llanoLugar(busca);
    if (q.length < 2) return lugares;
    return lugares.filter((l) => llanoLugar([l.nombre, ...l.otrosNombres].join(' | ')).includes(q));
  }, [lugares, busca]);

  async function hacer(fn: () => Promise<unknown>, listo: string) {
    setFalla('');
    setAviso('');
    try {
      await fn();
      setAviso(listo);
      cargar();
      return true;
    } catch (x) {
      setFalla(mensaje(x));
      return false;
    }
  }

  const aprobar = (m: Medicion) => {
    if (!window.confirm(t.seguroAprobar(m.lugar))) return;
    void hacer(
      () => api.pedir('POST', `/datos/admin/mediciones/medicion/${m.id}/aprobar`, {}),
      t.aprobada,
    );
  };
  const rechazar = (m: Medicion) =>
    void hacer(
      () => api.pedir('POST', `/datos/admin/mediciones/medicion/${m.id}/rechazar`, { motivo }),
      t.rechazada,
    ).then((ok) => {
      if (ok) {
        setRechazando(null);
        setMotivo('');
      }
    });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!v.titulo.trim()) return setFalla(t.faltaTitulo);
    if (!v.lugares.length) return setFalla(t.faltanLugares);
    const ok = await hacer(
      () =>
        api.pedir('POST', '/datos/admin/mediciones', {
          zona,
          titulo: v.titulo.trim(),
          nota: v.nota.trim(),
          lugares: v.lugares,
          conductores: v.conductores.map((c) => c.id),
        }),
      t.creada,
    );
    if (ok) await b.limpiar();
  }

  const alternarLugar = (id: string) =>
    b.setValores((o) => ({
      ...o,
      lugares: o.lugares.includes(id) ? o.lugares.filter((x) => x !== id) : [...o.lugares, id],
    }));

  return (
    <section className="tarjeta-form" data-testid="mediciones-lugares">
      <h2>{t.titulo}</h2>
      <p>{t.intro}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && (
        <p role="status" style={{ color: '#1E7B34' }}>
          {aviso}
        </p>
      )}
      <label className="campo">
        <span>{t.ciudad}</span>
        <select
          data-testid="medicion-ciudad"
          value={zona}
          onChange={(e) => {
            setZona(e.target.value);
            setTareas(null);
            setBusca('');
            setEditando(null);
          }}
        >
          <option value="">{t.elegirCiudad}</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
      </label>

      {zona && tareas ? (
        <>
          <h3>{t.porAprobar}</h3>
          {!pendientes.length ? <p>{t.sinPendientes}</p> : null}
          {pendientes.map((m) => (
            <article
              key={m.id}
              data-testid="medicion-pendiente"
              style={{
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: 14,
                margin: '10px 0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>
                {t.medicionNueva(m.lugar, distanciaLegible(m.distanciaM, idioma))}
              </strong>
              <span
                style={{ display: 'block', color: '#666B73', fontSize: 14, margin: '4px 0 8px' }}
              >
                {t.detalle(m.conductor, m.precisionM, horaLocal(m.tomadaEn, idioma))}
              </span>
              {elegirMapaWeb({ llave: LLAVE_MAPA }) !== 'google' ? (
                <MapaDosPuntosLibre
                  antes={m.antes}
                  medido={{ lat: m.lat, lng: m.lng }}
                  etiquetas={[t.guardado, t.medido]}
                />
              ) : null}
              <MapaFicha
                idioma={idioma}
                etiqueta={t.medicionNueva(m.lugar, distanciaLegible(m.distanciaM, idioma))}
                puntos={[
                  { id: 'guardado', ...m.antes, color: '#666B73', etiqueta: t.guardado },
                  { id: 'medido', lat: m.lat, lng: m.lng, color: '#F20D20', etiqueta: t.medido },
                ]}
                lineas={[
                  {
                    id: 'movido',
                    puntos: [m.antes, { lat: m.lat, lng: m.lng }],
                    color: '#101010',
                    punteada: true,
                  },
                ]}
                leyenda={[
                  { texto: t.guardado, color: '#666B73' },
                  { texto: t.medido, color: '#F20D20' },
                ]}
              />
              <p style={{ margin: '10px 0 6px', fontWeight: 600 }}>{t.fotos}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FOTOS_MEDICION.map((tipo) => {
                  const f = m.fotos.find((x) => x.tipo === tipo);
                  const nombre = nombreFotoMedicion(tipo, idioma === 'en' ? 'en' : 'es');
                  return f ? (
                    <a
                      key={tipo}
                      href={`/datos/admin/mediciones/fotos/${f.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: 120, textDecoration: 'none', color: 'inherit' }}
                    >
                      <img
                        src={`/datos/admin/mediciones/fotos/${f.id}`}
                        alt={nombre}
                        style={{
                          width: 120,
                          height: 90,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: '1px solid #2a2a2a',
                        }}
                      />
                      <span style={{ display: 'block', fontSize: 12 }}>{nombre}</span>
                    </a>
                  ) : (
                    <div
                      key={tipo}
                      style={{
                        width: 120,
                        height: 90,
                        borderRadius: 8,
                        border: '1px dashed #666B73',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        fontSize: 12,
                        color: '#666B73',
                        padding: 4,
                      }}
                    >
                      {`${t.falta}: ${nombre}`}
                    </div>
                  );
                })}
              </div>
              {m.faltanFotos.length ? (
                <p
                  style={{ color: '#C20A1A', margin: '8px 0' }}
                  data-testid="medicion-faltan-fotos"
                >
                  {t.faltanFotos(
                    m.faltanFotos
                      .map((x) =>
                        nombreFotoMedicion(x, idioma === 'en' ? 'en' : 'es').toLowerCase(),
                      )
                      .join(', '),
                  )}
                </p>
              ) : null}
              {rechazando === m.id ? (
                <div className="flex-form">
                  <label className="campo">
                    <span>{t.motivo}</span>
                    <input
                      value={motivo}
                      maxLength={300}
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                  </label>
                  <button type="button" className="boton" onClick={() => rechazar(m)}>
                    {t.confirmarRechazo}
                  </button>
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => setRechazando(null)}
                  >
                    {t.cancelar}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button
                    type="button"
                    className="boton"
                    data-testid="medicion-aprobar"
                    disabled={m.faltanFotos.length > 0}
                    onClick={() => aprobar(m)}
                  >
                    {t.aprobar}
                  </button>
                  <button
                    type="button"
                    className="boton secundario"
                    data-testid="medicion-rechazar"
                    onClick={() => {
                      setRechazando(m.id);
                      setMotivo('');
                    }}
                  >
                    {t.rechazar}
                  </button>
                </div>
              )}
            </article>
          ))}

          <h3>{t.publicas}</h3>
          <p style={{ color: '#666B73' }}>{t.publicasAyuda}</p>
          {!publicas.length ? <p>{t.sinPublicas}</p> : null}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {publicas.map((f) => (
              <div key={f.id} style={{ width: 150 }} data-testid="foto-publica">
                <img
                  src={`/datos/admin/mediciones/fotos/${f.id}`}
                  alt={`${f.lugar}: ${nombreFotoMedicion(f.tipo, idioma === 'en' ? 'en' : 'es')}`}
                  style={{
                    width: 150,
                    height: 110,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #2a2a2a',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ flex: 1, fontSize: 13, overflowWrap: 'anywhere' }}>
                    {`${f.lugar} · ${nombreFotoMedicion(f.tipo, idioma === 'en' ? 'en' : 'es')}`}
                  </span>
                  <MenuTresPuntos
                    etiqueta={t.opcionesFoto}
                    opciones={[
                      {
                        texto: t.quitarFoto,
                        peligro: true,
                        alTocar: () => {
                          if (!window.confirm(t.seguroQuitar)) return;
                          void hacer(
                            () =>
                              api.pedir('POST', `/datos/admin/mediciones/fotos/${f.id}/quitar`, {}),
                            t.quitada,
                          );
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>

          <h3>{t.tareas}</h3>
          {!tareas.length ? <p>{t.sinTareas}</p> : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tareas.map((x) => {
              const estadoDe = (lugarId: string) =>
                x.mediciones.find((m) => m.lugarId === lugarId)?.estado ?? 'sin';
              const hechos = x.lugares.filter((l) => estadoDe(l.id) !== 'sin').length;
              return (
                <li
                  key={x.id}
                  data-testid="medicion-tarea"
                  style={{ padding: '12px 0', borderBottom: '1px solid #e3e5e8' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                      <strong>{x.titulo}</strong>
                      {x.estado === 'cerrada' ? ` · ${t.cerrada}` : ''}
                      <span style={{ display: 'block', fontSize: 14, color: '#666B73' }}>
                        {t.progreso(hechos, x.lugares.length)}
                      </span>
                      <span style={{ display: 'block', fontSize: 14 }}>
                        {x.asignados.length
                          ? `${t.asignadaA}: ${x.asignados.map((a) => a.nombre).join(', ')}`
                          : t.sinAsignar}
                      </span>
                    </span>
                    {x.estado === 'abierta' ? (
                      <MenuTresPuntos
                        etiqueta={t.opciones}
                        opciones={[
                          {
                            texto: t.cambiarConductores,
                            alTocar: () => setEditando({ tarea: x.id, conductores: x.asignados }),
                          },
                          {
                            texto: t.cerrar,
                            peligro: true,
                            alTocar: () => {
                              if (window.confirm(t.seguroCerrar))
                                void hacer(
                                  () =>
                                    api.pedir('POST', `/datos/admin/mediciones/${x.id}/cerrar`, {}),
                                  t.cerrada,
                                );
                            },
                          },
                        ]}
                      />
                    ) : null}
                  </div>
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 14 }}>
                      {t.elegidos(x.lugares.length)}
                    </summary>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {x.lugares.map((l) => (
                        <li key={l.id} style={{ fontSize: 14 }}>
                          {l.nombre} · {t.estados[estadoDe(l.id)]}
                        </li>
                      ))}
                    </ul>
                  </details>
                  {editando?.tarea === x.id ? (
                    <div className="flex-form" style={{ marginTop: 8 }}>
                      <ElegirConductores
                        zona={zona}
                        idioma={idioma}
                        elegidos={editando.conductores}
                        cambiar={(c) => setEditando({ tarea: x.id, conductores: c })}
                      />
                      <button
                        type="button"
                        className="boton"
                        onClick={() =>
                          void hacer(
                            () =>
                              api.pedir('PUT', `/datos/admin/mediciones/${x.id}/asignados`, {
                                conductores: editando.conductores.map((c) => c.id),
                              }),
                            t.conductoresGuardados,
                          ).then((ok) => ok && setEditando(null))
                        }
                      >
                        {t.guardarConductores}
                      </button>
                      <button
                        type="button"
                        className="boton secundario"
                        onClick={() => setEditando(null)}
                      >
                        {t.cancelar}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <form className="flex-form" onSubmit={(e) => void crear(e)} noValidate>
            <h3 data-testid="medicion-nueva">{t.nueva}</h3>
            <AvisoBorrador
              visible={b.recuperado}
              idioma={idioma}
              empezar={() => void b.empezarDeNuevo()}
            />
            <label className="campo">
              <span>{t.nombreTarea}</span>
              <input
                data-testid="medicion-titulo"
                placeholder={t.ejemploTarea}
                value={v.titulo}
                maxLength={120}
                onChange={(e) => b.cambiar('titulo', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.nota}</span>
              <textarea
                rows={2}
                maxLength={500}
                value={v.nota}
                onChange={(e) => b.cambiar('nota', e.target.value)}
              />
            </label>
            <div className="campo">
              <span>{t.lugares}</span>
              <input
                type="search"
                placeholder={t.buscarLugar}
                aria-label={t.buscarLugar}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <small style={{ color: '#666B73' }}>{t.elegidos(v.lugares.length)}</small>
              <ul
                data-testid="medicion-lugares"
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  maxHeight: 260,
                  overflowY: 'auto',
                }}
              >
                {lugaresVisibles.map((l) => (
                  <li key={l.id}>
                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}
                    >
                      <input
                        type="checkbox"
                        checked={v.lugares.includes(l.id)}
                        onChange={() => alternarLugar(l.id)}
                      />
                      <span style={{ overflowWrap: 'anywhere' }}>{l.nombre}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <ElegirConductores
              zona={zona}
              idioma={idioma}
              elegidos={v.conductores}
              cambiar={(c) => b.setValores((o) => ({ ...o, conductores: c }))}
            />
            <button type="submit" className="boton" data-testid="medicion-crear">
              {t.crear}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
