import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { COLORES, type Punto, type ZonaDemanda, crearMapa, isotipo, punto, zona } from './mapaWeb';
import { MapaGoogleBajoDemanda, rumboEntre } from '@tumbite/compartido/src/mapaWebGoogle';
import {
  destinoMapaDriver,
  origenesMapaDriver,
  vistaMapaDriver,
} from '@tumbite/compartido/src/mapaDriverWeb';
import {
  type VistaMapa,
  rotuloDestino,
  useVistaDeLlegada,
  vistaDeLlegada,
} from '@tumbite/compartido/src/mapaLlegada';
import { useSesion } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, MAP_ID_MAPA_WEB, proveedorMapaWeb } from '../flex/mapaGoogleWeb';

/**
 * Mapa del repartidor en la versión web (Leaflet con OpenStreetMap, sin llave): su ubicación con
 * el isotipo de Divoox, los restaurantes cercanos, el restaurante del pedido y la casa con la ruta. Con
 * `zonasDemanda`, las zonas con más pedidos ahora (C-MAPA-DEMANDA), debajo de todo lo demás.
 */
type PropsMapa = Parameters<typeof MapaLeaflet>[0];

/**
 * C-MAPA-GOOGLE-WEB (14 nov 2026): con la llave del navegador el mapa es SIEMPRE el de Google. Con un
 * pedido activo (restaurante o casa) se abre solo y, con Map ID, va inclinado a 45° mirando hacia el
 * destino; sin pedido, plano y con el botón «Ver en el mapa». Las zonas con más pedidos se dibujan
 * como áreas rojas translúcidas, y la del pago extra lleva el monto a la vista. Sin llave, Leaflet.
 */
export function Mapa(props: PropsMapa) {
  return proveedorMapaWeb(origenesMapaDriver(props)) === 'google' ? (
    <MapaGoogle {...props} />
  ) : (
    <MapaLeaflet {...props} />
  );
}

function MapaGoogle({
  yo,
  restaurante,
  casa,
  marcadores = [],
  zonasDemanda = [],
  etiquetaZona = (n: number) => String(n),
  alto = 300,
  etiquetas,
  direccionDestino,
}: PropsMapa) {
  const { idioma } = useSesion();
  const centro = yo ?? restaurante ?? casa ?? marcadores[0]?.punto ?? zonasDemanda[0];
  const viaje = vistaMapaDriver({ restaurante, casa }) === 'viaje';
  const destino = destinoMapaDriver({ restaurante, casa });
  // C-MAPA-LLEGADA: a menos de 200 m del destino (el local o la casa) el mapa se acerca solo y el
  // punto muestra el número de la dirección.
  const llegada = useVistaDeLlegada(yo, viaje ? destino : null);
  if (!centro) return null;
  const rotulo = llegada ? rotuloDestino(direccionDestino) : '';
  const vaALaCasa = casa != null;
  const puntos = [
    // C-PAGO-PICO: el monto extra queda a la vista sobre la zona (como el «+$2.00» de DoorDash).
    ...zonasDemanda
      .filter((z) => z.pico)
      .map((z, i) => ({
        id: `pico-${i}`,
        lat: z.lat,
        lng: z.lng,
        color: '#F20D20',
        radio: 12,
        texto: etiquetaZona(z.pedidos, z.pico),
        etiqueta: etiquetaZona(z.pedidos, z.pico),
      })),
    ...marcadores.map((x) => ({
      id: `m-${x.id}`,
      ...x.punto,
      color: COLORES.restaurante,
      radio: 8,
      etiqueta: x.nombre,
    })),
    ...(restaurante
      ? [
          {
            id: 'restaurante',
            ...restaurante,
            color: COLORES.restaurante,
            radio: llegada && !vaALaCasa ? 13 : 9,
            etiqueta: etiquetas.restaurante,
            texto: (!vaALaCasa && rotulo) || undefined,
          },
        ]
      : []),
    ...(casa
      ? [
          {
            id: 'casa',
            ...casa,
            color: COLORES.casa,
            radio: llegada ? 13 : 9,
            etiqueta: etiquetas.casa,
            texto: rotulo || undefined,
          },
        ]
      : []),
    ...(yo
      ? [
          {
            id: 'yo',
            ...yo,
            color: COLORES.repartidor,
            radio: 12,
            // C-MAPA-ISOTIPO: el conductor es el isotipo de Divoox.
            isotipo: true,
            etiqueta: etiquetas.yo,
          },
        ]
      : []),
  ];
  return (
    <MapaGoogleBajoDemanda
      llave={LLAVE_MAPA_WEB}
      mapId={MAP_ID_MAPA_WEB}
      idioma={idioma}
      centro={centro}
      puntos={puntos}
      circulos={zonasDemanda.map((z, i) => ({
        id: `zona-${i}`,
        centro: { lat: z.lat, lng: z.lng },
        metros: 600,
        color: '#F20D20',
        opacidad: z.nivel === 'alta' ? 0.35 : 0.18,
      }))}
      alto={alto}
      etiqueta={etiquetas.yo}
      abierto={viaje}
      inclinado={viaje}
      rumbo={viaje && yo && destino ? rumboEntre(yo, destino) : 0}
      llegada={llegada}
    />
  );
}

