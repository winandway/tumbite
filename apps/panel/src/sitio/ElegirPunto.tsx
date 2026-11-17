import { useEffect, useRef, useState } from 'react';
import { type Idioma, enIdioma, textosPuntoExacto } from '@tumbite/compartido';
import { api } from '../panel/api';
import {
  MapaGoogleBajoDemanda,
  PinFijoWeb,
  elegirMapaWeb,
} from '@tumbite/compartido/src/mapaWebGoogle';
import { seguirTemaEnLeaflet } from '@tumbite/compartido/src/temaMapa';

type Punto = { lat: number; lng: number };

const T = {
  es: {
    buscar: 'Buscar la dirección',
    sinResultados: 'Sin resultados. Mueve el mapa hasta tu puerta.',
  },
  en: {
    buscar: 'Search for the address',
    sinResultados: 'No results. Drag the map to your door.',
  },
};

/** Redondeo a ~10 cm: el mismo punto no se vuelve a guardar por un decimal de diferencia. */
const fino = (p: Punto): Punto => ({
  lat: Math.round(p.lat * 1e6) / 1e6,
  lng: Math.round(p.lng * 1e6) / 1e6,
});

/**
 * C-PUNTO-EXACTO en la web (16 nov 2026) — todos los países. El mismo flujo que las apps: el pin
 * queda FIJO en el centro y la persona arrastra el mapa hasta su puerta (como Uber, DiDi y Rappi);
 * «Estoy aquí» es el botón grande de arriba y, si la búsqueda de Google está encendida, se elige
 * una sugerencia y el mapa salta ahí para afinar. Abrir el mapa no marca nada: solo cuenta lo que
 * la persona arrastró, su ubicación o la sugerencia que eligió. La referencia la pide la pantalla
 * que usa la pieza (C-FLEX-UBICACION).
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
  const tp = textosPuntoExacto(idioma);
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const alCambiar = useRef((p: Punto) => cambiar(fino(p)));
  useEffect(() => {
    alCambiar.current = (p: Punto) => cambiar(fino(p));
  }, [cambiar]);
  // Hacia dónde mueve el mapa la pantalla (al abrir, «Estoy aquí» o una sugerencia). Lo que la
  // persona arrastra NO lo cambia: así el mapa nunca salta de vuelta.
  const [vista, setVista] = useState<{ centro: Punto; zoom: number }>(() => ({
    centro: punto ?? centro,
    zoom: punto ? 17 : 12,
  }));
  const [estadoGps, setEstadoGps] = useState('');
  const [busqueda, setBusqueda] = useState<boolean | null>(null);
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

  // C-MAPA-GOOGLE-WEB (14 nov 2026): con la llave del navegador el mapa es SIEMPRE el de Google
  // (bajo demanda, plano: elegir un punto no es un viaje), haya o no búsqueda. Sin llave, Leaflet.
  const llave = (import.meta.env.VITE_GOOGLE_MAPS_WEB_KEY as string | undefined) ?? '';
  const mapId = (import.meta.env.VITE_GOOGLE_MAPS_WEB_MAP_ID as string | undefined) ?? '';
  const proveedor = elegirMapaWeb({ llave });

  useEffect(() => {
    if (proveedor !== 'leaflet') return;
    let vivo = true;
    void (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !caja.current) return;
      const inicio = vista.centro;
      const m = leaflet.map(caja.current).setView([inicio.lat, inicio.lng], vista.zoom);
      leaflet
        .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        })
        .addTo(m);
      // C-PUNTO-EXACTO: el punto es lo que queda bajo el pin al soltar el mapa arrastrado.
      let arrastrado = false;
      m.on('dragstart', () => {
        arrastrado = true;
      });
      m.on('moveend', () => {
        if (!arrastrado) return;
        arrastrado = false;
        const c = m.getCenter();
        alCambiar.current({ lat: c.lat, lng: c.lng });
      });
      // C-MAPA-DIA-NOCHE: el mapa de respaldo sigue el mismo ajuste de día y noche.
      m.on('unload', seguirTemaEnLeaflet(m, inicio));
      mapa.current = m;
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // La vista solo importa al abrir; después la sigue el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedor]);

  // «Estoy aquí» o una sugerencia: el mapa de respaldo va a ese punto.
  useEffect(() => {
    mapa.current?.setView([vista.centro.lat, vista.centro.lng], vista.zoom);
  }, [vista]);

  function irA(p: Punto) {
    setVista({ centro: p, zoom: 17 });
    alCambiar.current(p);
  }

  function estoyAqui() {
    if (!('geolocation' in navigator)) return setEstadoGps(tp.sinPermiso);
    setEstadoGps(tp.buscandote);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setEstadoGps('');
        irA({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => setEstadoGps(tp.sinPermiso),
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
      irA(r.punto);
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
      <button type="button" className="boton" onClick={estoyAqui} data-testid="estoy-aqui">
        {tp.estoyAqui}
      </button>
      {estadoGps && <p role="status">{estadoGps}</p>}
      <p className="pista">{tp.ayuda}</p>
      {proveedor === 'google' ? (
        <MapaGoogleBajoDemanda
          llave={llave}
          mapId={mapId}
          idioma={idioma}
          centro={vista.centro}
          zoom={vista.zoom}
          alto={320}
          etiqueta={tp.mapa}
          puntos={[]}
          alMoverCentro={(p) => alCambiar.current(p)}
          conAjuste
        />
      ) : (
        <div style={{ position: 'relative' }}>
          <PinFijoWeb alto={320} />
          <div
            ref={caja}
            role="application"
            aria-label={tp.mapa}
            style={{
              height: 320,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #2a2a2a',
            }}
          />
        </div>
      )}
      <p className={punto ? 'aviso-exito' : 'pista'} role="status" data-testid="estado-punto">
        {punto ? tp.puntoMarcado : tp.sinMarcar}
      </p>
    </div>
  );
}
