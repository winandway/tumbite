// Capturas REALES de «Recordatorios de registro» y de la ventana «Enviar mensaje» de la ficha
// (C-REZAGADOS, 22 nov 2026) para la AYUDA INTERNA del panel — todos los países. Contra el servidor
// LOCAL del recorrido que ya está corriendo (no toca el sitio de pruebas ni producción):
//   SOLO_SERVIDOR=1 PUERTO_RECORRIDO=8791 node scripts/recorrido/preparar.mjs
//   npm run build -w @tumbite/panel && cp -R apps/panel/dist/. .recorrido/sitio/
//   npx wrangler dev -c .recorrido/wrangler.jsonc --port 8791 --persist-to .recorrido/estado
// Siembra dos zonas de ejemplo (una en vista previa) con cuatro cuentas a medio registro y algunos
// envíos, en español con zonas de Venezuela y en inglés con zonas de Estados Unidos, todas con nombres
// neutros (sin ciudades). Las demás zonas de la base local se apagan para que no salgan en la foto.
//   rezagados-zonas-<es|en>       → la pantalla con la franja, el aviso del SMS y las zonas
//   rezagados-plantillas-<es|en>  → las plantillas de un paso en los dos idiomas
//   rezagados-lista-<es|en>       → «A quiénes les escribiría hoy»
//   rezagados-mensaje-<es|en>     → la ventana «Enviar mensaje» con la vista previa
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Uso: node scripts/recorrido/capturas-rezagados.mjs   (termina con error si algo no aparece)
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas y llaves de idioma fijas «es» y «en» */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.87.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = async (q) => {
  const d = await pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': DATOS.relojSecreto,
  });
  return d.filas ?? d.results ?? [];
};

// Cada idioma con sus zonas y sus personas (nombres neutros, sin ciudades ni personas reales).
const PASADAS = {
  es: {
    locale: 'es-VE',
    zonas: [
      ['ZZ-REZ-NORTE', 'Zona de ejemplo Norte', 'VE', 'VES', 'America/Caracas'],
      ['ZZ-REZ-SUR', 'Zona de ejemplo Sur', 'VE', 'VES', 'America/Caracas'],
    ],
    telefono: (n) => `+58414555${String(n).padStart(4, '0')}`,
    personas: [
      ['marina', 'Marina Ejemplo', 'repartidor', 26, 'fotos'],
      ['tomas', 'Tomás Ejemplo', 'repartidor', 1, 'vehiculo'],
      ['elena', 'Elena Ejemplo', 'cliente', 5, 'correo'],
      ['julian', 'Julián Ejemplo', 'repartidor', 80, 'tope'],
    ],
    mas: 'Más acciones de la cuenta',
    enviar: 'Enviar mensaje',
    ver: 'Ver cómo queda',
    sms: 'SMS',
  },
  en: {
    locale: 'en-US',
    zonas: [
      ['US-ZZ-REZ-NORTH', 'Sample Zone North', 'US', 'USD', 'America/Detroit'],
      ['US-ZZ-REZ-SOUTH', 'Sample Zone South', 'US', 'USD', 'America/Detroit'],
    ],
    telefono: (n) => `+1313555${String(n).padStart(4, '0')}`,
    personas: [
      ['megan', 'Megan Sample', 'repartidor', 26, 'fotos'],
      ['tom', 'Tom Sample', 'repartidor', 1, 'vehiculo'],
      ['ellen', 'Ellen Sample', 'cliente', 5, 'correo'],
      ['jason', 'Jason Sample', 'repartidor', 80, 'tope'],
    ],
    mas: 'More account actions',
    enviar: 'Send message',
    ver: 'Preview',
    sms: 'SMS',
  },
};

// El equipo (el dueño del panel local).
const reg = await pedir('POST', '/datos/cuentas/registro', {
  nombre: 'Divoox Soporte',
  correo: DATOS.correoEquipo,
  clave: DATOS.clave,
  rol: 'cliente',
  idioma: 'es',
}).catch(() => null);
const t0 =
  reg?.token ??
  (await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave }))
    .token;
await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, t0).catch(() => null);
const equipo = (
  await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
).token;
const idEquipo = (await sql(`SELECT id FROM usuarios WHERE correo = '${DATOS.correoEquipo}'`))[0]
  ?.id;
const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, equipo)).ruta;

