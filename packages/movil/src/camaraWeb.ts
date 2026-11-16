import type { Idioma } from '@tumbite/compartido';
import type { CamaraComputadora } from './camaraLogica';

/**
 * C-CAMARA-EN-TODA-SUBIDA, parte de la COMPUTADORA (regla global de Richard, 9 nov 2026) — todos
 * los países. En las apps abiertas en el navegador de una computadora, «Tomar foto» caía al selector
 * de archivos (expo-image-picker en la web solo abre un `<input type="file">`). Aquí, como en el
 * panel (`apps/panel/src/panel/camara.tsx`): una ventanita con la cámara web y su botón «Tomar la
 * foto». Sin cámara o sin permiso, se dice en palabras y se sigue con los archivos.
 *
 * Es DOM puro (sin react-native-web): la ventanita se pinta encima de todo, también encima de una
 * hoja abierta, y vale para cualquier subida de imagen que pase por la pieza única de la cámara.
 * En el teléfono (nativo o navegador táctil) no se usa: ahí el sistema abre la cámara trasera.
 */
const T = {
  es: {
    titulo: 'Agregar una foto',
    camara: 'Tomar foto',
    archivos: 'Subir desde archivos',
    cancelar: 'Cancelar',
    ventana: 'Cámara',
    abriendo: 'Abriendo la cámara…',
    capturar: 'Tomar la foto',
    cerrar: 'Cerrar',
    sinCamara:
      'No pudimos usar la cámara (no hay una o falta el permiso). Sube la foto desde tus archivos.',
  },
  en: {
    titulo: 'Add a photo',
    camara: 'Take photo',
    archivos: 'Upload from files',
    cancelar: 'Cancel',
    ventana: 'Camera',
    abriendo: 'Opening the camera…',
    capturar: 'Take the photo',
    cerrar: 'Close',
    sinCamara:
      'We couldn’t use the camera (there isn’t one or permission is missing). Upload the photo from your files.',
  },
};
export const textosCamaraWeb = (idioma: Idioma) => (idioma === 'en' ? T.en : T.es);

export type FotoWeb = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
};

/** ¿Es el navegador de una computadora (sin pantalla táctil como puntero principal)? */
export function esComputadoraWeb(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(pointer: coarse)').matches;
}

const COLORES = { primario: '#F20D20', texto: '#101010', borde: '#2a2a2a', suave: '#666B73' };

