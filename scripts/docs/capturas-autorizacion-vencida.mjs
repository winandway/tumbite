/* eslint-disable security/detect-non-literal-fs-filename -- rutas armadas con carpetas fijas de este repositorio */
// Capturas de la guía «Resolving an expired card authorization» (C-AUTORIZACION-VENCIDA, 16 nov 2026).
// Todos los países con tarjeta: en inglés Novi, Michigan; en español Miami (ciudad hispana con tarjeta).
//
// Siembra datos NEUTROS e inventados en el servidor LOCAL del simulador (nunca en una base de la
// nube) y le dice al Stripe SIMULADO que el pago venció. Abre el panel local, hace lo que haría
// soporte y guarda las originales en docs/capturas/monitoreo/autorizacion-<pantalla>-<en|es>.png y
// las WebP livianas para Docs en apps/panel/public/docs/monitoreo-autorizacion-<pantalla>-<en|es>.webp.
//
// Uso (desde la raíz):
//   PUERTO_STRIPE=12121 PUERTO_RECORRIDO=8797 SIN_COMPILAR=1 CARPETA_RECORRIDO=.simulador SOLO_SERVIDOR=1 node scripts/recorrido/preparar.mjs
//   PUERTO_STRIPE=12121 node scripts/recorrido/stripe-simulado.mjs
//   npx wrangler dev -c .simulador/wrangler.jsonc --persist-to .simulador/estado --port 8797 --local
//   DATOS_URL=http://localhost:8797 PUERTO_PANEL=5193 npm run dev -w @tumbite/panel
//   PANEL=http://localhost:5193 STRIPE_SIM=http://localhost:12121 node scripts/docs/capturas-autorizacion-vencida.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const RAIZ = join(import.meta.dirname, '..', '..');
const CARPETA = process.env.CARPETA_RECORRIDO ?? '.simulador';
const PANEL = process.env.PANEL ?? 'http://localhost:5173';
const STRIPE_SIM = process.env.STRIPE_SIM ?? 'http://localhost:12111';
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'monitoreo');
const DOCS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
mkdirSync(ORIGINALES, { recursive: true });
const datos = JSON.parse(readFileSync(join(RAIZ, CARPETA, 'datos.json'), 'utf8'));

const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const ID = {
  en: {
    cobra: 'c4f2a9d1-0000-4000-8000-000000000101',
    sin: 'e7b3c5a2-0000-4000-8000-000000000102',
  },
  es: {
    cobra: 'c4f2a9d3-0000-4000-8000-000000000103',
    sin: 'e7b3c5a4-0000-4000-8000-000000000104',
  },
};
const LUGAR = {
  en: {
    zona: 'US-MI-NOVI',
    nombreZona: 'Novi',
    hora: 'America/Detroit',
    lat: 42.4806,
    lng: -83.4755,
    cliente: 'Taylor Brooks',
    comercio: 'Novi Pizza Co.',
    dir: '41200 Ten Mile Rd, Novi, MI',
    plato: 'Large Margherita pizza',
  },
  es: {
    zona: 'US-FL-MIAMI',
    nombreZona: 'Miami',
    hora: 'America/New_York',
    lat: 25.7617,
    lng: -80.1918,
    cliente: 'Lucía Gómez',
    comercio: 'Pizzería La Esquina',
    dir: '1200 SW 8th St, Miami, FL',
    plato: 'Pizza margarita grande',
  },
};

