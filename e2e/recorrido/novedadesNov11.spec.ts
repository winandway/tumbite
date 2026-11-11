import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';
import { TEXTOS } from './textos';

/**
 * Lo del 11 nov 2026, probado en el navegador con sus capturas reales para Docs:
 * C-LISTO-SIN-AJUSTE (el restaurante no puede marcar «Listo» mientras el cliente decide el plato
 * que falta), C-COBRO-MISMOS-DATOS (cambiar algo después de «Continuar al pago» vuelve a pedirlo)
 * y C-PIN-SIN-FOTO (un pedido en mano con PIN no se entrega con foto). Todos los países.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');

const CAPTURAS = join(RAIZ, 'docs', 'capturas', 'nov11');
mkdirSync(CAPTURAS, { recursive: true });
const MIAMI = { latitude: 25.7743, longitude: -80.1937 };
const CASA = { latitude: 25.7725, longitude: -80.187 };

for (const idioma of ['es', 'en'] as const)
  test(`novedades del 11 nov en el navegador (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const en = idioma === 'en';
    const L = TEXTOS[idioma];
    const id = `${idioma}${Date.now().toString(36)}`;
    let n = 0;
    const ip = () => ({ 'cf-connecting-ip': `10.98.${en ? 2 : 1}.${(Date.now() + n++) % 250}` });
    const foto = (p: import('@playwright/test').Page, nombre: string) =>
      p.screenshot({ path: join(CAPTURAS, `${nombre}-${idioma}.png`) });
    async function cuenta(rol: string, nombre: string, alias: string) {
      const correo = `${alias}.${id}@recorrido.test`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: ip(),
        data: { nombre, correo, clave: DATOS!.clave, rol, idioma },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const j = (await r.json()) as { token: string; usuario: { id: string } };
      return { correo, token: j.token, id: j.usuario.id };
    }
    const con = (token: string) => ({ authorization: `Bearer ${token}` });
    const app = async (token: string, uid: string, donde = MIAMI, celular = true) => {
      const ctx = await browser.newContext({
        ...(celular ? devices['Pixel 7'] : { viewport: { width: 1100, height: 900 } }),
        baseURL: DATOS!.url,
        geolocation: donde,
        permissions: ['geolocation'],
        locale: en ? 'en-US' : 'es-US',
      });
      await ctx.addInitScript(
        ([pase, i, u]) => {
          localStorage.setItem('tumbite.idioma', i!);
          localStorage.setItem('tumbite.sesion', pase!);
          localStorage.setItem(`divoox.permisos.${u}`, '1');
        },
        [token, idioma, uid],
      );
      return ctx;
    };

    // ───────── El restaurante, su plato y su cliente ─────────
    const dueno = await cuenta(
      'restaurante',
      en ? 'Restaurant owner' : 'Dueño del restaurante',
      'dueno',
    );
    const nombreRest = en ? `Pizza House ${id}` : `Casa de Pizza ${id}`;
    const local = await request.put('/datos/mi-restaurante', {
      headers: con(dueno.token),
      data: {
        nombre: nombreRest,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
    sqlLocal(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}'`);
    const plato = await request.post('/datos/mi-restaurante/platos', {
      headers: con(dueno.token),
      data: { nombreEs: 'Pizza margarita', nombreEn: 'Margherita pizza', precioCentavos: 1500 },
    });
    expect(plato.ok(), await plato.text()).toBe(true);
    const platoId = ((await plato.json()) as { plato: { id: string } }).plato.id;
    const limonada = await request.post('/datos/mi-restaurante/platos', {
      headers: con(dueno.token),
      data: { nombreEs: 'Limonada de coco', nombreEn: 'Coconut lemonade', precioCentavos: 500 },
    });
    expect(limonada.ok(), await limonada.text()).toBe(true);
    const limonadaId = ((await limonada.json()) as { plato: { id: string } }).plato.id;
    await request.put('/datos/mi-restaurante/horarios', {
      headers: con(dueno.token),
      data: {
        turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
      },
    });
    const abierto = await request.patch('/datos/mi-restaurante/abierto', {
      headers: con(dueno.token),
      data: { abierto: true },
    });
    expect(abierto.ok(), await abierto.text()).toBe(true);
    const cliente = await cuenta('cliente', en ? 'Customer' : 'Cliente', 'cliente');

    // ───────── C-LISTO-SIN-AJUSTE: «Me falta un plato» en un pedido aceptado ─────────
    const pedido = await request.post('/datos/pedidos', {
      headers: con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [
          { platoId, cantidad: 1 },
          { platoId: limonadaId, cantidad: 1 },
        ],
        propinaCentavos: 300,
        direccion: '300 Biscayne Blvd, Miami, FL',
        lat: 25.777,
        lng: -80.19,
      },
    });
    expect(pedido.ok(), await pedido.text()).toBe(true);
    const pid = ((await pedido.json()) as { pedidoId: string }).pedidoId;
    for (const paso of [
      "estado = 'pagado', pagado_en = datetime('now')",
      "estado = 'aceptado', aceptado_en = datetime('now')",
    ])
      sqlLocal(`UPDATE pedidos SET ${paso} WHERE id = '${pid}'`);
    const ctxPanel = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      baseURL: DATOS!.url,
      locale: en ? 'en-US' : 'es-US',
    });
    await ctxPanel.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctxPanel.request.post('/datos/cuentas/entrar', {
      headers: ip(),
      data: { correo: dueno.correo, clave: DATOS!.clave },
    });
    const panel = await ctxPanel.newPage();
    await panel.goto(`${en ? '' : '/es'}/panel/orders`);
    const tarjeta = panel.locator('li', { hasText: pid.slice(0, 4).toUpperCase() }).first();
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await expect(tarjeta.getByRole('button', { name: /^(¡Listo!|Ready!)$/ })).toBeVisible();
    await tarjeta.getByRole('button', { name: L.masOpciones }).click();
    await panel.getByRole('menuitem', { name: L.faltaPlato }).click();
    await tarjeta
      .getByRole('combobox')
      .selectOption({ label: en ? 'Coconut lemonade' : 'Limonada de coco' });
    await tarjeta.getByRole('button', { name: L.avisarFalta }).click();
    await expect(tarjeta.getByRole('status')).toBeVisible({ timeout: 20_000 });
    await expect(tarjeta.getByRole('button', { name: /^(¡Listo!|Ready!)$/ })).toHaveCount(0);
    await tarjeta.scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-listo-espera');
    // El servidor también lo frena (app, panel y punto de venta pasan por la misma guarda).
    const intento = await request.post(`/datos/restaurante/pedidos/${pid}/listo`, {
      headers: con(dueno.token),
    });
    expect(intento.status()).toBe(409);

    // ───────── C-COBRO-MISMOS-DATOS: cambiar algo tras «Continuar al pago» ─────────
    const ctxCli = await app(cliente.token, cliente.id);
    const cli = await ctxCli.newPage();
    await cli.goto('/app/');
    await cli
      .getByTestId('lista-restaurantes')
      .getByRole('button', { name: nombreRest, exact: true })
      .click({ timeout: 60_000 });
    await cli
      .getByRole('button', { name: `${L.agregar} ${en ? 'Coconut lemonade' : 'Limonada de coco'}` })
      .filter({ visible: true })
      .click();
    await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
    await cli.getByRole('radio', { name: L.enPuerta }).click();
    await cli.getByLabel(L.direccionCampo).fill('200 S Biscayne Blvd, Apt 12');
    const continuar = cli.getByText(L.continuarPago).filter({ visible: true });
    await continuar.scrollIntoViewIfNeeded();
    const [respuesta] = await Promise.all([
      cli.waitForResponse(
        (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
      ),
      continuar.click(),
    ]);
    expect(respuesta.status()).toBe(201);
    // El cobro ya existe: ahora el cliente cambia las indicaciones para el repartidor.
    const notas = cli.getByLabel(
      en ? 'Notes for your driver (optional)' : /Indicaciones para el repartidor/,
    );
    await notas.scrollIntoViewIfNeeded();
    await notas.fill(
      en ? 'Blue gate, ring the bell twice' : 'Portón azul, toca el timbre dos veces',
    );
    await expect(continuar).toBeVisible({ timeout: 20_000 });
    await continuar.scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-carrito-cambio');

    // ───────── C-PIN-SIN-FOTO: la entrega en mano con PIN, en la app del repartidor ─────────
    const rep = await cuenta('repartidor', en ? 'Driver' : 'Repartidor', 'rep');
    const mano = await request.post('/datos/pedidos', {
      headers: con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [{ platoId, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '200 S Biscayne Blvd, Miami, FL',
        lat: CASA.latitude,
        lng: CASA.longitude,
        entrega: 'mano',
        pin: true,
      },
    });
    expect(mano.ok(), await mano.text()).toBe(true);
    const mid = ((await mano.json()) as { pedidoId: string }).pedidoId;
    for (const paso of [
      "estado = 'pagado', pagado_en = datetime('now')",
      "estado = 'aceptado', aceptado_en = datetime('now')",
      "estado = 'listo', listo_en = datetime('now')",
      `estado = 'en_camino', repartidor_id = '${rep.id}'`,
    ])
      sqlLocal(`UPDATE pedidos SET ${paso} WHERE id = '${mid}'`);
    const ctxRep = await app(rep.token, rep.id, CASA);
    const d = await ctxRep.newPage();
    await d.goto('/driver/');
    await expect(d.getByTestId('con-pin-sin-foto')).toBeVisible({ timeout: 60_000 });
    await d.getByTestId('con-pin-sin-foto').scrollIntoViewIfNeeded();
    await foto(d, 'repartidor-pin-sin-foto');
  });
