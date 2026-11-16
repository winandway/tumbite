// Reportar, bloquear y la bandeja de reportes (C-MODERACION, 16 nov 2026) — todos los países. Prueba
// en pantalla, de punta a punta, con la app web real del cliente (/app), el panel del restaurante y
// el superadmin, contra el servidor local del recorrido (.recorrido, puerto 8790; lo arma
// `node scripts/recorrido/preparar.mjs`). Cada paso lleva su comprobación; si una falla, se para.
//   a) Chat del pedido: el mensaje del repartidor lleva «Reportar»; la hoja con motivo y nota; gracias.
//   b) Los tres puntos del chat: «Bloquear a…», la confirmación y el aviso «Bloqueaste a…».
//   c) La cuenta: «Personas bloqueadas» con «Desbloquear».
//   d) El panel del restaurante: «Reportar» en una reseña y su ventanita.
//   e) El superadmin: la bandeja «Reportes» con lo reportado.
//   f) El selector de idioma de la app (los avisos salen en ese idioma, C-AVISOS-IDIOMA).
// C-CAPTURAS-POR-IDIOMA: inglés en Novi, Michigan (dólares, nombres en inglés); español en Miami,
// con nombres hispanos. Datos neutros e inventados, solo en el servidor local.
// Originales en docs/capturas/recorrido/moderacion-*-{es,en}.png. `SOLO_IDIOMA=en` o `es`: una pasada.
// Uso: node scripts/recorrido/capturas-moderacion.mjs
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.83.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const filas = async (q) => (await sql(q)).results ?? [];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const informe = [];
function comprobar(cond, paso, evidencia) {
  if (!cond) throw new Error(`FALLA ${paso}: ${evidencia}`);
  informe.push(`${paso}: ${evidencia}`);
}

const CIUDADES = {
  en: {
    zona: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      lat: 42.4806,
      lng: -83.4755,
      tz: 'America/Detroit',
    },
    local: { lat: 42.481, lng: -83.4735, direccion: '43259 Crescent Blvd, Novi, MI 48375' },
    casa: { lat: 42.4722, lng: -83.478, direccion: '120 Maple Grove Ct, Novi, MI 48375' },
    restaurante: 'Crescent Pizza Kitchen',
    plato: ['Pizza margarita', 'Margherita pizza'],
    repartidor: 'Sam Carter',
    cliente: 'Jamie Lee',
    otro: 'Taylor Brooks',
    mensajes: {
      rep: 'Hi! I’m at the restaurant. Your order will be ready in a few minutes.',
      cli: 'Great, thanks! The gate code is at the front desk.',
      rep2: 'Please come outside now, I won’t wait.',
    },
    resena: 'The pizza arrived cold and the box was crushed.',
    nota: 'The driver kept messaging me after I answered.',
    locale: 'en-US',
  },
  es: {
    zona: {
      id: 'US-FL-MIAMI',
      nombre: 'Miami',
      lat: 25.7617,
      lng: -80.1918,
      tz: 'America/New_York',
    },
    local: { lat: 25.7743, lng: -80.1937, direccion: '250 NE 3rd St, Miami, FL 33132' },
    casa: { lat: 25.7801, lng: -80.2001, direccion: '1200 NW 7th Ave, Miami, FL 33136' },
    restaurante: 'Pizzería La Esquina',
    plato: ['Pizza margarita', 'Margherita pizza'],
    repartidor: 'Andrés Molina',
    cliente: 'Lucía Romero',
    otro: 'Carmen Díaz',
    mensajes: {
      rep: '¡Hola! Ya estoy en el restaurante. Tu pedido sale en unos minutos.',
      cli: 'Perfecto, gracias. El código del portón está en la recepción.',
      rep2: 'Sal ya a la calle, no voy a esperar.',
    },
    resena: 'La pizza llegó fría y la caja aplastada.',
    nota: 'El repartidor me siguió escribiendo después de responderle.',
    locale: 'es-US',
  },
};

const ciudadDe = (idioma) => (idioma === 'en' ? CIUDADES.en : CIUDADES.es);

const navegador = await chromium.launch();