// ───────────── Los datos (SQL, directo en la base local) ─────────────
const sql = [];
for (const [i, l] of Object.entries(LUGAR)) {
  sql.push(`INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES (${q(l.zona)}, ${q(l.nombreZona)}, 'US', 'USD', ${q(l.hora)}, ${l.lat}, ${l.lng}, 30, 1)
    ON CONFLICT(id) DO UPDATE SET activa = 1;`);
  sql.push(`INSERT OR IGNORE INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id, activo, idioma, stripe_cliente) VALUES
    ('aut-c-${i}', 'aut-c-${i}@ejemplo.com', ${q(l.cliente)}, 'cliente', 'x', ${q(l.zona)}, 1, ${q(i)}, 'cus_aut_${i}'),
    ('aut-o-${i}', 'aut-o-${i}@ejemplo.com', 'Dueño ${i}', 'restaurante', 'x', ${q(l.zona)}, 1, ${q(i)}, NULL);`);
  sql.push(`INSERT OR IGNORE INTO restaurantes (id, dueno_id, nombre, direccion, lat, lng, estado, abierto, zona_id, tipo_comercio, tiempo_prep_min)
    VALUES ('aut-r-${i}', 'aut-o-${i}', ${q(l.comercio)}, ${q(l.dir)}, ${l.lat}, ${l.lng}, 'aprobado', 1, ${q(l.zona)}, 'restaurante', 15);`);
  for (const [tipo, id] of Object.entries(i === 'en' ? ID.en : ID.es)) {
    const total = tipo === 'cobra' ? 3460 : 2875;
    const pi = `pi_aut_${i}_${tipo}`;
    sql.push(`INSERT OR REPLACE INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total,
      comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, zona_id, tiempo_prep_min, creado_en, pagado_en, entregado_en, moneda, stripe_pago, stripe_sesion)
      VALUES (${q(id)}, 'aut-c-${i}', 'aut-r-${i}', 'entregado', ${q(JSON.stringify([{ nombreEs: l.plato, cantidad: 1 }]))}, ${total - 999}, 399, 200, 0, 400, ${total},
      300, ${total - 1300}, 600, 0, 100, 'inicial', ${q(l.dir)}, ${l.lat + 0.01}, ${l.lng + 0.01}, ${q(l.zona)}, 15,
      datetime('now', '-8 days', '-30 minutes'), datetime('now', '-8 days', '-29 minutes'), datetime('now', '-40 minutes'), 'USD', ${q(pi)}, ${q(pi)});`);
    sql.push(`DELETE FROM historial_estados WHERE pedido_id = ${q(id)};`);
    sql.push(`INSERT INTO historial_estados (pedido_id, estado, actor_id, creado_en) VALUES
      (${q(id)}, 'pagado', 'aut-c-${i}', datetime('now', '-8 days', '-29 minutes')),
      (${q(id)}, 'entregado', NULL, datetime('now', '-40 minutes'));`);
    sql.push(`DELETE FROM bitacora_pedidos WHERE pedido_id = ${q(id)};`);
    sql.push(`INSERT INTO bitacora_pedidos (pedido_id, evento, detalle, creado_en) VALUES
      (${q(id)}, 'autorizacion_por_vencer', '', datetime('now', '-4 days', '-29 minutes'));`);
    // Repetir el guion no suma al límite del control dual de 24 horas (solo en la base local).
    sql.push(`DELETE FROM dinero_manual WHERE objeto = ${q(id)};`);
    sql.push(`DELETE FROM aprobaciones_dinero WHERE objeto = ${q(id)};`);
    sql.push(
      `INSERT OR REPLACE INTO cobros (pedido_id, autorizado_en) VALUES (${q(id)}, datetime('now', '-8 days', '-29 minutes'));`,
    );
    sql.push(`INSERT OR REPLACE INTO liquidaciones (pedido_id, estado, pi, monto, intentos, error, alertado_en)
      VALUES (${q(id)}, 'revision', ${q(pi)}, ${total}, 1, 'La autorización venció o se anuló (canceled)', datetime('now', '-39 minutes'));`);
  }
}
const tmp = mkdtempSync(join(tmpdir(), 'autorizacion-'));
const archivoSql = join(tmp, 'semilla.sql');
writeFileSync(archivoSql, sql.join('\n'));
execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'tumbite-local',
    '--file',
    archivoSql,
    '--local',
    '--persist-to',
    `${CARPETA}/estado`,
    '-c',
    `${CARPETA}/wrangler.jsonc`,
  ],
  { cwd: RAIZ, stdio: 'pipe' },
);

// ───────────── El Stripe SIMULADO: los pagos vencidos ─────────────
const ahora = Math.floor(Date.now() / 1000);
for (const i of ['en', 'es'])
  for (const tipo of ['cobra', 'sin']) {
    const r = await fetch(`${STRIPE_SIM}/__simulador/estado`, {
      method: 'POST',
      body: JSON.stringify({
        id: `pi_aut_${i}_${tipo}`,
        status: 'canceled',
        extra: {
          amount: tipo === 'cobra' ? 3460 : 2875,
          amount_capturable: 0,
          amount_received: 0,
          customer: `cus_aut_${i}`,
          setup_future_usage: tipo === 'cobra' ? 'off_session' : null,
          cancellation_reason: 'automatic',
          created: ahora - 8 * 86_400 - 1740,
          canceled_at: ahora - 86_400 - 1440,
          payment_method: {
            id: `pm_aut_${i}_${tipo}`,
            customer: tipo === 'cobra' ? `cus_aut_${i}` : null,
            card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 },
          },
          latest_charge: {
            payment_method_details: { card: { capture_before: ahora - 86_400 - 1740 } },
          },
        },
      }),
    });
    if (!r.ok) throw new Error(`stripe simulado: ${r.status}`);
  }

