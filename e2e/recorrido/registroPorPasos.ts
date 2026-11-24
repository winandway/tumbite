import { expect, type Locator, type Page } from '@playwright/test';

/**
 * C-FORMULARIO-POR-PASOS (24 nov 2026): crear la cuenta en la app de clientes y en Driver va por
 * pasos (nombre, correo, celular, contraseña y último paso). Los guiones llenan cada casilla en su
 * paso: si la casilla no está a la vista, se toca «Siguiente» hasta llegar a ella. En Divoox
 * Restaurants (formulario de siempre) la casilla ya está a la vista y no se toca nada más.
 */
export async function enPaso(p: Page, casilla: Locator): Promise<Locator> {
  for (let i = 0; i < 6; i++) {
    if (await casilla.isVisible()) return casilla;
    const siguiente = p.getByTestId('pasos-siguiente');
    if (!(await siguiente.isVisible())) break;
    await siguiente.click();
  }
  await expect(casilla).toBeVisible();
  return casilla;
}

/** Marca la casilla de los términos (en el último paso del registro). */
export async function aceptarTerminos(p: Page) {
  await (await enPaso(p, p.getByTestId('registro-acepto'))).click();
}
