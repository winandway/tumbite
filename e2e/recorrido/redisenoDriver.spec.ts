import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Browser, type Page, expect, test } from './fixtures';
import { sinDesbordes } from './desbordes';
import { deslizar } from './deslizar';
import { sqlLocal } from './sqlLocal';

/**
 * C-REDISENO-DRIVER y C-DESBORDES-360 (24 nov 2026, borrador aprobado por Richard; todos los países).
 * Divoox Driver con el diseño nuevo, en tres tamaños: el celular más angosto (360 px), el más grande
 * (430 px, como un iPhone Pro Max o un Android grande) y una tableta (820 px). En cada pantalla clave
 * (inicio desconectado con la barra de activación, inicio conectado, la oferta, el viaje en curso con
 * el código, la cuenta, ganancias, avisos y seguridad):
 *  - está la pieza nueva del rediseño (hoja de abajo, barra de cuatro lugares, etiqueta del servicio…);
 *  - nada se sale de la pantalla ni se parte una palabra;
 *  - lo de arriba no queda debajo de la isla ni de la barra de estado (zona segura);
 *  - en tableta el contenido no se estira de borde a borde (columna de 600 px como máximo).
 * Las fotos quedan en Documentos › Entregas › Divoox › rediseno-driver-borrador › construido y, con
 * CAPTURAS=1, las de Docs en docs/capturas/recorrido (datos neutros, sin ciudades).
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
const ENTREGA = join(
  homedir(),
  'Documents',
  'Entregas',
  'Divoox',
  'rediseno-driver-borrador',
  'construido',
);

const TAMANOS = [
  { nombre: '360', width: 360, height: 760, movil: true, arriba: 24 },
  { nombre: '430', width: 430, height: 932, movil: true, arriba: 59 },
  { nombre: 'tableta', width: 820, height: 1180, movil: false, arriba: 24 },
] as const;
type Tamano = (typeof TAMANOS)[number];

const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Plaza Central' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Avenida Principal 120' };
const sql = sqlLocal;

const REQUISITOS_CARRO = `INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES
  ('carro', 'identidad', 1), ('carro', 'antecedentes_pasajeros', 1), ('carro', 'historial_manejo', 1),
  ('carro', 'licencia', 1), ('carro', 'edad_minima_21', 1), ('carro', 'seguro_pasajeros', 1),
  ('carro', 'inspeccion_vehiculo', 1)`;

test.afterAll(() => {
  if (STAGING) return;
  sql(REQUISITOS_CARRO);
  sql(`UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id = 'carro'`);
  sql(`UPDATE servicios SET estado = 'proximamente' WHERE id = 'carro'`);
  sql(`DELETE FROM servicios_implementados WHERE servicio_id = 'carro'`);
});

async function abrir(
  browser: Browser,
  t: Tamano,
  idioma: 'es' | 'en',
  sesion: { token: string; id: string },
) {
  const ctx = await browser.newContext({
    viewport: { width: t.width, height: t.height },
    deviceScaleFactor: 2,
    isMobile: t.movil,
    hasTouch: true,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    baseURL: DATOS!.url,
    geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([i, pase, id]) => {
      localStorage.setItem('tumbite.idioma', i as string);
      localStorage.setItem('tumbite.sesion', pase as string);
      localStorage.setItem(`divoox.permisos.${id as string}`, '1');
    },
    [idioma, sesion.token, sesion.id] as const,
  );
  const p = await ctx.newPage();
  // La isla dinámica y los bordes curvos: la zona segura de arriba la da el navegador como
  // `safe-area-inset-top`; aquí se simula con el relleno que pone SafeAreaView en la web.
  await p.addInitScript((arriba) => {
    document.documentElement.style.setProperty('--zona-arriba', `${arriba}px`);
  }, t.arriba);
  return { ctx, p };
}

async function foto(p: Page, t: Tamano, nombre: string, idioma: 'es' | 'en', docs?: string) {
  await p.evaluate(() => document.fonts.ready.then(() => true));
  await p.waitForTimeout(400);
  mkdirSync(ENTREGA, { recursive: true });
  await p.screenshot({ path: join(ENTREGA, `${t.nombre}-${nombre}-${idioma}.png`) });
  if (CAPTURAS && docs && t.nombre === '360') {
    const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
    mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: join(dir, `${docs}-${idioma}.png`) });
  }
}

/** En tableta, lo de adentro no pasa de 600 px de ancho (nada estirado de borde a borde). */
async function sinEstirar(p: Page, t: Tamano, testID: string) {
  if (t.width < 768) return;
  const caja = await p.getByTestId(testID).first().boundingBox();
  expect(caja, `${testID} en tableta`).not.toBeNull();
  expect(caja!.width, `${testID} se estira en tableta`).toBeLessThanOrEqual(602);
}

