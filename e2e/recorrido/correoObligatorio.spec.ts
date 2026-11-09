import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test, type Page } from './fixtures';
import { sqlLocal } from './sqlLocal';
import { TEXTOS } from './textos';

/**
 * C-CORREO-OBLIGATORIO y C-BORRAR-EN-LA-APP (4 nov 2026, Richard grabando el video para Apple):
 * 0) sin cuenta se mira la portada (C-MIRAR-SIN-CUENTA, Apple 5.1.1 v);
 * 1) al crear la cuenta, la portada avisa que falta confirmar el correo; al ir a pagar, «Confirma tu
 *    correo» no deja seguir; cuando toca el enlace, la app se da cuenta sola y dice «Tu correo quedó
 *    verificado»;
 * 2) «Borrar mi cuenta» de los tres puntos se hace dentro de la app escribiendo DELETE / BORRAR, dice
 *    que quedó borrada y vuelve a la pantalla de entrar. Solo en esta computadora (la cuenta
 *    «verificar.» es la que pasa por la puerta fuera de producción).
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
const CAPTURAS = process.env.CAPTURAS === '1' && !process.env.TIENDA;

test.skip(STAGING, 'solo en esta computadora');

async function foto(p: Page, nombre: string) {
  if (!CAPTURAS) return;
  const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
  mkdirSync(dir, { recursive: true });
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(dir, `${nombre}.png`) });
}

for (const idioma of ['en', 'es'] as const)
  test(`crear la cuenta pide confirmar el correo y borrarla no sale de la app (${idioma})`, async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const L = TEXTOS[idioma];
    const id = `${Date.now().toString(36)}${idioma}`;
    const correo = `verificar.${id}@recorrido.test`;
    const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    // 0. Sin cuenta se mira la portada (Apple 5.1.1 v); entrar está a mano, sin bloquear.
    await p.goto('/app/');
    await expect(p.getByTestId('entrar-invitado')).toBeVisible({ timeout: 20_000 });
    await foto(p, `cliente-portada-sin-cuenta-${idioma}`);
    await p.getByText(L.appCrear).click();
    await p.getByLabel(L.nombreCompleto).fill('Ana García');
    await p.getByLabel(L.correo).fill(correo);
    await p.getByLabel(L.clave, { exact: true }).fill(DATOS!.clave);
    await p.getByRole('checkbox').first().click();
    await p.getByRole('button', { name: L.crearCuenta }).click();

    // 1. Vuelve a la portada con el aviso de confirmar el correo (no bloquea mirar).
    await expect(p.getByTestId('aviso-correo')).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('aviso-correo')).toContainText(correo);
    await foto(p, `cliente-aviso-correo-${idioma}`);

    // 2. Al ir a pagar, la puerta: no se paga sin el correo confirmado.
    await p.goto('/app/cart');
    await expect(p.getByTestId('confirma-tu-correo')).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('correo-a-confirmar')).toHaveText(correo);
    await foto(p, `cliente-confirma-correo-${idioma}`);
    // «Ya lo confirmé» sin haberlo hecho: lo dice y sigue en la puerta.
    await p
      .getByRole('button', { name: idioma === 'en' ? 'I already confirmed it' : 'Ya lo confirmé' })
      .click();
    await expect(p.getByRole('alert')).toBeVisible();
    await expect(p.getByTestId('confirma-tu-correo')).toBeVisible();

    // Toca el enlace del correo (aquí, la base marca el correo confirmado): la app se da cuenta sola.
    sqlLocal(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    await expect(p.getByTestId('correo-verificado')).toBeVisible({ timeout: 20_000 });
    await foto(p, `cliente-correo-verificado-${idioma}`);
    await p.getByRole('button', { name: idioma === 'en' ? 'Continue' : 'Continuar' }).click();
    await expect(p.getByTestId('confirma-tu-correo')).toBeHidden();
    await expect(p.getByTestId('correo-verificado')).toBeHidden();

    // 3. Borra la cuenta desde los tres puntos de «Mi cuenta», sin salir de la app.
    await p.goto('/app/account');
    await p
      .getByRole('button', {
        name: idioma === 'en' ? 'More account options' : 'Más opciones de la cuenta',
      })
      .last()
      .click();
    await p.getByTestId('menu-borrar-cuenta').click();
    await expect(p.getByTestId('confirmar-borrado')).toBeVisible();
    await p
      .getByLabel(idioma === 'en' ? 'Type DELETE to confirm' : 'Escribe BORRAR para confirmar')
      .fill(idioma === 'en' ? 'DELETE' : 'BORRAR');
    await foto(p, `cliente-borrar-cuenta-${idioma}`);
    expect(new URL(p.url()).pathname).toBe('/app/account');
    await p
      .getByRole('button', { name: idioma === 'en' ? 'Delete my account' : 'Borrar mi cuenta' })
      .click();
    await expect(p.getByTestId('cuenta-borrada')).toBeVisible({ timeout: 20_000 });
    await foto(p, `cliente-cuenta-borrada-${idioma}`);
    // La dirección ya no está en ninguna cuenta: se borró de verdad.
    expect(sqlLocal(`SELECT id FROM usuarios WHERE correo = '${correo}'`)).toEqual([]);
    await p.getByRole('button', { name: idioma === 'en' ? 'OK' : 'Entendido' }).click();
    await expect(p.getByText(L.appCrear)).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });
