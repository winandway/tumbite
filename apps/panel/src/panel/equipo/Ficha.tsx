import { useCallback, useEffect, useState } from 'react';
import { useHora } from '../horario';
import { type Alcance, ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { pedir } from '../api';
import { EncabezadoPagina, Pastilla, Tarjeta } from '../armazon/Piezas';
import { MenuTresPuntos } from '../MenuTresPuntos';
import { usePermisos } from '../permisosPanel';
import { type Miembro, TONO_ESTADO, nombresPlantillas } from '../SuperEquipo';
import { ConfirmarConMotivo, ElegirAcceso, alcanceDe, type EleccionAcceso } from './Piezas';
import {
  type Plantilla,
  type Zona,
  accionEnPalabras,
  alcanceEnPalabras,
  objetoEnPalabras,
  nombreArea,
  nombrePermiso,
  porArea,
  textosEquipo,
} from './textos';

type DatosFicha = {
  miembro: Miembro;
  acceso: {
    permisos: string[];
    fuentes: Record<string, string[]>;
    alcance: Alcance;
    topes: Record<string, number> | null;
    origen: string;
    dueno: boolean;
    /** Permisos de sus plantillas que no valen con su alcance limitado (son de toda la empresa). */
    sinEfecto?: string[];
  };
  asignaciones: { plantillaId: string; alcance: Alcance; venceEn: string | null; motivo: string }[];
  acciones: { id: number; metodo: string; ruta: string; estado: number; creadoEn: string }[];
  accesos: { id: number; objeto: string; tipo: string; permiso: string; creadoEn: string }[] | null;
  cambios: { id: number; accion: string; creadoEn: string; actor: string | null }[];
};

/**
 * Ficha de una persona del equipo (C-PERMISOS-FINOS): sus permisos efectivos y de qué plantilla
 * sale cada uno, su acceso (editable con `equipo.gestionar`), lo que hizo, lo que VIO (con
 * `auditoria.accesos`) y los cambios de su acceso. Suspender y quitar, en los tres puntos.
 */
export function Ficha({
  id,
  miId,
  base,
  idioma,
  plantillas,
  zonas,
}: {
  id: string;
  miId: string;
  base: string;
  idioma: Idioma;
  plantillas: Plantilla[];
  zonas: Zona[];
}) {
  const t = textosEquipo(idioma);
  // C-HORARIO-EMPLEADO: toda fecha pasa por la pieza única con la preferencia del empleado.
  const hora = useHora(idioma);
  const { puedeVer, acceso: mio } = usePermisos();
  const gestiona = puedeVer('equipo.gestionar');
  const [d, setD] = useState<DatosFicha | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [editando, setEditando] = useState(false);
  const [eleccion, setEleccion] = useState<EleccionAcceso | null>(null);
  const [motivo, setMotivo] = useState('');
  const [confirmar, setConfirmar] = useState<'suspender' | 'reactivar' | 'quitar' | null>(null);

  const cargar = useCallback(() => {
    pedir<DatosFicha>('GET', `/datos/admin/equipo/miembros/${encodeURIComponent(id)}`)
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [id]);
  useEffect(cargar, [cargar]);

  if (!d)
    return (
      <section className="super eq">
        <Enlace a={`${base}/team`}>{t.volver}</Enlace>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );

  const m = d.miembro;
  // La ficha se abre desde la dirección (sin la cuenta de quien mira): mi id sale de mis permisos.
  const yo = m.id === (mio?.id || miId);
  const nombreFuente = (f: string) =>
    f === 'extra'
      ? t.extra
      : f.startsWith('legado:')
        ? `${t.perfilViejo}: ${new Map(Object.entries(t.perfiles)).get(f.slice(7)) ?? f.slice(7)}`
        : (() => {
            const p = plantillas.find((x) => x.id === f);
            return p ? enIdioma(p.nombre, idioma) : f;
          })();

  function abrirEdicion() {
    const primera = d?.asignaciones[0];
    setEleccion({
      plantillas: d?.asignaciones.map((a) => a.plantillaId) ?? [],
      paises: primera?.alcance.paises ?? [],
      zonas: primera?.alcance.zonas ?? [],
      servicios: primera?.alcance.servicios ?? [],
      venceEn: primera?.venceEn?.slice(0, 10) ?? '',
    });
    setMotivo('');
    setEditando(true);
  }
  async function guardarAcceso() {
    if (!eleccion) return;
    setError('');
    try {
      const alcance = alcanceDe(eleccion);
      await pedir('PUT', `/datos/admin/equipo/miembros/${encodeURIComponent(id)}`, {
        asignaciones: eleccion.plantillas.map((plantillaId) => ({
          plantillaId,
          alcance,
          venceEn: eleccion.venceEn || null,
        })),
        motivo,
      });
      setEditando(false);
      setOk(t.guardado);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const acciones =
    gestiona && !yo && !m.dueno
      ? [
          ...(m.estado === 'suspendido' || m.estado === 'retirado'
            ? [{ texto: t.reactivar, alTocar: () => setConfirmar('reactivar') }]
            : [{ texto: t.suspender, alTocar: () => setConfirmar('suspender') }]),
          ...(m.estado !== 'retirado'
            ? [{ texto: t.quitar, peligro: true, alTocar: () => setConfirmar('quitar') }]
            : []),
        ]
      : [];

  return (
    <section className="super eq">
      <Enlace a={`${base}/team`} className="eq-volver">
        {t.volver}
      </Enlace>
      <EncabezadoPagina
        titulo={`${m.nombre}${yo ? ` ${t.tu}` : ''}`}
        detalle={
          <>
            {m.correo} ·{' '}
            <Pastilla tono={new Map(Object.entries(TONO_ESTADO)).get(m.estado) ?? 'neutro'}>
              {new Map(Object.entries(t.estados)).get(m.estado) ?? m.estado}
            </Pastilla>
            {m.dueno ? ` · ${t.dueno}` : ''}
          </>
        }
      >
        {acciones.length ? (
          <MenuTresPuntos etiqueta={`${t.masAcciones}: ${m.nombre}`} opciones={acciones} />
        ) : null}
      </EncabezadoPagina>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      <div className="eq-rejilla">
        <Tarjeta titulo={t.acceso}>
          <dl className="eq-datos">
            <dt>{t.columnas.plantillas}</dt>
            <dd>{nombresPlantillas(m.plantillas, plantillas, idioma, m.perfilViejo, t) || '—'}</dd>
            <dt>{t.columnas.alcance}</dt>
            <dd>{alcanceEnPalabras(d.acceso.alcance, zonas, idioma)}</dd>
            <dt>{t.columnas.vence}</dt>
            <dd>{m.venceEn ? hora.fecha(m.venceEn, null, 'fecha') : t.sinVencimiento}</dd>
            <dt>{t.columnas.ultima}</dt>
            <dd>{m.ultimaEntrada ? hora.fecha(m.ultimaEntrada, null) : t.nunca}</dd>
          </dl>
          {gestiona && !yo && !m.dueno && !editando ? (
            <button type="button" className="boton secundario" onClick={abrirEdicion}>
              {t.editarAcceso}
            </button>
          ) : null}
          {editando && eleccion ? (
            <div className="eq-editar">
              <ElegirAcceso
                valor={eleccion}
                cambiar={setEleccion}
                plantillas={plantillas}
                zonas={zonas}
                misPermisos={mio?.permisos ?? []}
                idioma={idioma}
              />
              <div className="campo">
                <label htmlFor="eq-motivo-acceso">{t.motivo}</label>
                <input
                  id="eq-motivo-acceso"
                  value={motivo}
                  placeholder={t.motivoAyuda}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <div className="eq-dialogo-botones">
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => setEditando(false)}
                >
                  {t.cancelar}
                </button>
                <button
                  type="button"
                  className="boton"
                  disabled={!eleccion.plantillas.length || motivo.trim().length < 5}
                  onClick={() => void guardarAcceso()}
                >
                  {t.guardarAcceso}
                </button>
              </div>
            </div>
          ) : null}
        </Tarjeta>
        <Tarjeta titulo={t.permisosEfectivos}>
          {porArea(d.acceso.permisos).map(([area, lista]) => (
            <div key={area} className="eq-area">
              <h3>{nombreArea(area, idioma)}</h3>
              <ul>
                {lista.map((p) => (
                  <li key={p}>
                    <span>{nombrePermiso(p, idioma)}</span>
                    <small>
                      {t.deDonde}:{' '}
                      {(new Map(Object.entries(d.acceso.fuentes)).get(p) ?? [])
                        .map(nombreFuente)
                        .join(', ')}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {d.acceso.sinEfecto?.length ? (
            <div className="eq-area">
              <h3>{t.sinEfecto}</h3>
              <p className="eq-nota">{t.sinEfectoNota}</p>
              <ul>
                {d.acceso.sinEfecto.map((p) => (
                  <li key={p}>
                    <span>{nombrePermiso(p, idioma)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Tarjeta>
      </div>
      <div className="eq-rejilla">
        <Tarjeta titulo={t.loQueHizo}>
          {d.acciones.length ? (
            <ul className="eq-registro">
              {d.acciones.map((a) => (
                <li key={a.id}>
                  <span>
                    {a.metodo} {a.ruta.replace('/datos/admin', '')}
                    {a.estado >= 400 ? ` · ${t.rechazado} (${a.estado})` : ''}
                  </span>
                  <small>{hora.fecha(a.creadoEn, null)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pista">{t.nadaAun}</p>
          )}
        </Tarjeta>
        {d.accesos ? (
          <Tarjeta titulo={t.loQueVio}>
            {d.accesos.length ? (
              <ul className="eq-registro">
                {d.accesos.map((a) => (
                  <li key={a.id}>
                    <span>
                      {new Map(Object.entries(t.tiposAcceso)).get(a.tipo) ?? a.tipo} ·{' '}
                      {objetoEnPalabras(a.objeto, t)}
                    </span>
                    <small>{hora.fecha(a.creadoEn, null)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pista">{t.nadaAun}</p>
            )}
          </Tarjeta>
        ) : null}
        <Tarjeta titulo={t.cambios}>
          {d.cambios.length ? (
            <ul className="eq-registro">
              {d.cambios.map((c) => (
                <li key={c.id}>
                  <span>
                    {accionEnPalabras(c.accion, t)} · {c.actor ?? '—'}
                  </span>
                  <small>{hora.fecha(c.creadoEn, null)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pista">{t.nadaAun}</p>
          )}
        </Tarjeta>
      </div>
      {confirmar ? (
        <ConfirmarConMotivo
          titulo={new Map(Object.entries(t.confirmarTitulo)).get(confirmar) ?? ''}
          texto={new Map(Object.entries(t.confirmarTexto)).get(confirmar) ?? ''}
          peligro={confirmar !== 'reactivar'}
          idioma={idioma}
          alCancelar={() => setConfirmar(null)}
          alConfirmar={async (mot) => {
            await pedir(
              'POST',
              `/datos/admin/equipo/miembros/${encodeURIComponent(id)}/${confirmar}`,
              {
                motivo: mot,
              },
            );
            setConfirmar(null);
            setOk(t.guardado);
            cargar();
          }}
        />
      ) : null}
    </section>
  );
}
