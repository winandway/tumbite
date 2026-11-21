import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-CUENTA-PRUEBA (21 nov 2026, pedido de Gerencia para la prueba en vivo de Richard en Novi) — todos
 * los países. Una sola marca de «cuenta de prueba» en la base, que pone solo el equipo (con auditoría).
 * Un servicio puede encenderse en una ciudad SOLO para cuentas de prueba (`servicios_prueba`): el resto
 * de la ciudad no lo ve ni lo puede pedir.
 */
const NOVI = { id: 'US-MI-NOVI', lat: 42.4806, lng: -83.4755 };
const ORIGEN = { lat: 42.4806, lng: -83.4755, direccion: 'Origen de ejemplo' };
const DESTINO = { lat: 42.4906, lng: -83.4705, direccion: 'Destino de ejemplo' };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  await m.DB.batch([
    m.DB.prepare(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES (?, 'Novi (pruebas)', 'US', 'USD', 'America/Detroit', ?, ?, 40, 1)`,
    ).bind(NOVI.id, NOVI.lat, NOVI.lng),
    m.DB.prepare("UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'"),
    m.DB.prepare(
      "INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('carro', ?, 'proximamente') ON CONFLICT DO UPDATE SET estado = 'proximamente'",
    ).bind(NOVI.id),
    m.DB.prepare(
      `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
         espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento,
         tope_dinamico_pb, redondeo, activa, de_prueba, motivo)
       VALUES ('t-novi', 'carro', ?, 'USD', 250, 110, 30, 800, 300, 30, 120, 300, 400, 10000, 1, 1, 1, 'prueba')`,
    ).bind(NOVI.id),
    m.DB.prepare(
      "INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('carro', 1)",
    ),
  ]);
  const normal = await m.cuenta('cliente', 'Cliente Normal');
  const prueba = await m.cuenta('cliente', 'Soporte Prueba Pasajero');
  const marcar = (id: string, si: boolean, token = admin.token) =>
    m.llamar('POST', `/datos/admin/usuarios/${id}/prueba`, { prueba: si }, token);
  const carro = async (token: string) =>
    (
      (await m.llamar('GET', `/datos/servicios?lat=${NOVI.lat}&lng=${NOVI.lng}`, undefined, token))
        .datos.servicios as { id: string; estado: string }[]
    ).find((s) => s.id === 'carro')?.estado;
  const cotizar = (token: string) =>
    m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      token,
    );
  return { m, admin, normal, prueba, marcar, carro, cotizar };
}

describe('C-CUENTA-PRUEBA · la marca la pone solo el equipo, con auditoría', () => {
  it('el equipo marca y quita la marca; queda en la auditoría', async () => {
    const { m, admin, prueba, marcar } = await escenario();
    expect((await marcar(prueba.id, true)).estado).toBe(200);
    const f = await m.DB.prepare('SELECT es_prueba FROM usuarios WHERE id = ?')
      .bind(prueba.id)
      .first<{ es_prueba: number }>();
    expect(f?.es_prueba).toBe(1);
    expect((await marcar(prueba.id, false)).estado).toBe(200);
    const a = await m.DB.prepare(
      "SELECT actor_id, antes_json, despues_json FROM auditoria_admin WHERE accion = 'cuenta_prueba' AND objeto = ? ORDER BY rowid",
    )
      .bind(prueba.id)
      .all<{ actor_id: string; antes_json: string; despues_json: string }>();
    expect(a.results).toHaveLength(2);
    expect(a.results[0]?.actor_id).toBe(admin.id);
    expect(a.results[0]?.despues_json).toContain('true');
  });

  it('nadie más puede marcarse ni marcar a otro', async () => {
    const { normal, prueba, marcar } = await escenario();
    expect((await marcar(normal.id, true, normal.token)).estado).toBe(403);
    expect((await marcar(prueba.id, true, prueba.token)).estado).toBe(403);
  });
});

describe('C-CUENTA-PRUEBA · Carro en Novi solo para cuentas de prueba', () => {
  it('sin encender para pruebas, nadie en Novi puede pedir Carro', async () => {
    const { prueba, marcar, carro, cotizar } = await escenario();
    await marcar(prueba.id, true);
    expect(await carro(prueba.token)).not.toBe('disponible');
    expect((await cotizar(prueba.token)).estado).toBe(409);
  });

  it('encendido para pruebas: la cuenta de prueba lo ve y cotiza; un cliente normal de Novi no lo ve ni lo puede pedir', async () => {
    const { m, normal, prueba, marcar, carro, cotizar } = await escenario();
    await m.DB.prepare(
      "INSERT INTO servicios_prueba (servicio_id, zona_id) VALUES ('carro', 'US-MI-NOVI')",
    ).run();
    await marcar(prueba.id, true);
    expect(await carro(prueba.token)).toBe('disponible');
    const cot = await cotizar(prueba.token);
    expect(cot.estado, JSON.stringify(cot.datos)).toBe(201);
    // El cliente normal de la misma ciudad: ni lo ve ni lo puede pedir.
    expect(await carro(normal.token)).not.toBe('disponible');
    expect((await cotizar(normal.token)).estado).toBe(409);
    // Sin sesión (la web pública): tampoco.
    const publico = (
      (await m.llamar('GET', `/datos/servicios?lat=${NOVI.lat}&lng=${NOVI.lng}`)).datos
        .servicios as { id: string; estado: string }[]
    ).find((s) => s.id === 'carro')?.estado;
    expect(publico).not.toBe('disponible');
  });

  it('si se le quita la marca, deja de verlo', async () => {
    const { m, prueba, marcar, carro } = await escenario();
    await m.DB.prepare(
      "INSERT INTO servicios_prueba (servicio_id, zona_id) VALUES ('carro', 'US-MI-NOVI')",
    ).run();
    await marcar(prueba.id, true);
    expect(await carro(prueba.token)).toBe('disponible');
    await marcar(prueba.id, false);
    expect(await carro(prueba.token)).not.toBe('disponible');
  });
});

describe('C-CUENTA-PRUEBA · los listados del panel: «Reales» por defecto', () => {
  it('Clientes y Repartidores: por defecto solo reales; «prueba» solo las marcadas; «todas» ambas, con su etiqueta', async () => {
    const { m, admin, normal, prueba, marcar } = await escenario();
    await marcar(prueba.id, true);
    const conductorReal = await m.cuenta('repartidor', 'Conductor Real');
    const conductorPrueba = await m.cuenta('repartidor', 'Soporte Prueba Conductor');
    await marcar(conductorPrueba.id, true);
    const ids = async (ruta: string, clave: string, cuentas?: string) => {
      const r = await m.llamar(
        'GET',
        `/datos/admin/${ruta}${cuentas ? `?cuentas=${cuentas}` : ''}`,
        undefined,
        admin.token,
      );
      expect(r.estado, JSON.stringify(r.datos)).toBe(200);
      return (r.datos[clave] as { id: string; esPrueba: boolean }[]).map(
        (x) => `${x.id}:${x.esPrueba ? 'P' : 'R'}`,
      );
    };
    const clientes = await ids('clientes', 'clientes');
    expect(clientes).toContain(`${normal.id}:R`);
    expect(clientes.some((x) => x.startsWith(prueba.id))).toBe(false);
    expect(await ids('clientes', 'clientes', 'prueba')).toEqual([`${prueba.id}:P`]);
    const todas = await ids('clientes', 'clientes', 'todas');
    expect(todas).toEqual(expect.arrayContaining([`${normal.id}:R`, `${prueba.id}:P`]));
    const reps = await ids('repartidores', 'repartidores');
    expect(reps).toContain(`${conductorReal.id}:R`);
    expect(reps.some((x) => x.startsWith(conductorPrueba.id))).toBe(false);
    expect(await ids('repartidores', 'repartidores', 'prueba')).toEqual([
      `${conductorPrueba.id}:P`,
    ]);
  });
});

describe('C-CUENTA-PRUEBA · antecedentes de una cuenta de prueba', () => {
  it('el equipo no aprueba a mano los antecedentes de un conductor real, pero sí los de una cuenta de prueba', async () => {
    const { m, admin, marcar } = await escenario();
    const real = await m.cuenta('repartidor', 'Conductor Real');
    const prueba = await m.cuenta('repartidor', 'Soporte Prueba Conductor');
    await marcar(prueba.id, true);
    const aprobar = (id: string) =>
      m.llamar(
        'PUT',
        `/datos/admin/cumplimientos/${id}/antecedentes_pasajeros`,
        { estado: 'aprobado' },
        admin.token,
      );
    expect((await aprobar(real.id)).estado).toBe(409);
    const r = await aprobar(prueba.id);
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    // La identidad sigue yendo por «Verificaciones» (KYC), también en una cuenta de prueba.
    const kyc = await m.llamar(
      'PUT',
      `/datos/admin/cumplimientos/${prueba.id}/identidad`,
      { estado: 'aprobado' },
      admin.token,
    );
    expect(kyc.estado).toBe(409);
    // La ficha de pasajeros del conductor dice si es de prueba.
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/conductores/${prueba.id}/pasajeros`,
      undefined,
      admin.token,
    );
    expect(ficha.datos.esPrueba).toBe(true);
  });
});

