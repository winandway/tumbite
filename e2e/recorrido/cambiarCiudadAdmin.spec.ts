import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { rutaSuperadmin } from './rutaSuperadmin';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { sqlLocal, sqlLocalTexto } from './sqlLocal';

/**
 * C-CAMBIAR-CIUDAD-ADMIN (piloto, 18 nov 2026; todos los países): desde la ficha del repartidor en
 * el superadmin, los tres puntos traen «Cambiar ciudad»: ciudades activas, motivo y confirmación
 * (otra más si cambia de país). Con CAPTURAS=1 guarda las capturas de la ayuda interna «?» en la
 * carpeta privada (nunca en Docs públicos).
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');
const PRIVADA = join(homedir(), 'Divoox-privado', 'ayuda-interna', 'originales', 'ciudad');
const CAPTURAS = process.env.CAPTURAS === '1';

for (const idioma of ['es', 'en'] as const)
  test(`el equipo pasa a un conductor de Miami a El Vigía (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    if (CAPTURAS) mkdirSync(PRIVADA, { recursive: true });
    const id = Date.now().toString(36);
    let ip = 0;
    const cuenta = async (rol: 'cliente' | 'repartidor', nombre: string) => {
      const correo = `ciudad.${rol}.${idioma}.${id}@recorrido.test`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.97.${Math.floor(++ip / 250)}.${ip % 250}` },
        data: { nombre, correo, clave: `Ciudad-${id}-Driver9`, rol },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const d = (await r.json()) as { token: string; usuario: { id: string } };
      return { token: d.token, id: d.usuario.id };
    };
    const admin = await cuenta('cliente', 'Soporte Divoox');
    sqlLocalTexto(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
    // El Vigía activa (como en las pruebas de Venezuela), si la base local todavía no la tiene.
    if (!sqlLocal("SELECT id FROM zonas WHERE id = 'VE-MER-ELVIGIA' AND activa = 1").length) {
      const abrir = await request.post('/datos/admin/comida/ciudades', {
        headers: { authorization: `Bearer ${admin.token}` },
        data: {
          zona: {
            id: 'VE-MER-ELVIGIA',
            nombre: 'El Vigía',
            lat: 8.6219,
            lng: -71.6506,
            radioKm: 15,
            zonaHoraria: 'America/Caracas',
          },
          motivo: 'Ciudad de pruebas en El Vigía',
        },
      });
      expect(abrir.ok(), await abrir.text()).toBe(true);
    }
    const c = await cuenta('repartidor', idioma === 'en' ? 'Alex Turner' : 'Carlos Rivera');
    sqlLocalTexto(`INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${c.id}', 'US-FL-MIAMI')
      ON CONFLICT(usuario_id) DO UPDATE SET zona_id = 'US-FL-MIAMI', conectado = 0, ciudad_elegida_en = NULL, codigo = NULL`);

    const ruta = await rutaSuperadmin(request, { authorization: `Bearer ${admin.token}` });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    // Revisor: nada de ventanas del navegador (si apareciera una, la prueba falla).
    p.on('dialog', (d) => {
      throw new Error(`ventana del navegador inesperada: ${d.message()}`);
    });
    await p.goto(`/panel/${ruta ? `${ruta}/` : ''}drivers/${c.id}`);
    await expect(p.getByRole('heading', { level: 1 })).toContainText(
      idioma === 'en' ? 'Alex Turner' : 'Carlos Rivera',
      { timeout: 30_000 },
    );
    await p
      .getByRole('button', {
        name: idioma === 'en' ? 'More account actions' : 'Más acciones de la cuenta',
      })
      .click();
    await p
      .getByRole('menuitem', { name: idioma === 'en' ? 'Change city' : 'Cambiar ciudad' })
      .click();
    const form = p.getByTestId('cambiar-ciudad-repartidor');
    await form
      .getByLabel(idioma === 'en' ? 'New city' : 'Ciudad nueva')
      .selectOption('VE-MER-ELVIGIA');
    await form
      .getByLabel(idioma === 'en' ? /Reason/ : /Motivo/)
      .fill(
        idioma === 'en'
          ? 'Lives in El Vigía, approved by management'
          : 'Vive en El Vigía, autorizado por Gerencia',
      );
    if (CAPTURAS) await form.screenshot({ path: join(PRIVADA, `formulario-${idioma}.png`) });
    await form
      .getByRole('button', { name: idioma === 'en' ? 'Review the change' : 'Revisar el cambio' })
      .click();
    await form
      .getByLabel(idioma === 'en' ? 'I confirm the country change' : 'Confirmo el cambio de país')
      .check();
    if (CAPTURAS) await form.screenshot({ path: join(PRIVADA, `confirmar-${idioma}.png`) });
    await form
      .getByRole('button', {
        name: idioma === 'en' ? 'Yes, change the city' : 'Sí, cambiar la ciudad',
      })
      .click();
    await expect(p.getByRole('status').filter({ hasText: /VE-/ })).toBeVisible({ timeout: 30_000 });
    if (CAPTURAS) {
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({
        path: join(PRIVADA, `listo-${idioma}.png`),
        clip: { x: 0, y: 0, width: 1280, height: 360 },
      });
    }
    const f = sqlLocal(
      `SELECT r.zona_id AS rz, u.zona_id AS uz, r.codigo FROM repartidores r JOIN usuarios u ON u.id = r.usuario_id WHERE r.usuario_id = '${c.id}'`,
    )[0];
    expect(f).toMatchObject({ rz: 'VE-MER-ELVIGIA', uz: 'VE-MER-ELVIGIA' });
    expect(String(f?.codigo)).toMatch(/^VE-/);
    await ctx.close();
  });
