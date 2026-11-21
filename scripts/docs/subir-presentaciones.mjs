// C-PAQUETE-DIETA (21 nov 2026): sube las presentaciones en PDF de Docs (docs/presentaciones-pdf/)
// al almacén de los sitios de YaDominios Cloud, como docs-pdf/<nombre>.pdf. El servidor las sirve en
// /docs/presentaciones/<nombre>.pdf (la dirección de siempre). No van en el paquete del sitio.
// Solo sube las que el sitio no sirve todavía o sirve con otro tamaño.
// Uso: node scripts/docs/subir-presentaciones.mjs [pruebas|produccion]   (sin nada: los dos)
// Las llaves salen del llavero de esta computadora; nunca del repo.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local sobre una carpeta del repo y dos sitios fijos */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = join(import.meta.dirname, '..', '..', 'docs', 'presentaciones-pdf');
const SITIOS = {
  pruebas: { llave: 'yadominios-llave-ia-tumbite-pruebas', web: 'https://staging.tumbite.com' },
  produccion: { llave: 'yadominios-llave-ia-tumbite', web: 'https://divoox.com' },
};
const elegidos = process.argv[2] ? [process.argv[2]] : Object.keys(SITIOS);
const llave = (nombre) => {
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
};
const archivos = readdirSync(carpeta).filter((f) => /^[a-z0-9-]+\.pdf$/.test(f));
let fallas = 0;
for (const sitio of elegidos) {
  const s = SITIOS[sitio];
  if (!s) throw new Error(`Sitio desconocido: ${sitio}`);
  const k = llave(s.llave);
  for (const f of archivos) {
    const bytes = readFileSync(join(carpeta, f));
    const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/subir_archivo', {
      method: 'POST',
      headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        clave: `docs-pdf/${f}`,
        tipo: 'application/pdf',
        contenido_base64: bytes.toString('base64'),
      }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (d?.ok) console.log(`${sitio}: ${f} (${(bytes.length / 1048576).toFixed(1)} MB) subido`);
    else {
      fallas++;
      console.error(`${sitio}: no se pudo subir ${f}: ${JSON.stringify(d).slice(0, 200)}`);
    }
    await new Promise((x) => setTimeout(x, 700));
  }
}
process.exit(fallas ? 1 : 0);
