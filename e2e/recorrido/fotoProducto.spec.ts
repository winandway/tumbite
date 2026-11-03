import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * NXT-8 · C-TIENDAS-FOTO-PROPIA y NXT-7 · C-FOTOS-LIVIANAS en el navegador de verdad: una tienda
 * sube la foto de un producto desde el panel; el navegador la convierte a WebP en tres tamaños y el
 * servidor guarda los tres. En la app, la tienda ve «Productos» en «Más». Con CAPTURAS=1 deja las
 * fotos originales de Docs en docs/capturas/recorrido/.
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

for (const idioma of ['es', 'en'] as const)
  test(`la tienda sube la foto del producto en tres tamaños (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(180_000);
    const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
    mkdirSync(dir, { recursive: true });
    const id = `${idioma}${Date.now().toString(36)}`;
    const ip = { 'cf-connecting-ip': `10.96.${idioma === 'es' ? 1 : 2}.${Date.now() % 250}` };
    const correo = `foto.${id}@recorrido.test`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: ip,
      data: { nombre: 'Tienda Fotos', correo, clave: DATOS!.clave, rol: 'restaurante' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    const h = { authorization: `Bearer ${token}`, ...ip };
    const local = await request.put('/datos/mi-restaurante', {
      headers: h,
      data: {
        nombre: `Mercado ${id}`,
        categoria: 'Mercado',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    expect(
      (
        await request.put('/datos/mi-restaurante/tipo', { headers: h, data: { tipo: 'mercado' } })
      ).status(),
    ).toBe(200);

    // Panel: «Productos», subir la foto y guardar el producto.
    const ctx = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      baseURL: DATOS!.url,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.request.post('/datos/cuentas/entrar', {
      headers: ip,
      data: { correo, clave: DATOS!.clave },
    });
    const p = await ctx.newPage();
    await p.goto(`${idioma === 'es' ? '/es' : ''}/panel/products`);
    const etiqueta = idioma === 'en' ? 'Product photo' : 'Foto del producto';
    await p
      .getByLabel(etiqueta)
      .setInputFiles(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-recogida.jpg'));
    const img = p.getByRole('img', { name: etiqueta });
    await expect(img).toHaveAttribute('src', /^\/media\/fotos\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/, {
      timeout: 30_000,
    });
    const url = (await img.getAttribute('src'))!;
    // Los tres tamaños, cada uno más liviano que el anterior (la miniatura no es la completa).
    const pesos: number[] = [];
    for (const ruta of [url, url.replace('.webp', '-m.webp'), url.replace('.webp', '-s.webp')]) {
      const res = await request.get(ruta);
      expect(res.status(), ruta).toBe(200);
      expect(res.headers()['content-type']).toBe('image/webp');
      expect(res.headers()['cache-control'], ruta).toContain('immutable');
      pesos.push((await res.body()).length);
    }
    expect(pesos[1]!).toBeLessThan(pesos[0]!);
    expect(pesos[2]!).toBeLessThan(pesos[1]!);
    await p.getByLabel(/^SKU/).fill(`BOLSA-${id.slice(-4)}`.toUpperCase());
    await p
      .getByLabel(idioma === 'en' ? 'Product name' : 'Nombre del producto')
      .fill(idioma === 'en' ? 'Reusable shopping bag' : 'Bolsa de compras reutilizable');
    await p
      .getByLabel(idioma === 'en' ? 'Category' : 'Categoría')
      .last()
      .fill(idioma === 'en' ? 'Household' : 'Hogar');
    await p.getByLabel(idioma === 'en' ? 'Price' : 'Precio').fill('2.50');
    await img.scrollIntoViewIfNeeded();
    if (CAPTURAS) await p.screenshot({ path: join(dir, `web-tienda-foto-producto-${idioma}.png`) });
    await p
      .getByRole('button', { name: idioma === 'en' ? 'Save product' : 'Guardar el producto' })
      .click();
    await expect
      .poll(async () => {
        const l = await request.get('/datos/mi-restaurante/productos', { headers: h });
        return ((await l.json()) as { totales: { sinFoto: number; productos: number } }).totales;
      })
      .toEqual({ productos: 1, disponibles: 1, sinFoto: 0 });
    await ctx.close();

    // App de la tienda: «Productos» en «Más».
    const app = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await app.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
      },
      [token, idioma],
    );
    const a = await app.newPage();
    await a.goto('/restaurant/');
    await a.getByRole('tab', { name: idioma === 'en' ? 'More' : 'Más' }).click({ timeout: 30_000 });
    await expect(a.getByTestId('mas-productos')).toBeVisible();
    if (CAPTURAS) await a.screenshot({ path: join(dir, `restapp-mas-productos-${idioma}.png`) });
    await app.close();
  });
