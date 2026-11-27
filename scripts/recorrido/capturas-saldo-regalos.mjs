// Capturas REALES del Saldo Divoox por lotes y de los regalos automáticos (C-SALDO-LOTES,
// C-SALDO-BIENVENIDA, C-SALDO-MASIVO, 26 nov 2026) — Venezuela. Contra el servidor LOCAL del recorrido
// (.recorrido, armado con scripts/recorrido/preparar.mjs y encendido con
// `npx wrangler dev -c .recorrido/wrangler.jsonc --port <puerto> --persist-to .recorrido/estado`), con la
// app web real del cliente y el panel:
//   - app (es, El Vigía con la ciudad neutra): «Método de pago» con un regalo que vence pronto y prepago
//     («Incluye … de regalo que vence el …» y «Regalo … · Prepagado …») → Docs públicos;
//   - la misma pantalla en inglés solo para la revisión (C-CAPTURAS-POR-IDIOMA: en inglés no se publica
//     con datos de Venezuela; en Estados Unidos el Saldo Divoox no se usa);
//   - el panel (es y en): «Regalos automáticos de Saldo Divoox» en Configuración, la carga masiva con su
//     vista previa y la ficha del cliente con sus lotes → ayuda interna (carpeta privada).
// Originales en docs/capturas/recorrido/moto-ve-pago-saldo-regalo-es.png y WebP pública en
// apps/panel/public/docs/recorrido-moto-ve-pago-saldo-regalo-v2-es.webp. Copias para la revisión en
// CAPTURAS_REVISION si se da esa variable. Todo en la base local: nada remoto.
// Uso: node scripts/recorrido/capturas-saldo-regalos.mjs
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: escribe capturas */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { ciudadNeutra } from './neutro.mjs';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo.mjs';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const PUBLICAS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
const REVISION = process.env.CAPTURAS_REVISION ?? '';
for (const d of [SALIDA, ORIGINALES_PRIVADAS, CAPTURAS_PRIVADAS, ...(REVISION ? [REVISION] : [])])
  mkdirSync(d, { recursive: true });
const ZONA = 'VE-MER-ELVIGIA';
const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Central' };
const DESTINO = { lat: 8.6105, lng: -71.6672, direccion: 'Avenida Principal 12' };
const IDS = { cliente: 'zz-mtve-c', conductor: 'zz-mtve-k', equipo: 'zz-mtve-a' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.81.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const sesion = async (id) => {
  const token = randomBytes(24).toString('hex');
  await sql(
    `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
  );
  return token;
};

// 1. El guion de Moto en Venezuela deja al conductor aprobado, con saldo y su Pago Móvil cargado.
execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const tokens = {
  cliente: await sesion(IDS.cliente),
  conductor: await sesion(IDS.conductor),
  equipo: await sesion(IDS.equipo),
};
await sql(SQL_TASA_EJEMPLO);
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${ZONA}' AND activa = 1`);
await sql(
  `UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id IN ('${IDS.cliente}', '${IDS.conductor}')`,
);
const colgado = (await pedir('GET', '/datos/viajes/actual', undefined, tokens.cliente)).viaje;
if (colgado)
  await pedir('POST', `/datos/viajes/${colgado.id}/cancelar`, {}, tokens.cliente, {
    'idempotency-key': `capturas-regalos-${Date.now().toString(36)}`,
  }).catch(() => null);
await sql(
  `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now', '+20 minutes') WHERE usuario_id = '${IDS.conductor}'`,
);

// 2. Las reglas de la ciudad (solo en la base local): bienvenida encendida y por viajes apagada.
const regla = (d) =>
  pedir('PUT', '/datos/admin/saldo-regalos/reglas', { zonaId: ZONA, ...d }, tokens.equipo);
await regla({
  tipo: 'bienvenida',
  monto: 300,
  vigenciaDias: 30,
  encendida: true,
  presupuesto: 30_000,
  topeDiario: 3_000,
});
await regla({
  tipo: 'fidelidad',
  monto: 200,
  vigenciaDias: 30,
  encendida: false,
  presupuesto: 10_000,
  cadaViajes: 10,
  topePersonaMes: 1,
});

// 3. El saldo del pasajero: un regalo que vence en 3 días y un prepago (nunca vence).
const disponible = async () =>
  (await pedir('GET', '/datos/cliente/saldo-divoox', undefined, tokens.cliente)).disponible;
let n = 0;
const cargar = (cuerpo) =>
  pedir(
    'POST',
    `/datos/admin/saldo-clientes/${IDS.cliente}/cargas`,
    { idempotencia: `capturas-regalos-${Date.now().toString(36)}-${++n}`, ...cuerpo },
    tokens.equipo,
  );
if ((await disponible()) === 0) {
  await cargar({ monto: 300, motivo: 'carrera_regalo', vigenciaDias: 3 });
  await cargar({ monto: 200, motivo: 'prepago', comprobante: 'REF-EJEMPLO-01' });
}

const navegador = await chromium.launch();
const fotosPublicas = [];
const revisar = (archivo, nombre) => {
  if (REVISION) copyFileSync(archivo, join(REVISION, nombre));
};
async function pantallaDePago(idioma) {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
    timezoneId: 'America/Caracas',
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i, b]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
      localStorage.setItem(`tumbite.borrador.moto.${u}`, b);
    },
    [
      tokens.cliente,
      IDS.cliente,
      idioma,
      JSON.stringify({
        recogida: ORIGEN.direccion,
        recogidaLat: String(ORIGEN.lat),
        recogidaLng: String(ORIGEN.lng),
        destino: DESTINO.direccion,
        destinoLat: String(DESTINO.lat),
        destinoLng: String(DESTINO.lng),
        metodo: 'efectivo',
        usarSaldo: true,
      }),
    ],
  );
  const c = await ctx.newPage();
  await c.goto('/app/ride');
  await c.getByTestId('moto-precio').waitFor({ timeout: 60_000 });
  await c.getByTestId('pedir-boton').click();
  await c.getByTestId('metodo-pago').waitFor({ timeout: 30_000 });
  await c.getByTestId('pago-saldo-vence').waitFor({ timeout: 30_000 });
  await espera(900);
  // En inglés con datos de Venezuela solo va a la revisión, nunca al repositorio.
  const archivo = join(
    idioma === 'es' ? SALIDA : REVISION || SALIDA,
    `moto-ve-pago-saldo-regalo-${idioma}.png`,
  );
  await c.screenshot({ path: archivo });
  if (idioma === 'es')
    fotosPublicas.push({
      archivo,
      publica: join(PUBLICAS, `recorrido-moto-ve-pago-saldo-regalo-v2-${idioma}.webp`),
    });
  revisar(archivo, `app-pago-saldo-regalo-${idioma}.png`);
  await ctx.close();
}

