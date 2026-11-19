import { createElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type Idioma, almacenNavegador, enIdioma, useBorrador } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { ir } from '../../ruta';
import { conIdioma, enEspanol } from '../../rutaIdioma';
import { Icono } from '../Icono';
import { DOCS, type Guia, type SeccionDocs, TEXTOS_DOCS } from './guias';
import { ICONOS_GUIA, nombreIconoGuia } from './iconosGuia';
import { buscarGuias, resaltar } from './buscar';
import { CapturasConLupa } from './Lupa';
import { PaginaVideos, VideoDeDocs } from './VideoDocs';
import { TEXTOS_VIDEO, VIDEOS, type VideoDocs, videosDeGuia } from './videos';

/** Cuántas sugerencias muestra la lista que se abre mientras se escribe. */
const SUGERENCIAS = 20;

/** Navegar a una guía quedándose en el idioma de la página (como Enlace). */
function irA(a: string) {
  ir(enEspanol(window.location.pathname) ? conIdioma(a, 'es') : a);
}

/**
 * El ícono propio de cada guía (Docs más amigable, 29 oct 2026). C-DOCS-PAGINA-LIVIANA: referencia
 * el símbolo dibujado una sola vez en la página (SimbolosIconosGuia), en vez de repetir el dibujo.
 */
function IconoGuia({ id, tamano }: { id: string; tamano: number }) {
  return (
    <svg width={tamano} height={tamano} aria-hidden="true" className="icono icono-guia">
      <use href={`#ig-${nombreIconoGuia(id)}`} />
    </svg>
  );
}

