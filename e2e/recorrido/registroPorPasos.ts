import { expect, type Locator, type Page } from '@playwright/test';

/**
 * C-FORMULARIO-POR-PASOS (24 nov 2026): crear la cuenta en la app de clientes y en Driver va por
 * pasos (nombre, correo, celular, contraseña y último paso). Los guiones llenan cada casilla en su
 * paso: si la casilla no está a la vista, se toca «Siguiente» hasta llegar a ella. En Divoox
 * Restaurants (formulario de siempre) la casilla ya está a la vista y no se toca nada más.
 */
export async function enPaso(p: Page, casilla: Locator): Promise<Locator> {
  for (let i = 0; i < 7; i++) {
    if (await casilla.isVisible()) return casilla;
    await elegirLugar(p);
    const siguiente = p.getByTestId('pasos-siguiente');
    if (!(await siguiente.isVisible())) break;
    await siguiente.click();
  }
  await expect(casilla).toBeVisible();
  return casilla;
}

/** Una ciudad del catálogo (GeoNames) para «¿Dónde vives?». */
export type LugarDePrueba = {
  pais: string;
  estado: string;
  buscar: string;
  lugarId: string;
  nombre: string;
};

/** Miami, Florida: dentro de la zona US-FL-MIAMI, donde corre el recorrido. */
export const MIAMI: LugarDePrueba = {
  pais: 'US',
  estado: 'FL',
  buscar: 'miami',
  lugarId: 'gn:4164138',
  nombre: 'Miami',
};

/** Miami como lo manda el registro por la API (`lugar` de /datos/cuentas/registro). */
export const LUGAR_MIAMI = {
  pais: 'US',
  estado: 'FL',
  municipio: null,
  ciudad: 'Miami',
  lugarId: 'gn:4164138',
  lat: 25.774,
  lng: -80.194,
};

/** «Otro país» (C-REGISTRO-OTRO-PAIS): vive fuera del catálogo; la ciudad sale de su ubicación. */
export const OTRO_PAIS = 'otro' as const;

const conLugar = new WeakSet<Page>();

/**
 * C-REGISTRO-TODO-EL-PAIS (26 nov 2026, pasada 45878257110): el registro de Driver y del panel pide
 * «¿Dónde vives?» (País → Estado → Ciudad) y sin elegirla no avanza; los guiones no lo sabían llenar
 * y cayeron tres pruebas. Si la casilla `registro-lugar` está a la vista y esta página todavía no
 * eligió, se elige la ciudad (por defecto Miami, para que la cuenta reciba su zona y no quede en
 * espera). La misma pieza para la web (panel) y para Driver: los dos usan los mismos testID.
 */
export async function elegirLugar(p: Page, lugar: LugarDePrueba | typeof OTRO_PAIS = MIAMI) {
  if (conLugar.has(p)) return;
  const casilla = p.getByTestId('registro-lugar');
  if (!(await casilla.isVisible())) return;
  await casilla.click();
  if (lugar === OTRO_PAIS) {
    await p.getByTestId('selector-lugar-pais-otro').click();
    await expect(casilla).toContainText(/Otro país|Another country/);
    conLugar.add(p);
    return;
  }
  const pais = p.getByTestId(`selector-lugar-pais-${lugar.pais}`);
  const buscar = p.getByTestId('selector-lugar-buscar');
  await expect(pais.or(buscar).first()).toBeVisible();
  // Si abrió con otro país sugerido, se vuelve hasta la lista de países.
  for (let i = 0; i < 3 && !(await pais.isVisible()); i++) {
    const volver = p.getByTestId('selector-lugar-volver');
    if (!(await volver.isVisible())) break;
    await volver.click();
  }
  if (await pais.isVisible()) await pais.click();
  const estado = p.getByTestId(`selector-lugar-estado-${lugar.estado}`);
  if (await estado.isVisible()) await estado.click();
  await buscar.fill(lugar.buscar);
  await p.getByTestId(`selector-lugar-ciudad-${lugar.lugarId}`).first().click();
  await expect(casilla).toContainText(lugar.nombre);
  conLugar.add(p);
}

/** Marca la casilla de los términos (en el último paso del registro). */
export async function aceptarTerminos(p: Page) {
  await elegirLugar(p);
  await (await enPaso(p, p.getByTestId('registro-acepto'))).click();
}
