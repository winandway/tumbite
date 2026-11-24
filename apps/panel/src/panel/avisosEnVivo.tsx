import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BellOff, BellRing, Smartphone } from 'lucide-react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { activarAvisosWeb } from '@tumbite/compartido/src/avisosWeb';
import { api, pedir } from './api';
import { SesionArmazon } from './armazon/Armazon';
import {
  type DetalleCambio,
  EVENTO_CAMBIO,
  type Entorno,
  crearSonador,
  entornoNavegador,
} from './sonarEvento';
import { usePreferencias } from './usePreferencias';
import { AyudaAqui } from './AyudaAqui';

/**
 * C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard): «que suene cuando llegue una persona completa
 * para hacer ya el KYC, y que yo no tenga que estar actualizando». Todos los países.
 *
 * Con el superadmin abierto, una marca barata (`GET /datos/admin/kyc/marca`) se pide cada 5 s con la
 * pestaña a la vista y alguien trabajando; cada 30 s si nadie toca nada; cada 60 s con la pestaña en
 * segundo plano. Solo si la marca cambió, la bandeja, la campana y los números del menú se vuelven a
 * leer. La PRIMERA marca es la base: lo que ya estaba no suena (recargar no vuelve a sonar).
 */
export type Marca = { firma: string; pendientes: number; ultimaEnviada: string | null };

export const SONDEO_ACTIVO_MS = 5_000;
export const SONDEO_QUIETO_MS = 30_000;
export const SONDEO_OCULTO_MS = 60_000;
/** Sin tocar nada este tiempo, se pregunta menos. */
export const QUIETO_TRAS_MS = 10 * 60_000;

export function intervaloSondeo(oculta: boolean, inactivoMs: number) {
  if (oculta) return SONDEO_OCULTO_MS;
  return inactivoMs > QUIETO_TRAS_MS ? SONDEO_QUIETO_MS : SONDEO_ACTIVO_MS;
}

/** ¿Cambió algo? ¿Entró una verificación NUEVA (la más nueva es más reciente que la de antes)? */
export function compararMarca(previa: Marca | null, actual: Marca) {
  if (!previa) return { cambio: false, nueva: null as string | null };
  const nueva =
    actual.ultimaEnviada && (!previa.ultimaEnviada || actual.ultimaEnviada > previa.ultimaEnviada)
      ? actual.ultimaEnviada
      : null;
  return { cambio: actual.firma !== previa.firma, nueva };
}

const T = {
  es: {
    aviso: 'Verificación lista para revisar',
    esperan: (n: number) => (n === 1 ? '1 espera revisión' : `${n} esperan revisión`),
    sonido: 'Sonido de avisos',
    sonidoSi: 'Sonido encendido',
    sonidoNo: 'Sonido silenciado',
    fuera: 'Avisarme también fuera del panel',
    fueraSi: 'Avisos en este aparato: encendidos',
    fueraNo: 'Apagar los avisos fuera del panel',
    bloqueado: 'El navegador tiene bloqueados los avisos de esta página: actívalos en sus ajustes.',
    sinSoporte: 'Este navegador no puede mostrar avisos fuera de la página.',
  },
  en: {
    aviso: 'Verification ready to review',
    esperan: (n: number) => (n === 1 ? '1 waiting for review' : `${n} waiting for review`),
    sonido: 'Notification sound',
    sonidoSi: 'Sound on',
    sonidoNo: 'Sound muted',
    fuera: 'Also notify me outside the dashboard',
    fueraSi: 'Notifications on this device: on',
    fueraNo: 'Turn off notifications outside the dashboard',
    bloqueado:
      'Your browser is blocking notifications for this page: turn them on in its settings.',
    sinSoporte: 'This browser can’t show notifications outside the page.',
  },
};

type Contexto = {
  silenciado: boolean;
  cambiarSonido: (encendido: boolean) => void;
  fuera: boolean;
  cambiarFuera: (encendido: boolean) => Promise<string>;
};
const AvisosEnVivo = createContext<Contexto | null>(null);

