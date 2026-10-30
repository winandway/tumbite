import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-COLORES-DRIVER (30 oct 2026): la barra de abajo y la campana del Driver van en los colores de la
 * marca, con íconos vectoriales; las imágenes viejas (azules, con un punto rojo pintado) ya no se cargan.
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

test('el Driver usa los colores de la marca en la barra y la campana', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const id = Date.now().toString(36);
  const r = await request.post('/datos/cuentas/registro', {
    headers: { 'cf-connecting-ip': `10.93.${Math.floor(Math.random() * 250)}.${id.length}` },
    data: {
      nombre: 'Conductor Colores',
      correo: `colores.${id}@recorrido.test`,
      clave: DATOS!.clave,
      rol: 'repartidor',
    },
  });
  expect(r.ok(), await r.text()).toBe(true);
  const { token } = (await r.json()) as { token: string };
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctx.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, token);
  const p = await ctx.newPage();
  const viejas: string[] = [];
  p.on(
    'request',
    (q) => /nav-(inicio|pedidos|cuenta)|icono-campana/.test(q.url()) && viejas.push(q.url()),
  );
  await p.goto('/driver');
  await expect(p.getByTestId('nav-inicio')).toBeVisible({ timeout: 30_000 });
  await expect(p.getByTestId('nav-perfil')).toBeVisible();
  expect(viejas).toEqual([]);
  await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'driver-colores-es.png') });
  await ctx.close();
});
