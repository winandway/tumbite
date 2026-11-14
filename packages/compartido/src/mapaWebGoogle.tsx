import type { VistaMapa } from './mapaLlegada';
import { useEffect, useRef, useState } from 'react';

import { type TemaMapa, estiloMapaDe, fondoMapaDe } from './estiloMapaDivoox';
import { ISOTIPO_DIVOOX_SVG } from './isotipoDivoox.generado';
import {
  AJUSTES_TEMA_MAPA,
  TEXTOS_TEMA_MAPA,
  nombreAjusteTemaMapa,
  cambiarAjusteTemaMapa,
  useAjusteTemaMapa,
  useTemaMapa,
} from './temaMapa';

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
 * - C-MAPA-DIA-NOCHE (14 nov 2026): dos estilos que cambian solos, de día y de noche (`useTemaMapa`).
 *   Con Map ID se pide a Google el esquema claro u oscuro (`colorScheme`, que solo se puede fijar al
 *   crear el mapa: al cambiar, el mapa se rehace); sin Map ID, el estilo de día o de noche en `styles`.
 * - C-MAPA-ISOTIPO (14 nov 2026): la marca del repartidor o conductor (`isotipo`) es el isotipo de
 *   Divoox sobre un disco blanco, que se lee igual de día y de noche.
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
  tema = 'dia',
}: {
  centro: LatLng;
  zoom: number;
  mapId?: string | null;
  inclinado?: boolean;
  rumbo?: number;
  tema?: TemaMapa;
}): Record<string, unknown> {
  const base = {
    center: centro,
    zoom,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: 'cooperative',
    backgroundColor: fondoMapaDe(tema),
  };
  if (!mapIdValido(mapId)) return { ...base, styles: estiloMapaDe(tema) };
  return {
    ...base,
    mapId: mapId.trim(),
    // El estilo claro y el oscuro están asociados al Map ID en la consola de Google; aquí se elige
    // cuál. Google solo lo admite al crear el mapa (documentación «Map color scheme»).
    colorScheme: tema === 'noche' ? 'DARK' : 'LIGHT',
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
  Point?: new (x: number, y: number) => unknown;
  Size?: new (ancho: number, alto: number) => unknown;
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
  /** C-MAPA-ISOTIPO: la marca es el isotipo de Divoox (el repartidor o conductor), no un círculo. */
  isotipo?: boolean;
  /** Sin señal reciente: el isotipo se ve apagado (no se presenta una ubicación vieja como viva). */
  apagado?: boolean;
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

/** Lado, en píxeles, de la marca del repartidor o conductor (disco blanco con el isotipo). */
export const LADO_MARCA_ISOTIPO = 44;

/**
 * C-MAPA-ISOTIPO: la marca del repartidor o conductor como dibujo vectorial: un disco blanco con
 * borde negro y, dentro, el isotipo de Divoox tal cual el vector aprobado (sin deformar: se encaja
 * entero). El disco blanco hace que se lea igual sobre el mapa de día y sobre el de noche.
 */
export function svgMarcaIsotipo(apagado = false): string {
  const dentro = ISOTIPO_DIVOOX_SVG.replace('<svg ', '<svg x="9" y="9" ').replace(
    /width="\d+" height="\d+"/,
    'width="26" height="26"',
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO_MARCA_ISOTIPO}" height="${LADO_MARCA_ISOTIPO}" viewBox="0 0 44 44"><g opacity="${apagado ? 0.55 : 1}"><circle cx="22" cy="22" r="20" fill="#FFFFFF" stroke="#101010" stroke-width="2"/>${dentro}</g></svg>`;
}

/** La misma marca como dirección de imagen (para Google sin Map ID y para Leaflet). */
export const urlMarcaIsotipo = (apagado = false): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarcaIsotipo(apagado))}`;

function contenidoIsotipo(p: PuntoMapaWeb): HTMLElement {
  const d = document.createElement('div');
  d.dataset.marca = 'isotipo';
  Object.assign(d.style, {
    width: `${LADO_MARCA_ISOTIPO}px`,
    height: `${LADO_MARCA_ISOTIPO}px`,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.45))',
    // La marca avanzada se ancla abajo al centro: se baja media altura para centrarla en el punto.
    transform: 'translateY(50%)',
    cursor: p.alTocar ? 'pointer' : 'default',
  });
  const img = document.createElement('img');
  img.src = urlMarcaIsotipo(p.apagado);
  img.alt = p.etiqueta ?? '';
  img.width = LADO_MARCA_ISOTIPO;
  img.height = LADO_MARCA_ISOTIPO;
  img.style.display = 'block';
  d.appendChild(img);
  return d;
}

/** El círculo de color con borde blanco (y su texto) de las marcas avanzadas. */
function contenidoMarca(p: PuntoMapaWeb): HTMLElement {
  if (p.isotipo) return contenidoIsotipo(p);
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
      zIndex: p.isotipo ? 1000 : undefined,
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
    label:
      p.texto && !p.isotipo
        ? { text: p.texto, color: '#FFFFFF', fontWeight: '800', fontSize: '12px' }
        : undefined,
    icon: p.isotipo
      ? {
          url: urlMarcaIsotipo(p.apagado),
          scaledSize: g.Size ? new g.Size(LADO_MARCA_ISOTIPO, LADO_MARCA_ISOTIPO) : undefined,
          anchor: g.Point ? new g.Point(LADO_MARCA_ISOTIPO / 2, LADO_MARCA_ISOTIPO / 2) : undefined,
        }
      : {
          path: g.SymbolPath.CIRCLE,
          scale: p.radio ?? 9,
          fillColor: p.color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
    // El repartidor va encima del local y de la casa.
    zIndex: p.isotipo ? 1000 : undefined,
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
  llegada: VistaMapa | null = null,
) {
  if (llegada) {
    // C-MAPA-LLEGADA: cerca del destino no se encuadra todo el recorrido: la casa y el repartidor
    // juntos, de cerca (el centro y el zoom los decide `vistaDeLlegada`).
    m.setCenter(llegada.centro);
    m.setZoom(llegada.zoom);
  } else if (puntos.length > 1) {
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
    llegada?: VistaMapa | null;
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
  encuadrar(g, m, d.puntos, d.zoom, d.inclinado, d.rumbo, d.llegada ?? null);
  return { todos: nuevos, marcas };
}

/**
 * Lo que obliga a redibujar (y, en viaje, a volver a encuadrar una vez): qué puntos hay, su color,
 * su texto, las líneas y las áreas. Si solo cambian las posiciones (una lectura de GPS), se mueven
 * las marcas y nada más.
 */
function firmaFija(puntos: PuntoMapaWeb[], lineas: LineaMapaWeb[], circulos: CirculoMapaWeb[]) {
  return [
    ...puntos.map(
      (p) =>
        `${p.id}:${p.color}:${p.radio ?? ''}:${p.texto ?? ''}:${p.isotipo ? 'i' : ''}${p.apagado ? 'a' : ''}`,
    ),
    ...lineas.map((l) => `${l.id}:${l.puntos.map((p) => `${p.lat},${p.lng}`).join(';')}`),
    ...circulos.map((c) => `${c.id}:${c.centro.lat},${c.centro.lng}:${c.metros}`),
  ].join('|');
}

const TEXTOS = {
  es: { ver: 'Ver en el mapa', cargando: 'Abriendo el mapa…', error: 'No pudimos abrir el mapa.' },
  en: { ver: 'See on the map', cargando: 'Opening the map…', error: 'We couldn’t open the map.' },
};

/** La clave de la vista de llegada: cuando cambia, la cámara se mueve una vez. */
const claveDeLlegada = (l: VistaMapa | null) =>
  l ? (l.clave ?? `${l.centro.lat},${l.centro.lng},${l.zoom}`) : '';

/**
 * C-MAPA-DIA-NOCHE: el ajuste de tres posiciones (automático, claro, oscuro) para la web. Se guarda
 * en el navegador de la persona y lo siguen todos los mapas abiertos.
 */
export function AjusteTemaMapaWeb({ idioma }: { idioma: 'es' | 'en' }) {
  const t = TEXTOS_TEMA_MAPA[idioma === 'es' ? 'es' : 'en'];
  const ajuste = useAjusteTemaMapa();
  return (
    <div
      role="radiogroup"
      aria-label={t.titulo}
      className="divoox-tema-mapa"
      data-testid="ajuste-tema-mapa"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        padding: 3,
        borderRadius: 999,
        border: '1px solid #2a2a2a',
        background: '#FFFFFF',
        fontSize: 13,
      }}
    >
      {/* Quien navega con el teclado ve en cuál está. */}
      <style>
        {'.divoox-tema-mapa label:focus-within{outline:2px solid #101010;outline-offset:2px}'}
      </style>
      {AJUSTES_TEMA_MAPA.map((a) => {
        const elegido = a === ajuste;
        return (
          <label
            key={a}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 14px',
              boxSizing: 'border-box',
              borderRadius: 999,
              cursor: 'pointer',
              fontWeight: 700,
              background: elegido ? '#101010' : 'transparent',
              color: elegido ? '#FFFFFF' : '#101010',
            }}
          >
            <input
              type="radio"
              name="divoox-tema-mapa"
              value={a}
              checked={elegido}
              onChange={() => void cambiarAjusteTemaMapa(a)}
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                opacity: 0,
              }}
            />
            {nombreAjusteTemaMapa(idioma, a)}
          </label>
        );
      })}
    </div>
  );
}

/**
 * Mapa de Google: un botón «Ver en el mapa» y, al tocarlo, se carga Google Maps y se dibujan los
 * puntos (círculos con borde blanco), las líneas y las áreas. Con `abierto` (pantallas de viaje o
 * entrega en curso) se abre solo; con `inclinado`, vista de 45° girada hacia `rumbo` (solo con Map
 * ID: el mapa vectorial). `alTocarMapa` recibe el punto tocado (para elegir la entrega). Una sola
 * pieza para el panel y las apps en la web.
 * C-MAPA-LLEGADA: con `llegada` (el móvil está a menos de 200 m del destino, `vistaDeLlegada`) el
 * mapa deja de encuadrar el recorrido y muestra la casa y el repartidor juntos, de cerca. La cámara
 * se mueve solo cuando cambia `llegada.clave` (al entrar al radio y en cada escalón de zoom).
 * C-MAPA-DIA-NOCHE: de día o de noche según `useTemaMapa` (automático, claro u oscuro); con
 * `conAjuste`, debajo del mapa va el ajuste de tres posiciones.
 * C-MAPA-ABRE-DONDE-ESTAS: sin puntos dibujados, si `centro` cambia (llegó el GPS de la persona) el
 * mapa se mueve ahí.
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
  llegada = null,
  conAjuste = false,
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
  llegada?: VistaMapa | null;
  /** Muestra el ajuste de colores del mapa (el panel; en las apps va en la cuenta). */
  conAjuste?: boolean;
}) {
  const t = TEXTOS[idioma === 'es' ? 'es' : 'en'];
  // Abierto si la pantalla es de viaje o entrega en curso, o si la persona tocó «Ver en el mapa».
  const [tocado, setTocado] = useState(false);
  const abierto = abiertoInicial || tocado;
  const [estado, setEstado] = useState<'' | 'cargando' | 'error' | 'listo'>('');
  // Cuenta cada mapa creado: al rehacerse (de día a noche) hay que volver a dibujar todo, aunque
  // el estado pase de «listo» a «listo» en el mismo instante.
  const [creado, setCreado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const api = useRef<GoogleMapsApi | null>(null);
  const mapa = useRef<MapaG | null>(null);
  const dibujados = useRef<Quitable[]>([]);
  const marcasPorId = useRef(new Map<string, Quitable>());
  const fijaDibujada = useRef<string | null>(null);
  const llegadaAplicada = useRef('');
  const centroAplicado = useRef('');
  const vectorial = mapIdValido(mapId);
  const tema = useTemaMapa(centro);
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
          opcionesMapaGoogle({ centro, zoom, mapId, inclinado, rumbo, tema }),
        );
        m.addListener('click', (e) => {
          if (e.latLng) alTocar.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        mapa.current = m;
        centroAplicado.current = `${centro.lat},${centro.lng},${zoom}`;
        setEstado('listo');
        setCreado((n) => n + 1);
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
      llegadaAplicada.current = '';
      centroAplicado.current = '';
      mapa.current = null;
      api.current = null;
    };
    // Se crea una sola vez al abrir; los puntos se redibujan abajo. Al cambiar de día a noche (o al
    // revés) el mapa se rehace: Google solo admite el esquema de color al crearlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tema]);

  const firma = [
    ...puntos.map((p) => `${p.id}:${p.lat},${p.lng}:${p.color}:${p.texto ?? ''}`),
    ...lineas.map((l) => `${l.id}:${l.puntos.map((p) => `${p.lat},${p.lng}`).join(';')}`),
    ...circulos.map((c) => `${c.id}:${c.centro.lat},${c.centro.lng}:${c.metros}`),
    `r${Math.round(rumbo)}`,
    `l${claveDeLlegada(llegada)}`,
    puntos.map((p) => (p.isotipo ? `i${p.apagado ? 'a' : ''}` : '')).join(''),
  ].join('|');
  useEffect(() => {
    const g = api.current;
    const m = mapa.current;
    if (estado !== 'listo' || !g || !m) return;
    const enViaje = inclinado && vectorial;
    const fija = firmaFija(puntos, lineas, circulos);
    const claveLlegada = claveDeLlegada(llegada);
    const cambioLlegada = claveLlegada !== llegadaAplicada.current;
    llegadaAplicada.current = claveLlegada;
    if (fija === fijaDibujada.current) {
      // Solo cambiaron posiciones (GPS): se mueven las marcas. En viaje no se vuelve a encuadrar
      // (aplanaría el mapa): solo se corrige el rumbo. Fuera de viaje, se encuadra como siempre.
      for (const p of puntos) marcasPorId.current.get(p.id)?.mover?.(p);
      // C-MAPA-LLEGADA: al entrar o salir de los 200 m, y en cada escalón de zoom, se mueve la
      // cámara UNA vez; entre escalones las lecturas no la tocan (se puede mover el mapa con el dedo).
      if (cambioLlegada) encuadrar(g, m, puntos, zoom, enViaje, rumbo, llegada);
      else if (llegada) {
        if (enViaje) m.setHeading?.(rumbo);
      } else if (enViaje) m.setHeading?.(rumbo);
      else encuadrar(g, m, puntos, zoom, false, rumbo);
      return;
    }
    // Cambió qué se dibuja (por ejemplo, el destino pasa del restaurante a la casa): se redibuja
    // y se encuadra una vez.
    const r = dibujarTodo(
      g,
      m,
      { puntos, lineas, circulos, zoom, avanzadas: vectorial, inclinado: enViaje, rumbo, llegada },
      dibujados.current,
    );
    dibujados.current = r.todos;
    marcasPorId.current = r.marcas;
    fijaDibujada.current = fija;
    // Se redibuja cuando el mapa queda listo (o se rehace) o cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, estado, creado]);

  // C-MAPA-ABRE-DONDE-ESTAS: sin nada dibujado (elegir un punto), el mapa sigue al centro que le
  // pasan: cuando llega la ubicación de la persona, se mueve ahí.
  useEffect(() => {
    const m = mapa.current;
    if (estado !== 'listo' || !m || puntos.length > 0) return;
    const clave = `${centro.lat},${centro.lng},${zoom}`;
    if (clave === centroAplicado.current) return;
    centroAplicado.current = clave;
    m.setCenter(centro);
    m.setZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro.lat, centro.lng, zoom, estado, creado, puntos.length]);

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
        // De día a noche el mapa se rehace sobre una caja nueva.
        key={tema}
        ref={caja}
        data-tema={tema}
        role="application"
        aria-label={etiqueta}
        data-testid="mapa-google"
        style={{
          // Con la llave rechazada no se deja el mapa gris: solo el mensaje.
          display: estado === 'error' ? 'none' : 'block',
          height: alto,
          borderRadius: 16,
          overflow: 'hidden',
          background: fondoMapaDe(tema),
        }}
      />
      {estado === 'cargando' ? <p role="status">{t.cargando}</p> : null}
      {estado === 'error' ? <p role="alert">{t.error}</p> : null}
      {conAjuste && estado !== 'error' ? <AjusteTemaMapaWeb idioma={idioma} /> : null}
    </div>
  );
}
