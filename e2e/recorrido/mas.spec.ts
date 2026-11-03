import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-EXPLORAR (30 oct 2026), como la pestaña «Services» de Uber: «Más» muestra los servicios en una
 * cuadrícula de dos en dos y cada uno lleva a su pantalla. Desde el 3 nov, solo lo que ya
 * funciona (C-SOLO-LO-TERMINADO). Solo en esta computadora.
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
  test(`«Más» muestra los servicios listos en una cuadrícula (${idioma})`, async ({
    browser,
    request,
  }) => {
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
    // Catálogo fijo: cuatro servicios abiertos y Farmacia por venir, que no debe aparecer.
    const srv = (id: string, orden: number, accion: string) => ({
      id,
      nombre: id,
      descripcion: '',
      icono: `servicio-${id}`,
      orden,
      estado: accion === 'abrir' ? 'disponible' : 'proximamente',
      accion,
    });
    await p.route('**/datos/servicios*', (ruta) =>
      ruta.fulfill({
        json: {
          zona: null,
          servicios: [
            srv('comida', 10, 'abrir'),
            srv('moto', 20, 'abrir'),
            srv('carro', 30, 'abrir'),
            srv('envios', 40, 'abrir'),
            srv('farmacia', 60, 'muy_pronto'),
            srv('mas', 80, 'abrir'),
          ],
        },
      }),
    );
    await p.goto('/app/service/mas');
    const en = idioma === 'en';
    await expect(p.getByTestId('pantalla-mas')).toBeVisible({ timeout: 30_000 });
    for (const s of ['moto', 'carro', 'comida', 'envios'])
      await expect(p.getByTestId(`explorar-${s}`)).toBeVisible();
    // C-SOLO-LO-TERMINADO (3 nov): bienvenida con el logo arriba, sin franja ni «Pronto».
    await expect(p.getByText(en ? 'Welcome to Divoox' : 'Bienvenido a Divoox')).toBeVisible();
    await expect(p.getByText(/^(Pronto|Soon)$/)).toHaveCount(0);
    await expect(p.getByTestId('franja-estado')).toHaveCount(0);
    await expect(p.getByTestId('explorar-farmacia')).toHaveCount(0);
    await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', `mas-servicios-${idioma}.png`) });
    // Un servicio que todavía no abre no muestra listas de «Ejemplo» (C-SOLO-LO-TERMINADO).
    await p.goto('/app/service/farmacia');
    await expect(p.getByTestId('franja-estado')).toBeVisible({ timeout: 30_000 });
    await expect(p.getByText(/^(Ejemplo|Sample)$/)).toHaveCount(0);
    await p.goto('/app/service/mas');
    await expect(p.getByTestId('pantalla-mas')).toBeVisible({ timeout: 30_000 });
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
