import { useEffect, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Buscador } from './Buscador';
import { FormEspera } from './FormEspera';
import { Icono, type NombreIcono } from './Icono';
import { LogoApple, LogoGooglePlay } from './Tiendas';
import { MapaCobertura } from './MapaCobertura';
import { CONTACTO, TEXTOS_SITIO } from './textos';

/** Imágenes del kit de marca aprobado (logo-imagenes-banner-marketing), optimizadas en public/marca. */
const IMG = {
  inicio: '/marca/app-inicio.webp',
  pizzeria: '/marca/app-pizzeria.webp',
  seguimiento: '/marca/app-seguimiento.webp',
  restaurante: '/marca/entrega-restaurante.webp',
  repartidor: '/marca/repartidor.webp',
  miami: '/marca/cartel-miami.webp',
  local: '/marca/local-tumbite.webp',
  mascota: '/marca/mascota.webp',
  banner: { es: '/marca/banner-es.webp', en: '/marca/banner-en.webp' },
};

const ALT = {
  es: {
    pantallas: [
      'App de Tumbite: restaurantes cerca de ti',
      'App de Tumbite: menú de una pizzería',
      'App de Tumbite: seguimiento del pedido en el mapa',
    ],
    banner: 'Tus antojos en minutos con Tumbite',
    restaurante: 'Un repartidor de Tumbite recoge un pedido en el mostrador de un restaurante',
    repartidor: 'Repartidor de Tumbite en su moto por Miami',
    miami: 'Cartel de Tumbite en una autopista de Miami',
    local: 'Local de Tumbite',
    mascota: 'Mascota de Tumbite',
  },
  en: {
    pantallas: [
      'Tumbite app: restaurants near you',
      'Tumbite app: a pizzeria menu',
      'Tumbite app: order tracking on the map',
    ],
    banner: 'Your cravings in minutes with Tumbite',
    restaurante: 'A Tumbite driver picks up an order at a restaurant counter',
    repartidor: 'Tumbite driver on a bike in Miami',
    miami: 'Tumbite billboard on a Miami highway',
    local: 'Tumbite storefront',
    mascota: 'Tumbite mascot',
  },
};

