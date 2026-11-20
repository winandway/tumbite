#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- guion de la Mac del equipo: carpetas y nombres fijos del propio guion, sin entrada de terceros */
// C-PLAZO-PAPELES (20 nov 2026): siembra en el SITIO DE PRUEBAS tres conductores de Venezuela de
// ejemplo, con fotos de ejemplo NEUTRAS dibujadas aquí (ilustraciones, ninguna persona real), para
// poder fotografiar las pantallas del superadmin del plazo de papeles. Hace por la API, como la app:
// registro → ciudad → moto → consentimiento → las seis fotos del asistente (cada una pasa por la
// comprobación automática real de pruebas) → «Enviar a revisión».
//   Andrés Ejemplo: todo enviado a revisión.
//   Sofía Ejemplo:  a medias (documento y cara, sin licencia ni seguro).
//   Mateo Ejemplo:   recién registrado, sin fotos (solo corre su plazo).
// Cuentas fijas (papeles.<nombre>@ejemplo.com): si ya existen, se entra y se sigue. Solo pruebas.
// Uso: node scripts/staging/sembrar-papeles-capturas.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL_PRUEBAS = (process.env.URL_PRUEBAS ?? 'https://staging.tumbite.com').replace(/\/$/, '');
if (!/^https:\/\/(staging\.tumbite\.com|tumbite-pruebas\.sitios\.dev)$/.test(URL_PRUEBAS)) {
  console.error('PARADA: esto solo corre contra el sitio de pruebas (staging).');
  process.exit(1);
}
const CLAVE = process.env.CLAVE_DEMO ?? 'Demo2026!';
const CIUDAD = 'VE-CCS-PRUEBAS';
const CARPETA = join(tmpdir(), 'divoox-papeles-ejemplo');
mkdirSync(CARPETA, { recursive: true });

