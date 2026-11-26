// C-REGISTRO-TODO-EL-PAIS (25 nov 2026) — Venezuela y Estados Unidos.
// Genera el catálogo de lugares donde VIVE la gente (País → Estado → Ciudad) desde los volcados
// públicos de GeoNames (licencia CC BY 4.0, https://www.geonames.org). Cero filas en la base: son
// archivos fijos que el sitio sirve en /lugares/<PAIS>/<ESTADO>.json y /lugares/<PAIS>/principales.json.
//
// Uso:  node scripts/lugares/generar-catalogo.mjs [--cache <carpeta>]
// Los volcados se bajan a una carpeta temporal FUERA del repositorio (o a --cache, para no bajarlos
// otra vez). Nada de lo bajado entra al repo: solo los archivos generados.
//
// Fila de un estado:     [lugarId, ciudad, municipio, lat, lng, poblacion]
// Fila de «principales»: [lugarId, ciudad, municipio, lat, lng, poblacion, estado]
//
// Criterio (anotado en CANDADOS.md, C-REGISTRO-TODO-EL-PAIS parte A):
// - Solo clase P de GeoNames (lugares poblados). Fuera: PPLX (barrios y secciones de una ciudad),
//   PPLH/PPLQ/PPLW (históricos, abandonados, destruidos) y PPLCH (sedes religiosas).
// - Venezuela: todos los demás (ciudades, pueblos y caseríos, PPLL incluidos): casi ninguno trae
//   población en GeoNames y ahí están los pueblos donde vive la gente.
// - Estados Unidos: los que tienen población (son los «places» del censo: ciudades, pueblos y
//   lugares designados) más las cabeceras (PPLA, PPLA2, PPLC). Los ~140 000 caseríos sin población
//   inflarían el catálogo diez veces; quien vive en uno elige su condado o la ciudad más cercana.
// - Sin repetidos: mismo nombre en el mismo municipio o condado = un solo lugar (el más poblado).
// - Coordenadas a 3 decimales (~110 m), en el formato 2 (formato.mjs).
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta temporal; claves de tablas fijas */
import { execFileSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { compactar } from './formato.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = join(RAIZ, 'apps', 'panel', 'public', 'lugares');
const FUENTE = 'https://download.geonames.org/export/dump';

const i = process.argv.indexOf('--cache');
const CACHE = i > 0 ? process.argv[i + 1] : mkdtempSync(join(tmpdir(), 'geonames-'));
mkdirSync(CACHE, { recursive: true });

/** GeoNames admin1 de Venezuela → código ISO 3166-2 del contrato (lugarCuenta.ts). */
const VE_ADMIN1 = {
  '01': 'Z',
  '02': 'B',
  '03': 'C',
  '04': 'D',
  '05': 'E',
  '06': 'F',
  '07': 'G',
  '08': 'H',
  '09': 'Y',
  11: 'I',
  12: 'J',
  13: 'K',
  14: 'L',
  15: 'M',
  16: 'N',
  17: 'O',
  18: 'P',
  19: 'R',
  20: 'S',
  21: 'T',
  22: 'U',
  23: 'V',
  25: 'A',
  26: 'X',
  // '24' Dependencias Federales (islas) no es un estado del contrato: queda fuera.
};
const ESTADOS_US =
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' ',
  );
const FUERA = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
const CABECERAS = new Set(['PPLA', 'PPLA2', 'PPLC']);

function bajar(nombre) {
  const destino = join(CACHE, nombre);
  if (!existsSync(destino)) {
    console.log(`Bajando ${nombre}…`);
    execFileSync('curl', ['-sSf', '-o', destino, `${FUENTE}/${nombre}`]);
  }
  return destino;
}

function admin2(pais) {
  const mapa = new Map();
  for (const linea of readFileSync(bajar('admin2Codes.txt'), 'utf8').split('\n')) {
    const [codigo, nombre] = linea.split('\t');
    if (!codigo?.startsWith(`${pais}.`)) continue;
    // «Municipio Libertador» → «Libertador»; «Santa Clara County» se queda como está.
    mapa.set(codigo, nombre.replace(/^Municipio\s+/i, '').trim());
  }
  return mapa;
}

const r4 = (n) => Math.round(Number(n) * 1e4) / 1e4;

