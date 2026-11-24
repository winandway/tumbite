import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { sqlLocal, sqlLocalTexto } from './sqlLocal';

/**
 * C-CORREGIR-CORREO (20 nov 2026, pedido de Richard; todos los países): en la ficha del cliente, el
 * correo dice «El correo rebotó» y, en sus tres puntos, «Corregir correo» lo cambia (con «¿Quisiste decir…?»)
 * y manda la confirmación; la línea de tiempo lo anota. Con CAPTURAS=1 guarda las capturas de la
 * ayuda interna «?» en la carpeta privada (nunca en Docs públicos).
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');
const PRIVADA = join(homedir(), 'Divoox-privado', 'ayuda-interna', 'originales', 'correo');
const CAPTURAS = process.env.CAPTURAS === '1';

for (const idioma of ['es', 'en'] as const)
  test(`soporte corrige el correo de un cliente que rebotó (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    if (CAPTURAS) mkdirSync(PRIVADA, { recursive: true });
    const en = idioma === 'en';
    const id = Date.now().toString(36);
    let ip = 0;
    const registrar = async (correo: string, nombre: string) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.96.${Math.floor(++ip / 250)}.${ip % 250}` },
        data: { nombre, correo, clave: `Correo-${id}-Bien9`, rol: 'cliente' },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const d = (await r.json()) as { token: string; usuario: { id: string } };
      return { token: d.token, id: d.usuario.id };
    };
    const admin = await registrar(`correo.admin.${idioma}.${id}@recorrido.test`, 'Soporte Divoox');
    sqlLocalTexto(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
    // La dirección mal escrita (una letra cambiada) ya rebotó.
    const local = en ? 'mike.johnson' : 'andres.perez';
    const dominio = en ? 'example.com' : 'ejemplo.com';
    const malo = `${local.replace('e', 'i')}@${dominio}`;
    const cli = await registrar(malo, en ? 'Mike Johnson' : 'Andrés Pérez');
    sqlLocalTexto(
      `INSERT OR REPLACE INTO correos_rebotados (correo, motivo) VALUES ('${malo}', 'Rebote permanente')`,
    );

    const { ruta } = (await (
      await request.get('/datos/admin/ruta', {
        headers: { authorization: `Bearer ${admin.token}` },
      })
    ).json()) as { ruta: string | null };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    p.on('dialog', (d) => {
      throw new Error(`ventana del navegador inesperada: ${d.message()}`);
    });
    await p.goto(`/panel/${ruta ? `${ruta}/` : ''}customers/${cli.id}`);
    await expect(p.getByRole('heading', { level: 1 })).toContainText(
      en ? 'Mike Johnson' : 'Andrés Pérez',
      { timeout: 30_000 },
    );
    await expect(p.getByTestId('estado-correo')).toContainText(
      en ? 'The email bounced' : 'El correo rebotó',
    );
    await p.getByRole('button', { name: en ? 'Fix email' : 'Corregir correo' }).click();
    if (CAPTURAS)
      await p
        .locator('.super-dos')
        .first()
        .screenshot({ path: join(PRIVADA, `estado-${idioma}.png`) });
    await p.getByRole('menuitem', { name: en ? 'Fix email' : 'Corregir correo' }).click();
    const form = p.getByTestId('form-corregir-correo');
    const campo = form.getByLabel(en ? 'New email' : 'Correo nuevo');
    await campo.fill(`${local}@gmial.com`);
    await expect(form.getByRole('button', { name: /gmail\.com\?/ })).toBeVisible();
    await form
      .getByLabel(en ? /Reason/ : /Motivo/)
      .fill(en ? 'Asked over WhatsApp, one letter off' : 'Lo pidió por WhatsApp, letra cambiada');
    if (CAPTURAS) await form.screenshot({ path: join(PRIVADA, `formulario-${idioma}.png`) });
    // En esta computadora no salen correos reales: se guarda una dirección de ejemplo.
    const bueno = `${local}@${dominio}`;
    await campo.fill(bueno);
    await form
      .getByRole('button', {
        name: en ? 'Save and send the confirmation' : 'Guardar y mandar la confirmación',
      })
      .click();
    await expect(p.getByText(en ? /Email fixed/ : /Correo corregido/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(p.getByTestId('estado-correo')).toContainText(
      en ? 'Not confirmed' : 'Sin confirmar',
    );
    await expect(p.getByTestId('historial-correo')).toBeVisible();
    if (CAPTURAS) {
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: join(PRIVADA, `listo-${idioma}.png`), fullPage: true });
    }
    const f = sqlLocal(
      `SELECT correo, correo_confirmado_en AS conf FROM usuarios WHERE id = '${cli.id}'`,
    )[0];
    expect(f).toMatchObject({ correo: bueno, conf: null });
    await ctx.close();
  });
