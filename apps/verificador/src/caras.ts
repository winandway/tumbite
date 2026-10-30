import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

/**
 * Caras del motor, como Idswyft: @vladmandic/face-api (MIT) sobre TensorFlow (Apache 2.0) con WASM. Tres
 * redes: encontrar la cara (SSD MobileNet), sus 68 puntos y su «huella» de 128 números. Todo corre en la
 * máquina del motor: los modelos y el WASM vienen en los paquetes, nada se baja de internet al verificar.
 */
const requerir = createRequire(import.meta.url);
type FaceApi = typeof import('@vladmandic/face-api');
type Tf = typeof import('@tensorflow/tfjs');

let listo: Promise<{ faceapi: FaceApi; tf: Tf }> | null = null;

function cargar() {
  listo ??= (async () => {
    const tf = requerir('@tensorflow/tfjs') as Tf;
    const wasm = requerir('@tensorflow/tfjs-backend-wasm') as {
      setWasmPaths: (p: Record<string, string>, simd?: boolean) => void;
    };
    const faceapi = requerir('@vladmandic/face-api/dist/face-api.node-wasm.js') as FaceApi;
    // El WASM se entrega desde el disco (Node no lee archivos con fetch), como datos en línea.
    const dist = join(
      dirname(requerir.resolve('@tensorflow/tfjs-backend-wasm/package.json')),
      'dist',
    );
    // La ruta sale del paquete instalado, nunca de lo que manda la persona.
    const enLinea = (f: string) =>
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      `data:application/wasm;base64,${readFileSync(join(dist, f)).toString('base64')}`;
    wasm.setWasmPaths(
      Object.fromEntries(
        [
          'tfjs-backend-wasm.wasm',
          'tfjs-backend-wasm-simd.wasm',
          'tfjs-backend-wasm-threaded-simd.wasm',
        ].map((f) => [f, enLinea(f)]),
      ),
      true,
    );
    await tf.setBackend('wasm');
    await tf.ready();
    const modelos = join(dirname(requerir.resolve('@vladmandic/face-api/package.json')), 'model');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelos);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelos);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelos);
    return { faceapi, tf };
  })();
  return listo;
}

export type Punto = { x: number; y: number };
export type Cara = {
  huella: number[];
  puntos: Punto[];
  caja: { x: number; y: number; ancho: number; alto: number };
  confianza: number;
};

/**
 * La cara más grande de la foto (en la selfie, la persona; en el documento, su foto). Null si no hay
 * ninguna con confianza suficiente.
 */
export async function leerCara(foto: Buffer): Promise<Cara | null> {
  const { faceapi, tf } = await cargar();
  const { data, info } = await sharp(foto)
    .rotate()
    .removeAlpha()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const imagen = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
  try {
    const caras = await faceapi
      .detectAllFaces(imagen, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    const mayor = caras.sort((a, b) => b.detection.box.area - a.detection.box.area)[0];
    if (!mayor) return null;
    const c = mayor.detection.box;
    return {
      huella: Array.from(mayor.descriptor),
      puntos: mayor.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
      caja: { x: c.x, y: c.y, ancho: c.width, alto: c.height },
      confianza: mayor.detection.score,
    };
  } finally {
    imagen.dispose();
  }
}

/** Distancia entre dos huellas (euclídea, la de face-api): 0 es la misma foto; más de 0,6, otra persona. */
export function distancia(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a.at(i) ?? 0) - (b.at(i) ?? 0)) ** 2;
  return Math.sqrt(s);
}

/** Umbral estándar de face-api: hasta 0,6 de distancia es la misma persona (Idswyft usa el mismo corte). */
export const UMBRAL_MISMA_PERSONA = 0.6;

export type Comparacion = { coincide: boolean; similitud: number; distancia: number };

export function compararHuellas(a: number[], b: number[]): Comparacion {
  const d = distancia(a, b);
  return {
    coincide: d <= UMBRAL_MISMA_PERSONA,
    similitud: Math.round(Math.max(0, 1 - d) * 100) / 100,
    distancia: Math.round(d * 1000) / 1000,
  };
}

