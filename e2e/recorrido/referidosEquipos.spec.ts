import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * C-REFERIDOS-EQUIPOS (17 nov 2026): equipos y referidos en las pantallas de verdad. El equipo crea el
 * equipo con su líder; el enlace público dice quién invita; los conductores se registran con el
 * código; el líder ve «Mi equipo» en Divoox Driver; el superadmin ve los programas y los equipos.
 * Español con El Vigía, inglés con Novi.
 * C-DOCS-SIN-DATOS-REALES (18 nov 2026): estas capturas van a Docs públicos, así que el equipo, el
 * líder y los miembros son de ejemplo, y el código que se ve es uno que el servidor NUNCA puede
 * generar (termina en «O01» / «001»: las letras O, I y los números 0 y 1 no están en su alfabeto).
 * El QR de la captura lleva a ese código inexistente en divoox.com, no a un equipo de verdad. Con CAPTURAS=1 guarda las capturas (docs/capturas/referidos/).
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
const CARPETA = join(RAIZ, 'docs', 'capturas', 'referidos');
if (CAPTURAS) mkdirSync(CARPETA, { recursive: true });
const sql = sqlLocal;

// «Mi equipo» NO va en la ficha de las tiendas (tercera auditoría, 18 nov 2026): los programas de
// referidos están apagados en producción y la pantalla habla de ganar saldo.

// Nombres neutros (auditor de tiendas, 18 nov 2026).
const CIUDADES = {
  es: {
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      pais: 'VE',
      lat: 8.6219,
      lng: -71.6506,
      tz: 'America/Caracas',
    },
    equipo: 'Equipo Ejemplo',
    lider: 'Andrés Ejemplo',
    codigo: 'EJEMPLO01',
    enlace: 'https://divoox.com/es/join/EJEMPLO01',
    miembros: ['Carlos R.', 'Ana M.', 'Luis P.'],
    tel: '+58414777',
  },
  en: {
    zona: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      pais: 'US',
      lat: 42.4806,
      lng: -83.4755,
      tz: 'America/Detroit',
    },
    equipo: 'Sample Team',
    lider: 'Alex Sample',
    codigo: 'SAMPLE001',
    enlace: 'https://divoox.com/join/SAMPLE001',
    miembros: ['Michael B.', 'Sarah K.', 'David L.'],
    tel: '+1248777',
  },
} as const;

