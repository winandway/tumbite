import { describe, expect, it } from 'vitest';
import { saldoLibro } from '../internacional/libro';
import { EL_VIGIA, abrirComida, escenarioVe } from '../pruebas/comidaVe';
import { TOPES_SALDO, darRegaloConductorNuevo } from '../saldoConductores';

/**
 * C-SALDO-CONDUCTOR (17 nov 2026) — Venezuela primero. La vista de conductores por ciudad, la carga
 * manual de saldo (auditada, con tope del código y con la doble firma del dinero) y el regalo de
 * arranque por ciudad con presupuesto.
 */
async function mundo() {
  const e = await escenarioVe();
  expect((await abrirComida(e)).estado).toBe(201);
  const conductor = async (nombre: string, conectado = 0) => {
    const c = await e.m.cuenta('repartidor', nombre);
    await e.m.DB.prepare(
      'INSERT INTO repartidores (usuario_id, conectado, lat, lng, zona_id) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(c.id, conectado, EL_VIGIA.lat, EL_VIGIA.lng, EL_VIGIA.id)
      .run();
    return c;
  };
  const cargar = (id: string, cuerpo: Record<string, unknown>, token = e.admin.token) =>
    e.m.llamar('POST', `/datos/admin/conductores-ciudad/${id}/saldo`, cuerpo, token);
  return { e, conductor, cargar };
}

describe('C-SALDO-CONDUCTOR: conductores por ciudad y carga manual', () => {
  it('la vista dice cuántos hay, cuántos activos y el saldo de cada uno', async () => {
    const { e, conductor, cargar } = await mundo();
    const a = await conductor('Ana Conductora', 1);
    await conductor('Beto Conductor');
    expect((await cargar(a.id, { monto: 500, motivo: 'Regalo de arranque' })).estado).toBe(200);
    const r = await e.m.llamar(
      'GET',
      `/datos/admin/conductores-ciudad?zona=${EL_VIGIA.id}`,
      undefined,
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.ciudad).toMatchObject({
      zonaId: EL_VIGIA.id,
      moneda: 'USD',
      total: 2,
      activos: 1,
      conectados: 1,
      sinSaldo: 1,
    });
    const ana = r.datos.ciudad.conductores.find((x: { id: string }) => x.id === a.id);
    expect(ana).toMatchObject({ saldo: 500, carreras: 0, conectado: true });
    expect(r.datos.topes).toEqual(TOPES_SALDO);
    // Una ciudad sin conductores también se puede elegir (para preparar su regalo de arranque).
    await e.m.DB.prepare(
      "INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('VE-MER-TUCANI', 'Tucaní', 'VE', 'USD', 'America/Caracas', 8.97, -71.27, 10, 1)",
    ).run();
    const t = await e.m.llamar(
      'GET',
      '/datos/admin/conductores-ciudad?zona=VE-MER-TUCANI',
      undefined,
      e.admin.token,
    );
    expect(t.datos.ciudad).toMatchObject({ zonaId: 'VE-MER-TUCANI', total: 0 });
  });

  it('la carga queda en el libro con su autor, su motivo y su comprobante; nada fuera del tope', async () => {
    const { e, conductor, cargar } = await mundo();
    const a = await conductor('Ana Conductora');
    const r = await cargar(a.id, {
      monto: 1_000,
      motivo: 'Pagó por pago móvil',
      comprobante: 'REF-123456',
    });
    expect(r.estado).toBe(200);
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(1_000);
    const asiento = await e.m.DB.prepare(
      "SELECT autor_id, concepto FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago'",
    )
      .bind(a.id)
      .first<{ autor_id: string; concepto: string }>();
    expect(asiento).toEqual({ autor_id: e.admin.id, concepto: 'carga_manual' });
    const cargas = await e.m.llamar(
      'GET',
      `/datos/admin/conductores-ciudad/${a.id}/cargas`,
      undefined,
      e.admin.token,
    );
    expect(cargas.datos.cargas[0]).toMatchObject({
      monto: 1_000,
      tipo: 'manual',
      motivo: 'Pagó por pago móvil',
      comprobante: 'REF-123456',
    });
    // Fuera del tope del código, sin motivo, o sin ser del equipo: no.
    expect(
      (await cargar(a.id, { monto: TOPES_SALDO.cargaMaxima + 1, motivo: 'Demasiado' })).estado,
    ).toBe(400);
    expect((await cargar(a.id, { monto: 100, motivo: '' })).estado).toBe(400);
    expect((await cargar(a.id, { monto: 100, motivo: 'Yo mismo' }, a.token)).estado).toBe(403);
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(1_000);
  });

  it('por encima del límite del día pide la firma de otra persona (doble confirmación)', async () => {
    const { e, conductor, cargar } = await mundo();
    const a = await conductor('Ana Conductora');
    expect((await cargar(a.id, { monto: 4_000, motivo: 'Regalo de arranque' })).estado).toBe(200);
    expect((await cargar(a.id, { monto: 4_000, motivo: 'Regalo de arranque' })).estado).toBe(200);
    // 120 dólares en 24 horas pasan el límite de 100: queda para aprobar y no se mueve nada.
    const tercera = await cargar(a.id, { monto: 4_000, motivo: 'Regalo de arranque' });
    expect(tercera.estado).toBe(202);
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(8_000);
    const pendiente = await e.m.DB.prepare(
      "SELECT tipo, estado FROM aprobaciones_dinero WHERE objeto = ? AND tipo = 'saldo_conductor'",
    )
      .bind(a.id)
      .first();
    expect(pendiente).toEqual({ tipo: 'saldo_conductor', estado: 'pendiente' });
  });
});

describe('C-SALDO-CONDUCTOR: regalo de arranque por ciudad, con presupuesto', () => {
  it('se da una vez por conductor y nunca pasa el presupuesto; al agotarse se apaga', async () => {
    const { e, conductor } = await mundo();
    const g = await e.m.llamar(
      'PUT',
      `/datos/admin/regalo-conductor-nuevo/${EL_VIGIA.id}`,
      { monto: 500, presupuesto: 800, activo: true },
      e.admin.token,
    );
    expect(g.estado).toBe(200);
    expect(g.datos.regalo).toMatchObject({
      monto: 500,
      presupuesto: 800,
      restante: 800,
      activo: true,
    });
    const a = await conductor('Ana');
    const b = await conductor('Beto');
    const c = await conductor('Carla');
    expect(await darRegaloConductorNuevo(e.m.DB, a.id)).toBe(500);
    expect(await darRegaloConductorNuevo(e.m.DB, a.id)).toBe(0);
    expect(await darRegaloConductorNuevo(e.m.DB, b.id)).toBe(300);
    expect(await darRegaloConductorNuevo(e.m.DB, c.id)).toBe(0);
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(500);
    expect(await saldoLibro(e.m.DB, b.id, 'prepago', 'VE', 'USD')).toBe(300);
    const vista = await e.m.llamar(
      'GET',
      `/datos/admin/conductores-ciudad?zona=${EL_VIGIA.id}`,
      undefined,
      e.admin.token,
    );
    expect(vista.datos.regalosNuevos[0]).toMatchObject({
      dado: 800,
      restante: 0,
      activo: false,
      conductores: 2,
    });
    // El tope del código: el panel no lo pasa.
    expect(
      (
        await e.m.llamar(
          'PUT',
          `/datos/admin/regalo-conductor-nuevo/${EL_VIGIA.id}`,
          { monto: TOPES_SALDO.regaloNuevoMaximo + 1, presupuesto: 800, activo: true },
          e.admin.token,
        )
      ).estado,
    ).toBe(400);
  });

  it('apagado no da nada', async () => {
    const { e, conductor } = await mundo();
    await e.m.llamar(
      'PUT',
      `/datos/admin/regalo-conductor-nuevo/${EL_VIGIA.id}`,
      { monto: 500, presupuesto: 800, activo: false },
      e.admin.token,
    );
    const a = await conductor('Ana');
    expect(await darRegaloConductorNuevo(e.m.DB, a.id)).toBe(0);
  });
});

describe('C-REFERIDOS-SIN-TRAMPA: los regalos por cobrar se miran por conductor', () => {
  it('con más de doscientos conductores con regalos, el que menos tiene también ve lo suyo', async () => {
    const { e, conductor } = await mundo();
    const { porCobrarRegalos } = await import('../regalosDivoox');
    const yo = await conductor('Conductor Chico');
    await e.m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    const uso = (id: string, conductorId: string, monto: number) =>
      e.m.DB.prepare(
        `INSERT INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, conductor_id, monto, moneda, estado)
         VALUES (?1, 'PRUEBA', 'c-' || ?1, 't-' || ?1, 'a-' || ?1, 'moto', ?2, 'VE', 'op-' || ?1, ?3, ?4, 'USD', 'cobrado')`,
      ).bind(id, EL_VIGIA.id, conductorId, monto);
    await e.m.DB.batch(
      Array.from({ length: 205 }, (_, i) => uso(`u${i}`, `otro-conductor-${i}`, 500)),
    );
    await e.m.DB.batch([
      uso('mio', yo.id, 150),
      e.m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES ('m-mio', ?, 150, 'regalo', 'regalo-divoox:mio')",
      ).bind(yo.id),
    ]);
    await e.m.DB.prepare('PRAGMA foreign_keys = ON').run();
    expect(await porCobrarRegalos(e.m.DB, yo.id)).toEqual({
      monto: 150,
      moneda: 'USD',
      pais: 'VE',
    });
  });
});

