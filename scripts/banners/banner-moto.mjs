/**
 * C-BANNER-MOTO (22 nov 2026, Richard vía Gerencia) — todos los países donde Moto está abierto.
 * Arma la imagen del banner de mototaxi para el carrusel de promociones del inicio de la app del
 * cliente, con la ilustración de la moto que ya usa la app (assets/inicio-nuevo/heroe-moto.webp),
 * en el mismo formato que la promoción de pizza (900 × 450, la moto a la derecha, escena oscura que
 * resalta sobre la tarjeta roja). Solo arma el archivo: se sube y se aprueba en «Banners de la app».
 *
 * Uso: node scripts/banners/banner-moto.mjs [salida.webp]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const salida = resolve(process.argv[2] ?? join(raiz, 'docs/capturas/banners/banner-moto.webp'));
const moto = readFileSync(join(raiz, 'apps/cliente/assets/inicio-nuevo/heroe-moto.webp')).toString(
  'base64',
);

const html = `<!doctype html><html><head><style>
  html,body{margin:0;width:900px;height:450px;overflow:hidden}
  .escena{position:relative;width:900px;height:450px;overflow:hidden;
    background:radial-gradient(ellipse 60% 75% at 60% 40%, #5A0A12 0%, #2C0609 55%, #160304 100%)}
  .piso{position:absolute;left:0;right:0;bottom:0;height:190px;
    background:linear-gradient(180deg,rgba(107,9,17,0) 0%,#6B0911 22%,#9E0A17 55%,#B30B19 100%)}
  .horizonte{position:absolute;left:0;right:0;bottom:150px;height:0;
    background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.25) 100%)}
  .luz{position:absolute;left:330px;top:10px;width:460px;height:420px;border-radius:50%;
    background:radial-gradient(circle, rgba(255,120,120,.20) 0%, rgba(255,80,80,0) 65%)}
  .sombra{position:absolute;left:400px;bottom:30px;width:380px;height:44px;border-radius:50%;
    background:radial-gradient(ellipse at center, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 70%)}
  .fundido{position:absolute;left:0;top:0;bottom:0;width:430px;
    background:linear-gradient(90deg,#F20D20 0%,#F20D20 30%,rgba(242,13,32,.55) 62%,rgba(242,13,32,0) 100%)}
  .moto{position:absolute;left:390px;bottom:44px;height:380px}
</style></head><body><div class="escena">
  <div class="luz"></div><div class="horizonte"></div><div class="piso"></div>
  <div class="sombra"></div>
  <div class="fundido"></div>
  <img class="moto" src="data:image/webp;base64,${moto}">
</div></body></html>`;

const nav = await chromium.launch();
const pag = await nav.newPage({ viewport: { width: 900, height: 450 }, deviceScaleFactor: 1 });
await pag.setContent(html);
await pag.waitForFunction(() => globalThis.document.querySelector('img')?.complete);
const tmp = join(mkdtempSync(join(tmpdir(), 'banner-moto-')), 'banner.png');
await pag.screenshot({ path: tmp });
await nav.close();
execFileSync('mkdir', ['-p', dirname(salida)]);
execFileSync('cwebp', ['-quiet', '-q', '86', tmp, '-o', salida]);
console.log(`Listo: ${salida}`);
