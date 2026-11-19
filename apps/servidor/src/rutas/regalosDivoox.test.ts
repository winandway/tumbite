import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { cambiarEstadoViaje } from '../operaciones';
import { TOPES_REGALO, apartarRegalo, barrerRegalos, saludRegalos } from '../regalosDivoox';
import { UMBRALES_VIAJE_REAL, evaluarViajeReal } from '../viajeReal';

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

/**
 * C-REGALO-VIAJE-REAL: lo que deja un viaje de verdad. Empezó hace 25 minutos, el servidor sumó el
 * recorrido cotizado y el conductor está en el destino con ubicación reciente.
 */
async function recorrer(e: E, condId: string, id: string, destino = DESTINO) {
  await e.m.DB.batch([
    e.m.DB.prepare(
      `UPDATE viajes SET iniciado_en = datetime('now', '-25 minutes'),
              distancia_m_real = (SELECT distancia_m FROM cotizaciones_viaje WHERE operacion_id = ?1)
        WHERE operacion_id = ?1`,
    ).bind(id),
    e.m.DB.prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    ).bind(destino.lat, destino.lng, condId),
  ]);
}

type Fin = {
  totalFinal: number;
  regaloDivoox: number;
  regaloEnRevision: boolean;
  cobrarEnMano: number;
};

async function hacerViaje(
  e: E,
  cond: Awaited<ReturnType<typeof conductorDeMoto>>,
  p: Awaited<ReturnType<typeof pasajero>>,
  id: string,
  /** Qué pasa entre «iniciar» y «terminar». Por defecto, un viaje de verdad. */
  enCurso: () => Promise<unknown> = () => recorrer(e, cond.id, id),
) {
  expect(await cond.paso(id, 'aceptar')).toBe(200);
  expect(await cond.paso(id, 'llegue')).toBe(200);
  const pin = (await p.llamar('GET', '/datos/viajes/actual')).datos.viaje.pin;
  expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
  await enCurso();
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
  return (await r.json()) as Fin;
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
    // C-OFERTA-TIEMPO-REAL: los segundos que le quedan a la oferta los cuenta el servidor (el reloj
    // del teléfono puede estar corrido y mostrarla vencida cuando sigue viva).
    expect(ofertas.datos.ofertas[0].segundosRestantes).toBeGreaterThan(25);
    expect(ofertas.datos.ofertas[0].segundosRestantes).toBeLessThanOrEqual(30);
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

/**
 * C-REGALO-VIAJE-REAL (19 nov 2026): el regalo de un viaje solo se acredita si el viaje fue real. El
 * hueco: un conductor y un conocido, parados juntos, pedían, iniciaban y terminaban sin moverse, y
 * el regalo se acreditaba igual.
 */
const reporte = async (e: E) =>
  (await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token)).datos;
const resolver = (e: E, id: string, cuerpo: Record<string, unknown>) =>
  e.m.llamar('POST', `/datos/admin/regalos-divoox/revisiones/${id}`, cuerpo, e.admin.token);

async function conRegalo(opciones: Record<string, unknown> = {}) {
  const e = await escenario();
  await crear(e, opciones);
  await encender(e);
  const cond = await conductorDeMoto(e.m, ORIGEN);
  await recargar(e, cond.id, 10_000);
  const p = await pasajero(e);
  await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
  const { id, cot } = await pedirViaje(e, p);
  return { e, cond, p, id, cot };
}

