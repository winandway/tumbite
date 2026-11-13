import { expect, test } from './fixtures';
import { sqlLocalTexto } from './sqlLocal';

/**
 * C-FLEX-SALIR y C-FLEX-MARCA (13 nov 2026, Richard): dentro de una empresa de Divoox Flex no había
 * cómo cerrar sesión (y por eso no se podía entrar con otra cuenta), el panel no decía «Divoox
 * Flex» y no se distinguía del de comida. La salida tiene que estar a la vista y dentro de la
 * pantalla, el nombre del servicio arriba y el azul de logística en la franja y en el menú.
 * Todos los países.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

const AZUL = 'rgb(31, 77, 105)';

for (const [nombre, ancho] of [
  ['computadora', 1000],
  ['celular', 375],
] as const)
  test(`Flex dice dónde estás y deja salir (${nombre})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
    const p = await ctx.newPage();
    const correo = `flex.cabecera.${ancho}.${Date.now().toString(36)}@recorrido.test`;
    const r = await p.request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.97.${ancho % 250}.${Date.now() % 250}` },
      data: {
        nombre: 'Empresa de Paquetes',
        correo,
        clave: `Cabecera-${Date.now().toString(36)}-Flex9`,
        rol: 'cliente',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    sqlLocalTexto(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    const e = await p.request.post('/datos/v1/flex/empresas', {
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': crypto.randomUUID() },
      data: { nombre: 'Paquetes del Centro', pais: 'US', moneda: 'USD' },
    });
    expect(e.ok(), await e.text()).toBe(true);
    const { empresa } = (await e.json()) as { empresa: { id: string } };
    await ctx.addInitScript((pase) => localStorage.setItem('tumbite.sesion', pase), token);
    await p.goto(`/panel/business/${empresa.id}`);

    // Dónde estoy: el nombre del servicio, arriba, con el azul de logística.
    const marca = p.getByTestId('flex-marca');
    await expect(marca).toBeVisible();
    await expect(marca).toHaveText(/Divoox Flex/);
    await expect(p.locator('.flex-franja')).toHaveCSS('background-color', AZUL);
    await expect(p.locator('.flex-panel .panel-menu')).toHaveCSS('background-color', AZUL);

    // Nada se sale de la pantalla hacia la derecha.
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);

    // La salida: a la vista, dentro de la pantalla, y de verdad cierra la sesión.
    const salir = p.getByTestId('flex-salir');
    await expect(salir).toBeVisible();
    const caja = await salir.boundingBox();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    if (process.env.CAPTURAS === '1')
      await p.screenshot({ path: `docs/capturas/recorrido/flex-cabecera-${nombre}.png` });
    await salir.click();
    await p.waitForURL(/\/panel$/);
    await expect(p.locator('input[type="email"]').first()).toBeVisible();
    // La sesión murió en el servidor: el pase viejo ya no sirve.
    const yo = await p.request.get('/datos/cuentas/yo', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(yo.status()).toBe(401);
    await ctx.close();
  });
