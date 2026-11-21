import { useEffect, useRef, useState } from 'react';
import type { Idioma, Poligono } from '@tumbite/compartido';
import { PAISES_CON_TERRITORIO_OFICIAL, enIdioma } from '@tumbite/compartido';
import {
  type GoogleMapsApi,
  type MapaG,
  alRechazarLlaveGoogle,
  cargarGoogleMaps,
  elegirMapaWeb,
  AjusteTemaMapaWeb,
  opcionesMapaGoogle,
} from '@tumbite/compartido/src/mapaWebGoogle';
import { seguirTemaEnLeaflet, useTemaMapa } from '@tumbite/compartido/src/temaMapa';

/**
 * Dibujo de un área de cobertura sobre el mapa (C-TERRITORIO). Cada clic agrega un punto; los
 * puntos se arrastran para ajustar el borde. Las otras áreas de la ciudad se ven en gris para no
 * pisarlas (la regla de verdad la aplica el servidor al guardar).
 * El mapa se carga solo aquí, cuando el superadmin abre el editor: el resto del sitio no lo paga.
 *
 * C-MAPA-GOOGLE-WEB (14 nov 2026): con la llave del navegador, sobre el mapa de Google (plano, con el
 * estilo de Divoox). No usa la biblioteca Drawing de Google (retirada en mayo de 2026): el área es
 * un Polygon normal y cada esquina una marca que se arrastra. Sin llave, Leaflet como siempre.
 */
const T = {
  es: {
    ayuda: 'Toca el mapa para marcar cada esquina del área. Arrastra un punto para moverlo.',
    deshacer: 'Quitar el último punto',
    borrar: 'Empezar de nuevo',
    puntos: 'puntos',
    error: 'No pudimos abrir el mapa.',
  },
  en: {
    ayuda: 'Tap the map to mark each corner of the area. Drag a point to move it.',
    deshacer: 'Remove last point',
    borrar: 'Start over',
    puntos: 'points',
    error: 'We couldn’t open the map.',
  },
};

export type OtraArea = { id: string; nombre: string; poligono: Poligono };

type PropsEditor = {
  centro: { lat: number; lng: number };
  /** C-TERRITORIO-OFICIAL: el país de la ciudad; si tiene su división oficial, se ven los municipios. */
  pais?: string;
  poligono: Poligono;
  otras: OtraArea[];
  cambiar: (p: Poligono) => void;
  idioma: Idioma;
};

/**
 * C-TERRITORIO-OFICIAL (21 nov 2026): los límites oficiales de los municipios del país de la ciudad
 * (INE vía OCHA en Venezuela), como base del mapa para dibujar áreas. Un archivo estático del sitio,
 * que se pide solo al abrir el editor. null si el país no tiene su división cargada o no se pudo leer.
 */
export function useMunicipios(pais: string | undefined): unknown {
  const [datos, setDatos] = useState<unknown>(null);
  useEffect(() => {
    const iso = (pais ?? '').toUpperCase();
    if (!PAISES_CON_TERRITORIO_OFICIAL.includes(iso)) return;
    let vivo = true;
    fetch(`/territorio/${iso}/municipios.json`)
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((d) => {
        if (vivo && d) setDatos(d);
      })
      .catch(() => {
        // Sin la capa de municipios el mapa sigue sirviendo igual.
      });
    return () => {
      vivo = false;
    };
  }, [pais]);
  return datos;
}

const ESTILO_MUNICIPIOS = { color: '#666B73', weight: 1, dashArray: '4 4', fill: false };

export function EditorArea(props: PropsEditor) {
  const llave = (import.meta.env.VITE_GOOGLE_MAPS_WEB_KEY as string | undefined) ?? '';
  const mapId = (import.meta.env.VITE_GOOGLE_MAPS_WEB_MAP_ID as string | undefined) ?? '';
  return elegirMapaWeb({ llave }) === 'google' ? (
    <EditorAreaGoogle {...props} llave={llave} mapId={mapId} />
  ) : (
    <EditorAreaLeaflet {...props} />
  );
}

type Quitable = { setMap(m: MapaG | null): void };