// ───────────── Imágenes de ejemplo (ilustraciones) ─────────────
const MARCO = (cuerpo, w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#dfe3e8"/>${cuerpo}</svg>`;
const tarjeta = (titulo, interior) =>
  MARCO(
    `<rect x="60" y="90" width="840" height="520" rx="34" fill="#fff" stroke="#8a929c" stroke-width="5"/>
     <rect x="60" y="90" width="840" height="96" rx="34" fill="#2f4a63"/>
     <rect x="60" y="150" width="840" height="36" fill="#2f4a63"/>
     <text x="100" y="152" font-family="Arial" font-size="42" font-weight="700" fill="#fff">${titulo}</text>
     <text x="880" y="152" font-family="Arial" font-size="40" font-weight="700" fill="#f4c542" text-anchor="end">EJEMPLO</text>
     ${interior}`,
    960,
    700,
  );
const avatar = (x, y, s) =>
  `<rect x="${x}" y="${y}" width="${s}" height="${s * 1.2}" rx="14" fill="#c8d0d8"/>
   <circle cx="${x + s / 2}" cy="${y + s * 0.42}" r="${s * 0.2}" fill="#8a929c"/>
   <path d="M ${x + s * 0.12} ${y + s * 1.1} q ${s * 0.38} -${s * 0.52} ${s * 0.76} 0 z" fill="#8a929c"/>`;
const linea = (x, y, w) =>
  `<rect x="${x}" y="${y}" width="${w}" height="20" rx="8" fill="#b7bec7"/>`;
const barras = Array.from(
  { length: 46 },
  (_, i) =>
    `<rect x="${110 + i * 16}" y="300" width="${i % 3 === 0 ? 11 : 6}" height="150" fill="#222"/>`,
).join('');
const IMAGENES = new Map([
  [
    'doc_frente',
    tarjeta(
      'DOCUMENTO DE IDENTIDAD',
      `${avatar(100, 230, 190)}${linea(340, 240, 400)}${linea(340, 290, 320)}${linea(340, 340, 360)}
     <text x="340" y="440" font-family="Arial" font-size="34" fill="#444">N.º 00.000.000</text>
     <text x="340" y="500" font-family="Arial" font-size="30" fill="#777">NOMBRE DE EJEMPLO</text>`,
    ),
  ],
  [
    'doc_reverso',
    tarjeta(
      'DOCUMENTO DE IDENTIDAD',
      `${linea(100, 230, 520)}${linea(100, 270, 380)}${barras}
     <text x="110" y="540" font-family="Arial" font-size="30" fill="#777">REVERSO DE EJEMPLO</text>`,
    ),
  ],
  [
    'licencia_frente',
    tarjeta(
      'LICENCIA DE CONDUCIR',
      `${avatar(100, 230, 190)}${linea(340, 240, 400)}${linea(340, 290, 300)}
     <text x="340" y="400" font-family="Arial" font-size="34" fill="#444">CATEGORÍA: MOTO</text>
     <text x="340" y="460" font-family="Arial" font-size="34" fill="#444">VENCE: 01/01/2030</text>
     <text x="340" y="520" font-family="Arial" font-size="30" fill="#777">NOMBRE DE EJEMPLO</text>`,
    ),
  ],
  [
    'licencia_reverso',
    tarjeta(
      'LICENCIA DE CONDUCIR',
      `${linea(100, 230, 560)}${linea(100, 270, 400)}${linea(100, 310, 480)}
     <text x="110" y="520" font-family="Arial" font-size="30" fill="#777">REVERSO DE EJEMPLO</text>`,
    ),
  ],
  [
    'seguro',
    MARCO(
      `<rect x="170" y="40" width="620" height="780" rx="12" fill="#fff" stroke="#8a929c" stroke-width="5"/>
     <rect x="170" y="40" width="620" height="110" rx="12" fill="#2f4a63"/>
     <text x="210" y="112" font-family="Arial" font-size="40" font-weight="700" fill="#fff">PÓLIZA DE SEGURO</text>
     <text x="760" y="112" font-family="Arial" font-size="34" font-weight="700" fill="#f4c542" text-anchor="end">EJEMPLO</text>
     ${linea(210, 200, 540)}${linea(210, 250, 420)}${linea(210, 300, 500)}${linea(210, 350, 380)}
     <text x="210" y="470" font-family="Arial" font-size="32" fill="#444">VIGENCIA HASTA: 01/01/2030</text>
     <text x="210" y="530" font-family="Arial" font-size="32" fill="#444">VEHÍCULO: MOTO · EJEMPLO</text>
     ${linea(210, 600, 540)}${linea(210, 650, 460)}${linea(210, 700, 520)}`,
      960,
      860,
    ),
  ],
  [
    'cara',
    MARCO(
      `<rect width="720" height="900" fill="#cfd6dd"/>
     <ellipse cx="360" cy="430" rx="190" ry="250" fill="#f0c9a4"/>
     <path d="M170 380 Q360 80 550 380 Q520 230 360 215 Q200 230 170 380 Z" fill="#3b2a20"/>
     <circle cx="285" cy="410" r="20" fill="#2a2a2a"/><circle cx="435" cy="410" r="20" fill="#2a2a2a"/>
     <path d="M290 540 Q360 600 430 540" stroke="#8a4b3a" stroke-width="12" fill="none" stroke-linecap="round"/>
     <path d="M60 900 Q360 620 660 900 Z" fill="#2f4a63"/>
     <text x="360" y="880" font-family="Arial" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">EJEMPLO</text>`,
      720,
      900,
    ),
  ],
]);

async function dibujarFotos() {
  const nav = await chromium.launch();
  const fotos = new Map();
  try {
    const p = await nav.newPage();
    for (const [paso, svg] of IMAGENES) {
      const m = svg.match(/width="(\d+)" height="(\d+)"/);
      await p.setViewportSize({ width: Number(m[1]), height: Number(m[2]) });
      await p.setContent(`<body style="margin:0">${svg}</body>`);
      const bytes = await p.screenshot({ type: 'jpeg', quality: 88 });
      writeFileSync(join(CARPETA, `${paso}.jpg`), bytes);
      fotos.set(paso, bytes);
    }
  } finally {
    await nav.close();
  }
  return fotos;
}

// ───────────── API ─────────────
async function pedir(metodo, ruta, cuerpo, token, tipo = 'application/json') {
  const crudo = cuerpo instanceof Uint8Array;
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': tipo,
      'x-idioma': 'es',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : crudo ? cuerpo : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  return { estado: r.status, d };
}
const ok = (r, que) => {
  if (r.estado < 200 || r.estado >= 300)
    throw new Error(`${que}: ${r.estado} ${r.d.error ?? JSON.stringify(r.d)}`);
  return r.d;
};

async function sesion(nombre, correo, telefono) {
  const reg = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: CLAVE,
    rol: 'repartidor',
    telefono,
    fechaNacimiento: '1990-05-15',
    idioma: 'es',
  });
  if (reg.estado === 201) return reg.d.token;
  return ok(await pedir('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE }), 'entrar').token;
}

const resumen = [];
const fotos = await dibujarFotos();
const PERSONAS = [
  {
    nombre: 'Andrés Ejemplo',
    correo: 'ejemplo.andres.vz@ejemplo.com',
    pasos: 'todo',
    placa: 'ZZ100201',
    telefono: '+584125550201',
  },
  {
    nombre: 'Sofía Ejemplo',
    correo: 'ejemplo.sofia.vz@ejemplo.com',
    pasos: ['doc_frente', 'doc_reverso', 'cara'],
    placa: 'ZZ100202',
    telefono: '+584125550202',
  },
  {
    nombre: 'Mateo Ejemplo',
    correo: 'ejemplo.mateo.vz@ejemplo.com',
    pasos: [],
    placa: null,
    telefono: '+584125550203',
  },
];
for (const p of PERSONAS) {
  const token = await sesion(p.nombre, p.correo, p.telefono);
  ok(await pedir('PUT', '/datos/conductor/ciudad', { zonaId: CIUDAD }, token), 'ciudad');
  if (p.placa) {
    const tiene = await pedir('GET', '/datos/conductor/vehiculos', undefined, token);
    if (!(tiene.d.vehiculos ?? []).length)
      ok(
        await pedir(
          'POST',
          '/datos/conductor/vehiculos',
          {
            tipo: 'moto',
            marca: 'Marca',
            modelo: 'Modelo',
            anio: 2023,
            color: 'Negro',
            // La placa es única en todo el sitio de pruebas: una al azar por cuenta nueva.
            placa: `ZV${Math.floor(Math.random() * 9e5 + 1e5)}`,
          },
          token,
        ),
        'moto',
      );
  }
  const v0 = ok(await pedir('GET', '/datos/conductor/verificacion', undefined, token), 'asistente');
  const pasos = p.pasos === 'todo' ? v0.pasos.map((x) => x.paso) : p.pasos;
  if (pasos.includes('cara'))
    ok(await pedir('POST', '/datos/kyc/consentimiento', { acepto: true }, token), 'consentimiento');
  const colores = [];
  for (const paso of pasos) {
    const r = await pedir(
      'POST',
      `/datos/conductor/verificacion/foto/${paso}?origen=camara`,
      new Uint8Array(fotos.get(paso)),
      token,
      'image/jpeg',
    );
    colores.push(
      `${paso}:${r.estado >= 300 ? `ERR ${r.estado} ${r.d.error ?? ''}` : r.d.ia?.color}`,
    );
  }
  let enviado = 'no';
  if (p.pasos === 'todo') {
    const r = await pedir('POST', '/datos/conductor/verificacion/enviar', {}, token);
    enviado = r.estado < 300 ? 'sí' : `ERR ${r.estado} ${r.d.error ?? ''}`;
  }
  resumen.push(`${p.nombre}: ${colores.join(' ') || 'sin fotos'} · enviado: ${enviado}`);
}
console.log(resumen.join('\n'));
console.log(`Imágenes de ejemplo en ${CARPETA}`);
