// C-DOCS-LUPA (15 nov 2026): sube las capturas nítidas de la lupa (.docs-grande/, las deja
// capturas-grandes.mjs) al almacén de los sitios de YaDominios Cloud, como
// docs-grande/<nombre>-<huella>.webp. El servidor las sirve en /media/docs-grande/.
// No van en el paquete del sitio: con ellas adentro pasó de 112 a 146 MB y no se pudo publicar.
// Solo sube las que el sitio todavía no sirve (pregunta primero a su dirección pública).
// Uso: node scripts/docs/subir-capturas-grandes.mjs [pruebas|produccion]   (sin nada: los dos)
// Las llaves salen del llavero de esta computadora (Acceso para IA de cada sitio); nunca del repo.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local sobre carpetas del repo y dos sitios fijos */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');
const carpeta = join(raiz, '.docs-grande');
const medidas = JSON.parse(
  readFileSync(join(raiz, 'apps', 'panel', 'src', 'sitio', 'docs', 'capturasMedidas.json'), 'utf8'),
);
const SITIOS = {
  pruebas: { llave: 'yadominios-llave-ia-tumbite-pruebas', web: 'https://staging.tumbite.com' },
  produccion: { llave: 'yadominios-llave-ia-tumbite', web: 'https://divoox.com' },
};
const elegidos = process.argv[2] ? [process.argv[2]] : Object.keys(SITIOS);

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

const grandes = Object.entries(medidas)
  .filter(([, m]) => m.length >= 5)
  .map(([nombre, m]) => ({ nombre, archivo: `${nombre}-${m[4]}.webp` }));

let fallas = 0;
let proximo = 0;
/** Reparte las llamadas a la API: como mucho una cada 600 ms. */
async function turno() {
  const ahora = Date.now();
  const espera = Math.max(0, proximo - ahora);
  proximo = Math.max(ahora, proximo) + 600;
  if (espera) await new Promise((r) => setTimeout(r, espera));
}
for (const sitio of elegidos) {
  const s = SITIOS[sitio];
  if (!s) throw new Error(`Sitio desconocido: ${sitio}`);
  const k = llave(s.llave);
  let subidas = 0;
  let yaEstaban = 0;
  const cola = [...grandes];
  const trabajador = async () => {
    for (let g = cola.shift(); g; g = cola.shift()) {
      const visto = await fetch(`${s.web}/media/docs-grande/${g.archivo}`, {
        method: 'HEAD',
      }).catch(() => null);
      if (visto?.ok) {
        yaEstaban++;
        continue;
      }
      const cuerpo = {
        clave: `docs-grande/${g.archivo}`,
        tipo: 'image/webp',
        contenido_base64: readFileSync(join(carpeta, `${g.nombre}.webp`)).toString('base64'),
      };
      let ok = false;
      for (let intento = 1; intento <= 4 && !ok; intento++) {
        // La API admite 120 llamadas por minuto por llave: una cada 0,6 s entre todos.
        await turno();
        const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/subir_archivo', {
          method: 'POST',
          headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' },
          body: JSON.stringify(cuerpo),
        }).catch(() => null);
        const d = r ? await r.json().catch(() => null) : null;
        ok = Boolean(d?.ok);
        if (d?.error === 'demasiadas_llamadas') await new Promise((r) => setTimeout(r, 61_000));
        if (!ok && intento === 4) {
          fallas++;
          console.error(`  ${sitio}: no se pudo subir ${g.archivo}: ${JSON.stringify(d)}`);
        }
      }
      if (ok) subidas++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabajador));
  console.log(`${sitio}: ${subidas} subidas, ${yaEstaban} ya estaban, de ${grandes.length}`);
}
if (fallas) {
  console.error(`${fallas} capturas sin subir: la lupa usará la versión liviana en esas.`);
  process.exit(1);
}
