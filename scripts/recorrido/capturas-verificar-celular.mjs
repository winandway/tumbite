/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y llaves de idioma fijas «es» y «en»; `localStorage` corre dentro del navegador */
// C-TELEFONO-AL-REGISTRARSE (22 nov 2026) — Venezuela y Estados Unidos. Prueba EN PANTALLA, con la app
// web real del cliente (/app) contra el servidor LOCAL del recorrido (.recorrido; antes:
// PUERTO_RECORRIDO=8797 PUERTO_TWILIO=12127 node scripts/recorrido/preparar.mjs), de la puerta del
// celular. No solo captura: cada paso lleva su comprobación y, si falla, el guion se para con el motivo.
//   1. Cuenta nueva (con la puerta): «Confirma tu celular» sale sola y el SMS (simulado aquí mismo)
//      trae el código. Se cambia el número, llega el código nuevo, se escribe y sale «confirmado».
//   2. Cuenta vieja: entra a la app y ve solo la franja suave, que se puede cerrar.
//   3. El bloque del panel (interruptor por país y quién confirmó), para la ayuda interna.
// Español con celulares de Venezuela; inglés con celulares de Estados Unidos (C-CAPTURAS-POR-IDIOMA).
// Nombres neutros y números de ejemplo (555).
//   → docs/capturas/verificar-celular/<nombre>-<es|en>.png
//   → apps/panel/public/docs/recorrido-celular-<nombre>-<es|en>.webp (Docs públicos)
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas}/celular-panel-<es|en> (ayuda interna)
// Uso: node scripts/recorrido/capturas-verificar-celular.mjs
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'verificar-celular');
const DOCS = join(RAIZ, 'apps', 'panel', 'public', 'docs');
const PUERTO_SMS = 12127;
for (const d of [SALIDA, DOCS, ORIGINALES_PRIVADAS, CAPTURAS_PRIVADAS])
  mkdirSync(d, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// El SMS simulado: guarda cada mensaje para leer el código (como lo leería el teléfono).
const mensajes = [];
const simulador = createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (d) => (cuerpo += d));
  req.on('end', () => {
    const b = new URLSearchParams(cuerpo);
    mensajes.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ sid: `SIM${mensajes.length}`, status: 'queued' }));
  });
}).listen(PUERTO_SMS);

// En este servidor local los SMS a Venezuela también salen por el simulador.
const vars = readFileSync(join(RAIZ, '.recorrido', '.dev.vars'), 'utf8');
if (!/^SMS_PREFIJOS=/m.test(vars))
  appendFileSync(join(RAIZ, '.recorrido', '.dev.vars'), '\nSMS_PREFIJOS=+1,+58\n');
const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    new globalThis.URL(URL).port,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.86.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
function comprobar(cond, paso, evidencia) {
  if (!cond) throw new Error(`FALLA ${paso}: ${evidencia}`);
  console.log(`  ✓ ${paso}: ${evidencia}`);
}

const L = {
  es: {
    locale: 'es-US',
    nombre: 'Laura Pérez',
    vieja: 'Ana Gómez',
    pendiente: ['Marina Ejemplo', '+584145550163'],
    correo: 'ana.gomez@ejemplo.com',
    pais: 'VE',
    malo: '+584145550199',
    bueno: '04145550142',
    viejo: '+584145550177',
    titulo: 'Confirma tu celular',
    cambiar: '¿Número equivocado? Cámbialo',
    numero: 'Número de celular',
    guardar: 'Guardar y mandar el código',
    listo: 'Tu celular quedó confirmado',
    franja: 'Confirma tu celular para proteger tu cuenta',
    panel: 'Código por SMS al registrarse',
  },
  en: {
    locale: 'en-US',
    nombre: 'Jamie Lee',
    vieja: 'Taylor Brooks',
    pendiente: ['Megan Sample', '+12485550163'],
    correo: 'taylor.brooks@example.com',
    pais: 'US',
    malo: '+12485550199',
    bueno: '2485550142',
    viejo: '+12485550177',
    titulo: 'Confirm your cell phone',
    cambiar: 'Wrong number? Change it',
    numero: 'Cell phone number',
    guardar: 'Save and send the code',
    listo: 'Your cell phone is confirmed',
    franja: 'Confirm your cell phone to protect your account',
    panel: 'Text code at sign-up',
  },
};

function webp(nombre, idioma) {
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    '-resize',
    '540',
    '0',
    join(SALIDA, `${nombre}-${idioma}.png`),
    '-o',
    join(DOCS, `recorrido-celular-${nombre}-${idioma}.webp`),
  ]);
  console.log(`  → recorrido-celular-${nombre}-${idioma}.webp`);
}

