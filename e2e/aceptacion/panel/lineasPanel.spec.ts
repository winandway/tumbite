import { expect, test, type Page } from '@playwright/test';
import {
  CIUDAD,
  abrir,
  NoSePudo,
  captura,
  conductorRobot,
  numeroDelMenu,
  ok,
  panel,
  pedir,
  sesionSoporte,
} from './comun';
import { celularDePrueba } from '../../recorrido/celularDePrueba';

/**
 * C-ROBOT-PANEL (26 nov 2026). Las líneas A1 a A9 de la lista de aceptación (sección 3, «Panel de
 * control»), una prueba por línea, contra el SITIO DE PRUEBAS y con cuentas de prueba. Cada prueba deja
 * su captura (A1.png…) y su motivo en palabras; el lanzador (scripts/aceptacion/panel.mjs) arma el parte.
 * Las que fallan quedan en rojo con lo que se vio: este robot no arregla el producto, lo mira.
 */

/** Tropiezos del sitio que no son la línea en sí (se dicen en el parte, no se esconden). */
let tropiezos: string[] = [];
test.beforeEach(() => {
  tropiezos = [];
});
test.afterEach(() => {
  for (const t of new Set(tropiezos))
    test.info().annotations.push({ type: 'tropiezo', description: t });
});

/** Lo que el parte dice de una línea en verde (o el detalle de cómo se comprobó). */
const anotar = (texto: string) =>
  test.info().annotations.push({ type: 'motivo', description: texto });
const conCaptura = (ruta: string) =>
  test.info().annotations.push({ type: 'captura', description: ruta });

/** Siempre deja la captura, salga bien o mal. */
async function conFoto<T>(p: Page, id: string, cuerpo: () => Promise<T>, completa = false) {
  try {
    return await cuerpo();
  } finally {
    conCaptura(await captura(p, id, completa));
  }
}

/** Palabras de código que nunca deben verse en pantalla (claves con guion bajo, estados crudos). */
const CODIGO_CRUDO = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;
function codigosCrudos(texto: string): string[] {
  const sinCorreos = texto.replace(/\S+@\S+/g, '');
  return [...new Set(sinCorreos.match(CODIGO_CRUDO) ?? [])];
}

test('A1 Ver en Verificaciones a un conductor nuevo con sus papeles y su moto en la misma pantalla', async ({
  browser,
}) => {
  const c = await conductorRobot(browser);
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(
    p,
    'A1',
    async () => {
      // Lo encuentra en la lista de Verificaciones…
      await abrir(p, `${raiz}/verifications`, tropiezos);
      await expect(
        p.getByText(c.nombre).first(),
        'el conductor nuevo no aparece en la lista de Verificaciones',
      ).toBeVisible({ timeout: 30_000 });
      // …y en su ficha están la identidad, los papeles y la moto juntos.
      await abrir(p, `${raiz}/verifications/${c.id}`, tropiezos);
      const main = p.locator('main');
      await expect(
        main.getByText(c.nombre).first(),
        'la ficha del conductor nuevo no abrió (no se ve su nombre)',
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        main.getByText('Fotos', { exact: true }).first(),
        'no se ven sus fotos',
      ).toBeVisible();
      await expect(
        main.getByText(/Licencia de moto/).first(),
        'no se ve su licencia de moto en la ficha',
      ).toBeVisible();
      await expect(
        main.getByText(c.placa).first(),
        'no se ve su moto (la placa) en la ficha',
      ).toBeVisible();
      await expect(
        main.getByText(/Bera BR 150/).first(),
        'no se ve la marca de la moto',
      ).toBeVisible();
      const crudos = codigosCrudos(await main.innerText());
      expect(crudos, `la ficha muestra códigos crudos: ${crudos.join(', ')}`).toEqual([]);
      anotar(
        'El conductor nuevo sale en la lista y su ficha junta fotos, papeles y moto, sin códigos crudos.',
      );
    },
    true,
  );
  await ctx.close();
});

