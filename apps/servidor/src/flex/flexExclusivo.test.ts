import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { saludExclusividad } from '../operaciones';

/**
 * C-FLEX-EXCLUSIVO (Richard, 16 nov 2026, al probar Driver): «Flex es exclusivo». Al tomar un bloque
 * de Flex, todo lo demás (comida, envíos de A a B, moto y carro con pasajero) se desconecta solo y no
 * se puede volver a conectar hasta terminar el bloque. Lo cuida la BASE, no solo la pantalla.
 */
async function preparar() {
  const m = mundo();
  const rep = await m.cuenta('repartidor', 'Bea Bloque');
  const con = await m.llamar(
    'POST',
    '/datos/repartidor/conectar',
    { conectado: true, lat: 42.48, lng: -83.47 },
    rep.token,
  );
  expect(con.estado).toBe(200);
  await m.DB.prepare(
    "INSERT INTO empresas (id, nombre, pais, moneda, dueno_id) VALUES ('emp-exc', 'Great Lakes Supply', 'US', 'USD', ?)",
  )
    .bind(rep.id)
    .run();
  await m.DB.prepare(
    "INSERT INTO rutas_flex (id, empresa_id, nombre, estado, bloque_desde, bloque_hasta) VALUES ('ruta-exc', 'emp-exc', 'Walled Lake route', 'borrador', '2026-11-16 14:00:00', '2026-11-16 17:30:00')",
  ).run();
  await m.DB.prepare(
    "UPDATE rutas_flex SET estado = 'ofrecida', conductor_id = ? WHERE id = 'ruta-exc'",
  )
    .bind(rep.id)
    .run();
  return { m, rep };
}

const conectado = async (m: ReturnType<typeof mundo>, id: string) =>
  Number(
    (
      await m.DB.prepare('SELECT conectado FROM repartidores WHERE usuario_id = ?')
        .bind(id)
        .first<{ conectado: number }>()
    )?.conectado,
  );

describe('C-FLEX-EXCLUSIVO · el bloque de Flex desconecta todo lo demás', () => {
  it('al aceptar el bloque queda desconectado, el estado trae el bloque y no se puede conectar', async () => {
    const { m, rep } = await preparar();
    expect(await conectado(m, rep.id)).toBe(1);
    const acepta = await m.llamar(
      'POST',
      '/datos/v1/flex/conductor/rutas/ruta-exc/aceptar',
      {},
      rep.token,
      { 'idempotency-key': `exc-${crypto.randomUUID()}` },
    );
    expect(acepta.estado).toBe(200);
    expect(await conectado(m, rep.id)).toBe(0);

    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.conectado).toBe(false);
    expect(estado.datos.bloqueFlex).toMatchObject({
      rutaId: 'ruta-exc',
      nombre: 'Walled Lake route',
      empresa: 'Great Lakes Supply',
      bloqueHasta: '2026-11-16 17:30:00',
    });

    const intento = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 42.48, lng: -83.47 },
      rep.token,
    );
    expect(intento.estado).toBe(409);
    expect(JSON.stringify(intento.datos)).toContain('Flex block');
    expect(await conectado(m, rep.id)).toBe(0);

    // Desconectarse sí se puede (no rompe nada).
    const apagar = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: false },
      rep.token,
    );
    expect(apagar.estado).toBe(200);
  });

  it('la base rechaza conectar por debajo durante el bloque, y al terminarlo se puede otra vez', async () => {
    const { m, rep } = await preparar();
    await m.DB.prepare("UPDATE rutas_flex SET estado = 'aceptada' WHERE id = 'ruta-exc'").run();
    await expect(
      m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?').bind(rep.id).run(),
    ).rejects.toThrow(/conductor_en_bloque_flex/);

    await m.DB.prepare("UPDATE rutas_flex SET estado = 'cancelada' WHERE id = 'ruta-exc'").run();
    const otraVez = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 42.48, lng: -83.47 },
      rep.token,
    );
    expect(otraVez.estado).toBe(200);
    expect(await conectado(m, rep.id)).toBe(1);
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.bloqueFlex).toBeNull();
  });

  it('el canario de exclusividad vigila los disparadores del bloque y avisa si alguien sigue conectado', async () => {
    const { m, rep } = await preparar();
    await m.DB.prepare("UPDATE rutas_flex SET estado = 'aceptada' WHERE id = 'ruta-exc'").run();
    expect(await saludExclusividad(m.DB)).toBe('ok');
    // Si alguien quita el freno de la base y se conecta por debajo, el canario se pone en rojo.
    await m.DB.prepare('DROP TRIGGER repartidores_no_conecta_en_bloque_flex').run();
    await m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?')
      .bind(rep.id)
      .run();
    expect(await saludExclusividad(m.DB)).toBe('error');
  });
});
