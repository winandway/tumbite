// Capturas REALES de las líneas de taxi y mototaxi (C-LINEAS-TAXI, 19 nov 2026) — todos los países.
// Contra el servidor LOCAL del recorrido (.recorrido, armado con scripts/recorrido/preparar.mjs y
// encendido en el puerto 8790), con el panel real (/register-line, /panel) y el Driver web real (/driver).
// NO toca el sitio de pruebas ni producción. Datos de ejemplo inventados: «Línea Ejemplo», código
// EJEMPLO01, personas con nombres neutros. Ningún dato real.
//
// Para Docs (públicas): registro, driver-pedir, driver-lider, driver-equipo, por idioma
//   → docs/capturas/lineas/<nombre>-<es|en>.png y apps/panel/public/docs/recorrido-lineas-<nombre>-<es|en>.webp
// Para la ayuda interna (privadas, fuera del repo): lineas-super-solicitudes|crear|lista-<es|en>
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas}
// Uso: node scripts/recorrido/capturas-lineas.mjs   (SOLO_IDIOMA=es|en para un solo idioma)
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection, no-undef -- guion local: carpetas fijas del repositorio y de la carpeta privada; `document` corre dentro del navegador */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'lineas');
const DOCS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
mkdirSync(SALIDA, { recursive: true });
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });

// Español en una ciudad hispana, inglés en una de Estados Unidos (C-CAPTURAS-POR-IDIOMA).
const L = {
  es: {
    zona: 'VE-MER-ELVIGIA',
    ciudad: 'El Vigía',
    pais: 'VE',
    moneda: 'VES',
    tz: 'America/Caracas',
    locale: 'es-VE',
    lat: 8.6219,
    lng: -71.6506,
    linea: 'Línea Ejemplo',
    otra: 'Línea Centro',
    lider: 'Laura Pérez',
    miembros: ['José Rojas', 'Marta Díaz', 'Pedro Gil'],
    pendientes: ['Luis Mora', 'Ana Silva'],
    nuevo: 'Carlos Vera',
    form: {
      nombre: 'Línea Ejemplo',
      conductores: '24',
      liderNombre: 'Laura Pérez',
      liderTelefono: '+58 414 000 0001',
      contacto2Nombre: 'Rosa Pérez',
      contacto2Telefono: '+58 414 000 0002',
    },
  },
  en: {
    zona: 'US-MI-NOVI',
    ciudad: 'Novi',
    pais: 'US',
    moneda: 'USD',
    tz: 'America/Detroit',
    locale: 'en-US',
    lat: 42.4806,
    lng: -83.4755,
    linea: 'Example Line',
    otra: 'Downtown Line',
    lider: 'Laura Smith',
    miembros: ['Mike Brown', 'Anna Davis', 'Tom Clark'],
    pendientes: ['Luke Moore', 'Emma Hill'],
    nuevo: 'Chris Young',
    form: {
      nombre: 'Example Line',
      conductores: '24',
      liderNombre: 'Laura Smith',
      liderTelefono: '+1 555 010 0001',
      contacto2Nombre: 'Rose Smith',
      contacto2Telefono: '+1 555 010 0002',
    },
  },
};

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.82.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const huella = (t) => createHash('sha256').update(t).digest('hex');
const txt = (s) => String(s).replace(/'/g, "''");
const sufijo = Date.now().toString(36);

async function conductor(nombre, idioma, zona, k) {
  const r = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo: `lineas-${sufijo}-${idioma}-${k}@recorrido.test`,
    clave: DATOS.clave,
    rol: 'repartidor',
    idioma,
  });
  const id = r.usuario.id;
  await sql(
    `UPDATE usuarios SET zona_id = '${zona}', idioma = '${idioma}', telefono = '+1555010${String((idioma === 'en' ? 2000 : 1000) + k)}', telefono_canonico = '1555010${String((idioma === 'en' ? 2000 : 1000) + k)}' WHERE id = '${id}'`,
  );
  await sql(
    `INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${id}', '${zona}') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
  );
  await sql(
    `UPDATE sesiones SET expira_en = datetime('now', '+90 minutes') WHERE id = '${huella(r.token)}'`,
  );
  return { id, token: r.token };
}

const navegador = await chromium.launch();
const webp = (origen, destino, ancho) =>
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    ...(ancho ? ['-resize', String(ancho), '0'] : []),
    origen,
    '-o',
    destino,
  ]);

async function correr(idioma) {
  const T = L[idioma];
  const en = idioma === 'en';
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${T.zona}', '${txt(T.ciudad)}', '${T.pais}', '${T.moneda}', '${T.tz}', ${T.lat}, ${T.lng}, 20, 1)`,
  );
  // Empezar limpio en esta ciudad.
  await sql(`DELETE FROM pedidos_linea WHERE equipo_id IN (SELECT equipo_id FROM lineas)`);
  await sql(`DELETE FROM miembros_equipo WHERE equipo_id IN (SELECT equipo_id FROM lineas)`);
  await sql(`DELETE FROM equipos WHERE id IN (SELECT equipo_id FROM lineas)`);
  await sql(`DELETE FROM lineas`);
  await sql(`DELETE FROM solicitudes_linea`);
  await sql(`DELETE FROM intentos_limite`).catch(() => null);

  const lider = await conductor(T.lider, idioma, T.zona, 1);
  const otroLider = await conductor(en ? 'Dan Wright' : 'Raúl Soto', idioma, T.zona, 2);
  const miembros = [];
  for (const [i, n] of T.miembros.entries())
    miembros.push(await conductor(n, idioma, T.zona, 10 + i));
  const pendientes = [];
  for (const [i, n] of T.pendientes.entries())
    pendientes.push(await conductor(n, idioma, T.zona, 20 + i));
  const nuevo = await conductor(T.nuevo, idioma, T.zona, 30);

  // Las líneas de ejemplo (código imposible EJEMPLO01) escritas en esta base local.
  const linea = async (id, nombre, codigo, liderId, tipo) => {
    await sql(
      `INSERT INTO equipos (id, nombre, zona_id, lider_id, codigo, creado_por) VALUES ('${id}', '${txt(nombre)}', '${T.zona}', '${liderId}', '${codigo}', '${liderId}')`,
    );
    await sql(
      `INSERT INTO lineas (equipo_id, tipo, contacto2_nombre, contacto2_telefono, conductores_estimados, telefono_verificado_en)
       VALUES ('${id}', '${tipo}', '${en ? 'Rose Smith' : 'Rosa Pérez'}', '+15550100002', 24, datetime('now'))`,
    );
  };
  const idLinea = `zz-linea-${idioma}-${sufijo}`;
  await linea(idLinea, T.linea, 'EJEMPLO01', lider.id, 'mototaxi');
  await linea(`${idLinea}-b`, T.otra, 'EJEMPLO02', otroLider.id, 'taxi');
  for (const m of miembros) {
    await sql(
      `INSERT INTO miembros_equipo (usuario_id, equipo_id) VALUES ('${m.id}', '${idLinea}')`,
    );
    await sql(
      `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado, resuelto_en) VALUES ('${m.id}', '${idLinea}', 'aceptada', datetime('now'))`,
    );
  }
  for (const p of pendientes)
    await sql(
      `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado) VALUES ('${p.id}', '${idLinea}', 'pendiente')`,
    );

  const contexto = async (token, usuario) => {
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: T.locale,
      timezoneId: T.tz,
      geolocation: { latitude: T.lat, longitude: T.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        if (pase) localStorage.setItem('tumbite.sesion', pase);
        if (u) localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [token, usuario, idioma],
    );
    return ctx;
  };
  const foto = async (pagina, nombre) => {
    await pagina.screenshot({ path: join(SALIDA, `${nombre}-${idioma}.png`) });
    webp(
      join(SALIDA, `${nombre}-${idioma}.png`),
      join(DOCS, `recorrido-lineas-${nombre}-${idioma}.webp`),
      540,
    );
  };
  const abrirMiLinea = async (d) => {
    await d.goto('/driver/');
    await d
      .getByLabel(en ? 'Profile' : 'Perfil')
      .first()
      .click({ timeout: 60_000 });
    await d
      .getByText(en ? 'My line' : 'Mi línea', { exact: true })
      .first()
      .click({ timeout: 30_000 });
    await d.getByTestId('mi-linea').waitFor({ timeout: 30_000 });
  };

  // ───────── registro: el formulario público, lleno con datos de ejemplo
  const pub = await contexto(null, null);
  const p = await pub.newPage();
  await p.goto(`${en ? '' : '/es'}/register-line`);
  await p.locator('form').first().waitFor({ timeout: 60_000 });
  const campos = await p.locator('form input').all();
  const valores = [
    T.form.nombre,
    T.form.conductores,
    T.form.liderNombre,
    T.form.liderTelefono,
    T.form.contacto2Nombre,
    T.form.contacto2Telefono,
  ];
  // Orden del formulario: nombre, [ciudad, tipo = selects], conductores, líder (2), contacto (2).
  for (const [i, v] of valores.entries()) await campos[i]?.fill(v);
  const selects = await p.locator('form select').all();
  await selects[0]?.selectOption(T.zona);
  await selects[1]?.selectOption('mototaxi');
  await p.evaluate(() => {
    document.activeElement?.blur();
    // La burbuja flotante del chat de soporte no sale en la foto del formulario.
    for (const e of document.querySelectorAll('body *'))
      if (getComputedStyle(e).position === 'fixed') e.style.display = 'none';
    globalThis.scrollTo(0, 0);
  });
  await espera(900);
  await p.screenshot({ path: join(SALIDA, `registro-${idioma}.png`), fullPage: true });
  webp(
    join(SALIDA, `registro-${idioma}.png`),
    join(DOCS, `recorrido-lineas-registro-${idioma}.webp`),
    540,
  );
  await pub.close();

  // ───────── driver-pedir: un conductor sin línea ve el código y las líneas de su ciudad
  const cn = await contexto(nuevo.token, nuevo.id);
  const dn = await cn.newPage();
  await abrirMiLinea(dn);
  await dn.getByTestId('linea-lista').waitFor({ timeout: 30_000 });
  await espera(1200);
  await foto(dn, 'driver-pedir');
  await cn.close();

  // ───────── driver-lider y driver-equipo: el líder con su código, su QR y sus solicitudes
  const cl = await contexto(lider.token, lider.id);
  const dl = await cl.newPage();
  await abrirMiLinea(dl);
  await dl.getByTestId('linea-lider').waitFor({ timeout: 30_000 });
  await espera(1500);
  await foto(dl, 'driver-lider');
  await dl.getByTestId('linea-equipo').scrollIntoViewIfNeeded();
  await dl.getByTestId(`linea-miembro-menu-${miembros[0].id}`).click();
  await dl.getByTestId(`linea-sacar-${miembros[0].id}`).waitFor({ timeout: 10_000 });
  await dl
    .getByTestId(`linea-sacar-${miembros[0].id}`)
    .evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await espera(900);
  await foto(dl, 'driver-equipo');
  await cl.close();

  // ───────── superadmin (ayuda interna, privadas): solicitudes, crear y lista
  await pedir('POST', '/datos/publico/lineas/solicitud', {
    nombre: en ? 'North Side Line' : 'Línea del Norte',
    zonaId: T.zona,
    tipo: 'taxi',
    conductores: 12,
    liderNombre: en ? 'Henry Adams' : 'Héctor Medina',
    liderTelefono: '+15550100003',
    contacto2Nombre: en ? 'Grace Adams' : 'Gloria Medina',
    contacto2Telefono: '+15550100004',
  });
  const reg = await pedir('POST', '/datos/cuentas/registro', {
    nombre: 'Divoox Soporte',
    correo: DATOS.correoEquipo,
    clave: DATOS.clave,
    rol: 'cliente',
    idioma,
  }).catch(() => null);
  const t0 =
    reg?.token ??
    (
      await pedir('POST', '/datos/cuentas/entrar', {
        correo: DATOS.correoEquipo,
        clave: DATOS.clave,
      })
    ).token;
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, t0).catch(
    () => null,
  );
  const dueno = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, dueno)).ruta;
  const sctx = await navegador.newContext({
    baseURL: URL,
    viewport: { width: 1000, height: 900 },
    deviceScaleFactor: 1,
    locale: T.locale,
  });
  await sctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  await sctx.addCookies([
    { name: 'tumbite_sesion', value: dueno, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const s = await sctx.newPage();
  await s.goto(`/panel/${ruta}/lines`);
  await s.getByTestId('super-lineas').waitFor({ timeout: 60_000 });
  await s.getByTestId('lineas-solicitudes').waitFor({ timeout: 30_000 });
  await espera(1200);
  const privada = async (elemento, nombre) => {
    const png = join(ORIGINALES_PRIVADAS, `lineas-super-${nombre}-${idioma}.png`);
    await elemento.screenshot({ path: png });
    webp(png, join(CAPTURAS_PRIVADAS, `lineas-super-${nombre}-${idioma}.webp`), 900);
  };
  await privada(s.getByTestId('lineas-solicitudes'), 'solicitudes');
  await privada(s.getByTestId('lineas-crear'), 'crear');
  await s.getByTestId('lineas-ciudad').selectOption(T.zona);
  await espera(900);
  await s
    .getByTestId('linea-tarjeta')
    .first()
    .getByRole('button', { name: en ? 'View' : 'Ver' })
    .click();
  await espera(1200);
  await privada(s.getByTestId('lineas-lista'), 'lista');
  await sctx.close();
}

const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'en') await correr('es');
  if (SOLO !== 'es') await correr('en');
} finally {
  await navegador.close();
}
console.log(
  'capturas de las líneas listas en docs/capturas/lineas/ y en la carpeta privada de la ayuda interna',
);