function boton(texto: string, principal: boolean, id: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = texto;
  b.setAttribute('data-testid', id);
  Object.assign(b.style, {
    minHeight: '46px',
    padding: '0 18px',
    borderRadius: '12px',
    border: principal ? 'none' : `1px solid ${COLORES.borde}`,
    background: principal ? COLORES.primario : '#fff',
    color: principal ? '#fff' : COLORES.texto,
    font: '700 15px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });
  return b;
}

/** La capa oscura y la ventanita blanca; `cerrar` la quita (y deja el foco donde estaba). */
function ventanita(etiqueta: string, testId: string) {
  const antes = document.activeElement as HTMLElement | null;
  const capa = document.createElement('div');
  capa.setAttribute('data-testid', `${testId}-capa`);
  Object.assign(capa.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '2147483000',
    padding: '16px',
  });
  const caja = document.createElement('div');
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-modal', 'true');
  caja.setAttribute('aria-label', etiqueta);
  caja.setAttribute('data-testid', testId);
  Object.assign(caja.style, {
    background: '#fff',
    borderRadius: '16px',
    border: `1px solid ${COLORES.borde}`,
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    padding: '18px',
    width: 'min(560px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    font: '15px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    color: COLORES.texto,
  });
  capa.appendChild(caja);
  document.body.appendChild(capa);
  const cerrar = () => {
    capa.remove();
    antes?.focus();
  };
  return { capa, caja, cerrar };
}

function fila(...botones: HTMLButtonElement[]) {
  const f = document.createElement('div');
  Object.assign(f.style, {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  });
  for (const b of botones) f.appendChild(b);
  return f;
}

/**
 * «Tomar foto» o «Subir desde archivos» en la computadora (en la web no hay ventanita nativa con
 * botones). Se cierra con «Cancelar», tocando fuera o con Escape.
 */
export function preguntarOrigenWeb(idioma: Idioma): Promise<'camara' | 'archivos' | null> {
  const t = textosCamaraWeb(idioma);
  return new Promise((ok) => {
    const { capa, caja, cerrar } = ventanita(t.titulo, 'camara-web-origen');
    const titulo = document.createElement('strong');
    titulo.textContent = t.titulo;
    titulo.style.fontSize = '18px';
    const camara = boton(t.camara, true, 'camara-web-tomar');
    const archivos = boton(t.archivos, false, 'camara-web-archivos');
    const cancelar = boton(t.cancelar, false, 'camara-web-cancelar');
    caja.append(titulo, fila(cancelar, archivos, camara));
    const fin = (r: 'camara' | 'archivos' | null) => {
      document.removeEventListener('keydown', tecla, true);
      cerrar();
      ok(r);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fin(null);
    };
    document.addEventListener('keydown', tecla, true);
    camara.onclick = () => fin('camara');
    archivos.onclick = () => fin('archivos');
    cancelar.onclick = () => fin(null);
    capa.onclick = (e) => {
      if (e.target === capa) fin(null);
    };
    camara.focus();
  });
}

/** Saca un JPEG del cuadro actual del video (la foto que «vio» la cámara al tocar el botón). */
export function fotoDelVideo(video: HTMLVideoElement): FotoWeb | null {
  const lienzo = document.createElement('canvas');
  lienzo.width = video.videoWidth || 1280;
  lienzo.height = video.videoHeight || 720;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
  return {
    uri: lienzo.toDataURL('image/jpeg', 0.9),
    width: lienzo.width,
    height: lienzo.height,
    fileName: `foto-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  };
}

/**
 * La cámara web en una ventanita con «Tomar la foto» y «Cerrar». Devuelve la foto (como la de la
 * cámara del teléfono: uri, ancho y alto) o null si la cerró. Sin cámara o sin permiso lanza un
 * error con el mensaje en palabras; la luz de la cámara se apaga siempre al terminar.
 */
export async function tomarConCamaraWeb(idioma: Idioma): Promise<FotoWeb | null> {
  const t = textosCamaraWeb(idioma);
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(t.sinCamara);
  const { capa, caja, cerrar } = ventanita(t.ventana, 'camara-web');
  const estado = document.createElement('p');
  estado.textContent = t.abriendo;
  estado.style.margin = '0';
  estado.style.color = COLORES.suave;
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.setAttribute('data-testid', 'camara-web-video');
  Object.assign(video.style, {
    width: '100%',
    maxHeight: '60vh',
    borderRadius: '12px',
    background: '#000',
    display: 'none',
  });
  const tomar = boton(t.capturar, true, 'camara-web-capturar');
  tomar.disabled = true;
  tomar.style.opacity = '0.5';
  const salir = boton(t.cerrar, false, 'camara-web-cerrar');
  caja.append(estado, video, fila(salir, tomar));

  let flujo: MediaStream | null = null;
  let abierta = true;
  const apagar = () => flujo?.getTracks().forEach((p) => p.stop());
  return new Promise<FotoWeb | null>((ok, falla) => {
    const fin = (r: FotoWeb | null, error?: Error) => {
      if (!abierta) return;
      abierta = false;
      document.removeEventListener('keydown', tecla, true);
      apagar();
      cerrar();
      if (error) falla(error);
      else ok(r);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fin(null);
    };
    document.addEventListener('keydown', tecla, true);
    salir.onclick = () => fin(null);
    capa.onclick = (e) => {
      if (e.target === capa) fin(null);
    };
    tomar.onclick = () => {
      const foto = fotoDelVideo(video);
      if (foto) fin(foto);
      else fin(null, new Error(t.sinCamara));
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((nuevo) => {
        flujo = nuevo;
        // Si la cerró mientras el navegador pedía el permiso, la cámara se apaga aquí mismo.
        if (!abierta) return apagar();
        video.srcObject = nuevo;
        video.style.display = 'block';
        estado.remove();
        void Promise.resolve(video.play()).catch(() => undefined);
        tomar.disabled = false;
        tomar.style.opacity = '1';
        tomar.focus();
      })
      .catch(() => fin(null, new Error(t.sinCamara)));
  });
}

/** La cámara de la computadora que usan las apps (camara.ts la pasa a la pieza única). */
export const camaraDeComputadora: CamaraComputadora = {
  disponible: esComputadoraWeb,
  preguntar: preguntarOrigenWeb,
  tomar: tomarConCamaraWeb,
};
