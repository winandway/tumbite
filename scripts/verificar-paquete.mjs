// Revisa un paquete ANTES de publicarlo (C-ENTORNOS-SEPARADOS). Falla si encuentra:
//   - una app que apunte al servidor de otro entorno;
//   - referencias del sitio de pruebas en producción, o de producción como servidor en pruebas;
//   - cualquier secreto dentro del paquete (llaves de Stripe, avisos, tokens de YaDominios…);
//   - piezas que faltan (_worker.js, schema.sql, las tres apps, el panel).
//   - una ruta con «@» (la plataforma la redirige con 307; C-RUTAS-SIN-ARROBA).
//   - un paquete más grande que el tope (C-PAQUETE-TOPE): la plataforma no lo publica y no avisa.
//   - (con <commit>) una pieza que no lleve grabado el commit de ESTA publicación (C-VERSION-DEL-ARTEFACTO).
// Uso: node scripts/verificar-paquete.mjs <carpeta> <pruebas|produccion> [commit]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [carpeta, entorno, commitPedido = ''] = process.argv.slice(2);
if (!carpeta || !['pruebas', 'produccion'].includes(entorno)) {
  console.error('Uso: node scripts/verificar-paquete.mjs <carpeta> <pruebas|produccion>');
  process.exit(2);
}
const problemas = [];
const archivos = [];
let bytes = 0;
const recorrer = (d) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    if (!statSync(r).isDirectory()) bytes += statSync(r).size;
    // C-RUTAS-SIN-ARROBA (LAN-6): la plataforma redirige con 307 toda ruta con «@».
    if (n.includes('@'))
      problemas.push(
        `${relative(carpeta, r)}: lleva «@» en la ruta (corre scripts/sin-arroba.mjs)`,
      );
    if (statSync(r).isDirectory()) recorrer(r);
    else if (/\.(js|mjs|html|json|txt|xml)$/.test(n)) archivos.push(r);
  }
};
recorrer(carpeta);

for (const pieza of [
  '_worker.js',
  'schema.sql',
  'yadominios.json',
  'index.html',
  'app/index.html',
  'driver/index.html',
  'restaurant/index.html',
])
  if (!existsSync(join(carpeta, pieza))) problemas.push(`falta ${pieza}`);

