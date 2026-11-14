import { expect, test } from './fixtures';
import { sqlLocalTexto } from './sqlLocal';

/**
 * C-FORMULARIO-APILADO (14 nov 2026, todos los países): «Abrir un servicio en una ciudad» del panel
 * del equipo salía en 1440 de ancho con las casillas sin estilo, en línea con sus etiquetas. Cada
 * etiqueta va arriba de su casilla, a lo ancho del formulario, y nada se sale ni se encima, en
 * computadora y en celular.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

for (const [nombre, ancho] of [
  ['computadora', 1440],
  ['celular', 375],
] as const)
  test(`«Abrir un servicio en una ciudad» con campos apilados (${nombre})`, async ({
    browser,
    request,
  }) => {
    const id = `${ancho}${Date.now().toString(36)}`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.97.${ancho % 250}.${Date.now() % 250}` },
      data: {
        nombre: 'Soporte Apilado',
        correo: `apilado.${id}@recorrido.test`,
        clave: `Apilado-${id}-Form9`,
        rol: 'cliente',
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const admin = (await r.json()) as { token: string; usuario: { id: string } };
    sqlLocalTexto(
      `UPDATE usuarios SET rol = 'admin', correo_confirmado_en = datetime('now') WHERE id = '${admin.usuario.id}'`,
    );
    const { ruta } = (await (
      await request.get('/datos/admin/ruta', {
        headers: { authorization: `Bearer ${admin.token}` },
      })
    ).json()) as { ruta: string | null };
    const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    const p = await ctx.newPage();
    await p.goto(`/es/panel${ruta ? `/${ruta}` : ''}/moto`);
    await expect(p.getByTestId('super-moto')).toBeVisible({ timeout: 60_000 });
    const form = p.locator('form.formulario-apilado').first();
    await expect(form).toBeVisible();
    const cajaForm = (await form.boundingBox())!;
    const etiquetas = form.locator('label:not(.casilla)');
    const n = await etiquetas.count();
    expect(n).toBeGreaterThan(3);
    let abajoAnterior = -1;
    for (let i = 0; i < n; i++) {
      const etiqueta = etiquetas.nth(i);
      if (!(await etiqueta.isVisible())) continue;
      const campo = etiqueta.locator('input, select').first();
      if (!(await campo.count())) continue;
      const e = (await etiqueta.boundingBox())!;
      const c = (await campo.boundingBox())!;
      // La casilla va debajo del texto de su etiqueta (apilada), no al lado.
      expect(c.y, `${nombre}: casilla ${i} al lado de su etiqueta`).toBeGreaterThan(e.y + 8);
      // No se sale del formulario ni se encima con la etiqueta anterior.
      expect(c.x).toBeGreaterThanOrEqual(cajaForm.x - 1);
      expect(c.x + c.width).toBeLessThanOrEqual(cajaForm.x + cajaForm.width + 1);
      expect(e.y).toBeGreaterThanOrEqual(abajoAnterior - 1);
      abajoAnterior = e.y + e.height;
    }
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, `${nombre}: la pantalla se sale de lado`).toBeLessThanOrEqual(0);
    await ctx.close();
  });
