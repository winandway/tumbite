import { useEffect, useRef, useState } from 'react';

import { ESTILO_MAPA_DIVOOX } from './estiloMapaDivoox';

/**
 * C-MAPA-GOOGLE-WEB — todos los países. Pieza única del mapa web (panel, sitio y apps exportadas a
 * la web).
 *
 * - 13 nov 2026 (términos de Google Maps Platform): lo que viene de Google Places no se dibuja sobre
 *   un mapa que no sea de Google.
 * - 14 nov 2026 (decisión de Richard): con la llave pública del navegador, el mapa es SIEMPRE el de
 *   Google, venga de donde venga el punto (Places, GPS o propio). Sin llave, Leaflet como siempre
 *   (entorno local y pruebas sin llave).
 * - Con Map ID (`VITE_GOOGLE_MAPS_WEB_MAP_ID` / `EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID`): mapa vectorial
 *   con el estilo de Divoox guardado en la consola de Google y marcas avanzadas; en las pantallas de
 *   viaje o entrega en curso, inclinado a 45° y girado hacia el destino, como Uber y DoorDash. Sin
 *   Map ID: mapa de Google normal con el mismo estilo en la opción `styles` y sin inclinar.
 * - Gasto: en las pantallas de viaje o entrega en curso el mapa se abre solo; en las demás, botón
 *   «Ver en el mapa». Una sola carga del script por página. El servidor no escribe nada por cada mapa
 *   abierto (regla «la nube no se come el dinero»). Tope duro en la cuota «Map loads per day» de
 *   Maps JavaScript API en Google Cloud (`TOPE_CARGAS_MAPA_DIA`).
 *
 * Ficha con las fuentes oficiales: docs/investigaciones-rea/2026-11-14-mapa-google-vectorial-web.md
 */
export type OrigenPunto = 'google' | 'gps' | 'propio';
export type ProveedorMapaWeb = 'google' | 'leaflet';

/**
 * Tope de cargas de mapa de Google al día (cuota «Map loads per day» del proyecto de Google Cloud:
 * cuenta los dos sitios juntos, producción y pruebas, porque comparten la llave).
 * 320 × 31 días = 9.920 cargas al mes: dentro de las 10.000 gratis de «Dynamic Maps» (precio leído
 * el 14 nov 2026: 7 USD cada 1.000 cargas después de las gratis). Costo máximo con este tope: 0 USD.
 */
export const TOPE_CARGAS_MAPA_DIA = 320;

/** Inclinación de las pantallas de viaje o entrega en curso (Google la limita según el zoom). */
export const INCLINACION_VIAJE = 45;

export function llaveMapaValida(llave: string | null | undefined): boolean {
  return typeof llave === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(llave.trim());
}

export function mapIdValido(mapId: string | null | undefined): mapId is string {
  return typeof mapId === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(mapId.trim());
}

/**
 * Qué mapa usar en la web. Desde el 14 nov 2026 el origen de los puntos ya no decide: con llave,
 * Google; sin llave, Leaflet. `origenes` se mantiene para no romper a quien lo pasa.
 */
export function elegirMapaWeb({
  llave,
}: {
  llave: string | null | undefined;
  origenes?: OrigenPunto[];
}): ProveedorMapaWeb {
  return llaveMapaValida(llave) ? 'google' : 'leaflet';
}

/** Rumbo inicial (grados desde el norte, en el sentido del reloj) de `desde` hacia `hacia`. */
export function rumboEntre(desde: LatLng, hacia: LatLng): number {
  const rad = Math.PI / 180;
  const f1 = desde.lat * rad;
  const f2 = hacia.lat * rad;
  const dl = (hacia.lng - desde.lng) * rad;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (((Math.atan2(y, x) / rad) % 360) + 360) % 360;
}

/** Opciones con las que se crea el mapa de Google (pura, para poder probarla). */
export function opcionesMapaGoogle({
  centro,
  zoom,
  mapId,
  inclinado = false,
  rumbo = 0,
}: {
  centro: LatLng;
  zoom: number;
  mapId?: string | null;
  inclinado?: boolean;
  rumbo?: number;
}): Record<string, unknown> {
  const base = {
    center: centro,
    zoom,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: 'cooperative',
  };
  if (!mapIdValido(mapId)) return { ...base, styles: ESTILO_MAPA_DIVOOX };
  return {
    ...base,
    mapId: mapId.trim(),
    renderingType: 'VECTOR',
    tilt: inclinado ? INCLINACION_VIAJE : 0,
    heading: inclinado ? ((rumbo % 360) + 360) % 360 : 0,
  };
}

