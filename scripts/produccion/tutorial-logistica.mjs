// Capturas REALES de producción para el tutorial «Empieza con Divoox Flex» (1 nov 2026, pedido de
// Richard: «un tutorial que explique y que tenga las pantallas reales»). Entra con las cuentas del
// revisor (las de TestFlight), usa la empresa «Divoox Demo Logística», invita al conductor del
// revisor desde la pantalla, arma una ruta nueva y fotografía cada paso en español y en inglés.
// No mueve dinero (Flex no cobra). Las claves se leen de ~/.config/tumbite/revisores-tiendas.
// Salida: docs/capturas/flex-tutorial/*.png (originales) y apps/panel/public/docs/flex-tutorial/*.webp.
// Uso: node scripts/produccion/tutorial-logistica.mjs
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const SITIO = 'https://divoox.com';
const ORIGINALES = join(process.cwd(), 'docs', 'capturas', 'flex-tutorial');
const WEB = join(process.cwd(), 'apps', 'panel', 'public', 'docs', 'flex-tutorial');
fs.mkdirSync(ORIGINALES, { recursive: true });
fs.mkdirSync(WEB, { recursive: true });

// La ruta del archivo de cuentas es fija (la carpeta privada de esta Mac).
const cuentas = new Map(
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs
    .readFileSync(join(os.homedir(), '.config', 'tumbite', 'revisores-tiendas'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .map(([correo, clave, rol]) => [rol, { correo, clave }]),
);
const clave = () => `tutorial-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${SITIO}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      ...(metodo !== 'GET' ? { 'idempotency-key': clave() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? JSON.stringify(d)}`);
  return d;
}
const entrar = (rol) =>
  api('POST', '/datos/cuentas/entrar', {
    correo: cuentas.get(rol).correo,
    clave: cuentas.get(rol).clave,
  });

const dueno = await entrar('cliente');
const conductor = await entrar('repartidor');
const { empresas } = await api('GET', '/datos/v1/flex/empresas', undefined, dueno.token);
const empresa = empresas.find((e) => e.nombre === 'Divoox Demo Logística');
if (!empresa) throw new Error('Falta la empresa de demostración: corre armar-demo-logistica.mjs');
const E = `/datos/v1/flex/empresas/${empresa.id}`;
const { centros } = await api('GET', `${E}/centros`, undefined, dueno.token);
const centro = centros[0];

// Tres envíos nuevos para mostrar «Nueva ruta» y la página de la ruta (sin asignar todavía).
const corrida = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');
const envios = [];
for (const [i, d] of [
  ['1499 E West Maple Rd, Walled Lake, MI 48390', 42.5373, -83.4583],
  ['100 N Pontiac Trl, Walled Lake, MI 48390', 42.5377, -83.4811],
  ['27500 Novi Rd, Novi, MI 48377', 42.4958, -83.4752],
].entries())
  envios.push(
    (
      await api(
        'POST',
        `${E}/envios`,
        {
          centroId: centro.id,
          referenciaExterna: `TUTORIAL-${corrida}-${i + 1}`,
          destinatarioNombre: `Cliente de demostración ${i + 1}`,
          destinatarioTelefono: '',
          destinatarioCorreo: '',
          direccion: d[0],
          lat: d[1],
          lng: d[2],
          entrega: 'domicilio',
          paquetes: [{ descripcion: 'Caja de demostración', pesoG: 1000 }],
        },
        dueno.token,
      )
    ).envio,
  );
const ruta = (
  await api(
    'POST',
    `${E}/rutas`,
    { nombre: `Ruta tutorial ${corrida}`, centroId: centro.id, envioIds: envios.map((x) => x.id) },
    dueno.token,
  )
).ruta;

function aWebp(png, webp) {
  execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', webp]);
}
const navegador = await chromium.launch();
let enlaceInvitacion;
for (const idioma of ['es', 'en']) {
  const ctx = await navegador.newContext({
    viewport: { width: 1366, height: 860 },
    deviceScaleFactor: 2,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
  });
  await ctx.addCookies([
    {
      name: 'tumbite_sesion',
      value: dueno.token,
      domain: 'divoox.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctx.newPage();
  const foto = async (nombre, entera = false) => {
    await p.waitForTimeout(1200);
    const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
    await p.screenshot({ path: png, fullPage: entera });
    aWebp(png, join(WEB, `${nombre}-${idioma}.webp`));
  };
  const ir = (ruta) =>
    p.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}${ruta}`, { waitUntil: 'networkidle' });
  const raiz = `/panel/business/${empresa.id}`;

  await ir('/panel/business');
  await foto('01-registro', true);
  await ir(raiz);
  await foto('02-inicio', true);
  await ir(`${raiz}/hubs`);
  await foto('03-centros');
  // Invitar al conductor desde la pantalla (el del revisor, una cuenta nuestra).
  await ir(`${raiz}/drivers`);
  const t = (es, en) => (idioma === 'en' ? en : es);
  await p.getByLabel(t('Nombre del conductor', 'Driver name')).fill('Conductor de demostración');
  await p
    .getByLabel(t('Correo (opcional)', 'Email (optional)'))
    .fill(cuentas.get('repartidor').correo);
  await p.getByRole('button', { name: t('Invitar conductor', 'Invite a driver') }).click();
  await p.getByRole('link', { name: t('Mandar por WhatsApp', 'Send by WhatsApp') }).waitFor();
  enlaceInvitacion = (await p.locator('.flex-enlace-invitacion code').textContent()) ?? '';
  await foto('04-invitar-conductor', true);
  await ir(`${raiz}/shipments/new`);
  await foto('05-nuevo-envio', true);
  await ir(`${raiz}/import`);
  await foto('06-importar');
  await ir(`${raiz}/labels`);
  await foto('07-etiquetas');
  await ir(`${raiz}/operativas`);
  await foto('08-rutas');
  await ir(`${raiz}/routes`);
  await foto('09-nueva-ruta', true);
  await ir(`${raiz}/operativas/${ruta.id}`);
  await foto('10-asignar-ruta', true);
  await ctx.close();

  // Las páginas públicas, en el celular: la invitación del conductor y el rastreo.
  const cel = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
  });
  await cel.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const c = await cel.newPage();
  const fotoCel = async (nombre) => {
    await c.waitForTimeout(1200);
    const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
    await c.screenshot({ path: png });
    aWebp(png, join(WEB, `${nombre}-${idioma}.webp`));
  };
  const token = enlaceInvitacion.split('/').at(-1);
  await c.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}/driver/join/${token}`, {
    waitUntil: 'networkidle',
  });
  await fotoCel('11-invitacion-conductor');
  await c.goto(
    `${SITIO}${idioma === 'en' ? '' : '/es'}/track/${envios[0].paquetes[0].codigoSeguimiento}`,
    { waitUntil: 'networkidle' },
  );
  await fotoCel('12-rastreo');
  await cel.close();
}
await navegador.close();

// El conductor acepta la invitación (como lo haría en Divoox Driver).
const { invitaciones } = await api(
  'GET',
  '/datos/v1/flex/conductor/invitaciones',
  undefined,
  conductor.token,
);
for (const i of invitaciones)
  await api('POST', `/datos/v1/flex/conductor/invitaciones/${i.id}/aceptar`, {}, conductor.token);
console.log(
  `Empresa ${empresa.id} · ruta tutorial ${ruta.id} · invitaciones aceptadas: ${invitaciones.length}`,
);
console.log(`Capturas: ${ORIGINALES}`);