let navegador;
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${URL}/datos/salud`).then(
        () => true,
        () => false,
      )
    )
      break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2_000);
  }
  // Las demás cuentas de la base local no salen en la foto del panel.
  await sql(
    "UPDATE usuarios SET telefono_exigido_en = NULL WHERE telefono_exigido_en IS NOT NULL AND correo NOT LIKE 'celular.%'",
  );
  await sql("DELETE FROM config WHERE clave = 'telefono_codigo_paises'");
  // Los números de ejemplo de una pasada anterior quedan libres (un teléfono, una cuenta de cada tipo).
  await sql(
    "UPDATE usuarios SET telefono = NULL, telefono_canonico = NULL WHERE correo LIKE 'celular.%' OR correo LIKE '%@apartado.test' OR correo IN ('ana.gomez@ejemplo.com', 'taylor.brooks@example.com')",
  );
  await sql('DELETE FROM envios_codigo_telefono');
  // La lista del panel muestra solo las cuentas de esta pasada.
  await sql(
    "UPDATE usuarios SET telefono_exigido_en = NULL, telefono_verificado_en = NULL WHERE correo LIKE 'celular.%' OR correo LIKE '%@apartado.test' OR correo IN ('ana.gomez@ejemplo.com', 'taylor.brooks@example.com')",
  );
  navegador = await chromium.launch();
  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    console.log(`— ${idioma}`);
    // Cada idioma con sus propias cuentas en la lista del panel (C-CAPTURAS-POR-IDIOMA).
    await sql(
      "UPDATE usuarios SET telefono_exigido_en = NULL, telefono_verificado_en = NULL WHERE correo LIKE 'celular.%'",
    );
    const v = `${idioma}${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
    const crear = async (nombre, telefono, conPuerta, limpio) => {
      const r = await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo: `celular.${v}.${randomBytes(3).toString('hex')}@recorrido.test`,
        clave: DATOS.clave,
        rol: 'cliente',
        idioma,
        telefono,
        verificaTelefono: conPuerta,
      });
      // El correo ya confirmado: aquí se mira solo el celular.
      await sql(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now'), fecha_nacimiento = '1990-03-15' WHERE id = '${r.usuario.id}'`,
      );
      // El correo que sale en la foto: limpio y de ejemplo (el de una pasada anterior se aparta).
      if (limpio) {
        await sql(
          `UPDATE usuarios SET correo = id || '@apartado.test', correo_canonico = NULL WHERE correo = '${limpio}'`,
        );
        await sql(`UPDATE usuarios SET correo = '${limpio}' WHERE id = '${r.usuario.id}'`);
      }
      return { token: r.token, id: r.usuario.id };
    };
    const contexto = async (c) => {
      const ctx = await navegador.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        baseURL: URL,
        locale: T.locale,
        timezoneId: idioma === 'en' ? 'America/Detroit' : 'America/Caracas',
      });
      await ctx.addInitScript(
        ([pase, u, i]) => {
          localStorage.setItem('tumbite.idioma', i);
          localStorage.setItem('tumbite.sesion', pase);
          localStorage.setItem(`divoox.permisos.${u}`, '1');
        },
        [c.token, c.id, idioma],
      );
      return ctx;
    };
    const foto = async (p, nombre) => {
      await espera(500);
      await p.screenshot({ path: join(SALIDA, `${nombre}-${idioma}.png`) });
      webp(nombre, idioma);
    };

    // 1. Cuenta nueva con la puerta.
    const nueva = await crear(T.nombre, T.malo, true);
    const antes = mensajes.length;
    const ctx = await contexto(nueva);
    const p = await ctx.newPage();
    await p.goto('/app/account');
    await p.getByTestId('confirma-tu-celular').waitFor({ timeout: 60_000 });
    await p.getByText(T.titulo).first().waitFor();
    for (let i = 0; i < 20 && mensajes.length === antes; i++) await espera(300);
    comprobar(
      mensajes.length === antes + 1,
      'el código sale solo',
      mensajes.at(-1)?.para ?? 'ninguno',
    );
    comprobar(
      /^Divoox: /.test(mensajes.at(-1)?.texto ?? ''),
      'el SMS empieza con «Divoox:»',
      mensajes.at(-1)?.texto.replace(/\d{6}/, '••••••') ?? '',
    );
    // Número equivocado: se cambia ahí mismo.
    await p.getByText(T.cambiar).click();
    await p.getByLabel(T.numero).fill(T.bueno);
    await foto(p, 'cambiar');
    // La espera entre códigos vale también tras cambiar el número: aquí se salta para seguir.
    await sql(
      `UPDATE codigos_telefono SET creado_en = datetime('now','-20 minutes') WHERE usuario_id = '${nueva.id}'`,
    );
    await sql(
      `UPDATE envios_codigo_telefono SET creado_en = datetime(creado_en,'-20 minutes') WHERE usuario_id = '${nueva.id}'`,
    );
    await p.getByText(T.guardar).click();
    await p.getByTestId('codigo-celular').waitFor({ timeout: 30_000 });
    for (let i = 0; i < 20 && mensajes.length === antes + 1; i++) await espera(300);
    const ultimo = mensajes.at(-1);
    comprobar(
      ultimo?.para.endsWith('0142'),
      'el código nuevo va al número corregido',
      ultimo?.para ?? '',
    );
    await p.getByText(/0142/).first().waitFor();
    await foto(p, 'codigo');
    const codigo = /(\d{6})/.exec(ultimo.texto)?.[1];
    await p.getByTestId('codigo-celular').fill(codigo);
    await p.getByTestId('celular-confirmado').waitFor({ timeout: 30_000 });
    await p.getByText(T.listo).waitFor();
    await foto(p, 'listo');
    const fila = await sql(
      `SELECT telefono_verificado_en AS v FROM usuarios WHERE id = '${nueva.id}'`,
    );
    comprobar(
      Boolean((fila.filas ?? fila.results ?? fila)[0]?.v),
      'la cuenta quedó confirmada',
      'sí',
    );
    await ctx.close();

    // 2. Cuenta vieja: solo la franja.
    const vieja = await crear(T.vieja, T.viejo, false, T.correo);
    const ctx2 = await contexto(vieja);
    const p2 = await ctx2.newPage();
    await p2.goto('/app/account');
    await p2.getByTestId('franja-celular').waitFor({ timeout: 60_000 });
    await p2.getByText(T.franja).waitFor();
    await espera(1200);
    await foto(p2, 'franja');
    await ctx2.close();

    // Una cuenta nueva que todavía no confirma, para que la lista del panel muestre los dos estados.
    await crear(T.pendiente[0], T.pendiente[1], true);
    // 3. El bloque del panel, para la ayuda interna.
    // La cuenta del equipo de esta base local (se crea y se hace del equipo con la semilla, si falta).
    const reg = await pedir('POST', '/datos/cuentas/registro', {
      nombre: 'Divoox Soporte',
      correo: DATOS.correoEquipo,
      clave: DATOS.clave,
      rol: 'cliente',
      idioma: 'es',
    }).catch(() => null);
    if (reg)
      await pedir(
        'POST',
        '/datos/cuentas/hacer-admin',
        { semilla: DATOS.semilla },
        reg.token,
      ).catch(() => null);
    const eq = await pedir('POST', '/datos/cuentas/entrar', {
      correo: DATOS.correoEquipo,
      clave: DATOS.clave,
    }).catch(() => null);
    if (eq) {
      const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, eq.token)).ruta;
      const ctx3 = await navegador.newContext({
        baseURL: URL,
        viewport: { width: 1440, height: 900 },
        locale: T.locale,
      });
      await ctx3.addInitScript((i) => {
        localStorage.clear();
        localStorage.setItem('tumbite.idioma', i);
      }, idioma);
      await ctx3.addCookies([
        { name: 'tumbite_sesion', value: eq.token, domain: 'localhost', path: '/', httpOnly: true },
      ]);
      const p3 = await ctx3.newPage();
      await p3.goto(`/panel/${ruta}/verifications/settings`);
      const bloque = p3.getByTestId('verificacion-celular');
      await bloque.waitFor({ timeout: 60_000 });
      await bloque.scrollIntoViewIfNeeded();
      await espera(600);
      const png = join(ORIGINALES_PRIVADAS, `celular-panel-${idioma}.png`);
      await bloque.screenshot({ path: png });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `celular-panel-${idioma}.webp`),
      ]);
      console.log(`  → ayuda interna: celular-panel-${idioma}.webp`);
      await ctx3.close();
    } else console.log('  (sin cuenta del equipo en esta base: la captura del panel se salta)');
  }
  console.log('capturas: todo salió');
} finally {
  await navegador?.close();
  simulador.close();
  try {
    process.kill(-servidor.pid);
  } catch {
    // ya estaba apagado
  }
}
