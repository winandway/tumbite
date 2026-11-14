import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-AVISOS-WEB (13 nov 2026) — todos los países. La app del restaurante instalada desde el
 * navegador explica para qué quiere los avisos ANTES de pedir el permiso, y la ventana del navegador
 * sale solo al tocar «Activar avisos». En iPhone sin agregar a inicio, explica que primero se agrega.
 * Con CAPTURAS=1 guarda las capturas de la guía de Docs.
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

const CASOS = [
  { idioma: 'es', equipo: 'Pixel 7', nombre: 'android' },
  { idioma: 'en', equipo: 'Pixel 7', nombre: 'android' },
  { idioma: 'es', equipo: 'iPhone 14', nombre: 'iphone' },
  { idioma: 'en', equipo: 'iPhone 14', nombre: 'iphone' },
] as const;

for (const caso of CASOS)
  test(`el restaurante ve la explicación de los avisos (${caso.nombre}, ${caso.idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const id = `${caso.nombre}${caso.idioma}${Date.now().toString(36)}`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: {
        'cf-connecting-ip': `10.95.${Math.floor(Math.random() * 200)}.${Date.now() % 250}`,
      },
      data: {
        nombre: 'Dueña Avisos',
        correo: `avisos.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: 'restaurante',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    const local = await request.put('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        nombre: 'Pizzería del Centro',
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    // El navegador de las pruebas es Chromium: con el equipo «iPhone» basta su nombre de navegador.
    const equipo = { ...devices[caso.equipo], defaultBrowserType: undefined };
    const ctx = await browser.newContext({ ...equipo, baseURL: DATOS!.url });
    await ctx.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        // Chromium sin pantalla dice «bloqueado» de entrada: aquí arranca como un celular nuevo
        // («sin decidir») y cuenta las veces que la app pide el permiso (nunca al cargar). La
        // persona de la prueba dice que no, para ver también ese caso.
        const w = window as unknown as { pedidosPermiso: number; permiso: string };
        w.pedidosPermiso = 0;
        w.permiso = 'default';
        if ('Notification' in window) {
          Object.defineProperty(Notification, 'permission', { get: () => w.permiso });
          Notification.requestPermission = () => {
            w.pedidosPermiso++;
            w.permiso = 'denied';
            return Promise.resolve('denied');
          };
        }
      },
      [token, caso.idioma],
    );
    const p = await ctx.newPage();
    await p.goto('/restaurant/');
    const tarjeta = p.getByTestId('tarjeta-avisos-web');
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    const es = caso.idioma === 'es';
    await expect(tarjeta).toContainText(
      es
        ? 'Entérate de cada pedido aunque la app esté cerrada'
        : 'Know about every order, even with the app closed',
    );
    expect(
      await p.evaluate(() => (window as unknown as { pedidosPermiso: number }).pedidosPermiso),
    ).toBe(0);
    if (caso.nombre === 'iphone') {
      await expect(tarjeta).toContainText(es ? 'Agregar a inicio' : 'Add to Home Screen');
      await expect(
        tarjeta.getByRole('button', { name: es ? 'Activar avisos' : 'Turn on notifications' }),
      ).toHaveCount(0);
    } else {
      await expect(
        tarjeta.getByRole('button', { name: es ? 'Activar avisos' : 'Turn on notifications' }),
      ).toBeVisible();
    }
    if (process.env.CAPTURAS) {
      const dir = join(RAIZ, 'docs', 'capturas');
      mkdirSync(dir, { recursive: true });
      await p.screenshot({ path: join(dir, `avisos-web-${caso.nombre}-${caso.idioma}.png`) });
    }
    if (caso.nombre === 'android') {
      // Al tocar «Activar avisos» sale la ventana del navegador (una sola vez, por el toque).
      await tarjeta
        .getByRole('button', { name: es ? 'Activar avisos' : 'Turn on notifications' })
        .click();
      await expect
        .poll(() =>
          p.evaluate(() => (window as unknown as { pedidosPermiso: number }).pedidosPermiso),
        )
        .toBe(1);
      // Si dice que no, la tarjeta explica cómo encenderlos en la configuración del sitio.
      await expect(tarjeta).toContainText(es ? 'están bloqueados' : 'are blocked');
    }
    // «Ahora no» la cierra y no vuelve a salir para esta cuenta.
    await tarjeta.getByRole('button', { name: es ? 'Ahora no' : 'Not now' }).click();
    await expect(tarjeta).toHaveCount(0);
    await p.reload();
    await expect(p.getByRole('tab', { name: es ? 'Más' : 'More' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(p.getByTestId('tarjeta-avisos-web')).toHaveCount(0);
    await ctx.close();
  });