test('A2 Aprobar o rechazar un papel y la moto, con motivo: el número del menú baja', async ({
  browser,
}) => {
  const c = await conductorRobot(browser);
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(p, 'A2', async () => {
    await abrir(p, `${raiz}/verifications/${c.id}`, tropiezos);
    const main = p.locator('main');
    await expect(main.getByText('Papeles por revisar').first()).toBeVisible({ timeout: 30_000 });
    const antes = await numeroDelMenu(p, /Verificaciones/);
    if (antes < 1) throw new NoSePudo('el menú de Verificaciones no tenía número antes de decidir');

    // 1) Rechazar la licencia de moto con motivo (tres puntos → Rechazar → motivo → confirmar).
    await main.getByRole('button', { name: 'Más opciones del papel' }).first().click();
    await p
      .getByRole('menuitem', { name: 'Rechazar' })
      .or(p.getByRole('button', { name: 'Rechazar', exact: true }))
      .last()
      .click();
    await main
      .getByLabel(/Motivo del rechazo/)
      .first()
      .fill('La foto de la licencia no se lee (prueba del robot del panel).');
    await main.getByRole('button', { name: 'Confirmar el rechazo' }).first().click();
    await expect(
      p.getByText(/Rechazado\. La persona ya puede ver el motivo/).first(),
      'el papel no quedó rechazado con su motivo',
    ).toBeVisible({ timeout: 20_000 });

    // 2) Aprobar los papeles de la moto y la moto.
    for (let i = 0; i < 6; i++) {
      const b = main.getByRole('button', { name: 'Aprobar documento' }).first();
      if (!(await b.isVisible().catch(() => false))) break;
      await b.click();
      await p.waitForTimeout(1200);
    }
    await main.getByRole('button', { name: 'Aprobar la moto' }).click();
    await expect(
      main.getByText(/1 vehículo por revisar/),
      'la moto sigue por revisar después de aprobarla',
    ).toHaveCount(0, { timeout: 20_000 });

    // 3) Rechazar la identidad con un motivo de la lista (le llega a la persona).
    await main.getByRole('button', { name: 'Rechazar', exact: true }).first().click();
    await main.getByRole('button', { name: /La foto del documento está borrosa/ }).click();
    await main.getByRole('button', { name: 'Rechazar con este motivo' }).click();
    await p.waitForTimeout(2000);

    // 4) El número del menú baja (se relee como lo hace el panel al cambiar de sección).
    await expect
      .poll(
        async () => {
          await abrir(p, `${raiz}/verifications`, tropiezos);
          await p.waitForTimeout(2500);
          return numeroDelMenu(p, /Verificaciones/);
        },
        {
          timeout: 60_000,
          intervals: [3000],
          message: `el número de Verificaciones no bajó (antes ${antes})`,
        },
      )
      .toBeLessThan(antes);
    anotar(
      `Rechazó la licencia con motivo, aprobó papeles y moto, rechazó la identidad con motivo; el menú bajó de ${antes}.`,
    );
  });
  await ctx.close();
});

test('A3 Usar «Usar esta fecha» en la fecha de nacimiento leída del documento', async ({
  browser,
}) => {
  const c = await conductorRobot(browser);
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(p, 'A3', async () => {
    await abrir(p, `${raiz}/verifications/${c.id}`, tropiezos);
    const ficha = p.getByTestId('ficha-nacimiento').first();
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    await ficha.scrollIntoViewIfNeeded();
    const usar = p.getByTestId('usar-fecha').first();
    if (await usar.isVisible().catch(() => false)) {
      await usar.click();
      await expect(ficha, 'la fecha no quedó guardada').toContainText(c.nacimiento, {
        timeout: 20_000,
      });
      await expect(ficha, 'la edad no se calculó').toContainText(/\d+ años/);
      anotar(`«Usar esta fecha» guardó ${c.nacimiento} y la edad salió sola.`);
      return;
    }
    const texto = await ficha.innerText();
    if (texto.includes(c.nacimiento) && /\d+ años/.test(texto))
      throw new NoSePudo(
        `la lectura automática leyó la fecha con confianza alta y la guardó sola (${texto.replace(/\s+/g, ' ').trim()}); no apareció el botón «Usar esta fecha» para probarlo`,
      );
    throw new Error(
      `no apareció «Usar esta fecha» y la fecha tampoco quedó guardada: ${texto.replace(/\s+/g, ' ').trim()}`,
    );
  });
  await ctx.close();
});

