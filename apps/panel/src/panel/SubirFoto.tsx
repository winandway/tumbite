import { BotonCamara } from './camara';
import { useId, useRef, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  TAMANOS_FOTO,
  enIdioma,
  idDeFoto,
  medidasReducidas,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { MenuTresPuntos } from './MenuTresPuntos';
import { api } from './api';

const T = {
  es: {
    subir: 'Subir desde archivos',
    cambiar: 'Cambiar foto',
    quitar: 'Quitar foto',
    subiendo: 'Subiendo…',
    opciones: 'Opciones de la foto',
    noEsFoto: 'Ese archivo no es una foto. Usa JPG, PNG o WebP.',
    ayuda: 'Una foto clara y con buena luz vende más. La reducimos sola para que cargue rápido.',
  },
  en: {
    subir: 'Upload from files',
    cambiar: 'Change photo',
    quitar: 'Remove photo',
    subiendo: 'Uploading…',
    opciones: 'Photo options',
    noEsFoto: 'That file isn’t a photo. Use JPG, PNG, or WebP.',
    ayuda: 'A clear, well-lit photo sells more. We shrink it for you so it loads fast.',
  },
};

const LADO_MAX = 1200;

/**
 * NXT-4z: el navegador no pudo abrir la foto (casi siempre un HEIC del iPhone en Chrome o Firefox,
 * o un archivo dañado). Se muestra el aviso en el idioma de la persona, nunca el texto del
 * navegador; el servidor tampoco guarda HEIC.
 */
export class FotoIlegible extends Error {}
export const AVISO_FOTO_ILEGIBLE = {
  es: 'No pudimos abrir esa foto. Si es HEIC (el formato del iPhone), mándala en JPG: en el iPhone, Ajustes → Cámara → Formatos → Más compatible.',
  en: 'We couldn’t open that photo. If it’s HEIC (the iPhone format), send it as JPG: on the iPhone, Settings → Camera → Formats → Most Compatible.',
};
const ES_HEIC = (a: File) => /^image\/hei[cf]/.test(a.type) || /\.hei[cf]$/i.test(a.name);

/** El mensaje para la persona: el aviso de la foto ilegible, el del servidor o uno genérico. */
export function mensajeDeFoto(x: unknown, idioma: Idioma): string {
  if (x instanceof FotoIlegible)
    return idioma === 'en' ? AVISO_FOTO_ILEGIBLE.en : AVISO_FOTO_ILEGIBLE.es;
  if (x instanceof ErrorApi) return x.message;
  return idioma === 'en' ? 'The photo couldn’t be uploaded.' : 'No se pudo subir la foto.';
}

/** Abre la foto en el navegador; si no puede (HEIC en Chrome, archivo dañado), FotoIlegible. */
async function abrirFoto(archivo: File): Promise<ImageBitmap | null> {
  if (ES_HEIC(archivo)) throw new FotoIlegible();
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(archivo);
  } catch {
    throw new FotoIlegible();
  }
}

/** Dibuja la foto con su lado mayor en `lado` (sin agrandar) y la pasa a WebP en el navegador. */
async function aWebp(img: ImageBitmap, lado: number, calidad: number): Promise<Blob | null> {
  const { ancho, alto } = medidasReducidas(img.width, img.height, lado);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, ancho, alto);
  return new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', calidad));
}

/**
 * C-FOTO-CONDUCTOR-MINIATURA: la miniatura WebP (200 px) de la selfie aprobada del conductor, la única
 * que ve el pasajero. Sin WebP en el navegador, null (no se guarda nada y el pasajero no ve foto).
 */
export async function miniaturaWebp(foto: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const img = await createImageBitmap(foto).catch(() => null);
  if (!img) return null;
  const b = await aWebp(img, TAMANOS_FOTO.miniatura.lado, TAMANOS_FOTO.miniatura.calidad);
  return b && b.type === 'image/webp' ? b : null;
}

