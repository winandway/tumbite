import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { FallosReportados, PreguntasDiagnostico } from './SuperCamilaFallos';
import { pedir } from './api';

/**
 * C-CAMILA-BUZON (17 nov 2026) — todos los países, primero El Vigía y Tucaní. El buzón de Camila
 * Campos, la asistente de soporte de Divoox, en el superadmin: los casos que Camila le pasó al
 * equipo, las conversaciones que una persona del equipo está atendiendo, el gasto de IA del día, la
 * conversación completa (responder en el mismo hilo, devolvérsela a Camila, cerrar el caso), la lista
 * semanal de aprendizaje (el equipo aprueba lo que Camila puede responder) y los ajustes. Los topes viven en el código del servidor: aquí no se pueden pasar.
 */
const T = {
  es: {
    titulo: 'Camila',
    ayuda:
      'Camila Campos es la asistente virtual del equipo de soporte. Responde a los conductores y a los líderes de equipo por la web, por la app Divoox Driver y por correo, en una sola conversación por persona. Lo que no puede resolver te llega aquí.',
    pestanas: {
      bandeja: 'Bandeja',
      conversacion: 'Conversación',
      aprendizaje: 'Aprendizaje',
      fallos: 'Fallos reportados',
      preguntas: 'Preguntas de diagnóstico',
      ajustes: 'Ajustes',
    },
    casos: 'Casos abiertos',
    sinCasos: 'No hay casos abiertos. Camila está resolviendo sola.',
    atendiendo: 'Atendiendo el equipo',
    sinAtendiendo: 'Nadie del equipo tiene una conversación tomada ahora.',
    gastoHoy: 'Gasto de IA de hoy',
    deTope: (g: string, t: string) => `${g} de ${t}`,
    llamadas: (n: number) => (n === 1 ? '1 consulta' : `${n} consultas`),
    regalos: (n: number) => (n === 1 ? '1 regalo de arranque' : `${n} regalos de arranque`),
    motivo: { ayuda: 'Necesita ayuda', pide_persona: 'Pidió una persona' } as Record<
      string,
      string
    >,
    abrir: 'Abrir la conversación',
    canal: {
      web: 'Web',
      app: 'App Driver',
      correo: 'Correo',
      sms: 'SMS',
      whatsapp: 'WhatsApp',
    } as Record<string, string>,
    hasta: (h: string) => `Tomada hasta ${h}`,
    buscar: 'Buscar por nombre o correo',
    conversaciones: 'Conversaciones',
    sinConversaciones: 'Todavía no hay conversaciones.',
    sinResultados: 'Ninguna conversación coincide con esa búsqueda.',
    elige: 'Elige una conversación de la lista o de la bandeja.',
    mensajes: (n: number) => (n === 1 ? '1 mensaje' : `${n} mensajes`),
    autor: {
      persona: 'Persona',
      camila: 'Camila',
      equipo: 'Equipo',
    } as Record<string, string>,
    sinCuenta: 'Sin cuenta unida',
    tomadaPorEquipo: 'La tiene el equipo: Camila no contesta.',
    responder: 'Responder en el mismo hilo',
    responderAyuda:
      'Al responder tomas la conversación por 12 horas y Camila se calla. Sale por el último canal que usó la persona.',
    enviar: 'Enviar respuesta',
    enviado: 'Respuesta enviada.',
    noEnviado:
      'Quedó en el hilo, pero no salió por el canal de la persona. La verá cuando vuelva a abrir el chat.',
    devolver: 'Devolver a Camila',
    devuelta: 'Camila vuelve a responder esta conversación.',
    casosDe: 'Casos de esta persona',
    cerrarCaso: 'Cerrar el caso',
    cerrado: 'Caso cerrado.',
    estadoCaso: { abierto: 'Abierto', cerrado: 'Cerrado' } as Record<string, string>,
    aprendizajeAyuda:
      'Cada semana Camila junta lo que no supo responder. Corrige la pregunta y la respuesta en los dos idiomas y apruébala: desde ese momento Camila la usa. Lo que descartes no se usa nunca.',
    armar: 'Armar la lista ahora',
    armada: (n: number) =>
      n === 1 ? 'Se agregó 1 propuesta nueva.' : `Se agregaron ${n} propuestas nuevas.`,
    sinLista: (n: number) =>
      n === 1
        ? '1 pregunta sin respuesta todavía no está en la lista.'
        : `${n} preguntas sin respuesta todavía no están en la lista.`,
    propuestas: 'Para revisar esta semana',
    sinPropuestas: 'No hay propuestas para revisar.',
    veces: (n: number) => (n === 1 ? 'Se preguntó 1 vez' : `Se preguntó ${n} veces`),
    preguntaEs: 'Pregunta en español',
    preguntaEn: 'Pregunta en inglés',
    respuestaEs: 'Respuesta en español',
    respuestaEn: 'Respuesta en inglés',
    aprobar: 'Aprobar',
    descartar: 'Descartar',
    aprobada: 'Aprobada: Camila ya la usa.',
    descartada: 'Descartada.',
    faltaTexto: 'Llena las cuatro casillas: pregunta y respuesta, en español y en inglés.',
    aprobadas: 'Respuestas aprobadas',
    sinAprobadas: 'Todavía no hay respuestas aprobadas.',
    ajustesAyuda:
      'Lo que Camila puede gastar y hacer cada día. Los topes máximos están fijos en el código.',
    ia: 'Respuestas con IA encendidas',
    iaAyuda:
      'Apagadas, Camila responde solo con Docs y con las respuestas aprobadas, y pasa lo demás al equipo.',
    iaSinLlave:
      'La IA todavía no está conectada en este sitio: Camila responde con Docs y lo aprobado.',
    tope: 'Tope diario de IA (dólares)',
    topeAyuda: (m: string) =>
      `Hasta ${m} al día. Al llegar al tope, Camila sigue sin IA y te avisa.`,
    regalosDia: 'Regalos de arranque por día',
    regalosAyuda: (n: number) =>
      `Cuántos regalos de arranque puede entregar Camila en un día (hasta ${n}).`,
    guardar: 'Guardar los ajustes',
    guardado: 'Ajustes guardados.',
    topeMalo: (m: string) => `El tope diario va de 0 a ${m}.`,
    regalosMalo: (n: number) => `Los regalos por día van de 0 a ${n}.`,
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Camila',
    ayuda:
      'Camila Campos is the Support Team’s virtual assistant. She answers drivers and team leaders on the web, in the Divoox Driver app and by email, in one conversation per person. What she can’t solve comes to you here.',
    pestanas: {
      bandeja: 'Inbox',
      conversacion: 'Conversation',
      aprendizaje: 'Learning',
      fallos: 'Reported issues',
      preguntas: 'Diagnostic questions',
      ajustes: 'Settings',
    },
    casos: 'Open cases',
    sinCasos: 'No open cases. Camila is handling everything.',
    atendiendo: 'Handled by the team',
    sinAtendiendo: 'No one on the team has taken a conversation right now.',
    gastoHoy: 'Today’s AI spend',
    deTope: (g: string, t: string) => `${g} of ${t}`,
    llamadas: (n: number) => (n === 1 ? '1 request' : `${n} requests`),
    regalos: (n: number) => (n === 1 ? '1 starter gift' : `${n} starter gifts`),
    motivo: { ayuda: 'Needs help', pide_persona: 'Asked for a person' } as Record<string, string>,
    abrir: 'Open the conversation',
    canal: {
      web: 'Web',
      app: 'Driver app',
      correo: 'Email',
      sms: 'SMS',
      whatsapp: 'WhatsApp',
    } as Record<string, string>,
    hasta: (h: string) => `Taken until ${h}`,
    buscar: 'Search by name or email',
    conversaciones: 'Conversations',
    sinConversaciones: 'No conversations yet.',
    sinResultados: 'No conversation matches that search.',
    elige: 'Pick a conversation from the list or the inbox.',
    mensajes: (n: number) => (n === 1 ? '1 message' : `${n} messages`),
    autor: { persona: 'Person', camila: 'Camila', equipo: 'Team' } as Record<string, string>,
    sinCuenta: 'No linked account',
    tomadaPorEquipo: 'The team has it: Camila stays quiet.',
    responder: 'Reply in the same thread',
    responderAyuda:
      'Replying takes the conversation for 12 hours and Camila stays quiet. It goes out on the last channel the person used.',
    enviar: 'Send reply',
    enviado: 'Reply sent.',
    noEnviado:
      'It’s in the thread, but it didn’t go out on the person’s channel. They’ll see it next time they open the chat.',
    devolver: 'Give back to Camila',
    devuelta: 'Camila is answering this conversation again.',
    casosDe: 'This person’s cases',
    cerrarCaso: 'Close the case',
    cerrado: 'Case closed.',
    estadoCaso: { abierto: 'Open', cerrado: 'Closed' } as Record<string, string>,
    aprendizajeAyuda:
      'Every week Camila collects what she couldn’t answer. Fix the question and the answer in both languages and approve it: from then on Camila uses it. What you discard is never used.',
    armar: 'Build the list now',
    armada: (n: number) =>
      n === 1 ? '1 new proposal was added.' : `${n} new proposals were added.`,
    sinLista: (n: number) =>
      n === 1
        ? '1 unanswered question isn’t on the list yet.'
        : `${n} unanswered questions aren’t on the list yet.`,
    propuestas: 'To review this week',
    sinPropuestas: 'No proposals to review.',
    veces: (n: number) => (n === 1 ? 'Asked once' : `Asked ${n} times`),
    preguntaEs: 'Question in Spanish',
    preguntaEn: 'Question in English',
    respuestaEs: 'Answer in Spanish',
    respuestaEn: 'Answer in English',
    aprobar: 'Approve',
    descartar: 'Discard',
    aprobada: 'Approved: Camila is using it now.',
    descartada: 'Discarded.',
    faltaTexto: 'Fill in all four boxes: question and answer, in Spanish and English.',
    aprobadas: 'Approved answers',
    sinAprobadas: 'No approved answers yet.',
    ajustesAyuda:
      'What Camila can spend and do each day. The maximum limits are fixed in the code.',
    ia: 'AI answers on',
    iaAyuda:
      'Off, Camila answers only with Docs and the approved answers, and hands everything else to the team.',
    iaSinLlave:
      'AI isn’t connected on this site yet: Camila answers with Docs and what’s approved.',
    tope: 'Daily AI limit (dollars)',
    topeAyuda: (m: string) =>
      `Up to ${m} a day. At the limit, Camila keeps going without AI and alerts you.`,
    regalosDia: 'Starter gifts per day',
    regalosAyuda: (n: number) => `How many starter gifts Camila can give in a day (up to ${n}).`,
    guardar: 'Save settings',
    guardado: 'Settings saved.',
    topeMalo: (m: string) => `The daily limit goes from 0 to ${m}.`,
    regalosMalo: (n: number) => `Gifts per day go from 0 to ${n}.`,
    cargando: 'Loading…',
  },
};
type Textos = (typeof T)['es'];