/** Un conductor de Carro listo en Novi, con la misma receta del guion de las cuentas de prueba. */
async function conductorCarroNovi(
  e: Awaited<ReturnType<typeof escenario>>,
  nombre: string,
): Promise<{ id: string; token: string }> {
  const c = await e.m.cuenta('repartidor', nombre);
  const db = e.m.DB;
  const veh = `veh-${c.id.slice(0, 8)}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id)
         VALUES (?, 1, ?, ?, datetime('now'), ?)
         ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng,
           ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`,
      )
      .bind(c.id, NOVI.lat, NOVI.lng, NOVI.id),
    db
      .prepare(
        `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
         VALUES (?, ?, 'carro', 'Toyota', 'Corolla', 'Blanco', ?, 'MI', 2021, 4, 'aprobado')`,
      )
      .bind(veh, c.id, `P${c.id.slice(0, 6)}`),
    db
      .prepare('UPDATE repartidores SET vehiculo_activo_id = ? WHERE usuario_id = ?')
      .bind(veh, c.id),
    ...['registro', 'seguro', 'seguro_pasajeros', 'inspeccion'].map((t) =>
      db
        .prepare(
          `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en)
           VALUES (?, ?, ?, 'x', 'aprobado', datetime('now', '+1 year'))`,
        )
        .bind(`${veh}-${t}`, veh, t),
    ),
    db
      .prepare(
        `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por)
         VALUES (?, 'aprobado', 'licencia', 'x', 'x', datetime('now'), datetime('now'), ?)`,
      )
      .bind(c.id, e.admin.id),
  ]);
  const { results: req } = await db
    .prepare(
      "SELECT r.requisito, d.nivel FROM servicio_requisitos r JOIN requisitos_def d ON d.requisito = r.requisito WHERE r.servicio_id = 'carro'",
    )
    .all<{ requisito: string; nivel: string }>();
  for (const r of req)
    await db
      .prepare(
        `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, vence_en, aprobado_por)
         VALUES (?, ?, ?, 'aprobado', ?, datetime('now', '+1 year'), ?)`,
      )
      .bind(
        c.id,
        r.nivel === 'vehiculo' ? veh : '',
        r.requisito,
        r.requisito === 'identidad' ? 'kyc' : 'revision_manual',
        e.admin.id,
      )
      .run();
  await db.batch([
    db
      .prepare(
        `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en)
         VALUES (?, 'carro', 'aprobada', ?, datetime('now'))`,
      )
      .bind(c.id, e.admin.id),
    db
      .prepare(
        "INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'carro', 1)",
      )
      .bind(c.id),
  ]);
  return { id: c.id, token: c.token };
}

