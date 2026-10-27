import { expect, test, type BrowserContext, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Hito 1 en el SITIO DE PRUEBAS (C-CATALOGO-ESTABLE y C-SESION-CON-LIMITE), con la app real del
 * cliente en un celular de 375 px. Solo cuentas nuevas @hito1.test; nada de dinero.
 * Uso: HITO1_URL=https://staging.tumbite.com npx playwright test -c playwright.hito1.config.ts
 */
const CASA = { latitude: 25.7725, longitude: -80.187 };
const CAPTURAS = 'docs/capturas/hito1';
const CLAVE = 'Hito1-prueba-segura-2026';
const TXT = {
  en: {
    crear: 'New here? Create your account',
    nombre: 'Full name',
    correo: 'Email',
    celular: 'Mobile phone',
    clave: 'Password',
    boton: 'Create account',
    comida: 'Food',
  },
  es: {
    crear: '¿Eres nuevo? Crea tu cuenta',
    nombre: 'Nombre y apellido',
    correo: 'Correo',
    celular: 'Celular',
    clave: 'Contraseña',
    boton: 'Crear cuenta',
    comida: 'Comida',
  },
} as const;

async function celular(browser: Browser, idioma: 'en' | 'es'): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    geolocation: CASA,
    permissions: ['geolocation'],
    locale: idioma === 'en' ? 'en-US' : 'es-US',
  });
  await ctx.addInitScript((i) => {
    if (!localStorage.getItem('tumbite.idioma')) localStorage.setItem('tumbite.idioma', i);
  }, idioma);
  return ctx;
}

async function registrar(p: Page, idioma: 'en' | 'es') {
  const L = TXT[idioma];
  await p.goto('/app/');
  await p.getByText(L.crear).click();
  await p.getByLabel(L.nombre).fill('Prueba Hito');
  await p.getByLabel(L.correo).fill(`cliente.${idioma}${Date.now().toString(36)}@hito1.test`);
  await p.getByLabel(L.celular).fill('3055550199');
  await p.getByLabel(L.clave, { exact: true }).fill(CLAVE);
  await p.getByRole('checkbox').click(); // acepta los términos
  await p.getByRole('button', { name: L.boton }).click();
}

const foto = (p: Page, nombre: string) => p.screenshot({ path: `${CAPTURAS}/${nombre}.png` });

test.beforeAll(() => mkdirSync(CAPTURAS, { recursive: true }));

