/* global document, getComputedStyle */
/* eslint-disable security/detect-non-literal-fs-filename -- rutas armadas con carpetas fijas de este repositorio */
// La foto de la puerta (C-FOTO-PUERTA, 15 nov 2026) — todos los países. Prueba en pantalla, de punta a
// punta, con las apps web reales del cliente (/app) y del Driver (/driver/), contra el servidor local del
// recorrido (.recorrido, puerto 8790; lo arma `node scripts/recorrido/preparar.mjs`). No solo captura:
// cada paso lleva su comprobación y, si una falla, el guion se para con el motivo.
//   a) Cliente, casa: la hoja sale al guardar una dirección nueva; «Casa»; una foto por «Tomar foto» y
//      otra por «Subir desde archivos»; cambiar una y borrar otra desde los tres puntos; «Listo».
//   b) Cliente, edificio (con apartamento): tres fotos en orden entrada, paso intermedio, puerta.
//   c) Borrador del carrito: recargar a mitad del formulario devuelve lo escrito; una subida fallida
//      deja la foto en pantalla con «Reintentar» y no limpia nada.
//   d) Tarjeta del carrito con sus miniaturas; el pedido creado guarda `direccion_id`.
//   e) Driver asignado: sin miniatura antes de recoger; con miniatura en camino; la hoja a media altura
//      (el mapa y la tarjeta del pedido siguen a la vista), deslizar entre fotos, cerrar con el botón,
//      tocando fuera y deslizando hacia abajo.
//   f) Privacidad por la API: otro repartidor, el restaurante, otro cliente y sin sesión reciben
//      rechazo; antes de recoger y después de entregar, tampoco las ve el asignado; ninguna ruta
//      pública sirve la foto.
//   g) Presupuesto: filas escritas al subir tres fotos y al mirarlas (contador de la vuelta de pruebas).
// C-CAPTURAS-POR-IDIOMA: inglés en Novi, Michigan (US-MI-NOVI, dólares, nombres en inglés); español en
// El Vigía, Mérida (VE-MER-ELVIGIA). Las fotos de la puerta son DIBUJOS inventados
// (scripts/recorrido/fotos-puerta-dibujos.mjs), nunca fotos de casas reales. Las direcciones de Google
// se simulan en el navegador (el servidor local no tiene llave): sugerencia y punto de ejemplo.
// Originales en docs/capturas/recorrido/foto-puerta-*-{es,en}.png. `SOLO_IDIOMA=en` o `es`: una pasada.
// Uso: node scripts/recorrido/capturas-foto-puerta.mjs
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import sharp from 'sharp';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const FOTOS = join(RAIZ, 'e2e', 'recorrido', 'fotos');
const BOLSA = readFileSync(join(FOTOS, 'bolsa-entrega.jpg'));
const dibujo = (nombre, idioma) => join(FOTOS, `puerta-${nombre}-${idioma}.jpg`);

let ip = 0;
async function llamar(metodo, ruta, cuerpo, token, extra = {}) {
  return fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.81.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await llamar(metodo, ruta, cuerpo, token, extra);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const filas = async (q) => (await sql(q)).results ?? [];
const fotoPedido = async (ruta, token, donde) => {
  const r = await fetch(`${URL}${ruta}?lat=${donde.lat}&lng=${donde.lng}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: BOLSA,
  });
  if (!r.ok) throw new Error(`foto ${ruta}: ${r.status} ${await r.text()}`);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
/** El mapa del Driver con sus calles cargadas antes de la captura. */
const mapaListo = async (p) => {
  await p
    .locator('.leaflet-tile-loaded')
    .nth(3)
    .waitFor({ timeout: 20_000 })
    .catch(() => null);
  await espera(2_500);
};

/** Las comprobaciones con su evidencia (se imprimen al final). */
const informe = [];
function comprobar(cond, paso, evidencia) {
  if (!cond) throw new Error(`FALLA ${paso}: ${evidencia}`);
  informe.push(`${paso}: ${evidencia}`);
}

const navegador = await chromium.launch();
// La computadora con cámara web: la cámara simulada de Chromium «filma» el dibujo de la fachada (un
// video MJPEG hecho aquí con el mismo dibujo), así la captura y la foto guardada son las de siempre.
const videoCamara = join(mkdtempSync(join(tmpdir(), 'camara-')), 'fachada.mjpeg');
{
  const cuadro = await sharp(join(FOTOS, 'puerta-casa-frente-en.jpg'))
    .resize(640, 480)
    .jpeg({ quality: 85 })
    .toBuffer();
  writeFileSync(videoCamara, Buffer.concat(Array.from({ length: 30 }, () => cuadro)));
}
const conCamara = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${videoCamara}`,
  ],
});

/**
 * Una pasada completa en un idioma. `ciudad` trae lo que cambia por país: las cuentas, el restaurante,
 * el pedido hasta la recogida y la entrega.
 */
