import type { Idioma } from '@tumbite/compartido';

/**
 * C-CAMARA-EN-TODA-SUBIDA (regla global de Richard, 9 nov 2026) — todos los países. Toda casilla
 * de subir imagen de las apps ofrece «Tomar foto» además de «Subir desde archivos». Pieza única:
 * pregunta el origen y, si es la cámara, pide el permiso y toma la foto. El paquete compartido no
 * depende de expo-image-picker: cada app le pasa su cámara (`pedirPermiso` y `tomar`).
 * Sin permiso se dice en palabras y se puede seguir con los archivos; nunca una pantalla en blanco.
 */
const T = {
  es: {
    titulo: 'Agregar una foto',
    camara: 'Tomar foto',
    archivos: 'Subir desde archivos',
    cancelar: 'Cancelar',
    sinPermiso:
      'No tenemos permiso para usar la cámara. Actívalo en los ajustes del teléfono o sube la foto desde tus archivos.',
  },
  en: {
    titulo: 'Add a photo',
    camara: 'Take photo',
    archivos: 'Upload from files',
    cancelar: 'Cancel',
    sinPermiso:
      'We don’t have permission to use the camera. Turn it on in your phone settings or upload the photo from your files.',
  },
};

export const textosCamara = (idioma: Idioma) => (idioma === 'en' ? T.en : T.es);

type FotoTomada = { uri: string; fileName?: string | null };
export type CamaraApp<F extends FotoTomada = FotoTomada> = {
  pedirPermiso: () => Promise<{ granted: boolean }>;
  tomar: () => Promise<{ canceled: boolean; assets?: F[] | null }>;
};

export type OrigenFoto = 'camara' | 'archivos' | null;

/** «Tomar foto» o «Subir desde archivos». En la web no hay ventanita nativa: van los archivos. */
type Alerta = (
  titulo: string,
  mensaje: string | undefined,
  botones: { text: string; style?: 'cancel'; onPress: () => void }[],
  opciones: { cancelable: boolean; onDismiss: () => void },
) => void;

export function preguntarOrigen(
  idioma: Idioma,
  plataforma: string,
  alerta: Alerta,
): Promise<OrigenFoto> {
  if (plataforma === 'web') return Promise.resolve('archivos');
  const t = textosCamara(idioma);
  return new Promise((ok) =>
    alerta(
      t.titulo,
      undefined,
      [
        { text: t.camara, onPress: () => ok('camara') },
        { text: t.archivos, onPress: () => ok('archivos') },
        { text: t.cancelar, style: 'cancel', onPress: () => ok(null) },
      ],
      { cancelable: true, onDismiss: () => ok(null) },
    ),
  );
}

/** Pide el permiso y toma la foto. Sin permiso lanza un error con el mensaje en palabras. */
export async function tomarConCamara<F extends FotoTomada>(
  camara: CamaraApp<F>,
  idioma: Idioma,
): Promise<F | null> {
  const permiso = await camara.pedirPermiso();
  if (!permiso.granted) throw new Error(textosCamara(idioma).sinPermiso);
  const r = await camara.tomar();
  return r.canceled ? null : (r.assets?.[0] ?? null);
}

/**
 * Una foto: pregunta el origen y devuelve la de la cámara o la de los archivos (lo que entregue
 * `deArchivos`, la apertura de la galería de siempre, con su modo compatible y su calidad).
 */
export async function fotoDe<F extends FotoTomada>(
  idioma: Idioma,
  camara: CamaraApp<F>,
  deArchivos: () => Promise<F | null>,
  preguntar: (idioma: Idioma) => Promise<OrigenFoto>,
): Promise<F | null> {
  const origen = await preguntar(idioma);
  if (origen === 'camara') return tomarConCamara(camara, idioma);
  if (origen === 'archivos') return deArchivos();
  return null;
}

type Captura = { uri: string; nombre: string };

/**
 * Varias capturas (casos de ayuda): el selector de siempre, ahora con «Tomar foto».
 * La app la usa con `capturasConCamara(selectorDeCapturas(galería, compatible), cámara, idioma)`.
 */
export function capturasDe(
  deArchivos: (maximo: number) => Promise<Captura[]>,
  camara: CamaraApp,
  idioma: Idioma,
  preguntar: (idioma: Idioma) => Promise<OrigenFoto>,
) {
  return async (maximo: number): Promise<Captura[]> => {
    const origen = await preguntar(idioma);
    if (origen === 'archivos') return deArchivos(maximo);
    if (origen !== 'camara') return [];
    const foto = await tomarConCamara(camara, idioma);
    return foto ? [{ uri: foto.uri, nombre: foto.fileName || `foto-${Date.now()}.jpg` }] : [];
  };
}