export function ProveedorAvisosEnVivo({
  activo,
  idioma,
  entorno,
  intervalo = intervaloSondeo,
  children,
}: {
  /** Solo el equipo (superadmin) vigila las verificaciones. */
  activo: boolean;
  idioma: Idioma;
  /** Para las pruebas: el navegador de mentira. */
  entorno?: Entorno;
  intervalo?: (oculta: boolean, inactivoMs: number) => number;
  children: React.ReactNode;
}) {
  const t = enIdioma(T, idioma);
  const usuario = useContext(SesionArmazon).usuario;
  // C-VERIFICACIONES-EN-VIVO: el silencio y el aviso fuera del panel, por cuenta en el servidor.
  const pref = usePreferencias('avisos', { sonido: 'si', aparato: 'no' });
  const silenciado = pref.valores.sonido === 'no';
  const silencio = useRef(silenciado);
  const textos = useRef(t);
  const espera = useRef(intervalo);
  // Lo último de cada render, para el sondeo (que vive fuera del render).
  useEffect(() => {
    silencio.current = silenciado;
    textos.current = t;
    espera.current = intervalo;
  });

  useEffect(() => {
    if (!activo) return;
    // El sonador vive con la vigía: lo que ya sonó no vuelve a sonar mientras la página esté abierta.
    const sonador = crearSonador(entorno ?? entornoNavegador(), () => silencio.current);
    let vivo = true;
    let previa: Marca | null = null;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    let ultimaActividad = Date.now();
    const actividad = () => {
      ultimaActividad = Date.now();
    };
    const oculta = () => document.visibilityState === 'hidden';
    const tic = async () => {
      try {
        const m = await pedir<Marca>('GET', '/datos/admin/kyc/marca');
        if (!vivo) return;
        const r = compararMarca(previa, m);
        if (!previa) {
          // La base: lo que ya estaba al abrir el panel no suena.
          if (m.ultimaEnviada) sonador.yaEstaba('verificacion', m.ultimaEnviada);
        } else {
          if (r.nueva)
            sonador.sonar('verificacion', r.nueva, {
              titulo: textos.current.aviso,
              cuerpo: textos.current.esperan(m.pendientes),
            });
          if (r.cambio)
            window.dispatchEvent(
              new CustomEvent<DetalleCambio>(EVENTO_CAMBIO, {
                detail: { nueva: Boolean(r.nueva) },
              }),
            );
        }
        previa = m;
      } catch (e) {
        console.warn('verificaciones en vivo: no se pudo leer la marca', e);
      }
      if (vivo) reloj = setTimeout(tic, espera.current(oculta(), Date.now() - ultimaActividad));
    };
    // Al volver a la pestaña se pregunta enseguida.
    const alVolver = () => {
      if (oculta()) return;
      if (reloj) clearTimeout(reloj);
      void tic();
    };
    for (const ev of ['pointerdown', 'keydown', 'wheel'] as const)
      window.addEventListener(ev, actividad, { passive: true });
    document.addEventListener('visibilitychange', alVolver);
    void tic();
    return () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
      for (const ev of ['pointerdown', 'keydown', 'wheel'] as const)
        window.removeEventListener(ev, actividad);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo, entorno]);

  const valor = useMemo<Contexto>(
    () => ({
      silenciado,
      cambiarSonido: (encendido) => pref.cambiar('sonido', encendido ? 'si' : 'no'),
      fuera: pref.valores.aparato === 'si',
      cambiarFuera: async (encendido) => {
        if (!encendido) {
          pref.cambiar('aparato', 'no');
          return '';
        }
        // El permiso del navegador se pide SOLO aquí, con el botón (nunca al cargar).
        const r = usuario ? await activarAvisosWeb(api, usuario.id) : 'error';
        if (r === 'permitido') {
          pref.cambiar('aparato', 'si');
          return '';
        }
        return r === 'bloqueado'
          ? textos.current.bloqueado
          : r === 'sin-soporte' || r === 'iphone-sin-inicio'
            ? textos.current.sinSoporte
            : textos.current.bloqueado;
      },
    }),
    [silenciado, pref, usuario],
  );
  return <AvisosEnVivo.Provider value={valor}>{children}</AvisosEnVivo.Provider>;
}

/** Los dos interruptores, en Verificaciones: el sonido y el aviso fuera del panel. */
export function ControlesAvisos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const c = useContext(AvisosEnVivo);
  const [mensaje, setMensaje] = useState('');
  if (!c) return null;
  return (
    <div className="avisos-en-vivo" data-testid="controles-avisos">
      <AyudaAqui guia="live-verifications" idioma={idioma} />
      <button
        type="button"
        className="boton secundario chico"
        aria-pressed={!c.silenciado}
        aria-label={t.sonido}
        data-testid="interruptor-sonido"
        onClick={() => c.cambiarSonido(c.silenciado)}
      >
        {c.silenciado ? (
          <BellOff size={16} aria-hidden="true" />
        ) : (
          <BellRing size={16} aria-hidden="true" />
        )}{' '}
        {c.silenciado ? t.sonidoNo : t.sonidoSi}
      </button>
      <button
        type="button"
        className="boton secundario chico"
        aria-pressed={c.fuera}
        data-testid="interruptor-fuera"
        title={c.fuera ? t.fueraNo : undefined}
        onClick={() => void c.cambiarFuera(!c.fuera).then(setMensaje)}
      >
        <Smartphone size={16} aria-hidden="true" /> {c.fuera ? t.fueraSi : t.fuera}
      </button>
      {mensaje ? (
        <p className="suave" role="status">
          {mensaje}
        </p>
      ) : null}
    </div>
  );
}