async function pasada(idioma, ciudad) {
  const en = idioma === 'en';
  const L = en
    ? {
        casa: 'House',
        esEdificio: 'It’s a building or complex',
        fallo: 'It couldn’t be uploaded. Your photo is still here.',
        titulos: ['Building entrance', 'Along the way', 'Apartment door'],
        notas: 'Notes for your driver (optional)',
        miniatura: 'Photos of your door',
      }
    : {
        casa: 'Casa',
        esEdificio: 'Es un edificio o conjunto',
        fallo: 'No se pudo subir. Tu foto sigue aquí.',
        titulos: ['Entrada del edificio', 'Paso intermedio', 'Puerta del apartamento'],
        notas: 'Indicaciones para el repartidor (opcional)',
        miniatura: 'Fotos de tu puerta',
      };
  const captura = (p, nombre) =>
    p.screenshot({ path: join(SALIDA, `foto-puerta-${nombre}-${idioma}.png`) });
  const vuelta = Date.now().toString(36);
  const cli = await ciudad.cliente(vuelta);
  const telefono = async (token, id, donde, carrito) => {
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: en ? 'en-US' : 'es-VE',
      timezoneId: ciudad.zonaHoraria,
      geolocation: { latitude: donde.lat, longitude: donde.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i, c]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
        if (c) localStorage.setItem(`tumbite.carrito.${u}`, c);
      },
      [token, id, idioma, carrito ?? null],
    );
    // El buscador de direcciones de Google, simulado: el servidor local no tiene llave.
    await ctx.route('**/datos/lugares/**', (route) => {
      const u = new globalThis.URL(route.request().url());
      if (u.pathname.endsWith('/estado')) return route.fulfill({ json: { busqueda: true } });
      if (u.pathname.endsWith('/sugerencias'))
        return route.fulfill({
          json: {
            sugerencias: ciudad.direcciones.map((d, i) => ({
              id: `lugar-de-ejemplo-${i}-0000000`,
              texto: d.direccion,
            })),
          },
        });
      const i = Number(/lugar-de-ejemplo-(\d)/.exec(u.pathname)?.[1] ?? 0);
      const d = ciudad.direcciones.at(i);
      return route.fulfill({ json: { punto: { lat: d.lat, lng: d.lng }, direccion: d.direccion } });
    });
    return ctx;
  };
  const subirCon = async (p, testId, archivo) => {
    const [selector] = await Promise.all([
      p.waitForEvent('filechooser'),
      p.getByTestId(testId).click(),
    ]);
    await selector.setFiles(archivo);
  };
  const misDirecciones = async () =>
    (await pedir('GET', '/datos/mis-direcciones', undefined, cli.token)).direcciones;
  const [CASA, EDIFICIO] = ciudad.direcciones;

  // ───────── a) Cliente, casa: la hoja sale justo después de guardar una dirección nueva
  const ctxA = await telefono(cli.token, cli.id, CASA);
  const a = await ctxA.newPage();
  a.on('dialog', (d) => void d.accept());
  await a.goto('/app');
  await a.getByTestId('inicio-direccion').click({ timeout: 60_000 });
  await a.getByTestId('inicio-direccion-casilla').fill(CASA.direccion.slice(0, 12));
  await a.getByText(CASA.direccion, { exact: true }).first().click({ timeout: 20_000 });
  await a.getByTestId('fotos-puerta-tipo-casa').waitFor({ timeout: 20_000 });
  // C-EDITAR-ES-EDITAR: al guardar una dirección nueva sale su hoja (nombre, datos y, abajo, las
  // fotos de la entrada con «Casa / Edificio»), con «Ahora no».
  comprobar(
    await a.getByTestId('editar-direccion-ahora-no').isVisible(),
    `a ${idioma}`,
    'al guardar la dirección nueva sale su hoja con «Casa / Edificio» y «Ahora no»',
  );
  await a
    .getByTestId('fotos-puerta-tipo-casa')
    .evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await espera(700);
  await captura(a, 'cliente-tipo');
  await a.getByTestId('fotos-puerta-tipo-casa').click();
  await a.getByTestId('fotos-puerta-camara-1').waitFor({ timeout: 15_000 });
  comprobar(
    (await a.getByTestId('fotos-puerta-casilla-3').count()) === 0,
    `a ${idioma}`,
    'casa: dos casillas (frente y puerta), no tres',
  );
  await subirCon(a, 'fotos-puerta-camara-1', dibujo('casa-frente', idioma));
  await a.getByTestId('fotos-puerta-guardada-1').waitFor({ timeout: 20_000 });
  await subirCon(a, 'fotos-puerta-archivos-2', dibujo('casa-cerca', idioma));
  await a.getByTestId('fotos-puerta-guardada-2').waitFor({ timeout: 20_000 });
  let casa = (await misDirecciones()).find((d) => d.direccion === CASA.direccion);
  comprobar(
    casa?.tipoLugar === 'casa' && casa.fotos.join(',') === '1,2',
    `a ${idioma}`,
    `«Tomar foto» y «Subir desde archivos» guardaron 2 fotos (servidor: tipo ${casa?.tipoLugar}, fotos ${casa?.fotos})`,
  );
  await a
    .getByTestId('fotos-puerta-casilla-1')
    .evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await espera(500);
  await captura(a, 'cliente-casa-fotos');
  // Cambiar la foto 1 desde los tres puntos.
  const claveAntes = (
    await filas(
      `SELECT clave FROM direcciones_fotos WHERE direccion_id = '${casa.id}' AND orden = 1`,
    )
  )[0]?.clave;
  await a.getByTestId('fotos-puerta-menu-1').click();
  await a.getByTestId('fotos-puerta-cambiar-1').waitFor();
  await espera(300);
  await captura(a, 'cliente-menu');
  await a.getByTestId('fotos-puerta-cambiar-1').click();
  await subirCon(a, 'fotos-puerta-archivos-1', dibujo('casa-frente', idioma));
  await a.getByTestId('fotos-puerta-guardada-1').waitFor({ timeout: 20_000 });
  // La foto nueva se guarda en otra clave: se espera a que el servidor la tenga (hasta 20 s).
  let claveDespues = claveAntes;
  for (let i = 0; i < 40 && claveDespues === claveAntes; i++) {
    await espera(500);
    claveDespues = (
      await filas(
        `SELECT clave FROM direcciones_fotos WHERE direccion_id = '${casa.id}' AND orden = 1`,
      )
    )[0]?.clave;
  }
  await a.getByTestId('fotos-puerta-guardada-1').waitFor({ timeout: 20_000 });
  comprobar(
    claveAntes && claveDespues && claveAntes !== claveDespues,
    `a ${idioma}`,
    'cambiar la foto 1 la reemplaza (otra clave en el almacén, misma fila)',
  );
  // Borrar la foto 2 (con su confirmación) y volver a ponerla.
  await a.getByTestId('fotos-puerta-menu-2').click();
  await a
    .getByTestId('fotos-puerta-borrar-2')
    .click({ timeout: 8_000 })
    .catch(async (x) => {
      await a.screenshot({ path: join(process.env.DEPURAR ?? SALIDA, 'fallo-borrar.png') });
      console.log(
        await a.getByTestId('fotos-puerta-borrar-2').evaluate((el) => {
          const r = el.getBoundingClientRect();
          const otro = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const cadena = [];
          for (let n = otro; n && cadena.length < 8; n = n.parentElement)
            cadena.push(
              `${n.getAttribute('data-testid') ?? ''} z=${getComputedStyle(n).zIndex} pos=${getComputedStyle(n).position} pe=${getComputedStyle(n).pointerEvents} ${n.innerText?.slice(0, 30)}`,
            );
          return JSON.stringify({ r, cadena }, null, 1);
        }),
      );
      throw x;
    });
  await a.getByTestId('fotos-puerta-camara-2').waitFor({ timeout: 15_000 });
  casa = (await misDirecciones()).find((d) => d.direccion === CASA.direccion);
  comprobar(
    casa.fotos.join(',') === '1',
    `a ${idioma}`,
    `borrar desde los tres puntos quita la foto 2 (servidor: fotos ${casa.fotos})`,
  );
  await subirCon(a, 'fotos-puerta-camara-2', dibujo('casa-cerca', idioma));
  await a.getByTestId('fotos-puerta-guardada-2').waitFor({ timeout: 20_000 });
  await a.getByTestId('editar-direccion-guardar').click();
  await a.getByTestId('editar-direccion').waitFor({ state: 'hidden', timeout: 10_000 });
  comprobar(true, `a ${idioma}`, '«Guardar cambios» cierra la hoja de la dirección nueva');
  // «Entregar en»: la dirección guardada con su sello «Con foto» y las fotos en sus tres puntos.
  await a.getByTestId('inicio-direccion').click();
  await a.getByTestId(`direccion-con-foto-${casa.id}`).waitFor({ timeout: 15_000 });
  await a.getByTestId(`direccion-menu-${casa.id}`).click();
  await a.getByTestId(`direccion-fotos-${casa.id}`).waitFor();
  await espera(400);
  await captura(a, 'cliente-direcciones');
  await a.getByTestId(`direccion-fotos-${casa.id}`).click();
  await a.getByTestId('fotos-puerta-guardada-2').waitFor({ timeout: 20_000 });
  comprobar(
    true,
    `a ${idioma}`,
    '«Entregar en» → tres puntos → «Fotos de la entrada» abre la hoja en sus 2 fotos',
  );
  await ctxA.close();

  // ───────── a') La computadora: «Tomar foto» abre la cámara web en su ventanita (C-CAMARA-EN-TODA-SUBIDA)
  const computadora = async (nav, conPermiso) => {
    const ctx = await nav.newContext({
      viewport: { width: 1280, height: 860 },
      baseURL: URL,
      locale: en ? 'en-US' : 'es-VE',
      permissions: conPermiso ? ['camera'] : [],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [cli.token, cli.id, idioma],
    );
    const p = await ctx.newPage();
    await p.goto('/app');
    await p.getByTestId('inicio-direccion').click({ timeout: 60_000 });
    await p.getByTestId(`direccion-menu-${casa.id}`).click({ timeout: 20_000 });
    await p.getByTestId(`direccion-fotos-${casa.id}`).click();
    await p.getByTestId('fotos-puerta-menu-1').click({ timeout: 20_000 });
    await p.getByTestId('fotos-puerta-cambiar-1').click();
    await p.getByTestId('fotos-puerta-camara-1').click();
    return { ctx, p };
  };
  {
    const { ctx, p } = await computadora(conCamara, true);
    const ventana = p.getByRole('dialog', { name: en ? 'Camera' : 'Cámara' });
    await p.getByTestId('camara-web-video').waitFor({ timeout: 15_000 });
    await espera(1_200);
    await captura(p, 'cliente-camara-computadora');
    const antesWeb = (
      await filas(
        `SELECT clave FROM direcciones_fotos WHERE direccion_id = '${casa.id}' AND orden = 1`,
      )
    )[0]?.clave;
    await p.getByTestId('camara-web-capturar').click();
    await ventana.waitFor({ state: 'hidden', timeout: 5_000 });
    let despuesWeb = antesWeb;
    for (let i = 0; i < 40 && despuesWeb === antesWeb; i++) {
      await espera(500);
      despuesWeb = (
        await filas(
          `SELECT clave FROM direcciones_fotos WHERE direccion_id = '${casa.id}' AND orden = 1`,
        )
      )[0]?.clave;
    }
    comprobar(
      despuesWeb && despuesWeb !== antesWeb,
      `cámara ${idioma}`,
      'en la computadora, «Tomar foto» abre la cámara web en su ventanita y la foto tomada se guarda',
    );
    await ctx.close();
  }
  {
    // Sin cámara ni permiso: el mensaje en palabras junto a la casilla, y «Subir desde archivos» a mano.
    const { ctx, p } = await computadora(navegador, false);
    const casilla = p.getByTestId('fotos-puerta-casilla-1');
    await casilla
      .getByText(en ? /Upload the photo from your files/ : /Sube la foto desde tus archivos/)
      .waitFor({ timeout: 15_000 });
    comprobar(
      (await p.getByRole('dialog', { name: en ? 'Camera' : 'Cámara' }).count()) === 0 &&
        (await p.getByTestId('fotos-puerta-archivos-1').isEnabled()),
      `cámara ${idioma}`,
      'sin cámara o sin permiso lo dice en palabras y deja «Subir desde archivos»',
    );
    await casilla.evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(400);
    await captura(p, 'cliente-sin-camara-computadora');
    // Se deja la foto como estaba: la del dibujo, desde los archivos.
    await subirCon(p, 'fotos-puerta-archivos-1', dibujo('casa-frente', idioma));
    await espera(2_500);
    await ctx.close();
  }

  // ───────── b, c, d) El carrito: edificio con apartamento, borrador y fallo de subida
  const carrito = await ciudad.carrito();
  const ctxB = await telefono(cli.token, cli.id, EDIFICIO, carrito);
  const b = await ctxB.newPage();
  b.on('dialog', (d) => void d.accept());
  await b.goto('/app/cart');
  await b.getByTestId('carrito-direccion').waitFor({ timeout: 60_000 });
  if (ciudad.antesDeLaDireccion) await ciudad.antesDeLaDireccion(b, en);
  await b.getByTestId('carrito-direccion').fill(EDIFICIO.direccion);
  await b.getByTestId('carrito-apto').fill(EDIFICIO.apto);
  await b.getByLabel(L.notas).fill(EDIFICIO.notas);
  await espera(1_200);
  // c) Recargar a mitad del formulario: lo escrito vuelve.
  await b.reload();
  await b.getByTestId('carrito-direccion').waitFor({ timeout: 60_000 });
  await espera(1_000);
  const tras = {
    direccion: await b.getByTestId('carrito-direccion').inputValue(),
    apto: await b.getByTestId('carrito-apto').inputValue(),
    notas: await b.getByLabel(L.notas).inputValue(),
  };
  comprobar(
    tras.direccion === EDIFICIO.direccion &&
      tras.apto === EDIFICIO.apto &&
      tras.notas === EDIFICIO.notas,
    `c ${idioma}`,
    `tras recargar, el carrito devuelve dirección «${tras.direccion}», apto «${tras.apto}» y notas`,
  );
  // b) «Agregar fotos de la entrada»: guarda la dirección y abre la hoja. C-CASA-POR-DEFECTO: aunque
  // tenga apartamento escrito, arranca en casa; se elige «Edificio o conjunto» en el selector.
  await b.getByTestId('carrito-fotos-puerta-boton').click();
  await b.getByTestId('fotos-puerta-camara-1').waitFor({ timeout: 20_000 });
  comprobar(
    (await b.getByTestId('fotos-puerta-tipo-casa').getAttribute('aria-checked')) === 'true' &&
      (await b.getByTestId('fotos-puerta-casilla-3').count()) === 0,
    `b ${idioma}`,
    'sin elegir, la hoja arranca en casa aunque haya apartamento escrito',
  );
  await b.getByTestId('fotos-puerta-tipo-edificio').click();
  await b.getByTestId('fotos-puerta-casilla-3').waitFor({ timeout: 15_000 });
  for (const [i, titulo] of L.titulos.entries())
    comprobar(
      (await b.getByTestId(`fotos-puerta-casilla-${i + 1}`).innerText()).includes(titulo),
      `b ${idioma}`,
      `casilla ${i + 1}: «${titulo}»`,
    );
  await espera(500);
  await captura(b, 'cliente-edificio');
  // c) La primera subida falla (sin conexión): la foto se queda, con «Reintentar», y no se borra nada.
  let cortar = true;
  // Solo la foto grande 1 (no la miniatura, que lleva «?tam=mini»).
  await b.route(
    (u) =>
      u.pathname.startsWith('/datos/mis-direcciones/') &&
      u.pathname.endsWith('/fotos/1') &&
      !u.search,
    (route) =>
      cortar && route.request().method() === 'POST'
        ? route.abort('internetdisconnected')
        : route.continue(),
  );
  await subirCon(b, 'fotos-puerta-camara-1', dibujo('edificio-entrada', idioma));
  await b.getByTestId('fotos-puerta-reintentar-1').waitFor({ timeout: 20_000 });
  const casilla1 = b.getByTestId('fotos-puerta-casilla-1');
  comprobar(
    (await casilla1.innerText()).includes(L.fallo) && (await casilla1.locator('img').count()) > 0,
    `c ${idioma}`,
    `subida fallida: «${L.fallo}», la foto sigue en la casilla y aparece «Reintentar»`,
  );
  await casilla1.evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await espera(400);
  await captura(b, 'cliente-reintentar');
  cortar = false;
  await b.getByTestId('fotos-puerta-reintentar-1').click();
  await b.getByTestId('fotos-puerta-guardada-1').waitFor({ timeout: 20_000 });
  comprobar(true, `c ${idioma}`, '«Reintentar» sube la misma foto sin volver a elegirla');
  await subirCon(b, 'fotos-puerta-archivos-2', dibujo('edificio-porteria', idioma));
  await b.getByTestId('fotos-puerta-guardada-2').waitFor({ timeout: 20_000 });
  await subirCon(b, 'fotos-puerta-camara-3', dibujo('apartamento', idioma));
  await b.getByTestId('fotos-puerta-guardada-3').waitFor({ timeout: 20_000 });
  const edificio = (await misDirecciones()).find((d) => d.direccion === EDIFICIO.direccion);
  comprobar(
    edificio?.tipoLugar === 'edificio' &&
      edificio.fotos.join(',') === '1,2,3' &&
      edificio.apto === EDIFICIO.apto,
    `b ${idioma}`,
    `edificio con 3 fotos en orden (servidor: tipo ${edificio?.tipoLugar}, fotos ${edificio?.fotos}, apto «${edificio?.apto}»)`,
  );
  await b
    .getByTestId('fotos-puerta-casilla-1')
    .evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await espera(500);
  await captura(b, 'cliente-edificio-fotos');
  await b.getByTestId('fotos-puerta-listo').click();
  await b.getByTestId('fotos-puerta-listo').waitFor({ state: 'hidden', timeout: 10_000 });
  // d) La tarjeta del carrito con sus tres miniaturas, y el formulario intacto.
  const tarjeta = b.getByTestId('carrito-fotos-puerta-boton');
  for (const n of [1, 2, 3]) await b.getByLabel(`${L.miniatura} ${n}`).waitFor({ timeout: 20_000 });
  comprobar(
    (await b.getByTestId('carrito-apto').inputValue()) === EDIFICIO.apto &&
      (await b.getByLabel(L.notas).inputValue()) === EDIFICIO.notas,
    `c ${idioma}`,
    'después del fallo y de la hoja, el carrito conserva apartamento y notas',
  );
  comprobar(true, `d ${idioma}`, 'la tarjeta del carrito muestra las 3 miniaturas');
  await b.getByTestId('carrito-fotos-puerta').evaluate((x) => {
    x.scrollIntoView({ block: 'center' });
  });
  await espera(600);
  await captura(b, 'cliente-carrito');
  void tarjeta;
  await ctxB.close();

  // d) El pedido creado guarda la dirección de donde sale (y con ella, sus fotos).
  const pedidoId = await ciudad.pedidoHastaAceptado(cli, EDIFICIO);
  const enlace = (await filas(`SELECT direccion_id FROM pedidos WHERE id = '${pedidoId}'`))[0];
  comprobar(
    enlace?.direccion_id === edificio.id,
    `d ${idioma}`,
    `pedido ${pedidoId.slice(0, 8)}… guarda direccion_id = ${String(enlace?.direccion_id).slice(0, 8)}… (la dirección del edificio)`,
  );

  // ───────── e, f) El Driver asignado, antes y después de recoger
  const { rep } = ciudad;
  const verPuerta = (token, orden) =>
    llamar(
      'GET',
      `/datos/repartidor/pedidos/${pedidoId}/puerta${orden ? `/${orden}` : ''}`,
      undefined,
      token,
    );
  const otroRep = await ciudad.cuenta('repartidor', en ? 'Alex Rivera' : 'Luis Pérez', vuelta);
  const otroCli = await ciudad.cuenta('cliente', en ? 'Taylor Brooks' : 'Ana Gómez', vuelta);
  const antes = await verPuerta(rep.token);
  const antesFoto = await verPuerta(rep.token, 1);
  comprobar(
    antes.status === 200 && (await antes.json()).fotos.length === 0 && antesFoto.status === 404,
    `f ${idioma}`,
    `antes de recoger, el asignado recibe lista vacía (200, 0 fotos) y la foto 1 da ${antesFoto.status}`,
  );
  const ctxD = await telefono(rep.token, rep.id, ciudad.local);
  const d = await ctxD.newPage();
  await d.goto('/driver/');
  await d.getByText(ciudad.nombreRestaurante).first().waitFor({ timeout: 60_000 });
  await mapaListo(d);
  comprobar(
    (await d.getByTestId('puerta-miniatura').count()) === 0,
    `e ${idioma}`,
    'antes de la recogida el Driver no muestra la miniatura de la puerta',
  );
  await captura(d, 'driver-antes');
  await ctxD.close();

  await ciudad.recoger(pedidoId);
  const ctxD2 = await telefono(rep.token, rep.id, ciudad.cerca);
  const d2 = await ctxD2.newPage();
  await d2.goto('/driver/');
  await d2.getByTestId('puerta-miniatura').waitFor({ timeout: 60_000 });
  await mapaListo(d2);
  await captura(d2, 'driver-miniatura');
  comprobar(
    true,
    `e ${idioma}`,
    'en camino aparece la miniatura «1 de 3» en la tarjeta del pedido',
  );
  const tarjetaPedido = await d2.getByTestId('puerta-miniatura').boundingBox();
  await d2.getByTestId('puerta-miniatura').click();
  const hoja = d2.getByTestId('puerta-hoja');
  await hoja.waitFor({ timeout: 10_000 });
  await d2.getByTestId('puerta-foto-1').locator('img').first().waitFor({ timeout: 20_000 });
  await espera(1_000);
  await captura(d2, 'driver-hoja');
  const caja = await hoja.boundingBox();
  const pantalla = d2.viewportSize();
  const mapa = await d2
    .locator('.leaflet-container, [data-testid="mapa-driver"]')
    .first()
    .boundingBox();
  comprobar(
    caja && pantalla && caja.height <= pantalla.height * 0.6 && caja.y > pantalla.height * 0.35,
    `e ${idioma}`,
    `la hoja es de media altura: ${Math.round(caja?.height ?? 0)} de ${pantalla?.height} px, desde y=${Math.round(caja?.y ?? 0)}`,
  );
  comprobar(
    mapa &&
      caja &&
      mapa.y + mapa.height * 0.5 < caja.y &&
      tarjetaPedido &&
      tarjetaPedido.y < caja.y,
    `e ${idioma}`,
    `el mapa (y=${Math.round(mapa?.y ?? 0)}–${Math.round((mapa?.y ?? 0) + (mapa?.height ?? 0))}) y la tarjeta del pedido (y=${Math.round(tarjetaPedido?.y ?? 0)}) quedan a la vista encima de la hoja`,
  );
  // Deslizar entre fotos: un gesto de lado sobre la foto (rueda horizontal, como el trackpad).
  const carrusel = await d2.getByTestId('puerta-fotos').boundingBox();
  await d2.mouse.move(carrusel.x + carrusel.width / 2, carrusel.y + carrusel.height / 2);
  await d2.mouse.wheel(carrusel.width, 0);
  await espera(800);
  const foto2 = await d2.getByTestId('puerta-foto-2').boundingBox();
  const punto2 = await d2.getByTestId('puerta-punto-2').getAttribute('aria-selected');
  comprobar(
    foto2 && Math.abs(foto2.x) < 10 && punto2 === 'true',
    `e ${idioma}`,
    `deslizar lleva a la foto 2 (x=${Math.round(foto2?.x ?? -1)}) y el punto 2 queda marcado (aria-selected=${punto2})`,
  );
  await captura(d2, 'driver-hoja-2');
  await d2.getByTestId('puerta-cerrar').click();
  await hoja.waitFor({ state: 'hidden', timeout: 5_000 });
  comprobar(true, `e ${idioma}`, 'el botón «Cerrar» cierra la hoja');
  await d2.getByTestId('puerta-miniatura').click();
  await hoja.waitFor();
  await espera(800);
  await d2.mouse.click(pantalla.width / 2, 40);
  await hoja.waitFor({ state: 'hidden', timeout: 5_000 });
  comprobar(true, `e ${idioma}`, 'tocar fuera de la hoja la cierra');
  await d2.getByTestId('puerta-miniatura').click();
  await hoja.waitFor();
  await espera(800);
  const manija = await d2.getByTestId('puerta-manija').boundingBox();
  const mx = manija.x + manija.width / 2;
  const my = manija.y + manija.height / 2;
  // Un dedo de verdad (eventos táctiles del teléfono), de la manija hacia abajo.
  const cdp = await ctxD2.newCDPSession(d2);
  if (process.env.DEPURAR)
    await d2.evaluate(() => {
      globalThis.__ev = [];
      for (const t of [
        'touchstart',
        'touchmove',
        'touchend',
        'touchcancel',
        'pointerdown',
        'pointercancel',
        'mousedown',
      ])
        document.addEventListener(
          t,
          (e) =>
            globalThis.__ev.push(
              `${t}:${e.target?.getAttribute?.('data-testid') ?? e.target?.tagName}`,
            ),
          true,
        );
    });
  const dedo = (type, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: mx, y }],
    });
  await dedo('touchStart', my);
  for (let i = 1; i <= 10; i++) {
    await dedo('touchMove', my + i * 16);
    await espera(16);
  }
  await dedo('touchEnd', my + 160);
  if (process.env.DEPURAR) {
    await espera(500);
    console.log(
      'hoja tras el dedo:',
      await hoja.isVisible(),
      await d2.evaluate(() => globalThis.__ev),
    );
  }
  await hoja.waitFor({ state: 'hidden', timeout: 5_000 });
  comprobar(true, `e ${idioma}`, 'deslizar la hoja hacia abajo desde la manija la cierra');
  await ctxD2.close();

  // f) Privacidad, con el pedido en camino.
  const verAjeno = async (quien, token) => {
    const lista = await verPuerta(token);
    const foto = await verPuerta(token, 1);
    comprobar(
      lista.status >= 400 && foto.status >= 400,
      `f ${idioma}`,
      `${quien}: lista ${lista.status}, foto ${foto.status}`,
    );
  };
  const enCamino = await verPuerta(rep.token);
  comprobar(
    enCamino.status === 200 && (await enCamino.json()).fotos.length === 3,
    `f ${idioma}`,
    'en camino, el asignado ve la lista de 3 fotos (200)',
  );
  await verAjeno('otro repartidor no asignado', otroRep.token);
  await verAjeno('el restaurante', ciudad.restoToken);
  await verAjeno('otro cliente', otroCli.token);
  await verAjeno('sin sesión', undefined);
  const delOtro = await llamar(
    'GET',
    `/datos/mis-direcciones/${edificio.id}/fotos/1`,
    undefined,
    otroCli.token,
  );
  const delDueno = await llamar(
    'GET',
    `/datos/mis-direcciones/${edificio.id}/fotos/1`,
    undefined,
    cli.token,
  );
  comprobar(
    delOtro.status === 404 &&
      delDueno.status === 200 &&
      delDueno.headers.get('cache-control')?.includes('no-store'),
    `f ${idioma}`,
    `la foto por la ruta del dueño: dueño ${delDueno.status} (${delDueno.headers.get('cache-control')}), otro cliente ${delOtro.status}`,
  );
  const clave = (
    await filas(
      `SELECT clave FROM direcciones_fotos WHERE direccion_id = '${edificio.id}' AND orden = 1`,
    )
  )[0].clave;
  const [, usuario, dir, archivo] = clave.split('/');
  for (const ruta of [
    `/media/${clave}`,
    `/media/fotos/${clave}`,
    `/media/fotos/${dir}/${archivo}`,
    `/media/fotos/${usuario}/${archivo}`,
    `/media/fotos/${dir}/${archivo}.webp`,
    `/${clave}`,
  ]) {
    const r = await llamar('GET', ruta);
    const tipo = r.headers.get('content-type') ?? '';
    comprobar(
      r.status === 404 || (r.status === 200 && tipo.includes('text/html')),
      `f ${idioma}`,
      `ruta pública ${ruta.replace(/[0-9a-f-]{20,}/g, '…')}: ${r.status} ${tipo.split(';')[0]} (no sirve la foto)`,
    );
  }

  // Entregado: el que lo entregó ya no la ve.
  await ciudad.entregar(pedidoId);
  const despues = await verPuerta(rep.token);
  const despuesFoto = await verPuerta(rep.token, 1);
  comprobar(
    despues.status === 200 &&
      (await despues.json()).fotos.length === 0 &&
      despuesFoto.status === 404,
    `f ${idioma}`,
    `después de entregar, el repartidor que lo entregó recibe 0 fotos y la foto 1 da ${despuesFoto.status}`,
  );

  // ───────── g) Presupuesto de escrituras, con el contador de la vuelta de pruebas
  const nueva = (
    await pedir(
      'POST',
      '/datos/mis-direcciones',
      {
        direccion: `${EDIFICIO.direccion} (${vuelta})`,
        apto: EDIFICIO.apto,
        lat: EDIFICIO.lat,
        lng: EDIFICIO.lng,
      },
      cli.token,
    )
  ).direccion;
  await pedir('PATCH', `/datos/mis-direcciones/${nueva.id}`, { tipoLugar: 'edificio' }, cli.token);
  const subirVuelta = `fotos-puerta-subir-${idioma}-${vuelta}`;
  const mirarVuelta = `fotos-puerta-mirar-${idioma}-${vuelta}`;
  const bytes = (n) =>
    readFileSync(dibujo(['edificio-entrada', 'edificio-porteria', 'apartamento'][n - 1], idioma));
  for (const n of [1, 2, 3])
    for (const mini of ['', '?tam=mini']) {
      const r = await fetch(`${URL}/datos/mis-direcciones/${nueva.id}/fotos/${n}${mini}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cli.token}`,
          'content-type': 'image/jpeg',
          'x-vuelta-pruebas': subirVuelta,
        },
        body: bytes(n),
      });
      if (!r.ok) throw new Error(`subir ${n}${mini}: ${r.status}`);
    }
  const mirar = { 'x-vuelta-pruebas': mirarVuelta };
  await llamar('GET', '/datos/mis-direcciones', undefined, cli.token, mirar);
  for (const n of [1, 2, 3]) {
    await llamar(
      'GET',
      `/datos/mis-direcciones/${nueva.id}/fotos/${n}?tam=mini`,
      undefined,
      cli.token,
      mirar,
    );
    await llamar(
      'GET',
      `/datos/mis-direcciones/${nueva.id}/fotos/${n}`,
      undefined,
      cli.token,
      mirar,
    );
  }
  const cuenta = async (id) =>
    (await filas(`SELECT escritas, peticiones FROM vueltas_pruebas WHERE id = '${id}'`))[0] ?? {
      escritas: 0,
      peticiones: 0,
    };
  const s = await cuenta(subirVuelta);
  const m = await cuenta(mirarVuelta);
  comprobar(
    Number(s.escritas) === 3 && Number(m.escritas) === 0,
    `g ${idioma}`,
    `subir 3 fotos (con sus 3 miniaturas, 6 peticiones): ${s.escritas} filas escritas en ${s.peticiones} peticiones que escribieron; mirar (lista + 6 imágenes): ${m.escritas} filas`,
  );
  await pedir('DELETE', `/datos/mis-direcciones/${nueva.id}`, undefined, cli.token);
}

