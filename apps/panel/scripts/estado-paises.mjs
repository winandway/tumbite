// C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026): antes de compilar la web se copia en
// src/sitio/paisesAbiertos.json qué países tienen un servicio abierto al público en PRODUCCIÓN
// (GET /datos/web/paises, solo lectura y con caché). Así las páginas prearmadas (título,
// descripción y tarjeta social) salen con el estado real: la plataforma las sirve sin pasar por el
// servidor. Si producción no responde o responde algo raro, se queda lo último guardado (el
// archivo está en el repositorio) y se avisa: nunca se compila con un país inventado.
// DIVOOX_ESTADO_SIN_RED=1 lo salta (pruebas sin red). DIVOOX_ESTADO_URL cambia el origen.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const archivo = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'sitio',
  'paisesAbiertos.json',
);
const origen = process.env.DIVOOX_ESTADO_URL || 'https://divoox.com';

/** Valida la respuesta: { paises: { XX: [{ id, es, en }] } }. Devuelve null si no sirve. */
export function validar(d) {
  if (!d || typeof d !== 'object' || !d.paises || typeof d.paises !== 'object') return null;
  const paises = {};
  for (const [codigo, lista] of Object.entries(d.paises).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[A-Z]{2}$/.test(codigo) || !Array.isArray(lista)) return null;
    const limpia = [];
    for (const s of lista) {
      if (!s || typeof s.id !== 'string' || typeof s.es !== 'string' || typeof s.en !== 'string')
        return null;
      limpia.push({ id: s.id, es: s.es, en: s.en });
    }
    if (limpia.length) paises[codigo] = limpia;
  }
  return { paises };
}

async function main() {
  if (process.env.DIVOOX_ESTADO_SIN_RED === '1') return;
  let datos = null;
  try {
    const r = await fetch(`${origen}/datos/web/paises`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) datos = validar(await r.json());
    else console.warn(`estado-paises: ${origen} respondió ${r.status}; queda lo guardado`);
  } catch (e) {
    console.warn(`estado-paises: sin respuesta de ${origen}; queda lo guardado`, e?.message ?? e);
  }
  if (!datos) return;
  // Una respuesta válida pero sin ningún país (un mal minuto de la base) no cierra los países ya
  // abiertos: cerrar un país es una decisión, y se hace vaciando el archivo a mano.
  if (!Object.keys(datos.paises).length) {
    console.warn(`estado-paises: ${origen} respondió sin países; queda lo guardado`);
    return;
  }
  const nuevo = `${JSON.stringify(datos, null, 2)}\n`;
  // Solo se escribe si cambió (sin fecha adentro): compilar no ensucia el repositorio.
  if (readFileSync(archivo, 'utf8') === nuevo) return;
  writeFileSync(archivo, nuevo);
  console.log(
    `estado-paises: países abiertos según producción: ${Object.keys(datos.paises).join(', ') || 'ninguno'}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