async function revisar(p: Page, t: Tamano, donde: string) {
  await sinDesbordes(p, `${donde} a ${t.nombre}`);
}

for (const idioma of ['es', 'en'] as const)
  for (const t of TAMANOS)
    test(`Driver rediseñado: registro sin terminar, cuenta, ganancias y avisos (${t.nombre}, ${idioma})`, async ({
      browser,
      request,
    }) => {
      test.setTimeout(180_000);
      const en = idioma === 'en';
      const id = `${Date.now().toString(36)}${t.nombre}${idioma}`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.94.${Math.floor(Math.random() * 250)}.${id.length}` },
        data: {
          nombre: en ? 'Jordan Lee' : 'Ana López',
          correo: `rediseno.${id}@recorrido.test`,
          clave: DATOS!.clave,
          rol: 'repartidor',
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const cuenta = (await r.json()) as { token: string; usuario: { id: string } };
      const { ctx, p } = await abrir(browser, t, idioma, {
        token: cuenta.token,
        id: cuenta.usuario.id,
      });
      await p.goto('/driver');

      // Inicio: el mapa entero, la hoja de abajo, el escudo, lo ganado hoy y el modo destino.
      await expect(p.getByTestId('hoja-inicio')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('driver-estado-desconectado')).toBeVisible();
      await expect(p.getByTestId('escudo-seguridad')).toBeVisible();
      await expect(p.getByTestId('pildora-ganancias')).toBeVisible();
      await expect(p.getByTestId('boton-modo-destino')).toBeVisible();
      await expect(p.getByTestId('pestana-avisos')).toBeVisible();
      await expect(p.getByTestId('pestana-cuenta')).toBeVisible();
      // Zona segura: el escudo no queda pegado arriba (ni bajo la isla).
      const escudo = await p.getByTestId('escudo-seguridad').boundingBox();
      expect(escudo!.y).toBeGreaterThanOrEqual(8);
      await sinEstirar(p, t, 'hoja-inicio');
      await revisar(p, t, 'inicio sin terminar el registro');
      await foto(p, t, '01-inicio-registro', idioma, 'driver-rediseno-inicio');

      // Modo destino desde la bandera.
      await p.getByTestId('boton-modo-destino').click();
      await expect(p.getByTestId('hoja-modo-destino')).toBeVisible();
      await foto(p, t, '02-modo-destino', idioma);
      await p
        .getByRole('button', { name: en ? 'Close' : 'Cerrar' })
        .last()
        .click();

      // Cuenta: cabecera de perfil y filas.
      await p.getByTestId('pestana-cuenta').click();
      await expect(p.getByTestId('cuenta-driver')).toBeVisible();
      await expect(p.getByTestId('cuenta-papeles')).toBeVisible();
      await expect(p.getByTestId('cuenta-idioma')).toBeVisible();
      await sinEstirar(p, t, 'cuenta-lista-trabajo');
      await revisar(p, t, 'cuenta');
      await foto(p, t, '03-cuenta', idioma, 'driver-rediseno-cuenta');

      // Seguridad desde la cuenta: «Desliza para emergencias».
      await p.getByTestId('cuenta-seguridad').click();
      await expect(p.getByTestId('cabecera-titulo')).toHaveText(en ? 'Safety' : 'Seguridad');
      await revisar(p, t, 'seguridad');
      await foto(p, t, '04-seguridad', idioma, 'driver-rediseno-seguridad');
      await p.getByTestId('cabecera-volver').click();
      await expect(p.getByTestId('cuenta-driver')).toBeVisible();

      // Avisos: con su cabecera; abrirla deja la campana en cero.
      await p.getByTestId('pestana-avisos').click();
      await expect(p.getByTestId('cabecera-titulo')).toHaveText(en ? 'Inbox' : 'Avisos');
      await revisar(p, t, 'avisos');
      await foto(p, t, '05-avisos', idioma);

      // Ganancias.
      await p.getByTestId('pestana-ganancias').click();
      await expect(p.getByTestId('cabecera-titulo')).toHaveText(en ? 'Earnings' : 'Ganancias');
      await revisar(p, t, 'ganancias');
      await foto(p, t, '06-ganancias', idioma, 'driver-rediseno-ganancias');
      await ctx.close();
    });

for (const idioma of ['es', 'en'] as const)
  for (const t of TAMANOS)
    test(`Driver rediseñado: conectado, oferta y viaje en curso (${t.nombre}, ${idioma})`, async ({
      browser,
      request,
    }) => {
      test.setTimeout(240_000);
      const en = idioma === 'en';
      const id = `${Date.now().toString(36)}${t.nombre}${idioma}`;
      let ip = 0;
      const cuenta = async (rol: string, nombre: string) => {
        const r = await request.post('/datos/cuentas/registro', {
          headers: { 'cf-connecting-ip': `10.96.${Math.floor(Math.random() * 250)}.${++ip}` },
          data: {
            nombre,
            correo: `rediseno.${rol}.${id}@recorrido.test`,
            clave: DATOS!.clave,
            rol: rol === 'admin' ? 'cliente' : rol,
          },
        });
        expect(r.ok(), await r.text()).toBe(true);
        return (await r.json()) as { token: string; usuario: { id: string } };
      };
      const h = (tk: string) => ({ authorization: `Bearer ${tk}` });
      const admin = await cuenta('admin', 'Soporte Rediseno');
      sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
      sql(REQUISITOS_CARRO);
      sql(
        `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('carro', 1)`,
      );
      sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'`);
      sql(
        `UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'carro' AND zona_id = 'US-FL-MIAMI'`,
      );
      const tarifa = await request.post('/datos/admin/viajes/tarifas', {
        headers: h(admin.token),
        data: {
          servicio: 'carro',
          zona: 'US-FL-MIAMI',
          tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 800 },
          dePrueba: true,
          motivo: 'Tarifa de prueba',
        },
      });
      expect(tarifa.ok(), await tarifa.text()).toBe(true);
      const cond = await cuenta('repartidor', en ? 'Jordan Lee' : 'Ana López');
      const c = cond.usuario.id;
      const v = `veh-rediseno-${id}`;
      sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = 'US-FL-MIAMI'`);
      sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'carro'`);
      sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${ORIGEN.lat}, ${ORIGEN.lng}, datetime('now'), 'US-FL-MIAMI')
       ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
      sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
       VALUES ('${v}', '${c}', 'carro', 'Toyota', 'Corolla', 'Gris', 'R${Math.random().toString(36).slice(2, 8).toUpperCase()}', 'FL', 2022, 4, 'aprobado')`);
      for (const d of ['registro', 'seguro', 'seguro_pasajeros'])
        sql(
          `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${d}-${id}', '${v}', '${d}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
        );
      sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
      sql(
        `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', 'carro', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
      );
      sql(
        `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', 'carro', 1)`,
      );

      const { ctx, p } = await abrir(browser, t, idioma, { token: cond.token, id: c });
      await p.goto('/driver');
      await expect(p.getByTestId('hoja-inicio')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('driver-estado-conectado')).toBeVisible({ timeout: 30_000 });
      await sinEstirar(p, t, 'hoja-inicio');
      await revisar(p, t, 'inicio conectado');
      await foto(p, t, '07-inicio-conectado', idioma, 'driver-rediseno-conectado');

      // La oferta: etiqueta del servicio, reloj, lo que gana en verde, tres datos y la ruta.
      const cli = await cuenta('cliente', 'Pasajera');
      const cot = await request.post('/datos/viajes/cotizar', {
        headers: h(cli.token),
        data: { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      });
      expect(cot.ok(), await cot.text()).toBe(true);
      const cotizacion = ((await cot.json()) as { cotizacion: { id: string } }).cotizacion;
      const pedido = await request.post('/datos/viajes', {
        headers: h(cli.token),
        data: { cotizacionId: cotizacion.id, metodoPago: 'efectivo' },
      });
      expect(pedido.ok(), await pedido.text()).toBe(true);
      expect(((await pedido.json()) as { viaje: { id: string } }).viaje.id).toBeTruthy();
      await expect(p.getByTestId('oferta-viaje')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('etiqueta-servicio')).toBeVisible();
      await expect(p.getByTestId('datos-tres')).toBeVisible();
      await expect(p.getByTestId('ruta-driver')).toBeVisible();
      await sinEstirar(p, t, 'oferta-viaje');
      await revisar(p, t, 'oferta de viaje');
      await foto(p, t, '08-oferta-viaje', idioma, 'driver-rediseno-oferta');
      await p.getByTestId('oferta-aceptar').click();

      // Ir a recoger: la barra de tres pasos y la hoja de abajo.
      await expect(p.getByTestId('barra-pasos')).toBeVisible({ timeout: 30_000 });
      await revisar(p, t, 'ir a recoger');
      await foto(p, t, '09-ir-a-recoger', idioma, 'driver-rediseno-recoger');

      // Llegué: el código del pasajero. La oferta que aceptó puede ser un viaje de una corrida anterior
      // que nadie tomó: se usa el que quedó asignado a este conductor.
      const op = String(
        sql(
          `SELECT id FROM operaciones WHERE conductor_id = '${c}' AND estado_general IN ('asignada', 'en_curso')`,
        )[0]?.id ?? '',
      );
      expect(op).not.toBe('');
      const llegue = await request.post(`/datos/conductor/operaciones/${op}/llegue`, {
        headers: { ...h(cond.token), 'idempotency-key': `rediseno-llegue-${id}` },
        data: {},
      });
      expect(llegue.status()).toBe(200);
      await expect(p.getByTestId('viaje-pin')).toBeVisible({ timeout: 30_000 });
      // C-CODIGO-A-LA-VISTA: el aviso grande y la casilla arriba, sin bajar, y con el teclado abierto
      // (se simula quitándole a la pantalla el alto de un teclado de teléfono).
      await expect(p.getByTestId('codigo-a-la-vista-titulo')).toHaveText(
        en ? 'Ask your rider for their code' : 'Pídele el código al pasajero',
      );
      await expect(p.getByTestId('viaje-pin')).toBeInViewport();
      if (t.movil) {
        await p.setViewportSize({ width: t.width, height: t.height - 330 });
        await p.getByTestId('viaje-pin').focus();
        // Como hace el teléfono al abrir el teclado: lo enfocado queda a la vista.
        await p
          .getByTestId('codigo-a-la-vista')
          .evaluate((el) => el.scrollIntoView({ block: 'end' }));
        await expect(p.getByTestId('viaje-pin')).toBeInViewport({ ratio: 1 });
        await expect(p.getByTestId('codigo-a-la-vista-titulo')).toBeInViewport();
        await revisar(p, t, 'código con el teclado abierto');
        await foto(p, t, '11-codigo-teclado', idioma, 'driver-codigo-a-la-vista');
        await p.setViewportSize({ width: t.width, height: t.height });
      }
      // Un código equivocado: el servidor lo rechaza y el aviso dice cuántos intentos quedan.
      if (t.nombre === '360') {
        const actual = await request.get('/datos/viajes/actual', { headers: h(cli.token) });
        const pin = ((await actual.json()) as { viaje: { pin: string } }).viaje.pin;
        await p.getByTestId('viaje-pin').fill(pin === '0000' ? '1111' : '0000');
        await deslizar(p, 'viaje-iniciar');
        await expect(p.getByTestId('codigo-a-la-vista-intentos')).toHaveText(
          en ? '4 attempts left.' : 'Te quedan 4 intentos.',
          { timeout: 20_000 },
        );
        await p.getByTestId('codigo-a-la-vista').scrollIntoViewIfNeeded();
        await foto(p, t, '12-codigo-equivocado', idioma, 'driver-codigo-equivocado');
      }
      await revisar(p, t, 'esperando al pasajero');
      await foto(p, t, '10-codigo', idioma, 'driver-rediseno-codigo');
      // C-CHAT-VIAJE-LLEGA: el pasajero escribe y el conductor lo ve arriba, sin abrir nada; al abrir
      // el chat el número baja a cero. Y al revés: el pasajero ve en su app lo que escribió el conductor.
      if (t.nombre === '360') {
        const escribe = (tk: string, texto: string) =>
          request.post(`/datos/viajes/${op}/mensajes`, { headers: h(tk), data: { texto } });
        expect((await escribe(cli.token, en ? 'Coming out now' : 'Ya salgo')).ok()).toBe(true);
        await expect(p.getByTestId('chat-viaje-sin-leer')).toHaveText('1', { timeout: 20_000 });
        await expect(p.getByTestId('chat-viaje-ultimo')).toContainText(
          en ? 'Coming out now' : 'Ya salgo',
        );
        await p.getByTestId('tarjeta-chat-viaje').scrollIntoViewIfNeeded();
        await revisar(p, t, 'mensaje nuevo del pasajero');
        await foto(p, t, '13-chat-sin-leer', idioma, 'driver-chat-sin-leer');
        await p.getByTestId('tarjeta-chat-viaje').click();
        await expect(p.getByTestId('chat-viaje-sin-leer')).toHaveCount(0, { timeout: 20_000 });
        expect(
          (await escribe(cond.token, en ? 'I’m in the gray car' : 'Estoy en el carro gris')).ok(),
        ).toBe(true);
        const pc = await ctx.newPage();
        await pc.addInitScript((pase) => localStorage.setItem('tumbite.sesion', pase), cli.token);
        await pc.goto(`/app/ride?servicio=carro&viaje=${op}`);
        await expect(pc.getByTestId('chat-viaje-ultimo')).toContainText(
          en ? 'I’m in the gray car' : 'Estoy en el carro gris',
          { timeout: 30_000 },
        );
        await expect(pc.getByTestId('chat-viaje-sin-leer')).toHaveText('1');
        await pc
          .getByTestId('tarjeta-chat-viaje')
          .evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await revisar(pc, t, 'mensaje nuevo del conductor en la app de clientes');
        await foto(pc, t, '14-chat-pasajero', idioma, 'cliente-chat-viaje-sin-leer');
      }
      await ctx.close();
    });
