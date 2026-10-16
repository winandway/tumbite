// Revisa un paquete ANTES de publicarlo (C-ENTORNOS-SEPARADOS). Falla si encuentra:
//   - una app que apunte al servidor de otro entorno;
//   - referencias del sitio de pruebas en producción, o de producción como servidor en pruebas;
//   - cualquier secreto dentro del paquete (llaves de Stripe, avisos, tokens de YaDominios…);
//   - piezas que faltan (_worker.js, schema.sql, las tres apps, el panel).
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
const recorrer = (d) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
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
const SERVIDOR_PRODUCCION = /["'`]https:\/\/tumbite\.com["'`]|https:\/\/tumbite\.com\/datos/;
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
if (
  existsSync(join(carpeta, '.entorno')) &&
  readFileSync(join(carpeta, '.entorno'), 'utf8').trim() !== entorno
)
  problemas.push('el paquete dice ser de otro entorno');

if (problemas.length) {
  for (const p of problemas) console.error(`::error::${p}`);
  console.error(`El paquete de ${entorno} NO se publica: ${problemas.length} problema(s).`);
  process.exit(1);
}
console.log(
  `Paquete de ${entorno} revisado: ${archivos.length} archivos, sin direcciones cruzadas ni secretos.`,
);
