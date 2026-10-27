/* eslint-disable security/detect-object-injection -- índices sobre los textos y resúmenes fijos, nunca claves del usuario */
import { useCallback, useEffect, useState } from 'react';
import { PERMISOS_CLAVE_API, almacenNavegador, useBorrador } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { Campo } from '../CampoClave';
import { crear, pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';
import { ConfigEntrega } from './PantallasRutas';

/** Pantallas de la empresa: inicio, perfil, centros, equipo, conductores y claves de API. */

function Error_({ error }: { error: string }) {
  return error ? (
    <p className="error-general" role="alert">
      {error}
    </p>
  ) : null;
}

export function Inicio({ ctx, resumen }: { ctx: Contexto; resumen: Record<string, number> }) {
  const { t, raiz } = ctx;
  const tarjetas: [keyof typeof t.resumen, string][] = [
    ['centros', `${raiz}/hubs`],
    ['miembros', `${raiz}/team`],
    ['conductores', `${raiz}/drivers`],
    ['envios', `${raiz}/shipments`],
    ['paquetes', `${raiz}/packages`],
    ['entregados', `${raiz}/packages?estado=entregado`],
    ['pendientes', `${raiz}/packages`],
  ];
  return (
    <section className="super">
      <h1>{ctx.empresa.nombre}</h1>
      <p>
        <span className={`insignia ${ctx.empresa.estado === 'activa' ? 'insignia-aprobado' : ''}`}>
          {t.estadosEmpresa[ctx.empresa.estado] ?? ctx.empresa.estado}
        </span>{' '}
        · {ctx.empresa.pais} · {ctx.empresa.moneda}
      </p>
      <ul className="super-tarjetas">
        {tarjetas.map(([k, a]) => (
          <li className="super-tarjeta" key={k}>
            <span>{t.resumen[k]}</span>
            <strong>{resumen[k] ?? 0}</strong>
            <Enlace a={a} className="enlace">
              {t.verDetalle}
            </Enlace>
          </li>
        ))}
      </ul>
      <h2>{t.primerosPasos}</h2>
      <ol className="flex-pasos">
        {t.pasos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </section>
  );
}

export function Perfil({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [nombre, setNombre] = useState(empresa.nombre);
  const [razon, setRazon] = useState(empresa.razonSocial);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const puede = ctx.permisos.includes('empresa.editar');
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PATCH', `${BASE_FLEX}/empresas/${empresa.id}`, { nombre, razonSocial: razon });
      setOk(true);
      ctx.recargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <section className="super">
      <h1>{t.perfil}</h1>
      <Error_ error={error} />
      <form onSubmit={guardar} noValidate className="flex-form">
        <Campo etiqueta={t.nombreComercial} valor={nombre} cambiar={setNombre} />
        <Campo etiqueta={t.razonSocial} valor={razon} cambiar={setRazon} />
        <p>
          {t.pais}: <strong>{empresa.pais}</strong> · {t.moneda}: <strong>{empresa.moneda}</strong>{' '}
          · {t.estado}: <strong>{t.estadosEmpresa[empresa.estado] ?? empresa.estado}</strong>
        </p>
        {puede && (
          <button type="submit" className="boton">
            {t.guardar}
          </button>
        )}
        {ok && <span className="insignia insignia-aprobado">✓</span>}
      </form>
      <ConfigEntrega ctx={ctx} />
      <Auditoria ctx={ctx} />
    </section>
  );
}

function Auditoria({ ctx }: { ctx: Contexto }) {
  const [eventos, setEventos] = useState<
    { id: number; actor: string; accion: string; objeto: string; creadoEn: string }[]
  >([]);
  useEffect(() => {
    if (!ctx.permisos.includes('miembros.gestionar')) return;
    pedir<{ eventos: typeof eventos }>('GET', `${BASE_FLEX}/empresas/${ctx.empresa.id}/auditoria`)
      .then((r) => setEventos(r.eventos.slice(0, 30)))
      .catch(() => setEventos([]));
  }, [ctx.empresa.id, ctx.permisos]);
  if (!eventos.length) return null;
  return (
    <>
      <h2>{ctx.t.auditoria}</h2>
      <ul className="super-lista">
        {eventos.map((e) => (
          <li key={e.id}>
            <strong>{e.accion}</strong> · {e.actor} · {e.creadoEn}
          </li>
        ))}
      </ul>
    </>
  );
}

type Centro = {
  id: string;
  nombre: string;
  direccion: string;
  pais: string;
  ciudad: string;
  estado: string;
  zonaHoraria: string;
};
const INICIAL_CENTRO = { nombre: '', direccion: '', ciudad: '', lat: '', lng: '' };

export function Centros({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [lista, setLista] = useState<Centro[] | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  const b = useBorrador({
    formulario: `flex-centro-${empresa.id}`,
    inicial: INICIAL_CENTRO,
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ centros: Centro[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/centros`)
      .then((r) => setLista(r.centros))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  const puede = ctx.permisos.includes('centros.gestionar');
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const v = b.valores;
    try {
      await crear(`${BASE_FLEX}/empresas/${empresa.id}/centros`, {
        nombre: v.nombre,
        direccion: v.direccion,
        ciudad: v.ciudad,
        pais: empresa.pais,
        lat: v.lat === '' ? null : Number(v.lat),
        lng: v.lng === '' ? null : Number(v.lng),
      });
      await b.limpiar();
      setAbierto(false);
      cargar();
      ctx.recargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function estado(c: Centro) {
    await pedir('PATCH', `${BASE_FLEX}/empresas/${empresa.id}/centros/${c.id}`, {
      estado: c.estado === 'activo' ? 'inactivo' : 'activo',
    });
    cargar();
  }
  const v = b.valores;
  return (
    <section className="super">
      <h1>{t.centros}</h1>
      <Error_ error={error} />
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinCentros}</p>
      ) : null}
      {lista && lista.length > 0 && (
        <ul className="super-lista">
          {lista.map((c) => (
            <li key={c.id}>
              <strong>{c.nombre}</strong> · {c.direccion}, {c.ciudad} ·{' '}
              <span
                className={`insignia ${c.estado === 'activo' ? 'insignia-aprobado' : 'insignia-pausado'}`}
              >
                {c.estado === 'activo' ? t.activo : t.inactivo}
              </span>{' '}
              {puede && (
                <button type="button" className="enlace" onClick={() => void estado(c)}>
                  {c.estado === 'activo' ? t.desactivar : t.activar}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puede && !abierto && (
        <button type="button" className="boton" onClick={() => setAbierto(true)}>
          {t.nuevoCentro}
        </button>
      )}
      {puede && abierto && (
        <form onSubmit={guardar} noValidate className="flex-form">
          <h2>{t.nuevoCentro}</h2>
          {b.recuperado && (
            <p className="aviso-borrador">
              {t.recuperado}{' '}
              <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
                {t.empezarDeNuevo}
              </button>
            </p>
          )}
          <Campo
            etiqueta={t.nombre}
            valor={v.nombre}
            cambiar={(x) => b.cambiar('nombre', x)}
            placeholder={t.nombre}
          />
          <Campo
            etiqueta={t.direccion}
            valor={v.direccion}
            cambiar={(x) => b.cambiar('direccion', x)}
            placeholder={t.direccion}
          />
          <Campo
            etiqueta={t.ciudad}
            valor={v.ciudad}
            cambiar={(x) => b.cambiar('ciudad', x)}
            placeholder={t.ciudad}
          />
          <Campo
            etiqueta={t.latitud}
            valor={v.lat}
            cambiar={(x) => b.cambiar('lat', x)}
            placeholder="25.7743"
          />
          <Campo
            etiqueta={t.longitud}
            valor={v.lng}
            cambiar={(x) => b.cambiar('lng', x)}
            placeholder="-80.1937"
          />
          <div className="fila-botones">
            <button type="submit" className="boton">
              {t.guardar}
            </button>
            <button type="button" className="boton secundario" onClick={() => setAbierto(false)}>
              {t.cancelar}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

type Miembro = { usuarioId: string; nombre: string; correo: string; rol: string; estado: string };
type Invitacion = { id: string; correo: string; rol: string; estado: string; expiraEn: string };
const INICIAL_INV = { correo: '', rol: 'operador' };

export function Equipo({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [datos, setDatos] = useState<{ miembros: Miembro[]; invitaciones: Invitacion[] } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: `flex-invitar-${empresa.id}`,
    inicial: INICIAL_INV,
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ miembros: Miembro[]; invitaciones: Invitacion[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/miembros`,
    )
      .then(setDatos)
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    try {
      await pedir('POST', `${BASE_FLEX}/empresas/${empresa.id}/invitaciones`, b.valores);
      await b.limpiar();
      setAviso(t.invitacionEnviada);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function revocar(id: string) {
    await pedir('DELETE', `${BASE_FLEX}/empresas/${empresa.id}/invitaciones/${id}`);
    cargar();
  }
  async function retirar(m: Miembro) {
    await pedir('PATCH', `${BASE_FLEX}/empresas/${empresa.id}/miembros/${m.usuarioId}`, {
      estado: m.estado === 'activo' ? 'retirado' : 'activo',
    });
    cargar();
    ctx.recargar();
  }
  const v = b.valores;
  return (
    <section className="super">
      <h1>{t.equipo}</h1>
      <Error_ error={error} />
      {aviso && <p className="aviso-borrador">{aviso}</p>}
      <form onSubmit={invitar} noValidate className="flex-form flex-inline">
        <h2>{t.invitar}</h2>
        <Campo
          etiqueta={t.correo}
          tipo="email"
          valor={v.correo}
          cambiar={(x) => b.cambiar('correo', x)}
          placeholder="name@example.com"
        />
        <div className="campo">
          <label htmlFor="flex-rol">{t.rol}</label>
          <select id="flex-rol" value={v.rol} onChange={(e) => b.cambiar('rol', e.target.value)}>
            {['operaciones', 'operador', 'finanzas', 'api'].map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="boton">
          {t.enviarInvitacion}
        </button>
      </form>
      <h2>{t.miembros}</h2>
      <ul className="super-lista">
        {datos?.miembros.map((m) => (
          <li key={m.usuarioId}>
            <strong>{m.nombre}</strong> · {m.correo} ·{' '}
            <span className="insignia">{t.roles[m.rol] ?? m.rol}</span>
            {m.estado !== 'activo' && (
              <span className="insignia insignia-pausado">{t.inactivo}</span>
            )}{' '}
            {m.rol !== 'dueno' && (
              <button type="button" className="enlace" onClick={() => void retirar(m)}>
                {m.estado === 'activo' ? t.retirar : t.activar}
              </button>
            )}
          </li>
        ))}
      </ul>
      <h2>{t.invitaciones}</h2>
      {!datos?.invitaciones.length ? (
        <p className="pista">{t.sinInvitaciones}</p>
      ) : (
        <ul className="super-lista">
          {datos.invitaciones.map((i) => (
            <li key={i.id}>
              {i.correo} · {t.roles[i.rol] ?? i.rol} ·{' '}
              <span
                className={`insignia ${i.estado === 'aceptada' ? 'insignia-aprobado' : i.estado === 'pendiente' ? '' : 'insignia-pausado'}`}
              >
                {t.estadosInvitacion[i.estado] ?? i.estado}
              </span>{' '}
              {i.estado === 'pendiente' && (
                <button type="button" className="enlace" onClick={() => void revocar(i.id)}>
                  {t.revocar}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Conductor = { usuarioId: string; nombre: string; vinculo: string; estado: string };

export function Conductores({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [lista, setLista] = useState<Conductor[] | null>(null);
  const [error, setError] = useState('');
  const [correo, setCorreo] = useState('');
  const [vinculo, setVinculo] = useState('propio');
  const cargar = useCallback(() => {
    pedir<{ conductores: Conductor[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/conductores`)
      .then((r) => setLista(r.conductores))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('POST', `${BASE_FLEX}/empresas/${empresa.id}/conductores`, { correo, vinculo });
      setCorreo('');
      cargar();
      ctx.recargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function estado(c: Conductor) {
    await pedir('PATCH', `${BASE_FLEX}/empresas/${empresa.id}/conductores/${c.usuarioId}`, {
      estado: c.estado === 'activo' ? 'retirado' : 'activo',
    });
    cargar();
  }
  return (
    <section className="super">
      <h1>{t.conductores}</h1>
      <Error_ error={error} />
      <form onSubmit={vincular} noValidate className="flex-form flex-inline">
        <h2>{t.vincular}</h2>
        <Campo
          etiqueta={t.correoConductor}
          tipo="email"
          valor={correo}
          cambiar={setCorreo}
          placeholder="driver@example.com"
        />
        <div className="campo">
          <label htmlFor="flex-vinculo">{t.vinculo}</label>
          <select id="flex-vinculo" value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
            {['propio', 'red', 'hibrido'].map((x) => (
              <option key={x} value={x}>
                {t.vinculos[x]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="boton">
          {t.vincular}
        </button>
      </form>
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinConductores}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((c) => (
            <li key={c.usuarioId}>
              <strong>{c.nombre}</strong> · {t.vinculos[c.vinculo] ?? c.vinculo} ·{' '}
              <span
                className={`insignia ${c.estado === 'activo' ? 'insignia-aprobado' : 'insignia-pausado'}`}
              >
                {c.estado === 'activo' ? t.activo : t.inactivo}
              </span>{' '}
              <button type="button" className="enlace" onClick={() => void estado(c)}>
                {c.estado === 'activo' ? t.retirar : t.activar}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Clave = {
  id: string;
  nombre: string;
  prefijo: string;
  permisos: string[];
  estado: string;
  usos: number;
  ultimoUsoEn: string | null;
};

export function Claves({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [lista, setLista] = useState<Clave[] | null>(null);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [permisos, setPermisos] = useState<string[]>(['envios.crear', 'envios.ver']);
  const [nueva, setNueva] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const cargar = useCallback(() => {
    pedir<{ claves: Clave[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/claves`)
      .then((r) => setLista(r.claves))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  async function crearClave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await pedir<{ clave: { secreto: string } }>(
        'POST',
        `${BASE_FLEX}/empresas/${empresa.id}/claves`,
        { nombre, permisos },
      );
      setNueva(r.clave.secreto);
      setCopiada(false);
      setNombre('');
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function revocar(id: string) {
    await pedir('DELETE', `${BASE_FLEX}/empresas/${empresa.id}/claves/${id}`);
    cargar();
  }
  return (
    <section className="super">
      <h1>{t.claves}</h1>
      <p className="pista">{t.clavesAyuda}</p>
      <p>
        <Enlace a="/docs/business/flex-api" className="enlace">
          {t.docsApi}
        </Enlace>
      </p>
      <Error_ error={error} />
      {nueva && (
        <div className="flex-clave-nueva" role="status">
          <p>{t.claveCreada}</p>
          <code>{nueva}</code>{' '}
          <button
            type="button"
            className="boton secundario"
            onClick={() => {
              void navigator.clipboard?.writeText(nueva).then(() => setCopiada(true));
            }}
          >
            {copiada ? t.copiada : t.copiar}
          </button>
        </div>
      )}
      <form onSubmit={crearClave} noValidate className="flex-form">
        <h2>{t.nuevaClave}</h2>
        <Campo etiqueta={t.nombreClave} valor={nombre} cambiar={setNombre} placeholder="ERP" />
        <fieldset className="campo">
          <legend>{t.permisos}</legend>
          {PERMISOS_CLAVE_API.map((p) => (
            <label key={p} className="flex-check">
              <input
                type="checkbox"
                checked={permisos.includes(p)}
                onChange={(e) =>
                  setPermisos(e.target.checked ? [...permisos, p] : permisos.filter((x) => x !== p))
                }
              />{' '}
              {p}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="boton">
          {t.nuevaClave}
        </button>
      </form>
      <ul className="super-lista">
        {lista?.map((c) => (
          <li key={c.id}>
            <strong>{c.nombre}</strong> · <code>{c.prefijo}…</code> · {c.permisos.join(', ')} ·{' '}
            {c.usos} {t.usos} · {t.ultimoUso}: {c.ultimoUsoEn ?? t.nunca}{' '}
            {c.estado === 'activa' ? (
              <button type="button" className="enlace" onClick={() => void revocar(c.id)}>
                {t.revocar}
              </button>
            ) : (
              <span className="insignia insignia-pausado">{t.revocada}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
