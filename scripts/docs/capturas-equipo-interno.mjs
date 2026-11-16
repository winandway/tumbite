// C-PERMISOS-FINOS (MON-5): capturas REALES de «Equipo interno» contra el servidor LOCAL del
// recorrido (nunca una base de la nube). Siembra datos neutros por la API y por la base local:
// personas de Novi, Michigan (inglés) y de El Vigía, Mérida (español), invitaciones, una foto de
// entrega de muestra y lo que cada uno hizo y vio. Luego fotografía la lista, «Agregar empleado», la
// ficha, las plantillas, el registro, aceptar la invitación y la foto borrosa sin permiso, en
// computadora (1280) y en celular (375).
//
// Uso:
//   SIN_COMPILAR=1 CARPETA_RECORRIDO=.simulador SOLO_SERVIDOR=1 PUERTO_RECORRIDO=8798 node scripts/recorrido/preparar.mjs
//   npx wrangler dev -c .simulador/wrangler.jsonc --persist-to .simulador/estado --port 8798 --inspector-port 9240 --local
//   (en apps/panel) PUERTO_PANEL=5174 DATOS_URL=http://localhost:8798 npx vite --port 5174
//   API=http://localhost:8798 PANEL=http://localhost:5174 node scripts/docs/capturas-equipo-interno.mjs
// Salida: docs/capturas/monitoreo/equipo-<pantalla>-<en|es>.png (y -movil en la carpeta de pruebas).
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { ORIGINALES_PRIVADAS } from './ayudaPrivada.mjs';

const RAIZ = process.cwd();
const API = process.env.API ?? 'http://localhost:8798';
const PANEL = process.env.PANEL ?? 'http://localhost:5174';
// C-AYUDA-INTERNA: fuera del repositorio (es público).
const SALIDA = ORIGINALES_PRIVADAS;
const MOVIL = join(RAIZ, '.simulador', 'capturas-movil');
// eslint-disable-next-line security/detect-non-literal-fs-filename -- carpeta privada fija (ayudaPrivada.mjs)
fs.mkdirSync(SALIDA, { recursive: true });
fs.mkdirSync(MOVIL, { recursive: true });
const datos = JSON.parse(fs.readFileSync(join(RAIZ, '.simulador', 'datos.json'), 'utf8'));
const errores = [];

async function llamar(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'en',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  return { estado: r.status, datos: d };
}
function exigir(r, que) {
  if (r.estado >= 300) throw new Error(`${que}: ${r.estado} ${JSON.stringify(r.datos)}`);
  return r.datos;
}
function sql(texto) {
  const f = join(RAIZ, '.simulador', 'semilla-equipo.sql');
  fs.writeFileSync(f, texto);
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'tumbite-local',
      '--local',
      '--persist-to',
      '.simulador/estado',
      '-c',
      '.simulador/wrangler.jsonc',
      '--file',
      f,
    ],
    { cwd: RAIZ, stdio: 'ignore' },
  );
}

// 1. La cuenta del dueño (ADMIN_CORREOS del recorrido) y su sesión.
async function entrarDueno() {
  const reg = await llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Divoox Soporte',
    correo: datos.correoEquipo,
    clave: datos.clave,
    rol: 'cliente',
    idioma: 'en',
  });
  const t0 =
    reg.estado === 201
      ? reg.datos.token
      : exigir(
          await llamar('POST', '/datos/cuentas/entrar', {
            correo: datos.correoEquipo,
            clave: datos.clave,
          }),
          'entrar',
        ).token;
  await llamar('POST', '/datos/cuentas/hacer-admin', { semilla: datos.semilla }, t0);
  return exigir(
    await llamar('POST', '/datos/cuentas/entrar', {
      correo: datos.correoEquipo,
      clave: datos.clave,
    }),
    'entrar dueño',
  ).token;
}

const dueno = await entrarDueno();

