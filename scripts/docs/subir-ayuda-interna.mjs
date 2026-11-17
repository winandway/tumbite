// C-AYUDA-INTERNA (16 nov 2026, Richard): sube las capturas de la ayuda del equipo (el «?» del
// superadmin) al almacén de los sitios de YaDominios Cloud, como ayuda-interna/<archivo>.webp. El
// servidor las entrega SOLO con la sesión del equipo (/datos/admin/ayuda/captura/<archivo>).
// Las WebP viven en la carpeta privada (~/Divoox-privado/ayuda-interna/capturas), nunca en el repo.
// Comprueba que estén todas las que nombran las guías y solo sube las que cambiaron (anota la huella
// de cada una por sitio en la carpeta privada).
// Uso: node scripts/docs/subir-ayuda-interna.mjs [pruebas|produccion]   (sin nada: los dos)
// Las llaves salen del llavero de esta computadora (Acceso para IA de cada sitio); nunca del repo.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local sobre la carpeta privada y dos sitios fijos */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AYUDA_PRIVADA, CAPTURAS_PRIVADAS } from './ayudaPrivada.mjs';

const raiz = join(import.meta.dirname, '..', '..');
const SITIOS = {
  pruebas: { llave: 'yadominios-llave-ia-tumbite-pruebas' },
  produccion: { llave: 'yadominios-llave-ia-tumbite' },
};
const elegidos = process.argv[2] ? [process.argv[2]] : Object.keys(SITIOS);

// Los archivos que nombran las guías (apps/servidor/src/ayudaInterna/guias.ts).
const guias = readFileSync(
  join(raiz, 'apps', 'servidor', 'src', 'ayudaInterna', 'guias.ts'),
  'utf8',
);
const archivos = new Set();
for (const [, nombre, idioma] of guias.matchAll(/\bfoto\(\s*'([a-z0-9-]+)',\s*'(es|en)'/g))
  archivos.add(`monitoreo-${nombre}-${idioma}.webp`);
for (const [, nombre, idioma] of guias.matchAll(/fotoModeracion\(\s*'([a-z0-9-]+)',\s*'(es|en)'/g))
  archivos.add(`recorrido-moderacion-${nombre}-${idioma}.webp`);
// C-CUPON-DIVOOX: las de «Regalos Divoox» (capRegalo).
for (const [, nombre, idioma] of guias.matchAll(/capRegalo\(\s*'([a-z0-9-]+)',\s*'(es|en)'/g))
  archivos.add(`regalos-divoox-${nombre}-${idioma}.webp`);
for (const [, archivo] of guias.matchAll(/archivo: '([a-z0-9-]+\.webp)'/g)) archivos.add(archivo);
const faltan = [...archivos].filter((a) => !existsSync(join(CAPTURAS_PRIVADAS, a)));
if (faltan.length) {
  console.error(
    `Faltan ${faltan.length} capturas en ${CAPTURAS_PRIVADAS}:\n  ${faltan.join('\n  ')}`,
  );
  process.exit(1);
}

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

let fallas = 0;
for (const sitio of elegidos) {
  const s = SITIOS[sitio];
  if (!s) throw new Error(`Sitio desconocido: ${sitio}`);
  const k = llave(s.llave);
  const registro = join(AYUDA_PRIVADA, `subidas-${sitio}.json`);
  const hechas = existsSync(registro) ? JSON.parse(readFileSync(registro, 'utf8')) : {};
  let subidas = 0;
  for (const archivo of [...archivos].sort()) {
    const bytes = readFileSync(join(CAPTURAS_PRIVADAS, archivo));
    const huella = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    if (hechas[archivo] === huella) continue;
    let ok = false;
    for (let intento = 1; intento <= 4 && !ok; intento++) {
      // La API admite 120 llamadas por minuto por llave: una cada 0,6 s.
      await new Promise((r) => setTimeout(r, 600));
      const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/subir_archivo', {
        method: 'POST',
        headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          clave: `ayuda-interna/${archivo}`,
          tipo: 'image/webp',
          contenido_base64: bytes.toString('base64'),
        }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => null) : null;
      ok = Boolean(d?.ok);
      if (d?.error === 'demasiadas_llamadas') await new Promise((w) => setTimeout(w, 61_000));
      if (!ok && intento === 4) {
        fallas++;
        console.error(`  ${sitio}: no se pudo subir ${archivo}: ${JSON.stringify(d)}`);
      }
    }
    if (ok) {
      hechas[archivo] = huella;
      subidas++;
      writeFileSync(registro, JSON.stringify(hechas, null, 2));
    }
  }
  console.log(
    `${sitio}: ${subidas} subidas, ${archivos.size - subidas} sin cambios, de ${archivos.size}`,
  );
}
if (fallas) {
  console.error(`${fallas} capturas sin subir: la ayuda mostrará el hueco de esas.`);
  process.exit(1);
}
