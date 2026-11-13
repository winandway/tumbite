import { expect, test } from './fixtures';

/**
 * C-ACCESO-ENLACES-CENTRADOS (13 nov 2026, Richard): en la entrada del panel, «¿Olvidaste tu
 * contraseña?» estaba corrido a la izquierda. Los enlaces bajo el botón van centrados con él.
 * Todos los países.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

for (const [nombre, ancho] of [
  ['computadora', 1000],
  ['celular', 375],
] as const)
  test(`los enlaces de la entrada del panel van centrados (${nombre})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('/panel');
    const boton = await p.locator('.acceso button[type="submit"]').boundingBox();
    const centro = boton!.x + boton!.width / 2;
    const enlaces = p.locator('.acceso > .enlace');
    await expect(enlaces).toHaveCount(2);
    for (const enlace of await enlaces.all()) {
      // El centro del texto, no el de la caja: se mide con un rango sobre el contenido.
      const medio = await enlace.evaluate((el) => {
        const rango = document.createRange();
        rango.selectNodeContents(el);
        const c = rango.getBoundingClientRect();
        return c.left + c.width / 2;
      });
      expect(Math.abs(medio - centro)).toBeLessThanOrEqual(2);
    }
    if (process.env.CAPTURAS === '1')
      await p.screenshot({ path: `docs/capturas/recorrido/acceso-centrado-${nombre}.png` });
    await ctx.close();
  });
