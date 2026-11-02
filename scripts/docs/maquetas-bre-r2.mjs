// MAQUETAS fieles (BRE-R2, 2 nov 2026) para las guías «Promociones que creas y pagas tú» y «Modo
// destino». Regla del proyecto: ninguna guía sin imagen; si la pantalla real todavía no se puede
// capturar en el sitio de pruebas, va una maqueta fiel MARCADA para reemplazar (archivos
// «maqueta-*»). Se reemplazan por las capturas reales en BRE-5b y BRE-6b (FILA.md).
// Los textos son los mismos de las pantallas (apps/panel/src/panel/Promociones.tsx y
// apps/repartidor/src/piezas/ModoDestino.tsx); datos neutros.
// Salida: docs/capturas/maquetas/<nombre>-<es|en>.png y apps/panel/public/docs/<nombre>-<es|en>.webp
// Uso: node scripts/docs/maquetas-bre-r2.mjs
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const RAIZ = process.cwd();
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'maquetas');
const WEB = join(RAIZ, 'apps', 'panel', 'public', 'docs');
fs.mkdirSync(ORIGINALES, { recursive: true });

const ROJO = '#F20D20';
const NEGRO = '#101010';
const GRIS = '#666B73';
const VERDE = '#14833B';

const estilo = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Montserrat, Arial, sans-serif; background: #f4f4f5; color: ${NEGRO}; }
  h1, h2, button, .titulo { font-family: Poppins, Arial, sans-serif; }
  .tarjeta { background: #fff; border: 1px solid #2a2a2a; border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,.06); padding: 20px; }
  .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: ${GRIS}; }
  .caja { border: 1px solid #d4d4d8; border-radius: 8px; padding: 10px 12px; font-size: 15px;
    color: ${NEGRO}; background: #fff; }
  .boton { background: ${ROJO}; color: #fff; border: 0; border-radius: 999px; padding: 12px 22px;
    font-weight: 600; font-size: 15px; }
  .fino { background: #fff; color: ${NEGRO}; border: 1px solid #2a2a2a; }
  .insignia { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px;
    border-radius: 999px; background: #e8f5ec; color: ${VERDE}; }
`;

const T = {
  es: {
    titulo: 'Promociones',
    ayuda:
      'Atrae clientes nuevos y haz que vuelvan. Tu promoción sale con su insignia en la lista, en tu página y en el carrito, y se aplica sola en los pedidos con tarjeta. Tú la pagas: el descuento se resta de lo que te toca de cada pedido.',
    nueva: 'Nueva promoción',
    tipo: 'Tipo',
    tipoValor: 'Porcentaje de descuento',
    porcentaje: 'Descuento (%)',
    tope: 'Descuento máximo por pedido (opcional)',
    minimo: 'Pedido mínimo (opcional)',
    inicia: 'Empieza',
    vence: 'Termina',
    crear: 'Crear promoción',
    mias: 'Tus promociones',
    p1: '20 % de descuento desde $25.00',
    p2: 'Envío gratis',
    vigente: 'Activa',
    usadas: 'Pedidos',
    costo: 'Te costó (pedidos entregados)',
    terminar: 'Terminar',
    destino: 'Modo destino',
    destinoAyuda: 'Pon tu destino y solo te llegan pedidos que te acercan. Hasta dos veces al día.',
    campo: 'Tu destino',
    direccion: '1200 Calle Principal, Miami, FL',
    encender: 'Ir hacia allá',
    quedan: 'Te quedan 2 usos hoy.',
    activo: 'Solo pedidos hacia: 1200 Calle Principal, Miami, FL',
    quedan1: 'Te queda 1 uso hoy.',
    apagar: 'Apagar',
    conectado: 'Conectado',
  },
  en: {
    titulo: 'Promotions',
    ayuda:
      'Attract new customers and bring them back. Your promotion shows with its badge in the list, on your page and in the cart, and applies automatically to card orders. You fund it: the discount comes out of what you earn on each order.',
    nueva: 'New promotion',
    tipo: 'Type',
    tipoValor: 'Percentage off',
    porcentaje: 'Discount (%)',
    tope: 'Maximum discount per order (optional)',
    minimo: 'Minimum order (optional)',
    inicia: 'Starts',
    vence: 'Ends',
    crear: 'Create promotion',
    mias: 'Your promotions',
    p1: '20% off on $25.00+',
    p2: 'Free delivery',
    vigente: 'Active',
    usadas: 'Orders',
    costo: 'Cost to you (delivered orders)',
    terminar: 'End',
    destino: 'Destination mode',
    destinoAyuda:
      'Set your destination and only get orders that take you closer. Up to twice a day.',
    campo: 'Your destination',
    direccion: '1200 Main Street, Miami, FL',
    encender: 'Head there',
    quedan: '2 uses left today.',
    activo: 'Only orders toward: 1200 Main Street, Miami, FL',
    quedan1: '1 use left today.',
    apagar: 'Turn off',
    conectado: 'Online',
  },
};

function panelPromociones(t) {
  const fila = (nombre, usos, costo) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid #e4e4e7">
      <div><div class="titulo" style="font-weight:600;font-size:16px">${nombre}</div>
        <div style="font-size:13px;color:${GRIS};margin-top:4px">${t.usadas}: ${usos} · ${t.costo}: ${costo}</div></div>
      <div style="display:flex;gap:10px;align-items:center"><span class="insignia">${t.vigente}</span>
        <button class="boton fino" style="padding:8px 16px;font-size:13px">${t.terminar}</button></div>
    </div>`;
  return `<div style="padding:32px;width:1200px">
    <h1 style="font-size:28px">${t.titulo}</h1>
    <p style="color:${GRIS};margin:8px 0 24px;max-width:820px;line-height:1.5">${t.ayuda}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div class="tarjeta"><h2 style="font-size:18px;margin-bottom:16px">${t.nueva}</h2>
        <div style="display:grid;gap:14px">
          <label class="campo">${t.tipo}<div class="caja">${t.tipoValor} ▾</div></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label class="campo">${t.porcentaje}<div class="caja">20</div></label>
            <label class="campo">${t.tope}<div class="caja">$5.00</div></label></div>
          <label class="campo">${t.minimo}<div class="caja">$25.00</div></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label class="campo">${t.inicia}<div class="caja">11/05/2026</div></label>
            <label class="campo">${t.vence}<div class="caja">11/30/2026</div></label></div>
          <div><button class="boton">${t.crear}</button></div>
        </div></div>
      <div class="tarjeta"><h2 style="font-size:18px;margin-bottom:6px">${t.mias}</h2>
        ${fila(t.p1, 18, '$62.40')}${fila(t.p2, 9, '$35.91')}</div>
    </div></div>`;
}

function appDestino(t, encendido) {
  const cuerpo = encendido
    ? `<div style="font-size:15px;font-weight:600;margin:12px 0 6px;color:${VERDE}">${t.activo}</div>
       <div style="font-size:13px;color:${GRIS};margin-bottom:14px">${t.quedan1}</div>
       <button class="boton fino" style="width:100%">${t.apagar}</button>`
    : `<label class="campo" style="margin:12px 0">${t.campo}<div class="caja">${t.direccion}</div></label>
       <div style="font-size:13px;color:${GRIS};margin-bottom:14px">${t.quedan}</div>
       <button class="boton" style="width:100%">${t.encender}</button>`;
  return `<div style="width:390px;height:844px;background:#e5e7eb;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;background:
      linear-gradient(90deg,transparent 48%,#fff 48%,#fff 52%,transparent 52%) 0 0/120px 120px,
      linear-gradient(0deg,transparent 48%,#fff 48%,#fff 52%,transparent 52%) 0 0/120px 120px,#dfe3e8"></div>
    <div style="position:absolute;top:52px;left:16px;right:16px;display:flex;justify-content:space-between">
      <span class="tarjeta" style="padding:8px 14px;border-radius:999px;font-weight:600;font-size:14px">● ${t.conectado}</span></div>
    <div class="tarjeta" style="position:absolute;left:16px;right:16px;bottom:32px">
      <div class="titulo" style="font-weight:700;font-size:18px">${t.destino}</div>
      <div style="font-size:13px;color:${GRIS};margin-top:4px;line-height:1.4">${t.destinoAyuda}</div>
      ${cuerpo}</div></div>`;
}

const navegador = await chromium.launch();
async function foto(nombre, idioma, html, ancho, alto, anchoWeb) {
  const p = await navegador.newPage({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: 2,
  });
  await p.setContent(
    `<!doctype html><html lang="${idioma}"><head><meta charset="utf-8"><style>${estilo}</style></head><body>${html}</body></html>`,
  );
  const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
  await p.screenshot({ path: png, fullPage: true });
  await p.close();
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    '-resize',
    String(anchoWeb),
    '0',
    png,
    '-o',
    join(WEB, `${nombre}-${idioma}.webp`),
  ]);
}
for (const [i, t] of Object.entries(T)) {
  await foto('maqueta-restaurante-promociones', i, panelPromociones(t), 1200, 620, 1200);
  await foto('maqueta-driver-modo-destino', i, appDestino(t, false), 390, 844, 390);
  await foto('maqueta-driver-modo-destino-encendido', i, appDestino(t, true), 390, 844, 390);
}
await navegador.close();
console.log('maquetas listas');
