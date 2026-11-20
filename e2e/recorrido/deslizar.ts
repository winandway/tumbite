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
    await deslizar(p, deslizo);
    await expect(visible(quiero)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}
