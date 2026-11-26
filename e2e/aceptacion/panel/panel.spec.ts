/**
 * ROBOT DEL PANEL (26 nov 2026, plan de mejoras de Gerencia): recorre las líneas A1 a A9 de la lista
 * de aceptación (~/Gerencia/LISTA-DE-ACEPTACION-DIVOOX.md, sección 3) como lo haría una persona del
 * equipo de Soporte, en celular (Pixel 7), y deja el parte en registros/aceptacion/<fecha>/panel.json.
 *
 * C-ROBOTS-SOLO-PRUEBAS: SOLO el sitio de pruebas. Cuentas de robot («@robots.invalid»), nunca las de
 * revisión de las tiendas, nunca dinero real. Una línea en rojo NO se arregla aquí: se anota con el
 * detalle exacto y se sigue con las demás.
 *
 * Uso: node scripts/aceptacion/panel.mjs
 */
import { type BrowserContext, type Page, devices, expect, test } from '@playwright/test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  anotar,
  api,
  carpetaParte,
  q,
  sql,
  URL_PRUEBAS,
} from '../../../scripts/aceptacion/base-pruebas.mjs';
import {
  CLAVE_ROBOT,
  crearConductor,
  crearPasajero,
  entrarSuperadmin,
} from '../../../scripts/aceptacion/panel-datos.mjs';

const ROBOT = 'panel';
const SELLO = Date.now().toString(36).toUpperCase().slice(-5);
const NOMBRE = `Robot Panel ${SELLO}`;

test.describe.configure({ mode: 'serial' });

let ctx: BrowserContext;
let page: Page;
let adm: { token: string; ruta: string };
let cond: Awaited<ReturnType<typeof crearConductor>> & { telefono?: string; codigo?: string };
let pasajero: Awaited<ReturnType<typeof crearPasajero>>;
let motoAprobada = false;

const bandeja = () => join(carpetaParte(), 'capturas');

async function captura(linea: string) {
  const ruta = join(bandeja(), `panel-${linea}.png`);
  await page.screenshot({ path: ruta, fullPage: true }).catch(() => undefined);
  return `capturas/panel-${linea}.png`;
}

/** Corre una línea: verde si no lanza, rojo (con el detalle y la captura) si el producto falla. */
async function linea(id: string, fn: () => Promise<string>) {
  try {
    const detalle = await fn();
    anotar(ROBOT, id, 'verde', detalle, await captura(id));
  } catch (e) {
    anotar(ROBOT, id, 'rojo', e instanceof Error ? e.message : String(e), await captura(id));
  }
}

/** El número rojo de una tarea del menú (0 si no lleva número). */
async function contador(clave: string): Promise<number> {
  const el = page.getByTestId(`pendiente-${clave}`);
  if (!(await el.count())) return 0;
  const t = ((await el.first().textContent()) ?? '').trim();
  return t === '99+' ? 99 : Number(t.replace(/\D/g, '')) || 0;
}

