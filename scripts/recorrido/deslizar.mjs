/**
 * C-CONECTAR-DESLIZANDO y C-CERRAR-DESLIZANDO (18 nov 2026): en Driver, conectarse, terminar un
 * viaje y entregar un envío se deslizan (un toque no los hace). Los guiones de capturas arrastran el
 * pulgar de la pieza `testID` hasta el final, como lo haría el conductor.
 */
export async function deslizar(pagina, testID) {
  const pulgar = pagina.getByTestId(`${testID}-pulgar`).first();
  const riel = pagina.getByTestId(testID).first();
  await pulgar.waitFor({ timeout: 60_000 });
  await riel.scrollIntoViewIfNeeded();
  const a = await pulgar.boundingBox();
  const b = await riel.boundingBox();
  const y = a.y + a.height / 2;
  const x0 = a.x + a.width / 2;
  await pagina.mouse.move(x0, y);
  await pagina.mouse.down();
  for (let i = 1; i <= 14; i++)
    await pagina.mouse.move(x0 + ((b.width - a.width - 20) * i) / 14 + 8, y);
  await pagina.mouse.up();
}
