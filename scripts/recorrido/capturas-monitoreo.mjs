/* eslint-disable security/detect-non-literal-fs-filename -- rutas armadas con carpetas fijas de este repositorio */
// Capturas del monitoreo del superadmin (C-FICHA-OPERACION, C-TIEMPOS-OPERACION,
// C-MONITOREO-SERVICIOS, C-HORARIO-EMPLEADO; 15 nov 2026). Todos los países.
//
// Siembra datos NEUTROS e inventados en el servidor LOCAL del simulador (nunca en una base de la
// nube): Novi, Michigan (capturas en inglés) y El Vigía, Mérida (capturas en español), con fotos de
// muestra dibujadas. Después abre el panel local y guarda las capturas originales en
// docs/capturas/monitoreo/<pantalla>-<en|es>.png (computadora) y <pantalla>-movil-<en|es>.png (375).
//
// Uso (desde la raíz, con el servidor y el panel locales encendidos):
//   SIN_COMPILAR=1 CARPETA_RECORRIDO=.simulador SOLO_SERVIDOR=1 node scripts/recorrido/preparar.mjs
//   npx wrangler dev -c .simulador/wrangler.jsonc --persist-to .simulador/estado --port 8787 --local
//   npm run dev -w @tumbite/panel            (puerto 5173)
//   node scripts/recorrido/capturas-monitoreo.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const RAIZ = join(import.meta.dirname, '..', '..');
const CARPETA = process.env.CARPETA_RECORRIDO ?? '.simulador';
const PANEL = process.env.PANEL ?? 'http://localhost:5173';
const SALIDA = join(RAIZ, 'docs', 'capturas', 'monitoreo');
mkdirSync(SALIDA, { recursive: true });
const datos = JSON.parse(readFileSync(join(RAIZ, CARPETA, 'datos.json'), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'monitoreo-'));

const wrangler = (...args) =>
  execFileSync(
    'npx',
    [
      'wrangler',
      ...args,
      '--local',
      '--persist-to',
      `${CARPETA}/estado`,
      '-c',
      `${CARPETA}/wrangler.jsonc`,
    ],
    { cwd: RAIZ, stdio: 'pipe' },
  );

// ───────────── Fotos de muestra (dibujos neutros, nada real) ─────────────
const dibujo = async (nombre, svg) => {
  const archivo = join(tmp, `${nombre}.jpg`);
  await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">${svg}</svg>`),
  )
    .jpeg({ quality: 88 })
    .toFile(archivo);
  return archivo;
};
const letrero = (t) =>
  `<rect x="40" y="40" width="300" height="70" rx="10" fill="#fff" stroke="#2F2F2F" stroke-width="4"/>
   <text x="190" y="88" font-family="Helvetica, Arial" font-size="36" font-weight="700" text-anchor="middle" fill="#2F2F2F">${t}</text>`;
const fotos = {
  recogida: await dibujo(
    'recogida',
    `<rect width="1200" height="900" fill="#E9E2D6"/>
     <rect y="560" width="1200" height="340" fill="#B08A63"/>
     <rect x="420" y="250" width="360" height="330" rx="10" fill="#C9A77A" stroke="#2F2F2F" stroke-width="6"/>
     <polygon points="420,250 470,200 730,200 780,250" fill="#B89366" stroke="#2F2F2F" stroke-width="6"/>
     <rect x="520" y="360" width="160" height="80" rx="8" fill="#fff" stroke="#2F2F2F" stroke-width="4"/>
     <text x="600" y="412" font-family="Helvetica, Arial" font-size="34" font-weight="700" text-anchor="middle" fill="#F20D20">#A7C3</text>
     ${letrero('SAMPLE · MUESTRA')}`,
  ),
  entrega: await dibujo(
    'entrega',
    `<rect width="1200" height="900" fill="#DDE6EC"/>
     <rect y="700" width="1200" height="200" fill="#9C9A94"/>
     <rect x="470" y="160" width="300" height="560" rx="8" fill="#5C6B7A" stroke="#2F2F2F" stroke-width="6"/>
     <circle cx="730" cy="450" r="14" fill="#C9A646" stroke="#2F2F2F" stroke-width="3"/>
     <rect x="560" y="600" width="160" height="150" rx="8" fill="#C9A77A" stroke="#2F2F2F" stroke-width="6"/>
     ${letrero('SAMPLE · MUESTRA')}`,
  ),
  paquete: await dibujo(
    'paquete',
    `<rect width="1200" height="900" fill="#ECE7DE"/>
     <rect x="380" y="260" width="440" height="380" fill="#C49A6C" stroke="#2F2F2F" stroke-width="6"/>
     <line x1="600" y1="260" x2="600" y2="640" stroke="#8C6A45" stroke-width="18"/>
     ${letrero('SAMPLE · MUESTRA')}`,
  ),
};

// ───────────── La cuenta del equipo ─────────────
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});
const api = contexto.request;
const reg = await api.post(`${PANEL}/datos/cuentas/registro`, {
  data: {
    nombre: 'Soporte Divoox',
    correo: datos.correoEquipo,
    clave: datos.clave,
    rol: 'cliente',
    idioma: 'en',
  },
});
if (!reg.ok() && reg.status() !== 409)
  throw new Error(`registro: ${reg.status()} ${await reg.text()}`);