// ───────────────────────── Estados Unidos: Novi, Michigan ─────────────────────────
async function ciudadUs() {
  const NOVI = { id: 'US-MI-NOVI', nombre: 'Novi', lat: 42.4806, lng: -83.4755, radioKm: 15 };
  const LOCAL = { lat: 42.481, lng: -83.4735, direccion: '43259 Crescent Blvd, Novi, MI 48375' };
  const CASA = { lat: 42.4722, lng: -83.478, direccion: '120 Maple Grove Ct, Novi, MI 48375' };
  const EDIFICIO = {
    lat: 42.4795,
    lng: -83.4689,
    direccion: '45 Town Center Dr, Novi, MI 48375',
    apto: 'Apt 4B',
    notas: 'Ring the front desk, then take the elevator to the 4th floor.',
  };
  const interno = (ruta, cuerpo = {}) =>
    pedir('POST', `/datos/interno/diagnostico/${ruta}`, cuerpo, undefined, {
      'x-reloj-secreto': SECRETO,
    });
  const sesion = async (id) => {
    const token = randomBytes(24).toString('hex');
    await sql(
      `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
    );
    return token;
  };
  const cuenta = async (rol, nombre, vuelta) => {
    const correo = `foto.puerta.us.${rol}.${vuelta}.${randomBytes(3).toString('hex')}@recorrido.test`;
    const r = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: DATOS.clave,
      rol,
    });
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
    );
    return { token: r.token, id: r.usuario.id };
  };
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${NOVI.id}', '${NOVI.nombre}', 'US', 'USD', 'America/Detroit', ${NOVI.lat}, ${NOVI.lng}, ${NOVI.radioKm}, 1)`,
  );
  const a = await interno('carro/armar');
  const rep = { id: a.ids.conductorUs, token: await sesion(a.ids.conductorUs) };
  await sql(`UPDATE usuarios SET nombre = 'Sam Carter' WHERE id = '${rep.id}'`);
  const yo = (m, r, c) => pedir(m, r, c, rep.token);
  await interno('carro/conductor', { quien: 'us', zonaId: NOVI.id, ...LOCAL }).catch(() => null);
  await yo('POST', '/datos/repartidor/terminos', { version: a.versionTerminos });
  await sql(`DELETE FROM selfies_control WHERE usuario_id = '${rep.id}' AND tomada_en IS NULL`);
  await sql(
    `INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado)
     VALUES ('capturas-foto-puerta-US', '${rep.id}', datetime('now'), 'ok')`,
  );
  await sql(
    `UPDATE pedidos SET estado = 'cancelado' WHERE repartidor_id = '${rep.id}' AND estado NOT IN ('entregado', 'cancelado')`,
  );
  const vuelta = Date.now().toString(36);
  const dueno = await cuenta('restaurante', 'Crescent Pizza Kitchen', vuelta);
  const resto = (m, r, c) => pedir(m, r, c, dueno.token);
  const rest = (
    await resto('PUT', '/datos/mi-restaurante', {
      nombre: 'Crescent Pizza Kitchen',
      categoria: 'Pizza',
      telefono: '2485550142',
      direccion: LOCAL.direccion,
      lat: LOCAL.lat,
      lng: LOCAL.lng,
    })
  ).restaurante;
  const plato = (
    await resto('POST', '/datos/mi-restaurante/platos', {
      nombreEs: 'Pizza margarita',
      nombreEn: 'Margherita pizza',
      precioCentavos: 1450,
    })
  ).plato;
  await resto('PUT', '/datos/mi-restaurante/horarios', {
    turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
  });
  await sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rest.id}'`);
  await resto('PATCH', '/datos/mi-restaurante/abierto', { abierto: true });
  const ubicar = async (donde) => {
    await yo('POST', '/datos/repartidor/ubicacion', {
      lat: donde.lat,
      lng: donde.lng,
      precision: 8,
    });
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${donde.lat}, lng = ${donde.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${rep.id}'`,
    );
  };
  const CERCA = { lat: 42.4772, lng: -83.4712 };
  return {
    zonaHoraria: 'America/Detroit',
    direcciones: [CASA, EDIFICIO],
    local: LOCAL,
    cerca: CERCA,
    rep,
    restoToken: dueno.token,
    nombreRestaurante: rest.nombre,
    cuenta,
    cliente: (v) => cuenta('cliente', 'Jamie Lee', v),
    carrito: async () =>
      JSON.stringify({
        restauranteId: rest.id,
        restauranteNombre: rest.nombre,
        plan: rest.plan ?? 'inicial',
        restLat: LOCAL.lat,
        restLng: LOCAL.lng,
        moneda: 'USD',
        lineas: [
          {
            clave: `${plato.id}:`,
            platoId: plato.id,
            nombreEs: plato.nombreEs,
            nombreEn: plato.nombreEn,
            precioCentavos: plato.precioCentavos,
            cantidad: 2,
          },
        ],
      }),
    /** Pagado con tarjeta (aquí anotado directo) y aceptado por el restaurante y el repartidor. */
    pedidoHastaAceptado: async (cli, dir) => {
      await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL });
      await ubicar(LOCAL);
      const p = await pedir(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rest.id,
          lineas: [{ platoId: plato.id, cantidad: 2 }],
          propinaCentavos: 400,
          entrega: 'puerta',
          direccion: dir.direccion,
          apto: dir.apto,
          notas: dir.notas,
          lat: dir.lat,
          lng: dir.lng,
        },
        cli.token,
      );
      const id = p.pedidoId;
      await sql(
        `UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = '${id}'`,
      );
      await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 });
      await ubicar(LOCAL);
      for (let i = 0; ; i++) {
        const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
        if (ofertas.some((o) => o.id === id)) break;
        if (i > 20) throw new Error(`la oferta ${id} no le llegó al repartidor`);
        await espera(3_000);
      }
      await yo('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {});
      return id;
    },
    recoger: async (id) => {
      await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {});
      await fotoPedido(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, LOCAL);
      await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {});
      await ubicar(CERCA);
    },
    entregar: async (id) => {
      await ubicar(EDIFICIO);
      await ubicar(EDIFICIO);
      await sql(
        `INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES ('${id}', 'llego_cliente')`,
      );
      await fotoPedido(`/datos/repartidor/pedidos/${id}/entregado`, rep.token, EDIFICIO);
      await yo('POST', '/datos/repartidor/conectar', { conectado: false });
    },
  };
}

