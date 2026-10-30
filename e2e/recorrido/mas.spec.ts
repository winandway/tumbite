import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-EXPLORAR (30 oct 2026), como la pestaña «Services» de Uber: «Más» muestra todos los servicios en
 * grupos (viajes, pedidos, envíos) y cada uno lleva a su pantalla. Solo en esta computadora.
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
  test(`«Más» muestra todos los servicios en grupos (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(120_000);
    const id = Date.now().toString(36);
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.91.${Math.floor(Math.random() * 250)}.${id.length}` },
      data: {
        nombre: 'Cliente Explorar',
        correo: `explorar.${id}@recorrido.test`,
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
    await p.goto('/app/service/mas');
    const en = idioma === 'en';
    await expect(p.getByText(en ? 'All services' : 'Todos los servicios')).toBeVisible({
      timeout: 30_000,
    });
    for (const g of en ? ['Rides', 'Orders', 'Delivery'] : ['Viajes', 'Pedidos', 'Envíos'])
      await expect(p.getByText(g, { exact: true }).first()).toBeVisible();
    for (const s of ['moto', 'carro', 'comida', 'envios'])
      await expect(p.getByTestId(`explorar-${s}`)).toBeVisible();
    await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', `mas-servicios-${idioma}.png`) });
    // Cada servicio lleva a su pantalla.
    await p.getByTestId('explorar-carro').click();
    await expect(p).toHaveURL(/service\/carro/);
    await ctx.close();
  });

/**
 * C-TEXTOS-POR-SERVICIO (30 oct 2026): el formulario de pedir es el mismo para Moto, Carro y Envíos, pero
 * cada servicio dice lo suyo. Lo destapó el repaso en el celular: Carro y Envíos mostraban el casco y
 * «un pasajero con mochila» de Moto, y Envíos preguntaba «¿A dónde vas?».
 */
test('cada servicio de viajes dice lo suyo en el formulario (es)', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const id = Date.now().toString(36);
  const r = await request.post('/datos/cuentas/registro', {
    headers: { 'cf-connecting-ip': `10.92.${Math.floor(Math.random() * 250)}.${id.length}` },
    data: {
      nombre: 'Cliente Textos',
      correo: `textos.${id}@recorrido.test`,
      clave: DATOS!.clave,
      rol: 'cliente',
    },
  });
  const { token } = (await r.json()) as { token: string };
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctx.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, token);
  const p = await ctx.newPage();
  const casco = /El casco es obligatorio/;
  await p.goto('/app/ride');
  await expect(p.getByText(casco)).toBeVisible({ timeout: 30_000 });
  await p.goto('/app/ride?servicio=carro');
  await expect(p.getByText('Carro XL (6 plazas)')).toBeVisible({ timeout: 30_000 });
  await expect(p.getByText(casco)).toHaveCount(0);
  await p.goto('/app/ride?servicio=envios');
  await expect(p.getByText('¿A dónde lo llevamos?').first()).toBeVisible({ timeout: 30_000 });
  await expect(p.getByText(casco)).toHaveCount(0);
  await expect(p.getByText(/Un pasajero/)).toHaveCount(0);
  await ctx.close();
});
