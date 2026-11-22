// Capturas REALES de Comida en Venezuela para Docs (C-DOCS-COMIDA-VE, 14 nov 2026). Venezuela (El
// Vigía, estado Mérida, zona VE-MER-ELVIGIA). Contra el servidor local del recorrido (.recorrido en el
// puerto 8790), con las apps web reales del cliente y del Driver:
//   1. corre probar-comida-venezuela.mjs (restaurante aprobado con su menú y repartidor con saldo);
//   2. el cliente ve los precios con su equivalente en bolívares y elige pagar al recibir;
//   3. con el conductor asegurado, el cliente le paga la comida al restaurante por pago móvil con su
//      número de referencia; el restaurante confirma «Me llegó» y el conductor cobra solo el envío
//      (C-COMIDA-PAGO-RESTAURANTE, 22 nov 2026);
//   4. el saldo para comisiones del repartidor con «te alcanza para unos N pedidos» y la recarga por código.
// Datos neutros («Arepera de pruebas»). Originales en docs/capturas/recorrido/comida-ve-*-es.png.
// C-CAPTURAS-POR-IDIOMA (15 nov 2026, EE. UU. y Venezuela): cada idioma con SUS ejemplos. El español se
// toma en El Vigía (pagar al recibir, pago móvil, bolívares, saldo para comisiones). El inglés se toma
// en Novi, Michigan (`US-MI-NOVI`), como funciona Comida en Estados Unidos: se paga con tarjeta en la
// app, en dólares; en la puerta no se cobra nada y, si el cliente no aparece, el repartidor espera y
// cierra el pedido con una foto. Originales en docs/capturas/recorrido/comida-us-*-en.png.
// `SOLO_IDIOMA=en` o `es` corre una sola pasada.
// Uso: node scripts/recorrido/capturas-comida-venezuela.mjs
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { ciudadNeutra, mapaSinRotulos } from './neutro.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const LOCAL_REST = { lat: 8.6225, lng: -71.651 };
const CASA = { lat: 8.6229, lng: -71.6512 };
const FOTO = readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.79.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const foto = async (ruta, token, donde) => {
  const r = await fetch(`${URL}${ruta}?lat=${donde.lat}&lng=${donde.lng}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: FOTO,
  });
  if (!r.ok) throw new Error(`foto ${ruta}: ${r.status} ${await r.text()}`);
};

// C-DOCS-SIN-DATOS-REALES: el mapa sin rótulos y la ciudad con nombre de ejemplo.
const navegador = mapaSinRotulos(await chromium.launch());
let restaurarCiudad = async () => {};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Venezuela (El Vigía): pagar al recibir, pago móvil, el saldo para comisiones y el cliente que no aparece. */
async function correrVe(idiomas) {
  // C-PLAZO-PAPELES: en una base recién creada los conductores de prueba nacen dentro del plazo de
  // papeles, y para conectarse necesitan la foto de su cara. Se les deja su identidad aprobada antes
  // de correr el guion (en el sitio de pruebas esas cuentas ya la tienen).
  const previo = await pedir('POST', '/datos/interno/pruebas/comida-ve/armar', {}, undefined, {
    'x-reloj-secreto': SECRETO,
  });
  for (const quien of [previo.ids.repartidor, previo.ids.sinSaldo])
    await sql(
      `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por)
       VALUES ('${quien}', 'aprobado', 'identificacion', 'zz', 'zz', datetime('now'), datetime('now'), '${previo.ids.equipo}')
       ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', selfie = 'zz', revisado_en = datetime('now')`,
    );
  execFileSync('node', ['scripts/staging/probar-comida-venezuela.mjs'], {
    cwd: RAIZ,
    env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const armado = await pedir('POST', '/datos/interno/pruebas/comida-ve/armar', {}, undefined, {
    'x-reloj-secreto': SECRETO,
  });
  const { tokens, ids } = armado;
  for (const t of Object.values(tokens))
    await sql(
      `UPDATE sesiones SET expira_en = datetime('now', '+90 minutes') WHERE id = '${createHash('sha256').update(t).digest('hex')}'`,
    );
  // El aviso del permiso de la asistente ya quedó respondido: no es parte de lo que se enseña aquí.
  await pedir(
    'POST',
    '/datos/conductor/aviso-ia',
    { acepto: true, plataforma: 'web', desde: 'aviso' },
    tokens.repartidor,
  );
  // En las fotos: «conductor» y un banco de ejemplo (solo en este servidor local).
  await sql(`UPDATE usuarios SET nombre = 'Conductor de prueba' WHERE id = '${ids.repartidor}'`);
  await sql(
    `UPDATE cuentas_cobro SET banco = 'Banco de ejemplo', titular = 'Conductor de prueba' WHERE usuario_id = '${ids.repartidor}'`,
  );
  const cliente = (m, r, c) => pedir(m, r, c, tokens.cliente);
  const resto = (m, r, c) => pedir(m, r, c, tokens.restaurante);
  const yo = (m, r, c) => pedir(m, r, c, tokens.repartidor);
  const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
  // Lo que haya quedado abierto de una vuelta anterior se cierra por la API, como el guion de pruebas.
  for (const v of ((await cliente('GET', '/datos/mis-pedidos')).pedidos ?? []).filter(
    (x) => !['entregado', 'cancelado'].includes(x.estado),
  ))
    await equipo('POST', `/datos/admin/pedidos/${v.id}/cancelar`, {
      motivo: 'Cierre de una vuelta de capturas anterior',
    });
  // El repartidor recarga su saldo con un código del punto de venta del equipo (como en el guion de
  // pruebas) para que le alcancen todos los pedidos de las capturas.
  async function recargar() {
    // Solo si le queda poco: con diez dólares alcanzan todos los pedidos de las capturas.
    if ((await yo('GET', '/datos/repartidor/saldo-prepago')).disponible >= 1_000) return;
    const puntos = (await equipo('GET', '/datos/admin/puntos-venta')).puntos ?? [];
    let punto = puntos.find(
      (x) => x.usuarioId === ids.equipo && x.pais === 'VE' && x.moneda === 'USD',
    );
    if (!punto)
      punto = (
        await equipo('POST', '/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Venezuela (pruebas)',
          pais: 'VE',
          moneda: 'USD',
          usuarioId: ids.equipo,
        })
      ).punto;
    // Cada recarga lleva antes su fondo en el punto (lo mismo que hace el equipo en el panel).
    await equipo('POST', `/datos/admin/puntos-venta/${punto.id}/fondo`, {
      monto: 5_000,
      comprobante: `capturas-${Date.now().toString(36)}`,
    });
    const { codigo } = await equipo('POST', '/datos/punto-venta/codigos', { monto: 1_000 });
    await yo('POST', '/datos/repartidor/recargar', { codigo });
  }
  const mio = await resto('GET', '/datos/mi-restaurante');
  const rest = mio.restaurante;
  const plato = (mio.platos ?? []).find((p) => p.nombreEs === 'Arepa reina pepiada');
  if (!rest || !plato) throw new Error('no está el restaurante de El Vigía con su plato');
  // C-DOCS-SIN-DATOS-REALES: la ciudad y la dirección del local, con datos de ejemplo en las fotos.
  restaurarCiudad = await ciudadNeutra(sql, 'VE-MER-ELVIGIA', idiomas[0]);
  await sql(`UPDATE restaurantes SET direccion = 'Calle Principal 123' WHERE id = '${rest.id}'`);
  const ubicar = async (donde) => {
    for (let i = 0; i < 2; i++)
      await yo('POST', '/datos/repartidor/ubicacion', { ...donde, precision: 8 });
  };

  const telefono = async (token, id, idioma, extra) => {
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
      geolocation: { latitude: CASA.lat, longitude: CASA.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i, carrito]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
        if (carrito) localStorage.setItem(`tumbite.carrito.${u}`, carrito);
      },
      [token, id, idioma, extra ?? null],
    );
    return ctx;
  };
  const captura = (p, nombre, idioma) =>
    p.screenshot({ path: join(SALIDA, `comida-ve-${nombre}-v3-${idioma}.png`) });
  const arriba = (l, extra = 0) =>
    l.evaluate((x, e) => {
      x.scrollIntoView({ block: 'start' });
      globalThis.scrollBy(0, -e);
    }, extra);

  const carrito = JSON.stringify({
    restauranteId: rest.id,
    restauranteNombre: rest.nombre,
    plan: rest.plan ?? 'inicial',
    restLat: LOCAL_REST.lat,
    restLng: LOCAL_REST.lng,
    moneda: 'USD',
    lineas: [
      {
        clave: `${plato.id}:`,
        platoId: plato.id,
        nombreEs: plato.nombreEs,
        nombreEn: plato.nombreEn,
        precioCentavos: plato.precioCentavos,
        cantidad: 2,
      },
    ],
  });

  // C-COMIDA-PAGO-RESTAURANTE: el pedido llega hasta que el conductor queda asegurado; ahí el pago
  // de la comida espera al cliente («por pagar»), con el monto en bolívares congelado.
  const hastaElPago = async (quien, metodoPago, cantidad, propinaCentavos) => {
    await recargar();
    await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL_REST });
    await ubicar(LOCAL_REST);
    const p = await quien('POST', '/datos/pedidos', {
      restauranteId: rest.id,
      lineas: [{ platoId: plato.id, cantidad }],
      propinaCentavos,
      direccion: 'Avenida Principal 12, casa 4',
      ...CASA,
      metodoPago,
    });
    const id = p.pedidoId;
    await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 });
    await ubicar(LOCAL_REST);
    // La oferta llega al pedir la lista (como la app): se espera a que sea suya y se acepta.
    for (let i = 0; ; i++) {
      const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
      if (ofertas.some((o) => o.id === id)) break;
      if (i > 20) throw new Error(`la oferta ${id} no le llegó al conductor`);
      await espera(3_000);
    }
    await yo('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {});
    return id;
  };
  // Con el «Me llegó» del restaurante: listo, recogida con su foto y el conductor en la puerta.
  const delLocalALaPuerta = async (id) => {
    await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {});
    await ubicar(LOCAL_REST);
    await foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, tokens.repartidor, LOCAL_REST);
    await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {});
    await ubicar(CASA);
  };
  // El aviso de las notificaciones del navegador no es parte de lo que se enseña.
  const sinAvisos = async (p, en) => {
    const ahoraNo = p.getByText(en ? 'Not now' : 'Ahora no', { exact: true });
    if (await ahoraNo.count()) await ahoraNo.first().click();
  };
  const tarjeta = async (p, testId, extra = 80) => {
    await p.getByTestId(testId).first().waitFor({ timeout: 60_000 });
    await arriba(p.getByTestId(testId).first(), extra);
    await espera(800);
  };

  for (const idioma of idiomas) {
    const en = idioma === 'en';
    // ───────── Cliente: el restaurante con sus precios y el carrito: la comida se paga al restaurante
    const ctxC = await telefono(tokens.cliente, ids.cliente, idioma, carrito);
    const c = await ctxC.newPage();
    await c.goto(`/app/restaurant/${rest.id}`);
    await c
      .getByText(en ? 'Reina pepiada arepa' : 'Arepa reina pepiada')
      .first()
      .waitFor({
        timeout: 60_000,
      });
    await espera(1_500);
    await captura(c, 'restaurante', idioma);
    await c.goto('/app/cart');
    await c.getByTestId('carrito-total-bs').waitFor({ timeout: 60_000 });
    await tarjeta(c, 'carrito-pago-restaurante', 60);
    await captura(c, 'carrito-pago', idioma);
    await c.getByTestId('carrito-total-bs').evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(600);
    await captura(c, 'carrito-total', idioma);

    // ───────── El pedido, con el conductor ya asegurado: el cliente le paga la comida al restaurante
    const id = await hastaElPago(cliente, 'transferencia_repartidor', 2, 50);
    await c.goto(`/app/order/${id}`);
    await c.getByTestId('pago-comida-monto').waitFor({ timeout: 60_000 });
    await tarjeta(c, 'pago-comida', 70);
    await captura(c, 'pago-comida-datos', idioma);

    // Driver: mientras el restaurante no confirme, el conductor espera sin adelantar nada.
    const ctxD = await telefono(tokens.repartidor, ids.repartidor, idioma);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
    await tarjeta(d, 'pago-comida-espera');
    await captura(d, 'driver-espera-pago', idioma);

    // Cliente: escribe el número de referencia de su pago móvil y lo envía.
    // Una referencia no se puede usar dos veces: cada vuelta escribe la suya.
    await c.getByTestId('pago-comida-referencia').fill(`0012${String(Date.now()).slice(-4)}`);
    await c.getByTestId('pago-comida-referencia').evaluate((x) => {
      x.blur();
      x.scrollIntoView({ block: 'center' });
    });
    await espera(800);
    await captura(c, 'pago-comida-referencia', idioma);
    await c.getByTestId('pago-comida-enviar').click();
    await c.getByTestId('pago-comida-reportado').waitFor({ timeout: 30_000 });

    // ───────── Restaurante: mira su banco y confirma «Me llegó»
    const ctxR = await telefono(tokens.restaurante, ids.restaurante, idioma);
    const r = await ctxR.newPage();
    await r.goto('/restaurant/');
    await r.getByTestId('cuenta-cobro-restaurante').waitFor({ timeout: 60_000 });
    await sinAvisos(r, en);
    // Su cuenta de pago móvil y su saldo, en el inicio de la app.
    await tarjeta(r, 'cuenta-cobro-restaurante', 20);
    await captura(r, 'rest-cuenta-cobro', idioma);
    await tarjeta(r, 'saldo-restaurante', 20);
    await captura(r, 'rest-saldo', idioma);
    // La fila del pedido avisa del pago por confirmar; al abrirla están la referencia y los botones.
    await tarjeta(r, 'fila-pago-por-confirmar', 260);
    await captura(r, 'rest-fila-pago', idioma);
    await r.getByTestId('fila-pago-por-confirmar').first().click();
    await r.getByTestId('pago-comida-me-llego').waitFor({ timeout: 60_000 });
    await tarjeta(r, 'pago-comida-restaurante', 120);
    await captura(r, 'rest-pago-por-confirmar', idioma);
    await r.getByTestId('pago-comida-me-llego').click();
    await r.getByTestId('pago-comida-ok').waitFor({ timeout: 30_000 });
    await tarjeta(r, 'pago-comida-restaurante', 120);
    await captura(r, 'rest-pago-confirmado', idioma);
    await ctxR.close();

    // Cliente: el restaurante confirmó; ya preparan su pedido.
    await c.goto(`/app/order/${id}`);
    await c.getByTestId('pago-comida-confirmado').waitFor({ timeout: 60_000 });
    await tarjeta(c, 'pago-comida', 70);
    await captura(c, 'pago-comida-confirmado', idioma);

    // Driver: con el «Me llegó», sale a recoger.
    await d.goto('/driver/');
    await tarjeta(d, 'pago-comida-salida');
    await captura(d, 'driver-salida', idioma);

    await delLocalALaPuerta(id);

    // Cliente: su pedido en camino, con el envío que paga al recibir.
    await c.goto(`/app/order/${id}`);
    await espera(4_000);
    await sinAvisos(c, en);
    await espera(500);
    await captura(c, 'pedido-cliente', idioma);
    await ctxC.close();

    // ───────── Driver: en la puerta cobra solo el envío y confirma el pago móvil
    await d.goto('/driver/');
    await d.getByTestId('cobro-directo').waitFor({ timeout: 60_000 });
    await arriba(d.getByTestId('cobro-directo'), 80);
    await espera(800);
    await captura(d, 'driver-cobro', idioma);
    await yo('POST', `/datos/repartidor/pedidos/${id}/pago-movil`, {
      recibido: true,
      referencia: '000000',
    });
    // C-DESLIZAR-SIEMPRE: la foto de la puerta no cierra; se cierra deslizando.
    await foto(`/datos/repartidor/pedidos/${id}/foto-entrega`, tokens.repartidor, CASA);
    await yo('POST', `/datos/repartidor/pedidos/${id}/entregado`, { ...CASA, modo: 'puerta' });

    // ───────── Driver: el saldo para comisiones y la recarga por código
    await d.goto('/driver/');
    await d.getByRole('tab', { name: en ? 'Earnings' : 'Ganancias' }).click({ timeout: 60_000 });
    await d.getByTestId('saldo-prepago').waitFor({ timeout: 30_000 });
    await arriba(d.getByTestId('saldo-prepago'), 20);
    await espera(800);
    await captura(d, 'driver-saldo', idioma);

    await ctxD.close();
  }

  // ───────── El cliente no aparece (envío en efectivo): el conductor avisa, espera y lo cierra.
  // Con un cliente nuevo en cada vuelta: «El cliente no pagó» le deja una deuda que no lo deja volver a
  // pedir, y así no frena al cliente fijo del guion de pruebas.
  const nuevo = await pedir('POST', '/datos/cuentas/registro', {
    nombre: 'Cliente de prueba',
    correo: `comida.ve.${Date.now().toString(36)}@recorrido.test`,
    clave: DATOS.clave,
    rol: 'cliente',
  });
  const ausente = (m, r, c) => pedir(m, r, c, nuevo.token);
  const id2 = await hastaElPago(ausente, 'efectivo', 1, 0);
  // La comida ya quedó pagada al restaurante; lo que falta cobrar en la puerta es el envío.
  await ausente('POST', `/datos/pedidos/${id2}/pago-comida`, {
    referencia: `0013${String(Date.now()).slice(-4)}`,
  });
  await resto('POST', `/datos/restaurante/pedidos/${id2}/pago-comida`, { llego: true });
  await delLocalALaPuerta(id2);
  await yo('POST', `/datos/repartidor/pedidos/${id2}/no-aparece`, {});
  const driverEn = async (idioma, nombre, listo) => {
    const ctx = await telefono(tokens.repartidor, ids.repartidor, idioma);
    const d = await ctx.newPage();
    await d.goto('/driver/');
    await d.getByTestId('cobro-directo').waitFor({ timeout: 60_000 });
    await listo(d, idioma === 'en');
    await espera(600);
    await captura(d, nombre, idioma);
    await ctx.close();
  };
  for (const idioma of idiomas)
    await driverEn(idioma, 'driver-no-aparece-espera', (d, en) =>
      d
        .getByText(en ? /We told the customer/ : /Avisamos al cliente/)
        .first()
        .evaluate((x) => x.scrollIntoView({ block: 'center' })),
    );
  // Pasa la espera (se adelanta el reloj del aviso, como en la prueba de punta a punta).
  await sql(
    `UPDATE hitos_pedido SET creado_en = datetime('now','-10 minutes') WHERE pedido_id = '${id2}' AND hito = 'no_aparece'`,
  );
  for (const idioma of idiomas)
    await driverEn(idioma, 'driver-no-aparece', async (d) => {
      await d.getByTestId('sin-lugar-seguro').waitFor({ timeout: 60_000 });
      await d
        .getByTestId('sin-lugar-seguro')
        .evaluate((x) => x.scrollIntoView({ block: 'center' }));
    });
  await yo('POST', `/datos/repartidor/pedidos/${id2}/no-pago`, { motivo: 'no aparece' });
  for (const idioma of idiomas) {
    const ctx = await telefono(nuevo.token, nuevo.usuario.id, idioma);
    const c2 = await ctx.newPage();
    await c2.goto(`/app/order/${id2}`);
    await espera(4_000);
    await sinAvisos(c2, idioma === 'en');
    await espera(500);
    await captura(c2, 'pedido-no-entregado', idioma);
    await ctx.close();
  }
}