describe('C-REGALO-HEREDADO: un regalo ya acreditado en el saldo con la versión vieja no se cobra otra vez', () => {
  it('el uso con crédito regalo_divoox en el libro no cuenta como por cobrar ni se pasa al saldo', async () => {
    const { e, conductor } = await mundo();
    const { porCobrarRegalos, liquidacionConductores } = await import('../regalosDivoox');
    const { regalosASaldo } = await import('../saldoConductores');
    const yo = await conductor('Conductor Heredado');
    await e.m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    await e.m.DB.batch([
      // Cobrado el 17 nov con la versión vieja: el crédito fue directo a su saldo prepago (libro).
      e.m.DB.prepare(
        `INSERT INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, conductor_id, monto, moneda, estado)
         VALUES ('viejo', 'PRUEBA', 'c', 't', 'a', 'moto', ?, 'VE', 'op-viejo', ?, 150, 'USD', 'cobrado')`,
      ).bind(EL_VIGIA.id, yo.id),
      e.m.DB.prepare(
        "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('l-viejo', ?, 'prepago', 'VE', 'USD', 150, 'regalo_divoox', 'regalo-divoox:viejo')",
      ).bind(yo.id),
      // Y además tiene otras ganancias (una entrega): con eso el código viejo lo ofrecía otra vez.
      e.m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES ('m-otra', ?, 300, 'entrega', 'otra-ganancia')",
      ).bind(yo.id),
    ]);
    await e.m.DB.prepare('PRAGMA foreign_keys = ON').run();
    expect((await porCobrarRegalos(e.m.DB, yo.id))?.monto ?? 0).toBe(0);
    await expect(regalosASaldo(e.m.DB, yo.id)).rejects.toThrow();
    expect(await saldoLibro(e.m.DB, yo.id, 'prepago', 'VE', 'USD')).toBe(150);
    expect(
      (await liquidacionConductores(e.m.DB)).find((x) => x.conductorId === yo.id)?.porPagar ?? 0,
    ).toBe(0);
  });
});

