import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext, Browser } from '@playwright/test';
import { devices, expect, test } from './fixtures';

/**
 * NXT-5 · C-VERSION-VISIBLE: la línea «Versión … · commit» al final de Mi cuenta (cliente), del
 * Perfil (Driver) y de Más (restaurante), en español e inglés. Con CAPTURAS=1 deja la foto en
 * docs/capturas/recorrido/version-<app>-<idioma>.png (la usa la guía de soporte de Docs).
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const CAPTURAS = process.env.CAPTURAS === '1';
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');

async function cuenta(request: APIRequestContext, rol: string, idioma: string, n: number) {
  const id = `${rol}${idioma}${Date.now().toString(36)}`;
  const r = await request.post('/datos/cuentas/registro', {
    headers: { 'cf-connecting-ip': `10.95.${n}.${Date.now() % 250}` },
    data: {
      nombre: 'Versión Visible',
      correo: `version.${id}@recorrido.test`,
      telefono: rol === 'repartidor' ? `30555${String(Date.now()).slice(-5)}` : undefined,
      clave: DATOS!.clave,
      rol,
    },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return ((await r.json()) as { token: string }).token;
}

async function abrir(browser: Browser, token: string, idioma: string, ruta: string) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL: DATOS!.url,
    geolocation: { latitude: 25.7743, longitude: -80.1937 },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
    },
    [token, idioma],
  );
  const p = await ctx.newPage();
  await p.goto(ruta);
  return { ctx, p };
}

for (const idioma of ['es', 'en'] as const)
  test(`la versión se ve al final de las tres apps (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
    mkdirSync(dir, { recursive: true });
    const linea = idioma === 'en' ? /^Version \S+/ : /^Versión \S+/;
    const fotografiar = async (
      p: Awaited<ReturnType<typeof abrir>>['p'],
      nombre: string,
    ): Promise<void> => {
      const v = p.getByTestId('version-app').filter({ visible: true }).first();
      await expect(v).toBeVisible({ timeout: 30_000 });
      await expect(v).toHaveText(linea);
      await v.scrollIntoViewIfNeeded();
      if (CAPTURAS) await p.screenshot({ path: join(dir, `version-${nombre}-${idioma}.png`) });
    };

    // Cliente: Mi cuenta.
    const cli = await abrir(
      browser,
      await cuenta(request, 'cliente', idioma, 1),
      idioma,
      '/app/account',
    );
    await expect(cli.p.getByText(/^(My account|Mi cuenta)$/).first()).toBeVisible({
      timeout: 30_000,
    });
    await fotografiar(cli.p, 'cliente');
    await cli.ctx.close();

    // Driver: Perfil.
    const rep = await abrir(
      browser,
      await cuenta(request, 'repartidor', idioma, 2),
      idioma,
      '/driver/',
    );
    // C-PERMISOS-EXPLICADOS: la primera vez la app explica los permisos (sale sola, un poco después).
    const listo = rep.p.getByRole('button', {
      name: idioma === 'en' ? 'I’m ready' : 'Estoy listo',
    });
    await listo
      .waitFor({ timeout: 15_000 })
      .then(() => listo.click())
      .catch(() => undefined);
    await rep.p
      .getByRole('tab', { name: idioma === 'en' ? 'Profile' : 'Perfil' })
      .click({ timeout: 30_000 });
    await expect(listo).toBeHidden();
    await fotografiar(rep.p, 'driver');
    await rep.ctx.close();

    // Restaurante: Más.
    const token = await cuenta(request, 'restaurante', idioma, 3);
    const local = await request.put('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        nombre: `Pizzería Versión ${idioma}`,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const rest = await abrir(browser, token, idioma, '/restaurant/');
    await rest.p
      .getByRole('tab', { name: idioma === 'en' ? 'More' : 'Más' })
      .click({ timeout: 30_000 });
    await fotografiar(rest.p, 'restaurante-app');
    await rest.ctx.close();
  });
