import { expect, test } from './fixtures';

/**
 * C-FLEX-MARGEN (13 nov 2026, Richard): «Mis empresas» y «Crear empresa» de Divoox Flex quedaban
 * pegadas al borde izquierdo de la pantalla. Deben tener margen en computadora y en celular.
 * Todos los países.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

for (const [nombre, ancho, minimo] of [
  ['computadora', 1280, 24],
  ['celular', 375, 16],
] as const)
  test(`el panel de Flex deja margen a los lados (${nombre})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
    const p = await ctx.newPage();
    const r = await p.request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.96.${ancho % 250}.${Date.now() % 250}` },
      data: {
        nombre: 'Empresa de Paquetes',
        correo: `flex.margen.${ancho}.${Date.now().toString(36)}@recorrido.test`,
        clave: `Margen-${Date.now().toString(36)}-Flex9`,
        rol: 'cliente',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    await ctx.addInitScript((pase) => localStorage.setItem('tumbite.sesion', pase), token);
    await p.goto('/panel/business');
    const formulario = p.getByTestId('registro-empresa');
    await expect(formulario).toBeVisible();
    for (const pieza of [p.locator('section.flex-panel h1'), formulario]) {
      const caja = await pieza.boundingBox();
      expect(caja!.x).toBeGreaterThanOrEqual(minimo);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho - minimo);
    }
    if (process.env.CAPTURAS === '1')
      await p.screenshot({ path: `docs/capturas/recorrido/flex-margen-${nombre}.png` });
    await ctx.close();
  });
