import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  crearCatalogoLugares,
  estadoDelPais,
  estadoEscrito,
  lugarEscrito,
  nombrePais,
  paisesParaElegir,
  textosSelectorLugar,
  useSelectorLugar,
  type Idioma,
  type LugarCuenta,
  type ResultadoLugar,
} from '@tumbite/compartido';
import './selectorLugar.css';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026) — Venezuela y Estados Unidos. «Dónde vives» en la web, la
 * misma lógica que el de las apps (useSelectorLugar, en compartido): País → Estado → Ciudad, con un
 * buscador directo arriba que sugiere desde la primera letra. Catálogo completo del país (GeoNames,
 * archivos fijos del mismo sitio en /lugares/…): nunca las zonas abiertas (C-SIN-LISTA-DE-CIUDADES).
 * Si no encuentra su pueblo, elige su municipio o condado. Se cierra con Escape o tocando fuera.
 */
export const CATALOGO_LUGARES_WEB = crearCatalogoLugares({ base: '' });

const bandera = (iso: string) =>
  iso.toUpperCase().replace(/[A-Z]/g, (l) => String.fromCodePoint(0x1f1e6 + l.charCodeAt(0) - 65));

export function SelectorLugar({
  valor,
  alElegir,
  idioma,
  paisSugerido,
  error,
  etiqueta,
}: {
  valor: LugarCuenta | null;
  alElegir: (l: LugarCuenta) => void;
  idioma: Idioma;
  paisSugerido?: string | null;
  error?: string;
  etiqueta?: string;
}) {
  const t = textosSelectorLugar(idioma);
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  return (
    <div className="campo selector-lugar">
      <label htmlFor={id}>{etiqueta ?? t.etiqueta}</label>
      <button
        id={id}
        type="button"
        className="selector-lugar-casilla"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-invalid={Boolean(error)}
        data-testid="registro-lugar"
        onClick={() => setAbierto(true)}
      >
        <span className={valor ? '' : 'selector-lugar-vacio'}>
          {valor ? `${bandera(valor.pais)} ${lugarEscrito(valor)}` : t.elegir}
        </span>
        <span className="selector-lugar-accion">{valor ? t.cambiar : '▾'}</span>
      </button>
      {error && <p className="error-campo">{error}</p>}
      {abierto &&
        // Fuera de la casilla (en el cuerpo de la página): no hereda sus estilos ni queda tapada.
        createPortal(
          <VentanaLugar
            idioma={idioma}
            paisSugerido={paisSugerido}
            inicial={valor}
            alCerrar={() => setAbierto(false)}
            alElegir={(l) => {
              setAbierto(false);
              alElegir(l);
            }}
          />,
          document.body,
        )}
    </div>
  );
}

