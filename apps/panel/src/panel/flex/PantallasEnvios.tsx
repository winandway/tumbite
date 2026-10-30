/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  type EstadoPaquete,
  TRANSICIONES_PAQUETE,
  almacenNavegador,
  barrasCode128,
  correoEjemplo,
  enIdioma,
  formatearMonto,
  perfilFlex,
  useBorrador,
  fechaHoraLocal,
} from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { ir } from '../../ruta';
import { CampoDireccion } from '../../sitio/CampoDireccion';
import { RetiroEnPunto } from './RetiroEnPunto';
import { Campo } from '../CampoClave';
import { MenuTresPuntos } from '../MenuTresPuntos';
import { crear, pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';
import { HerramientasEnvio } from './PantallasRutas';
import { type UbicacionDeEnvio, UbicacionEnvio } from './UbicacionEnvio';

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
  centroId?: string | null;
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
  // Fase 5 (C-FLEX-UBICACION).
  destinatarioCorreo?: string;
  destinatarioDocumento?: string;
  // Fase 6 (C-FLEX-COBRO).
  cobro?: CobroEnvio | null;
  // C-FLEX-RETIRO.
  entrega?: 'domicilio' | 'punto';
  retiroVence?: string | null;
} & UbicacionDeEnvio;
type CobroEnvio = {
  monto: number;
  moneda: string;
  estado: string;
  metodo: string | null;
  montoRecibido: number | null;
  monedaRecibida: string | null;
  referencia: string | null;
  cobradoEn: string | null;
  liquidadoEn: string | null;
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
              {String(e.paquetes)} {t.paquetesN} · {fechaHoraLocal(e.creadoEn, ctx.idioma)}
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
  // Fase 5 (C-FLEX-UBICACION).
  destinatarioCorreo: '',
  destinatarioDocumento: '',
  referencias: '',
  // C-FLEX-RETIRO: a domicilio o retiro en el centro elegido abajo.
  entrega: 'domicilio',
  // C-DIRECCION-SUGERENCIAS: el punto de la dirección sugerida que se eligió.
  lat: '',
  lng: '',
  // Fase 6 (C-FLEX-COBRO): cobro contra entrega, escrito como en la factura («25.00»).
  cobroMonto: '',
  cobroMoneda: 'USD',
};

/** Campos nuevos del destinatario (Fase 5), en los dos idiomas. */
const CAMPOS_DESTINATARIO = {
  es: {
    correo: 'Correo del destinatario (opcional)',
    documento: 'Cédula o RIF del destinatario',
    referencias: 'Punto de referencia',
    referenciasEj: 'Casa azul frente a la panadería',
    ayudaApp:
      'Con su teléfono o su correo lo encontramos en Divoox: si tiene la app, el paquete le llega ya ubicado.',
    entrega: 'Cómo se entrega',
    domicilio: 'A domicilio (sale en una ruta)',
    punto: 'Retiro en el centro elegido abajo (5 días hábiles)',
    direccionPunto: 'Retiro en el centro',
    cobro: 'Cobrar al entregar (opcional)',
    cobroAyuda:
      'El conductor lo cobra y lo registra antes de entregar. Déjalo vacío si ya está pagado.',
    moneda: 'Moneda del cobro',
    cobroTitulo: 'Cobro contra entrega',
    cobroEstados: {
      pendiente: 'Por cobrar',
      cobrado: 'Cobrado por el conductor',
      liquidado: 'Recibido en el centro',
    } as Record<string, string>,
    metodos: {
      efectivo_usd: 'efectivo en dólares',
      efectivo_ves: 'efectivo en bolívares',
      pago_movil: 'pago móvil',
      transferencia: 'transferencia',
      zelle: 'Zelle',
      punto_venta: 'punto de venta',
    } as Record<string, string>,
    referenciaPago: 'Referencia',
    cobrar: 'COBRAR',
  },
  en: {
    correo: 'Recipient email (optional)',
    documento: 'Recipient ID',
    referencias: 'Landmark',
    referenciasEj: 'Blue house across from the bakery',
    ayudaApp:
      'With their phone or email we find them on Divoox: if they have the app, the package arrives already located.',
    entrega: 'How it’s delivered',
    domicilio: 'To a home (goes on a route)',
    punto: 'Pickup at the hub chosen below (5 business days)',
    direccionPunto: 'Pickup at the hub',
    cobro: 'Collect on delivery (optional)',
    cobroAyuda:
      'The driver collects and records it before delivering. Leave it empty if it’s already paid.',
    moneda: 'Collection currency',
    cobroTitulo: 'Cash on delivery',
    cobroEstados: {
      pendiente: 'To collect',
      cobrado: 'Collected by the driver',
      liquidado: 'Received at the center',
    } as Record<string, string>,
    metodos: {
      efectivo_usd: 'cash in dollars',
      efectivo_ves: 'cash in bolívares',
      pago_movil: 'pago móvil',
      transferencia: 'bank transfer',
      zelle: 'Zelle',
      punto_venta: 'card terminal',
    } as Record<string, string>,
    referenciaPago: 'Reference',
    cobrar: 'COLLECT',
  },
};