describe('C-CUENTA-PRUEBA · el despacho: solo un conductor de prueba recibe los viajes de prueba', () => {
  it('con Carro solo para pruebas en Novi, el conductor de prueba es elegible y uno real no', async () => {
    const e = await escenario();
    await e.m.DB.prepare(
      "INSERT INTO servicios_prueba (servicio_id, zona_id) VALUES ('carro', 'US-MI-NOVI')",
    ).run();
    const real = (await conductorCarroNovi(e, 'Conductor Real')).id;
    const cuentaPrueba = await conductorCarroNovi(e, 'Soporte Prueba Conductor');
    const prueba = cuentaPrueba.id;
    await e.marcar(prueba, true);
    // En la app Driver, Carro sale disponible y activable para la cuenta de prueba.
    const carroEnApp = (
      (await e.m.llamar('GET', '/datos/conductor/servicios', undefined, cuentaPrueba.token)).datos
        .servicios as { servicioId: string; estadoServicio: string; puedeActivar: boolean }[]
    ).find((x) => x.servicioId === 'carro');
    expect(carroEnApp).toMatchObject({ estadoServicio: 'disponible', puedeActivar: true });
    const elegibles = async () =>
      (
        await e.m.DB.prepare(
          "SELECT conductor_id FROM conductores_elegibles WHERE servicio_id = 'carro' AND zona_id = 'US-MI-NOVI'",
        ).all<{ conductor_id: string }>()
      ).results.map((r) => r.conductor_id);
    expect(await elegibles()).toEqual([prueba]);
    // Sin el encendido de prueba, nadie (Novi sigue «muy pronto» para el público).
    await e.m.DB.prepare('DELETE FROM servicios_prueba').run();
    expect(await elegibles()).toEqual([]);
    // Abierto al público, los dos (la marca no quita nada en una ciudad abierta).
    await e.m.DB.prepare(
      "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'carro' AND zona_id = 'US-MI-NOVI'",
    ).run();
    expect((await elegibles()).sort()).toEqual([prueba, real].sort());
  });
});