export function Landing({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma);
  const a = enIdioma(ALT, idioma);
  // El WhatsApp de soporte lo da el servidor (variable del sitio): aparece solo cuando exista.
  const [whatsapp, setWhatsapp] = useState('');
  useEffect(() => {
    fetch('/datos/publico')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { whatsapp?: string } | null) => setWhatsapp(d?.whatsapp ?? ''))
      .catch(() => setWhatsapp(''));
  }, []);
  return (
    <main className="ld">
      {/* 1 · Portada estilo Uber Eats: titular, buscador de dirección y la app con pizzas */}
      <section className="ld-hero">
        <div className="ld-hero-texto">
          <span className="ld-etiqueta">{t.hero.etiqueta}</span>
          <h1>{t.hero.titulo}</h1>
          <p>{t.hero.texto}</p>
          <Buscador idioma={idioma} />
          <div className="ld-ctas">
            <a className="ld-cta" href="/app/">
              <Icono nombre="pizza" tamano={18} /> {t.hero.pedir}
            </a>
            <a className="ld-cta" href="/panel">
              <Icono nombre="chef" tamano={18} /> {t.hero.restaurante}
            </a>
            <a className="ld-cta" href="#drivers">
              <Icono nombre="moto" tamano={18} /> {t.hero.repartir}
            </a>
          </div>
          <div className="ld-tiendas">
            <span>
              <LogoApple /> App Store
            </span>
            <span>
              <LogoGooglePlay /> Google Play
            </span>
            <small>{t.hero.tiendas}</small>
          </div>
        </div>
        <div className="ld-hero-apps">
          <img
            src={IMG.pizzeria}
            alt={a.pantallas[1]}
            width={260}
            height={536}
            className="ld-app ld-app-atras"
          />
          <img
            src={IMG.inicio}
            alt={a.pantallas[0]}
            width={260}
            height={557}
            className="ld-app"
            fetchPriority="high"
          />
        </div>
      </section>

      {/* Los tres caminos, claros y arriba: nadie tiene que adivinar ni bajar. */}
      <section className="ld-entradas" aria-label={t.hero.pedir}>
        {t.hero.entradas.map(([titulo, texto, boton], i) => {
          const destino = ['/app/', '/panel', '#drivers'].at(i) ?? '/';
          const icono = (['pizza', 'chef', 'moto'] as const).at(i) ?? 'pizza';
          return (
            <a key={titulo} className="ld-entrada-tarjeta" href={destino}>
              <span className="ld-icono">
                <Icono nombre={icono} tamano={26} />
              </span>
              <strong>{titulo}</strong>
              <p>{texto}</p>
              <span className="boton">{boton}</span>
            </a>
          );
        })}
      </section>

      <ul className="ld-ventajas">
        {t.ventajas.map(([icono, fuerte, suave]) => (
          <li key={fuerte}>
            <span className="ld-icono">
              <Icono nombre={icono as NombreIcono} />
            </span>
            <strong>{fuerte}</strong>
            <small>{suave}</small>
          </li>
        ))}
      </ul>

      <div className="ld-banner">
        <img
          src={enIdioma(IMG.banner, idioma)}
          alt={a.banner}
          width={1800}
          height={663}
          loading="lazy"
        />
      </div>

      {/* 2 · Comensales: los tres pasos con las pantallas reales */}
      <section id="customers" className="ld-seccion">
        <span className="ld-etiqueta">{t.comensales.etiqueta}</span>
        <h2>{t.comensales.titulo}</h2>
        <ol className="ld-pasos">
          {t.comensales.pasos.map(([titulo, texto], i) => (
            <li key={titulo}>
              <img
                className="ld-app"
                src={[IMG.inicio, IMG.pizzeria, IMG.seguimiento].at(i)}
                alt={a.pantallas.at(i) ?? ''}
                width={240}
                height={510}
                loading="lazy"
              />
              <div className="ld-paso-texto">
                <span className="numero">{i + 1}</span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="ld-nota">
          <Icono nombre="cumple" /> {t.comensales.fidelidad}
        </p>
        <FormEspera tipo="comensal" idioma={idioma} titulo={t.comensales.form} />
      </section>

      {/* 3 · Restaurantes */}
      <section id="restaurants" className="ld-seccion ld-clara">
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
        <div className="ld-con-foto">
          <img
            className="ld-foto"
            src={IMG.restaurante}
            alt={a.restaurante}
            width={1200}
            height={800}
            loading="lazy"
          />
          <ul className="ld-funciones">
            {t.restaurantes.funciones.map(([icono, titulo, texto]) => (
              <li key={titulo}>
                <span className="ld-icono">
                  <Icono nombre={icono as NombreIcono} />
                </span>
                <div>
                  <strong>{titulo}</strong>
                  <p>{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <FormEspera tipo="restaurante" idioma={idioma} titulo={t.restaurantes.form} />
      </section>

      {/* 4 · Repartidores */}
      <section id="drivers" className="ld-seccion">
        <span className="ld-etiqueta">{t.repartidores.etiqueta}</span>
        <h2>{t.repartidores.titulo}</h2>
        <div className="ld-con-foto">
          <img
            className="ld-foto ld-foto-alta"
            src={IMG.repartidor}
            alt={a.repartidor}
            width={900}
            height={1350}
            loading="lazy"
          />
          <ul className="ld-funciones">
            {t.repartidores.puntos.map(([icono, titulo, texto]) => (
              <li key={titulo}>
                <span className="ld-icono">
                  <Icono nombre={icono as NombreIcono} />
                </span>
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

      {/* 5 · Dónde estamos */}
      <section id="como" className="ld-seccion ld-clara ld-mapa">
        <div>
          <span className="ld-etiqueta">{t.mapa.etiqueta}</span>
          <h2>{t.mapa.titulo}</h2>
          <p className="ld-entrada">{t.mapa.texto}</p>
          <img
            className="ld-foto"
            src={IMG.miami}
            alt={a.miami}
            width={1400}
            height={933}
            loading="lazy"
          />
        </div>
        <MapaCobertura idioma={idioma} />
      </section>

      {/* 6 · Música */}
      <section className="ld-seccion ld-oscura ld-musica">
        <span className="ld-etiqueta">
          <Icono nombre="musica" tamano={16} /> {t.musica.etiqueta}
        </span>
        <h2>{t.musica.titulo}</h2>
        <p className="ld-entrada">{t.musica.texto}</p>
        <img
          className="ld-foto"
          src={IMG.local}
          alt={a.local}
          width={1400}
          height={933}
          loading="lazy"
        />
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
        <img
          className="ld-mascota"
          src={IMG.mascota}
          alt={a.mascota}
          width={260}
          height={172}
          loading="lazy"
        />
        <h2>{t.soporte.titulo}</h2>
        <p className="ld-entrada">{t.soporte.texto}</p>
        <div className="fila-botones">
          {whatsapp && (
            <a
              className="boton ld-whatsapp"
              href={`https://wa.me/${whatsapp}`}
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