test('A4 Buscar por nombre, teléfono, placa o código desde la primera letra', async ({
  browser,
}) => {
  const c = await conductorRobot(browser);
  const { token } = await sesionSoporte();
  const ficha = ok(await pedir('GET', `/datos/admin/verificacion/${c.id}`, token), 'ficha')
    .codigo as string | undefined;
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(p, 'A4', async () => {
    await abrir(p, `${raiz}/verifications`, tropiezos);
    const caja = p.getByRole('combobox', { name: /Buscar/ });
    await expect(caja).toBeVisible({ timeout: 30_000 });
    const opciones = p.getByRole('option');
    const busca = async (texto: string, que: string) => {
      await caja.fill('');
      await caja.fill(texto);
      await expect(
        opciones.filter({ hasText: c.nombre }).first(),
        `buscando por ${que} («${texto}») no aparece el conductor`,
      ).toBeVisible({ timeout: 15_000 });
    };
    // Desde la primera letra ya sugiere algo.
    await caja.fill('R');
    await expect(opciones.first(), 'con una sola letra no sugiere nada').toBeVisible({
      timeout: 15_000,
    });
    await busca(c.nombre, 'nombre');
    await busca(c.telefono.slice(-7), 'teléfono');
    await busca(c.placa, 'placa');
    let codigo = ficha;
    if (!codigo) {
      await abrir(p, `${raiz}/verifications/${c.id}`, tropiezos);
      await expect(
        p
          .locator('main')
          .getByText(/\b[A-Z]{2}-[A-Z]{3}-\d{6}\b/)
          .first(),
      ).toBeVisible({
        timeout: 30_000,
      });
      codigo = (await p.locator('main').innerText()).match(/\b[A-Z]{2}-[A-Z]{3}-\d{6}\b/)?.[0];
    }
    if (!codigo) throw new Error('no encontré el código del conductor en su ficha para buscarlo');
    await busca(codigo, 'código');
    // El conductor quedó rechazado (A2) y es de El Vigía, otra ciudad que la de Soporte.
    anotar(
      'Sugiere desde la primera letra y lo encuentra por nombre, teléfono, placa y código (conductor de El Vigía, ya decidido).',
    );
  });
  await ctx.close();
});

test('A5 Mandar un aviso a una zona (WhatsApp «lo que te falta») con vista previa', async ({
  browser,
}) => {
  const c = await conductorRobot(browser);
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(p, 'A5', async () => {
    // 1) Vista previa a una persona (la cuenta del robot es de prueba: nunca se le manda).
    await abrir(p, `${raiz}/verifications/${c.id}`, tropiezos);
    await p.getByTestId('whatsapp-falta-boton').first().click();
    const ventana = p.getByTestId('whatsapp-falta-ventana');
    await expect(ventana, 'no se abrió la vista previa del WhatsApp').toBeVisible({
      timeout: 20_000,
    });
    await expect(
      ventana
        .getByTestId('whatsapp-falta-texto')
        .or(ventana.getByTestId('whatsapp-falta-motivo'))
        .first(),
      'la vista previa no muestra ni el texto ni por qué no sale',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      ventana.getByTestId('whatsapp-falta-enviar'),
      'a una cuenta de prueba se le ofrece mandar el WhatsApp',
    ).toHaveCount(0);
    await p.keyboard.press('Escape');

    // 2) A toda una zona: la vista previa de El Vigía (sin mandar nada).
    await abrir(p, `${raiz}/signup-reminders`, tropiezos);
    const ajustes = p.getByTestId('whatsapp-falta-ajustes');
    const elegir = p.getByTestId('whatsapp-falta-zona');
    await expect(elegir, 'no está «A todos los trabados de una zona»').toBeVisible({
      timeout: 30_000,
    });
    await elegir.scrollIntoViewIfNeeded();
    const opciones = await elegir.locator('option').allInnerTexts();
    expect(
      opciones.filter((o) => /revisi[oó]n|VE-ZZ-REVIEW/i.test(o)),
      'la zona de revisión de las tiendas se puede elegir para mandar avisos',
    ).toEqual([]);
    await elegir.selectOption({
      label: opciones.find((o) => o.includes(CIUDAD.nombre)) ?? CIUDAD.nombre,
    });
    await ajustes.getByRole('button', { name: /Ver a quién se le manda/ }).click();
    await expect(
      ajustes
        .getByTestId('whatsapp-falta-tabla')
        .or(ajustes.getByText(/no hay conductores trabados/))
        .first(),
      'la vista previa de la zona no mostró a nadie ni dijo que no hay nadie',
    ).toBeVisible({ timeout: 45_000 });
    // Las cuentas del robot (@aceptacion.test) pueden salir en la lista, pero a ninguna le sale nada.
    const filasRobot = ajustes
      .getByTestId('whatsapp-falta-tabla')
      .locator('tr')
      .filter({ hasText: /Robot Panel/ });
    for (const fila of await filasRobot.all())
      await expect(
        fila.locator('td').last(),
        'a una cuenta del robot le saldría el WhatsApp',
      ).toHaveText(/^\s*No\b/);
    const robotsEnLista = await filasRobot.count();
    // El botón de mandar existe, pero el robot NO lo toca (no se manda nada real).
    await p.getByText('A todos los trabados de una zona').scrollIntoViewIfNeeded();
    // 3) La regla de una vez cada 24 horas está a la vista (no se manda nada para comprobarla).
    await expect(p.getByText(/uno cada 24 horas como mucho/).first()).toBeVisible();
    anotar(
      `Vista previa a una persona y a la zona de El Vigía sin mandar nada; la zona de revisión no se puede elegir; la regla de 24 horas está a la vista (no se mandó un WhatsApp real para medirla).${robotsEnLista ? ` Nota: ${robotsEnLista} cuentas del robot (@aceptacion.test) aparecen en la lista de la zona como conductores reales (no llevan la marca de prueba); a ninguna le sale.` : ''}`,
    );
  });
  await ctx.close();
});

