/** Lo mismo que `Captura` de MisCasos (aquí sin importar la pantalla, para poder probarlo solo). */
type Captura = { uri: string; nombre: string };

/**
 * C-CASOS-CAPTURAS: el selector de la galería que usan las tres apps para «Mis casos de ayuda».
 * Recibe el `launchImageLibraryAsync` de expo-image-picker de cada app (el paquete compartido no
 * depende de él) y devuelve hasta `maximo` capturas con su nombre.
 */
type Galeria<M> = (o: {
  mediaTypes: 'images'[];
  allowsMultipleSelection: boolean;
  selectionLimit: number;
  quality: number;
  preferredAssetRepresentationMode?: M;
}) => Promise<{ canceled: boolean; assets?: { uri: string; fileName?: string | null }[] | null }>;

/**
 * NXT-4y: `compatible` es `UIImagePickerPreferredAssetRepresentationMode.Compatible` de cada app:
 * en el iPhone la galería entrega JPEG en vez de HEIC (el servidor no guarda HEIC).
 */
export function selectorDeCapturas<M>(galeria: Galeria<M>, compatible?: M) {
  return async (maximo: number): Promise<Captura[]> => {
    const r = await galeria({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maximo,
      quality: 0.8,
      ...(compatible === undefined ? {} : { preferredAssetRepresentationMode: compatible }),
    });
    if (r.canceled || !r.assets) return [];
    return r.assets
      .slice(0, maximo)
      .map((a, i) => ({ uri: a.uri, nombre: a.fileName || `captura-${i + 1}.jpg` }));
  };
}
