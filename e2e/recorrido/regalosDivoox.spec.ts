import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * C-CUPON-DIVOOX (17 nov 2026): el regalo que paga Divoox en las apps web de verdad. El equipo crea el
 * cupón (nace apagado) y lo enciende; el pasajero agrega el código, ve el precio tachado y paga en
 * mano solo la diferencia; el conductor ve «Cobra X · Divoox te paga Y»; el superadmin ve el gasto en
 * vivo. En español con El Vigía y en inglés con Novi (C-CAPTURAS-POR-IDIOMA). Solo en esta computadora.
 * Con CAPTURAS=1 guarda las capturas de Docs (docs/capturas/regalos-divoox/).
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
const CARPETA = join(RAIZ, 'docs', 'capturas', 'regalos-divoox');
if (CAPTURAS) mkdirSync(CARPETA, { recursive: true });
const sql = sqlLocal;

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
    codigo: 'VIGIA',
    nombreEs: 'Regalo de bienvenida El Vigía',
    nombreEn: 'El Vigía welcome gift',
    recogida: { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar, El Vigía' },
    destino: { lat: 8.6345, lng: -71.6611, direccion: 'Terminal de pasajeros, El Vigía' },
    pasajero: 'María Pasajera',
    conductor: 'José Conductor',
    telefono: '+584145550123',
    textos: {
      verPrecio: 'Ver precio',
      tienesCodigo: '¿Tienes un código de regalo?',
      agregar: 'Agregar',
      pedir: 'Pedir Moto',
    },
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
    codigo: 'NOVIRIDE',
    nombreEs: 'Regalo de bienvenida Novi',
    nombreEn: 'Novi welcome gift',
    recogida: { lat: 42.4806, lng: -83.4755, direccion: '26000 Novi Rd, Novi, MI' },
    destino: { lat: 42.4935, lng: -83.4612, direccion: '27500 Novi Rd, Novi, MI' },
    pasajero: 'Emily Rider',
    conductor: 'Michael Driver',
    telefono: '+12485550123',
    textos: {
      verPrecio: 'See price',
      tienesCodigo: 'Have a gift code?',
      agregar: 'Add',
      pedir: 'Request Moto',
    },
  },
} as const;

