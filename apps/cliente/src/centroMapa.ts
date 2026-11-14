import { useCallback, useEffect, useState } from 'react';
import { centroParaElegir, type VistaMapa } from '@tumbite/compartido/src/mapaLlegada';
import { direccionElegida, puntoGuardado } from './comida/useRestaurantes';
import { miUbicacion, ubicacionSiHayPermiso, type Punto } from './ubicacion';

/**
 * C-MAPA-ABRE-DONDE-ESTAS (14 nov 2026, Richard) — todos los países. Dónde abre el mapa de elegir un
 * punto, en la web y en las apps: el punto ya marcado; si no, el GPS de la persona (solo si ya dio
 * permiso: abrir un mapa no dispara la pregunta del permiso); si no, la dirección de entrega que
 * eligió; si no, la última ubicación guardada en su teléfono; si no, la zona de lo que está pidiendo
 * (`cerca`: el local del carrito o la recogida). Nunca una ciudad fija: sin ningún dato `vista` es
 * `null` y la pantalla ofrece «Usar mi ubicación» (`pedirUbicacion`, que sí pregunta el permiso).
 * No llama a Google ni al servidor: lee lo que el teléfono ya tiene.
 */
export function useCentroParaElegir(
  punto: Punto | null,
  cerca?: Punto | null,
): { vista: VistaMapa | null; buscando: boolean; pedirUbicacion: () => Promise<Punto | null> } {
  const [gps, setGps] = useState<Punto | null>(null);
  const [direccion, setDireccion] = useState<Punto | null>(null);
  const [guardado, setGuardado] = useState<Punto | null>(null);
  const [leido, setLeido] = useState(false);
  const hayPunto = punto != null;

  useEffect(() => {
    if (hayPunto) return;
    let vivo = true;
    const al = <T>(p: Promise<T>, poner: (v: T) => void) =>
      p.then((v) => vivo && poner(v)).catch((e: unknown) => console.warn('mapa: sin ese dato', e));
    void Promise.all([
      al(ubicacionSiHayPermiso(), setGps),
      al(direccionElegida(), (d) => setDireccion(d?.punto ?? null)),
      al(puntoGuardado(), setGuardado),
    ]).then(() => vivo && setLeido(true));
    return () => {
      vivo = false;
    };
  }, [hayPunto]);

  const pedirUbicacion = useCallback(async () => {
    const p = await miUbicacion();
    if (p) setGps(p);
    return p;
  }, []);

  return {
    vista: centroParaElegir({ punto, gps, direccion, guardado, cerca }),
    buscando: !hayPunto && !leido,
    pedirUbicacion,
  };
}

/** Lo que dice la pantalla cuando todavía no se sabe dónde está la persona. */
export const TEXTOS_SIN_CENTRO = {
  es: {
    sin: 'Para marcar el punto en el mapa, usa tu ubicación o escribe la dirección.',
    usar: 'Usar mi ubicación',
    no: 'No pudimos leer tu ubicación. Escribe la dirección y el mapa irá ahí.',
  },
  en: {
    sin: 'To drop the pin on the map, use your location or type the address.',
    usar: 'Use my location',
    no: 'We couldn’t read your location. Type the address and the map will go there.',
  },
};