/** Los dibujos de los íconos de las guías, una sola vez por página, ocultos. */
function SimbolosIconosGuia() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {ICONOS_GUIA.map(([nombre, Dibujo]) => (
          <symbol key={nombre} id={`ig-${nombre}`} viewBox="0 0 24 24">
            {createElement(Dibujo, { size: 24, strokeWidth: 2 })}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Docs estilo Wikipedia: barra lateral con secciones e íconos que NUNCA se pierde, buscador
 * (⌘K) que filtra mientras se escribe, y cada guía en su propia dirección /docs/<seccion>/<guia>.
 * En celular el contenido va primero (C-DOCS-AL-GRANO) y arriba va «← Docs».
 *
 * El menú va DESPUÉS del contenido en la página y, por debajo de 900 de ancho, PLEGADO en el botón
 * «Menú de Docs» (arriba, una sola línea): solo se despliega al tocarlo. En escritorio la barra
 * lateral queda a la vista con el ítem activo resaltado (lo decide la hoja de estilos).
 */
export function Docs({
  ruta,
  idioma,
  videos = VIDEOS,
}: {
  ruta: string;
  idioma: Idioma;
  /** C-DOCS-VIDEO: los videos de Docs (por defecto, los publicados). */
  videos?: readonly VideoDocs[];
}) {
  const t = enIdioma(TEXTOS_DOCS, idioma);
  const tv = enIdioma(TEXTOS_VIDEO, idioma);
  const secciones = enIdioma(DOCS, idioma);
  const [seccionId, guiaId] = ruta.replace(/^\/docs\/?/, '').split('/');
  // «¿Cómo hago…?»: todas las preguntas de la gente, cada una con el enlace a su guía.
  const comoHago = seccionId === 'how-to';
  // C-DOCS-VIDEO: la página «Videos» existe solo cuando hay al menos un video publicado.
  const paginaVideos = seccionId === 'videos' && !guiaId && videos.length > 0;
  // La guía se encuentra aunque la dirección traiga otra sección o ninguna (/docs/<guia>, o una
  // guía que cambió de sección): antes caía en el inicio de Docs sin decir nada.
  const directa = secciones.find((s) => s.id === seccionId) ?? null;
  const buscada = guiaId ?? (directa ? undefined : seccionId);
  const enDirecta = directa?.guias.find((g) => g.id === buscada) ?? null;
  const otra =
    buscada && !enDirecta
      ? (secciones.find((s) => s.guias.some((g) => g.id === buscada)) ?? null)
      : null;
  const seccion = otra ?? directa;
  const guia = enDirecta ?? otra?.guias.find((g) => g.id === buscada) ?? null;
  // Una dirección que no existe lo dice, en vez de mostrar el inicio como si nada.
  const noExiste = Boolean(buscada) && !guia && !comoHago && !paginaVideos;
  // Lo escrito en el buscador se guarda, como en todo formulario de la casa.
  const b = useBorrador({
    formulario: 'docs-buscador',
    inicial: { q: '' },
    almacen: almacenNavegador,
  });
  const busqueda = b.valores.q;
  const setBusqueda = (x: string) => b.cambiar('q', x);
  // Al abrir una guía (desde un resultado o el menú) la búsqueda se limpia: antes el texto quedaba
  // guardado y la pantalla seguía mostrando los resultados, como si el clic no abriera nada.
  const rutaVista = useRef(ruta);
  const { cambiar, recuperado, empezarDeNuevo } = b;
  useEffect(() => {
    if (rutaVista.current === ruta) return;
    rutaVista.current = ruta;
    cambiar('q', '');
  }, [ruta, cambiar]);
  // Al llegar por el enlace de una guía, una búsqueda vieja guardada no la tapa (15 nov 2026: se
  // abría /docs/ordering/ride-moto y se veían los resultados de «tracking»). El borrador llega un
  // instante después de dibujar, por eso se mira cuando llega.
  const llegoAUnaGuia = useRef(Boolean(guia) || comoHago || paginaVideos);
  useEffect(() => {
    if (!recuperado || !llegoAUnaGuia.current) return;
    llegoAUnaGuia.current = false;
    void empezarDeNuevo();
  }, [recuperado, empezarDeNuevo]);
  const campo = useRef<HTMLInputElement>(null);
  // El menú plegado del celular: se guarda EN QUÉ página se abrió, así al elegir una guía (cambia
  // la dirección) vuelve a quedar plegado solo y la guía nueva abre en su título.
  const [menuEn, setMenuEn] = useState<string | null>(null);
  const menuAbierto = menuEn === ruta;
  const idMenu = useId();

  // ⌘K o Ctrl+K enfoca el buscador desde cualquier página de Docs.
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, []);

  // C-DOCS-BUSCADOR-MOTOR (15 nov 2026): buscar en cada tecla tarda unas milésimas (el índice se
  // arma una vez). Sin acentos, con errores de escritura, por el comienzo de la palabra y en los
  // dos idiomas («wallet» encuentra la billetera), ordenado por relevancia.
  const resultados = busqueda.trim() ? buscarGuias(secciones, busqueda) : null;
  const sugerencias = resultados?.slice(0, SUGERENCIAS) ?? [];
  // La lista de sugerencias (combobox, como el buscador de la documentación de los grandes).
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);
  const idLista = useId();
  const mostrarLista = abierta && sugerencias.length > 0;
  const abrirResultado = (r: { seccion: SeccionDocs; guia: Guia }) => {
    setAbierta(false);
    setBusqueda('');
    irA(`/docs/${r.seccion.id}/${r.guia.id}`);
  };

  const buscador = (
    <form
      className="docs-buscador"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        // Enter abre la sugerencia marcada con las flechas, o la primera.
        const elegido = (activa >= 0 ? sugerencias.at(activa) : undefined) ?? resultados?.at(0);
        if (elegido) abrirResultado(elegido);
      }}
    >
      <Icono nombre="buscar" tamano={18} />
      <input
        ref={campo}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-activedescendant={mostrarLista && activa >= 0 ? `${idLista}-${activa}` : undefined}
        autoComplete="off"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setAbierta(true);
          setActiva(-1);
        }}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!sugerencias.length) return;
            e.preventDefault();
            setAbierta(true);
            const paso = e.key === 'ArrowDown' ? 1 : -1;
            // De -1 (en el campo) a la última y vuelta a empezar.
            setActiva((a) => {
              const n = a + paso;
              return n >= sugerencias.length ? -1 : n < -1 ? sugerencias.length - 1 : n;
            });
          } else if (e.key === 'Escape' && mostrarLista) {
            e.preventDefault();
            setAbierta(false);
            setActiva(-1);
          }
        }}
        placeholder={t.buscar}
        aria-label={t.buscar}
      />
      <kbd>{t.atajo}</kbd>
      <ul
        id={idLista}
        role="listbox"
        aria-label={t.sugerencias}
        className="docs-sugerencias"
        hidden={!mostrarLista}
      >
        {sugerencias.map((r, i) => (
          <li
            key={`${r.seccion.id}/${r.guia.id}`}
            id={`${idLista}-${i}`}
            role="option"
            aria-selected={i === activa}
            className={i === activa ? 'activa' : undefined}
            // mousedown: elegir antes de que el campo pierda el foco y cierre la lista.
            onMouseDown={(e) => {
              e.preventDefault();
              abrirResultado(r);
            }}
            onMouseEnter={() => setActiva(i)}
          >
            <IconoGuia id={r.guia.id} tamano={18} />
            <span className="docs-sugerencia-texto">
              <span className="docs-sugerencia-titulo">
                {resaltar(r.guia.titulo, r.terminos).map((x, j) =>
                  x.marca ? <mark key={j}>{x.texto}</mark> : <span key={j}>{x.texto}</span>,
                )}
              </span>
              <span className="docs-sugerencia-seccion">{r.seccion.titulo}</span>
            </span>
          </li>
        ))}
      </ul>
    </form>
  );

  return (
    <div className="docs">
      <SimbolosIconosGuia />
      <main className="docs-contenido">
        {/* El buscador vive siempre en el mismo sitio: si se moviera, perdería el foco al escribir. */}
        <div
          className={!seccion && !resultados && !paginaVideos ? 'docs-buscador-grande' : undefined}
        >
          {buscador}
        </div>
        {noExiste && !resultados ? (
          <p className="docs-vacio" role="alert">
            {t.noExiste}
          </p>
        ) : null}
        {resultados ? (
          <>
            {resultados.length === 0 ? (
              <p className="docs-vacio">{t.sinResultados}</p>
            ) : (
              <div className="docs-tarjetas">
                {resultados.map(({ seccion: s, guia: g }) => (
                  <TarjetaGuia key={`${s.id}/${g.id}`} seccion={s} guia={g} />
                ))}
              </div>
            )}
          </>
        ) : comoHago ? (
          <ComoHago secciones={secciones} t={t} />
        ) : paginaVideos ? (
          <PaginaVideos
            videos={videos}
            secciones={secciones}
            idioma={idioma}
            volver={t.volver}
            migas={t.migas}
          />
        ) : guia && seccion ? (
          <PaginaGuia
            secciones={secciones}
            seccion={seccion}
            guia={guia}
            t={t}
            idioma={idioma}
            videos={videosDeGuia(videos, `${seccion.id}/${guia.id}`)}
          />
        ) : seccion ? (
          <>
            <nav className="docs-migas" aria-label={t.migas}>
              <Enlace a="/docs" className="docs-volver">
                {t.volver}
              </Enlace>
            </nav>
            <h1>
              <Icono nombre={seccion.icono} tamano={28} /> {seccion.titulo}
            </h1>
            <div className="docs-tarjetas">
              {seccion.guias.map((g) => (
                <TarjetaGuia key={g.id} seccion={seccion} guia={g} />
              ))}
            </div>
          </>
        ) : (
          <>
            <h1>{t.titulo}</h1>
            <p className="docs-sub">{t.subtitulo}</p>
            <p>
              <Enlace a="/docs/how-to" className="docs-comohago">
                {t.comoHagoInvita} →
              </Enlace>
            </p>
            {videos.length > 0 ? (
              <p>
                <Enlace a="/docs/videos" className="docs-comohago">
                  {tv.titulo}: {tv.resumen} →
                </Enlace>
              </p>
            ) : null}
            {/* Cursos y presentaciones, a la vista apenas se entra (antes nadie los encontraba). */}
            {secciones
              .filter((s) => s.id === 'courses')
              .map((s) => (
                <section key={s.id} className="docs-cursos" aria-labelledby="docs-cursos-titulo">
                  <h2 id="docs-cursos-titulo">
                    <Icono nombre={s.icono} tamano={24} /> {s.titulo}
                  </h2>
                  <div className="docs-cursos-tarjetas">
                    {s.guias
                      .filter((g) => g.descargas?.length === 1)
                      .map((g) => (
                        <Enlace key={g.id} a={`/docs/${s.id}/${g.id}`} className="docs-curso">
                          <IconoGuia id={g.id} tamano={28} />
                          <strong>{g.titulo}</strong>
                          <span>{g.resumen}</span>
                        </Enlace>
                      ))}
                  </div>
                </section>
              ))}
            {secciones
              .filter((s) => s.id !== 'courses')
              .map((s) => (
                <section key={s.id} className="docs-seccion">
                  <h2>
                    <Enlace a={`/docs/${s.id}`}>
                      <Icono nombre={s.icono} tamano={22} /> {s.titulo}
                    </Enlace>
                  </h2>
                  <div className="docs-tarjetas">
                    {s.guias.map((g) => (
                      <TarjetaGuia key={g.id} seccion={s} guia={g} />
                    ))}
                  </div>
                </section>
              ))}
          </>
        )}
      </main>
      {/* C-DOCS-AL-GRANO: el menú va DESPUÉS del contenido en la página (el celular y Google llegan
          directo a la guía); en pantallas anchas se ve a la izquierda, como siempre. */}
      <aside className={`docs-barra${menuAbierto ? ' abierta' : ''}`}>
        <button
          type="button"
          className="docs-menu-boton"
          aria-expanded={menuAbierto}
          aria-controls={idMenu}
          onClick={() => setMenuEn(menuAbierto ? null : ruta)}
        >
          <Icono nombre="menu" tamano={18} /> {t.menuBoton}
        </button>
        <div id={idMenu} className="docs-barra-cuerpo">
          <Enlace
            a="/docs"
            className={`docs-inicio${!seccion && !comoHago && !paginaVideos ? ' activo' : ''}`}
          >
            <Icono nombre="libro" tamano={18} /> {t.titulo}
          </Enlace>
          <Enlace a="/docs/how-to" className={`docs-inicio${comoHago ? ' activo' : ''}`}>
            <Icono nombre="soporte" tamano={18} /> {t.comoHago}
          </Enlace>
          {videos.length > 0 ? (
            <Enlace a="/docs/videos" className={`docs-inicio${paginaVideos ? ' activo' : ''}`}>
              <Icono nombre="presentacion" tamano={18} /> {tv.titulo}
            </Enlace>
          ) : null}
          <nav aria-label={t.menu}>
            {secciones.map((s) => (
              <details
                key={s.id}
                open={(!seccion && !comoHago && !paginaVideos) || s.id === seccion?.id}
              >
                <summary className={s.id === seccion?.id ? 'activo' : undefined}>
                  <Icono nombre={s.icono} tamano={18} /> {s.titulo}
                </summary>
                <ul>
                  {s.guias.map((g) => (
                    <li key={g.id}>
                      <Enlace
                        a={`/docs/${s.id}/${g.id}`}
                        className={g.id === guia?.id && s.id === seccion?.id ? 'activo' : undefined}
                      >
                        <IconoGuia id={g.id} tamano={15} />
                        <span>{g.titulo}</span>
                      </Enlace>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}

/** Cada pregunta de la gente, agrupada por sección, con el enlace directo a la guía que la responde. */
function ComoHago({ secciones, t }: { secciones: SeccionDocs[]; t: (typeof TEXTOS_DOCS)['es'] }) {
  return (
    <article className="docs-guia">
      <nav className="docs-migas" aria-label={t.migas}>
        <Enlace a="/docs" className="docs-volver">
          {t.volver}
        </Enlace>
      </nav>
      <h1>{t.comoHago}</h1>
      <p className="docs-resumen">{t.comoHagoResumen}</p>
      {secciones.map((s) => (
        <section key={s.id} className="docs-preguntas">
          <h2>
            <Icono nombre={s.icono} tamano={22} /> {s.titulo}
          </h2>
          <ul>
            {s.guias.flatMap((g) =>
              (g.preguntas ?? []).map((x) => (
                <li key={`${g.id}-${x}`}>
                  <Enlace a={`/docs/${s.id}/${g.id}`}>{x}</Enlace>
                </li>
              )),
            )}
          </ul>
        </section>
      ))}
    </article>
  );
}

function TarjetaGuia({ seccion, guia }: { seccion: SeccionDocs; guia: Guia }) {
  return (
    <Enlace a={`/docs/${seccion.id}/${guia.id}`} className="docs-tarjeta">
      <IconoGuia id={guia.id} tamano={22} />
      <strong>{guia.titulo}</strong>
      <span>{guia.resumen}</span>
    </Enlace>
  );
}

/** Cuántas guías relacionadas se enlazan al pie de cada guía. */
const RELACIONADAS = 4;

/**
 * Las guías que más se parecen a esta (por título y resumen, con el mismo motor del buscador),
 * de cualquier sección. Como los «Véase también» de Wikipedia: enlazan las guías entre sí.
 */
export function guiasRelacionadas(secciones: readonly SeccionDocs[], guia: Guia) {
  return buscarGuias(secciones, guia.titulo)
    .filter((r) => r.guia.id !== guia.id)
    .slice(0, RELACIONADAS);
}

function PaginaGuia({
  secciones,
  seccion,
  guia,
  t,
  idioma,
  videos,
}: {
  secciones: readonly SeccionDocs[];
  seccion: SeccionDocs;
  guia: Guia;
  t: (typeof TEXTOS_DOCS)['es'];
  idioma: Idioma;
  videos: readonly VideoDocs[];
}) {
  const i = seccion.guias.indexOf(guia);
  // C-DOCS-VIDEO: el primer video de la guía lleva el ancla #video (es la que comparte Camila).
  const video = (v: VideoDocs) => (
    <VideoDeDocs
      key={v.id}
      video={v}
      idioma={idioma}
      ancla={v === videos[0] ? 'video' : `video-${v.id}`}
    />
  );
  const anterior = seccion.guias.at(i - 1 < 0 ? seccion.guias.length : i - 1);
  const siguiente = seccion.guias.at(i + 1 >= seccion.guias.length ? -seccion.guias.length : i + 1);
  const relacionadas = useMemo(() => guiasRelacionadas(secciones, guia), [secciones, guia]);
  // C-DOCS-AL-GRANO: título, resumen y los pasos numerados primero; después las capturas, y recién
  // al final la explicación larga («Cómo funciona»), que antes enterraba los pasos.
  return (
    <article className="docs-guia">
      <nav className="docs-migas" aria-label={t.migas}>
        <Enlace a="/docs" className="docs-volver">
          {t.volver}
        </Enlace>
        <span aria-hidden="true">›</span>
        <Enlace a={`/docs/${seccion.id}`}>{seccion.titulo}</Enlace>
      </nav>
      <h1>
        <IconoGuia id={guia.id} tamano={30} /> {guia.titulo}
      </h1>
      <p className="docs-resumen">{guia.resumen}</p>
      {guia.descargas && guia.descargas.length > 0 && (
        <ul className="docs-descargas">
          {guia.descargas.map((d) => (
            <li key={d.href}>
              <a className="boton" href={d.href} target="_blank" rel="noopener noreferrer">
                {d.texto}
              </a>
            </li>
          ))}
        </ul>
      )}
      {videos.filter((v) => v.lugar === 'arriba').map(video)}
      {guia.pasos.length > 0 && (
        <>
          <h2>{t.pasos}</h2>
          <ol>
            {guia.pasos.map((p, n) => (
              <li key={p} id={`paso-${n + 1}`}>
                {p}
              </li>
            ))}
          </ol>
        </>
      )}
      {videos.filter((v) => v.lugar === 'pasos').map(video)}
      {guia.capturas && guia.capturas.length > 0 && (
        <CapturasConLupa capturas={guia.capturas} idioma={idioma} />
      )}
      {guia.explicacion && (
        <>
          <h2 className="docs-explicacion">{t.comoFunciona}</h2>
          {guia.explicacion.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </>
      )}
      {guia.nota && <p className="docs-nota">{guia.nota}</p>}
      {guia.preguntas && guia.preguntas.length > 0 && (
        <section className="docs-preguntas">
          <h2>{t.responde}</h2>
          <ul>
            {guia.preguntas.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {relacionadas.length > 0 && (
        <section className="docs-relacionadas" aria-labelledby="docs-relacionadas-titulo">
          <h2 id="docs-relacionadas-titulo">{t.relacionadas}</h2>
          <ul>
            {relacionadas.map((r) => (
              <li key={`${r.seccion.id}/${r.guia.id}`}>
                <Enlace a={`/docs/${r.seccion.id}/${r.guia.id}`}>
                  <IconoGuia id={r.guia.id} tamano={18} />
                  <span>
                    <strong>{r.guia.titulo}</strong>
                    <small>{r.seccion.titulo}</small>
                  </span>
                </Enlace>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="docs-pies" aria-label={t.enEstaSeccion}>
        {anterior && anterior !== guia && (
          <Enlace a={`/docs/${seccion.id}/${anterior.id}`}>
            ← {t.anterior}: {anterior.titulo}
          </Enlace>
        )}
        {siguiente && siguiente !== guia && (
          <Enlace a={`/docs/${seccion.id}/${siguiente.id}`}>
            {t.siguiente}: {siguiente.titulo} →
          </Enlace>
        )}
      </nav>
    </article>
  );
}
