import { describe, expect, it } from 'vitest';
import { EL_VIGIA, abrirComida, escenarioVe } from './pruebas/comidaVe';
import { asegurarCodigoRepartidor } from './rutas/superadmin';

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
});
