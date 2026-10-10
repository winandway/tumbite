import { expect, test } from '@playwright/test';

const RUTAS = ['/', '/privacidad', '/terminos', '/soporte', '/panel'];

for (const ruta of RUTAS) {
  test(`la ruta ${ruta} responde 200 y muestra la marca`, async ({ page }) => {
    const res = await page.goto(ruta);
    expect(res?.status()).toBe(200);
    await expect(page.getByText('Tumbite').first()).toBeVisible();
  });
}

test('la salud del servidor responde (solo contra el sitio publicado)', async ({ request }) => {
  test.skip(!process.env.URL_BASE, 'solo corre contra el sitio en vivo');
  const res = await request.get('/datos/salud');
  expect(res.status()).toBe(200);
});