async function leerPais(pais) {
  const zip = bajar(`${pais}.zip`);
  const carpeta = join(CACHE, pais.toLowerCase());
  execFileSync('unzip', ['-oq', zip, `${pais}.txt`, '-d', carpeta]);
  const municipios = admin2(pais);
  const porEstado = new Map();
  const lector = createInterface({ input: createReadStream(join(carpeta, `${pais}.txt`)) });
  for await (const linea of lector) {
    const c = linea.split('\t');
    const [id, nombre, , , lat, lng, clase, codigo, , , a1, a2, , , pob] = c;
    if (clase !== 'P' || FUERA.has(codigo)) continue;
    const poblacion = Number(pob) || 0;
    const estado = pais === 'VE' ? VE_ADMIN1[a1] : ESTADOS_US.includes(a1) ? a1 : null;
    if (!estado) continue;
    if (pais === 'US' && poblacion <= 0 && !CABECERAS.has(codigo)) continue;
    const municipio = (a2 && municipios.get(`${pais}.${a1}.${a2}`)) || '';
    const lista = porEstado.get(estado) ?? new Map();
    porEstado.set(estado, lista);
    // Repetidos: mismo nombre en el mismo municipio → el más poblado (o la cabecera).
    const clave = `${nombre.toLowerCase()}|${municipio}`;
    const previo = lista.get(clave);
    const fila = [`gn:${id}`, nombre, municipio, r4(lat), r4(lng), poblacion];
    const peso = poblacion + (CABECERAS.has(codigo) ? 1e9 : 0);
    if (!previo || peso > previo.peso) lista.set(clave, { fila, peso, codigo });
  }
  return porEstado;
}

function ordenar(filas) {
  return filas.sort((a, b) => b[5] - a[5] || a[1].localeCompare(b[1], 'es'));
}

const COMPROBAR = {
  VE: ['Maracaibo', 'Caracas', 'El Vigía', 'Tucaní', 'Mérida', 'Barquisimeto', 'Valencia'],
  US: ['Gilroy', 'San Jose', 'San Francisco', 'Los Angeles', 'New York City', 'Novi', 'Miami'],
};

let totalBytes = 0;
let totalArchivos = 0;
for (const pais of ['VE', 'US']) {
  const porEstado = await leerPais(pais);
  const dir = join(SALIDA, pais);
  mkdirSync(dir, { recursive: true });
  const todos = [];
  for (const [estado, lista] of [...porEstado].sort()) {
    const filas = ordenar([...lista.values()].map((x) => x.fila));
    // Formato 2 (formato.mjs): municipios por índice, coordenadas en milésimas, sin población.
    const texto = JSON.stringify(compactar(filas));
    writeFileSync(join(dir, `${estado}.json`), texto);
    totalBytes += texto.length;
    totalArchivos++;
    for (const x of lista.values()) todos.push({ ...x, estado });
  }
  // Principales: para sugerir desde la primera letra sin elegir estado.
  // Venezuela: las que tienen población y todas las cabeceras de municipio.
  // Estados Unidos: las de 15 000 habitantes o más y las capitales (las demás, eligiendo el estado).
  const principales = ordenar(
    todos
      .filter((x) =>
        pais === 'VE'
          ? x.fila[5] > 0 || CABECERAS.has(x.codigo)
          : x.fila[5] >= 15000 || x.codigo === 'PPLA' || x.codigo === 'PPLC',
      )
      .map((x) => [...x.fila, x.estado]),
  );
  const texto = JSON.stringify(compactar(principales, true));
  writeFileSync(join(dir, 'principales.json'), texto);
  totalBytes += texto.length;
  totalArchivos++;
  const faltan = COMPROBAR[pais].filter((n) => !principales.some((f) => f[1] === n));
  if (faltan.length) throw new Error(`${pais}: faltan en principales: ${faltan.join(', ')}`);
  const estadosEsperados = pais === 'VE' ? Object.values(VE_ADMIN1) : ESTADOS_US;
  const sinArchivo = estadosEsperados.filter((e) => !porEstado.has(e));
  if (sinArchivo.length) throw new Error(`${pais}: estados sin lugares: ${sinArchivo.join(', ')}`);
  console.log(
    `${pais}: ${porEstado.size} estados, ${todos.length} lugares, ${principales.length} principales`,
  );
}
writeFileSync(
  join(SALIDA, 'ATRIBUCION.txt'),
  'Lugares poblados de Venezuela y Estados Unidos: GeoNames (https://www.geonames.org), licencia CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).\n' +
    'Filtrados y compactados por Divoox (sin barrios ni lugares abandonados, coordenadas a 3 decimales).\n',
);
console.log(`Listo: ${totalArchivos} archivos, ${Math.round(totalBytes / 1024)} KB en ${SALIDA}`);