// 2. Ciudades de prueba: Novi (Michigan) y El Vigía (Mérida). Un comercio, un cliente y un pedido en
//    efectivo con diferencia (cae en la bandeja del dinero, con su foto de entrega de muestra).
sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
VALUES ('US-MI-NOVI', 'Novi', 'US', 'USD', 'America/Detroit', 42.4806, -83.4755, 30, 1),
       ('VE-MER-ELVIGIA', 'El Vigía', 'VE', 'VES', 'America/Caracas', 8.6136, -71.6566, 20, 1);`);
const comercio = await llamar('POST', '/datos/cuentas/registro', {
  nombre: 'Persona Comercio',
  correo: `comercio-${Date.now()}@recorrido.test`,
  clave: datos.clave,
  rol: 'restaurante',
  idioma: 'en',
});
const rest = exigir(
  await llamar(
    'PUT',
    '/datos/mi-restaurante',
    {
      nombre: 'Novi Pizza Kitchen',
      direccion: '43000 Grand River Ave, Novi, MI',
      lat: 42.4806,
      lng: -83.4755,
      categoria: 'Pizza',
      telefono: '2485550100',
    },
    comercio.datos.token,
  ),
  'comercio',
).restaurante;
const cliente = exigir(
  await llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Jamie Carter',
    correo: `cliente-${Date.now()}@recorrido.test`,
    clave: datos.clave,
    rol: 'cliente',
    telefono: '+12485550142',
    idioma: 'en',
  }),
  'cliente',
);
const pedidoId = crypto.randomUUID();
sql(`INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
  cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan,
  direccion, lat, lng, zona_id, metodo_pago, cobro_estado, conciliacion_estado, entregado_en)
VALUES ('${pedidoId}', '${cliente.usuario.id}', '${rest.id}', 'entregado', '[]', 2400, 399, 240, 0, 300, 3339,
  480, 1920, 699, 0, 240, 'basico', '43150 Main St, Novi, MI', 42.481, -83.476, 'US-MI-NOVI', 'efectivo',
  'confirmado', 'con_diferencia', datetime('now', '-2 hours'));
