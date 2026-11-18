import { expect, test } from '@playwright/test';

/**
 * C-DOCS-MENU-PLEGADO y C-DOCS-AL-GRANO (18 nov 2026, Richard): al tocar «Ver la guía con capturas» en el chat de Camila,
 * la página abría con TODO el menú de Docs desplegado arriba y había que bajar muchísimo para llegar
 * al texto. Cada página de Docs abre directo en su contenido, como una página de Wikipedia: en el
 * celular el menú va plegado en un botón y el título queda en la primera pantalla. En escritorio la
 * barra lateral sigue a la vista con el ítem activo resaltado.
 */
const CELULAR = { width: 375, height: 667 };
const PAGINAS = [
  '/docs',
  '/es/docs',
  '/docs/how-to',
  '/es/docs/how-to',
  '/docs/ordering',
  '/es/docs/drivers',
  '/docs/ordering/ride-moto',
  '/es/docs/ordering/ride-moto',
  '/es/docs/drivers/start-delivering',
  '/docs/courses/customers-presentation',
  '/es/docs/restaurants/order-photos',
];

test.describe('Docs al grano en el celular (375 de ancho)', () => {
  test.use({ viewport: CELULAR, hasTouch: true, isMobile: true });

  for (const ruta of PAGINAS) {
    test(`${ruta}: el título está en la primera pantalla y el menú va plegado`, async ({
      page,
    }) => {
      const res = await page.goto(ruta);
      expect(res?.status()).toBe(200);
      const titulo = page.locator('main.docs-contenido h1').first();
      await expect(titulo).toBeVisible();
      const caja = await titulo.boundingBox();
      expect(caja, 'el título tiene que estar dibujado').not.toBeNull();
      // Entero dentro de la primera pantalla, sin deslizar.
      expect(caja!.y + caja!.height).toBeLessThanOrEqual(CELULAR.height);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      // El menú existe (la barra nunca se pierde), pero plegado en su botón.
      const boton = page.locator('.docs-menu-boton');
      await expect(boton).toBeVisible();
      await expect(boton).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.docs-barra nav')).toBeHidden();
      // Nada se sale por el costado.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }

  test('una guía abre con «← Docs», el resumen y los pasos antes que nada', async ({ page }) => {
    await page.goto('/es/docs/ordering/ride-moto');
    const guia = page.locator('article.docs-guia');
    await expect(guia.getByRole('link', { name: '← Docs' })).toBeVisible();
    await expect(guia.locator('.docs-resumen')).toBeVisible();
    // Los pasos numerados van antes de la explicación larga y de las capturas.
    const orden = await guia.evaluate((a) => {
      const y = (s: string) => a.querySelector(s)?.getBoundingClientRect().top ?? -1;
      return { pasos: y('ol'), capturas: y('.docs-capturas'), explicacion: y('.docs-explicacion') };
    });
    expect(orden.pasos).toBeGreaterThan(0);
    expect(orden.pasos).toBeLessThan(orden.capturas);
    expect(orden.capturas).toBeLessThan(orden.explicacion);
  });

  test('el menú se abre al tocarlo, resalta la guía y se pliega al elegir otra', async ({
    page,
  }) => {
    await page.goto('/es/docs/ordering/ride-moto');
    const boton = page.locator('.docs-menu-boton');
    await boton.click();
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('.docs-barra nav');
    await expect(menu).toBeVisible();
    await expect(menu.locator('a.activo')).toHaveText(/Pedir un viaje en moto/);
    await menu.locator('details[open] li a:not(.activo)').first().click();
    await expect(page).not.toHaveURL(/ride-moto$/);
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
    const caja = await page.locator('main.docs-contenido h1').first().boundingBox();
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(CELULAR.height);
  });
});

test.describe('Docs en escritorio', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('la barra lateral sigue a la vista con la guía activa resaltada', async ({ page }) => {
    await page.goto('/docs/ordering/ride-moto');
    await expect(page.locator('.docs-menu-boton')).toBeHidden();
    const menu = page.locator('.docs-barra nav');
    await expect(menu).toBeVisible();
    await expect(menu.locator('a.activo')).toHaveText(/moto/i);
    await expect(page.locator('main.docs-contenido h1').first()).toBeInViewport();
  });
});