function VentanaLugar({
  idioma,
  paisSugerido,
  inicial,
  alElegir,
  alCerrar,
}: {
  idioma: Idioma;
  paisSugerido?: string | null;
  inicial: LugarCuenta | null;
  alElegir: (l: LugarCuenta) => void;
  alCerrar: () => void;
}) {
  const t = textosSelectorLugar(idioma);
  const s = useSelectorLugar({ catalogo: CATALOGO_LUGARES_WEB, paisSugerido, inicial, alElegir });
  const buscador = useRef<HTMLInputElement>(null);
  const [activo, setActivo] = useState(0);
  const est = s.pais && s.estado ? estadoDelPais(s.pais, s.estado) : null;
  const esUS = s.pais === 'US';
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alCerrar]);
  useEffect(() => {
    buscador.current?.focus();
  }, [s.paso]);
  const titulo =
    s.paso === 'pais'
      ? t.tituloPais
      : s.paso === 'estado'
        ? t.tituloEstado
        : s.paso === 'ciudad'
          ? t.tituloCiudad
          : esUS
            ? t.tituloMunicipioUS
            : t.tituloMunicipioVE;
  const placeholder =
    s.paso === 'estado'
      ? t.buscarTodo
      : s.paso === 'ciudad' && est
        ? t.buscarEn(est.nombre)
        : esUS
          ? t.buscarCondado
          : t.buscarMunicipio;
  const lista: ResultadoLugar[] = s.paso === 'estado' || s.paso === 'ciudad' ? s.resultados : [];
  // Navegar con el teclado: flechas y Enter sobre las ciudades sugeridas.
  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!lista.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, lista.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = lista.at(activo);
      if (r) s.elegir(r.lugar);
    }
  };
  return (
    <div className="selector-lugar-fondo" onClick={alCerrar}>
      <div
        className="selector-lugar-ventana"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="selector-lugar-cabeza">
          <button
            type="button"
            className="selector-lugar-volver"
            aria-label={s.paso === 'pais' ? t.cerrar : t.volver}
            onClick={() => {
              if (!s.volver()) alCerrar();
            }}
          >
            {/* Íconos de línea (C-SIN-EMOJIS): una equis para cerrar, una flecha para volver. */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {s.paso === 'pais' ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M19 12H5M11 6l-6 6 6 6" />
              )}
            </svg>
          </button>
          <div>
            <h2>{titulo}</h2>
            {s.pais && s.paso !== 'pais' && (
              <p className="selector-lugar-ruta">
                {bandera(s.pais)} {nombrePais(s.pais, idioma)}
                {est ? ` · ${estadoEscrito(s.pais, est)}` : ''}
              </p>
            )}
          </div>
        </div>
        {s.paso !== 'pais' && (
          <input
            ref={buscador}
            className="selector-lugar-buscar"
            type="search"
            value={s.consulta}
            onChange={(e) => {
              setActivo(0);
              s.cambiarConsulta(e.target.value);
            }}
            onKeyDown={teclas}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            data-testid="selector-lugar-buscar"
          />
        )}
        <div className="selector-lugar-lista">
          {s.paso === 'pais' &&
            paisesParaElegir(paisSugerido).map((p) => (
              <button
                key={p}
                type="button"
                className="selector-lugar-fila"
                onClick={() => s.elegirPais(p)}
              >
                <span>
                  {bandera(p)} {nombrePais(p, idioma)}
                </span>
                <span aria-hidden>›</span>
              </button>
            ))}
          {s.cargando && s.paso !== 'pais' && (s.paso !== 'estado' || s.consulta) && (
            <p className="selector-lugar-nota">{t.cargando}</p>
          )}
          {s.fallo && (
            <p className="selector-lugar-nota error-campo" role="alert">
              {t.fallo}{' '}
              <button type="button" className="enlace" onClick={s.reintentar}>
                {t.reintentar}
              </button>
            </p>
          )}
          {lista.map((r, i) => (
            <FilaResultado
              key={r.lugar.lugarId}
              r={r}
              idioma={idioma}
              conEstado={s.paso === 'estado'}
              activo={i === activo}
              alTocar={() => s.elegir(r.lugar)}
            />
          ))}
          {s.paso === 'estado' &&
            s.consulta.trim() &&
            !s.cargando &&
            !lista.length &&
            !s.estados.length && (
              <p className="selector-lugar-nota">{t.sinResultados(s.consulta.trim())}</p>
            )}
          {s.paso === 'estado' && s.pais && (
            <>
              <p className="selector-lugar-subtitulo">
                {s.consulta.trim() ? t.oEligeEstado : t.tituloEstado}
              </p>
              {s.estados.map((x) => (
                <button
                  key={x.codigo}
                  type="button"
                  className="selector-lugar-fila"
                  onClick={() => s.elegirEstado(x.codigo)}
                >
                  <span>{estadoEscrito(s.pais!, x)}</span>
                  <span aria-hidden>›</span>
                </button>
              ))}
            </>
          )}
          {s.paso === 'ciudad' && s.consulta.trim() && !s.cargando && !lista.length && (
            <p className="selector-lugar-nota">{t.sinResultadosEstado(s.consulta.trim())}</p>
          )}
          {s.paso === 'ciudad' && !s.cargando && !s.fallo && (
            <button
              type="button"
              className="enlace selector-lugar-noencuentro"
              onClick={s.verMunicipios}
            >
              {esUS ? t.noEncuentroUS : t.noEncuentroVE}
            </button>
          )}
          {s.paso === 'municipio' &&
            s.municipios.map((m) => (
              <button
                key={m.municipio}
                type="button"
                className="selector-lugar-fila selector-lugar-doble"
                onClick={() => s.elegir(m)}
              >
                <strong>{m.municipio}</strong>
                <small>{t.quedarasEn(m.ciudad)}</small>
              </button>
            ))}
          {s.paso !== 'pais' && <p className="selector-lugar-credito">{t.credito}</p>}
        </div>
      </div>
    </div>
  );
}

function FilaResultado({
  r,
  idioma,
  conEstado,
  activo,
  alTocar,
}: {
  r: ResultadoLugar;
  idioma: Idioma;
  conEstado: boolean;
  activo: boolean;
  alTocar: () => void;
}) {
  const t = textosSelectorLugar(idioma);
  const est = estadoDelPais(r.lugar.pais, r.lugar.estado);
  const [antes, coincide, despues] = r.resaltado;
  const detalle = [
    r.lugar.municipio
      ? `${r.lugar.pais === 'US' ? '' : `${t.municipio} `}${r.lugar.municipio}`
      : '',
    conEstado && est ? estadoEscrito(r.lugar.pais, est) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      className={`selector-lugar-fila selector-lugar-doble${activo ? ' activo' : ''}`}
      onClick={alTocar}
      data-testid={`selector-lugar-ciudad-${r.lugar.lugarId}`}
    >
      <span>
        {antes}
        <mark>{coincide}</mark>
        {despues}
      </span>
      {detalle && <small>{detalle}</small>}
    </button>
  );
}
