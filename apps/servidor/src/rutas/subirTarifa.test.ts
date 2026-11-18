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

describe('C-SUBIR-TARIFA · dictamen del revisor (18 nov 2026)', () => {
  it('B1: cambiar las paradas después de subir conserva la subida en el total y en el desglose', async () => {
    const e = await listo();
    const { id, total: antes } = await pedir(e);
    await esperar(e, id);
    expect((await subir(e, id, 100, 'k1')).estado).toBe(200);
    const r = await e.m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      {
        paradas: [{ lat: ORIGEN.lat + 0.01, lng: ORIGEN.lng + 0.01, direccion: 'Parada uno' }],
        confirmar: true,
      },
      e.cliente.token,
    );
    expect(r.estado).toBe(200);
    const d = await e.m.DB.prepare(
      'SELECT q.total, q.desglose_json FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?',
    )
      .bind(id)
      .first<{ total: number; desglose_json: string }>();
    const desglose = JSON.parse(d!.desglose_json) as Record<string, number>;
    expect(desglose.subidaPasajero).toBe(100);
    expect(Number(d!.total)).toBe(desglose.total);
    expect(Number(d!.total)).toBeGreaterThanOrEqual(antes + 100);
    const suma = Object.entries(desglose)
      .filter(([k]) => k !== 'total')
      .reduce((x, [, v]) => x + v, 0);
    expect(suma).toBe(desglose.total);
  });

  it('B2: la oferta nacida en el mismo segundo que la subida no se trata como anterior (tope y respiro intactos)', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    await esperar(e, id);
    expect((await subir(e, id, 25, 'k1')).estado).toBe(200);
    // La oferta del precio nuevo nace en el mismo segundo que la subida; la deja vencer «ya».
    await e.m.DB.prepare(
      "UPDATE ofertas_operacion SET estado = 'vencida', expira_en = datetime('now') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    // Recién vencida: respiro. No vuelve en el acto (antes volvía y reiniciaba los intentos).
    expect(await ofertas(e, a.token)).toHaveLength(0);
  });

  it('I1: con la pieza apagada o fuera de «buscando», el sondeo no consulta las subidas', async () => {
    const e = await listo(null);
    const { id } = await pedir(e);
    const { estadoSubida } = await import('./subirTarifa');
    const consultas: string[] = [];
    const db = new Proxy(e.m.DB, {
      get(t, k) {
        if (k === 'prepare')
          return (sql: string) => {
            consultas.push(sql);
            return t.prepare(sql);
          };
        const v = Reflect.get(t, k) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    expect(await estadoSubida(db, id, e.cliente.id, 'asignado')).toBeNull();
    expect(consultas).toHaveLength(0);
    expect(await estadoSubida(db, id, e.cliente.id, 'buscando')).toBeNull();
    expect(consultas).toHaveLength(1);
  });

  it('I2: con tarjeta nunca se sube, de punta a punta', async () => {
    const e = await listo();
    const { id } = await pedir(e);
    await e.m.DB.prepare("UPDATE viajes SET metodo_pago = 'tarjeta' WHERE operacion_id = ?")
      .bind(id)
      .run();
    await esperar(e, id);
    const r = await subir(e, id, 25, 'k1');
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/tarjeta|card/);
    const a = await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect(a.datos.subida).toBeNull();
  });

  it('I3 y I5: dos toques a la vez con la misma clave suben una vez; con claves distintas, una sola pasa', async () => {
    const e = await listo();
    const { id, total: antes } = await pedir(e);
    await esperar(e, id);
    const [x, y] = await Promise.all([subir(e, id, 50, 'misma'), subir(e, id, 50, 'misma')]);
    expect([x.estado, y.estado]).toEqual([200, 200]);
    expect(await total(e, id)).toBe(antes + 50);
    await esperar(e, id);
    const [p, q] = await Promise.all([subir(e, id, 25, 'una'), subir(e, id, 25, 'otra')]);
    expect([p.estado, q.estado].sort()).toEqual([200, 409]);
    expect(await total(e, id)).toBe(antes + 75);
  });

  it('I5: con pago móvil se sube igual (lo paga en mano el pasajero)', async () => {
    const e = await listo();
    const { id, total: antes } = await pedir(e);
    await e.m.DB.prepare("UPDATE viajes SET metodo_pago = 'pago_movil' WHERE operacion_id = ?")
      .bind(id)
      .run();
    await esperar(e, id);
    expect((await subir(e, id, 25, 'k1')).estado).toBe(200);
    expect(await total(e, id)).toBe(antes + 25);
  });

  it('I5: si con el precio nuevo al conductor no le alcanza el saldo para la comisión, no se le ofrece', async () => {
    const e = await listo();
    await e.m.DB.prepare(
      `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('pol-ride', 'ride', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
    ).run();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id, total: antes } = await pedir(e);
    // Le alcanza justo para la comisión del precio original, no para la del nuevo.
    await e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('rec-1', ?, 'prepago', 'US', 'USD', ?, 'recarga', 'rec-1')",
    )
      .bind(a.id, Math.round(antes / 10))
      .run();
    expect(await a.paso(id, 'rechazar')).toBe(200);
    await esperar(e, id);
    expect((await subir(e, id, 100, 'k1')).estado).toBe(200);
    expect(await ofertas(e, a.token)).toHaveLength(0);
  });

  it('M4 e I5: si acepta la oferta vieja retirada por la subida, se le dice por qué', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const b = await conductorDeMoto(e.m, { lat: ORIGEN.lat + 0.03, lng: ORIGEN.lng });
    const { id } = await pedir(e);
    expect(await ofertas(e, a.token)).toHaveLength(1);
    await esperar(e, id);
    // Sube mientras «a» tiene la oferta abierta: se retira y pasa al precio nuevo.
    expect((await subir(e, id, 50, 'k1')).estado).toBe(200);
    await e.m.DB.prepare(
      "UPDATE ofertas_operacion SET estado = 'retirada' WHERE operacion_id = ? AND conductor_id = ?",
    )
      .bind(id, a.id)
      .run();
    const r = await e.m.llamar('POST', `/datos/conductor/operaciones/${id}/aceptar`, {}, a.token, {
      'idempotency-key': `acep-${id.slice(0, 8)}`,
    });
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/subió la tarifa|raised the fare/);
    void b;
  });

  it('I5: el recibo y «Mis viajes» llevan el precio nuevo y la línea de la subida', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id, total: antes } = await pedir(e);
    expect(await a.paso(id, 'rechazar')).toBe(200);
    await esperar(e, id);
    await subir(e, id, 50, 'k1');
    const h = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    const fila = (h.datos.viajes as { id: string; total: number }[]).find((x) => x.id === id);
    expect(fila?.total).toBe(antes + 50);
    const r = await e.m.llamar('GET', `/datos/viajes/${id}/recibo`, undefined, e.cliente.token);
    if (r.estado === 200) {
      expect(r.datos.recibo?.desglose?.subidaPasajero ?? r.datos.desglose?.subidaPasajero).toBe(50);
    }
  });

  it('I4: el superadmin no guarda pasos repetidos, desordenados ni por encima del tope de la moneda', async () => {
    const e = await listo(null);
    const poner = (pasos: number[]) =>
      e.m.llamar(
        'PUT',
        '/datos/admin/viajes/ajustes',
        { zona: ZONA, servicio: 'moto', pin: 'siempre', selfieCasco: false, subida: { pasos } },
        e.admin.token,
      );
    expect((await poner([50, 25])).estado).toBe(400);
    expect((await poner([25, 25])).estado).toBe(400);
    expect((await poner([25, 50, 5_000])).estado).toBe(422);
    expect((await poner([25, 50, 100])).estado).toBe(200);
  });

  it('M2: con la pieza apagada, una oferta «ofrecida» vencida de otro viaje no se reabre por el lado de la subida', async () => {
    const { vuelveAOfrecerseUpsert } = await import('../operaciones');
    expect(vuelveAOfrecerseUpsert('o')).not.toMatch(/'ofrecida'/);
  });
});

describe('C-SUBIR-TARIFA · conductor de confianza (revisor, I5)', () => {
  it('si el conductor de confianza rechazó, con la subida le vuelve a llegar el precio nuevo', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id, total: antes } = await pedir(e);
    await e.m.DB.prepare('UPDATE viajes SET conductor_preferido_id = ? WHERE operacion_id = ?')
      .bind(a.id, id)
      .run();
    expect(await a.paso(id, 'rechazar')).toBe(200);
    expect(await ofertas(e, a.token)).toHaveLength(0);
    await esperar(e, id);
    expect((await subir(e, id, 50, 'k1')).estado).toBe(200);
    const o = await ofertas(e, a.token);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ gananciaCentavos: antes + 50, tarifaSubida: true });
  });
});

describe('C-SUBIR-TARIFA · regalo de Divoox (revisor, I5)', () => {
  it('el regalo no crece: la subida se cobra en mano y el cierre lo respeta', async () => {
    const e = await listo();
    await e.m.DB.prepare(
      `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('pol-ride', 'ride', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
    ).run();
    const crear = await e.m.llamar(
      'POST',
      '/datos/admin/regalos-divoox',
      {
        codigo: 'SUBE',
        nombreEs: 'Regalo de bienvenida',
        nombreEn: 'Welcome gift',
        tipo: 'monto',
        valor: 300,
        servicios: ['moto'],
        zonas: [ZONA],
        venceEn: null,
        presupuesto: 10_000,
      },
      e.admin.token,
    );
    expect(crear.estado).toBe(201);
    await e.m.llamar('PATCH', '/datos/admin/regalos-divoox/SUBE', { activo: true }, e.admin.token);
    const p = await e.m.cuenta('cliente', 'Pasajero Regalo');
    await e.m.DB.prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ? WHERE id = ?')
      .bind('+13055559911', '13055559911', p.id)
      .run();
    const aparato = `aparato-subida-${Math.random().toString(36).slice(2, 8)}`;
    const llamar = (metodo: string, ruta: string, cuerpo?: unknown, extra = {}) =>
      e.m.llamar(metodo, ruta, cuerpo, p.token, { 'x-aparato': aparato, ...extra });
    expect((await llamar('POST', '/datos/regalos-divoox/guardar', { codigo: 'sube' })).estado).toBe(
      201,
    );
    const cot = (
      await llamar('POST', '/datos/viajes/cotizar', {
        servicio: 'moto',
        origen: ORIGEN,
        destino: DESTINO,
      })
    ).datos.cotizacion;
    expect(cot.regalo?.codigo).toBe('SUBE');
    const pedido = await llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo', regalo: 'SUBE' },
      { 'idempotency-key': `pedir-${cot.id.slice(0, 12)}` },
    );
    const id = pedido.datos.viaje.id as string;
    const regalo = Number(
      (
        await e.m.DB.prepare('SELECT monto FROM usos_cupon_divoox WHERE operacion_id = ?')
          .bind(id)
          .first<{ monto: number }>()
      )?.monto,
    );
    expect(regalo).toBe(300);
    await esperar(e, id);
    const s = await llamar('POST', `/datos/viajes/${id}/subir-tarifa`, { monto: 100, clave: 'k1' });
    expect(s.estado).toBe(200);
    const nuevo = cot.total + 100;
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('rec-s', ?, 'prepago', 'US', 'USD', 10000, 'recarga', 'rec-s')",
    )
      .bind(cond.id)
      .run();
    // La oferta trae lo que paga Divoox sin cambio.
    const o = (
      await e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, cond.token)
    ).datos.ofertas[0];
    expect(o).toMatchObject({
      regaloDivoox: 300,
      gananciaCentavos: nuevo - Math.round(nuevo / 10),
    });
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const actual = (
      await e.m.llamar('GET', '/datos/conductor/operaciones/actual', undefined, cond.token)
    ).datos.operacion;
    expect(actual.cobrar_en_mano).toBe(nuevo - 300);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await llamar('GET', '/datos/viajes/actual')).datos.viaje.pin;
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
    const fin = (await r.json()) as {
      totalFinal: number;
      regaloDivoox: number;
      cobrarEnMano: number;
    };
    expect(fin.regaloDivoox).toBe(300);
    expect(fin.totalFinal).toBe(nuevo);
    expect(fin.cobrarEnMano).toBe(nuevo - 300);
  });
});

