// C-FOTO-CARA-A-LA-VISTA y C-QUE-TE-FALTA (23 nov 2026) — capturas REALES y MEDIDA en pantalla del
// alta de un conductor nuevo de Venezuela en Divoox Driver (web), contra el servidor LOCAL del recorrido
// (.recorrido; antes: node scripts/recorrido/preparar.mjs). No toca el sitio de pruebas ni producción.
//
// Es también el CANDADO medido: en cada pantalla comprueba que el botón principal (y el motivo de no
// poder conectarse) quede ENTERO dentro de la ventana, sin deslizar, a 360×568 y 360×640, en español e
// inglés. Si algo queda fuera, termina con error y dice qué y dónde.
//
// Pasos: aviso de IA → inicio con la tarjeta de la cara arriba → deslizar sin la foto (el motivo junto
// a la barra) → «Tu cara» (consentimiento) → la cámara → la vista previa → la subida caída (y lenta) →
// la foto enviada → «qué te falta» (vehículo) → la moto vieja sin placa y su corrección.
//   → docs/capturas/driver-foto-cara/<nn>-<nombre>-<ancho>x<alto>-<es|en>.png
// Uso: node scripts/recorrido/capturas-driver-foto-cara.mjs   (SIN_LENTA=1 se salta la subida lenta)
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { deslizar } from './deslizar.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'driver-foto-cara');
mkdirSync(SALIDA, { recursive: true });
const ZONA = 'VE-MER-ELVIGIA';
const ORIGEN = { lat: 8.6219, lng: -71.6531 };
const PANTALLAS = [
  { width: 360, height: 568 },
  { width: 360, height: 640 },
];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    new globalThis.URL(URL).port,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);
const interno = async (ruta, cuerpo = {}) => {
  const r = await fetch(`${URL}/datos/interno/diagnostico/${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-reloj-secreto': DATOS.relojSecreto },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
};
const sql = (q) => interno('sql', { sql: q });
const pedir = async (metodo, ruta, cuerpo, token) => {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${JSON.stringify(d)}`);
  return d;
};

