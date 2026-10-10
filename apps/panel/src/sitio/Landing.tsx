import { type Idioma, enIdioma } from '@tumbite/compartido';
import { CONTACTO, TEXTOS_SITIO } from './textos';

export function Landing({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma);
  return (
    <main>
      <section className="hero">
        <div className="hero-contenido">
          <h1>{t.heroTitulo}</h1>
          <p>{t.heroTexto}</p>
          <span className="sello">{t.heroBoton}</span>
        </div>
      </section>

      <nav className="menu-secciones" aria-label={t.comoTitulo}>
        <a href="#como">{t.menu.como}</a>
        <a href="#restaurantes">{t.menu.restaurantes}</a>
        <a href="#repartidores">{t.menu.repartidores}</a>
        <a href="#musica">{t.menu.musica}</a>
        <a href="#contacto">{t.menu.contacto}</a>
      </nav>

      <section id="como" className="seccion">
        <h2>{t.comoTitulo}</h2>
        <ol className="pasos">
          {t.comoPasos.map(([titulo, texto], i) => (
            <li key={titulo}>
              <span className="numero">{i + 1}</span>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="restaurantes" className="seccion alterna">
        <h2>{t.restTitulo}</h2>
        <p className="entrada">{t.restTexto}</p>
        <ul className="puntos">
          {t.restPuntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section id="repartidores" className="seccion">
        <h2>{t.repTitulo}</h2>
        <p className="entrada">{t.repTexto}</p>
        <ul className="puntos">
          {t.repPuntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section id="musica" className="seccion oscura">
        <h2>{t.musTitulo}</h2>
        <p className="entrada">{t.musTexto}</p>
      </section>

      <section id="contacto" className="seccion">
        <h2>{t.conTitulo}</h2>
        <p className="entrada">{t.conTexto}</p>
        <a className="boton" href={`mailto:${CONTACTO}`}>
          {CONTACTO}
        </a>
      </section>
    </main>
  );
}
