import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from '@playwright/test';
import { sqlLocal } from './sqlLocal';

/**
 * Pantallas de antes de iniciar sesión (19 nov 2026, órdenes de Richard) — todos los países.
 * C-SIN-CALLEJON: de «Crear cuenta» se vuelve a «Entrar» sin perder lo escrito.
 * C-RESTAURANTE-DESDE-EL-TELEFONO: el restaurante crea su cuenta en la app y tiene ayuda a la vista.
 * C-FECHA-MODERNA: la fecha se teclea con números, las barras salen solas y el orden es el del país.
 * C-SIN-LISTA-DE-CIUDADES: ninguna pantalla de registro enumera dónde funciona Divoox.
 * CAPTURAS=1 guarda las originales para Docs; CARPETA_ENTRADA, las del antes y el después.
 */
const CAPTURAS = process.env.CAPTURAS === '1';
const DOCS = join(__dirname, '..', '..', 'docs', 'capturas', 'recorrido');
const REVISION = process.env.CARPETA_ENTRADA;
// En el sitio de pruebas no hay base local que consultar: ahí manda lo que se ve en pantalla.
const STAGING = Boolean(process.env.RECORRIDO_URL);
if (REVISION) mkdirSync(REVISION, { recursive: true });

for (const idioma of ['es', 'en'] as const) {
  const en = idioma === 'en';
  // El español se enseña con un teléfono de América Latina (día primero) y el inglés con uno de
  // Estados Unidos (mes primero): el orden lo decide la región del teléfono, no el idioma.
  const contexto = {
    ...devices['Pixel 7'],
    locale: en ? 'en-US' : 'es-VE',
  };
  const guardar = async (p: import('@playwright/test').Page, nombre: string, docs = false) => {
    if (REVISION) await p.screenshot({ path: join(REVISION, `${nombre}-${idioma}.png`) });
    if (CAPTURAS && docs) await p.screenshot({ path: join(DOCS, `${nombre}-${idioma}.png`) });
  };

  test(`Driver: de «Crear cuenta» se vuelve a «Entrar» y lo escrito no se pierde (${idioma})`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext(contexto);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto('/driver/');
    await p.getByTestId('ir-a-crear-cuenta').click();
    await expect(p.getByTestId('volver-a-entrar')).toBeVisible();
    await expect(p.getByTestId('ya-tengo-cuenta-arriba')).toBeVisible();
    await expect(p.getByTestId('acceso-ayuda')).toBeVisible();
    await expect(
      p.getByText(/ya funciona en|already works in|¿Tu ciudad no está|see your city/i),
    ).toHaveCount(0);
    const nombre = p.getByPlaceholder(en ? 'Full name' : 'Nombre y apellido');
    await nombre.fill(en ? 'Alex Morgan' : 'Luis Pérez');
    await guardar(p, 'driver-crear-cuenta');
    if (CAPTURAS) {
      // La captura de Docs, con datos neutros de ejemplo.
      await p
        .getByPlaceholder(en ? 'email@example.com' : 'correo@ejemplo.com')
        .fill(en ? 'email@example.com' : 'correo@ejemplo.com');
      await p.getByPlaceholder(en ? 'Mobile phone' : 'Celular', { exact: true }).fill('3055550112');
      await p.screenshot({ path: join(DOCS, `repartidor-registro-${idioma}.png`) });
      await p.getByPlaceholder(en ? 'email@example.com' : 'correo@ejemplo.com').fill('');
      await p.getByPlaceholder(en ? 'Mobile phone' : 'Celular', { exact: true }).fill('');
    }
    // La flecha de arriba vuelve a «Entrar»…
    await p.getByTestId('volver-a-entrar').click();
    await expect(p.getByTestId('ir-a-crear-cuenta')).toBeVisible();
    await expect(p.getByTestId('volver-a-entrar')).toHaveCount(0);
    await guardar(p, 'driver-entrar');
    // …y al regresar a «Crear cuenta», lo escrito sigue ahí (borrador).
    await p.getByTestId('ir-a-crear-cuenta').click();
    await expect(nombre).toHaveValue(en ? 'Alex Morgan' : 'Luis Pérez', { timeout: 15_000 });
    // El enlace de arriba y el del final también vuelven.
    await p.getByTestId('ya-tengo-cuenta-arriba').click();
    await expect(p.getByTestId('ir-a-crear-cuenta')).toBeVisible();
    await p.getByTestId('ir-a-crear-cuenta').click();
    await p.getByTestId('ya-tengo-cuenta').click();
    await expect(p.getByTestId('ir-a-crear-cuenta')).toBeVisible();
    await ctx.close();
  });

  test(`Cliente: el cumpleaños se teclea con números y es opcional de verdad (${idioma})`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext(contexto);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto('/app/sign-in?crear=1');
    const cumple = p.getByTestId('registro-cumple');
    await expect(cumple).toBeVisible({ timeout: 30_000 });
    await expect(cumple).toHaveAttribute('placeholder', en ? 'MM/DD/YYYY' : 'DD/MM/AAAA');
    await expect(p.getByText(/AAAA-MM-DD|YYYY-MM-DD/)).toHaveCount(0);
    // Un primer dígito imposible se completa solo y las barras salen solas.
    await cumple.pressSequentially(en ? '4152000' : '1542000');
    await expect(cumple).toHaveValue(en ? '04/15/2000' : '15/04/2000');
    await guardar(p, 'cliente-crear-cuenta-fecha');
    if (CAPTURAS) {
      await p
        .getByPlaceholder(en ? 'Full name' : 'Nombre y apellido')
        .fill(en ? 'Sam Taylor' : 'Ana García');
      await p
        .getByPlaceholder(en ? 'email@example.com' : 'correo@ejemplo.com')
        .fill(en ? 'email@example.com' : 'correo@ejemplo.com');
      await p.getByPlaceholder(en ? 'Mobile phone' : 'Celular', { exact: true }).fill('3055550113');
      await p.screenshot({ path: join(DOCS, `cliente-registro-${idioma}.png`) });
    }
    // Borrar hacia atrás se come la barra sin trabarse.
    // El cursor al final sin depender de la tecla «Fin» (en la Mac no lo mueve).
    await cumple.focus();
    await cumple.evaluate((el: HTMLInputElement) =>
      el.setSelectionRange(el.value.length, el.value.length),
    );
    for (let i = 0; i < 4; i++) await cumple.press('Backspace');
    await expect(cumple).toHaveValue(en ? '04/15' : '15/04');
    // Una fecha imposible se dice en palabras, sin borrar lo escrito.
    await cumple.fill('');
    await cumple.pressSequentially(en ? '02312000' : '31022000');
    await expect(
      p.getByText(en ? /doesn’t exist in that month/ : /no existe en ese mes/),
    ).toBeVisible();
    await expect(
      p
        .getByTestId('volver-a-entrar')
        .or(p.getByRole('button', { name: en ? 'Back' : 'Volver' }))
        .first(),
    ).toBeVisible();
    await ctx.close();
  });

  test(`Restaurants: la cuenta se crea desde el teléfono, con ayuda a la vista (${idioma})`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext(contexto);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto('/restaurant/');
    const crear = p.getByTestId('ir-a-crear-cuenta');
    await expect(crear).toBeVisible({ timeout: 30_000 });
    await expect(crear).toHaveText(
      en ? 'Create a restaurant account' : 'Crear cuenta de restaurante',
    );
    await expect(p.getByText(/solo entras|created at divoox\.com/i)).toHaveCount(0);
    await expect(p.getByTestId('acceso-ayuda')).toBeVisible();
    await guardar(p, 'app-restaurante-app-entrar', true);
    await crear.click();
    await expect(p.getByTestId('volver-a-entrar')).toBeVisible();
    const correo = `rest-entrada-${idioma}-${Date.now().toString(36)}@recorrido.test`;
    await p
      .getByPlaceholder(en ? 'Full name' : 'Nombre y apellido')
      .fill(en ? 'Jordan Lee' : 'Marco Rossi');
    await p.getByPlaceholder(en ? 'email@example.com' : 'correo@ejemplo.com').fill(correo);
    // El celular es único por cuenta y el sitio de pruebas guarda las corridas anteriores:
    // cada corrida usa uno distinto (uno fijo choca con «Ese teléfono ya tiene una cuenta»).
    const celular = `30555${String(Date.now() % 100000).padStart(5, '0')}`;
    const casillaCelular = p.getByPlaceholder(en ? 'Mobile phone' : 'Celular', { exact: true });
    await casillaCelular.fill(celular);
    await p.locator('input[type="password"]').fill('Recorrido-2026-entrada');
    // En la foto, un correo neutro (el de la corrida lleva letras al azar).
    if (CAPTURAS || REVISION) {
      const visible = p.getByPlaceholder(en ? 'email@example.com' : 'correo@ejemplo.com');
      await visible.fill(en ? 'email@example.com' : 'correo@ejemplo.com');
      await casillaCelular.fill(en ? '3055550145' : '3055550144');
      await guardar(p, 'app-restaurante-app-crear-cuenta', true);
      await visible.fill(correo);
      await casillaCelular.fill(celular);
    }
    await p.getByRole('checkbox').first().click();
    // C-REVISA-TUS-DATOS: nada se manda solo; primero «Revisa tus datos», con el correo en grande.
    await p.getByTestId('registro-continuar').click();
    await expect(p.getByTestId('revisar-correo')).toHaveText(correo);
    await guardar(p, 'app-restaurante-app-revisa-tus-datos');
    await p.getByTestId('crear-mi-cuenta').click();
    // Ya dentro: la app le ofrece completar su restaurante ahí mismo, sin pedirle una computadora.
    await expect(
      p.getByRole('button', { name: en ? 'Complete my restaurant' : 'Completar mi restaurante' }),
    ).toBeVisible({ timeout: 30_000 });
    await guardar(p, 'app-restaurante-app-completar', true);
    if (!STAGING)
      expect(sqlLocal(`SELECT rol FROM usuarios WHERE correo = '${correo}'`)[0]).toMatchObject({
        rol: 'restaurante',
      });
    // La cuenta recién creada se borra desde esa misma pantalla, sin completar el restaurante.
    await p.getByTestId('cuenta-tres-puntos').click();
    await p.getByTestId('borrar-cuenta').click();
    await p
      .getByPlaceholder(en ? 'Type DELETE to confirm' : 'Escribe BORRAR para confirmar')
      .fill(en ? 'DELETE' : 'BORRAR');
    await guardar(p, 'app-restaurante-app-borrar-cuenta');
    await p.getByRole('button', { name: en ? 'Delete my account' : 'Borrar mi cuenta' }).click();
    await expect(
      p.getByText(en ? 'Your account was deleted' : 'Tu cuenta quedó borrada'),
    ).toBeVisible();
    if (!STAGING)
      expect(sqlLocal(`SELECT id FROM usuarios WHERE correo = '${correo}'`)).toHaveLength(0);
    await ctx.close();
  });

  test(`Panel web: crear la cuenta de restaurante sin lista de ciudades y con ayuda (${idioma})`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto('/panel');
    await p
      .getByRole('button', { name: en ? /New here|Create/i : /Eres nuevo|Crea tu cuenta|Crear/i })
      .first()
      .click();
    await expect(p.getByTestId('acceso-ayuda')).toBeVisible();
    await expect(p.getByTestId('donde-funciona')).toHaveCount(0);
    await expect(p.getByText(/ya funciona en|already works in/i)).toHaveCount(0);
    const casillas = p.locator('form input:not([type="checkbox"])');
    await casillas.nth(0).fill(en ? 'Jordan Lee' : 'Marco Rossi');
    await casillas.nth(1).fill(en ? 'email@example.com' : 'correo@ejemplo.com');
    await casillas.nth(2).fill('3055550110');
    await guardar(p, 'restaurante-registro', true);
    await ctx.close();
  });
}