for (const idioma of ['en', 'es'] as const) {
  test(`catálogo: una respuesta vieja y lenta no borra la lista (${idioma})`, async ({
    browser,
    request,
  }) => {
    const { restaurantes } = (await (
      await request.get(`/datos/restaurantes?lat=${CASA.latitude}&lng=${CASA.longitude}`)
    ).json()) as { restaurantes: { nombre: string }[] };
    expect(restaurantes.length).toBeGreaterThan(0);
    const nombre = restaurantes[0]!.nombre;

    const ctx = await celular(browser, idioma);
    const p = await ctx.newPage();
    const pedidos: string[] = [];
    // La consulta SIN ubicación tarda 5 s a propósito: antes llegaba última y borraba la buena.
    await p.route('**/datos/restaurantes**', async (r) => {
      const url = r.request().url();
      pedidos.push(url);
      if (!url.includes('lat=')) await new Promise((ok) => setTimeout(ok, 5000));
      await r.continue();
    });
    await registrar(p, idioma);
    await expect(p.getByText(nombre).first()).toBeVisible({ timeout: 30_000 });
    await p.waitForTimeout(7000); // ya llegó la respuesta vieja
    await expect(p.getByText(nombre).first()).toBeVisible();
    // Ir a «Comida» y volver no repite la consulta (lista compartida, recuerdo de 60 s).
    const antes = pedidos.length;
    await p.getByRole('button', { name: TXT[idioma].comida, exact: true }).click();
    await expect(p.getByText(nombre).filter({ visible: true }).first()).toBeVisible();
    await p.goBack();
    await expect(p.getByText(nombre).first()).toBeVisible();
    expect(pedidos.length - antes).toBe(0);
    expect(pedidos.length).toBeLessThanOrEqual(3);

    // Sin conexión con la lista ya cargada (pasado el recuerdo de 60 s): se conserva y avisa,
    // con «Intentar de nuevo».
    await p.unroute('**/datos/restaurantes**');
    await p.route('**/datos/restaurantes**', (r) => r.abort());
    await p.waitForTimeout(61_000);
    await p.getByRole('button', { name: TXT[idioma].comida, exact: true }).click();
    await expect(p.getByTestId('catalogo-lista-con-error').filter({ visible: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(p.getByText(nombre).filter({ visible: true }).first()).toBeVisible();
    await expect(
      p
        .getByRole('button', { name: idioma === 'en' ? 'Try again' : 'Intentar de nuevo' })
        .filter({ visible: true }),
    ).toBeVisible();
    await foto(p, `catalogo-no-se-actualizo-${idioma}`);
    await ctx.close();
  });

  test(`sesión: si el servidor no contesta, no se queda cargando para siempre (${idioma})`, async ({
    browser,
  }) => {
    const ctx = await celular(browser, idioma);
    const p = await ctx.newPage();
    await registrar(p, idioma);
    await expect(p.getByRole('button', { name: TXT[idioma].comida, exact: true })).toBeVisible({
      timeout: 30_000,
    });
    // El servidor se cuelga al comprobar la sesión guardada.
    await p.route('**/datos/cuentas/yo', () => {});
    const t0 = Date.now();
    await p.reload();
    await expect(p.getByTestId('sesion-sin-confirmar')).toBeVisible({ timeout: 15_000 });
    expect(Date.now() - t0).toBeLessThan(15_000);
    // Nada protegido mientras tanto, y la sesión sigue guardada.
    await expect(p.getByRole('button', { name: TXT[idioma].comida, exact: true })).toHaveCount(0);
    expect(await p.evaluate(() => Boolean(localStorage.getItem('tumbite.sesion')))).toBe(true);
    await foto(p, `sesion-sin-confirmar-${idioma}`);
    // Vuelve la conexión: «Reintentar» entra sin pedir la contraseña.
    await p.unroute('**/datos/cuentas/yo');
    await p.getByRole('button', { name: idioma === 'en' ? 'Try again' : 'Reintentar' }).click();
    await expect(p.getByRole('button', { name: TXT[idioma].comida, exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await ctx.close();
  });
}

test('100 aperturas seguidas: siempre llega al inicio o a una pantalla con salida', async ({
  browser,
}) => {
  test.setTimeout(1_800_000);
  const ctx = await celular(browser, 'en');
  const p = await ctx.newPage();
  // Lo que respondió el servidor al comprobar la sesión en cada apertura.
  const codigos = new Map<number, number>();
  p.on('response', (r) => {
    if (r.url().includes('/datos/cuentas/yo'))
      codigos.set(r.status(), (codigos.get(r.status()) ?? 0) + 1);
  });
  await registrar(p, 'en');
  const inicio = p.getByRole('button', { name: 'Food', exact: true });
  await expect(inicio).toBeVisible({ timeout: 30_000 });
  let alInicio = 0;
  let sinConfirmar = 0;
  for (let i = 0; i < 100; i++) {
    await p.reload();
    await expect(inicio.or(p.getByTestId('sesion-sin-confirmar'))).toBeVisible({ timeout: 15_000 });
    if (await inicio.isVisible()) alInicio++;
    else sinConfirmar++;
    // Al ritmo de una persona apurada (una apertura cada ~2 s), por debajo del límite de intentos.
    await p.waitForTimeout(1500);
  }
  const resumen = `100 aperturas: ${alInicio} al inicio, ${sinConfirmar} con «Reintentar»; servidor: ${JSON.stringify(Object.fromEntries(codigos))}`;
  console.warn(resumen);
  expect(alInicio + sinConfirmar).toBe(100);
  // Con el servidor sano, todas llegan al inicio: «Reintentar» solo aparece si falla la conexión.
  if ([...codigos.keys()].every((c) => c === 200)) expect(alInicio).toBe(100);
  await ctx.close();
});
