import { useEffect, useRef, useState } from 'react';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026, decisión de Richard por los términos de Google Maps Platform) —
 * todos los países. El contenido de Google Places (direcciones y puntos sugeridos) no se muestra
 * sobre un mapa que no sea de Google. En la web (panel, sitio y apps exportadas a la web):
 *
 * - si algún punto del mapa vino de Google Places y existe la llave pública del navegador, el mapa
 *   es el de Google (Maps JavaScript API), cargado SOLO cuando la persona toca «Ver en el mapa»
 *   (nunca en cada visita: así no se gasta por mirar);
 * - si ningún punto vino de Google (por ejemplo, la ubicación GPS del repartidor), sigue Leaflet
 *   con OpenStreetMap, como siempre;
 * - mientras la llave no exista, sigue Leaflet como hoy (el riesgo queda anotado en
 *   docs/investigaciones/2026-11-13-mapas-y-distancia-por-calles.md).
 *
 * El tope duro de cargas (300 al día por sitio) se pone en la cuota «Map loads per day» de Maps
 * JavaScript API en Google Cloud, igual que los topes de Places: el servidor no escribe nada por
 * cada mapa abierto (regla «la nube no se come el dinero»).
 */
export type OrigenPunto = 'google' | 'gps' | 'propio';
export type ProveedorMapaWeb = 'google' | 'leaflet';

/** Tope de cargas de mapa de Google al día por sitio (se configura en la cuota de Google Cloud). */
export const TOPE_CARGAS_MAPA_DIA = 300;

export function elegirMapaWeb({
  llave,
  origenes,
}: {
  llave: string | null | undefined;
  origenes: OrigenPunto[];
}): ProveedorMapaWeb {
  const llaveValida = typeof llave === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(llave.trim());
  return llaveValida && origenes.includes('google') ? 'google' : 'leaflet';
}

// Tipos mínimos de la parte de Maps JavaScript API que usamos (sin depender de @types).
type LatLng = { lat: number; lng: number };
type Escuchador = { remove(): void };
export type MapaG = {
  setCenter(p: LatLng): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
  fitBounds(b: unknown, relleno?: number): void;
  addListener(
    evento: string,
    cb: (e: { latLng?: { lat(): number; lng(): number } }) => void,
  ): Escuchador;
};
type MarcaG = {
  setMap(m: MapaG | null): void;
  addListener(evento: string, cb: () => void): Escuchador;
};
export type GoogleMapsApi = {
  Map: new (div: HTMLElement, opciones: Record<string, unknown>) => MapaG;
  Marker: new (opciones: Record<string, unknown>) => MarcaG;
  LatLngBounds: new () => { extend(p: LatLng): void };
  SymbolPath: { CIRCLE: unknown };
};

let cargando: Promise<GoogleMapsApi> | null = null;

/** Para las pruebas: olvida la carga anterior. */
export function olvidarCargaGoogleMaps() {
  cargando = null;
}

/**
 * Carga Maps JavaScript API una sola vez por página (carga dinámica con «loading=async»). Si falla,
 * la promesa se rechaza y la próxima vez se vuelve a intentar.
 */
export function cargarGoogleMaps(
  llave: string,
  idioma: 'es' | 'en' = 'en',
  doc: Document = document,
): Promise<GoogleMapsApi> {
  if (cargando) return cargando;
  const ventana = doc.defaultView as (Window & { google?: { maps?: GoogleMapsApi } }) | null;
  if (ventana?.google?.maps?.Map) return (cargando = Promise.resolve(ventana.google.maps));
  cargando = new Promise<GoogleMapsApi>((resolver, rechazar) => {
    const nombre = '__divooxMapaListo';
    const v = ventana as unknown as { __divooxMapaListo?: () => void } | null;
    if (v)
      v.__divooxMapaListo = () => {
        const g = (ventana as { google?: { maps?: GoogleMapsApi } } | null)?.google?.maps;
        if (g) resolver(g);
        else rechazar(new Error('Google Maps no respondió'));
      };
    const s = doc.createElement('script');
    const q = new URLSearchParams({
      key: llave.trim(),
      loading: 'async',
      callback: nombre,
      language: idioma,
      v: 'weekly',
    });
    s.src = `https://maps.googleapis.com/maps/api/js?${q.toString()}`;
    s.async = true;
    s.onerror = () => {
      cargando = null;
      rechazar(new Error('No se pudo cargar Google Maps'));
    };
    doc.head.appendChild(s);
  });
  return cargando;
}

