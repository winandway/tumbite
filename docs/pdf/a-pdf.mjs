/* global process, document, console */
// Convierte un HTML de docs/pdf a PDF horizontal con Chromium (Playwright).
// Uso: node docs/pdf/a-pdf.mjs <entrada.html> <salida.pdf>
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida)
  throw new Error('Uso: node docs/pdf/a-pdf.mjs <entrada.html> <salida.pdf>');
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(resolve(entrada)).href, { waitUntil: 'networkidle' });
await pagina.evaluate(() => document.fonts.ready);
await pagina.pdf({ path: salida, landscape: true, printBackground: true, preferCSSPageSize: true });
await navegador.close();
console.log(`PDF listo: ${salida}`);
