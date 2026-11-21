// C-DATOS-PAIS (21 nov 2026): arma los datos estáticos de país desde sus fuentes oficiales.
// Uso: node scripts/pais/generar-datos-pais.mjs [VE]
//
// - Territorio: OCHA, conjunto «cod-ab-<iso3>» en HDX (Venezuela: fuente INE, licencia CC BY-IGO).
//   Sale la lista completa (entidades, municipios, parroquias con su P-code, nombre y centro) para el
//   código, y los contornos simplificados para el mapa del panel y para ubicar una zona en su
//   municipio. Los contornos son archivos del sitio (apps/panel/public/territorio/<ISO>/), nunca
//   filas de la base ni parte del servidor.
// - Operadoras: archivos «carrier» de libphonenumber de Google (Apache 2.0), solo los países que
//   servimos.
// Para sumar un país: su entrada en FUENTES_TERRITORIO (o su propio lector si no es de OCHA, como
// DIVIPOLA del DANE para Colombia) y su prefijo en PREFIJOS_OPERADORAS. Se vuelve a correr y listo.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local que escribe en carpetas fijas del repo y lee tablas fijas */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATOS = join(RAIZ, 'packages/compartido/src/pais/datos');
const PUBLICO = join(RAIZ, 'apps/panel/public/territorio');

const FUENTES_TERRITORIO = {
  VE: {
    conjunto: 'cod-ab-ven',
    prefijo: 'ven',
    fuente: 'Instituto Nacional de Estadística (INE), vía OCHA (HDX, conjunto cod-ab-ven)',
    licencia: 'CC BY-IGO',
    url: 'https://data.humdata.org/dataset/cod-ab-ven',
  },
};
/** Prefijos telefónicos cuyas operadoras se guardan (los de los países donde trabajamos). */
const PREFIJOS_OPERADORAS = ['58', '57', '51'];
const MAPSHAPER = 'mapshaper@0.7.101';

const pedidos = process.argv.slice(2);
const paises = pedidos.length ? pedidos : Object.keys(FUENTES_TERRITORIO);
mkdirSync(DATOS, { recursive: true });

async function bajar(url, destino) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

const redondear = (n) => Math.round(Number(n) * 1e5) / 1e5;

for (const iso of paises) {
  const f = FUENTES_TERRITORIO[iso];
  if (!f) throw new Error(`No hay fuente de territorio para ${iso}`);
  const meta = await (
    await fetch(`https://data.humdata.org/api/3/action/package_show?id=${f.conjunto}`)
  ).json();
  const recurso = meta.result.resources.find((r) => /geojson/i.test(r.format));
  if (!recurso) throw new Error(`${f.conjunto} no trae GeoJSON`);
  const tmp = mkdtempSync(join(tmpdir(), `territorio-${iso}-`));
  await bajar(recurso.url, join(tmp, 'contornos.zip'));
  execFileSync('unzip', ['-o', '-q', join(tmp, 'contornos.zip'), '-d', join(tmp, 'g')]);
  const archivo = (n) => {
    const nombre = readdirSync(join(tmp, 'g')).find((x) => x === `${f.prefijo}_admin${n}.geojson`);
    if (!nombre) throw new Error(`Falta el nivel ${n} en ${f.conjunto}`);
    return join(tmp, 'g', nombre);
  };
  const leer = (n) =>
    JSON.parse(readFileSync(archivo(n), 'utf8')).features.map((x) => x.properties);
  const entidades = leer(1).map((p) => ({
    c: p.adm1_pcode,
    n: p.adm1_name,
    lat: redondear(p.center_lat),
    lng: redondear(p.center_lon),
  }));
  const municipios = leer(2).map((p) => ({
    c: p.adm2_pcode,
    n: p.adm2_name,
    p: p.adm1_pcode,
    lat: redondear(p.center_lat),
    lng: redondear(p.center_lon),
  }));
  const parroquias = leer(3).map((p) => ({
    c: p.adm3_pcode,
    n: p.adm3_name,
    p: p.adm2_pcode,
    lat: redondear(p.center_lat),
    lng: redondear(p.center_lon),
  }));
  const orden = (a, b) => a.c.localeCompare(b.c);
  const territorio = {
    pais: iso,
    fuente: f.fuente,
    licencia: f.licencia,
    url: f.url,
    vigente: leer(1)[0]?.valid_on ?? null,
    entidades: entidades.sort(orden),
    municipios: municipios.sort(orden),
    parroquias: parroquias.sort(orden),
  };
  writeFileSync(join(DATOS, `territorio-${iso}.json`), `${JSON.stringify(territorio)}\n`);
  // Contornos simplificados (≈11 m de precisión), solo con el P-code, el nombre y su padre.
  const dir = join(PUBLICO, iso);
  mkdirSync(dir, { recursive: true });
  const niveles = [
    [1, 'entidades', 'c=adm1_pcode,n=adm1_name'],
    [2, 'municipios', 'c=adm2_pcode,n=adm2_name,p=adm1_pcode'],
    [3, 'parroquias', 'c=adm3_pcode,n=adm3_name,p=adm2_pcode'],
  ];
  // Las parroquias van en un archivo por entidad (parroquias/VE14.json): el mapa las carga al mirar
  // ese estado, y ningún archivo del sitio pasa de 400 KB (C-PAQUETE-DIETA).
  for (const [n, nombre, campos] of niveles) {
    const partir = n === 3;
    if (partir) mkdirSync(join(dir, nombre), { recursive: true });
    const salida = partir ? join(dir, nombre) : join(dir, `${nombre}.json`);
    execFileSync(
      'npx',
      [
        '-y',
        MAPSHAPER,
        archivo(n),
        '-rename-fields',
        campos,
        '-filter-fields',
        n === 1 ? 'c,n' : 'c,n,p',
        ...(partir ? ['-each', 'e = p.slice(0, 4)', '-split', 'e', '-filter-fields', 'c,n,p'] : []),
        '-simplify',
        '4%',
        'keep-shapes',
        '-o',
        'precision=0.0001',
        'format=geojson',
        ...(partir ? ['extension=.json'] : []),
        salida + (partir ? '/' : ''),
      ],
      { stdio: 'inherit' },
    );
  }
  writeFileSync(
    join(dir, 'ATRIBUCION.txt'),
    `Límites administrativos de ${iso}: ${f.fuente}. Licencia ${f.licencia}. ${f.url}\nSimplificados por Divoox para mostrarlos en el mapa; la fuente oficial manda.\n`,
  );
  console.log(
    `${iso}: ${entidades.length} entidades, ${municipios.length} municipios, ${parroquias.length} parroquias`,
  );
}

// Operadoras: prefijo (con el código del país) → nombre de la operadora.
const operadoras = {};
for (const cc of PREFIJOS_OPERADORAS) {
  const r = await fetch(
    `https://raw.githubusercontent.com/google/libphonenumber/master/resources/carrier/en/${cc}.txt`,
  );
  if (!r.ok) throw new Error(`Operadoras de +${cc}: ${r.status}`);
  for (const linea of (await r.text()).split('\n')) {
    const m = /^(\d+)\|(.+)$/.exec(linea.trim());
    if (m) operadoras[m[1]] = m[2].trim();
  }
}
writeFileSync(
  join(DATOS, 'operadoras.json'),
  `${JSON.stringify({ fuente: 'Google libphonenumber, resources/carrier (Apache 2.0)', prefijos: operadoras })}\n`,
);
console.log(
  `operadoras: ${Object.keys(operadoras).length} prefijos (${PREFIJOS_OPERADORAS.join(', ')})`,
);
