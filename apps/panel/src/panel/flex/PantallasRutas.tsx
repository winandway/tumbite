/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, almacenNavegador, useBorrador } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { Campo } from '../CampoClave';
import { crear, pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';

/**
 * Divoox Flex · Fase 2 en el panel de la empresa: rutas operativas (lista con filtros y detalle
 * con asignación, progreso, paradas, incidencias, pruebas y resumen), devoluciones e incidencias.
 * El seguimiento se hace con consultas controladas (cada 20 s y solo con la ruta activa).
 */

type FilaRuta = {
  id: string;
  nombre: string;
  estado: string;
  centro: string | null;
  conductor: string | null;
  bloqueDesde: string | null;
  creadoEn: string;
  ofertaVenceEn: string | null;
  paradas: number;
  paradasResueltas: number;
  paquetes: number;
  entregados: number;
  incidencias: number;
};
type Paquete = {
  id: string;
  codigoSeguimiento: string;
  estado: string;
  cargado: boolean;
  excluido: boolean;
  entregadoAlCentro: boolean;
};
type Parada = {
  id: string;
  orden: number;
  estado: string;
  envioId: string;
  direccion: string;
  referenciaExterna: string | null;
  destinatarioNombre: string | null;
  sinCoordenadas: boolean;
  paquetes: Paquete[];
};
type Detalle = {
  ruta: {
    id: string;
    nombre: string;
    estado: string;
    modalidad: string | null;
    ofertaVenceEn: string | null;
    ofertaVencida: boolean;
    bloqueDesde: string | null;
    bloqueHasta: string | null;
    iniciadaEn: string | null;
    cerradaEn: string | null;
    conductor: { id: string; nombre: string } | null;
    ubicacion: { lat: number; lng: number; en: string | null } | null;
    resumen: Record<string, number | string | null> | null;
    progreso: {
      total: number;
      cargados: number;
      entregados: number;
      fallidos: number;
      enDevolucion: number;
      devueltos: number;
      paradas: number;
      paradasResueltas: number;
      excluidos: number;
    };
    paradas: Parada[];
  };
  incidencias: {
    id: string;
    codigoSeguimiento: string;
    motivo: string;
    observaciones: string;
    proximaAccion: string;
    estado: string;
    reintentoAutorizado: boolean;
    pruebaId: string | null;
    creadoEn: string;
  }[];
  pruebas: { id: string; paradaId: string | null; tipo: string; creadoEn: string }[];
};
type Conductor = { usuarioId: string; nombre: string; vinculo: string; estado: string };

const ACTIVAS = ['ofrecida', 'asignada', 'aceptada', 'en_carga', 'en_curso'];

function Error_({ error }: { error: string }) {
  return error ? (
    <p className="error-general" role="alert">
      {error}
    </p>
  ) : null;
}

/** Barra de progreso: lo hecho va en verde (regla de la casa: el éxito nunca en rojo). */
function Barra({ valor, total, etiqueta }: { valor: number; total: number; etiqueta: string }) {
  const pct = total ? Math.round((valor / total) * 100) : 0;
  return (
    <div
      className="flex-barra"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
    >
      <div className="flex-barra-llena" style={{ width: `${pct}%` }} />
      <span>
        {valor}/{total} {etiqueta}
      </span>
    </div>
  );
}

export function RutasOperativas({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const [lista, setLista] = useState<FilaRuta[] | null>(null);
  const [centros, setCentros] = useState<{ id: string; nombre: string }[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [f, setF] = useState({ estado: '', centroId: '', conductorId: '', fecha: '' });
  const [error, setError] = useState('');
  useEffect(() => {
    void pedir<{ centros: { id: string; nombre: string }[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/centros`,
    )
      .then((r) => setCentros(r.centros))
      .catch(() => undefined);
    if (ctx.permisos.includes('conductores.gestionar'))
      void pedir<{ conductores: Conductor[] }>(
        'GET',
        `${BASE_FLEX}/empresas/${empresa.id}/conductores`,
      )
        .then((r) => setConductores(r.conductores))
        .catch(() => undefined);
  }, [empresa.id, ctx.permisos]);
  useEffect(() => {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    pedir<{ rutas: FilaRuta[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/rutas-operativas?${p.toString()}`,
    )
      .then((r) => setLista(r.rutas))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, f]);
  return (
    <section className="super">
      <h1>{t.rutasOperativas}</h1>
      <Error_ error={error} />
      <div className="flex-filtros" aria-label={t.filtros}>
        <select
          aria-label={t.estado}
          value={f.estado}
          onChange={(e) => setF({ ...f, estado: e.target.value })}
        >
          <option value="">{t.todos}</option>
          {Object.entries(t.estadosRuta).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label={t.centro}
          value={f.centroId}
          onChange={(e) => setF({ ...f, centroId: e.target.value })}
        >
          <option value="">{t.todosCentros}</option>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label={t.conductor}
          value={f.conductorId}
          onChange={(e) => setF({ ...f, conductorId: e.target.value })}
        >
          <option value="">{t.todosConductores}</option>
          {conductores.map((c) => (
            <option key={c.usuarioId} value={c.usuarioId}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label={t.fecha}
          value={f.fecha}
          onChange={(e) => setF({ ...f, fecha: e.target.value })}
        />
      </div>
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinRutas}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((r) => (
            <li key={r.id}>
              <Enlace a={`${raiz}/operativas/${r.id}`}>
                <strong>{r.nombre || r.id.slice(0, 8)}</strong>
              </Enlace>{' '}
              ·{' '}
              <span
                className={`insignia ${['completada'].includes(r.estado) ? 'insignia-aprobado' : r.estado === 'con_incidencias' ? 'insignia-pausado' : ''}`}
              >
                {t.estadosRuta[r.estado] ?? r.estado}
              </span>
              {r.conductor ? ` · ${r.conductor}` : ''}
              {r.centro ? ` · ${r.centro}` : ''} · {r.entregados} {t.entregadosDe} {r.paquetes} ·{' '}
              {r.paradasResueltas}/{r.paradas} {t.paradasResueltas}
              {r.incidencias ? ` · ${r.incidencias} ${t.incidencias.toLowerCase()}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DetalleRutaOperativa({ ctx, rutaId }: { ctx: Contexto; rutaId: string }) {
  const { t, empresa } = ctx;
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState('');
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [asig, setAsig] = useState({
    conductorId: '',
    bloqueDesde: '',
    bloqueHasta: '',
    minutos: '60',
  });
  const [menu, setMenu] = useState(false);
  const puede = ctx.permisos.includes('lotes.gestionar');
  const cargar = useCallback(() => {
    pedir<Detalle>('GET', `${BASE_FLEX}/empresas/${empresa.id}/rutas/${rutaId}/detalle`)
      .then(setD)
      .catch((x: unknown) =>
        setError(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : mensajeDe(x)),
      );
  }, [empresa.id, rutaId, t.noExiste]);
  useEffect(cargar, [cargar]);
  // Seguimiento: una consulta cada 20 s, solo mientras la ruta está activa.
  const activa = d ? ACTIVAS.includes(d.ruta.estado) : false;
  useEffect(() => {
    if (!activa) return;
    const reloj = setInterval(cargar, 20_000);
    return () => clearInterval(reloj);
  }, [activa, cargar]);
  useEffect(() => {
    if (ctx.permisos.includes('conductores.gestionar'))
      void pedir<{ conductores: Conductor[] }>(
        'GET',
        `${BASE_FLEX}/empresas/${empresa.id}/conductores`,
      )
        .then((r) => setConductores(r.conductores.filter((c) => c.estado === 'activo')))
        .catch(() => undefined);
  }, [empresa.id, ctx.permisos]);
  if (!d) return <p role={error ? 'alert' : 'status'}>{error || t.cargando}</p>;
  const r = d.ruta;
  const base = `${BASE_FLEX}/empresas/${empresa.id}/rutas/${r.id}`;
  async function hacer(sub: string, cuerpo: unknown, idem = false) {
    setError('');
    try {
      const res = idem
        ? await crear<Detalle>(`${base}/${sub}`, cuerpo)
        : await pedir<Detalle>('POST', `${base}/${sub}`, cuerpo);
      if (res?.ruta) cargar();
      else cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function mover(i: number, delta: number) {
    const ids = r.paradas.map((p) => p.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
    try {
      await pedir('PUT', `${base}/orden`, { paradaIds: ids });
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  const elegido = conductores.find((c) => c.usuarioId === asig.conductorId);
  const puedeAsignar = elegido && elegido.vinculo !== 'red';
  const puedeOfrecer = elegido && elegido.vinculo !== 'propio';
  const conFecha = (v: string) => (v ? v.replace('T', ' ') : null);
  const reordenable =
    puede && ['borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga'].includes(r.estado);
  return (
    <section className="super">
      <h1>
        {t.detalleRuta}: {r.nombre || r.id.slice(0, 8)}
      </h1>
      <p>
        <span className="insignia">{t.estadosRuta[r.estado] ?? r.estado}</span>
        {r.conductor ? ` · ${t.conductor}: ${r.conductor.nombre}` : ''}
        {r.estado === 'ofrecida' && r.ofertaVenceEn
          ? ` · ${t.ofertaVence}: ${r.ofertaVenceEn}`
          : ''}
      </p>
      {r.ofertaVencida ? <p className="pista">{t.ofertaVencida}</p> : null}
      <Error_ error={error} />
      <h2>{t.progreso}</h2>
      <Barra
        valor={r.progreso.entregados}
        total={r.progreso.total}
        etiqueta={t.resumen.entregados.toLowerCase()}
      />
      <Barra
        valor={r.progreso.paradasResueltas}
        total={r.progreso.paradas}
        etiqueta={t.paradasResueltas}
      />
      {r.estado === 'en_carga' ? (
        <Barra valor={r.progreso.cargados} total={r.progreso.total} etiqueta={t.cargadosTexto} />
      ) : null}
      {r.ubicacion ? (
        <p>
          {t.ubicacionConductor}: {r.ubicacion.en ?? ''} ·{' '}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${r.ubicacion.lat},${r.ubicacion.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.verMapa}
          </a>
        </p>
      ) : null}
      {puede && r.estado === 'borrador' ? (
        conductores.length === 0 ? (
          <p className="pista">{t.sinConductoresRuta}</p>
        ) : (
          <div className="flex-form flex-inline">
            <div className="campo">
              <label htmlFor="flex-conductor">{t.conductor}</label>
              <select
                id="flex-conductor"
                value={asig.conductorId}
                onChange={(e) => setAsig({ ...asig, conductorId: e.target.value })}
              >
                <option value="">—</option>
                {conductores.map((c) => (
                  <option key={c.usuarioId} value={c.usuarioId}>
                    {c.nombre} · {t.vinculos[c.vinculo] ?? c.vinculo}
                  </option>
                ))}
              </select>
            </div>
            <Campo
              etiqueta={t.bloqueDesde}
              tipo="datetime-local"
              valor={asig.bloqueDesde}
              cambiar={(v) => setAsig({ ...asig, bloqueDesde: v })}
            />
            <Campo
              etiqueta={t.bloqueHasta}
              tipo="datetime-local"
              valor={asig.bloqueHasta}
              cambiar={(v) => setAsig({ ...asig, bloqueHasta: v })}
            />
            {puedeOfrecer ? (
              <Campo
                etiqueta={t.minutosOferta}
                tipo="number"
                valor={asig.minutos}
                cambiar={(v) => setAsig({ ...asig, minutos: v })}
              />
            ) : null}
            <div className="fila-botones">
              {puedeAsignar ? (
                <button
                  type="button"
                  className="boton"
                  onClick={() =>
                    void hacer(
                      'asignar',
                      {
                        conductorId: asig.conductorId,
                        bloqueDesde: conFecha(asig.bloqueDesde),
                        bloqueHasta: conFecha(asig.bloqueHasta),
                      },
                      true,
                    )
                  }
                >
                  {t.asignar}
                </button>
              ) : null}
              {puedeOfrecer ? (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() =>
                    void hacer(
                      'ofrecer',
                      {
                        conductorId: asig.conductorId,
                        minutos: Number(asig.minutos) || 60,
                        bloqueDesde: conFecha(asig.bloqueDesde),
                        bloqueHasta: conFecha(asig.bloqueHasta),
                      },
                      true,
                    )
                  }
                >
                  {t.ofrecer}
                </button>
              ) : null}
            </div>
          </div>
        )
      ) : null}
      {puede && ['borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga'].includes(r.estado) ? (
        <div className="menu-tres-puntos">
          <button
            type="button"
            className="boton secundario"
            aria-label={t.masOpciones}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            ⋮
          </button>
          {menu ? (
            <div role="menu" className="cuenta-menu">
              {['ofrecida', 'asignada', 'aceptada'].includes(r.estado) ? (
                <button type="button" role="menuitem" onClick={() => void hacer('retirar', {})}>
                  {t.retirarRuta}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (window.confirm(t.confirmarCancelar)) void hacer('cancelar', {});
                }}
              >
                {t.cancelarRuta}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <h2>{t.listaParadas}</h2>
      {reordenable ? <p className="pista">{t.ordenAyuda}</p> : null}
      <ol className="flex-paradas">
        {r.paradas.map((p, i) => (
          <li key={p.id}>
            <strong>
              {p.orden}. {p.referenciaExterna ?? '—'}
            </strong>{' '}
            · {p.destinatarioNombre} · {p.direccion} ·{' '}
            <span
              className={`insignia ${p.estado === 'entregada' ? 'insignia-aprobado' : p.estado === 'fallida' ? 'insignia-rechazado' : ''}`}
            >
              {t.estadosParada[p.estado] ?? p.estado}
            </span>
            {p.sinCoordenadas ? (
              <span className="insignia insignia-rechazado">{t.sinCoordenadas}</span>
            ) : null}
            {reordenable ? (
              <>
                {' '}
                <button
                  type="button"
                  className="enlace"
                  aria-label={`${t.subir} ${p.orden}`}
                  onClick={() => void mover(i, -1)}
                >
                  ↑
                </button>{' '}
                <button
                  type="button"
                  className="enlace"
                  aria-label={`${t.bajar} ${p.orden}`}
                  onClick={() => void mover(i, 1)}
                >
                  ↓
                </button>
              </>
            ) : null}
            <ul>
              {p.paquetes
                .filter((q) => !q.excluido)
                .map((q) => (
                  <li key={q.id}>
                    <code>{q.codigoSeguimiento}</code> · {t.estadosPaquete[q.estado] ?? q.estado}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
      <h2>{t.incidencias}</h2>
      {d.incidencias.length === 0 ? (
        <p className="pista">{t.sinIncidencias}</p>
      ) : (
        <ul className="super-lista">
          {d.incidencias.map((i) => (
            <li key={i.id}>
              <code>{i.codigoSeguimiento}</code> · {t.motivos[i.motivo] ?? i.motivo} ·{' '}
              {t.acciones[i.proximaAccion] ?? i.proximaAccion} ·{' '}
              {t.estadosIncidencia[i.estado] ?? i.estado}
              {i.observaciones ? ` · ${i.observaciones}` : ''}
              {i.pruebaId ? (
                <>
                  {' '}
                  ·{' '}
                  <a
                    href={`${BASE_FLEX}/empresas/${empresa.id}/pruebas/${i.pruebaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.verPrueba}
                  </a>
                </>
              ) : null}{' '}
              {i.estado === 'abierta' &&
              puede &&
              !i.reintentoAutorizado &&
              r.estado === 'en_curso' ? (
                <button
                  type="button"
                  className="enlace"
                  onClick={() =>
                    void pedir(
                      'POST',
                      `${BASE_FLEX}/empresas/${empresa.id}/incidencias/${i.id}/autorizar-reintento`,
                      {},
                    )
                      .then(cargar)
                      .catch((x: unknown) => setError(mensajeDe(x)))
                  }
                >
                  {t.autorizarReintento}
                </button>
              ) : i.reintentoAutorizado ? (
                <span className="insignia insignia-aprobado">{t.reintentoAutorizado}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {d.pruebas.length ? (
        <>
          <h2>{t.pruebasEntrega}</h2>
          <div className="flex-pruebas">
            {d.pruebas.map((p) => (
              <a
                key={p.id}
                href={`${BASE_FLEX}/empresas/${empresa.id}/pruebas/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={`${BASE_FLEX}/empresas/${empresa.id}/pruebas/${p.id}`}
                  alt={`${t.tiposPrueba[p.tipo] ?? p.tipo} ${p.creadoEn}`}
                  width={120}
                  height={120}
                  loading="lazy"
                />
                <span>{t.tiposPrueba[p.tipo] ?? p.tipo}</span>
              </a>
            ))}
          </div>
        </>
      ) : null}
      {r.resumen ? (
        <>
          <h2>{t.resumenRuta}</h2>
          <ul className="super-tarjetas">
            {Object.entries(t.resumenCampos).map(([k, texto]) => (
              <li className="super-tarjeta" key={k}>
                <span>{texto}</span>
                <strong>{String(r.resumen?.[k] ?? 0)}</strong>
              </li>
            ))}
          </ul>
          <p>
            {String(r.resumen.inicio ?? '')} → {String(r.resumen.fin ?? '')}
          </p>
        </>
      ) : null}
    </section>
  );
}

type Devolucion = {
  paqueteId: string;
  codigoSeguimiento: string;
  codigoEtiqueta: string;
  ruta: string;
  conductor: string | null;
  referenciaExterna: string | null;
  motivo: string | null;
  proximaAccion: string | null;
  entregadoAlCentro: boolean;
};

export function Devoluciones({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [lista, setLista] = useState<Devolucion[] | null>(null);
  // Lo escrito se guarda solo (regla: ningún formulario pierde lo escrito).
  const b = useBorrador({
    formulario: `flex-devolucion-${empresa.id}`,
    inicial: { codigo: '', destino: 'centro' },
    almacen: almacenNavegador,
  });
  const codigo = b.valores.codigo;
  const destino = b.valores.destino as 'centro' | 'remitente';
  const setCodigo = (v: string) => b.cambiar('codigo', v);
  const setDestino = (v: 'centro' | 'remitente') => b.cambiar('destino', v);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const puede = ctx.permisos.includes('devoluciones.recibir');
  const cargar = useCallback(() => {
    pedir<{ devoluciones: Devolucion[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/devoluciones`)
      .then((r) => setLista(r.devoluciones))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  async function recibir(c: string, dest: 'centro' | 'remitente') {
    setError('');
    setOk('');
    try {
      await pedir('POST', `${BASE_FLEX}/empresas/${empresa.id}/devoluciones/recibir`, {
        codigo: c,
        destino: dest,
      });
      setOk(`${c} · ${t.recibido}`);
      await b.limpiar();
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <section className="super">
      <h1>{t.devoluciones}</h1>
      <p className="pista">{t.devolucionesAyuda}</p>
      <Error_ error={error} />
      {ok ? <p className="aviso-borrador">{ok}</p> : null}
      {puede ? (
        <form
          className="flex-form flex-inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (codigo.trim()) void recibir(codigo.trim(), destino);
          }}
        >
          <Campo
            etiqueta={t.codigoPaquete}
            valor={codigo}
            cambiar={setCodigo}
            placeholder="dvx:ABCDEFGHJKMN"
          />
          <div className="campo">
            <label htmlFor="flex-destino">{t.destino}</label>
            <select
              id="flex-destino"
              value={destino}
              onChange={(e) => setDestino(e.target.value as 'centro' | 'remitente')}
            >
              <option value="centro">{t.destinos.centro}</option>
              <option value="remitente">{t.destinos.remitente}</option>
            </select>
          </div>
          <button type="submit" className="boton">
            {t.recibir}
          </button>
        </form>
      ) : null}
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinDevoluciones}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((x) => (
            <li key={x.paqueteId}>
              <code>{x.codigoSeguimiento}</code> · {x.referenciaExterna ?? '—'} · {x.ruta}
              {x.conductor ? ` · ${x.conductor}` : ''} ·{' '}
              {x.motivo ? (t.motivos[x.motivo] ?? x.motivo) : '—'} ·{' '}
              <span className={`insignia ${x.entregadoAlCentro ? 'insignia-aprobado' : ''}`}>
                {x.entregadoAlCentro ? t.entregadoAlCentro : t.enCamino}
              </span>{' '}
              {puede ? (
                <button
                  type="button"
                  className="enlace"
                  onClick={() =>
                    void recibir(
                      x.codigoEtiqueta,
                      x.proximaAccion === 'devolver' ? 'remitente' : 'centro',
                    )
                  }
                >
                  {t.recibir}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Incidencias({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const [lista, setLista] = useState<
    (Detalle['incidencias'][number] & { rutaId: string; ruta: string; conductor: string })[] | null
  >(null);
  const [estado, setEstado] = useState('abierta');
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ incidencias: NonNullable<typeof lista> }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/incidencias${estado ? `?estado=${estado}` : ''}`,
    )
      .then((r) => setLista(r.incidencias))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, estado]);
  return (
    <section className="super">
      <h1>{t.incidencias}</h1>
      <Error_ error={error} />
      <div className="flex-filtros">
        <select aria-label={t.estado} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">{t.todos}</option>
          {Object.entries(t.estadosIncidencia).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinIncidencias}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((i) => (
            <li key={i.id}>
              <code>{i.codigoSeguimiento}</code> · {t.motivos[i.motivo] ?? i.motivo} ·{' '}
              {t.acciones[i.proximaAccion] ?? i.proximaAccion} ·{' '}
              {t.estadosIncidencia[i.estado] ?? i.estado} · {i.conductor} ·{' '}
              <Enlace a={`${raiz}/operativas/${i.rutaId}`}>{i.ruta || t.verRuta}</Enlace>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Pruebas que pide la empresa en cada entrega (en el perfil; solo quien puede editar la empresa). */
export function ConfigEntrega({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [cfg, setCfg] = useState<Record<string, boolean> | null>(null);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void pedir<{ config: Record<string, boolean> }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/config-entrega`,
    )
      .then((r) => setCfg(r.config))
      .catch(() => undefined);
  }, [empresa.id]);
  if (!cfg) return null;
  const puede = ctx.permisos.includes('empresa.editar');
  async function guardar() {
    setError('');
    try {
      await pedir('PUT', `${BASE_FLEX}/empresas/${empresa.id}/config-entrega`, cfg);
      setOk(true);
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <fieldset className="campo flex-config">
      <legend>{t.configEntrega}</legend>
      {Object.entries(t.configCampos).map(([k, texto]) => (
        <label key={k} className="flex-check">
          <input
            type="checkbox"
            disabled={!puede}
            checked={Boolean(cfg[k])}
            onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })}
          />{' '}
          {texto}
        </label>
      ))}
      <Error_ error={error} />
      {puede ? (
        <button type="button" className="boton secundario" onClick={() => void guardar()}>
          {t.guardar}
        </button>
      ) : null}
      {ok ? <span className="insignia insignia-aprobado">✓</span> : null}
    </fieldset>
  );
}

/** En el detalle del envío: PIN del destinatario (se ve una vez) y corregir la ubicación. */
export function HerramientasEnvio({
  ctx,
  envioId,
  sinCoordenadas,
  alCambiar,
}: {
  ctx: Contexto;
  envioId: string;
  sinCoordenadas: boolean;
  alCambiar: () => void;
}) {
  const { t, empresa } = ctx;
  const [pin, setPin] = useState<string | null>(null);
  const b = useBorrador({
    formulario: `flex-ubicacion-${envioId}`,
    inicial: { lat: '', lng: '' },
    almacen: almacenNavegador,
  });
  const { lat, lng } = b.valores;
  const setLat = (v: string) => b.cambiar('lat', v);
  const setLng = (v: string) => b.cambiar('lng', v);
  const [error, setError] = useState('');
  if (!ctx.permisos.includes('envios.crear')) return null;
  async function generar() {
    setError('');
    try {
      setPin(
        (
          await pedir<{ pin: string }>(
            'POST',
            `${BASE_FLEX}/empresas/${empresa.id}/envios/${envioId}/pin`,
            {},
          )
        ).pin,
      );
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function ubicar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PATCH', `${BASE_FLEX}/empresas/${empresa.id}/envios/${envioId}`, {
        lat: Number(lat),
        lng: Number(lng),
      });
      alCambiar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <div className="flex-herramientas">
      <Error_ error={error} />
      {sinCoordenadas ? (
        <form onSubmit={ubicar} className="flex-form flex-inline">
          <p className="pista">{t.sinCoordenadas}</p>
          <Campo etiqueta={t.latitud} valor={lat} cambiar={setLat} placeholder="25.7743" />
          <Campo etiqueta={t.longitud} valor={lng} cambiar={setLng} placeholder="-80.1937" />
          <button type="submit" className="boton secundario">
            {t.guardarUbicacion}
          </button>
        </form>
      ) : null}
      {pin ? (
        <p className="flex-clave-nueva" role="status">
          PIN: <strong>{pin}</strong> · {t.pinAviso}
        </p>
      ) : (
        <button type="button" className="boton secundario" onClick={() => void generar()}>
          {t.generarPin}
        </button>
      )}
    </div>
  );
}
