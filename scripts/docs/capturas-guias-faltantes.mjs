// Capturas REALES para las guías de Docs que no tenían ninguna (CAP-7, 1 nov 2026: «ninguna guía
// sin capturas»). Corre SOLO contra el sitio de pruebas con las cuentas de demostración
// (docs/CUENTAS-DE-PRUEBA.md, fuera de git). No mueve dinero.
// Salida: docs/capturas/funciones/<nombre>-<es|en>.png y apps/panel/public/docs/<nombre>-<es|en>.webp
// Uso: node scripts/docs/capturas-guias-faltantes.mjs [solo=web,cliente,...]
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const SITIO = 'https://staging.tumbite.com';
const RAIZ = process.cwd();
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'funciones');
const WEB = join(RAIZ, 'apps', 'panel', 'public', 'docs');
fs.mkdirSync(ORIGINALES, { recursive: true });
const SOLO = (process.argv.find((a) => a.startsWith('solo=')) ?? '')
  .slice(5)
  .split(',')
  .filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);

const aWebp = (png, webp, ancho) =>
  execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', String(ancho), '0', png, '-o', webp]);

const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const t = (es, en) => (idioma === 'en' ? en : es);
    const foto = async (p, nombre, opciones = {}) => {
      await p.waitForTimeout(1200);
      const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
      await (opciones.elemento ?? p).screenshot({ path: png });
      aWebp(png, join(WEB, `${nombre}-${idioma}.webp`), opciones.ancho ?? 540);
      console.log('foto', nombre, idioma);
    };

    if (toca('web')) {
      // La calculadora pública: lo que cobra Divoox al lado de lo que publican las otras apps.
      const ctx = await navegador.newContext({
        viewport: { width: 1280, height: 900 },
        locale: idioma === 'en' ? 'en-US' : 'es-US',
      });
      const p = await ctx.newPage();
      await p.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}/calculator`, {
        waitUntil: 'networkidle',
      });
      await foto(p, 'web-comparar-restaurante', { ancho: 960 });
      await p.getByRole('tab', { name: t('Cliente', 'Customer') }).click();
      await foto(p, 'web-comparar-cliente', { ancho: 960 });
      await ctx.close();
    }
  }
} finally {
  await navegador.close();
}
