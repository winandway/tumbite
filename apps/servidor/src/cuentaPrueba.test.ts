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
