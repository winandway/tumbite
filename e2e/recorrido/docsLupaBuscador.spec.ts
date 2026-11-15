import { devices, expect, test } from './fixtures';

/**
 * C-DOCS-LUPA y C-DOCS-BUSCADOR-MOTOR (15 nov 2026), pedido de Richard: en un navegador de verdad,
 * en computadora y en celular, el buscador de Docs da la lista de sugerencias desde la primera letra
 * y encuentra «wallet» en español; cualquier captura se abre en grande, se acerca y se cierra.
 * Corre igual en esta computadora y contra el sitio de pruebas.
 */
for (const [nombre, opciones] of [
  ['computadora', { viewport: { width: 1280, height: 860 } }],
  ['celular', devices['Pixel 7']],
] as const) {
  test(`Docs: sugerencias bilingües y lupa en las capturas (${nombre})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ ...opciones, locale: 'es-US' });
    const p = await ctx.newPage();

    // Buscador: «wallet» en la versión en español trae la billetera, resaltada.
    await p.goto('/es/docs');
    const campo = p.getByRole('combobox', { name: 'Buscar en Docs' });
    await campo.fill('w');
    await expect(p.getByRole('listbox', { name: 'Guías que coinciden' })).toBeVisible();
    await campo.fill('wallet');
    const lista = p.getByRole('listbox', { name: 'Guías que coinciden' });
    await expect(lista.locator('mark').first()).toHaveText(/billetera/i);
    await campo.press('ArrowDown');
    await campo.press('Enter');
    await expect(p.getByRole('heading', { level: 1 })).toContainText(/billetera/i);

    // Lupa: la captura de la billetera de Flex se abre en grande (versión nítida), se acerca y se cierra.
    await p.goto('/es/docs/business/flex-wallet');
    const boton = p.getByRole('button', { name: /^Ampliar la imagen/ }).first();
    await boton.click();
    const visor = p.getByRole('dialog', { name: 'Captura ampliada' });
    await expect(visor).toBeVisible();
    const imagen = visor.locator('.pswp__img:not(.pswp__img--placeholder)').first();
    await expect(imagen).toHaveAttribute('src', '/docs/grande/flex-billetera-es.webp');
    await expect(visor.locator('.pswp__pie')).toHaveText('Tu saldo, recargas y comprobantes.');
    const antes = (await imagen.boundingBox())?.width ?? 0;
    await visor.getByRole('button', { name: 'Acercar', exact: true }).click();
    await expect
      .poll(async () => (await imagen.boundingBox())?.width ?? 0)
      .toBeGreaterThan(antes * 1.3);
    await p.keyboard.press('Escape');
    await expect(visor).toHaveCount(0);
    await ctx.close();
  });
}