// ───────────────────────── Venezuela: El Vigía, Mérida ─────────────────────────
async function ciudadVe() {
  execFileSync('node', ['scripts/staging/probar-comida-venezuela.mjs'], {
    cwd: RAIZ,
    env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const armado = await pedir('POST', '/datos/interno/pruebas/comida-ve/armar', {}, undefined, {
    'x-reloj-secreto': SECRETO,
  });
  const { tokens, ids } = armado;
  for (const t of Object.values(tokens))
    await sql(
      `UPDATE sesiones SET expira_en = datetime('now', '+90 minutes') WHERE id = '${createHash('sha256').update(t).digest('hex')}'`,
    );
  const resto = (m, r, c) => pedir(m, r, c, tokens.restaurante);
  const yo = (m, r, c) => pedir(m, r, c, tokens.repartidor);
  const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
  const LOCAL = { lat: 8.6225, lng: -71.651 };
  const CASA = {
    lat: 8.6229,
    lng: -71.6512,
    direccion: 'Calle 5 con avenida 3, casa 120, El Vigía',
  };
  const EDIFICIO = {
    lat: 8.6241,
    lng: -71.6498,
    direccion: 'Avenida Bolívar, Torre Norte, El Vigía',
    apto: 'Piso 4, apto 4B',
    notas: 'Anúnciate en la portería y sube por el ascensor hasta el piso 4.',
  };
  const CERCA = { lat: 8.6236, lng: -71.6503 };
  // Lo que haya quedado abierto con este repartidor de una vuelta anterior se cierra.
  for (const v of (
    (await yo('GET', '/datos/repartidor/pedidos').catch(() => ({ pedidos: [] }))).pedidos ?? []
  ).filter((x) => !['entregado', 'cancelado'].includes(x.estado)))
    await equipo('POST', `/datos/admin/pedidos/${v.id}/cancelar`, {
      motivo: 'Cierre de una vuelta anterior',
    }).catch(() => null);
  await sql(
    `UPDATE pedidos SET estado = 'cancelado' WHERE repartidor_id = '${ids.repartidor}' AND estado NOT IN ('entregado', 'cancelado')`,
  );
  async function recargar() {
    if ((await yo('GET', '/datos/repartidor/saldo-prepago')).disponible >= 1_000) return;
    const puntos = (await equipo('GET', '/datos/admin/puntos-venta')).puntos ?? [];
    let punto = puntos.find(
      (x) => x.usuarioId === ids.equipo && x.pais === 'VE' && x.moneda === 'USD',
    );
    if (!punto)
      punto = (
        await equipo('POST', '/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Venezuela (pruebas)',
          pais: 'VE',
          moneda: 'USD',
          usuarioId: ids.equipo,
        })
      ).punto;
    await equipo('POST', `/datos/admin/puntos-venta/${punto.id}/fondo`, {
      monto: 5_000,
      comprobante: `foto-puerta-${Date.now().toString(36)}`,
    });
    const { codigo } = await equipo('POST', '/datos/punto-venta/codigos', { monto: 1_000 });
    await yo('POST', '/datos/repartidor/recargar', { codigo });
  }
  const mio = await resto('GET', '/datos/mi-restaurante');
  const rest = mio.restaurante;
  const plato = (mio.platos ?? []).find((p) => p.nombreEs === 'Arepa reina pepiada');
  if (!rest || !plato) throw new Error('no está el restaurante de El Vigía con su plato');
  const ubicar = async (donde) => {
    for (let i = 0; i < 2; i++)
      await yo('POST', '/datos/repartidor/ubicacion', { ...donde, precision: 8 });
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${donde.lat}, lng = ${donde.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${ids.repartidor}'`,
    );
  };
  const cuenta = async (rol, nombre, vuelta) => {
    const r = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo: `foto.puerta.ve.${rol}.${vuelta}.${randomBytes(3).toString('hex')}@recorrido.test`,
      clave: DATOS.clave,
      rol,
    });
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
    );
    return { token: r.token, id: r.usuario.id };
  };
  return {
    zonaHoraria: 'America/Caracas',
    direcciones: [CASA, EDIFICIO],
    local: LOCAL,
    cerca: CERCA,
    rep: { id: ids.repartidor, token: tokens.repartidor },
    restoToken: tokens.restaurante,
    nombreRestaurante: rest.nombre,
    cuenta,
    cliente: (v) => cuenta('cliente', 'María Fernández', v),
    carrito: async () =>
      JSON.stringify({
        restauranteId: rest.id,
        restauranteNombre: rest.nombre,
        plan: rest.plan ?? 'inicial',
        restLat: LOCAL.lat,
        restLng: LOCAL.lng,
        moneda: 'USD',
        lineas: [
          {
            clave: `${plato.id}:`,
            platoId: plato.id,
            nombreEs: plato.nombreEs,
            nombreEn: plato.nombreEn,
            precioCentavos: plato.precioCentavos,
            cantidad: 2,
          },
        ],
      }),
    pedidoHastaAceptado: async (cli, dir) => {
      await recargar();
      await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL });
      await ubicar(LOCAL);
      const p = await pedir(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rest.id,
          lineas: [{ platoId: plato.id, cantidad: 2 }],
          propinaCentavos: 50,
          direccion: dir.direccion,
          apto: dir.apto,
          notas: dir.notas,
          lat: dir.lat,
          lng: dir.lng,
          metodoPago: 'efectivo',
        },
        cli.token,
      );
      const id = p.pedidoId;
      await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 });
      await ubicar(LOCAL);
      for (let i = 0; ; i++) {
        const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
        if (ofertas.some((o) => o.id === id)) break;
        if (i > 20) throw new Error(`la oferta ${id} no le llegó al repartidor`);
        await espera(3_000);
      }
      await yo('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {});
      return id;
    },
    recoger: async (id) => {
      await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {});
      const l = await yo('GET', `/datos/repartidor/pedidos/${id}/pago-local`);
      await yo('POST', `/datos/repartidor/pedidos/${id}/pago-local`, {
        montoPagado: l.montoEsperado,
        importeTicket: l.subtotal,
        metodo: 'efectivo',
      });
      await fotoPedido(`/datos/repartidor/pedidos/${id}/foto-recogida`, tokens.repartidor, LOCAL);
      await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {});
      await ubicar(CERCA);
    },
    entregar: async (id) => {
      await ubicar(EDIFICIO);
      await sql(
        `INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES ('${id}', 'llego_cliente')`,
      );
      await yo('POST', `/datos/repartidor/pedidos/${id}/cobrado`, {}).catch(() => null);
      await fotoPedido(`/datos/repartidor/pedidos/${id}/entregado`, tokens.repartidor, EDIFICIO);
      await yo('POST', '/datos/repartidor/conectar', { conectado: false });
    },
  };
}

const apagarPasajerosUs = async () => {
  await sql(
    "UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro') AND zona_id IN (SELECT id FROM zonas WHERE pais = 'US')",
  ).catch(() => null);
  await sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro') AND NOT EXISTS (SELECT 1 FROM servicios_zona z WHERE z.servicio_id = servicios.id AND z.estado = 'disponible')",
  ).catch(() => null);
};

const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'es') await pasada('en', await ciudadUs());
  await apagarPasajerosUs();
  if (SOLO !== 'en') await pasada('es', await ciudadVe());
} finally {
  await apagarPasajerosUs();
  await navegador.close();
  await conCamara.close();
  console.log(informe.map((x) => `  ok  ${x}`).join('\n'));
}
console.log(
  'foto de la puerta: todo comprobado; capturas en docs/capturas/recorrido/foto-puerta-*.png',
);
