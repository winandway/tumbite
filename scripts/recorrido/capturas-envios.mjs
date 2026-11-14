// Capturas REALES de Divoox Envíos (de A a B, persona a persona) para Docs (C-DOCS-ENVIOS, 14 nov
// 2026). EE. UU. (Novi, Michigan). Contra el servidor local del recorrido (.recorrido, encendido en el
// puerto 8790), con las apps web reales del cliente y del Driver:
//   1. el equipo abre Envíos en Novi con el paso del panel (tarifa de mercado, no «de prueba»);
//   2. un conductor de prueba con moto aprobada y habilitado para Envíos se conecta en la recogida;
//   3. el cliente cotiza, declara qué envía, su valor y quién lo recibe, y ve su PIN de entrega;
//   4. el Driver ve la oferta, toma la foto del paquete y entrega con el PIN;
//   5. quien recibe sigue el envío en vivo con su enlace.
// Datos neutros («Remitente de prueba», «Destinatario de prueba», «Conductor de prueba»). Al terminar,
// Envíos vuelve a quedar apagado (los demás recorridos esperan verlo así).
// Guarda las originales en docs/capturas/recorrido/envios-*.png.
// Uso: node scripts/recorrido/capturas-envios.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const CIUDAD = {
  id: 'US-MI-NOVI',
  nombre: 'Novi',
  lat: 42.4806,
  lng: -83.4755,
  radioKm: 25,
  zonaHoraria: 'America/Detroit',
};
const ORIGEN = { lat: 42.4725, lng: -83.4757, direccion: '45175 W Ten Mile Rd, Novi, MI 48375' };
const DESTINO = {
  lat: 42.5373,
  lng: -83.4583,
  direccion: '1499 E West Maple Rd, Walled Lake, MI 48390',
};
const FOTO = readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'));
const ID = Date.now().toString(36);

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      // Servidor local: cada llamada desde otra dirección, para no chocar con el límite de intentos.
      'cf-connecting-ip': `10.81.${100 + (Math.floor(++ip / 250) % 100)}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429 && intento < 4) {
    await new Promise((x) => setTimeout(x, 15_000));
    return pedir(metodo, ruta, cuerpo, token, extra, intento + 1);
  }
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
let cuentas = 0;
const cuenta = async (rol, nombre) => {
  const correo = `envios.${rol}.${ID}.${++cuentas}@recorrido.test`;
  const r = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: DATOS.clave,
    rol: rol === 'admin' ? 'cliente' : rol,
  });
  await sql(
    `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
  );
  return { token: r.token, id: r.usuario.id };
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── 1. Envíos encendido en Novi con su tarifa (solo en este servidor local)
const admin = await cuenta('admin', 'Soporte Envíos');
await sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
await sql(
  `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('envios', 1)`,
);
await sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'envios'`);
await pedir(
  'POST',
  '/datos/admin/viajes/ciudades',
  {
    servicio: 'envios',
    zona: CIUDAD,
    tarifa: { base: 300, porKm: 110, porMinuto: 20, minimo: 800, valorMaximo: 50_000 },
    motivo: 'Ciudad de las capturas de Envíos (servidor local)',
  },
  admin.token,
);
await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${CIUDAD.id}' AND activa = 1`);

const limpiarColgados = async () => {
  // Un envío de una vuelta anterior que quedó buscando conductor se llevaría la oferta.
  await sql(
    `UPDATE viajes SET estado = 'sin_conductor', ultimo_actor = 'sistema', ultimo_actor_id = NULL, ultima_clave = 'capturas-limpieza-' || hex(randomblob(6)) WHERE estado = 'buscando' AND operacion_id IN (SELECT id FROM operaciones WHERE zona_id = '${CIUDAD.id}')`,
  );
  await sql(
    `UPDATE operaciones SET estado_general = 'sin_conductor' WHERE zona_id = '${CIUDAD.id}' AND estado_general = 'buscando'`,
  );
  await sql(
    `UPDATE ofertas_operacion SET estado = 'vencida' WHERE estado = 'ofrecida' AND operacion_id IN (SELECT id FROM operaciones WHERE zona_id = '${CIUDAD.id}')`,
  ).catch(() => null);
};
await limpiarColgados();

