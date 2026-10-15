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
/**
 * Con TIENDA=apple o TIENDA=google, las fotos salen al tamaño exacto de cada tienda y van a
 * capturas-tiendas/<app>/<tienda>/<idioma>/ con un nombre que dice qué pantalla es. Ahí no se
 * guardan las de Docs (son de otro tamaño).
 */
const TIENDA = (process.env.TIENDA ?? '') as '' | 'apple' | 'google';
const CAPTURAS = process.env.CAPTURAS === '1' || TIENDA !== '';
// Apple: iPhone de 6,9" (1320 × 2868) y iPad de 13" acostado (2752 × 2064).
// Google: celular y tableta en 9:16 y 16:9 (1080 × 1920 y 1920 × 1080).
const PANTALLAS = {
  apple: {
    celular: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, ua: 'iPhone' },
    tableta: { viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2, ua: 'iPad' },
  },
  google: {
    celular: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, ua: 'Android' },
    tableta: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, ua: 'Android' },
  },
} as const;
const AGENTE = {
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  Android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
} as const;
/** Qué foto del recorrido va a qué app de la tienda, en qué orden y con qué nombre. */
const PARA_TIENDA = new Map<string, [string, string]>([
  ['cliente-inicio', ['Tumbite (cliente)', '01-inicio-restaurantes-cercanos']],
  ['cliente-menu', ['Tumbite (cliente)', '02-menu-del-restaurante']],
  ['cliente-opciones', ['Tumbite (cliente)', '02b-elige-tamano-y-extras']],
  ['cliente-carrito', ['Tumbite (cliente)', '03-carrito-con-el-precio-completo']],
  ['cliente-pagado', ['Tumbite (cliente)', '04-pago-recibido']],
  ['cliente-en-camino', ['Tumbite (cliente)', '05-pedido-en-vivo-en-el-mapa']],
  ['cliente-sellado', ['Tumbite (cliente)', '06-pedido-sellado-con-foto']],
  ['cliente-chat', ['Tumbite (cliente)', '07-chat-con-el-repartidor']],
  ['cliente-calificar', ['Tumbite (cliente)', '08-entregado-con-foto-y-calificar']],
  ['repartidor-conectado', ['Tumbite Driver (repartidor)', '01-conectado-buscando-pedidos']],
  ['repartidor-oferta', ['Tumbite Driver (repartidor)', '02-oferta-con-el-pago-antes-de-aceptar']],
  [
    'repartidor-foto-recogida',
    ['Tumbite Driver (repartidor)', '03-foto-del-pedido-en-el-restaurante'],
  ],
  ['repartidor-en-camino', ['Tumbite Driver (repartidor)', '04-en-camino-como-llegar']],
  ['repartidor-llegada', ['Tumbite Driver (repartidor)', '05-en-la-puerta-foto-de-la-entrega']],
  ['repartidor-billetera', ['Tumbite Driver (repartidor)', '06-billetera']],
  ['repartidor-retiro', ['Tumbite Driver (repartidor)', '07-retiro-al-banco']],
  ['restapp-nuevo', ['Tumbite Restaurants (restaurante)', '01-pedido-nuevo-y-tiempo-para-aceptar']],
  ['restapp-preparando', ['Tumbite Restaurants (restaurante)', '02-pedido-en-preparacion']],
  [
    'restapp-listo',
    ['Tumbite Restaurants (restaurante)', '03-confirmar-con-la-foto-del-repartidor'],
  ],
  ['restapp-entrar', ['Tumbite Restaurants (restaurante)', '04-entrar']],
]);
const MIAMI = { latitude: 25.7743, longitude: -80.1937 };
// Las «fotos» que toma el repartidor: la bolsa cerrada al recoger y al entregar (sin caras).
const FOTO_RECOGIDA = join(__dirname, 'fotos', 'bolsa-recogida.jpg');
const FOTO_ENTREGA = join(__dirname, 'fotos', 'bolsa-entrega.jpg');
const CASA = { latitude: 25.7725, longitude: -80.187 };