// ───────────── La cuenta del equipo ─────────────
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
});
const api = contexto.request;
const reg = await api.post(`${PANEL}/datos/cuentas/registro`, {
  data: {
    nombre: 'Soporte Divoox',
    correo: datos.correoEquipo,
    clave: datos.clave,
    rol: 'cliente',
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

// ───────────── Capturas: solo la tarjeta de la acción (sin barra de direcciones ni rutas) ─────────────
const pagina = await contexto.newPage();
const hechas = [];
async function guardar(nombre, idioma, locator) {
  // La cabecera fija del panel no tapa la tarjeta capturada.
  await pagina.addStyleTag({ content: '.pd-cabecera { position: static !important; }' });
  await locator.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(300);
  const png = join(ORIGINALES, `autorizacion-${nombre}-${idioma}.png`);
  await locator.screenshot({ path: png });
  const webp = join(DOCS, `monitoreo-autorizacion-${nombre}-${idioma}.webp`);
  await sharp(png)
    .resize({ width: 1100, withoutEnlargement: true })
    .webp({ quality: 70, effort: 6 })
    .toFile(webp);
  hechas.push(webp);
}
async function abrir(id, idioma) {
  await pagina.addInitScript((i) => {
    try {
      localStorage.setItem('tumbite.idioma', i);
    } catch {
      /* sin almacenamiento */
    }
  }, idioma);
  await api.put(`${PANEL}/datos/cuentas/yo`, { data: { idioma } }).catch(() => undefined);
  await pagina.goto(`${BASE}/orders/${id}`, { waitUntil: 'networkidle' });
  const tarjeta = pagina.locator('.resolver-autorizacion');
  await tarjeta.waitFor();
  await tarjeta
    .getByRole('button', {
      name: idioma === 'en' ? 'Resolve expired authorization' : 'Resolver autorización vencida',
    })
    .click();
  await tarjeta.locator('.resolver-opciones').waitFor();
  return tarjeta;
}
for (const idioma of ['en', 'es']) {
  const ids = idioma === 'en' ? ID.en : ID.es;
  // 1. El estado real del pago y las dos salidas (el cliente sí dejó su tarjeta para cobros futuros).
  let tarjeta = await abrir(ids.cobra, idioma);
  await guardar('estado', idioma, tarjeta);
  // 2. Volver a cobrar pide confirmar el monto.
  await tarjeta.locator('.resolver-opcion').first().getByRole('button').click();
  await pagina.mouse.move(0, 0);
  // Solo lo que se lee: la caja a la altura de su contenido.
  await pagina.addStyleTag({ content: '.resolver-opcion { align-self: start; }' });
  await guardar('confirmar', idioma, tarjeta.locator('.resolver-opcion').first());
  await tarjeta
    .getByRole('button', { name: idioma === 'en' ? /Yes, charge/ : /Sí, cobrar/ })
    .click();
  await pagina.locator('.resolver-autorizacion').waitFor({ state: 'detached' });
  // 3. En la línea de tiempo queda quién lo resolvió y cómo.
  await guardar('linea', idioma, pagina.locator('[aria-labelledby="ficha-linea-titulo"]'));
  // 4. Sin el permiso del cliente no hay cobro: se cierra sin cobro con una nota.
  tarjeta = await abrir(ids.sin, idioma);
  await tarjeta
    .getByLabel(idioma === 'en' ? /Note \(required\)/ : /Nota \(obligatoria\)/)
    .fill(
      idioma === 'en'
        ? 'Customer confirmed the order arrived. Card no longer saved: Divoox covers it.'
        : 'El cliente confirmó que recibió el pedido. Ya no tiene la tarjeta guardada: lo asume Divoox.',
    );
  await guardar('sin-cobro', idioma, tarjeta);
}
await navegador.close();
for (const h of hechas) console.log(h);