// Una cara DIBUJADA y neutra (no es una persona real) para la cámara de mentira del navegador.
let JPEG_EJEMPLO;
const video = join(mkdtempSync(join(tmpdir(), 'cara-')), 'cara.mjpeg');
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
    <rect width="640" height="480" fill="#D9DEE5"/>
    <ellipse cx="320" cy="520" rx="200" ry="150" fill="#3B4A5A"/>
    <ellipse cx="320" cy="230" rx="105" ry="130" fill="#C99A7A"/>
    <path d="M215 210 Q220 95 320 92 Q420 95 425 210 Q400 150 320 145 Q240 150 215 210Z" fill="#2B2420"/>
    <ellipse cx="282" cy="235" rx="11" ry="8" fill="#2B2420"/>
    <ellipse cx="358" cy="235" rx="11" ry="8" fill="#2B2420"/>
    <path d="M285 300 Q320 322 355 300" stroke="#7A4A3A" stroke-width="7" fill="none" stroke-linecap="round"/>
  </svg>`;
  const cuadro = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
  JPEG_EJEMPLO = cuadro;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- carpeta temporal propia
  writeFileSync(video, Buffer.concat(Array.from({ length: 30 }, () => cuadro)));
}

const fuera = [];
let navegador;
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${URL}/datos/salud`).then(
        () => true,
        () => false,
      )
    )
      break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2_000);
  }
  // La ciudad de pruebas de Venezuela (El Vigía), como la arma el guion de Moto.
  try {
    execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
      cwd: RAIZ,
      env: {
        ...process.env,
        URL_PRUEBAS: URL,
        RELOJ_SECRETO: DATOS.relojSecreto,
        CIUDAD_VE: 'el-vigia',
      },
      stdio: 'ignore',
    });
  } catch {
    /* la ciudad ya quedó armada */
  }
  // Sin nombre de ciudad real a la vista.
  await sql(`UPDATE zonas SET nombre = 'Ciudad de ejemplo' WHERE id = '${ZONA}'`);
  navegador = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
    ],
  });

  for (const idioma of ['es', 'en'])
    for (const pantalla of PANTALLAS) {
      const en = idioma === 'en';
      const tam = `${pantalla.width}x${pantalla.height}`;
      const r = await pedir('POST', '/datos/cuentas/registro', {
        nombre: en ? 'Sam Carter' : 'José Rojas',
        correo: `foto-cara-${idioma}-${tam}-${Date.now().toString(36)}@recorrido.test`,
        clave: DATOS.clave,
        rol: 'repartidor',
        idioma,
      });
      const yo = { id: r.usuario.id, token: r.token };
      await sql(
        `UPDATE usuarios SET zona_id = '${ZONA}', idioma = '${idioma}' WHERE id = '${yo.id}'`,
      );
      await sql(
        `INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${yo.id}', '${ZONA}') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
      );
      // Su moto ya declarada y en uso (dentro del plazo se trabaja con ella): solo le falta la cara.
      const moto = await pedir(
        'POST',
        '/datos/conductor/vehiculos',
        {
          tipo: 'moto',
          marca: en ? 'Sample Motors' : 'Motos Ejemplo',
          modelo: 'M150',
          anio: 2023,
          color: en ? 'Black' : 'Negro',
          placa: `AB${Date.now() % 1e6}`,
        },
        yo.token,
      );
      await pedir('GET', '/datos/conductor/verificacion', undefined, yo.token);
      await pedir('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: moto.id }, yo.token);
      await pedir(
        'PUT',
        '/datos/conductor/preferencias',
        { servicioId: 'moto', activa: true },
        yo.token,
      ).catch(() => null);
      const abrir = async (cuenta) => {
        const c = await navegador.newContext({
          viewport: pantalla,
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
          baseURL: URL,
          locale: en ? 'en-US' : 'es-US',
          geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
          permissions: ['geolocation', 'camera'],
        });
        await c.addInitScript(
          ([pase, u, i]) => {
            localStorage.setItem('tumbite.idioma', i);
            localStorage.setItem('tumbite.sesion', pase);
            localStorage.setItem(`divoox.permisos.${u}`, '1');
          },
          [cuenta.token, cuenta.id, idioma],
        );
        return c;
      };
      let ctx = await abrir(yo);
      let p = await ctx.newPage();
      let n = 0;
      const foto = async (nombre) => {
        n++;
        const archivo = `${String(n).padStart(2, '0')}-${nombre}-${tam}-${idioma}.png`;
        await p.screenshot({ path: join(SALIDA, archivo) });
        console.log(`✓ ${archivo}`);
      };
      // El candado medido: el elemento entero dentro de la ventana, sin deslizar.
      const aLaVista = async (id, donde) => {
        const caja = await p.getByTestId(id).first().boundingBox();
        // Lo visible de verdad: debajo de la cabecera y encima de la barra de pestañas (si están).
        const pestana = p.getByRole('tab', { name: en ? 'Home' : 'Inicio' }).first();
        const barra = (await pestana.count()) ? await pestana.boundingBox() : null;
        const menu = p.getByLabel(en ? 'Menu' : 'Menú').first();
        const cabecera = (await menu.count()) ? await menu.boundingBox() : null;
        const arriba = cabecera ? cabecera.y + cabecera.height : 0;
        const abajo = barra ? Math.min(pantalla.height, barra.y - 6) : pantalla.height;
        const ok =
          caja &&
          caja.y >= arriba - 0.5 &&
          caja.y + caja.height <= abajo + 0.5 &&
          caja.x >= 0 &&
          caja.x + caja.width <= pantalla.width + 0.5;
        if (!ok)
          fuera.push(
            `${donde} · ${id} · ${tam} ${idioma}: ${caja ? `y=${Math.round(caja.y)}…${Math.round(caja.y + caja.height)} (visible ${Math.round(arriba)}…${Math.round(abajo)})` : 'no está'}`,
          );
      };

      try {
        // Tramo 1: ningún texto cortado con «…» (el registro real en un Android angosto los tenía).
        const sinCortes = async (donde) => {
          const cortados = await p.evaluate(() =>
            [...globalThis.document.querySelectorAll('div, span')]
              .filter((x) => {
                const e = globalThis.getComputedStyle(x);
                const corta =
                  (e.textOverflow === 'ellipsis' && x.scrollWidth > x.clientWidth + 1) ||
                  (e.webkitLineClamp !== 'none' && x.scrollHeight > x.clientHeight + 1);
                return corta && x.textContent && x.offsetParent !== null;
              })
              .map((x) => x.textContent.slice(0, 40)),
          );
          for (const t of cortados)
            fuera.push(`${donde} · texto cortado «${t}» · ${tam} ${idioma}`);
        };
        // 1 · El aviso de IA (antes de cualquier foto): casilla y botón a la vista.
        await p.goto('/driver/');
        await p.getByTestId('aviso-ia').waitFor({ timeout: 90_000 });
        await espera(1200);
        await aLaVista('aviso-ia-casilla', 'aviso IA');
        await aLaVista('aviso-ia-aceptar', 'aviso IA');
        await foto('aviso-ia');
        await p.getByTestId('aviso-ia-casilla').click();
        await p.getByTestId('aviso-ia-aceptar').click();

        // 2 · El inicio: la tarjeta de la cara arriba de todo, con su botón.
        await p.getByTestId('tarjeta-cara').waitFor({ timeout: 60_000 });
        await espera(2500);
        await aLaVista('tarjeta-cara-tomar', 'inicio');
        await foto('inicio-tarjeta-cara');
        await sinCortes('inicio');

        // 3 · Desliza para conectarse sin la foto: el motivo pegado a la barra, con «Tomar mi foto».
        await deslizar(p, 'conectarme');
        await p.getByTestId('motivo-conectar').waitFor({ timeout: 60_000 });
        await espera(800);
        await aLaVista('motivo-conectar', 'motivo de no conectarse');
        await aLaVista('motivo-tomar-foto', 'motivo de no conectarse');
        await foto('motivo-sin-cara');
        await p.getByTestId('motivo-tomar-foto').click();

        // 4 · «Tu cara»: el consentimiento y «Acepto y sigo» en el pie fijo.
        await p.getByTestId('papeles-acepto').waitFor({ timeout: 60_000 });
        await espera(1200);
        await aLaVista('papeles-acepto', 'Tu cara');
        await foto('tu-cara-consentimiento');
        await sinCortes('Tu cara');
        await p.getByTestId('papeles-acepto').click();

        // 5 · Lista para tomar la foto.
        await p.getByTestId('papeles-tomar').waitFor({ timeout: 30_000 });
        await espera(800);
        await aLaVista('papeles-tomar', 'Tu cara');
        await foto('tu-cara-tomar');
        await p.getByTestId('papeles-tomar').click();

        // 6 · La cámara con el óvalo.
        await p.getByTestId('camara-disparo').waitFor({ timeout: 30_000 });
        await espera(3500);
        await aLaVista('camara-disparo', 'cámara');
        await foto('camara');
        await p.getByTestId('camara-disparo').click();

        // 7 · La vista previa: «Usar esta» y «Repetir».
        await p.getByTestId('papeles-usar').waitFor({ timeout: 30_000 });
        await espera(800);
        await aLaVista('papeles-usar', 'vista previa');
        await aLaVista('papeles-repetir', 'vista previa');
        await foto('vista-previa');

        // 8 · La subida lenta: se corta sola (45 s) y lo dice; la foto sigue ahí.
        const ruta = '**/datos/conductor/verificacion/foto/cara**';
        if (!process.env.SIN_LENTA && idioma === 'es' && pantalla.height === 640) {
          await p.route(ruta, async (x) => {
            if (x.request().method() !== 'POST') return x.continue();
            await espera(60_000);
            await x.abort().catch(() => undefined);
          });
          await p.getByTestId('papeles-usar').click();
          await espera(4000);
          await foto('subida-lenta-esperando');
          await p.getByTestId('papeles-error').waitFor({ timeout: 70_000 });
          await espera(500);
          await aLaVista('papeles-error', 'subida lenta');
          await aLaVista('papeles-usar', 'subida lenta');
          await foto('subida-lenta-se-corto');
          await p.unroute(ruta);
        }
        // 9 · La subida caída: el error junto al botón, y «Reintentar» sin repetir la foto.
        await p.route(ruta, (x) =>
          x.request().method() === 'POST' ? x.abort('internetdisconnected') : x.continue(),
        );
        await p.getByTestId('papeles-usar').click();
        await p.getByTestId('papeles-error').waitFor({ timeout: 30_000 });
        await espera(600);
        await aLaVista('papeles-error', 'subida caída');
        await aLaVista('papeles-usar', 'subida caída');
        await foto('subida-caida');
        await p.unroute(ruta);
        await p.getByTestId('papeles-usar').click();

        // 10 · La foto enviada.
        await p
          .getByTestId('ya-puedes-trabajar')
          .or(p.getByTestId('papeles-foto-lista'))
          .first()
          .waitFor({ timeout: 60_000 });
        await espera(1500);
        await foto('foto-enviada');

        // 11 · Lo que le falta ahora (lo siguiente de la lista), arriba del inicio.
        await p.goto('/driver/');
        await p.getByTestId('que-te-falta').waitFor({ timeout: 60_000 });
        await espera(2500);
        if (await p.getByTestId('falta-boton').count())
          await aLaVista('falta-boton', 'qué te falta');
        await foto('te-falta-siguiente');
        await sinCortes('qué te falta');

        // 12 · Otro conductor (con su cara ya tomada) con la moto guardada SIN placa, como la de un
        // conductor real: primero sin vehículo; después la moto vieja, que se corrige sin borrarla.
        if (pantalla.height === 640) {
          const r2 = await pedir('POST', '/datos/cuentas/registro', {
            nombre: en ? 'Alex Moore' : 'Luis Pérez',
            correo: `foto-cara-placa-${idioma}-${Date.now().toString(36)}@recorrido.test`,
            clave: DATOS.clave,
            rol: 'repartidor',
            idioma,
          });
          const otro = { id: r2.usuario.id, token: r2.token };
          await sql(
            `UPDATE usuarios SET zona_id = '${ZONA}', idioma = '${idioma}' WHERE id = '${otro.id}'`,
          );
          await sql(
            `INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${otro.id}', '${ZONA}') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
          );
          await pedir(
            'POST',
            '/datos/conductor/aviso-ia',
            { acepto: true, plataforma: 'web', desde: 'aviso' },
            otro.token,
          );
          await sql(
            `INSERT INTO kyc (usuario_id, selfie) VALUES ('${otro.id}', 'ejemplo') ON CONFLICT(usuario_id) DO UPDATE SET selfie = 'ejemplo'`,
          );
          await ctx.close();
          ctx = await abrir(otro);
          p = await ctx.newPage();
          await p.goto('/driver/');
          await p.getByTestId('falta-sin_vehiculo').waitFor({ timeout: 60_000 });
          await espera(2000);
          await aLaVista('falta-boton', 'sin vehículo');
          await foto('te-falta-vehiculo');
          await sql(
            `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, anio, color, placa, placa_estado) VALUES ('moto-${otro.id}', '${otro.id}', 'moto', '${en ? 'Sample Motors' : 'Motos Ejemplo'}', 'M150', 2023, '${en ? 'Black' : 'Negro'}', '', 'VE')`,
          );
          await p.goto('/driver/');
          await p.getByTestId('falta-sin_placa').waitFor({ timeout: 60_000 });
          await espera(2000);
          await aLaVista('falta-boton', 'moto sin placa');
          await foto('te-falta-placa');
          await p.getByTestId('falta-boton').click();
          await p.getByTestId('editar-placa').waitFor({ timeout: 60_000 });
          await espera(1200);
          await p.getByTestId('editar-vehiculo').scrollIntoViewIfNeeded();
          await foto('corregir-placa');
          await sinCortes('corregir placa');
          await p.getByTestId('editar-placa').fill(`AC${Date.now() % 1e5}`);
          await p.getByTestId('editar-guardar').click();
          await p.getByTestId('vehiculo-corregir').waitFor({ timeout: 30_000 });
          await espera(800);
          await foto('placa-guardada');
          await p.getByTestId('vehiculo-volver').click();
          await p.getByTestId('falta-vehiculo_sin_activar').waitFor({ timeout: 60_000 });
          await espera(1500);
          await aLaVista('falta-boton', 'activar la moto');
          await foto('te-falta-activar');
          await sinCortes('activar');
          // 13 · C-PAPEL-DICE-LA-VERDAD: un papel subido con la moto sin enviar dice «Subida. Falta
          // enviar tu moto a revisión» y qué falta para poder enviarla (no «en revisión»).
          const sube = await fetch(
            `${URL}/datos/conductor/vehiculos/moto-${otro.id}/documentos?tipo=registro`,
            {
              method: 'POST',
              headers: { authorization: `Bearer ${otro.token}`, 'content-type': 'image/jpeg' },
              body: JPEG_EJEMPLO,
            },
          );
          if (!sube.ok) throw new Error(`documento: ${sube.status}`);
          await p.goto('/driver/');
          await p.getByRole('tab', { name: en ? 'Profile' : 'Perfil' }).click({ timeout: 60_000 });
          const seccion = p.getByTestId('seccion-vehiculo').first();
          await seccion.waitFor({ timeout: 30_000 });
          if (
            !(await p
              .getByTestId('vehiculo-moto')
              .first()
              .isVisible()
              .catch(() => false))
          )
            await seccion.click();
          await p.getByTestId('vehiculo-moto').first().getByRole('button').first().click();
          await p.getByTestId('enviar-vehiculo-moto').waitFor({ timeout: 30_000 });
          await p.getByTestId('papel-registro').scrollIntoViewIfNeeded();
          await espera(1000);
          await foto('mi-vehiculo-subida-sin-enviar');
          await sinCortes('mi vehículo');
        }
      } catch (x) {
        if (process.env.FALLO_EN)
          await p.screenshot({ path: join(process.env.FALLO_EN, `fallo-${tam}-${idioma}.png`) });
        throw x;
      }
      await ctx.close();
    }
} finally {
  await navegador?.close();
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
}
if (fuera.length) {
  console.error(
    `\nC-FOTO-CARA-A-LA-VISTA: quedan cosas FUERA de pantalla:\n- ${fuera.join('\n- ')}`,
  );
  process.exit(1);
}
console.log('\nC-FOTO-CARA-A-LA-VISTA: todo a la vista en 360×568 y 360×640, en español e inglés.');
