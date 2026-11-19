import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  nombrePais,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { api, pedir } from './api';

/**
 * C-CAMILA-FALLOS (18 nov 2026, Richard: «Camila es nuestra fuente para autorrepararnos») — todos
 * los países. Dos pestañas del buzón de Camila en el superadmin:
 * - «Fallos reportados»: los reportes parecidos agrupados en un fallo con su contador; al abrir uno,
 *   cada reporte con sus preguntas y respuestas, lo que Camila adjuntó sola y la captura (privada,
 *   pedida con la sesión del equipo). «Marcar arreglado y avisar» cierra el círculo: Camila le escribe
 *   a cada persona que lo reportó.
 * - «Preguntas de diagnóstico»: las cuatro de base y las que el equipo propone y aprueba por tipo.
 * Todo lo que escribió la persona es DATO: se muestra como texto (React lo escapa), nunca como HTML.
 */
const T = {
  es: {
    nuevos: 'Nuevos',
    arreglados: 'Arreglados',
    ayudaFallos:
      'Cuando alguien le cuenta a Camila que algo falla, ella conversa con la persona, lee su captura y reúne qué pasó, dónde, su nombre y un contacto para avisarle. Los reportes parecidos se agrupan. Aquí ves cada fallo con cuántas personas lo reportaron.',
    sinFallos: 'No hay fallos nuevos reportados.',
    sinArreglados: 'Todavía no hay fallos marcados como arreglados.',
    reportes: (n: number) => (n === 1 ? '1 reporte' : `${n} reportes`),
    primeraVez: 'Primera vez',
    ultimaVez: 'Última vez',
    arregladoEn: 'Arreglado',
    volver: '‹ Volver a la lista',
    reporteDe: (n: string) => `Reporte de ${n}`,
    sinNombre: 'Persona sin cuenta',
    loQueDijo: 'Lo que escribió primero',
    resumen: 'Resumen del caso',
    quePaso: 'Qué pasó, con sus palabras',
    donde: 'Dónde',
    enLaCaptura: 'Lo que se ve en la captura',
    contacto: 'A quién avisarle',
    nombre: 'Nombre',
    correo: 'Correo',
    telefono: 'Teléfono',
    deLaCuenta: 'Tiene cuenta: se le avisa por la app y al correo de su cuenta.',
    porElChat: 'Además, el aviso le queda escrito en su chat.',
    noQuisoContacto: 'No quiso dejar un contacto. Se le avisa por su chat.',
    noQuisoNombre: 'No quiso dar su nombre.',
    noDijo: 'No lo dijo',
    preguntaEquipo: 'Pregunta del equipo técnico',
    conversacion: 'Conversación completa',
    verConversacion: 'Ver la conversación',
    cargandoConversacion: 'Cargando la conversación…',
    autor: { persona: 'La persona', camila: 'Camila', equipo: 'Equipo' } as Record<string, string>,
    preguntasRespuestas: 'Preguntas y respuestas',
    sinRespuesta: 'Sin respuesta',
    adjunto: 'Lo que Camila adjuntó sola',
    captura: 'Captura de pantalla',
    sinCaptura: 'No mandó captura.',
    verCaptura: 'Ver la captura',
    cargandoCaptura: 'Cargando la captura…',
    capturaNoDisponible: 'Esa captura ya no está disponible (se borran a los 90 días).',
    avisado: 'Ya se le avisó que está arreglado.',
    campos: {
      hora: 'Hora',
      app: 'App y versión',
      aparato: 'Aparato',
      idioma: 'Idioma',
      pais: 'País',
      canal: 'Canal',
      ciudad: 'Ciudad',
      viaje: 'Viaje reciente',
      pedido: 'Pedido reciente',
      errores: 'Últimos errores',
    } as Record<string, string>,
    ninguno: 'Ninguno',
    canal: { web: 'Web', app: 'App Driver', correo: 'Correo' } as Record<string, string>,
    marcar: 'Marcar arreglado y avisar',
    nota: 'Nota para las personas (opcional, por ejemplo «ya puedes recargar desde Ganancias»)',
    confirmar: (n: number) =>
      n === 1
        ? 'Camila le va a escribir a 1 persona para decirle que ya está arreglado y que actualice la app.'
        : `Camila le va a escribir a ${n} personas para decirles que ya está arreglado y que actualicen la app.`,
    confirmarNadie: 'Todas las personas que lo reportaron ya fueron avisadas.',
    siMarcar: 'Sí, marcar arreglado y avisar',
    cancelar: 'Cancelar',
    marcado: (n: number) =>
      n === 1
        ? 'Marcado como arreglado. Camila avisó a 1 persona.'
        : `Marcado como arreglado. Camila avisó a ${n} personas.`,
    notaArreglo: 'Nota del arreglo',
    // Preguntas de diagnóstico
    ayudaPreguntas:
      'Camila conversa con la persona y reúne siempre los cuatro datos de abajo, preguntando solo lo que falte. Además puede hacer UNA pregunta propia de cada tipo de fallo, al final: cualquiera del equipo la propone y no se usa hasta que alguien la aprueba.',
    base: 'Lo que Camila reúne siempre',
    baseLista: [
      'Qué pasó, con las palabras de la persona.',
      'Dónde: la app o la página, y la pantalla.',
      'Su nombre (con cuenta, sale de la cuenta).',
      'Un contacto para avisarle: correo o teléfono (con cuenta, el de la cuenta).',
    ],
    proponer: 'Proponer una pregunta',
    tipo: 'Tipo de fallo',
    todos: 'Todos los tipos',
    preguntaEs: 'Pregunta en español',
    preguntaEn: 'Pregunta en inglés',
    proponerBoton: 'Proponer la pregunta',
    propuesta: 'Propuesta guardada. Queda esperando que alguien la apruebe.',
    faltaPregunta: 'Escribe la pregunta en español y en inglés (al menos 8 letras cada una).',
    propias: 'Preguntas por tipo',
    sinPropias: 'Todavía no hay preguntas propias.',
    estado: { propuesta: 'Propuesta', aprobada: 'Aprobada' } as Record<string, string>,
    aprobar: 'Aprobar',
    retirar: 'Retirar',
    aprobadaOk: 'Aprobada: Camila ya la usa.',
    retiradaOk: 'Retirada: Camila ya no la usa.',
    cargando: 'Cargando…',
  },
  en: {
    nuevos: 'New',
    arreglados: 'Fixed',
    ayudaFallos:
      'When someone tells Camila that something is broken, she talks with the person, reads their screenshot and gathers what happened, where, their name and a contact to notify them. Similar reports are grouped. Here you see each issue with how many people reported it.',
    sinFallos: 'No new issues reported.',
    sinArreglados: 'No issues marked as fixed yet.',
    reportes: (n: number) => (n === 1 ? '1 report' : `${n} reports`),
    primeraVez: 'First time',
    ultimaVez: 'Last time',
    arregladoEn: 'Fixed',
    volver: '‹ Back to the list',
    reporteDe: (n: string) => `Report from ${n}`,
    sinNombre: 'Person without an account',
    loQueDijo: 'What they wrote first',
    resumen: 'Case summary',
    quePaso: 'What happened, in their words',
    donde: 'Where',
    enLaCaptura: 'What the screenshot shows',
    contacto: 'Who to notify',
    nombre: 'Name',
    correo: 'Email',
    telefono: 'Phone',
    deLaCuenta: 'They have an account: they’re notified in the app and at their account email.',
    porElChat: 'The notice is also written in their chat.',
    noQuisoContacto: 'They chose not to leave a contact. They’re notified in their chat.',
    noQuisoNombre: 'They chose not to give their name.',
    noDijo: 'Not given',
    preguntaEquipo: 'Question from the technical team',
    conversacion: 'Full conversation',
    verConversacion: 'View the conversation',
    cargandoConversacion: 'Loading the conversation…',
    autor: { persona: 'The person', camila: 'Camila', equipo: 'Team' } as Record<string, string>,
    preguntasRespuestas: 'Questions and answers',
    sinRespuesta: 'No answer',
    adjunto: 'What Camila attached on her own',
    captura: 'Screenshot',
    sinCaptura: 'No screenshot sent.',
    verCaptura: 'View the screenshot',
    cargandoCaptura: 'Loading the screenshot…',
    capturaNoDisponible: 'That screenshot is no longer available (they’re deleted after 90 days).',
    avisado: 'They were already told it’s fixed.',
    campos: {
      hora: 'Time',
      app: 'App and version',
      aparato: 'Device',
      idioma: 'Language',
      pais: 'Country',
      canal: 'Channel',
      ciudad: 'City',
      viaje: 'Recent ride',
      pedido: 'Recent order',
      errores: 'Latest errors',
    } as Record<string, string>,
    ninguno: 'None',
    canal: { web: 'Web', app: 'Driver app', correo: 'Email' } as Record<string, string>,
    marcar: 'Mark fixed and notify',
    nota: 'Note for the people (optional, for example “you can top up from Earnings now”)',
    confirmar: (n: number) =>
      n === 1
        ? 'Camila will write to 1 person to say it’s fixed and to update the app.'
        : `Camila will write to ${n} people to say it’s fixed and to update the app.`,
    confirmarNadie: 'Everyone who reported it has already been notified.',
    siMarcar: 'Yes, mark fixed and notify',
    cancelar: 'Cancel',
    marcado: (n: number) =>
      n === 1
        ? 'Marked as fixed. Camila notified 1 person.'
        : `Marked as fixed. Camila notified ${n} people.`,
    notaArreglo: 'Fix note',
    ayudaPreguntas:
      'Camila talks with the person and always gathers the four items below, asking only for what is missing. She can also ask ONE question for each kind of issue, at the end: anyone on the team proposes it and it isn’t used until someone approves it.',
    base: 'What Camila always gathers',
    baseLista: [
      'What happened, in the person’s own words.',
      'Where: the app or the page, and the screen.',
      'Their name (with an account, it comes from the account).',
      'A contact to notify them: email or phone (with an account, the account’s).',
    ],
    proponer: 'Propose a question',
    tipo: 'Kind of issue',
    todos: 'All kinds',
    preguntaEs: 'Question in Spanish',
    preguntaEn: 'Question in English',
    proponerBoton: 'Propose the question',
    propuesta: 'Proposal saved. It’s waiting for someone to approve it.',
    faltaPregunta: 'Write the question in Spanish and English (at least 8 letters each).',
    propias: 'Questions by kind',
    sinPropias: 'No custom questions yet.',
    estado: { propuesta: 'Proposed', aprobada: 'Approved' } as Record<string, string>,
    aprobar: 'Approve',
    retirar: 'Retire',
    aprobadaOk: 'Approved: Camila is using it now.',
    retiradaOk: 'Retired: Camila no longer uses it.',
    cargando: 'Loading…',
  },
};
type Textos = (typeof T)['es'];
type NombresTipo = Record<string, { es: string; en: string }>;

