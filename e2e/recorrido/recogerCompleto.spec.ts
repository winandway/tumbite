import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Locator, type Page, devices, expect, test } from './fixtures';
import { TEXTOS } from './textos';

/**
 * BRE-7 (2 nov 2026): «Recoger en el local» de punta a punta, como el «Pickup» de DoorDash, Uber
 * Eats y Grubhub. El cliente elige «Recojo en el local» en el carrito y paga (Stripe simulado), ve
 * su PIN; el restaurante acepta, marca listo y, en su app, entrega con el PIN del cliente (un PIN
 * equivocado no pasa). El cliente lo ve entregado, la tarjeta se cobra al entregar y no hay pago de
 * repartidor. Cuida C-RECOGER-MAPA y C-ETAPA-2¾-FINAL. Con CAPTURAS=1 guarda las fotos para la
 * guía de Docs de recogida (docs/capturas/recorrido/). Solo en esta computadora.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
      semilla: string;
      secretoAviso: string;
    });
test.skip(STAGING, 'solo en esta computadora');
const CAPTURAS = process.env.CAPTURAS === '1';
const CASA = { latitude: 25.7725, longitude: -80.187 };

/** Lo que ve la persona en el pedido para recoger (además de lo común de textos.ts). */
const PROPIOS = {
  en: {
    tuPin: 'Your PIN to receive',
    recogerListo: 'Your order is ready: come pick it up and show your PIN.',
    pinMalo: 'The PIN isn’t correct',
    pinAyuda: 'Show it at the counter when you pick up your order.',
    entrar: 'Sign in',
    pizza: 'Margherita pizza',
  },
  es: {
    tuPin: 'Tu PIN para recibir',
    recogerListo: 'Tu pedido está listo: pasa a buscarlo y muestra tu PIN.',
    pinMalo: 'El PIN no es correcto',
    pinAyuda: 'Muéstralo en el mostrador cuando recojas tu pedido.',
    entrar: 'Entrar',
    pizza: 'Pizza margarita',
  },
} as const;

const sql = (comando: string): Record<string, unknown>[] => {
  const salida = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'tumbite-local',
      '--local',
      '--persist-to',
      '.recorrido/estado',
      '-c',
      '.recorrido/wrangler.jsonc',
      '--json',
      '--command',
      comando,
    ],
    { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  return (JSON.parse(salida) as { results: Record<string, unknown>[] }[])[0]?.results ?? [];
};

