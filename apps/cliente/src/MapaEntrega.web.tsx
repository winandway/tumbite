import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { COLORES, crearMapa, isotipo, punto } from './mapaWeb';
import type { Punto } from './ubicacion';
import { MapaGoogleBajoDemanda, rumboEntre } from '@tumbite/compartido/src/mapaWebGoogle';
import {
  type VistaMapa,
  rotuloDestino,
  useVistaDeLlegada,
  vistaDeLlegada,
} from '@tumbite/compartido/src/mapaLlegada';
import { useSesion } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, MAP_ID_MAPA_WEB, proveedorMapaWeb } from './mapaGoogleWeb';

/**
 * Mapa en vivo de la entrega en la versión web: restaurante (gris oscuro), tu casa (escarlata)
 * y el repartidor (el isotipo de Divoox, C-MAPA-ISOTIPO) que se mueve con cada actualización.
 */
type Props = {
  restaurante: Punto | null;
  casa: Punto | null;
  repartidor: Punto | null;
  nombreRepartidor?: string;
  etiquetas: { restaurante: string; casa: string; repartidor: string };
  /** La dirección de entrega (o el destino del viaje): su número se lee sobre el punto al llegar. */
  direccion?: string | null;
  /** Hacia dónde va ahora: tu casa (o el destino) o, en un viaje que viene a buscarte, la recogida. */
  meta?: 'casa' | 'restaurante';
  sinSenal?: boolean;
  /** C-VIAJE-PARADAS: las paradas intermedias de un viaje (se pintan numeradas, en gris). */
  paradas?: readonly (Punto & { etiqueta: string })[];
  /** C-MAPA-PRECIO-PEDIR: el alto del mapa (260 de siempre; 160 en el precio antes de pedir). */
  alto?: number;
  /**
   * C-MAPA-GOOGLE-WEB: fuera de un viaje o una entrega en curso, el mapa de Google de la web se carga
   * solo al tocar «Ver en el mapa» (mirar no gasta cargas de mapa).
   */
  bajoDemanda?: boolean;
  /**
   * C-MAPA-VISTA-PREVIA: en el teléfono el mapa pequeño del precio no se toca. En la web ya se carga
   * al tocarlo (`bajoDemanda`), así que aquí no cambia nada.
   */
  vistaPrevia?: boolean;
};

/**
 * C-MAPA-GOOGLE-WEB: con la llave del navegador, el mapa de Google. Es la pantalla de entrega (o
 * viaje) en curso: se abre solo, sin botón, y con Map ID va inclinado a 45° mirando hacia tu casa
 * (desde el repartidor si ya se ve; si no, desde el restaurante), como Uber y DoorDash. Sin llave,
 * Leaflet.
 * C-MAPA-LLEGADA: cuando el repartidor (o conductor) está a menos de 200 m de tu casa, el mapa se
 * acerca solo y deja el punto de la casa centrado, con el número de la dirección a la vista.
 */
/** C-VIAJE-PARADAS: las paradas van en gris de apoyo, entre la recogida y el destino. */
const COLOR_PARADA = '#666B73';

export function MapaEntrega(props: Props) {
  return proveedorMapaWeb(['google', 'gps']) === 'google' ? (
    <MapaEntregaGoogle {...props} />
  ) : (
    <MapaEntregaLeaflet {...props} />
  );
}

