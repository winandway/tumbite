import { useEffect, useRef } from 'react';
import { type Idioma, almacenNavegador, enIdioma, useBorrador } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { Icono } from '../Icono';
import { DOCS, type Guia, type SeccionDocs, TEXTOS_DOCS } from './guias';

/**
 * Docs estilo Wikipedia: barra lateral con secciones e íconos que NUNCA se pierde, buscador
 * (⌘K) que filtra mientras se escribe, y cada guía en su propia dirección /docs/<seccion>/<guia>.
 * En celular la barra va plegada y arriba del contenido va «← Docs».
 */
export function Docs({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_DOCS, idioma);
  const secciones = enIdioma(DOCS, idioma);
  const [seccionId, guiaId] = ruta.replace(/^\/docs\/?/, '').split('/');
  // «¿Cómo hago…?»: todas las preguntas de la gente, cada una con el enlace a su guía.
  const comoHago = seccionId === 'how-to';
  const seccion = secciones.find((s) => s.id === seccionId) ?? null;
  const guia = seccion?.guias.find((g) => g.id === guiaId) ?? null;
  // Lo escrito en el buscador se guarda, como en todo formulario de la casa.
  const b = useBorrador({
    formulario: 'docs-buscador',
    inicial: { q: '' },
    almacen: almacenNavegador,
  });
  const busqueda = b.valores.q;
  const setBusqueda = (x: string) => b.cambiar('q', x);
  const campo = useRef<HTMLInputElement>(null);

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

  // Son veinte guías: filtrar en cada tecla es barato, no hace falta memoria.
  const q = busqueda.trim().toLowerCase();
  const resultados = q
    ? secciones.flatMap((s) =>
        s.guias
          .filter((g) =>
            [
              g.titulo,
              g.resumen,
              ...(g.preguntas ?? []),
              ...(g.explicacion ?? []),
              ...g.pasos,
            ].some((x) => x.toLowerCase().includes(q)),
          )
          .map((g) => ({ seccion: s, guia: g })),
      )
    : null;

  const buscador = (
    <form className="docs-buscador" role="search" onSubmit={(e) => e.preventDefault()}>
      <Icono nombre="buscar" tamano={18} />
      <input
        ref={campo}
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder={t.buscar}
        aria-label={t.buscar}
      />
      <kbd>{t.atajo}</kbd>
    </form>
  );

  return (
    <div className="docs">
      <aside className="docs-barra">
        <Enlace a="/docs" className={`docs-inicio${!seccion && !comoHago ? ' activo' : ''}`}>
          <Icono nombre="libro" tamano={18} /> {t.titulo}
        </Enlace>
        <Enlace a="/docs/how-to" className={`docs-inicio${comoHago ? ' activo' : ''}`}>
          <Icono nombre="soporte" tamano={18} /> {t.comoHago}
        </Enlace>
        <nav aria-label={t.menu}>
          {secciones.map((s) => (
            <details key={s.id} open={(!seccion && !comoHago) || s.id === seccion?.id}>
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
                      {g.titulo}
                    </Enlace>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </nav>
      </aside>

      <main className="docs-contenido">
        {/* El buscador vive siempre en el mismo sitio: si se moviera, perdería el foco al escribir. */}
        <div className={!seccion && !resultados ? 'docs-buscador-grande' : undefined}>
          {buscador}
        </div>
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
        ) : guia && seccion ? (
          <PaginaGuia seccion={seccion} guia={guia} t={t} />
        ) : seccion ? (
          <>
            <Enlace a="/docs" className="docs-volver">
              {t.volver}
            </Enlace>
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
            {secciones.map((s) => (
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
    </div>
  );
}

/** Cada pregunta de la gente, agrupada por sección, con el enlace directo a la guía que la responde. */
function ComoHago({ secciones, t }: { secciones: SeccionDocs[]; t: (typeof TEXTOS_DOCS)['es'] }) {
  return (
    <article className="docs-guia">
      <Enlace a="/docs" className="docs-volver">
        {t.volver}
      </Enlace>
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
      <strong>{guia.titulo}</strong>
      <span>{guia.resumen}</span>
    </Enlace>
  );
}

function PaginaGuia({
  seccion,
  guia,
  t,
}: {
  seccion: SeccionDocs;
  guia: Guia;
  t: (typeof TEXTOS_DOCS)['es'];
}) {
  const i = seccion.guias.indexOf(guia);
  const anterior = seccion.guias.at(i - 1 < 0 ? seccion.guias.length : i - 1);
  const siguiente = seccion.guias.at(i + 1 >= seccion.guias.length ? -seccion.guias.length : i + 1);
  return (
    <article className="docs-guia">
      <Enlace a="/docs" className="docs-volver">
        {t.volver}
      </Enlace>
      <p className="docs-miga">
        <Enlace a={`/docs/${seccion.id}`}>{seccion.titulo}</Enlace>
      </p>
      <h1>{guia.titulo}</h1>
      <p className="docs-resumen">{guia.resumen}</p>
      {guia.explicacion && (
        <>
          <h2>{t.comoFunciona}</h2>
          {guia.explicacion.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </>
      )}
      {guia.capturas && (
        <div className="docs-capturas">
          {guia.capturas.map((c) => (
            <figure key={c.src} className="docs-captura">
              <img src={c.src} alt={c.alt} loading="lazy" />
              <figcaption>{c.pie}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {guia.pasos.length > 0 && (
        <>
          <h2>{t.pasos}</h2>
          <ol>
            {guia.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
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