// ───────── 2. Un conductor con moto aprobada y habilitado para Envíos, conectado en la recogida
// Uno por idioma: al terminar un envío en efectivo, el conductor queda en «cobra y califica».
async function nuevoConductor(sufijo, nombre) {
  const cond = await cuenta('repartidor', nombre);
  const veh = `veh-envios-${ID}-${sufijo}`;
  await sql(
    `UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${CIUDAD.id}'`,
  );
  await sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'envios'`);
  await sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${cond.id}', 1, ${ORIGEN.lat}, ${ORIGEN.lng}, datetime('now'), '${CIUDAD.id}')
    ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
  await sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
    VALUES ('${veh}', '${cond.id}', 'moto', 'Honda', 'PCX', 'Gris', 'MI${ID.slice(-4).toUpperCase()}${sufijo}', 'MI', 2023, 1, 'aprobado')`);
  for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
    await sql(
      `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${ID}-${sufijo}', '${veh}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
    );
  await sql(
    `UPDATE repartidores SET vehiculo_activo_id = '${veh}' WHERE usuario_id = '${cond.id}'`,
  );
  await sql(
    `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${cond.id}', 'envios', 'aprobada', '${admin.id}', datetime('now'))`,
  );
  await sql(
    `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${cond.id}', 'envios', 1)`,
  );
  return cond;
}
const conductores = [];

const navegador = await chromium.launch();
const telefono = async (token, id, idioma) => {
  const ctx = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    timezoneId: 'America/Detroit',
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      if (pase) localStorage.setItem('tumbite.sesion', pase);
      if (u) localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [token, id, idioma],
  );
  return ctx;
};
const foto = (p, nombre, idioma) =>
  p.screenshot({ path: join(SALIDA, `envios-${nombre}-${idioma}.png`) });
const caja = (l) =>
  l.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { y: r.top + globalThis.scrollY, fin: r.bottom + globalThis.scrollY };
  });

