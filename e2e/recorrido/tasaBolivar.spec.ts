import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo';

/**
 * C-TASA-CORDURA (19 nov 2026, Venezuela): la pantalla de la tasa del bolívar en el superadmin, de
 * verdad. El equipo ve la oficial en uso; una tasa disparatada (240, como la que dejó un guion de
 * capturas en el sitio de pruebas) no se guarda y el panel dice cuál es la oficial; una flotante se
 * guarda y se muestra con la oficial al lado. Al terminar, vuelve a «oficial».
 * Con CAPTURAS=1 guarda la captura (interna: es del superadmin, no va a Docs públicos).
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
const CAPTURAS = process.env.CAPTURAS === '1';
const CARPETA = join(RAIZ, 'docs', 'capturas', 'tasa-bolivar');
if (CAPTURAS) mkdirSync(CARPETA, { recursive: true });
const sql = sqlLocal;

for (const idioma of ['es', 'en'] as const) {
  test(`la tasa del bolívar en el superadmin (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const es = idioma === 'es';
    const id = `${Date.now().toString(36)}${idioma}`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.96.${Math.floor(Math.random() * 250)}.7` },
      data: {
        nombre: 'Soporte Divoox',
        correo: `tasa.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: 'cliente',
        idioma,
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const admin = (await r.json()) as { token: string; usuario: { id: string } };
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
    // Solo la oficial del día, como en producción: sin tasa del equipo ni modo guardado.
    sql("DELETE FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'equipo'");
    sql("DELETE FROM tasas_modo WHERE pais = 'VE'");
    sql(SQL_TASA_EJEMPLO);
    const h = { authorization: `Bearer ${admin.token}` };
    const { ruta } = (await (await request.get('/datos/admin/ruta', { headers: h })).json()) as {
      ruta: string | null;
    };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
    const p = await ctx.newPage();
    await p.goto(`/panel${ruta ? `/${ruta}` : ''}/moto`);
    const caja = p.getByTestId('tasa-referencia');
    await expect(caja).toBeVisible({ timeout: 30_000 });
    await caja.scrollIntoViewIfNeeded();
    await expect(caja).toContainText(es ? '917,78' : '917.78');

    // Una fija disparatada no se guarda: el panel dice cuál es la oficial y lo escrito se queda.
    await caja.getByRole('radio', { name: es ? /^Fija/ : /^Fixed/ }).check();
    await caja.getByRole('textbox').fill('240');
    await caja.getByRole('button', { name: es ? 'Guardar' : 'Save' }).click();
    await expect(caja).toContainText(es ? /se aleja más de 30 %/ : /more than 30% away/);
    await expect(caja.getByRole('textbox')).toHaveValue('240');
    expect(sql("SELECT COUNT(*) AS n FROM tasas_modo WHERE pais = 'VE'")[0]?.n).toBe(0);

    // La flotante (la oficial más 10 %) se guarda y queda a la vista con la oficial al lado.
    await caja.getByRole('radio', { name: es ? /^Flotante/ : /^Floating/ }).check();
    await caja.getByRole('textbox').fill('10');
    await expect(caja).toContainText(es ? '1.009,558' : '1,009.558');
    if (CAPTURAS) await caja.screenshot({ path: join(CARPETA, `super-pantalla-${idioma}.png`) });
    await caja.getByRole('button', { name: es ? 'Guardar' : 'Save' }).click();
    await expect(p.getByTestId('tasa-oficial-VE')).toBeVisible({ timeout: 15_000 });
    await expect(p.getByTestId('tasa-oficial-VE')).toContainText(es ? '917,78' : '917.78');

    // Se deja como en producción: oficial automática.
    sql("DELETE FROM tasas_modo WHERE pais = 'VE'");
    await ctx.close();
  });
}