if (reg.status() === 409) {
  const e = await api.post(`${PANEL}/datos/cuentas/entrar`, {
    data: { correo: datos.correoEquipo, clave: datos.clave },
  });
  if (!e.ok()) throw new Error(`entrar: ${e.status()}`);
}
const admin = await api.post(`${PANEL}/datos/cuentas/hacer-admin`, {
  data: { semilla: datos.semilla },
});
if (!admin.ok()) throw new Error(`hacer-admin: ${admin.status()} ${await admin.text()}`);
const ruta = (await (await api.get(`${PANEL}/datos/admin/ruta`)).json()).ruta;
const BASE = `${PANEL}/panel/${ruta}`;

// ───────────── Los datos (SQL, directo en la base local) ─────────────
const m = (min) => `datetime('now', '${min} minutes')`;
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const uuid = (pre, n) => `${pre}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sql = [];
const ZONAS = {
  novi: {
    id: 'US-MI-NOVI',
    nombre: 'Novi',
    pais: 'US',
    zona: 'America/Detroit',
    lat: 42.4806,
    lng: -83.4755,
  },
  vigia: {
    id: 'VE-MER-ELVIGIA',
    nombre: 'El Vigía',
    pais: 'VE',
    zona: 'America/Caracas',
    lat: 8.6167,
    lng: -71.65,
  },
};
for (const z of Object.values(ZONAS))
  sql.push(`INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES (${q(z.id)}, ${q(z.nombre)}, ${q(z.pais)}, 'USD', ${q(z.zona)}, ${z.lat}, ${z.lng}, 30, 1)
    ON CONFLICT(id) DO UPDATE SET activa = 1, zona_horaria = excluded.zona_horaria;`);
const usuario = (id, nombre, rol, zona, activo = 1) =>
  sql.push(
    `INSERT OR IGNORE INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id, activo, idioma) VALUES (${q(id)}, ${q(`${id}@ejemplo.com`)}, ${q(nombre)}, ${q(rol)}, 'x', ${q(zona)}, ${activo}, 'en');`,
  );
usuario('mon-c-taylor', 'Taylor Brooks', 'cliente', ZONAS.novi.id);
usuario('mon-c-morgan', 'Morgan Diaz', 'cliente', ZONAS.novi.id);
usuario('mon-c-borrado', 'Cuenta borrada', 'cliente', ZONAS.novi.id, 0);
usuario('mon-c-maria', 'María Fernández', 'cliente', ZONAS.vigia.id);
usuario('mon-d-jordan', 'Jordan Lee', 'repartidor', ZONAS.novi.id);
usuario('mon-d-sam', 'Sam Rivera', 'repartidor', ZONAS.novi.id);
usuario('mon-d-carlos', 'Carlos Méndez', 'repartidor', ZONAS.vigia.id);
usuario('mon-o-1', 'Novi Pizza Owner', 'restaurante', ZONAS.novi.id);
usuario('mon-o-2', 'Market Owner', 'restaurante', ZONAS.novi.id);
usuario('mon-o-3', 'Dueña Pizzería', 'restaurante', ZONAS.vigia.id);
for (const [id, codigo, zona] of [
  ['mon-d-jordan', 'US-NOV-000014', ZONAS.novi.id],
  ['mon-d-sam', 'US-NOV-000020', ZONAS.novi.id],
  ['mon-d-carlos', 'VE-ELV-000003', ZONAS.vigia.id],
])
  sql.push(
    `INSERT OR IGNORE INTO repartidores (usuario_id, codigo, zona_id) VALUES (${q(id)}, ${q(codigo)}, ${q(zona)});`,
  );
sql.push(`INSERT OR IGNORE INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado) VALUES
  ('mon-v-sam', 'mon-d-sam', 'moto', 'Honda', 'CB300', 'Red', 'MOT482', 'MI'),
  ('mon-v-jordan', 'mon-d-jordan', 'carro', 'Toyota', 'Corolla', 'Gray', 'DVX2041', 'MI'),
  ('mon-v-carlos', 'mon-d-carlos', 'moto', 'Bera', 'SBR', 'Azul', 'AB1C23D', 'MER');`);
const comercio = (id, dueno, nombre, tipo, zona, dir, lat, lng) =>
  sql.push(
    `INSERT OR IGNORE INTO restaurantes (id, dueno_id, nombre, direccion, lat, lng, estado, abierto, zona_id, tipo_comercio, tiempo_prep_min) VALUES (${q(id)}, ${q(dueno)}, ${q(nombre)}, ${q(dir)}, ${lat}, ${lng}, 'aprobado', 1, ${q(zona)}, ${q(tipo)}, 15);`,
  );
comercio(
  'mon-r-pizza',
  'mon-o-1',
  'Novi Pizza Co.',
  'restaurante',
  ZONAS.novi.id,
  '43000 W 12 Mile Rd, Novi, MI',
  42.489,
  -83.469,
);
comercio(
  'mon-r-market',
  'mon-o-2',
  'Twelve Oaks Market',
  'mercado',
  ZONAS.novi.id,
  '27500 Novi Rd, Novi, MI',
  42.493,
  -83.474,
);
comercio(
  'mon-r-plaza',
  'mon-o-3',
  'Pizzería La Plaza',
  'restaurante',
  ZONAS.vigia.id,
  'Av. Bolívar, El Vigía, Mérida',
  8.619,
  -71.653,
);

const pedido = (p) =>
  sql.push(`INSERT OR REPLACE INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio,
    cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, zona_id,
    tiempo_prep_min, creado_en, pagado_en, aceptado_en, listo_en, recogido_en, entregado_en, cancelado_en, moneda)
    VALUES (${q(p.id)}, ${q(p.cliente)}, ${q(p.rest)}, ${q(p.rep)}, ${q(p.estado)}, ${q(JSON.stringify(p.lineas))}, ${p.total - 700}, 399, 200, 0, 400, ${p.total},
    300, ${p.total - 1000}, 600, 0, 100, 'inicial', ${q(p.dir)}, ${p.lat}, ${p.lng}, ${q(p.zona)}, ${p.prep ?? 15},
    ${m(p.t.creado)}, ${p.t.pagado == null ? 'NULL' : m(p.t.pagado)}, ${p.t.aceptado == null ? 'NULL' : m(p.t.aceptado)},
    ${p.t.listo == null ? 'NULL' : m(p.t.listo)}, ${p.t.recogido == null ? 'NULL' : m(p.t.recogido)},
    ${p.t.entregado == null ? 'NULL' : m(p.t.entregado)}, ${p.t.cancelado == null ? 'NULL' : m(p.t.cancelado)}, 'USD');`);
const historial = (id, filas) => {
  sql.push(`DELETE FROM historial_estados WHERE pedido_id = ${q(id)};`);
  for (const [estado, min, actor] of filas)
    sql.push(
      `INSERT INTO historial_estados (pedido_id, estado, actor_id, creado_en) VALUES (${q(id)}, ${q(estado)}, ${q(actor)}, ${m(min)});`,
    );
};
const hitos = (id, filas) => {
  for (const [hito, min, valor] of filas)
    sql.push(
      `INSERT OR REPLACE INTO hitos_pedido (pedido_id, hito, valor, creado_en) VALUES (${q(id)}, ${q(hito)}, ${valor ?? 'NULL'}, ${m(min)});`,
    );
};
const evidencia = (id, tipo, e) =>
  sql.push(`INSERT OR REPLACE INTO evidencias (pedido_id, tipo, clave, lat, lng, distancia_m, modo, nota, creada_en, confirmada_en) VALUES
    (${q(id)}, ${q(tipo)}, ${q(e.clave ?? '')}, ${e.lat}, ${e.lng}, ${e.dist}, ${q(e.modo)}, ${q(e.nota ?? '')}, ${m(e.creada)}, ${e.confirmada == null ? 'NULL' : m(e.confirmada)});`);
const oferta = (id, rep, km, creada, resp) =>
  sql.push(
    `INSERT OR REPLACE INTO ofertas (pedido_id, repartidor_id, estado, km, creada_en, respondida_en) VALUES (${q(id)}, ${q(rep)}, 'aceptada', ${km}, ${m(creada)}, ${m(resp)});`,
  );

// Novi (inglés): un pedido de comida entregado de punta a punta, uno vivo en cocina atrasado, una
// compra de tienda en camino, uno entregado en mano y uno cancelado de una cuenta borrada.
const P = {
  completo: uuid('a7c3e1f0', 1),
  cocina: uuid('b51d07aa', 2),
  tienda: uuid('c2e94b10', 3),
  mano: uuid('d0a1ff42', 4),
  cancelado: uuid('e93c5a07', 5),
  vigia: uuid('a7c3e9b2', 6),
  vigiaVivo: uuid('f17b20c3', 7),
  // Mismo código corto que `completo` (A7C3E1), también de Novi: la búsqueda en inglés muestra los dos.
  repetido: uuid('a7c3e1b4', 8),
};
const CASA_NOVI = { dir: '41200 Ten Mile Rd, Novi, MI', lat: 42.4705, lng: -83.452 };
pedido({
  id: P.completo,
  cliente: 'mon-c-taylor',
  rest: 'mon-r-pizza',
  rep: 'mon-d-jordan',
  estado: 'entregado',
  total: 3460,
  zona: ZONAS.novi.id,
  ...CASA_NOVI,
  lineas: [
    { nombreEs: 'Pizza Margherita grande', cantidad: 1 },
    { nombreEs: 'Garlic knots', cantidad: 2 },
  ],
  t: { creado: -62, pagado: -61, aceptado: -60, listo: -46, recogido: -44, entregado: -36 },
});
historial(P.completo, [
  ['pagado', -61, 'mon-c-taylor'],
  ['aceptado', -60, 'mon-r-pizza'],
  ['listo', -46, 'mon-r-pizza'],
  ['en_camino', -44, 'mon-r-pizza'],
  ['entregado', -36, 'mon-d-jordan'],
]);
oferta(P.completo, 'mon-d-jordan', 2.1, -51, -50);
hitos(P.completo, [
  ['llego_restaurante', -46],
  ['casi_llega', -38],
  ['llego_cliente', -37],
]);
evidencia(P.completo, 'recogida', {
  clave: `evidencias/${P.completo}/recogida-1`,
  lat: 42.48905,
  lng: -83.46915,
  dist: 14,
  creada: -44.5,
  confirmada: -44,
});
evidencia(P.completo, 'entrega', {
  clave: `evidencias/${P.completo}/entrega-1`,
  lat: 42.47055,
  lng: -83.45205,
  dist: 9,
  modo: 'puerta',
  nota: 'Front porch, by the door',
  creada: -36,
  confirmada: -36,
});
sql.push(
  `INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle, creado_en) VALUES (${q(P.completo)}, 'tiempo_ajustado', '15 min', ${m(-60)});`,
);

pedido({
  id: P.cocina,
  cliente: 'mon-c-morgan',
  rest: 'mon-r-pizza',
  rep: null,
  estado: 'aceptado',
  total: 2190,
  zona: ZONAS.novi.id,
  ...CASA_NOVI,
  lineas: [{ nombreEs: 'Pepperoni slice', cantidad: 3 }],
  t: { creado: -33, pagado: -32, aceptado: -31 },
});
historial(P.cocina, [
  ['pagado', -32, 'mon-c-morgan'],
  ['aceptado', -31, 'mon-r-pizza'],
]);
sql.push(
  `INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle, creado_en) VALUES (${q(P.cocina)}, 'recordatorio_1', '1 min', ${m(-31.5)});`,
);

pedido({
  id: P.tienda,
  cliente: 'mon-c-taylor',
  rest: 'mon-r-market',
  rep: 'mon-d-jordan',
  estado: 'en_camino',
  total: 5825,
  zona: ZONAS.novi.id,
  ...CASA_NOVI,
  lineas: [{ nombreEs: 'Groceries', cantidad: 8 }],
  t: { creado: -26, pagado: -25, aceptado: -24, listo: -14, recogido: -9 },
});
historial(P.tienda, [
  ['pagado', -25, 'mon-c-taylor'],
  ['aceptado', -24, 'mon-r-market'],
  ['listo', -14, 'mon-r-market'],
  ['en_camino', -9, 'mon-r-market'],
]);
oferta(P.tienda, 'mon-d-jordan', 0.9, -17, -16.5);
hitos(P.tienda, [['llego_restaurante', -12]]);
evidencia(P.tienda, 'recogida', {
  clave: `evidencias/${P.tienda}/recogida-1`,
  lat: 42.49302,
  lng: -83.47405,
  dist: 6,
  creada: -9.5,
  confirmada: -9,
});

pedido({
  id: P.mano,
  cliente: 'mon-c-morgan',
  rest: 'mon-r-pizza',
  rep: 'mon-d-jordan',
  estado: 'entregado',
  total: 1880,
  zona: ZONAS.novi.id,
  ...CASA_NOVI,
  lineas: [{ nombreEs: 'Calzone', cantidad: 1 }],
  t: { creado: -180, pagado: -179, aceptado: -178, listo: -160, recogido: -158, entregado: -146 },
});
historial(P.mano, [
  ['pagado', -179, 'mon-c-morgan'],
  ['aceptado', -178, 'mon-r-pizza'],
  ['listo', -160, 'mon-r-pizza'],
  ['en_camino', -158, 'mon-r-pizza'],
  ['entregado', -146, 'mon-d-jordan'],
]);
evidencia(P.mano, 'entrega', {
  lat: 42.4706,
  lng: -83.4521,
  dist: 7,
  modo: 'mano',
  creada: -146,
  confirmada: -146,
});

pedido({
  id: P.cancelado,
  cliente: 'mon-c-borrado',
  rest: 'mon-r-pizza',
  rep: null,
  estado: 'cancelado',
  total: 1590,
  zona: ZONAS.novi.id,
  ...CASA_NOVI,
  lineas: [{ nombreEs: 'Cheese pizza', cantidad: 1 }],
  t: { creado: -300, pagado: -299, cancelado: -293 },
});
historial(P.cancelado, [
  ['pagado', -299, 'mon-c-borrado'],
  ['cancelado', -293, null],
]);
sql.push(
  `INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle, creado_en) VALUES (${q(P.cancelado)}, 'cancelado_sin_respuesta', '6 min', ${m(-293)});`,
);

// Un pedido cerrado de Novi con el MISMO código corto que el entregado (A7C3E1): así el ejemplo del
// buscador en inglés muestra un código repetido sin salir de Novi. Cerrado: no cambia lo que está vivo.
pedido({
  id: P.repetido,
  cliente: 'mon-c-morgan',
  rest: 'mon-r-pizza',
  rep: null,
  estado: 'cancelado',
  total: 2150,
  zona: ZONAS.novi.id,
  ...CASA_NOVI,
  lineas: [{ nombreEs: 'Pepperoni pizza', cantidad: 1 }],
  t: { creado: -420, pagado: -419, cancelado: -412 },
});
historial(P.repetido, [
  ['pagado', -419, 'mon-c-morgan'],
  ['cancelado', -412, null],
]);

// El Vigía (español).
const CASA_VIGIA = { dir: 'Calle 5 con Av. 15, El Vigía, Mérida', lat: 8.6105, lng: -71.644 };
pedido({
  id: P.vigia,
  cliente: 'mon-c-maria',
  rest: 'mon-r-plaza',
  rep: 'mon-d-carlos',
  estado: 'entregado',
  total: 1450,
  zona: ZONAS.vigia.id,
  ...CASA_VIGIA,
  lineas: [
    { nombreEs: 'Pizza margarita mediana', cantidad: 1 },
    { nombreEs: 'Refresco 1,5 L', cantidad: 1 },
  ],
  t: { creado: -75, pagado: -74, aceptado: -73, listo: -57, recogido: -54, entregado: -45 },
});
historial(P.vigia, [
  ['pagado', -74, 'mon-c-maria'],
  ['aceptado', -73, 'mon-r-plaza'],
  ['listo', -57, 'mon-r-plaza'],
  ['en_camino', -54, 'mon-r-plaza'],
  ['entregado', -45, 'mon-d-carlos'],
]);
oferta(P.vigia, 'mon-d-carlos', 1.4, -63, -62);
hitos(P.vigia, [
  ['llego_restaurante', -58],
  ['llego_cliente', -46],
]);
evidencia(P.vigia, 'recogida', {
  clave: `evidencias/${P.vigia}/recogida-1`,
  lat: 8.61905,
  lng: -71.65305,
  dist: 11,
  creada: -54.5,
  confirmada: -54,
});
evidencia(P.vigia, 'entrega', {
  clave: `evidencias/${P.vigia}/entrega-1`,
  lat: 8.61055,
  lng: -71.64405,
  dist: 12,
  modo: 'seguro',
  nota: 'En la recepción del edificio',
  creada: -45,
  confirmada: -45,
});
pedido({
  id: P.vigiaVivo,
  cliente: 'mon-c-maria',
  rest: 'mon-r-plaza',
  rep: 'mon-d-carlos',
  estado: 'en_camino',
  total: 980,
  zona: ZONAS.vigia.id,
  ...CASA_VIGIA,
  lineas: [{ nombreEs: 'Empanadas', cantidad: 4 }],
  t: { creado: -20, pagado: -19, aceptado: -18, listo: -8, recogido: -5 },
});
historial(P.vigiaVivo, [
  ['pagado', -19, 'mon-c-maria'],
  ['aceptado', -18, 'mon-r-plaza'],
  ['listo', -8, 'mon-r-plaza'],
  ['en_camino', -5, 'mon-r-plaza'],
]);

// Viajes: auto terminado, moto en curso con una emergencia abierta, un envío y una moto en El Vigía.
// C-BUSCADOR-INSTANTANEO (16 nov 2026): pedidos cerrados que comparten la PRIMERA letra del código,
// para mostrar que con una sola letra ya salen, con cuántos hay y «Ver todos». En inglés, «b» y todos
// de Novi (junto al vivo b51d07aa); en español, «f» y todos de El Vigía (junto al vivo f17b20c3).
const letraDe = (idioma) => (idioma === 'en' ? 'b' : 'f');
for (let i = 0; i < 7; i++) {
  const enNovi = {
    id: uuid(`b${String(i + 2).repeat(2)}e${i}0a1`.slice(0, 8), 60 + i),
    cliente: 'mon-c-morgan',
    rest: 'mon-r-pizza',
    rep: 'mon-d-jordan',
    estado: i === 3 ? 'cancelado' : 'entregado',
    total: 1890 + i * 215,
    zona: ZONAS.novi.id,
    ...CASA_NOVI,
    lineas: [{ nombreEs: 'Pepperoni pizza', cantidad: 1 }],
    t:
      i === 3
        ? { creado: -1500 - i * 600, pagado: -1499 - i * 600, cancelado: -1490 - i * 600 }
        : {
            creado: -1500 - i * 600,
            pagado: -1499 - i * 600,
            aceptado: -1497 - i * 600,
            listo: -1482 - i * 600,
            recogido: -1478 - i * 600,
            entregado: -1460 - i * 600,
          },
  };
  pedido(enNovi);
  pedido({
    ...enNovi,
    id: uuid(`f${String(i + 2).repeat(2)}a${i}0c4`.slice(0, 8), 70 + i),
    cliente: 'mon-c-maria',
    rest: 'mon-r-plaza',
    rep: 'mon-d-carlos',
    total: 1250 + i * 140,
    zona: ZONAS.vigia.id,
    ...CASA_VIGIA,
    lineas: [{ nombreEs: 'Pizza margarita mediana', cantidad: 1 }],
  });
}

const V = {
  auto: uuid('a7c4d2e1', 11),
  moto: uuid('9be1c0d4', 12),
  envio: uuid('5d7e3a90', 13),
  motoVigia: uuid('a7c5f3b8', 14),
};
const tarifa = (servicio, zona) => ({ id: `mon-t-${servicio}-${zona}`, servicio, zona });
const TARIFA_JSON = JSON.stringify({
  base: 250,
  porKm: 110,
  porMinuto: 25,
  minimo: 600,
  moneda: 'USD',
  esperaGratisS: 300,
  factorCallePb: 13000,
  velocidadKmh: 28,
});
for (const t of [
  tarifa('carro', ZONAS.novi.id),
  tarifa('moto', ZONAS.novi.id),
  tarifa('envios', ZONAS.novi.id),
  tarifa('moto', ZONAS.vigia.id),
])
  sql.push(`INSERT OR IGNORE INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo, espera_gratis_s, por_minuto_espera,
    cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento, tope_dinamico_pb, redondeo, activa) VALUES (${q(t.id)}, ${q(t.servicio)}, ${q(t.zona)}, 'USD',
    250, 110, 25, 600, 300, 10, 120, 300, 300, 10000, 1, 0);`);
const viaje = (v) => {
  const cot = `mon-q-${v.id.slice(0, 8)}`;
  sql.push(`INSERT OR REPLACE INTO cotizaciones_viaje (id, cliente_id, servicio_id, zona_id, tarifa_id, origen_lat, origen_lng, origen_direccion,
    destino_lat, destino_lng, destino_direccion, distancia_m, duracion_s, desglose_json, tarifa_json, total, moneda, vence_en)
    VALUES (${q(cot)}, ${q(v.cliente)}, ${q(v.servicio)}, ${q(v.zona)}, ${q(`mon-t-${v.servicio}-${v.zona}`)}, ${v.o.lat}, ${v.o.lng}, ${q(v.o.dir)},
    ${v.d.lat}, ${v.d.lng}, ${q(v.d.dir)}, ${v.distM}, ${v.durS}, '{}', ${q(TARIFA_JSON)}, ${v.total}, 'USD', ${m(60)});`);
  sql.push(`INSERT OR REPLACE INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, vehiculo_id, zona_id, estado_general, creado_en)
    VALUES (${q(v.id)}, ${q(v.servicio)}, ${q(v.tipo)}, ${q(v.cliente)}, ${q(v.conductor)}, ${q(v.vehiculo)}, ${q(v.zona)}, ${q(v.general)}, ${m(v.t.creado)});`);
  sql.push(`INSERT OR REPLACE INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng,
    destino_direccion, pin_recogida, cotizacion_id, intentos_pin, metodo_pago, total_final_centavos, asignado_en, llego_en, iniciado_en, terminado_en)
    VALUES (${q(v.id)}, ${q(v.estado)}, 'conductor', 'k', ${v.o.lat}, ${v.o.lng}, ${q(v.o.dir)}, ${v.d.lat}, ${v.d.lng}, ${q(v.d.dir)}, '4826', ${q(cot)}, ${v.intentos ?? 0},
    'tarjeta', ${v.final ?? 'NULL'}, ${v.t.asignado == null ? 'NULL' : m(v.t.asignado)}, ${v.t.llego == null ? 'NULL' : m(v.t.llego)},
    ${v.t.iniciado == null ? 'NULL' : m(v.t.iniciado)}, ${v.t.terminado == null ? 'NULL' : m(v.t.terminado)});`);
  sql.push(`INSERT OR REPLACE INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en, respondida_en, km)
    VALUES (${q(v.id)}, ${q(v.conductor)}, ${q(v.vehiculo)}, 'aceptada', ${m(v.t.asignado)}, ${m(v.t.asignado)}, ${v.km});`);
  sql.push(`DELETE FROM eventos_operacion WHERE operacion_id = ${q(v.id)};`);
  for (const [desde, hacia, rol, actor, min] of v.eventos)
    sql.push(`INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, creado_en)
      VALUES (${q(v.id)}, 'transicion', ${q(desde)}, ${q(hacia)}, ${q(actor)}, ${q(rol)}, ${m(min)});`);
};
viaje({
  id: V.auto,
  servicio: 'carro',
  tipo: 'viaje_pasajero',
  cliente: 'mon-c-taylor',
  conductor: 'mon-d-jordan',
  vehiculo: 'mon-v-jordan',
  zona: ZONAS.novi.id,
  general: 'terminada',
  estado: 'terminado',
  total: 1890,
  final: 1890,
  km: 1.6,
  distM: 6400,
  durS: 960,
  intentos: 0,
  o: { dir: 'Twelve Oaks Mall, Novi, MI', lat: 42.491, lng: -83.47 },
  d: { dir: 'Novi Civic Center, Novi, MI', lat: 42.4795, lng: -83.443 },
  t: { creado: -95, asignado: -93, llego: -88, iniciado: -86, terminado: -71 },
  eventos: [
    ['pago_pendiente', 'buscando', 'sistema', null, -95],
    ['buscando', 'asignado', 'conductor', 'mon-d-jordan', -93],
    ['asignado', 'conductor_llego', 'conductor', 'mon-d-jordan', -88],
    ['conductor_llego', 'en_curso', 'conductor', 'mon-d-jordan', -86],
    ['en_curso', 'terminado', 'conductor', 'mon-d-jordan', -71],
  ],
});
viaje({
  id: V.moto,
  servicio: 'moto',
  tipo: 'viaje_pasajero',
  cliente: 'mon-c-morgan',
  conductor: 'mon-d-sam',
  vehiculo: 'mon-v-sam',
  zona: ZONAS.novi.id,
  general: 'en_curso',
  estado: 'en_curso',
  total: 1150,
  km: 0.8,
  distM: 4100,
  durS: 720,
  intentos: 1,
  o: { dir: 'Main Street, Novi, MI', lat: 42.4801, lng: -83.4762 },
  d: { dir: 'Fuerst Park, Novi, MI', lat: 42.465, lng: -83.469 },
  t: { creado: -14, asignado: -13, llego: -9, iniciado: -7 },
  eventos: [
    ['pago_pendiente', 'buscando', 'sistema', null, -14],
    ['buscando', 'asignado', 'conductor', 'mon-d-sam', -13],
    ['asignado', 'conductor_llego', 'conductor', 'mon-d-sam', -9],
    ['conductor_llego', 'en_curso', 'conductor', 'mon-d-sam', -7],
  ],
});
sql.push(
  `INSERT OR REPLACE INTO emergencias_viaje (id, operacion_id, actor_id, rol, creado_en) VALUES ('mon-em-1', ${q(V.moto)}, 'mon-c-morgan', 'pasajero', ${m(-4)});`,
);
viaje({
  id: V.envio,
  servicio: 'envios',
  tipo: 'envio_paquete',
  cliente: 'mon-c-taylor',
  conductor: 'mon-d-sam',
  vehiculo: 'mon-v-sam',
  zona: ZONAS.novi.id,
  general: 'terminada',
  estado: 'terminado',
  total: 990,
  final: 990,
  km: 1.1,
  distM: 3500,
  durS: 600,
  o: { dir: '26100 Novi Rd, Novi, MI', lat: 42.476, lng: -83.4745 },
  d: { dir: '43300 Eleven Mile Rd, Novi, MI', lat: 42.484, lng: -83.456 },
  t: { creado: -130, asignado: -128, llego: -122, iniciado: -120, terminado: -108 },
  eventos: [
    ['pago_pendiente', 'buscando', 'sistema', null, -130],
    ['buscando', 'asignado', 'conductor', 'mon-d-sam', -128],
    ['en_curso', 'terminado', 'conductor', 'mon-d-sam', -108],
  ],
});
sql.push(`INSERT OR REPLACE INTO envios_persona (operacion_id, descripcion, valor_declarado, destinatario_nombre, destinatario_telefono, pin_entrega, foto_recogida, recogido_en, entregado_en)
  VALUES (${q(V.envio)}, 'Box of books', 4000, 'Alex Kim', '+12485550100', '7319', ${q(`envios/${V.envio}/recogida-1`)}, ${m(-120)}, ${m(-108)});`);
viaje({
  id: V.motoVigia,
  servicio: 'moto',
  tipo: 'viaje_pasajero',
  cliente: 'mon-c-maria',
  conductor: 'mon-d-carlos',
  vehiculo: 'mon-v-carlos',
  zona: ZONAS.vigia.id,
  general: 'terminada',
  estado: 'terminado',
  total: 350,
  final: 350,
  km: 0.9,
  distM: 2800,
  durS: 480,
  intentos: 0,
  o: { dir: 'Plaza Bolívar, El Vigía', lat: 8.618, lng: -71.654 },
  d: { dir: 'Terminal de pasajeros, El Vigía', lat: 8.608, lng: -71.646 },
  t: { creado: -110, asignado: -109, llego: -104, iniciado: -102, terminado: -93 },
  eventos: [
    ['pago_pendiente', 'buscando', 'sistema', null, -110],
    ['buscando', 'asignado', 'conductor', 'mon-d-carlos', -109],
    ['asignado', 'conductor_llego', 'conductor', 'mon-d-carlos', -104],
    ['conductor_llego', 'en_curso', 'conductor', 'mon-d-carlos', -102],
    ['en_curso', 'terminado', 'conductor', 'mon-d-carlos', -93],
  ],
});

// Reclamos: uno de comida (Novi), uno de la moto con emergencia y uno de El Vigía.
const ticket = (
  id,
  codigo,
  nombre,
  asunto,
  pedidoId,
  operacionId,
  zona,
  idioma,
  prioridad,
  minutos,
) => {
  sql.push(`INSERT OR REPLACE INTO tickets (id, codigo, tipo, estado, nombre, correo, asunto, usuario_id, pedido_id, operacion_id, zona_id, idioma, prioridad, creado_en, actualizado_en)
    VALUES (${q(id)}, ${q(codigo)}, 'soporte', 'abierto', ${q(nombre)}, ${q(`${id}@ejemplo.com`)}, ${q(asunto)}, NULL, ${q(pedidoId)}, ${q(operacionId)}, ${q(zona)}, ${q(idioma)}, ${q(prioridad)}, ${m(minutos)}, ${m(minutos)});`);
  sql.push(
    `INSERT OR REPLACE INTO ticket_mensajes (id, ticket_id, autor, texto, creado_en) VALUES (${q(`${id}-m`)}, ${q(id)}, 'persona', ${q(asunto)}, ${m(minutos)});`,
  );
};
ticket(
  'mon-tk-1',
  'mon-codigo-largo-1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'Taylor Brooks',
  'One garlic knot order was missing',
  P.completo,
  null,
  ZONAS.novi.id,
  'en',
  'normal',
  -30,
);
ticket(
  'mon-tk-2',
  'mon-codigo-largo-2-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'Morgan Diaz',
  'Rider pressed the emergency button',
  null,
  V.moto,
  ZONAS.novi.id,
  'en',
  'urgente',
  -3,
);
ticket(
  'mon-tk-3',
  'mon-codigo-largo-3-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'María Fernández',
  'El refresco llegó caliente',
  P.vigia,
  null,
  ZONAS.vigia.id,
  'es',
  'normal',
  -40,
);

// La primera petición arma columnas e índices; después se siembra.
await api.get(`${PANEL}/datos/admin/pedidos?estado=vivos`);
const archivoSql = join(tmp, 'sembrar.sql');
writeFileSync(archivoSql, sql.join('\n'));
wrangler('d1', 'execute', 'tumbite-local', '--file', archivoSql);
for (const [clave, foto] of [
  [`evidencias/${P.completo}/recogida-1`, fotos.recogida],
  [`evidencias/${P.completo}/entrega-1`, fotos.entrega],
  [`evidencias/${P.tienda}/recogida-1`, fotos.recogida],
  [`evidencias/${P.vigia}/recogida-1`, fotos.recogida],
  [`evidencias/${P.vigia}/entrega-1`, fotos.entrega],
  [`envios/${V.envio}/recogida-1`, fotos.paquete],
])
  wrangler(
    'r2',
    'object',
    'put',
    `tumbite-local/${clave}`,
    '--file',
    foto,
    '--content-type',
    'image/jpeg',
  );

// ───────────── Capturas ─────────────
const pagina = await contexto.newPage();
const comprobaciones = [];
async function captura(nombre, url, idioma, preparar) {
  for (const [sufijo, ancho, alto] of [
    ['', 1440, 1000],
    ['-movil', 375, 812],
  ]) {
    await pagina.setViewportSize({ width: ancho, height: alto });
    await pagina.addInitScript((i) => {
      try {
        localStorage.setItem('tumbite.idioma', i);
      } catch {
        /* sin almacenamiento */
      }
    }, idioma);
    await pagina.goto(url, { waitUntil: 'networkidle' });
    if (preparar) await preparar(pagina);
    await pagina.waitForTimeout(600);
    // La ventana del alto de la página (no «fullPage»): el menú y la cabecera fijos no se repiten.
    const altoTotal = await pagina.evaluate(() => {
      const d = globalThis.document;
      return Math.max(d.documentElement.scrollHeight, d.body.scrollHeight);
    });
    await pagina.setViewportSize({
      width: ancho,
      height: Math.min(Math.max(alto, altoTotal), 6000),
    });
    await pagina.waitForTimeout(300);
    const archivo = join(SALIDA, `${nombre}${sufijo}-${idioma}.png`);
    await pagina.screenshot({ path: archivo });
    comprobaciones.push(archivo);
  }
}
const cambiarIdioma = async (idioma) => {
  await api.put(`${PANEL}/datos/cuentas/yo`, { data: { idioma } }).catch(() => undefined);
};
for (const idioma of ['en', 'es']) {
  await cambiarIdioma(idioma);
  const pedidoFicha = idioma === 'en' ? P.completo : P.vigia;
  const viajeFicha = idioma === 'en' ? V.auto : V.motoVigia;
  const zona = idioma === 'en' ? ZONAS.novi.id : ZONAS.vigia.id;
  // SOLO=buscador-en rehace únicamente esa captura (las demás no cambian).
  const solo = process.env.SOLO;
  const todo = !solo;
  if (todo) {
    await captura('ficha-pedido', `${BASE}/orders/${pedidoFicha}`, idioma, async (p) => {
      await p
        .getByRole('button', { name: idioma === 'en' ? 'View photo' : 'Ver foto' })
        .first()
        .click();
      await p.waitForSelector('img.ficha-foto-imagen:not(.ficha-foto-oculta)');
    });
    await captura('ficha-viaje', `${BASE}/rides/${viajeFicha}`, idioma);
    if (idioma === 'en') {
      await captura('ficha-viaje-emergencia', `${BASE}/rides/${V.moto}`, idioma);
      await captura('ficha-envio', `${BASE}/rides/${V.envio}`, idioma, async (p) => {
        await p.getByRole('button', { name: 'View photo' }).first().click();
        await p.waitForSelector('img.ficha-foto-imagen:not(.ficha-foto-oculta)');
      });
    }
    await captura('pestanas-servicio', `${BASE}/orders?zona=${zona}`, idioma);
    await captura('pestanas-moto', `${BASE}/orders?servicio=moto&zona=${zona}`, idioma);
    await captura('bandeja-tickets', `${BASE}/tickets`, idioma);
    await captura('horario', `${BASE}/configuration`, idioma);
  }
  if (todo || solo === `buscador-letra-${idioma}`) {
    // C-BUSCADOR-INSTANTANEO: con UNA letra ya sugiere, dice cuántos hay y ofrece «Ver todos».
    await captura('buscador-letra', `${BASE}/orders?zona=${zona}`, idioma, async (p) => {
      await p
        .getByPlaceholder(
          idioma === 'en'
            ? 'Order, customer, phone, or plate'
            : 'Pedido, cliente, teléfono o placa',
        )
        .click();
      await p.keyboard.type(letraDe(idioma), { delay: 60 });
      await p.waitForSelector('.bs-ver-todos');
      await p.waitForTimeout(500);
    });
    // «Ver todos» lleva a «Pedidos en curso» con lo buscado: el total y el comienzo del código subrayado.
    await captura(
      'pedidos-por-codigo',
      `${BASE}/orders?q=${letraDe(idioma)}`,
      idioma,
      async (p) => {
        await p.waitForSelector('.codigo-pedido mark');
      },
    );
    // Sin resultados: dice qué se buscó y sugiere el código bien escrito.
    await captura('buscador-sugerencia', `${BASE}/orders?zona=${zona}`, idioma, async (p) => {
      await p
        .getByPlaceholder(
          idioma === 'en'
            ? 'Order, customer, phone, or plate'
            : 'Pedido, cliente, teléfono o placa',
        )
        .click();
      await p.keyboard.type(idioma === 'en' ? 'B51DO7' : 'F17B2OC', { delay: 60 });
      await p.waitForSelector('.bs-vacio');
      await p.waitForTimeout(400);
    });
  }
  if (todo || solo === `buscador-${idioma}`)
    // En inglés, el ejemplo es de Novi y el código se repite entre dos pedidos de Novi; en español, de El Vigía.
    await captura(
      'buscador',
      idioma === 'en' ? `${BASE}/orders?zona=${zona}` : `${BASE}/orders`,
      idioma,
      async (p) => {
        await p
          .getByPlaceholder(
            idioma === 'en'
              ? 'Order, customer, phone, or plate'
              : 'Pedido, cliente, teléfono o placa',
          )
          .click();
        await p.keyboard.type(idioma === 'en' ? 'a7c3e1' : 'a7c', { delay: 60 });
        await p.waitForTimeout(900);
      },
    );
}
await navegador.close();
console.log(`capturas: ${comprobaciones.length} en ${SALIDA}`);