const SECRETOS = [
  /sk_(live|test)_[A-Za-z0-9]{8,}/,
  /rk_(live|test)_[A-Za-z0-9]{8,}/,
  /whsec_[A-Za-z0-9]{8,}/,
  /ydk_[A-Za-z0-9]{8,}/,
  /pk_(live|test)_[A-Za-z0-9]{20,}/,
];
// La DIRECCIÓN del sitio de pruebas (el nombre suelto sí aparece: así se reconoce cada entorno).
const PRUEBAS = /https:\/\/(staging\.tumbite\.com|tumbite-pruebas\.sitios\.dev)/;
// C-TUMBITE-REDIRIGE: producción se construye con divoox.com (tumbite.com sigue valiendo en paquetes viejos).
const SERVIDOR_PRODUCCION =
  /["'`]https:\/\/(divoox|tumbite)\.com["'`]|https:\/\/(divoox|tumbite)\.com\/datos/;
const SERVIDOR_PRUEBAS = /["'`]https:\/\/staging\.tumbite\.com["'`]/;

for (const a of archivos) {
  const t = readFileSync(a, 'utf8');
  const r = relative(carpeta, a);
  for (const s of SECRETOS)
    if (s.test(t))
      problemas.push(`${r}: contiene algo que parece un secreto (${s.source.slice(0, 12)}…)`);
  const esApp = /^(app|driver|restaurant)\//.test(r) && r.endsWith('.js');
  if (entorno === 'produccion') {
    if (PRUEBAS.test(t))
      problemas.push(`${r}: referencia al sitio de PRUEBAS en un paquete de producción`);
  } else if (esApp && SERVIDOR_PRODUCCION.test(t) && !SERVIDOR_PRUEBAS.test(t)) {
    problemas.push(`${r}: app de pruebas construida con el servidor de PRODUCCIÓN`);
  }
}
// Cada app tiene que traer el servidor de su entorno.
const esperado = entorno === 'produccion' ? SERVIDOR_PRODUCCION : SERVIDOR_PRUEBAS;
for (const app of ['app', 'driver', 'restaurant']) {
  const js = archivos.filter(
    (a) => relative(carpeta, a).startsWith(`${app}/`) && a.endsWith('.js'),
  );
  if (!js.some((a) => esperado.test(readFileSync(a, 'utf8'))))
    problemas.push(`${app}: no trae la dirección de ${entorno}`);
}
// C-VERSION-DEL-ARTEFACTO: el servidor, la web y las tres apps llevan el commit de ESTA publicación.
if (/^[0-9a-f]{7,40}$/i.test(commitPedido)) {
  const c = commitPedido.slice(0, 7).toLowerCase();
  // El commit entero o sus 7 primeros: los dos empiezan igual.
  const lleva = (a) => readFileSync(a, 'utf8').includes(`"${c}`);
  if (existsSync(join(carpeta, '_worker.js')) && !lleva(join(carpeta, '_worker.js')))
    problemas.push(`_worker.js: el servidor no lleva grabado el commit ${c}`);
  if (
    existsSync(join(carpeta, 'index.html')) &&
    !readFileSync(join(carpeta, 'index.html'), 'utf8').includes(`name="version" content="${c}"`)
  )
    problemas.push(`index.html: la web no lleva el commit ${c}`);
  for (const app of ['app', 'driver', 'restaurant']) {
    const js = archivos.filter(
      (a) => relative(carpeta, a).startsWith(`${app}/`) && a.endsWith('.js'),
    );
    if (!js.some(lleva)) problemas.push(`${app}: la app no lleva grabado el commit ${c}`);
  }
}
// C-PRUEBAS-SIN-INDEXAR: pruebas cerrado a los buscadores; producción NUNCA con noindex.
const leer = (r) => (existsSync(join(carpeta, r)) ? readFileSync(join(carpeta, r), 'utf8') : '');
const noindex = /<meta name="robots" content="noindex/;
if (entorno === 'pruebas') {
  if (!/Disallow: \/\s*$/m.test(leer('robots.txt')))
    problemas.push('robots.txt: el sitio de pruebas debe cerrar todo (Disallow: /)');
  if (!noindex.test(leer('index.html')))
    problemas.push('index.html: el sitio de pruebas debe llevar noindex (scripts/sin-indexar.mjs)');
} else if (noindex.test(leer('index.html')) || /Disallow: \/\s*$/m.test(leer('robots.txt'))) {
  problemas.push(
    'producción no puede llevar noindex ni cerrar robots.txt: Google dejaría de ver divoox.com',
  );
}
if (
  existsSync(join(carpeta, '.entorno')) &&
  readFileSync(join(carpeta, '.entorno'), 'utf8').trim() !== entorno
)
  problemas.push('el paquete dice ser de otro entorno');

// C-PAQUETE-TOPE (15 nov 2026): a 133 MB la plataforma falló con «Memory limit exceeded» y el sitio
// siguió sirviendo la versión anterior sin avisar; a 109 MB publicaba bien. Tope con margen.
// C-PAQUETE-DIETA (21 nov 2026): con 120 de tope el paquete llegó a 120,2 y se quedó sin publicar a
// media entrega. El tope baja a 112: avisa con 8 MB de margen frente a lo que la plataforma aguanta.
const topeMb = Number(process.env.PAQUETE_TOPE_MB ?? 112);
if (bytes > topeMb * 1024 * 1024)
  problemas.push(
    `el paquete pesa ${(bytes / 1048576).toFixed(1)} MB y el tope es ${topeMb} MB: la plataforma no lo publicaría (mira qué creció: fuentes, imágenes, PDF)`,
  );
// C-BARRA-LIGERA (21 nov 2026): las páginas prearmadas pesaban 42 MB porque cada una repetía la barra
// de Docs entera y la lámina completa de íconos. Con la barra ligera pesan unos 23 MB. Si vuelven a
// engordar, o si una página trae otra vez las secciones cerradas desplegadas, no se publica.
const paginas = archivos.filter((a) => a.endsWith('.html'));
const bytesPaginas = paginas.reduce((s, a) => s + statSync(a).size, 0);
const topePaginasMb = Number(process.env.PAGINAS_TOPE_MB ?? 30);
if (bytesPaginas > topePaginasMb * 1024 * 1024)
  problemas.push(
    `las páginas prearmadas pesan ${(bytesPaginas / 1048576).toFixed(1)} MB y su tope es ${topePaginasMb} MB (mira apps/panel/scripts/barraLigera.mjs: ¿algo se repite en todas?)`,
  );
for (const a of paginas) {
  const html = readFileSync(a, 'utf8');
  const i = html.indexOf('<aside class="docs-barra');
  if (i === -1) continue;
  const barra = html.slice(i, html.indexOf('</aside>', i));
  if (barra.includes('<details><summary>')) {
    problemas.push(
      `${relative(carpeta, a)}: la barra de Docs viaja entera (falta barraLigera en el prearmado)`,
    );
    break;
  }
}
if (problemas.length) {
  for (const p of problemas) console.error(`::error::${p}`);
  console.error(`El paquete de ${entorno} NO se publica: ${problemas.length} problema(s).`);
  process.exit(1);
}
console.log(
  `Paquete de ${entorno} revisado: ${archivos.length} archivos, sin direcciones cruzadas ni secretos.`,
);
