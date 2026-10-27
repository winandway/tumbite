/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  type EstadoPaquete,
  TRANSICIONES_PAQUETE,
  almacenNavegador,
  barrasCode128,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { ir } from '../../ruta';
import { Campo } from '../CampoClave';
import { crear, pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';
import { HerramientasEnvio } from './PantallasRutas';

/** Pantallas de envíos, paquetes, importación, etiquetas, lotes y rutas, y billetera (próximamente). */

type Paquete = {
  id: string;
  envioId: string;
  codigoSeguimiento: string;
  codigoEtiqueta: string;
  descripcion: string;
  estado: string;
  referenciaExterna?: string | null;
  destinatarioNombre?: string;
  direccion?: string;
};
type Envio = {
  id: string;
  referenciaExterna: string | null;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  direccion: string;
  instrucciones: string;
  estado: string;
  creadoEn: string;
  paquetes: number | Paquete[];
  entregados?: number;
  centroId: string | null;
  lat?: number | null;
  lng?: number | null;
};
type Evento = {
  id: number;
  tipo: string;
  actor: string | null;
  actorTipo: string;
  creadoEn: string;
  metadatos: { nota?: string } | null;
  paqueteId?: string;
};
type Centro = { id: string; nombre: string; estado: string };

function Error_({ error }: { error: string }) {
  return error ? (
    <p className="error-general" role="alert">
      {error}
    </p>
  ) : null;
}

function InsigniaPaquete({ estado, t }: { estado: string; t: Contexto['t'] }) {
  const ok = estado === 'entregado';
  const mal = ['entrega_fallida', 'cancelado', 'devuelto', 'en_devolucion'].includes(estado);
  return (
    <span className={`insignia ${ok ? 'insignia-aprobado' : mal ? 'insignia-rechazado' : ''}`}>
      {t.estadosPaquete[estado] ?? estado}
    </span>
  );
}

function useCentros(empresaId: string) {
  const [centros, setCentros] = useState<Centro[]>([]);
  useEffect(() => {
    pedir<{ centros: Centro[] }>('GET', `${BASE_FLEX}/empresas/${empresaId}/centros`)
      .then((r) => setCentros(r.centros.filter((c) => c.estado === 'activo')))
      .catch(() => setCentros([]));
  }, [empresaId]);
  return centros;
}

// ───────────────────────────── Envíos ─────────────────────────────

export function Envios({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const [lista, setLista] = useState<Envio[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (q) p.set('q', q);
    if (estado) p.set('estado', estado);
    pedir<{ envios: Envio[]; hayMas: boolean }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/envios?${p.toString()}`,
    )
      .then((r) => {
        setLista(r.envios);
        setHayMas(r.hayMas);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, pagina, q, estado]);
  return (
    <section className="super">
      <h1>{t.envios}</h1>
      <Error_ error={error} />
      <div className="fila-botones">
        {ctx.permisos.includes('envios.crear') && (
          <Enlace a={`${raiz}/shipments/new`} className="boton">
            {t.nuevoEnvio}
          </Enlace>
        )}
        {ctx.permisos.includes('importar') && (
          <Enlace a={`${raiz}/import`} className="boton secundario">
            {t.menu.import}
          </Enlace>
        )}
      </div>
      <div className="flex-filtros">
        <input
          type="search"
          aria-label={t.buscar}
          placeholder={t.buscar}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select aria-label={t.estado} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">{t.todos}</option>
          {Object.entries(t.estadosEnvio).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinEnvios}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((e) => (
            <li key={e.id}>
              <Enlace a={`${raiz}/shipments/${e.id}`}>
                <strong>{e.referenciaExterna ?? e.destinatarioNombre}</strong>
              </Enlace>{' '}
              · {e.destinatarioNombre} · {e.direccion} ·{' '}
              <span className="insignia">{t.estadosEnvio[e.estado] ?? e.estado}</span> ·{' '}
              {String(e.paquetes)} {t.paquetesN} · {e.creadoEn}
            </li>
          ))}
        </ul>
      )}
      <div className="fila-botones">
        {pagina > 1 && (
          <button type="button" className="boton secundario" onClick={() => setPagina(pagina - 1)}>
            {t.anteriorPagina}
          </button>
        )}
        {hayMas && (
          <button type="button" className="boton secundario" onClick={() => setPagina(pagina + 1)}>
            {t.masPagina}
          </button>
        )}
      </div>
    </section>
  );
}

const INICIAL_ENVIO = {
  referenciaExterna: '',
  destinatarioNombre: '',
  destinatarioTelefono: '',
  direccion: '',
  instrucciones: '',
  paquetes: '1',
  descripcion: '',
  centroId: '',
};

export function NuevoEnvio({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const centros = useCentros(empresa.id);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: `flex-envio-${empresa.id}`,
    inicial: INICIAL_ENVIO,
    almacen: almacenNavegador,
  });
  const v = b.valores;
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const n = Math.max(1, Math.min(50, Number(v.paquetes) || 1));
      const r = await crear<{ envio: { id: string } }>(
        `${BASE_FLEX}/empresas/${empresa.id}/envios`,
        {
          referenciaExterna: v.referenciaExterna || null,
          destinatarioNombre: v.destinatarioNombre,
          destinatarioTelefono: v.destinatarioTelefono,
          direccion: v.direccion,
          instrucciones: v.instrucciones,
          centroId: v.centroId || null,
          paquetes: Array.from({ length: n }, () => ({ descripcion: v.descripcion })),
        },
      );
      await b.limpiar();
      ir(`${raiz}/shipments/${r.envio.id}`);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <section className="super">
      <h1>{t.nuevoEnvio}</h1>
      <Error_ error={error} />
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form onSubmit={guardar} noValidate className="flex-form">
        <Campo
          etiqueta={t.referencia}
          valor={v.referenciaExterna}
          cambiar={(x) => b.cambiar('referenciaExterna', x)}
          placeholder="ORD-1001"
        />
        <Campo
          etiqueta={t.destinatario}
          valor={v.destinatarioNombre}
          cambiar={(x) => b.cambiar('destinatarioNombre', x)}
          placeholder={t.destinatario}
        />
        <Campo
          etiqueta={t.telefono}
          tipo="tel"
          valor={v.destinatarioTelefono}
          cambiar={(x) => b.cambiar('destinatarioTelefono', x)}
          placeholder={t.telefono}
        />
        <Campo
          etiqueta={t.direccion}
          valor={v.direccion}
          cambiar={(x) => b.cambiar('direccion', x)}
          placeholder={t.direccion}
        />
        <Campo
          etiqueta={t.instrucciones}
          valor={v.instrucciones}
          cambiar={(x) => b.cambiar('instrucciones', x)}
          placeholder={t.instrucciones}
        />
        <Campo
          etiqueta={t.cuantosPaquetes}
          tipo="number"
          valor={v.paquetes}
          cambiar={(x) => b.cambiar('paquetes', x)}
        />
        <Campo
          etiqueta={t.descripcionPaquete}
          valor={v.descripcion}
          cambiar={(x) => b.cambiar('descripcion', x)}
          placeholder={t.descripcionPaquete}
        />
        <div className="campo">
          <label htmlFor="flex-centro">{t.centro}</label>
          <select
            id="flex-centro"
            value={v.centroId}
            onChange={(e) => b.cambiar('centroId', e.target.value)}
          >
            <option value="">{t.sinCentro}</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? t.guardando : t.guardar}
          </button>
          <Enlace a={`${raiz}/shipments`} className="boton secundario">
            {t.cancelar}
          </Enlace>
        </div>
      </form>
    </section>
  );
}

function Trazabilidad({
  eventos,
  t,
  conPaquete,
}: {
  eventos: Evento[];
  t: Contexto['t'];
  conPaquete?: boolean;
}) {
  if (!eventos.length) return <p className="pista">{t.sinEventos}</p>;
  return (
    <ol className="flex-eventos">
      {eventos.map((e) => (
        <li key={e.id}>
          <InsigniaPaquete estado={e.tipo} t={t} /> {e.creadoEn}
          {e.actor ? ` · ${t.por} ${e.actor}` : ''}
          {e.metadatos?.nota ? ` · ${e.metadatos.nota}` : ''}
          {conPaquete && e.paqueteId ? ` · ${e.paqueteId.slice(0, 8)}` : ''}
        </li>
      ))}
    </ol>
  );
}

export function DetalleEnvio({ ctx, envioId }: { ctx: Contexto; envioId: string }) {
  const { t, empresa, raiz } = ctx;
  const [datos, setDatos] = useState<{
    envio: Envio & { paquetes: Paquete[] };
    eventos: Evento[];
  } | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ envio: Envio & { paquetes: Paquete[] }; eventos: Evento[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/envios/${envioId}`,
    )
      .then(setDatos)
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, envioId]);
  useEffect(cargar, [cargar]);
  if (!datos) return <p role={error ? 'alert' : 'status'}>{error || t.cargando}</p>;
  const e = datos.envio;
  return (
    <section className="super">
      <h1>{t.detalleEnvio}</h1>
      <p>
        <strong>{e.referenciaExterna ?? '—'}</strong> ·{' '}
        <span className="insignia">{t.estadosEnvio[e.estado] ?? e.estado}</span>
      </p>
      <p>
        {e.destinatarioNombre}
        {e.destinatarioTelefono ? ` · ${e.destinatarioTelefono}` : ''}
        <br />
        {e.direccion}
        {e.instrucciones ? <br /> : null}
        {e.instrucciones}
      </p>
      <HerramientasEnvio
        ctx={ctx}
        envioId={e.id}
        sinCoordenadas={e.lat == null || e.lng == null}
        alCambiar={cargar}
      />
      <h2>{t.paquetes}</h2>
      <ul className="super-lista">
        {e.paquetes.map((p, i) => (
          <li key={p.id}>
            <Enlace a={`${raiz}/packages/${p.id}`}>
              <strong>
                {t.pieza} {i + 1} {t.de} {e.paquetes.length}
              </strong>
            </Enlace>{' '}
            · <code>{p.codigoSeguimiento}</code> · <InsigniaPaquete estado={p.estado} t={t} />
            {p.descripcion ? ` · ${p.descripcion}` : ''}
          </li>
        ))}
      </ul>
      <h2>{t.trazabilidad}</h2>
      <Trazabilidad eventos={datos.eventos} t={t} conPaquete />
    </section>
  );
}

