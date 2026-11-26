import { useEffect, useState } from 'react';
import { type Idioma, ErrorApi, enIdioma, estadosDelPais } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AyudaAqui } from './AyudaAqui';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';
import { fechaSuper } from './horario';
import { usePreferencias } from './usePreferencias';
import {
  type CiudadEspera,
  type RolEspera,
  ROLES_ESPERA,
  ciudadEscrita,
  ciudadesVisibles,
  leerRolEspera,
  nombrePaisCatalogo,
  sumaEspera,
  totalCiudad,
} from './esperaCiudad';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026, Richard; Venezuela y Estados Unidos). «Lista de
 * espera por ciudad»: cuántas personas esperan en cada ciudad donde todavía no hay zona abierta
 * («Maracaibo, Zulia: 14 esperando»), para decidir dónde abrir. Va en el grupo PERSONAS del menú y
 * sin número: no es una tarea que se pueda bajar, es un dato para decidir.
 *
 * Lee `GET /datos/admin/espera-ciudades?pais=&estado=` y, al tocar una ciudad,
 * `GET /datos/admin/espera-ciudades/personas?lugarId=`. El país, el estado y el «quién» se guardan
 * por empleado (C-FILTROS-GUARDADOS); lo escrito en el buscador no se guarda nunca.
 */
/** Una fila de `GET /datos/admin/espera-ciudades/personas` (servidor, parte B). Sin código: quien
 * espera su ciudad todavía no tiene ID (sin ciudad real no hay ID). */
type Persona = {
  id: string;
  rol: 'repartidor' | 'cliente' | string;
  nombre: string;
  creadoEn?: string | null;
  /** Papeles que ya subió (los conductores avanzan su registro mientras esperan). */
  papeles?: number;
};

const T = {
  es: {
    titulo: 'Lista de espera por ciudad',
    ayuda:
      'Personas que se registraron en una ciudad donde todavía no hay zona abierta. Su cuenta ya está creada. El día que abras una zona que cubre su ciudad, pasan solas a ella y Camila les avisa.',
    pais: 'País',
    estado: 'Estado',
    quien: 'Quién',
    todos: 'Todos',
    roles: {
      '': 'Todos',
      conductores: 'Conductores',
      clientes: 'Clientes',
      anonimos: 'Anotados en la web',
    } as Record<RolEspera, string>,
    buscar: 'Buscar por ciudad, municipio o estado',
    buscarEtiqueta: 'Buscar',
    total: (n: number, c: number) =>
      `${n} ${n === 1 ? 'persona espera' : 'personas esperan'} en ${c} ${c === 1 ? 'ciudad' : 'ciudades'}.`,
    vacio: 'Nadie espera con esos filtros.',
    sinCoincidencias: 'Ninguna ciudad coincide con lo que escribiste.',
    ciudad: 'Ciudad',
    conductores: 'Conductores',
    clientes: 'Clientes',
    anonimos: 'Web',
    esperando: 'Esperando',
    desde: 'Desde',
    verPersonas: (c: string) => `Ver quiénes esperan en ${c}`,
    ocultar: 'Ocultar',
    personas: (c: string) => `Quiénes esperan en ${c}`,
    sinPersonas:
      'Todavía no hay cuentas aquí: solo personas anotadas en la web con su correo (las ves en «Lista de espera»).',
    rol: { repartidor: 'Conductor', cliente: 'Cliente' } as Record<string, string>,
    alta: 'Se registró',
    papeles: (n: number) => (n === 1 ? '1 papel subido' : `${n} papeles subidos`),
    abrirFicha: 'Abrir su ficha',
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Waitlist by city',
    ayuda:
      'People who signed up in a city with no open zone yet. Their account already exists. The day you open a zone that covers their city, they move into it on their own and Camila lets them know.',
    pais: 'Country',
    estado: 'State',
    quien: 'Who',
    todos: 'All',
    roles: {
      '': 'Everyone',
      conductores: 'Drivers',
      clientes: 'Customers',
      anonimos: 'Signed up on the website',
    } as Record<RolEspera, string>,
    buscar: 'Search by city, county or state',
    buscarEtiqueta: 'Search',
    total: (n: number, c: number) =>
      `${n} ${n === 1 ? 'person is' : 'people are'} waiting in ${c} ${c === 1 ? 'city' : 'cities'}.`,
    vacio: 'Nobody is waiting with those filters.',
    sinCoincidencias: 'No city matches what you typed.',
    ciudad: 'City',
    conductores: 'Drivers',
    clientes: 'Customers',
    anonimos: 'Website',
    esperando: 'Waiting',
    desde: 'Since',
    verPersonas: (c: string) => `See who is waiting in ${c}`,
    ocultar: 'Hide',
    personas: (c: string) => `Who is waiting in ${c}`,
    sinPersonas:
      'No accounts here yet: only people who left their email on the website (see “Waitlist”).',
    rol: { repartidor: 'Driver', cliente: 'Customer' } as Record<string, string>,
    alta: 'Signed up',
    papeles: (n: number) => (n === 1 ? '1 document uploaded' : `${n} documents uploaded`),
    abrirFicha: 'Open their file',
    cargando: 'Loading…',
  },
};

