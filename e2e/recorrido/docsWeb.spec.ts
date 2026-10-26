import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, devices, expect, test } from './fixtures';

/**
 * Capturas originales de las páginas públicas para Docs (23 oct 2026, cambio de marca a Divoox):
 * borrar la cuenta, la calculadora, las franquicias, «olvidé mi contraseña» y la conversación de un
 * reporte de soporte. Solo con CAPTURAS=1 y solo en esta computadora. Las guarda en
 * docs/capturas/recorrido/web-<nombre>-<idioma>.png; `npm run recorrido:docs` las pasa a Docs.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const CAPTURAS = process.env.CAPTURAS === '1' && !process.env.TIENDA;
test.skip(STAGING || !CAPTURAS, 'solo para rehacer las capturas de Docs, en esta computadora');

const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      correoEquipo: string;
      semilla: string;
      clave: string;
    });

for (const idioma of ['en', 'es'] as const) {
  test(`capturas de las páginas públicas para Docs (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const es = idioma === 'es';
    const pre = es ? '/es' : '';
    const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
    mkdirSync(dir, { recursive: true });
    // Las de computadora llevan «web-» (quedan a su ancho en Docs); las del celular, su nombre.
    const guardar = (pagina: Page, nombre: string, celular = false) =>
      pagina.screenshot({ path: join(dir, `${celular ? '' : 'web-'}${nombre}-${idioma}.png`) });
    const contexto = async (celular = false) => {
      const ctx = await browser.newContext({
        ...(celular ? devices['Pixel 7'] : { viewport: { width: 1100, height: 900 } }),
        baseURL: DATOS!.url,
        locale: es ? 'es-US' : 'en-US',
      });
      await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
      return ctx;
    };

    const ctx = await contexto();
    const p = await ctx.newPage();

    await p.goto(`${pre}/delete-account`);
    await expect(p.getByRole('heading', { level: 1 })).toContainText('Divoox');
    await guardar(p, 'borrar-cuenta');

    await p.goto(`${pre}/calculator`);
    await p.getByRole('tab', { name: es ? 'Restaurante' : 'Restaurant' }).click();
    await guardar(p, 'calculadora-restaurante');
    await p.getByRole('tab', { name: es ? 'Franquicia' : 'Franchise' }).click();
    await guardar(p, 'calculadora-franquicia');

    // Desde el 25 oct la franquicia vive solo en su página para inversionistas.
    await p.goto(`${pre}/franchise`);
    await expect(p.getByRole('heading', { level: 1 })).toBeVisible();
    await p.waitForTimeout(500);
    await guardar(p, 'franquicias');

    await p.goto(`${pre}/forgot-password`);
    await expect(p.getByRole('textbox').first()).toBeVisible();
    await guardar(p, 'olvide-clave');
    await ctx.close();

    // La conversación de un reporte: lo abre un cliente y le responde el equipo de Divoox.
    const correoCliente = `docs.${idioma}.${Date.now().toString(36)}@recorrido.test`;
    const registro = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.89.${idioma === 'es' ? 1 : 2}.${Date.now() % 250}` },
      data: {
        nombre: 'Ana García',
        correo: correoCliente,
        clave: DATOS!.clave,
        rol: 'cliente',
      },
    });
    expect(registro.ok(), await registro.text()).toBe(true);
    const { token } = (await registro.json()) as { token: string };
    await request.put('/datos/cuentas/idioma', {
      headers: { authorization: `Bearer ${token}` },
      data: { idioma },
    });
    const queja = await request.post('/datos/quejas', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        texto: es
          ? 'Mi pizza llegó fría y faltó la limonada.'
          : 'My pizza arrived cold and the lemonade was missing.',
      },
    });
    expect(queja.ok(), await queja.text()).toBe(true);
    const { enlace } = (await queja.json()) as { enlace: string };
    // La cuenta del equipo (ADMIN_CORREOS en la preparación): se entra o, la primera vez, se crea.
    let entrar = await request.post('/datos/cuentas/entrar', {
      data: { correo: DATOS!.correoEquipo, clave: DATOS!.clave },
    });
    if (!entrar.ok())
      entrar = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.89.9.${Date.now() % 250}` },
        data: {
          nombre: 'Soporte Recorrido',
          correo: DATOS!.correoEquipo,
          clave: DATOS!.clave,
          rol: 'cliente',
        },
      });
    expect(entrar.ok(), await entrar.text()).toBe(true);
    const equipo = {
      authorization: `Bearer ${((await entrar.json()) as { token: string }).token}`,
    };
    // Igual que el recorrido: la semilla local la vuelve del equipo (si ya lo es, no cambia nada).
    await request.post('/datos/cuentas/hacer-admin', {
      headers: equipo,
      data: { semilla: DATOS!.semilla },
    });
    const lista = (await (
      await request.get('/datos/admin/tickets', { headers: equipo })
    ).json()) as {
      tickets: { id: string; correo: string }[];
    };
    const ticket = lista.tickets.find((x) => x.correo === correoCliente);
    expect(ticket, 'el reporte aparece en la bandeja del equipo').toBeTruthy();
    const respuesta = await request.post(`/datos/admin/tickets/${ticket!.id}/mensajes`, {
      headers: equipo,
      data: {
        texto: es
          ? 'Hola, Ana. Lo sentimos. Te devolvimos la limonada y te dejamos un regalo para tu próximo pedido.'
          : "Hi, Ana. We're sorry. We refunded the lemonade and left you a gift for your next order.",
      },
    });
    expect(respuesta.ok(), await respuesta.text()).toBe(true);
    const cel = await contexto(true);
    const t = await cel.newPage();
    await t.goto(enlace);
    await expect(t.getByText(es ? /Hola, Ana/ : /Hi, Ana/)).toBeVisible({ timeout: 20_000 });
    await guardar(t, 'cliente-ticket', true);
    await cel.close();
  });
}
