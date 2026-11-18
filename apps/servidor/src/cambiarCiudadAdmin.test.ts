import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { EL_VIGIA, abrirComida, escenarioVe } from './pruebas/comidaVe';
import { asegurarCodigoRepartidor, codigoCiudad } from './rutas/superadmin';

/**
 * C-CAMBIAR-CIUDAD-ADMIN (piloto, 18 nov 2026): un conductor real del piloto quedó en Miami (zona por
 * defecto) y el equipo no tenía cómo pasarlo a El Vigía desde su ficha. Es un cambio de país.
 */
async function preparar() {
  const e = await escenarioVe();
  expect((await abrirComida(e)).estado).toBe(201);
  const c = await e.m.cuenta('repartidor', 'Conductor Piloto');
  await e.m.DB.prepare(
    "INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, 'US-FL-MIAMI') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = 'US-FL-MIAMI'",
  )
    .bind(c.id)
    .run();
  const viejo = await asegurarCodigoRepartidor(e.m.DB, c.id);
  const cambiar = (cuerpo: Record<string, unknown>) =>
    e.m.llamar('PUT', `/datos/admin/conductores/${c.id}/ciudad`, cuerpo, e.admin.token);
  const fila = () =>
    e.m.DB.prepare(
      `SELECT u.zona_id AS uz, r.zona_id AS rz, r.codigo, r.ciudad_elegida_en IS NOT NULL AS eligio
         FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
    )
      .bind(c.id)
      .first<{ uz: string | null; rz: string; codigo: string; eligio: number }>();
  return { e, c, viejo, cambiar, fila };
}

describe('el equipo cambia la ciudad de un conductor desde su ficha', () => {
  it('conectado no se puede: mensaje claro y nada cambia', async () => {
    const { e, c, cambiar, fila } = await preparar();
    await e.m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?')
      .bind(c.id)
      .run();
    const r = await cambiar({ zonaId: EL_VIGIA.id, motivo: 'Vive en El Vigía', cambioPais: true });
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/go offline before changing city/);
    expect((await fila())?.rz).toBe('US-FL-MIAMI');
  });

  it('de Miami a El Vigía es un cambio de país: pide confirmarlo; con dinero en EE. UU., no', async () => {
    const { e, c, cambiar, fila } = await preparar();
    const sin = await cambiar({ zonaId: EL_VIGIA.id, motivo: 'Vive en El Vigía' });
    expect(sin.estado).toBe(409);
    expect(sin.datos.error).toMatch(/country change \(from US to VE\)/);
    await e.m.DB.prepare(
      "INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES ('m-saldo', ?, 500, 'ajuste')",
    )
      .bind(c.id)
      .run();
    const conSaldo = await cambiar({
      zonaId: EL_VIGIA.id,
      motivo: 'Vive en El Vigía',
      cambioPais: true,
    });
    expect(conSaldo.estado).toBe(409);
    expect(conSaldo.datos.error).toMatch(/balance or a payout account in US/);
    expect((await fila())?.rz).toBe('US-FL-MIAMI');
  });

  it('confirmado: cuenta, fila, ciudad elegida y código nuevos coherentes, y queda en la auditoría', async () => {
    const { e, c, viejo, cambiar, fila } = await preparar();
    expect(viejo).toMatch(/^US-MIA-\d{6}$/);
    const r = await cambiar({
      zonaId: EL_VIGIA.id,
      motivo: 'Vive en El Vigía (autorizado)',
      cambioPais: true,
    });
    expect(r.estado).toBe(200);
    const f = await fila();
    expect(f).toMatchObject({ uz: EL_VIGIA.id, rz: EL_VIGIA.id, eligio: 1 });
    expect(f?.codigo).toMatch(/^VE-[A-Z]{3}-\d{6}$/);
    expect(r.datos.codigo).toBe(f?.codigo);
    const a = await e.m.DB.prepare(
      "SELECT actor_id, antes_json, despues_json FROM auditoria_admin WHERE accion = 'conductor.ciudad' AND objeto = ?",
    )
      .bind(`conductor:${c.id}`)
      .first<{ actor_id: string; antes_json: string; despues_json: string }>();
    expect(a?.actor_id).toBe(e.admin.id);
    expect(JSON.parse(a!.antes_json)).toMatchObject({
      zonaId: 'US-FL-MIAMI',
      pais: 'US',
      codigo: viejo,
    });
    expect(JSON.parse(a!.despues_json)).toMatchObject({
      zonaId: EL_VIGIA.id,
      pais: 'VE',
      codigo: f?.codigo,
      motivo: 'Vive en El Vigía (autorizado)',
    });
    // La ciudad por ubicación (C-ZONA-CONDUCTOR-NUEVO) ya no la mueve: la eligió el equipo.
    const mover = await e.m.llamar(
      'POST',
      '/datos/conductor/zona-por-ubicacion',
      { lat: 25.77, lng: -80.19 },
      c.token,
    );
    expect(mover.datos.cambio).toBe(false);
    expect((await fila())?.rz).toBe(EL_VIGIA.id);
  });

  // ── Revisión del 18 nov (NO APTO corregido) ──
  const auditorias = (e: Awaited<ReturnType<typeof preparar>>['e'], id: string) =>
    e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'conductor.ciudad' AND objeto = ?",
    )
      .bind(`conductor:${id}`)
      .first<{ n: number }>()
      .then((x) => Number(x?.n));

  it('la misma ciudad se rechaza (no regenera el código); motivo vacío o largo, 400', async () => {
    const { cambiar, fila, viejo } = await preparar();
    const misma = await cambiar({ zonaId: 'US-FL-MIAMI', motivo: 'Prueba de misma ciudad' });
    expect(misma.estado).toBe(409);
    expect((await fila())?.codigo).toBe(viejo);
    expect((await cambiar({ zonaId: EL_VIGIA.id, motivo: '', cambioPais: true })).estado).toBe(400);
    expect(
      (await cambiar({ zonaId: EL_VIGIA.id, motivo: 'x'.repeat(201), cambioPais: true })).estado,
    ).toBe(400);
  });

  it('a medias no queda nada: si el código nuevo choca, ni ciudad, ni código, ni auditoría', async () => {
    const { e, c, cambiar, fila, viejo } = await preparar();
    const z = (await e.m.DB.prepare('SELECT nombre, codigo_ciudad FROM zonas WHERE id = ?')
      .bind(EL_VIGIA.id)
      .first<{ nombre: string; codigo_ciudad: string | null }>())!;
    const prefijo = `VE-${codigoCiudad(z)}`;
    // Otro conductor ya tiene el número que va a salir del contador.
    const otro = await e.m.cuenta('repartidor', 'Otro Conductor');
    await e.m.DB.batch([
      e.m.DB.prepare(
        "INSERT INTO repartidores (usuario_id, zona_id, codigo) VALUES (?, 'VE-MER-ELVIGIA', ?) ON CONFLICT(usuario_id) DO UPDATE SET codigo = excluded.codigo",
      ).bind(otro.id, `${prefijo}-000008`),
      e.m.DB.prepare(
        'INSERT INTO contadores (clave, n) VALUES (?, 7) ON CONFLICT(clave) DO UPDATE SET n = 7',
      ).bind(`repartidor:${prefijo}`),
    ]);
    const r = await cambiar({ zonaId: EL_VIGIA.id, motivo: 'Vive en El Vigía', cambioPais: true });
    expect(r.estado).toBeGreaterThanOrEqual(400);
    expect(await fila()).toMatchObject({ uz: null, rz: 'US-FL-MIAMI', codigo: viejo, eligio: 0 });
    expect(await auditorias(e, c.id)).toBe(0);
  });

  it('si se conecta justo en medio, no cambia nada (la condición va en el mismo UPDATE)', async () => {
    const { e, c, cambiar, fila, viejo } = await preparar();
    // Simula la carrera: al subir el contador (después de los controles), el conductor se conecta.
    await e.m.DB.prepare(
      `CREATE TRIGGER se_conecta AFTER INSERT ON contadores BEGIN
         UPDATE repartidores SET conectado = 1 WHERE usuario_id = '${c.id}';
       END`,
    ).run();
    await e.m.DB.prepare(
      `CREATE TRIGGER se_conecta2 AFTER UPDATE ON contadores BEGIN
         UPDATE repartidores SET conectado = 1 WHERE usuario_id = '${c.id}';
       END`,
    ).run();
    const r = await cambiar({ zonaId: EL_VIGIA.id, motivo: 'Vive en El Vigía', cambioPais: true });
    expect(r.estado).toBe(409);
    expect(await fila()).toMatchObject({ uz: null, rz: 'US-FL-MIAMI', codigo: viejo });
    expect(await auditorias(e, c.id)).toBe(0);
  });

  it('cambio de país: lo bloquean regalos por cobrar, recargas o retiros pendientes, y los papeles', async () => {
    for (const caso of [
      'recarga',
      'retiro',
      'regalo',
      'vehiculo',
      'papel',
      'habilitacion',
    ] as const) {
      const { e, c, cambiar, fila } = await preparar();
      const q = (sql: string, ...v: unknown[]) =>
        e.m.DB.prepare(sql)
          .bind(...v)
          .run();
      await q('PRAGMA foreign_keys = OFF');
      if (caso === 'recarga')
        await q(
          "INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado) VALUES ('rc1', ?, 'US', 'USD', 500, 'stripe', 'pendiente')",
          c.id,
        );
      if (caso === 'retiro')
        await q(
          "INSERT INTO retiros (id, usuario_id, stripe_cuenta, monto_centavos, estado) VALUES ('rt1', ?, 'acct_x', 500, 'pendiente')",
          c.id,
        );
      if (caso === 'regalo') {
        await q(
          "INSERT INTO cupones_divoox (codigo, tipo, valor, presupuesto) VALUES ('RG1', 'monto', 500, 10000)",
        );
        await q(
          `INSERT INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, conductor_id, monto, moneda, estado)
           VALUES ('u1', 'RG1', 'cli', '+1', 'ap', 'moto', 'US-FL-MIAMI', 'US', 'op1', ?, 300, 'USD', 'cobrado')`,
          c.id,
        );
        await q(
          "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES ('mv1', ?, 300, 'regalo', 'regalo-divoox:u1')",
          c.id,
        );
      }
      if (caso === 'vehiculo')
        await q(
          "INSERT INTO vehiculos (id, conductor_id, tipo, placa, estado) VALUES ('v1', ?, 'moto', 'X1', 'aprobado')",
          c.id,
        );
      if (caso === 'papel')
        await q(
          "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, estado) VALUES ('d1', ?, 'licencia_moto', 'x', 'aprobado')",
          c.id,
        );
      if (caso === 'habilitacion')
        await q(
          "INSERT INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'comida', 'pendiente')",
          c.id,
        );
      await q('PRAGMA foreign_keys = ON');
      const r = await cambiar({
        zonaId: EL_VIGIA.id,
        motivo: 'Vive en El Vigía',
        cambioPais: true,
      });
      expect(r.estado, caso).toBe(409);
      expect(r.datos.campo, caso).toBe(
        ['vehiculo', 'papel', 'habilitacion'].includes(caso)
          ? 'cambioPaisPapeles'
          : 'cambioPaisDinero',
      );
      expect((await fila())?.rz, caso).toBe('US-FL-MIAMI');
    }
  });

  it('la lista de destino: activas, sin la suya; en producción, sin zonas internas de prueba', async () => {
    const { e, c } = await preparar();
    await e.m.DB.prepare(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('US-MI-PRUEBAS', 'Novi (pruebas)', 'US', 'USD', 'America/Detroit', 42.48, -83.47, 20, 1)`,
    ).run();
    const ids = async (host?: string) => {
      const r = await e.m.crudo(`/datos/admin/conductores/${c.id}/ciudades-destino`, {
        headers: { authorization: `Bearer ${e.admin.token}`, ...(host ? { host } : {}) },
      });
      return ((await r.json()) as { ciudades: { id: string }[] }).ciudades.map((x) => x.id);
    };
    const local = await ids();
    expect(local).toContain(EL_VIGIA.id);
    expect(local).not.toContain('US-FL-MIAMI');
    expect(local).toContain('US-MI-PRUEBAS');
  });

  it('en producción no se ofrecen ni se aceptan zonas internas de prueba (C-DISPONIBLE-MUNDO)', async () => {
    const m = mundo({}, { host: 'divoox.com' });
    const admin = await m.cuenta('admin', 'Soporte Total');
    const c = await m.cuenta('repartidor', 'Conductor Producción');
    await m.DB.prepare(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('US-MI-PRUEBAS', 'Novi (pruebas)', 'US', 'USD', 'America/Detroit', 42.48, -83.47, 20, 1)`,
    ).run();
    await m.DB.prepare("INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, 'US-FL-MIAMI')")
      .bind(c.id)
      .run();
    const lista = await m.llamar(
      'GET',
      `/datos/admin/conductores/${c.id}/ciudades-destino`,
      undefined,
      admin.token,
    );
    const ids = (lista.datos.ciudades as { id: string }[]).map((x) => x.id);
    expect(ids).not.toContain('US-MI-PRUEBAS');
    const r = await m.llamar(
      'PUT',
      `/datos/admin/conductores/${c.id}/ciudad`,
      { zonaId: 'US-MI-PRUEBAS', motivo: 'Prueba en producción' },
      admin.token,
    );
    expect(r.estado).toBe(404);
  });
});
