import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { COLORES, type Punto, crearMapa, punto } from '../piezas/mapaWeb';
import { COLOR_TONO, type PuntoRuta } from './colorTono';
import { MapaGoogleBajoDemanda, rumboEntre } from '@tumbite/compartido/src/mapaWebGoogle';
import { origenesMapaRutaFlex } from '@tumbite/compartido/src/mapaDriverWeb';
import { rotuloDestino, vistaDeLlegada } from '@tumbite/compartido/src/mapaLlegada';
import { useSesion } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, MAP_ID_MAPA_WEB, proveedorMapaWeb } from './mapaGoogleWeb';

export type { PuntoRuta };

/**
 * Mapa de la ruta Flex en la versión web (el mismo Leaflet con OpenStreetMap de la app): el centro
 * y las paradas con su número, unidos en orden con una línea punteada (orden de visita, no calles).
 */
type PropsRuta = Parameters<typeof MapaRutaLeaflet>[0];

/**
 * C-MAPA-GOOGLE-WEB (14 nov 2026): con la llave del navegador, el mapa de Google. Es la ruta en
 * curso: se abre solo y, con Map ID, va inclinado a 45° mirando hacia la parada actual. Cada parada
 * con su color de estado y su número dentro de la marca, la línea punteada del orden y el círculo
 * del área de entrega, igual que en Leaflet. Sin llave, Leaflet como siempre.
 */
export function MapaRuta(props: PropsRuta) {
  return proveedorMapaWeb(origenesMapaRutaFlex({ paradas: props.puntos.length, yo: props.yo })) ===
    'google' ? (
    <MapaRutaGoogle {...props} />
  ) : (
    <MapaRutaLeaflet {...props} />
  );
}

function MapaRutaGoogle({ puntos, yo, alto = 380, etiqueta, area = null }: PropsRuta) {
  const { idioma } = useSesion();
  const centro = puntos[0]?.punto ?? yo;
  if (!centro) return null;
  const parada = puntos.find((p) => p.tono === 'actual') ?? null;
  const actual = parada?.punto ?? area?.punto ?? null;
  // C-MAPA-LLEGADA: a menos de 200 m de la parada actual el mapa se acerca solo y la parada muestra,
  // junto a su número, el número de la dirección.
  const llegada = vistaDeLlegada(yo, actual);
  const rotulo = llegada ? rotuloDestino(parada?.direccion) : '';
  const numero = (p: PuntoRuta) => p.numero.replace(/[^0-9A-Za-z]/g, '');
  return (
    <MapaGoogleBajoDemanda
      llave={LLAVE_MAPA_WEB}
      mapId={MAP_ID_MAPA_WEB}
      idioma={idioma}
      centro={centro}
      alto={alto}
      etiqueta={etiqueta}
      abierto
      inclinado
      rumbo={yo && actual ? rumboEntre(yo, actual) : 0}
      llegada={llegada}
      lineas={
        puntos.length > 1
          ? [{ id: 'orden', puntos: puntos.map((p) => p.punto), color: '#8E9198', punteada: true }]
          : []
      }
      circulos={
        area ? [{ id: 'area', centro: area.punto, metros: area.metros, color: '#4AA5DC' }] : []
      }
      puntos={[
        ...puntos.map((p) => ({
          id: p.id,
          ...p.punto,
          color: COLOR_TONO[p.tono],
          radio: 15,
          texto: p === parada && rotulo ? `${numero(p)} · ${rotulo}` : numero(p),
          etiqueta: `${p.numero} · ${p.nombre}`,
        })),
        ...(yo ? [{ id: 'yo', ...yo, color: COLORES.repartidor, radio: 9 }] : []),
      ]}
    />
  );
}

function MapaRutaLeaflet({
  puntos,
  yo,
  alto = 380,
  etiqueta,
  area = null,
}: {
  puntos: PuntoRuta[];
  yo: Punto | null;
  alto?: number;
  etiqueta: string;
  /** C-FLEX-GEOCERCA: el círculo del área de entrega de la parada actual. */
  area?: { punto: Punto; metros: number } | null;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<L.Layer[]>([]);
  const todos = [...puntos.map((p) => p.punto), ...(yo ? [yo] : [])];
  const clave = [
    ...puntos.map((p) => `${p.id}:${p.tono}:${p.punto.lat},${p.punto.lng}`),
    yo ? `${yo.lat},${yo.lng}` : '',
    area ? `${area.punto.lat},${area.punto.lng},${area.metros}` : '',
  ].join('|');

  useEffect(() => {
    // C-MAPA-ABRE-DONDE-ESTAS: la ruta siempre trae puntos; sin ninguno no hay mapa.
    if (!caja.current || mapa.current || !todos[0]) return;
    mapa.current = crearMapa(caja.current, todos[0], 13);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // Se crea una sola vez; los puntos se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const c of capas.current) c.remove();
    const nuevas: L.Layer[] = [];
    if (puntos.length > 1)
      nuevas.push(
        L.polyline(
          puntos.map((p) => [p.punto.lat, p.punto.lng] as [number, number]),
          { color: '#8E9198', weight: 3, dashArray: '8 6' },
        ),
      );
    for (const p of puntos) {
      const icono = L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="min-width:30px;height:30px;padding:0 6px;box-sizing:border-box;border-radius:15px;background:${COLOR_TONO[p.tono]};border:2px solid #fff;color:#fff;font:800 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25)">${p.numero.replace(/[^0-9A-Za-z]/g, '')}</div>`,
      });
      nuevas.push(L.marker([p.punto.lat, p.punto.lng], { icon: icono, title: p.nombre }));
    }
    if (area)
      nuevas.push(
        L.circle([area.punto.lat, area.punto.lng], {
          radius: area.metros,
          color: '#4AA5DC',
          weight: 2,
          fillColor: '#4AA5DC',
          fillOpacity: 0.18,
        }),
      );
    if (yo) nuevas.push(punto(yo, COLORES.repartidor, 9));
    for (const c of nuevas) c.addTo(m);
    capas.current = nuevas;
    const llegada = vistaDeLlegada(yo, puntos.find((p) => p.tono === 'actual')?.punto);
    if (llegada) m.setView([llegada.centro.lat, llegada.centro.lng], llegada.zoom);
    else if (todos.length > 1)
      m.fitBounds(
        todos.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 16 },
      );
    else if (todos[0]) m.setView([todos[0].lat, todos[0].lng], 15);
    // Se redibuja cuando cambia algún punto o su estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return (
    <div
      ref={caja}
      style={{
        height: alto,
        width: '100%',
        overflow: 'hidden',
        borderRadius: 14,
        background: '#E9EEF5',
      }}
      aria-label={etiqueta}
    />
  );
}
