import { useEffect, useRef, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { api } from '../panel/api';

type Punto = { lat: number; lng: number };

const T = {
  es: {
    ayuda: 'Toca el mapa justo donde se entrega (la puerta de tu casa o tu negocio).',
    miUbicacion: 'Usar mi ubicación actual',
    buscando: 'Buscando tu ubicación…',
    sinPermiso: 'No pudimos leer tu ubicación. Toca el mapa para marcar el punto.',
    buscar: 'Buscar la dirección',
    sinResultados: 'Sin resultados. Marca el punto en el mapa.',
    marcado: 'Punto marcado',
  },
  en: {
    ayuda: 'Tap the map exactly where the delivery goes (your front door or business).',
    miUbicacion: 'Use my current location',
    buscando: 'Finding your location…',
    sinPermiso: 'We couldn’t read your location. Tap the map to mark the spot.',
    buscar: 'Search for the address',
    sinResultados: 'No results. Mark the spot on the map.',
    marcado: 'Spot marked',
  },
};

/**
 * Divoox Flex (todos los países): marcar el punto EXACTO de entrega (C-FLEX-UBICACION). Se toca el
 * mapa, se usa la ubicación del teléfono o, si la búsqueda de Google está encendida, se elige una
 * sugerencia. Lo que manda siempre es el pin: es lo que más se acerca a la puerta en Venezuela.
 */
export function ElegirPunto({
  punto,
  cambiar,
  centro,
  pais,
  idioma,
  alDireccion,
}: {
  punto: Punto | null;
  cambiar: (p: Punto) => void;
  centro: Punto;
  pais: string;
  idioma: Idioma;
  alDireccion?: (texto: string) => void;
}) {
  const t = enIdioma(T, idioma);
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const marca = useRef<import('leaflet').CircleMarker | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);
  const alCambiar = useRef(cambiar);
  useEffect(() => {
    alCambiar.current = cambiar;
  }, [cambiar]);
  const [estadoGps, setEstadoGps] = useState('');
  const [busqueda, setBusqueda] = useState(false);
  const [q, setQ] = useState('');
  const [sugerencias, setSugerencias] = useState<{ id: string; texto: string }[]>([]);
  const [sesion] = useState(
    () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    api
      .pedir<{ busqueda: boolean }>('GET', '/datos/lugares/estado')
      .then((r) => setBusqueda(r.busqueda))
      .catch(() => setBusqueda(false));
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !caja.current) return;
      L.current = leaflet;
      const inicio = punto ?? centro;
      const m = leaflet.map(caja.current).setView([inicio.lat, inicio.lng], punto ? 17 : 12);
      leaflet
        .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        })
        .addTo(m);
      m.on('click', (e: import('leaflet').LeafletMouseEvent) =>
        alCambiar.current({ lat: e.latlng.lat, lng: e.latlng.lng }),
      );
      mapa.current = m;
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // El centro solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El pin sigue al punto elegido.
  useEffect(() => {
    const leaflet = L.current;
    const m = mapa.current;
    if (!leaflet || !m || !punto) return;
    marca.current?.remove();
    marca.current = leaflet
      .circleMarker([punto.lat, punto.lng], {
        radius: 10,
        color: '#101010',
        weight: 3,
        fillColor: '#F20D20',
        fillOpacity: 1,
      })
      .bindTooltip(t.marcado)
      .addTo(m);
    m.setView([punto.lat, punto.lng], Math.max(m.getZoom(), 17));
  }, [punto, t.marcado]);

  function usarGps() {
    if (!('geolocation' in navigator)) return setEstadoGps(t.sinPermiso);
    setEstadoGps(t.buscando);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setEstadoGps('');
        cambiar({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => setEstadoGps(t.sinPermiso),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function buscar(texto: string) {
    setQ(texto);
    if (texto.trim().length < 3) return setSugerencias([]);
    try {
      const r = await api.pedir<{ sugerencias: { id: string; texto: string }[] }>(
        'GET',
        `/datos/lugares/sugerencias?q=${encodeURIComponent(texto)}&pais=${pais}&sesion=${sesion}`,
      );
      setSugerencias(r.sugerencias);
    } catch {
      setSugerencias([]);
    }
  }

  async function elegir(id: string) {
    setSugerencias([]);
    try {
      const r = await api.pedir<{ punto: Punto; direccion: string }>(
        'GET',
        `/datos/lugares/punto/${encodeURIComponent(id)}?sesion=${sesion}`,
      );
      cambiar(r.punto);
      alDireccion?.(r.direccion);
    } catch {
      setEstadoGps(t.sinResultados);
    }
  }

  return (
    <div className="elegir-punto">
      {busqueda && (
        <label className="campo">
          <span>{t.buscar}</span>
          <input value={q} onChange={(e) => void buscar(e.target.value)} autoComplete="off" />
          {sugerencias.length > 0 && (
            <ul className="sugerencias" role="listbox">
              {sugerencias.map((s) => (
                <li key={s.id}>
                  <button type="button" className="enlace" onClick={() => void elegir(s.id)}>
                    {s.texto}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
      )}
      <p className="pista">{t.ayuda}</p>
      <div
        ref={caja}
        role="application"
        aria-label={t.ayuda}
        style={{ height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a2a' }}
      />
      <button type="button" className="boton secundario" onClick={usarGps}>
        {t.miUbicacion}
      </button>
      {estadoGps && <p role="status">{estadoGps}</p>}
    </div>
  );
}
