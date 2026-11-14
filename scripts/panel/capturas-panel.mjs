// Capturas reales de los paneles web por rol (superadmin, restaurante, franquicia, Flex y cuenta sin
// panel), en computadora y en celular. Sirve para comparar el antes y el después de un cambio de
// diseño y para comprobar un sitio ya publicado.
// Uso: node scripts/panel/capturas-panel.mjs <base> <carpeta> [idioma]
//   base: https://staging.tumbite.com  o  http://localhost:5173
//   carpeta: docs/capturas/panel-nuevo/antes
// Las cuentas son las de demostración del sitio de pruebas; la clave va en CLAVE_DEMO.
// La dirección privada del superadmin nunca se escribe: ni en nombres de archivo ni en la salida.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [base, carpeta, idioma = 'es'] = process.argv.slice(2);
const clave = process.env.CLAVE_DEMO;
if (!base || !carpeta || !clave)
  throw new Error(
    'uso: CLAVE_DEMO=… node scripts/panel/capturas-panel.mjs <base> <carpeta> [idioma]',
  );
// eslint-disable-next-line security/detect-non-literal-fs-filename -- carpeta de capturas del repositorio
mkdirSync(carpeta, { recursive: true });

const TAMANOS = [
  ['escritorio', { width: 1440, height: 900 }],
  ['celular', { width: 375, height: 812 }],
];
const soloRol = process.env.SOLO_ROL;
const soloTamano = process.env.SOLO_TAMANO;

const navegador = await chromium.launch();

async function sesion(correo, tamano) {
  const ctx = await navegador.newContext({ viewport: tamano, deviceScaleFactor: 1 });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctx.newPage();
  const r = await p.request.post(`${base}/datos/cuentas/entrar`, { data: { correo, clave } });
  if (!r.ok()) throw new Error(`no entra ${correo}: ${r.status()}`);
  return { ctx, p };
}

async function foto(p, ruta, nombre) {
  await p.goto(`${base}${ruta}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await p.waitForTimeout(900);
  await p.screenshot({ path: join(carpeta, `${nombre}.png`), fullPage: true });
  console.log('captura', nombre);
}

const datos = async (p, ruta) => {
  const r = await p.request.get(`${base}${ruta}`);
  return r.ok() ? r.json() : null;
};

for (const [tamano, medidas] of TAMANOS) {
  if (soloTamano && soloTamano !== tamano) continue;
  const n = (rol, pantalla) => `${rol}-${pantalla}-${tamano}-${idioma}`;

  if (!soloRol || soloRol === 'superadmin') {
    const { ctx, p } = await sesion('demo.soporte@ejemplo.com', medidas);
    const ruta = (await datos(p, '/datos/admin/ruta'))?.ruta;
    const raiz = ruta ? `/panel/${ruta}` : '/panel';
    for (const [sub, pantalla] of [
      ['', 'resumen'],
      ['/moto', 'moto-abrir'],
      ['/rides', 'moto-viajes'],
      ['/tickets', 'tickets'],
      ['/orders', 'pedidos'],
      ['/franchises', 'franquicias'],
      ['/cities', 'ciudades'],
      ['/verifications', 'verificaciones'],
      ['/customers', 'clientes'],
      ['/restaurants', 'restaurantes'],
      ['/drivers', 'repartidores'],
      ['/money', 'dinero'],
      ['/flexfinance', 'flex-dinero'],
      ['/approvals', 'aprobar'],
      ['/zones', 'zonas'],
      ['/reports', 'informes'],
      ['/team', 'equipo'],
      ['/pilot', 'piloto'],
      ['/rewards', 'rewards'],
    ])
      await foto(p, `${raiz}${sub}`, n('superadmin', pantalla));
    await foto(p, '/panel/settings', n('superadmin', 'configuracion'));
    // La franquicia se mira con la misma cuenta (el superadmin entra a todas).
    const fr = (await datos(p, '/datos/admin/resumen'))?.franquicias?.[0]?.ruta;
    if (fr) await foto(p, `/panel/${fr}`, n('franquicia', 'resumen'));
    await ctx.close();
  }

  if (!soloRol || soloRol === 'restaurante') {
    const { ctx, p } = await sesion('demo.restaurante@ejemplo.com', medidas);
    for (const [ruta, pantalla] of [
      ['/panel', 'inicio'],
      ['/panel/restaurant', 'mi-restaurante'],
      ['/panel/company', 'mi-empresa'],
      ['/panel/menu', 'menu'],
      ['/panel/orders', 'pedidos'],
      ['/panel/earnings', 'beneficios'],
      ['/panel/gifts', 'regalos'],
      ['/panel/reviews', 'resenas'],
      ['/panel/ads', 'anuncios'],
      ['/panel/promotions', 'promociones'],
      ['/panel/team', 'equipo'],
      ['/panel/settings', 'configuracion'],
    ])
      await foto(p, ruta, n('restaurante', pantalla));
    await ctx.close();
  }

  if (!soloRol || soloRol === 'cliente') {
    const { ctx, p } = await sesion('demo.cliente@ejemplo.com', medidas);
    await foto(p, '/panel', n('cliente', 'inicio'));
    await foto(p, '/panel/settings', n('cliente', 'configuracion'));
    await foto(p, '/panel/business', n('flex', 'mis-empresas'));
    const empresa = (await datos(p, '/datos/v1/flex/empresas'))?.empresas?.[0]?.id;
    if (empresa)
      for (const [sub, pantalla] of [
        ['', 'inicio'],
        ['/shipments', 'envios'],
        ['/shipments/new', 'envio-nuevo'],
        ['/operativas', 'rutas'],
        ['/hubs', 'centros'],
        ['/drivers', 'conductores'],
        ['/team', 'equipo'],
        ['/profile', 'perfil'],
        ['/wallet', 'billetera'],
        ['/operations', 'operaciones'],
      ])
        await foto(p, `/panel/business/${empresa}${sub}`, n('flex', pantalla));
    else console.log('aviso: la cuenta demo no tiene empresa de Flex');
    await ctx.close();
  }
}

// La pantalla de entrar, sin sesión.
if (!soloRol || soloRol === 'acceso') {
  for (const [tamano, medidas] of TAMANOS) {
    const ctx = await navegador.newContext({ viewport: medidas });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await foto(p, '/panel', `acceso-entrar-${tamano}-${idioma}`);
    await ctx.close();
  }
}
await navegador.close();
