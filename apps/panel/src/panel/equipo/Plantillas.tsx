import { useId, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  PERMISOS_INTERNOS,
  type PermisoInterno,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from '../api';
import { Pastilla } from '../armazon/Piezas';
import { MenuTresPuntos } from '../MenuTresPuntos';
import { usePermisos } from '../permisosPanel';
import { type Plantilla, nombreArea, nombrePermiso, porArea, textosEquipo } from './textos';

const MONEDAS = ['USD', 'MXN', 'COP', 'VES', 'PEN'];
const CERRADA = {
  abierta: false,
  id: null,
  nombreEs: '',
  nombreEn: '',
  descripcionEs: '',
  descripcionEn: '',
  permisos: [],
  topes: {},
};
type Edicion = {
  id: string | null;
  nombreEs: string;
  nombreEn: string;
  descripcionEs: string;
  descripcionEn: string;
  permisos: PermisoInterno[];
  topes: Record<string, string>;
};

/**
 * Plantillas de puesto (C-PERMISOS-FINOS): las de fábrica y las del equipo. Con `equipo.gestionar`
 * se editan y se crean; nadie marca un permiso que no tiene; «Total» no se edita; borrar una
 * propia vive en los tres puntos.
 */
export function Plantillas({
  idioma,
  plantillas,
  alCambiar,
}: {
  idioma: Idioma;
  plantillas: Plantilla[];
  alCambiar: () => void;
}) {
  const t = textosEquipo(idioma);
  const id = useId();
  const { puedeVer, acceso } = usePermisos();
  const gestiona = puedeVer('equipo.gestionar');
  const mios = new Set(acceso?.permisos ?? []);
  // Regla «ningún formulario pierde lo escrito»: la plantilla a medio editar vuelve si se cierra la
  // ventana (por cuenta); se borra al guardar o al cancelar.
  const b = useBorrador<Edicion & { abierta: boolean }>({
    formulario: 'equipo-plantilla',
    cuenta: acceso?.id,
    inicial: CERRADA,
    almacen: almacenNavegador,
  });
  const ed = b.valores.abierta ? b.valores : null;
  const setEd = (x: (Edicion & { abierta?: boolean }) | null) => {
    if (!x) return void b.limpiar();
    for (const [k, v] of Object.entries(x))
      b.cambiar(k as keyof Edicion, v as Edicion[keyof Edicion]);
  };
  const [error, setError] = useState('');

  const abrir = (p: Plantilla | null) =>
    b.cargar({
      abierta: true,
      id: p?.id ?? null,
      nombreEs: p?.nombre.es ?? '',
      nombreEn: p?.nombre.en ?? '',
      descripcionEs: p?.descripcion.es ?? '',
      descripcionEn: p?.descripcion.en ?? '',
      permisos: p?.permisos ?? [],
      topes: Object.fromEntries(Object.entries(p?.topes ?? {}).map(([k, v]) => [k, String(v)])),
    });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!ed) return;
    setError('');
    const topes = Object.fromEntries(
      Object.entries(ed.topes)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, Number(v)]),
    );
    try {
      await pedir(
        ed.id ? 'PUT' : 'POST',
        `/datos/admin/equipo/plantillas${ed.id ? `/${ed.id}` : ''}`,
        {
          nombre: { es: ed.nombreEs, en: ed.nombreEn },
          descripcion: { es: ed.descripcionEs, en: ed.descripcionEn },
          permisos: ed.permisos,
          topes: Object.keys(topes).length ? topes : null,
        },
      );
      setEd(null);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function borrar(p: Plantilla) {
    setError('');
    try {
      await pedir('DELETE', `/datos/admin/equipo/plantillas/${p.id}`);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <>
      {gestiona && !ed ? (
        <div className="eq-barra">
          <span />
          <button type="button" className="boton" onClick={() => abrir(null)}>
            {t.nuevaPlantilla}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ed ? (
        <form className="pd-tarjeta eq-invitar" onSubmit={guardar}>
          <h2>{ed.id ? t.editar : t.nuevaPlantilla}</h2>
          <div className="eq-dos">
            {(
              [
                ['nombreEs', t.nombreEs],
                ['nombreEn', t.nombreEn],
                ['descripcionEs', t.descripcionEs],
                ['descripcionEn', t.descripcionEn],
              ] as const
            ).map(([campo, etiqueta]) => (
              <div className="campo" key={campo}>
                <label htmlFor={`${id}-${campo}`}>{etiqueta}</label>
                <input
                  id={`${id}-${campo}`}
                  value={new Map(Object.entries(ed)).get(campo) as string}
                  onChange={(e) => setEd({ ...ed, [campo]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {porArea(PERMISOS_INTERNOS).map(([area, lista]) => (
            <fieldset key={area} className="eq-grupo">
              <legend>{nombreArea(area, idioma)}</legend>
              <div className="eq-chips">
                {lista.map((p) => (
                  <label key={p} className={mios.has(p) ? 'eq-chip' : 'eq-chip eq-opcion-apagada'}>
                    <input
                      type="checkbox"
                      disabled={!mios.has(p)}
                      checked={ed.permisos.includes(p as PermisoInterno)}
                      onChange={() =>
                        setEd({
                          ...ed,
                          permisos: ed.permisos.includes(p as PermisoInterno)
                            ? ed.permisos.filter((x) => x !== p)
                            : [...ed.permisos, p as PermisoInterno],
                        })
                      }
                    />
                    {nombrePermiso(p, idioma)}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset className="eq-grupo">
            <legend>{t.topes}</legend>
            <div className="eq-chips">
              {MONEDAS.map((m) => (
                <label key={m} className="eq-tope">
                  {m}
                  <input
                    inputMode="numeric"
                    value={new Map(Object.entries(ed.topes)).get(m) ?? ''}
                    onChange={(e) =>
                      setEd({
                        ...ed,
                        topes: { ...ed.topes, [m]: e.target.value.replace(/\D/g, '') },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="eq-dialogo-botones">
            <button type="button" className="boton secundario" onClick={() => setEd(null)}>
              {t.cancelar}
            </button>
            <button
              type="submit"
              className="boton"
              disabled={!ed.nombreEs.trim() || !ed.nombreEn.trim() || !ed.permisos.length}
            >
              {t.guardar}
            </button>
          </div>
        </form>
      ) : null}
      <div className="eq-plantillas">
        {plantillas.map((p) => (
          <article key={p.id} className="pd-tarjeta eq-plantilla">
            <header>
              <h2>{enIdioma(p.nombre, idioma)}</h2>
              {p.sistema ? <Pastilla tono="suave">{t.deFabrica}</Pastilla> : null}
              {gestiona && p.borrable ? (
                <MenuTresPuntos
                  etiqueta={`${t.masAcciones}: ${enIdioma(p.nombre, idioma)}`}
                  opciones={[{ texto: t.borrar, peligro: true, alTocar: () => void borrar(p) }]}
                />
              ) : null}
            </header>
            <p className="pista">{enIdioma(p.descripcion, idioma)}</p>
            <p className="eq-plantilla-cuenta">
              {p.personas} {t.personas} · {p.permisos.length} {t.permisos}
            </p>
            <ul className="eq-plantilla-permisos">
              {p.permisos.slice(0, 8).map((x) => (
                <li key={x}>{nombrePermiso(x, idioma)}</li>
              ))}
              {p.permisos.length > 8 ? <li>+{p.permisos.length - 8}</li> : null}
            </ul>
            {gestiona && p.editable ? (
              <button type="button" className="boton secundario chico" onClick={() => abrir(p)}>
                {t.editar}
              </button>
            ) : !p.editable ? (
              <small className="pista">{t.totalNoEdita}</small>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
