import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test, type Page } from './fixtures';
import { sqlLocal } from './sqlLocal';
import { cruzarPuertaCelular } from './puertaCelular';
import { TEXTOS } from './textos';
import { aceptarTerminos, enPaso } from './registroPorPasos';

/**
 * C-CORREO-NO-FRENA (23 nov 2026, decisión de Richard: el correo en segundo plano), C-CORREO-FRANJA,
 * C-CORREO-OBLIGATORIO (donde el código del celular no tiene por dónde salir) y C-BORRAR-EN-LA-APP:
 * 0) sin cuenta se mira la portada (C-MIRAR-SIN-CUENTA, Apple 5.1.1 v);
 * 1) al crear la cuenta, la portada muestra la franja del correo; al ir a pagar, se confirma el celular
 *    con el código y se sigue al carrito SIN confirmar el correo. La franja trae «Mandar el enlace otra
 *    vez» y «¿Correo equivocado? Cámbialo», y se pone verde cuando la persona toca el enlace;
 * 2) donde el código no pudo salir por ningún canal (C-TELEFONO-SIN-CANAL), al ir a pagar «Confirma tu
 *    correo» frena como siempre y, al tocar el enlace, dice «Tu correo quedó verificado»;
 * 3) «Borrar mi cuenta» de los tres puntos se hace dentro de la app (DELETE / BORRAR);
 * 4) Driver: la misma franja en el inicio, sin frenar nada.
 * Solo en esta computadora (las cuentas «verificar.» son las que tienen correo por confirmar fuera de
 * producción).
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

const celular = () => `+1305555${String(Date.now()).slice(-4)}`;
const idDe = (correo: string) =>
  String(sqlLocal(`SELECT id FROM usuarios WHERE correo = '${correo}'`)[0]?.id ?? '');

async function crearCuenta(p: Page, idioma: 'en' | 'es', correo: string) {
  const L = TEXTOS[idioma];
  await p.getByText(L.appCrear).click();
  await (await enPaso(p, p.getByLabel(L.nombreCompleto))).fill('Ana García');
  await (await enPaso(p, p.getByLabel(L.correo))).fill(correo);
  await (await enPaso(p, p.getByLabel(L.clave, { exact: true }))).fill(DATOS!.clave);
  await aceptarTerminos(p); // acepta los términos (último paso)
  // C-REVISA-TUS-DATOS: «Continuar» abre «Revisa tus datos»; la cuenta se crea con «Crear mi cuenta».
  await p.getByTestId('registro-continuar').click();
  await p.getByTestId('crear-mi-cuenta').click();
}

async function borrarCuenta(p: Page, idioma: 'en' | 'es', correo: string) {
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
  await expect(p.getByText(TEXTOS[idioma].appCrear)).toBeVisible({ timeout: 20_000 });
}

for (const idioma of ['en', 'es'] as const) {
  test(`con el celular confirmado el correo no frena: franja suave y se pide igual (${idioma})`, async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const id = `${Date.now().toString(36)}${idioma}`;
    const correo = `verificar.${id}@recorrido.test`;
    const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    // 0. Sin cuenta se mira la portada (Apple 5.1.1 v); entrar está a mano, sin bloquear.
    await p.goto('/app/');
    await expect(p.getByTestId('entrar-invitado')).toBeVisible({ timeout: 20_000 });
    await foto(p, `cliente-portada-sin-cuenta-${idioma}`);
    await crearCuenta(p, idioma, correo);

    // 1. Vuelve a la portada con la franja del correo (no frena nada).
    await expect(p.getByTestId('aviso-correo')).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('aviso-correo')).toContainText(correo);
    await expect(p.getByTestId('aviso-correo-reenviar')).toBeVisible();
    await expect(p.getByTestId('aviso-correo-cambiar')).toBeVisible();
    await foto(p, `cliente-aviso-correo-${idioma}`);

    // 2. Al ir a pagar, el celular con su código, y al carrito SIN confirmar el correo.
    await p.goto('/app/cart');
    await cruzarPuertaCelular(p, correo, celular());
    await expect(
      p.getByText(idioma === 'en' ? 'Find food' : 'Buscar comida', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('confirma-tu-correo')).toHaveCount(0);
    await foto(p, `cliente-carrito-sin-correo-${idioma}`);

    // 3. En la portada la franja sigue: manda un enlace NUEVO y deja cambiar el correo.
    await p.goto('/app/');
    await expect(p.getByTestId('aviso-correo')).toBeVisible({ timeout: 20_000 });
    await p.getByTestId('aviso-correo-reenviar').click();
    await expect(p.getByTestId('aviso-correo')).toContainText(
      idioma === 'en' ? 'We sent you a new link' : 'Te mandamos un enlace nuevo',
    );
    await p.getByTestId('aviso-correo-cambiar').click();
    await expect(p.getByTestId('cambiar-correo')).toBeVisible();
    await foto(p, `cliente-franja-cambiar-correo-${idioma}`);
    await p.getByRole('button', { name: idioma === 'en' ? 'Cancel' : 'Cancelar' }).click();
    await expect(p.getByTestId('cambiar-correo')).toHaveCount(0);

    // 4. Toca el enlace del correo (aquí, la base lo marca): la franja se pone verde sola.
    sqlLocal(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    await expect(p.getByTestId('aviso-correo-verificado')).toBeVisible({ timeout: 30_000 });
    await foto(p, `cliente-franja-correo-verificado-${idioma}`);

    // 5. Borra la cuenta desde los tres puntos de «Mi cuenta», sin salir de la app.
    await borrarCuenta(p, idioma, correo);
    await ctx.close();
  });

  test(`sin canal para el código, el correo frena como siempre al ir a pagar (${idioma})`, async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const id = `${Date.now().toString(36)}s${idioma}`;
    const correo = `verificar.${id}@recorrido.test`;
    const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto('/app/');
    await expect(p.getByTestId('entrar-invitado')).toBeVisible({ timeout: 20_000 });
    await crearCuenta(p, idioma, correo);
    await expect(p.getByTestId('aviso-correo')).toBeVisible({ timeout: 20_000 });
    // C-TELEFONO-SIN-CANAL: el código no pudo salir por ningún canal (por ejemplo, el proveedor rechazó
    // el número): la puerta del celular se abre sola y queda la del correo.
    const usuario = idDe(correo);
    sqlLocal(
      `INSERT INTO codigos_telefono (usuario_id, telefono, codigo_hash, intentos, enviados_hoy, creado_en, sin_canal_en)
       VALUES ('${usuario}', '', '-', 0, 0, datetime('now'), datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET sin_canal_en = datetime('now')`,
    );
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
    sqlLocal(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    await expect(p.getByTestId('correo-verificado')).toBeVisible({ timeout: 20_000 });
    await foto(p, `cliente-correo-verificado-${idioma}`);
    await p.getByRole('button', { name: idioma === 'en' ? 'Continue' : 'Continuar' }).click();
    await expect(p.getByTestId('confirma-tu-correo')).toBeHidden();
    await expect(p.getByTestId('correo-verificado')).toBeHidden();
    await borrarCuenta(p, idioma, correo);
    await ctx.close();
  });

  // C-MENSAJES-ACCESO (24 nov 2026, decisión de Richard): con un correo sin cuenta, «olvidé mi
  // contraseña» ya no finge que mandó algo: dice que no hay cuenta y ofrece crearla.
  test(`olvidé mi contraseña con un correo sin cuenta lo dice y ofrece crearla (${idioma})`, async ({
    browser,
  }) => {
    const es = idioma === 'es';
    const ctx = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      baseURL: DATOS!.url,
      locale: es ? 'es-US' : 'en-US',
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto(`${es ? '/es' : ''}/forgot-password`);
    await p.getByRole('textbox').first().fill('nombre@ejemplo.com');
    await p.getByRole('button', { name: es ? 'Mandarme el enlace' : 'Send me the link' }).click();
    await expect(p.getByTestId('olvide-sin-cuenta')).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('accion-crear')).toBeVisible();
    if (CAPTURAS) {
      mkdirSync(join(RAIZ, 'docs', 'capturas', 'recorrido'), { recursive: true });
      await p.screenshot({
        path: join(RAIZ, 'docs', 'capturas', 'recorrido', `web-olvide-codigo-${idioma}.png`),
      });
    }
    await ctx.close();
  });

  test(`Driver: la franja del correo en el inicio, sin frenar el registro (${idioma})`, async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const L = TEXTOS[idioma];
    const id = `${Date.now().toString(36)}d${idioma}`;
    const correo = `verificar.${id}@recorrido.test`;
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: DATOS!.url,
      geolocation: { latitude: 25.7617, longitude: -80.1918 },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto('/driver/');
    await p.getByText(L.appCrear).click();
    await (await enPaso(p, p.getByLabel(L.nombreCompleto))).fill('Luis Pérez');
    await (await enPaso(p, p.getByLabel(L.correo))).fill(correo);
    await (await enPaso(p, p.getByLabel(L.celular))).fill(celular().slice(2));
    await (await enPaso(p, p.getByLabel(L.clave, { exact: true }))).fill(DATOS!.clave);
    await aceptarTerminos(p); // acepta los términos (último paso)
    await p.getByTestId('registro-continuar').click();
    await p.getByTestId('crear-mi-cuenta').click();
    await p.getByRole('button', { name: L.permisosListo }).click({ timeout: 20_000 });
    await cruzarPuertaCelular(p, correo);
    // Con el celular confirmado sigue su registro; el correo, en la franja.
    await expect(p.getByTestId('aviso-correo')).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId('aviso-correo')).toContainText(correo);
    await expect(p.getByTestId('aviso-correo-cambiar')).toBeVisible();
    await foto(p, `repartidor-franja-correo-${idioma}`);
    await ctx.close();
  });
}
