import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-MAS-RESTAURANTE (30 oct 2026): la pestaña «Más» de la app del restaurante trae la lista de
 * DoorDash Merchant (datos y horario, ganancias, reseñas, equipo, configuración, guías, términos)
 * y la versión; antes solo tenía «Cerrar sesión» y unos tres puntos sueltos.
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

for (const idioma of ['es', 'en'] as const)
  test(`la pestaña Más del restaurante tiene la lista completa (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const id = `${idioma}${Date.now().toString(36)}`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.94.${idioma === 'es' ? 1 : 2}.${Date.now() % 250}` },
      data: {
        nombre: 'Dueño Más',
        correo: `mas.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: 'restaurante',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    const local = await request.put('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        nombre: `Pizzería ${id}`,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctx.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
      },
      [token, idioma],
    );
    const p = await ctx.newPage();
    await p.goto('/restaurant/');
    await p.getByRole('tab', { name: idioma === 'en' ? 'More' : 'Más' }).click({ timeout: 30_000 });
    for (const o of [
      'restaurante',
      'ganancias',
      'resenas',
      'equipo',
      'configuracion',
      'guias',
      'legales',
    ])
      await expect(p.getByTestId(`mas-${o}`)).toBeVisible();
    await expect(
      p.getByText(idioma === 'en' ? 'Hours and closures' : 'Horario y cierres'),
    ).toBeVisible();
    await expect(p.getByTestId('version-app')).toBeVisible();
    await expect(
      p.getByRole('button', { name: idioma === 'en' ? 'Sign out' : 'Cerrar sesión' }),
    ).toBeVisible();
    await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', `restapp-mas-${idioma}.png`) });
    // C-APP-RESTAURANTE-PAR: reseñas y horario se abren dentro de la app.
    await p.getByTestId('mas-horario').click();
    await expect(p.getByTestId('app-horario')).toBeVisible({ timeout: 20_000 });
    await p
      .getByRole('button', { name: idioma === 'en' ? '+ Shift · Monday' : '+ Turno · Lunes' })
      .click();
    await p
      .getByRole('button', { name: idioma === 'en' ? 'Save hours' : 'Guardar horario' })
      .click();
    await expect(p.getByText(idioma === 'en' ? 'Hours saved.' : 'Horario guardado.')).toBeVisible();
    await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', `restapp-horario-${idioma}.png`) });
    const hor = await request.get('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(
      ((await hor.json()) as { restaurante: { horarios: unknown[] } }).restaurante.horarios,
    ).toEqual([{ dia: 1, abre: '09:00', cierra: '22:00' }]);
    await p.getByRole('button', { name: idioma === 'en' ? 'Back' : 'Volver' }).click();
    await p.getByTestId('mas-resenas').click();
    await expect(p.getByTestId('app-resenas')).toBeVisible({ timeout: 20_000 });
    await expect(
      p.getByText(idioma === 'en' ? 'You don’t have reviews yet.' : 'Todavía no tienes reseñas.'),
    ).toBeVisible();
    await ctx.close();
  });

// C-APP-OPCIONES (30 oct 2026): las opciones del plato se editan desde la app del restaurante.
test('el restaurante crea un grupo de opciones desde la app', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const id = `op${Date.now().toString(36)}`;
  const r = await request.post('/datos/cuentas/registro', {
    headers: { 'cf-connecting-ip': `10.94.9.${Date.now() % 250}` },
    data: {
      nombre: 'Dueño Opciones',
      correo: `opc.${id}@recorrido.test`,
      clave: DATOS!.clave,
      rol: 'restaurante',
    },
  });
  const { token } = (await r.json()) as { token: string };
  const h = { authorization: `Bearer ${token}` };
  await request.put('/datos/mi-restaurante', {
    headers: h,
    data: {
      nombre: `Pizzería ${id}`,
      categoria: 'Pizza',
      telefono: '3055550100',
      direccion: '100 Biscayne Blvd, Miami, FL',
      lat: 25.7743,
      lng: -80.1937,
    },
  });
  const plato = await request.post('/datos/mi-restaurante/platos', {
    headers: h,
    data: { nombreEs: 'Pizza Margarita', precioCentavos: 1200 },
  });
  const pid = ((await plato.json()) as { plato: { id: string } }).plato.id;
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctx.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, token);
  const p = await ctx.newPage();
  await p.goto('/restaurant/');
  await p.getByRole('tab', { name: 'Menú' }).click({ timeout: 30_000 });
  await p.getByRole('button', { name: 'Editar: Pizza Margarita' }).click();
  await p.getByRole('button', { name: '+ Grupo de opciones' }).click();
  await p.getByLabel('Nombre del grupo 1', { exact: true }).fill('Tamaño');
  await p.getByLabel('Mínimo 1').fill('1');
  await p.getByLabel('Opción 1.1', { exact: true }).fill('Grande');
  await p.getByLabel('Precio extra 1.1').fill('3.00');
  await p.screenshot({
    path: join(RAIZ, 'docs', 'capturas', 'restapp-opciones-es.png'),
    fullPage: true,
  });
  await p.getByRole('button', { name: 'Guardar', exact: true }).last().click();
  await expect
    .poll(
      async () => {
        const mio = await request.get('/datos/mi-restaurante', { headers: h });
        const pl = (
          (await mio.json()) as {
            platos: {
              id: string;
              grupos?: {
                nombreEs: string;
                minimo: number;
                opciones: { nombreEs: string; precioCentavos: number }[];
              }[];
            }[];
          }
        ).platos.find((x) => x.id === pid);
        return pl?.grupos?.map((g) => [
          g.nombreEs,
          g.minimo,
          g.opciones[0]?.nombreEs,
          g.opciones[0]?.precioCentavos,
        ]);
      },
      { timeout: 20_000 },
    )
    .toEqual([['Tamaño', 1, 'Grande', 300]]);
  await ctx.close();
});
