import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { validarSubida } from './subirTarifa';

/**
 * C-SUBIR-TARIFA (18 nov 2026; pedido de los mototaxistas del piloto vía Gerencia). Si nadie acepta,
 * el pasajero sube la tarifa con un toque (como «Aumentar tarifa» de inDrive y DiDi): el viaje no se
 * cancela, se vuelve a ofrecer en el acto con el precio nuevo, también a quien lo dejó vencer o lo
 * rechazó. Apagado por defecto; se enciende por ciudad y servicio desde el superadmin.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const SUBIDA = { pasos: [25, 50, 100], esperaS: 40, maxVeces: 3, topePb: 15_000 };

async function listo(subida: typeof SUBIDA | null = SUBIDA) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
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
    {
      servicio: 'moto',
      zona: ZONA,
      tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  if (subida) {
    const r = await m.llamar(
      'PUT',
      '/datos/admin/viajes/ajustes',
      { zona: ZONA, servicio: 'moto', pin: 'siempre', selfieCasco: false, subida },
      admin.token,
    );
    expect(r.estado).toBe(200);
  }
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof listo>>;

async function pedir(e: E) {
  const c = (
    await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      e.cliente.token,
    )
  ).datos.cotizacion;
  const r = await e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: c.id, metodoPago: 'efectivo' },
    e.cliente.token,
  );
  return { id: r.datos.viaje.id as string, total: c.total as number };
}
/** El viaje lleva `s` segundos buscando (y su última subida, si la hay, también). */
async function esperar(e: E, op: string, s = 60) {
  await e.m.DB.prepare("UPDATE operaciones SET creado_en = datetime('now', ?) WHERE id = ?")
    .bind(`-${s} seconds`, op)
    .run();
  await e.m.DB.prepare(
    "UPDATE eventos_operacion SET creado_en = datetime('now', ?) WHERE operacion_id = ?",
  )
    .bind(`-${s} seconds`, op)
    .run();
  await e.m.DB.prepare(
    "UPDATE cambios_viaje SET creado_en = datetime('now', ?) WHERE operacion_id = ?",
  )
    .bind(`-${s} seconds`, op)
    .run();
}
const subir = (e: E, op: string, monto: number, clave: string) =>
  e.m.llamar('POST', `/datos/viajes/${op}/subir-tarifa`, { monto, clave }, e.cliente.token);
const total = async (e: E, op: string) =>
  Number(
    (
      await e.m.DB.prepare(
        'SELECT q.total FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?',
      )
        .bind(op)
        .first<{ total: number }>()
    )?.total,
  );
const ofertas = async (e: E, token: string) =>
  (await e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, token)).datos
    .ofertas as { operacionId: string; gananciaCentavos: number; tarifaSubida?: boolean }[];

