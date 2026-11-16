import { TAMANOS_FOTO, TAMANOS_FOTO_PUERTA, idDeFoto, medidasReducidas } from '@tumbite/compartido';

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

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. La foto de la puerta se convierte en el teléfono
 * a WebP (lado mayor 1024, calidad 0,75) y se sube a su casilla; después, la miniatura (200 px,
 * calidad 0,7) a la misma ruta con `?tam=mini`. La original nunca se sube. Si cualquiera de las dos
 * falla, lanza el error: la pantalla deja la foto elegida con «Reintentar» (nada se limpia antes
 * de la confirmación del servidor), y al reintentar se reemplazan las dos.
 */
export async function subirFotoPuertaApp<F>(
  subir: Subir,
  foto: { uri: string; width: number; height: number },
  manipular: Manipular<F>,
  webp: F,
  ruta: string,
  leer: (uri: string) => Promise<Blob> = async (uri) => (await fetch(uri)).blob(),
): Promise<void> {
  const convertir = async (lado: number, calidad: number) => {
    const { ancho, alto } = medidasReducidas(foto.width, foto.height, lado);
    const r = await manipular(foto.uri, [{ resize: { width: ancho, height: alto } }], {
      compress: calidad,
      format: webp,
    });
    return leer(r.uri);
  };
  const { grande, mini } = TAMANOS_FOTO_PUERTA;
  await subir(await convertir(grande.lado, grande.calidad), ruta);
  await subir(
    await convertir(mini.lado, mini.calidad),
    `${ruta}${ruta.includes('?') ? '&' : '?'}tam=mini`,
  );
}

/**
 * C-FOTO-EVIDENCIA-LIVIANA (15 nov 2026, pedido de Richard tras la prueba en Novi: la foto en el
 * restaurante tardaba mucho en subir). Las fotos de prueba de un pedido (recogida, entrega, chat,
 * paquetes) se achican EN EL TELÉFONO antes de subir: lado mayor 1280 px y JPEG al 0,6. Una foto de
 * 12 megapíxeles pasa de cerca de 1 MB (o más) a unos 150-200 KB: sube en uno o dos segundos con
 * mala señal. Se queda en JPEG para que el correo de la entrega la muestre en cualquier programa.
 * Si achicar falla (memoria, formato raro), se sube la original: nunca se pierde la foto.
 */
export const FOTO_EVIDENCIA = { lado: 1280, calidad: 0.6 } as const;

export async function achicarFotoEvidencia<F>(
  foto: { uri: string; width?: number; height?: number },
  manipular: Manipular<F>,
  jpeg: F,
): Promise<string> {
  const { width, height } = foto;
  if (!width || !height) return foto.uri;
  try {
    const { ancho, alto } = medidasReducidas(width, height, FOTO_EVIDENCIA.lado);
    const r = await manipular(foto.uri, [{ resize: { width: ancho, height: alto } }], {
      compress: FOTO_EVIDENCIA.calidad,
      format: jpeg,
    });
    return r.uri;
  } catch (e) {
    console.warn('foto: no se pudo achicar; se sube la original', e);
    return foto.uri;
  }
}