describe('C-SUBIR-TARIFA · viaje fijo y blindaje (revisor, I5 y M5)', () => {
  it('un viaje fijo también se sube y le llega con el precio nuevo a quien lo rechazó', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id, total: antes } = await pedir(e);
    await e.m.DB.prepare("UPDATE viajes SET rutina_id = 'rutina-prueba' WHERE operacion_id = ?")
      .bind(id)
      .run();
    expect(await a.paso(id, 'rechazar')).toBe(200);
    await esperar(e, id);
    expect((await subir(e, id, 25, 'k1')).estado).toBe(200);
    const o = (await e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, a.token))
      .datos.ofertas as { gananciaCentavos: number; tarifaSubida: boolean; viajeFijo: boolean }[];
    expect(o[0]).toMatchObject({
      gananciaCentavos: antes + 25,
      tarifaSubida: true,
      viajeFijo: true,
    });
  });

  it('M5: sin ninguna ciudad encendida, el despacho y la oferta no leen las columnas nuevas', async () => {
    const e = await listo(null);
    const consultas: string[] = [];
    const real = e.m.DB.prepare.bind(e.m.DB);
    (e.m.DB as unknown as { prepare: (sql: string) => D1PreparedStatement }).prepare = (
      sql: string,
    ) => {
      consultas.push(sql);
      return real(sql);
    };
    const a = await conductorDeMoto(e.m, ORIGEN);
    const { id } = await pedir(e);
    await e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, a.token);
    await e.m.DB.prepare(
      "UPDATE ofertas_operacion SET expira_en = datetime('now', '-40 seconds') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, a.token);
    expect(await a.paso(id, 'aceptar')).toBe(200);
    const nuevas = consultas.filter(
      (q) =>
        /subida_n|sc\.tipo|tipo = 'subida'|tipo = 'paradas'/.test(q) &&
        !/ajustes_viaje_zona/.test(q),
    );
    expect(nuevas, nuevas.join('\n---\n')).toEqual([]);
  });
});
