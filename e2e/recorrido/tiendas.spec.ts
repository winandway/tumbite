import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-TIENDAS-COMPRA en el navegador (28 oct 2026): un supermercado sube su planilla, el cliente
 * entra a la tienda, agrega un producto rebajado, uno al peso y una cerveza, elige qué hacer si
 * falta cada uno, paga (Stripe SIMULADO, aviso firmado como el de verdad) y la tienda ve en su
 * panel lo que pidió el cliente; después marca que falta un producto y se le devuelve.
 *
 * Dónde corre: SOLO en esta computadora o en la revisión de GitHub, con el servidor local del
 * recorrido (TIENDAS_LOCAL=1) y Stripe simulado. En el sitio de pruebas se salta: allí se paga
 * con Stripe en modo prueba y eso lo hace Richard o el recorrido de comida, no esta prueba.
 * Con CAPTURAS=1 saca las fotos ORIGINALES de Docs (docs/capturas/tiendas y apps/panel/public/docs).
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(
  STAGING,
  'Solo local: en el sitio de pruebas el pago con tarjeta de prueba no lo hace esta prueba',
);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      correoEquipo: string;
      semilla: string;
      secretoAviso: string;
      clave: string;
    });
const CAPTURAS = process.env.CAPTURAS === '1';
const SALIDA = join(RAIZ, 'docs', 'capturas', 'tiendas');
const MIAMI = { latitude: 25.78, longitude: -80.2 };

const HOJA = [
  'sku,name_en,name_es,brand,size,size_unit,category_1,price,sale_price,available,stock_quantity,restriction,sold_by,average_weight,weight_unit',
  'T-001,Spring water,Agua de manantial,Brand Sample,500,mL,Drinks,1.25,,yes,48,,,,',
  'T-002,Orange juice,Jugo de naranja,Brand Sample,52,fl oz,Drinks,4.99,3.99,yes,20,,,,',
  'T-003,Whole milk,Leche entera,Brand Sample,1,gal,Dairy,4.20,,yes,20,,,,',
  'T-004,Greek yogurt,Yogur griego,Brand Sample,32,oz,Dairy,5.49,,yes,15,,,,',
  'T-005,White rice,Arroz blanco,Brand Sample,2,lb,Pantry,2.80,,yes,35,,,,',
  'T-006,Ground coffee,Café molido,Brand Sample,12,oz,Pantry,7.50,6.50,yes,15,,,,',
  'T-007,Bananas,Guineos,,1,lb,Produce,0.69,,yes,,,weight,2,lb',
  'T-008,Avocados,Aguacates,,1,each,Produce,1.50,,yes,30,,,,',
  'T-009,Paper towels,Toallas de papel,Brand Sample,6,each,Household,9.99,,yes,12,,,,',
  'T-010,Light beer,Cerveza ligera,Brand Sample,355,mL,Beer and wine,1.80,,yes,60,alcohol,,,',
  'T-011,Sold out soda,Refresco agotado,Brand Sample,2,L,Drinks,2.50,,no,0,,,,',
].join('\n');