/**
 * Estados Unidos (Novi, Michigan, zona US-MI-NOVI): Comida como funciona allá. El pedido se paga con
 * tarjeta en la app (en este servidor local el pago queda anotado directo, sin pasar por el
 * procesador), en la puerta no se cobra nada y, si el cliente no aparece, el repartidor espera y deja
 * el pedido en un lugar seguro con su foto. Nombres en inglés y direcciones de Novi.
 */
async function correrUs(idiomas) {
  const NOVI = { id: 'US-MI-NOVI', nombre: 'Novi', lat: 42.4806, lng: -83.4755, radioKm: 15 };
  const LOCAL = { lat: 42.481, lng: -83.4735, direccion: '123 Main Street' };
  const CASA_US = { lat: 42.4722, lng: -83.478, direccion: '12 Main Avenue, Apt 4' };
  const interno = (ruta, cuerpo = {}) =>
    pedir('POST', `/datos/interno/diagnostico/${ruta}`, cuerpo, undefined, {
      'x-reloj-secreto': SECRETO,
    });
  const sesion = async (id) => {
    const token = randomBytes(24).toString('hex');
    await sql(
      `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
    );
    return token;
  };
  const vuelta = Date.now().toString(36);
  const cuenta = async (rol, nombre) => {
    const correo = `comida.us.${rol}.${vuelta}@recorrido.test`;
    const r = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: DATOS.clave,
      rol,
    });
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${r.usuario.id}'`,
    );
    return { token: r.token, id: r.usuario.id };
  };

  // ───────── La ciudad, las cuentas de Estados Unidos y el restaurante de Novi con su plato
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${NOVI.id}', '${NOVI.nombre}', 'US', 'USD', 'America/Detroit', ${NOVI.lat}, ${NOVI.lng}, ${NOVI.radioKm}, 1)`,
  );
  const a = await interno('carro/armar');
  const rep = { id: a.ids.conductorUs, token: await sesion(a.ids.conductorUs) };
  await sql(`UPDATE usuarios SET nombre = 'Sam C.' WHERE id = '${rep.id}'`);
  const yo = (m, r, c) => pedir(m, r, c, rep.token);
  // El repartidor queda en la ciudad con su ficha, sus términos aceptados y su foto de control al día.
  await interno('carro/conductor', { quien: 'us', zonaId: NOVI.id, ...LOCAL }).catch(() => null);
  await yo('POST', '/datos/repartidor/terminos', { version: a.versionTerminos });
  await sql(`DELETE FROM selfies_control WHERE usuario_id = '${rep.id}' AND tomada_en IS NULL`);
  await sql(
    `INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado)
     VALUES ('capturas-comida-US', '${rep.id}', datetime('now'), 'ok')`,
  );
  // Un pedido que una vuelta anterior dejó abierto con este repartidor se cierra (solo en este servidor local).
  await sql(
    `UPDATE pedidos SET estado = 'cancelado' WHERE repartidor_id = '${rep.id}' AND estado NOT IN ('entregado', 'cancelado')`,
  );
  const dueno = await cuenta('restaurante', 'Crescent Pizza Kitchen');
  const resto = (m, r, c) => pedir(m, r, c, dueno.token);
  const rest = (
    await resto('PUT', '/datos/mi-restaurante', {
      nombre: 'Crescent Pizza Kitchen',
      categoria: 'Pizza',
      telefono: '2485550142',
      direccion: LOCAL.direccion,
      lat: LOCAL.lat,
      lng: LOCAL.lng,
    })
  ).restaurante;
  const plato = (
    await resto('POST', '/datos/mi-restaurante/platos', {
      nombreEs: 'Pizza margarita',
      nombreEn: 'Margherita pizza',
      precioCentavos: 1450,
    })
  ).plato;
  await resto('PUT', '/datos/mi-restaurante/horarios', {
    turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
  });
  await sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rest.id}'`);
  await resto('PATCH', '/datos/mi-restaurante/abierto', { abierto: true });
  // C-DOCS-SIN-DATOS-REALES: mientras se toman las fotos la ciudad lleva un nombre de ejemplo.
  restaurarCiudad = await ciudadNeutra(sql, NOVI.id, idiomas[0]);

  const telefono = async (token, id, idioma, donde, carrito) => {
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
      timezoneId: 'America/Detroit',
      geolocation: { latitude: donde.lat, longitude: donde.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i, c]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
        if (c) localStorage.setItem(`tumbite.carrito.${u}`, c);
      },
      [token, id, idioma, carrito ?? null],
    );
    return ctx;
  };
  const captura = (p, nombre, idioma) =>
    p.screenshot({ path: join(SALIDA, `comida-us-${nombre}-v2-${idioma}.png`) });
  const ubicar = async (donde) => {
    await yo('POST', '/datos/repartidor/ubicacion', {
      lat: donde.lat,
      lng: donde.lng,
      precision: 8,
    });
    // El servidor descarta saltos de GPS: en este servidor local la posición se escribe directo.
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${donde.lat}, lng = ${donde.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${rep.id}'`,
    );
  };
  /** Un pedido pagado con tarjeta, aceptado, recogido y con el repartidor en la puerta del cliente. */
  const pedidoEnLaPuerta = async (cli) => {
    await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL });
    await ubicar(LOCAL);
    const p = await pedir(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rest.id,
        lineas: [{ platoId: plato.id, cantidad: 2 }],
        propinaCentavos: 400,
        entrega: 'mano',
        direccion: CASA_US.direccion,
        lat: CASA_US.lat,
        lng: CASA_US.lng,
      },
      cli.token,
    );
    const id = p.pedidoId;
    await sql(
      `UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = '${id}'`,
    );
    await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 });
    await ubicar(LOCAL);
    for (let i = 0; ; i++) {
      const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
      if (ofertas.some((o) => o.id === id)) break;
      if (i > 20) throw new Error(`la oferta ${id} no le llegó al repartidor`);
      await espera(3_000);
    }
    await yo('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {});
    await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {});
    await foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, LOCAL);
    await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {});
    await ubicar(CASA_US);
    await ubicar(CASA_US);
    await sql(
      `INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES ('${id}', 'llego_cliente')`,
    );
    return id;
  };

  for (const idioma of idiomas) {
    const en = idioma === 'en';
    const cli = await cuenta('cliente', 'Jamie L.');
    const carrito = JSON.stringify({
      restauranteId: rest.id,
      restauranteNombre: rest.nombre,
      plan: rest.plan ?? 'inicial',
      restLat: LOCAL.lat,
      restLng: LOCAL.lng,
      moneda: 'USD',
      lineas: [
        {
          clave: `${plato.id}:`,
          platoId: plato.id,
          nombreEs: plato.nombreEs,
          nombreEn: plato.nombreEn,
          precioCentavos: plato.precioCentavos,
          cantidad: 2,
        },
      ],
    });
    // ───────── Cliente: el carrito en dólares, con «Entrégamelo en mano», y el total a pagar en la app
    const ctxC = await telefono(cli.token, cli.id, idioma, CASA_US, carrito);
    const c = await ctxC.newPage();
    await c.goto('/app/cart');
    await c.getByTestId('carrito-direccion').waitFor({ timeout: 60_000 });
    await c.getByText(en ? 'Hand it to me' : 'Entrégamelo en mano', { exact: true }).click();
    await c.getByTestId('carrito-direccion').fill(CASA_US.direccion);
    await espera(1_500);
    await c
      .getByText(rest.nombre, { exact: true })
      .first()
      .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await c.evaluate(() => globalThis.scrollBy(0, -90));
    await espera(600);
    await captura(c, 'carrito', idioma);
    const pagar = c.getByText(en ? /^Continue to payment/ : /^Continuar al pago/).last();
    await pagar.waitFor({ timeout: 30_000 });
    await pagar.evaluate((x) => x.scrollIntoView({ block: 'end' }));
    await c.evaluate(() => globalThis.scrollBy(0, 60));
    await espera(800);
    await captura(c, 'carrito-total', idioma);

    // ───────── Pedido pagado con tarjeta hasta la puerta del cliente
    const id = await pedidoEnLaPuerta(cli);
    await c.goto(`/app/order/${id}`);
    await c
      .getByText(en ? 'Not now' : 'Ahora no', { exact: true })
      .click({ timeout: 15_000 })
      .catch(() => null);
    await espera(4_000);
    await captura(c, 'pedido-cliente', idioma);

    // ───────── Driver: en la puerta del cliente (no cobra nada: el pedido ya se pagó en la app)
    const driverEn = async (nombre, listo) => {
      const ctx = await telefono(rep.token, rep.id, idioma, CASA_US);
      const d = await ctx.newPage();
      await d.goto('/driver/');
      await listo(d);
      await espera(800);
      await captura(d, nombre, idioma);
      await ctx.close();
    };
    const alCentro = (l) => l.evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await driverEn('driver-puerta', async (d) => {
      const boton = d.getByText(en ? /Customer isn.t here/ : /El cliente no aparece/).first();
      await boton.waitFor({ timeout: 60_000 });
      await alCentro(boton);
    });
    // El cliente no aparece: el repartidor avisa y espera.
    await yo('POST', `/datos/repartidor/pedidos/${id}/no-aparece`, {});
    await driverEn('driver-no-aparece-espera', async (d) => {
      const aviso = d.getByText(en ? /We told the customer/ : /Avisamos al cliente/).first();
      await aviso.waitFor({ timeout: 60_000 });
      await alCentro(aviso);
    });
    // Pasa la espera (se adelanta el reloj del aviso, como en la prueba de punta a punta).
    await sql(
      `UPDATE hitos_pedido SET creado_en = datetime('now','-10 minutes') WHERE pedido_id = '${id}' AND hito = 'no_aparece'`,
    );
    await driverEn('driver-no-aparece', async (d) => {
      await d.getByTestId('cliente-ausente').waitFor({ timeout: 60_000 });
      await alCentro(d.getByTestId('cliente-ausente'));
    });
    // Con PIN no se deja solo: lo cierra como «el cliente no apareció», con la foto del lugar.
    const cierre = await fetch(
      `${URL}/datos/repartidor/pedidos/${id}/entregado?modo=ausente&lat=${CASA_US.lat}&lng=${CASA_US.lng}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${rep.token}`, 'content-type': 'image/jpeg' },
        body: FOTO,
      },
    );
    if (!cierre.ok) throw new Error(`cierre sin cliente: ${cierre.status} ${await cierre.text()}`);
    await c.goto(`/app/order/${id}`);
    await c
      .getByText(en ? 'Not now' : 'Ahora no', { exact: true })
      .click({ timeout: 8_000 })
      .catch(() => null);
    await espera(4_000);
    // La foto empieza en la tarjeta que cuenta lo que pasó, con la foto del lugar donde esperó.
    await c
      .getByText(en ? /^We couldn.t deliver it/ : /^No pudimos entregarlo/)
      .first()
      .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await c.evaluate(() => globalThis.scrollBy(0, -110));
    await espera(600);
    await captura(c, 'pedido-no-entregado', idioma);
    await ctxC.close();
  }
  await yo('POST', '/datos/repartidor/conectar', { conectado: false });
}

// Los servicios de pasajeros de Estados Unidos vuelven a quedar apagados en este servidor local: el
// país no está abierto y, encendidos, el canario de servicios se pone en rojo y frena la pasada de
// Venezuela (su guion de punta a punta exige la salud en verde).
const apagarPasajerosUs = async () => {
  await sql(
    "UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro') AND zona_id IN (SELECT id FROM zonas WHERE pais = 'US')",
  ).catch(() => null);
  // Y el servicio que no quedó encendido en ninguna ciudad vuelve a «próximamente».
  await sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro') AND NOT EXISTS (SELECT 1 FROM servicios_zona z WHERE z.servicio_id = servicios.id AND z.estado = 'disponible')",
  ).catch(() => null);
};
// Español en El Vigía; inglés en Novi, Michigan (C-CAPTURAS-POR-IDIOMA).
const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'en') await correrVe(['es']).finally(() => restaurarCiudad());
  if (SOLO !== 'es') await correrUs(['en']).finally(() => restaurarCiudad());
} finally {
  await apagarPasajerosUs();
  await navegador.close();
}
console.log('capturas de Comida listas en docs/capturas/recorrido/comida-{ve,us}-*.png');
