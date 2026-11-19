import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * C-AGENTE-DIVOOX (18 nov 2026): el Agente Divoox en las pantallas de verdad, de punta a punta.
 * El equipo enciende la ciudad, crea al agente y le anota el fondo; el agente crea su contraseña y
 * entra en dos pasos; el conductor pide su código en Ganancias; el agente lo paga (deslizando) y
 * después le vende saldo; el equipo ve la conciliación. Español: ciudad que paga en bolívares con
 * la tasa fijada. Inglés: ciudad que paga en dólares enteros.
 * C-DOCS-SIN-DATOS-REALES: las capturas van a Docs, así que la ciudad, el agente y el conductor son
 * de ejemplo y no se nombra ningún lugar. Con CAPTURAS=1 guarda las capturas
 * (docs/capturas/agente-divoox/; las del superadmin son internas y no van a Docs públicos).
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
const CAPTURAS = process.env.CAPTURAS === '1';
const CARPETA = join(RAIZ, 'docs', 'capturas', 'agente-divoox');
if (CAPTURAS) mkdirSync(CARPETA, { recursive: true });
const sql = sqlLocal;

const CASOS = {
  es: {
    zona: { id: 'VE-EJEMPLO', nombre: 'Ciudad Ejemplo', pais: 'VE', tz: 'America/Caracas' },
    pagaEn: 'VES',
    agente: 'Casa de Cambio Ejemplo',
    direccion: 'Calle Principal 123, local 4',
    horario: 'Lunes a sábado, de 8 a 5',
    conductor: 'Carlos Ejemplo',
    telefono: '+584145550101',
    escrito: '0414-5550101',
    ganancias: 4_250,
    cobro: '25.50',
    entrega: 'Bs. 6.375,00',
    venta: '10',
    cobra: 'Bs. 2.500,00',
    ganTab: 'Ganancias',
  },
  en: {
    zona: { id: 'US-SAMPLE', nombre: 'Sample City', pais: 'US', tz: 'America/New_York' },
    pagaEn: 'USD',
    agente: 'Sample Exchange',
    direccion: '123 Main Street, Suite 4',
    horario: 'Monday to Saturday, 8 to 5',
    conductor: 'Alex Sample',
    telefono: '+12485550101',
    escrito: '(248) 555-0101',
    ganancias: 4_250,
    cobro: '25',
    entrega: '$25.00',
    venta: '10',
    cobra: '$10.00',
    ganTab: 'Earnings',
  },
} as const;