// Tipos mínimos de la parte de Maps JavaScript API que usamos (sin depender de @types).
type LatLng = { lat: number; lng: number };
type Escuchador = { remove(): void };
export type MapaG = {
  setCenter(p: LatLng): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
  fitBounds(b: unknown, relleno?: number): void;
  setTilt?(t: number): void;
  setHeading?(h: number): void;
  addListener(
    evento: string,
    cb: (e: { latLng?: { lat(): number; lng(): number } }) => void,
  ): Escuchador;
};
type MarcaG = {
  setMap(m: MapaG | null): void;
  setPosition?(p: LatLng): void;
  addListener(evento: string, cb: () => void): Escuchador;
};
type MarcaAvanzadaG = {
  map: MapaG | null;
  position?: LatLng | null;
  addListener(evento: string, cb: () => void): Escuchador;
};
type FiguraG = { setMap(m: MapaG | null): void };
export type GoogleMapsApi = {
  Map: new (div: HTMLElement, opciones: Record<string, unknown>) => MapaG;
  Marker: new (opciones: Record<string, unknown>) => MarcaG;
  LatLngBounds: new () => { extend(p: LatLng): void };
  SymbolPath: { CIRCLE: unknown };
  Polyline?: new (opciones: Record<string, unknown>) => FiguraG;
  Circle?: new (opciones: Record<string, unknown>) => FiguraG;
  Polygon?: new (opciones: Record<string, unknown>) => FiguraG;
  marker?: { AdvancedMarkerElement?: new (opciones: Record<string, unknown>) => MarcaAvanzadaG };
  importLibrary?: (nombre: string) => Promise<Record<string, unknown>>;
};

let cargando: Promise<GoogleMapsApi> | null = null;
let llaveRechazada = false;
const escuchasLlave = new Set<() => void>();

/** Para las pruebas: olvida la carga anterior. */
export function olvidarCargaGoogleMaps() {
  cargando = null;
  llaveRechazada = false;
}

/**
 * Google llama a `window.gm_authFailure` cuando rechaza la llave (dominio no permitido, API sin
 * habilitar, cuota agotada): sin esto, el mapa queda gris y nadie se entera. Avisa a cada mapa
 * abierto y deja rastro en la consola.
 */
function escucharLlaveRechazada(ventana: object | null) {
  if (!ventana) return;
  (ventana as { gm_authFailure?: () => void }).gm_authFailure = () => {
    llaveRechazada = true;
    console.error('Google Maps rechazó la llave del navegador (gm_authFailure).');
    for (const f of escuchasLlave) f();
  };
}

/** Se entera si Google rechaza la llave; devuelve cómo dejar de escuchar. */
export function alRechazarLlaveGoogle(f: () => void): () => void {
  escuchasLlave.add(f);
  return () => escuchasLlave.delete(f);
}

/**
 * Con la carga dinámica («loading=async») las clases se piden con `importLibrary` (documentación
 * oficial, «Load the Maps JavaScript API»): core, maps y marker en paralelo. Si la página no tiene
 * `importLibrary` (pruebas o una carga vieja), se usa `google.maps` tal cual.
 */
