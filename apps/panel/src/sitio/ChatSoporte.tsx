import { useCallback, useEffect, useRef, useState } from 'react';
import {
  faltaPermisoIaChat,
  textosPermisoIaChat,
  ErrorApi,
  type HiloCamila,
  type Idioma,
  type MensajeCamila,
  type RespuestaCamila,
  TEXTOS_CHAT_SOPORTE,
  almacenNavegador,
  enIdioma,
  enIdiomaDireccion,
  esMarcaDeCaptura,
  nombreAutorCamila,
  trozosDeMensaje,
  cronometroDeEscritura,
  problemaDeCaptura,
  useBorrador,
  visitaCamila,
} from '@tumbite/compartido';
import { api, pedir } from '../panel/api';
import { BotonCamara } from '../panel/camara';
import { Icono } from './Icono';

/**
 * C-CAMILA-CHAT (17 nov 2026) — todos los países. La burbuja «Habla con nuestro equipo de soporte»
 * de las páginas públicas (reemplaza al viejo «¿Preguntas?»). Abre el chat con Camila Campos, del
 * equipo de soporte: una sola conversación por persona, la misma que sigue por la app y por correo.
 *
 * - Sin cuenta, el navegador lleva su ficha anónima (cabecera x-camila-visita). Mirar no escribe: el
 *   hilo solo se pide si este navegador ya conversó (o si hay sesión y la persona abre el chat).
 * - Lo escrito se guarda solo y vuelve al recargar; se borra al enviarse bien. Si falla, se queda.
 * - Si una persona del equipo tomó la conversación, Camila no contesta y se dice en pantalla.
 * - Sin cuenta, se ofrece discreto unir el chat al correo con un código de seis números.
 * - C-CAMILA-REPORTE-CONVERSADO (19 nov 2026): «Adjuntar captura» abre «Subir desde archivos» y
 *   «Tomar foto» (la pieza única de la cámara). La captura NO se envía sola: queda en el borrador del
 *   mensaje, como una miniatura con su equis, y viaja con lo que la persona escriba al tocar Enviar.
 *   Si se cierra el chat, la captura del borrador vuelve al abrirlo (la guarda el servidor).
 */
const LLAVE_CONVERSO = 'divoox.camila.converso';

function guardarConverso() {
  try {
    localStorage.setItem(LLAVE_CONVERSO, '1');
  } catch {
    /* sin almacenamiento: se vuelve a pedir el hilo solo en esta visita */
  }
}
function yaConverso(): boolean {
  try {
    return localStorage.getItem(LLAVE_CONVERSO) === '1';
  } catch {
    return false;
  }
}
function almacenLocal() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const ESPERA_RECARGA_MS = 8_000;

