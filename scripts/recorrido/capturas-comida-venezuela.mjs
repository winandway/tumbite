// Capturas REALES de Comida en Venezuela para Docs (C-DOCS-COMIDA-VE, 14 nov 2026). Venezuela (El
// Vigía, estado Mérida, zona VE-MER-ELVIGIA). Contra el servidor local del recorrido (.recorrido en el
// puerto 8790), con las apps web reales del cliente y del Driver:
//   1. corre probar-comida-venezuela.mjs (restaurante aprobado con su menú y repartidor con saldo);
//   2. el cliente ve los precios con su equivalente en bolívares y elige pagar al recibir;
//   3. pedido por pago móvil hasta la puerta: el repartidor confirma «sí me llegó / no me llegó»;
//   4. el saldo para comisiones del repartidor con «te alcanza para unos N pedidos» y la recarga por código.
// Datos neutros («Arepera de pruebas»). Originales en docs/capturas/recorrido/comida-ve-*.png.
// Uso: node scripts/recorrido/capturas-comida-venezuela.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

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
const ubicar = async (donde) => {
  for (let i = 0; i < 2; i++)
    await yo('POST', '/datos/repartidor/ubicacion', { ...donde, precision: 8 });
};

const navegador = await chromium.launch();
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
  p.screenshot({ path: join(SALIDA, `comida-ve-${nombre}-${idioma}.png`) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
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

for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  // ───────── Cliente: el restaurante con sus precios y el carrito con «pagar al recibir»
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
  await c
    .getByText(en ? 'How do you pay?' : '¿Cómo pagas?', { exact: true })
    .first()
    .evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await espera(800);
  await captura(c, 'carrito-pago', idioma);
  await c.getByTestId('carrito-total-bs').evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await espera(600);
  await captura(c, 'carrito-total', idioma);

  // ───────── Pedido por pago móvil hasta la puerta del cliente
  await recargar();
  await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL_REST });
  await ubicar(LOCAL_REST);
  const p = await cliente('POST', '/datos/pedidos', {
    restauranteId: rest.id,
    lineas: [{ platoId: plato.id, cantidad: 2 }],
    propinaCentavos: 50,
    direccion: 'Calle 5 con avenida 3, El Vigía',
    ...CASA,
    metodoPago: 'transferencia_repartidor',
  });
  const id = p.pedidoId;
  await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 });
  await ubicar(LOCAL_REST);
  // La oferta llega al pedir la lista (como la app): se espera a que sea suya y se acepta.
  for (let i = 0; ; i++) {
    const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
    if (ofertas.some((o) => o.id === id)) break;
    if (i > 20) throw new Error(`la oferta ${id} no le llegó al repartidor`);
    await espera(3_000);
  }
  await yo('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {});
  await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {});
  const l = await yo('GET', `/datos/repartidor/pedidos/${id}/pago-local`);
  await yo('POST', `/datos/repartidor/pedidos/${id}/pago-local`, {
    montoPagado: l.montoEsperado,
    importeTicket: l.subtotal,
    metodo: 'efectivo',
  });
  await foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, tokens.repartidor, LOCAL_REST);
  await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {});
  await ubicar(CASA);

  // Cliente: su pedido en camino, con lo que paga al recibir.
  await c.goto(`/app/order/${id}`);
  await espera(4_000);
  await captura(c, 'pedido-cliente', idioma);
  await ctxC.close();

  // ───────── Driver: en la puerta, cobra y confirma el pago móvil
  const ctxD = await telefono(tokens.repartidor, ids.repartidor, idioma);
  const d = await ctxD.newPage();
  await d.goto('/driver/');
  await d.getByTestId('cobro-directo').waitFor({ timeout: 60_000 });
  await arriba(d.getByTestId('cobro-directo'), 80);
  await espera(800);
  await captura(d, 'driver-cobro', idioma);
  await yo('POST', `/datos/repartidor/pedidos/${id}/pago-movil`, {
    recibido: true,
    referencia: '000000',
  });
  await foto(`/datos/repartidor/pedidos/${id}/entregado`, tokens.repartidor, CASA);

  // ───────── Driver: el saldo para comisiones y la recarga por código
  await d.goto('/driver/');
  await d.getByRole('tab', { name: en ? 'Earnings' : 'Ganancias' }).click({ timeout: 60_000 });
  await d.getByTestId('saldo-prepago').waitFor({ timeout: 30_000 });
  await arriba(d.getByTestId('saldo-prepago'), 20);
  await espera(800);
  await captura(d, 'driver-saldo', idioma);

  await ctxD.close();
}

// ───────── El cliente no aparece (pedido en efectivo): el repartidor avisa, espera y lo cierra.
// Con un cliente nuevo en cada vuelta: «El cliente no pagó» le deja una deuda que no lo deja volver a
// pedir, y así no frena al cliente fijo del guion de pruebas.
const nuevo = await pedir('POST', '/datos/cuentas/registro', {
  nombre: 'Cliente de prueba',
  correo: `comida.ve.${Date.now().toString(36)}@recorrido.test`,
  clave: DATOS.clave,
  rol: 'cliente',
});
const ausente = (m, r, c) => pedir(m, r, c, nuevo.token);
await recargar();
await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL_REST });
await ubicar(LOCAL_REST);
const p2 = await ausente('POST', '/datos/pedidos', {
  restauranteId: rest.id,
  lineas: [{ platoId: plato.id, cantidad: 1 }],
  propinaCentavos: 0,
  direccion: 'Calle 5 con avenida 3, El Vigía',
  ...CASA,
  metodoPago: 'efectivo',
});
const id2 = p2.pedidoId;
await resto('POST', `/datos/restaurante/pedidos/${id2}/aceptar`, { minutos: 5 });
for (let i = 0; ; i++) {
  const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
  if (ofertas.some((o) => o.id === id2)) break;
  if (i > 20) throw new Error(`la oferta ${id2} no le llegó al repartidor`);
  await espera(3_000);
}
await yo('POST', `/datos/repartidor/ofertas/${id2}/aceptar`, {});
await resto('POST', `/datos/restaurante/pedidos/${id2}/listo`, {});
const l2 = await yo('GET', `/datos/repartidor/pedidos/${id2}/pago-local`);
await yo('POST', `/datos/repartidor/pedidos/${id2}/pago-local`, {
  montoPagado: l2.montoEsperado,
  importeTicket: l2.subtotal,
  metodo: 'efectivo',
});
await foto(`/datos/repartidor/pedidos/${id2}/foto-recogida`, tokens.repartidor, LOCAL_REST);
await resto('POST', `/datos/restaurante/pedidos/${id2}/confirmar-recogida`, {});
await ubicar(CASA);
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
for (const idioma of ['es', 'en'])
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
for (const idioma of ['es', 'en'])
  await driverEn(idioma, 'driver-no-aparece', async (d) => {
    await d.getByTestId('sin-lugar-seguro').waitFor({ timeout: 60_000 });
    await d.getByTestId('sin-lugar-seguro').evaluate((x) => x.scrollIntoView({ block: 'center' }));
  });
await yo('POST', `/datos/repartidor/pedidos/${id2}/no-pago`, { motivo: 'no aparece' });
for (const idioma of ['es', 'en']) {
  const ctx = await telefono(nuevo.token, nuevo.usuario.id, idioma);
  const c2 = await ctx.newPage();
  await c2.goto(`/app/order/${id2}`);
  await espera(4_000);
  await captura(c2, 'pedido-no-entregado', idioma);
  await ctx.close();
}
await navegador.close();
console.log('capturas de Comida Venezuela listas en docs/capturas/recorrido/comida-ve-*.png');