for (const idioma of ['es', 'en'] as const) {
  test(`Agente Divoox de punta a punta (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const C = CASOS[idioma];
    const id = `${Date.now().toString(36)}${idioma}`;
    const pre = idioma === 'es' ? '/es' : '';
    // Los últimos cuatro números del teléfono cambian en cada corrida (el teléfono es único).
    const sufijo = String(Date.now()).slice(-4);
    const foto = async (donde: Page | ReturnType<Page['getByTestId']>, nombre: string) => {
      if (CAPTURAS) await donde.screenshot({ path: join(CARPETA, `${nombre}-${idioma}.png`) });
    };
    let ip = 0;
    const registrar = async (rol: string, nombre: string, telefono: string) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.97.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo: `agente.${rol}.${ip}.${id}@recorrido.test`,
          clave: DATOS!.clave,
          rol: rol === 'admin' ? 'cliente' : rol,
          telefono,
          idioma,
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return (await r.json()) as { token: string; usuario: { id: string; correo: string } };
    };
    const h = (t: string) => ({ authorization: `Bearer ${t}` });
    const z = C.zona;
    sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
         VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.tz}', 10, -70, 15, 1, '${idioma}')`);
    // La tasa del día fija para la prueba (Venezuela): 250 bolívares por dólar.
    sql(`UPDATE zonas SET activa = 1 WHERE id = '${z.id}'`);
    // Lo que había antes se guarda y se devuelve al terminar (otras pruebas usan la tasa de Venezuela).
    const modoAntes =
      C.pagaEn === 'VES'
        ? (sql("SELECT modo, ajuste_pct, tasa_fija FROM tasas_modo WHERE pais = 'VE'")[0] ?? null)
        : null;
    if (C.pagaEn === 'VES')
      sql(
        "INSERT OR REPLACE INTO tasas_modo (pais, modo, ajuste_pct, tasa_fija) VALUES ('VE', 'fija', NULL, 250)",
      );
    // Cada corrida deja la ciudad apagada y sin agentes viejos con sesión.
    sql(`DELETE FROM agentes_ciudad WHERE zona_id = '${z.id}'`);
    sql(
      `UPDATE agentes SET estado = 'suspendido', nombre = 'Agente anterior ' || substr(id, 1, 6) WHERE zona_id = '${z.id}' AND nombre NOT LIKE 'Agente anterior%'`,
    );
    const admin = await registrar(
      'admin',
      idioma === 'es' ? 'Soporte Divoox' : 'Divoox Support',
      idioma === 'es' ? `+58414555${sufijo}` : `+1248555${sufijo}`,
    );
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
    const conductor = await registrar(
      'repartidor',
      C.conductor,
      `${C.telefono.slice(0, -4)}${sufijo}`,
    );
    const telefonoEscrito = `${C.escrito.slice(0, -4)}${sufijo}`;
    const tel = sql(`SELECT telefono FROM usuarios WHERE id = '${conductor.usuario.id}'`)[0]
      ?.telefono as string;
    sql(
      `INSERT OR IGNORE INTO repartidores (usuario_id, conectado, zona_id) VALUES ('${conductor.usuario.id}', 0, '${z.id}')`,
    );
    sql(`UPDATE repartidores SET zona_id = '${z.id}' WHERE usuario_id = '${conductor.usuario.id}'`);
    sql(
      `INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES ('mov-${id}', '${conductor.usuario.id}', ${C.ganancias}, 'regalo', 'recorrido:${id}')`,
    );

    // ── El equipo: Dinero → Agentes. Enciende la ciudad y crea al agente. ──
    const { ruta } = (await (
      await request.get('/datos/admin/ruta', { headers: h(admin.token) })
    ).json()) as { ruta: string | null };
    const panel = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await panel.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await panel.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
    const sp = await panel.newPage();
    await sp.goto(`/panel${ruta ? `/${ruta}` : ''}/agents`);
    await expect(sp.getByTestId('super-agentes')).toBeVisible({ timeout: 30_000 });
    const filaCiudad = sp.getByTestId('agentes-ciudades').locator('tr', { hasText: z.nombre });
    await filaCiudad.getByRole('button').click();
    const formCiudad = sp.getByTestId('agentes-ciudad-form');
    await formCiudad.getByRole('checkbox').check();
    await formCiudad.locator('select').selectOption(C.pagaEn);
    await foto(formCiudad, 'super-ciudad');
    await formCiudad.locator('button[type="submit"]').click();
    await expect(filaCiudad).toContainText(idioma === 'es' ? 'Encendido' : 'On');
    const crear = sp.getByTestId('agente-crear');
    const correoAgente = `agente.${id}@recorrido.test`;
    const campos = crear.locator('input');
    await campos.nth(0).fill(C.agente);
    await campos.nth(1).fill(correoAgente);
    await campos.nth(2).fill(idioma === 'es' ? '+584145550199' : '+12485550199');
    await crear.locator('select').first().selectOption(z.id);
    await campos.nth(3).fill(C.direccion);
    await campos.nth(4).fill(C.horario);
    await crear.locator('select').nth(1).selectOption(idioma);
    await foto(crear, 'super-crear');
    await crear.locator('button[type="submit"]').click();
    const enlace = (
      await sp.getByTestId('agente-enlace-prueba').locator('code').innerText()
    ).trim();
    expect(enlace).toContain(`${pre}/agent/password?token=`);
    const sobra = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    // Le anota el fondo: 200 dólares transferidos por fuera.
    await sp
      .getByTestId('agentes-tabla')
      .locator('tr', { hasText: C.agente })
      .getByRole('button')
      .click();
    const libro = sp.getByTestId('agente-libro');
    await libro.locator('input[type="number"]').fill('200');
    await libro.locator('input:not([type="number"])').first().fill('TRF-0001');
    await libro.locator('button[type="submit"]').click();
    await expect(sp.getByTestId('agente-libro-confirmar')).toBeVisible();
    await foto(libro, 'super-fondo');
    await libro.locator('button.exito').click();
    await expect(sp.getByTestId('agente-conciliacion')).toContainText('$200.00');

    // ── El agente: crea su contraseña y entra en dos pasos. ──
    const ctxAgente = await browser.newContext({ viewport: { width: 1100, height: 820 } });
    const pa = await ctxAgente.newPage();
    await pa.goto(new URL(enlace).pathname + new URL(enlace).search);
    const clave = 'clave-de-agente-ejemplo';
    const cajaClave = pa.getByTestId('agente-clave');
    await cajaClave.locator('input').nth(0).fill(clave);
    await cajaClave.locator('input').nth(1).fill(clave);
    await foto(pa, 'agente-contrasena');
    await cajaClave.locator('button[type="submit"]').click();
    await cajaClave.getByRole('link').click();
    const entrar = pa.getByTestId('agente-entrar');
    await entrar.locator('input[type="email"]').fill(correoAgente);
    await entrar.locator('input[autocomplete="current-password"]').fill(clave);
    await foto(pa, 'agente-entrar');
    const [respuesta] = await Promise.all([
      pa.waitForResponse((r) => r.url().endsWith('/datos/agent/login')),
      entrar.locator('button[type="submit"]').click(),
    ]);
    const { codigoPrueba } = (await respuesta.json()) as { codigoPrueba: string };
    const segundo = pa.getByTestId('agente-codigo');
    await segundo.locator('input').fill(codigoPrueba);
    await foto(pa, 'agente-segundo-paso');
    await segundo.locator('button[type="submit"]').click();
    await expect(pa.getByTestId('agente-fondo')).toContainText('$200.00', { timeout: 30_000 });
    // La dirección del selector de idioma queda en su idioma y el panel no se desborda.
    expect(new URL(pa.url()).pathname).toBe(`${pre}/agent`);
    await foto(pa, 'agente-inicio');

    // ── El conductor: Ganancias → «Cobrar en efectivo». ──
    const ctxRep = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctxRep.addInitScript(
      ([pase, idi, cuentaId]) => {
        localStorage.setItem('tumbite.idioma', idi);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${cuentaId}`, '1');
      },
      [conductor.token, idioma, conductor.usuario.id] as const,
    );
    const pr = await ctxRep.newPage();
    await pr.goto('/driver');
    await pr.getByText(C.ganTab, { exact: true }).last().click();
    const tarjeta = pr.getByTestId('cobrar-efectivo');
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await tarjeta.scrollIntoViewIfNeeded();
    await foto(tarjeta, 'conductor-cobrar');
    await pr.getByTestId('cobro-abrir').click();
    await tarjeta.locator('input').fill(C.cobro);
    await foto(tarjeta, 'conductor-monto');
    await tarjeta.getByText(idioma === 'es' ? 'Pedir mi código' : 'Get my code').click();
    await expect(pr.getByTestId('cobro-vivo')).toBeVisible({ timeout: 30_000 });
    if (C.pagaEn === 'VES') await expect(pr.getByTestId('cobro-en-mano-bs')).toHaveText(C.entrega);
    // El monto va grande, en dólares, con los bolívares debajo (pieza única de Driver).
    await expect(pr.getByTestId('cobro-en-mano-usd')).toBeVisible();
    await expect(pr.getByTestId('cobro-agentes')).toContainText(C.agente);
    // C-DOCS-SIN-DATOS-REALES: en la captura se ve un código de ejemplo que el servidor nunca
    // genera (empieza por cero); el de verdad se usa abajo para pagar.
    if (CAPTURAS) {
      await pr.route('**/datos/repartidor/cobro-efectivo', async (ruta) => {
        if (ruta.request().method() !== 'GET') return ruta.continue();
        const r = await ruta.fetch();
        const d = (await r.json()) as { vivo: { codigo: string } | null };
        if (d.vivo) d.vivo.codigo = '012345';
        await ruta.fulfill({ response: r, json: d });
      });
      await pr.reload();
      await pr.getByText(C.ganTab, { exact: true }).last().click();
      await expect(pr.getByTestId('cobro-vivo')).toBeVisible({ timeout: 30_000 });
      await pr.getByTestId('cobrar-efectivo').scrollIntoViewIfNeeded();
      await foto(pr.getByTestId('cobrar-efectivo'), 'conductor-codigo');
      await pr.unroute('**/datos/repartidor/cobro-efectivo');
    }
    const estado = (await (
      await request.get('/datos/repartidor/cobro-efectivo', { headers: h(conductor.token) })
    ).json()) as { vivo: { codigo: string; monto: number } };
    expect(estado.vivo.codigo).toMatch(/^[1-9]\d{5}$/);

    // ── El agente paga: código, ficha, «Ya le entregué el efectivo» y deslizar. ──
    await pa.getByTestId('agente-ir-pagar').click();
    const pagar = pa.getByTestId('agente-pagar');
    await pagar.locator('input.agente-codigo').fill('012345');
    await foto(pa, 'agente-pagar-codigo');
    await pagar.locator('input.agente-codigo').fill(estado.vivo.codigo);
    await pagar.locator('button[type="submit"]').click();
    await expect(pa.getByTestId('agente-cobro')).toContainText(C.conductor);
    await expect(pa.getByTestId('agente-entrega')).toHaveText(C.entrega);
    await foto(pa, 'agente-pagar-ficha');
    await pa.getByTestId('agente-ya-entregue').click();
    await expect(pa.getByTestId('agente-confirmar')).toBeVisible();
    await foto(pa, 'agente-pagar-deslizar');
    // Deslizar de verdad, con el ratón, hasta el final.
    const boton = pa.getByTestId('agente-deslizar');
    const caja = (await boton.boundingBox())!;
    const pista = (await boton.locator('..').boundingBox())!;
    await pa.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await pa.mouse.down();
    await pa.mouse.move(pista.x + pista.width - 10, caja.y + caja.height / 2, { steps: 12 });
    await pa.mouse.up();
    const recibo = pa.getByTestId('agente-recibo');
    await expect(recibo).toBeVisible({ timeout: 30_000 });
    await expect(recibo).toContainText(C.conductor);
    await foto(pa, 'agente-pagar-recibo');
    await recibo.getByRole('button').first().click();
    const pagado = Math.round(Number(C.cobro) * 100);
    await expect(pa.getByTestId('agente-fondo')).toContainText(
      `$${((20_000 - pagado) / 100).toFixed(2)}`,
    );

    // ── El agente vende saldo: busca por teléfono, cobra y acredita. ──
    await pa.getByTestId('agente-ir-vender').click();
    const vender = pa.getByTestId('agente-vender');
    await vender.locator('input[type="tel"]').fill(telefonoEscrito);
    await foto(pa, 'agente-vender-buscar');
    await vender.locator('button[type="submit"]').click();
    await expect(pa.getByTestId('agente-venta')).toContainText(C.conductor);
    await pa.getByTestId('agente-venta').locator('input').fill(C.venta);
    await expect(pa.getByTestId('agente-cobra')).toHaveText(C.cobra);
    await foto(pa, 'agente-vender-monto');
    await pa.getByTestId('agente-venta').locator('button[type="submit"]').click();
    await foto(pa, 'agente-vender-confirmar');
    await pa.getByTestId('agente-ya-cobre').click();
    await expect(recibo).toBeVisible({ timeout: 30_000 });
    await foto(pa, 'agente-vender-recibo');
    await foto(recibo, 'agente-vender-recibo-tarjeta');
    await recibo.getByRole('button').first().click();
    await pa.getByRole('button', { name: idioma === 'es' ? 'Historial' : 'History' }).click();
    await expect(pa.getByTestId('agente-historial').locator('tbody tr')).toHaveCount(3);
    await foto(pa, 'agente-historial');
    await pa.getByRole('button', { name: idioma === 'es' ? 'Ayuda' : 'Help' }).click();
    await expect(pa.getByTestId('agente-ayuda')).toBeVisible();
    // El panel cabe en un teléfono sin desbordarse.
    await pa.setViewportSize({ width: 390, height: 800 });
    await pa.getByRole('button', { name: idioma === 'es' ? 'Inicio' : 'Home' }).click();
    const sobraAgente = await pa.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sobraAgente).toBeLessThanOrEqual(0);
    await foto(pa, 'agente-inicio-celular');

    // ── El dinero quedó donde debe: ganancias, saldo, fondo y deuda. ──
    const despues = (await (
      await request.get('/datos/repartidor/cobro-efectivo', { headers: h(conductor.token) })
    ).json()) as {
      vivo: unknown;
      ganancias: number;
      historial: { estado: string; monto: number }[];
    };
    expect(despues.vivo).toBeNull();
    expect(despues.ganancias).toBe(C.ganancias - pagado);
    expect(despues.historial[0]).toMatchObject({ estado: 'pagado', monto: pagado });
    const saldo = sql(
      `SELECT COALESCE(SUM(monto), 0) AS s FROM libro WHERE cuenta_id = '${conductor.usuario.id}' AND bolsillo = 'prepago'`,
    )[0]?.s;
    expect(Number(saldo)).toBe(1_000);
    expect(tel).toBeTruthy();
    // El conductor ve su cobro en el historial de la tarjeta.
    await pr.reload();
    await pr.getByText(C.ganTab, { exact: true }).last().click();
    await expect(pr.getByTestId('cobro-historial')).toBeVisible({ timeout: 30_000 });
    await pr.getByTestId('cobrar-efectivo').scrollIntoViewIfNeeded();
    await foto(pr.getByTestId('cobrar-efectivo'), 'conductor-historial');
    // La recarga con el agente aparece en su saldo para comisiones.
    await expect(pr.getByTestId('cargas-saldo')).toContainText('Agente Divoox'.split(' ')[1] ?? '');
    await pr.getByTestId('saldo-prepago').scrollIntoViewIfNeeded();
    await foto(pr.getByTestId('saldo-prepago'), 'conductor-saldo');

    // ── El equipo ve la conciliación. ──
    await sp.reload();
    await sp
      .getByTestId('agentes-tabla')
      .locator('tr', { hasText: C.agente })
      .getByRole('button')
      .click();
    const conc = sp.getByTestId('agente-conciliacion');
    await expect(conc).toContainText(`$${((20_000 - pagado) / 100).toFixed(2)}`);
    await expect(conc).toContainText('$10.00');
    await foto(conc, 'super-conciliacion');
    await expect(sp.getByTestId('agente-historial').locator('tbody tr')).toHaveCount(3);

    // ── Salir cierra de verdad la sesión del agente. ──
    await pa.getByRole('button', { name: idioma === 'es' ? 'Salir' : 'Sign out' }).click();
    await expect(pa.getByTestId('agente-entrar')).toBeVisible({ timeout: 30_000 });
    expect((await pa.request.get('/datos/agent/me')).status()).toBe(401);

    // Se deja como estaba: la ciudad apagada, el agente suspendido y la tasa de antes.
    sql(`DELETE FROM agentes_ciudad WHERE zona_id = '${z.id}'`);
    sql(`UPDATE agentes SET estado = 'suspendido' WHERE zona_id = '${z.id}'`);
    // La zona de ejemplo queda apagada: ninguna otra prueba la ve en las listas de ciudades.
    sql(`UPDATE zonas SET activa = 0 WHERE id = '${z.id}'`);
    if (C.pagaEn === 'VES') {
      if (modoAntes)
        sql(
          `INSERT OR REPLACE INTO tasas_modo (pais, modo, ajuste_pct, tasa_fija) VALUES ('VE', '${String(modoAntes.modo)}', ${modoAntes.ajuste_pct == null ? 'NULL' : Number(modoAntes.ajuste_pct)}, ${modoAntes.tasa_fija == null ? 'NULL' : Number(modoAntes.tasa_fija)})`,
        );
      else sql("DELETE FROM tasas_modo WHERE pais = 'VE'");
    }
    await ctxAgente.close();
    await ctxRep.close();
    await panel.close();
  });
}
