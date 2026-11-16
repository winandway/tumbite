import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, CircleHelp, X } from 'lucide-react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { ir } from '../ruta';
import { pedir } from './api';
import './ayudaInterna.css';

/**
 * C-AYUDA-AQUI (16 nov 2026, Richard): «si yo estoy leyendo algo y no lo entiendo… ahí debe estar el
 * signo de interrogación en un sitio clave, le doy clic, se abre y me explica cómo funciona esa
 * parte». UNA pieza: el «?» al lado de cada parte del superadmin que tiene guía en la ayuda interna.
 * Abre un panel lateral (no saca a la persona de donde está) con la explicación de ESA parte y el
 * enlace a la guía completa.
 *
 * Solo existe dentro del superadmin: sin `BaseAyudaInterna` (la pone PanelApp con la dirección
 * secreta) no dibuja nada, así ningún otro panel muestra ni pide la ayuda del equipo.
 * El candado `ayudaAqui.test.tsx` falla si una pantalla con guía se queda sin su «?».
 */
export const BaseAyudaInterna = createContext<string | null>(null);

type GuiaAyuda = {
  id: string;
  titulo: string;
  resumen: string;
  explicacion?: string[];
  pasos: string[];
};
type SeccionAyuda = { id: string; titulo: string; guias: GuiaAyuda[] };

/** Una sola lectura de la ayuda por idioma mientras el panel está abierto. */
const cache = new Map<Idioma, Promise<SeccionAyuda[]>>();
export function cargarAyuda(idioma: Idioma): Promise<SeccionAyuda[]> {
  const ya = cache.get(idioma);
  if (ya) return ya;
  const nueva = pedir<{ secciones: SeccionAyuda[] }>('GET', `/datos/admin/ayuda?idioma=${idioma}`)
    .then((r) => r.secciones)
    .catch((e: unknown) => {
      cache.delete(idioma);
      throw e;
    });
  cache.set(idioma, nueva);
  return nueva;
}
/** Solo para las pruebas. */
export const olvidarAyuda = () => cache.clear();

const T = {
  es: {
    abrir: 'Cómo funciona esta parte',
    cerrar: 'Cerrar la ayuda',
    estaParte: 'Esta parte',
    comoFunciona: 'Cómo funciona',
    pasos: 'Pasos',
    completa: 'Ver la guía completa, con capturas',
    cargando: 'Cargando la ayuda…',
    error: 'No pudimos cargar la ayuda. Revisa tu conexión e intenta de nuevo.',
  },
  en: {
    abrir: 'How this part works',
    cerrar: 'Close help',
    estaParte: 'This part',
    comoFunciona: 'How it works',
    pasos: 'Steps',
    completa: 'See the full guide, with screenshots',
    cargando: 'Loading help…',
    error: 'We couldn’t load the help. Check your connection and try again.',
  },
};

export function AyudaAqui({
  guia,
  parrafo,
  idioma,
}: {
  /** El id de la guía de la ayuda interna (por ejemplo «read-order-ride-file»). */
  guia: string;
  /** El párrafo de «Cómo funciona» que explica ESTA parte (mismo orden en los dos idiomas). */
  parrafo?: number;
  idioma: Idioma;
}) {
  const base = useContext(BaseAyudaInterna);
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<{ g: GuiaAyuda; seccion: string } | null>(null);
  const [error, setError] = useState(false);
  const idTitulo = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const cerrarBoton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    cargarAyuda(idioma)
      .then((secciones) => {
        if (!vivo) return;
        for (const s of secciones) {
          const g = s.guias.find((x) => x.id === guia);
          if (g) return setDatos({ g, seccion: s.titulo });
        }
        console.error(`ayuda interna: la guía ${guia} no existe`);
        setError(true);
      })
      .catch((e: unknown) => {
        console.warn('ayuda interna: no se pudo cargar', e);
        if (vivo) setError(true);
      });
    cerrarBoton.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', tecla);
    return () => {
      vivo = false;
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, guia, idioma]);

  if (!base) return null;
  const cerrar = () => {
    setAbierto(false);
    boton.current?.focus();
  };
  const g = datos?.g;
  const destacado = g && parrafo !== undefined ? g.explicacion?.at(parrafo) : undefined;
  const resto = (g?.explicacion ?? []).filter((_, i) => i !== parrafo);

  return (
    <>
      <button
        type="button"
        ref={boton}
        className="ayq-boton"
        aria-label={t.abrir}
        title={t.abrir}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        data-ayuda={guia}
        onClick={() => {
          setError(false);
          setAbierto(true);
        }}
      >
        <CircleHelp size={17} aria-hidden="true" />
      </button>
      {abierto ? (
        <>
          <button
            type="button"
            className="ayq-velo"
            tabIndex={-1}
            aria-hidden="true"
            onClick={cerrar}
          />
          <aside className="ayq-panel" role="dialog" aria-labelledby={idTitulo}>
            <div className="ayq-cabeza">
              <p className="ayi-migas">{datos?.seccion ?? ''}</p>
              <button
                type="button"
                ref={cerrarBoton}
                className="pd-icono-boton"
                aria-label={t.cerrar}
                onClick={cerrar}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {error ? (
              <p role="alert">{t.error}</p>
            ) : !g ? (
              <p>{t.cargando}</p>
            ) : (
              <div className="ayi-guia">
                <h2 id={idTitulo}>{g.titulo}</h2>
                {destacado ? (
                  <div className="ayq-esta-parte">
                    <p className="ayq-etiqueta">{t.estaParte}</p>
                    <p>{destacado}</p>
                  </div>
                ) : (
                  <p className="ayi-resumen">{g.resumen}</p>
                )}
                {resto.length ? (
                  <>
                    <h3>{t.comoFunciona}</h3>
                    {resto.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </>
                ) : null}
                <h3>{t.pasos}</h3>
                <ol className="ayi-pasos">
                  {g.pasos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </div>
            )}
            <a
              className="ayq-completa"
              href={`${base}/help/${guia}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                setAbierto(false);
                ir(`${base}/help/${guia}`);
              }}
            >
              {t.completa}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </aside>
        </>
      ) : null}
    </>
  );
}
