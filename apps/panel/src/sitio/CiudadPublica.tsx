import { type Idioma, enIdioma, perfilPasajeros } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { BannerArriba } from './BannerCarretera';
import { Icono } from './Icono';
import { CIUDADES, type Lugar } from './cobertura';
import {
  TEXTOS_CIUDAD,
  TEXTOS_TARIFAS,
  pagosDe,
  paisDeCiudad,
  precioDesdeOtra,
  preguntasTarifas,
  reemplazar as r,
} from './ciudadesPublicas';
import { fraseServicios, useCiudadesAbiertas } from './paisesAbiertos';
import {
  type PrecioPublico,
  type TarifasPublicas,
  CIUDADES_CON_TARIFAS,
  hora,
  monto,
  nombreCentro,
  nombreGrupo,
  porcentaje,
  useTarifas,
} from './tarifasCiudades';

/**
 * C-CIUDAD-ABIERTA-SIN-PRONTO (25 nov 2026, orden de Richard) — la página de una ciudad con `clave`
 * (las de Venezuela). Abierta: dice claro que ya funciona y con qué. Sin servicio abierto: qué es
 * Divoox, cómo se pide, cómo ser conductor y dónde funciona hoy; nunca «muy pronto» ni «ya disponible».
 */
export function PaginaCiudadPublica({ ciudad, idioma }: { ciudad: Lugar; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_CIUDAD, idioma);
  const nombre = enIdioma(ciudad.nombre, idioma);
  const pais = paisDeCiudad(ciudad);
  const nombrePais = pais ? enIdioma(pais.nombre, idioma) : '';
  const estadoCiudad = useCiudadesAbiertas();
  const estado = estadoCiudad(ciudad, pais?.codigo);
  const pagos = pagosDe(pais?.codigo, idioma);
  const edad = String(perfilPasajeros(pais?.codigo).edadMinima);
  const abiertasDelPais = CIUDADES.filter(
    (c) => c.pais === ciudad.pais && c.clave && estadoCiudad(c, pais?.codigo).abierta,
  );
  const otras = CIUDADES.filter((c) => c.pais === ciudad.pais && c.clave && c.slug !== ciudad.slug);
  // C-TARIFAS-PUBLICAS: el enlace a los precios y «De El Vigía a Tucaní» solo con lo que confirme
  // producción (lo guardado al publicar o, en el navegador, el servidor); una ciudad cerrada no pregunta.
  const propias = useTarifas(estado.abierta && ciudad.clave ? ciudad.clave : '');
  const otra = abiertasDelPais.find((c) => c.slug !== ciudad.slug && c.clave);
  const deOtra = useTarifas(estado.abierta && otra?.clave ? otra.clave : '');
  const tieneTarifas = Boolean(propias && (propias.grupos.length || propias.otros.length));
  const desdeOtra =
    otra?.clave && deOtra ? precioDesdeOtra(ciudad, { [otra.clave]: deOtra }) : null;
  return (
    <>
      <BannerArriba
        idioma={idioma}
        lugar={nombre}
        activo={estado.abierta}
        {...(estado.abierta
          ? { servicios: estado.servicios.map((s) => (idioma === 'en' ? s.en : s.es)).join(' · ') }
          : { lema: r(t.tituloCerrada, { ciudad: nombre }) })}
      />
      <main className="lugar lugar-ciudad">
        {pais ? (
          <Enlace a={`/country/${pais.slug}`} className="docs-volver">
            ← {nombrePais}
          </Enlace>
        ) : null}
        {estado.abierta ? (
          <span className="ld-etiqueta lugar-activo">
            <Icono nombre="listo" tamano={14} /> {t.etiquetaAbierta}
          </span>
        ) : null}
        <h1>{r(estado.abierta ? t.tituloAbierta : t.tituloCerrada, { ciudad: nombre })}</h1>
        <p className="ld-entrada">
          {estado.abierta
            ? r(t.entradaAbierta, {
                ciudad: nombre,
                servicios: fraseServicios(estado.servicios, idioma),
                pagos,
              })
            : r(t.entradaCerrada, { ciudad: nombre, estado: ciudad.estadoRegion ?? nombrePais })}
        </p>
        {!estado.abierta && abiertasDelPais.length > 0 ? (
          <p className="lugar-donde-hoy">
            {t.dondeHoy}{' '}
            {abiertasDelPais.map((c, k) => (
              <span key={c.slug}>
                {k === 0
                  ? ''
                  : k === abiertasDelPais.length - 1
                    ? idioma === 'en'
                      ? ' and '
                      : ' y '
                    : ', '}
                <Enlace a={`/city/${c.slug}`} className="lugar-enlace-ciudad">
                  {enIdioma(c.nombre, idioma)}
                </Enlace>
              </span>
            ))}
            . {t.dondeHoyFin}
          </p>
        ) : null}
        <section className="lugar-abierto">
          <Enlace a="/download" className="lugar-descargar">
            <Icono nombre="moto" tamano={18} /> {t.descargar}
          </Enlace>
          {tieneTarifas ? (
            <Enlace a={`/city/${ciudad.slug}/prices`} className="lugar-tarifas">
              {r(t.verTarifas, { ciudad: nombre })}
            </Enlace>
          ) : null}
        </section>
        {desdeOtra && estado.abierta ? (
          <p className="lugar-desde-otra">
            {r(t.desdeOtra, {
              desde: enIdioma(desdeOtra.desde.nombre, idioma),
              ciudad: nombre,
              precio: monto(desdeOtra.t, desdeOtra.precio, idioma),
            })}{' '}
            <Enlace a={`/city/${desdeOtra.desde.slug}/prices`}>
              {r(t.verTarifas, { ciudad: enIdioma(desdeOtra.desde.nombre, idioma) })}
            </Enlace>
          </p>
        ) : null}
        <section className="lugar-pasos">
          <h2>{estado.abierta ? t.comoPedir : t.comoPedirCerrada}</h2>
          <ol>
            {t.pasosPedir.map((p) => (
              <li key={p}>{r(p, { pagos })}</li>
            ))}
          </ol>
        </section>
        {ciudad.sobre ? (
          <section className="lugar-sobre">
            <h2>{r(t.sobre, { ciudad: nombre })}</h2>
            <p>{enIdioma(ciudad.sobre, idioma)}</p>
          </section>
        ) : null}
        <section className="lugar-manejar">
          <h2>{estado.abierta ? t.manejar : r(t.primerosTitulo, { ciudad: nombre })}</h2>
          <p>{r(t.manejarTexto, { edad })}</p>
          <Enlace a="/download" className="lugar-descargar lugar-descargar-claro">
            <Icono nombre="moto" tamano={18} /> {t.descargarDriver}
          </Enlace>
        </section>
        <section className="lugar-datos">
          <h2>{r(t.datos, { ciudad: nombre })}</h2>
          <dl>
            {ciudad.estadoRegion ? (
              <>
                <dt>{t.estadoRegion}</dt>
                <dd>{ciudad.estadoRegion}</dd>
              </>
            ) : null}
            {pais ? (
              <>
                <dt>{t.pais}</dt>
                <dd>
                  <Enlace a={`/country/${pais.slug}`}>{nombrePais}</Enlace>
                </dd>
              </>
            ) : null}
          </dl>
        </section>
        {otras.length > 0 && pais ? (
          <nav className="lugar-vecinos" aria-label={r(t.otras, { pais: nombrePais })}>
            <h2>{r(t.otras, { pais: nombrePais })}</h2>
            <ul>
              {otras.map((c) => (
                <li key={c.slug}>
                  <Enlace a={`/city/${c.slug}`}>{enIdioma(c.nombre, idioma)}</Enlace>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </main>
    </>
  );
}

/** La lista de ciudades de un país abierto, en su página: las abiertas en verde y el resto sin etiqueta. */
export function CiudadesDelPais({ pais, idioma }: { pais: Lugar; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_CIUDAD, idioma);
  const estadoCiudad = useCiudadesAbiertas();
  const xs = CIUDADES.filter((c) => c.pais === pais.slug && c.clave).map((c) => ({
    c,
    abierta: estadoCiudad(c, pais.codigo).abierta,
  }));
  if (!xs.length) return null;
  const abiertas = xs.filter((x) => x.abierta);
  const resto = xs.filter((x) => !x.abierta);
  const nombrePais = enIdioma(pais.nombre, idioma);
  return (
    <section className="lugar-ciudades lugar-ciudades-pais">
      <h2>{r(t.ciudadesPais, { pais: nombrePais })}</h2>
      {abiertas.length > 0 ? (
        <>
          <h3>{t.ciudadesAbiertas}</h3>
          <ul>
            {abiertas.map(({ c }) => (
              <li key={c.slug} className="activo">
                <Enlace a={`/city/${c.slug}`}>{enIdioma(c.nombre, idioma)}</Enlace>
                <span>
                  <Icono nombre="listo" tamano={12} /> {t.etiquetaAbierta}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {resto.length > 0 ? (
        <>
          <h3>{t.ciudadesMas}</h3>
          <ul>
            {resto.map(({ c }) => (
              <li key={c.slug}>
                <Enlace a={`/city/${c.slug}`}>{enIdioma(c.nombre, idioma)}</Enlace>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/** Preguntas frecuentes como lista de detalles (las mismas que van al FAQPage del HTML). */
export function Preguntas({
  titulo,
  preguntas,
}: {
  titulo: string;
  preguntas: [string, string][];
}) {
  if (!preguntas.length) return null;
  return (
    <section className="lugar-preguntas">
      <h2>{titulo}</h2>
      {preguntas.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </section>
  );
}

const fechaLarga = (iso: string, idioma: Idioma) =>
  new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));

/**
 * C-TARIFAS-PUBLICAS (25 nov 2026, encargo de Richard) — «Tarifas de mototaxi en El Vigía»
 * (/city/el-vigia/prices). Los precios salen de los datos que cobra el sistema (tarifasCiudades.ts).
 */
export function PaginaTarifas({ ciudad, idioma }: { ciudad: Lugar; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_TARIFAS, idioma);
  const tc = enIdioma(TEXTOS_CIUDAD, idioma);
  const nombre = enIdioma(ciudad.nombre, idioma);
  const tarifas = useTarifas(ciudad.clave ?? '');
  const pais = paisDeCiudad(ciudad);
  const pagos = pagosDe(pais?.codigo, idioma);
  const hay = Boolean(tarifas && (tarifas.grupos.length || tarifas.otros.length));
  return (
    <>
      <BannerArriba
        idioma={idioma}
        lugar={nombre}
        activo={hay}
        servicios={idioma === 'en' ? 'Moto taxi · Fixed prices' : 'Mototaxi · Precios fijos'}
      />
      <main className="lugar lugar-tarifas-pagina">
        <Enlace a={`/city/${ciudad.slug}`} className="docs-volver">
          {r(t.volverCiudad, { ciudad: nombre })}
        </Enlace>
        <span className="ld-etiqueta lugar-activo">
          <Icono nombre="listo" tamano={14} /> {t.etiqueta}
        </span>
        <h1>{r(t.titulo, { ciudad: nombre })}</h1>
        {tarifas && hay ? (
          <>
            <p className="ld-entrada">
              {r(t.entrada, { centro: nombreCentro(tarifas.centro ?? nombre, idioma) })}
            </p>
            <section className="tarifas-reglas">
              <h2>{t.comoFunciona}</h2>
              <ul>
                {t.reglas.map((x) => (
                  <li key={x}>{r(x, { pagos })}</li>
                ))}
                {tarifas.noche ? (
                  <li>
                    {r(t.noche, {
                      desde: hora(tarifas.noche.desdeH, idioma),
                      hasta: hora(tarifas.noche.hastaH, idioma),
                      ciudad: nombre,
                      porcentaje: porcentaje(tarifas.noche.recargoPb, idioma),
                    })}
                  </li>
                ) : null}
                {tarifas.minimo ? (
                  <li>{r(t.minimo, { minimo: monto(tarifas, tarifas.minimo.dia, idioma) })}</li>
                ) : null}
              </ul>
            </section>
            {tarifas.grupos.map((g) => (
              <TablaGrupo key={g.grupo ?? ''} tarifas={tarifas} grupo={g} idioma={idioma} />
            ))}
            {tarifas.otros.length > 0 ? (
              <section className="tarifas-grupo">
                <h2>{t.otros}</h2>
                <ul className="tarifas-otros">
                  {tarifas.otros.map((o) => (
                    <li key={`${o.desde}-${o.hasta}`}>
                      {o.desde} → {o.hasta}: <Precio t={tarifas} p={o.precio} idioma={idioma} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {tarifas.actualizado ? (
              <p className="tarifas-fecha">
                {r(t.actualizado, { fecha: fechaLarga(tarifas.actualizado, idioma) })}
              </p>
            ) : null}
            <section className="lugar-abierto">
              <Enlace a="/download" className="lugar-descargar">
                <Icono nombre="moto" tamano={18} /> {t.descargar}
              </Enlace>
              <Enlace a="/docs/ordering/local-fixed-price" className="lugar-tarifas">
                {t.guia}
              </Enlace>
            </section>
            <Preguntas
              titulo={tc.preguntas}
              preguntas={preguntasTarifas(ciudad, tarifas, idioma)}
            />
          </>
        ) : (
          <>
            <p className="ld-entrada">{r(t.sinPrecios, { ciudad: nombre })}</p>
            <section className="lugar-abierto">
              <Enlace a="/download" className="lugar-descargar">
                <Icono nombre="moto" tamano={18} /> {t.descargar}
              </Enlace>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Precio({ t, p, idioma }: { t: TarifasPublicas; p: PrecioPublico; idioma: Idioma }) {
  return (
    <>
      {monto(t, p.dia, idioma)}
      {p.noche ? ` · ${monto(t, p.noche, idioma)}` : ''}
    </>
  );
}

function TablaGrupo({
  tarifas,
  grupo,
  idioma,
}: {
  tarifas: TarifasPublicas;
  grupo: TarifasPublicas['grupos'][number];
  idioma: Idioma;
}) {
  const t = enIdioma(TEXTOS_TARIFAS, idioma);
  const titulo = nombreGrupo(grupo.grupo, idioma);
  const conNoche = Boolean(tarifas.noche);
  return (
    <section className="tarifas-grupo">
      <h2>{titulo}</h2>
      <table className="tarifas-tabla">
        <caption className="oculto">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{t.lugar}</th>
            <th scope="col">{t.dia}</th>
            {conNoche ? <th scope="col">{t.nocheCol}</th> : null}
          </tr>
        </thead>
        <tbody>
          {grupo.lugares.map((l) => {
            const base = l.ida ?? l.regreso;
            if (!base) return null;
            const notas: string[] = [];
            if (l.ida && l.regreso)
              notas.push(
                l.regreso.dia === l.ida.dia
                  ? t.mismoRegreso
                  : r(t.regresoA, { precio: monto(tarifas, l.regreso.dia, idioma) }),
              );
            else if (!l.ida && l.regreso) notas.push(t.regreso);
            if (l.idaVuelta)
              notas.push(r(t.idaVuelta, { precio: monto(tarifas, l.idaVuelta.dia, idioma) }));
            return (
              <tr key={l.lugar}>
                <th scope="row">
                  {l.lugar}
                  {notas.length ? <small>{notas.join(' · ')}</small> : null}
                </th>
                <td>{monto(tarifas, base.dia, idioma)}</td>
                {conNoche ? <td>{base.noche ? monto(tarifas, base.noche, idioma) : '—'}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** Para el prearmado y las pruebas: las ciudades con página de precios. */
export const RUTAS_TARIFAS = () =>
  CIUDADES.filter((c) => c.clave && CIUDADES_CON_TARIFAS.includes(c.clave)).map(
    (c) => `/city/${c.slug}/prices`,
  );
