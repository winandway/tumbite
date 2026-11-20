// C-CAMILA-CORREO-HILO (20 nov 2026): las capturas de la guía «Escríbenos por correo». Son el correo
// REAL que manda Camila: se arma con la misma plantilla y el mismo pie que usa el servidor
// (aHtml de correo.ts y cuerpoDeCorreo de camila/canales.ts) y se fotografía tal cual. Datos neutros:
// ningún nombre, correo ni ciudad de una persona real. No manda ningún correo ni toca ningún sitio.
// Salida: docs/capturas/funciones/camila-correo-<nombre>-<es|en>.png
//         apps/panel/public/docs/camila-correo-<nombre>-<es|en>.webp
// Uso: node scripts/docs/capturas-correo-camila.mjs
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const RAIZ = process.cwd();
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'funciones');
const WEB = join(RAIZ, 'apps', 'panel', 'public', 'docs');
fs.mkdirSync(ORIGINALES, { recursive: true });

const entrada = join(RAIZ, 'scripts', 'docs', '.entrada-correo-camila.ts');
fs.writeFileSync(
  entrada,
  `export { aHtml } from '../../apps/servidor/src/correo';
export { cuerpoDeCorreo } from '../../apps/servidor/src/camila/canales';
export { textoBienvenida } from '../../apps/servidor/src/camila/bienvenida';\n`,
);
let piezas;
try {
  const r = await build({
    entryPoints: [entrada],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  piezas = await import(
    `data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`
  );
} finally {
  fs.rmSync(entrada, { force: true });
}
const { aHtml, cuerpoDeCorreo, textoBienvenida } = piezas;

const RESPUESTA_ES = `Hola, Ana:

Gracias por escribir. Tu saldo para comisiones se recarga por adelantado, y con saldo vuelves a recibir carreras. Estos son los pasos:

1. Abre Divoox Driver y mira tu saldo en la pantalla de inicio.
2. Tócalo para ver el detalle en Ganancias, «Saldo para comisiones».
3. Recarga con un código, o pídele al equipo de tu ciudad que te cargue el saldo.
4. Acepta la carrera: la comisión se aparta y, al terminar el viaje, se descuenta.

Si después de recargar no ves el saldo, respóndeme con la hora de la recarga y lo reviso.

Ver la guía con capturas → https://divoox.com/es/docs/drivers/driver-balance`;
const RESPUESTA_EN = `Hi Alex,

Thanks for writing. Your balance for fees is topped up in advance, and with balance you get trips again. These are the steps:

1. Open Divoox Driver and check your balance on the home screen.
2. Tap it to see the details in Earnings, “Balance for fees.”
3. Top up with a code, or ask your city’s team to add the balance for you.
4. Accept the trip: the fee is set aside and, when the trip ends, it is deducted.

If you do not see the balance after topping up, reply with the time of the top-up and I will check it.

See the guide with screenshots → https://divoox.com/docs/drivers/driver-balance`;

const aWebp = (png, webp, ancho) =>
  execFileSync('cwebp', ['-quiet', '-q', '86', '-resize', String(ancho), '0', png, '-o', webp]);

const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const correos = {
      respuesta: cuerpoDeCorreo(idioma === 'en' ? RESPUESTA_EN : RESPUESTA_ES, idioma),
      bienvenida: cuerpoDeCorreo(
        textoBienvenida(idioma === 'en' ? 'Alex Example' : 'Ana Ejemplo', idioma),
        idioma,
      ),
    };
    for (const [nombre, texto] of Object.entries(correos)) {
      const pagina = await navegador.newPage({
        viewport: { width: 640, height: 300 },
        deviceScaleFactor: 2,
      });
      await pagina.setContent(aHtml(texto, idioma), { waitUntil: 'networkidle' });
      const png = join(ORIGINALES, `camila-correo-${nombre}-${idioma}.png`);
      await pagina.screenshot({ path: png, fullPage: true });
      aWebp(png, join(WEB, `camila-correo-${nombre}-${idioma}.webp`), 1000);
      await pagina.close();
      console.log('captura', png);
    }
  }
} finally {
  await navegador.close();
}