async function ir(sub: string) {
  await page.goto(`${adm.ruta}${sub}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

const fichaDelConductor = () => `/verifications/${cond.id}`;

test.beforeAll(async ({ browser }) => {
  rmSync(join(carpetaParte(), 'panel.jsonl'), { force: true });
  adm = await entrarSuperadmin();
  cond = await crearConductor({ nombre: NOMBRE });
  const [u] = await sql(`SELECT telefono FROM usuarios WHERE id = ${q(cond.id)}`);
  cond.telefono = String(u.telefono);
  pasajero = await crearPasajero();
  ctx = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'es-ES',
    baseURL: URL_PRUEBAS,
  });
  await ctx.addCookies([
    {
      name: 'tumbite_sesion',
      value: adm.token,
      domain: new URL(URL_PRUEBAS).hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  page = await ctx.newPage();
  page.setDefaultTimeout(25_000);
});

test.afterAll(async () => {
  await ctx?.close();
});

// ── A1 ───────────────────────────────────────────────────────────────────────────────────────────
test('A1 conductor nuevo con papeles y moto en una pantalla', async () => {
  await linea('A1', async () => {
    await ir(fichaDelConductor());
    await expect(page.getByText('Barra de activación')).toBeVisible();
    const t = await page.locator('body').innerText();
    for (const x of [
      NOMBRE,
      'Papeles',
      'Licencia',
      'Vehículo por revisar',
      `Placa: ${cond.placa}`,
      'Barra de activación',
    ])
      expect(t, `la ficha no dice «${x}»`).toContain(x);
    const crudos = [...t.matchAll(/\b[a-z]{2,}(?:_[a-z0-9]+)+\b/g)].map((m) => m[0]);
    expect(crudos, `códigos crudos a la vista: ${crudos.join(', ')}`).toEqual([]);
    return 'identidad, papeles y moto (con su placa) en la misma ficha, todo en palabras, sin códigos crudos';
  });
});

// ── A2 ───────────────────────────────────────────────────────────────────────────────────────────
test('A2 aprobar la moto y rechazar un papel con motivo; baja el número', async () => {
  // El número del menú cuenta solo cuentas REALES (nunca las marcadas de prueba, por diseño): para
  // poder medir que baja, el robot suelta la marca de esta única cuenta mientras dura la línea y la
  // vuelve a poner al terminar (su correo «@robots.invalid» sigue sin recibir nada de nadie).
  await sql(`UPDATE usuarios SET es_prueba = 0 WHERE id = ${q(cond.id)}`);
  try {
    await linea('A2', async () => {
      await ir(fichaDelConductor());
      await expect(page.getByText('Barra de activación')).toBeVisible();
      const antes = await contador('verifications');
      // El papel (licencia) se rechaza con motivo.
      const papel = page
        .locator('li', { hasText: 'Licencia de moto' })
        .filter({ has: page.getByRole('button', { name: 'Aprobar', exact: true }) })
        .first();
      await papel.getByRole('button', { name: /Opciones del papel/i }).click();
      await page.getByRole('menuitem', { name: 'Rechazar' }).first().click();
      const motivo = 'Robot: la foto de la licencia está borrosa, tómala de nuevo.';
      await papel.locator('input[type="text"], input:not([type])').last().fill(motivo);
      await papel.getByRole('button', { name: 'Confirmar el rechazo' }).click();
      await expect(papel.getByRole('button', { name: 'Confirmar el rechazo' })).toBeHidden();
      // El conductor ve el rechazo con su motivo (lo que le llega a su app).
      const pap = (await api('GET', '/datos/conductor/papeles', undefined, { token: cond.token }))
        .d;
      const rech = JSON.stringify(pap).includes('borrosa');
      expect(
        rech,
        'el motivo del rechazo no le llegó al conductor: ' + JSON.stringify(pap).slice(0, 300),
      ).toBe(true);
      // La moto se aprueba.
      // Primero se aprueban sus papeles (registro, seguro, fotos); sin ellos el servidor no deja aprobar la moto.
      const docs = page.getByRole('button', { name: 'Aprobar documento' });
      for (let n = await docs.count(); n > 0; n = await docs.count()) {
        await docs.first().click();
        await expect(docs).toHaveCount(n - 1, { timeout: 20_000 });
      }
      await page.getByRole('button', { name: 'Aprobar la moto' }).click();
      await expect(page.getByText('Moto aprobada.')).toBeVisible();
      motoAprobada = true;
      // La identidad (lo último que esperaba de esta persona) se rechaza con motivo: así ya no le queda
      // nada por decidir al equipo (el número del menú cuenta personas con algo pendiente).
      const decision = page.getByTestId('kyc-decision');
      await decision.getByRole('button', { name: 'Rechazar', exact: true }).click();
      await decision.getByRole('button', { name: /La foto del documento está borrosa/ }).click();
      await decision.getByRole('button', { name: 'Rechazar con este motivo' }).click();
      await expect(page.getByText('Verificación rechazada.')).toBeVisible();
      // El número del menú baja al terminar la tarea (se vuelve a leer la pantalla).
      await ir(fichaDelConductor());
      await expect(page.getByText('Barra de activación')).toBeVisible();
      const despues = await contador('verifications');
      const [v] =
        (await api('GET', '/datos/conductor/vehiculos', undefined, { token: cond.token })).d
          .vehiculos ?? [];
      expect(v?.estado, 'la moto no quedó aprobada para el conductor').toBe('aprobado');
      expect(
        despues,
        `el número de Verificaciones no bajó (antes ${antes}, después ${despues})`,
      ).toBeLessThan(antes);
      return `moto aprobada, licencia e identidad rechazadas con motivo (todo lo que esperaba de esa persona); número de Verificaciones ${antes} → ${despues}`;
    });
  } finally {
    await sql(`UPDATE usuarios SET es_prueba = 1 WHERE id = ${q(cond.id)}`);
  }
});

// ── A3 ───────────────────────────────────────────────────────────────────────────────────────────
test('A3 «Usar esta fecha» en la fecha leída del documento', async () => {
  await linea('A3', async () => {
    // Lo que leería la comprobación automática del documento (con confianza baja: no se guarda sola).
    await sql(`DELETE FROM datos_documento WHERE usuario_id = ${q(cond.id)}`);
    await sql(
      `INSERT INTO datos_documento (usuario_id, nacimiento, confianza_nacimiento, confianza) VALUES (${q(cond.id)}, '1992-03-14', 60, 90)`,
    );
    await sql(`UPDATE usuarios SET fecha_nacimiento = NULL WHERE id = ${q(cond.id)}`);
    await ir(fichaDelConductor());
    await expect(page.getByTestId('fecha-propuesta').first()).toContainText('1992-03-14');
    await page.getByTestId('usar-fecha').first().click();
    await expect(page.getByTestId('ficha-nacimiento').first()).toContainText('1992-03-14');
    const [u] = await sql(`SELECT fecha_nacimiento FROM usuarios WHERE id = ${q(cond.id)}`);
    expect(u.fecha_nacimiento, 'la fecha no quedó guardada en su cuenta').toBe('1992-03-14');
    const hoy = new Date();
    let edad = hoy.getUTCFullYear() - 1992;
    if (hoy.getUTCMonth() + 1 < 3 || (hoy.getUTCMonth() + 1 === 3 && hoy.getUTCDate() < 14))
      edad -= 1;
    await ir(fichaDelConductor());
    await expect(page.getByTestId('ficha-nacimiento').first()).toContainText(`${edad} años`);
    return `fecha 1992-03-14 guardada con un toque y edad calculada sola (${edad} años)`;
  });
});

// ── A4 ───────────────────────────────────────────────────────────────────────────────────────────
test('A4 buscador por nombre, teléfono, placa y código desde la primera letra', async () => {
  await linea('A4', async () => {
    await ir('');
    const buscar = page.getByRole('combobox').first();
    const hallado: string[] = [];
    const probar = async (texto: string, esperado: string | RegExp, que: string) => {
      await buscar.fill('');
      await buscar.fill(texto);
      const caja = page.locator('.pd-buscador-caja').first();
      await expect(caja, `${que}: con «${texto}» no apareció «${esperado}»`).toContainText(
        esperado,
        { timeout: 15_000 },
      );
      hallado.push(que);
    };
    // Nombre: solo la primera palabra casi entera, y desde dos letras ya sugiere.
    await probar(NOMBRE.slice(0, 2), /Robot|Ro/, 'nombre (2 letras)');
    await probar(NOMBRE, NOMBRE, 'nombre completo');
    // Teléfono: los últimos cuatro números.
    await probar(cond.telefono!.replace(/\D/g, '').slice(-6), NOMBRE, 'teléfono');
    // Placa y código de conductor.
    await probar(cond.placa.slice(0, 5), cond.placa, 'placa');
    const cod = (await page.locator('.pd-buscador-caja').first().innerText()).match(
      /VE-ELV-\d{6}/,
    )?.[0];
    await probar(cond.placa, /VE-ELV-\d{6}/, 'placa → su conductor');
    const codigo =
      (await page.locator('.pd-buscador-caja').first().innerText()).match(/VE-ELV-\d{6}/)?.[0] ??
      cod;
    expect(codigo, 'no salió el código del conductor').toBeTruthy();
    await probar(codigo!, NOMBRE, 'código');
    // En otra ciudad (Caracas de pruebas) y ya cerrado (verificación rechazada).
    await probar('Carlos', /Caracas/, 'otra ciudad (Caracas)');
    const rech =
      (
        await api('GET', '/datos/admin/kyc?estado=rechazado&cuentas=todas', undefined, {
          token: adm.token,
        })
      ).d.solicitudes ?? [];
    const cerrado = rech.find((s: { nombre: string }) => s.nombre && !/robot/i.test(s.nombre));
    if (cerrado)
      await probar(
        cerrado.nombre.slice(0, 6),
        cerrado.nombre.slice(0, 6),
        `cerrado (${cerrado.nombre})`,
      );
    return `encontró por ${hallado.join(', ')}`;
  });
});

// ── A5 ───────────────────────────────────────────────────────────────────────────────────────────
test('A5 aviso por WhatsApp «lo que te falta» con vista previa', async () => {
  await linea('A5', async () => {
    // 1. Un conductor: la vista previa del mensaje y por qué una cuenta de robot nunca lo recibe.
    await ir(fichaDelConductor());
    await page.getByRole('button', { name: 'Mandarle por WhatsApp lo que le falta' }).click();
    const cuadro = page.getByRole('dialog').first();
    await expect(cuadro.or(page.getByText('Así les llega por WhatsApp').first()))
      .toBeVisible()
      .catch(() => undefined);
    await page.waitForTimeout(4000);
    const texto = await page.locator('body').innerText();
    expect(texto, 'no salió la vista previa del mensaje').toMatch(
      /Así (les|le) llega|Hola .* te falta|nunca se le manda|No sale/i,
    );
    expect(texto, 'una cuenta de robot no debe poder recibir el WhatsApp').not.toMatch(
      /Mensaje enviado|Listo: se mandó/i,
    );
    const cuenta = /nuestras cuentas|nunca se le manda|cuenta_interna/i.test(texto);
    await page.keyboard.press('Escape');
    // 2. Una zona: a quién se le mandaría (solo mirar, sin enviar).
    await ir('/signup-reminders');
    const zona = page.locator('select').filter({ hasText: 'Elige una zona' }).first();
    await zona.selectOption({ label: 'El Vigía (VE)' });
    await page.getByRole('button', { name: 'Ver a quién se le manda' }).click();
    await expect(page.getByText(/Mirando la barra/).first()).toBeHidden({ timeout: 60_000 });
    const t2 = await page.locator('body').innerText();
    expect(t2).toMatch(/¿Sale\?|En esta zona no hay conductores trabados/i);
    expect(t2, 'la zona de revisión aparece como destino').not.toMatch(/zona de revisión.*Sí/i);
    return `vista previa por conductor (cuenta de prueba protegida: ${cuenta ? 'sí' : 'no dicho'}) y por zona sin enviar nada`;
  });
  anotar(
    ROBOT,
    'A5-envio',
    'omitida',
    'El envío real (una vez por persona cada 24 h) no se prueba con robot: la plantilla de Meta no está aprobada, no existe una zona solo de robots y El Vigía tiene conductores reales; se prueba por teléfono real una vez por versión.',
  );
});

// ── A6 ───────────────────────────────────────────────────────────────────────────────────────────
test('A6 abrir la campana: el número va a cero', async () => {
  await linea('A6', async () => {
    await ir('');
    const campana = page.getByTestId('campana');
    const num = campana.locator('.pd-campana-numero');
    const antes = (await num.count()) ? Number((await num.textContent())?.replace(/\D/g, '')) : 0;
    if (!antes) {
      throw new Error(
        'no había avisos sin leer para comprobar el cero (la campana ya estaba en cero)',
      );
    }
    await campana.click();
    await expect(page.locator('.pd-campana-caja')).toBeVisible();
    await expect(num).toHaveCount(0);
    // Y sigue en cero al volver a cargar.
    await ir('');
    await expect(page.getByTestId('campana').locator('.pd-campana-numero')).toHaveCount(0);
    return `la campana tenía ${antes} sin leer, al abrirla quedó en cero y sigue en cero al recargar`;
  });
});

// ── A7 ───────────────────────────────────────────────────────────────────────────────────────────
test('A7 ver los que esperan por ciudad', async () => {
  await linea('A7', async () => {
    const correo = `robot.espera.${SELLO.toLowerCase()}@robots.invalid`;
    await sql(`DELETE FROM lista_espera WHERE correo = ${q(correo)}`);
    await sql(
      `INSERT INTO lista_espera (id, tipo, nombre, correo, ciudad, pais, idioma) VALUES (${q('robot-' + SELLO)}, 'comensal', 'Robot Espera', ${q(correo)}, 'Maracaibo', 'VE', 'es')`,
    );
    try {
      await ir('/waitlist');
      await expect(page.getByText('Robot Espera').first()).toBeVisible();
      const t = await page.locator('body').innerText();
      const porCiudad = t.match(
        /Maracaibo[^\n]{0,40}\d+\s+esperando|\d+\s+esperando[^\n]{0,40}Maracaibo/i,
      );
      expect(
        porCiudad,
        'La lista de espera solo cuenta por país (y la lista de personas): no hay un conteo «Ciudad: N esperando» por país, estado y ciudad.',
      ).toBeTruthy();
      return `conteo por ciudad visible: ${porCiudad![0]}`;
    } finally {
      await sql(`DELETE FROM lista_espera WHERE correo = ${q(correo)}`);
    }
  });
});

// ── A8 ───────────────────────────────────────────────────────────────────────────────────────────
test('A8 editar un precio fijo del tabulador de El Vigía', async () => {
  const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' };
  const DESTINO = { lat: 8.59643, lng: -71.72124, direccion: 'KM 9' };
  const cotizar = async () => {
    const r = await api(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      { token: pasajero.token },
    );
    if (r.estado >= 300)
      throw new Error(`cotizar: ${r.estado} ${JSON.stringify(r.d).slice(0, 200)}`);
    return r.d.cotizacion as { total: number; moneda: string };
  };
  let ruta:
    | { id: string; precio: number; reparto: { pasajero: number; noche?: { pasajero: number } } }
    | undefined;
  let original = 0;
  try {
    await linea('A8', async () => {
      const lista = (
        await api('GET', '/datos/admin/viajes/precios-zona', undefined, { token: adm.token })
      ).d.rutas as any[];
      ruta = lista.find(
        (r) =>
          r.zona === 'VE-MER-ELVIGIA' &&
          r.servicio === 'moto' &&
          r.desde?.nombre === 'El Vigía (casco urbano)' &&
          r.hasta?.nombre === 'KM 9',
      );
      if (!ruta) throw new Error('no está en la hoja la ruta El Vigía → KM 9');
      original = ruta.precio;
      const antes = await cotizar();
      const nuevo = original + 50; // +0,50 $
      await ir('/rides');
      await page.getByTestId('precio-zona-buscar').fill('KM 9');
      const fila = page
        .getByTestId('precio-zona-linea')
        .filter({ hasText: 'El Vigía (casco urbano) → KM 9' })
        .first();
      await expect(fila).toBeVisible();
      await fila.getByRole('button', { name: 'Opciones de la ruta' }).click();
      await page.getByRole('menuitem', { name: 'Editar' }).first().click();
      const campo = page.getByTestId('precio-zona-precio');
      await campo.scrollIntoViewIfNeeded();
      await campo.fill((nuevo / 100).toFixed(2));
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(
        page.getByText('Ruta guardada. Las cotizaciones nuevas ya la usan.'),
      ).toBeVisible();
      const hoja = (
        (await api('GET', '/datos/admin/viajes/precios-zona', undefined, { token: adm.token })).d
          .rutas as any[]
      ).find((r) => r.id === ruta!.id);
      expect(hoja.precio, 'la hoja no guardó el precio nuevo').toBe(nuevo);
      const despues = await cotizar();
      const esperados = [hoja.reparto.pasajero, hoja.reparto.noche?.pasajero].filter(Boolean);
      expect(
        esperados,
        `el pasajero cotiza ${despues.total} y la hoja dice ${esperados.join(' o ')}`,
      ).toContain(despues.total);
      expect(despues.total, `el pasajero sigue viendo ${antes.total}`).not.toBe(antes.total);
      return `precio ${original / 100} → ${nuevo / 100} $ en la hoja; el pasajero pasó de ${antes.total} a ${despues.total} centavos en su próxima cotización`;
    });
  } finally {
    // Siempre se devuelve el precio de la hoja a lo que tenía.
    if (ruta) {
      const r = (
        (await api('GET', '/datos/admin/viajes/precios-zona', undefined, { token: adm.token })).d
          .rutas as any[]
      ).find((x) => x.id === ruta!.id);
      if (r && r.precio !== original) {
        const rr = await api(
          'PUT',
          `/datos/admin/viajes/precios-zona/${r.id}`,
          {
            zona: r.zona,
            servicio: r.servicio,
            desde: r.desde,
            hasta: r.hasta,
            precio: original,
            precioIdaVuelta: r.precioIdaVuelta,
            grupo: r.grupo ?? null,
          },
          { token: adm.token },
        );
        console.warn(`[A8] precio devuelto a ${original} (${rr.estado})`);
      }
    }
  }
});

// ── A9 ───────────────────────────────────────────────────────────────────────────────────────────
test('A9 cargar saldo a un conductor desde el panel', async () => {
  await linea('A9', async () => {
    const leer = async () => {
      const r = await api('GET', '/datos/repartidor/saldo-prepago', undefined, {
        token: cond.token,
      });
      if (r.estado >= 300)
        throw new Error(`saldo del conductor: ${r.estado} ${JSON.stringify(r.d).slice(0, 150)}`);
      return Number(r.d.disponible ?? 0);
    };
    const antes = await leer();
    await ir('/driver-balance');
    await page.getByRole('tab', { name: 'El Vigía' }).click();
    const fila = page.getByTestId('saldo-tabla').locator('tr', { hasText: NOMBRE }).first();
    await expect(
      fila,
      'el conductor nuevo no sale en «Saldo de conductores» de su ciudad',
    ).toBeVisible();
    await fila.getByRole('button', { name: 'Cargar' }).click();
    const carga = page.getByTestId('saldo-carga');
    await carga.locator('input[type="number"]').fill('1.00');
    await carga.getByRole('button', { name: 'Revisar la carga' }).click();
    await expect(page.getByTestId('saldo-confirmar-texto')).toContainText(NOMBRE);
    await carga.getByRole('button', { name: 'Confirmar la carga' }).click();
    await expect(page.getByText('Saldo cargado.').first()).toBeVisible();
    const despues = await leer();
    expect(despues, `el saldo en su app no subió (antes ${antes}, después ${despues})`).toBe(
      antes + 100,
    );
    return `carga de 1,00 $ desde el panel; saldo en la API del conductor ${antes} → ${despues} centavos al instante`;
  });
  anotar(
    ROBOT,
    'A9-regalo',
    'omitida',
    'Activar el regalo automático por ciudad cambia la configuración real de El Vigía (reparte saldo a conductores nuevos reales): no se prueba con robot.',
  );
  void CLAVE_ROBOT;
  void motoAprobada;
});
