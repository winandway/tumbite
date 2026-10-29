#!/usr/bin/env node
// Tiendas · Fase 1 (C-TIENDAS-CATALOGO): capturas ORIGINALES del panel «Productos» para Docs. Corre
// contra el sitio local del recorrido (node scripts/recorrido/preparar.mjs + wrangler dev en 8790):
// crea un supermercado de ejemplo con datos neutros, sube la planilla estándar (con una fila con
// error a propósito) y fotografía la pantalla en español y en inglés.
// Salida: docs/capturas/tiendas/<pantalla>-<es|en>.png y WebP en apps/panel/public/docs/.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = join(import.meta.dirname, '..', '..');
const URL = process.env.URL_RECORRIDO ?? 'http://localhost:8790';
const salida = join(raiz, 'docs', 'capturas', 'tiendas');
mkdirSync(salida, { recursive: true });
const corrida = Date.now().toString(36);
const clave = `Tienda-${corrida}-Clave1`;
let ip = 0;
async function api(metodo, ruta, cuerpo, token) {
  ip++;
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.68.${Math.floor(ip / 250)}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (s) =>
  execSync(
    `npx wrangler d1 execute tumbite-local --local --persist-to .recorrido/estado -c .recorrido/wrangler.jsonc --command ${JSON.stringify(s)}`,
    { cwd: raiz, stdio: 'ignore' },
  );
const correo = `tienda.${corrida}@ejemplo.com`;
const r = await api('POST', '/datos/cuentas/registro', {
  nombre: 'Laura Mendoza',
  correo,
  clave,
  rol: 'restaurante',
  telefono: '',
});
sql(`UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`);
const t = r.token;
await api(
  'PUT',
  '/datos/mi-restaurante',
  {
    nombre: 'Mercado Ejemplo',
    direccion: '100 Calle de Ejemplo, Miami, FL',
    lat: 25.77,
    lng: -80.19,
    categoria: 'Supermercado',
    telefono: '3055550100',
  },
  t,
);
await api('PUT', '/datos/mi-restaurante/tipo', { tipo: 'mercado' }, t);
const hoja = [
  'sku,barcode,name,brand,size,size_unit,category_1,price,available,stock_quantity,restriction',
  'M-001,012000161155,Spring water,Brand Sample,500,mL,Drinks,1.25,yes,48,',
  'M-002,,Whole milk,Brand Sample,1,gal,Dairy,4.20,yes,20,',
  'M-003,,White rice,Brand Sample,2,lb,Pantry,2.80,yes,35,',
  'M-004,,Bananas,Brand Sample,1,lb,Produce,0.69,yes,,',
  'M-005,,Ground coffee,Brand Sample,12,oz,Pantry,7.50,yes,15,',
  'M-006,,Paper towels,Brand Sample,6,each,Household,9.99,yes,12,',
  'M-007,,Light beer,Brand Sample,355,mL,Beer and wine,1.80,yes,60,alcohol',
  'M-008,,Orange juice,Brand Sample,52,fl oz,Drinks,4.99,no,0,',
].join('\n');
await api('POST', '/datos/mi-restaurante/productos/importar', { csv: hoja, confirmar: true }, t);

const navegador = await chromium.launch();
for (const idioma of ['es', 'en']) {
  const pre = idioma === 'es' ? '/es' : '';
  const ctx = await navegador.newContext({
    viewport: { width: 1280, height: 1100 },
    locale: idioma === 'es' ? 'es-US' : 'en-US',
  });
  await ctx.request.post(`${URL}/datos/cuentas/entrar`, { data: { correo, clave } });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctx.newPage();
  await p.goto(`${URL}${pre}/panel/products`);
  await p.waitForTimeout(1500);
  // Vista previa de una planilla con una fila con error, para mostrar cómo se ve.
  await p
    .getByLabel(idioma === 'es' ? 'Archivo de la planilla (.csv)' : 'Spreadsheet file (.csv)')
    .setInputFiles({
      name: 'productos.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `${hoja}\nM-009,7591016816019,Bad barcode,Brand Sample,1,each,Pantry,1,yes,,\n`,
      ),
    });
  await p
    .getByRole('button', {
      name: idioma === 'es' ? 'Revisar la planilla' : 'Check the spreadsheet',
    })
    .click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(salida, `productos-${idioma}.png`) });
  console.log('captura productos', idioma);
  await ctx.close();
}
await navegador.close();
for (const l of ['es', 'en'])
  execSync(
    `cwebp -quiet -q 82 "${join(salida, `productos-${l}.png`)}" -o "${join(raiz, 'apps', 'panel', 'public', 'docs', `tiendas-productos-${l}.webp`)}"`,
  );
console.log('ok');
