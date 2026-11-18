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
  test(`el inicio muestra los servicios listos y «Más servicios» lo secundario (${idioma})`, async ({
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
    // C-INICIO-NUEVO (17 nov 2026, borrador aprobado): en el inicio, los servicios que funcionan en
    // cuatro columnas; «Más servicios» abre una hoja con lo secundario, sin repetir servicios.
    await p.goto('/app/');
    const en = idioma === 'en';
    for (const s of ['moto', 'carro', 'comida', 'envios'])
      await expect(p.getByTestId(`servicio-${s}`)).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId('servicio-farmacia')).toHaveCount(0);
    // Ningún nombre de servicio se corta, tampoco en un teléfono angosto de 360 con letra grande.
    await p.setViewportSize({ width: 360, height: 780 });
    await p.addStyleTag({ content: 'html { font-size: 120% }' });
    for (const s of ['moto', 'carro', 'comida', 'envios', 'mas']) {
      const cortado = await p
        .getByTestId(`servicio-${s}`)
        .evaluate((el) =>
          [...el.querySelectorAll('div[dir], div')]
            .filter((d) => d.childElementCount === 0 && (d.textContent ?? '').trim())
            .some((d) => d.scrollWidth > d.clientWidth + 1 || d.scrollHeight > d.clientHeight + 1),
        );
      expect(cortado, `servicio-${s} cortado a 360`).toBe(false);
    }
    await p.screenshot({ path: join(RAIZ, 'test-results', `servicios-360-${idioma}.png`) });
    await p.setViewportSize({ width: 412, height: 915 });
    await expect(p.getByText(/^(Pronto|Soon)$/)).toHaveCount(0);
    await p.getByTestId('servicio-mas').click();
    await expect(p.getByTestId('mas-regalos')).toBeVisible({ timeout: 30_000 });
    await expect(p.getByText(en ? 'More services' : 'Más servicios').last()).toBeVisible();
    await expect(p.getByTestId('mas-moto')).toHaveCount(0);
    await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', `mas-servicios-${idioma}.png`) });
    // La hoja se cierra con su propio botón (también con el lector de pantalla), traducido.
    await p
      .getByRole('button', {
        name: en ? 'Close More services' : 'Cerrar Más servicios',
        exact: true,
      })
      .click();
    await expect(p.getByTestId('mas-regalos')).toBeHidden({ timeout: 10_000 });
    // C-SIN-PANTALLAS-INTERMEDIAS: los enlaces viejos de /service/<id> llevan directo a su pantalla.
    await p.goto('/app/service/carro');
    await expect(p).toHaveURL(/ride\?servicio=carro/, { timeout: 30_000 });
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
  // C-CARRO-CATEGORIAS: las categorías se eligen al ver el precio; el formulario dice lo de Carro.
  await expect(p.getByText(/Para 6, elige Carro XL/)).toBeVisible({ timeout: 30_000 });
  // C-INICIO-NUEVO: las paradas se agregan después de elegir el destino (borrador aprobado).
  await expect(p.getByText('Tipo de carro')).toBeVisible();
  await expect(p.getByText(casco)).toHaveCount(0);
  await p.goto('/app/ride?servicio=envios');
  // Envíos: «Recoger en» y «Entregar en» (borrador aprobado), nunca «¿A dónde vas?».
  await expect(p.getByText('Entregar en').first()).toBeVisible({ timeout: 30_000 });
  await expect(p.getByText('¿A dónde vas?')).toHaveCount(0);
  await expect(p.getByText(casco)).toHaveCount(0);
  await expect(p.getByText(/Un pasajero/)).toHaveCount(0);
  await ctx.close();
});
