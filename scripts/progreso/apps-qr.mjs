#!/usr/bin/env node
// Página de apps de prueba (14 nov 2026, pedido de Richard): un código QR por cada enlace, para
// abrirlo o instalarlo desde el teléfono con la cámara, sin correo ni WhatsApp. Lee
// progreso/instalar.json y reescribe el bloque entre «QR:INICIO» y «QR:FIN» de progreso/apps.html.
// Uso: node scripts/progreso/apps-qr.mjs   (después de cambiar una dirección en instalar.json)
import { readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const { grupos } = JSON.parse(readFileSync('progreso/instalar.json', 'utf8'));
let html = '';
for (const g of grupos) {
  html += `      <h2>${esc(g.titulo)}</h2>\n      <p>${esc(g.pista)}</p>\n      <div class="qrs">\n`;
  for (const e of g.enlaces) {
    const svg = (
      await QRCode.toString(e.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    )
      .replace(/\n/g, '')
      .replace('<svg ', `<svg role="img" aria-label="Código QR de ${esc(e.titulo)}" `);
    html += `        <a class="qr" id="${esc(e.id)}" href="${esc(e.url)}">${svg}<b>${esc(e.titulo)}</b><span>${esc(e.para)}</span><em>Abrir</em></a>\n`;
  }
  html += '      </div>\n';
}
const archivo = 'progreso/apps.html';
const pagina = readFileSync(archivo, 'utf8');
const [antes, resto] = pagina.split('<!-- QR:INICIO -->');
if (resto === undefined) throw new Error('apps.html no tiene la marca QR:INICIO');
const despues = resto.split('<!-- QR:FIN -->')[1];
writeFileSync(archivo, `${antes}<!-- QR:INICIO -->\n${html}      <!-- QR:FIN -->${despues}`);
console.log(`apps.html: ${grupos.reduce((n, g) => n + g.enlaces.length, 0)} códigos QR`);
