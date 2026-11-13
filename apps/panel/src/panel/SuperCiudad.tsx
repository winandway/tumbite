import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-CIUDAD-PRUEBAS (13 nov 2026, pedido de Richard): la ciudad de pruebas EN VIVO. Una población
 * falsa del simulador compra, vende y reparte; aquí se ve qué pedidos van en cada estado, cuántos
 * clientes compran, qué restaurantes venden, qué repartidores están en la zona (lista y mapa), las
 * ventas de la sesión y los fallos que va encontrando. Solo existe en el sitio de pruebas y en local
 * (el menú no la muestra en producción y el servidor responde «No encontrado» allí). Solo lee:
 * mirar no escribe nada. Todos los países.
 */
const T = {
  es: {
    titulo: 'Ciudad de pruebas',
    ayuda:
      'Clientes, restaurantes y repartidores falsos del simulador de compras usan Divoox de punta a punta. Esta pantalla se actualiza sola cada 5 segundos.',
    comoArrancar:
      'Para arrancar una sesión en el sitio de pruebas: GitHub → Actions → «simulador» → Run workflow → modo «ciudad» (pedidos y minutos). En la computadora: npm run simulador:ciudad.',
    sinSesion: 'Todavía no hay ninguna sesión de la ciudad.',
    sesion: 'Sesión',
    estados: { corriendo: 'En curso', parar: 'Parando…', terminada: 'Terminada' } as Record<
      string,
      string
    >,
    parar: 'Parar la sesión',
    pedidoParar: 'Pedido enviado: la sesión termina los pedidos en curso y cierra.',
    meta: (p: number, m: number) => `Hasta ${p} pedidos o ${m} minutos`,
    clientes: 'Clientes comprando',
    restaurantes: 'Restaurantes vendiendo',
    repartidores: 'Repartidores conectados',
    entregados: 'Entregados',
    ventas: 'Ventas entregadas',
    cancelados: 'Cancelados',
    fallos: 'Fallos encontrados',
    sinFallos: 'Ningún fallo en esta sesión.',
    porEstado: 'Pedidos por estado',
    pedidos: 'Últimos pedidos',
    zona: 'Repartidores en la zona',
    restaurante: 'Restaurante',
    estado: 'Estado',
    total: 'Total',
    hora: 'Hora',
    nombre: 'Nombre',
    conectado: 'Conectado',
    ocupado: 'Con pedido',
    libre: 'Libre',
    desconectado: 'Desconectado',
    ultimaSenal: 'Última señal',
    actualizado: 'Actualizado',
    nombresEstado: {
      pago_pendiente: 'Pago pendiente',
      pagado: 'Pagado',
      aceptado: 'Aceptado',
      listo: 'Listo',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Test city',
    ayuda:
      'Simulated customers, restaurants and drivers from the order simulator use Divoox end to end. This page refreshes itself every 5 seconds.',
    comoArrancar:
      'To start a session on the test site: GitHub → Actions → “simulador” → Run workflow → “ciudad” mode (orders and minutes). On the computer: npm run simulador:ciudad.',
    sinSesion: 'There’s no test city session yet.',
    sesion: 'Session',
    estados: { corriendo: 'Running', parar: 'Stopping…', terminada: 'Finished' } as Record<
      string,
      string
    >,
    parar: 'Stop the session',
    pedidoParar: 'Request sent: the session finishes the orders in progress and closes.',
    meta: (p: number, m: number) => `Up to ${p} orders or ${m} minutes`,
    clientes: 'Customers ordering',
    restaurantes: 'Restaurants selling',
    repartidores: 'Drivers online',
    entregados: 'Delivered',
    ventas: 'Delivered sales',
    cancelados: 'Canceled',
    fallos: 'Problems found',
    sinFallos: 'No problems in this session.',
    porEstado: 'Orders by status',
    pedidos: 'Latest orders',
    zona: 'Drivers in the area',
    restaurante: 'Restaurant',
    estado: 'Status',
    total: 'Total',
    hora: 'Time',
    nombre: 'Name',
    conectado: 'Online',
    ocupado: 'On an order',
    libre: 'Available',
    desconectado: 'Offline',
    ultimaSenal: 'Last signal',
    actualizado: 'Updated',
    nombresEstado: {
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid',
      aceptado: 'Accepted',
      listo: 'Ready',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
  },
};

type Vivo = {
  sesion: {
    id: string;
    estado: string;
    inicio: string;
    fin: string | null;
    meta: { pedidos?: number; minutos?: number };
    fallos: { cuando: string; comportamiento: string; mensaje: string; pedido?: string }[];
  } | null;
  porEstado?: Record<string, number>;
  clientesComprando?: number;
  restaurantesVendiendo?: number;
  ventas?: { entregados: number; total: number; moneda: string; cancelados: number };
  pedidos?: {
    id: string;
    estado: string;
    total: number;
    moneda: string;
    restaurante: string;
    creadoEn: string;
  }[];
  restaurantes?: { id: string; nombre: string; lat: number; lng: number; abierto: number }[];
  repartidores?: {
    id: string;
    nombre: string;
    conectado: boolean;
    ocupado: boolean;
    lat: number | null;
    lng: number | null;
    ubicacionEn: string | null;
  }[];
};

const ORDEN = [
  'pago_pendiente',
  'pagado',
  'aceptado',
  'listo',
  'en_camino',
  'entregado',
  'cancelado',
];
/** Hora local de una fecha de la base (UTC, «AAAA-MM-DD HH:MM:SS» o ISO). */
const hora = (x: string | null | undefined, idioma: Idioma = 'es') => {
  if (!x) return '—';
  const d = new Date(x.includes('T') ? x : `${x.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
};

export function SuperCiudad({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [vivo, setVivo] = useState<Vivo | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cuando, setCuando] = useState('');
  const cargar = useCallback(() => {
    pedir<Vivo>('GET', '/datos/admin/ciudad-pruebas')
      .then((r) => {
        setVivo(r);
        setError('');
        setCuando(new Date().toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US'));
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [idioma]);
  useEffect(() => {
    cargar();
    const id = window.setInterval(cargar, 5_000);
    return () => window.clearInterval(id);
  }, [cargar]);

  async function parar() {
    if (!vivo?.sesion) return;
    try {
      await pedir('POST', '/datos/admin/ciudad-pruebas/parar', { sesion: vivo.sesion.id });
      setAviso(t.pedidoParar);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const s = vivo?.sesion ?? null;
  const reps = vivo?.repartidores ?? [];
  const conectados = reps.filter((r) => r.conectado).length;
  const nombreEstado = (e: string) => new Map(Object.entries(t.nombresEstado)).get(e) ?? e;
  return (
    <section className="super ciudad-pruebas" data-testid="super-ciudad">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p className="texto-exito" role="status">
          {aviso}
        </p>
      ) : null}
      {vivo && !s ? (
        <>
          <p>{t.sinSesion}</p>
          <p className="pista">{t.comoArrancar}</p>
        </>
      ) : null}
      {s ? (
        <>
          <div className="ciudad-cabecera">
            <p>
              <strong>
                {t.sesion} {s.id}
              </strong>{' '}
              ·{' '}
              <span className={`ciudad-estado ciudad-estado-${s.estado}`}>
                {new Map(Object.entries(t.estados)).get(s.estado) ?? s.estado}
              </span>{' '}
              · {t.meta(s.meta.pedidos ?? 0, s.meta.minutos ?? 0)} · {t.actualizado} {cuando}
            </p>
            {s.estado === 'corriendo' ? (
              <button type="button" className="boton secundario" onClick={() => void parar()}>
                {t.parar}
              </button>
            ) : null}
          </div>
          <ul className="super-tarjetas" aria-label={t.titulo}>
            <li className="super-tarjeta">
              <span>{t.clientes}</span>
              <strong>{vivo?.clientesComprando ?? 0}</strong>
            </li>
            <li className="super-tarjeta">
              <span>{t.restaurantes}</span>
              <strong>{vivo?.restaurantesVendiendo ?? 0}</strong>
            </li>
            <li className="super-tarjeta">
              <span>{t.repartidores}</span>
              <strong>
                {conectados} / {reps.length}
              </strong>
            </li>
            <li className="super-tarjeta">
              <span>{t.entregados}</span>
              <strong className="ciudad-bien">{vivo?.ventas?.entregados ?? 0}</strong>
            </li>
            <li className="super-tarjeta">
              <span>{t.ventas}</span>
              <strong className="ciudad-bien">
                {formatearMonto(vivo?.ventas?.total ?? 0, vivo?.ventas?.moneda ?? 'USD', idioma)}
              </strong>
            </li>
            <li className="super-tarjeta">
              <span>{t.cancelados}</span>
              <strong>{vivo?.ventas?.cancelados ?? 0}</strong>
            </li>
            <li className={`super-tarjeta ${s.fallos.length ? 'super-tarjeta-alerta' : ''}`}>
              <span>{t.fallos}</span>
              <strong>{s.fallos.length}</strong>
            </li>
          </ul>

          <h2>{t.porEstado}</h2>
          <ul className="ciudad-estados">
            {ORDEN.map((e) => (
              <li key={e} className={e === 'entregado' ? 'ciudad-bien' : undefined}>
                <span>{nombreEstado(e)}</span>
                <strong>{new Map(Object.entries(vivo?.porEstado ?? {})).get(e) ?? 0}</strong>
              </li>
            ))}
          </ul>

          <h2>{t.zona}</h2>
          <MapaCiudad
            restaurantes={vivo?.restaurantes ?? []}
            repartidores={reps}
            etiquetaLibre={t.libre}
            etiquetaOcupado={t.ocupado}
          />
          <div className="tabla-ancha">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t.nombre}</th>
                  <th>{t.estado}</th>
                  <th>{t.ultimaSenal}</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td>{!r.conectado ? t.desconectado : r.ocupado ? t.ocupado : t.libre}</td>
                    <td>{hora(r.ubicacionEn, idioma)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>{t.fallos}</h2>
          {s.fallos.length === 0 ? (
            <p className="texto-exito">{t.sinFallos}</p>
          ) : (
            <ul className="lista ciudad-fallos">
              {[...s.fallos].reverse().map((f, i) => (
                <li key={`${f.cuando}-${i}`}>
                  <div className="lista-texto">
                    <strong>{f.comportamiento}</strong>
                    <span>
                      {hora(f.cuando, idioma)} · {f.mensaje}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2>{t.pedidos}</h2>
          <div className="tabla-ancha">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t.hora}</th>
                  <th>{t.restaurante}</th>
                  <th>{t.estado}</th>
                  <th>{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {(vivo?.pedidos ?? []).map((p) => (
                  <tr key={p.id}>
                    <td>{hora(p.creadoEn, idioma)}</td>
                    <td>{p.restaurante}</td>
                    <td className={p.estado === 'entregado' ? 'ciudad-bien' : undefined}>
                      {nombreEstado(p.estado)}
                    </td>
                    <td>{formatearMonto(p.total, p.moneda, idioma)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pista">{t.comoArrancar}</p>
        </>
      ) : null}
    </section>
  );
}

/** El mapa de la zona (la misma pieza Leaflet del panel): restaurantes y repartidores. */
function MapaCiudad({
  restaurantes,
  repartidores,
  etiquetaLibre,
  etiquetaOcupado,
}: {
  restaurantes: NonNullable<Vivo['restaurantes']>;
  repartidores: NonNullable<Vivo['repartidores']>;
  etiquetaLibre: string;
  etiquetaOcupado: string;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const capa = useRef<import('leaflet').LayerGroup | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);
  const [listo, setListo] = useState(false);
  const encuadrado = useRef(false);
  const centro = restaurantes[0];

  useEffect(() => {
    if (!caja.current || mapa.current || !centro) return;
    let vivo = true;
    void (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !caja.current) return;
      L.current = leaflet;
      const m = leaflet.map(caja.current).setView([centro.lat, centro.lng], 14);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        })
        .addTo(m);
      capa.current = leaflet.layerGroup().addTo(m);
      mapa.current = m;
      // La caja termina de tomar su tamaño después de pintar: sin esto quedan cuadros grises.
      window.setTimeout(() => m.invalidateSize(), 200);
      setListo(true);
    })();
    return () => {
      vivo = false;
    };
  }, [centro]);

  useEffect(() => {
    const leaflet = L.current;
    const g = capa.current;
    if (!listo || !leaflet || !g) return;
    g.clearLayers();
    for (const r of restaurantes)
      leaflet
        .circleMarker([r.lat, r.lng], { radius: 9, color: '#101010', weight: 2, fillOpacity: 0.9 })
        .bindTooltip(r.nombre)
        .addTo(g);
    for (const d of repartidores) {
      if (!d.conectado || d.lat == null || d.lng == null) continue;
      leaflet
        .circleMarker([d.lat, d.lng], {
          radius: 7,
          // Libre en verde (listo para trabajar); con pedido en el azul de logística (el rojo es
          // solo para problemas).
          color: d.ocupado ? '#1F4D69' : '#0d7a3a',
          weight: 2,
          fillOpacity: 0.8,
        })
        .bindTooltip(`${d.nombre} · ${d.ocupado ? etiquetaOcupado : etiquetaLibre}`)
        .addTo(g);
    }
    // Que se vean todos: el encuadre sigue a la gente de la ciudad.
    const puntos = [
      ...restaurantes.map((r) => [r.lat, r.lng] as [number, number]),
      ...repartidores
        .filter((d) => d.conectado && d.lat != null && d.lng != null)
        .map((d) => [d.lat as number, d.lng as number] as [number, number]),
    ];
    if (puntos.length > 1 && !encuadrado.current) {
      mapa.current?.invalidateSize();
      mapa.current?.fitBounds(puntos, { padding: [32, 32], maxZoom: 16 });
      encuadrado.current = true;
    }
  }, [listo, restaurantes, repartidores, etiquetaLibre, etiquetaOcupado]);

  return <div ref={caja} className="ciudad-mapa" role="img" aria-label="mapa" />;
}
