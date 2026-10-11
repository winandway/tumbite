import { useId, useRef, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { MenuTresPuntos } from './MenuTresPuntos';
import { api } from './api';

const T = {
  es: {
    subir: 'Subir foto',
    cambiar: 'Cambiar foto',
    quitar: 'Quitar foto',
    subiendo: 'Subiendo…',
    opciones: 'Opciones de la foto',
    noEsFoto: 'Ese archivo no es una foto. Usa JPG, PNG o WebP.',
    ayuda: 'Una foto clara y con buena luz vende más. La reducimos sola para que cargue rápido.',
  },
  en: {
    subir: 'Upload photo',
    cambiar: 'Change photo',
    quitar: 'Remove photo',
    subiendo: 'Uploading…',
    opciones: 'Photo options',
    noEsFoto: 'That file isn’t a photo. Use JPG, PNG, or WebP.',
    ayuda: 'A clear, well-lit photo sells more. We shrink it for you so it loads fast.',
  },
};

const LADO_MAX = 1200;

/** Reduce la foto en el navegador (máx. 1200 px, WebP) antes de subirla. */
export async function reducirFoto(archivo: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return archivo;
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) return archivo;
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', 0.82));
  // Algunos navegadores viejos no saben hacer WebP y devuelven PNG: también sirve.
  return blob ?? archivo;
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
    if (!archivo) return;
    setError('');
    if (!archivo.type.startsWith('image/')) return setError(t.noEsFoto);
    setSubiendo(true);
    try {
      const { url } = await api.subirFoto(await reducirFoto(archivo));
      cambiar(url);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
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