function MapaLeaflet({
  yo,
  restaurante,
  casa,
  marcadores = [],
  zonasDemanda = [],
  etiquetaZona = (n: number) => String(n),
  alto = 300,
  etiquetas,
  direccionDestino,
}: {
  yo: Punto | null;
  restaurante?: Punto | null;
  casa?: Punto | null;
  marcadores?: { id: string; punto: Punto; nombre: string }[];
  zonasDemanda?: ZonaDemanda[];
  etiquetaZona?: (pedidos: number, pico?: number) => string;
  alto?: number;
  etiquetas: { yo: string; restaurante: string; casa: string };
  /** La dirección del destino de ahora (el local o la casa): su número se lee al llegar. */
  direccionDestino?: string | null;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<L.Layer[]>([]);
  const vistaCerca = useRef<VistaMapa | null>(null);
  // C-MAPA-ABRE-DONDE-ESTAS: sin ningún punto todavía no hay mapa (nunca una ciudad fija).
  const centro = yo ?? restaurante ?? casa ?? marcadores[0]?.punto ?? zonasDemanda[0] ?? null;
  const hayCentro = centro != null;
  const firmaZonas = zonasDemanda.map((z) => `${z.lat},${z.lng},${z.pedidos}`).join('|');

  useEffect(() => {
    if (!caja.current || mapa.current || !centro) return;
    mapa.current = crearMapa(caja.current, centro, 14);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // Se crea una sola vez, cuando ya hay un punto; los puntos se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayCentro]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const c of capas.current) c.remove();
    const nuevas: L.Layer[] = [];
    for (const z of zonasDemanda) nuevas.push(zona(z, etiquetaZona(z.pedidos, z.pico)));
    for (const x of marcadores) nuevas.push(punto(x.punto, COLORES.restaurante, 8, x.nombre));
    const destino = casa ?? restaurante ?? null;
    const llegada = vistaDeLlegada(yo, destino, undefined, vistaCerca.current);
    const rotulo = llegada ? rotuloDestino(direccionDestino) : '';
    const conRotulo = (c: L.CircleMarker, es: boolean) => {
      if (es && rotulo) c.bindTooltip(rotulo, { permanent: true, direction: 'top' });
      return c;
    };
    if (restaurante)
      nuevas.push(
        conRotulo(punto(restaurante, COLORES.restaurante, 9, etiquetas.restaurante), !casa),
      );
    if (casa) nuevas.push(conRotulo(punto(casa, COLORES.casa, 9, etiquetas.casa), true));
    if (yo) nuevas.push(isotipo(yo, etiquetas.yo));
    for (const c of nuevas) c.addTo(m);
    capas.current = nuevas;
    const todos = [yo, restaurante ?? null, casa ?? null].filter((p): p is Punto => p != null);
    const separados =
      todos.length > 1 &&
      todos.some((p) => Math.abs(p.lat - todos[0]!.lat) + Math.abs(p.lng - todos[0]!.lng) > 0.0005);
    // Estando cerca, la cámara se mueve solo al entrar al radio y en cada escalón de zoom (entre
    // uno y otro se puede mover el mapa con el dedo): casa y repartidor juntos.
    const claveAntes = vistaCerca.current?.clave ?? '';
    vistaCerca.current = llegada;
    if (llegada) {
      if (llegada.clave !== claveAntes)
        m.setView([llegada.centro.lat, llegada.centro.lng], llegada.zoom);
    } else if (separados)
      m.fitBounds(
        todos.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 16 },
      );
    else if (todos[0]) m.setView([todos[0].lat, todos[0].lng], 15);
    // Se redibuja cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    yo?.lat,
    yo?.lng,
    restaurante?.lat,
    restaurante?.lng,
    casa?.lat,
    casa?.lng,
    marcadores.length,
    firmaZonas,
    hayCentro,
  ]);

  return (
    <div
      ref={caja}
      style={{ height: alto, width: '100%', overflow: 'hidden', background: '#E9EEF5' }}
      aria-label={etiquetas.yo}
    />
  );
}