for (const idioma of ['es', 'en'] as const) {
  test(`regalo de Divoox de punta a punta (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const C = CIUDADES[idioma];
    const id = `${Date.now().toString(36)}${idioma}`;
    let ip = 0;
    const cuenta = async (rol: string, nombre: string) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.97.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo: `regalo.${rol}.${id}@recorrido.test`,
          clave: DATOS!.clave,
          rol: rol === 'admin' ? 'cliente' : rol,
          ...(rol === 'cliente' ? { telefono: C.telefono } : {}),
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return (await r.json()) as { token: string; usuario: { id: string } };
    };
    const h = (t: string, extra: Record<string, string> = {}) => ({
      authorization: `Bearer ${t}`,
      ...extra,
    });

    // La ciudad, con Moto encendido y su tarifa.
    const admin = await cuenta('admin', idioma === 'es' ? 'Soporte Divoox' : 'Divoox Support');
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
    const z = C.zona;
    sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
         VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.tz}', ${z.lat}, ${z.lng}, 15, 1, '${idioma}')`);
    // El sitio local no es el de pruebas: Moto se declara construido y se enciende en su base (como
    // en las pruebas del servidor). En el sitio de pruebas lo hace el equipo desde el panel.
    sql(`INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('moto', 1)`);
    sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'`);
    sql(`INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${z.id}', 'disponible')
         ON CONFLICT(servicio_id, zona_id) DO UPDATE SET estado = 'disponible'`);
    const tarifa = await request.post('/datos/admin/viajes/tarifas', {
      headers: h(admin.token),
      data: {
        servicio: 'moto',
        zona: z.id,
        tarifa: { base: 50, porKm: 22, porMinuto: 3, minimo: 100 },
        dePrueba: false,
        motivo: 'Tarifa del recorrido',
      },
    });
    expect(tarifa.ok(), await tarifa.text()).toBe(true);

    // El equipo crea el cupón: nace apagado; lo enciende después.
    const crear = await request.post('/datos/admin/regalos-divoox', {
      headers: h(admin.token),
      data: {
        codigo: C.codigo,
        nombreEs: C.nombreEs,
        nombreEn: C.nombreEn,
        tipo: 'monto',
        valor: 100,
        servicios: ['moto', 'envios', 'comida'],
        zonas: [z.id],
        presupuesto: 10_000,
        topeDiarioConductor: 6,
      },
    });
    expect(crear.ok(), await crear.text()).toBe(true);
    expect(((await crear.json()) as { cupon: { activo: boolean } }).cupon.activo).toBe(false);
    const encender = await request.patch(`/datos/admin/regalos-divoox/${C.codigo}`, {
      headers: h(admin.token),
      data: { activo: true },
    });
    expect(encender.ok(), await encender.text()).toBe(true);

    // Un conductor de moto conectado en la recogida, con saldo para la comisión.
    const cond = await cuenta('repartidor', C.conductor);
    const c = cond.usuario.id;
    const v = `veh-regalo-${id}`;
    sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${z.id}'`);
    // Aquí se prueba el regalo, no el alta del conductor: los requisitos de Moto se apartan y vuelven
    // al final (sin ellos la base no deja encender Moto en otra ciudad).
    const requisitos = sql(
      `SELECT servicio_id, requisito, obligatorio FROM servicio_requisitos WHERE servicio_id = 'moto'`,
    );
    sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'moto'`);
    sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${C.recogida.lat}, ${C.recogida.lng}, datetime('now'), '${z.id}')
         ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
    sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
         VALUES ('${v}', '${c}', 'moto', 'Bera', 'SBR', '${idioma === 'es' ? 'Negro' : 'Black'}', 'R${id.slice(-6).toUpperCase()}', '', 2022, 1, 'aprobado')`);
    for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
      sql(
        `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${id}', '${v}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
      );
    sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
    sql(
      `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', 'moto', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
    );
    sql(
      `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', 'moto', 1)`,
    );
    sql(
      `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('recarga-${id}', '${c}', 'prepago', '${z.pais}', 'USD', 2000, 'recarga_recorrido', 'recarga-${id}')`,
    );

    // El pasajero: el formulario de Pedir viaje ya escrito (recogida y destino), en su celular.
    const cli = await cuenta('cliente', C.pasajero);
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: DATOS!.url,
      geolocation: { latitude: C.recogida.lat, longitude: C.recogida.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, idi, cuentaId, borrador]) => {
        localStorage.setItem('tumbite.idioma', idi);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`tumbite.borrador.moto.${cuentaId}`, borrador);
      },
      [
        cli.token,
        idioma,
        cli.usuario.id,
        JSON.stringify({
          recogida: C.recogida.direccion,
          recogidaLat: String(C.recogida.lat),
          recogidaLng: String(C.recogida.lng),
          destino: C.destino.direccion,
          destinoLat: String(C.destino.lat),
          destinoLng: String(C.destino.lng),
          metodo: 'efectivo',
        }),
      ] as const,
    );
    const p = await ctx.newPage();
    await p.goto('/app/ride');
    await p.getByText(C.textos.verPrecio, { exact: true }).click();
    const precio = p.getByTestId('moto-precio');
    await expect(precio).toBeVisible({ timeout: 30_000 });
    // Sin regalo todavía: «¿Tienes un código de regalo?» lo agrega a su cuenta.
    await p.getByText(C.textos.tienesCodigo).click();
    await p.getByTestId('regalo-codigo').fill(C.codigo.toLowerCase());
    if (CAPTURAS) await precio.screenshot({ path: join(CARPETA, `cliente-codigo-${idioma}.png`) });
    await p.getByText(C.textos.agregar, { exact: true }).click();
    // El precio se vuelve a calcular con el regalo: el de siempre tachado y lo que paga en mano.
    await expect(p.getByTestId('regalo-divoox')).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId('regalo-paga-en-mano')).toBeVisible();
    if (CAPTURAS) await precio.screenshot({ path: join(CARPETA, `cliente-precio-${idioma}.png`) });
    await p.getByText(C.textos.pedir, { exact: true }).click();
    // El viaje en curso muestra lo que paga Divoox y lo que paga en mano.
    await expect(p.getByTestId('regalo-divoox')).toBeVisible({ timeout: 30_000 });
    const op = String(
      sql(
        `SELECT operacion_id FROM usos_cupon_divoox WHERE cliente_id = '${cli.usuario.id}' AND estado = 'apartado'`,
      )[0]?.operacion_id ?? '',
    );
    expect(op).not.toBe('');

    // El conductor acepta (API) y su app le dice cuánto cobra y cuánto le paga Divoox.
    const paso = (nombre: string, data: object = {}) =>
      request.post(`/datos/conductor/operaciones/${op}/${nombre}`, {
        headers: h(cond.token, { 'idempotency-key': `regalo-${nombre}-${id}` }),
        data,
      });
    await expect.poll(async () => (await paso('aceptar')).status(), { timeout: 30_000 }).toBe(200);
    if (CAPTURAS) {
      await p.reload();
      await expect(p.getByTestId('regalo-divoox')).toBeVisible({ timeout: 30_000 });
      // La parte de la pantalla donde se ve lo que paga Divoox y lo que se paga en mano.
      await p.getByTestId('regalo-divoox').scrollIntoViewIfNeeded();
      await p.evaluate(() => window.scrollBy(0, 200));
      await p.screenshot({ path: join(CARPETA, `cliente-viaje-${idioma}.png`) });
    }
    const ctxRep = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctxRep.addInitScript(
      ([pase, idi, cuentaId]) => {
        localStorage.setItem('tumbite.idioma', idi);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${cuentaId}`, '1');
      },
      [cond.token, idioma, c] as const,
    );
    const pr = await ctxRep.newPage();
    await pr.goto('/driver');
    await expect(pr.getByTestId('viaje-divoox-paga')).toBeVisible({ timeout: 30_000 });
    if (CAPTURAS) await pr.screenshot({ path: join(CARPETA, `conductor-viaje-${idioma}.png`) });

    // Termina el viaje: el regalo entra al saldo del conductor una vez.
    expect((await paso('llegue')).status()).toBe(200);
    const pin = String(
      sql(`SELECT pin_recogida FROM viajes WHERE operacion_id = '${op}'`)[0]?.pin_recogida,
    );
    expect((await paso('iniciar', { pin })).status()).toBe(200);
    const fin = await paso('terminar');
    expect(fin.status()).toBe(200);
    const cuenta_ = (await fin.json()) as {
      regaloDivoox: number;
      cobrarEnMano: number;
      totalFinal: number;
    };
    expect(cuenta_.regaloDivoox).toBe(100);
    expect(cuenta_.cobrarEnMano).toBe(cuenta_.totalFinal - 100);
    expect(
      Number(
        sql(
          `SELECT COUNT(*) AS n FROM libro WHERE cuenta_id = '${c}' AND concepto = 'regalo_divoox'`,
        )[0]?.n,
      ),
    ).toBe(1);

    // El superadmin: el cupón con su gasto en vivo y el crédito del conductor.
    const { ruta } = (await (
      await request.get('/datos/admin/ruta', { headers: h(admin.token) })
    ).json()) as { ruta: string | null };
    const panel = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await panel.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await panel.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
    const sp = await panel.newPage();
    await sp.goto(`/panel${ruta ? `/${ruta}` : ''}/gift-codes`);
    const tarjeta = sp.getByTestId(`regalo-${C.codigo}`);
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await expect(tarjeta).toContainText(idioma === 'es' ? 'Encendido' : 'On');
    const sobra = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    if (CAPTURAS) {
      await tarjeta.screenshot({ path: join(CARPETA, `super-cupon-${idioma}.png`) });
      await sp.getByTestId('regalos-crear').screenshot({
        path: join(CARPETA, `super-crear-${idioma}.png`),
      });
      await sp
        .locator('table')
        .first()
        .screenshot({
          path: join(CARPETA, `super-conductores-${idioma}.png`),
        });
    }
    // Al terminar, se deja como estaba: el cupón apagado y Moto en construcción.
    await request.patch(`/datos/admin/regalos-divoox/${C.codigo}`, {
      headers: h(admin.token),
      data: { activo: false },
    });
    for (const r of requisitos)
      sql(
        `INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES ('${String(r.servicio_id)}', '${String(r.requisito)}', ${Number(r.obligatorio)})`,
      );
    sql(`UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id = 'moto'`);
    sql(`UPDATE servicios SET estado = 'proximamente' WHERE id = 'moto'`);
    sql(`DELETE FROM servicios_implementados WHERE servicio_id = 'moto'`);
    await ctx.close();
    await ctxRep.close();
    await panel.close();
  });
}
