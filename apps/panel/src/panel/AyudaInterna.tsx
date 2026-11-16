import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { type Idioma, almacenNavegador, enIdioma, useBorrador } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { ir } from '../ruta';
import { pedir } from './api';
import { EncabezadoPagina } from './armazon/Piezas';
import './ayudaInterna.css';

/**
 * C-AYUDA-INTERNA (16 nov 2026, Richard) — todos los países. La ayuda del equipo de operaciones,
 * DENTRO del superadmin (su dirección secreta + la sesión del equipo). El botón «?» de la cabecera
 * la abre. Estilo Wikipedia como Docs: barra lateral con secciones, buscador desde la primera letra
 * y una página por guía (`<superadmin>/help/<guía>`). El texto y las capturas los da el servidor
 * (`/datos/admin/ayuda`), nunca el paquete público del panel; ningún buscador la indexa.
 */
type Captura = { src: string; alt: string; pie: string };
type Guia = {
  id: string;
  titulo: string;
  resumen: string;
  explicacion?: string[];
  capturas?: Captura[];
  preguntas?: string[];
  pasos: string[];
  nota?: string;
};
type Seccion = { id: string; titulo: string; guias: Guia[] };

const T = {
  es: {
    titulo: 'Ayuda del equipo',
    detalle:
      'Así funciona nuestra plataforma. Solo para el equipo de Divoox: no se comparte fuera.',
    buscar: 'Buscar en la ayuda',
    sinResultados: 'No encontramos nada con eso. Prueba con otra palabra.',
    cargando: 'Cargando la ayuda…',
    error: 'No pudimos cargar la ayuda. Revisa tu conexión.',
    reintentar: 'Reintentar',
    noExiste: 'Esa guía no existe o cambió de nombre. Elige una del menú.',
    volver: 'Ayuda',
    responde: 'Esta guía responde',
    comoFunciona: 'Cómo funciona',
    pasos: 'Pasos',
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    menu: 'Secciones de la ayuda',
    ampliar: 'Abrir la captura en grande',
  },
  en: {
    titulo: 'Team help',
    detalle: 'How our platform works. For the Divoox team only: never shared outside.',
    buscar: 'Search the help',
    sinResultados: 'Nothing matched. Try another word.',
    cargando: 'Loading the help…',
    error: 'We couldn’t load the help. Check your connection.',
    reintentar: 'Try again',
    noExiste: 'That guide doesn’t exist or was renamed. Pick one from the menu.',
    volver: 'Help',
    responde: 'This guide answers',
    comoFunciona: 'How it works',
    pasos: 'Steps',
    anterior: 'Previous',
    siguiente: 'Next',
    menu: 'Help sections',
    ampliar: 'Open the screenshot full size',
  },
};

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca desde la primera letra, sin acentos ni mayúsculas, cada palabra por su comienzo. */
export function buscarAyuda(secciones: Seccion[], texto: string) {
  const palabras = plano(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const todas = secciones.flatMap((s) => s.guias.map((g) => ({ seccion: s, guia: g })));
  return todas
    .map((r) => {
      const titulo = plano(r.guia.titulo);
      const resto = plano(
        [
          r.guia.resumen,
          ...(r.guia.preguntas ?? []),
          ...(r.guia.explicacion ?? []),
          ...r.guia.pasos,
        ].join(' '),
      );
      const enPalabra = (t: string, p: string) =>
        t.split(/[^a-z0-9#]+/).some((w) => w.startsWith(p));
      let puntos = 0;
      for (const p of palabras) {
        if (enPalabra(titulo, p)) puntos += 3;
        else if (enPalabra(resto, p)) puntos += 1;
        else return null;
      }
      return { ...r, puntos };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.puntos - a.puntos);
}

/** Ninguna página de la ayuda la guarda un buscador (además de la cabecera del servidor). */
function useSinIndexar() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    meta.dataset.ayudaInterna = '1';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

export function AyudaInterna({ base, sub, idioma }: { base: string; sub: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  useSinIndexar();
  const raiz = `${base}/help`;
  const guiaId = sub.replace(/^\/?/, '').split('/')[0] ?? '';
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [error, setError] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    pedir<{ secciones: Seccion[] }>('GET', `/datos/admin/ayuda?idioma=${idioma}`)
      .then((r) => {
        if (vivo) setSecciones(r.secciones);
      })
      .catch((e: unknown) => {
        console.warn('ayuda interna: no se pudo cargar', e);
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [idioma, vuelta]);

  // Lo escrito en el buscador se guarda, como en todo formulario de la casa.
  const b = useBorrador({
    formulario: 'ayuda-interna-buscador',
    inicial: { q: '' },
    almacen: almacenNavegador,
  });
  const q = b.valores.q;
  const { cambiar } = b;
  const rutaVista = useRef(sub);
  useEffect(() => {
    if (rutaVista.current === sub) return;
    rutaVista.current = sub;
    cambiar('q', '');
  }, [sub, cambiar]);
  const idLista = useId();
  const resultados = useMemo(
    () => (secciones && q.trim() ? buscarAyuda(secciones, q).slice(0, 12) : null),
    [secciones, q],
  );

  if (error)
    return (
      <section className="ayi">
        <EncabezadoPagina titulo={t.titulo} detalle={t.detalle} />
        <p role="alert">{t.error}</p>
        <button
          type="button"
          className="boton"
          onClick={() => {
            setError(false);
            setVuelta((v) => v + 1);
          }}
        >
          {t.reintentar}
        </button>
      </section>
    );
  if (!secciones)
    return (
      <section className="ayi">
        <EncabezadoPagina titulo={t.titulo} detalle={t.detalle} />
        <p>{t.cargando}</p>
      </section>
    );

  const lista = secciones.flatMap((s) => s.guias.map((g) => ({ seccion: s, guia: g })));
  const posicion = lista.findIndex((r) => r.guia.id === guiaId);
  const actual = posicion >= 0 ? lista.at(posicion) : undefined;
  const anterior = posicion > 0 ? lista.at(posicion - 1) : undefined;
  const siguiente = posicion >= 0 ? lista.at(posicion + 1) : undefined;

  const buscador = (
    <form
      className="ayi-buscador pd-en-linea"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const primero = resultados?.[0];
        if (primero) ir(`${raiz}/${primero.guia.id}`);
      }}
    >
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        value={q}
        placeholder={t.buscar}
        aria-label={t.buscar}
        aria-controls={idLista}
        onChange={(e) => cambiar('q', e.target.value)}
      />
    </form>
  );

  return (
    <section className="ayi">
      <EncabezadoPagina titulo={t.titulo} detalle={t.detalle} />
      <div className={actual && !resultados ? 'ayi-cuerpo con-guia' : 'ayi-cuerpo'}>
        <aside className="ayi-lateral">
          {buscador}
          <nav aria-label={t.menu}>
            {secciones.map((s) => (
              <div key={s.id} className="ayi-seccion">
                <p className="ayi-seccion-titulo">{s.titulo}</p>
                {s.guias.map((g) => (
                  <Enlace
                    key={g.id}
                    a={`${raiz}/${g.id}`}
                    className={g.id === guiaId ? 'ayi-item activo' : 'ayi-item'}
                    actual={g.id === guiaId}
                  >
                    {g.titulo}
                  </Enlace>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="ayi-contenido" id={idLista}>
          {resultados ? (
            resultados.length === 0 ? (
              <p className="ayi-vacio">{t.sinResultados}</p>
            ) : (
              <ul className="ayi-resultados">
                {resultados.map((r) => (
                  <li key={r.guia.id}>
                    <Enlace a={`${raiz}/${r.guia.id}`}>
                      <strong>{r.guia.titulo}</strong>
                      <small>{r.seccion.titulo}</small>
                      <span>{r.guia.resumen}</span>
                    </Enlace>
                  </li>
                ))}
              </ul>
            )
          ) : actual ? (
            <article className="ayi-guia">
              <Enlace a={raiz} className="ayi-volver">
                <ArrowLeft size={16} aria-hidden="true" />
                {t.volver}
              </Enlace>
              <p className="ayi-migas">{actual.seccion.titulo}</p>
              <h2>{actual.guia.titulo}</h2>
              <p className="ayi-resumen">{actual.guia.resumen}</p>
              {actual.guia.preguntas?.length ? (
                <div className="ayi-responde">
                  <p>{t.responde}</p>
                  <ul>
                    {actual.guia.preguntas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {actual.guia.explicacion?.length ? (
                <>
                  <h3>{t.comoFunciona}</h3>
                  {actual.guia.explicacion.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </>
              ) : null}
              {(actual.guia.capturas ?? []).map((c) => (
                <figure key={c.src} className="ayi-captura">
                  <a href={c.src} target="_blank" rel="noopener noreferrer" aria-label={t.ampliar}>
                    <img src={c.src} alt={c.alt} loading="lazy" />
                  </a>
                  <figcaption>{c.pie}</figcaption>
                </figure>
              ))}
              <h3>{t.pasos}</h3>
              <ol className="ayi-pasos">
                {actual.guia.pasos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {actual.guia.nota ? <p className="ayi-nota">{actual.guia.nota}</p> : null}
              <nav className="ayi-pasar">
                {anterior ? (
                  <Enlace a={`${raiz}/${anterior.guia.id}`}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>
                      <small>{t.anterior}</small>
                      {anterior.guia.titulo}
                    </span>
                  </Enlace>
                ) : (
                  <span />
                )}
                {siguiente ? (
                  <Enlace a={`${raiz}/${siguiente.guia.id}`} className="ayi-siguiente">
                    <span>
                      <small>{t.siguiente}</small>
                      {siguiente.guia.titulo}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Enlace>
                ) : null}
              </nav>
            </article>
          ) : (
            <>
              {guiaId ? (
                <p role="alert" className="ayi-vacio">
                  {t.noExiste}
                </p>
              ) : null}
              {secciones.map((s) => (
                <div key={s.id} className="ayi-indice">
                  <h2>{s.titulo}</h2>
                  <ul>
                    {s.guias.map((g) => (
                      <li key={g.id}>
                        <Enlace a={`${raiz}/${g.id}`}>
                          <strong>{g.titulo}</strong>
                          <span>{g.resumen}</span>
                        </Enlace>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
