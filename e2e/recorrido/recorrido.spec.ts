import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, type Page, devices, expect, test } from '@playwright/test';
import { TEXTOS } from './textos';

/**
 * El recorrido completo de Tumbite en el navegador, como lo haría la gente: el restaurante se
 * registra y arma su menú, nuestro equipo lo aprueba, el cliente se registra, pide y paga (con
 * Stripe simulado), el restaurante acepta, el repartidor se conecta, acepta, recoge y entrega, y
 * el cliente califica. Al final el dinero tiene que cuadrar al centavo.
 *
 * Dos cosas en una: es la prueba de punta a punta de cada publicación y, con CAPTURAS=1, guarda
 * las capturas reales para Docs (docs/capturas/<nombre>-<idioma>.png).
 */
const RAIZ = join(__dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
  url: string;
  correoEquipo: string;
  semilla: string;
  secretoAviso: string;
  clave: string;
};
const CAPTURAS = process.env.CAPTURAS === '1';
const MIAMI = { latitude: 25.7743, longitude: -80.1937 };
const CASA = { latitude: 25.7725, longitude: -80.187 };

for (const idioma of ['en', 'es'] as const) {
  test(`recorrido completo de un pedido (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const L = TEXTOS[idioma];
    const id = `${idioma}${Date.now().toString(36)}`;
    const correo = (quien: string) => `${quien}.${id}@recorrido.test`;
    const restaurante = idioma === 'en' ? 'Bella Pizza' : 'Pizza Bella';

    const nuevoContexto = async (tipo: 'computadora' | 'celular', donde = MIAMI) => {
      const ctx: BrowserContext = await browser.newContext({
        ...(tipo === 'celular' ? devices['Pixel 7'] : { viewport: { width: 1100, height: 900 } }),
        baseURL: DATOS.url,
        geolocation: donde,
        permissions: ['geolocation'],
        locale: idioma === 'en' ? 'en-US' : 'es-US',
      });
      await ctx.addInitScript((i) => {
        if (!localStorage.getItem('tumbite.idioma')) localStorage.setItem('tumbite.idioma', i);
      }, idioma);
      return ctx;
    };
    // Solo para las capturas: el mapa termina de pintar sus calles (sin internet no hace falta).
    const mapaListo = async (pagina: Page) => {
      if (!CAPTURAS) return;
      await pagina
        .locator('.leaflet-tile-loaded')
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => {});
      await pagina.waitForTimeout(800);
    };
    const foto = async (pagina: Page, nombre: string) => {
      if (!CAPTURAS) return;
      // La burbuja de ayuda se esconde solo durante la foto (no se quita: la pantalla la sigue usando).
      await pagina.evaluate(() =>
        document
          .querySelectorAll<HTMLElement>('[class*=burbuja]')
          .forEach((e) => (e.style.visibility = 'hidden')),
      );
      const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
      mkdirSync(dir, { recursive: true });
      await pagina.screenshot({ path: join(dir, `${nombre}-${idioma}.png`) });
      await pagina.evaluate(() =>
        document
          .querySelectorAll<HTMLElement>('[class*=burbuja]')
          .forEach((e) => (e.style.visibility = '')),
      );
    };

    // 1. El restaurante se registra en el panel y arma su ficha.
    const panelCtx = await nuevoContexto('computadora');
    const panel = await panelCtx.newPage();
    await panel.goto('/panel');
    await panel.getByText(L.panelCrear).click();
    await panel.getByLabel(L.tuNombre).fill(idioma === 'en' ? 'Marco Rossi' : 'Marco Rossi');
    await panel.getByLabel(L.correo).fill(correo('restaurante'));
    await panel.getByLabel(L.celular).fill('3055550100');
    await panel.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
    await foto(panel, 'restaurante-registro');
    await panel.getByRole('button', { name: L.panelRegistrar }).click();

    await panel.getByRole('link', { name: L.miRestaurante, exact: true }).click();
    await panel.getByLabel(L.nombreRest).fill(restaurante);
    await panel.getByLabel(L.tipo).fill('Pizza');
    await panel.getByLabel(L.telRest).fill('3055550101');
    await panel.getByLabel(L.direccion, { exact: true }).fill('100 SE 2nd St, Miami, FL 33131');
    await panel.getByLabel(L.descEs).fill('Pizza al horno de leña y masa madre.');
    await panel.getByLabel(L.descEn).fill('Wood-fired pizza on a sourdough crust.');
    await panel.getByRole('button', { name: L.ubicacion }).click();
    await panel.getByRole('button', { name: L.guardar, exact: true }).click();
    await expect(panel.getByText(/Under review|En revisión/)).toBeVisible();
    await foto(panel, 'restaurante-ficha');

    // 2. El menú: dos platos con su categoría en los dos idiomas.
    await panel.getByRole('link', { name: L.menu, exact: true }).click();
    for (const [es, en, catEs, catEn, precio] of [
      ['Pizza margarita', 'Margherita pizza', 'Pizzas', 'Pizzas', '14.00'],
      ['Limonada de coco', 'Coconut lemonade', 'Bebidas', 'Drinks', '4.50'],
    ]) {
      await panel.getByRole('button', { name: L.agregarPlato }).click();
      await panel.getByLabel(L.nombreEs).fill(es!);
      await panel.getByLabel(L.nombreEn).fill(en!);
      await panel.getByLabel(L.catEs).fill(catEs!);
      await panel.getByLabel(L.catEn).fill(catEn!);
      await panel.getByLabel(L.precio).fill(precio!);
      await panel.getByRole('button', { name: L.guardarPlato }).click();
      await expect(panel.getByText(idioma === 'en' ? en! : es!).first()).toBeVisible();
    }
    await foto(panel, 'restaurante-menu');

    // 3. Nuestro equipo lo aprueba (pantalla privada: se hace por la API, sin capturas).
    const correoEquipo = DATOS.correoEquipo;
    let tokenEquipo: string;
    const entrar = await request.post('/datos/cuentas/entrar', {
      data: { correo: correoEquipo, clave: DATOS.clave },
    });
    if (entrar.ok()) tokenEquipo = ((await entrar.json()) as { token: string }).token;
    else {
      const r = await request.post('/datos/cuentas/registro', {
        data: {
          nombre: 'Soporte Recorrido',
          correo: correoEquipo,
          clave: DATOS.clave,
          rol: 'cliente',
        },
      });
      tokenEquipo = ((await r.json()) as { token: string }).token;
    }
    const auth = { authorization: `Bearer ${tokenEquipo}` };
    expect(
      (
        await request.post('/datos/cuentas/hacer-admin', {
          headers: auth,
          data: { semilla: DATOS.semilla },
        })
      ).status(),
    ).toBe(200);
    const lista = (await (
      await request.get('/datos/admin/restaurantes', { headers: auth })
    ).json()) as {
      restaurantes: { id: string; nombre: string }[];
    };
    const rest = lista.restaurantes.find((r) => r.nombre === restaurante);
    expect(rest, 'el restaurante nuevo aparece en la lista del equipo').toBeTruthy();
    expect(
      (
        await request.patch(`/datos/admin/restaurantes/${rest!.id}`, {
          headers: auth,
          data: { estado: 'aprobado' },
        })
      ).status(),
    ).toBe(200);

    await panel.getByRole('link', { name: L.miRestaurante, exact: true }).click();
    await panel.getByRole('button', { name: L.abrir }).click();
    await foto(panel, 'restaurante-abierto');
    // La ayuda del panel lleva a «¿Cómo hago…?», en el idioma del panel.
    const ayuda = panel.getByRole('button', {
      name: idioma === 'en' ? 'Help' : 'Ayuda',
      exact: true,
    });
    await ayuda.click();
    await expect(panel.getByRole('link', { name: /How do I…\?|¿Cómo hago…\?/ })).toHaveAttribute(
      'href',
      idioma === 'en' ? '/docs/how-to' : '/es/docs/how-to',
    );
    await ayuda.click();

    // 4. El repartidor se registra en su app y se conecta cerca del restaurante.
    const repCtx = await nuevoContexto('celular', MIAMI);
    const rep = await repCtx.newPage();
    await rep.goto('/driver/');
    await rep.getByText(L.appCrear).click();
    await rep.getByLabel(L.nombreCompleto).fill('Luis Pérez');
    await rep.getByLabel(L.correo).fill(correo('repartidor'));
    await rep.getByLabel(L.celular).fill('3055550102');
    await rep.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
    await rep.getByRole('button', { name: L.crearCuenta }).click();
    await rep
      .getByRole('switch')
      .or(rep.getByRole('button', { name: L.conectarme }))
      .first()
      .click();
    await expect(
      rep.getByText(/Online: receiving orders|Conectado: recibiendo pedidos/),
    ).toBeVisible();
    await foto(rep, 'repartidor-conectado');

    // 5. El cliente se registra, elige, arma el carrito y paga.
    const cliCtx = await nuevoContexto('celular', CASA);
    const cli = await cliCtx.newPage();
    await cli.goto('/app/');
    await cli.getByText(L.appCrear).click();
    await cli.getByLabel(L.nombreCompleto).fill('Ana García');
    await cli.getByLabel(L.correo).fill(correo('cliente'));
    await cli.getByLabel(L.celular).fill('3055550103');
    await cli.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
    await foto(cli, 'cliente-registro');
    await cli.getByRole('button', { name: L.crearCuenta }).click();
    await cli.getByText(restaurante).click();
    await expect(
      cli.getByText(idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita'),
    ).toBeVisible();
    await foto(cli, 'cliente-menu');
    await cli
      .getByRole('button', {
        name: `${L.agregar} ${idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita'}`,
      })
      .click();
    await cli
      .getByRole('button', {
        name: `${L.agregar} ${idioma === 'en' ? 'Coconut lemonade' : 'Limonada de coco'}`,
      })
      .click();
    await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
    await cli.getByLabel(L.direccionEntrega).fill('200 S Biscayne Blvd, Apt 12');
    await mapaListo(cli);
    await cli.getByText(L.continuarPago).filter({ visible: true }).scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-carrito');
    const [respuesta] = await Promise.all([
      cli.waitForResponse(
        (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
      ),
      cli.getByText(L.continuarPago).filter({ visible: true }).click(),
    ]);
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
    expect(respuesta.status()).toBe(201);

    // El banco aprueba (aviso firmado de Stripe, como el de verdad).
    const cuerpo = JSON.stringify({
      id: `evt_${id}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: cobro.clientSecret.split('_secret')[0],
          amount_received: cobro.desglose.totalCliente,
          metadata: { pedido_id: cobro.pedidoId },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const firma = createHmac('sha256', DATOS.secretoAviso).update(`${t}.${cuerpo}`).digest('hex');
    const aviso = await request.post('/datos/stripe/aviso', {
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${firma}` },
      data: cuerpo,
    });
    expect(aviso.status()).toBe(200);
    await cli.goto(`/app/order/${cobro.pedidoId}`);
    await expect(cli.getByText(/Payment received|Recibimos tu pago|Pago recibido/)).toBeVisible();
    await foto(cli, 'cliente-pagado');

    // 6. El restaurante acepta con su tiempo y avisa que está listo.
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    await expect(panel.getByText(cobro.pedidoId.slice(0, 4).toUpperCase()).first()).toBeVisible({
      timeout: 20_000,
    });
    await foto(panel, 'restaurante-pedido-nuevo');
    await panel.getByRole('button', { name: `${L.aceptar} · 20` }).click();
    await expect(panel.getByRole('button', { name: L.listo })).toBeVisible();
    await foto(panel, 'restaurante-pedido-aceptado');
    await panel.getByRole('button', { name: L.listo }).click();

    // 7. El repartidor recibe la oferta, la acepta, recoge y entrega.
    await expect(rep.getByRole('button', { name: L.aceptarOferta, exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await foto(rep, 'repartidor-oferta');
    await rep.getByRole('button', { name: L.aceptarOferta, exact: true }).click();
    await rep.getByRole('button', { name: L.recogido }).click();
    await expect(rep.getByRole('button', { name: L.entregar, exact: true })).toBeVisible();
    await foto(rep, 'repartidor-en-camino');
    await cli.reload();
    await expect(
      cli.getByText(/Your driver is on the way|Tu repartidor va en camino/),
    ).toBeVisible();
    await mapaListo(cli);
    await foto(cli, 'cliente-en-camino');
    await rep.getByRole('button', { name: L.entregar, exact: true }).click();

    // El repartidor termina su turno: así no se queda «libre» para el recorrido siguiente.
    await rep.getByText(L.desconectarme).filter({ visible: true }).click();

    // 8. El cliente lo ve entregado y califica.
    await cli.reload();
    await expect(cli.getByText(L.entregado)).toBeVisible({ timeout: 20_000 });
    await cli.getByRole('button', { name: L.estrellas(L.laComida, 5) }).click();
    await cli.getByRole('button', { name: L.estrellas(`${L.tuRepartidor}: Luis`, 5) }).click();
    await foto(cli, 'cliente-calificar');
    await cli.getByRole('button', { name: L.enviarCalificacion }).click();

    // 9. El dinero cuadra al centavo: lo que pagó el cliente se reparte entero.
    const d = cobro.desglose;
    expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);

    await Promise.all([panelCtx.close(), repCtx.close(), cliCtx.close()]);
  });
}