INSERT INTO evidencias (pedido_id, tipo, clave, modo) VALUES ('${pedidoId}', 'entrega', 'evidencias/${pedidoId}/entrega-muestra', 'puerta');`);
execFileSync(
  'npx',
  [
    'wrangler',
    'r2',
    'object',
    'put',
    `tumbite-local/evidencias/${pedidoId}/entrega-muestra`,
    '--file',
    join(RAIZ, 'apps', 'panel', 'public', 'og.png'),
    '--content-type',
    'image/png',
    '--local',
    '--persist-to',
    '.simulador/estado',
    '-c',
    '.simulador/wrangler.jsonc',
  ],
  { cwd: RAIZ, stdio: 'ignore' },
);

// 3. El equipo: invitaciones aceptadas, una pendiente, una persona suspendida y otra con vencimiento.
async function persona(nombre, plantillas, alcance, extra = {}) {
  const correo = `${nombre.toLowerCase().replace(/[^a-z]+/g, '.')}@recorrido.test`;
  const inv = exigir(
    await llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      { correo, nombre, plantillas, alcance, motivo: 'Turno de soporte', idioma: 'en', ...extra },
      dueno,
    ),
    `invitar ${nombre}`,
  );
  const codigo = new URL(inv.enlace).searchParams.get('code');
  const ok = exigir(
    await llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo,
      nombre,
      clave: datos.clave,
    }),
    `aceptar ${nombre}`,
  );
  return { id: ok.usuario.id, token: ok.token, correo };
}
const maya = await persona('Maya Chen', ['soporte_1'], { zonas: ['US-MI-NOVI'] });
const jordan = await persona('Jordan Reyes', ['monitor'], { zonas: ['US-MI-NOVI'] });
const sam = await persona('Sam Patel', ['soporte_2'], {}, { venceEn: '2027-03-31' });
const alex = await persona('Alex Rivera', ['finanzas'], { paises: ['US'] });
const daniela = await persona('Daniela Rojas', ['soporte_1'], { zonas: ['VE-MER-ELVIGIA'] });
const luis = await persona('Luis Méndez', ['verificador'], { paises: ['VE'] });
void alex;
void luis;
exigir(
  await llamar(
    'POST',
    `/datos/admin/equipo/miembros/${jordan.id}/suspender`,
    { motivo: 'Licencia de dos semanas' },
    dueno,
  ),
  'suspender',
);
exigir(
  await llamar(
    'POST',
    '/datos/admin/equipo/invitaciones',
    {
      correo: 'taylor.brooks@recorrido.test',
      nombre: 'Taylor Brooks',
      plantillas: ['emergencias'],
      alcance: { servicios: ['carro', 'moto'] },
      motivo: 'Turno de noche de viajes',
      idioma: 'en',
    },
    dueno,
  ),
  'invitación pendiente',
);
// Lo que vieron: Maya abre la foto de entrega; Sam desenmascara el teléfono del cliente.
await fetch(`${API}/datos/pedidos/${pedidoId}/evidencia/entrega`, {
  headers: { authorization: `Bearer ${maya.token}` },
});
await llamar(
  'GET',
  `/datos/admin/datos-personales/cliente/${cliente.usuario.id}/telefono`,
  undefined,
  sam.token,
);
await llamar('GET', '/datos/admin/pedidos?estado=todos', undefined, maya.token);
await llamar('PATCH', `/datos/admin/tickets/no-existe`, { estado: 'cerrado' }, maya.token);
const ruta = exigir(await llamar('GET', '/datos/admin/ruta', undefined, dueno), 'ruta').ruta;
const BASE = `${PANEL}/panel/${ruta}`;
// Un enlace de invitación nuevo para fotografiar la página de aceptar (no se acepta).
const paraAceptar = exigir(
  await llamar(
    'POST',
    '/datos/admin/equipo/invitaciones',
    {
      correo: 'riley.morgan@recorrido.test',
      nombre: 'Riley Morgan',
      plantillas: ['soporte_1'],
      alcance: { zonas: ['US-MI-NOVI'] },
      motivo: 'Turno de tarde',
      idioma: 'en',
    },
    dueno,
  ),
  'invitación para aceptar',
).enlace;

// 4. Las fotos.
const navegador = await chromium.launch();
async function pagina(token, idioma, ancho) {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: ancho < 500 ? 812 : 900 },
    deviceScaleFactor: 2,
    locale: idioma === 'es' ? 'es-US' : 'en-US',
  });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  if (token)
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(`${idioma}/${ancho}: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|401|403|404/.test(m.text()))
      errores.push(`${idioma}/${ancho} consola: ${m.text()}`);
  });
  return { ctx, p };
}
async function foto(p, nombre, idioma, ancho, selector = null) {
  await p.waitForTimeout(600);
  const destino =
    ancho < 500
      ? join(MOVIL, `equipo-${nombre}-${idioma}.png`)
      : join(SALIDA, `equipo-${nombre}-${idioma}.png`);
  // La página entera (con el menú y la cabecera, como se ve): la dirección del equipo no sale.
  if (selector) await p.locator(selector).first().screenshot({ path: destino });
  else await p.screenshot({ path: destino, fullPage: true });
  console.log('captura:', destino.replace(`${RAIZ}/`, ''));
}

