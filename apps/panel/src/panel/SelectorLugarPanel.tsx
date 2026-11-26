import { useEffect, useId, useState } from 'react';
import {
  type Idioma,
  type LugarCuenta,
  type PaisConCatalogo,
  enIdioma,
  estadosDelPais,
  lugarEscrito,
  sinAcentos,
} from '@tumbite/compartido';
import { nombrePaisCatalogo } from './esperaCiudad';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). Selector MÍNIMO de
 * País → Estado → Ciudad para el panel interno (poner la ciudad a una cuenta a medias). Lee el
 * catálogo fijo `/lugares/<PAIS>/<ESTADO>.json` (filas `[lugarId, ciudad, municipio, lat, lng,
 * poblacion]`, sin base de datos) y sugiere desde la primera letra, sin acentos.
 *
 * AL INTEGRAR: la parte A crea `SelectorLugar` para la web; este se reemplaza por esa pieza común
 * (misma salida: un `LugarCuenta`). Se dejó aparte solo para no chocar en paralelo.
 */
export type FilaCatalogo = [string | number, string, string | null, number, number, number?];

const T = {
  es: {
    pais: 'País',
    estado: 'Estado',
    ciudad: 'Ciudad o pueblo',
    elegir: 'Elige',
    escribe: 'Escribe las primeras letras',
    cargando: 'Cargando las ciudades…',
    error: 'No pudimos cargar las ciudades de ese estado. Revisa tu conexión y vuelve a elegirlo.',
    nada: 'Ninguna ciudad de ese estado empieza así.',
    elegida: (c: string) => `Elegida: ${c}`,
  },
  en: {
    pais: 'Country',
    estado: 'State',
    ciudad: 'City or town',
    elegir: 'Choose',
    escribe: 'Type the first letters',
    cargando: 'Loading cities…',
    error: 'We couldn’t load that state’s cities. Check your connection and pick it again.',
    nada: 'No city in that state starts like that.',
    elegida: (c: string) => `Selected: ${c}`,
  },
};

/** El identificador del catálogo: «gn:3633009» (si la fila trae solo el número, se le pone «gn:»). */
export const idDeFila = (x: string | number) => {
  const s = String(x);
  return /^\d+$/.test(s) ? `gn:${s}` : s;
};

/** « · Libertador» si el municipio (o condado) no se llama igual que la ciudad; si no, nada. */
export const conMunicipio = (ciudad: string, municipio: string | null | undefined) =>
  municipio && sinAcentos(municipio) !== sinAcentos(ciudad) ? ` · ${municipio}` : '';

/** Las sugerencias: cada palabra escrita es el comienzo de una palabra de la ciudad o su municipio. */
export function sugerirCiudades(filas: readonly FilaCatalogo[], q: string, maximo = 8) {
  const palabras = sinAcentos(q).split(' ').filter(Boolean);
  if (!palabras.length) return [];
  return filas
    .filter((f) => {
      const texto = sinAcentos(`${f[1]} ${f[2] ?? ''}`).split(' ');
      return palabras.every((p) => texto.some((t) => t.startsWith(p)));
    })
    .sort((a, b) => (b[5] ?? 0) - (a[5] ?? 0))
    .slice(0, maximo);
}

export function lugarDeFila(pais: PaisConCatalogo, estado: string, f: FilaCatalogo): LugarCuenta {
  return {
    pais,
    estado,
    municipio: f[2] ?? null,
    ciudad: f[1],
    lugarId: idDeFila(f[0]),
    lat: f[3],
    lng: f[4],
  };
}

export function SelectorLugarPanel({
  valor,
  cambiar,
  idioma,
}: {
  valor: { pais: string; estado: string; lugar: LugarCuenta | null };
  cambiar: (v: { pais: string; estado: string; lugar: LugarCuenta | null }) => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const idLista = useId();
  const [q, setQ] = useState('');
  const [catalogo, setCatalogo] = useState<{
    clave: string;
    filas?: FilaCatalogo[];
    error?: boolean;
  } | null>(null);
  const pais = valor.pais === 'VE' || valor.pais === 'US' ? valor.pais : '';
  const clave = pais && valor.estado ? `${pais}/${valor.estado}` : '';
  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    fetch(`/lugares/${clave}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<unknown>;
      })
      .then((x) => {
        if (!vivo) return;
        setCatalogo({ clave, filas: Array.isArray(x) ? (x as FilaCatalogo[]) : [] });
      })
      .catch((e: unknown) => {
        console.error('selector de lugar: no se pudo leer el catálogo', clave, e);
        if (vivo) setCatalogo({ clave, error: true });
      });
    return () => {
      vivo = false;
    };
  }, [clave]);
  const filas = catalogo?.clave === clave ? catalogo.filas : undefined;
  const sugerencias = filas ? sugerirCiudades(filas, q) : [];
  return (
    <div className="selector-lugar" data-testid="selector-lugar">
      <label>
        {t.pais}
        <select
          value={pais}
          onChange={(e) => {
            setQ('');
            cambiar({ pais: e.target.value, estado: '', lugar: null });
          }}
          required
        >
          <option value="">{t.elegir}</option>
          {(['VE', 'US'] as const).map((p) => (
            <option key={p} value={p}>
              {nombrePaisCatalogo(p, idioma)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.estado}
        <select
          value={valor.estado}
          disabled={!pais}
          onChange={(e) => {
            setQ('');
            cambiar({ pais, estado: e.target.value, lugar: null });
          }}
          required
        >
          <option value="">{t.elegir}</option>
          {estadosDelPais(pais).map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {pais === 'US' ? `${e.nombre} (${e.codigo})` : e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.ciudad}
        <input
          type="search"
          value={q}
          disabled={!clave}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.escribe}
          aria-controls={idLista}
          autoComplete="off"
        />
      </label>
      {clave && !filas && !catalogo?.error ? <p role="status">{t.cargando}</p> : null}
      {catalogo?.clave === clave && catalogo.error ? (
        <p className="error-general" role="alert">
          {t.error}
        </p>
      ) : null}
      {filas && q && sugerencias.length === 0 ? <p className="pista">{t.nada}</p> : null}
      {sugerencias.length > 0 ? (
        <ul id={idLista} className="super-lista" role="listbox" aria-label={t.ciudad}>
          {sugerencias.map((f) => (
            <li key={String(f[0])}>
              <button
                type="button"
                className="enlace"
                role="option"
                aria-selected={valor.lugar?.lugarId === idDeFila(f[0])}
                onClick={() => {
                  if (!pais) return;
                  setQ('');
                  cambiar({
                    pais,
                    estado: valor.estado,
                    lugar: lugarDeFila(pais, valor.estado, f),
                  });
                }}
              >
                {f[1]}
                {conMunicipio(f[1], f[2])}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {valor.lugar ? (
        <p data-testid="lugar-elegido">
          <strong>
            {t.elegida(
              `${lugarEscrito(valor.lugar)}${conMunicipio(valor.lugar.ciudad, valor.lugar.municipio)}`,
            )}
          </strong>
        </p>
      ) : null}
    </div>
  );
}
