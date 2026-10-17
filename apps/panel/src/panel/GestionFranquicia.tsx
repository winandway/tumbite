import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  correoEjemplo,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';

/**
 * Territorio y equipo de una franquicia (C-TERRITORIO), dentro del superadmin: qué áreas de su
 * ciudad administra, quiénes entran a su panel (dueño y managers) y sus condiciones comerciales,
 * que quedan «pendientes de definición» hasta que el negocio las fije.
 */
type Condiciones = {
  cuotaEntradaCentavos: number | null;
  porcentajeIngresos: number | null;
  cuotaMensualCentavos: number | null;
  plazoMeses: number | null;
  exclusividadTerritorial: boolean | null;
  observaciones: string;
};
type Detalle = {
  franquicia: { id: string; nombre: string; ciudad: string; condiciones: Condiciones };
  areas: { id: string; nombre: string; estado: string; asignada: boolean; deOtra: boolean }[];
  miembros: { correo: string; rol: 'dueno' | 'manager'; desde: string; tieneCuenta: boolean }[];
};

const T = {
  es: {
    territorio: 'Territorio',
    sinAreas: 'Esta ciudad no tiene áreas todavía. Dibújalas en Zonas → Áreas.',
    deOtra: 'de otra franquicia',
    guardarAreas: 'Guardar territorio',
    equipo: 'Equipo con acceso a su panel',
    sinEquipo: 'Todavía no hay managers.',
    manager: 'Manager',
    dueno: 'Dueño',
    sinCuenta: 'aún sin cuenta: entra cuando se registre con ese correo',
    correo: 'Correo',
    rol: 'Papel',
    agregar: 'Dar acceso',
    quitar: 'Quitar acceso',
    opciones: 'Opciones',
    seguro: '¿Quitarle el acceso a este panel?',
    condiciones: 'Condiciones comerciales',
    pendiente: 'Pendiente de definición comercial',
    cuotaEntrada: 'Cuota de entrada (dólares)',
    porcentaje: 'Porcentaje sobre ingresos (%)',
    cuotaMensual: 'Cuota mensual (dólares)',
    plazo: 'Plazo del contrato (meses)',
    exclusividad: 'Exclusividad territorial',
    si: 'Sí',
    no: 'No',
    observaciones: 'Observaciones',
    guardarCondiciones: 'Guardar condiciones',
    guardado: 'Guardado',
    estadosArea: {
      borrador: 'borrador',
      proximamente: 'próximamente',
      activa: 'activa',
      pausada: 'pausada',
      cerrada: 'cerrada',
    } as Record<string, string>,
  },
  en: {
    territorio: 'Territory',
    sinAreas: 'This city has no areas yet. Draw them in Zones → Areas.',
    deOtra: 'another franchise’s',
    guardarAreas: 'Save territory',
    equipo: 'Team with access to its dashboard',
    sinEquipo: 'No managers yet.',
    manager: 'Manager',
    dueno: 'Owner',
    sinCuenta: 'no account yet: gets in as soon as they sign up with that email',
    correo: 'Email',
    rol: 'Role',
    agregar: 'Grant access',
    quitar: 'Remove access',
    opciones: 'Options',
    seguro: 'Remove their access to this dashboard?',
    condiciones: 'Business terms',
    pendiente: 'Pending business definition',
    cuotaEntrada: 'Entry fee (dollars)',
    porcentaje: 'Revenue share (%)',
    cuotaMensual: 'Monthly fee (dollars)',
    plazo: 'Contract term (months)',
    exclusividad: 'Territorial exclusivity',
    si: 'Yes',
    no: 'No',
    observaciones: 'Notes',
    guardarCondiciones: 'Save terms',
    guardado: 'Saved',
    estadosArea: {
      borrador: 'draft',
      proximamente: 'coming soon',
      activa: 'live',
      pausada: 'paused',
      cerrada: 'closed',
    } as Record<string, string>,
  },
};

const aTexto = (n: number | null, centavos = false) =>
  n == null ? '' : String(centavos ? n / 100 : n);
const aNumero = (s: string, centavos = false) => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return centavos ? Math.round(n * 100) : n;
};

