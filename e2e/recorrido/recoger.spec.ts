import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-RECOGER-MAPA (29 oct 2026), como el «Pickup» de Uber Eats: en Comida, «Entrega | Recoger»;
 * en Recoger, el mapa de locales y lo más cerca primero con «Listo en X min». Los restaurantes van
 * simulados para no depender de las demás pruebas. Solo en esta computadora.
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

const local = (id: string, nombre: string, km: number, prep: number) => ({
  id,
  nombre,
  descripcionEs: '',
  descripcionEn: '',
  categoria: 'Pizza',
  telefono: '',
  direccion: '',
  lat: 25.77 + km / 100,
  lng: -80.19,
  imagen: null,
  plan: 'inicial',
  estado: 'aprobado',
  abierto: true,
  abiertoAhora: true,
  tiempoPrepMin: prep,
  regalosPb: 0,
  distanciaKm: km,
  moneda: 'USD',
});

for (const idioma of ['en', 'es'] as const)
  test(`recoger en el local con mapa y lo más cerca primero (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const id = Date.now().toString(36);
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.89.${Math.floor(Math.random() * 250)}.${id.length}` },
      data: {
        nombre: 'Cliente Recoger',
        correo: `recoger.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: 'cliente',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctx.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
      },
      [token, idioma] as const,
    );
    const p = await ctx.newPage();
    await p.route('**/datos/restaurantes*', (r) =>
      r.fulfill({
        json: {
          restaurantes: [
            local('r-lejos', 'Pizza Lejos', 4, 25),
            local('r-cerca', 'Pizza Cerca', 1, 15),
          ],
          zona: { id: 'US-FL-MIAMI' },
        },
      }),
    );
    await p.goto('/app/restaurants');
    const en = idioma === 'en';
    await p.getByRole('radio', { name: en ? 'Pickup' : 'Recoger' }).click();
    await expect(p.getByRole('img', { name: 'map' })).toBeVisible({ timeout: 30_000 });
    const listo = p.getByText(en ? 'Ready in 15 min' : 'Listo en 15 min');
    await expect(listo.first()).toBeVisible();
    // Lo más cerca primero: «Pizza Cerca» aparece antes que «Pizza Lejos».
    const nombres = await p
      .getByRole('button', { name: /^Pizza (Cerca|Lejos)$/ })
      .allTextContents();
    expect(nombres.findIndex((x) => x.includes('Cerca'))).toBeLessThan(
      nombres.findIndex((x) => x.includes('Lejos')),
    );
    // Volver a «Entrega» quita el mapa.
    await p.getByRole('radio', { name: en ? 'Delivery' : 'Entrega' }).click();
    await expect(p.getByRole('img', { name: 'map' })).toHaveCount(0);
    await ctx.close();
  });
