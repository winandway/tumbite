import { useEffect, useId, useState } from 'react';
import {
  type Idioma,
  SERVICIOS_ALCANCE,
  type ServicioAlcance,
  enIdioma,
  permisosFuera,
} from '@tumbite/compartido';
import { pedir } from '../api';
import { type Plantilla, type Zona, textosEquipo } from './textos';

/** C-PERMISOS-FINOS: piezas que comparten «Agregar empleado», la ficha y las plantillas. */

export function useZonas(): Zona[] {
  const [zonas, setZonas] = useState<Zona[]>([]);
  useEffect(() => {
    pedir<{ zonas: Zona[] }>('GET', '/datos/admin/zonas')
      .then((r) => setZonas(r.zonas ?? []))
      .catch((e: unknown) => console.warn('equipo: no se pudieron leer las ciudades', e));
  }, []);
  return zonas;
}

export function usePlantillas(vuelta = 0): Plantilla[] {
  const [lista, setLista] = useState<Plantilla[]>([]);
  useEffect(() => {
    pedir<{ plantillas: Plantilla[] }>('GET', '/datos/admin/equipo/plantillas')
      .then((r) => setLista(r.plantillas ?? []))
      .catch((e: unknown) => console.warn('equipo: no se pudieron leer las plantillas', e));
  }, [vuelta]);
  return lista;
}

export type EleccionAcceso = {
  plantillas: string[];
  paises: string[];
  zonas: string[];
  servicios: ServicioAlcance[];
  venceEn: string;
};

/** Plantillas (con las que no puedes dar, apagadas), alcance y vencimiento. */
export function ElegirAcceso({
  valor,
  cambiar,
  plantillas,
  zonas,
  misPermisos,
  idioma,
}: {
  valor: EleccionAcceso;
  cambiar: (v: EleccionAcceso) => void;
  plantillas: Plantilla[];
  zonas: Zona[];
  misPermisos: string[];
  idioma: Idioma;
}) {
  const t = textosEquipo(idioma);
  const id = useId();
  const alternar = <T extends string>(lista: T[], x: T) =>
    lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x];
  const paises = [...new Set(zonas.map((z) => z.pais))].sort();
  return (
    <>
      <fieldset className="eq-grupo">
        <legend>{t.eligePlantillas}</legend>
        <div className="eq-opciones">
          {plantillas.map((p) => {
            const noPuedo = permisosFuera(p.permisos, misPermisos).length > 0;
            return (
              <label key={p.id} className={noPuedo ? 'eq-opcion eq-opcion-apagada' : 'eq-opcion'}>
                <input
                  type="checkbox"
                  checked={valor.plantillas.includes(p.id)}
                  disabled={noPuedo}
                  onChange={() =>
                    cambiar({ ...valor, plantillas: alternar(valor.plantillas, p.id) })
                  }
                />
                <span>
                  <strong>{enIdioma(p.nombre, idioma)}</strong>
                  <small>{noPuedo ? t.noPuedesDar : enIdioma(p.descripcion, idioma)}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="eq-grupo">
        <legend>{t.alcance}</legend>
        <p className="pista">{t.alcanceAyuda}</p>
        {paises.length ? (
          <div className="eq-chips" role="group" aria-label={t.paises}>
            <span className="eq-chips-titulo">{t.paises}</span>
            {paises.map((p) => (
              <label key={p} className="eq-chip">
                <input
                  type="checkbox"
                  checked={valor.paises.includes(p)}
                  onChange={() => cambiar({ ...valor, paises: alternar(valor.paises, p) })}
                />
                {p}
              </label>
            ))}
          </div>
        ) : null}
        {zonas.length ? (
          <div className="eq-chips" role="group" aria-label={t.ciudades}>
            <span className="eq-chips-titulo">{t.ciudades}</span>
            {zonas.map((z) => (
              <label key={z.id} className="eq-chip">
                <input
                  type="checkbox"
                  checked={valor.zonas.includes(z.id)}
                  onChange={() => cambiar({ ...valor, zonas: alternar(valor.zonas, z.id) })}
                />
                {z.nombre}
              </label>
            ))}
          </div>
        ) : null}
        <div className="eq-chips" role="group" aria-label={t.servicios}>
          <span className="eq-chips-titulo">{t.servicios}</span>
          {SERVICIOS_ALCANCE.map((s) => (
            <label key={s} className="eq-chip">
              <input
                type="checkbox"
                checked={valor.servicios.includes(s)}
                onChange={() => cambiar({ ...valor, servicios: alternar(valor.servicios, s) })}
              />
              {new Map(Object.entries(t.nombresServicio)).get(s) ?? s}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="campo">
        <label htmlFor={`${id}-vence`}>{t.venceEn}</label>
        <input
          id={`${id}-vence`}
          type="date"
          value={valor.venceEn}
          onChange={(e) => cambiar({ ...valor, venceEn: e.target.value })}
        />
      </div>
    </>
  );
}

/** El alcance elegido, como lo pide el servidor (listas vacías = sin límite). */
export function alcanceDe(v: EleccionAcceso) {
  return {
    ...(v.paises.length ? { paises: v.paises } : {}),
    ...(v.zonas.length ? { zonas: v.zonas } : {}),
    ...(v.servicios.length ? { servicios: v.servicios } : {}),
  };
}

/** Confirmación con motivo (suspender, reactivar, quitar). Nunca tapa sin poder cerrar. */
export function ConfirmarConMotivo({
  titulo,
  texto,
  peligro,
  idioma,
  alConfirmar,
  alCancelar,
}: {
  titulo: string;
  texto: string;
  peligro?: boolean;
  idioma: Idioma;
  alConfirmar: (motivo: string) => Promise<void>;
  alCancelar: () => void;
}) {
  const t = textosEquipo(idioma);
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCancelar();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [alCancelar]);
  return (
    <div className="eq-velo" role="presentation" onMouseDown={alCancelar}>
      <div
        className="eq-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`}>{titulo}</h2>
        <p>{texto}</p>
        <div className="campo">
          <label htmlFor={`${id}-m`}>{t.motivo}</label>
          <textarea
            id={`${id}-m`}
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p className="pista">{t.motivoAyuda}</p>
        </div>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        <div className="eq-dialogo-botones">
          <button type="button" className="boton secundario" onClick={alCancelar}>
            {t.cancelar}
          </button>
          <button
            type="button"
            className={peligro ? 'boton peligro' : 'boton'}
            disabled={enviando || motivo.trim().length < 5}
            onClick={() => {
              setEnviando(true);
              setError('');
              alConfirmar(motivo.trim())
                .catch((x: unknown) => setError(x instanceof Error ? x.message : String(x)))
                .finally(() => setEnviando(false));
            }}
          >
            {t.confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
