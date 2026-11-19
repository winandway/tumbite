/* eslint-disable security/detect-object-injection -- guion local: las llaves son los idiomas fijos «es» y «en» */
// C-DOCS-SIN-DATOS-REALES (18 nov 2026, Richard) — todos los países. Las capturas públicas son
// NEUTRAS DE LUGAR: quien vive en otra ciudad no debe creer que ahí no sirve. Esta pieza la usan los
// guiones de capturas para que ninguna muestre una ciudad ni una calle reconocible:
//   - el mapa se pinta con teselas SIN rótulos (mismas calles, sin nombres), cargado y en claro;
//   - la ciudad de la pasada se llama «Ciudad de ejemplo» / «Sample City» mientras se toman las fotos;
//   - las direcciones y los nombres son genéricos (nombres con inicial).
// Las coordenadas siguen siendo reales (el precio, la distancia y la ruta salen del servidor).

/**
 * Teselas sin nombres de calles ni de ciudades. Los mapas con teselas ya dibujadas traen los nombres
 * dentro de la imagen, así que aquí se pintan: un mapa vectorial libre (OpenFreeMap, estilo
 * «liberty», sobre OpenStreetMap; sin llave) al que se le quitan TODAS las capas de texto e íconos,
 * dibujado con MapLibre en una página aparte del mismo navegador. Mismas calles, ningún nombre.
 */
const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
const TESELA = /tile\.openstreetmap\.org\/(\d+)\/(\d+)\/(\d+)\.png/;
const cache = new Map();
let fila = Promise.resolve();

async function abrirPintor(nuevoContexto) {
  const estilo = await (await fetch(ESTILO)).json();
  estilo.layers = estilo.layers.filter((capa) => capa.type !== 'symbol');
  const ctx = await nuevoContexto({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(
    '<style>html,body,#m{margin:0;width:256px;height:256px;overflow:hidden}</style><div id="m"></div>',
  );
  await p.addStyleTag({ url: `${MAPLIBRE}.css` });
  await p.addScriptTag({ url: `${MAPLIBRE}.js` });
  await p.evaluate(
    (e) =>
      new Promise((listo, fallo) => {
        // eslint-disable-next-line no-undef -- corre dentro de la página del pintor
        const mapa = new maplibregl.Map({
          container: 'm',
          style: e,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
          center: [0, 0],
          zoom: 1,
        });
        globalThis.mapa = mapa;
        mapa.once('load', listo);
        mapa.once('error', (x) => fallo(new Error(String(x?.error?.message ?? x))));
      }),
    estilo,
  );
  return p;
}

/** El centro de la tesela z/x/y (las de 256 puntos equivalen al acercamiento z − 1 de MapLibre). */
function centro(z, x, y) {
  const n = 2 ** z;
  const lng = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return [lng, lat, z - 1];
}

function tesela(pintor, z, x, y) {
  const llave = `${z}/${x}/${y}`;
  if (cache.has(llave)) return cache.get(llave);
  // Una a la vez: el pintor es una sola página.
  const pedido = (fila = fila
    .catch(() => null)
    .then(async () => {
      const p = await pintor();
      await p.evaluate(
        ([lng, lat, zoom]) =>
          new Promise((listo) => {
            globalThis.mapa.jumpTo({ center: [lng, lat], zoom });
            globalThis.mapa.once('idle', listo);
          }),
        centro(Number(z), Number(x), Number(y)),
      );
      return p.screenshot({ type: 'png' });
    }));
  cache.set(llave, pedido);
  return pedido;
}

/** Hace que todo contexto nuevo de este navegador pinte el mapa sin rótulos y de día. */
export function mapaSinRotulos(navegador) {
  const original = navegador.newContext.bind(navegador);
  let pagina;
  const pintor = () => (pagina ??= abrirPintor(original));
  navegador.newContext = async (opciones) => {
    const ctx = await original(opciones);
    // De día: el mapa «en claro», a cualquier hora en que se tomen las fotos (C-MAPA-DIA-NOCHE).
    await ctx.addInitScript(() => localStorage.setItem('divoox.mapa.tema', 'claro'));
    let pendientes = 0;
    await ctx.route(TESELA, async (ruta) => {
      const [, z, x, y] = TESELA.exec(ruta.request().url()) ?? [];
      pendientes++;
      try {
        await ruta.fulfill({ body: await tesela(pintor, z, x, y), contentType: 'image/png' });
      } catch {
        // Sin la tesela neutra no se pinta la que trae nombres: el hueco se ve y la foto se repite.
        await ruta.abort().catch(() => null);
      } finally {
        pendientes--;
      }
    });
    // Ninguna foto sale con el mapa a medio pintar: antes de cada una se espera a que no quede
    // ninguna tesela pendiente (pintarlas tarda más que bajarlas hechas).
    const mapaListo = async () => {
      let quieto = 0;
      for (let i = 0; i < 300 && quieto < 6; i++) {
        quieto = pendientes === 0 ? quieto + 1 : 0;
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    ctx.on('page', (pagina) => {
      const foto = pagina.screenshot.bind(pagina);
      pagina.screenshot = async (opciones) => {
        await mapaListo();
        return foto(opciones);
      };
    });
    return ctx;
  };
  return navegador;
}

/** El nombre de la ciudad mientras se toman las fotos, por idioma. */
export const CIUDAD_NEUTRA = { es: 'Ciudad de ejemplo', en: 'Sample City' };

/**
 * Pone el nombre neutro a la ciudad en la base local y devuelve cómo dejarla como estaba.
 * `sql` es la puerta de diagnóstico del servidor local del recorrido.
 */
export async function ciudadNeutra(sql, zonaId, idioma) {
  const antes = (await sql(`SELECT nombre FROM zonas WHERE id = '${zonaId}'`))?.results?.[0]
    ?.nombre;
  await sql(`UPDATE zonas SET nombre = '${CIUDAD_NEUTRA[idioma]}' WHERE id = '${zonaId}'`);
  // Los viajes viejos de los guiones de punta a punta (salen en «Mis viajes») tampoco nombran un lugar.
  const D = DIRECCION[idioma];
  const conLugar = (campo) =>
    `${campo} LIKE '%Vigía%' OR ${campo} LIKE '%Novi%' OR ${campo} LIKE '%, MI%'`;
  await sql(
    `UPDATE viajes SET origen_direccion = '${D.origen}' WHERE ${conLugar('origen_direccion')}`,
  ).catch(() => null);
  await sql(
    `UPDATE viajes SET destino_direccion = '${D.destino}' WHERE ${conLugar('destino_direccion')}`,
  ).catch(() => null);
  return async () => {
    if (antes)
      await sql(`UPDATE zonas SET nombre = '${antes.replace(/'/g, "''")}' WHERE id = '${zonaId}'`);
  };
}

/** Direcciones genéricas: no existen como tales en ninguna ciudad. */
export const DIRECCION = {
  es: {
    origen: 'Plaza Central',
    destino: 'Avenida Principal 12',
    parada: 'Calle Principal 123',
    parada2: 'Avenida Central 456',
    casa: 'Avenida Principal 12, casa 4',
    local: 'Calle Principal 123',
  },
  en: {
    origen: 'Central Plaza',
    destino: '12 Main Avenue',
    parada: '123 Main Street',
    parada2: '456 Central Avenue',
    casa: '12 Main Avenue, Apt 4',
    local: '123 Main Street',
  },
};
