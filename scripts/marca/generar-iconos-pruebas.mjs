// C-PRUEBAS-OTRO-PAQUETE (18 nov 2026): el ícono de las apps de PRUEBAS de Android (otro paquete, otro
// nombre) lleva una banda «PRUEBAS» encima, para que nadie la confunda con la de la tienda. Se genera
// desde los mismos vectores aprobados de identidad-divoox (nada a mano): el isotipo con el fondo de
// cada app y la banda en la zona segura del ícono adaptable de Android (el 66 % del centro).
// Uso: node scripts/marca/generar-iconos-pruebas.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VEC = join(RAIZ, 'identidad-divoox', 'Divoox_Vectoriales');
const ISO_OSCURO = readFileSync(join(VEC, '06_Isotipo_GPS_Fondo_Oscuro.svg'), 'utf8');
// El mismo isotipo sobre rojo del generador de identidad (disco blanco detrás del punto).
const ISO_SOBRE_ROJO = ISO_OSCURO.replace(
  '</title>',
  '</title><circle cx="623" cy="528" r="235" fill="#FFFFFF"/>',
);
const ROJO = '#F20D20';
const NEGRO = '#101010';

/** Los mismos fondos e isotipos que los íconos de la tienda (C-ICONOS-POR-APP). */
export const APPS_PRUEBAS = [
  { app: 'cliente', fondo: ROJO, iso: ISO_SOBRE_ROJO },
  { app: 'repartidor', fondo: '#1F4D69', iso: ISO_OSCURO },
  { app: 'restaurante', fondo: NEGRO, iso: ISO_OSCURO },
];
/** Los archivos que deja el guion en cada app (los usa app.config.js en el perfil «pruebas»). */
export const ICONO_PRUEBAS = 'assets/pruebas/icon.png';
export const FRENTE_PRUEBAS = 'assets/pruebas/android-icon-foreground.png';

const datos = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/** El isotipo centrado y, encima, la banda blanca con «PRUEBAS» en negro (se lee sobre los tres fondos). */
async function pintar(navegador, ruta, { svg, lado, fondo, escala, banda }) {
  const p = await navegador.newPage({ viewport: { width: lado, height: lado } });
  await p.setContent(`<html><body style="margin:0;background:transparent">
    <div style="position:relative;width:${lado}px;height:${lado}px;background:${fondo};display:flex;align-items:center;justify-content:center">
      <img src="${datos(svg)}" style="width:${Math.round(lado * escala)}px;height:${Math.round(lado * escala)}px;object-fit:contain">
      <div style="position:absolute;left:${banda.izq}px;right:${banda.izq}px;top:${banda.arriba}px;height:${banda.alto}px;background:#FFFFFF;border:${Math.round(banda.alto * 0.08)}px solid ${NEGRO};border-radius:${Math.round(banda.alto * 0.2)}px;display:flex;align-items:center;justify-content:center;font:800 ${Math.round(banda.alto * 0.55)}px Arial,Helvetica,sans-serif;letter-spacing:${Math.round(banda.alto * 0.05)}px;color:${NEGRO}">PRUEBAS</div>
    </div></body></html>`);
  await p.waitForTimeout(150);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- carpetas fijas de las tres apps
  mkdirSync(dirname(ruta), { recursive: true });
  await p.screenshot({ path: ruta, omitBackground: fondo === 'transparent' });
  await p.close();
}

if (process.argv[1]?.endsWith('generar-iconos-pruebas.mjs')) {
  const navegador = await chromium.launch();
  for (const { app, fondo, iso } of APPS_PRUEBAS) {
    const A = join(RAIZ, 'apps', app);
    // Ícono completo (el que ve quien instala el APK y el lanzador viejo).
    await pintar(navegador, join(A, ICONO_PRUEBAS), {
      svg: iso,
      lado: 1024,
      fondo,
      escala: 0.6,
      banda: { izq: 96, arriba: 640, alto: 190 },
    });
    // Frente del ícono adaptable: transparente, con la banda dentro de la zona segura (centro 66 %).
    await pintar(navegador, join(A, FRENTE_PRUEBAS), {
      svg: iso,
      lado: 1024,
      fondo: 'transparent',
      escala: 0.42,
      banda: { izq: 220, arriba: 600, alto: 130 },
    });
  }
  await navegador.close();
  console.log('íconos de pruebas generados');
}
