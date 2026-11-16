// C-DOCS-LUPA (15 nov 2026): la lupa de Docs muestra cada captura en grande y nítida.
// Las capturas de Docs son livianas (las del celular van a 540 de ancho, ver a-docs.mjs). Este guion
// busca la ORIGINAL de cada una en docs/capturas/ y, si es bastante más grande, deja una segunda
// versión en .docs-grande/<nombre>.webp (fuera de git y del paquete del sitio: con ellas adentro el
// paquete no se pudo publicar). Escribe las medidas de todas y la huella de cada grande (las pide el
// visor). Después: node scripts/docs/subir-capturas-grandes.mjs las sube al almacén de los sitios.
// Uso: node scripts/docs/capturas-grandes.mjs        (rehace solo las que faltan o cambiaron)
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: rutas y nombres salen de las carpetas del propio repositorio */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');
const publicas = join(raiz, 'apps', 'panel', 'public', 'docs');
const grandes = join(raiz, '.docs-grande');
const originales = join(raiz, 'docs', 'capturas');
const salida = join(raiz, 'apps', 'panel', 'src', 'sitio', 'docs', 'capturasMedidas.json');
const ANCHO_MAXIMO = 2000;
const CUANTO_MAS_GRANDE = 1.4;

function medidas(archivo) {
  if (extname(archivo) === '.webp') {
    const t = execFileSync('webpinfo', ['-summary', archivo], { encoding: 'utf8' });
    const w = Number(/Width:\s*(\d+)/.exec(t)?.[1]);
    const h = Number(/Height:\s*(\d+)/.exec(t)?.[1]);
    return [w, h];
  }
  const t = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', archivo], {
    encoding: 'utf8',
  });
  return [Number(/pixelWidth:\s*(\d+)/.exec(t)?.[1]), Number(/pixelHeight:\s*(\d+)/.exec(t)?.[1])];
}

function todos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? todos(join(dir, d.name)) : [join(dir, d.name)],
  );
}

// Las originales por nombre (sin extensión). Las del recorrido se llaman recorrido-<nombre> en Docs.
const porNombre = new Map();
for (const f of todos(originales).filter((x) => /\.(png|jpe?g)$/i.test(x))) {
  const n = basename(f).replace(/\.(png|jpe?g)$/i, '');
  const claves = f.includes(`${join('capturas', 'recorrido')}/`) ? [`recorrido-${n}`, n] : [n];
  for (const c of claves) porNombre.set(c, [...(porNombre.get(c) ?? []), f]);
}

const anterior = existsSync(salida) ? JSON.parse(readFileSync(salida, 'utf8')) : {};
mkdirSync(grandes, { recursive: true });
const manifiesto = {};
let hechas = 0;
for (const archivo of readdirSync(publicas)
  .filter((f) => f.endsWith('.webp'))
  .sort()) {
  const nombre = archivo.replace(/\.webp$/, '');
  const ruta = join(publicas, archivo);
  const [w, h] = medidas(ruta);
  manifiesto[nombre] = [w, h];
  // La original tiene que ser LA MISMA imagen (misma proporción), no otra con el mismo nombre.
  const candidatas = (porNombre.get(nombre) ?? [])
    .map((f) => ({ f, m: medidas(f) }))
    .filter(({ m }) => Math.abs(m[1] / m[0] - h / w) < 0.02 && m[0] >= w * CUANTO_MAS_GRANDE)
    .sort((a, b) => b.m[0] - a.m[0]);
  const mejor = candidatas[0];
  if (!mejor) continue;
  const gw = Math.min(mejor.m[0], ANCHO_MAXIMO);
  const gh = Math.round((mejor.m[1] * gw) / mejor.m[0]);
  const destino = join(grandes, archivo);
  const vieja = anterior[nombre];
  const alDia =
    existsSync(destino) &&
    vieja?.[2] === gw &&
    statSync(destino).mtimeMs >= statSync(mejor.f).mtimeMs;
  if (!alDia) {
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '80',
      '-resize',
      String(gw),
      '0',
      mejor.f,
      '-o',
      destino,
    ]);
    hechas++;
  }
  const huella = createHash('sha256').update(readFileSync(destino)).digest('hex').slice(0, 8);
  manifiesto[nombre] = [w, h, gw, gh, huella];
}
writeFileSync(salida, `${JSON.stringify(manifiesto, null, 0).replace(/\],"/g, '],\n"')}\n`);
const conGrande = Object.values(manifiesto).filter((m) => m.length >= 4).length;
console.log(
  `lupa: ${Object.keys(manifiesto).length} capturas medidas, ${conGrande} con versión grande (${hechas} rehechas)`,
);
