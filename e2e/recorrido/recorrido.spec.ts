import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, type Locator, type Page, devices, expect, test } from './fixtures';
import { TEXTOS } from './textos';

/**
 * El recorrido completo de Divoox en el navegador, como lo haría la gente: el restaurante se
 * registra y arma su menú, nuestro equipo lo aprueba, el cliente se registra, pide y paga (con
 * Stripe simulado), el restaurante acepta, el repartidor se conecta, acepta, recoge y entrega, y
 * el cliente califica. Al final el dinero tiene que cuadrar al centavo.
 *
 * Dos cosas en una: es la prueba de punta a punta de cada publicación y, con CAPTURAS=1, guarda
 * las capturas reales para Docs (docs/capturas/<nombre>-<idioma>.png).
 */
const RAIZ = join(__dirname, '..', '..');
/**
 * EN EL SITIO DE PRUEBAS (RECORRIDO_URL=https://staging.tumbite.com y RECORRIDO_SECRETO): el
 * mismo recorrido contra el sitio publicado, con Stripe en MODO PRUEBA de verdad. El pago se hace
 * con la tarjeta de prueba de Stripe y el aviso (webhook) es el real de Stripe. La base se lee por
 * la ruta de diagnóstico del sitio de pruebas (solo existe allí). Nunca contra producción.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('El recorrido remoto solo corre contra el sitio de pruebas.');
const DATOS = (
  STAGING
    ? {
        url: process.env.RECORRIDO_URL,
        correoEquipo: `soporte.recorrido.${Date.now().toString(36)}@recorrido.test`,
        semilla: '',
        secretoAviso: '',
        clave: `Recorrido-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`,
      }
    : JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'))
) as {
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
  ['cliente-inicio', ['Divoox (cliente)', '01-inicio-restaurantes-cercanos']],
  ['cliente-restaurantes', ['Divoox (cliente)', '01b-restaurantes-de-comida']],
  ['cliente-menu', ['Divoox (cliente)', '02-menu-del-restaurante']],
  ['cliente-opciones', ['Divoox (cliente)', '02b-elige-tamano-y-extras']],
  ['cliente-carrito', ['Divoox (cliente)', '03-carrito-con-el-precio-completo']],
  ['cliente-pagado', ['Divoox (cliente)', '04-pago-recibido']],
  ['cliente-en-camino', ['Divoox (cliente)', '05-pedido-en-vivo-en-el-mapa']],
  ['cliente-sellado', ['Divoox (cliente)', '06-pedido-sellado-con-foto']],
  ['cliente-chat', ['Divoox (cliente)', '07-chat-con-el-repartidor']],
  ['cliente-calificar', ['Divoox (cliente)', '08-entregado-con-foto-y-calificar']],
  ['repartidor-conectado', ['Divoox Driver (repartidor)', '01-conectado-buscando-pedidos']],
  ['repartidor-oferta', ['Divoox Driver (repartidor)', '02-oferta-con-el-pago-antes-de-aceptar']],
  [
    'repartidor-foto-recogida',
    ['Divoox Driver (repartidor)', '03-foto-del-pedido-en-el-restaurante'],
  ],
  ['repartidor-en-camino', ['Divoox Driver (repartidor)', '04-en-camino-como-llegar']],
  ['repartidor-llegada', ['Divoox Driver (repartidor)', '05-en-la-puerta-foto-de-la-entrega']],
  ['repartidor-billetera', ['Divoox Driver (repartidor)', '06-billetera']],
  ['repartidor-retiro', ['Divoox Driver (repartidor)', '07-retiro-al-banco']],
  ['restapp-nuevo', ['Divoox Restaurants (restaurante)', '01-pedido-nuevo-y-tiempo-para-aceptar']],
  ['restapp-preparando', ['Divoox Restaurants (restaurante)', '02-pedido-en-preparacion']],
  [
    'restapp-listo',
    ['Divoox Restaurants (restaurante)', '03-confirmar-con-la-foto-del-repartidor'],
  ],
  ['restapp-entrar', ['Divoox Restaurants (restaurante)', '04-entrar']],
]);
const MIAMI = { latitude: 25.7743, longitude: -80.1937 };
// Las «fotos» que toma el repartidor: la bolsa cerrada al recoger y al entregar (sin caras).
const FOTO_RECOGIDA = join(__dirname, 'fotos', 'bolsa-recogida.jpg');
const FOTO_ENTREGA = join(__dirname, 'fotos', 'bolsa-entrega.jpg');
const CASA = { latitude: 25.7725, longitude: -80.187 };

for (const idioma of ['en', 'es'] as const) {
  test(`recorrido completo de un pedido (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(STAGING ? 900_000 : 600_000);
    const L = TEXTOS[idioma];
    const id = `${idioma}${Date.now().toString(36)}`;
    const correo = (quien: string) => `${quien}.${id}@recorrido.test`;
    // En el sitio de pruebas los datos de corridas anteriores se quedan: el nombre lleva la corrida.
    const restaurante = `${idioma === 'en' ? 'Bella Pizza' : 'Pizza Bella'}${STAGING ? ` ${id.slice(-5)}` : ''}`;

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
    /**
     * Captura para Docs sin mover la pantalla (23 oct 2026): la sección ya quedó a la vista. Solo
     * con CAPTURAS y nunca para las tiendas; con `elemento`, solo ese recuadro.
     */
    const fotoAqui = async (pagina: Page, nombre: string, elemento?: Locator) => {
      if (!CAPTURAS || TIENDA) return;
      const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
      mkdirSync(dir, { recursive: true });
      await (elemento ?? pagina).screenshot({ path: join(dir, `${nombre}-${idioma}.png`) });
    };

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
      if (STAGING) {
        const r = execFileSync(
          'curl',
          [
            '-s',
            '-f',
            '-X',
            'POST',
            `${DATOS.url}/datos/interno/diagnostico/sql`,
            '-H',
            'content-type: application/json',
            '-H',
            `x-reloj-secreto: ${process.env.RECORRIDO_SECRETO ?? ''}`,
            '--data',
            JSON.stringify({ sql: comando }),
          ],
          { encoding: 'utf8' },
        );
        return (JSON.parse(r) as { results: Record<string, unknown>[] }).results;
      }
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
      if (STAGING) {
        // Stripe de verdad (modo prueba): se paga con la tarjeta de prueba y se espera el aviso real.
        if (tipo !== 'payment_intent.amount_capturable_updated') return;
        const pedidoId = (objeto.metadata as { pedido_id: string }).pedido_id;
        const r = await request.post('/datos/interno/diagnostico/confirmar-pago', {
          headers: { 'x-reloj-secreto': process.env.RECORRIDO_SECRETO ?? '' },
          data: { pedidoId },
        });
        expect(r.status(), await r.text()).toBe(200);
        await expect
          .poll(() => sql(`SELECT estado FROM pedidos WHERE id = '${pedidoId}'`)[0]?.estado, {
            timeout: 60_000,
            message: 'el aviso real de Stripe deja el pedido pagado',
          })
          .toBe('pagado');
        return;
      }
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
    await panel.getByRole('checkbox').check(); // acepta los términos
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
    if (STAGING)
      // En el sitio de pruebas la cuenta del equipo se vuelve admin en SU base (no se usa la semilla).
      sql(`UPDATE usuarios SET rol = 'admin' WHERE correo = '${correoEquipo}'`);
    else
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
        // La lista de activación exige horario (y teléfono) antes de abrir.
        await request.put('/datos/mi-restaurante/horarios', {
          headers: h,
          data: {
            turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
          },
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
    await fotoAqui(rep, 'repartidor-registro');
    await rep.getByRole('checkbox').click(); // acepta los términos
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
    if (CAPTURAS) {
      const nivel = rep
        .getByText(/^(Your level|Tu nivel):/)
        .filter({ visible: true })
        .first();
      await nivel.scrollIntoViewIfNeeded();
      await fotoAqui(rep, 'repartidor-nivel', nivel.locator('..'));
    }

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
    await cli.getByRole('checkbox').click(); // acepta los términos
    await cli.getByRole('button', { name: L.crearCuenta }).click();
    await expect(cli.getByText(restaurante)).toBeVisible({ timeout: 20_000 });
    await cli.waitForTimeout(CAPTURAS ? 1500 : 0);
    await foto(cli, 'cliente-inicio');
    // Inicio «como los grandes» (18 oct): un servicio que viene abre su pantalla con la franja de
    // «en construcción» (nunca una ventana encima), el buscador es real y la campana también.
    await cli.getByTestId('servicio-moto').click();
    await expect(cli.getByTestId('franja-estado')).toBeVisible({ timeout: 20_000 });
    await expect(
      cli.getByText(/Estamos construyendo este servicio|We’re building this service/),
    ).toBeVisible();
    await foto(cli, 'cliente-servicio');
    await cli.goto('/app/search');
    await cli.getByLabel(/^(Buscar|Search)$/).fill(idioma === 'en' ? 'margh' : 'margar');
    // Al menos un plato (la base del recorrido conserva los de la pasada anterior).
    const platos = cli.getByRole('tab', { name: /(Platos|Dishes) \([1-9]\d*\)/ });
    await expect(platos).toBeVisible({ timeout: 20_000 });
    await platos.click();
    await expect(
      cli.getByText(idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita').first(),
    ).toBeVisible();
    await foto(cli, 'cliente-buscar');
    await cli.goto('/app/notifications');
    await expect(cli.getByTestId('avisos-vacio')).toBeVisible({ timeout: 20_000 });
    // Staging acumula un restaurante por corrida y el inicio no los muestra todos: los de corridas
    // viejas se pausan (nunca los de la corrida en curso, que corre en los dos idiomas a la vez).
    if (STAGING)
      sql(
        "UPDATE restaurantes SET estado = 'pausado', abierto = 0 WHERE estado = 'aprobado' AND (nombre LIKE 'Pizza Bella %' OR nombre LIKE 'Bella Pizza %') AND creado_en < datetime('now', '-30 minutes')",
      );
    await cli.goto('/app/');
    await expect(cli.getByText(restaurante)).toBeVisible({ timeout: 20_000 });
    // «Comida» abre la lista de restaurantes (diseño aprobado del 14 oct) y de ahí, el menú.
    await cli.getByRole('button', { name: /^(Comida|Food)$/ }).click();
    await expect(cli.getByLabel(/Buscar restaurantes|Search restaurants/)).toBeVisible();
    const enLista = cli.getByText(restaurante).filter({ visible: true });
    // Con muchos restaurantes (staging tiene más de cien) la lista es virtual y el de la corrida
    // puede no estar dibujado: como una persona, se escribe su nombre en el buscador de la lista.
    await foto(cli, 'cliente-restaurantes');
    await cli.getByLabel(/Buscar restaurantes|Search restaurants/).fill(restaurante);
    await expect(enLista).toHaveCount(1, { timeout: 20_000 });
    await enLista.click();
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
          await cli.getByText(restaurante, { exact: true }).click({ timeout: 15_000 });
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
    // Al pagar, la app abre el pedido con la confirmación «¡Pedido realizado!» (diseño del 14 oct).
    await cli.goto(`/app/order/${cobro.pedidoId}?nuevo=1`);
    await expect(cli.getByText(/Payment received|Recibimos tu pago|Pago recibido/)).toBeVisible();
    await expect(cli.getByText(/Order placed!|¡Pedido realizado!/)).toBeVisible();
    await foto(cli, 'cliente-pagado');
    // La campana: el pedido pagado es un aviso real, con su punto en el inicio.
    await cli.goto('/app/notifications');
    await expect(cli.getByText(/Tu pedido en|Your order at/)).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-avisos');
    await cli.goto('/app/');
    await expect(cli.getByTestId('campana-punto')).toBeVisible({ timeout: 20_000 });
    await cli.goto(`/app/order/${cobro.pedidoId}?nuevo=1`);
    await cli.getByRole('button', { name: /Track order|Ver seguimiento/ }).click();
    await expect(cli.getByText(/Confirmed|Confirmado/)).toBeVisible();

    // 6. El restaurante acepta con su tiempo y avisa que está listo.
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    await expect(panel.getByText(cobro.pedidoId.slice(0, 4).toUpperCase()).first()).toBeVisible({
      timeout: 20_000,
    });
    await foto(panel, 'restaurante-pedido-nuevo');
    // Para las tiendas: la app del restaurante en celular y en tableta, con el mismo pedido.
    // La app del restaurante (diseño del 14 oct) se maneja en cada corrida, en celular; en el modo
    // de tiendas también en tableta. La de celular acepta, marca listo y ve la recogida.
    const restApps: Page[] = [];
    {
      for (const tipo of TIENDA ? (['celular', 'tableta'] as const) : (['celular'] as const)) {
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
    const rapp = restApps[0]!;
    const filaRapp = (p: Page) =>
      p.getByRole('button', { name: `#${cobro.pedidoId.slice(0, 4).toUpperCase()}` });
    /** Abre el pedido en la app del restaurante (desde «En cocina») y le toma la foto. */
    const fotoRestApps = async (nombre: string) => {
      for (const p of restApps) {
        if (p !== rapp) await p.reload();
        // La lista se refresca cada 5 s: si un toque cae justo en el refresco, se repite.
        await expect(async () => {
          if (!(await p.getByRole('progressbar').count())) await filaRapp(p).first().click();
          await expect(p.getByRole('progressbar').first()).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
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
    // El pedido se acepta desde la app del restaurante con el tiempo sugerido (20 min).
    await expect(
      rapp.getByRole('button', { name: `${L.aceptar} · 20 ${L.min} · ${L.sugerido}` }),
    ).toBeVisible({ timeout: 20_000 });
    await rapp.getByRole('button', { name: `${L.aceptar} · 20` }).click();
    await expect(panel.getByRole('button', { name: L.listo })).toBeVisible({ timeout: 20_000 });
    await foto(panel, 'restaurante-pedido-aceptado');
    await fotoRestApps('restapp-preparando');
    await expect(rapp.getByText(/Time elapsed|Tiempo transcurrido/)).toBeVisible();
    // Las otras pestañas de la app del restaurante: pedidos, mi menú y estadísticas.
    for (const [pestana, nombre] of [
      [/^(Orders|Pedidos)$/, 'restapp-pedidos'],
      [/^(Menu|Menú)$/, 'restapp-menu'],
      [/^(Stats|Estadísticas)$/, 'restapp-estadisticas'],
    ] as const) {
      await rapp.getByRole('tab', { name: pestana }).click();
      await rapp.waitForTimeout(1200);
      await foto(rapp, nombre);
    }
    await rapp.getByRole('tab', { name: /^(Home|Inicio)$/ }).click();
    await filaRapp(rapp).first().click();
    await rapp.getByRole('button', { name: L.listo }).click();
    await expect(rapp.getByText(/Order ready for pickup|Pedido listo para recoger/)).toBeVisible({
      timeout: 20_000,
    });

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
    // Como los grandes (18 oct): «Llegué al restaurante» confirma la llegada con la posición.
    await expect(rep.getByRole('button', { name: L.llegue })).toBeVisible({ timeout: 20_000 });
    await foto(rep, 'repartidor-llegue');
    await rep.getByRole('button', { name: L.llegue }).click();
    await expect(rep.getByText(L.llegueOk, { exact: false })).toBeVisible({ timeout: 20_000 });
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
    // La app del restaurante muestra el código, la foto del repartidor y «Marcar como recogido».
    await expect(rapp.getByRole('button', { name: L.confirmarRecogida })).toBeVisible({
      timeout: 20_000,
    });
    await fotoRestApps('restapp-listo');
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
    // En la app del restaurante el pedido queda «Recogido» (los cuatro pasos en verde).
    await expect(rapp.getByText(/^(On the way|En camino)$/).first()).toBeVisible({
      timeout: 20_000,
    });
    await Promise.all(restApps.map((p) => p.context().close()));

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
    // Llamada con número oculto (Twilio simulado): el repartidor toca «Llamar al cliente». En el
    // sitio de pruebas no hay Twilio todavía (llaves pendientes): ahí se salta la llamada.
    if (!STAGING) {
      await rep.getByRole('button', { name: L.llamarCliente }).filter({ visible: true }).click();
      await expect(rep.getByText(L.llamando, { exact: false })).toBeVisible({ timeout: 20_000 });
      await foto(rep, 'repartidor-llamar');
    }
    await cli.reload();
    await expect(
      cli.getByText(/Your driver is on the way|Tu repartidor va en camino/),
    ).toBeVisible();
    await mapaListo(cli);
    await foto(cli, 'cliente-en-camino');
    // …y el cliente también puede llamar al repartidor, sin ver su número (no en pruebas: sin Twilio).
    if (!STAGING) {
      await cli.getByRole('button', { name: L.llamarRepartidor }).scrollIntoViewIfNeeded();
      await cli.getByRole('button', { name: L.llamarRepartidor }).click();
      await expect(cli.getByText(L.llamando, { exact: false })).toBeVisible({ timeout: 20_000 });
      await foto(cli, 'cliente-llamar');
    }
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
    // Se espera que el servidor guarde la calificación antes de abrir las reseñas en el panel.
    await Promise.all([
      cli.waitForResponse(
        (r) => r.url().includes('/calificar') && r.request().method() === 'POST' && r.ok(),
      ),
      cli.getByRole('button', { name: L.enviarCalificacion }).click(),
    ]);

    // 11b. Lo nuevo de la Fase 2 que ve el público (capturas para Docs). Sin fotos, sirve igual
    //      de prueba: cada pantalla carga y responde.
    // Reseñas con respuesta: el restaurante contesta en público y el cliente la ve en su pedido.
    await panel.getByRole('link', { name: /^(Reviews|Reseñas)$/ }).click();
    await expect(panel.getByText('5/5').first()).toBeVisible({ timeout: 20_000 });
    await panel
      .getByRole('button', { name: /^(Reply|Responder)$/ })
      .first()
      .click();
    await panel
      .getByLabel(/^(Your reply|Tu respuesta)$/)
      .fill(idioma === 'en' ? 'Thank you! See you next time.' : '¡Gracias! Te esperamos pronto.');
    await foto(panel, 'restaurante-resenas');
    await panel.getByRole('button', { name: /^(Publish reply|Publicar respuesta)$/ }).click();
    await expect(panel.getByText(/^(You replied|Respondiste):/)).toBeVisible({ timeout: 20_000 });
    // Equipo: quién entra al panel y con qué rol (dueño, encargado, personal).
    await panel.getByRole('link', { name: /^(Team|Equipo)$/ }).click();
    await expect(panel.getByRole('button', { name: /^(Add|Agregar)$/ })).toBeVisible({
      timeout: 20_000,
    });
    await foto(panel, 'restaurante-equipo');
    // Festivos y cierres: un día marcado cierra el restaurante aunque esté dentro del horario.
    await panel.getByRole('link', { name: L.miRestaurante, exact: true }).click();
    const cierres = panel.getByRole('heading', {
      name: /^(Holidays and closures|Festivos y cierres)$/,
    });
    await expect(cierres).toBeVisible({ timeout: 20_000 });
    await panel.getByLabel(/^(Date \(YYYY-MM-DD\)|Fecha \(AAAA-MM-DD\))$/).fill('2026-12-25');
    await panel.getByLabel(/^(Reason|Motivo)/).fill(idioma === 'en' ? 'Christmas' : 'Navidad');
    await panel.getByRole('button', { name: /^(Add closure|Agregar cierre)$/ }).click();
    await expect(panel.getByText('2026-12-25')).toBeVisible({ timeout: 20_000 });
    await cierres.scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-festivos');
    // Orden del menú: categorías y platos como los ve el cliente, con flechas.
    await panel.getByRole('link', { name: L.menu, exact: true }).click();
    await expect(
      panel.getByRole('heading', { name: /^(Category order|Orden de las categorías)$/ }),
    ).toBeVisible({ timeout: 20_000 });
    await panel.evaluate(() => window.scrollTo(0, 0));
    await foto(panel, 'restaurante-orden-menu');

    // Favoritos: el corazón en la lista guarda el restaurante en «Favoritos».
    await cli.goto('/app/restaurants');
    // Lista virtual con muchos restaurantes en staging: se busca por su nombre, como una persona.
    await cli.getByLabel(/Buscar restaurantes|Search restaurants/).fill(restaurante);
    const corazon = cli.getByLabel(
      `${idioma === 'en' ? 'Save to favorites' : 'Guardar en favoritos'}: ${restaurante}`,
    );
    await expect(corazon).toBeVisible({ timeout: 20_000 });
    // El corazón cambia al instante; se espera la respuesta del servidor antes de salir de la
    // pantalla (en staging, salir enseguida cortaba la petición y el favorito no se guardaba).
    await Promise.all([
      cli.waitForResponse(
        (r) => r.url().includes('/datos/favoritos/') && r.request().method() === 'PUT' && r.ok(),
      ),
      corazon.click(),
    ]);
    await expect(
      cli.getByLabel(
        `${idioma === 'en' ? 'Remove from favorites' : 'Quitar de favoritos'}: ${restaurante}`,
      ),
    ).toBeVisible({ timeout: 20_000 });
    await cli.goto('/app/favorites');
    await expect(cli.getByText(restaurante).first()).toBeVisible({ timeout: 20_000 });
    await foto(cli, 'cliente-favoritos');
    if (CAPTURAS) {
      await cli.goto('/app/account');
      await expect(cli.getByText(/^(My account|Mi cuenta)$/).first()).toBeVisible({
        timeout: 20_000,
      });
      await foto(cli, 'cliente-mi-cuenta');
    }

    // Direcciones guardadas, cupón y pago al recibir, todo en el carrito. La dirección queda
    // guardada por la API (como si la hubiera marcado «guardar» en el primer pedido); el cupón lo
    // crea nuestro equipo; el efectivo lo enciende el superadmin en el país (interruptor Fase 2).
    // La app guarda su pase en el almacén del navegador (AsyncStorage en la web): se usa el mismo.
    const paseCliente = await cli.evaluate(() => localStorage.getItem('tumbite.sesion') ?? '');
    expect(paseCliente, 'el cliente tiene sesión abierta').toBeTruthy();
    expect(
      (
        await request.post('/datos/mis-direcciones', {
          headers: { authorization: `Bearer ${paseCliente}` },
          data: {
            etiqueta: idioma === 'en' ? 'Home' : 'Casa',
            direccion: '200 S Biscayne Blvd, Apt 12',
            lat: CASA.latitude,
            lng: CASA.longitude,
          },
        })
      ).ok(),
    ).toBe(true);
    const codigoCupon = `WELCOME${id.slice(-4).toUpperCase()}`;
    expect(
      (
        await request.post('/datos/admin/cupones', {
          headers: auth,
          data: {
            codigo: codigoCupon,
            tipo: 'monto',
            valor: 300,
            descripcionEs: '3 dólares de regalo en tu pedido',
            descripcionEn: '$3 off your order',
            destacado: true,
          },
        })
      ).status(),
    ).toBe(201);
    const paisUS = (await (
      await request.get('/datos/admin/paises/US', { headers: auth })
    ).json()) as { config: Record<string, unknown> };
    const ponerEfectivo = async (activo: boolean) =>
      expect(
        (
          await request.put('/datos/admin/paises/US', {
            headers: auth,
            data: { ...paisUS.config, efectivoActivo: activo },
          })
        ).ok(),
      ).toBe(true);
    await ponerEfectivo(true);
    try {
      await cli.goto('/app/');
      await cli.getByText(restaurante, { exact: true }).click();
      await cli
        .getByRole('button', { name: `${L.agregar} ${plato.limonada}` })
        .filter({ visible: true })
        .click();
      await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
      await cli.getByRole('radio', { name: L.enPuerta }).click();
      const direccionGuardada = cli.getByLabel(
        `${idioma === 'en' ? 'Your addresses' : 'Tus direcciones'}: ${idioma === 'en' ? 'Home' : 'Casa'}`,
      );
      await expect(direccionGuardada).toBeVisible({ timeout: 20_000 });
      await direccionGuardada.click();
      await expect(cli.getByLabel(L.direccionEntrega)).toHaveValue('200 S Biscayne Blvd, Apt 12');
      await mapaListo(cli);
      await direccionGuardada.scrollIntoViewIfNeeded();
      await foto(cli, 'cliente-direcciones');
      const efectivo = cli.getByRole('radio', { name: /^(Cash on delivery|Efectivo al recibir)$/ });
      await expect(efectivo).toBeVisible({ timeout: 20_000 });
      await efectivo.click();
      await expect(
        cli
          .getByText(/^(Order and pay on delivery|Pedir y pagar al recibir) · \$/)
          .filter({ visible: true }),
      ).toBeVisible();
      await efectivo.scrollIntoViewIfNeeded();
      await foto(cli, 'cliente-pago-al-recibir');
      await cli.getByRole('radio', { name: /^(Card|Tarjeta)$/ }).click();
      await cli
        .getByPlaceholder(/^(Coupon or promo code|Cupón o código promocional)$/)
        .fill(codigoCupon);
      await cli.getByLabel(/^(Apply|Aplicar)$/).click();
      const cuponAplicado = cli.getByText(/^(Coupon applied|Cupón aplicado)/);
      await expect(cuponAplicado).toBeVisible({ timeout: 20_000 });
      await cuponAplicado.scrollIntoViewIfNeeded();
      await foto(cli, 'cliente-cupon');
      await cli.getByLabel(/^(Remove|Quitar)$/).click();
      await expect(cuponAplicado).toHaveCount(0);
      // El repartidor, con el efectivo encendido, ve su saldo para comisiones en la billetera.
      await rep.goto('/driver/');
      await rep.getByText(L.verBilletera).filter({ visible: true }).click();
      const saldoPrepago = rep.getByTestId('saldo-prepago');
      await expect(saldoPrepago).toBeVisible({ timeout: 20_000 });
      await saldoPrepago.scrollIntoViewIfNeeded();
      await foto(rep, 'repartidor-prepago');
      await rep.goto('/driver/');
    } finally {
      // Pase lo que pase, el país vuelve a quedar como estaba (en el sitio de pruebas también).
      await ponerEfectivo(false);
    }

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
    await cli.getByText(restaurante, { exact: true }).click();
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

    // 14b. Soporte cancela un pedido YA ACEPTADO (auditoría, punto 3): la autorización de la
    //      tarjeta se anula en Stripe (no se cobra nada) y el pedido queda cancelado.
    const aceptadoYCancelado = await pedirYPagar([plato.limonada]);
    await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
    await panel
      .getByRole('button', { name: `${L.aceptar} · 10` })
      .first()
      .click();
    await expect
      .poll(
        () =>
          sql(`SELECT estado FROM pedidos WHERE id = '${aceptadoYCancelado.pedidoId}'`)[0]?.estado,
        { timeout: 20_000 },
      )
      .toBe('aceptado');
    expect(
      (
        await request.post(`/datos/admin/pedidos/${aceptadoYCancelado.pedidoId}/cancelar`, {
          headers: auth,
          data: { motivo: 'recorrido: soporte cancela un pedido aceptado' },
        })
      ).status(),
    ).toBe(200);
    expect(
      sql(
        `SELECT p.estado, c.cancelado_en IS NOT NULL AS anulado FROM pedidos p JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${aceptadoYCancelado.pedidoId}'`,
      )[0],
    ).toMatchObject({ estado: 'cancelado', anulado: 1 });

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
    await expect
      .poll(
        () => Number(sql(`SELECT total FROM pedidos WHERE id = '${agotado.pedidoId}'`)[0]?.total),
        {
          timeout: 20_000,
          message: 'al quitar el plato agotado, el total baja',
        },
      )
      .toBeLessThan(agotado.desglose.totalCliente);
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
    // lo que importa es que con Divoox le queda más que con los otros.
    await expect(compara).toContainText(/DoorDash Basic/);
    const textoCompara = await compara.innerText();
    const montoTumbite = Number(/Divoox[^$]*\$(\d+\.\d\d)/.exec(textoCompara)?.[1] ?? '0');
    const montoDoorDash = Number(/DoorDash Basic[^$]*\$(\d+\.\d\d)/.exec(textoCompara)?.[1] ?? '0');
    expect(montoTumbite).toBeGreaterThan(montoDoorDash);
    await expect(compara).toContainText(/Uber Eats Lite/);
    await foto(panel, 'restaurante-beneficios');
    if (CAPTURAS) {
      await panel.goto('/panel');
      await expect(panel.getByText(/Last 7 days|Últimos 7 días/).first()).toBeVisible({
        timeout: 20_000,
      });
      await foto(panel, 'restaurante-tablero');
      await panel.goto('/panel/settings');
      await expect(
        panel.getByRole('button', { name: /^(Change password|Cambiar contraseña)$/ }),
      ).toBeVisible({ timeout: 20_000 });
      for (const [titulo, nombre] of [
        [/^(Password|Contraseña)$/, 'restaurante-clave'],
        [/^(Email|Correo)$/, 'restaurante-correo'],
      ] as const) {
        // Solo la tarjeta de esa sección (Playwright la trae a la vista sola).
        await fotoAqui(panel, nombre, panel.getByRole('heading', { name: titulo }).locator('..'));
      }
      await panel.goto('/panel/company');
      const verif = panel.getByText(
        /^(Owner and storefront verification|Verificación del dueño y del local)$/,
      );
      await verif.scrollIntoViewIfNeeded();
      await fotoAqui(panel, 'restaurante-verificacion');
    }

    // El repartidor ve su billetera, conecta su banco (en Stripe) y retira todo.
    await rep.goto('/driver/');
    await rep.getByText(L.verBilletera).filter({ visible: true }).click();
    await expect(rep.getByText(L.disponible).filter({ visible: true })).toBeVisible();
    // Ganancias con desglose (base, bonos y propinas) arriba de la billetera.
    await expect(rep.getByTestId('ganancias-desglose')).toBeVisible({ timeout: 20_000 });
    await foto(rep, 'repartidor-ganancias');
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
    if (STAGING) expect(String(cuenta)).toMatch(/^acct_/); // cuenta de prueba real en Stripe
    await avisoStripe('account.updated', {
      id: cuenta,
      payouts_enabled: true,
      charges_enabled: true,
    });
    // En el sitio de pruebas la cuenta de prueba de Stripe no termina el alta: se marca aprobada en
    // la base, como lo haría el aviso de Stripe al verificarla (en local lo hace el aviso simulado).
    if (STAGING)
      sql(
        `UPDATE cuentas_stripe SET pagos_activos = 1 WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = '${correo('repartidor')}')`,
      );
    // Fase 0: los retiros nacen APAGADOS. La billetera lo dice y no hay botón de retirar.
    sql("DELETE FROM config WHERE clave = 'retiros_activos'"); // sin bandera = apagados
    await rep.goto('/driver/');
    await rep.getByText(L.verBilletera).filter({ visible: true }).click();
    await expect(rep.getByText(L.retirosPausa).filter({ visible: true })).toBeVisible();
    await expect(rep.getByText(L.retirar).filter({ visible: true })).toHaveCount(0);
    // En esta computadora (Stripe simulado) se encienden para recorrer el retiro completo. En el
    // sitio de pruebas NO: el retiro con Stripe de prueba lo cubre S11, y los retiros siguen apagados.
    if (!STAGING) {
      sql(
        "INSERT INTO config (clave, valor) VALUES ('retiros_activos', '1') ON CONFLICT(clave) DO UPDATE SET valor = '1'",
      );
      await rep.goto('/driver/');
      await rep.getByText(L.verBilletera).filter({ visible: true }).click();
      await rep.getByText(L.retirar).filter({ visible: true }).click();
      await expect(rep.getByText(L.retiroEnCamino).filter({ visible: true })).toBeVisible();
      await foto(rep, 'repartidor-retiro');
      // Calificaciones visibles y la campana real (como los grandes, 18 oct).
      await rep.getByRole('tab', { name: L.perfil }).click();
      if (CAPTURAS) {
        await rep.getByText(/^(Documents|Documentos)$/).click();
        const titulo = rep.getByText(/^(Verify your identity|Verifica tu identidad)$/);
        await titulo.scrollIntoViewIfNeeded();
        await fotoAqui(rep, 'repartidor-verificacion');
        await rep.getByText(/^(Documents|Documentos)$/).click();
      }
      await rep.getByRole('button', { name: L.misCalificaciones }).click();
      await expect(rep.getByTestId('calificaciones')).toBeVisible({ timeout: 20_000 });
      await foto(rep, 'repartidor-calificaciones');
      await rep.getByRole('button', { name: L.campana }).click();
      await expect(rep.getByText(L.tusAvisos)).toBeVisible({ timeout: 20_000 });
      await foto(rep, 'repartidor-avisos');
      const saldo = sql(
        `SELECT COALESCE(SUM(m.monto), 0) AS s FROM movimientos m JOIN usuarios u ON u.id = m.usuario_id WHERE u.correo = '${correo('repartidor')}'`,
      )[0]?.s;
      expect(Number(saldo), 'después de retirar todo, el saldo queda en cero').toBe(0);
    }

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
    // Primero se espera que la aceptación haya llegado: si no, la escribe encima (pasó en pruebas).
    await expect
      .poll(() => sql(`SELECT estado FROM pedidos WHERE id = '${otro.pedidoId}'`)[0]?.estado, {
        timeout: 20_000,
      })
      .toBe('aceptado');
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

    // 18. Cobro en mano de punta a punta (C-COBRO-DIRECTO-LOCAL y C-COBRO-DIRECTO-STAGING), aquí y
    //     en el sitio de pruebas: el país se enciende un momento, solo con las cuentas de la corrida,
    //     y vuelve a quedar como estaba. Nunca en producción (el recorrido no corre allí).
    {
      const pais = (await (
        await request.get('/datos/admin/paises/US', { headers: auth })
      ).json()) as { config: Record<string, unknown> };
      const ponerPais = async (on: boolean) =>
        expect(
          (
            await request.put('/datos/admin/paises/US', {
              headers: auth,
              data: {
                ...pais.config,
                efectivoActivo: on,
                transferenciaRepartidorActiva: on,
                recargasPuntoVentaActivas: on,
              },
            })
          ).ok(),
        ).toBe(true);
      await ponerPais(true);
      try {
        const paseDe = (pg: Page) =>
          pg.evaluate(() => localStorage.getItem('tumbite.sesion') ?? '');
        const paseCli = await paseDe(cli);
        const paseRep = await paseDe(rep);
        // Saldo para comisiones: un punto de venta (su dueño, el cliente) emite un código y el
        // repartidor lo canjea. Es saldo para comisiones, NO dinero para comprar la comida.
        const idCli = String(
          sql(`SELECT id FROM usuarios WHERE correo = '${correo('cliente')}'`)[0]?.id,
        );
        const punto = (await (
          await request.post('/datos/admin/puntos-venta', {
            headers: auth,
            data: { nombre: `Punto ${id.slice(-4)}`, pais: 'US', usuarioId: idCli },
          })
        ).json()) as { punto: { id: string } };
        await request.post(`/datos/admin/puntos-venta/${punto.punto.id}/fondo`, {
          headers: auth,
          data: { monto: 5000, comprobante: 'recorrido' },
        });
        const codigo = (await (
          await request.post('/datos/punto-venta/codigos', {
            headers: { authorization: `Bearer ${paseCli}` },
            data: { monto: 2000 },
          })
        ).json()) as { codigo: string };
        expect(
          (
            await request.post('/datos/repartidor/recargar', {
              headers: { authorization: `Bearer ${paseRep}` },
              data: { codigo: codigo.codigo },
            })
          ).ok(),
        ).toBe(true);
        // El cliente pide y elige «Efectivo al recibir».
        await cli.goto('/app/');
        await cli.getByText(restaurante, { exact: true }).click();
        await cli
          .getByRole('button', { name: `${L.agregar} ${plato.limonada}` })
          .filter({ visible: true })
          .click();
        await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
        await cli.getByRole('radio', { name: L.enPuerta }).click();
        await cli.getByLabel(L.direccionEntrega).fill('200 S Biscayne Blvd, Apt 12');
        await cli.getByRole('radio', { name: /^(Cash on delivery|Efectivo al recibir)$/ }).click();
        const [resp] = await Promise.all([
          cli.waitForResponse(
            (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
          ),
          cli
            .getByText(/^(Order and pay on delivery|Pedir y pagar al recibir) · \$/)
            .filter({ visible: true })
            .click(),
        ]);
        expect(resp.status()).toBe(201);
        const directo = (await resp.json()) as { pedidoId: string; directo: boolean };
        expect(directo.directo).toBe(true);
        // El restaurante acepta; el repartidor (con saldo) recibe la oferta y la acepta.
        await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
        await panel
          .getByRole('button', { name: `${L.aceptar} · 10` })
          .first()
          .click();
        await expect
          .poll(
            () => sql(`SELECT estado FROM pedidos WHERE id = '${directo.pedidoId}'`)[0]?.estado,
            {
              timeout: 20_000,
            },
          )
          .toBe('aceptado');
        sql(
          `UPDATE pedidos SET aceptado_en = datetime('now','-9 minutes') WHERE id = '${directo.pedidoId}'`,
        );
        await rep.goto('/driver/');
        await rep
          .getByRole('switch')
          .or(rep.getByRole('button', { name: L.conectarme }))
          .first()
          .click();
        await expect(rep.getByRole('button', { name: L.aceptarOferta, exact: true })).toBeVisible({
          timeout: 30_000,
        });
        // La oferta dice que se cobra en mano y cuánto se adelanta en el local, antes de aceptar.
        await expect(rep.getByTestId('oferta-cobro-en-mano')).toBeVisible();
        await foto(rep, 'oferta-cobro-en-mano');
        await rep.getByRole('button', { name: L.aceptarOferta, exact: true }).click();
        // El restaurante ve cuánto le cobra al repartidor en el mostrador (su app, en celular).
        const rappCtx = await nuevoContexto('celular');
        const rapp = await rappCtx.newPage();
        await rapp.goto('/restaurant/');
        await rapp.getByLabel(L.correo).fill(correo('restaurante'));
        await rapp.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
        await rapp.getByRole('button', { name: idioma === 'en' ? 'Sign in' : 'Entrar' }).click();
        const filaDirecta = rapp.getByRole('button', {
          name: `#${directo.pedidoId.slice(0, 4).toUpperCase()}`,
        });
        await expect(async () => {
          if (!(await rapp.getByTestId('cobro-al-repartidor').count()))
            await filaDirecta.first().click();
          await expect(rapp.getByTestId('cobro-al-repartidor').first()).toBeVisible({
            timeout: 3_000,
          });
        }).toPass({ timeout: 30_000 });
        await foto(rapp, 'restapp-cobro-repartidor');
        await rappCtx.close();
        // Listo: el repartidor paga la comida en el mostrador y lo registra.
        await panel.getByRole('button', { name: L.listo }).first().click();
        const bloque = rep.getByTestId('pago-en-local');
        await expect(bloque).toBeVisible({ timeout: 30_000 });
        await bloque.scrollIntoViewIfNeeded();
        await foto(rep, 'pago-local-repartidor');
        await rep.getByRole('button', { name: /^(Record the payment|Registrar el pago)$/ }).click();
        await expect(rep.getByText(/^(Payment recorded\.|Pago registrado\.)$/)).toBeVisible({
          timeout: 20_000,
        });
        // Con el pago registrado aparece la foto del ticket (opcional, C-FOTO-TICKET).
        await expect(
          rep.getByRole('button', {
            name: /^(Take a photo of the receipt \(optional\)|Tomar foto del ticket \(opcional\))$/,
          }),
        ).toBeVisible();
        await rep.getByTestId('pago-en-local').scrollIntoViewIfNeeded();
        await foto(rep, 'pago-local-registrado');
        const fila = sql(
          `SELECT monto_pagado, metodo, diferencia_pago FROM pagos_local WHERE pedido_id = '${directo.pedidoId}'`,
        )[0];
        expect(fila).toMatchObject({ metodo: 'efectivo', diferencia_pago: 0 });
        // ── El resto del cobro en mano por las rutas del producto (las mismas que usan las apps),
        //    en esta computadora Y en el sitio de pruebas (C-COBRO-DIRECTO-STAGING, 19 oct). ──
        const entrarComo = async (quien: string) =>
          (
            (await (
              await request.post('/datos/cuentas/entrar', {
                data: { correo: correo(quien), clave: DATOS.clave },
              })
            ).json()) as { token: string }
          ).token;
        const tRest = await entrarComo('restaurante');
        const hdr = (t: string) => ({ authorization: `Bearer ${t}` });
        const rest = sql(
          `SELECT r.id, r.lat, r.lng FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id WHERE u.correo = '${correo('restaurante')}'`,
        )[0] as { id: string; lat: number; lng: number };
        const enRest = `lat=${rest.lat}&lng=${rest.lng}`;
        const enCasa = `lat=${CASA.latitude}&lng=${CASA.longitude}`;
        const bolsa = readFileSync(FOTO_ENTREGA);
        const subir = (ruta: string, token: string, donde: string) =>
          request.post(`${ruta}${ruta.includes('?') ? '&' : '?'}${donde}`, {
            headers: { ...hdr(token), 'content-type': 'image/jpeg' },
            data: bolsa,
          });
        /** Recoge (foto en el local + el restaurante confirma) y entrega en la puerta con GPS serio. */
        const recogerYEntregar = async (pid: string) => {
          const rFoto1 = await subir(
            `/datos/repartidor/pedidos/${pid}/foto-recogida`,
            paseRep,
            enRest,
          );
          expect(rFoto1.ok(), `${rFoto1.status()} ${await rFoto1.text()}`).toBe(true);
          expect(
            (
              await request.post(`/datos/restaurante/pedidos/${pid}/confirmar-recogida`, {
                headers: hdr(tRest),
                data: {},
              })
            ).ok(),
          ).toBe(true);
          await llegarALaPuerta(pid);
          const r = await subir(`/datos/repartidor/pedidos/${pid}/entregado`, paseRep, enCasa);
          expect(r.status(), await r.text()).toBe(200);
        };
        const llegarALaPuerta = async (pid: string) => {
          expect(filaPed(pid)?.estado, 'el pedido salió del local').toBe('en_camino');
          // Sin coordenadas de la puerta (la dirección se escribió a mano), el GPS no puede
          // confirmar la llegada: el repartidor pide la excepción y soporte la autoriza (paso 10).
          const sinPuerta = sql(`SELECT lat FROM pedidos WHERE id = '${pid}'`)[0]?.lat == null;
          if (sinPuerta) {
            expect(
              (
                await request.post(`/datos/repartidor/pedidos/${pid}/no-puedo-confirmar`, {
                  headers: hdr(paseRep),
                  data: { motivo: 'La dirección no tiene ubicación en el mapa' },
                })
              ).ok(),
            ).toBe(true);
            expect(
              (
                await request.post(`/datos/admin/pedidos/${pid}/autorizar-ubicacion`, {
                  headers: auth,
                })
              ).ok(),
            ).toBe(true);
            return;
          }
          // El celular del repartidor también está en la puerta (su app manda la posición sola).
          await repCtx.setGeolocation(CASA);
          // Dos lecturas precisas en la puerta (como un celular de verdad); se repite hasta que el
          // servidor confirme la llegada (la app también manda su posición mientras tanto).
          await expect
            .poll(
              async () => {
                sql(
                  `UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-60 seconds') WHERE usuario_id = (SELECT repartidor_id FROM pedidos WHERE id = '${pid}')`,
                );
                for (let n = 0; n < 2; n++)
                  await request.post('/datos/repartidor/ubicacion', {
                    headers: hdr(paseRep),
                    data: { lat: CASA.latitude, lng: CASA.longitude, precision: 10 },
                  });
                return sql(
                  `SELECT COUNT(*) AS n FROM hitos_pedido WHERE pedido_id = '${pid}' AND hito = 'llego_cliente'`,
                )[0]?.n;
              },
              { timeout: 30_000, intervals: [1_000] },
            )
            .toBe(1);
        };
        const platoId = String(
          sql(
            `SELECT id FROM platos WHERE restaurante_id = '${rest.id}' AND eliminado = 0 AND disponible = 1 AND id NOT IN (SELECT plato_id FROM grupos_opciones WHERE minimo > 0) LIMIT 1`,
          )[0]?.id,
        );
        /** Otro pedido en mano por la API: el cliente pide, el restaurante acepta, el repartidor toma. */
        const pedirEnMano = async (metodoPago: 'efectivo' | 'transferencia_repartidor') => {
          const r = await request.post('/datos/pedidos', {
            headers: hdr(paseCli),
            data: {
              restauranteId: rest.id,
              lineas: [{ platoId, cantidad: 1 }],
              propinaCentavos: 0,
              direccion: '200 S Biscayne Blvd, Apt 12',
              lat: CASA.latitude,
              lng: CASA.longitude,
              entrega: 'puerta',
              metodoPago,
            },
          });
          expect(r.status(), await r.text()).toBe(201);
          const p = (await r.json()) as { pedidoId: string; desglose: { totalCliente: number } };
          await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/aceptar`, {
            headers: hdr(tRest),
            data: { minutos: 10 },
          });
          sql(
            `UPDATE pedidos SET aceptado_en = datetime('now','-9 minutes') WHERE id = '${p.pedidoId}'`,
          );
          await expect
            .poll(
              async () => {
                const o = (await (
                  await request.get('/datos/repartidor/ofertas', { headers: hdr(paseRep) })
                ).json()) as {
                  ofertas: { id: string; metodoPago?: string; adelantoLocal?: number }[];
                };
                return o.ofertas.find((x) => x.id === p.pedidoId)?.metodoPago ?? null;
              },
              { timeout: 30_000 },
            )
            .toBe(metodoPago);
          expect(
            (
              await request.post(`/datos/repartidor/ofertas/${p.pedidoId}/aceptar`, {
                headers: hdr(paseRep),
                data: {},
              })
            ).ok(),
          ).toBe(true);
          await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/listo`, {
            headers: hdr(tRest),
            data: {},
          });
          const l = (await (
            await request.get(`/datos/repartidor/pedidos/${p.pedidoId}/pago-local`, {
              headers: hdr(paseRep),
            })
          ).json()) as {
            montoEsperado: number;
            subtotal: number;
          };
          expect(
            (
              await request.post(`/datos/repartidor/pedidos/${p.pedidoId}/pago-local`, {
                headers: hdr(paseRep),
                data: {
                  montoPagado: l.montoEsperado,
                  importeTicket: l.subtotal,
                  metodo: 'efectivo',
                },
              })
            ).ok(),
          ).toBe(true);
          return { id: p.pedidoId, total: p.desglose.totalCliente };
        };
        const filaPed = (pid: string) =>
          sql(
            `SELECT estado, cobro_estado, conciliacion_estado FROM pedidos WHERE id = '${pid}'`,
          )[0];
        const comisiones = () =>
          Number(
            sql(
              `SELECT COALESCE(SUM(monto),0) AS s FROM libro WHERE concepto = 'comision_cobrada' AND bolsillo = 'comisiones'`,
            )[0]?.s,
          );

        // A. El pedido de la pantalla: se recoge, se entrega y el repartidor confirma el cobro.
        const antes = comisiones();
        await recogerYEntregar(directo.pedidoId);
        const totalA = Number(
          sql(`SELECT total - propina AS t FROM pedidos WHERE id = '${directo.pedidoId}'`)[0]?.t,
        );
        expect(
          (
            await request.post(`/datos/repartidor/pedidos/${directo.pedidoId}/cobre`, {
              headers: hdr(paseRep),
              data: { montoRecibido: totalA, nota: 'recorrido' },
            })
          ).ok(),
        ).toBe(true);
        expect(filaPed(directo.pedidoId)).toMatchObject({
          estado: 'entregado',
          cobro_estado: 'confirmado',
          conciliacion_estado: 'conciliado',
        });
        expect(comisiones(), 'la comisión pasó del saldo prepago a Divoox').toBeGreaterThan(antes);

        // B. Transferencia: «aún no me llega» (pendiente, sin cerrar nada) y después confirmada.
        const t = await pedirEnMano('transferencia_repartidor');
        await recogerYEntregar(t.id);
        expect(
          (
            await request.post(`/datos/repartidor/pedidos/${t.id}/transferencia-pendiente`, {
              headers: hdr(paseRep),
              data: { nota: 'recorrido' },
            })
          ).ok(),
        ).toBe(true);
        expect(filaPed(t.id)).toMatchObject({
          estado: 'entregado',
          cobro_estado: 'pendiente',
          conciliacion_estado: 'pendiente',
        });
        const casosT = (await (
          await request.get('/datos/admin/bandeja-dinero?tipo=transferencia', { headers: auth })
        ).json()) as { casos: { clave: string }[] };
        expect(casosT.casos.map((c) => c.clave)).toContain(`transferencia:${t.id}`);
        expect(
          (
            await request.post(`/datos/repartidor/pedidos/${t.id}/cobre`, {
              headers: hdr(paseRep),
              data: { montoRecibido: t.total, nota: 'la vi en mi banco' },
            })
          ).ok(),
        ).toBe(true);
        expect(filaPed(t.id)).toMatchObject({
          cobro_estado: 'confirmado',
          conciliacion_estado: 'conciliado',
        });

        // C. Cliente ausente después de comprar la comida: «El cliente no pagó» → cancelado, deuda
        //    del cliente y la comida como pérdida pendiente de decisión, en la bandeja.
        const c = await pedirEnMano('efectivo');
        const rFoto2 = await subir(
          `/datos/repartidor/pedidos/${c.id}/foto-recogida`,
          paseRep,
          enRest,
        );
        expect(rFoto2.ok(), `${rFoto2.status()} ${await rFoto2.text()}`).toBe(true);
        await request.post(`/datos/restaurante/pedidos/${c.id}/confirmar-recogida`, {
          headers: hdr(tRest),
          data: {},
        });
        await llegarALaPuerta(c.id);
        expect(
          (
            await request.post(`/datos/repartidor/pedidos/${c.id}/no-aparece`, {
              headers: hdr(paseRep),
              data: {},
            })
          ).ok(),
        ).toBe(true);
        sql(
          `UPDATE hitos_pedido SET creado_en = datetime('now','-10 minutes') WHERE pedido_id = '${c.id}' AND hito = 'no_aparece'`,
        );
        // No se deja en un lugar seguro: se cobra en mano.
        expect(
          (
            await subir(
              `/datos/repartidor/pedidos/${c.id}/entregado?modo=seguro&nota=porteria`,
              paseRep,
              enCasa,
            )
          ).status(),
        ).toBe(409);
        expect(
          (
            await request.post(`/datos/repartidor/pedidos/${c.id}/no-pago`, {
              headers: hdr(paseRep),
              data: { motivo: 'no aparece' },
            })
          ).ok(),
        ).toBe(true);
        expect(filaPed(c.id)).toMatchObject({ estado: 'cancelado', cobro_estado: 'no_pagado' });
        expect(
          sql(
            `SELECT COUNT(*) AS n FROM libro WHERE pedido_id = '${c.id}' AND concepto = 'comida_comprada_sin_entregar'`,
          )[0]?.n,
        ).toBe(1);

        // D. Soporte: la bandeja muestra la comida perdida (espera la decisión de Richard), la toma y
        //    deja la nota. Nada se compensa solo.
        // Por su clave, no en la lista: la bandeja pagina los 50 casos más viejos primero y el sitio
        // de pruebas acumula casos de corridas anteriores (27 oct 2026).
        const comida = (
          (await (
            await request.get(
              `/datos/admin/bandeja-dinero/${encodeURIComponent(`comida:${c.id}`)}`,
              { headers: auth },
            )
          ).json()) as {
            caso: {
              clave: string;
              tipo: string;
              moneda: string;
              esperaDecision: string | null;
              acciones: string[];
            };
          }
        ).caso;
        expect(comida).toMatchObject({
          tipo: 'comida',
          moneda: 'USD',
          esperaDecision: 'decision-20',
          acciones: ['tomar', 'nota', 'resolver'],
        });
        for (const accion of ['tomar', 'nota'])
          expect(
            (
              await request.post(
                `/datos/admin/bandeja-dinero/${encodeURIComponent(`comida:${c.id}`)}/acciones`,
                {
                  headers: auth,
                  data: {
                    accion,
                    nota: 'Recorrido: el cliente no apareció; ticket en la app',
                    idempotencia: `recorrido-${accion}-${c.id}`,
                  },
                },
              )
            ).ok(),
          ).toBe(true);
        // La bandeja en la pantalla del superadmin (en el idioma de la corrida).
        const ruta = (
          (await (await request.get('/datos/admin/ruta', { headers: auth })).json()) as {
            ruta: string | null;
          }
        ).ruta;
        const supCtx = await nuevoContexto('computadora');
        const sup = await supCtx.newPage();
        await sup.goto('/panel');
        await sup.getByLabel(L.correo).fill(DATOS.correoEquipo);
        await sup.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
        await sup.getByRole('button', { name: idioma === 'en' ? 'Sign in' : 'Entrar' }).click();
        // Ya dentro: se espera a que se vaya el formulario, no a que la red quede quieta (el panel
        // consulta cada pocos segundos y una sola respuesta perdida colgaba la corrida 15 minutos).
        await expect(sup.getByLabel(L.clave, { exact: true })).toBeHidden({ timeout: 30_000 });
        await sup.goto(`/panel/${ruta}/cash/${encodeURIComponent(`comida:${c.id}`)}`);
        await expect(sup.getByTestId('caso-dinero')).toBeVisible({ timeout: 20_000 });
        await foto(sup, 'super-bandeja-caso');
        await sup.goto(`/panel/${ruta}/cash`);
        await expect(sup.getByTestId('bandeja-dinero')).toBeVisible({ timeout: 20_000 });
        await foto(sup, 'super-bandeja');
        await supCtx.close();
        // Resuelto al final: el caso de esta corrida no se queda acumulado en la bandeja de pruebas.
        expect(
          (
            await request.post(
              `/datos/admin/bandeja-dinero/${encodeURIComponent(`comida:${c.id}`)}/acciones`,
              {
                headers: auth,
                data: {
                  accion: 'resolver',
                  nota: 'Recorrido: caso de prueba cerrado',
                  idempotencia: `recorrido-resolver-${c.id}`,
                },
              },
            )
          ).ok(),
        ).toBe(true);
        await repCtx.setGeolocation(MIAMI);
        // Ya libre, el repartidor se desconecta (así no se lleva ofertas de la corrida siguiente).
        await rep.goto('/driver/');
        await rep
          .getByText(L.desconectarme)
          .filter({ visible: true })
          .click({ timeout: 20_000 })
          .catch(() => undefined);
      } finally {
        await ponerPais(false);
      }
    }

    // Para las tiendas: el restaurante de este idioma se cierra, así no sale en las fotos del otro.
    if (TIENDA) sql(`UPDATE restaurantes SET abierto = 0 WHERE nombre = '${restaurante}'`);
    await Promise.all([panelCtx.close(), repCtx.close(), cliCtx.close()]);
  });
}