const restaurarCiudad = await ciudadNeutra(sql, ZONA, 'es');
try {
  await pantallaDePago('es');
  await pantallaDePago('en');

  // Panel (ayuda interna, carpeta privada).
  const { ruta } = await pedir('GET', '/datos/admin/ruta', undefined, tokens.equipo);
  const base = (idioma) => `${idioma === 'es' ? '/es' : ''}/panel${ruta ? `/${ruta}` : ''}`;
  for (const idioma of ['es', 'en']) {
    const ctx = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
    });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: tokens.equipo, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript((i) => {
      localStorage.clear();
      localStorage.setItem('tumbite.idioma', i);
    }, idioma);
    const p = await ctx.newPage();
    const foto = async (nombre) => {
      await espera(800);
      const original = join(ORIGINALES_PRIVADAS, `saldo-clientes-${nombre}-${idioma}.png`);
      await p.screenshot({ path: original });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        original,
        '-o',
        join(CAPTURAS_PRIVADAS, `saldo-clientes-${nombre}-${idioma}.webp`),
      ]);
      revisar(original, `panel-saldo-clientes-${nombre}-${idioma}.png`);
    };
    // a) Configuración → «Regalos automáticos de Saldo Divoox».
    await p.goto(`${base(idioma)}/configuration`);
    const bloque = p.getByTestId('saldo-regalos-auto');
    await bloque.waitFor({ timeout: 60_000 });
    await p.getByTestId(`regla-bienvenida-${ZONA}`).waitFor({ timeout: 30_000 });
    await bloque.scrollIntoViewIfNeeded();
    await foto('regalos-auto');
    // b) Saldo de clientes → la ficha con sus lotes y la carga masiva con su vista previa.
    await p.goto(`${base(idioma)}/customer-balance`);
    await p.getByTestId('saldo-clientes-buscar').waitFor({ timeout: 60_000 });
    await p.getByTestId('saldo-clientes-buscar').fill('Pasajero');
    await p.getByTestId('saldo-clientes-resultados').waitFor({ timeout: 30_000 });
    await p.getByTestId('saldo-clientes-resultados').getByRole('button').first().click();
    await p.getByTestId('saldo-cliente-lotes').waitFor({ timeout: 30_000 });
    await p.getByTestId('saldo-cliente-ficha').scrollIntoViewIfNeeded();
    await foto('carga');
    const masiva = p.getByTestId('saldo-masiva-form');
    await masiva.scrollIntoViewIfNeeded();
    await masiva.locator('select').first().selectOption(ZONA);
    await p.getByTestId('masiva-monto').fill('1');
    await p
      .getByTestId('masiva-motivo')
      .fill(idioma === 'es' ? 'Lanzamiento en la ciudad' : 'City launch');
    await p.getByTestId('masiva-ver-previa').click();
    await p.getByTestId('masiva-previa-total').waitFor({ timeout: 30_000 });
    const total = (await p.getByTestId('masiva-previa-total').textContent()) ?? '';
    await p.getByTestId('masiva-total-escrito').fill(total.replace(/[^\d.,]/g, ''));
    await p.getByTestId('masiva-confirmar').scrollIntoViewIfNeeded();
    await foto('masiva');
    await ctx.close();
  }
} finally {
  await navegador.close();
  await restaurarCiudad();
}
for (const f of fotosPublicas)
  execFileSync('cwebp', ['-quiet', '-q', '82', f.archivo, '-o', f.publica]);
console.log(`capturas del saldo con regalos listas: ${fotosPublicas.length} públicas`);
