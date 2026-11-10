import { useEffect, useRef, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';

/**
 * C-CAMARA-EN-TODA-SUBIDA (regla global de Richard, 9 nov 2026) — todos los países. Toda casilla
 * de subir imagen ofrece «Tomar foto». Pieza única del panel: en el celular abre la cámara trasera
 * del teléfono; en la computadora, la cámara web en una ventanita con su botón. La foto se entrega
 * a la casilla de siempre (misma validación y compresión). Sin cámara o sin permiso se dice en
 * palabras y se deja subir desde archivos; nunca una ventana en blanco.
 */
const T = {
  es: {
    tomar: 'Tomar foto',
    capturar: 'Tomar la foto',
    cerrar: 'Cerrar',
    titulo: 'Cámara',
    abriendo: 'Abriendo la cámara…',
    sinCamara:
      'No pudimos usar la cámara (no hay una o falta el permiso). Sube la foto desde tus archivos.',
  },
  en: {
    tomar: 'Take photo',
    capturar: 'Take the photo',
    cerrar: 'Close',
    titulo: 'Camera',
    abriendo: 'Opening the camera…',
    sinCamara:
      'We couldn’t use the camera (there isn’t one or permission is missing). Upload the photo from your files.',
  },
};

/** ¿Es un celular o una tableta? Ahí el propio sistema abre la cámara con el atributo capture. */
export function esTactil(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/** Saca un JPEG del cuadro actual del video. */
export async function fotoDelVideo(video: HTMLVideoElement): Promise<File | null> {
  const lienzo = document.createElement('canvas');
  lienzo.width = video.videoWidth || 1280;
  lienzo.height = video.videoHeight || 720;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.9));
  return blob ? new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null;
}

export function BotonCamara({
  idioma,
  alTomar,
  alFallar,
  deshabilitado,
  camara = 'environment',
}: {
  idioma: Idioma;
  /** Recibe la foto como archivo, igual que si se hubiera elegido de la computadora. */
  alTomar: (archivo: File) => void;
  /** Sin cámara o sin permiso: el mensaje en palabras, para mostrarlo junto a la casilla. */
  alFallar: (mensaje: string) => void;
  deshabilitado?: boolean;
  camara?: 'environment' | 'user';
}) {
  const t = enIdioma(T, idioma);
  const entrada = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [flujo, setFlujo] = useState<MediaStream | null>(null);

  /** Hay un permiso de cámara en curso: si se cierra antes de que llegue, se apaga al llegar. */
  const pidiendo = useRef(false);
  useEffect(
    () => () => {
      pidiendo.current = false;
    },
    [],
  );
  const cerrar = () => {
    pidiendo.current = false;
    flujo?.getTracks().forEach((p) => p.stop());
    setFlujo(null);
    setAbierta(false);
  };
  // Al desmontar, la cámara se apaga (la luz no se queda encendida).
  useEffect(() => () => flujo?.getTracks().forEach((p) => p.stop()), [flujo]);
  useEffect(() => {
    if (video.current && flujo) {
      video.current.srcObject = flujo;
      // En algunos navegadores play() no devuelve una promesa.
      void Promise.resolve(video.current.play()).catch(() => undefined);
    }
  }, [flujo]);

  async function abrir() {
    if (esTactil()) return entrada.current?.click();
    if (!navigator.mediaDevices?.getUserMedia) return alFallar(t.sinCamara);
    setAbierta(true);
    pidiendo.current = true;
    try {
      const nuevo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camara } });
      // Si cerró la ventanita (o salió de la pantalla) mientras el navegador pedía el permiso,
      // la cámara se apaga aquí mismo: la luz nunca se queda encendida.
      if (!pidiendo.current) return nuevo.getTracks().forEach((pista) => pista.stop());
      pidiendo.current = false;
      setFlujo(nuevo);
    } catch {
      pidiendo.current = false;
      setAbierta(false);
      alFallar(t.sinCamara);
    }
  }

  async function capturar() {
    const foto = video.current ? await fotoDelVideo(video.current) : null;
    cerrar();
    if (foto) alTomar(foto);
    else alFallar(t.sinCamara);
  }

  return (
    <>
      <button
        type="button"
        className="boton secundario"
        onClick={() => void abrir()}
        disabled={deshabilitado}
        data-testid="boton-camara"
      >
        <Icono nombre="foto" tamano={18} />
        {t.tomar}
      </button>
      {/* En el celular: la cámara del teléfono, directo. */}
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={camara}
        className="oculto"
        aria-label={t.tomar}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) alTomar(archivo);
        }}
      />
      {abierta && (
        <div className="camara-ventana" role="dialog" aria-label={t.titulo}>
          {flujo ? (
            <video ref={video} playsInline muted className="camara-video" />
          ) : (
            <p>{t.abriendo}</p>
          )}
          <div className="fila-botones">
            <button
              type="button"
              className="boton"
              onClick={() => void capturar()}
              disabled={!flujo}
            >
              {t.capturar}
            </button>
            <button type="button" className="boton secundario" onClick={cerrar}>
              {t.cerrar}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
