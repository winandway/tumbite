import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { repartirOperaciones } from '../operaciones';

/**
 * Divoox Moto · Fase M1. Candados C-MOTO-SOLO-PRUEBAS (Moto se enciende solo en el sitio de
 * pruebas; en producción, nunca) y C-VIAJE-PRECIO-FIJO (tarifa versionada por ciudad y cotización
 * con precio fijo guardada en el servidor, que vence a los 5 minutos).
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

async function escenario(host?: string) {
  const m = mundo({}, host ? { host } : {});
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  return { m, admin, cliente };
}
const enPruebas = () => escenario('staging.tumbite.com');

async function encenderMoto(e: Awaited<ReturnType<typeof escenario>>) {
  const s = await e.m.llamar(
    'PUT',
    '/datos/admin/servicios/moto',
    { estado: 'disponible' },
    e.admin.token,
  );
  const z = await e.m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    e.admin.token,
  );
  return { servicio: s.estado, zona: z.estado };
}
function ponerTarifa(
  e: Awaited<ReturnType<typeof escenario>>,
  tarifa = TARIFA,
  motivo = 'Tarifa de prueba',
) {
  return e.m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: ZONA, tarifa, motivo },
    e.admin.token,
  );
}
const cotizar = (
  e: Awaited<ReturnType<typeof escenario>>,
  cuerpo: object = {},
  token = e.cliente.token,
) =>
  e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: ORIGEN, destino: DESTINO, ...cuerpo },
    token,
  );

describe('C-MOTO-SOLO-PRUEBAS: Moto existe solo en el sitio de pruebas', () => {
  it('en producción (divoox.com) Moto no se enciende ni se cotiza', async () => {
    const e = await escenario('divoox.com');
    expect(await encenderMoto(e)).toEqual({ servicio: 409, zona: 409 });
    expect((await ponerTarifa(e)).estado).toBe(201);
    expect((await cotizar(e)).estado).toBe(409);
    const lista = await e.m.llamar('GET', '/datos/admin/servicios', undefined, e.admin.token);
    expect(lista.datos.implementadosEnEsteCodigo).toEqual(['comida']);
  });

  it('en el sitio de pruebas Moto se enciende y la salud sigue en verde', async () => {
    const e = await enPruebas();
    expect(await encenderMoto(e)).toEqual({ servicio: 200, zona: 200 });
    const lista = await e.m.llamar('GET', '/datos/admin/servicios', undefined, e.admin.token);
    expect(lista.datos.implementadosEnEsteCodigo).toEqual(['comida', 'moto']);
    expect((await e.m.llamar('GET', '/datos/salud')).datos.piezas.servicios).toBe('ok');
    // Carro sigue bloqueado aun en pruebas: solo se abre lo que se está construyendo.
    const carro = await e.m.llamar(
      'PUT',
      '/datos/admin/servicios/carro',
      { estado: 'disponible' },
      e.admin.token,
    );
    expect(carro.estado).toBe(409);
  });

  it('si Moto quedara encendida en una base de producción, la salud lo dice en rojo', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    // La misma base vista desde producción: la sincronización la suspende y la salud no la tolera.
    await e.m.DB.prepare(
      "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'moto'",
    ).run();
    const { saludServicios } = await import('./servicios');
    expect(await saludServicios(e.m.DB, 'produccion')).toBe('error');
    expect(await saludServicios(e.m.DB, 'pruebas')).toBe('ok');
  });
});

describe('C-VIAJE-PRECIO-FIJO: tarifa por ciudad', () => {
  it('solo el superadmin pone tarifas, y cada cambio es una versión nueva', async () => {
    const e = await enPruebas();
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/admin/viajes/tarifas',
          { servicio: 'moto', zona: ZONA, tarifa: TARIFA, motivo: 'x x x' },
          e.cliente.token,
        )
      ).estado,
    ).toBe(403);
    const a = await ponerTarifa(e);
    expect(a.estado).toBe(201);
    expect(a.datos.tarifa).toMatchObject({
      moneda: 'USD',
      dePrueba: true,
      activa: true,
      esperaGratisS: 300,
    });
    const b = await ponerTarifa(e, { ...TARIFA, base: 200 }, 'Sube la base');
    expect(b.estado).toBe(201);
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/viajes/tarifas?servicio=moto',
      undefined,
      e.admin.token,
    );
    expect(lista.datos.tarifas).toHaveLength(2);
    expect(lista.datos.tarifas.filter((t: { activa: boolean }) => t.activa)).toHaveLength(1);
    expect(lista.datos.tarifas[0]).toMatchObject({ base: 200, activa: true });
    expect(lista.datos.tarifas[1].cerradaEn).toBeTruthy();
    const audit = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'viaje.tarifa'",
    ).first<{ n: number }>();
    expect(audit?.n).toBe(2);
  });

  it('una tarifa con montos negativos o en una ciudad que no existe no entra', async () => {
    const e = await enPruebas();
    expect((await ponerTarifa(e, { ...TARIFA, base: -5 })).estado).toBe(400);
    const r = await e.m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      { servicio: 'moto', zona: 'US-XX-NADA', tarifa: TARIFA, motivo: 'Prueba' },
      e.admin.token,
    );
    expect(r.estado).toBe(404);
  });
});

describe('C-VIAJE-PRECIO-FIJO: cotización del pasajero', () => {
  it('devuelve el precio fijo con su desglose, guardado en el servidor por 5 minutos', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const r = await cotizar(e);
    expect(r.estado).toBe(201);
    const c = r.datos.cotizacion;
    expect(c).toMatchObject({
      servicio: 'moto',
      moneda: 'USD',
      dePrueba: true,
      zona: { id: ZONA },
    });
    const d = c.desglose;
    expect(
      d.base + d.distancia + d.tiempo + d.ajusteMinimo + d.dinamico + d.cargoFijo + d.redondeo,
    ).toBe(c.total);
    expect(d.distancia).toBe(Math.round((TARIFA.porKm * c.distanciaM) / 1000));
    expect(c.total).toBeGreaterThanOrEqual(TARIFA.minimo);
    const f = await e.m.DB.prepare('SELECT * FROM cotizaciones_viaje WHERE id = ?')
      .bind(c.id)
      .first<Record<string, unknown>>();
    expect(f).toMatchObject({ cliente_id: e.cliente.id, total: c.total, usada_en: null });
    // La cotización guarda la tarifa con que se calculó (la espera y la cancelación usan esa).
    expect(JSON.parse(String(f?.tarifa_json))).toMatchObject({
      ...TARIFA,
      cargoFijo: 0,
      velocidadKmh: 24,
    });
    const vence = new Date(`${String(f?.vence_en).replace(' ', 'T')}Z`).getTime();
    expect(vence - Date.now()).toBeGreaterThan(280_000);
    expect(vence - Date.now()).toBeLessThanOrEqual(300_000);
  });

  it('cotiza con la tarifa activa del momento (la versión nueva manda)', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const antes = (await cotizar(e)).datos.cotizacion.total as number;
    await ponerTarifa(e, { ...TARIFA, base: TARIFA.base + 1000 }, 'Sube la base');
    expect((await cotizar(e)).datos.cotizacion.total).toBe(antes + 1000);
  });

  it('sin servicio encendido o sin tarifa no hay precio', async () => {
    const e = await enPruebas();
    await ponerTarifa(e);
    expect((await cotizar(e)).estado).toBe(409);
    const f = await enPruebas();
    await encenderMoto(f);
    const sin = await cotizar(f);
    expect(sin.estado).toBe(409);
    expect(sin.datos.error).toMatch(/pricing|precio/);
  });

  it('rechaza recogidas fuera de cobertura, destinos de otra ciudad y viajes demasiado cortos', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const lejos = { lat: 4.65, lng: -74.05, direccion: 'Otra ciudad' };
    expect((await cotizar(e, { origen: lejos })).estado).toBe(409);
    expect((await cotizar(e, { destino: lejos })).estado).toBe(422);
    expect((await cotizar(e, { destino: { ...ORIGEN, direccion: 'Al lado' } })).estado).toBe(422);
    expect((await cotizar(e, { servicio: 'comida' })).estado).toBe(400);
  });

  it('solo un pasajero cotiza (un conductor o una visita sin sesión, no)', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const rep = await e.m.cuenta('repartidor', 'Conductor Uno');
    expect((await cotizar(e, {}, rep.token)).estado).toBe(403);
    expect(
      (
        await e.m.llamar('POST', '/datos/viajes/cotizar', {
          servicio: 'moto',
          origen: ORIGEN,
          destino: DESTINO,
        })
      ).estado,
    ).toBe(401);
  });
});

describe('M2: pedir, ver y cancelar un viaje (efectivo)', () => {
  const T2 = { ...TARIFA, cancelacionGratisS: 120, cargoCancelacion: 150, cargoNoSePresento: 200 };
  async function listo() {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e, T2);
    return e;
  }
  const q = (e: Awaited<ReturnType<typeof escenario>>, sql: string, ...v: unknown[]) =>
    e.m.DB.prepare(sql)
      .bind(...v)
      .run();
  const uno = <T>(e: Awaited<ReturnType<typeof escenario>>, sql: string, ...v: unknown[]) =>
    e.m.DB.prepare(sql)
      .bind(...v)
      .first<T>();
  async function pedir(e: Awaited<ReturnType<typeof escenario>>, token = e.cliente.token) {
    const c = (await cotizar(e, {}, token)).datos.cotizacion;
    const r = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: c.id, metodoPago: 'efectivo' },
      token,
    );
    return { cot: c, r, id: r.datos.viaje?.id as string };
  }
  let k = 0;
  const cancelar = (
    e: Awaited<ReturnType<typeof escenario>>,
    id: string,
    token = e.cliente.token,
  ) =>
    e.m.crudo(`/datos/viajes/${id}/cancelar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': `cancelar-${++k}-cliente`,
      },
      body: '{}',
    });

  it('pedir crea el viaje buscando con su código; repetir no crea otro; uno a la vez', async () => {
    const e = await listo();
    const { cot, r, id } = await pedir(e);
    expect(r.estado).toBe(201);
    const otra = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      e.cliente.token,
    );
    expect(otra.estado).toBe(200);
    expect(otra.datos.viaje.id).toBe(id);
    const act = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje;
    expect(act).toMatchObject({
      id,
      estado: 'buscando',
      total: cot.total,
      metodoPago: 'efectivo',
      conductor: null,
    });
    expect(act.pin).toMatch(/^\d{4}$/);
    expect(act.cancelacion).toEqual({ cargo: 0, gratisPorS: null });
    // Con un viaje activo no se pide otro.
    expect((await pedir(e)).r.estado).toBe(409);
    expect(
      await uno(
        e,
        "SELECT COUNT(*) AS n FROM operaciones WHERE cliente_id = ? AND tipo_operacion = 'viaje_pasajero'",
        e.cliente.id,
      ),
    ).toEqual({ n: 1 });
  });

  it('una cotización vencida o de otro pasajero no sirve', async () => {
    const e = await listo();
    const c = (await cotizar(e)).datos.cotizacion;
    const otro = await e.m.cuenta('cliente', 'Otro');
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/viajes',
          { cotizacionId: c.id, metodoPago: 'efectivo' },
          otro.token,
        )
      ).estado,
    ).toBe(404);
    await q(
      e,
      "UPDATE cotizaciones_viaje SET vence_en = datetime('now', '-1 second') WHERE id = ?",
      c.id,
    );
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/viajes',
          { cotizacionId: c.id, metodoPago: 'efectivo' },
          e.cliente.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('cancelar mientras se busca es gratis y no deja deuda', async () => {
    const e = await listo();
    const { id } = await pedir(e);
    const r = await cancelar(e, id);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, cargo: 0 });
    expect(await uno(e, 'SELECT estado_general FROM operaciones WHERE id = ?', id)).toEqual({
      estado_general: 'cancelada',
    });
    expect(await uno(e, 'SELECT COUNT(*) AS n FROM deudas_pasajero')).toEqual({ n: 0 });
  });

  it('con conductor: gratis en la ventana desde la asignación; después, el cargo queda como deuda', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    // Pedir busca conductor al instante: la oferta ya está.
    expect(
      await uno(
        e,
        'SELECT estado FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?',
        id,
        cond.id,
      ),
    ).toEqual({ estado: 'ofrecida' });
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const act = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje;
    expect(act.estado).toBe('asignado');
    expect(act.conductor).toMatchObject({
      nombre: 'Conductor',
      vehiculo: { marca: 'Yamaha', modelo: 'NMAX', color: 'Negro' },
    });
    expect(act.cancelacion.cargo).toBe(0);
    expect(act.cancelacion.gratisPorS).toBeGreaterThan(100);
    await q(
      e,
      "UPDATE viajes SET asignado_en = datetime('now', '-200 seconds') WHERE operacion_id = ?",
      id,
    );
    const r = await cancelar(e, id);
    expect(await r.json()).toMatchObject({ ok: true, cargo: 150 });
    expect(
      await uno(e, 'SELECT motivo, monto, estado FROM deudas_pasajero WHERE operacion_id = ?', id),
    ).toEqual({ motivo: 'cancelacion', monto: 150, estado: 'pendiente' });
    const luego = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token))
      .datos;
    expect(luego).toMatchObject({ viaje: null, deudaPendiente: { monto: 150, moneda: 'USD' } });
    // El conductor quedó libre.
    expect(
      await uno(e, 'SELECT 1 AS x FROM conductor_ocupacion WHERE conductor_id = ?', cond.id),
    ).toBeNull();
  });

  it('un viaje en curso no se cancela desde la app', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin;
    expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
    expect((await cancelar(e, id)).status).toBe(409);
    expect(
      (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos.viaje.pin,
    ).toBeNull();
  });

  it('«no se presentó» deja la deuda de la tarifa del viaje', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    await q(
      e,
      "UPDATE viajes SET llego_en = datetime('now', '-301 seconds') WHERE operacion_id = ?",
      id,
    );
    expect(await cond.paso(id, 'no-se-presento')).toBe(200);
    expect(
      await uno(e, 'SELECT motivo, monto FROM deudas_pasajero WHERE operacion_id = ?', id),
    ).toEqual({ motivo: 'no_se_presento', monto: 200 });
  });

  it('sin conductor en 10 minutos, el viaje se cierra como «sin conductor»', async () => {
    const e = await listo();
    const { id } = await pedir(e);
    await q(
      e,
      "UPDATE operaciones SET creado_en = datetime('now', '-11 minutes') WHERE id = ?",
      id,
    );
    await repartirOperaciones(undefined, e.m.DB);
    expect(await uno(e, 'SELECT estado FROM viajes WHERE operacion_id = ?', id)).toEqual({
      estado: 'sin_conductor',
    });
    expect(
      (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos.viaje
        .estado,
    ).toBe('sin_conductor');
  });

  it('nadie más ve ni cancela mi viaje', async () => {
    const e = await listo();
    const { id } = await pedir(e);
    const otro = await e.m.cuenta('cliente', 'Otro');
    expect((await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, otro.token)).estado).toBe(
      404,
    );
    expect((await cancelar(e, id, otro.token)).status).toBe(404);
  });
});

describe('M3 (C-OFERTA-COMPLETA): la oferta del conductor y el despacho sin esperar al reloj', () => {
  async function listo() {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    return e;
  }
  async function pedir(e: Awaited<ReturnType<typeof escenario>>) {
    const c = (await cotizar(e)).datos.cotizacion;
    const r = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: c.id, metodoPago: 'efectivo' },
      e.cliente.token,
    );
    return { cot: c, id: r.datos.viaje.id as string };
  }
  const ofertas = (e: Awaited<ReturnType<typeof escenario>>, token: string) =>
    e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, token);

  it('el conductor ve ganancia, recogida, destino, duración y forma de pago antes de aceptar', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, { lat: ORIGEN.lat + 0.005, lng: ORIGEN.lng });
    const { cot, id } = await pedir(e);
    const o = (await ofertas(e, cond.token)).datos.ofertas;
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({
      operacionId: id,
      gananciaCentavos: cot.total, // sin política de comisión, gana todo
      moneda: 'USD',
      destino: DESTINO.direccion,
      viajeM: cot.distanciaM,
      viajeS: cot.duracionS,
      metodoPago: 'efectivo',
    });
    expect(o[0].recogidaM).toBeGreaterThan(500);
    expect(o[0].recogidaM).toBeLessThan(600);
  });

  it('con una política de comisión vigente, la ganancia ya la descuenta', async () => {
    const e = await listo();
    await e.m.DB.prepare(
      `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('pol-ride', 'ride', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
    ).run();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const { cot } = await pedir(e);
    const o = (await ofertas(e, cond.token)).datos.ofertas;
    expect(o[0].gananciaCentavos).toBe(cot.total - Math.round(cot.total / 10));
  });

  it('si el conductor la rechaza, pasa al siguiente de una vez', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const b = await conductorDeMoto(e.m, { lat: ORIGEN.lat + 0.01, lng: ORIGEN.lng });
    const { id } = await pedir(e);
    expect((await ofertas(e, a.token)).datos.ofertas).toHaveLength(1);
    expect((await ofertas(e, b.token)).datos.ofertas).toHaveLength(0);
    expect(await a.paso(id, 'rechazar')).toBe(200);
    expect((await ofertas(e, b.token)).datos.ofertas).toHaveLength(1);
  });

  it('si la oferta vence, la consulta del pasajero la pasa al siguiente', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const b = await conductorDeMoto(e.m, { lat: ORIGEN.lat + 0.01, lng: ORIGEN.lng });
    const { id } = await pedir(e);
    await e.m.DB.prepare(
      "UPDATE ofertas_operacion SET expira_en = datetime('now', '-1 second') WHERE operacion_id = ? AND conductor_id = ?",
    )
      .bind(id, a.id)
      .run();
    expect((await ofertas(e, b.token)).datos.ofertas).toHaveLength(0);
    await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect((await ofertas(e, b.token)).datos.ofertas).toHaveLength(1);
  });
});

describe('M6 (C-VIAJE-SEGURIDAD): emergencia y viaje compartido', () => {
  async function conViaje() {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const c = (await cotizar(e)).datos.cotizacion;
    const id = (
      await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: c.id, metodoPago: 'efectivo' },
        e.cliente.token,
      )
    ).datos.viaje.id as string;
    return { e, cond, id };
  }

  it('el botón de emergencia del pasajero y del conductor queda registrado y da el número del país', async () => {
    const { e, cond, id } = await conViaje();
    const r = await e.m.llamar(
      'POST',
      `/datos/viajes/${id}/emergencia`,
      { lat: 25.76, lng: -80.19 },
      e.cliente.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.numero).toBe('911');
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const d = await e.m.llamar(
      'POST',
      `/datos/conductor/operaciones/${id}/emergencia`,
      {},
      cond.token,
    );
    expect(d.datos.numero).toBe('911');
    const { results } = await e.m.DB.prepare(
      'SELECT rol, lat FROM emergencias_viaje WHERE operacion_id = ? ORDER BY creado_en, rol',
    )
      .bind(id)
      .all();
    expect(results.map((x) => x.rol).sort()).toEqual(['conductor', 'pasajero']);
    const otro = await e.m.cuenta('cliente', 'Otro');
    expect(
      (await e.m.llamar('POST', `/datos/viajes/${id}/emergencia`, {}, otro.token)).estado,
    ).toBe(404);
  });

  it('el enlace compartido muestra el viaje en vivo sin cuenta y deja de mostrarlo al terminar', async () => {
    const { e, cond, id } = await conViaje();
    const r = await e.m.llamar('POST', `/datos/viajes/${id}/compartir`, {}, e.cliente.token);
    expect(r.estado).toBe(201);
    const codigo = String(r.datos.url).split('/ride/')[1] ?? '';
    expect(codigo).toMatch(/^[A-Za-z0-9_-]{40,60}$/);
    // Solo se guarda la huella, nunca el código.
    expect(
      await e.m.DB.prepare('SELECT 1 AS x FROM viajes_compartidos WHERE huella = ?')
        .bind(codigo)
        .first(),
    ).toBeNull();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const vivo = await e.m.llamar('GET', `/datos/publico/viaje/${codigo}`);
    expect(vivo.datos.viaje).toMatchObject({
      estado: 'asignado',
      terminado: false,
      conductor: 'Conductor',
      destino: DESTINO.direccion,
    });
    expect(vivo.datos.viaje.vehiculo.marca).toBe('Yamaha');
    // Al terminar no se ve nada más del viaje.
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin;
    expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200);
    const fin = await e.m.llamar('GET', `/datos/publico/viaje/${codigo}`);
    expect(fin.datos.viaje).toEqual({ estado: 'terminado', terminado: true });
    expect(
      (await e.m.llamar('POST', `/datos/viajes/${id}/compartir`, {}, e.cliente.token)).estado,
    ).toBe(409);
  });

  it('un código inventado o mal formado no muestra nada', async () => {
    const e = await enPruebas();
    expect((await e.m.llamar('GET', `/datos/publico/viaje/${'a'.repeat(43)}`)).estado).toBe(404);
    expect((await e.m.llamar('GET', '/datos/publico/viaje/corto')).estado).toBe(404);
  });
});

describe('M7 (C-VIAJE-COMISION): comisión del prepago, espera y deudas', () => {
  const T7 = { ...TARIFA, porMinutoEspera: 20, cancelacionGratisS: 120, cargoCancelacion: 150 };
  async function listo(conPolitica = true) {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e, T7);
    if (conPolitica)
      await e.m.DB.prepare(
        `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
         VALUES ('pol-ride', 'ride', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
      ).run();
    return e;
  }
  const recargar = (e: Awaited<ReturnType<typeof escenario>>, cuenta: string, monto: number) =>
    e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES (?, ?, 'prepago', 'US', 'USD', ?, 'recarga_prueba', ?)",
    )
      .bind(crypto.randomUUID(), cuenta, monto, `recarga-prueba:${cuenta}:${monto}`)
      .run();
  const bolsillo = async (e: Awaited<ReturnType<typeof escenario>>, cuenta: string, b: string) =>
    Number(
      (
        await e.m.DB.prepare(
          'SELECT COALESCE(SUM(monto), 0) AS s FROM libro WHERE cuenta_id = ? AND bolsillo = ?',
        )
          .bind(cuenta, b)
          .first<{ s: number }>()
      )?.s,
    );
  async function pedir(e: Awaited<ReturnType<typeof escenario>>) {
    const c = (await cotizar(e)).datos.cotizacion;
    const id = (
      await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: c.id, metodoPago: 'efectivo' },
        e.cliente.token,
      )
    ).datos.viaje.id as string;
    return { cot: c, id };
  }
  async function hacerViaje(
    e: Awaited<ReturnType<typeof escenario>>,
    cond: Awaited<ReturnType<typeof conductorDeMoto>>,
    id: string,
    esperaS = 0,
  ) {
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    if (esperaS)
      await e.m.DB.prepare("UPDATE viajes SET llego_en = datetime('now', ?) WHERE operacion_id = ?")
        .bind(`-${esperaS} seconds`, id)
        .run();
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin;
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
    return (await r.json()) as { totalFinal: number };
  }

  it('aparta la comisión al aceptar y la cobra al terminar, una sola vez', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const { cot, id } = await pedir(e);
    const comision = Math.round(cot.total / 10);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await bolsillo(e, cond.id, 'reservado')).toBe(comision);
    expect(await bolsillo(e, cond.id, 'prepago')).toBe(10_000 - comision);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin;
    expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200); // reintento
    expect(await bolsillo(e, cond.id, 'reservado')).toBe(0);
    expect(await bolsillo(e, cond.id, 'prepago')).toBe(10_000 - comision);
    expect(await bolsillo(e, 'tumbite', 'comisiones')).toBe(comision);
  });

  it('sin saldo suficiente no acepta, y el viaje sigue buscando', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 1);
    const { id } = await pedir(e);
    expect(await cond.paso(id, 'aceptar')).toBe(409);
    expect(await bolsillo(e, cond.id, 'prepago')).toBe(1);
    expect(
      (await e.m.DB.prepare('SELECT estado FROM viajes WHERE operacion_id = ?').bind(id).first())
        ?.estado,
    ).toBe('buscando');
  });

  it('si el pasajero cancela o el conductor suelta, lo apartado vuelve al prepago', async () => {
    const e = await listo();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await recargar(e, cond.id, 10_000);
    const a = await pedir(e);
    expect(await cond.paso(a.id, 'aceptar')).toBe(200);
    expect(await cond.paso(a.id, 'liberar', { motivo: 'prueba' })).toBe(200);
    expect(await bolsillo(e, cond.id, 'reservado')).toBe(0);
    expect(await bolsillo(e, cond.id, 'prepago')).toBe(10_000);
    // El viaje vuelve a buscar y pasa a OTRO conductor (al que lo soltó no se le ofrece de nuevo);
    // ese lo acepta y el pasajero cancela.
    const otro = await conductorDeMoto(e.m, { lat: ORIGEN.lat + 0.002, lng: ORIGEN.lng });
    await recargar(e, otro.id, 10_000);
    await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect(await otro.paso(a.id, 'aceptar')).toBe(200);
    expect(await bolsillo(e, otro.id, 'reservado')).toBeGreaterThan(0);
    const r = await e.m.crudo(`/datos/viajes/${a.id}/cancelar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${e.cliente.token}`,
        'content-type': 'application/json',
        'idempotency-key': 'cancelar-m7-cliente',
      },
      body: '{}',
    });
    expect(r.status).toBe(200);
    expect(await bolsillo(e, otro.id, 'reservado')).toBe(0);
    expect(await bolsillo(e, otro.id, 'prepago')).toBe(10_000);
    expect(await bolsillo(e, 'tumbite', 'comisiones')).toBe(0);
  });

  it('sin política que rija no se aparta nada (EE. UU. sigue con su modelo)', async () => {
    const e = await listo(false);
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const { cot, id } = await pedir(e);
    const r = await hacerViaje(e, cond, id);
    expect(r.totalFinal).toBe(cot.total);
    expect(await bolsillo(e, cond.id, 'reservado')).toBe(0);
  });

  it('la espera pasada la gratis y la deuda anterior se suman a lo que se cobra en efectivo', async () => {
    const e = await listo(false);
    const cond = await conductorDeMoto(e.m, ORIGEN);
    // Una deuda pendiente de un viaje anterior.
    const viejo = await pedir(e);
    expect(await cond.paso(viejo.id, 'aceptar')).toBe(200);
    await e.m.DB.prepare(
      "UPDATE viajes SET asignado_en = datetime('now', '-200 seconds') WHERE operacion_id = ?",
    )
      .bind(viejo.id)
      .run();
    await e.m.crudo(`/datos/viajes/${viejo.id}/cancelar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${e.cliente.token}`,
        'content-type': 'application/json',
        'idempotency-key': 'cancelar-deuda-m7',
      },
      body: '{}',
    });
    const { cot, id } = await pedir(e);
    // 400 s esperando: 100 s pasados de los 300 gratis = 2 minutos empezados × 20.
    const r = await hacerViaje(e, cond, id, 400);
    expect(r.totalFinal).toBe(cot.total + 40 + 150);
    expect(
      await e.m.DB.prepare('SELECT estado, cobrada_en FROM deudas_pasajero WHERE operacion_id = ?')
        .bind(viejo.id)
        .first(),
    ).toEqual({ estado: 'cobrada', cobrada_en: id });
    const luego = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token))
      .datos;
    expect(luego.deudaPendiente).toBeNull();
  });
});

describe('M7: la salud de los viajes (conciliación)', () => {
  it('en verde sin nada colgado; en rojo si un viaje cerrado conserva comisión apartada', async () => {
    const e = await enPruebas();
    expect((await e.m.llamar('GET', '/datos/salud')).datos.piezas.viajes).toBe('ok');
    await encenderMoto(e);
    await ponerTarifa(e);
    const c = (await cotizar(e)).datos.cotizacion;
    const id = (
      await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: c.id, metodoPago: 'efectivo' },
        e.cliente.token,
      )
    ).datos.viaje.id as string;
    // Una reserva olvidada en un viaje cancelado hace rato.
    await e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('x1', 'alguien', 'reservado', 'US', 'USD', 50, 'reserva_viaje:ride', ?)",
    )
      .bind(`reserva_viaje:${id}:alguien:reservado`)
      .run();
    await e.m.DB.prepare(
      "UPDATE viajes SET estado = 'cancelado', ultimo_actor = 'cliente', ultima_clave = 'x-cancel' WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await e.m.DB.prepare(
      "UPDATE operaciones SET actualizado_en = datetime('now', '-11 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    expect((await e.m.llamar('GET', '/datos/salud')).datos.piezas.viajes).toBe('error');
  });
});
