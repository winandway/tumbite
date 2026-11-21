// C-VER-VIDEO (21 nov 2026): enciende (o apaga) el video de ayuda de una pantalla de las apps, el
// del enlace «Ver video». Sube el MP4 al almacén del sitio con scripts/docs/subir-video.mjs (que
// revisa que sea vertical, H.264, con arranque rápido y de menos de 12 MB) y guarda el ajuste
// `videos_ayuda`. Las apps lo muestran solas a los pocos minutos: NO hay que compilar nada.
//
// Uso:  node scripts/docs/encender-video-ayuda.mjs <clave> <es|en> <archivo.mp4> [pruebas|produccion]
//       node scripts/docs/encender-video-ayuda.mjs <clave> <es|en> apagar        [pruebas|produccion]
//       (sin sitio: los dos). Claves: las de CLAVES_VIDEO_AYUDA (hoy: fotos-entrada).
// Las llaves salen del llavero de esta computadora (Acceso para IA de cada sitio); nunca del repo.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local sobre un archivo que se pasa a mano y dos sitios fijos */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITIOS = {
  pruebas: { llave: 'yadominios-llave-ia-tumbite-pruebas', web: 'https://staging.tumbite.com' },
  produccion: { llave: 'yadominios-llave-ia-tumbite', web: 'https://divoox.com' },
};
const CLAVES = ['fotos-entrada'];
const [clave, idioma, archivo, sitio] = process.argv.slice(2);
if (!CLAVES.includes(clave) || !['es', 'en'].includes(idioma) || !archivo) {
  console.error(
    `Uso: node scripts/docs/encender-video-ayuda.mjs <${CLAVES.join('|')}> <es|en> <archivo.mp4|apagar> [pruebas|produccion]`,
  );
  process.exit(2);
}
const elegidos = sitio ? [sitio] : Object.keys(SITIOS);
for (const s of elegidos) if (!SITIOS[s]) throw new Error(`Sitio desconocido: ${s}`);
const raiz = join(import.meta.dirname, '..', '..');

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
async function sql(s, consulta, params = []) {
  const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/consultar_base', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${llave(SITIOS[s].llave)}`,
    },
    body: JSON.stringify({ sql: consulta, params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok)
    throw new Error(`${s}: la base respondió ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d.resultado.results ?? [];
}

const apagar = archivo === 'apagar';
const id = `ayuda-${clave}`;
let nombre = null;
if (!apagar) {
  // El mismo nombre que le pone subir-video: <id>-<idioma>-<huella>.mp4
  const huella = createHash('sha256').update(readFileSync(archivo)).digest('hex').slice(0, 8);
  nombre = `${id}-${idioma}-${huella}.mp4`;
  execFileSync(
    'node',
    [join(raiz, 'scripts/docs/subir-video.mjs'), id, idioma, archivo, ...(sitio ? [sitio] : [])],
    {
      stdio: 'inherit',
    },
  );
}
for (const s of elegidos) {
  if (nombre) {
    const visto = await fetch(`${SITIOS[s].web}/media/docs-video/${nombre}`, { method: 'HEAD' });
    if (!visto.ok)
      throw new Error(`${s}: el video no quedó en el almacén (${visto.status}); no se enciende.`);
  }
  const filas = await sql(s, "SELECT valor FROM config WHERE clave = 'videos_ayuda'");
  const ajuste = filas[0]?.valor ? JSON.parse(filas[0].valor) : {};
  const deLaPantalla = { ...(ajuste[clave] ?? {}) };
  if (nombre) deLaPantalla[idioma] = nombre;
  else delete deLaPantalla[idioma];
  if (Object.keys(deLaPantalla).length) ajuste[clave] = deLaPantalla;
  else delete ajuste[clave];
  await sql(
    s,
    "INSERT INTO config (clave, valor) VALUES ('videos_ayuda', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    [JSON.stringify(ajuste)],
  );
  console.log(
    `✓ ${s}: «Ver video» de ${clave} en ${idioma} ${nombre ? `encendido (${nombre})` : 'apagado'}. Las apps lo leen en unos cinco minutos: ${SITIOS[s].web}/datos/videos-ayuda`,
  );
}
