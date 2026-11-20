import { Fragment, type ReactNode } from 'react';
import {
  correoLimpio,
  trozosDeCorreo,
  textosRevisar,
  type CasillaRegistro,
  type FilaRevision,
  type Idioma,
} from '@tumbite/compartido';
import { SugerenciaCorreo } from './SugerenciaCorreo';

/**
 * C-REVISA-TUS-DATOS (19 nov 2026, orden de Richard) — todos los países. En la web, antes de crear la
 * cuenta: el correo arriba y en grande (ahí llega el enlace para activarla), los demás datos debajo,
 * cada uno con «Editar». La cuenta se crea SOLO con el toque en «Crear mi cuenta» (`alCrear`).
 * La contraseña nunca se muestra.
 */
export function RevisaTusDatos({
  idioma,
  correo,
  filas,
  enviando,
  error,
  alEditar,
  alEditarDatos,
  alCrear,
  aceptarCorreo,
  children,
}: {
  idioma: Idioma;
  correo: string;
  filas: FilaRevision[];
  enviando: boolean;
  error?: string | null;
  alEditar: (campo: CasillaRegistro) => void;
  alEditarDatos: () => void;
  alCrear: () => void;
  aceptarCorreo: (correo: string) => void;
  /** El escudo anti-robots, a la vista donde se crea la cuenta. */
  children?: ReactNode;
}) {
  const r = textosRevisar(idioma);
  return (
    <section
      className="revisa-datos"
      data-testid="revisa-tus-datos"
      aria-labelledby="revisa-titulo"
    >
      <h2 id="revisa-titulo">{r.titulo}</h2>
      <p className="revisa-intro">{r.intro}</p>
      <div className="revisa-tarjeta">
        <div className="revisa-fila-cabeza">
          <span className="revisa-etiqueta">{r.etiquetaCorreo}</span>
          <button
            type="button"
            className="enlace"
            data-testid="editar-correo"
            aria-label={`${r.editar}: ${r.etiquetaCorreo}`}
            onClick={() => alEditar('correo')}
          >
            {r.editar}
          </button>
        </div>
        <p className="revisa-correo" data-testid="revisar-correo">
          {/* Un correo largo se parte en los puntos y guiones, nunca a media palabra. */}
          {trozosDeCorreo(correoLimpio(correo)).map((trozo, i) => (
            <Fragment key={`${i}-${trozo}`}>
              {trozo}
              <wbr />
            </Fragment>
          ))}
        </p>
        <p className="revisa-pregunta">{r.correoPregunta}</p>
        <SugerenciaCorreo correo={correo} idioma={idioma} aceptar={aceptarCorreo} />
      </div>
      {filas.length > 0 && (
        <dl className="revisa-tarjeta revisa-lista">
          {filas.map((f) => (
            <div key={f.campo} className="revisa-dato">
              <div>
                <dt className="revisa-etiqueta">{f.etiqueta}</dt>
                <dd data-testid={`revisar-${f.campo}`}>{f.valor}</dd>
              </div>
              <button
                type="button"
                className="enlace"
                data-testid={`editar-${f.campo}`}
                aria-label={`${r.editar}: ${f.etiqueta}`}
                onClick={() => alEditar(f.campo)}
              >
                {r.editar}
              </button>
            </div>
          ))}
        </dl>
      )}
      {children}
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="boton ancho"
        data-testid="crear-mi-cuenta"
        disabled={enviando}
        onClick={alCrear}
      >
        {enviando ? r.creando : r.crearMiCuenta}
      </button>
      <button
        type="button"
        className="boton ancho secundario"
        data-testid="editar-datos"
        disabled={enviando}
        onClick={alEditarDatos}
      >
        {r.editarDatos}
      </button>
    </section>
  );
}
