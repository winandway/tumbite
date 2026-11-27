import { type Page, expect } from '@playwright/test';

/**
 * C-CONECTAR-DESLIZANDO (18 nov 2026): en Driver, conectarse, desconectarse y volver de la pausa se
 * deslizan (nunca se tocan). Arrastra el pulgar de la pieza `testID` hasta `fraccion` del recorrido
 * (1 = hasta el final) y suelta.
 */
export async function deslizar(p: Page, testID: string, fraccion = 1) {
  const riel = p.getByTestId(testID).filter({ visible: true }).first();
  const pulgar = p.getByTestId(`${testID}-pulgar`).filter({ visible: true }).first();
  await expect(pulgar).toBeVisible({ timeout: 30_000 });
  await riel.scrollIntoViewIfNeeded();
  // C-DESLIZAR-RECIBE-EL-TOQUE (27 nov 2026): el pulgar tiene que ser el que de verdad recibe el
  // toque. Justo después de cerrar una oferta, en las máquinas lentas de GitHub algo lo tapaba unos
  // segundos y el arrastre caía encima de otra cosa sin hacer nada. La prueba «de ensayo» espera a
  // que nada lo tape (y si algo lo tapa para siempre, el error dice qué es).
  await pulgar.click({ trial: true, timeout: 30_000 });
  const caja = (await riel.boundingBox())!;
  const ini = (await pulgar.boundingBox())!;
  const y = ini.y + ini.height / 2;
  const x0 = ini.x + ini.width / 2;
  const recorrido = caja.width - ini.width - 12;
  await p.mouse.move(x0, y);
  await p.mouse.down();
  const pasos = 14;
  for (let i = 1; i <= pasos; i++)
    await p.mouse.move(x0 + (recorrido * fraccion * i) / pasos + (fraccion >= 1 ? 8 : 0), y);
  await p.mouse.up();
}

/** Un toque simple en el pulgar (para comprobar que NO conecta). */
export async function tocarPulgar(p: Page, testID: string) {
  await p.getByTestId(`${testID}-pulgar`).filter({ visible: true }).first().click();
}

/**
 * Deja al conductor conectado o desconectado y COMPRUEBA que quedó así (19 nov 2026). En el sitio de
 * pruebas, más lento, un «desliza para desconectarte» sin comprobar se quedaba a medias: el
 * conductor seguía conectado y el paso siguiente buscaba un deslizador de conectarse que no existía.
 * Si ya está como se pide, no desliza nada; si el primer intento no prende, lo repite.
 */
export async function dejarConectado(p: Page, conectado: boolean) {
  const quiero = conectado ? 'desconectarme' : 'conectarme';
  const deslizo = conectado ? 'conectarme' : 'desconectarme';
  const visible = (id: string) => p.getByTestId(`${id}-pulgar`).filter({ visible: true }).first();
  await expect(visible(quiero).or(visible(deslizo))).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    if (await visible(quiero).isVisible()) return;
    // C-DESLIZAR-RECIBE-EL-TOQUE: se espera la respuesta REAL del servidor (conectar o desconectar),
    // no un tiempo fijo. Si el gesto no mandó nada, se dice así y se vuelve a intentar.
    const respuesta = p
      .waitForResponse(
        (r) => r.url().includes('/datos/repartidor/conectar') && r.request().method() === 'POST',
        { timeout: 15_000 },
      )
      .catch(() => null);
    await deslizar(p, deslizo);
    const r = await respuesta;
    expect(r, `el deslizador «${deslizo}» no mandó nada al servidor`).not.toBeNull();
    expect(r!.ok(), `el servidor no aceptó «${deslizo}»: ${r!.status()}`).toBe(true);
    await expect(visible(quiero)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}