export type ResultadoCaras =
  | ({ ok: true } & Comparacion)
  | { ok: false; motivo: 'sin_cara_en_selfie' | 'sin_cara_en_documento' };

/** La selfie contra la foto del documento. */
export async function compararSelfieConDocumento(
  selfie: Buffer,
  documento: Buffer,
): Promise<ResultadoCaras> {
  const a = await leerCara(selfie);
  if (!a) return { ok: false, motivo: 'sin_cara_en_selfie' };
  const b = await leerCara(documento);
  if (!b) return { ok: false, motivo: 'sin_cara_en_documento' };
  return { ok: true, ...compararHuellas(a.huella, b.huella) };
}

/**
 * Cuánto está girada la cabeza, de 0 a 1: la punta de la nariz (punto 30) entre los dos extremos de la
 * mandíbula (puntos 0 y 16). 0,5 es de frente; menos, girada hacia un lado; más, hacia el otro.
 */
export function giroDeCabeza(puntos: Punto[]): number {
  const izq = puntos.at(0);
  const der = puntos.at(16);
  const nariz = puntos.at(30);
  if (!izq || !der || !nariz || der.x === izq.x) return 0.5;
  return (nariz.x - izq.x) / (der.x - izq.x);
}

/** Cuánto tiene que moverse la nariz al girar para contar como giro de verdad (como el reto de Idswyft). */
export const GIRO_MINIMO = 0.08;

export type Vida =
  | { viva: true; giros: [number, number, number] }
  | {
      viva: false;
      motivo: 'falta_una_cara' | 'otra_persona' | 'sin_giro';
      giros?: [number, number, number];
    };

/**
 * Prueba de persona viva con el reto de girar la cabeza: tres fotos (de frente, a un lado y al otro).
 * Pasa si las tres son de la misma persona y la cabeza giró de verdad hacia los dos lados. Una foto
 * impresa o una pantalla no gira: sus tres fotos dan el mismo giro y no pasan.
 */
export function decidirVida(caras: (Cara | null)[]): Vida {
  const [frente, lado1, lado2] = caras;
  if (!frente || !lado1 || !lado2) return { viva: false, motivo: 'falta_una_cara' };
  if (
    !compararHuellas(frente.huella, lado1.huella).coincide ||
    !compararHuellas(frente.huella, lado2.huella).coincide
  )
    return { viva: false, motivo: 'otra_persona' };
  const giros: [number, number, number] = [
    giroDeCabeza(frente.puntos),
    giroDeCabeza(lado1.puntos),
    giroDeCabeza(lado2.puntos),
  ];
  const [g0, g1, g2] = giros;
  const haciaUnLado = g1 - g0;
  const haciaElOtro = g2 - g0;
  const giro =
    Math.abs(haciaUnLado) >= GIRO_MINIMO &&
    Math.abs(haciaElOtro) >= GIRO_MINIMO &&
    Math.sign(haciaUnLado) !== Math.sign(haciaElOtro);
  return giro ? { viva: true, giros } : { viva: false, motivo: 'sin_giro', giros };
}

export async function pruebaDeVida(fotos: [Buffer, Buffer, Buffer]): Promise<Vida> {
  const caras: (Cara | null)[] = [];
  for (const f of fotos) caras.push(await leerCara(f));
  return decidirVida(caras);
}

/**
 * Caras repetidas: la huella de quien se registra contra las de cuentas cerradas por mala conducta. Las
 * parecidas van a revisión del equipo, de la más parecida a la menos; nunca se rechaza solo por esto.
 */
export function buscarParecidas(
  huella: number[],
  lista: { id: string; huella: number[] }[],
): { id: string; similitud: number; distancia: number }[] {
  return lista
    .map(({ id, huella: otra }) => ({ id, ...compararHuellas(huella, otra) }))
    .filter((c) => c.coincide)
    .sort((a, b) => a.distancia - b.distancia)
    .map(({ id, similitud, distancia }) => ({ id, similitud, distancia }));
}