/** Reduce la foto en el navegador (máx. 1200 px, WebP) antes de subirla (verificación). */
export async function reducirFoto(archivo: File): Promise<Blob> {
  const img = await abrirFoto(archivo);
  if (!img) return archivo;
  // Algunos navegadores viejos no saben hacer WebP y devuelven PNG: también sirve.
  return (await aWebp(img, LADO_MAX, 0.82)) ?? archivo;
}

/**
 * C-FOTOS-LIVIANAS (NXT-7): la foto de un plato o del restaurante se convierte aquí, sin servicios
 * de pago, a WebP en tres tamaños: primero se sube la completa (1400 px) y después la tarjeta
 * (640) y la miniatura (200), que el servidor guarda junto a ella. Si un tamaño chico falla, la
 * foto queda igual: el servidor entrega la completa en su lugar.
 */
export async function subirFotoLiviana(archivo: File): Promise<string> {
  const img = await abrirFoto(archivo);
  const completa = img
    ? await aWebp(img, TAMANOS_FOTO.completa.lado, TAMANOS_FOTO.completa.calidad)
    : null;
  const { url } = await api.subirFoto(completa ?? archivo);
  const id = idDeFoto(url);
  if (img && id && completa?.type === 'image/webp')
    for (const tam of ['tarjeta', 'miniatura'] as const) {
      const regla = tam === 'tarjeta' ? TAMANOS_FOTO.tarjeta : TAMANOS_FOTO.miniatura;
      const chica = await aWebp(img, regla.lado, regla.calidad);
      if (chica?.type !== 'image/webp') continue;
      await api
        .subirFoto(chica, `/datos/mi-restaurante/fotos?de=${id}&tam=${tam}`)
        .catch((e: unknown) => console.warn('foto: no se subió el tamaño', tam, e));
    }
  return url;
}

export function SubirFoto({
  etiqueta,
  valor,
  cambiar,
  idioma,
  formato = 'ancho',
}: {
  etiqueta: string;
  valor: string;
  cambiar: (url: string) => void;
  idioma: Idioma;
  formato?: 'ancho' | 'cuadrado';
}) {
  const t = enIdioma(T, idioma);
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (archivo) await recibir(archivo);
  }

  /** La foto llega de los archivos o de la cámara: misma validación y misma compresión. */
  async function recibir(archivo: File) {
    setError('');
    if (!archivo.type.startsWith('image/')) return setError(t.noEsFoto);
    setSubiendo(true);
    try {
      cambiar(await subirFotoLiviana(archivo));
    } catch (x) {
      setError(mensajeDeFoto(x, idioma));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="campo subir-foto">
      <label htmlFor={id}>{etiqueta}</label>
      <div className={`foto-caja foto-${formato}`}>
        {valor ? (
          <img src={valor} alt={etiqueta} />
        ) : (
          <Icono nombre="foto" tamano={36} className="foto-vacia" />
        )}
      </div>
      <div className="fila-botones">
        <button
          type="button"
          className="boton secundario"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
        >
          <Icono nombre="subir" tamano={18} />
          {subiendo ? t.subiendo : valor ? t.cambiar : t.subir}
        </button>
        {/* C-CAMARA-EN-TODA-SUBIDA: toda casilla de imagen ofrece «Tomar foto». */}
        <BotonCamara
          idioma={idioma}
          alTomar={(archivo) => void recibir(archivo)}
          alFallar={setError}
          deshabilitado={subiendo}
        />
        {valor && !subiendo && (
          <MenuTresPuntos
            etiqueta={t.opciones}
            opciones={[{ texto: t.quitar, peligro: true, alTocar: () => cambiar('') }]}
          />
        )}
      </div>
      <input
        ref={entrada}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="oculto"
        onChange={(e) => void elegir(e)}
      />
      <small>{t.ayuda}</small>
      {error && (
        <p className="error-campo" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
