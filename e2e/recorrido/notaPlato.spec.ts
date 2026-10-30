import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-NOTA-PLATO (30 oct 2026): el cliente escribe «sin cebolla» en el plato (instrucciones especiales,
 * como Uber Eats) y la nota sale en su carrito; el mismo plato con otra nota es otra línea.
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

const sql = (comando: string) =>
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'tumbite-local',
      '--local',
      '--persist-to',
      '.recorrido/estado',
      '-c',
      '.recorrido/wrangler.jsonc',
      '--command',
      comando,
    ],
    { cwd: RAIZ, encoding: 'utf8' },
  );

test('el cliente escribe una nota en el plato y la ve en el carrito', async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const id = Date.now().toString(36);
  let ip = 0;
  const cuenta = async (rol: string, nombre: string) => {
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.98.${Math.floor(Math.random() * 250)}.${++ip}` },
      data: { nombre, correo: `nota.${rol}.${id}@recorrido.test`, clave: DATOS!.clave, rol },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const dueno = await cuenta('restaurante', 'Dueño Notas');
  const cliente = await cuenta('cliente', 'Ana García');
  const h = { authorization: `Bearer ${dueno.token}` };
  const local = await request.put('/datos/mi-restaurante', {
    headers: h,
    data: {
      nombre: `Pizzería Notas ${id}`,
      categoria: 'Pizza',
      telefono: '3055550100',
      direccion: '100 Biscayne Blvd, Miami, FL',
      lat: 25.7743,
      lng: -80.1937,
    },
  });
  expect(local.ok(), await local.text()).toBe(true);
  const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
  const plato = await request.post('/datos/mi-restaurante/platos', {
    headers: h,
    data: { nombreEs: 'Pizza Margarita', nombreEn: 'Margherita Pizza', precioCentavos: 1200 },
  });
  expect(plato.ok(), await plato.text()).toBe(true);
  sql(`UPDATE restaurantes SET estado = 'aprobado', abierto = 1 WHERE id = '${rid}'`);
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctx.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, cliente.token);
  const p = await ctx.newPage();
  await p.goto(`/app/restaurant/${rid}`);
  for (const nota of ['sin cebolla', 'bien cocida']) {
    await p.getByText('Pizza Margarita').first().click({ timeout: 30_000 });
    await p.getByTestId('nota-plato').fill(nota);
    await p.getByRole('button', { name: /Agregar al carrito/ }).click();
    await expect(p.getByTestId('nota-plato')).toHaveCount(0);
  }
  await p.goto('/app/cart');
  await expect(p.getByText('Pizza Margarita · Nota: sin cebolla')).toBeVisible({ timeout: 30_000 });
  await expect(p.getByText('Pizza Margarita · Nota: bien cocida')).toBeVisible();
  await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'nota-plato-carrito-es.png') });
  // C-DIRECCION-APTO: el apartamento va en su propia casilla y no se pierde al recargar.
  await p.getByTestId('carrito-apto').fill('Apto 4B');
  await p.waitForTimeout(800);
  await p.reload();
  await expect(p.getByTestId('carrito-apto')).toHaveValue('Apto 4B', { timeout: 30_000 });
  await ctx.close();
});
