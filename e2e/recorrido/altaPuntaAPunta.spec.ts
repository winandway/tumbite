import { randomUUID } from 'node:crypto';
import { devices, expect, test } from './fixtures';
import { celularDePrueba } from './celularDePrueba';
import { TEXTOS } from './textos';

/**
 * C-ALTA-PUNTA-A-PUNTA (24 nov 2026, Gerencia: «la zona de Tucaní dejó de registrar gente»). El alta de
 * un conductor en Divoox Driver, desde cero hasta que la cuenta EXISTE y puede entrar, en cada corrida
 * del recorrido: en esta computadora (`npm run recorrido`) y en el sitio de pruebas en cada rama
 * «fase-*» que va a publicarse (pruebas-rama). Comprueba también lo que salió de lo de hoy:
 * 1) antes del alta, entrar con ese correo dice «No hay ninguna cuenta con ese correo» (código propio);
 * 2) «Continuar» con una casilla mal dice cuál JUNTO al botón;
 * 3) «Revisa tus datos» dice que la cuenta todavía no existe (no suena a confirmación);
 * 4) «Crear mi cuenta» crea la cuenta y la app sigue (pantalla de permisos);
 * 5) con ese correo y esa contraseña se entra (200, cuenta de conductor), y con otra contraseña
 *    se dice «La contraseña no es correcta».
 */
const L = TEXTOS.es;

test('alta de conductor de punta a punta: de cero a una cuenta que entra (es)', async ({
  browser,
  request,
}) => {
  const id = randomUUID().slice(0, 8);
  const correo = `alta.${id}@recorrido.test`;
  const clave = `Alta-${id}-2026`;

  // 1) Antes: no existe, y el servidor lo dice con su código.
  const antes = await request.post('/datos/cuentas/entrar', {
    data: { correo, clave },
    headers: { 'x-idioma': 'es' },
  });
  expect(antes.status()).toBe(401);
  expect(await antes.json()).toMatchObject({
    codigo: 'correo_sin_cuenta',
    error: 'No hay ninguna cuenta con ese correo.',
  });

  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-US' });
  await ctx.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
  const p = await ctx.newPage();
  await p.goto('/driver/');
  await p.getByText(L.appCrear).click();
  await p.getByLabel(L.correo).fill(correo);
  await p.getByLabel(L.celular).fill(celularDePrueba());
  await p.getByLabel(L.clave, { exact: true }).fill(clave);
  await p.getByRole('checkbox').first().click(); // acepta los términos

  // 2) Sin nombre: el aviso sale junto al botón y no se pasa a revisar.
  await p.getByTestId('registro-continuar').click();
  await expect(p.getByTestId('registro-revisar-casillas')).toContainText('Nombre');
  await expect(p.getByTestId('revisa-tus-datos')).toHaveCount(0);

  // 3) Con todo bien: «Revisa tus datos» dice que la cuenta todavía no existe.
  await p.getByLabel(L.nombreCompleto).fill('Conductor Alta');
  await p.getByTestId('registro-continuar').click();
  await expect(p.getByTestId('revisa-tus-datos')).toContainText('todavía no está creada');

  // 4) Se crea con «Crear mi cuenta» y la app sigue.
  await p.getByTestId('crear-mi-cuenta').click();
  await expect(p.getByRole('button', { name: L.permisosListo })).toBeVisible({ timeout: 30_000 });
  // Las intercepciones del arnés (fixtures.ts) pueden tener una lectura en vuelo al terminar: se sueltan
  // antes de cerrar para que un cierre a destiempo no tumbe la prueba (falló así en el sitio de pruebas).
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.close();

  // 5) La cuenta existe y entra; con otra contraseña, el mensaje propio.
  const entra = await request.post('/datos/cuentas/entrar', { data: { correo, clave } });
  expect(entra.status()).toBe(200);
  const sesion = (await entra.json()) as { token: string; usuario: { rol: string } };
  expect(sesion.token).toBeTruthy();
  expect(sesion.usuario.rol).toBe('repartidor');
  const mala = await request.post('/datos/cuentas/entrar', {
    data: { correo, clave: `${clave}-otra` },
    headers: { 'x-idioma': 'es' },
  });
  expect((await mala.json()) as { codigo: string }).toMatchObject({ codigo: 'clave_incorrecta' });
});