export function SuperEsperaCiudad({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const pref = usePreferencias('espera-ciudades', { pais: '', region: '', servicio: '' });
  const pais = pref.valores.pais === 'VE' || pref.valores.pais === 'US' ? pref.valores.pais : '';
  const estado = pais ? (pref.valores.region ?? '') : '';
  const rol = leerRolEspera(pref.valores.servicio);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ ciudades?: CiudadEspera[]; error?: string } | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const consulta = new URLSearchParams();
  if (pais) consulta.set('pais', pais);
  if (estado) consulta.set('estado', estado);
  const qs = consulta.toString();
  useEffect(() => {
    if (!pref.listo) return;
    let vivo = true;
    pedir<{ total: number; ciudades: CiudadEspera[] }>(
      'GET',
      `/datos/admin/espera-ciudades${qs ? `?${qs}` : ''}`,
    )
      .then((r) => vivo && setRes({ ciudades: Array.isArray(r.ciudades) ? r.ciudades : [] }))
      .catch(
        (e: unknown) => vivo && setRes({ error: e instanceof ErrorApi ? e.message : String(e) }),
      );
    return () => {
      vivo = false;
    };
  }, [qs, pref.listo]);

  const todas = res?.ciudades ?? [];
  // Sin texto: lo del país, estado y quién. Con texto: además lo que coincide.
  const conFiltros = ciudadesVisibles(todas, { pais, estado, rol });
  const visibles = ciudadesVisibles(todas, { pais, estado, rol, q });
  const estados = estadosDelPais(pais);

  return (
    <section className="super" data-testid="espera-ciudades">
      <h1>
        {t.titulo} <AyudaAqui guia="city-waitlist" idioma={idioma} />
      </h1>
      <p className="pista">{t.ayuda}</p>
      <div className="super-busqueda" role="search">
        <label>
          {t.pais}
          <select
            value={pais}
            onChange={(e) => {
              pref.cambiar('pais', e.target.value);
              pref.cambiar('region', '');
            }}
            data-testid="espera-pais"
          >
            <option value="">{t.todos}</option>
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
            value={estado}
            onChange={(e) => pref.cambiar('region', e.target.value)}
            disabled={!pais}
            style={{ minWidth: 160 }}
            data-testid="espera-estado"
          >
            <option value="">{t.todos}</option>
            {estados.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {pais === 'US' ? `${e.nombre} (${e.codigo})` : e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.quien}
          <select
            value={rol}
            onChange={(e) => pref.cambiar('servicio', e.target.value)}
            data-testid="espera-rol"
          >
            {ROLES_ESPERA.map((r) => (
              <option key={r || 'todos'} value={r}>
                {new Map(Object.entries(t.roles)).get(r) ?? r}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: '1 1 240px' }}>
          {t.buscarEtiqueta}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.buscar}
            aria-label={t.buscar}
            data-testid="espera-buscar"
            style={{ flex: 'none' }}
          />
        </label>
      </div>
      <AvisoFiltrosGuardados
        visible={pref.guardados}
        idioma={idioma}
        restablecer={pref.restablecer}
      />
      {res?.error ? (
        <p className="error-general" role="alert">
          {res.error}
        </p>
      ) : null}
      {!res ? <p role="status">{t.cargando}</p> : null}
      {res?.ciudades ? (
        <p data-testid="espera-total">
          <strong>{t.total(sumaEspera(visibles, rol), visibles.length)}</strong>
        </p>
      ) : null}
      {res?.ciudades && conFiltros.length === 0 ? <p>{t.vacio}</p> : null}
      {res?.ciudades && conFiltros.length > 0 && visibles.length === 0 ? (
        <p>{t.sinCoincidencias}</p>
      ) : null}
      {visibles.length > 0 ? (
        <div className="tabla-ancha">
          <table className="tabla" data-testid="espera-tabla">
            <thead>
              <tr>
                <th scope="col">{t.ciudad}</th>
                <th scope="col">{t.esperando}</th>
                <th scope="col">{t.conductores}</th>
                <th scope="col">{t.clientes}</th>
                <th scope="col">{t.anonimos}</th>
                <th scope="col">{t.desde}</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const nombre = ciudadEscrita(c);
                const abierto = abierta === c.lugarId;
                return (
                  <FilaCiudad
                    key={c.lugarId}
                    c={c}
                    nombre={nombre}
                    rol={rol}
                    abierto={abierto}
                    alternar={() => setAbierta(abierto ? null : c.lugarId)}
                    base={base}
                    idioma={idioma}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function FilaCiudad({
  c,
  nombre,
  rol,
  abierto,
  alternar,
  base,
  idioma,
}: {
  c: CiudadEspera;
  nombre: string;
  rol: RolEspera;
  abierto: boolean;
  alternar: () => void;
  base: string;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  return (
    <>
      <tr data-lugar={c.lugarId}>
        <td>
          <button
            type="button"
            className="enlace"
            aria-expanded={abierto}
            aria-label={abierto ? t.ocultar : t.verPersonas(nombre)}
            onClick={alternar}
          >
            {nombre}
          </button>
          {c.municipio ? <small className="suave"> · {c.municipio}</small> : null}
        </td>
        <td>
          <strong data-testid={`espera-n-${c.lugarId}`}>{totalCiudad(c, rol)}</strong>
        </td>
        <td>{c.conductores}</td>
        <td>{c.clientes}</td>
        <td>{c.anonimos}</td>
        <td>{fechaSuper(c.desde ?? null, idioma, { estilo: 'fecha' })}</td>
      </tr>
      {abierto ? (
        <tr>
          <td colSpan={6}>
            <PersonasCiudad lugarId={c.lugarId} nombre={nombre} base={base} idioma={idioma} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function PersonasCiudad({
  lugarId,
  nombre,
  base,
  idioma,
}: {
  lugarId: string;
  nombre: string;
  base: string;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const [res, setRes] = useState<{ personas?: Persona[]; error?: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    pedir<{ personas: Persona[] }>(
      'GET',
      `/datos/admin/espera-ciudades/personas?lugarId=${encodeURIComponent(lugarId)}`,
    )
      .then((r) => vivo && setRes({ personas: Array.isArray(r.personas) ? r.personas : [] }))
      .catch(
        (e: unknown) => vivo && setRes({ error: e instanceof ErrorApi ? e.message : String(e) }),
      );
    return () => {
      vivo = false;
    };
  }, [lugarId]);
  const ficha = (p: Persona) =>
    p.rol === 'cliente' ? `${base}/customers/${p.id}` : `${base}/drivers/${p.id}`;
  return (
    <div data-testid="espera-personas">
      <h2>{t.personas(nombre)}</h2>
      {!res ? <p role="status">{t.cargando}</p> : null}
      {res?.error ? (
        <p className="error-general" role="alert">
          {res.error}
        </p>
      ) : null}
      {res?.personas?.length === 0 ? <p className="pista">{t.sinPersonas}</p> : null}
      {res?.personas?.length ? (
        <ul className="super-lista">
          {res.personas.map((p) => (
            <li key={p.id}>
              <Enlace a={ficha(p)}>{p.nombre}</Enlace>{' '}
              <Insignia tono="apagado">
                {new Map(Object.entries(t.rol)).get(p.rol) ?? p.rol}
              </Insignia>{' '}
              <small className="suave">
                {t.alta}: {fechaSuper(p.creadoEn ?? null, idioma, { estilo: 'fecha' })}
                {p.rol === 'repartidor' && typeof p.papeles === 'number'
                  ? ` · ${t.papeles(p.papeles)}`
                  : ''}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
