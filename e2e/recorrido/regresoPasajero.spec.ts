import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, expect, test } from './fixtures';
import { sinDesbordes } from './desbordes';
import { sqlLocal } from './sqlLocal';

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países), prueba de aceptación 12 de la ficha, en el
 * recorrido de esta computadora: un conductor de Carro termina lejos de su ciudad base, ve «Voy de
 * regreso a <ciudad>», lo enciende y, cuando un pasajero pide un viaje en ese sentido, la oferta le
 * llega PRIMERO a él aunque otro conductor esté más cerca (a menos de 3 km de diferencia). Con
 * CAPTURAS=1 deja las fotos de Docs (360 px, ciudad de ejemplo, sin datos reales).
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
const sql = sqlLocal;

const ORIGEN = { lat: 25.7617, lng: -80.1918 };
/** El viaje del pasajero: 15 km hacia el norte, en el rumbo de la ciudad base del conductor. */
const HACIA_CASA = { lat: 25.8967, lng: -80.1918 };
const KM = 1 / 111.2;
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
  sql(`UPDATE modo_destino SET activo = 0 WHERE tipo = 'regreso'`);
});

async function foto(p: Page, nombre: string, idioma: 'es' | 'en') {
  await p.evaluate(() => document.fonts.ready.then(() => true));
  await p.waitForTimeout(400);
  if (!CAPTURAS) return;
  // Docs públicos sin ciudades ni calles reales (C-DOCS-SIN-DATOS-REALES): el mapa va desenfocado.
  await p.addStyleTag({ content: '.leaflet-tile-pane { filter: blur(7px); }' });
  await p.waitForTimeout(200);
  const dir = join(RAIZ, 'docs', 'capturas', 'recorrido');
  mkdirSync(dir, { recursive: true });
  await p.screenshot({ path: join(dir, `${nombre}-${idioma}.png`) });
}

