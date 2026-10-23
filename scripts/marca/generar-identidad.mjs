// Genera todas las piezas visuales de Divoox desde los vectores aprobados (identidad-divoox/).
// Uso: node scripts/marca/generar-identidad.mjs
// Nada se redibuja: se usan los trazos tal cual; solo se recorta, se centra y se pinta el fondo.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VEC = join(RAIZ, 'identidad-divoox', 'Divoox_Vectoriales');
const leer = (f) => readFileSync(join(VEC, f), 'utf8');
export const ROJO = '#F20D20';
export const NEGRO = '#101010';

const LOGO_CLARO = leer('01_Logo_Completo_Fondo_Claro.svg');
const LOGO_OSCURO = leer('02_Logo_Completo_Fondo_Oscuro.svg');
const ISO_CLARO = leer('05_Isotipo_GPS_Fondo_Claro.svg');
const ISO_OSCURO = leer('06_Isotipo_GPS_Fondo_Oscuro.svg');
// Sobre fondo rojo, el anillo transparente del isotipo oscuro dejaba el punto rojo perdido en el
// rojo. Un disco blanco detrás del punto (solo dentro del hueco) lo deja como el ícono rojo del
// manual: isotipo blanco con el punto rojo. No se tocan los trazos.
const ISO_SOBRE_ROJO = ISO_OSCURO.replace(
  '</title>',
  '</title><circle cx="623" cy="528" r="235" fill="#FFFFFF"/>',
);

/** La palabra sola, sin los trazos del isotipo que quedaban fuera del recuadro (x < 475). */
function palabraLimpia(svg) {
  return svg
    .replace(/d="([^"]+)"/g, (_, d) => {
      const partes = d.split(/(?=M)/).filter((p) => {
        const xs = [...p.matchAll(/[ML] ?(\d+)/g)].map((m) => Number(m[1]));
        return xs.length && Math.min(...xs) >= 475;
      });
      return `d="${partes.join(' ')}"`;
    })
    .replace(/<title>[^<]*<\/title>/, '<title>Divoox</title>');
}

function guardar(ruta, contenido) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
}

// 1. Vectores para la web (nítidos a cualquier tamaño).
const MARCA_WEB = join(RAIZ, 'apps/panel/public/marca');
guardar(join(MARCA_WEB, 'divoox-logo.svg'), LOGO_CLARO);
guardar(join(MARCA_WEB, 'divoox-logo-oscuro.svg'), LOGO_OSCURO);
guardar(join(MARCA_WEB, 'divoox-isotipo.svg'), ISO_CLARO);
guardar(join(MARCA_WEB, 'divoox-isotipo-oscuro.svg'), ISO_OSCURO);
guardar(
  join(MARCA_WEB, 'divoox-palabra.svg'),
  palabraLimpia(leer('03_Logotipo_Solo_Fondo_Claro.svg')),
);
guardar(
  join(MARCA_WEB, 'divoox-palabra-oscuro.svg'),
  palabraLimpia(leer('04_Logotipo_Solo_Fondo_Oscuro.svg')),
);
copyFileSync(
  join(RAIZ, 'identidad-divoox/favicon.ico'),
  join(RAIZ, 'apps/panel/public/favicon.ico'),
);

const datos = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const navegador = await chromium.launch();

/** Pinta un SVG centrado en un lienzo, sin deformarlo (contain), con su margen. */
async function png(
  ruta,
  { svg, ancho, alto, fondo = 'transparent', escala = 0.62, radio = 0, extra = '' },
) {
  const p = await navegador.newPage({ viewport: { width: ancho, height: alto } });
  await p.setContent(`<html><body style="margin:0;width:${ancho}px;height:${alto}px;background:transparent">
    <div style="width:${ancho}px;height:${alto}px;background:${fondo};border-radius:${radio}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(alto * 0.04)}px">
      <img src="${datos(svg)}" style="width:${Math.round(ancho * escala)}px;height:${Math.round(alto * escala)}px;object-fit:contain">${extra}
    </div></body></html>`);
  await p.waitForTimeout(150);
  mkdirSync(dirname(ruta), { recursive: true });
  await p.screenshot({ path: ruta, omitBackground: fondo === 'transparent' });
  await p.close();
}