export type PuntoMapaWeb = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  radio?: number;
  etiqueta?: string;
  alTocar?: () => void;
};

/** Dibuja los puntos (y quita los anteriores); con varios, encuadra todos. */
function dibujarPuntos(
  g: GoogleMapsApi,
  m: MapaG,
  puntos: PuntoMapaWeb[],
  zoom: number,
  anteriores: MarcaG[],
): MarcaG[] {
  for (const x of anteriores) x.setMap(null);
  const marcas = puntos.map((p) => {
    const marca = new g.Marker({
      map: m,
      position: { lat: p.lat, lng: p.lng },
      title: p.etiqueta,
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: p.radio ?? 9,
        fillColor: p.color,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
      },
    });
    if (p.alTocar) marca.addListener('click', p.alTocar);
    return marca;
  });
  if (puntos.length > 1) {
    const b = new g.LatLngBounds();
    for (const p of puntos) b.extend({ lat: p.lat, lng: p.lng });
    m.fitBounds(b, 40);
  } else if (puntos[0]) {
    m.setCenter({ lat: puntos[0].lat, lng: puntos[0].lng });
    m.setZoom(Math.max(m.getZoom() ?? zoom, 16));
  }
  return marcas;
}

const TEXTOS = {
  es: { ver: 'Ver en el mapa', cargando: 'Abriendo el mapa…', error: 'No pudimos abrir el mapa.' },
  en: { ver: 'See on the map', cargando: 'Opening the map…', error: 'We couldn’t open the map.' },
};

/**
 * Mapa de Google bajo demanda: un botón «Ver en el mapa»; al tocarlo se carga Google Maps y se
 * dibujan los puntos (círculos con borde blanco, como en Leaflet). `alTocarMapa` recibe el punto
 * tocado (para elegir la entrega). Una sola pieza para el panel y las apps en la web.
 */
export function MapaGoogleBajoDemanda({
  llave,
  idioma,
  centro,
  zoom = 15,
  puntos,
  alTocarMapa,
  alto = 260,
  etiqueta,
  abierto: abiertoInicial = false,
}: {
  llave: string;
  idioma: 'es' | 'en';
  centro: LatLng;
  zoom?: number;
  puntos: PuntoMapaWeb[];
  alTocarMapa?: (p: LatLng) => void;
  alto?: number;
  etiqueta: string;
  abierto?: boolean;
}) {
  const t = TEXTOS[idioma === 'es' ? 'es' : 'en'];
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [estado, setEstado] = useState<'' | 'cargando' | 'error' | 'listo'>('');
  const caja = useRef<HTMLDivElement>(null);
  const api = useRef<GoogleMapsApi | null>(null);
  const mapa = useRef<MapaG | null>(null);
  const marcas = useRef<MarcaG[]>([]);
  const alTocar = useRef(alTocarMapa);
  useEffect(() => {
    alTocar.current = alTocarMapa;
  }, [alTocarMapa]);

  useEffect(() => {
    if (!abierto || mapa.current) return;
    let vivo = true;
    setEstado('cargando');
    cargarGoogleMaps(llave, idioma)
      .then((g) => {
        if (!vivo || !caja.current) return;
        api.current = g;
        const m = new g.Map(caja.current, {
          center: centro,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
        m.addListener('click', (e) => {
          if (e.latLng) alTocar.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        mapa.current = m;
        setEstado('listo');
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
    };
    // Se crea una sola vez al abrir; los puntos se redibujan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const firma = puntos.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    const g = api.current;
    const m = mapa.current;
    if (estado !== 'listo' || !g || !m) return;
    marcas.current = dibujarPuntos(g, m, puntos, zoom, marcas.current);
    // Se redibuja cuando el mapa queda listo o cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, estado]);

  if (!abierto)
    return (
      <button
        type="button"
        data-testid="ver-en-el-mapa"
        onClick={() => setAbierto(true)}
        style={{
          width: '100%',
          padding: '12px 16px',
          marginBottom: 12,
          borderRadius: 12,
          border: '1px solid #2a2a2a',
          background: '#FFFFFF',
          color: '#101010',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {t.ver}
      </button>
    );
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        ref={caja}
        role="application"
        aria-label={etiqueta}
        data-testid="mapa-google"
        style={{ height: alto, borderRadius: 16, overflow: 'hidden', background: '#E9EEF5' }}
      />
      {estado === 'cargando' ? <p role="status">{t.cargando}</p> : null}
      {estado === 'error' ? <p role="alert">{t.error}</p> : null}
    </div>
  );
}
