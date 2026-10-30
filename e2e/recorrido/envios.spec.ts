import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-ENVIOS (30 oct 2026): un envío de persona a persona de punta a punta en las apps web, como Uber
 * Courier. El cliente ve su PIN de entrega; el Driver toma la foto del paquete y entrega con el PIN.
 * Los pasos sin pantalla nueva (pedir, aceptar, llegar) van por la API. Solo en esta computadora.
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
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('un envío de punta a punta: PIN para quien recibe, foto y entrega con el PIN (es)', async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const id = Date.now().toString(36);
  let ip = 0;
  const cuenta = async (rol: string, nombre: string) => {
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.94.${Math.floor(Math.random() * 250)}.${++ip}` },
      data: {
        nombre,
        correo: `envio.${rol}.${id}@recorrido.test`,
        clave: DATOS!.clave,
        rol: rol === 'admin' ? 'cliente' : rol,
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const h = (t: string, extra: Record<string, string> = {}) => ({
    authorization: `Bearer ${t}`,
    ...extra,
  });
  const clave = (p: string) => ({ 'idempotency-key': `envio-${p}-${id}` });

  // El equipo enciende Envíos en Miami con una tarifa de prueba.
  const admin = await cuenta('admin', 'Soporte Envíos');
  sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
  // El sitio local no es el de pruebas: Envíos se declara construido y se enciende en su base (como en
  // las pruebas del servidor). En el sitio de pruebas lo hace el equipo desde el panel.
  sql(`INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('envios', 1)`);
  sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'envios'`);
  sql(
    `UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'envios' AND zona_id = 'US-FL-MIAMI'`,
  );
  const tarifa = await request.post('/datos/admin/viajes/tarifas', {
    headers: h(admin.token),
    data: {
      servicio: 'envios',
      zona: 'US-FL-MIAMI',
      tarifa: { base: 200, porKm: 90, porMinuto: 10, minimo: 600 },
      dePrueba: true,
      motivo: 'Tarifa de prueba',
    },
  });
  expect(tarifa.ok(), await tarifa.text()).toBe(true);

  // Un conductor con moto aprobada y habilitado para Envíos, conectado en la recogida.
  const cond = await cuenta('repartidor', 'Conductor Envíos');
  const c = cond.usuario.id;
  const v = `veh-envio-${id}`;
  sql(`UPDATE repartidores SET conectado = 0`);
  sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'envios'`);
  sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${ORIGEN.lat}, ${ORIGEN.lng}, datetime('now'), 'US-FL-MIAMI')
       ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
  sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
       VALUES ('${v}', '${c}', 'moto', 'Yamaha', 'NMAX', 'Negro', 'E${id.slice(-6).toUpperCase()}', 'FL', 2022, 1, 'aprobado')`);
  for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
    sql(
      `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${id}', '${v}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
    );
  sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
  sql(
    `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', 'envios', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
  );
  sql(
    `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', 'envios', 1)`,
  );

  // El cliente pide el envío.
  const cli = await cuenta('cliente', 'Paula Remitente');
  const cot = await request.post('/datos/viajes/cotizar', {
    headers: h(cli.token),
    data: { servicio: 'envios', origen: ORIGEN, destino: DESTINO },
  });
  expect(cot.ok(), await cot.text()).toBe(true);
  const cotizacion = ((await cot.json()) as { cotizacion: { id: string } }).cotizacion;
  const pedido = await request.post('/datos/viajes', {
    headers: h(cli.token),
    data: {
      cotizacionId: cotizacion.id,
      metodoPago: 'efectivo',
      paquete: {
        descripcion: 'Unas llaves',
        valorDeclarado: 1_000,
        destinatario: { nombre: 'Lucía Destino', telefono: '3055550177' },
        sinProhibidos: true,
      },
    },
  });
  expect(pedido.ok(), await pedido.text()).toBe(true);
  const op = ((await pedido.json()) as { viaje: { id: string } }).viaje.id;

  // La app del cliente muestra el PIN de entrega.
  const ctxCli = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctxCli.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, cli.token);
  const pc = await ctxCli.newPage();
  await pc.goto('/app/ride?servicio=envios');
  const pinVisto = pc.getByTestId('envio-pin');
  await expect(pinVisto).toBeVisible({ timeout: 30_000 });
  const pin = (await pinVisto.textContent())?.trim() ?? '';
  expect(pin).toMatch(/^\d{4}$/);
  await expect(pc.getByText(/Unas llaves/)).toBeVisible();
  // C-TEXTOS-POR-SERVICIO: un envío no es un viaje.
  await expect(pc.getByText('Cancelar el envío')).toBeVisible();
  await expect(pc.getByText('Cancelar el viaje')).toHaveCount(0);
  await pc.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'envio-cliente-es.png') });

  // El conductor acepta y llega (API); en su app, la foto del paquete antes de salir.
  const paso = (nombre: string, data: object = {}) =>
    request.post(`/datos/conductor/operaciones/${op}/${nombre}`, {
      headers: h(cond.token, clave(nombre)),
      data,
    });
  expect((await paso('aceptar')).status()).toBe(200);
  expect((await paso('llegue')).status()).toBe(200);
  const ctxRep = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctxRep.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, cond.token);
  const pr = await ctxRep.newPage();
  await pr.goto('/driver');
  await expect(pr.getByText('Tomar la foto del paquete')).toBeVisible({ timeout: 30_000 });
  await expect(pr.getByText(/Unas llaves · para Lucía Destino/)).toBeVisible();
  await pr.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'envio-driver-foto-es.png') });
  // La cámara no existe en la web de prueba: la foto va por la API, como la mandaría la app.
  const foto = await request.post(`/datos/conductor/operaciones/${op}/foto-paquete`, {
    headers: h(cond.token, { 'content-type': 'image/png' }),
    data: PNG,
  });
  expect(foto.status()).toBe(201);
  expect((await paso('iniciar')).status()).toBe(200);

  // Entrega en la app del Driver con el PIN de quien recibe.
  await pr.reload();
  const campo = pr.getByTestId('envio-pin-entrega');
  await expect(pr.getByText('Llevando el paquete a Lucía Destino')).toBeVisible({
    timeout: 30_000,
  });
  await expect(campo).toBeVisible({ timeout: 30_000 });
  await campo.fill(pin);
  await pr.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'envio-driver-pin-es.png') });
  await pr.getByText('Entregar el paquete').click();
  await expect
    .poll(
      () =>
        sql(
          `SELECT entregado_en IS NOT NULL AS ok FROM envios_persona WHERE operacion_id = '${op}'`,
        )[0]?.ok,
      { timeout: 30_000 },
    )
    .toBe(1);
  await ctxCli.close();
  await ctxRep.close();
});
