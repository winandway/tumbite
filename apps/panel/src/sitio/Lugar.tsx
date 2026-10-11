import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { FormEspera } from './FormEspera';
import { Icono } from './Icono';
import {
  CIUDADES,
  PAISES,
  type Lugar as DatosLugar,
  ciudadDe,
  cocinaDe,
  paisDe,
} from './cobertura';
import { TEXTOS_SITIO } from './textos';

/**
 * Páginas por país, por ciudad y por tipo de comida (/pais/x, /ciudad/x, /comida/x).
 * Cada una es su propia página para el SEO: título claro, estado, texto y la lista de espera.
 */
export function PaginaLugar({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).lugar;
  const [, tipo, slug] = ruta.split('/');
  const pais = tipo === 'pais' ? paisDe(slug ?? '') : null;
  const ciudad = tipo === 'ciudad' ? ciudadDe(slug ?? '') : null;
  const cocina = tipo === 'comida' ? cocinaDe(slug ?? '') : null;

  if (cocina) {
    const nombre = enIdioma(cocina.nombre, idioma);
    return (
      <main className="lugar">
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
        <span className="ld-etiqueta">{t.comida}</span>
        <h1>{t.cocinaTitulo.replace('{comida}', nombre)}</h1>
        <p className="ld-entrada">{t.cocinaTexto.replace('{comida}', nombre.toLowerCase())}</p>
        <FormEspera tipo="comensal" idioma={idioma} titulo={t.avisame} />
        <h2>{t.restauranteCocina.replace('{comida}', nombre.toLowerCase())}</h2>
        <FormEspera tipo="restaurante" idioma={idioma} titulo={t.quieroRestaurante} />
      </main>
    );
  }

  const lugar: DatosLugar | null = pais ?? ciudad;
  if (!lugar) {
    return (
      <main className="lugar">
        <h1>{t.noExiste}</h1>
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
      </main>
    );
  }
  const nombre = enIdioma(lugar.nombre, idioma);
  const activo = lugar.estado === 'activo';
  const ciudadesDelPais = pais ? CIUDADES.filter((c) => c.pais === pais.slug) : [];
  const paisDeCiudad = ciudad ? PAISES.find((p) => p.slug === ciudad.pais) : null;

  return (
    <main className="lugar">
      <Enlace a="/" className="docs-volver">
        {t.volver}
      </Enlace>
      <span className={`ld-etiqueta ${activo ? 'lugar-activo' : 'lugar-pronto'}`}>
        <Icono nombre={activo ? 'listo' : 'reloj'} tamano={14} /> {activo ? t.activo : t.pronto}
      </span>
      <h1>{(activo ? t.tituloActivo : t.tituloPronto).replace('{lugar}', nombre)}</h1>
      <p className="ld-entrada">
        {(activo ? t.textoActivo : t.textoPronto).replace(/\{lugar\}/g, nombre)}
        {paisDeCiudad
          ? ` ${t.enPais.replace('{pais}', enIdioma(paisDeCiudad.nombre, idioma))}`
          : ''}
      </p>
      {ciudadesDelPais.length > 0 && (
        <section className="lugar-ciudades">
          <h2>{t.ciudadesDe.replace('{lugar}', nombre)}</h2>
          <ul>
            {ciudadesDelPais.map((c) => (
              <li key={c.slug} className={c.estado}>
                <Enlace a={`/ciudad/${c.slug}`}>{enIdioma(c.nombre, idioma)}</Enlace>
                <span>{c.estado === 'activo' ? t.activo : t.pronto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="lugar-publicos">
        <h2>{t.tresPublicos}</h2>
        <ul>
          <li>{t.paraComensales}</li>
          <li>{t.paraRestaurantes}</li>
          <li>{t.paraRepartidores}</li>
        </ul>
      </section>
      <FormEspera tipo="comensal" idioma={idioma} titulo={t.avisame} />
      <FormEspera tipo="restaurante" idioma={idioma} titulo={t.quieroRestaurante} />
      <FormEspera tipo="repartidor" idioma={idioma} titulo={t.quieroRepartir} />
    </main>
  );
}