for (const idioma of ['en', 'es'] as const)
  test(`recoger en el local de punta a punta (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const L = TEXTOS[idioma];
    const P = PROPIOS[idioma];
    const id = `${idioma}${Date.now().toString(36)}`;
    /** Con `elemento`, solo ese recuadro (lo que la guía explica, sin el resto de la pantalla). */
    const foto = async (pagina: Page, nombre: string, elemento?: Locator) => {
      if (!CAPTURAS) return;
      const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
      mkdirSync(dir, { recursive: true });
      await pagina.waitForTimeout(800);
      await pagina.evaluate(() =>
        document
          .querySelectorAll<HTMLElement>('[class*=burbuja]')
          .forEach((e) => (e.style.visibility = 'hidden')),
      );
      await (elemento ?? pagina).screenshot({ path: join(dir, `${nombre}-${idioma}.png`) });
    };

    // 1. El restaurante y el cliente (cuentas nuevas por corrida, por la API como en notaPlato).
    let ip = 0;
    const cuenta = async (rol: string, nombre: string) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.77.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: { nombre, correo: `recoger.${rol}.${id}@recorrido.test`, clave: DATOS!.clave, rol },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return (await r.json()) as { token: string; usuario: { id: string } };
    };
    const dueno = await cuenta('restaurante', 'Marco Rossi');
    const cliente = await cuenta('cliente', 'Ana García');
    const h = { authorization: `Bearer ${dueno.token}` };
    const nombreLocal = `${idioma === 'en' ? 'Corner Pizza' : 'Pizza de la Esquina'} ${id.slice(-4)}`;
    const local = await request.put('/datos/mi-restaurante', {
      headers: h,
      data: {
        nombre: nombreLocal,
        categoria: 'Pizza',
        descripcionEs: 'Pizza al horno de leña.',
        descripcionEn: 'Wood-fired pizza.',
        telefono: '3055550101',
        direccion: '100 SE 2nd St, Miami, FL 33131',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
    const plato = await request.post('/datos/mi-restaurante/platos', {
      headers: h,
      data: {
        nombreEs: 'Pizza margarita',
        nombreEn: 'Margherita pizza',
        categoria: 'Pizzas',
        categoriaEn: 'Pizzas',
        precioCentavos: 1400,
      },
    });
    expect(plato.ok(), await plato.text()).toBe(true);
    const horario = await request.put('/datos/mi-restaurante/horarios', {
      headers: h,
      data: {
        turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
      },
    });
    expect(horario.ok(), await horario.text()).toBe(true);
    // Nuestro equipo lo aprueba (pantalla privada: directo en la base local del recorrido).
    sql(`UPDATE restaurantes SET estado = 'aprobado', abierto = 1 WHERE id = '${rid}'`);

    // 2. El cliente arma el carrito, elige «Recojo en el local» y paga.
    const cliCtx = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: DATOS!.url,
      geolocation: CASA,
      permissions: ['geolocation'],
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await cliCtx.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
      },
      [cliente.token, idioma] as const,
    );
    const cli = await cliCtx.newPage();
    cli.on('pageerror', (e) => console.error('app del cliente:', e.message));
    await cli.goto(`/app/restaurant/${rid}`);
    await cli
      .getByRole('button', { name: `${L.agregar} ${P.pizza}` })
      .filter({ visible: true })
      .first()
      .click({ timeout: 30_000 });
    await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
    await cli.getByRole('radio', { name: L.recojo }).click();
    // Recogida: sin dirección de entrega ni costo de envío.
    await expect(cli.getByLabel(L.direccionCampo)).toHaveCount(0);
    await cli.getByText(L.continuarPago).filter({ visible: true }).scrollIntoViewIfNeeded();
    // Solo las tres formas de recibir (lo que explica la guía), con «Recojo en el local» elegido.
    const formas = cli.getByRole('radio', { name: L.recojo }).locator('..');
    await formas.scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-recoger-carrito', formas);
    const [respuesta] = await Promise.all([
      cli.waitForResponse(
        (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
      ),
      cli.getByText(L.continuarPago).filter({ visible: true }).click(),
    ]);
    expect(respuesta.status(), await respuesta.text()).toBe(201);
    const cobro = (await respuesta.json()) as {
      pedidoId: string;
      clientSecret: string;
      desglose: {
        totalCliente: number;
        pagoRestaurante: number;
        pagoRepartidor: number;
        gananciaPlataforma: number;
      };
    };
    const d = cobro.desglose;
    // Sin repartidor: nadie cobra reparto y el dinero cuadra al centavo.
    expect(d.pagoRepartidor).toBe(0);
    expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);
    // El banco autoriza la tarjeta (se cobra al entregar): aviso firmado de Stripe, como el real.
    const cuerpo = JSON.stringify({
      id: `evt_recoger_${cobro.pedidoId}`,
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: cobro.clientSecret.split('_secret')[0],
          amount_capturable: d.totalCliente,
          metadata: { pedido_id: cobro.pedidoId },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const firma = createHmac('sha256', DATOS!.secretoAviso).update(`${t}.${cuerpo}`).digest('hex');
    const aviso = await request.post('/datos/stripe/aviso', {
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${firma}` },
      data: cuerpo,
    });
    expect(aviso.status()).toBe(200);
    const estado = () =>
      sql(`SELECT estado FROM pedidos WHERE id = '${cobro.pedidoId}'`)[0]?.estado as string;
    await expect.poll(estado, { timeout: 20_000 }).toBe('pagado');

    // 3. El cliente ve que lo recoge él y su PIN de 4 dígitos.
    await cli.goto(`/app/order/${cobro.pedidoId}`);
    await expect(cli.getByText(L.recogerEnLocal)).toBeVisible({ timeout: 20_000 });
    const tarjetaPin = cli.getByText(P.tuPin).locator('..');
    await expect(tarjetaPin).toBeVisible();
    const pin = /\b(\d{4})\b/.exec(await tarjetaPin.innerText())?.[1] ?? '';
    expect(pin, 'el cliente ve su PIN en la app').toMatch(/^\d{4}$/);
    // En la recogida el PIN se muestra en el mostrador: no habla de un repartidor que no existe.
    await expect(tarjetaPin).toContainText(P.pinAyuda);
    await foto(cli, 'cliente-recoger-pin', tarjetaPin);

    // 4. El restaurante, en su app: ve el pedido «lo recoge el cliente», acepta y marca listo.
    const restCtx = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: DATOS!.url,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await restCtx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const rapp = await restCtx.newPage();
    await rapp.goto('/restaurant/');
    await rapp.getByLabel(L.correo).fill(`recoger.restaurante.${id}@recorrido.test`);
    await rapp.getByLabel(L.clave, { exact: true }).fill(DATOS!.clave);
    await rapp.getByRole('button', { name: P.entrar }).click();
    const codigo = `#${cobro.pedidoId.slice(0, 4).toUpperCase()}`;
    await expect(rapp.getByText(codigo).first()).toBeVisible({ timeout: 30_000 });
    const aceptar = rapp.getByRole('button', { name: `${L.aceptar} · 20` });
    // La lista se refresca cada 5 s: si un toque cae justo en el refresco, se repite.
    await expect(async () => {
      if (!(await aceptar.count()))
        await rapp.getByRole('button', { name: codigo }).first().click();
      await expect(aceptar.first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await aceptar.first().click();
    await expect.poll(estado, { timeout: 20_000 }).toBe('aceptado');
    const listo = rapp.getByRole('button', { name: L.listo });
    await expect(async () => {
      if (!(await listo.count())) await rapp.getByRole('button', { name: codigo }).first().click();
      await expect(listo.first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await listo.first().click();
    await expect.poll(estado, { timeout: 20_000 }).toBe('listo');

    // 5. El cliente recibe «Tu pedido está listo».
    await cli.reload();
    await expect(cli.getByText(P.recogerListo)).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-recoger-listo', cli.getByText(P.recogerListo).locator('..'));

    // 6. En el mostrador: un PIN equivocado no entrega; con el del cliente, sí.
    const campoPin = rapp.getByLabel(L.pinCliente);
    await expect(async () => {
      if (!(await campoPin.count()))
        await rapp.getByRole('button', { name: codigo }).first().click();
      await expect(campoPin.first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    const malo = pin === '0000' ? '1111' : '0000';
    await campoPin.fill(malo);
    await rapp.getByRole('button', { name: L.entregadoLocal }).click();
    await expect(rapp.getByText(P.pinMalo, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    expect(estado(), 'con un PIN equivocado el pedido no se entrega').toBe('listo');
    // Para la foto, la pantalla sin el aviso del intento fallido (se vuelve a abrir el pedido).
    await rapp.reload();
    await expect(async () => {
      if (!(await campoPin.count()))
        await rapp.getByRole('button', { name: codigo }).first().click();
      await expect(campoPin.first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await campoPin.fill(pin);
    await foto(rapp, 'restapp-recoger-pin');
    await rapp.getByRole('button', { name: L.entregadoLocal }).click();
    await expect.poll(estado, { timeout: 20_000 }).toBe('entregado');
    // La tarjeta se cobra al entregar (C-COBRO-AL-ENTREGAR), por el total del cliente.
    await expect
      .poll(
        () =>
          sql(`SELECT estado, monto FROM liquidaciones WHERE pedido_id = '${cobro.pedidoId}'`)[0],
        { timeout: 20_000 },
      )
      .toMatchObject({ monto: d.totalCliente });
    await restCtx.close();

    // 7. El cliente lo ve entregado, sin PIN a la vista (ya se usó).
    await cli.reload();
    await expect(cli.getByText(L.entregado)).toBeVisible({ timeout: 20_000 });
    await expect(cli.getByText(P.tuPin)).toHaveCount(0);
    await expect(cli.getByText(L.recogerEnLocal)).toHaveCount(0);
    await foto(cli, 'cliente-recoger-entregado');
    await cliCtx.close();
  });
