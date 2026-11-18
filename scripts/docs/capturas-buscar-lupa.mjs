// Capturas reales de la guía «Buscar en Docs y ampliar una captura» (C-DOCS-LUPA, 15 nov 2026).
// Con el panel local encendido (PUERTO_PANEL=5181 npm run dev -w @tumbite/panel):
//   node scripts/docs/capturas-buscar-lupa.mjs [http://localhost:5181]
// En español, ejemplos de habla hispana (El Vigía); en inglés, de Estados Unidos (Novi, Michigan):
// regla C-CAPTURAS-POR-IDIOMA. Originales en docs/capturas/funciones/, livianas en public/docs/.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5181';
const raiz = join(import.meta.dirname, '..', '..');
const originales = join(raiz, 'docs', 'capturas', 'funciones');
const publicas = join(raiz, 'apps', 'panel', 'public', 'docs');

const PASADAS = {
  es: { prefijo: '/es', busqueda: 'wallet', guia: '/docs/ordering/ride-moto', captura: 1 },
  en: { prefijo: '', busqueda: 'billetera', guia: '/docs/ordering/ride-moto', captura: 0 },
};

const navegador = await chromium.launch();
for (const [idioma, p] of Object.entries(PASADAS)) {
  const pagina = await navegador.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const foto = async (nombre) => {
    // La burbuja del chat de soporte no tapa lo que se explica.
    await pagina.addStyleTag({ content: '.chat-soporte-burbuja{display:none!important}' });
    const png = join(originales, `docs-${nombre}-${idioma}.png`);
    await pagina.screenshot({ path: png });
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      '-resize',
      '540',
      '0',
      png,
      '-o',
      join(publicas, `docs-${nombre}-${idioma}.webp`),
    ]);
  };
  // 1. El buscador con la lista de sugerencias (en español se escribe la palabra en inglés).
  await pagina.goto(`${base}${p.prefijo}/docs`);
  const campo = pagina.getByRole('combobox');
  await campo.scrollIntoViewIfNeeded();
  await campo.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await pagina.mouse.wheel(0, -12);
  await campo.fill(p.busqueda);
  await pagina.getByRole('listbox').waitFor();
  await pagina.waitForTimeout(300);
  await foto('buscar');
  // 2. Una guía con capturas: el botón de la lupa en la esquina de cada una.
  await campo.fill('');
  await pagina.goto(`${base}${p.prefijo}${p.guia}`);
  const boton = pagina.locator('.docs-captura-boton').nth(p.captura);
  await boton.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await pagina.waitForTimeout(500);
  await foto('lupa-boton');
  // 3. La captura abierta en grande, con su pie y los botones «−» y «+».
  await boton.click();
  await pagina.locator('.pswp__img').first().waitFor();
  await pagina.waitForTimeout(1200);
  await foto('lupa-abierta');
  // 4. Ampliada con «+» para leer los detalles.
  await pagina.locator('.pswp__button--acercar').click();
  await pagina.waitForTimeout(1000);
  await pagina.locator('.pswp__button--acercar').click();
  // Que termine la animación y baje la versión grande.
  await pagina.waitForTimeout(2500);
  await foto('lupa-zoom');
  await pagina.close();
}
await navegador.close();
console.log('capturas de buscar y lupa listas');