type Vista = 'bandeja' | 'conversacion' | 'aprendizaje' | 'fallos' | 'preguntas' | 'ajustes';
const VISTAS: Vista[] = [
  'bandeja',
  'conversacion',
  'aprendizaje',
  'fallos',
  'preguntas',
  'ajustes',
];

type Caso = {
  id: string;
  persona_id: string;
  resumen: string;
  motivo: string;
  creado_en: string;
  nombre: string;
  canal_ultimo: string;
  humano_hasta: string | null;
};
type Atendida = {
  id: string;
  nombre: string;
  canal_ultimo: string;
  humano_hasta: string | null;
  ultimo: string | null;
  autor_ultimo: string | null;
};
type Bandeja = {
  casos: Caso[];
  atendiendo: Atendida[];
  hoy: { microdolares: number; llamadas: number; regalos: number; topeMicro: number };
};
type HiloLista = {
  id: string;
  nombre: string;
  correo: string | null;
  canal_ultimo: string;
  mensajes: number;
  humano_hasta: string | null;
  actualizado_en: string;
  usuario_id: string | null;
};
type MensajeEquipo = {
  id: string;
  canal: string;
  autor: string;
  texto: string;
  creado_en: string;
  autor_nombre: string | null;
};
type HiloCompleto = {
  persona: {
    id: string;
    nombre: string;
    correo: string | null;
    canal_ultimo: string;
    usuario_id: string | null;
    equipoAtendiendo: boolean;
  };
  mensajes: MensajeEquipo[];
  casos: { id: string; resumen: string; motivo: string; estado: string; creado_en: string }[];
};
type Propuesta = {
  id: string;
  pregunta_es: string;
  pregunta_en: string;
  respuesta_es: string;
  respuesta_en: string;
  veces: number;
  semana: string;
};
type Ajustes = {
  ia: boolean;
  topeDiarioCentavos: number;
  regalosPorDia: number;
};

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/** Las fechas de la base van en UTC sin zona («2026-11-17 14:05:00»). */
export function fechaCamila(s: string | null | undefined, idioma: Idioma): string {
  if (!s) return '';
  const d = new Date(`${s.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'}`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(idioma === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const dolares = (centavos: number, idioma: Idioma) =>
  new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-VE', {
    style: 'currency',
    currency: 'USD',
  }).format(centavos / 100);

function leerVista(): { vista: Vista; persona: string } {
  const q = new URLSearchParams(window.location.search);
  const v = q.get('view') as Vista | null;
  // «person» guarda la conversación abierta y, en «Fallos reportados», el fallo abierto.
  return { vista: v && VISTAS.includes(v) ? v : 'bandeja', persona: q.get('person') ?? '' };
}

export function SuperCamila({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [{ vista, persona }, setEstado] = useState(leerVista);
  // La pestaña y la conversación abierta viven en la dirección: recargar o compartir el enlace
  // vuelve al mismo lugar.
  const ir = useCallback((v: Vista, p = '') => {
    const q = new URLSearchParams(window.location.search);
    q.set('view', v);
    if (p) q.set('person', p);
    else q.delete('person');
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
    setEstado({ vista: v, persona: p });
  }, []);
  return (
    <div className="super camila" data-testid="super-camila">
      <h2>
        {t.titulo}
        <AyudaAqui guia="camila-support-inbox" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      <div className="fila-botones" role="tablist" aria-label={t.titulo}>
        {VISTAS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            className={vista === v ? 'boton' : 'boton secundario'}
            onClick={() => ir(v, v === 'conversacion' ? persona : '')}
          >
            {new Map(Object.entries(t.pestanas)).get(v)}
          </button>
        ))}
      </div>
      {vista === 'bandeja' ? (
        <BandejaCamila t={t} idioma={idioma} abrir={(p) => ir('conversacion', p)} />
      ) : null}
      {vista === 'conversacion' ? (
        <Conversaciones
          t={t}
          idioma={idioma}
          persona={persona}
          elegir={(p) => ir('conversacion', p)}
        />
      ) : null}
      {vista === 'aprendizaje' ? <Aprendizaje t={t} idioma={idioma} /> : null}
      {/* C-CAMILA-FALLOS: los fallos que reportaron los usuarios y las preguntas de diagnóstico. */}
      {vista === 'fallos' ? (
        <FallosReportados idioma={idioma} fallo={persona} elegir={(f) => ir('fallos', f)} />
      ) : null}
      {vista === 'preguntas' ? <PreguntasDiagnostico idioma={idioma} /> : null}
      {vista === 'ajustes' ? <AjustesCamila t={t} idioma={idioma} /> : null}
    </div>
  );
}