let n = 0;
async function sembrar(idioma) {
  const P = PASADAS[idioma];
  const todas = Object.values(PASADAS).flatMap((x) => x.zonas.map((z) => z[0]));
  for (const [id, nombre, pais, moneda, hora] of P.zonas)
    await sql(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('${id}', '${nombre}', '${pais}', '${moneda}', '${hora}', 8.6, -71.1, 20, 1)`,
    );
  // Solo las zonas de esta pasada salen en la foto.
  await sql(
    `UPDATE zonas SET activa = CASE WHEN id IN (${P.zonas.map((z) => `'${z[0]}'`).join(',')}) THEN 1 ELSE 0 END`,
  );
  const zona = P.zonas[0][0];
  const ids = {};
  for (const [clave, nombre, rol, horas, caso] of P.personas) {
    const correo = `rez.${clave}@recorrido.test`;
    let id = (await sql(`SELECT id FROM usuarios WHERE correo = '${correo}'`))[0]?.id;
    if (!id)
      id = (
        await pedir('POST', '/datos/cuentas/registro', {
          nombre,
          correo,
          clave: DATOS.clave,
          rol,
          idioma,
        })
      ).usuario.id;
    ids[clave] = id;
    await sql(
      `UPDATE usuarios SET zona_id = '${zona}', idioma = '${idioma}', es_prueba = 0, activo = 1,
         telefono = '${P.telefono(++n)}', correo_confirmado_en = NULL,
         creado_en = datetime('now', '-${horas} hours') WHERE id = '${id}'`,
    );
    await sql(`DELETE FROM embudo_cuenta WHERE usuario_id = '${id}'`);
    await sql(`DELETE FROM rezagados_mensajes WHERE usuario_id = '${id}'`);
    if (rol === 'repartidor')
      await sql(
        `INSERT INTO repartidores (usuario_id, zona_id, codigo) VALUES ('${id}', '${zona}', 'EJE-${String(n).padStart(6, '0')}')
         ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
      );
    // Al de «vehículo» ya le constan las fotos (hace una hora).
    if (caso === 'vehiculo')
      for (const paso of ['foto_cara', 'foto_documento', 'foto_licencia', 'enviado'])
        await sql(
          `INSERT OR REPLACE INTO embudo_cuenta (usuario_id, paso, creado_en) VALUES ('${id}', '${paso}', datetime('now', '-1 hours'))`,
        );
    const envio = (paso, canal, origen, numero, estado, detalle, horasAtras, actor = null) =>
      sql(
        `INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, numero, estado, detalle, texto, actor_id, creado_en)
         VALUES ('rez-${clave}-${canal}-${numero}-${origen}', '${id}', '${paso}', '${canal}', '${origen}', ${numero}, '${estado}', '${detalle}', '', ${actor ? `'${actor}'` : 'NULL'}, datetime('now', '-${horasAtras} hours'))`,
      );
    if (caso === 'fotos') {
      await envio('fotos', 'correo', 'auto', 1, 'entregado', '', 23);
      await envio('fotos', 'aviso', 'auto', 1, 'enviado', '', 23);
    }
    if (caso === 'tope') {
      await envio('fotos', 'correo', 'auto', 1, 'enviado', '', 77);
      await envio('fotos', 'sms', 'auto', 2, 'fallido', 'el_proveedor_no_lo_acepto', 56);
      await envio('fotos', 'correo', 'auto', 3, 'rebotado', '', 8);
      await envio('libre', 'aviso', 'manual', 0, 'sin_destino', 'sin_aparato', 2, idEquipo);
    }
  }
  // Ajustes: la primera zona en vista previa, la otra apagada; horario de todo el día para que la
  // foto no dependa de la hora en que se toma.
  const actuales = (await pedir('GET', '/datos/admin/camila/recordatorios', undefined, equipo))
    .ajustes;
  const zonas = Object.fromEntries(todas.map((z) => [z, 'apagado']));
  zonas[zona] = 'previa';
  await pedir(
    'PUT',
    '/datos/admin/camila/recordatorios',
    { ...actuales, horaDesde: 0, horaHasta: 24, zonas },
    equipo,
  );
  return ids;
}

const navegador = await chromium.launch();
const fallos = [];
for (const idioma of ['es', 'en']) {
  const P = PASADAS[idioma];
  const ids = await sembrar(idioma);
  const ctx = await navegador.newContext({
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: P.locale,
  });
  await ctx.addInitScript((i) => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', i);
  }, idioma);
  await ctx.addCookies([
    { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const p = await ctx.newPage();
  const guardar = async (nombre, objetivo) => {
    const png = join(ORIGINALES_PRIVADAS, `rezagados-${nombre}-${idioma}.png`);
    // Una parte de la pantalla se recorta de la página entera: así la cabecera fija no la tapa.
    if (objetivo) {
      const caja = await objetivo.boundingBox();
      const arriba = await p.evaluate(() => globalThis.scrollY);
      await p.screenshot({
        path: png,
        fullPage: true,
        clip: {
          x: caja.x - 8,
          y: caja.y + arriba - 8,
          width: caja.width + 16,
          height: caja.height + 16,
        },
      });
    } else await p.screenshot({ path: png });
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      png,
      '-o',
      join(CAPTURAS_PRIVADAS, `rezagados-${nombre}-${idioma}.webp`),
    ]);
    console.log(`capturas: rezagados-${nombre}-${idioma}`);
  };

  await p.goto(`/panel/${ruta}/signup-reminders`);
  await p.getByTestId('rez-zonas').waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => null);
  await espera(600);
  const filas = await p.getByTestId('rez-fila').count();
  if (filas !== 4) fallos.push(`${idioma}: la lista trajo ${filas} personas, se esperaban 4`);
  await guardar('zonas');
  await guardar('plantillas', p.getByTestId('rez-plantillas'));
  await guardar('lista', p.getByTestId('rez-lista'));

  // La ficha de la primera persona: tres puntos → «Enviar mensaje» → «Ver cómo queda».
  await p.goto(`/panel/${ruta}/drivers/${Object.values(ids)[0]}`);
  await p.getByRole('button', { name: P.mas }).waitFor({ timeout: 60_000 });
  await p.getByRole('button', { name: P.mas }).click();
  await p.getByRole('menuitem', { name: P.enviar }).click();
  const ventana = p.getByTestId('enviar-mensaje');
  await ventana.waitFor({ timeout: 30_000 });
  await ventana.getByLabel(P.sms).check();
  await ventana.getByRole('button', { name: P.ver }).click();
  await p
    .getByTestId('enviar-mensaje-vista')
    .waitFor({ timeout: 30_000 })
    .catch(() => fallos.push(`${idioma}: la vista previa del mensaje no apareció`));
  await espera(400);
  await guardar('mensaje');
  await ctx.close();
}
await navegador.close();
console.log(fallos.length ? `capturas: FALLOS\n- ${fallos.join('\n- ')}` : 'capturas: todo salió');
if (fallos.length) process.exit(1);
