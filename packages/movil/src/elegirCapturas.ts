import type { Captura } from './MisCasos';

/**
 * C-CASOS-CAPTURAS: el selector de la galería que usan las tres apps para «Mis casos de ayuda».
 * Recibe el `launchImageLibraryAsync` de expo-image-picker de cada app (el paquete compartido no
 * depende de él) y devuelve hasta `maximo` capturas con su nombre.
 */
type Galeria = (o: {
  mediaTypes: 'images'[];
  allowsMultipleSelection: boolean;
  selectionLimit: number;
  quality: number;
}) => Promise<{ canceled: boolean; assets?: { uri: string; fileName?: string | null }[] | null }>;

export function selectorDeCapturas(galeria: Galeria) {
  return async (maximo: number): Promise<Captura[]> => {
    const r = await galeria({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maximo,
      quality: 0.8,
    });
    if (r.canceled || !r.assets) return [];
    return r.assets
      .slice(0, maximo)
      .map((a, i) => ({ uri: a.uri, nombre: a.fileName || `captura-${i + 1}.jpg` }));
  };
}
