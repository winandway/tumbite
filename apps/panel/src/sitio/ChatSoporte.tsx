import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ErrorApi,
  type HiloCamila,
  type Idioma,
  type MensajeCamila,
  type RespuestaCamila,
  TEXTOS_CHAT_SOPORTE,
  almacenNavegador,
  enIdioma,
  enIdiomaDireccion,
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
 * - C-CAMILA-FALLOS: cuando Camila pide la captura de un reporte de fallo, aparece su bloque con
 *   «Subir desde archivos», «Tomar foto» (la pieza única de la cámara) y «No tengo captura».
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
  // C-CAMILA-ADJUNTAR: la persona abrió el bloque de la captura con el botón fijo del chat.
  const [adjuntar, setAdjuntar] = useState(false);
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

  const cargar = useCallback(
    async (callado = false) => {
      if (!callado) setCargando(true);
      try {
        const h = await pedir<HiloCamila>('GET', '/datos/camila/hilo', undefined, {
          cabeceras: { 'x-camila-visita': visita },
        });
        setHilo(h);
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

  /** Manda lo escrito, o un texto fijo (por ejemplo «sin captura») sin tocar lo escrito. */
  async function enviar(fijo?: string) {
    const texto = (fijo ?? b.valores.texto).trim();
    if (!texto || enviando) return;
    setError('');
    setEnviando(true);
    setPendiente({
      id: 'pendiente',
      autor: 'persona',
      texto,
      creado_en: new Date().toISOString(),
    });
    const esperar = cronometroDeEscritura();
    try {
      const r = await pedir<RespuestaCamila>(
        'POST',
        '/datos/camila/mensaje',
        { texto, canal: 'web' },
        { cabeceras },
      );
      guardarConverso();
      // El mensaje ya llegó: la casilla se vacía AHORA, antes de la espera. Lo que la persona escriba
      // mientras Camila «escribe» es su siguiente mensaje y no se borra.
      if (fijo === undefined) await b.limpiar();
      // C-CAMILA-TONO: «Camila está escribiendo…» de 2 a 4 segundos según el largo de la respuesta.
      await esperar(r.respuesta);
      setHilo({
        pideCaptura: r.pideCaptura,
        capturaPuesta: r.capturaPuesta,
        verificada: r.verificada,
        equipoAtendiendo: r.equipoAtendiendo,
        mensajes: r.mensajes,
      });
    } catch (x) {
      // Lo escrito se queda en la casilla para reintentar (regla de los formularios).
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setPendiente(null);
      setEnviando(false);
    }
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
                {trozosDeMensaje(m.texto).map((trozo, i) =>
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
          {hilo?.pideCaptura || adjuntar ? (
            <BloqueCaptura
              idioma={idioma}
              cabeceras={cabeceras}
              ocupado={enviando}
              voluntaria={!hilo?.pideCaptura}
              alSubir={async () => {
                setAdjuntar(false);
                guardarConverso();
                await cargar(true);
              }}
              alNoTener={() =>
                hilo?.pideCaptura ? void enviar(t.mensajeSinCaptura) : setAdjuntar(false)
              }
            />
          ) : hilo?.equipoAtendiendo || hilo?.capturaPuesta ? null : (
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
              placeholder={t.escribe}
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
            <button type="submit" className="boton" disabled={enviando || !b.valores.texto.trim()}>
              {enviando ? t.enviando : t.enviar}
            </button>
          </form>
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

/**
 * C-CAMILA-FALLOS: el bloque de la captura de un reporte de fallo. Dos botones a la vista (regla de la
 * cámara: «Subir desde archivos» y «Tomar foto»), el aviso de tapar contraseñas y tarjetas, y «No
 * tengo captura». Mientras sube, se ve; si falla, se dice por qué y se puede volver a intentar.
 */
function BloqueCaptura({
  idioma,
  cabeceras,
  ocupado,
  voluntaria = false,
  alSubir,
  alNoTener,
}: {
  idioma: Idioma;
  cabeceras: Record<string, string>;
  ocupado: boolean;
  /** La persona la abrió con «Adjuntar captura» (Camila no la pidió): el botón de abajo solo cierra. */
  voluntaria?: boolean;
  alSubir: () => Promise<void>;
  alNoTener: () => void;
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
      await api.subirFoto(archivo, '/datos/camila/fallos/captura', cabeceras);
      setFallida(null);
      await alSubir();
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
        onClick={alNoTener}
      >
        {voluntaria ? t.cancelarCaptura : t.sinCaptura}
      </button>
      <small className="pista">{t.capturaPrivada}</small>
    </div>
  );
}
