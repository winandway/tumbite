import { useEffect, useRef } from 'react';
import type { Idioma, Poligono } from '@tumbite/compartido';
import { enIdioma } from '@tumbite/compartido';

/**
 * Dibujo de un área de cobertura sobre el mapa (C-TERRITORIO). Cada clic agrega un punto; los
 * puntos se arrastran para ajustar el borde. Las otras áreas de la ciudad se ven en gris para no
 * pisarlas (la regla de verdad la aplica el servidor al guardar).
 * Leaflet se carga solo aquí, cuando el superadmin abre el editor: el resto del sitio no lo paga.
 */
const T = {
  es: {
    ayuda: 'Toca el mapa para marcar cada esquina del área. Arrastra un punto para moverlo.',
    deshacer: 'Quitar el último punto',
    borrar: 'Empezar de nuevo',
    puntos: 'puntos',
  },
  en: {
    ayuda: 'Tap the map to mark each corner of the area. Drag a point to move it.',
    deshacer: 'Remove last point',
    borrar: 'Start over',
    puntos: 'points',
  },
};

export type OtraArea = { id: string; nombre: string; poligono: Poligono };

export function EditorArea({
  centro,
  poligono,
  otras,
  cambiar,
  idioma,
}: {
  centro: { lat: number; lng: number };
  poligono: Poligono;
  otras: OtraArea[];
  cambiar: (p: Poligono) => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
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
      mapa.current = m;
      capa.current = leaflet.layerGroup().addTo(m);
      pintar();
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // El centro solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      leaflet.polygon(puntos, { color: '#FF3008', weight: 2, fillOpacity: 0.2 }).addTo(g);
    actual.current.forEach(([lng, lat], i) => {
      const marca = leaflet
        .circleMarker([lat, lng], {
          radius: 6,
          color: '#191919',
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
    </div>
  );
}