function EditorAreaGoogle({
  centro,
  poligono,
  otras,
  cambiar,
  idioma,
  llave,
  mapId,
  pais,
}: PropsEditor & { llave: string; mapId: string }) {
  const municipios = useMunicipios(pais);
  const t = enIdioma(T, idioma);
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaG | null>(null);
  const api = useRef<GoogleMapsApi | null>(null);
  const dibujados = useRef<Quitable[]>([]);
  const actual = useRef(poligono);
  const alCambiar = useRef(cambiar);
  useEffect(() => {
    actual.current = poligono;
    alCambiar.current = cambiar;
  }, [poligono, cambiar]);
  // Cuenta cada mapa creado (0 = todavía ninguno): al rehacerse, el área se vuelve a dibujar.
  const [listo, setListo] = useState(0);
  const [error, setError] = useState(false);
  // C-MAPA-DIA-NOCHE: de día o de noche, como todos los mapas (automático, claro u oscuro).
  const tema = useTemaMapa(centro);

  // El mapa se crea una vez (y se rehace al pasar de día a noche: Google solo admite el esquema de
  // color al crear el mapa).
  useEffect(() => {
    let vivo = true;
    const dejar = alRechazarLlaveGoogle(() => vivo && setError(true));
    cargarGoogleMaps(llave, idioma === 'es' ? 'es' : 'en')
      .then((g) => {
        if (!vivo || !caja.current) return;
        api.current = g;
        const m = new g.Map(caja.current, opcionesMapaGoogle({ centro, zoom: 11, mapId, tema }));
        m.addListener('click', (e) => {
          if (e.latLng) alCambiar.current([...actual.current, [e.latLng.lng(), e.latLng.lat()]]);
        });
        mapa.current = m;
        setListo((n) => n + 1);
      })
      .catch((e: unknown) => {
        console.error('No se pudo abrir el mapa de Google en el editor de áreas:', e);
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
      dejar();
      for (const x of dibujados.current) x.setMap(null);
      dibujados.current = [];
      mapa.current = null;
      api.current = null;
    };
    // El centro solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema]);

  // Los límites oficiales de los municipios, finos y punteados, debajo de todo (no se tocan).
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m?.data || !municipios) return;
    m.data.addGeoJson(municipios);
    m.data.setStyle({
      strokeColor: ESTILO_MUNICIPIOS.color,
      strokeWeight: ESTILO_MUNICIPIOS.weight,
      strokeOpacity: 0.7,
      fillOpacity: 0,
      clickable: false,
    });
  }, [listo, municipios]);

  useEffect(() => {
    const g = api.current;
    const m = mapa.current;
    if (!listo || !g || !m || !g.Polygon) return;
    for (const x of dibujados.current) x.setMap(null);
    const nuevos: Quitable[] = [];
    const aGoogle = (p: Poligono) => p.map(([lng, lat]) => ({ lat, lng }));
    for (const o of otras)
      nuevos.push(
        new g.Polygon({
          map: m,
          paths: aGoogle(o.poligono),
          strokeColor: '#6b6b6b',
          strokeWeight: 1,
          fillColor: '#6b6b6b',
          fillOpacity: 0.15,
          clickable: false,
        }),
      );
    if (poligono.length >= 2)
      nuevos.push(
        new g.Polygon({
          map: m,
          paths: aGoogle(poligono),
          strokeColor: '#F20D20',
          strokeWeight: 2,
          fillColor: '#F20D20',
          fillOpacity: 0.2,
          clickable: false,
        }),
      );
    poligono.forEach(([lng, lat], i) => {
      const esquina = new g.Marker({
        map: m,
        position: { lat, lng },
        draggable: true,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: '#101010',
          strokeWeight: 2,
        },
      });
      // Arrastrar: al soltar, la esquina queda donde se dejó.
      esquina.addListener('dragend', ((e: { latLng?: { lat(): number; lng(): number } }) => {
        const p = e?.latLng;
        if (!p) return;
        alCambiar.current(
          actual.current.map((v, j): [number, number] => (j === i ? [p.lng(), p.lat()] : v)),
        );
      }) as () => void);
      nuevos.push(esquina);
    });
    dibujados.current = nuevos;
  }, [listo, poligono, otras]);

  return (
    <div className="editor-area">
      <p className="pista">{t.ayuda}</p>
      <div
        key={tema}
        ref={caja}
        className="editor-area-mapa"
        role="application"
        aria-label={t.ayuda}
      />
      {error ? <p role="alert">{t.error}</p> : <AjusteTemaMapaWeb idioma={idioma} />}
      <Botones t={t} poligono={poligono} cambiar={cambiar} />
    </div>
  );
}