function Mensajes({ error, ok }: { error: string; ok: string }) {
  return (
    <>
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
    </>
  );
}

function BandejaCamila({
  t,
  idioma,
  abrir,
}: {
  t: Textos;
  idioma: Idioma;
  abrir: (persona: string) => void;
}) {
  const [datos, setDatos] = useState<Bandeja | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      pedir<Bandeja>('GET', '/datos/admin/camila/bandeja')
        .then((d) => {
          if (!vivo) return;
          setDatos(d);
          setError('');
        })
        .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    void cargar();
    // La bandeja se refresca sola (lee poco: los casos abiertos y los hilos tomados).
    const reloj = window.setInterval(() => void cargar(), 20_000);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, []);
  if (!datos)
    return error ? <Mensajes error={error} ok="" /> : <p className="pista">{t.cargando}</p>;
  const gasto = datos.hoy.microdolares / 10_000;
  const tope = datos.hoy.topeMicro / 10_000;
  const proporcion = tope > 0 ? Math.min(1, gasto / tope) : 0;
  const pct = `${proporcion * 100}%`;
  const casiTope = proporcion >= 0.9;
  return (
    <div data-testid="camila-bandeja">
      <Mensajes error={error} ok="" />
      <div className="flex-tarjeta" data-testid="camila-gasto">
        <h3>{t.gastoHoy}</h3>
        <div
          className="regalo-barra"
          role="img"
          aria-label={t.deTope(dolares(gasto, idioma), dolares(tope, idioma))}
        >
          {/* Gris mientras va bien; rojo solo cuando está por llegar al tope (rojo = problema). */}
          <i className={casiTope ? 'camila-gasto casi' : 'camila-gasto'} style={{ width: pct }} />
        </div>
        <p>
          <strong>{t.deTope(dolares(gasto, idioma), dolares(tope, idioma))}</strong> ·{' '}
          {t.llamadas(datos.hoy.llamadas)} · {t.regalos(datos.hoy.regalos)}
        </p>
      </div>
      <div className="flex-tarjeta">
        <h3>
          {t.casos} ({datos.casos.length})
        </h3>
        {datos.casos.length === 0 ? (
          <p className="pista">{t.sinCasos}</p>
        ) : (
          <ul className="camila-lista">
            {datos.casos.map((c) => (
              <li key={c.id}>
                <button type="button" className="camila-fila" onClick={() => abrir(c.persona_id)}>
                  <span className="camila-fila-cabeza">
                    <strong>{c.nombre || t.sinCuenta}</strong>
                    <span className="camila-chip">{t.motivo[c.motivo] ?? c.motivo}</span>
                    <small className="pista">
                      {t.canal[c.canal_ultimo] ?? c.canal_ultimo} ·{' '}
                      {fechaCamila(c.creado_en, idioma)}
                    </small>
                  </span>
                  <span className="camila-resumen">{c.resumen}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex-tarjeta">
        <h3>
          {t.atendiendo} ({datos.atendiendo.length})
        </h3>
        {datos.atendiendo.length === 0 ? (
          <p className="pista">{t.sinAtendiendo}</p>
        ) : (
          <ul className="camila-lista">
            {datos.atendiendo.map((a) => (
              <li key={a.id}>
                <button type="button" className="camila-fila" onClick={() => abrir(a.id)}>
                  <span className="camila-fila-cabeza">
                    <strong>{a.nombre || t.sinCuenta}</strong>
                    <small className="pista">
                      {t.canal[a.canal_ultimo] ?? a.canal_ultimo} ·{' '}
                      {t.hasta(fechaCamila(a.humano_hasta, idioma))}
                    </small>
                  </span>
                  {a.ultimo ? (
                    <span className="camila-resumen">
                      {t.autor[a.autor_ultimo ?? ''] ?? ''}: {a.ultimo}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Conversaciones({
  t,
  idioma,
  persona,
  elegir,
}: {
  t: Textos;
  idioma: Idioma;
  persona: string;
  elegir: (p: string) => void;
}) {
  const [q, setQ] = useState('');
  const [hilos, setHilos] = useState<HiloLista[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    const espera = window.setTimeout(() => {
      pedir<{ hilos: HiloLista[] }>(
        'GET',
        `/datos/admin/camila/hilos${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
      )
        .then((d) => vivo && setHilos(d.hilos))
        .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    }, 250);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [q]);
  return (
    <div className="camila-conversaciones" data-testid="camila-conversaciones">
      <aside className="flex-tarjeta camila-hilos">
        <h3>{t.conversaciones}</h3>
        <label className="campo">
          {t.buscar}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Mensajes error={error} ok="" />
        {hilos === null ? (
          <p className="pista">{t.cargando}</p>
        ) : hilos.length === 0 ? (
          <p className="pista">{q.trim() ? t.sinResultados : t.sinConversaciones}</p>
        ) : (
          <ul className="camila-lista">
            {hilos.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={h.id === persona ? 'camila-fila activa' : 'camila-fila'}
                  aria-current={h.id === persona ? 'true' : undefined}
                  onClick={() => elegir(h.id)}
                >
                  <span className="camila-fila-cabeza">
                    <strong>{h.nombre || h.correo || t.sinCuenta}</strong>
                    <small className="pista">
                      {t.canal[h.canal_ultimo] ?? h.canal_ultimo} · {t.mensajes(h.mensajes)} ·{' '}
                      {fechaCamila(h.actualizado_en, idioma)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {persona ? (
        <HiloEquipo key={persona} t={t} idioma={idioma} persona={persona} />
      ) : (
        <p className="pista">{t.elige}</p>
      )}
    </div>
  );
}

function HiloEquipo({ t, idioma, persona }: { t: Textos; idioma: Idioma; persona: string }) {
  const [hilo, setHilo] = useState<HiloCompleto | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Lo escrito no se pierde si se cierra la ventana (regla de los formularios).
  const b = useBorrador({
    formulario: `camila-respuesta-${persona}`,
    cuenta: 'superadmin',
    inicial: { texto: '' },
    almacen: almacenNavegador,
  });
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      pedir<HiloCompleto>('GET', `/datos/admin/camila/hilos/${encodeURIComponent(persona)}`)
        .then((d) => vivo && setHilo(d))
        .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    void cargar();
    const reloj = window.setInterval(() => void cargar(), 15_000);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, [persona, vuelta]);
  const recargar = () => setVuelta((n) => n + 1);
  async function accion(fn: () => Promise<string>) {
    setError('');
    setOk('');
    setEnviando(true);
    try {
      setOk(await fn());
      recargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  if (!hilo)
    return error ? <Mensajes error={error} ok="" /> : <p className="pista">{t.cargando}</p>;
  const p = hilo.persona;
  return (
    <section className="flex-tarjeta camila-hilo" data-testid="camila-hilo">
      <div className="camila-hilo-cabeza">
        <div>
          <h3>{p.nombre || p.correo || t.sinCuenta}</h3>
          <p className="pista">
            {[p.correo, t.canal[p.canal_ultimo] ?? p.canal_ultimo].filter(Boolean).join(' · ')}
          </p>
        </div>
        {p.equipoAtendiendo ? (
          <div className="camila-tomada">
            <span className="camila-chip">{t.tomadaPorEquipo}</span>
            <button
              type="button"
              className="boton secundario"
              disabled={enviando}
              onClick={() =>
                void accion(async () => {
                  await pedir(
                    'POST',
                    `/datos/admin/camila/hilos/${encodeURIComponent(p.id)}/devolver`,
                  );
                  return t.devuelta;
                })
              }
            >
              {t.devolver}
            </button>
          </div>
        ) : null}
      </div>
      <ol className="camila-mensajes" aria-label={t.conversaciones}>
        {hilo.mensajes.map((m) => (
          <li key={m.id} className={`camila-mensaje camila-${m.autor}`}>
            <span className="camila-autor">
              {m.autor === 'equipo' && m.autor_nombre
                ? m.autor_nombre
                : (t.autor[m.autor] ?? m.autor)}
              <small>
                {' '}
                · {t.canal[m.canal] ?? m.canal} · {fechaCamila(m.creado_en, idioma)}
              </small>
            </span>
            <span className="camila-texto">{m.texto}</span>
          </li>
        ))}
      </ol>
      <Mensajes error={error} ok={ok} />
      <form
        className="formulario"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const texto = b.valores.texto.trim();
          if (!texto || enviando) return;
          void accion(async () => {
            const r = await pedir<{ enviado: boolean }>(
              'POST',
              `/datos/admin/camila/hilos/${encodeURIComponent(p.id)}/responder`,
              { texto },
            );
            await b.limpiar();
            return r.enviado ? t.enviado : t.noEnviado;
          });
        }}
      >
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          {t.responder}
          <textarea
            rows={3}
            value={b.valores.texto}
            onChange={(e) => b.cambiar('texto', e.target.value)}
          />
        </label>
        <p className="pista">{t.responderAyuda}</p>
        <button type="submit" className="boton" disabled={enviando || !b.valores.texto.trim()}>
          {t.enviar}
        </button>
      </form>
      {hilo.casos.length ? (
        <div className="camila-casos">
          <h4>{t.casosDe}</h4>
          <ul className="camila-lista">
            {hilo.casos.map((c) => (
              <li key={c.id} className="camila-caso">
                <span>
                  <strong>{t.motivo[c.motivo] ?? c.motivo}</strong> ·{' '}
                  {t.estadoCaso[c.estado] ?? c.estado} · {fechaCamila(c.creado_en, idioma)}
                  <br />
                  {c.resumen}
                </span>
                {c.estado === 'abierto' ? (
                  <button
                    type="button"
                    className="boton exito"
                    disabled={enviando}
                    onClick={() =>
                      void accion(async () => {
                        await pedir(
                          'POST',
                          `/datos/admin/camila/casos/${encodeURIComponent(c.id)}/cerrar`,
                        );
                        return t.cerrado;
                      })
                    }
                  >
                    {t.cerrarCaso}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Aprendizaje({ t, idioma }: { t: Textos; idioma: Idioma }) {
  const [datos, setDatos] = useState<{
    propuestas: Propuesta[];
    aprobadas: Propuesta[];
    sinLista: number;
  } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [armando, setArmando] = useState(false);
  useEffect(() => {
    let vivo = true;
    pedir<{ propuestas: Propuesta[]; aprobadas: Propuesta[]; sinLista: number }>(
      'GET',
      '/datos/admin/camila/aprendizaje',
    )
      .then((d) => vivo && setDatos(d))
      .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  const recargar = (mensaje: string) => {
    setOk(mensaje);
    setVuelta((n) => n + 1);
  };
  if (!datos)
    return error ? <Mensajes error={error} ok="" /> : <p className="pista">{t.cargando}</p>;
  return (
    <div data-testid="camila-aprendizaje">
      <p className="pista">{t.aprendizajeAyuda}</p>
      <div className="fila-botones">
        <button
          type="button"
          className="boton secundario"
          disabled={armando}
          onClick={() => {
            setArmando(true);
            setError('');
            pedir<{ creadas: number }>('POST', '/datos/admin/camila/aprendizaje/armar')
              .then((r) => recargar(t.armada(r.creadas)))
              .catch((x: unknown) => setError(mensajeDe(x)))
              .finally(() => setArmando(false));
          }}
        >
          {t.armar}
        </button>
        {datos.sinLista > 0 ? <span className="pista">{t.sinLista(datos.sinLista)}</span> : null}
      </div>
      <Mensajes error={error} ok={ok} />
      <h3>
        {t.propuestas} ({datos.propuestas.length})
      </h3>
      {datos.propuestas.length === 0 ? (
        <p className="pista">{t.sinPropuestas}</p>
      ) : (
        datos.propuestas.map((p) => (
          <PropuestaCamila
            key={p.id}
            p={p}
            t={t}
            idioma={idioma}
            alDecidir={recargar}
            setError={setError}
          />
        ))
      )}
      <h3>
        {t.aprobadas} ({datos.aprobadas.length})
      </h3>
      {datos.aprobadas.length === 0 ? (
        <p className="pista">{t.sinAprobadas}</p>
      ) : (
        <ul className="camila-lista" data-testid="camila-aprobadas">
          {datos.aprobadas.map((a) => (
            <li key={a.id} className="camila-aprobada">
              <strong>{idioma === 'en' ? a.pregunta_en : a.pregunta_es}</strong>
              <span>{idioma === 'en' ? a.respuesta_en : a.respuesta_es}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PropuestaCamila({
  p,
  t,
  idioma,
  alDecidir,
  setError,
}: {
  p: Propuesta;
  t: Textos;
  idioma: Idioma;
  alDecidir: (mensaje: string) => void;
  setError: (s: string) => void;
}) {
  const b = useBorrador({
    formulario: `camila-propuesta-${p.id}`,
    cuenta: 'superadmin',
    inicial: {
      preguntaEs: p.pregunta_es,
      preguntaEn: p.pregunta_en,
      respuestaEs: p.respuesta_es,
      respuestaEn: p.respuesta_en,
    },
    almacen: almacenNavegador,
  });
  const [enviando, setEnviando] = useState(false);
  const v = b.valores;
  async function decidir(aprobar: boolean) {
    setError('');
    if (
      aprobar &&
      [v.preguntaEs, v.preguntaEn, v.respuestaEs, v.respuestaEn].some((x) => x.trim().length < 3)
    )
      return setError(t.faltaTexto);
    setEnviando(true);
    try {
      await pedir(
        'POST',
        `/datos/admin/camila/aprendizaje/${encodeURIComponent(p.id)}/${aprobar ? 'aprobar' : 'rechazar'}`,
        aprobar ? v : undefined,
      );
      await b.limpiar();
      alDecidir(aprobar ? t.aprobada : t.descartada);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  const casilla = (campo: keyof typeof v, valor: string, etiqueta: string, filas: number) => (
    <label className="campo">
      {etiqueta}
      <textarea rows={filas} value={valor} onChange={(e) => b.cambiar(campo, e.target.value)} />
    </label>
  );
  return (
    <div className="flex-tarjeta camila-propuesta" data-testid={`camila-propuesta-${p.id}`}>
      <p>
        <span className="camila-chip">{t.veces(p.veces)}</span>
        {p.semana ? <small className="pista"> · {p.semana}</small> : null}
      </p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <div className="camila-dos-columnas">
        {casilla('preguntaEs', v.preguntaEs, t.preguntaEs, 2)}
        {casilla('preguntaEn', v.preguntaEn, t.preguntaEn, 2)}
        {casilla('respuestaEs', v.respuestaEs, t.respuestaEs, 4)}
        {casilla('respuestaEn', v.respuestaEn, t.respuestaEn, 4)}
      </div>
      <div className="fila-botones">
        <button
          type="button"
          className="boton exito"
          disabled={enviando}
          onClick={() => void decidir(true)}
        >
          {t.aprobar}
        </button>
        <button
          type="button"
          className="boton secundario"
          disabled={enviando}
          onClick={() => void decidir(false)}
        >
          {t.descartar}
        </button>
      </div>
    </div>
  );
}

function AjustesCamila({ t, idioma }: { t: Textos; idioma: Idioma }) {
  const [datos, setDatos] = useState<{
    ajustes: Ajustes;
    limites: { topeMaximoCentavos: number; regalosPorDiaMaximo: number };
    iaConectada: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    pedir<{
      ajustes: Ajustes;
      limites: { topeMaximoCentavos: number; regalosPorDiaMaximo: number };
      iaConectada: boolean;
    }>('GET', '/datos/admin/camila/ajustes')
      .then((d) => vivo && setDatos(d))
      .catch((x: unknown) => vivo && setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, []);
  if (!datos)
    return error ? <Mensajes error={error} ok="" /> : <p className="pista">{t.cargando}</p>;
  return (
    <FormAjustes
      t={t}
      idioma={idioma}
      ajustes={datos.ajustes}
      limites={datos.limites}
      iaConectada={datos.iaConectada}
    />
  );
}

function FormAjustes({
  t,
  idioma,
  ajustes,
  limites,
  iaConectada,
}: {
  t: Textos;
  idioma: Idioma;
  ajustes: Ajustes;
  limites: { topeMaximoCentavos: number; regalosPorDiaMaximo: number };
  iaConectada: boolean;
}) {
  const b = useBorrador({
    formulario: 'camila-ajustes',
    cuenta: 'superadmin',
    inicial: {
      ia: ajustes.ia,
      tope: String(ajustes.topeDiarioCentavos / 100),
      regalos: String(ajustes.regalosPorDia),
    },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const v = b.valores;
  const maximo = dolares(limites.topeMaximoCentavos, idioma);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const tope = Math.round(Number(String(v.tope).replace(',', '.')) * 100);
    const regalos = Number(v.regalos);
    if (!Number.isFinite(tope) || tope < 0 || tope > limites.topeMaximoCentavos)
      return setError(t.topeMalo(maximo));
    if (!Number.isInteger(regalos) || regalos < 0 || regalos > limites.regalosPorDiaMaximo)
      return setError(t.regalosMalo(limites.regalosPorDiaMaximo));
    setEnviando(true);
    try {
      await pedir('PUT', '/datos/admin/camila/ajustes', {
        ia: v.ia,
        topeDiarioCentavos: tope,
        regalosPorDia: regalos,
      });
      await b.limpiar();
      setOk(t.guardado);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form
      className="flex-tarjeta formulario"
      noValidate
      onSubmit={(e) => void guardar(e)}
      data-testid="camila-ajustes"
    >
      <p className="pista">{t.ajustesAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label className="casilla-fila">
        <input type="checkbox" checked={v.ia} onChange={(e) => b.cambiar('ia', e.target.checked)} />
        {t.ia}
      </label>
      <p className="pista">{iaConectada ? t.iaAyuda : t.iaSinLlave}</p>
      <label className="campo">
        {t.tope}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={limites.topeMaximoCentavos / 100}
          step="0.01"
          value={v.tope}
          onChange={(e) => b.cambiar('tope', e.target.value)}
        />
      </label>
      <p className="pista">{t.topeAyuda(maximo)}</p>
      <label className="campo">
        {t.regalosDia}
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max={limites.regalosPorDiaMaximo}
          step="1"
          value={v.regalos}
          onChange={(e) => b.cambiar('regalos', e.target.value)}
        />
      </label>
      <p className="pista">{t.regalosAyuda(limites.regalosPorDiaMaximo)}</p>
      <Mensajes error={error} ok={ok} />
      <button type="submit" className="boton" disabled={enviando}>
        {t.guardar}
      </button>
    </form>
  );
}
