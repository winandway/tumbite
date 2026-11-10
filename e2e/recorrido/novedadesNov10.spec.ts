import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * Lo del 10 nov 2026, probado en el navegador de punta a punta y con sus capturas reales para Docs:
 * C-FLOTA-PROPIA (el restaurante invita a su repartidor), C-CANCELAR-LISTO (pedir a soporte la
 * cancelación de un pedido listo), C-DISPONIBLE-MUNDO («Avísame cuando llegue» y «Quiero traer
 * Divoox a mi ciudad») y C-CAMARA-EN-TODA-SUBIDA («Tomar foto»). Todos los países.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');

const CAPTURAS = join(RAIZ, 'docs', 'capturas', 'nov10');
mkdirSync(CAPTURAS, { recursive: true });
const SANTIAGO = { lat: -33.4489, lng: -70.6693 };

for (const idioma of ['es', 'en'] as const)
  test(`novedades del 10 nov en el navegador (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const en = idioma === 'en';
    const id = `${idioma}${Date.now().toString(36)}`;
    let n = 0;
    const ip = () => ({ 'cf-connecting-ip': `10.97.${en ? 2 : 1}.${(Date.now() + n++) % 250}` });
    const foto = (p: import('@playwright/test').Page, nombre: string) =>
      p.screenshot({ path: join(CAPTURAS, `${nombre}-${idioma}.png`) });
    async function cuenta(rol: string, nombre: string, alias: string) {
      const correo = `${alias}.${id}@recorrido.test`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: ip(),
        data: { nombre, correo, clave: DATOS!.clave, rol, idioma },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const j = (await r.json()) as { token: string; usuario: { id: string } };
      return { correo, token: j.token, id: j.usuario.id };
    }
    const con = (token: string) => ({ authorization: `Bearer ${token}` });
    async function panelDe(correo: string) {
      const ctx = await browser.newContext({
        viewport: { width: 1100, height: 900 },
        baseURL: DATOS!.url,
        locale: en ? 'en-US' : 'es-US',
      });
      await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
      await ctx.request.post('/datos/cuentas/entrar', {
        headers: ip(),
        data: { correo, clave: DATOS!.clave },
      });
      return ctx.newPage();
    }
    const ruta = (r: string) => `${en ? '' : '/es'}${r}`;

    // ───────── El restaurante, su plato y su repartidor ─────────
    const dueno = await cuenta(
      'restaurante',
      en ? 'Restaurant owner' : 'Dueño del restaurante',
      'dueno',
    );
    const local = await request.put('/datos/mi-restaurante', {
      headers: con(dueno.token),
      data: {
        nombre: en ? `Pizza House ${id}` : `Casa de Pizza ${id}`,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
    const rep = await cuenta('repartidor', en ? 'Fleet driver' : 'Repartidor del equipo', 'rep');

    // ───────── C-FLOTA-PROPIA: «Mis repartidores» ─────────
    const panel = await panelDe(dueno.correo);
    await panel.goto(ruta('/panel/fleet'));
    await expect(panel.getByTestId('flota')).toBeVisible({ timeout: 30_000 });
    await panel.getByLabel(en ? /My own drivers/ : /Mis propios repartidores/).check();
    await panel
      .getByRole('button', { name: en ? 'Save' : 'Guardar' })
      .first()
      .click();
    await expect(panel.getByText(en ? 'Saved.' : 'Guardado.')).toBeVisible();
    await foto(panel, 'restaurante-flota-modo');
    await panel
      .getByPlaceholder(en ? 'Driver’s name' : 'Nombre del repartidor')
      .fill(en ? 'Fleet driver' : 'Repartidor del equipo');
    await panel.getByPlaceholder(en ? 'email@example.com' : 'correo@ejemplo.com').fill(rep.correo);
    await panel.getByRole('button', { name: en ? 'Send invitation' : 'Enviar invitación' }).click();
    const cajaEnlace = panel.getByTestId('flota-enlace');
    await expect(cajaEnlace).toBeVisible();
    const enlace = (await cajaEnlace.locator('code').innerText()).trim();
    // En la foto, la dirección pública (en esta computadora el sitio vive en localhost).
    await cajaEnlace
      .locator('code')
      .evaluate(
        (el) =>
          (el.textContent = (el.textContent ?? '').replace(
            /^https?:\/\/[^/]+/,
            'https://divoox.com',
          )),
      );
    await cajaEnlace.scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-flota-invitacion');
    expect(enlace).toMatch(/\/driver\/fleet\//);

    // La página pública del enlace dice quién invita.
    const pub = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: DATOS!.url,
      locale: en ? 'en-US' : 'es-US',
    });
    await pub.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const pagina = await pub.newPage();
    await pagina.goto(`${en ? '' : '/es'}${new URL(enlace).pathname}`);
    await expect(pagina.getByTestId('invitacion-flota')).toBeVisible({ timeout: 30_000 });
    await foto(pagina, 'web-flota-enlace');

    // El repartidor la ve en Divoox Driver y la acepta.
    const driver = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await driver.addInitScript(
      ([pase, i, uid]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        // C-PERMISOS-EXPLICADOS: esta cuenta ya vio la pantalla que explica los permisos.
        localStorage.setItem(`divoox.permisos.${uid}`, '1');
      },
      [rep.token, idioma, rep.id],
    );
    const d = await driver.newPage();
    await d.goto('/driver/');
    const invitacion = d.getByTestId('invitaciones-flota');
    await expect(invitacion).toBeVisible({ timeout: 60_000 });
    await invitacion.scrollIntoViewIfNeeded();
    await foto(d, 'driver-flota-invitacion');
    await invitacion.getByRole('button', { name: en ? 'Accept' : 'Aceptar' }).click();
    await expect(d.getByTestId('mi-flota')).toBeVisible({ timeout: 20_000 });
    await d.getByTestId('mi-flota').scrollIntoViewIfNeeded();
    await foto(d, 'driver-flota-aceptada');
    await panel.reload();
    await expect(
      panel.getByText(en ? 'Fleet driver' : 'Repartidor del equipo').first(),
    ).toBeVisible({ timeout: 30_000 });
    await panel
      .getByText(en ? 'My delivery team' : 'Mi equipo de reparto')
      .scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-flota-equipo');

    // ───────── C-CANCELAR-LISTO: pedir a soporte la cancelación ─────────
    sqlLocal(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}'`);
    const plato = await request.post('/datos/mi-restaurante/platos', {
      headers: con(dueno.token),
      data: { nombreEs: 'Pizza margarita', nombreEn: 'Margherita pizza', precioCentavos: 1500 },
    });
    expect(plato.ok(), await plato.text()).toBe(true);
    const platoId = ((await plato.json()) as { plato: { id: string } }).plato.id;
    await request.put('/datos/mi-restaurante/horarios', {
      headers: con(dueno.token),
      data: {
        turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
      },
    });
    const abierto = await request.patch('/datos/mi-restaurante/abierto', {
      headers: con(dueno.token),
      data: { abierto: true },
    });
    expect(abierto.ok(), await abierto.text()).toBe(true);
    const cliente = await cuenta('cliente', en ? 'Customer' : 'Cliente', 'cliente');
    const pedido = await request.post('/datos/pedidos', {
      headers: con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [{ platoId, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '300 Biscayne Blvd, Miami, FL',
        lat: 25.777,
        lng: -80.19,
      },
    });
    expect(pedido.ok(), await pedido.text()).toBe(true);
    const pid = ((await pedido.json()) as { pedidoId: string }).pedidoId;
    for (const paso of [
      "estado = 'pagado', pagado_en = datetime('now')",
      "estado = 'aceptado', aceptado_en = datetime('now')",
      "estado = 'listo', listo_en = datetime('now')",
    ])
      sqlLocal(`UPDATE pedidos SET ${paso} WHERE id = '${pid}'`);
    await panel.goto(ruta('/panel/orders'));
    const tarjeta = panel.locator('li', { hasText: pid.slice(0, 4).toUpperCase() }).first();
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await tarjeta.getByRole('button', { name: en ? 'More options' : 'Más opciones' }).click();
    const opcion = panel.getByRole('menuitem', {
      name: en ? 'Ask support to cancel' : 'Pedir cancelación a soporte',
    });
    await expect(opcion).toBeVisible();
    await foto(panel, 'restaurante-cancelar-listo-menu');
    await opcion.click();
    const formulario = panel.getByTestId('pedir-cancelacion');
    await formulario.getByRole('combobox').selectOption('repartidor_no_llego');
    await expect(formulario.getByTestId('quien-paga')).toBeVisible();
    await formulario.scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-cancelar-listo-motivo');
    await formulario
      .getByRole('button', { name: en ? 'Send to support' : 'Enviar a soporte' })
      .click();
    await expect(panel.getByTestId('cancelacion-pendiente')).toBeVisible({ timeout: 20_000 });
    await panel.getByTestId('cancelacion-pendiente').scrollIntoViewIfNeeded();
    await foto(panel, 'restaurante-cancelar-listo-enviada');
    const fila = sqlLocal(
      `SELECT motivo, paga_comida, estado FROM solicitudes_cancelacion WHERE pedido_id = '${pid}'`,
    );
    expect(fila[0]).toMatchObject({
      motivo: 'repartidor_no_llego',
      paga_comida: 'divoox',
      estado: 'pendiente',
    });

    // ───────── C-DISPONIBLE-MUNDO y C-CAMARA-EN-TODA-SUBIDA: un restaurante de otra ciudad ─────────
    const lejos = await cuenta(
      'restaurante',
      en ? 'Restaurant owner' : 'Dueño del restaurante',
      'lejos',
    );
    const otro = await request.put('/datos/mi-restaurante', {
      headers: con(lejos.token),
      data: {
        nombre: en ? `Southern Kitchen ${id}` : `Cocina del Sur ${id}`,
        categoria: 'Pizza',
        telefono: '+56912345678',
        direccion: 'Av. Providencia 100, Santiago',
        ...SANTIAGO,
      },
    });
    expect(otro.ok(), await otro.text()).toBe(true);
    expect(((await otro.json()) as { cobertura: string }).cobertura).toBe('fuera');
    const panelLejos = await panelDe(lejos.correo);
    await panelLejos.goto(ruta('/panel/restaurant'));
    await expect(panelLejos.getByTestId('boton-camara')).toBeVisible({ timeout: 30_000 });
    await foto(panelLejos, 'restaurante-tomar-foto');
    const traer = panelLejos.getByTestId('traer-divoox');
    await traer.scrollIntoViewIfNeeded();
    await traer
      .getByPlaceholder(en ? 'City, country' : 'Ciudad, país')
      .fill(en ? 'Santiago, Chile' : 'Santiago, Chile');
    await foto(panelLejos, 'restaurante-traer-divoox');
    await traer
      .getByRole('button', {
        name: en ? 'Bring Divoox to my city' : 'Quiero traer Divoox a mi ciudad',
      })
      .click();
    await expect(panelLejos.getByTestId('traer-divoox-listo')).toBeVisible({ timeout: 20_000 });

    // El cliente de otra ciudad: «Avísame cuando llegue» dentro de la app.
    const app = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await app.addInitScript(
      ([pase, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
      },
      [cliente.token, idioma],
    );
    const a = await app.newPage();
    await a.goto(
      `/app/?lat=${SANTIAGO.lat}&lng=${SANTIAGO.lng}&direccion=${encodeURIComponent('Av. Providencia 100, Santiago')}`,
    );
    const avisame = a.getByTestId('avisame-comensal').first();
    await expect(avisame).toBeVisible({ timeout: 60_000 });
    await avisame.scrollIntoViewIfNeeded();
    await avisame.getByPlaceholder(en ? 'City, country' : 'Ciudad, país').fill('Santiago, Chile');
    // En la foto, un correo neutro (el de la corrida lleva letras al azar).
    await a
      .getByTestId('avisame-correo')
      .first()
      .evaluate(
        (el, [de, a2]) => (el.textContent = (el.textContent ?? '').replace(de!, a2!)),
        [cliente.correo, en ? 'email@example.com' : 'correo@ejemplo.com'],
      );
    await foto(a, 'cliente-avisame');
    await avisame
      .getByRole('button', { name: en ? 'Notify me when it arrives' : 'Avísame cuando llegue' })
      .click();
    await expect(a.getByTestId('avisame-listo').first()).toBeVisible({ timeout: 20_000 });
    await a.getByTestId('avisame-listo').first().scrollIntoViewIfNeeded();
    await foto(a, 'cliente-avisame-listo');
    const anotado = sqlLocal(
      `SELECT origen, ciudad FROM lista_espera WHERE correo = '${cliente.correo}'`,
    );
    expect(anotado[0]).toMatchObject({ origen: 'app', ciudad: 'Santiago, Chile' });
  });