for (const idioma of ['en', 'es'] as const) {
  test(`recorrido completo de un pedido (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const L = TEXTOS[idioma];
    const id = `${idioma}${Date.now().toString(36)}`;
    const correo = (quien: string) => `${quien}.${id}@recorrido.test`;
    const restaurante = idioma === 'en' ? 'Bella Pizza' : 'Pizza Bella';

    const nuevoContexto = async (tipo: 'computadora' | 'celular' | 'tableta', donde = MIAMI) => {
      const t = TIENDA && tipo !== 'computadora' ? PANTALLAS[TIENDA][tipo] : null;
      const ctx: BrowserContext = await browser.newContext({
        ...(t
          ? {
              viewport: t.viewport,
              deviceScaleFactor: t.deviceScaleFactor,
              isMobile: true,
              hasTouch: true,
              userAgent: AGENTE[t.ua],
            }
          : tipo === 'celular'
            ? devices['Pixel 7']
            : { viewport: { width: 1100, height: 900 } }),
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
      // La app del repartidor (diseño del 14 oct) tiene cabecera, mapa y progreso arriba: la foto
      // se toma desde el principio de la pantalla, no desde donde quedó el último desplazamiento.
      if (nombre.startsWith('repartidor-'))
        await pagina.evaluate(() => {
          window.scrollTo(0, 0);
          document.querySelectorAll('div').forEach((d) => {
            if (d.scrollHeight > d.clientHeight + 4) d.scrollTop = 0;
          });
        });
      // La burbuja de ayuda se esconde solo durante la foto (no se quita: la pantalla la sigue usando).
      await pagina.evaluate(() =>
        document
          .querySelectorAll<HTMLElement>('[class*=burbuja]')
          .forEach((e) => (e.style.visibility = 'hidden')),
      );
      if (TIENDA) {
        const destino = PARA_TIENDA.get(nombre);
        if (destino) {
          const dir = join(
            RAIZ,
            'capturas-tiendas',
            destino[0],
            TIENDA === 'apple' ? 'Apple App Store' : 'Google Play',
            idioma === 'en' ? 'English' : 'Español',
            pagina.viewportSize()!.width > pagina.viewportSize()!.height ? 'Tableta' : 'Celular',
          );
          mkdirSync(dir, { recursive: true });
          await pagina.screenshot({ path: join(dir, `${destino[1]}.png`) });
        }
      } else {
        const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
        mkdirSync(dir, { recursive: true });
        await pagina.screenshot({ path: join(dir, `${nombre}-${idioma}.png`) });
      }
      await pagina.evaluate(() =>
        document
          .querySelectorAll<HTMLElement>('[class*=burbuja]')
          .forEach((e) => (e.style.visibility = '')),
      );
    };

    /**
     * Consulta a la base de prueba (solo la local de .recorrido; nunca otra). Si wrangler falla un
     * instante (la base ocupada por el servidor, pasa en GitHub), se reintenta hasta tres veces.
     */
    const sql = (comando: string, intento = 1): Record<string, unknown>[] => {
      try {
        return sqlUnaVez(comando);
      } catch (e) {
        if (intento >= 3) throw e;
        execFileSync('sleep', ['1']);
        return sql(comando, intento + 1);
      }
    };
    const sqlUnaVez = (comando: string): Record<string, unknown>[] => {
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
    /** Un aviso de Stripe firmado como el de verdad (el pago aprobado, la cuenta del banco lista). */
    const avisoStripe = async (tipo: string, objeto: Record<string, unknown>) => {
      const cuerpo = JSON.stringify({
        id: `evt_${tipo}_${String(objeto.id)}`,
        type: tipo,
        data: { object: objeto },
      });
      const t = Math.floor(Date.now() / 1000);
      const firma = createHmac('sha256', DATOS.secretoAviso).update(`${t}.${cuerpo}`).digest('hex');
      const r = await request.post('/datos/stripe/aviso', {
        headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${firma}` },
        data: cuerpo,
      });
      expect(r.status()).toBe(200);
    };

    // Si el recorrido del otro idioma se cayó a medias, sus pedidos sin repartidor no se le deben
    // ofrecer al repartidor de este: se cierran antes de empezar.
    sql(
      "UPDATE pedidos SET estado = 'cancelado' WHERE estado IN ('aceptado','listo') AND repartidor_id IS NULL",
    );
    // Y ningún repartidor de un recorrido anterior se queda conectado (se llevaría la oferta).
    sql('UPDATE repartidores SET conectado = 0');

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
    // La lista de activación: todavía faltan el horario y los platos (y lo recomendado).
    const activacion = panel.getByLabel(L.activacion);
    await expect(activacion.locator('.activacion-ok')).toHaveCount(2);
    await expect(activacion.locator('.activacion-falta')).toHaveCount(4);
    await activacion.scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-activacion');

    // 1b. El horario: abierto todo el día, todos los días (el recorrido corre a cualquier hora).
    const horario = panel.locator('form.horarios');
    await horario.getByRole('button', { name: L.turno }).nth(1).click(); // lunes
    await horario.getByLabel(L.abre).fill('00:00');
    await horario.getByLabel(L.cierra).fill('23:59');
    await horario.getByRole('button', { name: L.copiarLunes }).click();
    await expect(horario.getByLabel(L.abre)).toHaveCount(7);
    await foto(panel, 'restaurante-horarios');
    await horario.getByRole('button', { name: L.guardarHorario }).click();
    await expect(horario.getByText(L.horarioGuardado)).toBeVisible();

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
    // 2b. Opciones de la pizza: tamaño mediana o grande (+4).
    const pizzaNombre = idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita';
    const filaPizza = panel
      .locator('li', { hasText: pizzaNombre })
      .filter({ has: panel.getByRole('button', { name: L.masOpciones }) })
      .first();
    await filaPizza.getByRole('button', { name: L.masOpciones }).click();
    await panel.getByRole('menuitem', { name: L.editar }).click();
    await panel.getByRole('button', { name: L.nuevoGrupo, exact: true }).click();
    await panel.getByLabel(L.nombreGrupoEs).fill('Tamaño');
    await panel.getByLabel(L.nombreGrupoEn).fill('Size');
    await panel.getByLabel(L.opcionEs).first().fill('Mediana');
    await panel.getByLabel(L.opcionEn).first().fill('Medium');
    await panel.getByRole('button', { name: L.nuevaOpcion, exact: true }).click();
    await panel.getByLabel(L.opcionEs).nth(1).fill('Grande');
    await panel.getByLabel(L.opcionEn).nth(1).fill('Large');
    await panel.getByLabel(L.precioExtra).nth(1).fill('4.00');
    await foto(panel, 'restaurante-opciones');
    await panel.getByRole('button', { name: L.guardarPlato }).click();
    await expect(panel.getByText(/with options|con opciones/).first()).toBeVisible();
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

    // Para las tiendas, el inicio muestra más de un restaurante cerca (cuentas de prueba locales).
    if (TIENDA) {
      const otros = [
        [
          'Sakura Sushi Bar',
          'Sushi',
          'Sushi y rolls hechos al momento.',
          'Fresh sushi and rolls made to order.',
          [
            ['Roll de salmón', 'Salmon roll', 1200],
            ['Edamame', 'Edamame', 550],
          ],
          25.7762,
          -80.1917,
        ],
        [
          'Taquería El Sol',
          'Mexican',
          'Tacos al pastor y salsas de la casa.',
          'Al pastor tacos and house-made salsas.',
          [
            ['Tacos al pastor', 'Al pastor tacos', 1100],
            ['Guacamole', 'Guacamole', 750],
          ],
          25.7716,
          -80.1951,
        ],
        [
          'Green Bowl Kitchen',
          'Healthy',
          'Bowls y ensaladas frescas.',
          'Fresh bowls and salads.',
          [
            ['Bowl de pollo', 'Chicken bowl', 1350],
            ['Jugo verde', 'Green juice', 600],
          ],
          25.7781,
          -80.1889,
        ],
      ] as const;
      const yaEstan = new Set(lista.restaurantes.map((r) => r.nombre));
      for (const [nombre, cat, descEs, descEn, platos, lat, lng] of otros) {
        if (yaEstan.has(nombre)) continue;
        const reg = await request.post('/datos/cuentas/registro', {
          data: {
            nombre: 'Dueño de prueba',
            correo: `${nombre.toLowerCase().replace(/[^a-z]+/g, '')}.${id}@recorrido.test`,
            clave: DATOS.clave,
            rol: 'restaurante',
          },
        });
        const h = { authorization: `Bearer ${((await reg.json()) as { token: string }).token}` };
        await request.put('/datos/mi-restaurante', {
          headers: h,
          data: {
            nombre,
            categoria: cat,
            descripcionEs: descEs,
            descripcionEn: descEn,
            direccion: 'Miami, FL',
            telefono: '3055550199',
            lat,
            lng,
          },
        });
        for (const [es, en, precio] of platos)
          await request.post('/datos/mi-restaurante/platos', {
            headers: h,
            data: {
              nombreEs: es,
              nombreEn: en,
              categoria: 'Menú',
              categoriaEn: 'Menu',
              precioCentavos: precio,
            },
          });
        const todos = (await (
          await request.get('/datos/admin/restaurantes', { headers: auth })
        ).json()) as { restaurantes: { id: string; nombre: string }[] };
        const nuevo = todos.restaurantes.find((r) => r.nombre === nombre)!;
        await request.patch(`/datos/admin/restaurantes/${nuevo.id}`, {
          headers: auth,
          data: { estado: 'aprobado' },
        });
        expect(
          (
            await request.patch('/datos/mi-restaurante/abierto', {
              headers: h,
              data: { abierto: true },
            })
          ).status(),
        ).toBe(200);
      }
    }

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
    // Identidad continua: al intentar conectarse, la app le pide una foto de control (en el
    // recorrido se pide siempre). La toma y recién ahí se conecta.
    await rep
      .getByRole('switch')
      .or(rep.getByRole('button', { name: L.conectarme }))
      .first()
      .click();
    await expect(rep.getByRole('button', { name: L.tomarSelfie })).toBeVisible({ timeout: 20_000 });
    await foto(rep, 'repartidor-foto-identidad');
    const [selectorSelfie] = await Promise.all([
      rep.waitForEvent('filechooser'),
      rep.getByRole('button', { name: L.tomarSelfie }).click(),
    ]);
    await selectorSelfie.setFiles(FOTO_RECOGIDA);
    await expect(rep.getByText(L.selfieLista)).toBeVisible({ timeout: 20_000 });
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
    await expect(cli.getByText(restaurante)).toBeVisible({ timeout: 20_000 });
    await cli.waitForTimeout(CAPTURAS ? 1500 : 0);
    await foto(cli, 'cliente-inicio');
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
    /** El restaurante rechaza un pedido desde los tres puntos de su fila (el cliente recibe su dinero). */
    const rechazarEnPanel = async (pedidoId: string) => {
      await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
      const codigo = pedidoId.slice(0, 4).toUpperCase();
      // La fila de ESE pedido: el ⋮ que está junto a su número.
      const fila = panel
        .locator('strong', { hasText: `#${codigo}` })
        .locator(`xpath=ancestor::*[.//button[@aria-label="${L.masOpciones}"]][1]`);
      await expect(fila).toBeVisible({ timeout: 20_000 });
      panel.once('dialog', (d) => void d.accept());
      await fila.getByRole('button', { name: L.masOpciones }).click();
      await panel.getByRole('menuitem', { name: L.rechazar }).click();
      await expect(panel.locator('strong', { hasText: `#${codigo}` })).toContainText(
        /Canceled|Cancelado/,
      );
    };
    /** Del menú al pago: agrega los platos, va al carrito, paga y el banco aprueba (simulado). */
    const pedirYPagar = async (
      platos: string[],
      fotoCarrito?: string,
      modo?: 'recoger',
    ): Promise<Cobro> => {
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
      for (const p of platos) {
        await cli
          .getByRole('button', { name: `${L.agregar} ${p}` })
          .filter({ visible: true })
          .click();
        // La pizza pide tamaño: se elige «Grande» (+4) y se agrega.
        if (p === plato.pizza) {
          const grande = cli.getByRole('radio', { name: L.grande });
          await expect(grande).toBeVisible({ timeout: 10_000 });
          if (fotoCarrito) {
            await cli.waitForTimeout(900); // la ventana termina de subir
            await foto(cli, 'cliente-opciones');
          }
          await grande.click();
          await cli.getByRole('button', { name: L.agregarAlCarrito }).click();
        }
      }
      await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
      if (modo === 'recoger') {
        // Recogida en el local: sin dirección ni envío.
        await cli.getByRole('radio', { name: L.recojo }).click();
        await expect(cli.getByLabel(L.direccionEntrega)).toHaveCount(0);
      } else {
        // El borrador del carrito recuerda la última elección: se vuelve a «En la puerta».
        await cli.getByRole('radio', { name: L.enPuerta }).click();
        await cli.getByLabel(L.direccionEntrega).fill('200 S Biscayne Blvd, Apt 12');
      }
      if (fotoCarrito) {
        await mapaListo(cli);
        // Para Docs: cómo se ve «En mano» con el interruptor del PIN; luego vuelve a «En la puerta».
        await cli.getByRole('radio', { name: L.enMano }).click();
        await expect(cli.getByRole('switch', { name: L.pinTitulo })).toBeVisible();
        await cli.getByRole('switch', { name: L.pinTitulo }).scrollIntoViewIfNeeded();
        await foto(cli, 'cliente-carrito-mano');
        await cli.getByRole('radio', { name: L.enPuerta }).click();
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
      // El banco AUTORIZA la tarjeta (se cobra al entregar): aviso firmado de Stripe, como el de verdad.
      await avisoStripe('payment_intent.amount_capturable_updated', {
        id: c.clientSecret.split('_secret')[0],
        amount_capturable: c.desglose.totalCliente,
        metadata: { pedido_id: c.pedidoId },
      });
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
    // Para las tiendas: la app del restaurante en celular y en tableta, con el mismo pedido.
    const restApps: Page[] = [];
    if (TIENDA) {
      for (const tipo of ['celular', 'tableta'] as const) {
        const ctx = await nuevoContexto(tipo);
        const p = await ctx.newPage();
        await p.goto('/restaurant/');
        await expect(p.getByLabel(L.correo)).toBeVisible({ timeout: 20_000 });
        await foto(p, 'restapp-entrar');
        await p.getByLabel(L.correo).fill(correo('restaurante'));
        await p.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
        await p.getByRole('button', { name: idioma === 'en' ? 'Sign in' : 'Entrar' }).click();
        await expect(
          p.getByText(`#${cobro.pedidoId.slice(0, 4).toUpperCase()}`).first(),
        ).toBeVisible({ timeout: 20_000 });
        await foto(p, 'restapp-nuevo');
        restApps.push(p);
      }
    }
    const fotoRestApps = async (nombre: string) => {
      for (const p of restApps) {
        await p.reload();
        await expect(
          p.getByText(`#${cobro.pedidoId.slice(0, 4).toUpperCase()}`).first(),
        ).toBeVisible({ timeout: 20_000 });
        await p.waitForTimeout(800);
        await foto(p, nombre);
      }
    };
    // Cocina ocupada: +10 minutos sube el tiempo sugerido (20 → 30); después vuelve a normal.
    const cocina = panel.getByLabel(L.cocina);
    await cocina.getByRole('button', { name: `+10 ${L.min}` }).click();
    await expect(
      panel.getByRole('button', { name: `${L.aceptar} · 30 ${L.min} · ${L.sugerido}` }),
    ).toBeVisible({ timeout: 20_000 });
    await foto(panel, 'restaurante-cocina-ocupada');
    await cocina.getByRole('button', { name: idioma === 'en' ? 'Normal' : 'Normal' }).click();
    await expect(
      panel.getByRole('button', { name: `${L.aceptar} · 20 ${L.min} · ${L.sugerido}` }),
    ).toBeVisible({ timeout: 20_000 });
    await panel.getByRole('button', { name: `${L.aceptar} · 20` }).click();
    await expect(panel.getByRole('button', { name: L.listo })).toBeVisible();
    await foto(panel, 'restaurante-pedido-aceptado');
    await fotoRestApps('restapp-preparando');
    await panel.getByRole('button', { name: L.listo }).click();

    // 7. El repartidor acepta y, en el restaurante, toma la foto del pedido cerrado.
    await expect(rep.getByRole('button', { name: L.aceptarOferta, exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await foto(rep, 'repartidor-oferta');
    // Oferta abierta con bono: cuando tres repartidores la dejaron pasar, se ofrece a todos con
    // $1 extra (aquí se simula el bono en la base para verla en pantalla).
    sql(
      `INSERT OR IGNORE INTO bonos_pedido (pedido_id, centavos, motivo) VALUES ('${cobro.pedidoId}', 100, 'oferta_abierta')`,
    );
    await expect(rep.getByText(L.bono, { exact: false })).toBeVisible({ timeout: 20_000 });
    await foto(rep, 'repartidor-oferta-bono');
    await rep.getByRole('button', { name: L.aceptarOferta, exact: true }).click();
    const tomarFoto = async (boton: string, archivo: string) => {
      const [selector] = await Promise.all([
        rep.waitForEvent('filechooser'),
        rep.getByRole('button', { name: boton }).filter({ visible: true }).click(),
      ]);
      await selector.setFiles(archivo);
    };
    await tomarFoto(L.fotoRecogida, FOTO_RECOGIDA);
    await expect(rep.getByText(L.esperaConfirmacion).filter({ visible: true })).toBeVisible({
      timeout: 20_000,
    });
    await foto(rep, 'repartidor-foto-recogida');
    // Sin la confirmación del restaurante, el pedido NO sale.
    expect(sql(`SELECT estado FROM pedidos WHERE id = '${cobro.pedidoId}'`)[0]?.estado).toBe(
      'listo',
    );

    // 8. El restaurante ve la foto en su pantalla y confirma que se lo entregó.
    await fotoRestApps('restapp-listo');
    await Promise.all(restApps.map((p) => p.context().close()));
    const confirmar = panel.getByRole('button', { name: L.confirmarRecogida });
    await expect(confirmar).toBeVisible({ timeout: 20_000 });
    await expect(panel.locator('.foto-recogida img')).toBeVisible();
    await expect(panel.locator('.qr-pedido img')).toBeVisible();
    await foto(panel, 'restaurante-confirmar-recogida');
    // El repartidor escribe el número de la pantalla (en el celular lo escanea): con el código
    // verificado y la foto ya tomada, el pedido sale solo, sin que el restaurante toque nada.
    await rep.getByLabel(L.escribirCodigo).fill(cobro.pedidoId.slice(0, 4).toUpperCase());
    await rep.getByRole('button', { name: L.verificar }).click();
    await expect
      .poll(() => sql(`SELECT estado FROM pedidos WHERE id = '${cobro.pedidoId}'`)[0]?.estado, {
        timeout: 20_000,
      })
      .toBe('en_camino');

    // 9. En camino: «Cómo llegar» mientras está lejos; el cliente ve su pedido sellado.
    // Espera la pantalla de entrega (en la de recogida también hay un «Cómo llegar», al restaurante).
    await expect(rep.getByText(/^(Deliver to|Entrega en):$/).filter({ visible: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    const irCasa = rep.getByRole('button', { name: L.comoLlegar }).filter({ visible: true });
    await expect(irCasa).toBeVisible();
    // Lejos de la casa: «Cómo llegar» en verde y todavía no hay botón de entregar.
    await expect(irCasa).toHaveCSS('background-color', 'rgb(13, 122, 58)');
    await expect(rep.getByRole('button', { name: L.fotoEntrega })).toHaveCount(0);
    await foto(rep, 'repartidor-en-camino');
    // Llamada con número oculto (Twilio simulado): el repartidor toca «Llamar al cliente».
    await rep.getByRole('button', { name: L.llamarCliente }).filter({ visible: true }).click();
    await expect(rep.getByText(L.llamando, { exact: false })).toBeVisible({ timeout: 20_000 });
    await foto(rep, 'repartidor-llamar');
    await cli.reload();
    await expect(
      cli.getByText(/Your driver is on the way|Tu repartidor va en camino/),
    ).toBeVisible();
    await mapaListo(cli);
    await foto(cli, 'cliente-en-camino');
    // …y el cliente también puede llamar al repartidor, sin ver su número.
    await cli.getByRole('button', { name: L.llamarRepartidor }).scrollIntoViewIfNeeded();
    await cli.getByRole('button', { name: L.llamarRepartidor }).click();
    await expect(cli.getByText(L.llamando, { exact: false })).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-llamar');
    const sellado = cli.getByLabel(
      /Your order left the restaurant|Tu pedido salió del restaurante/,
    );
    await expect(sellado.first()).toBeVisible({ timeout: 20_000 });
    await expect(cli.getByText(L.aMasTardar, { exact: false })).toBeVisible();
    await sellado.first().scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-sellado');
    // El chat del pedido: el cliente escribe, el repartidor lo lee (sin números de teléfono).
    const textoChat =
      idioma === 'en' ? 'Ring the bell twice, please' : 'Toca el timbre dos veces, por favor';
    await cli.getByLabel(L.chatEscribe).fill(textoChat);
    await cli.getByRole('button', { name: L.chatEnviar }).click();
    await expect(cli.getByText(textoChat)).toBeVisible({ timeout: 20_000 });
    await cli.getByText(textoChat).scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-chat');
    await expect(rep.getByText(textoChat)).toBeVisible({ timeout: 20_000 });
    const respuesta = idioma === 'en' ? 'On my way, 3 minutes' : 'Voy en camino, 3 minutos';
    await rep.getByLabel(L.chatEscribe).fill(respuesta);
    await rep.getByRole('button', { name: L.chatEnviar }).click();
    await expect(cli.getByText(respuesta)).toBeVisible({ timeout: 20_000 });

    // 10. GPS serio: en un edificio el GPS no marca la puerta. El repartidor pide la excepción
    // «No puedo confirmar mi ubicación» con su motivo; soporte la autoriza desde el panel y
    // queda en la bitácora. Mientras, el GPS también llega a la puerta (dos lecturas precisas).
    await rep
      .getByLabel(L.sinGpsAyuda)
      .fill(
        idioma === 'en'
          ? 'Tall building, GPS shows the next street'
          : 'Edificio alto, el GPS marca la otra calle',
      );
    await rep.getByRole('button', { name: L.pedirExcepcion }).click();
    await expect(rep.getByText(L.esperandoSoporte, { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await foto(rep, 'repartidor-sin-gps');
    expect(
      (
        await request.post(`/datos/admin/pedidos/${cobro.pedidoId}/autorizar-ubicacion`, {
          headers: auth,
        })
      ).status(),
    ).toBe(200);
    await repCtx.setGeolocation(CASA);
    // Llega a la puerta: se quita «Cómo llegar» y aparece la foto de la entrega.
    await expect(
      rep.getByRole('button', { name: L.fotoEntrega }).filter({ visible: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(rep.getByRole('button', { name: L.comoLlegar })).toHaveCount(0);
    await foto(rep, 'repartidor-llegada');
    // 11. Sin señal al entregar: la foto se guarda en el celular, «pendiente de confirmar», y se
    // manda sola cuando vuelve la señal. El pedido NO queda entregado hasta entonces.
    await repCtx.setOffline(true);
    await tomarFoto(L.fotoEntrega, FOTO_ENTREGA);
    await expect(rep.getByText(`${L.pendientes}: 1`)).toBeVisible({ timeout: 20_000 });
    expect(sql(`SELECT estado FROM pedidos WHERE id = '${cobro.pedidoId}'`)[0]?.estado).toBe(
      'en_camino',
    );
    await foto(rep, 'repartidor-sin-senal');
    await repCtx.setOffline(false);
    await expect
      .poll(() => sql(`SELECT estado FROM pedidos WHERE id = '${cobro.pedidoId}'`)[0]?.estado, {
        timeout: 40_000,
      })
      .toBe('entregado');
    await expect(rep.getByText(`${L.pendientes}: 1`)).toHaveCount(0, { timeout: 20_000 });
    // Propina después de entregar: el cliente deja $2 extra con su tarjeta guardada.
    await cli.goto(`/app/order/${cobro.pedidoId}`);
    const dosDolares = cli.getByRole('button', { name: /\$2\.00/ }).first();
    await expect(dosDolares).toBeVisible({ timeout: 20_000 });
    await dosDolares.scrollIntoViewIfNeeded();
    await foto(cli, 'cliente-propina-despues');
    await dosDolares.click();
    await expect(cli.getByText(L.propinaGracias)).toBeVisible({ timeout: 20_000 });
    await repCtx.setGeolocation(MIAMI);

    // El repartidor termina su turno: así no se queda «libre» para el recorrido siguiente.
    await rep.getByText(L.desconectarme).filter({ visible: true }).click();

    // 11. El cliente lo ve entregado y califica.
    await cli.reload();
    await expect(cli.getByText(L.entregado)).toBeVisible({ timeout: 20_000 });
    await expect(cli.getByLabel(/How your order was left|Así quedó tu pedido/).first()).toBeVisible(
      { timeout: 20_000 },
    );
    await cli.getByRole('button', { name: L.estrellas(L.laComida, 5) }).click();
    await cli.getByRole('button', { name: L.estrellas(`${L.tuRepartidor}: Luis`, 5) }).click();
    await foto(cli, 'cliente-calificar');
    await cli.getByRole('button', { name: L.enviarCalificacion }).click();

    // 12. Regalo de cumpleaños: el restaurante aparta el 20 % y regala los nudos de ajo.
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

    // 13. El cliente paga y se arrepiente: cancela antes de que el restaurante acepte.
    const conRegalo = await pedirYPagar([]);
    await cli.goto(`/app/order/${conRegalo.pedidoId}`);
    await cli.getByText(L.cancelarPedido).filter({ visible: true }).click();
    await foto(cli, 'cliente-cancelar');
    await cli.getByText(L.siCancelar).filter({ visible: true }).click();
    await expect(cli.getByText(L.cancelasteTu, { exact: false })).toBeVisible();
    await foto(cli, 'cliente-cancelado');

    // 14. El restaurante no puede atender un pedido y lo rechaza: el cliente recibe su dinero.
    const rechazado = await pedirYPagar([plato.pizza]);
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    await rechazarEnPanel(rechazado.pedidoId);
    await cli.goto(`/app/order/${rechazado.pedidoId}`);
    await expect(cli.getByText(L.rechazado, { exact: false })).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-rechazado');

    // 14b. Algo agotado: el restaurante marca el plato que no tiene; el cliente lo quita y se le
    //      devuelve esa parte; el resto del pedido sigue.
    const agotado = await pedirYPagar([plato.pizza, plato.limonada]);
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    const filaAgotado = panel
      .locator('strong', { hasText: `#${agotado.pedidoId.slice(0, 4).toUpperCase()}` })
      .locator(`xpath=ancestor::*[.//button[@aria-label="${L.masOpciones}"]][1]`);
    await expect(filaAgotado).toBeVisible({ timeout: 20_000 });
    await filaAgotado.getByRole('button', { name: L.masOpciones }).click();
    await panel.getByRole('menuitem', { name: L.faltaPlato }).click();
    await filaAgotado.getByRole('combobox').selectOption({ label: plato.limonada });
    await foto(panel, 'restaurante-falta-plato');
    await filaAgotado.getByRole('button', { name: L.avisarFalta }).click();
    await cli.goto(`/app/order/${agotado.pedidoId}`);
    const quitar = cli.getByRole('button', { name: L.quitarPlato, exact: false });
    await expect(quitar).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-falta-plato');
    await quitar.click();
    await expect(cli.getByText(L.quitadoOk, { exact: false })).toBeVisible({ timeout: 20_000 });
    expect(
      Number(sql(`SELECT total FROM pedidos WHERE id = '${agotado.pedidoId}'`)[0]?.total),
    ).toBeLessThan(agotado.desglose.totalCliente);
    await rechazarEnPanel(agotado.pedidoId);

    // 15. El Manager: un pedido que nadie confirma se pone en rojo y a los 6 minutos se cancela
    //     solo, con la devolución. El reloj se adelanta en la base de prueba, no se espera.
    const olvidado = await pedirYPagar([plato.pizza]);
    // Antes de que el restaurante lo acepte, el cliente cambia la dirección de entrega.
    await cli.goto(`/app/order/${olvidado.pedidoId}`);
    await cli.getByLabel(L.nuevaDireccion).fill('350 NE 2nd Ave, Miami');
    await cli.getByRole('button', { name: L.aplicarDireccion }).click();
    await expect(cli.getByText(L.direccionCambiada)).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-cambiar-direccion');
    const atrasar = (minutos: number) =>
      sql(
        `UPDATE pedidos SET pagado_en = datetime('now','-${minutos} minutes') WHERE id = '${olvidado.pedidoId}'`,
      );
    atrasar(4);
    await panel.reload();
    await expect(panel.getByText(/In trouble|En problemas/).first()).toBeVisible({
      timeout: 20_000,
    });
    await foto(panel, 'restaurante-semaforo-rojo');
    atrasar(7);
    await cli.goto(`/app/order/${olvidado.pedidoId}`);
    await expect(cli.getByText(L.managerCancela, { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    await foto(cli, 'cliente-manager-cancela');
    // 16. Recogida en el local: sin repartidor; el restaurante entrega en el mostrador con el PIN.
    const recogida = await pedirYPagar([plato.pizza], undefined, 'recoger');
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    await expect(
      panel.getByText(`#${recogida.pedidoId.slice(0, 4).toUpperCase()}`).first(),
    ).toBeVisible({ timeout: 20_000 });
    // La lista se refresca cada 5 s: si el clic cae en medio del refresco, se repite una vez.
    const aceptarRecogida = panel.getByRole('button', { name: `${L.aceptar} · 20` }).first();
    const listoRecogida = panel.getByRole('button', { name: L.listo }).first();
    await aceptarRecogida.click();
    try {
      await expect(listoRecogida).toBeVisible({ timeout: 15_000 });
    } catch {
      await aceptarRecogida.click();
      await expect(listoRecogida).toBeVisible({ timeout: 15_000 });
    }
    await listoRecogida.click();
    await expect(panel.getByLabel(L.pinCliente)).toBeVisible({ timeout: 20_000 });
    await foto(panel, 'restaurante-recoger');
    await cli.goto(`/app/order/${recogida.pedidoId}`);
    await expect(cli.getByText(L.recogerEnLocal)).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-recoger');
    const pinRecogida = String(
      sql(`SELECT pin FROM pines_entrega WHERE pedido_id = '${recogida.pedidoId}'`)[0]?.pin ?? '',
    );
    await panel.getByLabel(L.pinCliente).fill(pinRecogida);
    await panel.getByRole('button', { name: L.entregadoLocal }).click();
    await expect
      .poll(() => sql(`SELECT estado FROM pedidos WHERE id = '${recogida.pedidoId}'`)[0]?.estado, {
        timeout: 20_000,
      })
      .toBe('entregado');

    // 17. El dinero de cada uno. El restaurante ve su día: lo entregado (la entrega a domicilio y
    //     la recogida en el local, con su comisión del 5 %).
    await panel.getByRole('link', { name: L.beneficios, exact: true }).click();
    const pagoRest = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-US', {
      style: 'currency',
      currency: 'USD',
    }).format((cobro.desglose.pagoRestaurante + recogida.desglose.pagoRestaurante) / 100);
    await expect(panel.getByText(L.teToca).locator('..')).toContainText(pagoRest);
    // La calculadora «Comparado con otras apps» usa sus ventas reales y lo propio sale primero.
    const compara = panel.getByRole('region', {
      name: /Compared with other apps|Comparado con otras apps/,
    });
    // La comparación usa el plan sobre TODAS sus ventas (la recogida al 5 % la mejora aún más):
    // lo que importa es que con Tumbite le queda más que con los otros.
    await expect(compara).toContainText(/DoorDash Basic/);
    const textoCompara = await compara.innerText();
    const montoTumbite = Number(/Tumbite[^$]*\$(\d+\.\d\d)/.exec(textoCompara)?.[1] ?? '0');
    const montoDoorDash = Number(/DoorDash Basic[^$]*\$(\d+\.\d\d)/.exec(textoCompara)?.[1] ?? '0');
    expect(montoTumbite).toBeGreaterThan(montoDoorDash);
    await expect(compara).toContainText(/Uber Eats Lite/);
    await foto(panel, 'restaurante-beneficios');

    // El repartidor ve su billetera, conecta su banco (en Stripe) y retira todo.
    await rep.goto('/driver/');
    await rep.getByText(L.verBilletera).filter({ visible: true }).click();
    await expect(rep.getByText(L.disponible).filter({ visible: true })).toBeVisible();
    await foto(rep, 'repartidor-billetera');
    const [stripePagina] = await Promise.all([
      repCtx.waitForEvent('page'),
      rep.getByText(L.conectarBanco).filter({ visible: true }).click(),
    ]);
    await stripePagina.close(); // la página de Stripe (simulada) no se carga en la prueba
    const cuenta = sql(
      `SELECT c.stripe_cuenta AS id FROM cuentas_stripe c JOIN usuarios u ON u.id = c.usuario_id WHERE u.correo = '${correo('repartidor')}'`,
    )[0]?.id;
    expect(cuenta, 'la cuenta del banco del repartidor quedó creada').toBeTruthy();
    await avisoStripe('account.updated', {
      id: cuenta,
      payouts_enabled: true,
      charges_enabled: true,
    });
    await rep.goto('/driver/');
    await rep.getByText(L.verBilletera).filter({ visible: true }).click();
    await rep.getByText(L.retirar).filter({ visible: true }).click();
    await expect(rep.getByText(L.retiroEnCamino).filter({ visible: true })).toBeVisible();
    await foto(rep, 'repartidor-retiro');
    const saldo = sql(
      `SELECT COALESCE(SUM(m.monto), 0) AS s FROM movimientos m JOIN usuarios u ON u.id = m.usuario_id WHERE u.correo = '${correo('repartidor')}'`,
    )[0]?.s;
    expect(Number(saldo), 'después de retirar todo, el saldo queda en cero').toBe(0);

    // 17. Rechazar una oferta no castiga: la oferta se va y el repartidor sigue buscando.
    await rep.goto('/driver/');
    await rep
      .getByRole('switch')
      .or(rep.getByRole('button', { name: L.conectarme }))
      .first()
      .click();
    const otro = await pedirYPagar([plato.pizza]);
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    await panel
      .getByRole('button', { name: `${L.aceptar} · 10` })
      .first()
      .click();
    // Con el despacho con reloj, la oferta sale cuando falta poco para la hora de listo: el reloj
    // se adelanta en la base (así el pedido sigue «aceptado» y el restaurante lo puede rechazar).
    sql(
      `UPDATE pedidos SET aceptado_en = datetime('now','-9 minutes') WHERE id = '${otro.pedidoId}'`,
    );
    await expect(rep.getByRole('button', { name: L.noGracias })).toBeVisible({ timeout: 30_000 });
    await rep.getByRole('button', { name: L.noGracias }).click();
    await expect(rep.getByText(L.buscando).filter({ visible: true })).toBeVisible();
    const sinRepartidor = sql(
      `SELECT repartidor_id AS r FROM pedidos WHERE id = '${otro.pedidoId}'`,
    )[0]?.r;
    expect(sinRepartidor ?? null, 'el pedido rechazado no se le asigna').toBeNull();
    await rep.getByText(L.desconectarme).filter({ visible: true }).click();
    // Nadie más lo toma: el restaurante lo rechaza y el cliente recibe su dinero. Así no queda
    // ningún pedido colgado para la corrida siguiente.
    await rechazarEnPanel(otro.pedidoId);

    // Para las tiendas: el restaurante de este idioma se cierra, así no sale en las fotos del otro.
    if (TIENDA) sql(`UPDATE restaurantes SET abierto = 0 WHERE nombre = '${restaurante}'`);
    await Promise.all([panelCtx.close(), repCtx.close(), cliCtx.close()]);
  });
}
