/* global document */
// Ícono (512x512) y gráfico destacado (1024x500) de Google Play para las tres apps. Todos los países.
// El ícono sale del icon.png de cada app (que se genera de los vectores de identidad-divoox/).
// El gráfico destacado (diseño aprobado del 11 nov, C-ICONOS-POR-APP) lleva el ícono de la app, para
// quién es, su nombre y su frase, sobre el COLOR DE SU APP (C-LAMINA-PLAY-COLOR-APP, 26 nov 2026):
// cliente rojo, Driver azul petróleo, Restaurants negro. El color no se escribe aquí: sale de
// app.json de cada app (lamina-play.mjs), y cada pieza se mide en sus píxeles antes de guardarla.
// Nada se estira. Salen en capturas-tiendas-con-titulo/<app>/Google Play/ (fuera de git).
// Con ENTREGA=<carpeta> copia además las piezas ahí.
// Uso: node scripts/marca/graficos-google-play.mjs
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  ALTO,
  ANCHO,
  LAMINAS,
  colorDeApp,
  comprobarIcono,
  comprobarLamina,
} from './lamina-play.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const frase = (t) =>
  t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*([^*]+)\*/g, '<b>$1</b>');
const copiar = (ruta, nombre) => {
  if (!process.env.ENTREGA) return;
  mkdirSync(process.env.ENTREGA, { recursive: true });
  copyFileSync(ruta, join(process.env.ENTREGA, nombre));
};

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const { app, carpeta, nombre, etiqueta, resalte, frase: frases } of LAMINAS) {
  const fondo = colorDeApp(app);
  const destino = join(RAIZ, 'capturas-tiendas-con-titulo', carpeta, 'Google Play');
  mkdirSync(destino, { recursive: true });
  const icono = readFileSync(join(RAIZ, 'apps', app, 'assets', 'icon.png')).toString('base64');
  await pagina.setViewportSize({ width: 512, height: 512 });
  await pagina.setContent(
    `<style>html,body{margin:0}</style><img src="data:image/png;base64,${icono}" width="512" height="512">`,
  );
  // PNG de 32 bits con alfa, totalmente opaco (lo pide Google Play para el ícono).
  const rutaIcono = join(destino, 'icono-512.png');
  const iconoPng = await sharp(await pagina.screenshot())
    .ensureAlpha(1)
    .png()
    .toBuffer();
  writeFileSync(rutaIcono, iconoPng);
  await comprobarIcono(iconoPng, fondo, `${carpeta} ícono`);
  copiar(rutaIcono, `${app}-icono-512.png`);
  for (const [idioma, etq, texto] of [
    ['English', etiqueta.at(0), frases.at(0)],
    ['Español', etiqueta.at(1), frases.at(1)],
  ]) {
    await pagina.setViewportSize({ width: ANCHO, height: ALTO });
    await pagina.setContent(
      `<!doctype html><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap');
html,body{margin:0;width:${ANCHO}px;height:${ALTO}px;background:${fondo};overflow:hidden}
.c{height:${ALTO}px;display:flex;align-items:center;gap:44px;padding:0 70px;box-sizing:border-box}
.c img{width:270px;height:270px;border-radius:60px;border:3px solid rgba(255,255,255,.28);flex:none}
.e{font-family:Poppins,sans-serif;font-weight:700;font-size:24px;letter-spacing:3px;color:${resalte}}
.n{font-family:Poppins,sans-serif;font-weight:700;font-size:62px;line-height:1.1;color:#fff;margin:6px 0 14px}
.t{font-family:Poppins,sans-serif;font-weight:700;font-size:36px;line-height:1.2;color:#fff}
.t b{color:${resalte}}
</style><div class="c"><img src="data:image/png;base64,${icono}"><div class="x"><div class="e">${etq}</div><div class="n">${nombre}</div><div class="t">${frase(texto)}</div></div></div>`,
      { waitUntil: 'networkidle' },
    );
    await pagina.evaluate(() => document.fonts.ready);
    // Si la frase no cabe en una línea, la parte resaltada baja entera a la segunda (nunca «a un /
    // toque»). El bloque de texto cabe dentro de la lámina, con su margen, en dos líneas como mucho.
    const caja = await pagina.evaluate(() => {
      const t = document.querySelector('.t');
      if (t.offsetHeight > 50) for (const b of t.querySelectorAll('b')) b.style.display = 'block';
      const x = document.querySelector('.x').getBoundingClientRect();
      return {
        der: x.right,
        arriba: x.top,
        abajo: x.bottom,
        lineas: Math.round(t.offsetHeight / 43.2),
      };
    });
    if (caja.der > ANCHO - 40 || caja.arriba < 30 || caja.abajo > ALTO - 30 || caja.lineas > 2)
      throw new Error(`${carpeta} ${idioma}: el texto no cabe bien (${JSON.stringify(caja)})`);
    const ruta = join(destino, `grafico-destacado-${idioma}.png`);
    const m = await comprobarLamina(
      await pagina.screenshot({ path: ruta }),
      fondo,
      `${carpeta} ${idioma}`,
    );
    console.log(`${carpeta} ${idioma}: ${fondo}, borde ${Math.round(m.borde * 100)} %`);
    copiar(ruta, `${app}-${idioma}.png`);
  }
}
await navegador.close();
console.log('gráficos de Google Play listos');
