#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion de la Mac del equipo: carpetas y nombres fijos del propio guion, sin entrada de terceros */
// C-PLAZO-PAPELES (20 nov 2026): sube al almacén de los sitios las ocho capturas de la guía interna
// «driver-documents-grace-period» (papeles-{lista,comprobaciones,pedir,politica}-{es,en}.webp).
// Hace lo mismo que scripts/docs/subir-ayuda-interna.mjs (misma API, misma llave del llavero, mismo
// registro de huellas), porque ese guion solo lee guias.ts y no ve las que declara
// apps/servidor/src/ayudaInterna/papeles.ts.
// Uso: [SOLO=lista,politica] node scripts/staging/subir-capturas-papeles.mjs [pruebas|produccion]   (sin nada: los dos)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AYUDA_PRIVADA, CAPTURAS_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const SITIOS = {
  pruebas: { llave: 'yadominios-llave-ia-tumbite-pruebas', web: 'https://staging.tumbite.com' },
  produccion: { llave: 'yadominios-llave-ia-tumbite', web: 'https://divoox.com' },
};
const elegidos = process.argv[2] ? [process.argv[2]] : Object.keys(SITIOS);
const archivos = [];
// SOLO=lista,politica sube solo esas (las que no dependen de la comprobación automática).
const SOLO = (process.env.SOLO ?? 'lista,comprobaciones,pedir,politica').split(',');
for (const n of SOLO) for (const i of ['es', 'en']) archivos.push(`papeles-${n}-${i}.webp`);
const faltan = archivos.filter((a) => !existsSync(join(CAPTURAS_PRIVADAS, a)));
if (faltan.length) {
  console.error(`Faltan capturas en ${CAPTURAS_PRIVADAS}: ${faltan.join(', ')}`);
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
  for (const archivo of archivos) {
    const bytes = readFileSync(join(CAPTURAS_PRIVADAS, archivo));
    const huella = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    if (hechas[archivo] === huella) continue;
    let ok = false;
    for (let intento = 1; intento <= 4 && !ok; intento++) {
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
    `${sitio}: ${subidas} subidas, ${archivos.length - subidas} sin cambios, de ${archivos.length}`,
  );
}
if (fallas) process.exit(1);
