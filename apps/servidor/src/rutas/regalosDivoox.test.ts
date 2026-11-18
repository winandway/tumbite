import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { cambiarEstadoViaje } from '../operaciones';
import { TOPES_REGALO, apartarRegalo, barrerRegalos, saludRegalos } from '../regalosDivoox';

/**
 * C-CUPON-DIVOOX (17 nov 2026): regalos que paga Divoox, con presupuesto, antifraude y liquidación
 * al conductor. Candado: ningún cupón gasta un centavo más que su presupuesto.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

let aparatos = 0;
const nuevoAparato = () => `aparato-prueba-${++aparatos}-${Math.random().toString(36).slice(2, 8)}`;

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: ZONA, tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  // La comisión del conductor sale de su prepago (10 %), como en Venezuela.
  await m.DB.prepare(
    `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
     VALUES ('pol-ride', 'ride', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
  ).run();
  return { m, admin };
}
type E = Awaited<ReturnType<typeof escenario>>;

let telefonos = 0;
async function pasajero(e: E, opciones: { telefono?: string; aparato?: string } = {}) {
  const c = await e.m.cuenta('cliente', 'Pasajero Regalo');
  const tel = opciones.telefono ?? `+1305555${String(1000 + ++telefonos).slice(-4)}`;
  await e.m.DB.prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ? WHERE id = ?')
    .bind(tel, tel.replace(/\D/g, ''), c.id)
    .run();
  const aparato = opciones.aparato ?? nuevoAparato();
  const llamar = (
    metodo: string,
    ruta: string,
    cuerpo?: unknown,
    extra: Record<string, string> = {},
  ) => e.m.llamar(metodo, ruta, cuerpo, c.token, { 'x-aparato': aparato, ...extra });
  return { ...c, tel, aparato, llamar };
}

const crear = (e: E, cuerpo: Record<string, unknown> = {}) =>
  e.m.llamar(
    'POST',
    '/datos/admin/regalos-divoox',
    {
      codigo: 'VIGIA',
      nombreEs: 'Regalo de bienvenida',
      nombreEn: 'Welcome gift',
      tipo: 'monto',
      valor: 300,
      servicios: ['moto', 'comida', 'envios'],
      zonas: [ZONA],
      venceEn: null,
      presupuesto: 10_000,
      ...cuerpo,
    },
    e.admin.token,
  );
const encender = (e: E, codigo = 'VIGIA', activo = true) =>
  e.m.llamar('PATCH', `/datos/admin/regalos-divoox/${codigo}`, { activo }, e.admin.token);

async function recargar(e: E, cuenta: string, monto: number) {
  await e.m.DB.prepare(
    "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES (?, ?, 'prepago', 'US', 'USD', ?, 'recarga_prueba', ?)",
  )
    .bind(crypto.randomUUID(), cuenta, monto, `recarga-prueba:${cuenta}:${monto}:${Math.random()}`)
    .run();
}
const ganancias = async (e: E, cuenta: string) =>
  Number(
    (
      await e.m.DB.prepare(
        'SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = ?',
      )
        .bind(cuenta)
        .first<{ s: number }>()
    )?.s,
  );
const bolsillo = async (e: E, cuenta: string, b: string) =>
  Number(
    (
      await e.m.DB.prepare(
        'SELECT COALESCE(SUM(monto), 0) AS s FROM libro WHERE cuenta_id = ? AND bolsillo = ?',
      )
        .bind(cuenta, b)
        .first<{ s: number }>()
    )?.s,
  );

async function pedirViaje(e: E, p: Awaited<ReturnType<typeof pasajero>>, metodoPago = 'efectivo') {
  const cot = await p.llamar('POST', '/datos/viajes/cotizar', {
    servicio: 'moto',
    origen: ORIGEN,
    destino: DESTINO,
  });
  expect(cot.estado).toBe(201);
  const c = cot.datos.cotizacion;
  const r = await p.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: c.id, metodoPago, ...(c.regalo ? { regalo: c.regalo.codigo } : {}) },
    { 'idempotency-key': `pedir-${c.id.slice(0, 12)}` },
  );
  return { cot: c, r, id: r.datos?.viaje?.id as string };
}

async function hacerViaje(
  e: E,
  cond: Awaited<ReturnType<typeof conductorDeMoto>>,
  p: Awaited<ReturnType<typeof pasajero>>,
  id: string,
) {
  expect(await cond.paso(id, 'aceptar')).toBe(200);
  expect(await cond.paso(id, 'llegue')).toBe(200);
  const pin = (await p.llamar('GET', '/datos/viajes/actual')).datos.viaje.pin;
  expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
  const r = await e.m.crudo(`/datos/conductor/operaciones/${id}/terminar`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cond.token}`,
      'content-type': 'application/json',
      'idempotency-key': `terminar-${id.slice(0, 8)}-x`,
    },
    body: '{}',
  });
  expect(r.status).toBe(200);
  return (await r.json()) as { totalFinal: number; regaloDivoox: number; cobrarEnMano: number };
}

describe('C-CUPON-DIVOOX: el superadmin crea el cupón y nace apagado', () => {
  it('crea VIGIA apagado, con su presupuesto en vivo; solo el equipo lo toca', async () => {
    const e = await escenario();
    const r = await crear(e);
    expect(r.estado).toBe(201);
    expect(r.datos.cupon).toMatchObject({
      codigo: 'VIGIA',
      activo: false,
      presupuesto: 10_000,
      gastado: 0,
      apartado: 0,
      restante: 10_000,
      moneda: 'USD',
    });
    const p = await pasajero(e);
    expect((await p.llamar('POST', '/datos/admin/regalos-divoox', {})).estado).toBe(403);
    // Repetido o con el mismo código que un cupón de comida: no.
    expect((await crear(e)).estado).toBe(409);
    expect((await encender(e)).estado).toBe(200);
    const lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0].activo).toBe(true);
    expect(lista.datos.topes).toEqual(TOPES_REGALO);
  });

  it('los topes viven en el código: monto por uso, presupuesto y suma de presupuestos', async () => {
    const e = await escenario();
    expect((await crear(e, { valor: TOPES_REGALO.valorMaximo + 1 })).estado).toBe(400);
    expect((await crear(e, { presupuesto: TOPES_REGALO.presupuestoMaximo + 1 })).estado).toBe(400);
    expect((await crear(e, { codigo: 'UNO', presupuesto: 50_000 })).estado).toBe(201);
    expect((await crear(e, { codigo: 'DOS', presupuesto: 50_000 })).estado).toBe(201);
    // La suma de los vigentes ya está en 1 000 USD: no entra ni un dólar más.
    const tres = await crear(e, { codigo: 'TRES', presupuesto: 100 });
    expect(tres.estado).toBe(422);
    expect(tres.datos.campo).toBe('presupuesto');
  });
});

describe('C-CUPON-DIVOOX: el pasajero agrega el código y paga en mano solo la diferencia', () => {
  it('cotiza con el regalo, el conductor ve «cobra X · Divoox te paga Y» y recibe Y en su saldo', async () => {
    const e = await escenario();
    await crear(e);
    const p = await pasajero(e);
    // Apagado: no se puede agregar.
    expect(
      (await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'vigia' })).estado,
    ).toBe(404);
    await encender(e);
    const g = await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: ' vigia ' });
    expect(g.estado).toBe(201);
    expect(g.datos.regalo.codigo).toBe('VIGIA');
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const { cot, id } = await pedirViaje(e, p);
    expect(cot.regalo).toMatchObject({ codigo: 'VIGIA', monto: 300 });
    const vista = (await p.llamar('GET', '/datos/viajes/actual')).datos.viaje;
    expect(vista.regalo).toMatchObject({ codigo: 'VIGIA', monto: 300 });
    const ofertas = await e.m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      cond.token,
    );
    expect(ofertas.datos.ofertas[0].regaloDivoox).toBe(300);
    const fin = await hacerViaje(e, cond, p, id);
    expect(fin.regaloDivoox).toBe(300);
    expect(fin.cobrarEnMano).toBe(fin.totalFinal - 300);
    // Lo que pagó Divoox entra a las GANANCIAS del conductor (recibió menos efectivo); la comisión
    // salió de su saldo como siempre.
    const comision = Math.round(cot.total / 10);
    expect(await bolsillo(e, cond.id, 'prepago')).toBe(10_000 - comision);
    expect(await ganancias(e, cond.id)).toBe(300);
    expect(await bolsillo(e, 'tumbite', 'comisiones')).toBe(comision - 300);
    // Repetir «terminar» no acredita dos veces.
    await cond.paso(id, 'terminar');
    expect(await ganancias(e, cond.id)).toBe(300);
    const lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({
      gastado: 300,
      apartado: 0,
      restante: 9_700,
      usos: 1,
    });
    expect(lista.datos.conductores[0]).toMatchObject({
      conductorId: cond.id,
      acreditado: 300,
      porPagar: 300,
    });
    // Ya lo usó: no hay un segundo regalo para la misma cuenta.
    expect(
      (await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' })).estado,
    ).toBe(409);
    expect(await saludRegalos(e.m.DB)).toBe('ok');
  });

  it('el regalo de bienvenida se aplica solo en la primera operación, sin código', async () => {
    const e = await escenario();
    await crear(e, { codigo: 'BIENVENIDA', bienvenida: true });
    await encender(e, 'BIENVENIDA');
    const p = await pasajero(e);
    const { cot } = await pedirViaje(e, p);
    expect(cot.regalo).toMatchObject({ codigo: 'BIENVENIDA', bienvenida: true });
    // Quien ya hizo un viaje no es nuevo.
    const veterano = await pasajero(e);
    await e.m.DB.prepare(
      "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general) VALUES (?, 'moto', 'viaje_pasajero', ?, ?, 'terminada')",
    )
      .bind(crypto.randomUUID(), veterano.id, ZONA)
      .run();
    const otra = await veterano.llamar('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    });
    expect(otra.datos.cotizacion.regalo ?? null).toBeNull();
  });

  it('sin aparato identificado (app vieja) o con tarjeta no hay regalo', async () => {
    const e = await escenario();
    await crear(e);
    await encender(e);
    const p = await pasajero(e);
    await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const sin = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      p.token,
    );
    expect(sin.datos.cotizacion.regalo).toBeNull();
    expect(
      (await e.m.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' }, p.token))
        .estado,
    ).toBe(409);
  });

  it('si el pasajero cancela, el regalo vuelve al presupuesto', async () => {
    const e = await escenario();
    await crear(e);
    await encender(e);
    const p = await pasajero(e);
    await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const { id } = await pedirViaje(e, p);
    const r = await p.llamar(
      'POST',
      `/datos/viajes/${id}/cancelar`,
      {},
      { 'idempotency-key': 'cancelar-regalo-1' },
    );
    expect(r.estado).toBe(200);
    const lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({ gastado: 0, apartado: 0, restante: 10_000 });
    // Y puede usarlo en su próximo viaje.
    const otra = await pedirViaje(e, p);
    expect(otra.cot.regalo?.codigo).toBe('VIGIA');
  });
});

describe('C-PRECIO-CON-REGALO: el pasajero ve el regalo en todas las pantallas del viaje', () => {
  it('el viaje en curso, cancelado, «Mis viajes» y el recibo traen el regalo con su nombre', async () => {
    const e = await escenario();
    await crear(e, { nombreEs: 'Tu primer viaje', nombreEn: 'Your first ride' });
    await encender(e);
    const p = await pasajero(e);
    await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const { id } = await pedirViaje(e, p);
    const esperado = {
      codigo: 'VIGIA',
      monto: 300,
      nombreEs: 'Tu primer viaje',
      nombreEn: 'Your first ride',
    };
    expect((await p.llamar('GET', '/datos/viajes/actual')).datos.viaje.regalo).toEqual(esperado);
    expect(
      (
        await p.llamar(
          'POST',
          `/datos/viajes/${id}/cancelar`,
          {},
          { 'idempotency-key': 'cancelar-precio-1' },
        )
      ).estado,
    ).toBe(200);
    // Cancelado: el regalo volvió a la cuenta, pero el viaje sigue mostrando el precio con su regalo.
    const cancelado = (await p.llamar('GET', `/datos/viajes/${id}`)).datos.viaje;
    expect(cancelado.estado).toBe('cancelado');
    expect(cancelado.regalo).toEqual({ ...esperado, devuelto: true });
    const historial = (await p.llamar('GET', '/datos/viajes/historial')).datos.viajes;
    expect(historial.find((v: { id: string }) => v.id === id)?.regalo).toEqual({
      ...esperado,
      devuelto: true,
    });
    const recibo = await p.llamar('GET', `/datos/viajes/${id}/recibo`);
    expect(recibo.datos.recibo.regalo).toEqual({ ...esperado, devuelto: true });
  });
});

describe('C-CUPON-DIVOOX (candado): ni un centavo más que el presupuesto', () => {
  it('con 7,00 USD y 3,00 por uso: 3,00 + 3,00 + 1,00 y se apaga solo', async () => {
    const e = await escenario();
    await crear(e, { presupuesto: 700 });
    await encender(e);
    const montos: number[] = [];
    for (let i = 0; i < 4; i++) {
      const p = await pasajero(e);
      await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
      const { cot } = await pedirViaje(e, p);
      montos.push(cot.regalo?.monto ?? 0);
    }
    expect(montos).toEqual([300, 300, 100, 0]);
    const lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({
      apartado: 700,
      restante: 0,
      activo: false,
      agotado: true,
    });
  });

  it('veinte apartados a la vez contra 10,00 USD nunca pasan de 10,00', async () => {
    const e = await escenario();
    await crear(e, { presupuesto: 1_000 });
    await encender(e);
    const intentos = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const p = await pasajero(e);
        await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
        return apartarRegalo(e.m.DB, {
          clienteId: p.id,
          servicio: 'moto',
          zonaId: ZONA,
          moneda: 'USD',
          base: 5_000,
          aparato: `a:${p.aparato}`,
          operacionId: `op-presupuesto-${i}`,
          pais: 'US',
        });
      }),
    );
    const total = intentos.reduce((s, r) => s + (r?.monto ?? 0), 0);
    expect(total).toBe(1_000);
    const suma = await e.m.DB.prepare(
      "SELECT SUM(monto) AS s FROM usos_cupon_divoox WHERE codigo = 'VIGIA' AND estado <> 'liberado'",
    ).first<{ s: number }>();
    expect(suma?.s).toBe(1_000);
  });

  it('el canario se pone en rojo si un cupón aparece gastado de más', async () => {
    const e = await escenario();
    await crear(e, { presupuesto: 300 });
    expect(await saludRegalos(e.m.DB)).toBe('ok');
    // Se fuerza a mano lo que el código nunca deja pasar.
    await e.m.DB.prepare(
      "INSERT INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, monto, moneda) VALUES ('x1', 'VIGIA', 'c', 't', 'a', 'moto', ?, 'US', 'op-x1', 500, 'USD')",
    )
      .bind(ZONA)
      .run();
    expect(await saludRegalos(e.m.DB)).toBe('error');
    expect((await e.m.llamar('GET', '/datos/salud')).datos.piezas.regalos).toBe('error');
  });
});

describe('C-CUPON-DIVOOX: antifraude', () => {
  it('un uso por aparato y por teléfono, aunque sea otra cuenta', async () => {
    const e = await escenario();
    await crear(e);
    await encender(e);
    const a = await pasajero(e);
    await a.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    expect((await pedirViaje(e, a)).cot.regalo?.monto).toBe(300);
    // Otra cuenta en el MISMO teléfono (aparato): no.
    const b = await pasajero(e, { aparato: a.aparato });
    expect(
      (await b.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' })).estado,
    ).toBe(409);
    // Otra cuenta con el MISMO número de celular: el regalo no se aplica.
    const c = await pasajero(e, { telefono: a.tel });
    await c.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    expect((await pedirViaje(e, c)).cot.regalo ?? null).toBeNull();
  });

  it('el conductor no toma un viaje con regalo pedido desde su propio teléfono', async () => {
    const e = await escenario();
    await crear(e);
    await encender(e);
    const p = await pasajero(e);
    await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const { id } = await pedirViaje(e, p);
    await e.m.DB.prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ? WHERE id = ?')
      .bind(p.tel, p.tel.replace(/\D/g, ''), cond.id)
      .run();
    expect(await cond.paso(id, 'aceptar')).toBe(409);
    // No quedó nada apartado de su comisión y la alerta está en el reporte.
    expect(await bolsillo(e, cond.id, 'reservado')).toBe(0);
    const r = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(r.datos.alertas[0]).toMatchObject({ tipo: 'propio', codigo: 'VIGIA' });
  });

  it('tope diario de viajes con regalo por conductor', async () => {
    const e = await escenario();
    await crear(e, { topeDiarioConductor: 1 });
    await encender(e);
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const p1 = await pasajero(e);
    await p1.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const v1 = await pedirViaje(e, p1);
    await hacerViaje(e, cond, p1, v1.id);
    const p2 = await pasajero(e);
    await p2.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const v2 = await pedirViaje(e, p2);
    expect(await cond.paso(v2.id, 'aceptar')).toBe(409);
    const r = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(r.datos.alertas.map((a: { tipo: string }) => a.tipo)).toContain('tope_diario');
  });
});

describe('C-CUPON-DIVOOX: liquidación al conductor y el reloj', () => {
  it('el equipo le paga por pago móvil lo acreditado, una vez por referencia y nunca de más', async () => {
    const e = await escenario();
    await crear(e);
    await encender(e);
    const p = await pasajero(e);
    await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const { id } = await pedirViaje(e, p);
    await hacerViaje(e, cond, p, id);
    const antes = await ganancias(e, cond.id);
    const pagar = (monto: number, referencia: string) =>
      e.m.llamar(
        'POST',
        `/datos/admin/regalos-divoox/conductores/${cond.id}/pago-movil`,
        { moneda: 'USD', monto, referencia },
        e.admin.token,
      );
    expect((await pagar(301, 'REF-0001')).estado).toBe(409);
    expect((await pagar(300, 'REF-0001')).estado).toBe(201);
    expect((await pagar(1, 'REF-0001')).estado).toBe(409);
    expect(await ganancias(e, cond.id)).toBe(antes - 300);
    const r = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(r.datos.conductores[0]).toMatchObject({
      acreditado: 300,
      pagadoPagoMovil: 300,
      porPagar: 0,
    });
  });

  it('el reloj libera lo apartado de un viaje que se quedó sin conductor', async () => {
    const e = await escenario();
    await crear(e, { presupuesto: 300 });
    await encender(e);
    const p = await pasajero(e);
    await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const { id } = await pedirViaje(e, p);
    let lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({ apartado: 300, activo: false });
    // Se libera aunque el aviso inmediato no corra: lo retoma el reloj.
    await cambiarEstadoViaje(e.m.DB, {
      operacionId: id,
      desde: 'buscando',
      hacia: 'sin_conductor',
      actor: 'sistema',
      actorId: null,
      clave: `sin-conductor:${id}`,
      motivo: 'sin_conductor',
    });
    expect(await barrerRegalos(e.m.DB)).toBe(1);
    lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    // El presupuesto volvió y el cupón se encendió solo otra vez.
    expect(lista.datos.cupones[0]).toMatchObject({ apartado: 0, restante: 300, activo: true });
  });
});