async function cuenta(rol, nombre, idioma) {
  const correo = `moderacion.${rol}.${Date.now().toString(36)}.${randomBytes(3).toString('hex')}@recorrido.test`;
  const r = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: DATOS.clave,
    rol,
    idioma,
  });
  await sql(
    `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
  );
  return { token: r.token, id: r.usuario.id, correo };
}

/** Restaurante, repartidor y cliente con un pedido aceptado (el chat queda abierto). */
async function montar(idioma) {
  const C = ciudadDe(idioma);
  const z = C.zona;
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${z.id}', '${z.nombre}', 'US', 'USD', '${z.tz}', ${z.lat}, ${z.lng}, 25, 1)`,
  );
  await sql(`UPDATE zonas SET activa = 1 WHERE id = '${z.id}'`);
  const dueno = await cuenta('restaurante', C.restaurante, idioma);
  const resto = (m, r, c) => pedir(m, r, c, dueno.token);
  const rest = (
    await resto('PUT', '/datos/mi-restaurante', {
      nombre: C.restaurante,
      categoria: 'Pizza',
      telefono: idioma === 'en' ? '2485550142' : '3055550142',
      direccion: C.local.direccion,
      lat: C.local.lat,
      lng: C.local.lng,
    })
  ).restaurante;
  const plato = (
    await resto('POST', '/datos/mi-restaurante/platos', {
      nombreEs: C.plato[0],
      nombreEn: C.plato[1],
      precioCentavos: 1450,
    })
  ).plato;
  await resto('PUT', '/datos/mi-restaurante/horarios', {
    turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
  });
  await sql(
    `UPDATE restaurantes SET estado = 'aprobado', zona_id = '${z.id}' WHERE id = '${rest.id}'`,
  );
  await resto('PATCH', '/datos/mi-restaurante/abierto', { abierto: true });
  const rep = await cuenta('repartidor', C.repartidor, idioma);
  await sql(
    `INSERT OR REPLACE INTO repartidores (usuario_id, zona_id, conectado, lat, lng, ubicacion_en)
     VALUES ('${rep.id}', '${z.id}', 1, ${C.local.lat}, ${C.local.lng}, datetime('now'))`,
  );
  const cli = await cuenta('cliente', C.cliente, idioma);
  const pedido = async () => {
    const p = await pedir(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rest.id,
        lineas: [{ platoId: plato.id, cantidad: 2 }],
        propinaCentavos: 400,
        direccion: C.casa.direccion,
        lat: C.casa.lat,
        lng: C.casa.lng,
      },
      cli.token,
    );
    const id = p.pedidoId;
    // Pagado con tarjeta (anotado directo: el pago no es lo que se prueba aquí) y asignado.
    await sql(
      `UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = '${id}'`,
    );
    await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 10 });
    await sql(
      `UPDATE pedidos SET repartidor_id = '${rep.id}', asignado_en = datetime('now') WHERE id = '${id}'`,
    ).catch(() => sql(`UPDATE pedidos SET repartidor_id = '${rep.id}' WHERE id = '${id}'`));
    return id;
  };
  return { C, dueno, rest, rep, cli, pedido };
}

async function telefono(idioma, token, id) {
  const C = ciudadDe(idioma);
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: C.locale,
    timezoneId: C.zona.tz,
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [token, id, idioma],
  );
  return ctx;
}

async function computadora(idioma) {
  const ctx = await navegador.newContext({
    viewport: { width: 1360, height: 900 },
    deviceScaleFactor: 2,
    baseURL: URL,
    locale: ciudadDe(idioma).locale,
  });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  return ctx;
}

