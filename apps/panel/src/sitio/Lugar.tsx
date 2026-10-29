import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { BannerArriba } from './BannerCarretera';
import { FormEspera } from './FormEspera';
import { Icono } from './Icono';
import {
  CIUDADES,
  PAISES,
  REGIONES,
  type Lugar as DatosLugar,
  ciudadDe,
  cocinaDe,
  ciudadEnIdioma,
  paisDe,
  paisEnFrase,
} from './cobertura';
import { TEXTOS_SITIO } from './textos';
import { useCiudadesEnVivo } from './ciudadesEnVivo';

/**
 * Páginas por país, por ciudad y por tipo de comida (/country/x, /city/x, /food/x).
 * Cada una es su propia página para el SEO: título claro, estado, texto y la lista de espera.
 */
export function PaginaLugar({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).lugar;
  const [, tipo, slug] = ruta.split('/');
  const pais = tipo === 'country' ? paisDe(slug ?? '') : null;
  const ciudad = tipo === 'city' ? ciudadDe(slug ?? '') : null;
  const cocina = tipo === 'food' ? cocinaDe(slug ?? '') : null;
  const estadoCiudad = useCiudadesEnVivo();

  if (cocina) {
    const nombre = enIdioma(cocina.nombre, idioma);
    return (
      <>
        <BannerArriba idioma={idioma} />
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
      </>
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
  // Dentro de una frase en inglés: «in the Netherlands», no «in Netherlands».
  const frase = pais ? paisEnFrase(pais, idioma) : nombre;
  const activo = (ciudad ? estadoCiudad(ciudad) : lugar.estado) === 'activo';
  const ciudadesDelPais = pais ? CIUDADES.filter((c) => c.pais === pais.slug) : [];
  const paisDeCiudad = ciudad ? PAISES.find((p) => p.slug === ciudad.pais) : null;
  const region = pais?.region ? (REGIONES.find((r) => r.id === pais.region) ?? null) : null;
  // Enlaces internos a los países de la misma región (ayudan a Google a recorrer el sitio).
  const vecinos = pais
    ? PAISES.filter((p) => p.region === pais.region && p.slug !== pais.slug)
    : [];

  return (
    <>
      <BannerArriba idioma={idioma} lugar={nombre} activo={activo} />
      <main className="lugar">
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
        <span className={`ld-etiqueta ${activo ? 'lugar-activo' : 'lugar-pronto'}`}>
          <Icono nombre={activo ? 'listo' : 'reloj'} tamano={14} /> {activo ? t.activo : t.pronto}
        </span>
        <h1>{(activo ? t.tituloActivo : t.tituloPronto).replace('{lugar}', frase)}</h1>
        <p className="ld-entrada">
          {(activo ? t.textoActivo : t.textoPronto).replace(/\{lugar\}/g, frase)}
          {paisDeCiudad ? ` ${t.enPais.replace('{pais}', paisEnFrase(paisDeCiudad, idioma))}` : ''}
        </p>
        {pais?.primerasCiudades && pais.primerasCiudades.length > 0 && (
          <section className="lugar-datos">
            <h2>{t.primerasCiudades.replace('{lugar}', frase)}</h2>
            <p>
              {t.primerasCiudadesTexto.replace('{lugar}', frase).replace(
                '{ciudades}',
                listaHumana(
                  pais.primerasCiudades.map((c) => ciudadEnIdioma(c, idioma)),
                  idioma,
                ),
              )}
            </p>
            <dl>
              {pais.idioma && (
                <>
                  <dt>{t.idioma}</dt>
                  <dd>{enIdioma(pais.idioma, idioma)}</dd>
                </>
              )}
              {pais.moneda && (
                <>
                  <dt>{t.moneda}</dt>
                  <dd>{enIdioma(pais.moneda, idioma)}</dd>
                </>
              )}
              {region && (
                <>
                  <dt>{t.region}</dt>
                  <dd>{enIdioma(region.nombre, idioma)}</dd>
                </>
              )}
            </dl>
          </section>
        )}
        {ciudadesDelPais.length > 0 && (
          <section className="lugar-ciudades">
            <h2>{t.ciudadesDe.replace('{lugar}', frase)}</h2>
            <ul>
              {ciudadesDelPais.map((c) => (
                <li key={c.slug} className={estadoCiudad(c)}>
                  <Enlace a={`/city/${c.slug}`}>{enIdioma(c.nombre, idioma)}</Enlace>
                  <span>{estadoCiudad(c) === 'activo' ? t.activo : t.pronto}</span>
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
        {pais && !activo && (
          <section className="lugar-franquicia">
            <h2>{t.franquiciaTitulo.replace('{lugar}', nombre)}</h2>
            <p>{t.franquiciaTexto}</p>
            <Enlace a="/franchise">{t.franquiciaEnlace}</Enlace>
          </section>
        )}
        <FormEspera tipo="comensal" idioma={idioma} titulo={t.avisame} />
        <FormEspera tipo="restaurante" idioma={idioma} titulo={t.quieroRestaurante} />
        <FormEspera tipo="repartidor" idioma={idioma} titulo={t.quieroRepartir} />
        {vecinos.length > 0 && region && (
          <nav className="lugar-vecinos" aria-label={t.otrosPaises.replace('{region}', '')}>
            <h2>{t.otrosPaises.replace('{region}', enIdioma(region.nombre, idioma))}</h2>
            <ul>
              {vecinos.map((v) => (
                <li key={v.slug}>
                  <Enlace a={`/country/${v.slug}`}>{enIdioma(v.nombre, idioma)}</Enlace>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
    </>
  );
}

/** «A, B y C» / «A, B, and C». */
function listaHumana(xs: string[], idioma: Idioma): string {
  if (xs.length < 2) return xs.join('');
  const y = idioma === 'en' ? (xs.length > 2 ? ', and ' : ' and ') : ' y ';
  return `${xs.slice(0, -1).join(', ')}${y}${xs.at(-1) ?? ''}`;
}