export function Paquetes({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const inicial =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('estado') ?? '')
      : '';
  const [lista, setLista] = useState<Paquete[] | null>(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState(inicial);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (q) p.set('q', q);
    if (estado) p.set('estado', estado);
    pedir<{ paquetes: Paquete[]; hayMas: boolean }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/paquetes?${p.toString()}`,
    )
      .then((r) => {
        setLista(r.paquetes);
        setHayMas(r.hayMas);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, q, estado, pagina]);
  return (
    <section className="super">
      <h1>{t.paquetes}</h1>
      <Error_ error={error} />
      <div className="flex-filtros">
        <input
          type="search"
          aria-label={t.buscar}
          placeholder={t.buscar}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select aria-label={t.estado} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">{t.todos}</option>
          {Object.entries(t.estadosPaquete).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinPaquetes}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((p) => (
            <li key={p.id}>
              <Enlace a={`${raiz}/packages/${p.id}`}>
                <code>{p.codigoSeguimiento}</code>
              </Enlace>{' '}
              · {p.referenciaExterna ?? '—'} · {p.destinatarioNombre} ·{' '}
              <InsigniaPaquete estado={p.estado} t={t} />
            </li>
          ))}
        </ul>
      )}
      <div className="fila-botones">
        {pagina > 1 && (
          <button type="button" className="boton secundario" onClick={() => setPagina(pagina - 1)}>
            {t.anteriorPagina}
          </button>
        )}
        {hayMas && (
          <button type="button" className="boton secundario" onClick={() => setPagina(pagina + 1)}>
            {t.masPagina}
          </button>
        )}
      </div>
    </section>
  );
}

export function DetallePaquete({ ctx, paqueteId }: { ctx: Contexto; paqueteId: string }) {
  const { t, empresa, raiz } = ctx;
  const [datos, setDatos] = useState<{ paquete: Paquete; envio: Envio; eventos: Evento[] } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [tipo, setTipo] = useState('');
  const [nota, setNota] = useState('');
  const cargar = useCallback(() => {
    pedir<{ paquete: Paquete; envio: Envio; eventos: Evento[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/paquetes/${paqueteId}`,
    )
      .then(setDatos)
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, paqueteId]);
  useEffect(cargar, [cargar]);
  if (!datos) return <p role={error ? 'alert' : 'status'}>{error || t.cargando}</p>;
  const p = datos.paquete;
  const siguientes = TRANSICIONES_PAQUETE[p.estado as EstadoPaquete] ?? [];
  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return;
    setError('');
    try {
      await crear(`${BASE_FLEX}/empresas/${empresa.id}/paquetes/${paqueteId}/eventos`, {
        tipo,
        nota: nota || undefined,
      });
      setTipo('');
      setNota('');
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <section className="super">
      <h1>
        <code>{p.codigoSeguimiento}</code>
      </h1>
      <p>
        <InsigniaPaquete estado={p.estado} t={t} /> · {t.etiqueta}: <code>{p.codigoEtiqueta}</code>{' '}
        ·{' '}
        <Enlace a={`${raiz}/shipments/${p.envioId}`} className="enlace">
          {t.detalleEnvio}
        </Enlace>{' '}
        ·{' '}
        <Enlace a={`${raiz}/labels?paquete=${p.id}`} className="enlace">
          {t.etiqueta}
        </Enlace>
      </p>
      <p>
        {datos.envio.destinatarioNombre} · {datos.envio.direccion}
      </p>
      <Error_ error={error} />
      {ctx.permisos.includes('paquetes.eventos') && siguientes.length > 0 && (
        <form onSubmit={registrar} noValidate className="flex-form flex-inline">
          <h2>{t.registrarEvento}</h2>
          <div className="campo">
            <label htmlFor="flex-evento">{t.evento}</label>
            <select id="flex-evento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">—</option>
              {siguientes.map((s) => (
                <option key={s} value={s}>
                  {t.estadosPaquete[s]}
                </option>
              ))}
            </select>
          </div>
          <Campo etiqueta={t.nota} valor={nota} cambiar={setNota} placeholder={t.nota} />
          <button type="submit" className="boton" disabled={!tipo}>
            {t.registrarEvento}
          </button>
        </form>
      )}
      <h2>{t.trazabilidad}</h2>
      <Trazabilidad eventos={datos.eventos} t={t} />
    </section>
  );
}