for (const idioma of ['en', 'es']) {
  for (const ancho of [1280, 375]) {
    const { ctx, p } = await pagina(dueno, idioma, ancho);
    const t = idioma === 'es';
    // Lista
    await p.goto(`${BASE}/team`);
    await p.getByRole('link', { name: 'Maya Chen' }).waitFor();
    await foto(p, 'lista', idioma, ancho);
    // Agregar empleado
    await p.getByRole('button', { name: t ? 'Agregar empleado' : 'Add employee' }).click();
    await p
      .getByLabel(t ? 'Correo de trabajo' : 'Work email')
      .fill(t ? 'carla.perez@recorrido.test' : 'chris.lee@recorrido.test');
    await p.getByLabel(t ? 'Nombre completo' : 'Full name').fill(t ? 'Carla Pérez' : 'Chris Lee');
    await p.getByRole('checkbox', { name: t ? /Soporte nivel 1/ : /Support level 1/ }).check();
    await p.getByRole('checkbox', { name: t ? 'El Vigía' : 'Novi' }).check();
    await p.getByLabel(t ? 'Motivo' : 'Reason').fill(t ? 'Turno de mañana' : 'Morning shift');
    await p.locator('form.eq-invitar').scrollIntoViewIfNeeded();
    await foto(p, 'agregar', idioma, ancho);
    await p.getByRole('button', { name: t ? 'Cancelar' : 'Cancel' }).click();
    // Ficha
    await p.goto(`${BASE}/team/${t ? daniela.id : maya.id}`);
    await p.getByRole('heading', { name: t ? 'Daniela Rojas' : 'Maya Chen' }).waitFor();
    await foto(p, 'ficha', idioma, ancho);
    // Plantillas
    await p.goto(`${BASE}/team?tab=plantillas`);
    await p
      .getByText(t ? 'Soporte nivel 2' : 'Support level 2')
      .first()
      .waitFor();
    await foto(p, 'plantillas', idioma, ancho);
    // Registro (lo que se vio)
    await p.goto(`${BASE}/team?tab=registro`);
    await p.getByLabel(t ? 'Qué mirar' : 'What to look at').selectOption('accesos');
    await p.getByRole('table').waitFor();
    await foto(p, 'registro', idioma, ancho);
    await ctx.close();
  }
  // Foto borrosa sin permiso: la bandeja del dinero vista por alguien sin `pedidos.fotos`. Se le
  // da a Sam la lectura del dinero como permiso extra (con motivo), sin fotos.
  const quien = idioma === 'en' ? sam : daniela;
  exigir(
    await llamar(
      'PUT',
      `/datos/admin/equipo/miembros/${quien.id}`,
      {
        asignaciones: [{ plantillaId: 'monitor', alcance: {} }],
        ajustes: [
          { permiso: 'dinero.ver', tipo: 'extra', motivo: 'Revisar la bandeja del dinero' },
        ],
        motivo: 'Capturas de la guía interna',
      },
      dueno,
    ),
    'permiso de dinero sin fotos',
  );
  const sesion = exigir(
    await llamar('POST', '/datos/cuentas/entrar', { correo: quien.correo, clave: datos.clave }),
    'entrar sin fotos',
  ).token;
  for (const ancho of [1280, 375]) {
    const { ctx, p } = await pagina(sesion, idioma, ancho);
    await p.goto(`${BASE}/cash/${encodeURIComponent(`diferencia:${pedidoId}`)}`);
    await p.locator('.eq-foto').first().waitFor();
    await p.locator('.eq-foto').first().scrollIntoViewIfNeeded();
    await foto(p, 'foto-sin-permiso', idioma, ancho);
    await ctx.close();
  }
  // Aceptar la invitación (página pública, sin sesión).
  for (const ancho of [1280, 375]) {
    const { ctx, p } = await pagina(null, idioma, ancho);
    const enlace = new URL(paraAceptar);
    await p.goto(`${PANEL}${idioma === 'es' ? '/es' : ''}/team-invite${enlace.search}`);
    await p.getByLabel(idioma === 'es' ? 'Crea tu contraseña' : 'Create your password').waitFor();
    await p
      .getByLabel(idioma === 'es' ? 'Crea tu contraseña' : 'Create your password')
      .fill('una-clave-de-muestra');
    await foto(p, 'aceptar', idioma, ancho);
    await ctx.close();
  }
}
await navegador.close();
if (errores.length) {
  console.error('ERRORES EN LA PANTALLA:\n' + errores.join('\n'));
  process.exitCode = 1;
}
