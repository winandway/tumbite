import { type Idioma, enIdioma } from '@tumbite/compartido';
import { FormEspera } from './FormEspera';
import { MapaCobertura } from './MapaCobertura';
import { Buscador } from './Buscador';
import { Pizza } from './Pizza';
import {
  PantallaAlarma,
  PantallaBilletera,
  PantallaCarrito,
  PantallaLista,
  PantallaOferta,
  PantallaSeguimiento,
  Telefono,
} from './Telefono';
import { CONTACTO, TEXTOS_SITIO, WHATSAPP_SOPORTE } from './textos';

export function Landing({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma);
  return (
    <main className="ld">
      {/* 1 · Portada: los tres públicos desde el primer segundo */}
      <section className="ld-hero">
        <div className="ld-hero-texto">
          <span className="ld-etiqueta">{t.hero.etiqueta}</span>
          <h1>{t.hero.titulo}</h1>
          <p>{t.hero.texto}</p>
          <Buscador idioma={idioma} />
          <div className="ld-ctas">
            <a className="ld-cta" href="#comensales">
              🍕 {t.hero.pedir}
            </a>
            <a className="ld-cta" href="#restaurantes">
              🧑‍🍳 {t.hero.restaurante}
            </a>
            <a className="ld-cta" href="#repartidores">
              🛵 {t.hero.repartir}
            </a>
          </div>
          <div className="ld-tiendas">
            <span> App Store</span>
            <span>▶ Google Play</span>
            <small>{t.hero.tiendas}</small>
          </div>
        </div>
        <div className="ld-hero-pizza" aria-hidden="true">
          <Pizza className="ld-pizza" />
        </div>
      </section>

      <ul className="ld-ventajas">
        {t.ventajas.map(([icono, fuerte, suave]) => (
          <li key={fuerte}>
            <span aria-hidden="true">{icono}</span>
            <strong>{fuerte}</strong>
            <small>{suave}</small>
          </li>
        ))}
      </ul>

      {/* 2 · Comensales */}
      <section id="comensales" className="ld-seccion">
        <span className="ld-etiqueta">{t.comensales.etiqueta}</span>
        <h2>{t.comensales.titulo}</h2>
        <ol className="ld-pasos">
          {t.comensales.pasos.map(([titulo, texto], i) => (
            <li key={titulo}>
              <Telefono etiqueta={titulo ?? ''}>
                {i === 0 ? (
                  <PantallaLista idioma={idioma} />
                ) : i === 1 ? (
                  <PantallaCarrito idioma={idioma} />
                ) : (
                  <PantallaSeguimiento idioma={idioma} />
                )}
              </Telefono>
              <div className="ld-paso-texto">
                <span className="numero">{i + 1}</span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="ld-nota">🎂 {t.comensales.fidelidad}</p>
        <FormEspera tipo="comensal" idioma={idioma} titulo={t.comensales.form} />
      </section>

      {/* 3 · Restaurantes */}
      <section id="restaurantes" className="ld-seccion ld-clara">
        <span className="ld-etiqueta">{t.restaurantes.etiqueta}</span>
        <h2>{t.restaurantes.titulo}</h2>
        <p className="ld-entrada">{t.restaurantes.texto}</p>
        <div className="ld-planes">
          {t.restaurantes.planes.map(([nombre, nuestra, otros, texto], i) => (
            <article key={nombre} className={i === 1 ? 'destacado' : undefined}>
              <h3>{nombre}</h3>
              <p className="ld-precio">
                {nuestra}
                <small> {t.restaurantes.comision}</small>
              </p>
              <p className="ld-tachado">
                {otros} {t.restaurantes.otros}
              </p>
              <p>{texto}</p>
            </article>
          ))}
        </div>
        <div className="ld-con-tel">
          <ul className="ld-funciones">
            {t.restaurantes.funciones.map(([icono, titulo, texto]) => (
              <li key={titulo}>
                <span aria-hidden="true">{icono}</span>
                <div>
                  <strong>{titulo}</strong>
                  <p>{texto}</p>
                </div>
              </li>
            ))}
          </ul>
          <Telefono etiqueta={t.restaurantes.funciones[0]?.[1] ?? ''}>
            <PantallaAlarma idioma={idioma} />
          </Telefono>
        </div>
        <FormEspera tipo="restaurante" idioma={idioma} titulo={t.restaurantes.form} />
      </section>

      {/* 4 · Repartidores */}
      <section id="repartidores" className="ld-seccion">
        <span className="ld-etiqueta">{t.repartidores.etiqueta}</span>
        <h2>{t.repartidores.titulo}</h2>
        <div className="ld-con-tel">
          <div className="ld-dos-tels">
            <Telefono etiqueta={t.pantallas.oferta} inclinado="izq">
              <PantallaOferta idioma={idioma} />
            </Telefono>
            <Telefono etiqueta="Wallet" inclinado="der">
              <PantallaBilletera idioma={idioma} />
            </Telefono>
          </div>
          <ul className="ld-funciones">
            {t.repartidores.puntos.map(([icono, titulo, texto]) => (
              <li key={titulo}>
                <span aria-hidden="true">{icono}</span>
                <div>
                  <strong>{titulo}</strong>
                  <p>{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <FormEspera tipo="repartidor" idioma={idioma} titulo={t.repartidores.form} />
      </section>

      {/* 5 · Mapa */}
      <section id="como" className="ld-seccion ld-clara ld-mapa">
        <div>
          <span className="ld-etiqueta">{t.mapa.etiqueta}</span>
          <h2>{t.mapa.titulo}</h2>
          <p className="ld-entrada">{t.mapa.texto}</p>
          <a className="boton" href="#comensales">
            {t.hero.pedir}
          </a>
        </div>
        <MapaCobertura idioma={idioma} />
      </section>

      {/* 6 · Música */}
      <section className="ld-seccion ld-oscura">
        <span className="ld-etiqueta">🎺 {t.musica.etiqueta}</span>
        <h2>{t.musica.titulo}</h2>
        <p className="ld-entrada">{t.musica.texto}</p>
      </section>

      {/* 7 · Preguntas */}
      <section className="ld-seccion">
        <h2>{t.preguntas.titulo}</h2>
        <div className="ld-preguntas">
          {t.preguntas.lista.map(([p, r]) => (
            <details key={p}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 8 · Soporte humano */}
      <section className="ld-seccion ld-soporte">
        <h2>💬 {t.soporte.titulo}</h2>
        <p className="ld-entrada">{t.soporte.texto}</p>
        <div className="fila-botones">
          {WHATSAPP_SOPORTE && (
            <a
              className="boton ld-whatsapp"
              href={`https://wa.me/${WHATSAPP_SOPORTE}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.soporte.whatsapp}
            </a>
          )}
          <a className="boton secundario" href={`mailto:${CONTACTO}`}>
            {t.soporte.correo}
          </a>
        </div>
      </section>
    </main>
  );
}
