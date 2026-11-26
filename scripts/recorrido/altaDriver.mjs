/**
 * Los guiones de capturas abren el alta de Moto o Carro de Divoox Driver como lo hace hoy un
 * conductor (el perfil ya no tiene la entrada «Divoox Moto» / «Divoox Carro», C-SERVICIOS-CONECTADOS):
 * - con el vehículo registrado: Cuenta → «Vehículo» (el perfil) → «Mi vehículo» → su tarjeta →
 *   «Completar o editar» (desde el rediseño, la pestaña «Perfil» es «Cuenta», C-REDISENO-DRIVER);
 * - sin vehículo todavía: Inicio → la tarjeta del servicio («Agregar este servicio») → «Empezar».
 */
/**
 * Abre el perfil del conductor (Mi vehículo y Documentos). Desde el rediseño de Driver la barra de
 * abajo dice «Cuenta» (antes «Perfil») y el perfil se abre con su fila «Vehículo».
 */
export async function abrirPerfil(d, en) {
  await d.getByRole('tab', { name: en ? 'Account' : 'Cuenta' }).click({ timeout: 60_000 });
  await d.getByTestId('cuenta-vehiculo').first().click({ timeout: 30_000 });
}

export async function abrirAlta(d, servicio, en) {
  await abrirPerfil(d, en);
  const seccion = d.getByTestId('seccion-vehiculo').first();
  await seccion.waitFor({ timeout: 30_000 });
  const tarjeta = d.getByTestId(`vehiculo-${servicio}`).first();
  if (!(await tarjeta.isVisible().catch(() => false))) await seccion.click();
  // `isVisible` no espera: con la máquina cargada la tarjeta tardaba en pintarse y el guion se iba
  // por el camino de «sin vehículo» aunque el vehículo existiera.
  const conVehiculo = await tarjeta
    .waitFor({ timeout: 6_000 })
    .then(() => true)
    .catch(() => false);
  if (conVehiculo) {
    await tarjeta.getByRole('button').first().click();
    await d
      .getByText(en ? 'Complete or edit' : 'Completar o editar', { exact: true })
      .first()
      .click();
  } else {
    await d.getByRole('tab', { name: en ? 'Home' : 'Inicio' }).click();
    await d.getByTestId(`servicio-${servicio}`).first().click();
    await d.getByTestId('agregar-servicio').waitFor({ timeout: 30_000 });
    await d
      .getByText(en ? /^Start · step 1 of/ : /^Empezar · paso 1 de/)
      .first()
      .click();
  }
  await d.getByTestId(`alta-${servicio}`).waitFor({ timeout: 30_000 });
}

/** Vuelve al perfil y abre «Documentos». */
export async function abrirDocumentos(d, en) {
  await d.goto('/driver/');
  await abrirPerfil(d, en);
  const docs = d.getByTestId('seccion-documentos').first();
  await docs.waitFor({ timeout: 30_000 });
  await docs.click();
}