for (const idioma of ['es', 'en'] as const) {
  test(`compra en una tienda con qué hacer si falta (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const D = DATOS!;
    const corrida = `${idioma}${Date.now().toString(36)}`;
    let ip = 0;
    const desde = () => ({ 'cf-connecting-ip': `10.77.${Math.floor(++ip / 250)}.${ip % 250}` });
    const hdr = (t: string) => ({ authorization: `Bearer ${t}`, 'x-idioma': idioma, ...desde() });
    const sql = (comando: string) =>
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
          comando,
        ],
        { cwd: RAIZ, stdio: 'ignore' },
      );
    const foto = async (pg: import('./fixtures').Page, nombre: string) => {
      if (!CAPTURAS) return;
      mkdirSync(SALIDA, { recursive: true });
      await pg.screenshot({ path: join(SALIDA, `${nombre}-${idioma}.png`) });
    };
    const cuenta = async (rol: 'cliente' | 'restaurante', nombre: string) => {
      const correo = `${rol}.${corrida}@tiendas.test`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: desde(),
        data: { nombre, correo, clave: D.clave, rol, telefono: '' },
      });
      expect(r.status(), await r.text()).toBeLessThan(300);
      sql(`UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`);
      return { correo, token: ((await r.json()) as { token: string }).token };
    };

    // 1. La tienda: ficha, tipo «supermercado», planilla, aprobada y abierta.
    const dueno = await cuenta('restaurante', 'Mercado Ejemplo');
    const ficha = await request.put('/datos/mi-restaurante', {
      headers: hdr(dueno.token),
      data: {
        nombre: 'Mercado Ejemplo',
        direccion: '300 Calle de Ejemplo, Miami, FL',
        lat: 25.7743,
        lng: -80.1868,
        categoria: 'Supermercado',
        telefono: '3055550199',
      },
    });
    expect(ficha.status(), await ficha.text()).toBeLessThan(300);
    const tid = ((await ficha.json()) as { restaurante: { id: string } }).restaurante.id;
    expect(
      (
        await request.put('/datos/mi-restaurante/tipo', {
          headers: hdr(dueno.token),
          data: { tipo: 'mercado' },
        })
      ).status(),
    ).toBe(200);
    const imp = await request.post('/datos/mi-restaurante/productos/importar', {
      headers: hdr(dueno.token),
      data: { csv: HOJA, confirmar: true },
    });
    expect(((await imp.json()) as { guardado: boolean }).guardado).toBe(true);
    sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${tid}'`);
    const turnos = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' }));
    await request.put('/datos/mi-restaurante/horarios', {
      headers: hdr(dueno.token),
      data: { turnos },
    });
    const abrir = await request.patch('/datos/mi-restaurante/abierto', {
      headers: hdr(dueno.token),
      data: { abierto: true },
    });
    expect(abrir.status(), await abrir.text()).toBe(200);
    await request.get('/datos/restaurante/pedidos', { headers: hdr(dueno.token) });

    // 2. El cliente en el celular: la tienda por dentro y el carrito.
    const cliente = await cuenta('cliente', 'Cliente Ejemplo');
    const cliCtx = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: D.url,
      geolocation: MIAMI,
      permissions: ['geolocation'],
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await cliCtx.addInitScript(
      ([tk, i]) => {
        localStorage.setItem('tumbite.sesion', tk);
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.ubicacion', JSON.stringify({ lat: 25.78, lng: -80.2 }));
      },
      [cliente.token, idioma],
    );
    const cli = await cliCtx.newPage();
    await cli.goto('/app/stores?servicio=mercado');
    await expect(cli.getByText('Mercado Ejemplo').first()).toBeVisible({
      timeout: 30_000,
    });
    await cli.goto(`/app/store/${tid}`);
    const nombre = (es: string, en: string) => (idioma === 'en' ? en : es);
    const agregar = idioma === 'en' ? 'Add' : 'Agregar';
    await expect(
      cli.getByRole('button', { name: `${agregar} ${nombre('Jugo de naranja', 'Orange juice')}` }),
    ).toBeVisible({
      timeout: 30_000,
    });
    // Lo agotado no sale a la venta.
    await expect(cli.getByText(nombre('Refresco agotado', 'Sold out soda'))).toHaveCount(0);
    for (const [es, en] of [
      ['Jugo de naranja', 'Orange juice'],
      ['Guineos', 'Bananas'],
      ['Cerveza ligera', 'Light beer'],
    ] as const)
      await cli.getByRole('button', { name: `${agregar} ${nombre(es, en)}` }).click();
    await cli.evaluate(() => window.scrollTo(0, 0));
    await foto(cli, 'cliente-tienda');

    await cli.goto('/app/cart');
    const siNoHay = idioma === 'en' ? 'If it’s out:' : 'Si no hay:';
    const parecido = idioma === 'en' ? 'Something similar' : 'Uno parecido';
    await cli
      .getByRole('radio', { name: `${siNoHay} ${parecido}` })
      .first()
      .click();
    await cli.getByRole('radio', { name: idioma === 'en' ? 'Hand it to me' : 'En mano' }).click();
    // La foto del carrito: arriba, con los productos y qué hacer si falta cada uno.
    await cli.getByText('Mercado Ejemplo').first().scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-carrito');
    await cli
      .getByLabel(idioma === 'en' ? 'Delivery address' : 'Dirección de entrega')
      .fill('200 S Biscayne Blvd, Apt 12');
    const [resp] = await Promise.all([
      cli.waitForResponse(
        (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
      ),
      cli
        .getByText(idioma === 'en' ? 'Continue to payment' : 'Continuar al pago')
        .filter({ visible: true })
        .click(),
    ]);
    expect(resp.status(), await resp.text()).toBe(201);
    const cobro = (await resp.json()) as {
      pedidoId: string;
      clientSecret: string;
      desglose: { subtotal: number; totalCliente: number };
    };
    // 3,99 rebajado + 0,69 × 2 lb estimadas + 1,80 = 7,17.
    expect(cobro.desglose.subtotal).toBe(717);
    // El banco autoriza la tarjeta: aviso firmado como el de Stripe (simulado, nunca dinero real).
    const cuerpo = JSON.stringify({
      id: `evt_tienda_${cobro.pedidoId}`,
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: cobro.clientSecret.split('_secret')[0],
          amount_capturable: cobro.desglose.totalCliente,
          metadata: { pedido_id: cobro.pedidoId },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const firma = createHmac('sha256', D.secretoAviso).update(`${t}.${cuerpo}`).digest('hex');
    const aviso = await request.post('/datos/stripe/aviso', {
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${firma}` },
      data: cuerpo,
    });
    expect(aviso.status()).toBe(200);

    // 3. La tienda ve el pedido con lo que quiere el cliente si falta cada producto.
    const panelCtx = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      baseURL: D.url,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await panelCtx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await panelCtx.request.post('/datos/cuentas/entrar', {
      headers: desde(),
      data: { correo: dueno.correo, clave: D.clave },
    });
    const panel = await panelCtx.newPage();
    await panel.goto(`${idioma === 'es' ? '/es' : ''}/panel/orders`);
    await expect(
      panel.getByText(
        idioma === 'en'
          ? 'If out: something similar, no extra charge'
          : 'Si no hay: uno parecido, sin cobrar de más',
      ),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      panel.getByText(idioma === 'en' ? 'If out: refund it' : 'Si no hay: reembolsar').first(),
    ).toBeVisible();
    await foto(panel, 'panel-pedido');

    // 4. Faltan los guineos: se quitan y se devuelve lo que costaron (el cobro nunca sube).
    const lineas = (
      (await (
        await request.get(`/datos/pedidos/${cobro.pedidoId}`, { headers: hdr(cliente.token) })
      ).json()) as {
        pedido: { lineas: { platoId: string; nombreEn: string }[] };
      }
    ).pedido.lineas;
    const guineos = lineas.find((l) => l.nombreEn === 'Bananas')!;
    const falta = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/falta`, {
      headers: hdr(dueno.token),
      data: { platoId: guineos.platoId },
    });
    expect(falta.status(), await falta.text()).toBe(200);

    // Se cierra la tienda de esta corrida para que no quede abierta en la base local.
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: hdr(dueno.token),
      data: { abierto: false },
    });
    await cliCtx.close();
    await panelCtx.close();
  });
}
