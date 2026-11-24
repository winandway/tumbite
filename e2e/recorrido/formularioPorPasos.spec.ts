import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Browser, type BrowserContext, type Page, expect, test } from './fixtures';
import { sinDesbordes } from './desbordes';
import { sqlLocal } from './sqlLocal';
import { TEXTOS } from './textos';

/**
 * C-FORMULARIO-POR-PASOS y C-DESBORDES-360 (24 nov 2026, orden de Richard; todos los países). Crear la
 * cuenta en la app de clientes y en Driver, pedir un envío de A a B y registrar la empresa de Flex van
 * por pasos, como Uber, DoorDash y Rappi. En cada paso, a 360 px de ancho: nada se sale de la pantalla
 * ni se parte una palabra; «Siguiente» sin llenar dice por qué no avanza y el error va al lado de su
 * casilla; y al recargar, la persona vuelve al mismo paso con lo que escribió (la contraseña, no).
 * Con CAPTURAS=1 guarda las fotos de Docs (docs/capturas/recorrido), con datos neutros y sin ciudades.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(STAGING, 'solo en esta computadora');
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
const CAPTURAS = process.env.CAPTURAS === '1' && !process.env.TIENDA;

async function foto(p: Page, nombre: string) {
  if (!CAPTURAS) return;
  const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
  mkdirSync(dir, { recursive: true });
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(dir, `${nombre}.png`) });
}

async function celular360(
  browser: Browser,
  idioma: 'es' | 'en',
  sesion?: { token: string },
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 760 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    baseURL: DATOS!.url,
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([i, s]) => {
      localStorage.setItem('tumbite.idioma', i as string);
      const token = s as string | null;
      if (token) localStorage.setItem('tumbite.sesion', token);
    },
    [idioma, sesion?.token ?? null] as const,
  );
  return ctx;
}

const ORIGEN = { lat: 25.7617, lng: -80.1918 };
const DESTINO = { lat: 25.79, lng: -80.13 };

// ─────────────────────────────── Crear la cuenta ───────────────────────────────
for (const idioma of ['es', 'en'] as const)
  for (const app of [
    { ruta: '/app/', nombre: 'cliente' },
    { ruta: '/driver/', nombre: 'repartidor' },
  ] as const)
    test(`crear la cuenta por pasos a 360 px: ${app.nombre} (${idioma})`, async ({ browser }) => {
      const L = TEXTOS[idioma];
      const en = idioma === 'en';
      const ctx = await celular360(browser, idioma);
      const p = await ctx.newPage();
      await p.goto(app.ruta);
      await p.getByText(L.appCrear).click();
      const form = '[data-testid="registro-por-pasos"]';
      await expect(p.locator(form)).toBeVisible({ timeout: 30_000 });

      // Paso 1: «Siguiente» vacío no avanza; dice por qué junto al botón y el error va a su lado.
      await expect(p.getByTestId('pasos-paso-nombre')).toBeVisible();
      await sinDesbordes(p, `${app.nombre} paso 1`, form);
      await p.getByTestId('pasos-siguiente').click();
      await expect(p.getByTestId('registro-revisar-casillas')).toBeVisible();
      await expect(p.getByText(en ? 'Enter your name.' : 'Escribe tu nombre.')).toBeVisible();
      await expect(p.getByTestId('pasos-paso-nombre')).toBeVisible();
      await sinDesbordes(p, `${app.nombre} paso 1 con error`, form);
      await foto(p, `pasos-registro-${app.nombre}-error-${idioma}`);
      await p.getByLabel(L.nombreCompleto).fill(en ? 'Jordan Lee' : 'Ana López');
      await expect(p.getByTestId('registro-revisar-casillas')).toHaveCount(0);
      // La foto de «Crear cuenta» de Docs (la misma que toma el recorrido completo).
      await foto(p, `${app.nombre}-registro-${idioma}`);
      await p.getByTestId('pasos-siguiente').click();

      // Paso 2: el correo, con su error al lado si está mal.
      await expect(p.getByTestId('pasos-paso-correo')).toBeVisible();
      await p.getByLabel(L.correo).fill(en ? 'email@' : 'correo@');
      await p.getByTestId('pasos-siguiente').click();
      await expect(p.getByTestId('registro-revisar-casillas')).toBeVisible();
      await sinDesbordes(p, `${app.nombre} paso 2 con error`, form);
      await p.getByLabel(L.correo).fill(en ? 'email@example.com' : 'correo@ejemplo.com');
      await sinDesbordes(p, `${app.nombre} paso 2`, form);
      await foto(p, `pasos-registro-${app.nombre}-2-${idioma}`);
      await p.getByTestId('pasos-siguiente').click();

      // Paso 3: el celular (opcional) y la casilla de los SMS.
      await expect(p.getByTestId('pasos-paso-celular')).toBeVisible();
      await p.getByRole('textbox', { name: L.celular, exact: true }).fill('3055550144');
      await sinDesbordes(p, `${app.nombre} paso 3`, form);
      await foto(p, `pasos-registro-${app.nombre}-3-${idioma}`);

      // Se cierra y se vuelve: el mismo paso, con lo escrito (borrador de siempre).
      await p.waitForTimeout(900);
      await p.reload();
      await expect(p.getByTestId('pasos-paso-celular')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByRole('textbox', { name: L.celular, exact: true })).toHaveValue(
        '3055550144',
      );
      await p.getByTestId('pasos-atras').click();
      await p.getByTestId('pasos-atras').click();
      await expect(p.getByLabel(L.nombreCompleto)).toHaveValue(en ? 'Jordan Lee' : 'Ana López');
      await p.getByTestId('pasos-siguiente').click();
      await p.getByTestId('pasos-siguiente').click();
      await p.getByTestId('pasos-siguiente').click();

      // Paso 4: la contraseña (con su ojito); corta, no avanza.
      await expect(p.getByTestId('pasos-paso-clave')).toBeVisible();
      await p.getByLabel(L.clave, { exact: true }).fill('corta');
      await p.getByTestId('pasos-siguiente').click();
      await expect(p.getByTestId('registro-revisar-casillas')).toBeVisible();
      await p.getByLabel(L.clave, { exact: true }).fill(DATOS!.clave);
      await sinDesbordes(p, `${app.nombre} paso 4`, form);
      await foto(p, `pasos-registro-${app.nombre}-4-${idioma}`);
      await p.getByTestId('pasos-siguiente').click();

      // Paso 5: sin marcar los términos, «Continuar» dice por qué junto al botón.
      await expect(p.getByTestId('pasos-paso-final')).toBeVisible();
      await p.getByTestId('registro-continuar').click();
      await expect(p.getByTestId('acceso-error')).toBeVisible();
      await sinDesbordes(p, `${app.nombre} paso 5 con error`, form);
      await p.getByTestId('registro-acepto').click();
      await expect(p.getByTestId('acceso-error')).toHaveCount(0);
      await sinDesbordes(p, `${app.nombre} paso 5`, form);
      await foto(p, `pasos-registro-${app.nombre}-5-${idioma}`);

      // Y recién entonces, «Revisa tus datos» (la cuenta todavía no existe: no se crea aquí).
      await p.getByTestId('registro-continuar').click();
      await expect(p.getByTestId('revisa-tus-datos')).toBeVisible();
      await sinDesbordes(p, `${app.nombre} revisa tus datos`);
      await ctx.close();
    });

// ───────────────────── Pedir un envío de A a B y registrar la empresa ─────────────────────
test.describe('Envíos y Flex por pasos', () => {
  test.afterAll(() => {
    if (STAGING) return;
    sqlLocal(`UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id = 'envios'`);
    sqlLocal(`UPDATE servicios SET estado = 'proximamente' WHERE id = 'envios'`);
    sqlLocal(`DELETE FROM servicios_implementados WHERE servicio_id = 'envios'`);
  });

  for (const idioma of ['es', 'en'] as const)
    test(`pedir un envío por pasos a 360 px (${idioma})`, async ({ browser, request }) => {
      test.setTimeout(180_000);
      const en = idioma === 'en';
      const id = `${Date.now().toString(36)}${idioma}`;
      const cuenta = async (nombre: string) => {
        const r = await request.post('/datos/cuentas/registro', {
          headers: { 'cf-connecting-ip': `10.93.${Math.floor(Math.random() * 250)}.${id.length}` },
          data: {
            nombre,
            correo: `pasos.${nombre.split(' ')[0]?.toLowerCase()}.${id}@recorrido.test`,
            clave: DATOS!.clave,
            rol: 'cliente',
          },
        });
        expect(r.ok(), await r.text()).toBe(true);
        return (await r.json()) as { token: string; usuario: { id: string } };
      };
      // El equipo enciende Envíos con una tarifa de prueba (como envios.spec.ts).
      const admin = await cuenta('Soporte Pasos');
      sqlLocal(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
      sqlLocal(
        `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('envios', 1)`,
      );
      sqlLocal(`UPDATE servicios SET estado = 'disponible' WHERE id = 'envios'`);
      sqlLocal(
        `UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'envios' AND zona_id = 'US-FL-MIAMI'`,
      );
      const tarifa = await request.post('/datos/admin/viajes/tarifas', {
        headers: { authorization: `Bearer ${admin.token}` },
        data: {
          servicio: 'envios',
          zona: 'US-FL-MIAMI',
          tarifa: { base: 200, porKm: 90, porMinuto: 10, minimo: 600 },
          dePrueba: true,
          motivo: 'Tarifa de prueba',
        },
      });
      expect(tarifa.ok(), await tarifa.text()).toBe(true);

      const cli = await cuenta('Paula Envía');
      // El destino, de sus lugares guardados (sin internet no hay sugerencias de Google); la
      // recogida, su ubicación de ahora.
      const lugar = await request.post('/datos/mis-direcciones', {
        headers: { authorization: `Bearer ${cli.token}` },
        data: {
          etiqueta: en ? 'Work' : 'Trabajo',
          direccion: en ? '2500 Oak Avenue' : 'Avenida Los Robles 2500',
          lat: DESTINO.lat,
          lng: DESTINO.lng,
          instrucciones: '',
        },
      });
      expect(lugar.ok(), await lugar.text()).toBe(true);
      const ctx = await celular360(browser, idioma, { token: cli.token });
      const p = await ctx.newPage();
      await p.goto('/app/ride?servicio=envios');
      const caja = '[data-testid="pedir-viaje"]';

      // Paso 1: la ruta.
      await expect(p.getByTestId('pasos-paso-ruta')).toBeVisible({ timeout: 30_000 });
      await p.getByTestId('lugar-trabajo').click();
      await expect(p.getByTestId('moto-destino')).toContainText(en ? '2500 Oak Avenue' : 'Avenida');
      await sinDesbordes(p, 'envío paso 1', caja);
      await foto(p, `pasos-envio-1-${idioma}`);
      await p.getByTestId('envio-siguiente').click();

      // Paso 2: el paquete. Vacío no avanza; el error va al lado de su casilla.
      await expect(p.getByTestId('pasos-paso-paquete')).toBeVisible();
      await p.getByTestId('envio-siguiente').click();
      await expect(p.getByTestId('envio-por-que')).toBeVisible();
      await expect(
        p.getByText(en ? 'Tell us what you’re sending.' : 'Escribe qué envías.'),
      ).toBeVisible();
      await expect(p.getByTestId('envio-prohibidos-error')).toBeVisible();
      await sinDesbordes(p, 'envío paso 2 con error', caja);
      await foto(p, `pasos-envio-error-${idioma}`);
      await p.getByTestId('envio-que').fill(en ? 'A set of keys' : 'Unas llaves');
      await p.getByTestId('envio-prohibidos').click();
      await expect(p.getByTestId('envio-por-que')).toHaveCount(0);
      await sinDesbordes(p, 'envío paso 2', caja);
      await foto(p, `pasos-envio-2-${idioma}`);
      await p.getByTestId('envio-siguiente').click();

      // Paso 3: quién lo recibe.
      await expect(p.getByTestId('pasos-paso-recibe')).toBeVisible();
      await p.getByTestId('envio-siguiente').click();
      await expect(p.getByTestId('envio-por-que')).toBeVisible();
      await p.getByTestId('envio-recibe-nombre').fill(en ? 'Sam Rivera' : 'Lucía Torres');
      await p.getByTestId('envio-recibe-celular').fill('3055550177');
      await sinDesbordes(p, 'envío paso 3', caja);
      await foto(p, `pasos-envio-3-${idioma}`);

      await p.getByTestId('envio-siguiente').click();

      // Paso 4: precio y pago, con «Atrás» y el botón de pedir.
      await expect(p.getByTestId('pasos-paso-pagar')).toBeVisible();
      await expect(p.getByTestId('moto-precio')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('pedir-boton')).toBeVisible();
      await expect(p.getByTestId('pasos-atras')).toBeVisible();
      await sinDesbordes(p, 'envío paso 4', caja);
      await foto(p, `pasos-envio-4-${idioma}`);

      // Se cierra y se vuelve: el mismo paso, con lo escrito.
      await p.getByTestId('pasos-atras').click();
      await expect(p.getByTestId('pasos-paso-recibe')).toBeVisible();
      await p.waitForTimeout(900);
      await p.reload();
      await expect(p.getByTestId('pasos-paso-recibe')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('envio-recibe-nombre')).toHaveValue(
        en ? 'Sam Rivera' : 'Lucía Torres',
      );
      await ctx.close();

      // Divoox Flex: registrar la empresa por pasos (sin crearla).
      const ctx2 = await celular360(browser, idioma, { token: cli.token });
      const q = await ctx2.newPage();
      await q.goto('/app/business');
      await q.getByText(en ? 'Register my company' : 'Registrar mi empresa').click();
      const form = '[data-testid="empresa-por-pasos"]';
      await expect(q.getByTestId('pasos-paso-empresa')).toBeVisible({ timeout: 30_000 });
      await sinDesbordes(q, 'empresa paso 1', form);
      await q.getByTestId('pasos-siguiente').click();
      await expect(q.getByTestId('pasos-por-que')).toBeVisible();
      await expect(
        q.getByText(en ? 'Fill in this field.' : 'Completa esta casilla.').first(),
      ).toBeVisible();
      await sinDesbordes(q, 'empresa paso 1 con error', form);
      await q
        .getByLabel(en ? 'Business name' : 'Nombre comercial')
        .fill(en ? 'Sample Shop' : 'Tienda Ejemplo');
      await q
        .getByLabel(
          en ? 'Legal name (as on its documents)' : 'Razón social (como aparece en sus papeles)',
        )
        .fill(en ? 'Sample Shop LLC' : 'Tienda Ejemplo LLC');
      await q.getByTestId('pasos-siguiente').click();
      await expect(q.getByTestId('pasos-paso-legal')).toBeVisible();
      await sinDesbordes(q, 'empresa paso 2', form);
      await q.getByTestId('pasos-siguiente').click();
      await expect(q.getByTestId('pasos-por-que')).toBeVisible();
      await sinDesbordes(q, 'empresa paso 2 con error', form);
      await ctx2.close();
    });
});
