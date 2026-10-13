import { execFileSync } from 'node:child_process';
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
      await pagina.waitForTimeout(1500);
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
      ['Nudos de ajo', 'Garlic knots', 'Entradas', 'Starters', '3.00'],
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
    cli.on('pageerror', (e) => console.error('app del cliente:', e.message));
    cli.on(
      'console',
      (m) => m.type() === 'error' && console.error('consola del cliente:', m.text()),
    );
    await cli.goto('/app/');
    await cli.getByText(L.appCrear).click();
    await cli.getByLabel(L.nombreCompleto).fill('Ana García');
    await cli.getByLabel(L.correo).fill(correo('cliente'));
    await cli.getByLabel(L.celular).fill('3055550103');
    // Cumple hoy: así, después de su primer pedido, le toca el regalo de cumpleaños.
    const hoy = new Date().toISOString().slice(5, 10);
    await cli.getByLabel(L.cumple).fill(`1995-${hoy}`);
    await cli.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
    await foto(cli, 'cliente-registro');
    await cli.getByRole('button', { name: L.crearCuenta }).click();
    await cli.getByText(restaurante).click();
    await expect(
      cli.getByText(idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita'),
    ).toBeVisible();
    await foto(cli, 'cliente-menu');
    const plato = {
      pizza: idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita',
      limonada: idioma === 'en' ? 'Coconut lemonade' : 'Limonada de coco',
      nudos: idioma === 'en' ? 'Garlic knots' : 'Nudos de ajo',
    };
    type Cobro = {
      pedidoId: string;
      clientSecret: string;
      desglose: {
        totalCliente: number;
        pagoRestaurante: number;
        pagoRepartidor: number;
        gananciaPlataforma: number;
      };
    };
    /** Del menú al pago: agrega los platos, va al carrito, paga y el banco aprueba (simulado). */
    const pedirYPagar = async (platos: string[], fotoCarrito?: string): Promise<Cobro> => {
      if (!cli.url().includes('/restaurant/')) {
        await cli.goto('/app/');
        try {
          await cli.getByText(restaurante).click({ timeout: 15_000 });
        } catch (e) {
          console.error(
            'DEPURAR inicio:',
            cli.url(),
            (await cli.locator('body').innerText()).slice(0, 800),
          );
          await cli.screenshot({ path: join(RAIZ, 'test-results', 'depurar-inicio.png') });
          throw e;
        }
      }
      for (const p of platos)
        await cli
          .getByRole('button', { name: `${L.agregar} ${p}` })
          .filter({ visible: true })
          .click();
      await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
      await cli.getByLabel(L.direccionEntrega).fill('200 S Biscayne Blvd, Apt 12');
      if (fotoCarrito) {
        await mapaListo(cli);
        await cli.getByText(L.continuarPago).filter({ visible: true }).scrollIntoViewIfNeeded();
        await foto(cli, fotoCarrito);
      }
      const [respuesta] = await Promise.all([
        cli.waitForResponse(
          (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
        ),
        cli.getByText(L.continuarPago).filter({ visible: true }).click(),
      ]);
      expect(respuesta.status()).toBe(201);
      const c = (await respuesta.json()) as Cobro;
      // El banco aprueba: aviso firmado de Stripe, como el de verdad.
      const cuerpo = JSON.stringify({
        id: `evt_${c.pedidoId}`,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: c.clientSecret.split('_secret')[0],
            amount_received: c.desglose.totalCliente,
            metadata: { pedido_id: c.pedidoId },
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
      // El dinero cuadra al centavo: lo que paga el cliente se reparte entero.
      const d = c.desglose;
      expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);
      return c;
    };
    const cobro = await pedirYPagar([plato.pizza, plato.limonada], 'cliente-carrito');
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

    // 9. Regalo de cumpleaños: el restaurante aparta el 20 % y regala los nudos de ajo.
    await panel.getByRole('link', { name: L.regalos, exact: true }).click();
    await panel.getByLabel(L.porcentajeRegalos).fill('20');
    const elegir = panel.getByLabel(L.platoRegalo).first();
    const valor = await elegir.locator('option', { hasText: plato.nudos }).getAttribute('value');
    await elegir.selectOption(valor ?? '');
    await panel.getByRole('button', { name: L.guardar, exact: true }).click();
    await expect(panel.getByText(/^Saved$|^Guardado$/)).toBeVisible();
    await panel.evaluate(() => window.scrollTo(0, 0));
    await foto(panel, 'restaurante-regalos');

    // El cliente cumple años: al poner los nudos en el carrito, le aparece el regalo.
    await cli.goto('/app/');
    await cli.getByText(restaurante).click();
    await cli
      .getByRole('button', { name: `${L.agregar} ${plato.nudos}` })
      .filter({ visible: true })
      .click();
    await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
    await expect(cli.getByText(L.regaloCumple).filter({ visible: true })).toBeVisible();
    await mapaListo(cli);
    await cli.getByText(L.continuarPago).filter({ visible: true }).scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-regalo');

    // 10. El cliente paga y se arrepiente: cancela antes de que el restaurante acepte.
    const conRegalo = await pedirYPagar([]);
    await cli.goto(`/app/order/${conRegalo.pedidoId}`);
    await cli.getByText(L.cancelarPedido).filter({ visible: true }).click();
    await foto(cli, 'cliente-cancelar');
    await cli.getByText(L.siCancelar).filter({ visible: true }).click();
    await expect(cli.getByText(L.cancelasteTu, { exact: false })).toBeVisible();
    await foto(cli, 'cliente-cancelado');

    // 11. El restaurante no puede atender un pedido y lo rechaza: el cliente recibe su dinero.
    const rechazado = await pedirYPagar([plato.pizza]);
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    const codigo = rechazado.pedidoId.slice(0, 4).toUpperCase();
    // La fila de ESE pedido: el ⋮ que está junto a su número.
    const fila = panel
      .locator('strong', { hasText: `#${codigo}` })
      .locator(`xpath=ancestor::*[.//button[@aria-label="${L.masOpciones}"]][1]`);
    await expect(fila).toBeVisible({ timeout: 20_000 });
    panel.once('dialog', (d) => void d.accept());
    await fila.getByRole('button', { name: L.masOpciones }).click();
    await panel.getByRole('menuitem', { name: L.rechazar }).click();
    await cli.goto(`/app/order/${rechazado.pedidoId}`);
    await expect(cli.getByText(L.rechazado, { exact: false })).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-rechazado');

    // 12. El Manager: un pedido que nadie confirma se pone en rojo y a los 10 minutos se cancela
    //     solo, con la devolución. El reloj se adelanta en la base de prueba, no se espera.
    const olvidado = await pedirYPagar([plato.pizza]);
    const atrasar = (minutos: number) =>
      execFileSync(
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
          '--command',
          `UPDATE pedidos SET pagado_en = datetime('now','-${minutos} minutes') WHERE id = '${olvidado.pedidoId}'`,
        ],
        { cwd: RAIZ, stdio: 'ignore' },
      );
    atrasar(7);
    await panel.reload();
    await expect(panel.getByText(/In trouble|En problemas/).first()).toBeVisible({
      timeout: 20_000,
    });
    await foto(panel, 'restaurante-semaforo-rojo');
    atrasar(11);
    await cli.goto(`/app/order/${olvidado.pedidoId}`);
    await expect(cli.getByText(L.managerCancela, { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await foto(cli, 'cliente-manager-cancela');

    await Promise.all([panelCtx.close(), repCtx.close(), cliCtx.close()]);
  });
}