test('A6 Abrir la campana: el número va a cero al leerla', async ({ browser }) => {
  // Un conductor nuevo deja un aviso nuevo en la campana del equipo.
  await conductorRobot(browser);
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(p, 'A6', async () => {
    await abrir(p, `${raiz}/verifications`, tropiezos);
    const campana = p.getByTestId('campana');
    await expect(campana).toBeVisible({ timeout: 30_000 });
    const numero = campana.locator('.pd-campana-numero');
    await expect
      .poll(async () => (await numero.count()) > 0, {
        timeout: 40_000,
        message: 'espera el número',
      })
      .toBe(true)
      .catch(() => {
        throw new NoSePudo('la campana no tenía ningún aviso sin leer para probarla');
      });
    const antes = (await numero.innerText()).trim();
    await campana.click();
    await expect(p.locator('.pd-campana-caja')).toBeVisible();
    await expect(numero, `el número (${antes}) no se fue a cero al abrir la campana`).toHaveCount(
      0,
      {
        timeout: 15_000,
      },
    );
    // Y sigue en cero al volver (queda guardado en la cuenta, no solo en la pestaña).
    await p.keyboard.press('Escape');
    await p.waitForTimeout(2500);
    await p.reload();
    await expect(campana).toBeVisible({ timeout: 30_000 });
    await p.waitForTimeout(4000);
    await expect(numero, 'al recargar, la campana volvió a mostrar número').toHaveCount(0);
    await campana.click();
    anotar(`Tenía ${antes} sin leer; al abrirla quedó en cero y siguió en cero al recargar.`);
  });
  await ctx.close();
});

test('A7 Ver los que esperan por ciudad («Maracaibo: 14 esperando»)', async ({ browser }) => {
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(
    p,
    'A7',
    async () => {
      await abrir(p, `${raiz}/verifications`, tropiezos);
      const enlace = p.locator('nav a, aside a').filter({ hasText: /Espera por ciudad/ });
      if (!(await enlace.count())) {
        await abrir(p, `${raiz}/waitlist`, tropiezos);
        await p.waitForTimeout(2500);
        throw new Error(
          'el panel del sitio de pruebas no tiene «Espera por ciudad»: solo la «Lista de espera», que cuenta por país y por tipo, sin conteo por estado ni por ciudad',
        );
      }
      await enlace.first().click();
      const vista = p.getByTestId('espera-ciudades');
      await expect(vista, '«Espera por ciudad» no abrió').toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('espera-pais'), 'no hay filtro por país').toBeVisible();
      await expect(p.getByTestId('espera-estado'), 'no hay filtro por estado').toBeVisible();
      // Las cuentas del robot (internas) no cuentan aquí a propósito: se mira lo que hay de verdad.
      const filas = p.getByTestId('espera-tabla').locator('tbody tr[data-lugar]');
      await p.waitForTimeout(2500);
      const total = (
        await p
          .getByTestId('espera-total')
          .innerText()
          .catch(() => '')
      ).trim();
      if (!(await filas.count()))
        throw new NoSePudo(
          `en el sitio de pruebas nadie real espera en ninguna ciudad («${total}»); las cuentas del robot no cuentan ahí a propósito, así que no hay conteo que mirar`,
        );
      const primera = filas.first();
      const ciudad = (await primera.locator('td').first().innerText()).trim();
      const n = Number(
        (await primera.locator('[data-testid^="espera-n-"]').innerText()).replace(/\D/g, ''),
      );
      expect(n, `la ciudad ${ciudad} aparece sin nadie esperando`).toBeGreaterThan(0);
      // Elegir un país habilita el filtro por estado.
      await p.getByTestId('espera-pais').selectOption({ index: 1 });
      await expect(
        p.getByTestId('espera-estado'),
        'el filtro por estado no se habilita',
      ).toBeEnabled();
      anotar(
        `«Espera por ciudad» muestra ${ciudad}: ${n} esperando (${total}), con filtros por país, estado y quién.`,
      );
      return;
    },
    true,
  );
  await ctx.close();
});

