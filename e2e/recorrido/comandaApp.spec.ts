import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocalTexto } from './sqlLocal';

/**
 * LAN-3 · C-COMANDA-APP: la app del restaurante imprime la comanda («Imprimir comanda» en el pedido
 * aceptado y el interruptor «Imprimir la comanda al aceptar», guardado en el equipo), con el pedido
 * de prueba. Aquí corre la versión web de la misma app: la impresión se intercepta y se revisa el
 * ticket (número, platos, sin dinero ni dirección). Con CAPTURAS=1 guarda las fotos para Docs en
 * docs/capturas/comanda-app-<paso>-<idioma>.png. Solo en esta computadora.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const CAPTURAS = process.env.CAPTURAS === '1';
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');

for (const idioma of ['en', 'es'] as const)
  test(`la app del restaurante imprime la comanda (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const es = idioma === 'es';
    const id = `com${idioma}${Date.now().toString(36)}`;
    const correo = `restaurante.${id}@recorrido.test`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.94.${Math.floor(Math.random() * 250)}.7` },
      data: { nombre: 'Dueño Comanda', correo, clave: DATOS!.clave, rol: 'restaurante' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const { token } = (await r.json()) as { token: string };
    const con = { authorization: `Bearer ${token}` };
    const local = await request.put('/datos/mi-restaurante', {
      headers: con,
      data: {
        nombre: `Pizzería Comanda ${id.slice(-4)}`,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(local.ok(), await local.text()).toBe(true);
    const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
    for (const [nombreEs, nombreEn, precio] of [
      ['Pizza margarita', 'Margherita pizza', 1500],
      ['Limonada', 'Lemonade', 400],
    ] as const)
      await request.post('/datos/mi-restaurante/platos', {
        headers: con,
        data: { nombreEs, nombreEn, precioCentavos: precio },
      });
    sqlLocalTexto(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}';`);

    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: DATOS!.url,
      locale: es ? 'es-US' : 'en-US',
    });
    await ctx.addInitScript((i) => {
      localStorage.setItem('tumbite.idioma', i);
      // La impresión se intercepta: cada marco que la app agrega guarda su ticket al imprimir.
      const w = window as unknown as { tickets: string[] };
      w.tickets = [];
      const agregar = Node.prototype.appendChild;
      Node.prototype.appendChild = function <T extends Node>(this: Node, hijo: T): T {
        const r = agregar.call(this, hijo) as T;
        if (hijo instanceof HTMLIFrameElement && hijo.contentWindow) {
          const marco = hijo.contentWindow;
          marco.print = () => {
            w.tickets.push(marco.document.documentElement.outerHTML);
          };
        }
        return r;
      };
    }, idioma);
    const p = await ctx.newPage();
    const fotoDocs = async (paso: string) => {
      if (!CAPTURAS) return;
      mkdirSync(join(RAIZ, 'docs', 'capturas'), { recursive: true });
      await p.waitForTimeout(600);
      await p.screenshot({
        path: join(RAIZ, 'docs', 'capturas', `comanda-app-${paso}-${idioma}.png`),
      });
    };
    await p.goto('/restaurant/');
    await p.getByLabel(es ? 'Correo' : 'Email').fill(correo);
    await p.getByLabel(es ? 'Contraseña' : 'Password', { exact: true }).fill(DATOS!.clave);
    await p.getByRole('button', { name: es ? 'Entrar' : 'Sign in' }).click();

    // El interruptor «Imprimir la comanda al aceptar» en Inicio, guardado en este equipo.
    const interruptor = p.getByRole('switch', {
      name: es ? 'Imprimir la comanda al aceptar' : 'Print the ticket when accepting',
    });
    await expect(interruptor).toBeVisible({ timeout: 30_000 });
    await interruptor.click();
    await expect(interruptor).toBeChecked();
    await interruptor.scrollIntoViewIfNeeded();
    await fotoDocs('interruptor');
    expect(await p.evaluate(() => localStorage.getItem('divoox.comandaAlAceptar'))).toBe('1');

    // Pedido de prueba: al aceptarlo, la comanda sale sola.
    await p
      .getByRole('button', { name: es ? 'Enviar un pedido de prueba' : 'Send a test order' })
      .click();
    const aceptar = p
      .getByRole('button', { name: es ? /^Aceptar ·/ : /^Accept ·/ })
      .filter({ visible: true })
      .first();
    await expect(aceptar).toBeVisible({ timeout: 30_000 });
    await aceptar.click();
    await expect
      .poll(() => p.evaluate(() => (window as unknown as { tickets: string[] }).tickets.length), {
        timeout: 20_000,
        message: 'al aceptar se imprime la comanda',
      })
      .toBe(1);

    // En el pedido aceptado, «Imprimir comanda» la vuelve a imprimir.
    const imprimir = p.getByTestId('imprimir-comanda');
    await expect(async () => {
      if (!(await imprimir.isVisible()))
        await p
          .getByRole('button', { name: /#[0-9A-F]{4}/ })
          .first()
          .click();
      await expect(imprimir).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 40_000 });
    await imprimir.scrollIntoViewIfNeeded();
    await fotoDocs('boton');
    await imprimir.click();
    await expect
      .poll(() => p.evaluate(() => (window as unknown as { tickets: string[] }).tickets.length))
      .toBe(2);
    const ticket = await p.evaluate(() => (window as unknown as { tickets: string[] }).tickets[1]!);
    expect(ticket, ticket.slice(0, 300)).toMatch(/#[0-9A-F]{4}/);
    expect(ticket).toContain('size:80mm');
    expect(ticket).toContain(`Pizzería Comanda ${id.slice(-4)}`);
    expect(ticket).not.toMatch(/\$\s?\d/);

    // La comanda tal como sale en 80 mm, para Docs.
    if (CAPTURAS) {
      const hoja = await ctx.newPage();
      await hoja.setViewportSize({ width: 320, height: 300 });
      await hoja.setContent(ticket);
      await hoja.locator('body').screenshot({
        path: join(RAIZ, 'docs', 'capturas', `comanda-app-ticket-${idioma}.png`),
      });
    }
    await ctx.close();
  });