describe('C-SUBIR-TARIFA: el pasajero sube la tarifa cuando nadie acepta', () => {
  it('apagado por defecto: sin ajuste de la ciudad no se puede subir', async () => {
    const e = await listo(null);
    const { id } = await pedir(e);
    await esperar(e, id);
    const r = await subir(e, id, 50, 'k1');
    expect(r.estado).toBe(409);
    const a = await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect(a.datos.subida ?? null).toBeNull();
  });

  it('el viaje dice cuándo y cuánto se puede subir; antes de la espera, no', async () => {
    const e = await listo();
    const { id } = await pedir(e);
    const a = await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect(a.datos.subida).toMatchObject({ pasos: [25, 50, 100], quedan: 3 });
    expect(a.datos.subida.enSegundos).toBeGreaterThan(30);
    expect((await subir(e, id, 50, 'k1')).estado).toBe(409);
  });

  it('subir no cancela: suma al precio, queda en el registro y es idempotente', async () => {
    const e = await listo();
    const { id, total: antes } = await pedir(e);
    await esperar(e, id);
    const r = await subir(e, id, 50, 'k1');
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ total: antes + 50, subida: 50 });
    expect(await total(e, id)).toBe(antes + 50);
    // Dos toques con la misma clave no suben dos veces.
    expect((await subir(e, id, 50, 'k1')).datos.total).toBe(antes + 50);
    expect(await total(e, id)).toBe(antes + 50);
    const ev = await e.m.DB.prepare(
      "SELECT actor_rol, datos_json FROM eventos_operacion WHERE operacion_id = ? AND tipo = 'subida_tarifa'",
    )
      .bind(id)
      .all<{ actor_rol: string; datos_json: string }>();
    expect(ev.results).toHaveLength(1);
    expect(JSON.parse(ev.results[0]!.datos_json)).toMatchObject({
      monto: 50,
      antes,
      despues: antes + 50,
    });
    const v = await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect(v.datos.viaje.estado).toBe('buscando');
    // El recibo lo dice aparte (el desglose suma el total).
    const d = await e.m.DB.prepare(
      'SELECT q.desglose_json FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?',
    )
      .bind(id)
      .first<{ desglose_json: string }>();
    expect(JSON.parse(d!.desglose_json)).toMatchObject({ subidaPasajero: 50, total: antes + 50 });
  });

  it('solo los montos de la ciudad, con tope de veces y de precio', async () => {
    const e = await listo({ ...SUBIDA, maxVeces: 2, topePb: 30_000 });
    const { id } = await pedir(e);
    await esperar(e, id);
    expect((await subir(e, id, 30, 'x')).estado).toBe(422);
    expect((await subir(e, id, 100, 'a')).estado).toBe(200);
    expect((await subir(e, id, 100, 'b')).estado).toBe(409); // hay que esperar otra vez
    await esperar(e, id);
    expect((await subir(e, id, 100, 'b')).estado).toBe(200);
    await esperar(e, id);
    const r = await subir(e, id, 25, 'c');
    expect(r.estado).toBe(409); // ya subió las veces permitidas
  });

  it('se vuelve a ofrecer en el acto a quien lo rechazó, con el precio nuevo y la marca', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id, total: antes } = await pedir(e);
    expect(await a.paso(id, 'rechazar')).toBe(200);
    expect(await ofertas(e, a.token)).toHaveLength(0);
    await esperar(e, id);
    expect((await subir(e, id, 100, 'k1')).estado).toBe(200);
    const o = await ofertas(e, a.token);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({
      operacionId: id,
      gananciaCentavos: antes + 100,
      tarifaSubida: true,
    });
  });

  it('a quien ya llegó al tope de reofertas (C-REOFERTA-TOPE) le llega el precio nuevo', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    for (let i = 0; i < 4; i++) {
      await e.m.DB.prepare(
        "UPDATE ofertas_operacion SET expira_en = datetime('now', '-40 seconds') WHERE operacion_id = ?",
      )
        .bind(id)
        .run();
      await ofertas(e, a.token);
    }
    await e.m.DB.prepare(
      "UPDATE ofertas_operacion SET expira_en = datetime('now', '-40 seconds') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    expect(await ofertas(e, a.token)).toHaveLength(0);
    await esperar(e, id);
    expect((await subir(e, id, 50, 'k1')).estado).toBe(200);
    const o = await ofertas(e, a.token);
    expect(o).toHaveLength(1);
    expect(o[0]?.tarifaSubida).toBe(true);
  });

  it('con prepago, la comisión se calcula sobre el precio nuevo', async () => {
    const e = await listo();
    await e.m.DB.prepare(
      `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('pol-ride', 'ride', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
    ).run();
    const a = await conductorDeMoto(e.m, ORIGEN);
    await e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('rec-1', ?, 'prepago', 'US', 'USD', 10000, 'recarga', 'rec-1')",
    )
      .bind(a.id)
      .run();
    const { id, total: antes } = await pedir(e);
    expect(await a.paso(id, 'rechazar')).toBe(200);
    await esperar(e, id);
    await subir(e, id, 100, 'k1');
    const nuevo = antes + 100;
    expect((await ofertas(e, a.token))[0]?.gananciaCentavos).toBe(nuevo - Math.round(nuevo / 10));
  });

  it('nadie más sube un viaje ajeno, ni uno que ya tiene conductor', async () => {
    const e = await listo();
    const otro = await e.m.cuenta('cliente', 'Otro Pasajero');
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    await esperar(e, id);
    const ajeno = await e.m.llamar(
      'POST',
      `/datos/viajes/${id}/subir-tarifa`,
      { monto: 50, clave: 'z' },
      otro.token,
    );
    expect(ajeno.estado).toBe(404);
    expect(await a.paso(id, 'aceptar')).toBe(200);
    expect((await subir(e, id, 50, 'k1')).estado).toBe(409);
  });

  it('las subidas no cuentan como cambios de paradas', async () => {
    const e = await listo();
    const { id } = await pedir(e);
    await esperar(e, id);
    await subir(e, id, 25, 'k1');
    const n = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM cambios_viaje WHERE operacion_id = ? AND tipo = 'paradas'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(Number(n?.n)).toBe(0);
  });
});

describe('validarSubida (dinero en centavos enteros)', () => {
  const base = {
    pasos: [25, 50, 100],
    maxVeces: 3,
    topePb: 15_000,
    original: 400,
    actual: 400,
    hechas: 0,
    monto: 50,
    metodoPago: 'efectivo',
    autorizado: null as number | null,
  };
  it('suma el paso y deja el precio en centavos enteros', () => {
    expect(validarSubida(base)).toEqual({ ok: true, nuevo: 450 });
  });
  it('no pasa del tope (múltiplo de la cotización original)', () => {
    expect(validarSubida({ ...base, actual: 580, monto: 50 })).toMatchObject({
      ok: false,
      motivo: 'tope',
    });
    expect(validarSubida({ ...base, actual: 550, monto: 50 })).toEqual({ ok: true, nuevo: 600 });
  });
  it('con tarjeta no pasa de lo autorizado (EE. UU.: sin nueva autorización, no se sube)', () => {
    expect(validarSubida({ ...base, metodoPago: 'tarjeta', autorizado: 400 })).toMatchObject({
      ok: false,
      motivo: 'tarjeta',
    });
    expect(validarSubida({ ...base, metodoPago: 'tarjeta', autorizado: null })).toMatchObject({
      ok: false,
      motivo: 'tarjeta',
    });
  });
  it('montos fuera de la lista y veces de más, no', () => {
    expect(validarSubida({ ...base, monto: 30 })).toMatchObject({ ok: false, motivo: 'monto' });
    expect(validarSubida({ ...base, hechas: 3 })).toMatchObject({ ok: false, motivo: 'veces' });
  });
});