type Fallo = {
  id: string;
  codigo: string;
  tipo: string;
  titulo: string;
  estado: 'nuevo' | 'arreglado';
  reportes: number;
  primera_vez: string;
  ultima_vez: string;
  arreglado_en: string | null;
  nota_arreglo: string | null;
};
type Reporte = {
  id: string;
  personaId: string;
  nombre: string;
  inicial: string;
  // C-CAMILA-REPORTE-CONVERSADO: lo que el reporte reunió conversando.
  resumen?: string;
  quePaso?: string;
  donde?: string;
  lecturaCaptura?: string;
  contacto?: {
    correo: string;
    telefono: string;
    deLaCuenta: boolean;
    noQuiso: boolean;
    sinNombre: boolean;
  };
  extra?: { pregunta: string; respuesta: string } | null;
  preguntas: { clave: string; es: string; en: string }[];
  respuestas: string[];
  contexto: Record<string, unknown>;
  captura: boolean;
  avisado: boolean;
  completoEn: string;
};
type Pregunta = {
  id: string;
  tipo: string;
  pregunta_es: string;
  pregunta_en: string;
  estado: 'propuesta' | 'aprobada';
};

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/** Las fechas de la base van en UTC sin zona («2026-11-17 14:05:00») o en ISO. */
function fecha(s: unknown, idioma: Idioma): string {
  if (typeof s !== 'string' || !s) return '';
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(idioma === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const nombreTipo = (tipos: NombresTipo, tipo: string, idioma: Idioma) => {
  const n = new Map(Object.entries(tipos)).get(tipo);
  return (idioma === 'en' ? n?.en : n?.es) ?? tipo;
};

/** Un valor del contexto, en una línea legible (nunca HTML: React lo escapa). */
export function valorContexto(clave: string, v: unknown, t: Textos, idioma: Idioma): string {
  if (v === null || v === undefined || v === '') return t.ninguno;
  if (clave === 'hora') return fecha(v, idioma);
  if (clave === 'pais' && typeof v === 'string') return nombrePais(v, idioma);
  if (clave === 'idioma') return v === 'en' ? 'English' : 'Español';
  if (clave === 'canal' && typeof v === 'string')
    return new Map(Object.entries(t.canal)).get(v) ?? v;
  if (Array.isArray(v)) {
    if (!v.length) return t.ninguno;
    return v
      .map((x) =>
        x && typeof x === 'object'
          ? Object.values(x as Record<string, unknown>)
              .filter((y) => y !== null && y !== '')
              .map(String)
              .join(' · ')
          : String(x),
      )
      .join('\n');
  }
  if (typeof v === 'object')
    return Object.entries(v as Record<string, unknown>)
      .filter(([, y]) => y !== null && y !== '')
      .map(([k, y]) => (k === 'creado_en' ? fecha(y, idioma) : String(y)))
      .join(' · ');
  return String(v);
}

export function FallosReportados({
  idioma,
  fallo,
  elegir,
}: {
  idioma: Idioma;
  fallo: string;
  elegir: (id: string) => void;
}) {
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<'nuevo' | 'arreglado'>('nuevo');
  const [datos, setDatos] = useState<{ fallos: Fallo[]; tipos: NombresTipo } | null>(null);
  const [error, setError] = useState('');
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    pedir<{ fallos: Fallo[]; tipos: NombresTipo }>(
      'GET',
      `/datos/admin/camila/fallos?estado=${estado}`,
    )
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setError('');
      })
      .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, [estado, vuelta]);
  if (fallo)
    return (
      <FichaFallo
        key={fallo}
        id={fallo}
        t={t}
        idioma={idioma}
        tipos={datos?.tipos ?? {}}
        volver={() => {
          elegir('');
          setVuelta((n) => n + 1);
        }}
      />
    );
  return (
    <div data-testid="camila-fallos">
      <p className="pista">{t.ayudaFallos}</p>
      <div className="fila-botones" role="group" aria-label={t.nuevos}>
        {(['nuevo', 'arreglado'] as const).map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={estado === e}
            className={estado === e ? 'boton' : 'boton secundario'}
            onClick={() => setEstado(e)}
          >
            {e === 'nuevo' ? t.nuevos : t.arreglados}
          </button>
        ))}
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {!datos ? (
        <p className="pista">{t.cargando}</p>
      ) : datos.fallos.length === 0 ? (
        <p className="pista">{estado === 'nuevo' ? t.sinFallos : t.sinArreglados}</p>
      ) : (
        <ul className="camila-lista" data-testid="camila-lista-fallos">
          {datos.fallos.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="camila-fila camila-fallo"
                onClick={() => elegir(f.id)}
              >
                <span className="camila-fila-cabeza">
                  <span className="camila-contador" aria-label={t.reportes(f.reportes)}>
                    {f.reportes}
                  </span>
                  <strong>{f.codigo}</strong>
                  <span className="camila-chip">{nombreTipo(datos.tipos, f.tipo, idioma)}</span>
                  <small className="pista">{t.reportes(f.reportes)}</small>
                </span>
                <span className="camila-resumen">{f.titulo}</span>
                <small className="pista">
                  {t.primeraVez}: {fecha(f.primera_vez, idioma)} · {t.ultimaVez}:{' '}
                  {fecha(f.ultima_vez, idioma)}
                  {f.estado === 'arreglado' && f.arreglado_en
                    ? ` · ${t.arregladoEn}: ${fecha(f.arreglado_en, idioma)}`
                    : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FichaFallo({
  id,
  t,
  idioma,
  tipos,
  volver,
}: {
  id: string;
  t: Textos;
  idioma: Idioma;
  tipos: NombresTipo;
  volver: () => void;
}) {
  const [ficha, setFicha] = useState<{ fallo: Fallo; reportes: Reporte[] } | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // La nota no se pierde si se cierra la ventana (regla de los formularios).
  const b = useBorrador({
    formulario: `camila-fallo-arreglado-${id}`,
    cuenta: 'superadmin',
    inicial: { nota: '' },
    almacen: almacenNavegador,
  });
  useEffect(() => {
    let vivo = true;
    pedir<{ fallo: Fallo; reportes: Reporte[] }>(
      'GET',
      `/datos/admin/camila/fallos/${encodeURIComponent(id)}`,
    )
      .then((d) => vivo && setFicha(d))
      .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, [id, vuelta]);
  async function marcar() {
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<{ avisadas: number }>(
        'POST',
        `/datos/admin/camila/fallos/${encodeURIComponent(id)}/arreglado`,
        { nota: b.valores.nota.trim() },
      );
      await b.limpiar();
      setConfirmando(false);
      setOk(t.marcado(r.avisadas));
      setVuelta((n) => n + 1);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  const atras = (
    <button type="button" className="enlace" onClick={volver}>
      {t.volver}
    </button>
  );
  if (!ficha)
    return (
      <div>
        {atras}
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : (
          <p className="pista">{t.cargando}</p>
        )}
      </div>
    );
  const f = ficha.fallo;
  const porAvisar = new Set(ficha.reportes.filter((r) => !r.avisado).map((r) => r.personaId)).size;
  return (
    <section data-testid="camila-ficha-fallo">
      {atras}
      <div className="flex-tarjeta">
        <div className="camila-fila-cabeza">
          <span className="camila-contador" aria-label={t.reportes(f.reportes)}>
            {f.reportes}
          </span>
          <h3 className="camila-ficha-titulo">{f.codigo}</h3>
          <span className="camila-chip">{nombreTipo(tipos, f.tipo, idioma)}</span>
          <small className="pista">{t.reportes(f.reportes)}</small>
        </div>
        <p className="camila-resumen">{f.titulo}</p>
        <p className="pista">
          {t.primeraVez}: {fecha(f.primera_vez, idioma)} · {t.ultimaVez}:{' '}
          {fecha(f.ultima_vez, idioma)}
          {f.estado === 'arreglado' && f.arreglado_en
            ? ` · ${t.arregladoEn}: ${fecha(f.arreglado_en, idioma)}`
            : ''}
        </p>
        {f.nota_arreglo ? (
          <p>
            <strong>{t.notaArreglo}:</strong> {f.nota_arreglo}
          </p>
        ) : null}
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        {f.estado === 'nuevo' ? (
          confirmando ? (
            <div className="camila-confirmar" data-testid="camila-confirmar-arreglo">
              <AvisoBorrador
                visible={b.recuperado}
                idioma={idioma}
                empezar={() => void b.empezarDeNuevo()}
              />
              <label className="campo">
                {t.nota}
                <input
                  maxLength={200}
                  value={b.valores.nota}
                  onChange={(e) => b.cambiar('nota', e.target.value)}
                />
              </label>
              <p>
                <strong>{porAvisar ? t.confirmar(porAvisar) : t.confirmarNadie}</strong>
              </p>
              <div className="fila-botones">
                <button
                  type="button"
                  className="boton exito"
                  disabled={enviando}
                  onClick={() => void marcar()}
                >
                  {t.siMarcar}
                </button>
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => setConfirmando(false)}
                >
                  {t.cancelar}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="boton exito" onClick={() => setConfirmando(true)}>
              {t.marcar}
            </button>
          )
        ) : null}
      </div>
      {ficha.reportes.map((r) => (
        <ReporteFallo key={r.id} r={r} falloId={f.id} t={t} idioma={idioma} />
      ))}
    </section>
  );
}

const ORDEN_CONTEXTO = [
  'hora',
  'app',
  'aparato',
  'idioma',
  'pais',
  'canal',
  'ciudad',
  'viaje',
  'pedido',
  'errores',
];

function ReporteFallo({
  r,
  falloId,
  t,
  idioma,
}: {
  r: Reporte;
  falloId: string;
  t: Textos;
  idioma: Idioma;
}) {
  const contexto = new Map(Object.entries(r.contexto));
  const claves = [
    ...ORDEN_CONTEXTO.filter((k) => contexto.has(k)),
    ...[...contexto.keys()].filter((k) => !ORDEN_CONTEXTO.includes(k)),
  ];
  const campos = new Map(Object.entries(t.campos));
  return (
    <article className="flex-tarjeta camila-reporte" data-testid={`camila-reporte-${r.id}`}>
      <h4>
        {t.reporteDe(r.nombre || t.sinNombre)}{' '}
        <small className="pista">· {fecha(r.completoEn, idioma)}</small>
      </h4>
      {r.avisado ? <p className="texto-exito">{t.avisado}</p> : null}
      {r.resumen ? (
        <>
          <h5>{t.resumen}</h5>
          <p className="camila-dato camila-resumen" data-testid="camila-resumen">
            {r.resumen}
          </p>
        </>
      ) : null}
      {r.quePaso || r.donde || r.lecturaCaptura ? (
        <dl className="camila-respuestas" data-testid="camila-campos">
          <div>
            <dt>{t.quePaso}</dt>
            <dd className="camila-dato">{r.quePaso || t.noDijo}</dd>
          </div>
          <div>
            <dt>{t.donde}</dt>
            <dd className="camila-dato">{r.donde || t.noDijo}</dd>
          </div>
          {r.lecturaCaptura ? (
            <div>
              <dt>{t.enLaCaptura}</dt>
              <dd className="camila-dato">{r.lecturaCaptura}</dd>
            </div>
          ) : null}
          {r.extra ? (
            <div>
              <dt>
                {t.preguntaEquipo}: {r.extra.pregunta}
              </dt>
              <dd className="camila-dato">{r.extra.respuesta}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="camila-dato">
          <strong>{t.loQueDijo}:</strong> {r.inicial}
        </p>
      )}
      {r.contacto ? (
        <>
          <h5>{t.contacto}</h5>
          <dl className="camila-respuestas" data-testid="camila-contacto">
            <div>
              <dt>{t.nombre}</dt>
              <dd className="camila-dato">
                {r.nombre || (r.contacto.sinNombre ? t.noQuisoNombre : t.noDijo)}
              </dd>
            </div>
            {r.contacto.correo ? (
              <div>
                <dt>{t.correo}</dt>
                <dd className="camila-dato">{r.contacto.correo}</dd>
              </div>
            ) : null}
            {r.contacto.telefono ? (
              <div>
                <dt>{t.telefono}</dt>
                <dd className="camila-dato">{r.contacto.telefono}</dd>
              </div>
            ) : null}
          </dl>
          <p className="pista">
            {r.contacto.deLaCuenta
              ? t.deLaCuenta
              : r.contacto.noQuiso || (!r.contacto.correo && !r.contacto.telefono)
                ? t.noQuisoContacto
                : t.porElChat}
          </p>
        </>
      ) : null}
      {r.preguntas.length ? (
        <>
          <h5>{t.preguntasRespuestas}</h5>
          <dl className="camila-respuestas">
            {r.preguntas.map((q, i) => (
              <div key={`${q.clave}-${i}`}>
                <dt>{idioma === 'en' ? q.en : q.es}</dt>
                <dd className="camila-dato">{r.respuestas.at(i) || t.sinRespuesta}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      <h5>{t.captura}</h5>
      {r.captura ? (
        <CapturaPrivada falloId={falloId} reporteId={r.id} t={t} />
      ) : (
        <p className="pista">{t.sinCaptura}</p>
      )}
      <h5>{t.conversacion}</h5>
      <ConversacionDelReporte falloId={falloId} reporteId={r.id} t={t} idioma={idioma} />
      <h5>{t.adjunto}</h5>
      <div className="tabla-ancha">
        <table className="tabla camila-contexto" aria-label={t.adjunto}>
          <tbody>
            {claves.map((k) => (
              <tr key={k}>
                <th scope="row">{campos.get(k) ?? k}</th>
                <td className="camila-dato">{valorContexto(k, contexto.get(k), t, idioma)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

type MensajeDeReporte = {
  id: string;
  autor: string;
  texto: string;
  creado_en: string;
  adjunto: string | null;
};

/** La conversación completa del reporte: se pide al tocar, con la sesión del equipo. */
function ConversacionDelReporte({
  falloId,
  reporteId,
  t,
  idioma,
}: {
  falloId: string;
  reporteId: string;
  t: Textos;
  idioma: Idioma;
}) {
  const [pedida, setPedida] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeDeReporte[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!pedida) return;
    let vivo = true;
    pedir<{ mensajes: MensajeDeReporte[] }>(
      'GET',
      `/datos/admin/camila/fallos/${encodeURIComponent(falloId)}/conversacion/${encodeURIComponent(reporteId)}`,
    )
      .then((r) => vivo && setMensajes(r.mensajes))
      .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, [pedida, falloId, reporteId]);
  if (!pedida)
    return (
      <button
        type="button"
        className="boton secundario"
        onClick={() => setPedida(true)}
        data-testid="camila-ver-conversacion"
      >
        {t.verConversacion}
      </button>
    );
  if (error)
    return (
      <p className="error-general" role="alert">
        {error}
      </p>
    );
  if (!mensajes) return <p className="pista">{t.cargandoConversacion}</p>;
  return (
    <ol className="camila-conversacion" data-testid="camila-conversacion">
      {mensajes.map((m) => (
        <li key={m.id} className={m.autor === 'persona' ? 'de-persona' : 'de-camila'}>
          <strong>{t.autor[m.autor] ?? m.autor}</strong>{' '}
          <small className="pista">{fecha(m.creado_en, idioma)}</small>
          {m.adjunto ? <AdjuntoPrivado id={m.adjunto} t={t} /> : null}
          <p className="camila-dato">{m.texto}</p>
        </li>
      ))}
    </ol>
  );
}

/** Una imagen de la conversación, pedida con la sesión del equipo. */
function AdjuntoPrivado({ id, t }: { id: string; t: Textos }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let vivo = true;
    api
      .verFoto(`/datos/admin/camila/adjuntos/${encodeURIComponent(id)}`)
      .then((u) => vivo && setSrc(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [id]);
  return src ? <img className="camila-captura chica" src={src} alt={t.captura} /> : null;
}

/** La captura se pide con la sesión del equipo y se muestra en la página (nunca un enlace público). */
function CapturaPrivada({
  falloId,
  reporteId,
  t,
}: {
  falloId: string;
  reporteId: string;
  t: Textos;
}) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const [pedida, setPedida] = useState(false);
  useEffect(() => {
    if (!pedida) return;
    let vivo = true;
    api
      .verFoto(
        `/datos/admin/camila/fallos/${encodeURIComponent(falloId)}/captura/${encodeURIComponent(reporteId)}`,
      )
      .then((u) => vivo && setSrc(u))
      .catch((x: unknown) => vivo && setError(mensajeDe(x) || t.capturaNoDisponible));
    return () => {
      vivo = false;
    };
  }, [pedida, falloId, reporteId, t.capturaNoDisponible]);
  if (!pedida)
    return (
      <button type="button" className="boton secundario" onClick={() => setPedida(true)}>
        {t.verCaptura}
      </button>
    );
  if (error)
    return (
      <p className="error-general" role="alert">
        {error}
      </p>
    );
  if (!src) return <p className="pista">{t.cargandoCaptura}</p>;
  return <img className="camila-captura" src={src} alt={t.captura} data-testid="camila-captura" />;
}

export function PreguntasDiagnostico({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<{
    base: { clave: string; es: string; en: string }[];
    preguntas: Pregunta[];
    tipos: NombresTipo;
  } | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: 'camila-pregunta-nueva',
    cuenta: 'superadmin',
    inicial: { tipo: 'todos', preguntaEs: '', preguntaEn: '' },
    almacen: almacenNavegador,
  });
  useEffect(() => {
    let vivo = true;
    pedir<{
      base: { clave: string; es: string; en: string }[];
      preguntas: Pregunta[];
      tipos: NombresTipo;
    }>('GET', '/datos/admin/camila/preguntas')
      .then((d) => vivo && setDatos(d))
      .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  async function proponer(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const v = b.valores;
    if (v.preguntaEs.trim().length < 8 || v.preguntaEn.trim().length < 8)
      return setError(t.faltaPregunta);
    setEnviando(true);
    try {
      await pedir('POST', '/datos/admin/camila/preguntas', {
        tipo: v.tipo,
        preguntaEs: v.preguntaEs.trim(),
        preguntaEn: v.preguntaEn.trim(),
      });
      await b.limpiar();
      setOk(t.propuesta);
      setVuelta((n) => n + 1);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  async function decidir(id: string, decision: 'aprobar' | 'retirar') {
    setError('');
    setOk('');
    try {
      await pedir('POST', `/datos/admin/camila/preguntas/${encodeURIComponent(id)}/${decision}`);
      setOk(decision === 'aprobar' ? t.aprobadaOk : t.retiradaOk);
      setVuelta((n) => n + 1);
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  if (!datos)
    return error ? (
      <p className="error-general" role="alert">
        {error}
      </p>
    ) : (
      <p className="pista">{t.cargando}</p>
    );
  const tipos = Object.keys(datos.tipos);
  return (
    <div data-testid="camila-preguntas">
      <p className="pista">{t.ayudaPreguntas}</p>
      <div className="flex-tarjeta">
        <h3>{t.base}</h3>
        <ol className="camila-base">
          {t.baseLista.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>
      <form className="flex-tarjeta formulario" noValidate onSubmit={(e) => void proponer(e)}>
        <h3>{t.proponer}</h3>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          {t.tipo}
          <select value={b.valores.tipo} onChange={(e) => b.cambiar('tipo', e.target.value)}>
            <option value="todos">{t.todos}</option>
            {tipos.map((k) => (
              <option key={k} value={k}>
                {nombreTipo(datos.tipos, k, idioma)}
              </option>
            ))}
          </select>
        </label>
        <div className="camila-dos-columnas">
          <label className="campo">
            {t.preguntaEs}
            <textarea
              rows={2}
              maxLength={240}
              value={b.valores.preguntaEs}
              onChange={(e) => b.cambiar('preguntaEs', e.target.value)}
            />
          </label>
          <label className="campo">
            {t.preguntaEn}
            <textarea
              rows={2}
              maxLength={240}
              value={b.valores.preguntaEn}
              onChange={(e) => b.cambiar('preguntaEn', e.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="boton" disabled={enviando}>
          {t.proponerBoton}
        </button>
      </form>
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
      <h3>{t.propias}</h3>
      {datos.preguntas.length === 0 ? (
        <p className="pista">{t.sinPropias}</p>
      ) : (
        <ul className="camila-lista" data-testid="camila-lista-preguntas">
          {datos.preguntas.map((q) => (
            <li key={q.id} className="camila-aprobada">
              <span className="camila-fila-cabeza">
                <span className="camila-chip">
                  {q.tipo === 'todos' ? t.todos : nombreTipo(datos.tipos, q.tipo, idioma)}
                </span>
                <span className={q.estado === 'aprobada' ? 'camila-chip aprobada' : 'camila-chip'}>
                  {new Map(Object.entries(t.estado)).get(q.estado) ?? q.estado}
                </span>
              </span>
              <span>{q.pregunta_es}</span>
              <span className="pista">{q.pregunta_en}</span>
              <span className="fila-botones">
                {q.estado === 'propuesta' ? (
                  <button
                    type="button"
                    className="boton exito"
                    onClick={() => void decidir(q.id, 'aprobar')}
                  >
                    {t.aprobar}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => void decidir(q.id, 'retirar')}
                >
                  {t.retirar}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
