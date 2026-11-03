import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { type Page, devices, expect, test } from './fixtures';
import { sqlLocalTexto } from './sqlLocal';

/**
 * LAN-4 · C-ACCESIBILIDAD-WEB: revisión automática con axe (código abierto, licencia MPL-2.0) de la
 * web pública y de la app del cliente en la web, en inglés y en español, en celular y en
 * computadora: portada, «Cómo funciona», Docs (portada y una guía), lista de restaurantes, ficha,
 * carrito y pedido. Falla si aparece una sola infracción «crítica» o «seria» de WCAG 2.1 A/AA.
 * Solo en esta computadora (el recorrido local); la ficha está en
 * docs/investigaciones-rea/2026-11-03-accesibilidad-web.md.
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

const GRAVES = new Set(['critical', 'serious']);

/** Las infracciones críticas y serias de la página, en palabras para el reporte. */
async function revisar(p: Page, donde: string) {
  const r = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // El mapa de Leaflet trae sus propios mosaicos y controles (biblioteca externa).
    .exclude('.leaflet-container')
    .analyze();
  return r.violations
    .filter((v) => GRAVES.has(v.impact ?? ''))
    .map(
      (v) =>
        `${donde} · ${v.impact} · ${v.id}: ${v.help} → ${v.nodes
          .slice(0, 3)
          .map((n) => {
            const d = n.any[0]?.data as { fgColor?: string; bgColor?: string } | undefined;
            return `${n.target.join(' ')}${d?.fgColor ? ` (${d.fgColor} sobre ${d.bgColor})` : ''} «${(n.html ?? '').slice(0, 90)}»`;
          })
          .join(' | ')}`,
    );
}

for (const idioma of ['en', 'es'] as const)
  for (const equipo of ['celular', 'computadora'] as const)
    test(`sin infracciones críticas ni serias (${idioma}, ${equipo})`, async ({
      browser,
      request,
    }) => {
      test.setTimeout(300_000);
      const es = idioma === 'es';
      const pre = es ? '/es' : '';
      const id = `a11y${idioma}${equipo.slice(0, 3)}${Date.now().toString(36)}`;
      let ip = 0;
      const cuenta = async (rol: string, nombre: string) => {
        const r = await request.post('/datos/cuentas/registro', {
          headers: { 'cf-connecting-ip': `10.93.${Math.floor(Math.random() * 250)}.${++ip}` },
          data: { nombre, correo: `${rol}.${id}@recorrido.test`, clave: DATOS!.clave, rol },
        });
        expect(r.ok(), await r.text()).toBe(true);
        return (await r.json()) as { token: string; usuario: { id: string } };
      };
      const dueno = await cuenta('restaurante', 'Dueño Accesible');
      const cliente = await cuenta('cliente', 'Cliente Accesible');
      const con = (t: string) => ({ authorization: `Bearer ${t}` });
      const local = await request.put('/datos/mi-restaurante', {
        headers: con(dueno.token),
        data: {
          nombre: `Pizzería Accesible ${id}`,
          categoria: 'Pizza',
          telefono: '3055550100',
          direccion: '100 Biscayne Blvd, Miami, FL',
          lat: 25.7743,
          lng: -80.1937,
        },
      });
      expect(local.ok(), await local.text()).toBe(true);
      const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
      const plato = await request.post('/datos/mi-restaurante/platos', {
        headers: con(dueno.token),
        data: { nombreEs: 'Pizza margarita', nombreEn: 'Margherita pizza', precioCentavos: 1500 },
      });
      expect(plato.ok(), await plato.text()).toBe(true);
      await request.put('/datos/mi-restaurante/horarios', {
        headers: con(dueno.token),
        data: {
          turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
        },
      });
      sqlLocalTexto(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}';`);
      const abierto = await request.patch('/datos/mi-restaurante/abierto', {
        headers: con(dueno.token),
        data: { abierto: true },
      });
      expect(abierto.ok(), await abierto.text()).toBe(true);
      const pid = ((await plato.json()) as { plato: { id: string } }).plato.id;
      const pedido = await request.post('/datos/pedidos', {
        headers: con(cliente.token),
        data: {
          restauranteId: rid,
          lineas: [{ platoId: pid, cantidad: 1 }],
          propinaCentavos: 200,
          entrega: 'puerta',
          direccion: '200 S Biscayne Blvd, Miami, FL',
          lat: 25.7735,
          lng: -80.189,
        },
      });
      expect(pedido.ok(), await pedido.text()).toBe(true);
      const pedidoId = ((await pedido.json()) as { pedidoId: string }).pedidoId;
      sqlLocalTexto(
        `UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = '${pedidoId}';
         UPDATE pedidos SET estado = 'aceptado', aceptado_en = datetime('now'), tiempo_prep_min = 20 WHERE id = '${pedidoId}';`,
      );

      const ctx = await browser.newContext({
        ...(equipo === 'celular' ? devices['Pixel 7'] : { viewport: { width: 1280, height: 900 } }),
        baseURL: DATOS!.url,
        locale: es ? 'es-US' : 'en-US',
      });
      await ctx.addInitScript(
        ([i]) => {
          localStorage.setItem('tumbite.idioma', i);
        },
        [idioma],
      );
      const p = await ctx.newPage();
      const fallas: string[] = [];

      // La web pública.
      for (const ruta of [`${pre}/`, `${pre}/how-it-works`, `${pre}/docs`]) {
        await p.goto(ruta);
        await expect(p.getByRole('heading', { level: 1 }).first()).toBeVisible({
          timeout: 30_000,
        });
        fallas.push(...(await revisar(p, ruta)));
      }
      // Una guía de Docs (la primera de la portada de Docs).
      const guia = p.locator('main a[href*="/docs/"]').first();
      const enlace = await guia.getAttribute('href');
      expect(enlace, 'Docs tiene guías').toBeTruthy();
      await p.goto(enlace!);
      await expect(p.getByRole('heading', { level: 1 }).first()).toBeVisible();
      fallas.push(...(await revisar(p, enlace!)));

      // La app del cliente en la web, con la sesión del cliente.
      await p.evaluate((pase) => localStorage.setItem('tumbite.sesion', pase), cliente.token);
      await p.goto('/app/restaurants');
      await expect(p.getByRole('button', { name: `Pizzería Accesible ${id}` }).first()).toBeVisible(
        { timeout: 30_000 },
      );
      fallas.push(...(await revisar(p, '/app/restaurants')));
      await p.goto(`/app/restaurant/${rid}`);
      const agregar = p
        .getByRole('button', {
          name: es ? 'Agregar Pizza margarita' : 'Add Margherita pizza',
        })
        .filter({ visible: true })
        .first();
      await expect(agregar).toBeVisible({ timeout: 30_000 });
      fallas.push(...(await revisar(p, '/app/restaurant')));
      await agregar.click();
      const ver = p.getByRole('button', { name: es ? /Ver carrito/ : /View cart/ });
      await ver.filter({ visible: true }).first().click({ timeout: 15_000 });
      await expect(p).toHaveURL(/\/app\/cart/);
      await p.waitForTimeout(1500);
      fallas.push(...(await revisar(p, '/app/cart')));
      await p.goto(`/app/order/${pedidoId}`);
      await expect(p.getByText(`Pizzería Accesible ${id}`).first()).toBeVisible({
        timeout: 30_000,
      });
      fallas.push(...(await revisar(p, '/app/order')));
      await ctx.close();
      expect(fallas, fallas.join('\n')).toEqual([]);
    });