/** «25.00» o «25,00» → 2500 (0 si está vacío o no es un monto). */
function montoCentavos(texto: string): number {
  const n = Math.round(Number(texto.replace(',', '.')) * 100);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Fase 6: el cobro contra entrega en el detalle del envío. */
function CobroDelEnvio({ cobro, idioma }: { cobro: CobroEnvio; idioma: Contexto['idioma'] }) {
  const cd = enIdioma(CAMPOS_DESTINATARIO, idioma);
  return (
    <div className="flex-cobro" data-testid="cobro-envio">
      <h2>{cd.cobroTitulo}</h2>
      <p>
        <strong>{formatearMonto(cobro.monto, cobro.moneda, idioma)}</strong> ·{' '}
        <span className={cobro.estado === 'pendiente' ? 'insignia' : 'insignia insignia-aprobado'}>
          {cd.cobroEstados[cobro.estado] ?? cobro.estado}
        </span>
      </p>
      {cobro.metodo && cobro.montoRecibido != null ? (
        <p>
          {formatearMonto(cobro.montoRecibido, cobro.monedaRecibida ?? cobro.moneda, idioma)} ·{' '}
          {cd.metodos[cobro.metodo] ?? cobro.metodo}
          {cobro.referencia ? ` · ${cd.referenciaPago} ${cobro.referencia}` : ''}
        </p>
      ) : null}
    </div>
  );
}

export function NuevoEnvio({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const cd = enIdioma(CAMPOS_DESTINATARIO, ctx.idioma);
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
          direccion: v.direccion || (v.entrega === 'punto' ? cd.direccionPunto : ''),
          entrega: v.entrega,
          ...(v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : {}),
          instrucciones: v.instrucciones,
          destinatarioCorreo: v.destinatarioCorreo,
          destinatarioDocumento: v.destinatarioDocumento,
          referencias: v.referencias,
          cobro: montoCentavos(v.cobroMonto)
            ? { monto: montoCentavos(v.cobroMonto), moneda: v.cobroMoneda }
            : null,
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
        <div className="campo">
          <label htmlFor="flex-entrega">{cd.entrega}</label>
          <select
            id="flex-entrega"
            value={v.entrega}
            onChange={(e) => b.cambiar('entrega', e.target.value)}
          >
            <option value="domicilio">{cd.domicilio}</option>
            <option value="punto">{cd.punto}</option>
          </select>
        </div>
        <div className="campo">
          {/* C-DIRECCION-SUGERENCIAS: direcciones reales del país de la empresa, con su punto. */}
          <CampoDireccion
            etiqueta={t.direccion}
            valor={v.direccion}
            cambiar={(x) => {
              b.cambiar('direccion', x);
              // Si se vuelve a escribir a mano, el punto elegido antes ya no corresponde.
              if (v.lat) {
                b.cambiar('lat', '');
                b.cambiar('lng', '');
              }
            }}
            alElegir={(d) => {
              b.cambiar('lat', String(d.punto.lat));
              b.cambiar('lng', String(d.punto.lng));
            }}
            pais={empresa.pais}
            placeholder={t.direccion}
          />
        </div>
        <Campo
          etiqueta={cd.referencias}
          valor={v.referencias}
          cambiar={(x) => b.cambiar('referencias', x)}
          placeholder={cd.referenciasEj}
        />
        <Campo
          etiqueta={cd.correo}
          tipo="email"
          valor={v.destinatarioCorreo}
          cambiar={(x) => b.cambiar('destinatarioCorreo', x)}
          placeholder={correoEjemplo(ctx.idioma)}
        />
        {perfilFlex(empresa.pais).documento.pide ? (
          <Campo
            etiqueta={cd.documento}
            valor={v.destinatarioDocumento}
            cambiar={(x) => b.cambiar('destinatarioDocumento', x)}
            placeholder={perfilFlex(empresa.pais).documento.ejemplo}
          />
        ) : null}
        <p className="pista">{cd.ayudaApp}</p>
        {perfilFlex(empresa.pais).cobroContraEntrega ? (
          <>
            <Campo
              etiqueta={cd.cobro}
              tipo="number"
              valor={v.cobroMonto}
              cambiar={(x) => b.cambiar('cobroMonto', x)}
              placeholder="0.00"
            />
            <div className="campo">
              <label htmlFor="flex-moneda-cobro">{cd.moneda}</label>
              <select
                id="flex-moneda-cobro"
                value={v.cobroMoneda}
                onChange={(e) => b.cambiar('cobroMoneda', e.target.value)}
              >
                {perfilFlex(empresa.pais).monedas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <p className="pista">{cd.cobroAyuda}</p>
          </>
        ) : null}
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
  idioma,
  conPaquete,
}: {
  eventos: Evento[];
  t: Contexto['t'];
  idioma: Contexto['idioma'];
  conPaquete?: boolean;
}) {
  if (!eventos.length) return <p className="pista">{t.sinEventos}</p>;
  return (
    <ol className="flex-eventos">
      {eventos.map((e) => (
        <li key={e.id}>
          <InsigniaPaquete estado={e.tipo} t={t} /> {fechaHoraLocal(e.creadoEn, idioma)}
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
      {e.cobro ? <CobroDelEnvio cobro={e.cobro} idioma={ctx.idioma} /> : null}
      {e.entrega === 'punto' ? (
        <RetiroEnPunto
          envio={e}
          empresaId={empresa.id}
          pais={empresa.pais}
          idioma={ctx.idioma}
          alCambiar={cargar}
        />
      ) : (
        <UbicacionEnvio
          envio={e}
          empresaId={empresa.id}
          pais={empresa.pais}
          idioma={ctx.idioma}
          alCambiar={cargar}
        />
      )}
      {/* Un envío que ya terminó no ofrece herramientas para entregarlo (PIN). */}
      {['entregado', 'devuelto', 'cancelado'].includes(e.estado) ? null : (
        <HerramientasEnvio
          ctx={ctx}
          envioId={e.id}
          // El punto ahora se marca con el pin de «Ubicación de entrega» (Fase 5).
          sinCoordenadas={false}
          alCambiar={cargar}
        />
      )}
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
      <Trazabilidad eventos={datos.eventos} t={t} idioma={ctx.idioma} conPaquete />
    </section>
  );
}

/** Estados que ya van en camino (verde suave, sin llegar al «entregado»). */
const EN_CAMINO = ['asignado', 'cargado', 'en_transito'];

/** Píldora de estado de la lista: verde para lo que salió bien, rojo solo para los problemas. */
function PildoraPaquete({ estado, t }: { estado: string; t: Contexto['t'] }) {
  const ok = estado === 'entregado';
  const camino = EN_CAMINO.includes(estado);
  const mal = ['entrega_fallida', 'cancelado', 'devuelto', 'en_devolucion'].includes(estado);
  const clase = ok
    ? 'insignia-aprobado'
    : camino
      ? 'flex-pildora-camino'
      : mal
        ? 'insignia-rechazado'
        : '';
  return (
    <span className={`insignia flex-pildora ${clase}`}>{t.estadosPaquete[estado] ?? estado}</span>
  );
}

/** Dirección en dos líneas: la calle y, debajo, la ciudad (parte en la primera coma). */
export function lineasDireccion(direccion: string | undefined): [string, string] {
  const d = (direccion ?? '').trim();
  const i = d.indexOf(',');
  return i < 0 ? [d, ''] : [d.slice(0, i).trim(), d.slice(i + 1).trim()];
}

type LoteAbierto = { id: string; nombre: string; estado: string };

export function Paquetes({ ctx }: { ctx: Contexto }) {
  const { t, empresa, raiz } = ctx;
  const inicial =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('estado') ?? '')
      : '';
  const centros = useCentros(empresa.id);
  const [lista, setLista] = useState<Paquete[] | null>(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState(inicial);
  const [centro, setCentro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState('');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [lotes, setLotes] = useState<LoteAbierto[] | null>(null);
  const [loteId, setLoteId] = useState('');
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const puedeLotes = ctx.permisos.includes('lotes.gestionar');
  useEffect(() => {
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (q) p.set('q', q);
    if (estado) p.set('estado', estado);
    if (centro) p.set('centro', centro);
    pedir<{ paquetes: Paquete[]; hayMas: boolean }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/paquetes?${p.toString()}`,
    )
      .then((r) => {
        setLista(r.paquetes);
        setHayMas(r.hayMas);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id, q, estado, centro, pagina]);
  const visibles = lista ?? [];
  const todosElegidos = visibles.length > 0 && visibles.every((p) => elegidos.includes(p.id));
  const alternar = (id: string) =>
    setElegidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const alternarTodos = () =>
    setElegidos((l) =>
      todosElegidos
        ? l.filter((id) => !visibles.some((p) => p.id === id))
        : [...new Set([...l, ...visibles.map((p) => p.id)])],
    );
  const aEtiquetas = (ids: string[], pdf = false) =>
    ir(`${raiz}/labels?paquetes=${ids.map(encodeURIComponent).join(',')}${pdf ? '&pdf=1' : ''}`);
  function abrirLotes() {
    setAviso('');
    setLotes([]);
    pedir<{ lotes: LoteAbierto[] }>('GET', `${BASE_FLEX}/empresas/${empresa.id}/lotes`)
      .then((r) => {
        const abiertos = r.lotes.filter((l) => l.estado === 'abierto');
        setLotes(abiertos);
        setLoteId(abiertos[0]?.id ?? '');
      })
      .catch((x: unknown) => {
        setLotes(null);
        setError(mensajeDe(x));
      });
  }
  async function asignarLote() {
    if (!loteId || !elegidos.length) return;
    setError('');
    setTrabajando(true);
    try {
      const r = await pedir<{ agregados: number; rechazados: string[] }>(
        'POST',
        `${BASE_FLEX}/empresas/${empresa.id}/lotes/${loteId}/paquetes`,
        { paqueteIds: elegidos },
      );
      setAviso(
        `${r.agregados} ${t.agregadosAlLote}${r.rechazados.length ? ` ${r.rechazados.length} ${t.noAgregados}` : ''}`,
      );
      setLotes(null);
      setElegidos([]);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setTrabajando(false);
    }
  }
  const cambiarFiltro = (poner: () => void) => {
    poner();
    setPagina(1);
  };
  return (
    <section className="super flex-paquetes">
      <header className="flex-encabezado">
        <div>
          <h1>{t.paquetes}</h1>
          <p className="pista">{t.paquetesSubtitulo}</p>
        </div>
        <div className="flex-encabezado-botones">
          {ctx.permisos.includes('importar') && (
            <Enlace a={`${raiz}/import`} className="boton secundario">
              {t.importarCsv}
            </Enlace>
          )}
          {ctx.permisos.includes('envios.crear') && (
            <Enlace a={`${raiz}/shipments/new`} className="boton">
              + {t.crearPaquete}
            </Enlace>
          )}
        </div>
      </header>
      <Error_ error={error} />
      <div className="flex-filtros">
        <input
          type="search"
          className="flex-buscador"
          aria-label={t.buscarPaquetes}
          placeholder={t.buscarPaquetes}
          value={q}
          onChange={(e) => cambiarFiltro(() => setQ(e.target.value))}
        />
        <select
          aria-label={t.estado}
          value={estado}
          onChange={(e) => cambiarFiltro(() => setEstado(e.target.value))}
        >
          <option value="">{t.todosEstados}</option>
          {Object.entries(t.estadosPaquete).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label={t.centro}
          value={centro}
          onChange={(e) => cambiarFiltro(() => setCentro(e.target.value))}
        >
          <option value="">{t.todosCentros}</option>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinPaquetes}</p>
      ) : (
        <div className="flex-tabla-caja">
          <table className="flex-tabla">
            <thead>
              <tr>
                <th className="flex-col-check">
                  <input
                    type="checkbox"
                    aria-label={t.seleccionarTodos}
                    checked={todosElegidos}
                    onChange={alternarTodos}
                  />
                </th>
                <th className="flex-col-num">#</th>
                <th>{t.colCodigo}</th>
                <th>{t.colDestinatario}</th>
                <th>{t.direccion}</th>
                <th>{t.estado}</th>
                <th className="flex-col-acciones">{t.colAcciones}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => {
                const [calle, ciudad] = lineasDireccion(p.direccion);
                const marcado = elegidos.includes(p.id);
                return (
                  <tr key={p.id} className={marcado ? 'flex-fila-elegida' : undefined}>
                    <td className="flex-col-check">
                      <input
                        type="checkbox"
                        aria-label={`${t.seleccionarPaquete} ${p.codigoSeguimiento}`}
                        checked={marcado}
                        onChange={() => alternar(p.id)}
                      />
                    </td>
                    <td className="flex-col-num">{(pagina - 1) * 50 + i + 1}</td>
                    <td className="flex-col-codigo">
                      <Enlace a={`${raiz}/packages/${p.id}`}>
                        <strong>{p.codigoSeguimiento}</strong>
                      </Enlace>
                      {p.referenciaExterna && <small>{p.referenciaExterna}</small>}
                    </td>
                    <td data-titulo={t.colDestinatario}>{p.destinatarioNombre}</td>
                    <td className="flex-col-direccion" data-titulo={t.direccion}>
                      <span>{calle}</span>
                      {ciudad && <span>{ciudad}</span>}
                    </td>
                    <td data-titulo={t.estado}>
                      <PildoraPaquete estado={p.estado} t={t} />
                    </td>
                    <td className="flex-col-acciones">
                      <MenuTresPuntos
                        etiqueta={`${t.accionesPaquete} ${p.codigoSeguimiento}`}
                        opciones={[
                          { texto: t.verDetalle, alTocar: () => ir(`${raiz}/packages/${p.id}`) },
                          { texto: t.verEtiqueta, alTocar: () => aEtiquetas([p.id]) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {lista !== null && lista.length > 0 && (
        <div className="flex-acciones-lote" aria-live="polite">
          <label className="flex-acciones-cuenta">
            <input
              type="checkbox"
              aria-label={t.seleccionarTodos}
              checked={todosElegidos}
              onChange={alternarTodos}
            />{' '}
            {elegidos.length}{' '}
            {elegidos.length === 1 ? t.paqueteSeleccionado : t.paquetesSeleccionados}
          </label>
          <div className="flex-acciones-botones">
            {puedeLotes && (
              <button
                type="button"
                className="boton secundario"
                disabled={!elegidos.length}
                onClick={abrirLotes}
              >
                {t.asignarALote}
              </button>
            )}
            <button
              type="button"
              className="boton secundario"
              disabled={!elegidos.length}
              onClick={() => aEtiquetas(elegidos)}
            >
              {t.imprimirEtiquetas}
            </button>
            <button
              type="button"
              className="boton secundario"
              disabled={!elegidos.length}
              onClick={() => aEtiquetas(elegidos, true)}
            >
              {t.descargarPdf}
            </button>
          </div>
        </div>
      )}
      {lotes !== null && (
        <div className="flex-tarjeta flex-elegir-lote">
          {lotes.length === 0 ? (
            <p className="pista">{t.sinLotesAbiertos}</p>
          ) : (
            <>
              <label>
                {t.elegirLote}{' '}
                <select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="boton"
                disabled={!loteId || trabajando}
                onClick={() => void asignarLote()}
              >
                {t.asignarAlLote}
              </button>
            </>
          )}
          <button type="button" className="boton secundario" onClick={() => setLotes(null)}>
            {t.cancelar}
          </button>
        </div>
      )}
      {aviso && (
        <p className="insignia insignia-aprobado" role="status">
          {aviso}
        </p>
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
      <Trazabilidad eventos={datos.eventos} t={t} idioma={ctx.idioma} />
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
                {h.procesadas}/{h.validas} · {fechaHoraLocal(h.creadoEn ?? '', ctx.idioma)}
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
  // Fase 5: punto de referencia y código plus del punto exacto (Google Maps lo entiende sin internet).
  referencias?: string;
  codigoPlus?: string | null;
  // Fase 6: el monto a cobrar, en grande (como el «cobro en destino» de las guías de allá).
  cobro?: { monto: number; moneda: string } | null;
  centro: string | null;
  empresa: string;
  pieza: number;
  total: number;
  descripcion: string;
  pesoG?: number | null;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  ruta?: { id: string; nombre: string; parada: number; paradas: number } | null;
  /** QR ya dibujado (lo prepara la hoja de impresión para imprimir sin esperar). */
  qrImagen?: string;
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
      preserveAspectRatio="none"
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

const kilos = (g: number | null | undefined) =>
  typeof g === 'number' && g > 0 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg` : '—';
const medidas = (d: DatosEtiqueta) =>
  d.largoCm && d.anchoCm && d.altoCm ? `${d.largoCm} x ${d.anchoCm} x ${d.altoCm} cm` : '—';

/**
 * Etiqueta del paquete (diseño aprobado el 27 oct 2026): logo, pieza, código de seguimiento,
 * barras con el identificador opaco, QR, destinatario, ruta y parada, y la franja negra de la marca.
 * Nunca lleva el teléfono del destinatario (C-FLEX-ETIQUETA).
 */
export function Etiqueta({
  d,
  t,
  compacta = false,
}: {
  d: DatosEtiqueta;
  t: Contexto['t'];
  compacta?: boolean;
}) {
  const [qrPropio, setQrPropio] = useState('');
  useEffect(() => {
    if (d.qrImagen) return;
    void QRCode.toDataURL(d.qr, { margin: 1, width: 220 })
      .then(setQrPropio)
      .catch(() => setQrPropio(''));
  }, [d.qr, d.qrImagen]);
  const qr = d.qrImagen || qrPropio;
  const [calle, ciudad] = lineasDireccion(d.direccion);
  const lado = compacta ? 76 : 112;
  return (
    <article className={`flex-etiqueta${compacta ? ' flex-etiqueta-compacta' : ''}`}>
      <header className="flex-etiqueta-cabeza">
        <img
          src="/marca/divoox-logo.svg"
          alt="Divoox"
          className="flex-etiqueta-logo"
          width={compacta ? 98 : 150}
          height={compacta ? 24 : 37}
        />
        <span className="flex-etiqueta-pieza">
          {t.paqueteN} {d.pieza} {t.de} {d.total}
        </span>
      </header>
      <div className="flex-etiqueta-codigos">
        <div className="flex-etiqueta-seguimiento">
          <span className="flex-etiqueta-titulo">{t.codigoSeguimiento}</span>
          <strong className="flex-etiqueta-codigo">{d.codigoSeguimiento}</strong>
          <CodigoBarras texto={d.codigoEtiqueta} alto={compacta ? 34 : 56} />
        </div>
        <figure className="flex-etiqueta-qr">
          {qr ? (
            <img src={qr} alt={d.qr} width={lado} height={lado} />
          ) : (
            <span style={{ width: lado, height: lado }} />
          )}
          {!compacta && <figcaption>{t.escanearSeguimiento}</figcaption>}
        </figure>
      </div>
      <div className="flex-etiqueta-destino">
        <div>
          <span className="flex-etiqueta-titulo">{t.destinatarioEtiqueta}</span>
          <p className="flex-etiqueta-nombre">{d.destinatarioNombre}</p>
          <p>{calle}</p>
          {ciudad && <p>{ciudad}</p>}
          {d.referencias && <p className="flex-etiqueta-nota">Ref.: {d.referencias}</p>}
          {d.codigoPlus && (
            <p className="flex-etiqueta-plus">
              <strong>{d.codigoPlus}</strong>
            </p>
          )}
          {d.cobro && (
            <p className="flex-etiqueta-cobro" data-testid="etiqueta-cobro">
              {t.cobrarEtiqueta}{' '}
              <strong>{formatearMonto(d.cobro.monto, d.cobro.moneda, t.idiomaMonto)}</strong>
            </p>
          )}
          {!compacta && d.instrucciones && <p className="flex-etiqueta-nota">{d.instrucciones}</p>}
          {compacta && d.referenciaExterna && (
            <p className="flex-etiqueta-ref">Ref: {d.referenciaExterna}</p>
          )}
        </div>
        <div className="flex-etiqueta-ruta">
          <span className="flex-etiqueta-titulo">{t.ruta}</span>
          <strong>{d.ruta ? d.ruta.nombre || d.ruta.id.slice(0, 8) : '—'}</strong>
          <span className="flex-etiqueta-titulo">{t.parada}</span>
          <strong className="flex-etiqueta-parada">
            {d.ruta ? `${d.ruta.parada} / ${d.ruta.paradas}` : '—'}
          </strong>
        </div>
      </div>
      {!compacta && (
        <dl className="flex-etiqueta-datos">
          <div>
            <dt>{t.referenciaExterna}</dt>
            <dd>{d.referenciaExterna ?? '—'}</dd>
          </div>
          <div>
            <dt>{t.peso}</dt>
            <dd>{kilos(d.pesoG)}</dd>
          </div>
          <div>
            <dt>{t.dimensiones}</dt>
            <dd>{medidas(d)}</dd>
          </div>
          <div>
            <dt>{t.remitente}</dt>
            <dd>{[d.empresa, d.centro].filter(Boolean).join(' · ') || '—'}</dd>
          </div>
        </dl>
      )}
      {!compacta && (
        <footer className="flex-etiqueta-pie">
          <img src="/marca/divoox-logo-oscuro.svg" alt="Divoox" width={130} height={32} />
          <span>{t.lema}</span>
        </footer>
      )}
    </article>
  );
}

export function Etiquetas({ ctx }: { ctx: Contexto }) {
  const { t, empresa } = ctx;
  const parametros =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const idsIniciales = [
    ...(parametros?.get('paquete') ? [parametros.get('paquete') as string] : []),
    ...(parametros?.get('paquetes')?.split(',').filter(Boolean) ?? []),
  ];
  const [pdf] = useState(parametros?.get('pdf') === '1');
  const [lista, setLista] = useState<Paquete[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([...new Set(idsIniciales)]);
  const [verLista, setVerLista] = useState(idsIniciales.length === 0);
  const [etiquetas, setEtiquetas] = useState<DatosEtiqueta[]>([]);
  const [error, setError] = useState('');
  const impreso = useRef(false);
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
        ).then(async (r) => ({
          ...r.etiqueta,
          qrImagen: await QRCode.toDataURL(r.etiqueta.qr, { margin: 1, width: 220 }).catch(
            () => '',
          ),
        })),
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
  // «Descargar PDF» llega con ?pdf=1: abre la ventana de impresión una vez, con todo dibujado.
  const listas =
    etiquetas.length > 0 &&
    etiquetas.length === elegidos.length &&
    etiquetas.every((e) => elegidos.includes(e.paqueteId));
  useEffect(() => {
    if (!pdf || impreso.current || !listas) return;
    impreso.current = true;
    window.print();
  }, [pdf, listas]);
  const alternar = (id: string) =>
    setElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  const una = etiquetas.length === 1;
  return (
    <section className="super flex-etiquetas">
      <header className="flex-encabezado flex-no-imprimir">
        <div>
          <h1>{una ? t.etiqueta : t.etiquetasImpresion}</h1>
          <p className="pista">{t.etiquetasAyuda}</p>
        </div>
        <div className="flex-encabezado-botones">
          <button
            type="button"
            className="boton secundario"
            disabled={!etiquetas.length}
            onClick={() => window.print()}
          >
            {t.descargarPdf}
          </button>
          <button
            type="button"
            className="boton"
            disabled={!etiquetas.length}
            onClick={() => window.print()}
          >
            {t.imprimir}
          </button>
        </div>
      </header>
      <p className="pista flex-no-imprimir">{t.pdfAyuda}</p>
      <Error_ error={error} />
      <div className="flex-no-imprimir">
        <button
          type="button"
          className="boton secundario"
          aria-expanded={verLista}
          onClick={() => setVerLista((v) => !v)}
        >
          {t.elegirPaquetes} ({elegidos.length})
        </button>
        {verLista && (
          <ul className="super-lista flex-elegir-paquetes">
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
        )}
      </div>
      {!elegidos.length && <p className="pista">{t.sinSeleccion}</p>}
      <div className={`flex-hoja-etiquetas${una ? ' flex-hoja-una' : ''}`}>
        {etiquetas.map((e) => (
          <Etiqueta key={e.paqueteId} d={e} t={t} compacta={!una} />
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