function Botones({
  t,
  poligono,
  cambiar,
}: {
  t: (typeof T)['es'];
  poligono: Poligono;
  cambiar: (p: Poligono) => void;
}) {
  return (
    <div className="fila-botones">
      <span>
        {poligono.length} {t.puntos}
      </span>
      <button
        type="button"
        className="boton secundario"
        disabled={!poligono.length}
        onClick={() => cambiar(poligono.slice(0, -1))}
      >
        {t.deshacer}
      </button>
      <button
        type="button"
        className="boton secundario"
        disabled={!poligono.length}
        onClick={() => cambiar([])}
      >
        {t.borrar}
      </button>
    </div>
  );
}

function EditorAreaLeaflet({ centro, poligono, otras, cambiar, idioma, pais }: PropsEditor) {
  const t = enIdioma(T, idioma);
  const municipios = useMunicipios(pais);
  const [mapaListo, setMapaListo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const capa = useRef<import('leaflet').LayerGroup | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);
  const actual = useRef(poligono);
  actual.current = poligono;
  const alCambiar = useRef(cambiar);
  alCambiar.current = cambiar;

  // El mapa se crea una vez.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !caja.current) return;
      L.current = leaflet;
      const m = leaflet.map(caja.current).setView([centro.lat, centro.lng], 11);
      leaflet
        .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap',
        })
        .addTo(m);
      m.on('click', (e: import('leaflet').LeafletMouseEvent) =>
        alCambiar.current([...actual.current, [e.latlng.lng, e.latlng.lat]]),
      );
      m.on('unload', seguirTemaEnLeaflet(m, centro));
      mapa.current = m;
      capa.current = leaflet.layerGroup().addTo(m);
      pintar();
      setMapaListo(true);
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // El centro solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // C-TERRITORIO-OFICIAL: los límites oficiales de los municipios, finos y punteados, sin tocarse.
  useEffect(() => {
    const leaflet = L.current;
    const m = mapa.current;
    if (!mapaListo || !leaflet || !m || !municipios) return;
    const capaMunicipios = leaflet
      .geoJSON(municipios as Parameters<typeof leaflet.geoJSON>[0], {
        style: ESTILO_MUNICIPIOS,
        interactive: false,
      })
      .addTo(m);
    capaMunicipios.bringToBack();
    return () => {
      capaMunicipios.remove();
    };
  }, [mapaListo, municipios]);

  function pintar() {
    const leaflet = L.current;
    const g = capa.current;
    if (!leaflet || !g) return;
    g.clearLayers();
    for (const o of otras)
      leaflet
        .polygon(
          o.poligono.map(([lng, lat]) => [lat, lng] as [number, number]),
          { color: '#6b6b6b', weight: 1, fillOpacity: 0.15 },
        )
        .bindTooltip(o.nombre)
        .addTo(g);
    const puntos = actual.current.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (puntos.length >= 2)
      leaflet.polygon(puntos, { color: '#F20D20', weight: 2, fillOpacity: 0.2 }).addTo(g);
    actual.current.forEach(([lng, lat], i) => {
      const marca = leaflet
        .circleMarker([lat, lng], {
          radius: 6,
          color: '#101010',
          fillColor: '#FFFFFF',
          fillOpacity: 1,
        })
        .addTo(g);
      // Arrastrar: se mueve el punto mientras el mouse sigue apretado.
      marca.on('mousedown', () => {
        const m = mapa.current;
        if (!m) return;
        m.dragging.disable();
        const mover = (e: import('leaflet').LeafletMouseEvent) => {
          alCambiar.current(
            actual.current.map((v, j): [number, number] =>
              j === i ? [e.latlng.lng, e.latlng.lat] : v,
            ),
          );
        };
        m.on('mousemove', mover);
        m.once('mouseup', () => {
          m.off('mousemove', mover);
          m.dragging.enable();
        });
      });
    });
  }

  useEffect(pintar, [poligono, otras]);

  return (
    <div className="editor-area">
      <p className="pista">{t.ayuda}</p>
      <div ref={caja} className="editor-area-mapa" role="application" aria-label={t.ayuda} />
      <Botones t={t} poligono={poligono} cambiar={cambiar} />
    </div>
  );
}