try {
  for (const idioma of ['es', 'en']) {
    const en = idioma === 'en';
    const cond = await nuevoConductor(en ? 'B' : 'A', en ? 'Test Driver' : 'Conductor de prueba');
    conductores.push(cond.id);
    const cli = await cuenta('cliente', en ? 'Test Sender' : 'Remitente de prueba');
    const remitente = (m, r, c) => pedir(m, r, c, cli.token);

    // ───────── Cliente: cotizar, qué envía y quién lo recibe
    const ctxC = await telefono(cli.token, cli.id, idioma);
    await ctxC.addInitScript(
      ([u, b]) => localStorage.setItem(`tumbite.borrador.envios.${u}`, b),
      [
        cli.id,
        JSON.stringify({
          recogida: ORIGEN.direccion,
          recogidaLat: String(ORIGEN.lat),
          recogidaLng: String(ORIGEN.lng),
          destino: DESTINO.direccion,
          destinoLat: String(DESTINO.lat),
          destinoLng: String(DESTINO.lng),
          metodo: 'efectivo',
          categoria: 'estandar',
          paqueteDescripcion: en ? 'House keys' : 'Llaves de la casa',
          paqueteValor: '40',
          destinatarioNombre: en ? 'Test recipient' : 'Destinatario de prueba',
          destinatarioTelefono: '(248) 555-0134',
          sinProhibidos: true,
        }),
      ],
    );
    const c = await ctxC.newPage();
    await c.goto('/app/ride?servicio=envios');
    // Sin llave de mapas en local no hay buscador: la recogida y el destino van como los guarda la
    // app (su borrador) y se recorta el aviso «Recuperamos lo que estabas escribiendo».
    await c
      .getByRole('button', { name: en ? 'See price' : 'Ver precio' })
      .click({ timeout: 60_000 });
    await c.getByTestId('moto-precio').waitFor({ timeout: 30_000 });
    await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
    await espera(700);
    const arriba = await caja(c.getByText(en ? 'Pickup point' : 'Punto de recogida').first());
    const precio = await caja(c.getByTestId('moto-precio'));
    await c.screenshot({
      path: join(SALIDA, `envios-cliente-precio-${idioma}.png`),
      fullPage: true,
      clip: {
        x: 0,
        y: arriba.y - 16,
        width: c.viewportSize().width,
        height: precio.fin + 24 - (arriba.y - 16),
      },
    });
    await c
      .getByText(en ? 'What are you sending?' : '¿Qué envías?', { exact: true })
      .first()
      .evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await c.evaluate(() => globalThis.scrollBy(0, -24));
    await espera(600);
    await foto(c, 'cliente-paquete', idioma);
    await c
      .getByText(en ? 'Send' : 'Enviar', { exact: true })
      .last()
      .click();
    await c.getByTestId('envio-pin').waitFor({ timeout: 60_000 });
    const pin = (await c.getByTestId('envio-pin').textContent())?.trim() ?? '';
    await espera(800);
    await foto(c, 'cliente-pin', idioma);
    const viaje = (await remitente('GET', '/datos/viajes/actual?servicio=envios')).viaje;
    if (!viaje) throw new Error('el cliente no quedó con un envío');
    const op = viaje.id;

    // ───────── Driver: la oferta, la foto del paquete y la entrega con el PIN
    let n = 0;
    const paso = (nombre, cuerpo = {}) =>
      pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, cond.token, {
        'idempotency-key': `capturas-envios-${nombre}-${++n}-${ID}-${idioma}`,
      });
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${cond.id}'`,
    );
    const ctxD = await telefono(cond.token, cond.id, idioma);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
    const oferta = await d
      .getByTestId('oferta-viaje')
      .waitFor({ timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (oferta) {
      await espera(800);
      // La tarjeta de la oferta desde lo que gana hacia abajo: su título todavía dice «viaje en
      // Moto» también para un envío (anotado como fallo de producto), y aquí no se muestra.
      const o = await caja(d.getByTestId('oferta-viaje'));
      await d.screenshot({
        path: join(SALIDA, `envios-driver-oferta-${idioma}.png`),
        fullPage: true,
        clip: { x: 0, y: o.y + 56, width: d.viewportSize().width, height: o.fin - o.y - 56 },
      });
    } else console.error(`(${idioma}) el Driver no mostró la oferta del envío`);
    await paso('aceptar');
    await paso('llegue');
    await d.reload();
    await d
      .getByText(en ? /photo of the package/i : 'Tomar la foto del paquete')
      .first()
      .waitFor({ timeout: 45_000 });
    await espera(800);
    await foto(d, 'driver-foto', idioma);
    const rf = await fetch(`${URL}/datos/conductor/operaciones/${op}/foto-paquete`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cond.token}`,
        'content-type': 'image/jpeg',
        'cf-connecting-ip': `10.81.99.${++ip % 250}`,
      },
      body: FOTO,
    });
    if (rf.status !== 201) throw new Error(`foto del paquete: ${rf.status} ${await rf.text()}`);
    await paso('iniciar');
    await sql(
      `UPDATE repartidores SET lat = 42.505, lng = -83.468, ubicacion_en = datetime('now') WHERE usuario_id = '${cond.id}'`,
    );

    // ───────── Quien recibe: el enlace para seguir el envío en vivo (el mismo que le llega por mensaje)
    const enlace = (await remitente('POST', `/datos/viajes/${op}/compartir`)).url;
    const ctxR = await telefono(null, null, idioma);
    const r = await ctxR.newPage();
    await r.goto(new globalThis.URL(enlace).pathname);
    await r.waitForLoadState('networkidle').catch(() => null);
    await espera(2_500);
    // Solo la página del envío, sin el pie del sitio (que lista ciudades).
    const pie = await r
      .locator('footer')
      .first()
      .evaluate((n) => n.getBoundingClientRect().top + globalThis.scrollY)
      .catch(() => 760);
    await r.screenshot({
      path: join(SALIDA, `envios-destinatario-seguir-${idioma}.png`),
      fullPage: true,
      clip: { x: 0, y: 0, width: r.viewportSize().width, height: Math.min(pie, 900) },
    });
    await ctxR.close();

    // ───────── Cliente: el envío en camino, con el PIN
    await c.reload();
    await c.getByTestId('envio-pin').waitFor({ timeout: 60_000 });
    await espera(1_500);
    await foto(c, 'cliente-en-camino', idioma);

    // ───────── Driver: entrega con el PIN
    await d.reload();
    const campo = d.getByTestId('envio-pin-entrega');
    await campo.waitFor({ timeout: 45_000 });
    await campo.fill(pin);
    await campo.evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(600);
    await foto(d, 'driver-pin', idioma);
    await d
      .getByText(en ? /Deliver the package/i : 'Entregar el paquete')
      .first()
      .click();
    for (let i = 0; i < 30; i++) {
      const f = await sql(
        `SELECT entregado_en IS NOT NULL AS ok FROM envios_persona WHERE operacion_id = '${op}'`,
      );
      if (f.results?.[0]?.ok === 1) break;
      await espera(1_000);
    }
    await espera(1_500);
    await foto(d, 'driver-entregado', idioma);
    await ctxD.close();
    await ctxC.close();
  }
} finally {
  await limpiarColgados().catch(() => null);
  // Envíos vuelve a quedar apagado y el conductor de prueba, desconectado.
  for (const c of conductores)
    await sql(`UPDATE repartidores SET conectado = 0 WHERE usuario_id = '${c}'`).catch(() => null);
  await sql(`UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id = 'envios'`);
  await sql(`UPDATE servicios SET estado = 'proximamente' WHERE id = 'envios'`);
  await navegador.close();
}
console.log('capturas de Envíos listas en docs/capturas/recorrido/envios-*.png');
