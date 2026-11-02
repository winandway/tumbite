// Capturas REALES de «Zonas con más pedidos» para Docs (CAP-1, 1 nov 2026: «ninguna guía sin
// capturas»). Corre SOLO contra el sitio de pruebas con las cuentas de demostración
// (docs/CUENTAS-DE-PRUEBA.md, fuera de git). No mueve dinero.
//
// El mapa solo marca una zona con dos o más pedidos de la última hora. Para fotografiarlo de
// verdad, la cuenta demo del cliente hace pedidos de pago al recibir en la Pizzería Demo (el
// efectivo de EE. UU. se enciende un momento en pruebas), se toman las fotos y, pase lo que pase,
// los pedidos se cancelan y el efectivo y el pago por hora pico quedan como estaban.
//
// Fotos: driver-zonas-mapa (la zona y la leyenda), driver-zonas-detalle (al tocar la zona: cuántos
// pedidos) y driver-zonas-pico (con pago por hora pico, el monto sobre la zona).
// Salida: docs/capturas/funciones/<nombre>-<es|en>.png y apps/panel/public/docs/<nombre>-<es|en>.webp
// Uso: node scripts/docs/capturas-zonas.mjs
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const SITIO = 'https://staging.tumbite.com';
const RAIZ = process.cwd();
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'funciones');
const WEB = join(RAIZ, 'apps', 'panel', 'public', 'docs');
fs.mkdirSync(ORIGINALES, { recursive: true });

const fila = fs
  .readFileSync(join(RAIZ, 'docs', 'CUENTAS-DE-PRUEBA.md'), 'utf8')
  .split('\n')
  .find((l) => l.includes('demo.soporte@ejemplo.com'));
const CLAVE = fila.split('|')[4].trim();
const MIAMI = { latitude: 25.7745, longitude: -80.1905 };

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${SITIO}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(metodo !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const entrar = (rol) =>
  api('POST', '/datos/cuentas/entrar', { correo: `demo.${rol}@ejemplo.com`, clave: CLAVE });

const [admin, cliente, rest, rep] = await Promise.all(
  ['soporte', 'cliente', 'restaurante', 'repartidor'].map(entrar),
);
if (!SITIO.includes('staging')) throw new Error('Este guion solo corre en el sitio de pruebas.');

const { restaurante } = await api('GET', '/datos/mi-restaurante', undefined, rest.token);
const menu = await api('GET', `/datos/restaurantes/${restaurante.id}`, undefined, cliente.token);
const platos = menu.platos ?? [];
const plato = platos.find(
  (p) => p.disponible !== false && !(p.grupos ?? []).some((g) => g.minimo > 0),
);
if (!plato) throw new Error('La Pizzería Demo no tiene un plato sin opciones obligatorias.');

const paisAntes = (await api('GET', '/datos/admin/paises/US', undefined, admin.token)).config;
const picoAntes = await api('GET', '/datos/admin/pago-pico', undefined, admin.token);
const hechos = [];

const pedir = async () => {
  const p = await api(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: restaurante.id,
      lineas: [{ platoId: plato.id, cantidad: 1 }],
      propinaCentavos: 0,
      direccion: '200 S Biscayne Blvd',
      lat: MIAMI.latitude,
      lng: MIAMI.longitude,
      entrega: 'puerta',
      metodoPago: 'efectivo',
    },
    cliente.token,
  );
  hechos.push(p.pedidoId);
};

const aWebp = (png, webp) =>
  execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', '540', '0', png, '-o', webp]);

const navegador = await chromium.launch();
try {
  await api('PUT', '/datos/admin/paises/US', { efectivoActivo: true }, admin.token);
  await api(
    'PUT',
    '/datos/admin/pago-pico',
    { centavos: 0, presupuestoDiaCentavos: 0 },
    admin.token,
  );
  // Tres pedidos: la zona sale en rojo suave (demanda media), sin pago por hora pico.
  for (let i = 0; i < 3; i++) await pedir();

  const sesion = async (idioma) => {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
      geolocation: MIAMI,
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([token, id, i]) => {
        localStorage.setItem('tumbite.sesion', token);
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem(`divoox.permisos.${id}`, '1');
      },
      [rep.token, rep.usuario.id, idioma],
    );
    const p = await ctx.newPage();
    await p.goto(`${SITIO}/driver/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(6000);
    return { ctx, p };
  };
  const foto = async (p, nombre, idioma) => {
    await p.waitForTimeout(1200);
    const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
    await p.screenshot({ path: png });
    aWebp(png, join(WEB, `${nombre}-${idioma}.webp`));
    console.log('foto', nombre, idioma);
  };
  const circulo = (p) => p.locator('path.leaflet-interactive[fill="#F20D20"]').first();

  for (const idioma of ['es', 'en']) {
    const { ctx, p } = await sesion(idioma);
    if (!(await circulo(p).count())) throw new Error('El mapa no marcó ninguna zona.');
    await foto(p, 'driver-zonas-mapa', idioma);
    await circulo(p).hover({ force: true });
    await foto(p, 'driver-zonas-detalle', idioma);
    await ctx.close();
  }

  // Cinco o más pedidos y pago por hora pico encendido: el monto queda escrito sobre la zona.
  for (let i = 0; i < 2; i++) await pedir();
  await api(
    'PUT',
    '/datos/admin/pago-pico',
    { centavos: 200, presupuestoDiaCentavos: 2000 },
    admin.token,
  );
  for (const idioma of ['es', 'en']) {
    const { ctx, p } = await sesion(idioma);
    if (!(await p.locator('.leaflet-tooltip-permanent, .leaflet-tooltip').count()))
      console.log('aviso: no apareció el monto de pago por hora pico');
    await foto(p, 'driver-zonas-pico', idioma);
    await ctx.close();
  }
} finally {
  await navegador.close();
  for (const id of hechos)
    await api(
      'POST',
      `/datos/admin/pedidos/${id}/cancelar`,
      { motivo: 'Pedido de demostración para las capturas de Docs.' },
      admin.token,
    ).catch((e) => console.error('no se pudo cancelar', id, e.message));
  await api(
    'PUT',
    '/datos/admin/paises/US',
    { efectivoActivo: paisAntes.efectivoActivo },
    admin.token,
  );
  await api(
    'PUT',
    '/datos/admin/pago-pico',
    { centavos: picoAntes.centavos, presupuestoDiaCentavos: picoAntes.presupuestoDiaCentavos },
    admin.token,
  );
  console.log('pedidos cancelados:', hechos.length, '· efectivo y pago pico como estaban');
}
