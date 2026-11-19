// C-DOCS-VIDEO (19 nov 2026): sube un video de Docs al almacén de los sitios de YaDominios Cloud,
// como docs-video/<id>-<idioma>-<huella>.mp4. El servidor lo sirve en /media/docs-video/ (por
// partes). No va en el paquete del sitio. Antes de subir revisa que el archivo sea el que Docs
// espera: MP4 H.264 vertical de 720×1280, con sonido AAC y arranque rápido (el índice al comienzo,
// para que empiece a verse sin bajarlo entero).
//
// Uso: node scripts/docs/subir-video.mjs <id> <es|en> <archivo.mp4> [pruebas|produccion]
//      (sin sitio: los dos). Al terminar imprime lo que va en apps/panel/src/sitio/docs/videos.ts.
// La portada (WebP vertical) va aparte, en apps/panel/public/docs/video-<id>-<idioma>.webp.
// Las llaves salen del llavero de esta computadora (Acceso para IA de cada sitio); nunca del repo.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local sobre un archivo que se pasa a mano y dos sitios fijos */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SITIOS = {
  pruebas: { llave: 'yadominios-llave-ia-tumbite-pruebas', web: 'https://staging.tumbite.com' },
  produccion: { llave: 'yadominios-llave-ia-tumbite', web: 'https://divoox.com' },
};
/** El tope de un video de Docs: con más peso, con internet lento no arranca. */
const MAX_BYTES = 12 * 1024 * 1024;

const [id, idioma, archivo, sitio] = process.argv.slice(2);
const idBueno = /^[a-z0-9-]{1,80}$/.test(id ?? '') && !/^-|-$|--/.test(id);
if (!idBueno || !['es', 'en'].includes(idioma) || !archivo) {
  console.error(
    'Uso: node scripts/docs/subir-video.mjs <id> <es|en> <archivo.mp4> [pruebas|produccion]',
  );
  process.exit(2);
}
const elegidos = sitio ? [sitio] : Object.keys(SITIOS);
for (const s of elegidos) if (!SITIOS[s]) throw new Error(`Sitio desconocido: ${s}`);

function llave(nombre) {
  for (const op of ['-s', '-a']) {
    try {
      return execFileSync('security', ['find-generic-password', op, nombre, '-w'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      /* se prueba la otra forma de guardarla */
    }
  }
  throw new Error(`No está la llave «${nombre}» en el llavero.`);
}

/** El orden de las cajas de primer nivel del MP4 («ftyp», «moov», «mdat»…). */
export function cajasDelMp4(bytes) {
  const cajas = [];
  for (let i = 0; i + 8 <= bytes.length;) {
    let largo = bytes.readUInt32BE(i);
    const tipo = bytes.toString('latin1', i + 4, i + 8);
    if (largo === 1 && i + 16 <= bytes.length) largo = Number(bytes.readBigUInt64BE(i + 8));
    else if (largo === 0) largo = bytes.length - i;
    if (largo < 8) break;
    cajas.push(tipo);
    i += largo;
  }
  return cajas;
}

const bytes = readFileSync(archivo);
const fallas = [];
if (bytes.length > MAX_BYTES)
  fallas.push(`pesa ${(bytes.length / 1048576).toFixed(1)} MB (máximo ${MAX_BYTES / 1048576})`);
const cajas = cajasDelMp4(bytes);
if (!cajas.includes('moov') || !cajas.includes('mdat')) fallas.push('no es un MP4 completo');
else if (cajas.indexOf('moov') > cajas.indexOf('mdat'))
  fallas.push('no tiene arranque rápido (expórtalo con «-movflags +faststart»)');
const sonda = JSON.parse(
  execFileSync(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', archivo],
    { encoding: 'utf8' },
  ),
);
const imagen = sonda.streams.find((x) => x.codec_type === 'video');
const sonido = sonda.streams.find((x) => x.codec_type === 'audio');
if (imagen?.codec_name !== 'h264')
  fallas.push(`la imagen va en H.264 (viene en ${imagen?.codec_name})`);
if (imagen?.width !== 720 || imagen?.height !== 1280)
  fallas.push(`va vertical de 720×1280 (viene de ${imagen?.width}×${imagen?.height})`);
if (imagen?.pix_fmt !== 'yuv420p')
  fallas.push(`el color va en yuv420p (viene en ${imagen?.pix_fmt})`);
if (sonido && sonido.codec_name !== 'aac')
  fallas.push(`el sonido va en AAC (viene en ${sonido.codec_name})`);
const segundos = Math.round(Number(sonda.format.duration));
if (!(segundos > 0)) fallas.push('no se pudo leer la duración');
if (fallas.length) {
  console.error(`✗ ${archivo} no se sube:\n  - ${fallas.join('\n  - ')}`);
  process.exit(1);
}

const huella = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
const nombre = `${id}-${idioma}-${huella}.mp4`;
let mal = 0;
for (const s of elegidos) {
  const { web, llave: nombreLlave } = SITIOS[s];
  const direccion = `${web}/media/docs-video/${nombre}`;
  const visto = await fetch(direccion, { method: 'HEAD' }).catch(() => null);
  if (visto?.ok && Number(visto.headers.get('content-length')) === bytes.length) {
    console.log(`✓ ${s}: ya estaba (${direccion})`);
    continue;
  }
  let subido = false;
  let detalle = '';
  for (let intento = 1; intento <= 3 && !subido; intento++) {
    const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/subir_archivo', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${llave(nombreLlave)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clave: `docs-video/${nombre}`,
        tipo: 'video/mp4',
        contenido_base64: bytes.toString('base64'),
      }),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    const texto = await r.text();
    let d = null;
    try {
      d = JSON.parse(texto);
    } catch {
      /* la respuesta no vino en JSON: se muestra tal cual */
    }
    subido = Boolean(r.ok && d?.ok);
    if (!subido) {
      detalle = `${r.status} ${texto.slice(0, 200)}`;
      // La API admite 120 llamadas por minuto por llave.
      await new Promise((x) =>
        setTimeout(x, d?.error === 'demasiadas_llamadas' ? 61_000 : 2000 * intento),
      );
    }
  }
  if (!subido) {
    mal++;
    console.error(`✗ ${s}: no se pudo subir (${detalle})`);
    continue;
  }
  // Se comprueba como lo pide un iPhone: los dos primeros bytes, por partes.
  const parte = await fetch(direccion, { headers: { range: 'bytes=0-1' } }).catch(() => null);
  if (parte?.status === 206 && parte.headers.get('content-range') === `bytes 0-1/${bytes.length}`)
    console.log(`✓ ${s}: subido y servido por partes (${direccion})`);
  else {
    mal++;
    console.error(
      `✗ ${s}: subido, pero ${direccion} respondió ${parte?.status ?? 'sin conexión'} (¿ya está publicada la ruta?)`,
    );
  }
}
console.log(
  `\nEn videos.ts, en «${idioma}» del video «${id}»:\n  archivo: '${nombre}',\n  portada: '/docs/video-${id}-${idioma}.webp',\ny en el video: segundos: ${segundos},`,
);
process.exit(mal ? 1 : 0);