test('A8 Editar un precio fijo del tabulador: el pasajero ve el precio nuevo', async ({
  browser,
}) => {
  const { token } = await sesionSoporte();
  type Ruta = {
    id: string;
    zona: string;
    servicio: string;
    desde: { lat: number; lng: number; radioKm: number; nombre: string } | null;
    hasta: { lat: number; lng: number; radioKm: number; nombre: string };
    precio: number;
    precioIdaVuelta: number | null;
    grupo: string | null;
    activa: boolean;
    reparto?: { pasajero: number; noche?: { pasajero: number } };
  };
  const leer = async () =>
    (
      ok(await pedir('GET', '/datos/admin/viajes/precios-zona', token), 'tabulador').rutas as Ruta[]
    ).find(
      (r) =>
        r.zona === CIUDAD.id && r.servicio === 'moto' && r.activa && r.desde?.nombre === 'KM 9',
    );
  const ruta = await leer();
  if (!ruta) throw new NoSePudo('no encontré la línea «KM 9» de Moto en el tabulador de El Vigía');
  const original = ruta.precio;
  const nuevo = original - 10; // diez centavos menos: el pasajero paga el menor, así se nota siempre
  // El pasajero del robot (cuenta nueva de prueba) cotiza de KM 9 al centro.
  const correo = `robot-panel-pasajero-${Date.now().toString(36)}@aceptacion.test`;
  const pas = ok(
    await pedir('POST', '/datos/cuentas/registro', undefined, {
      nombre: 'Pasajero Robot Panel',
      correo,
      clave: `Robot-${Date.now().toString(36)}-Pasajero9`,
      rol: 'cliente',
      telefono: celularDePrueba(),
      idioma: 'es',
      canal: 'app',
    }),
    'crear el pasajero',
  ) as { token: string };
  const cotizar = async () => {
    const r = ok(
      await pedir('POST', '/datos/viajes/cotizar', pas.token, {
        servicio: 'moto',
        origen: { lat: ruta.desde!.lat, lng: ruta.desde!.lng, direccion: 'KM 9, El Vigía' },
        destino: { lat: ruta.hasta.lat, lng: ruta.hasta.lng, direccion: 'Centro de El Vigía' },
      }),
      'cotizar de KM 9 al centro',
    ) as { cotizacion: { total: number; moneda: string } };
    return r.cotizacion.total;
  };
  const { ctx, p, raiz } = await panel(browser);
  let cambiado = false;
  try {
    await conFoto(p, 'A8', async () => {
      const antes = await cotizar();
      const esperadoAntes = [ruta.reparto?.pasajero, ruta.reparto?.noche?.pasajero];
      // Editar en el panel: «Viajes · Emergencias y tarifas» → Precios de la zona → KM 9 → Editar.
      await abrir(p, `${raiz}/rides`, tropiezos);
      const tabulador = p.getByTestId('precios-zona');
      await expect(tabulador).toBeVisible({ timeout: 30_000 });
      await tabulador.getByTestId('precio-zona-buscar').fill('KM 9');
      const linea = tabulador
        .getByTestId('precio-zona-linea')
        .filter({ hasText: /KM 9\b/ })
        .filter({ hasText: /Moto/ })
        .first();
      await expect(linea).toBeVisible();
      await linea.getByRole('button', { name: /opciones/i }).click();
      await p
        .getByRole('menuitem', { name: 'Editar' })
        .or(p.getByRole('button', { name: 'Editar' }))
        .first()
        .click();
      const precio = tabulador.getByTestId('precio-zona-precio');
      await expect(precio).toBeVisible();
      await precio.fill((nuevo / 100).toFixed(2));
      cambiado = true;
      await tabulador
        .getByRole('button', { name: /Guardar los cambios|Guardar/ })
        .first()
        .click();
      await expect
        .poll(async () => (await leer())?.precio, {
          timeout: 20_000,
          message: 'el precio no se guardó',
        })
        .toBe(nuevo);
      await linea.scrollIntoViewIfNeeded();
      const despues = await cotizar();
      const r2 = await leer();
      const esperado =
        antes === esperadoAntes[1] ? r2?.reparto?.noche?.pasajero : r2?.reparto?.pasajero;
      expect(
        despues,
        `el pasajero no ve el precio nuevo: antes pagaba ${antes / 100}, después ${despues / 100}, y el tabulador dice ${(esperado ?? nuevo) / 100}`,
      ).toBe(esperado ?? nuevo);
      anotar(
        `KM 9 → centro: el pasajero pagaba ${(antes / 100).toFixed(2)} y con el precio editado paga ${(despues / 100).toFixed(2)}; el precio se devolvió a ${(original / 100).toFixed(2)}.`,
      );
    });
  } finally {
    if (cambiado) {
      const r = await leer();
      if (r && r.precio !== original)
        ok(
          await pedir('PUT', `/datos/admin/viajes/precios-zona/${r.id}`, token, {
            zona: r.zona,
            servicio: r.servicio,
            desde: r.desde,
            hasta: r.hasta,
            precio: original,
            precioIdaVuelta: r.precioIdaVuelta,
            grupo: r.grupo ?? null,
          }),
          'devolver el precio de KM 9',
        );
      expect((await leer())?.precio, 'el precio de KM 9 no volvió a su valor').toBe(original);
    }
    await ctx.close();
  }
});