async function armarApi(maps: GoogleMapsApi): Promise<GoogleMapsApi> {
  if (typeof maps.importLibrary !== 'function') return maps;
  const [core, mapsLib, marker] = await Promise.all(
    ['core', 'maps', 'marker'].map((n) => maps.importLibrary!(n)),
  );
  return {
    ...maps,
    ...core,
    ...mapsLib,
    Marker: (marker?.Marker as GoogleMapsApi['Marker'] | undefined) ?? maps.Marker,
    marker: { ...maps.marker, ...marker },
  } as GoogleMapsApi;
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
  escucharLlaveRechazada(ventana);
  const ya = ventana?.google?.maps;
  if (ya?.importLibrary || ya?.Map) return (cargando = armarApi(ya));
  cargando = new Promise<GoogleMapsApi>((resolver, rechazar) => {
    const nombre = '__divooxMapaListo';
    const v = ventana as unknown as { __divooxMapaListo?: () => void } | null;
    if (v)
      v.__divooxMapaListo = () => {
        const g = (ventana as { google?: { maps?: GoogleMapsApi } } | null)?.google?.maps;
        if (g) armarApi(g).then(resolver, rechazar);
        else rechazar(new Error('Google Maps no respondió'));
      };
    const s = doc.createElement('script');
    const q = new URLSearchParams({
      key: llave.trim(),
      loading: 'async',
      callback: nombre,
      language: idioma,
      // Marcas avanzadas (AdvancedMarkerElement): las usa el mapa vectorial con Map ID.
      libraries: 'marker',
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
  /** Texto corto dentro de la marca (el número de la parada, el pago extra de una zona). */
  texto?: string;
  alTocar?: () => void;
};

/** Línea entre puntos (por ejemplo, el orden de las paradas de una ruta Flex). */
export type LineaMapaWeb = { id: string; puntos: LatLng[]; color: string; punteada?: boolean };

/** Área redonda (el área de entrega de Flex, las zonas con más pedidos del conductor). */
export type CirculoMapaWeb = {
  id: string;
  centro: LatLng;
  metros: number;
  color: string;
  opacidad?: number;
};

type Quitable = { quitar(): void; mover?(p: LatLng): void };

/** El círculo de color con borde blanco (y su texto) de las marcas avanzadas. */
function contenidoMarca(p: PuntoMapaWeb): HTMLElement {
  const d = document.createElement('div');
  const lado = (p.radio ?? 9) * 2;
  Object.assign(d.style, {
    minWidth: `${lado}px`,
    height: `${lado}px`,
    padding: p.texto ? '0 6px' : '0',
    boxSizing: 'border-box',
    borderRadius: `${lado}px`,
    background: p.color,
    border: '3px solid #FFFFFF',
    boxShadow: '0 1px 4px rgba(0,0,0,.3)',
    color: '#FFFFFF',
    font: '800 12px system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // La marca avanzada se ancla abajo al centro: se baja media altura para centrar el círculo.
    transform: 'translateY(50%)',
    cursor: p.alTocar ? 'pointer' : 'default',
  });
  if (p.texto) d.textContent = p.texto;
  return d;
}

function dibujarMarca(g: GoogleMapsApi, m: MapaG, p: PuntoMapaWeb, avanzadas: boolean): Quitable {
  const Avanzada = g.marker?.AdvancedMarkerElement;
  if (avanzadas && Avanzada) {
    const marca = new Avanzada({
      map: m,
      position: { lat: p.lat, lng: p.lng },
      title: p.etiqueta ?? '',
      content: contenidoMarca(p),
      gmpClickable: Boolean(p.alTocar),
    });
    if (p.alTocar) marca.addListener('gmp-click', p.alTocar);
    return {
      quitar: () => (marca.map = null),
      mover: (q) => (marca.position = { lat: q.lat, lng: q.lng }),
    };
  }
  const marca = new g.Marker({
    map: m,
    position: { lat: p.lat, lng: p.lng },
    title: p.etiqueta,
    label: p.texto
      ? { text: p.texto, color: '#FFFFFF', fontWeight: '800', fontSize: '12px' }
      : undefined,
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
  return {
    quitar: () => marca.setMap(null),
    mover: (q) => marca.setPosition?.({ lat: q.lat, lng: q.lng }),
  };
}

/**
 * Encuadra los puntos. En viaje, como `fitBounds` deja el mapa plano, al quedar quieto se vuelve a
 * inclinar y a girar.
 */
function encuadrar(
  g: GoogleMapsApi,
  m: MapaG,
  puntos: PuntoMapaWeb[],
  zoom: number,
  inclinado: boolean,
  rumbo: number,
) {
  if (puntos.length > 1) {
    const b = new g.LatLngBounds();
    for (const p of puntos) b.extend({ lat: p.lat, lng: p.lng });
    m.fitBounds(b, 40);
  } else if (puntos[0]) {
    m.setCenter({ lat: puntos[0].lat, lng: puntos[0].lng });
    m.setZoom(Math.max(m.getZoom() ?? zoom, 16));
  }
  if (inclinado && m.setTilt) {
    const una = m.addListener('idle', () => {
      una.remove();
      m.setTilt?.(INCLINACION_VIAJE);
      m.setHeading?.(rumbo);
    });
  }
}

/** Dibuja puntos, líneas y áreas (y quita lo anterior). Devuelve las marcas por id para moverlas. */
function dibujarTodo(
  g: GoogleMapsApi,
  m: MapaG,
  d: {
    puntos: PuntoMapaWeb[];
    lineas: LineaMapaWeb[];
    circulos: CirculoMapaWeb[];
    zoom: number;
    avanzadas: boolean;
    inclinado: boolean;
    rumbo: number;
  },
  anteriores: Quitable[],
): { todos: Quitable[]; marcas: Map<string, Quitable> } {
  for (const x of anteriores) x.quitar();
  const nuevos: Quitable[] = [];
  for (const c of d.circulos)
    if (g.Circle) {
      const f = new g.Circle({
        map: m,
        center: c.centro,
        radius: c.metros,
        strokeColor: c.color,
        strokeWeight: 1,
        fillColor: c.color,
        fillOpacity: c.opacidad ?? 0.18,
        clickable: false,
      });
      nuevos.push({ quitar: () => f.setMap(null) });
    }
  for (const l of d.lineas)
    if (g.Polyline && l.puntos.length > 1) {
      const f = new g.Polyline({
        map: m,
        path: l.puntos.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: l.color,
        strokeWeight: 3,
        strokeOpacity: l.punteada ? 0 : 0.9,
        clickable: false,
        icons: l.punteada
          ? [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: l.color, scale: 3 },
                offset: '0',
                repeat: '14px',
              },
            ]
          : undefined,
      });
      nuevos.push({ quitar: () => f.setMap(null) });
    }
  const marcas = new Map<string, Quitable>();
  for (const p of d.puntos) {
    const x = dibujarMarca(g, m, p, d.avanzadas);
    marcas.set(p.id, x);
    nuevos.push(x);
  }
  encuadrar(g, m, d.puntos, d.zoom, d.inclinado, d.rumbo);
  return { todos: nuevos, marcas };
}

/**
 * Lo que obliga a redibujar (y, en viaje, a volver a encuadrar una vez): qué puntos hay, su color,
 * su texto, las líneas y las áreas. Si solo cambian las posiciones (una lectura de GPS), se mueven
 * las marcas y nada más.
 */
function firmaFija(puntos: PuntoMapaWeb[], lineas: LineaMapaWeb[], circulos: CirculoMapaWeb[]) {
  return [
    ...puntos.map((p) => `${p.id}:${p.color}:${p.radio ?? ''}:${p.texto ?? ''}`),
    ...lineas.map((l) => `${l.id}:${l.puntos.map((p) => `${p.lat},${p.lng}`).join(';')}`),
    ...circulos.map((c) => `${c.id}:${c.centro.lat},${c.centro.lng}:${c.metros}`),
  ].join('|');
}

const TEXTOS = {
  es: { ver: 'Ver en el mapa', cargando: 'Abriendo el mapa…', error: 'No pudimos abrir el mapa.' },
  en: { ver: 'See on the map', cargando: 'Opening the map…', error: 'We couldn’t open the map.' },
};

/**
 * Mapa de Google: un botón «Ver en el mapa» y, al tocarlo, se carga Google Maps y se dibujan los
 * puntos (círculos con borde blanco), las líneas y las áreas. Con `abierto` (pantallas de viaje o
 * entrega en curso) se abre solo; con `inclinado`, vista de 45° girada hacia `rumbo` (solo con Map
 * ID: el mapa vectorial). `alTocarMapa` recibe el punto tocado (para elegir la entrega). Una sola
 * pieza para el panel y las apps en la web.
 */
export function MapaGoogleBajoDemanda({
  llave,
  mapId,
  idioma,
  centro,
  zoom = 15,
  puntos,
  lineas = [],
  circulos = [],
  alTocarMapa,
  alto = 260,
  etiqueta,
  abierto: abiertoInicial = false,
  inclinado = false,
  rumbo = 0,
}: {
  llave: string;
  mapId?: string | null;
  idioma: 'es' | 'en';
  centro: LatLng;
  zoom?: number;
  puntos: PuntoMapaWeb[];
  lineas?: LineaMapaWeb[];
  circulos?: CirculoMapaWeb[];
  alTocarMapa?: (p: LatLng) => void;
  alto?: number;
  etiqueta: string;
  abierto?: boolean;
  inclinado?: boolean;
  rumbo?: number;
}) {
  const t = TEXTOS[idioma === 'es' ? 'es' : 'en'];
  // Abierto si la pantalla es de viaje o entrega en curso, o si la persona tocó «Ver en el mapa».
  const [tocado, setTocado] = useState(false);
  const abierto = abiertoInicial || tocado;
  const [estado, setEstado] = useState<'' | 'cargando' | 'error' | 'listo'>('');
  const caja = useRef<HTMLDivElement>(null);
  const api = useRef<GoogleMapsApi | null>(null);
  const mapa = useRef<MapaG | null>(null);
  const dibujados = useRef<Quitable[]>([]);
  const marcasPorId = useRef(new Map<string, Quitable>());
  const fijaDibujada = useRef<string | null>(null);
  const vectorial = mapIdValido(mapId);
  const alTocar = useRef(alTocarMapa);
  useEffect(() => {
    alTocar.current = alTocarMapa;
  }, [alTocarMapa]);

  useEffect(() => {
    if (!abierto || mapa.current) return;
    let vivo = true;
    setEstado('cargando');
    const dejar = alRechazarLlaveGoogle(() => vivo && setEstado('error'));
    cargarGoogleMaps(llave, idioma)
      .then((g) => {
        if (!vivo || !caja.current) return;
        if (llaveRechazada) {
          setEstado('error');
          return;
        }
        api.current = g;
        const m = new g.Map(
          caja.current,
          opcionesMapaGoogle({ centro, zoom, mapId, inclinado, rumbo }),
        );
        m.addListener('click', (e) => {
          if (e.latLng) alTocar.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        mapa.current = m;
        setEstado('listo');
      })
      .catch((e: unknown) => {
        console.error('No se pudo abrir el mapa de Google:', e);
        if (vivo) setEstado('error');
      });
    return () => {
      vivo = false;
      dejar();
      // Al cerrarse (abierto pasa a false o la pantalla se va) el div del mapa desaparece: se
      // olvida todo, para que al volver a abrir se cree un mapa nuevo sobre el div nuevo.
      for (const x of dibujados.current) x.quitar();
      dibujados.current = [];
      marcasPorId.current = new Map();
      fijaDibujada.current = null;
      mapa.current = null;
      api.current = null;
    };
    // Se crea una sola vez al abrir; los puntos se redibujan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const firma = [
    ...puntos.map((p) => `${p.id}:${p.lat},${p.lng}:${p.color}:${p.texto ?? ''}`),
    ...lineas.map((l) => `${l.id}:${l.puntos.map((p) => `${p.lat},${p.lng}`).join(';')}`),
    ...circulos.map((c) => `${c.id}:${c.centro.lat},${c.centro.lng}:${c.metros}`),
    `r${Math.round(rumbo)}`,
  ].join('|');
  useEffect(() => {
    const g = api.current;
    const m = mapa.current;
    if (estado !== 'listo' || !g || !m) return;
    const enViaje = inclinado && vectorial;
    const fija = firmaFija(puntos, lineas, circulos);
    if (fija === fijaDibujada.current) {
      // Solo cambiaron posiciones (GPS): se mueven las marcas. En viaje no se vuelve a encuadrar
      // (aplanaría el mapa): solo se corrige el rumbo. Fuera de viaje, se encuadra como siempre.
      for (const p of puntos) marcasPorId.current.get(p.id)?.mover?.(p);
      if (enViaje) m.setHeading?.(rumbo);
      else encuadrar(g, m, puntos, zoom, false, rumbo);
      return;
    }
    // Cambió qué se dibuja (por ejemplo, el destino pasa del restaurante a la casa): se redibuja
    // y se encuadra una vez.
    const r = dibujarTodo(
      g,
      m,
      { puntos, lineas, circulos, zoom, avanzadas: vectorial, inclinado: enViaje, rumbo },
      dibujados.current,
    );
    dibujados.current = r.todos;
    marcasPorId.current = r.marcas;
    fijaDibujada.current = fija;
    // Se redibuja cuando el mapa queda listo o cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, estado]);

  if (!abierto)
    return (
      <button
        type="button"
        data-testid="ver-en-el-mapa"
        onClick={() => setTocado(true)}
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
        style={{
          // Con la llave rechazada no se deja el mapa gris: solo el mensaje.
          display: estado === 'error' ? 'none' : 'block',
          height: alto,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#E9EEF5',
        }}
      />
      {estado === 'cargando' ? <p role="status">{t.cargando}</p> : null}
      {estado === 'error' ? <p role="alert">{t.error}</p> : null}
    </div>
  );
}