export function ChatSoporte({ idioma, conSesion }: { idioma: Idioma; conSesion?: boolean }) {
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  const [abierto, setAbierto] = useState(false);
  const [visita] = useState(() => visitaCamila(almacenLocal()));
  const [hilo, setHilo] = useState<HiloCamila | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // El mensaje ya llegó y corre la espera de «Camila está escribiendo»: el botón dice «Un momento…».
  const [respondiendo, setRespondiendo] = useState(false);
  // La persona abrió el bloque para elegir la captura con el botón fijo del chat.
  const [adjuntar, setAdjuntar] = useState(false);
  // La captura del borrador: su id en el servidor y, si se acaba de elegir, su imagen local.
  const [adjunto, setAdjunto] = useState<{ id: string; local?: string } | null>(null);
  // Las que la persona quitó con la equis: aunque el servidor todavía las nombre, no vuelven.
  const quitadas = useRef(new Set<string>());
  // La imagen local de cada captura elegida aquí: el hilo la muestra sin volver a bajarla.
  const [locales, setLocales] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [pendiente, setPendiente] = useState<MensajeCamila | null>(null);
  const [error, setError] = useState('');
  const [unir, setUnir] = useState(false);
  const [unido, setUnido] = useState(false);
  const [conCuenta, setConCuenta] = useState(Boolean(conSesion));
  const lista = useRef<HTMLOListElement>(null);
  const casilla = useRef<HTMLTextAreaElement>(null);
  const b = useBorrador({
    formulario: 'chat-soporte',
    cuenta: visita.slice(0, 12),
    inicial: { texto: '' },
    almacen: almacenNavegador,
  });
  const cabeceras = { 'x-camila-visita': visita };
  // C-PERMISO-IA-CHAT: el permiso se pide antes del primer mensaje. Con el hilo leído, lo dice el
  // servidor; un visitante nuevo (sin hilo que leer) todavía no ha contestado nada.
  const pidePermiso = hilo
    ? faltaPermisoIaChat(hilo)
    : abierto && !cargando && !(conSesion || yaConverso());

  const cargar = useCallback(
    async (callado = false) => {
      if (!callado) setCargando(true);
      try {
        const h = await pedir<HiloCamila>('GET', '/datos/camila/hilo', undefined, {
          cabeceras: { 'x-camila-visita': visita },
        });
        setHilo(h);
        // La captura que quedó en el borrador vuelve con el hilo (si no se quitó aquí).
        const pendienteDelHilo = h.adjuntoPendiente;
        if (pendienteDelHilo && !quitadas.current.has(pendienteDelHilo))
          setAdjunto((a) => (a?.id === pendienteDelHilo ? a : { id: pendienteDelHilo }));
        setError('');
      } catch (x) {
        if (!callado) setError(x instanceof ErrorApi ? x.message : t.sinRed);
      } finally {
        if (!callado) setCargando(false);
      }
    },
    [visita, t.sinRed],
  );

  // Al abrir: el hilo, si este navegador ya conversó o si hay una cuenta (mirar no escribe).
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    // El hilo se pide fuera del efecto (después de pintar), nunca dentro de él.
    const pedirHilo = () => void cargar();
    let primero: number | undefined;
    if (conSesion || yaConverso()) primero = window.setTimeout(pedirHilo, 0);
    else
      // Con una cuenta abierta en este navegador, su conversación de siempre (la de la app y el
      // correo) aparece aquí; sin cuenta, nada se pide hasta que escriba.
      void api
        .yo()
        .then((r) => {
          if (vivo && r.usuario) {
            setConCuenta(true);
            void cargar();
          }
        })
        .catch(() => undefined);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', tecla);
    const foco = window.setTimeout(() => casilla.current?.focus(), 50);
    return () => {
      vivo = false;
      window.clearTimeout(primero);
      window.removeEventListener('keydown', tecla);
      window.clearTimeout(foco);
    };
  }, [abierto, conSesion, cargar]);

  // Mientras está abierto y ya hay conversación, se mira si respondió alguien del equipo.
  useEffect(() => {
    if (!abierto || !hilo?.mensajes.length) return;
    const reloj = window.setInterval(() => {
      if (document.visibilityState === 'visible') void cargar(true);
    }, ESPERA_RECARGA_MS);
    return () => window.clearInterval(reloj);
  }, [abierto, hilo?.mensajes.length, cargar]);

  const cuantos = (hilo?.mensajes.length ?? 0) + (pendiente ? 1 : 0);
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cuantos, abierto, enviando]);

  /** Manda lo escrito y la captura del borrador, juntos. */
  async function enviar() {
    const texto = b.valores.texto.trim();
    const conAdjunto = adjunto;
    if ((!texto && !conAdjunto) || enviando) return;
    setError('');
    setEnviando(true);
    setPendiente({
      id: 'pendiente',
      autor: 'persona',
      texto,
      creado_en: new Date().toISOString(),
      adjunto: conAdjunto?.id ?? null,
    });
    const esperar = cronometroDeEscritura();
    try {
      const r = await pedir<RespuestaCamila>(
        'POST',
        '/datos/camila/mensaje',
        { texto, canal: 'web', ...(conAdjunto ? { adjunto: conAdjunto.id } : {}) },
        { cabeceras },
      );
      guardarConverso();
      // El mensaje ya llegó: la casilla y la captura se vacían AHORA, antes de la espera. Lo que la
      // persona escriba mientras Camila «escribe» es su siguiente mensaje y no se borra.
      await b.limpiar();
      if (conAdjunto) quitadas.current.add(conAdjunto.id);
      setAdjunto(null);
      setRespondiendo(true);
      // C-CAMILA-TONO: «Camila está escribiendo…» de 2 a 4 segundos según el largo de la respuesta.
      await esperar(r.respuesta);
      setHilo((h) => ({
        adjuntoPendiente: r.adjuntoPendiente,
        verificada: r.verificada,
        equipoAtendiendo: r.equipoAtendiendo,
        // C-PERMISO-IA-CHAT: lo que la persona contestó no se pierde al refrescar el hilo.
        permisoIa: r.permisoIa ?? h?.permisoIa ?? null,
        mensajes: r.mensajes,
      }));
    } catch (x) {
      // Lo escrito y la captura se quedan en el borrador para reintentar (regla de los formularios).
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setPendiente(null);
      setEnviando(false);
      setRespondiendo(false);
    }
  }

  /** La equis de la miniatura: la captura sale del borrador (aquí y en el servidor). */
  async function quitarAdjunto() {
    const a = adjunto;
    if (!a) return;
    quitadas.current.add(a.id);
    setAdjunto(null);
    await pedir('DELETE', `/datos/camila/adjunto/${a.id}`, undefined, { cabeceras }).catch(
      () => undefined,
    );
  }

  /** C-CAMILA-REPORTAR: reportar una respuesta de Camila sin salir del chat. */
  async function reportar(id: string) {
    try {
      await pedir('POST', `/datos/camila/mensajes/${id}/reportar`, {}, { cabeceras });
      setHilo((h) =>
        h
          ? { ...h, mensajes: h.mensajes.map((m) => (m.id === id ? { ...m, reportado: true } : m)) }
          : h,
      );
    } catch (x) {
      setError(x instanceof Error ? x.message : t.sinRed);
    }
  }

  const mensajes = [...(hilo?.mensajes ?? []), ...(pendiente ? [pendiente] : [])];
  return (
    <>
      {abierto ? null : (
        <button
          type="button"
          className="chat-soporte-burbuja"
          onClick={() => setAbierto(true)}
          aria-haspopup="dialog"
          aria-label={t.burbuja}
          data-testid="chat-soporte-burbuja"
        >
          <Icono nombre="soporte" tamano={22} />
          <span className="chat-soporte-burbuja-texto">{t.burbuja}</span>
        </button>
      )}
      {abierto ? (
        <section
          className="chat-soporte"
          role="dialog"
          aria-label={t.titulo}
          data-testid="chat-soporte"
        >
          <header className="chat-soporte-cabeza">
            <div>
              <h2>{t.titulo}</h2>
              <p>{t.camila}</p>
            </div>
            <button type="button" className="enlace-boton" onClick={() => setAbierto(false)}>
              {t.cerrar}
            </button>
          </header>
          <ol
            className="chat-soporte-mensajes"
            ref={lista}
            aria-live="polite"
            aria-label={t.titulo}
          >
            {/* Un solo saludo, corto, y solo si la conversación está vacía (el encabezado ya dice quién es). */}
            {mensajes.length === 0 && !cargando ? (
              <li className="chat-soporte-mensaje de-camila">
                <span className="chat-soporte-autor">{t.camilaCorto}</span>
                <span className="chat-soporte-texto">{t.saludo}</span>
              </li>
            ) : null}
            {mensajes.map((m) => (
              <li
                key={m.id}
                className={`chat-soporte-mensaje ${m.autor === 'persona' ? 'mio' : m.autor === 'equipo' ? 'de-equipo' : 'de-camila'}`}
                data-testid={`chat-mensaje-${m.autor}`}
              >
                <span className="chat-soporte-autor">{nombreAutorCamila(m.autor, idioma)}</span>
                {m.adjunto ? (
                  <Miniatura
                    id={m.adjunto}
                    local={locales.get(m.adjunto)}
                    cabeceras={cabeceras}
                    alt={t.capturaAlt}
                  />
                ) : null}
                {(m.adjunto && esMarcaDeCaptura(m.texto) ? [] : trozosDeMensaje(m.texto)).map(
                  (trozo, i) =>
                    'url' in trozo ? (
                      <a
                        key={i}
                        className="chat-soporte-guia"
                        href={trozo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="chat-enlace-guia"
                      >
                        {trozo.etiqueta}
                      </a>
                    ) : (
                      <span key={i} className="chat-soporte-texto">
                        {trozo.texto}
                      </span>
                    ),
                )}
                {m.autor === 'camila' ? (
                  m.reportado ? (
                    <span className="chat-soporte-reportada" role="status">
                      {t.reportada}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="chat-soporte-reportar"
                      onClick={() => void reportar(m.id)}
                    >
                      {t.reportar}
                    </button>
                  )
                ) : null}
              </li>
            ))}
            {enviando && !hilo?.equipoAtendiendo ? (
              <li className="chat-soporte-escribiendo" role="status" data-testid="chat-escribiendo">
                {t.escribiendo}
                <span className="chat-soporte-puntos" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </li>
            ) : null}
            {cargando ? (
              <li className="chat-soporte-escribiendo" role="status">
                {t.cargando}
              </li>
            ) : null}
          </ol>
          {pidePermiso ? (
            // C-PERMISO-IA-CHAT: antes del primer mensaje, una sola vez, el permiso explícito.
            <PermisoIaChat
              idioma={idioma}
              cabeceras={cabeceras}
              alResponder={(permisoIa) => {
                // La ficha del navegador ya existe en el servidor: la próxima vez se lee su hilo.
                guardarConverso();
                setHilo((h) =>
                  h
                    ? { ...h, permisoIa }
                    : { verificada: false, equipoAtendiendo: false, mensajes: [], permisoIa },
                );
              }}
            />
          ) : (
            <>
              {adjuntar ? (
                <BloqueCaptura
                  idioma={idioma}
                  cabeceras={cabeceras}
                  ocupado={enviando}
                  alSubir={(id, local) => {
                    setAdjuntar(false);
                    guardarConverso();
                    setLocales((m) => new Map(m).set(id, local));
                    setAdjunto({ id, local });
                    casilla.current?.focus();
                  }}
                  alCerrar={() => setAdjuntar(false)}
                />
              ) : adjunto ? (
                <div className="chat-soporte-borrador-captura" data-testid="chat-captura-lista">
                  <Miniatura
                    id={adjunto.id}
                    local={adjunto.local}
                    cabeceras={cabeceras}
                    alt={t.capturaAlt}
                  />
                  <span>{t.capturaLista}</span>
                  <button
                    type="button"
                    className="chat-soporte-quitar"
                    aria-label={t.quitarCaptura}
                    title={t.quitarCaptura}
                    disabled={enviando}
                    onClick={() => void quitarAdjunto()}
                    data-testid="chat-captura-quitar"
                  >
                    ×
                  </button>
                </div>
              ) : hilo?.equipoAtendiendo ? null : (
                <button
                  type="button"
                  className="enlace chat-soporte-adjuntar"
                  data-testid="chat-adjuntar"
                  onClick={() => setAdjuntar(true)}
                >
                  <Icono nombre="foto" tamano={16} /> {t.adjuntar}
                </button>
              )}
              {hilo?.equipoAtendiendo ? (
                <p className="chat-soporte-aviso" role="status" data-testid="chat-equipo-atiende">
                  {t.equipoAtiende}
                </p>
              ) : null}
              {error ? (
                <p className="chat-soporte-error" role="alert">
                  {error}
                </p>
              ) : null}
              {b.recuperado ? (
                <p className="aviso-borrador chat-soporte-borrador">
                  {idioma === 'en'
                    ? 'We restored what you were typing.'
                    : 'Recuperamos lo que estabas escribiendo.'}{' '}
                  <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
                    {idioma === 'en' ? 'Start over' : 'Empezar de nuevo'}
                  </button>
                </p>
              ) : null}
              <form
                className="chat-soporte-casilla"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar();
                }}
              >
                <textarea
                  ref={casilla}
                  rows={2}
                  value={b.valores.texto}
                  placeholder={adjunto ? t.escribeConCaptura : t.escribe}
                  aria-label={t.escribe}
                  maxLength={2000}
                  onChange={(e) => b.cambiar('texto', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void enviar();
                    }
                  }}
                />
                <button
                  type="submit"
                  className="boton"
                  disabled={enviando || (!b.valores.texto.trim() && !adjunto)}
                >
                  {respondiendo ? t.unMomento : enviando ? t.enviando : t.enviar}
                </button>
              </form>
            </>
          )}
          {hilo?.verificada || conCuenta ? (
            unido ? (
              <p className="chat-soporte-aviso exito chat-soporte-unir" role="status">
                {t.unido}
              </p>
            ) : null
          ) : unir ? (
            <UnirCorreo
              idioma={idioma}
              cabeceras={cabeceras}
              visita={visita}
              alUnir={(h) => {
                guardarConverso();
                setUnido(true);
                setHilo(h);
              }}
              alCerrar={() => setUnir(false)}
            />
          ) : (
            <button
              type="button"
              className="enlace chat-soporte-unir"
              onClick={() => setUnir(true)}
              data-testid="chat-unir"
            >
              {t.unir}
            </button>
          )}
          <p className="chat-soporte-pie">
            {t.prefieresCorreo} <a href={enIdiomaDireccion('/contact', idioma)}>{t.formulario}</a>
          </p>
          {hilo?.permisoIa != null ? (
            // C-PERMISO-IA-CHAT: el permiso se puede dar o retirar cuando se quiera, aquí mismo.
            <AjusteIaChat
              idioma={idioma}
              cabeceras={cabeceras}
              permiso={hilo.permisoIa}
              alCambiar={(permisoIa) => setHilo((h) => (h ? { ...h, permisoIa } : h))}
            />
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function UnirCorreo({
  idioma,
  cabeceras,
  visita,
  alUnir,
  alCerrar,
}: {
  idioma: Idioma;
  cabeceras: Record<string, string>;
  visita: string;
  alUnir: (h: HiloCamila) => void;
  alCerrar: () => void;
}) {
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  // El correo se guarda como borrador; el código de un solo uso no (es sensible).
  const b = useBorrador({
    formulario: 'chat-soporte-unir',
    cuenta: visita.slice(0, 12),
    inicial: { correo: '', codigo: '' },
    almacen: almacenNavegador,
    sensibles: ['codigo'],
  });
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function paso(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      if (!enviado) {
        await pedir(
          'POST',
          '/datos/camila/verificar',
          { correo: b.valores.correo.trim() },
          { cabeceras },
        );
        setEnviado(true);
      } else {
        const h = await pedir<HiloCamila>(
          'POST',
          '/datos/camila/verificar/confirmar',
          { codigo: b.valores.codigo.trim() },
          { cabeceras },
        );
        await b.limpiar();
        alUnir(h);
      }
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form className="chat-soporte-unir-form" noValidate onSubmit={(e) => void paso(e)}>
      <p className="pista">{enviado ? t.codigoEnviado(b.valores.correo.trim()) : t.unirAyuda}</p>
      {enviado ? (
        <label className="campo">
          {t.codigo}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={b.valores.codigo}
            onChange={(e) => b.cambiar('codigo', e.target.value.replace(/\D/g, ''))}
          />
        </label>
      ) : (
        <label className="campo">
          {t.correo}
          <input
            type="email"
            autoComplete="email"
            value={b.valores.correo}
            onChange={(e) => b.cambiar('correo', e.target.value)}
          />
        </label>
      )}
      {error ? (
        <p className="chat-soporte-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="chat-soporte-unir-botones">
        <button type="submit" className="boton secundario" disabled={enviando}>
          {enviado ? t.confirmar : t.mandarCodigo}
        </button>
        <button
          type="button"
          className="enlace"
          onClick={() => {
            if (enviado) setEnviado(false);
            else alCerrar();
          }}
        >
          {enviado ? t.otroCorreo : t.ahoraNo}
        </button>
      </div>
    </form>
  );
}

/** La captura, pedida con la ficha de la persona (nunca una dirección pública). */
function Miniatura({
  id,
  local,
  cabeceras,
  alt,
}: {
  id: string;
  /** La imagen recién elegida, para no volver a bajarla. */
  local?: string;
  cabeceras: Record<string, string>;
  alt: string;
}) {
  const [bajada, setBajada] = useState('');
  const visita = cabeceras['x-camila-visita'] ?? '';
  useEffect(() => {
    if (local) return;
    let vivo = true;
    api
      .verFoto(`/datos/camila/adjunto/${encodeURIComponent(id)}`, { 'x-camila-visita': visita })
      .then((u) => vivo && setBajada(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [id, local, visita]);
  const src = local ?? bajada;
  return src ? (
    <img className="chat-soporte-miniatura" src={src} alt={alt} data-testid="chat-miniatura" />
  ) : (
    <span className="chat-soporte-miniatura vacia" role="img" aria-label={alt} />
  );
}

/**
 * C-CAMILA-REPORTE-CONVERSADO: elegir la captura. Dos botones a la vista (regla de la cámara: «Subir
 * desde archivos» y «Tomar foto») y el aviso de tapar contraseñas y tarjetas. La imagen se sube y
 * queda en el BORRADOR del mensaje: no se envía sola. Si falla, se dice por qué y se reintenta.
 */
function BloqueCaptura({
  idioma,
  cabeceras,
  ocupado,
  alSubir,
  alCerrar,
}: {
  idioma: Idioma;
  cabeceras: Record<string, string>;
  ocupado: boolean;
  /** La captura ya está guardada: su id y su imagen local para la miniatura. */
  alSubir: (id: string, local: string) => void;
  alCerrar: () => void;
}) {
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [fallida, setFallida] = useState<File | null>(null);
  async function subir(archivo: File) {
    setError('');
    const problema = problemaDeCaptura(archivo, idioma);
    if (problema) return setError(problema);
    setSubiendo(true);
    try {
      const r = await api.subirFoto(archivo, '/datos/camila/adjunto', cabeceras);
      if (!r.adjunto) throw new ErrorApi(t.sinRed, 0);
      setFallida(null);
      alSubir(r.adjunto, URL.createObjectURL(archivo));
    } catch (x) {
      setFallida(archivo);
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setSubiendo(false);
    }
  }
  const quieto = subiendo || ocupado;
  return (
    <div className="chat-soporte-captura" data-testid="chat-captura">
      <strong>{t.capturaTitulo}</strong>
      <p className="chat-soporte-captura-aviso">{t.capturaAviso}</p>
      <div className="chat-soporte-captura-botones">
        <button
          type="button"
          className="boton secundario"
          disabled={quieto}
          onClick={() => entrada.current?.click()}
        >
          {t.subirArchivos}
        </button>
        {/* C-CAMARA-EN-TODA-SUBIDA: la misma captura, tomada con la cámara. */}
        <BotonCamara
          idioma={idioma}
          alTomar={(archivo) => void subir(archivo)}
          alFallar={setError}
          deshabilitado={quieto}
        />
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="oculto"
        aria-label={t.subirArchivos}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) void subir(archivo);
        }}
      />
      {subiendo ? (
        <p className="chat-soporte-captura-estado" role="status">
          {t.subiendo}
        </p>
      ) : null}
      {error ? (
        <p className="chat-soporte-error chat-soporte-captura-error" role="alert">
          {error}{' '}
          {fallida ? (
            <button type="button" className="enlace" onClick={() => void subir(fallida)}>
              {t.reintentarCaptura}
            </button>
          ) : null}
        </p>
      ) : null}
      <button
        type="button"
        className="enlace chat-soporte-captura-no"
        disabled={quieto}
        onClick={alCerrar}
      >
        {t.cancelarCaptura}
      </button>
      <small className="pista">{t.capturaPrivada}</small>
    </div>
  );
}

/**
 * C-PERMISO-IA-CHAT (21 nov 2026, Apple 5.1.2(i)): el aviso con permiso explícito, en lugar de la
 * casilla de escribir, hasta que la persona conteste. El servidor es quien lo hace cumplir.
 */
function PermisoIaChat({
  idioma,
  cabeceras,
  alResponder,
}: {
  idioma: Idioma;
  cabeceras: Record<string, string>;
  alResponder: (permisoIa: boolean) => void;
}) {
  const t = textosPermisoIaChat(idioma);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const responder = async (acepto: boolean) => {
    setOcupado(true);
    setError('');
    try {
      const r = await pedir<{ permisoIa: boolean }>(
        'POST',
        '/datos/camila/permiso-ia',
        { acepto },
        { cabeceras },
      );
      alResponder(r.permisoIa);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.error);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="chat-soporte-permiso" data-testid="chat-permiso-ia">
      <div className="chat-soporte-permiso-caja">
        <strong>{t.titulo}</strong>
        <p>{t.texto}</p>
        <p className="chat-soporte-permiso-nota">{t.nota}</p>
      </div>
      <button
        type="button"
        className="boton"
        disabled={ocupado}
        data-testid="chat-permiso-ia-si"
        onClick={() => void responder(true)}
      >
        {t.si}
      </button>
      <button
        type="button"
        className="boton secundario"
        disabled={ocupado}
        data-testid="chat-permiso-ia-no"
        onClick={() => void responder(false)}
      >
        {t.no}
      </button>
      {error ? (
        <p className="chat-soporte-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** C-PERMISO-IA-CHAT: el ajuste del permiso, al pie del chat (la web no tiene otra pantalla de ajustes). */
function AjusteIaChat({
  idioma,
  cabeceras,
  permiso,
  alCambiar,
}: {
  idioma: Idioma;
  cabeceras: Record<string, string>;
  permiso: boolean;
  alCambiar: (permisoIa: boolean) => void;
}) {
  const t = textosPermisoIaChat(idioma);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const cambiar = async () => {
    setOcupado(true);
    setError('');
    try {
      const r = await pedir<{ permisoIa: boolean }>(
        'POST',
        '/datos/camila/permiso-ia',
        { acepto: !permiso },
        { cabeceras },
      );
      alCambiar(r.permisoIa);
      setAbierto(false);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.error);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="chat-soporte-ajuste-ia" data-testid="chat-ajuste-ia">
      <button
        type="button"
        className="enlace"
        aria-expanded={abierto}
        data-testid="chat-ajuste-ia-abrir"
        onClick={() => setAbierto((x) => !x)}
      >
        {t.ajuste}: {permiso ? t.permitido : t.noPermitido}
      </button>
      {abierto ? (
        <div className="chat-soporte-permiso-caja">
          <p className="chat-soporte-permiso-nota">{t.ajusteAyuda}</p>
          <button
            type="button"
            className="boton secundario"
            disabled={ocupado}
            data-testid="chat-ajuste-ia-cambiar"
            onClick={() => void cambiar()}
          >
            {permiso ? t.retirar : t.permitir}
          </button>
          {error ? (
            <p className="chat-soporte-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