for (const idioma of ['es', 'en'] as const) {
  test(`equipos y referidos de punta a punta (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const C = CIUDADES[idioma];
    const id = `${Date.now().toString(36)}${idioma}`;
    let ip = 0;
    const registrar = async (rol: string, nombre: string, extra: Record<string, string> = {}) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.98.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo: `ref.${rol}.${ip}.${id}@recorrido.test`,
          clave: DATOS!.clave,
          rol: rol === 'admin' ? 'cliente' : rol,
          telefono: `${C.tel}${String(1000 + ip).slice(-4)}`,
          idioma,
          ...extra,
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return (await r.json()) as { token: string; usuario: { id: string; correo: string } };
    };
    const h = (t: string) => ({ authorization: `Bearer ${t}` });
    const z = C.zona;
    sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
         VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.tz}', ${z.lat}, ${z.lng}, 15, 1, '${idioma}')`);
    const admin = await registrar('admin', idioma === 'es' ? 'Soporte Divoox' : 'Divoox Support');
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
    // El líder ya maneja en Divoox Driver; el equipo crea su equipo con su correo.
    const lider = await registrar('repartidor', C.lider);
    sql(
      `INSERT OR IGNORE INTO repartidores (usuario_id, conectado, zona_id) VALUES ('${lider.usuario.id}', 0, '${z.id}')`,
    );
    const equipo = await request.post('/datos/admin/equipos', {
      headers: h(admin.token),
      data: { nombre: C.equipo, zonaId: z.id, lider: lider.usuario.correo },
    });
    expect(equipo.ok(), await equipo.text()).toBe(true);
    const generado = ((await equipo.json()) as { equipo: { codigo: string } }).equipo.codigo;
    // El código real se cambia por el de ejemplo, que el servidor nunca genera.
    const codigo = C.codigo;
    sql(`UPDATE equipos SET codigo = 'VIEJO' || substr(id, 1, 8) WHERE codigo = '${codigo}'`);
    sql(`UPDATE equipos SET codigo = '${codigo}' WHERE codigo = '${generado}'`);
    // El programa de conductores de Venezuela queda encendido con sus valores por defecto (prueba).
    const p = await request.put(`/datos/admin/referidos-programas/conductor/VE`, {
      headers: h(admin.token),
      data: {
        activo: true,
        presupuesto: 5_000,
        reglas: { premio: 100, carreras: 10, dias: 30, topeMes: 10 },
      },
    });
    expect(p.ok(), await p.text()).toBe(true);

    // El enlace público del líder.
    const web = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    const pw = await web.newPage();
    // C-DOCS-SIN-DATOS-REALES: la captura pública no nombra ninguna ciudad (quien vive en otra
    // creería que ahí no sirve). La página ya sabe mostrarse sin ciudad.
    await pw.route('**/datos/publico/invitacion/*', async (ruta) => {
      const r = await ruta.fetch();
      const d = (await r.json()) as { invitacion: { ciudad: string | null } | null };
      if (d.invitacion) d.invitacion.ciudad = null;
      await ruta.fulfill({ response: r, json: d });
    });
    await pw.goto(`${idioma === 'es' ? '/es' : ''}/join/${codigo}`);
    await expect(pw.getByTestId('invitacion-codigo')).toHaveText(codigo, { timeout: 30_000 });
    if (CAPTURAS) {
      // Hasta donde termina la invitación: el pie del sitio (con su lista de ciudades) no va.
      const pie = await pw.locator('footer').first().boundingBox();
      const ancho = pw.viewportSize()?.width ?? 412;
      await pw.screenshot({
        path: join(CARPETA, `enlace-${idioma}.png`),
        ...(pie && pie.y > 200 ? { clip: { x: 0, y: 0, width: ancho, height: pie.y } } : {}),
      });
    }

    // Tres conductores se registran con el código del equipo.
    for (const nombre of C.miembros) {
      const m = await registrar('repartidor', nombre, { invitacion: codigo });
      sql(
        `INSERT OR IGNORE INTO repartidores (usuario_id, conectado, zona_id) VALUES ('${m.usuario.id}', 0, '${z.id}')`,
      );
    }
    expect(
      Number(
        sql(
          `SELECT COUNT(*) AS n FROM miembros_equipo m JOIN equipos e ON e.id = m.equipo_id WHERE e.codigo = '${codigo}'`,
        )[0]?.n,
      ),
    ).toBe(3);

    // El líder ve «Mi equipo» en su app.
    const ctxRep = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctxRep.addInitScript(
      ([pase, idi, cuentaId]) => {
        localStorage.setItem('tumbite.idioma', idi);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${cuentaId}`, '1');
      },
      [lider.token, idioma, lider.usuario.id] as const,
    );
    const pr = await ctxRep.newPage();
    // El QR y el enlace de la captura apuntan al sitio público con el código de ejemplo.
    await pr.route('**/datos/repartidor/invitaciones', async (ruta) => {
      const r = await ruta.fetch();
      const d = (await r.json()) as { equipo: { enlace: string } | null };
      if (d.equipo) d.equipo.enlace = C.enlace;
      await ruta.fulfill({ response: r, json: d });
    });
    await pr.goto('/driver');
    await pr
      .getByText(idioma === 'es' ? 'Perfil' : 'Profile', { exact: true })
      .last()
      .click();
    await pr
      .getByText(idioma === 'es' ? 'Mi equipo e invitaciones' : 'My team and invitations')
      .first()
      .click();
    const lideres = pr.getByTestId('mi-equipo-lider');
    await expect(lideres).toBeVisible({ timeout: 30_000 });
    await expect(lideres).toContainText(C.equipo);
    if (CAPTURAS)
      await pr
        .getByTestId('mi-equipo')
        .screenshot({ path: join(CARPETA, `driver-equipo-${idioma}.png`) });

    // El superadmin: los programas y el equipo con su ficha, su enlace y su QR.
    const { ruta } = (await (
      await request.get('/datos/admin/ruta', { headers: h(admin.token) })
    ).json()) as {
      ruta: string | null;
    };
    const panel = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await panel.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await panel.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
    const sp = await panel.newPage();
    await sp.goto(`/panel${ruta ? `/${ruta}` : ''}/referrals`);
    await expect(sp.getByTestId('programa-conductor-VE')).toBeVisible({ timeout: 30_000 });
    const sobra = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    if (CAPTURAS)
      await sp
        .getByTestId('programa-conductor-VE')
        .screenshot({ path: join(CARPETA, `super-programa-${idioma}.png`) });
    await sp.getByTestId('equipos-filtro').selectOption(z.id);
    const tabla = sp.getByTestId('equipos-tabla');
    await expect(tabla).toContainText(C.equipo);
    await tabla.getByRole('button').first().click();
    await expect(sp.getByTestId('equipo-ficha')).toContainText(codigo);
    if (CAPTURAS) {
      await sp
        .getByTestId('equipos-crear')
        .screenshot({ path: join(CARPETA, `super-crear-equipo-${idioma}.png`) });
      await tabla.screenshot({ path: join(CARPETA, `super-equipos-${idioma}.png`) });
      await sp
        .getByTestId('equipo-ficha')
        .screenshot({ path: join(CARPETA, `super-ficha-equipo-${idioma}.png`) });
    }
    // Se deja como estaba: el programa apagado.
    await request.put(`/datos/admin/referidos-programas/conductor/VE`, {
      headers: h(admin.token),
      data: {
        activo: false,
        presupuesto: 5_000,
        reglas: { premio: 100, carreras: 10, dias: 30, topeMes: 10 },
      },
    });
    await web.close();
    await ctxRep.close();
    await panel.close();
  });
}