describe('C-REGALO-VIAJE-REAL: el regalo solo se acredita si el viaje fue real', () => {
  it('terminar sin moverse deja el regalo en revisión: el viaje se termina y nada entra a ganancias', async () => {
    const { e, cond, p, id } = await conRegalo();
    const fin = await hacerViaje(e, cond, p, id, async () => undefined);
    // El viaje se termina igual y el pasajero paga solo su parte.
    expect(fin.regaloEnRevision).toBe(true);
    expect(fin.regaloDivoox).toBe(300);
    expect(fin.cobrarEnMano).toBe(fin.totalFinal - 300);
    expect((await p.llamar('GET', `/datos/viajes/${id}`)).datos.viaje.estado).toBe('terminado');
    // Nada a ganancias; el presupuesto sigue apartado (ni gastado ni libre).
    expect(await ganancias(e, cond.id)).toBe(0);
    const r = await reporte(e);
    expect(r.cupones[0]).toMatchObject({ gastado: 0, apartado: 300, restante: 9_700 });
    expect(r.conductores).toHaveLength(0);
    expect(r.revisiones).toHaveLength(1);
    expect(r.revisiones[0]).toMatchObject({
      estado: 'pendiente',
      monto: 300,
      conductorId: cond.id,
    });
    expect(r.revisiones[0].motivos).toContain('sin_moverse');
    expect(r.revisiones[0].detalle).toMatch(/sin moverse/);
    expect(r.alertas.map((a: { tipo: string }) => a.tipo)).toContain('sin_moverse');
    // El conductor lo ve como «en revisión», no como dinero por cobrar.
    const saldo = await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, cond.token);
    expect(saldo.datos.regalosPorCobrar).toBe(0);
    expect(saldo.datos.regalosEnRevision).toEqual({ monto: 300, viajes: 1 });
    // Ni repetir «terminar» ni el reloj lo pagan; y la salud no lo cuenta como colgado.
    await cond.paso(id, 'terminar');
    await e.m.DB.prepare(
      "UPDATE operaciones SET actualizado_en = datetime('now', '-2 hours') WHERE id = ?",
    )
      .bind(id)
      .run();
    await barrerRegalos(e.m.DB);
    expect(await ganancias(e, cond.id)).toBe(0);
    expect(await saludRegalos(e.m.DB)).toBe('ok');
  });

  it('el equipo lo aprueba una sola vez y entonces sí entra a ganancias', async () => {
    const { e, cond, p, id } = await conRegalo();
    await hacerViaje(e, cond, p, id, async () => undefined);
    const rev = (await reporte(e)).revisiones[0];
    // Solo el equipo.
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/admin/regalos-divoox/revisiones/${rev.id}`,
          { aprobar: true },
          cond.token,
        )
      ).estado,
    ).toBe(403);
    const ok = await resolver(e, rev.id, { aprobar: true, nota: 'GPS malo, viaje confirmado' });
    expect(ok.estado).toBe(200);
    expect(ok.datos.pagado).toBe(300);
    expect(await ganancias(e, cond.id)).toBe(300);
    expect((await resolver(e, rev.id, { aprobar: true })).estado).toBe(409);
    expect((await resolver(e, rev.id, { aprobar: false, nota: 'cambio de idea' })).estado).toBe(
      409,
    );
    expect(await ganancias(e, cond.id)).toBe(300);
    const r = await reporte(e);
    expect(r.cupones[0]).toMatchObject({ gastado: 300, apartado: 0 });
    expect(r.revisiones[0]).toMatchObject({ estado: 'aprobado' });
    const auditoria = await e.m.DB.prepare(
      "SELECT actor_id FROM auditoria_admin WHERE accion = 'regalo.revision.aprobar'",
    ).first<{ actor_id: string }>();
    expect(auditoria?.actor_id).toBe(e.admin.id);
    expect(await saludRegalos(e.m.DB)).toBe('ok');
  });

  it('rechazado: pide el motivo, el dinero vuelve al presupuesto y esa cuenta no repite el cupón', async () => {
    const { e, cond, p, id } = await conRegalo();
    await hacerViaje(e, cond, p, id, async () => undefined);
    const rev = (await reporte(e)).revisiones[0];
    expect((await resolver(e, rev.id, { aprobar: false })).estado).toBe(422);
    expect((await resolver(e, rev.id, { aprobar: false, nota: 'No hubo recorrido' })).estado).toBe(
      200,
    );
    expect(await ganancias(e, cond.id)).toBe(0);
    const r = await reporte(e);
    expect(r.cupones[0]).toMatchObject({ gastado: 0, apartado: 0, restante: 10_000 });
    expect(r.revisiones[0]).toMatchObject({ estado: 'rechazado', nota: 'No hubo recorrido' });
    // El uso quedó libre, pero esa cuenta, ese teléfono y ese aparato ya no tienen el regalo.
    const cot = await p.llamar('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    });
    expect(cot.datos.cotizacion.regalo ?? null).toBeNull();
    const otro = await pasajero(e, { aparato: p.aparato });
    await otro.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const cot2 = await otro.llamar('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    });
    expect(cot2.datos.cotizacion.regalo ?? null).toBeNull();
    expect(await saludRegalos(e.m.DB)).toBe('ok');
  });

  it('se movió pero muy poco y en un suspiro: demasiado corto frente a lo cotizado', async () => {
    const { e, cond, p, id } = await conRegalo();
    const fin = await hacerViaje(e, cond, p, id, async () => {
      await recorrer(e, cond.id, id);
      await e.m.DB.prepare(
        "UPDATE viajes SET distancia_m_real = distancia_m_real / 4, iniciado_en = datetime('now', '-40 seconds') WHERE operacion_id = ?",
      )
        .bind(id)
        .run();
    });
    expect(fin.regaloEnRevision).toBe(true);
    const r = await reporte(e);
    expect(r.revisiones[0].motivos).toEqual(['muy_corto']);
    expect(r.alertas.map((a: { tipo: string }) => a.tipo)).toContain('muy_corto');
  });

  it('recorrió lo cotizado pero terminó lejos del destino, o sin ubicación reciente', async () => {
    const lejos = await conRegalo();
    const fin = await hacerViaje(lejos.e, lejos.cond, lejos.p, lejos.id, () =>
      recorrer(lejos.e, lejos.cond.id, lejos.id, { ...DESTINO, lat: DESTINO.lat + 0.01 }),
    );
    expect(fin.regaloEnRevision).toBe(true);
    expect((await reporte(lejos.e)).revisiones[0].motivos).toEqual(['lejos_destino']);

    const sin = await conRegalo();
    await hacerViaje(sin.e, sin.cond, sin.p, sin.id, async () => {
      await recorrer(sin.e, sin.cond.id, sin.id);
      await sin.e.m.DB.prepare(
        "UPDATE repartidores SET ubicacion_en = datetime('now', '-10 minutes') WHERE usuario_id = ?",
      )
        .bind(sin.cond.id)
        .run();
    });
    expect((await reporte(sin.e)).revisiones[0].motivos).toEqual(['sin_ubicacion']);
    expect(await ganancias(sin.e, sin.cond.id)).toBe(0);
  });

  it('el servidor suma el recorrido con las ubicaciones del conductor, solo con el viaje en curso', async () => {
    const { e, cond, p, id } = await conRegalo();
    const ubicar = async (parte: number) => {
      // Cada lectura llega tres minutos después de la anterior (no es un salto imposible).
      await e.m.DB.batch([
        e.m.DB.prepare(
          "UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-180 seconds') WHERE usuario_id = ?",
        ).bind(cond.id),
        e.m.DB.prepare(
          "UPDATE repartidores SET ubicacion_en = datetime(ubicacion_en, '-180 seconds') WHERE usuario_id = ?",
        ).bind(cond.id),
      ]);
      const r = await e.m.llamar(
        'POST',
        '/datos/repartidor/ubicacion',
        {
          lat: ORIGEN.lat + (DESTINO.lat - ORIGEN.lat) * parte,
          lng: ORIGEN.lng + (DESTINO.lng - ORIGEN.lng) * parte,
          precision: 10,
        },
        cond.token,
      );
      expect(r.estado).toBe(200);
    };
    const recorrido = async () =>
      Number(
        (
          await e.m.DB.prepare('SELECT distancia_m_real AS m FROM viajes WHERE operacion_id = ?')
            .bind(id)
            .first<{ m: number | null }>()
        )?.m ?? 0,
      );
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    // Antes de empezar el viaje, moverse no suma nada.
    await ubicar(0.0005);
    expect(await recorrido()).toBe(0);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await p.llamar('GET', '/datos/viajes/actual')).datos.viaje.pin;
    expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
    for (const parte of [0.25, 0.5, 0.75, 1]) await ubicar(parte);
    const linea = 6_900; // metros en línea recta entre los dos puntos de la prueba (aprox.)
    expect(await recorrido()).toBeGreaterThan(linea * 0.9);
    expect(await recorrido()).toBeLessThan(linea * 1.15);
    // Un temblor del GPS con el vehículo quieto no suma.
    const antes = await recorrido();
    await ubicar(1.0001);
    expect(await recorrido()).toBe(antes);
    await e.m.DB.prepare(
      "UPDATE viajes SET iniciado_en = datetime('now', '-25 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await e.m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(cond.id)
      .run();
    expect(await cond.paso(id, 'terminar')).toBe(200);
    // Viaje real, medido por el servidor: el regalo se acredita sin revisión.
    expect(await ganancias(e, cond.id)).toBe(300);
    expect((await reporte(e)).revisiones).toHaveLength(0);
  });

  it('el teléfono del pasajero lejos del conductor durante el viaje manda el regalo a revisión', async () => {
    const { e, cond, p, id } = await conRegalo();
    const leer = async () =>
      e.m.DB.prepare(
        'SELECT pasajero_cerca AS cerca, pasajero_lejos AS lejos FROM viajes WHERE operacion_id = ?',
      )
        .bind(id)
        .first<{ cerca: number; lejos: number }>();
    const mandar = async (punto: { lat: number; lng: number }, precision = 15) => {
      await e.m.DB.prepare(
        "UPDATE viajes SET pasajero_ubicacion_en = datetime(pasajero_ubicacion_en, '-60 seconds') WHERE operacion_id = ?",
      )
        .bind(id)
        .run();
      return (await p.llamar('POST', `/datos/viajes/${id}/mi-ubicacion`, { ...punto, precision }))
        .estado;
    };
    const fin = await hacerViaje(e, cond, p, id, async () => {
      // Junto al conductor una vez; después, tres lecturas a kilómetros de él.
      expect(await mandar(ORIGEN)).toBe(200);
      expect(await leer()).toEqual({ cerca: 1, lejos: 0 });
      // Dos seguidas sin esperar: la segunda no cuenta. Y una imprecisa tampoco.
      await p.llamar('POST', `/datos/viajes/${id}/mi-ubicacion`, { ...DESTINO, precision: 15 });
      expect(await mandar(DESTINO, 900)).toBe(200);
      expect(await leer()).toEqual({ cerca: 1, lejos: 0 });
      for (let i = 0; i < 3; i++) expect(await mandar(DESTINO)).toBe(200);
      expect(await leer()).toEqual({ cerca: 1, lejos: 3 });
      // Otra persona no puede escribir en este viaje.
      const ajeno = await pasajero(e);
      await ajeno.llamar('POST', `/datos/viajes/${id}/mi-ubicacion`, { ...ORIGEN, precision: 15 });
      expect(await leer()).toEqual({ cerca: 1, lejos: 3 });
      await recorrer(e, cond.id, id);
    });
    expect(fin.regaloEnRevision).toBe(true);
    expect((await reporte(e)).revisiones[0].motivos).toEqual(['pasajero_lejos']);
  });

  it('un viaje con regalo SIEMPRE pide el código de inicio, aunque la ciudad lo tenga apagado', async () => {
    const e = await escenario();
    const ajuste = await e.m.llamar(
      'PUT',
      '/datos/admin/viajes/ajustes',
      { servicio: 'moto', zona: ZONA, pin: 'nunca', selfieCasco: false },
      e.admin.token,
    );
    expect(ajuste.estado).toBe(200);
    // Sin regalo (todavía no hay cupón), en esta ciudad el viaje empieza sin código.
    const sin = await pasajero(e);
    const v0 = await pedirViaje(e, sin);
    expect(v0.cot.regalo ?? null).toBeNull();
    expect((await sin.llamar('GET', '/datos/viajes/actual')).datos.viaje.pin ?? null).toBeNull();
    const cancelado = await sin.llamar(
      'POST',
      `/datos/viajes/${v0.id}/cancelar`,
      { motivo: 'cambio_de_planes' },
      { 'idempotency-key': 'cancelar-sin-regalo-1' },
    );
    expect(cancelado.estado).toBe(200);
    await crear(e);
    await encender(e);
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const con = await pasajero(e);
    await con.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
    const v = await pedirViaje(e, con);
    expect(v.cot.regalo).toMatchObject({ codigo: 'VIGIA' });
    const vista = (await con.llamar('GET', '/datos/viajes/actual')).datos.viaje;
    expect(vista.pin).toMatch(/^\d{4}$/);
    expect(await cond.paso(v.id, 'aceptar')).toBe(200);
    expect(await cond.paso(v.id, 'llegue')).toBe(200);
    expect(await cond.paso(v.id, 'iniciar')).not.toBe(200);
    expect(await cond.paso(v.id, 'iniciar', { pin: vista.pin })).toBe(200);
  });

  it('alerta: varios regalos del mismo conductor con cuentas creadas el mismo día', async () => {
    const e = await escenario();
    await crear(e);
    await encender(e);
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    for (let i = 0; i < UMBRALES_VIAJE_REAL.cuentasMismoDia; i++) {
      const p = await pasajero(e);
      await p.llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'VIGIA' });
      const v = await pedirViaje(e, p);
      await hacerViaje(e, cond, p, v.id);
      await e.m.DB.prepare(
        "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
      )
        .bind(ORIGEN.lat, ORIGEN.lng, cond.id)
        .run();
      const tipos = (await reporte(e)).alertas.map((a: { tipo: string }) => a.tipo);
      if (i < UMBRALES_VIAJE_REAL.cuentasMismoDia - 1)
        expect(tipos).not.toContain('cuentas_mismo_dia');
      else expect(tipos.filter((t: string) => t === 'cuentas_mismo_dia')).toHaveLength(1);
    }
    // Es solo una alerta: los viajes fueron reales y se acreditaron.
    expect(await ganancias(e, cond.id)).toBe(300 * UMBRALES_VIAJE_REAL.cuentasMismoDia);
  });

  it('la regla, sin base de datos: qué cumple y qué no', () => {
    const real = {
      cotizadaM: 5_000,
      cotizadaS: 900,
      recorridoM: 4_200,
      duracionS: 800,
      alDestinoM: 80,
      pasajeroCerca: 0,
      pasajeroLejos: 0,
    };
    expect(evaluarViajeReal(real)).toEqual([]);
    // El mal GPS que se queda corto pero no tanto, pasa.
    expect(evaluarViajeReal({ ...real, recorridoM: 2_600, duracionS: 400 })).toEqual([]);
    expect(evaluarViajeReal({ ...real, recorridoM: 40 })).toEqual(['sin_moverse']);
    expect(evaluarViajeReal({ ...real, recorridoM: 2_400 })).toEqual(['muy_corto']);
    expect(evaluarViajeReal({ ...real, duracionS: 300 })).toEqual(['muy_corto']);
    expect(evaluarViajeReal({ ...real, alDestinoM: 301 })).toEqual(['lejos_destino']);
    expect(evaluarViajeReal({ ...real, alDestinoM: null })).toEqual(['sin_ubicacion']);
    // El reloj, que cierra después, no sabe dónde estaba: eso no cuenta en contra.
    expect(evaluarViajeReal({ ...real, alDestinoM: undefined })).toEqual([]);
    // Una sola lectura del pasajero no opina; la mayoría lejos, sí.
    expect(evaluarViajeReal({ ...real, pasajeroLejos: 1 })).toEqual([]);
    expect(evaluarViajeReal({ ...real, pasajeroCerca: 1, pasajeroLejos: 2 })).toEqual([
      'pasajero_lejos',
    ]);
    expect(evaluarViajeReal({ ...real, pasajeroCerca: 3, pasajeroLejos: 1 })).toEqual([]);
    // Un viaje cotizado cortísimo no exige más de lo que mide.
    expect(
      evaluarViajeReal({ ...real, cotizadaM: 300, cotizadaS: 90, recorridoM: 160, duracionS: 95 }),
    ).toEqual([]);
  });
});