export function GestionFranquicia({
  id,
  usuario,
  idioma,
}: {
  id: string;
  usuario: Usuario;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Detalle | null>(null);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
  const miembro = useBorrador({
    formulario: `miembro-franquicia-${id}`,
    cuenta: usuario.id,
    inicial: { correo: '', rol: 'manager' },
    almacen: almacenNavegador,
  });
  const cond = useBorrador({
    formulario: `condiciones-franquicia-${id}`,
    cuenta: usuario.id,
    inicial: {
      cuotaEntrada: '',
      porcentaje: '',
      cuotaMensual: '',
      plazo: '',
      exclusividad: '',
      observaciones: '',
    },
    almacen: almacenNavegador,
  });

  const cargar = useCallback(() => {
    pedir<Detalle>('GET', `/datos/admin/franquicias/${id}`)
      .then((r) => {
        setD(r);
        setElegidas(r.areas.filter((a) => a.asignada).map((a) => a.id));
        // Lo guardado es la base; si había algo a medio escribir, eso manda.
        const c = r.franquicia.condiciones;
        cond.cargarBase({
          cuotaEntrada: aTexto(c.cuotaEntradaCentavos, true),
          porcentaje: aTexto(c.porcentajeIngresos),
          cuotaMensual: aTexto(c.cuotaMensualCentavos, true),
          plazo: aTexto(c.plazoMeses),
          exclusividad:
            c.exclusividadTerritorial == null ? '' : c.exclusividadTerritorial ? 'si' : 'no',
          observaciones: c.observaciones,
        });
      })
      .catch((x: unknown) => setError(mensaje(x)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(cargar, [cargar]);

  async function hacer(accion: () => Promise<unknown>, despues?: () => Promise<void>) {
    setError('');
    setAviso('');
    try {
      await accion();
      await despues?.();
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }

  if (!d) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const v = cond.valores;
  return (
    <div className="gestion-franquicia">
      <h3>{t.territorio}</h3>
      {d.areas.length === 0 ? (
        <p className="pista">{t.sinAreas}</p>
      ) : (
        <fieldset className="campo">
          {d.areas.map((a) => (
            <label key={a.id} className="casilla">
              <input
                type="checkbox"
                disabled={a.deOtra}
                checked={elegidas.includes(a.id)}
                onChange={(e) =>
                  setElegidas(
                    e.target.checked ? [...elegidas, a.id] : elegidas.filter((x) => x !== a.id),
                  )
                }
              />{' '}
              {a.nombre}{' '}
              <small>
                ({new Map(Object.entries(t.estadosArea)).get(a.estado) ?? a.estado}
                {a.deOtra ? ` · ${t.deOtra}` : ''})
              </small>
            </label>
          ))}
          <button
            type="button"
            className="boton"
            onClick={() =>
              void hacer(() =>
                pedir('PUT', `/datos/admin/franquicias/${id}/areas`, { areaIds: elegidas }),
              )
            }
          >
            {t.guardarAreas}
          </button>
        </fieldset>
      )}

      <h3>{t.equipo}</h3>
      {d.miembros.length === 0 && <p className="pista">{t.sinEquipo}</p>}
      <ul className="lista">
        {d.miembros.map((m) => (
          <li key={m.correo}>
            <div className="lista-texto">
              <strong>{m.correo}</strong>
              <span>
                {m.rol === 'dueno' ? t.dueno : t.manager}
                {m.tieneCuenta ? '' : ` · ${t.sinCuenta}`}
              </span>
            </div>
            <MenuTresPuntos
              etiqueta={t.opciones}
              opciones={[
                {
                  texto: t.quitar,
                  peligro: true,
                  alTocar: () => {
                    if (!window.confirm(t.seguro)) return;
                    void hacer(() =>
                      pedir(
                        'DELETE',
                        `/datos/admin/franquicias/${id}/miembros/${encodeURIComponent(m.correo)}`,
                      ),
                    );
                  },
                },
              ]}
            />
          </li>
        ))}
      </ul>
      <form
        className="formulario"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void hacer(
            () => pedir('POST', `/datos/admin/franquicias/${id}/miembros`, miembro.valores),
            () => miembro.limpiar(),
          );
        }}
      >
        <AvisoBorrador
          visible={miembro.recuperado}
          idioma={idioma}
          empezar={() => void miembro.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.correo}</span>
          <input
            type="email"
            value={miembro.valores.correo}
            placeholder={correoEjemplo(idioma)}
            onChange={(e) => miembro.cambiar('correo', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.rol}</span>
          <select
            value={miembro.valores.rol}
            onChange={(e) => miembro.cambiar('rol', e.target.value)}
          >
            <option value="manager">{t.manager}</option>
            <option value="dueno">{t.dueno}</option>
          </select>
        </label>
        <button type="submit" className="boton">
          {t.agregar}
        </button>
      </form>

      <h3>{t.condiciones}</h3>
      <form
        className="formulario"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void hacer(
            () =>
              pedir('PATCH', `/datos/admin/franquicias/${id}`, {
                condiciones: {
                  cuotaEntradaCentavos: aNumero(v.cuotaEntrada, true),
                  porcentajeIngresos: aNumero(v.porcentaje),
                  cuotaMensualCentavos: aNumero(v.cuotaMensual, true),
                  plazoMeses: aNumero(v.plazo),
                  exclusividadTerritorial: v.exclusividad === '' ? null : v.exclusividad === 'si',
                  observaciones: v.observaciones,
                },
              }),
            () => cond.limpiar(),
          );
        }}
      >
        <AvisoBorrador
          visible={cond.recuperado}
          idioma={idioma}
          empezar={() => void cond.empezarDeNuevo()}
        />
        {(
          [
            ['cuotaEntrada', t.cuotaEntrada, v.cuotaEntrada],
            ['porcentaje', t.porcentaje, v.porcentaje],
            ['cuotaMensual', t.cuotaMensual, v.cuotaMensual],
            ['plazo', t.plazo, v.plazo],
          ] as const
        ).map(([k, etiqueta, valor]) => (
          <label className="campo" key={k}>
            <span>{etiqueta}</span>
            <input
              inputMode="decimal"
              value={valor}
              placeholder={t.pendiente}
              onChange={(e) => cond.cambiar(k, e.target.value)}
            />
          </label>
        ))}
        <label className="campo">
          <span>{t.exclusividad}</span>
          <select
            value={v.exclusividad}
            onChange={(e) => cond.cambiar('exclusividad', e.target.value)}
          >
            <option value="">{t.pendiente}</option>
            <option value="si">{t.si}</option>
            <option value="no">{t.no}</option>
          </select>
        </label>
        <label className="campo">
          <span>{t.observaciones}</span>
          <textarea
            rows={2}
            value={v.observaciones}
            onChange={(e) => cond.cambiar('observaciones', e.target.value)}
          />
        </label>
        <button type="submit" className="boton">
          {t.guardarCondiciones}
        </button>
      </form>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="ok" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}

type Solicitud = {
  id: string;
  nombre: string;
  correo: string;
  pais: string;
  ciudad: string;
  asunto: string;
  creada: string;
  franquicia_id: string | null;
};

const TS = {
  es: {
    solicitudes: 'Solicitudes del formulario «Quiero una franquicia»',
    vacio: 'No hay solicitudes todavía.',
    ciudad: 'Ciudad de Tumbite',
    elegir: 'Elige una ciudad',
    convertir: 'Crear franquicia en prospecto',
    convertida: 'Ya es franquicia',
  },
  en: {
    solicitudes: 'Requests from the “I want a franchise” form',
    vacio: 'No requests yet.',
    ciudad: 'Tumbite city',
    elegir: 'Choose a city',
    convertir: 'Create prospect franchise',
    convertida: 'Already a franchise',
  },
};

/** Las solicitudes del formulario público, con el paso para convertirlas en franquicia. */
export function SolicitudesFranquicia({
  zonas,
  idioma,
  alCrear,
}: {
  zonas: { id: string; nombre: string }[];
  idioma: Idioma;
  alCrear: () => void;
}) {
  const t = enIdioma(TS, idioma);
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [ciudad, setCiudad] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ solicitudes: Solicitud[] }>('GET', '/datos/admin/solicitudes-franquicia')
      .then((r) => setLista(r.solicitudes))
      .catch(() => setLista([]));
  }, []);
  useEffect(cargar, [cargar]);
  const ciudadDe = (id: string) => new Map(Object.entries(ciudad)).get(id) ?? '';

  async function convertir(s: Solicitud) {
    setError('');
    try {
      await pedir('POST', `/datos/admin/franquicias/desde-solicitud/${s.id}`, {
        zonaId: ciudadDe(s.id),
      });
      cargar();
      alCrear();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section>
      <h2>{t.solicitudes}</h2>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {lista && lista.length === 0 && <p className="pista">{t.vacio}</p>}
      <ul className="lista">
        {lista?.map((s) => (
          <li key={s.id}>
            <div className="lista-texto">
              <strong>
                {s.nombre} · {s.correo}
              </strong>
              <span>
                {s.ciudad} {s.pais ? `(${s.pais})` : ''} · {s.creada}
              </span>
              <span>{s.asunto}</span>
            </div>
            {s.franquicia_id ? (
              <span className="insignia insignia-aprobado">{t.convertida}</span>
            ) : (
              <>
                <label className="campo">
                  <span>{t.ciudad}</span>
                  <select
                    value={ciudadDe(s.id)}
                    onChange={(e) => setCiudad({ ...ciudad, [s.id]: e.target.value })}
                  >
                    <option value="">{t.elegir}</option>
                    {zonas.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="boton"
                  disabled={!ciudadDe(s.id)}
                  onClick={() => void convertir(s)}
                >
                  {t.convertir}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
