import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-CARRO-PRUEBAS (30 oct 2026): un viaje en Carro de punta a punta en las apps web. En Carro el Driver
 * pide el código del pasajero pero no el casco. Los pasos sin pantalla nueva van por la API.
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

const sql = (comando: string): Record<string, unknown>[] => {
  const salida = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'tumbite-local',
      '--local',
      '--persist-to',
      '.recorrido/estado',
      '-c',
      '.recorrido/wrangler.jsonc',
      '--json',
      '--command',
      comando,
    ],
    { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  return (JSON.parse(salida) as { results: Record<string, unknown>[] }[])[0]?.results ?? [];
};

const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: '100 SE 2nd St, Miami' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: '1000 Collins Ave, Miami Beach' };

test('un viaje en Carro de punta a punta: código sin casco (es)', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const id = Date.now().toString(36);
  let ip = 0;
  const cuenta = async (rol: string, nombre: string) => {
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.95.${Math.floor(Math.random() * 250)}.${++ip}` },
      data: {
        nombre,
        correo: `carro.${rol}.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: rol === 'admin' ? 'cliente' : rol,
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const h = (t: string) => ({ authorization: `Bearer ${t}` });
  const admin = await cuenta('admin', 'Soporte Carro');
  sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
  sql(`INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('carro', 1)`);
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
  const cond = await cuenta('repartidor', 'Conductor Carro');
  const c = cond.usuario.id;
  const v = `veh-carro-${id}`;
  sql(`UPDATE repartidores SET conectado = 0`);
  sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'carro'`);
  sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${ORIGEN.lat}, ${ORIGEN.lng}, datetime('now'), 'US-FL-MIAMI')
       ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
  sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
       VALUES ('${v}', '${c}', 'carro', 'Toyota', 'Corolla', 'Gris', 'C${id.slice(-6).toUpperCase()}', 'FL', 2022, 4, 'aprobado')`);
  for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
    sql(
      `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${id}', '${v}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
    );
  sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
  sql(
    `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', 'carro', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
  );
  sql(
    `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', 'carro', 1)`,
  );

  const cli = await cuenta('cliente', 'Paula Pasajera');
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
  const op = ((await pedido.json()) as { viaje: { id: string } }).viaje.id;
  const actual = await request.get('/datos/viajes/actual', { headers: h(cli.token) });
  const pin = ((await actual.json()) as { viaje: { pin: string } }).viaje.pin;
  expect(pin).toMatch(/^\d{4}$/);
  const paso = (nombre: string) =>
    request.post(`/datos/conductor/operaciones/${op}/${nombre}`, {
      headers: { ...h(cond.token), 'idempotency-key': `carro-${nombre}-${id}` },
      data: {},
    });
  expect((await paso('aceptar')).status()).toBe(200);
  expect((await paso('llegue')).status()).toBe(200);

  // En el Driver: el código del pasajero, sin el interruptor del casco.
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctx.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, cond.token);
  const pr = await ctx.newPage();
  await pr.goto('/driver');
  const codigo = pr.getByTestId('viaje-pin');
  await expect(codigo).toBeVisible({ timeout: 30_000 });
  await expect(pr.getByTestId('viaje-casco')).toHaveCount(0);
  await codigo.fill(pin);
  await pr.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'carro-driver-codigo-es.png') });
  await pr
    .getByRole('button', { name: /Empezar|Iniciar/ })
    .first()
    .click();
  await expect
    .poll(() => sql(`SELECT estado FROM viajes WHERE operacion_id = '${op}'`)[0]?.estado, {
      timeout: 30_000,
    })
    .toBe('en_curso');
  await ctx.close();
});
