import { useCallback, useEffect, useState } from 'react';
import { useHora } from './horario';
import { type Alcance, ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { EncabezadoPagina, EstadoVacio, Pastilla, type Tono } from './armazon/Piezas';
import { MenuTresPuntos } from './MenuTresPuntos';
import { usePermisos } from './permisosPanel';
import { Ficha } from './equipo/Ficha';
import { Invitar } from './equipo/Invitar';
import { ConfirmarConMotivo, usePlantillas, useZonas } from './equipo/Piezas';
import { Plantillas } from './equipo/Plantillas';
import { Registro } from './equipo/Registro';
import {
  type Plantilla,
  type TextosEquipo,
  alcanceEnPalabras,
  textosEquipo,
} from './equipo/textos';
import './equipo/equipo.css';

/**
 * C-PERMISOS-FINOS y C-EQUIPO-INVITACION (MON-5, 15 nov 2026) — todos los países. «Equipo interno»:
 * personas (lista por clave con buscador, estado, plantillas, alcance, última entrada, vencimiento),
 * «Agregar empleado» por invitación de un solo uso, ficha de cada persona, plantillas de puesto,
 * registro con exportación y «Mis avisos por correo». Suspender y quitar el acceso viven en el
 * menú de tres puntos y piden confirmación con motivo.
 */
export type Miembro = {
  id: string;
  nombre: string;
  correo: string;
  estado: 'activo' | 'suspendido' | 'retirado' | 'vencido';
  dueno: boolean;
  perfilViejo: string | null;
  plantillas: string[];
  alcance: Alcance;
  ultimaEntrada: string | null;
  venceEn: string | null;
};
type Invitacion = {
  id: string;
  correo: string;
  nombre: string;
  plantillas: string[];
  alcance: Alcance;
  estado: string;
  expiraEn: string;
  invitadoPor: string | null;
};
type Pestana = 'personas' | 'plantillas' | 'registro' | 'avisos';

export const TONO_ESTADO: Record<string, Tono> = {
  activo: 'exito',
  invitado: 'espera',
  suspendido: 'problema',
  vencido: 'neutro',
  retirado: 'neutro',
};

export function nombresPlantillas(
  ids: string[],
  plantillas: Plantilla[],
  idioma: Idioma,
  perfilViejo: string | null,
  t: TextosEquipo,
): string {
  if (!ids.length && perfilViejo)
    return `${t.perfilViejo}: ${new Map(Object.entries(t.perfiles)).get(perfilViejo) ?? perfilViejo}`;
  return ids
    .map((id) => {
      const p = plantillas.find((x) => x.id === id);
      return p ? enIdioma(p.nombre, idioma) : id;
    })
    .join(', ');
}

export function SuperEquipo({
  idioma,
  miId,
  base,
  personaId = null,
}: {
  idioma: Idioma;
  miId: string;
  base: string;
  personaId?: string | null;
}) {
  const t = textosEquipo(idioma);
  const { puedeVer } = usePermisos();
  const veEquipo = puedeVer('equipo.ver');
  // La pestaña elegida (o la de la dirección); mientras llegan los permisos no se decide nada.
  const [elegida, setPestana] = useState<Pestana | null>(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    return p === 'plantillas' || p === 'registro' || p === 'avisos' || p === 'personas' ? p : null;
  });
  const { cargando } = usePermisos();
  const pestana: Pestana = !veEquipo ? 'avisos' : (elegida ?? 'personas');
  const [vuelta, setVuelta] = useState(0);
  const plantillas = usePlantillas(vuelta);
  const zonas = useZonas();

  if (personaId)
    return (
      <Ficha
        id={personaId}
        miId={miId}
        base={base}
        idioma={idioma}
        plantillas={plantillas}
        zonas={zonas}
      />
    );

  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', p);
    window.history.replaceState(null, '', url);
  };
  const pestanas: Pestana[] = veEquipo
    ? [
        'personas',
        'plantillas',
        ...(puedeVer('auditoria.ver') ? (['registro'] as const) : []),
        'avisos',
      ]
    : ['avisos'];

  if (cargando) return <section className="super eq" aria-busy="true" />;
  return (
    <section className="super eq">
      <EncabezadoPagina titulo={t.titulo} detalle={t.detalle} />
      <div className="super-filtros" role="tablist" aria-label={t.titulo}>
        {pestanas.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pestana === p}
            className={pestana === p ? 'activa' : undefined}
            onClick={() => cambiarPestana(p)}
          >
            {new Map(Object.entries(t.pestanas)).get(p)}
          </button>
        ))}
      </div>
      {pestana === 'personas' ? (
        <Personas idioma={idioma} miId={miId} base={base} plantillas={plantillas} zonas={zonas} />
      ) : null}
      {pestana === 'plantillas' ? (
        <Plantillas
          idioma={idioma}
          plantillas={plantillas}
          alCambiar={() => setVuelta((v) => v + 1)}
        />
      ) : null}
      {pestana === 'registro' ? <Registro idioma={idioma} /> : null}
      {pestana === 'avisos' ? <MisAvisos idioma={idioma} /> : null}
    </section>
  );
}

