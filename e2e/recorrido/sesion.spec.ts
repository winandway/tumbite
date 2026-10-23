import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-SESION-REINTENTA-SOLA (23 oct 2026): si al abrir la app no se puede confirmar la sesión (sin
 * conexión), la pantalla «No pudimos confirmar tu sesión» sigue reintentando sola. Al volver la
 * conexión, la persona entra sin tocar nada. Solo en esta computadora.
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

for (const idioma of ['en', 'es'] as const)
  test(`sin conexión al abrir: la app reintenta sola y entra cuando vuelve la red (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const id = Date.now().toString(36);
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.88.${Math.floor(Math.random() * 250)}.${id.length}` },
      data: {
        nombre: 'Cliente Sesion',
        correo: `sesion.${id}@recorrido.test`,
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
    const pagina = await ctx.newPage();
    // Sin conexión con el servidor: la confirmación de la sesión falla.
    await pagina.route('**/datos/cuentas/yo', (ruta) => ruta.abort('internetdisconnected'));
    await pagina.goto('/app/');
    await expect(pagina.getByTestId('sesion-sin-confirmar')).toBeVisible({ timeout: 30_000 });
    // Con CAPTURAS=1, la foto original de esta pantalla para Docs.
    if (process.env.CAPTURAS === '1' && !process.env.TIENDA) {
      const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
      mkdirSync(dir, { recursive: true });
      await pagina.screenshot({ path: join(dir, `cliente-sesion-sin-confirmar-${idioma}.png`) });
    }

    // Vuelve la conexión. Nadie toca «Reintentar»: la app entra sola.
    await pagina.unroute('**/datos/cuentas/yo');
    await expect(pagina.getByTestId('sesion-sin-confirmar')).toBeHidden({ timeout: 30_000 });
    expect(await pagina.evaluate(() => localStorage.getItem('tumbite.sesion'))).toBe(token);
    await ctx.close();
  });
