/* global document */
// Las ocho capturas de la ficha de Divoox Driver en Google Play, en español y en inglés (22 nov 2026,
// pedido de Richard: «bien profesionales») — todos los países. Toma las pantallas reales de
// docs/tiendas/capturas-ficha-driver/originales/<es|en>/ (node scripts/recorrido/capturas-ficha-driver.mjs)
// y arma cada pieza a 1080 × 1920 (9:16, dentro de lo que pide Google Play: PNG de 24 bits sin
// transparencia, lado largo que no pase del doble del corto, menos de 8 MB): fondo del color de
// Driver, para quién es, titular corto (máximo seis palabras) y la pantalla entera dentro de un marco
// de teléfono, sin estirarla ni cortarla. Una idea por imagen y la misma composición en toda la serie.
//   → docs/tiendas/capturas-ficha-driver/finales/<es|en>/NN-nombre.png
//   → y una copia en ~/Documents/Entregas/Divoox/ficha-driver-google-play/<es|en>/ (ENTREGA=0 la omite)
// NO sube nada a Play Console: eso lo hace Gerencia con el dictamen del auditor de tiendas.
// Uso: node scripts/marca/ficha-driver-google-play.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection, security/detect-non-literal-regexp -- guion local: carpetas fijas del repositorio y de Entregas; los nombres de color son fijos */
import { chromium } from '@playwright/test';
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const RAIZ = join(import.meta.dirname, '..', '..');
const BASE = join(RAIZ, 'docs', 'tiendas', 'capturas-ficha-driver');
const ENTREGA = join(homedir(), 'Documents', 'Entregas', 'Divoox', 'ficha-driver-google-play');
const W = 1080;
const H = 1920;

// [archivo, titular en español, titular en inglés]; *palabra* va resaltada. Solo lo que la app hace hoy.
export const PIEZAS = [
  ['01-oferta', 'Gana con *cada viaje*', 'Earn on *every trip*'],
  ['02-conectado', 'Conéctate *cuando quieras*', 'Go online *whenever you want*'],
  ['03-moto-o-carro', 'Trabaja en *moto o carro*', 'Drive a *motorcycle or car*'],
  ['04-registro-guiado', 'Registro guiado, *foto por foto*', 'Guided sign-up, *photo by photo*'],
  ['05-saldo', 'Tu saldo, *siempre claro*', 'Your balance, *always clear*'],
  ['06-linea', 'Tu línea y *tu equipo*', 'Your line and *your team*'],
  ['07-foto-entrada', 'Ves la *foto de la entrada*', 'See the *entrance photo*'],
  ['08-camila', 'Camila *te ayuda*', 'Camila is *here to help*'],
];
const ETIQUETA = { es: 'PARA CONDUCTORES', en: 'FOR DRIVERS' };
// Colores de Divoox Driver, del sistema de diseño (`MARCA.colores` en packages/compartido/src/marca.ts,
// C-ICONOS-POR-APP): `logistica` es el fondo de la app y de su ícono; `logisticaAccion`, su azul claro.
const marca = readFileSync(join(RAIZ, 'packages', 'compartido', 'src', 'marca.ts'), 'utf8');
const colorDe = (nombre) => {
  const m = new RegExp(`\\b${nombre}: '(#[0-9A-Fa-f]{6})'`).exec(marca);
  if (!m) throw new Error(`la marca no tiene el color ${nombre}`);
  return m[1];
};
const FONDO = colorDe('logistica');
const RESALTE = colorDe('logisticaAccion');

const titular = (texto) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*([^*]+)\*/g, '<b>$1</b>');

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: W, height: H } });
let hechas = 0;
for (const idioma of ['es', 'en']) {
  for (const [nombre, es, en] of PIEZAS) {
    const origen = join(BASE, 'originales', idioma, `${nombre}.png`);
    if (!existsSync(origen)) throw new Error(`falta la pantalla original: ${idioma}/${nombre}.png`);
    const texto = idioma === 'es' ? es : en;
    const palabras = texto.replace(/\*/g, '').split(/\s+/).length;
    if (palabras > 6) throw new Error(`titular de más de seis palabras: «${texto}»`);
    const datos = `data:image/png;base64,${readFileSync(origen).toString('base64')}`;
    await pagina.setContent(
      `<!doctype html><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;800&display=swap');
html,body{margin:0;width:${W}px;height:${H}px;background:${FONDO};overflow:hidden}
.t{box-sizing:border-box;height:400px;padding:56px 72px 0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:20px;font-family:Poppins,sans-serif;text-align:center}
.t i{font-style:normal;font-weight:600;font-size:30px;letter-spacing:.14em;color:${RESALTE}}
.t span{font-weight:800;font-size:80px;line-height:1.1;color:#fff}
.t b{color:${RESALTE}}
/* El teléfono entero: marco negro de esquinas redondas, con la pantalla completa adentro. */
.f{position:absolute;left:50%;top:412px;width:800px;margin-left:-400px;box-sizing:border-box;
  padding:20px;background:#101010;border-radius:76px;
  box-shadow:0 0 0 3px #3a3a3a, 0 24px 60px rgba(0,0,0,.3)}
.f img{display:block;width:100%;border-radius:57px}
</style><div class="t"><i>${ETIQUETA[idioma]}</i><span>${titular(texto)}</span></div>
<div class="f"><img src="${datos}"></div>`,
      { waitUntil: 'networkidle' },
    );
    await pagina.evaluate(() => document.fonts.ready);
    const destino = join(BASE, 'finales', idioma);
    mkdirSync(destino, { recursive: true });
    const salida = join(destino, `${nombre}.png`);
    // PNG de 24 bits, sin canal de transparencia (lo pide Google Play).
    await sharp(await pagina.screenshot({ type: 'png' }))
      .flatten({ background: FONDO })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toFile(salida);
    const m = await sharp(salida).metadata();
    const peso = statSync(salida).size;
    if (m.width !== W || m.height !== H || m.hasAlpha || peso > 8 * 1024 * 1024)
      throw new Error(`${idioma}/${nombre}: no cumple las reglas de Google Play`);
    hechas++;
  }
}
await navegador.close();
if (process.env.ENTREGA !== '0') {
  mkdirSync(ENTREGA, { recursive: true });
  for (const idioma of ['es', 'en'])
    cpSync(join(BASE, 'finales', idioma), join(ENTREGA, idioma), { recursive: true });
}
console.log(
  `ficha de Driver: ${hechas} piezas de ${W} × ${H} en docs/tiendas/capturas-ficha-driver/finales/`,
);
