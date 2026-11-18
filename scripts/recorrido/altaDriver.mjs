/**
 * Los guiones de capturas abren el alta de Moto o Carro de Divoox Driver como lo hace hoy un
 * conductor (el perfil ya no tiene la entrada «Divoox Moto» / «Divoox Carro», C-SERVICIOS-CONECTADOS):
 * - con el vehículo registrado: Perfil → «Mi vehículo» → su tarjeta → «Completar o editar»;
 * - sin vehículo todavía: Inicio → la tarjeta del servicio («Agregar este servicio») → «Empezar».
 */
export async function abrirAlta(d, servicio, en) {
  await d.getByRole('tab', { name: en ? 'Profile' : 'Perfil' }).click({ timeout: 60_000 });
  const seccion = d.getByTestId('seccion-vehiculo').first();
  await seccion.waitFor({ timeout: 30_000 });
  const tarjeta = d.getByTestId(`vehiculo-${servicio}`).first();
  if (!(await tarjeta.isVisible().catch(() => false))) await seccion.click();
  if (await tarjeta.isVisible({ timeout: 5_000 }).catch(() => false)) {
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
  await d.getByRole('tab', { name: en ? 'Profile' : 'Perfil' }).click({ timeout: 60_000 });
  const docs = d.getByTestId('seccion-documentos').first();
  await docs.waitFor({ timeout: 30_000 });
  await docs.click();
}