guardar(join(MARCA_WEB, 'divoox-isotipo-blanco.svg'), ISO_SOBRE_ROJO);

// 2. Web: íconos (fondo negro, como el favicon aprobado) y la tarjeta para redes.
const PUB = join(RAIZ, 'apps/panel/public');
await png(join(PUB, 'icono.png'), { svg: ISO_OSCURO, ancho: 64, alto: 64, fondo: NEGRO });
await png(join(PUB, 'icono-512.png'), { svg: ISO_OSCURO, ancho: 512, alto: 512, fondo: NEGRO });
await png(join(PUB, 'apple-touch-icon.png'), {
  svg: ISO_OSCURO,
  ancho: 180,
  alto: 180,
  fondo: NEGRO,
});
await png(join(PUB, 'og.png'), {
  svg: LOGO_CLARO,
  ancho: 1200,
  alto: 630,
  fondo: '#FFFFFF',
  escala: 0.66,
  extra: `<div style="font:700 34px Arial,Helvetica,sans-serif;color:#666B73;letter-spacing:1px">Food · Rides · Delivery</div>`,
});

// 3. Apps: un ícono por app con las variantes oficiales del manual.
const APPS = [
  { app: 'cliente', fondo: ROJO, iso: ISO_SOBRE_ROJO },
  { app: 'repartidor', fondo: NEGRO, iso: ISO_OSCURO },
  { app: 'restaurante', fondo: '#FFFFFF', iso: ISO_CLARO },
];
for (const { app, fondo, iso } of APPS) {
  const A = join(RAIZ, 'apps', app, 'assets');
  await png(join(A, 'icon.png'), { svg: iso, ancho: 1024, alto: 1024, fondo, escala: 0.6 });
  await png(join(A, 'splash-icon.png'), { svg: iso, ancho: 1024, alto: 1024, escala: 0.5 });
  await png(join(A, 'android-icon-foreground.png'), {
    svg: iso,
    ancho: 1024,
    alto: 1024,
    escala: 0.42,
  });
  await png(join(A, 'android-icon-background.png'), {
    svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    ancho: 1024,
    alto: 1024,
    fondo,
  });
  // Monocromo (Android 13+): la silueta en una sola tinta.
  const mono = iso.replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"');
  await png(join(A, 'android-icon-monochrome.png'), {
    svg: mono,
    ancho: 1024,
    alto: 1024,
    escala: 0.42,
  });
  await png(join(A, 'favicon.png'), { svg: iso, ancho: 48, alto: 48, fondo, escala: 0.72 });
}

// 4. El logo de la cabecera de cada app (fondo claro), a tres veces su tamaño en pantalla.
const CABECERAS = [
  'apps/cliente/assets/inicio/logo.png',
  'apps/repartidor/assets/driver/logo.png',
  'apps/restaurante/assets/rest/logo.png',
];
for (const ruta of CABECERAS)
  await png(join(RAIZ, ruta), { svg: LOGO_CLARO, ancho: 1218, alto: 300, escala: 1 });

// 5. La mascota de la marca vieja se reemplaza por el isotipo (un marcador de mapa), en los mismos
// archivos y con la misma proporción, para no mover ningún diseño.
for (const ruta of [
  'apps/cliente/assets/comida/mascota.webp',
  'apps/repartidor/assets/driver/mascota.webp',
  'apps/restaurante/assets/rest/mascota.webp',
  'apps/panel/public/marca/mascota.webp',
]) {
  const tmp = join(RAIZ, ruta.replace(/\.webp$/, '.tmp.png'));
  await png(tmp, { svg: ISO_CLARO, ancho: 700, alto: 463, escala: 0.8 });
  const { execFileSync } = await import('node:child_process');
  execFileSync('python3', [
    '-c',
    `from PIL import Image; Image.open(r'${tmp}').save(r'${join(RAIZ, ruta)}', 'WEBP', quality=92, method=6)`,
  ]);
  const { rmSync } = await import('node:fs');
  rmSync(tmp);
}

await navegador.close();
console.log('identidad generada');
