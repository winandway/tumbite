// C-ROBOT-MAPA-CON-MOSAICOS (18 nov 2026) — todos los países. Candado de los robots de capturas: una
// pantalla con mapa no puede salir con el mapa liso o gris (mosaicos sin cargar, llave sin permiso,
// estilo roto). Recibe una captura PNG y la zona donde debe estar el mapa, la parte en una cuadrícula y
// cuenta cuántas casillas tienen detalle (calles, manzanas, letras). Un mapa con mosaicos tiene
// detalle en casi todas; uno liso solo donde hay botones o el pin.
//
// Uso: node scripts/robot/mapa-con-mosaicos.mjs <captura.png> <x>,<y>,<ancho>,<alto>
//   (la zona en píxeles de la imagen). Sale con 0 si hay mapa; con 1 y un mensaje en palabras si no.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/** Casillas por lado de la cuadrícula. */
export const CASILLAS = 8;
/** Desviación de la luminosidad (0-255) desde la que una casilla «tiene detalle». */
export const DETALLE_MINIMO = 6;
/** Parte de las casillas que deben tener detalle para dar el mapa por cargado. */
export const PARTE_MINIMA = 0.7;

/** Lee la zona y devuelve qué parte de sus casillas tiene detalle (0 a 1). */
export function detalleDeZona(png, zona) {
  const { width, height, data } = png;
  const x0 = Math.max(0, Math.floor(zona.x));
  const y0 = Math.max(0, Math.floor(zona.y));
  const x1 = Math.min(width, Math.floor(zona.x + zona.ancho));
  const y1 = Math.min(height, Math.floor(zona.y + zona.alto));
  if (x1 - x0 < CASILLAS || y1 - y0 < CASILLAS)
    throw new Error('la zona del mapa es demasiado chica');
  const anchoCasilla = (x1 - x0) / CASILLAS;
  const altoCasilla = (y1 - y0) / CASILLAS;
  let conDetalle = 0;
  for (let fila = 0; fila < CASILLAS; fila++)
    for (let col = 0; col < CASILLAS; col++) {
      let n = 0;
      let suma = 0;
      let cuadrados = 0;
      const cx0 = Math.floor(x0 + col * anchoCasilla);
      const cy0 = Math.floor(y0 + fila * altoCasilla);
      const cx1 = Math.floor(x0 + (col + 1) * anchoCasilla);
      const cy1 = Math.floor(y0 + (fila + 1) * altoCasilla);
      // Uno de cada dos píxeles basta y es el doble de rápido.
      for (let y = cy0; y < cy1; y += 2)
        for (let x = cx0; x < cx1; x += 2) {
          const i = (y * width + x) * 4;
          const l =
            0.299 * (data.at(i) ?? 0) +
            0.587 * (data.at(i + 1) ?? 0) +
            0.114 * (data.at(i + 2) ?? 0);
          n++;
          suma += l;
          cuadrados += l * l;
        }
      const media = suma / n;
      const desviacion = Math.sqrt(Math.max(0, cuadrados / n - media * media));
      if (desviacion >= DETALLE_MINIMO) conDetalle++;
    }
  return conDetalle / (CASILLAS * CASILLAS);
}

export function leerZona(texto) {
  const p = String(texto ?? '')
    .split(',')
    .map(Number);
  if (p.length !== 4 || p.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error('la zona va así: x,y,ancho,alto (en píxeles)');
  return { x: p[0], y: p[1], ancho: p[2], alto: p[3] };
}

/** El dictamen en palabras: { ok, parte, mensaje }. */
export function revisarMapa(archivo, zona) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- la captura la nombra quien corre el robot
  const parte = detalleDeZona(PNG.sync.read(readFileSync(archivo)), zona);
  const porcentaje = Math.round(parte * 100);
  return parte >= PARTE_MINIMA
    ? { ok: true, parte, mensaje: `Mapa con mosaicos: ${porcentaje} % de la zona con detalle.` }
    : {
        ok: false,
        parte,
        mensaje: `El mapa está liso o gris: solo ${porcentaje} % de la zona tiene detalle (hace falta ${Math.round(PARTE_MINIMA * 100)} %). Revisa que el mapa cargue sus mosaicos (llave, red o estilo) antes de dar la pantalla por buena.`,
      };
}

if (process.argv[1]?.endsWith('mapa-con-mosaicos.mjs')) {
  try {
    const [archivo, zona] = process.argv.slice(2);
    if (!archivo)
      throw new Error('falta la captura: mapa-con-mosaicos.mjs <captura.png> x,y,ancho,alto');
    const r = revisarMapa(archivo, leerZona(zona));
    console.log(r.mensaje);
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`No se pudo revisar el mapa: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
}
