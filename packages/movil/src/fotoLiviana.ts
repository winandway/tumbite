import { TAMANOS_FOTO, idDeFoto, medidasReducidas } from '@tumbite/compartido';

/**
 * C-FOTOS-LIVIANAS (NXT-7): en el teléfono, la foto de un plato (o de un producto) se convierte con
 * expo-image-manipulator, sin servicios de pago, a WebP en tres tamaños: primero se sube la
 * completa (1400 px) y después la tarjeta (640) y la miniatura (200). Recibe el `manipulateAsync`
 * y el formato WebP de cada app (el paquete compartido no depende de expo-image-manipulator).
 * Si un tamaño chico falla, la foto queda igual: el servidor entrega la completa en su lugar.
 */
type Manipular<F> = (
  uri: string,
  acciones: { resize: { width: number; height: number } }[],
  opciones: { compress: number; format: F },
) => Promise<{ uri: string }>;
type Subir = (foto: Blob, ruta?: string) => Promise<{ url: string }>;

export async function subirFotoLivianaApp<F>(
  subir: Subir,
  foto: { uri: string; width: number; height: number },
  manipular: Manipular<F>,
  webp: F,
  ruta = '/datos/mi-restaurante/fotos',
  leer: (uri: string) => Promise<Blob> = async (uri) => (await fetch(uri)).blob(),
): Promise<string> {
  const convertir = async (lado: number, calidad: number) => {
    const { ancho, alto } = medidasReducidas(foto.width, foto.height, lado);
    const r = await manipular(foto.uri, [{ resize: { width: ancho, height: alto } }], {
      compress: calidad,
      format: webp,
    });
    return leer(r.uri);
  };
  const { url } = await subir(
    await convertir(TAMANOS_FOTO.completa.lado, TAMANOS_FOTO.completa.calidad),
    ruta,
  );
  const id = idDeFoto(url);
  if (!id) return url;
  for (const tam of ['tarjeta', 'miniatura'] as const) {
    const regla = tam === 'tarjeta' ? TAMANOS_FOTO.tarjeta : TAMANOS_FOTO.miniatura;
    try {
      await subir(await convertir(regla.lado, regla.calidad), `${ruta}?de=${id}&tam=${tam}`);
    } catch (e) {
      console.warn('foto: no se subió el tamaño', tam, e);
    }
  }
  return url;
}