test('A9 Cargar saldo a un conductor: el saldo aparece en su app al instante', async ({
  browser,
}) => {
  const c = await conductorRobot(browser);
  const saldo = async () =>
    Number(
      ok(await pedir('GET', '/datos/repartidor/saldo-prepago', c.token), 'saldo del conductor')
        .disponible,
    );
  const antes = await saldo();
  const { ctx, p, raiz } = await panel(browser);
  await conFoto(p, 'A9', async () => {
    await abrir(p, `${raiz}/driver-balance`, tropiezos);
    const pagina = p.getByTestId('super-saldo-conductores');
    await expect(pagina).toBeVisible({ timeout: 30_000 });
    await pagina.getByRole('tab', { name: CIUDAD.nombre }).click();
    const fila = p.getByTestId('saldo-tabla').getByRole('row').filter({ hasText: c.nombre });
    await expect(fila, 'el conductor del robot no aparece en su ciudad').toBeVisible({
      timeout: 20_000,
    });
    await fila.getByRole('button', { name: 'Cargar' }).click();
    const carga = p.getByTestId('saldo-carga');
    await expect(carga).toBeVisible();
    await carga.getByLabel(/Monto/).fill('1');
    const motivo = carga.getByLabel(/^Motivo/);
    if ((await motivo.evaluate((e) => e.tagName)) === 'SELECT')
      await motivo.selectOption({ label: 'Corrección del equipo' });
    else await motivo.fill('Corrección del equipo');
    await carga.getByRole('button', { name: 'Revisar la carga' }).click();
    await expect(carga.getByTestId('saldo-confirmar-texto')).toContainText('$1.00');
    await carga.getByRole('button', { name: 'Confirmar la carga' }).click();
    await expect(
      p.getByText(/Saldo cargado|quedó en «Para aprobar»/).first(),
      'la carga no se confirmó',
    ).toBeVisible({ timeout: 20_000 });
    if (
      await p
        .getByText(/quedó en «Para aprobar»/)
        .isVisible()
        .catch(() => false)
    )
      throw new Error('la carga de 1 dólar quedó esperando la segunda firma: no llega al instante');
    const despues = await saldo();
    expect(
      despues,
      `el saldo en su app no subió 1 dólar (antes ${antes}, después ${despues} centavos)`,
    ).toBe(antes + 100);
    // El regalo automático por ciudad está a la vista (no se enciende en esta prueba).
    await expect(p.getByTestId('saldo-regalo-arranque')).toBeVisible();
    anotar(
      `Cargó 1 dólar desde el panel y la app del conductor lo ve al instante (${(antes / 100).toFixed(2)} → ${(despues / 100).toFixed(2)}). El regalo de arranque de El Vigía se miró sin encenderlo.`,
    );
  });
  await ctx.close();
});