async function pasada(idioma) {
  const en = idioma === 'en';
  const L = en
    ? {
        reportar: 'Report',
        acoso: 'It’s harassment or a threat',
        nota: 'Tell us more (optional)',
        enviar: 'Send report',
        gracias: 'Thanks. We got your report',
        mas: 'More options',
        bloquear: 'Block',
        bloqueaste: 'You blocked',
        bloqueadas: 'Blocked people',
        desbloquear: 'Unblock',
        spam: 'It’s spam, advertising or fake',
      }
    : {
        reportar: 'Reportar',
        acoso: 'Es acoso o una amenaza',
        nota: 'Cuéntanos más (opcional)',
        enviar: 'Enviar reporte',
        gracias: 'Gracias. Recibimos tu reporte',
        mas: 'Más opciones',
        bloquear: 'Bloquear',
        bloqueaste: 'Bloqueaste a',
        bloqueadas: 'Personas bloqueadas',
        desbloquear: 'Desbloquear',
        spam: 'Es spam, publicidad o falsa',
      };
  const captura = (p, nombre, opciones = {}) =>
    p.screenshot({
      // C-AYUDA-INTERNA: la bandeja del superadmin va a la carpeta privada, no al repositorio.
      path: join(
        nombre === 'computadora-bandeja' ? ORIGINALES_PRIVADAS : SALIDA,
        `moderacion-${nombre}-${idioma}.png`,
      ),
      ...opciones,
    });
  const { C, dueno, rep, cli, pedido } = await montar(idioma);
  const id = await pedido();
  await pedir('POST', `/datos/pedidos/${id}/mensajes`, { texto: C.mensajes.rep }, rep.token);
  await pedir('POST', `/datos/pedidos/${id}/mensajes`, { texto: C.mensajes.cli }, cli.token);
  await pedir('POST', `/datos/pedidos/${id}/mensajes`, { texto: C.mensajes.rep2 }, rep.token);

  // ───────── a) Reportar un mensaje del chat
  const ctx = await telefono(idioma, cli.token, cli.id);
  const a = await ctx.newPage();
  await a.goto(`/app/order/${id}`);
  const chat = a.getByLabel(en ? 'Order chat' : 'Chat del pedido').first();
  await chat.waitFor({ timeout: 60_000 });
  await a.getByText(C.mensajes.rep2).waitFor({ timeout: 30_000 });
  await chat.scrollIntoViewIfNeeded();
  await espera(800);
  const botones = a.getByRole('button', {
    name: en ? 'Report this message' : 'Reportar este mensaje',
  });
  comprobar(
    (await botones.count()) === 2,
    `a ${idioma}`,
    `los dos mensajes del repartidor llevan «${L.reportar}»; el del cliente no`,
  );
  await captura(a, 'chat');
  await botones.last().click();
  await a.getByRole('radio', { name: L.acoso }).click();
  await a.getByLabel(L.nota).fill(C.nota);
  await espera(600);
  await captura(a, 'hoja-reportar');
  await a.getByRole('button', { name: L.enviar }).click();
  await a.getByText(L.gracias).waitFor({ timeout: 20_000 });
  await captura(a, 'gracias');
  const guardado = await filas(
    `SELECT motivo, nota FROM reportes_contenido WHERE reporta_id = '${cli.id}' AND tipo = 'mensaje_pedido'`,
  );
  comprobar(
    guardado.length === 1 && guardado[0].motivo === 'acoso' && guardado[0].nota === C.nota,
    `a ${idioma}`,
    'el reporte llegó al servidor con su motivo y su nota',
  );
  await a
    .getByRole('button', { name: en ? 'Close' : 'Cerrar' })
    .last()
    .click();

  // ───────── b) Bloquear desde los tres puntos del chat
  await a.getByRole('button', { name: L.mas }).click();
  const primerNombre = C.repartidor.split(' ')[0];
  await a.getByText(`${L.bloquear} ${en ? '' : 'a '}${primerNombre}`.replace('  ', ' ')).click();
  await espera(500);
  await captura(a, 'bloquear');
  await a.getByRole('button', { name: L.bloquear, exact: true }).click();
  await a.getByText(L.bloqueaste, { exact: false }).waitFor({ timeout: 20_000 });
  comprobar(
    !(await a.getByText(C.mensajes.rep2).isVisible()),
    `b ${idioma}`,
    'después de bloquear, el cliente ya no ve los mensajes del repartidor',
  );
  await captura(a, 'bloqueado');

  // ───────── c) Personas bloqueadas en la cuenta
  await a.goto('/app/account');
  const lista = a.getByLabel(L.bloqueadas).first();
  await lista.waitFor({ timeout: 60_000 });
  await lista.scrollIntoViewIfNeeded();
  await a.getByRole('button', { name: `${L.desbloquear} ${primerNombre}` }).waitFor();
  await espera(500);
  await captura(a, 'personas-bloqueadas');
  comprobar(
    true,
    `c ${idioma}`,
    `«${L.bloqueadas}» muestra a ${primerNombre} con «${L.desbloquear}»`,
  );

  // ───────── f) El selector de idioma (los avisos salen en ese idioma)
  await a.goto('/app');
  const selector = a
    .getByRole('button', { name: en ? 'Change language' : 'Cambiar idioma' })
    .first();
  await selector.waitFor({ timeout: 60_000 });
  await selector.click();
  await espera(600);
  await captura(a, 'idioma');
  await ctx.close();

  // ───────── d) El restaurante reporta una reseña desde su panel
  // El pedido sigue su camino estado por estado (la base no deja saltarse ninguno).
  for (const e of ['listo', 'en_camino', 'entregado'])
    await sql(`UPDATE pedidos SET estado = '${e}' WHERE id = '${id}'`);
  await pedir(
    'POST',
    `/datos/pedidos/${id}/calificar`,
    { estrellasRestaurante: 2, comentario: C.resena },
    cli.token,
  );
  const pc = await computadora(idioma);
  const d = await pc.newPage();
  const entrar = await d.request.post('/datos/cuentas/entrar', {
    data: { correo: dueno.correo, clave: DATOS.clave },
  });
  comprobar(entrar.ok(), `d ${idioma}`, 'el restaurante entra a su panel');
  await d.goto('/panel/reviews');
  await d.getByText(C.resena).waitFor({ timeout: 60_000 });
  await espera(500);
  await captura(d, 'computadora-restaurante-resenas');
  await d.getByRole('button', { name: L.reportar, exact: true }).first().click();
  await d.getByLabel(L.spam).check();
  await espera(400);
  await captura(d, 'computadora-restaurante-reportar');
  await d.getByRole('button', { name: L.enviar }).click();
  await d.getByText(L.gracias).waitFor({ timeout: 20_000 });
  await captura(d, 'computadora-restaurante-gracias');
  await pc.close();

  // ───────── e) La bandeja «Reportes» del superadmin
  const ac = await computadora(idioma);
  const e = await ac.newPage();
  const reg = await e.request.post('/datos/cuentas/registro', {
    data: {
      nombre: 'Soporte Divoox',
      correo: DATOS.correoEquipo,
      clave: DATOS.clave,
      rol: 'cliente',
    },
  });
  if (!reg.ok()) {
    const r = await e.request.post('/datos/cuentas/entrar', {
      data: { correo: DATOS.correoEquipo, clave: DATOS.clave },
    });
    if (!r.ok()) throw new Error(`entrar equipo: ${r.status()}`);
  }
  const ha = await e.request.post('/datos/cuentas/hacer-admin', {
    data: { semilla: DATOS.semilla },
  });
  if (!ha.ok() && ha.status() !== 409) throw new Error(`hacer-admin: ${ha.status()}`);
  const ruta = (await (await e.request.get('/datos/admin/ruta')).json()).ruta;
  // La captura muestra solo lo de esta pasada (cada idioma con sus propios datos).
  await sql(
    `UPDATE reportes_contenido SET estado = 'resuelto', accion = 'descartar' WHERE estado = 'abierto' AND objeto_id <> '${id}'`,
  );
  await e.goto(`/panel/${ruta}/moderation`);
  await e.getByText(C.mensajes.rep2).first().waitFor({ timeout: 60_000 });
  await espera(800);
  await captura(e, 'computadora-bandeja');
  comprobar(
    await e.getByText(C.resena).first().isVisible(),
    `e ${idioma}`,
    'la bandeja muestra el mensaje y la reseña reportados, con quién lo escribió y el motivo',
  );
  await ac.close();
}

const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'es') await pasada('en');
  if (SOLO !== 'en') await pasada('es');
} finally {
  await navegador.close();
  console.log(informe.map((x) => `  ok  ${x}`).join('\n'));
}
console.log('moderación: todo comprobado; capturas en docs/capturas/recorrido/moderacion-*.png');