/**
 * C-REGALO-CONDUCTOR-TOPE-VENCE (26 nov 2026, Richard: 5 USD a cada conductor nuevo, solos al
 * registrarse; 50 USD al día por ciudad; 30 días si no se usan).
 */
describe('C-REGALO-CONDUCTOR-TOPE-VENCE: tope del día, solo nuevos y vencimiento', () => {
  const encender = (
    e: Awaited<ReturnType<typeof mundo>>['e'],
    cuerpo: Record<string, unknown> = {},
  ) =>
    e.m.llamar(
      'PUT',
      `/datos/admin/regalo-conductor-nuevo/${EL_VIGIA.id}`,
      {
        monto: 500,
        presupuesto: 30_000,
        activo: true,
        topeDiario: 1_000,
        vigenciaDias: 30,
        ...cuerpo,
      },
      e.admin.token,
    );

  it('el tope del día no se pasa; el que quedó afuera lo recibe cuando vuelve a caber', async () => {
    const { e, conductor } = await mundo();
    const g = await encender(e);
    expect(g.estado).toBe(200);
    expect(g.datos.regalo).toMatchObject({
      topeDiario: 1_000,
      vigenciaDias: 30,
      dadoUltimas24h: 0,
    });
    const a = await conductor('Ana');
    const b = await conductor('Beto');
    const c = await conductor('Carla');
    expect(await darRegaloConductorNuevo(e.m.DB, a.id)).toBe(500);
    expect(await darRegaloConductorNuevo(e.m.DB, b.id)).toBe(500);
    // Hoy ya no cabe un regalo entero: espera, no recibe la mitad.
    expect(await darRegaloConductorNuevo(e.m.DB, c.id)).toBe(0);
    expect(await saldoLibro(e.m.DB, c.id, 'prepago', 'VE', 'USD')).toBe(0);
    // Pasa el día: al volver a intentarlo (al conectarse) le llega.
    await e.m.DB.prepare(
      "UPDATE cargas_saldo_conductor SET creado_en = datetime('now', '-2 days') WHERE tipo = 'regalo_nuevo'",
    ).run();
    expect(await darRegaloConductorNuevo(e.m.DB, c.id)).toBe(500);
    // El regalo guarda su vencimiento: 30 días.
    const v = await e.m.DB.prepare(
      'SELECT CAST(julianday(vence_en) - julianday(creado_en) + 0.5 AS INTEGER) AS dias FROM cargas_saldo_conductor WHERE conductor_id = ?',
    )
      .bind(c.id)
      .first<{ dias: number }>();
    expect(v?.dias).toBe(30);
    // Tope del día por debajo de un regalo: el panel no lo deja.
    expect((await encender(e, { topeDiario: 100 })).estado).toBe(422);
  });

  it('encenderlo no le regala a quien ya estaba registrado; cada cambio queda auditado', async () => {
    const { e, conductor } = await mundo();
    const viejo = await conductor('Viejo');
    await e.m.DB.prepare("UPDATE usuarios SET creado_en = datetime('now', '-3 days') WHERE id = ?")
      .bind(viejo.id)
      .run();
    expect((await encender(e)).estado).toBe(200);
    const nuevo = await conductor('Nuevo');
    expect(await darRegaloConductorNuevo(e.m.DB, viejo.id)).toBe(0);
    expect(await darRegaloConductorNuevo(e.m.DB, nuevo.id)).toBe(500);
    const aud = await e.m.DB.prepare(
      "SELECT actor_id, despues_json FROM auditoria_admin WHERE accion = 'regalo_conductor_nuevo' AND objeto = ?",
    )
      .bind(`regalo-conductor-nuevo:${EL_VIGIA.id}`)
      .first<{ actor_id: string; despues_json: string }>();
    expect(aud?.actor_id).toBe(e.admin.id);
    expect(JSON.parse(aud?.despues_json ?? '{}')).toMatchObject({ monto: 500, topeDiario: 1_000 });
  });

  it('al vencer se retira solo lo que no usó, nunca su propio dinero; una vez', async () => {
    const { vencerRegaloConductor } = await import('../regaloConductorVence');
    const { reservarComision } = await import('../internacional/libro');
    const { e, conductor } = await mundo();
    await encender(e);
    const a = await conductor('Ana');
    const b = await conductor('Beto');
    expect(await darRegaloConductorNuevo(e.m.DB, a.id)).toBe(500);
    expect(await darRegaloConductorNuevo(e.m.DB, b.id)).toBe(500);
    // Ana usa 200 en comisiones y recarga 1.000 de su bolsillo.
    await e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('u1', ?1, 'prepago', 'VE', 'USD', -200, 'reserva_comision', 'r-u1'), ('r1', ?1, 'prepago', 'VE', 'USD', 1000, 'recarga', 'r-r1')",
    )
      .bind(a.id)
      .run();
    // Antes de los 30 días no pasa nada, y la app le dice cuánto le queda del regalo y hasta cuándo.
    expect(await vencerRegaloConductor(e.m.DB, a.id)).toBe(false);
    const { regaloVigenteConductor } = await import('../regaloConductorVence');
    expect(await regaloVigenteConductor(e.m.DB, a.id)).toMatchObject({ monto: 300 });
    expect((await regaloVigenteConductor(e.m.DB, b.id))?.monto).toBe(500);
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(1_300);
    await e.m.DB.prepare(
      "UPDATE cargas_saldo_conductor SET vence_en = datetime('now', '-1 minute') WHERE tipo = 'regalo_nuevo'",
    ).run();
    expect(await vencerRegaloConductor(e.m.DB, a.id)).toBe(true);
    // Quedaban 300 del regalo: salen esos 300 y se queda con sus 1.000.
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(1_000);
    expect(await regaloVigenteConductor(e.m.DB, a.id)).toBeNull();
    expect(await vencerRegaloConductor(e.m.DB, a.id)).toBe(false);
    expect(await saldoLibro(e.m.DB, a.id, 'prepago', 'VE', 'USD')).toBe(1_000);
    // Beto no lo usó: al ir a apartar una comisión, el regalo vencido sale primero y no le alcanza.
    expect(
      await reservarComision(e.m.DB, {
        pedidoId: 'p-x',
        repartidorId: b.id,
        pais: 'VE',
        moneda: 'USD',
        monto: 100,
      }),
    ).toBe(false);
    expect(await saldoLibro(e.m.DB, b.id, 'prepago', 'VE', 'USD')).toBe(0);
  });
});