function Personas({
  idioma,
  miId,
  base,
  plantillas,
  zonas,
}: {
  idioma: Idioma;
  miId: string;
  base: string;
  plantillas: Plantilla[];
  zonas: ReturnType<typeof useZonas>;
}) {
  const t = textosEquipo(idioma);
  // C-HORARIO-EMPLEADO: toda fecha pasa por la pieza única con la preferencia del empleado.
  const hora = useHora(idioma);
  const { puedeVer } = usePermisos();
  const gestiona = puedeVer('equipo.gestionar');
  const [q, setQ] = useState('');
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [invitando, setInvitando] = useState(false);
  const [confirmar, setConfirmar] = useState<{
    accion: 'suspender' | 'reactivar' | 'quitar';
    m: Miembro;
  } | null>(null);

  const cargar = useCallback(
    (despues: string | null = null) => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (despues) p.set('despues', despues);
      pedir<{ miembros: Miembro[]; siguiente: string | null }>(
        'GET',
        `/datos/admin/equipo/miembros?${p.toString()}`,
      )
        .then((r) => {
          setMiembros((antes) => (despues ? [...antes, ...r.miembros] : r.miembros));
          setSiguiente(r.siguiente);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    },
    [q],
  );
  // El buscador espera un respiro antes de pedir (no una petición por tecla).
  useEffect(() => {
    const reloj = window.setTimeout(() => cargar(), 250);
    return () => window.clearTimeout(reloj);
  }, [cargar]);
  const cargarInvitaciones = useCallback(() => {
    pedir<{ invitaciones: Invitacion[] }>('GET', '/datos/admin/equipo/invitaciones')
      .then((r) => setInvitaciones(r.invitaciones.filter((i) => i.estado === 'pendiente')))
      .catch((e: unknown) => console.warn('equipo: invitaciones', e));
  }, []);
  useEffect(cargarInvitaciones, [cargarInvitaciones]);

  async function cancelarInvitacion(id: string) {
    setError('');
    try {
      await pedir('DELETE', `/datos/admin/equipo/invitaciones/${id}`);
      cargarInvitaciones();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <>
      <div className="eq-barra">
        <input
          type="search"
          className="eq-buscar"
          aria-label={t.buscar}
          placeholder={t.buscar}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {gestiona ? (
          <button type="button" className="boton" onClick={() => setInvitando(true)}>
            {t.agregar}
          </button>
        ) : null}
      </div>
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
      {invitando ? (
        <Invitar
          idioma={idioma}
          plantillas={plantillas}
          zonas={zonas}
          alTerminar={cargarInvitaciones}
          alCerrar={() => setInvitando(false)}
        />
      ) : null}
      {invitaciones.length ? (
        <section className="pd-tarjeta">
          <h2>{t.invitaciones}</h2>
          <ul className="eq-filas">
            {invitaciones.map((i) => (
              <li key={i.id} className="eq-fila">
                <div className="eq-fila-persona">
                  <strong>{i.nombre}</strong>
                  <small>{i.correo}</small>
                </div>
                <Pastilla tono="espera">{t.estados.invitado}</Pastilla>
                <span className="eq-fila-dato">
                  {nombresPlantillas(i.plantillas, plantillas, idioma, null, t)}
                </span>
                <span className="eq-fila-dato">{alcanceEnPalabras(i.alcance, zonas, idioma)}</span>
                <span className="eq-fila-dato">
                  {t.expira}: {hora.fecha(i.expiraEn, null)}
                </span>
                {gestiona ? (
                  <MenuTresPuntos
                    etiqueta={`${t.masAcciones}: ${i.nombre}`}
                    opciones={[
                      {
                        texto: t.cancelarInvitacion,
                        peligro: true,
                        alTocar: () => void cancelarInvitacion(i.id),
                      },
                    ]}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="pd-tarjeta">
        {miembros.length === 0 ? <EstadoVacio titulo={t.sinMiembros} /> : null}
        <ul className="eq-filas">
          {miembros.length ? (
            <li className="eq-fila eq-fila-cabeza" aria-hidden="true">
              <span>{t.columnas.persona}</span>
              <span>{t.columnas.estado}</span>
              <span>{t.columnas.plantillas}</span>
              <span>{t.columnas.alcance}</span>
              <span>{t.columnas.ultima}</span>
              <span>{t.columnas.vence}</span>
              <span />
            </li>
          ) : null}
          {miembros.map((m) => {
            const yo = m.id === miId;
            const acciones =
              gestiona && !yo && !m.dueno
                ? [
                    ...(m.estado === 'suspendido' || m.estado === 'retirado'
                      ? [
                          {
                            texto: t.reactivar,
                            alTocar: () => setConfirmar({ accion: 'reactivar', m }),
                          },
                        ]
                      : [
                          {
                            texto: t.suspender,
                            alTocar: () => setConfirmar({ accion: 'suspender', m }),
                          },
                        ]),
                    ...(m.estado !== 'retirado'
                      ? [
                          {
                            texto: t.quitar,
                            peligro: true,
                            alTocar: () => setConfirmar({ accion: 'quitar', m }),
                          },
                        ]
                      : []),
                  ]
                : [];
            return (
              <li key={m.id} className="eq-fila">
                <div className="eq-fila-persona">
                  <Enlace a={`${base}/team/${m.id}`}>
                    <strong>
                      {m.nombre} {yo ? t.tu : ''}
                    </strong>
                  </Enlace>
                  <small>{m.correo}</small>
                </div>
                <span>
                  <Pastilla tono={new Map(Object.entries(TONO_ESTADO)).get(m.estado) ?? 'neutro'}>
                    {new Map(Object.entries(t.estados)).get(m.estado) ?? m.estado}
                  </Pastilla>
                  {m.dueno ? <small className="eq-dueno">{t.dueno}</small> : null}
                </span>
                <span className="eq-fila-dato">
                  {nombresPlantillas(m.plantillas, plantillas, idioma, m.perfilViejo, t)}
                </span>
                <span className="eq-fila-dato">{alcanceEnPalabras(m.alcance, zonas, idioma)}</span>
                <span className="eq-fila-dato" data-etiqueta={t.columnas.ultima}>
                  {m.ultimaEntrada ? hora.fecha(m.ultimaEntrada, null) : t.nunca}
                </span>
                <span className="eq-fila-dato" data-etiqueta={t.columnas.vence}>
                  {m.venceEn ? hora.fecha(m.venceEn, null, 'fecha') : t.sinVencimiento}
                </span>
                {acciones.length ? (
                  <MenuTresPuntos etiqueta={`${t.masAcciones}: ${m.nombre}`} opciones={acciones} />
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
        {siguiente ? (
          <button type="button" className="boton secundario" onClick={() => cargar(siguiente)}>
            {t.cargarMas}
          </button>
        ) : null}
      </section>
      {gestiona ? <InterruptorSegundoFactor idioma={idioma} /> : null}
      {confirmar ? (
        <ConfirmarConMotivo
          titulo={new Map(Object.entries(t.confirmarTitulo)).get(confirmar.accion) ?? ''}
          texto={new Map(Object.entries(t.confirmarTexto)).get(confirmar.accion) ?? ''}
          peligro={confirmar.accion !== 'reactivar'}
          idioma={idioma}
          alCancelar={() => setConfirmar(null)}
          alConfirmar={async (motivo) => {
            await pedir(
              'POST',
              `/datos/admin/equipo/miembros/${confirmar.m.id}/${confirmar.accion}`,
              {
                motivo,
              },
            );
            setConfirmar(null);
            setOk(t.guardado);
            cargar();
          }}
        />
      ) : null}
    </>
  );
}

function InterruptorSegundoFactor({ idioma }: { idioma: Idioma }) {
  const t = textosEquipo(idioma);
  const [activo, setActivo] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ activo: boolean }>('GET', '/datos/admin/equipo/ajustes/segundo-factor')
      .then((r) => setActivo(r.activo))
      .catch(() => setActivo(null));
  }, []);
  if (activo === null) return null;
  return (
    <section className="pd-tarjeta eq-interruptor">
      <label className="campo-check">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => {
            const nuevo = e.target.checked;
            setError('');
            pedir('PUT', '/datos/admin/equipo/ajustes/segundo-factor', { activo: nuevo })
              .then(() => setActivo(nuevo))
              .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
          }}
        />{' '}
        <strong>{t.segundoFactor}</strong> · {activo ? t.encendido : t.apagado}
      </label>
      <p className="pista">{t.segundoFactorAyuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function MisAvisos({ idioma }: { idioma: Idioma }) {
  const t = textosEquipo(idioma);
  const [avisos, setAvisos] = useState<{ tipo: string; activo: boolean; fijo: boolean }[]>([]);
  const [error, setError] = useState('');
  const nombreAviso = (tipo: string) => new Map(Object.entries(t.tiposAviso)).get(tipo) ?? tipo;
  const cargarAvisos = useCallback(() => {
    pedir<{ avisos: { tipo: string; activo: boolean; fijo: boolean }[] }>(
      'GET',
      '/datos/admin/mis-avisos',
    )
      .then((r) => setAvisos(r.avisos ?? []))
      .catch(() => setAvisos([]));
  }, []);
  useEffect(cargarAvisos, [cargarAvisos]);
  async function cambiarAviso(tipo: string, activo: boolean) {
    setError('');
    try {
      await pedir('PUT', '/datos/admin/mis-avisos', { tipo, activo });
      cargarAvisos();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <section className="pd-tarjeta">
      <h2>{t.misAvisos}</h2>
      <p className="pista">{t.misAvisosAyuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {avisos.map((a) => (
        <label key={a.tipo} className="campo-check">
          <input
            type="checkbox"
            checked={a.activo || a.fijo}
            disabled={a.fijo}
            onChange={(e) => void cambiarAviso(a.tipo, e.target.checked)}
          />{' '}
          {nombreAviso(a.tipo)}
        </label>
      ))}
    </section>
  );
}