for (const idioma of ['es', 'en'] as const)
  test(`regreso con pasajero: tarjeta, encendido y la oferta primero (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(240_000);
    const en = idioma === 'en';
    const id = `${Date.now().toString(36)}${idioma}`;
    // Una ciudad de ejemplo (nada real en las capturas públicas), ~60 km al norte.
    const base = {
      id: `XX-REGRESO-${id}`.toUpperCase(),
      nombre: en ? 'Sample City' : 'Ciudad Ejemplo',
    };
    sql(`INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
         VALUES ('${base.id}', '${base.nombre}', 'US', 'USD', 'America/New_York', 26.3, -80.19, 20, 0)`);
    let ip = 0;
    const cuenta = async (rol: string, nombre: string) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.97.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo: `regreso.${rol}.${ip}.${id}@recorrido.test`,
          clave: DATOS!.clave,
          rol: rol === 'admin' ? 'cliente' : rol,
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return (await r.json()) as { token: string; usuario: { id: string } };
    };
    const h = (tk: string) => ({ authorization: `Bearer ${tk}` });
    const admin = await cuenta('admin', 'Soporte Regreso');
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
    sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = 'US-FL-MIAMI'`);
    sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'carro'`);

    /** Un conductor de Carro en regla, conectado en `donde`, con su ciudad base al norte. */
    const conductor = async (nombre: string, donde: { lat: number; lng: number }) => {
      const cond = await cuenta('repartidor', nombre);
      const c = cond.usuario.id;
      const v = `veh-regreso-${ip}-${id}`;
      sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id, zona_base_id)
           VALUES ('${c}', 1, ${donde.lat}, ${donde.lng}, datetime('now'), 'US-FL-MIAMI', '${base.id}')
           ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng,
             ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id, zona_base_id = excluded.zona_base_id`);
      sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
           VALUES ('${v}', '${c}', 'carro', 'Toyota', 'Corolla', 'Gris', 'R${Math.random().toString(36).slice(2, 8).toUpperCase()}', 'FL', 2022, 4, 'aprobado')`);
      for (const d of ['registro', 'seguro', 'seguro_pasajeros'])
        sql(
          `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${d}-${ip}-${id}', '${v}', '${d}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
        );
      sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
      sql(
        `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', 'carro', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
      );
      sql(
        `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', 'carro', 1)`,
      );
      return cond;
    };
    // El de la app, a 2 km de la recogida; luego entra otro a 0,3 km (más cerca).
    const yo = await conductor(en ? 'Jordan Lee' : 'Ana López', {
      lat: ORIGEN.lat - 2 * KM,
      lng: ORIGEN.lng,
    });

    const ctx = await browser.newContext({
      viewport: { width: 360, height: 760 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: en ? 'en-US' : 'es-US',
      baseURL: DATOS!.url,
      geolocation: { latitude: ORIGEN.lat - 2 * KM, longitude: ORIGEN.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([i, pase, uid]) => {
        localStorage.setItem('tumbite.idioma', i as string);
        localStorage.setItem('tumbite.sesion', pase as string);
        localStorage.setItem(`divoox.permisos.${uid as string}`, '1');
      },
      [idioma, yo.token, yo.usuario.id] as const,
    );
    const p = await ctx.newPage();
    await p.goto('/driver');
    await expect(p.getByTestId('hoja-inicio')).toBeVisible({ timeout: 30_000 });

    // La tarjeta: lejos de su ciudad base, con el botón «Voy de regreso a …».
    const tarjeta = p.getByTestId('regreso-a-casa');
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    const boton = p.getByTestId('regreso-encender');
    await expect(boton).toContainText(
      en ? `Heading home to ${base.nombre}` : `Voy de regreso a ${base.nombre}`,
    );
    await expect(tarjeta).not.toContainText(/Pronto|Coming soon/i);
    await tarjeta.scrollIntoViewIfNeeded();
    await sinDesbordes(p, `tarjeta de regreso (${idioma})`);
    await foto(p, 'driver-regreso-tarjeta', idioma);

    // Encendido: «Vas de regreso a …», con «Apagar».
    await boton.click();
    await expect(p.getByTestId('regreso-activo')).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('regreso-apagar')).toBeVisible();
    await p.getByTestId('regreso-a-casa').scrollIntoViewIfNeeded();
    await sinDesbordes(p, `regreso encendido (${idioma})`);
    await foto(p, 'driver-regreso-encendido', idioma);

    // Otro conductor más cerca de la recogida; el pasajero pide un viaje hacia la ciudad base.
    const otro = await conductor('Conductor Cercano', {
      lat: ORIGEN.lat - 0.3 * KM,
      lng: ORIGEN.lng,
    });
    const cli = await cuenta('cliente', en ? 'Sam Rider' : 'Pasajera');
    const cot = await request.post('/datos/viajes/cotizar', {
      headers: h(cli.token),
      // Direcciones de ejemplo en el idioma de la captura (C-CAPTURAS-POR-IDIOMA).
      data: {
        servicio: 'carro',
        origen: { ...ORIGEN, direccion: en ? 'Central Plaza' : 'Plaza Central' },
        destino: { ...HACIA_CASA, direccion: en ? '400 North Avenue' : 'Avenida Norte 400' },
      },
    });
    expect(cot.ok(), await cot.text()).toBe(true);
    const cotizacion = ((await cot.json()) as { cotizacion: { id: string } }).cotizacion;
    const pedido = await request.post('/datos/viajes', {
      headers: h(cli.token),
      data: { cotizacionId: cotizacion.id, metodoPago: 'efectivo' },
    });
    expect(pedido.ok(), await pedido.text()).toBe(true);
    const viaje = ((await pedido.json()) as { viaje: { id: string } }).viaje.id;
    // La oferta le llega PRIMERO a quien va de regreso, no al más cercano.
    await expect
      .poll(
        () =>
          sql(
            `SELECT conductor_id FROM ofertas_operacion WHERE operacion_id = '${viaje}' ORDER BY creada_en LIMIT 1`,
          )[0]?.conductor_id ?? null,
        { timeout: 60_000, message: 'la primera oferta va al conductor que va de regreso' },
      )
      .toBe(yo.usuario.id);
    expect(otro.usuario.id).not.toBe(yo.usuario.id);
    await expect(p.getByTestId('oferta-viaje')).toBeVisible({ timeout: 30_000 });
    await sinDesbordes(p, `oferta de regreso (${idioma})`);
    await foto(p, 'driver-regreso-oferta', idioma);
    await ctx.close();
  });
