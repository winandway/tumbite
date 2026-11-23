import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-SERVICIO-SIN-OFERTA (23 nov 2026, Richard: un conductor quedó «conectado a Comida» en un pueblo sin
 * restaurantes: «¿cómo le miente así?») — todos los países. En cada ciudad se arranca por motos,
 * después restaurantes y al final clientes: Comida aparece sola en Driver cuando la zona tiene al menos
 * un restaurante aprobado. Todo desde el SERVIDOR, para que valga con Driver 0.1.69.
 */
const PUNTO = { lat: 25.7617, lng: -80.1918 };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const cond = await conductorDeMoto(m, PUNTO, 'US-FL-MIAMI', 'envios');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, cond.token);
  const panel = async () =>
    (await yo('GET', '/datos/conductor/panel-servicios')).datos as {
      conectados: number;
      servicios: { servicioId: string; estado: string }[];
    };
  const abrirRestaurante = async () => {
    const dueno = await m.cuenta('restaurante', 'Dueño de ejemplo');
    await m.DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre, estado, zona_id) VALUES ('rest-zona', ?, 'Restaurante de ejemplo', 'aprobado', 'US-FL-MIAMI')",
    )
      .bind(dueno.id)
      .run();
  };
  return { m, cond, yo, panel, abrirRestaurante };
}

describe('C-SERVICIO-SIN-OFERTA', () => {
  it('conectarse a Comida sin restaurantes en la zona: 409 con la verdad, y no queda conectado', async () => {
    const e = await escenario();
    const r = await e.yo('POST', '/datos/conductor/servicios/comida/conexion', {
      conectado: true,
      ...PUNTO,
    });
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('sin_restaurantes');
    // En el idioma de la cuenta (esta es de Estados Unidos: inglés).
    expect(r.datos.error).toMatch(/no restaurants in your area|no hay restaurantes en tu zona/);
    const pref = await e.m.DB.prepare(
      "SELECT activa FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id = 'comida'",
    )
      .bind(e.cond.id)
      .first<{ activa: number }>();
    expect(Number(pref?.activa ?? 0)).toBe(0);
  });

  it('quien YA estaba conectado a Comida sin restaurantes no figura «esperando pedidos» de Comida', async () => {
    const e = await escenario();
    await e.m.DB.prepare(
      "INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'comida', 1) ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET activa = 1",
    )
      .bind(e.cond.id)
      .run();
    const p = await e.panel();
    expect(p.servicios.map((s) => s.servicioId)).not.toContain('comida');
    // Al abrir el primer restaurante de la zona, Comida aparece sola.
    await e.abrirRestaurante();
    expect((await e.panel()).servicios.map((s) => s.servicioId)).toContain('comida');
  });

  it('con un restaurante en la zona, conectarse a Comida ya no choca con «sin restaurantes»', async () => {
    const e = await escenario();
    await e.abrirRestaurante();
    const r = await e.yo('POST', '/datos/conductor/servicios/comida/conexion', {
      conectado: true,
      ...PUNTO,
    });
    expect(r.datos.campo).not.toBe('sin_restaurantes');
  });

  it('el encendido general (Driver 0.1.69) le dice la verdad a quien solo tiene Comida en una zona vacía y no figura recibiendo', async () => {
    const e = await escenario();
    // Solo Comida aprobada: Envíos sin habilitación.
    await e.m.DB.prepare('DELETE FROM habilitaciones WHERE conductor_id = ?').bind(e.cond.id).run();
    await e.m.DB.prepare(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, motivo) VALUES (?, 'comida', 'aprobada', '')",
    )
      .bind(e.cond.id)
      .run();
    await e.m.DB.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?')
      .bind(e.cond.id)
      .run();
    for (const [veh, req] of [
      ['', 'licencia_moto'],
      [e.cond.vehiculo, 'seguro_vehiculo'],
    ])
      await e.m.DB.prepare(
        "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente) VALUES (?, ?, ?, 'aprobado', 'sistema')",
      )
        .bind(e.cond.id, veh, req)
        .run();
    const r = await e.yo('POST', '/datos/repartidor/conectar', { conectado: true, ...PUNTO });
    // Driver 0.1.69 muestra `avisoComida` al conectarse: se le dice la verdad ahí mismo.
    expect(r.datos.avisoComida).toMatch(
      /no restaurants in your area|no hay restaurantes en tu zona/,
    );
    const f = await e.yo('GET', '/datos/conductor/que-te-falta');
    expect(f.datos.recibeViajes).toBe(false);
  });
});
