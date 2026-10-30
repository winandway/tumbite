import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-MAS-RESTAURANTE (30 oct 2026): la pestaña «Más» de la app del restaurante trae la lista de
 * DoorDash Merchant (datos y horario, ganancias, reseñas, equipo, configuración, guías, términos)
 * y la versión; antes solo tenía «Cerrar sesión» y unos tres puntos sueltos.
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

for (const idioma of ['es', 'en'] as const)
  test(`la pestaña Más del restaurante tiene la lista completa (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const id = `${idioma}${Date.now().toString(36)}`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.94.${idioma === 'es' ? 1 : 2}.${Date.now() % 250}` },
      data: {
        nombre: 'Dueño Más',
        correo: `mas.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: 'restaurante',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    const local = await request.put('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        nombre: `Pizzería ${id}`,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctx.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
      },
      [token, idioma],
    );
    const p = await ctx.newPage();
    await p.goto('/restaurant/');
    await p.getByRole('tab', { name: idioma === 'en' ? 'More' : 'Más' }).click({ timeout: 30_000 });
    for (const o of [
      'restaurante',
      'ganancias',
      'resenas',
      'equipo',
      'configuracion',
      'guias',
      'legales',
    ])
      await expect(p.getByTestId(`mas-${o}`)).toBeVisible();
    await expect(
      p.getByText(idioma === 'en' ? 'Store info and hours' : 'Datos y horario'),
    ).toBeVisible();
    await expect(p.getByTestId('version-app')).toBeVisible();
    await expect(
      p.getByRole('button', { name: idioma === 'en' ? 'Sign out' : 'Cerrar sesión' }),
    ).toBeVisible();
    await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', `restapp-mas-${idioma}.png`) });
    await ctx.close();
  });
