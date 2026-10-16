import { expect, test, type BrowserContext, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Versión visible en el SITIO DE PRUEBAS (C-VERSION-DEL-ARTEFACTO), con la app real del
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
  await p.getByRole('button', { name: L.boton }).click();
}

const foto = (p: Page, nombre: string) => p.screenshot({ path: `${CAPTURAS}/${nombre}.png` });

test.beforeAll(() => mkdirSync(CAPTURAS, { recursive: true }));

test('versión: la app muestra el commit que de verdad está instalado', async ({
  browser,
  request,
}) => {
  const { servidor } = (await (await request.get('/datos/version')).json()) as {
    servidor: { version: string; commit: string };
  };
  for (const idioma of ['en', 'es'] as const) {
    const ctx = await celular(browser, idioma);
    const p = await ctx.newPage();
    await registrar(p, idioma);
    await p
      .getByRole('button', {
        name: idioma === 'en' ? 'More account options' : 'Más opciones de la cuenta',
      })
      .first()
      .click();
    const v = p.getByTestId('version-app').filter({ visible: true });
    await expect(v).toHaveText(
      `${idioma === 'en' ? 'Version' : 'Versión'} ${servidor.version} · ${servidor.commit}`,
    );
    await foto(p, `version-app-${idioma}`);
    await ctx.close();
  }
});