function MapaEntregaGoogle({
  restaurante,
  casa,
  repartidor,
  nombreRepartidor,
  etiquetas,
  direccion,
  meta = 'casa',
  sinSenal = false,
  paradas = [],
  alto = 260,
  bajoDemanda = false,
}: Props) {
  const { idioma } = useSesion();
  const hacia = meta === 'restaurante' ? restaurante : casa;
  const llegada = useVistaDeLlegada(repartidor, hacia);
  const rotulo = llegada ? rotuloDestino(direccion) : '';
  const centro = repartidor ?? restaurante ?? casa;
  if (!centro) return null;
  const puntos = [
    restaurante && {
      id: 'restaurante',
      ...restaurante,
      color: COLORES.restaurante,
      radio: llegada && meta === 'restaurante' ? 13 : 9,
      etiqueta: etiquetas.restaurante,
      texto: (meta === 'restaurante' && rotulo) || undefined,
    },
    casa && {
      id: 'casa',
      ...casa,
      color: COLORES.casa,
      radio: llegada && meta === 'casa' ? 13 : 8,
      etiqueta: etiquetas.casa,
      texto: (meta === 'casa' && rotulo) || undefined,
    },
    ...paradas.map((p, i) => ({
      id: `parada-${i + 1}`,
      lat: p.lat,
      lng: p.lng,
      color: COLOR_PARADA,
      radio: 10,
      etiqueta: p.etiqueta,
      texto: String(i + 1),
    })),
    repartidor && {
      id: 'repartidor',
      ...repartidor,
      color: COLORES.repartidor,
      radio: 12,
      isotipo: true,
      // C-SEGUIMIENTO-HONESTO: sin señal reciente, la marca se ve apagada.
      apagado: sinSenal,
      etiqueta: nombreRepartidor ?? etiquetas.repartidor,
    },
  ].filter((p) => p != null);
  const desde = meta === 'restaurante' ? repartidor : (repartidor ?? restaurante);
  return (
    <MapaGoogleBajoDemanda
      llave={LLAVE_MAPA_WEB}
      mapId={MAP_ID_MAPA_WEB}
      idioma={idioma}
      centro={centro}
      puntos={puntos}
      etiqueta={etiquetas.repartidor}
      abierto={!bajoDemanda}
      alto={alto}
      inclinado
      rumbo={desde && hacia ? rumboEntre(desde, hacia) : 0}
      llegada={llegada}
    />
  );
}

function MapaEntregaLeaflet({
  restaurante,
  casa,
  repartidor,
  nombreRepartidor,
  etiquetas,
  direccion,
  meta = 'casa',
  sinSenal = false,
  paradas = [],
  alto = 260,
}: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const claveParadas = paradas.map((p) => `${p.lat},${p.lng}`).join('|');
  const capas = useRef<L.Layer[]>([]);
  const vistaCerca = useRef<VistaMapa | null>(null);
  const centro = repartidor ?? restaurante ?? casa;

  useEffect(() => {
    if (!caja.current || mapa.current || !centro) return;
    mapa.current = crearMapa(caja.current, centro);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // Se crea una sola vez; los puntos se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(centro)]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const c of capas.current) c.remove();
    const nuevas: L.Layer[] = [];
    const llegada = vistaDeLlegada(
      repartidor,
      meta === 'restaurante' ? restaurante : casa,
      undefined,
      vistaCerca.current,
    );
    const rotulo = llegada ? rotuloDestino(direccion) : '';
    const conRotulo = (c: L.CircleMarker, es: boolean) => {
      if (es && rotulo) c.bindTooltip(rotulo, { permanent: true, direction: 'top' });
      return c;
    };
    if (restaurante)
      nuevas.push(
        conRotulo(
          punto(restaurante, COLORES.restaurante, 9, etiquetas.restaurante),
          meta === 'restaurante',
        ),
      );
    if (casa) nuevas.push(conRotulo(punto(casa, COLORES.casa, 8, etiquetas.casa), meta === 'casa'));
    for (const p of paradas) nuevas.push(punto(p, COLOR_PARADA, 7, p.etiqueta));
    if (repartidor)
      nuevas.push(isotipo(repartidor, nombreRepartidor ?? etiquetas.repartidor, sinSenal));
    for (const c of nuevas) c.addTo(m);
    capas.current = nuevas;
    const todos = [restaurante, casa, repartidor].filter((p): p is Punto => p != null);
    // Estando cerca, la cámara se mueve solo al entrar al radio y en cada escalón de zoom (entre
    // uno y otro se puede mover el mapa con el dedo): casa y repartidor juntos.
    const claveAntes = vistaCerca.current?.clave ?? '';
    vistaCerca.current = llegada;
    if (llegada) {
      if (llegada.clave !== claveAntes)
        m.setView([llegada.centro.lat, llegada.centro.lng], llegada.zoom);
    } else if (todos.length > 1)
      m.fitBounds(
        todos.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 17 },
      );
    else if (todos[0]) m.setView([todos[0].lat, todos[0].lng], 16);
    // Se redibuja cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restaurante?.lat,
    restaurante?.lng,
    casa?.lat,
    casa?.lng,
    repartidor?.lat,
    repartidor?.lng,
    sinSenal,
    claveParadas,
  ]);

  if (!centro) return null;
  return (
    <div
      ref={caja}
      role="img"
      aria-label={etiquetas.repartidor}
      style={{ height: alto, borderRadius: 16, overflow: 'hidden', marginBottom: 12, zIndex: 0 }}
    />
  );
}