// ───────────────────────────── Importar ─────────────────────────────

type Importacion = {
  id: string;
  estado: string;
  total: number;
  validas: number;
  procesadas: number;
  nombreArchivo: string;
  creadoEn?: string;
};
type Vista = {
  importacion: Importacion;
  errores: { fila: number; error: string }[];
  vista: { fila: number; datos: Record<string, unknown>; error: string | null }[];
  creadasAhora?: number;
  quedan?: number;
};

export function Importar({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const centros = useCentros(empresa.id);
  const [centroId, setCentroId] = useState('');
  const [csv, setCsv] = useState('');
  const [nombre, setNombre] = useState('');
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [historial, setHistorial] = useState<Importacion[]>([]);
  const cargarHistorial = useCallback(() => {
    pedir<{ importaciones: Importacion[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/importaciones`,
    )
      .then((r) => setHistorial(r.importaciones))
      .catch(() => setHistorial([]));
  }, [empresa.id]);
  useEffect(cargarHistorial, [cargarHistorial]);
  async function archivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setNombre(f.name);
    setCsv(await f.text());
  }
  async function previsualizar() {
    setError('');
    setTrabajando(true);
    try {
      setVista(
        await pedir<Vista>(
          'POST',
          `${BASE_FLEX}/empresas/${empresa.id}/importaciones/previsualizar`,
          { csv, nombreArchivo: nombre, centroId: centroId || null },
        ),
      );
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setTrabajando(false);
    }
  }
  async function confirmar() {
    if (!vista) return;
    setError('');
    setTrabajando(true);
    try {
      setVista(
        await pedir<Vista>(
          'POST',
          `${BASE_FLEX}/empresas/${empresa.id}/importaciones/${vista.importacion.id}/confirmar`,
          {},
        ),
      );
      cargarHistorial();
      ctx.recargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setTrabajando(false);
    }
  }
  const imp = vista?.importacion;
  return (
    <section className="super">
      <h1>{t.importar}</h1>
      <p className="pista">{t.importarAyuda}</p>
      <Error_ error={error} />
      <div className="flex-form">
        <div className="campo">
          <label htmlFor="flex-csv">{t.archivo}</label>
          <input
            id="flex-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void archivo(e)}
          />
        </div>
        <div className="campo">
          <label htmlFor="flex-csv-texto">CSV</label>
          <textarea
            id="flex-csv-texto"
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={
              'reference,recipient,address,phone,packages\nORD-1,Ana,100 Main St,3051112222,2'
            }
          />
        </div>
        <div className="campo">
          <label htmlFor="flex-csv-centro">{t.centro}</label>
          <select
            id="flex-csv-centro"
            value={centroId}
            onChange={(e) => setCentroId(e.target.value)}
          >
            <option value="">{t.sinCentro}</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="boton"
          disabled={!csv || trabajando}
          onClick={() => void previsualizar()}
        >
          {t.previsualizar}
        </button>
      </div>
      {imp && (
        <div className="flex-importacion" role="status">
          <h2>
            {imp.nombreArchivo || 'CSV'} ·{' '}
            <span className="insignia">{t.estadosImportacion[imp.estado] ?? imp.estado}</span>
          </h2>
          <p>
            {t.filas}: <strong>{imp.total}</strong> · {t.validas}: <strong>{imp.validas}</strong> ·{' '}
            {t.conError}: <strong>{imp.total - imp.validas}</strong>
            {imp.estado !== 'previsualizada' && (
              <>
                {' '}
                · {t.creadas}: <strong>{imp.procesadas}</strong>
              </>
            )}
          </p>
          {vista.errores.length > 0 && (
            <ul className="super-lista flex-errores">
              {vista.errores.map((e) => (
                <li key={e.fila}>
                  {t.fila} {e.fila}: {e.error}
                </li>
              ))}
            </ul>
          )}
          {vista.vista.length > 0 && (
            <ul className="super-lista">
              {vista.vista
                .filter((f) => !f.error)
                .map((f) => (
                  <li key={f.fila}>
                    {t.fila} {f.fila}: {String(f.datos.referenciaExterna ?? '—')} ·{' '}
                    {String(f.datos.destinatarioNombre ?? '')} · {String(f.datos.direccion ?? '')} ·{' '}
                    {Array.isArray(f.datos.paquetes) ? f.datos.paquetes.length : 1} {t.paquetesN}
                  </li>
                ))}
            </ul>
          )}
          {imp.estado === 'previsualizada' && imp.validas > 0 && (
            <button
              type="button"
              className="boton"
              disabled={trabajando}
              onClick={() => void confirmar()}
            >
              {trabajando ? t.importando : t.confirmarImportacion}
            </button>
          )}
          {imp.estado === 'confirmada' && (
            <p>
              {vista.quedan ?? 0} {t.quedan}{' '}
              <button
                type="button"
                className="boton"
                disabled={trabajando}
                onClick={() => void confirmar()}
              >
                {t.importando}
              </button>
            </p>
          )}
          {imp.estado === 'terminada' && (
            <p className="insignia insignia-aprobado">
              {t.importacionTerminada}: {imp.procesadas} {t.creadas}
            </p>
          )}
        </div>
      )}
      {historial.length > 0 && (
        <>
          <h2>{t.historialImportaciones}</h2>
          <ul className="super-lista">
            {historial.map((h) => (
              <li key={h.id}>
                {h.nombreArchivo || 'CSV'} · {t.estadosImportacion[h.estado] ?? h.estado} ·{' '}
                {h.procesadas}/{h.validas} · {h.creadoEn}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ───────────────────────────── Etiquetas ─────────────────────────────

type DatosEtiqueta = {
  paqueteId: string;
  codigoEtiqueta: string;
  codigoSeguimiento: string;
  qr: string;
  referenciaExterna: string | null;
  destinatarioNombre: string;
  direccion: string;
  instrucciones: string;
  centro: string | null;
  empresa: string;
  pieza: number;
  total: number;
  descripcion: string;
};

/** Código de barras Code 128 B como SVG (sin dependencias). */
export function CodigoBarras({ texto, alto = 48 }: { texto: string; alto?: number }) {
  const barras = barrasCode128(texto);
  const ancho = barras.length
    ? (barras[barras.length - 1]?.x ?? 0) + (barras[barras.length - 1]?.ancho ?? 0)
    : 0;
  return (
    <svg
      viewBox={`0 0 ${ancho + 20} ${alto}`}
      width="100%"
      height={alto}
      role="img"
      aria-label={texto}
      className="flex-barras"
    >
      <rect x="0" y="0" width={ancho + 20} height={alto} fill="#fff" />
      {barras.map((b) => (
        <rect key={b.x} x={b.x + 10} y="0" width={b.ancho} height={alto} fill="#000" />
      ))}
    </svg>
  );
}

export function Etiqueta({ d, t }: { d: DatosEtiqueta; t: Contexto['t'] }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(d.qr, { margin: 1, width: 180 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [d.qr]);
  return (
    <article className="flex-etiqueta">
      <header>
        <strong>{d.empresa}</strong>
        <span>
          {t.pieza} {d.pieza} {t.de} {d.total}
        </span>
      </header>
      <div className="flex-etiqueta-cuerpo">
        {qr ? (
          <img src={qr} alt={d.qr} width={120} height={120} />
        ) : (
          <div style={{ width: 120, height: 120 }} />
        )}
        <div>
          <p className="flex-etiqueta-nombre">{d.destinatarioNombre}</p>
          <p>{d.direccion}</p>
          {d.instrucciones && <p className="flex-etiqueta-nota">{d.instrucciones}</p>}
          {d.referenciaExterna && (
            <p>
              Ref: <strong>{d.referenciaExterna}</strong>
            </p>
          )}
          {d.centro && <p>{d.centro}</p>}
          {d.descripcion && <p>{d.descripcion}</p>}
        </div>
      </div>
      <CodigoBarras texto={d.codigoEtiqueta} />
      <footer>
        <code>{d.codigoEtiqueta}</code> · {t.seguimiento}: <code>{d.codigoSeguimiento}</code>
      </footer>
    </article>
  );
}

export function Etiquetas({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const unoInicial =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('paquete')
      : null;
  const [lista, setLista] = useState<Paquete[]>([]);
  const [elegidos, setElegidos] = useState<string[]>(unoInicial ? [unoInicial] : []);
  const [etiquetas, setEtiquetas] = useState<DatosEtiqueta[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ paquetes: Paquete[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/paquetes`)
      .then((r) => setLista(r.paquetes))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(() => {
    let vivo = true;
    Promise.all(
      elegidos.map((id) =>
        pedir<{ etiqueta: DatosEtiqueta }>(
          'GET',
          `${BASE_FLEX}/empresas/${empresa.id}/paquetes/${id}/etiqueta`,
        ).then((r) => r.etiqueta),
      ),
    )
      .then((e) => {
        if (vivo) setEtiquetas(e);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
    return () => {
      vivo = false;
    };
  }, [elegidos, empresa.id]);
  const alternar = (id: string) =>
    setElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  return (
    <section className="super flex-etiquetas">
      <h1>{t.etiquetas}</h1>
      <p className="pista">{t.etiquetasAyuda}</p>
      <Error_ error={error} />
      <div className="flex-no-imprimir">
        <ul className="super-lista">
          {lista.map((p) => (
            <li key={p.id}>
              <label className="flex-check">
                <input
                  type="checkbox"
                  checked={elegidos.includes(p.id)}
                  onChange={() => alternar(p.id)}
                />{' '}
                <code>{p.codigoSeguimiento}</code> · {p.referenciaExterna ?? '—'} ·{' '}
                {p.destinatarioNombre}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="boton"
          disabled={!etiquetas.length}
          onClick={() => window.print()}
        >
          {t.imprimir}
        </button>
      </div>
      <div className="flex-hoja-etiquetas">
        {etiquetas.map((e) => (
          <Etiqueta key={e.paqueteId} d={e} t={t} />
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────── Lotes y rutas ─────────────────────────────

type Lote = { id: string; nombre: string; estado: string; paquetes: number };
type Ruta = {
  id: string;
  nombre: string;
  estado: string;
  paradas:
    | number
    | {
        orden: number;
        referenciaExterna: string | null;
        destinatarioNombre: string;
        direccion: string;
      }[];
};

export function LotesRutas({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [paqElegidos, setPaqElegidos] = useState<string[]>([]);
  const [envElegidos, setEnvElegidos] = useState<string[]>([]);
  const [loteId, setLoteId] = useState('');
  const [nombreLote, setNombreLote] = useState('');
  const [nombreRuta, setNombreRuta] = useState('');
  const [error, setError] = useState('');
  const puede = ctx.permisos.includes('lotes.gestionar');
  const cargar = useCallback(() => {
    void Promise.all([
      pedir<{ lotes: Lote[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/lotes`).then((r) =>
        setLotes(r.lotes),
      ),
      pedir<{ rutas: Ruta[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/rutas`).then((r) =>
        setRutas(r.rutas),
      ),
      pedir<{ paquetes: Paquete[] }>(
        'GET',
        `${BASE_FLEX}/empresas/${empresa.id}/paquetes?estado=creado`,
      ).then((r) => setPaquetes(r.paquetes)),
      pedir<{ envios: Envio[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/envios`).then((r) =>
        setEnvios(r.envios),
      ),
    ]).catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  async function crearLote() {
    setError('');
    try {
      const r = await crear<{ lote: Lote }>(`${BASE_FLEX}/empresas/${empresa.id}/lotes`, {
        nombre: nombreLote,
      });
      setLoteId(r.lote.id);
      setNombreLote('');
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function agregar() {
    if (!loteId || !paqElegidos.length) return;
    setError('');
    try {
      await pedir('POST', `${BASE_FLEX}/empresas/${empresa.id}/lotes/${loteId}/paquetes`, {
        paqueteIds: paqElegidos,
      });
      setPaqElegidos([]);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function crearRuta() {
    if (!envElegidos.length) return;
    setError('');
    try {
      await crear(`${BASE_FLEX}/empresas/${empresa.id}/rutas`, {
        nombre: nombreRuta,
        envioIds: envElegidos,
        loteId: loteId || null,
      });
      setEnvElegidos([]);
      setNombreRuta('');
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  const alternar = (lista: string[], poner: (l: string[]) => void, id: string) =>
    poner(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  return (
    <section className="super">
      <h1>{t.lotesRutas}</h1>
      <p className="pista">{t.lotesAyuda}</p>
      <Error_ error={error} />
      <div className="super-dos">
        <div>
          <h2>{t.lotes}</h2>
          {lotes.length === 0 ? (
            <p className="pista">{t.sinLotes}</p>
          ) : (
            <ul className="super-lista">
              {lotes.map((l) => (
                <li key={l.id}>
                  <label className="flex-check">
                    <input
                      type="radio"
                      name="lote"
                      checked={loteId === l.id}
                      onChange={() => setLoteId(l.id)}
                    />{' '}
                    <strong>{l.nombre}</strong> · {t.estadosLote[l.estado] ?? l.estado} ·{' '}
                    {l.paquetes} {t.paquetesN}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {puede && (
            <div className="flex-form flex-inline">
              <Campo
                etiqueta={t.nuevoLote}
                valor={nombreLote}
                cambiar={setNombreLote}
                placeholder={t.nuevoLote}
              />
              <button
                type="button"
                className="boton secundario"
                disabled={!nombreLote}
                onClick={() => void crearLote()}
              >
                {t.nuevoLote}
              </button>
            </div>
          )}
          {puede && paquetes.length > 0 && (
            <>
              <h3>{t.paquetes}</h3>
              <ul className="super-lista">
                {paquetes.map((p) => (
                  <li key={p.id}>
                    <label className="flex-check">
                      <input
                        type="checkbox"
                        checked={paqElegidos.includes(p.id)}
                        onChange={() => alternar(paqElegidos, setPaqElegidos, p.id)}
                      />{' '}
                      <code>{p.codigoSeguimiento}</code> · {p.referenciaExterna ?? '—'}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="boton"
                disabled={!loteId || !paqElegidos.length}
                onClick={() => void agregar()}
              >
                {t.agregarAlLote}
              </button>
            </>
          )}
        </div>
        <div>
          <h2>{t.rutas}</h2>
          {rutas.length === 0 ? (
            <p className="pista">{t.sinRutas}</p>
          ) : (
            <ul className="super-lista">
              {rutas.map((r) => (
                <li key={r.id}>
                  <strong>{r.nombre || r.id.slice(0, 8)}</strong> ·{' '}
                  <span className="insignia">{t.estadosRuta[r.estado] ?? r.estado}</span> ·{' '}
                  {typeof r.paradas === 'number' ? r.paradas : r.paradas.length} {t.paradas}
                </li>
              ))}
            </ul>
          )}
          {puede && envios.length > 0 && (
            <>
              <h3>{t.envios}</h3>
              <ul className="super-lista">
                {envios.map((e) => (
                  <li key={e.id}>
                    <label className="flex-check">
                      <input
                        type="checkbox"
                        checked={envElegidos.includes(e.id)}
                        onChange={() => alternar(envElegidos, setEnvElegidos, e.id)}
                      />{' '}
                      {envElegidos.includes(e.id) ? `${envElegidos.indexOf(e.id) + 1}. ` : ''}
                      {e.referenciaExterna ?? e.destinatarioNombre} · {e.direccion}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex-form flex-inline">
                <Campo
                  etiqueta={t.nombre}
                  valor={nombreRuta}
                  cambiar={setNombreRuta}
                  placeholder="Ruta 1"
                />
                <button
                  type="button"
                  className="boton"
                  disabled={!envElegidos.length}
                  onClick={() => void crearRuta()}
                >
                  {t.nuevaRuta}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function Billetera({ ctx }: { ctx: Contexto }) {
  const { t } = ctx;
  return (
    <section className="super">
      <h1>{t.billetera}</h1>
      <p className="pista">{t.billeteraPronto}</p>
    </section>
  );
}
