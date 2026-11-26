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
import { fraseServicios, listaHumana, useMapaCiudades, usePaisesAbiertos } from './paisesAbiertos';
import { CiudadesDelPais, PaginaCiudadPublica, PaginaTarifas, Preguntas } from './CiudadPublica';
import { TEXTOS_CIUDAD, ciudadConTarifas, preguntasPais } from './ciudadesPublicas';
import { TARIFAS_PUBLICADAS } from './tarifasCiudades';

/**
 * Páginas por país, por ciudad y por tipo de comida (/country/x, /city/x, /food/x).
 * Cada una es su propia página para el SEO: título claro, estado, texto y la lista de espera.
 */
export function PaginaLugar({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).lugar;
  const [, tipo, slug, sub] = ruta.split('/');
  const pais = tipo === 'country' ? paisDe(slug ?? '') : null;
  const ciudad = tipo === 'city' ? ciudadDe(slug ?? '') : null;
  const cocina = tipo === 'food' ? cocinaDe(slug ?? '') : null;
  const estadoCiudad = useCiudadesEnVivo();
  const estadoPais = usePaisesAbiertos();
  const mapaCiudades = useMapaCiudades();

  // C-TARIFAS-PUBLICAS: /city/el-vigia/prices (solo ciudades con clave; lo demás no existe).
  if (sub !== undefined) {
    if (sub === 'prices' && ciudad?.clave && !pais && !cocina)
      return <PaginaTarifas ciudad={ciudad} idioma={idioma} />;
    return (
      <main className="lugar">
        <h1>{t.noExiste}</h1>
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
      </main>
    );
  }
  // C-CIUDAD-ABIERTA-SIN-PRONTO: una ciudad con clave (Venezuela) dice lo que de verdad tiene abierto.
  if (ciudad?.clave) return <PaginaCiudadPublica ciudad={ciudad} idioma={idioma} />;

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
  // C-PAIS-ABIERTO-SIN-PRONTO: un país con un servicio abierto (Venezuela con Moto) dice «Ya estamos»
  // con lo que de verdad funciona allí; nunca «muy pronto» ni promete lo que no está abierto.
  const ep = pais ? estadoPais(pais) : null;
  const abierto = ep?.abierto ?? false;
  const serviciosAbiertos = ep?.servicios ?? [];
  const activo = (ciudad ? estadoCiudad(ciudad) : (ep?.estado ?? lugar.estado)) === 'activo';
  // Las ciudades con clave van en su propia sección (CiudadesDelPais), sin «muy pronto».
  const ciudadesDelPais = pais ? CIUDADES.filter((c) => c.pais === pais.slug && !c.clave) : [];
  const tc = enIdioma(TEXTOS_CIUDAD, idioma);
  const conTarifas = pais ? ciudadConTarifas(pais.slug) : null;
  const paisDeCiudad = ciudad ? PAISES.find((p) => p.slug === ciudad.pais) : null;
  const region = pais?.region ? (REGIONES.find((r) => r.id === pais.region) ?? null) : null;
  // Enlaces internos a los países de la misma región (ayudan a Google a recorrer el sitio).
  const vecinos = pais
    ? PAISES.filter((p) => p.region === pais.region && p.slug !== pais.slug)
    : [];

  return (
    <>
      <BannerArriba
        idioma={idioma}
        lugar={nombre}
        activo={activo}
        servicios={
          abierto
            ? serviciosAbiertos.map((x) => (idioma === 'en' ? x.en : x.es)).join(' · ')
            : undefined
        }
      />
      <main className="lugar">
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
        <span className={`ld-etiqueta ${activo ? 'lugar-activo' : 'lugar-pronto'}`}>
          <Icono nombre={activo ? 'listo' : 'reloj'} tamano={14} /> {activo ? t.activo : t.pronto}
        </span>
        <h1>
          {(abierto ? t.tituloAbierto : activo ? t.tituloActivo : t.tituloPronto).replace(
            '{lugar}',
            frase,
          )}
        </h1>
        <p className="ld-entrada">
          {abierto
            ? t.textoAbierto
                .replace(/\{lugar\}/g, frase)
                .replace('{servicios}', fraseServicios(serviciosAbiertos, idioma))
            : (activo ? t.textoActivo : t.textoPronto).replace(/\{lugar\}/g, frase)}
          {paisDeCiudad ? ` ${t.enPais.replace('{pais}', paisEnFrase(paisDeCiudad, idioma))}` : ''}
        </p>
        {abierto && (
          <section className="lugar-abierto">
            <Enlace a="/download" className="lugar-descargar">
              <Icono nombre="moto" tamano={18} /> {t.descargar}
            </Enlace>
          </section>
        )}
        {abierto && pais && (
          // C-CIUDAD-ABIERTA-SIN-PRONTO (25 nov 2026, orden nueva de Richard): la web pública SÍ
          // enlaza las páginas de ciudad del país (las apps siguen sin listar ciudades).
          <>
            <CiudadesDelPais pais={pais} idioma={idioma} />
            {conTarifas ? (
              <p>
                <Enlace a={`/city/${conTarifas.slug}/prices`} className="lugar-tarifas">
                  {tc.verTarifas.replace('{ciudad}', enIdioma(conTarifas.nombre, idioma))}
                </Enlace>
              </p>
            ) : null}
            <section className="lugar-datos">
              <h2>{t.datos.replace('{lugar}', frase)}</h2>
              <DatosPais pais={pais} idioma={idioma} region={region} t={t} />
            </section>
            <Preguntas
              titulo={tc.preguntas}
              preguntas={preguntasPais(pais, idioma, {
                ciudades: mapaCiudades,
                tarifas: TARIFAS_PUBLICADAS,
              })}
            />
          </>
        )}
        {!abierto && pais?.primerasCiudades && pais.primerasCiudades.length > 0 && (
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
            <DatosPais pais={pais} idioma={idioma} region={region} t={t} />
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
        {!abierto && (
          <section className="lugar-publicos">
            <h2>{t.tresPublicos}</h2>
            <ul>
              <li>{t.paraComensales}</li>
              <li>{t.paraRestaurantes}</li>
              <li>{t.paraRepartidores}</li>
            </ul>
          </section>
        )}
        {pais && !activo && (
          <section className="lugar-franquicia">
            <h2>{t.franquiciaTitulo.replace('{lugar}', nombre)}</h2>
            <p>{t.franquiciaTexto}</p>
            <Enlace a="/franchise">{t.franquiciaEnlace}</Enlace>
          </section>
        )}
        {!abierto && (
          <>
            <FormEspera tipo="comensal" idioma={idioma} titulo={t.avisame} />
            <FormEspera tipo="restaurante" idioma={idioma} titulo={t.quieroRestaurante} />
            <FormEspera tipo="repartidor" idioma={idioma} titulo={t.quieroRepartir} />
          </>
        )}
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

type TextosLugar = (typeof TEXTOS_SITIO)['es']['lugar'];

/** Idioma de la app, moneda y región del país. */
function DatosPais({
  pais,
  idioma,
  region,
  t,
}: {
  pais: DatosLugar;
  idioma: Idioma;
  region: (typeof REGIONES)[number] | null;
  t: TextosLugar;
}) {
  return (
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
  );
}
