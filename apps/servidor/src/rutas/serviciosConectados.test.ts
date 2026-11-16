import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { estadoTarjeta } from './serviciosConectados';
import type { EstadoConductor } from './servicios';

/**
 * C-SERVICIOS-CONECTADOS (Richard, 16 nov 2026, al probar Driver). Varios servicios al momento
 * conectados a la vez; al llevar uno, los demás en pausa y vuelven solos; desconectar es por
 * servicio; Flex es exclusivo; un papel rechazado apaga solo los servicios que lo piden.
 */
async function conComidaYEnvios() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  for (const ruta of [
    '/datos/admin/servicios/envios',
    '/datos/admin/servicios/envios/zonas/US-FL-MIAMI',
  ])
    await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
  const cond = await conductorDeMoto(m, { lat: 25.7617, lng: -80.1918 }, 'US-FL-MIAMI', 'envios');
  for (const [veh, req] of [
    ['', 'licencia_moto'],
    [cond.vehiculo, 'seguro_vehiculo'],
  ])
    await m.DB.prepare(
      "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por) VALUES (?, ?, ?, 'aprobado', 'revision_manual', ?)",
    )
      .bind(cond.id, veh, req, admin.id)
      .run();
  const panel = async () =>
    (await m.llamar('GET', '/datos/conductor/panel-servicios', undefined, cond.token)).datos as {
      conectadoGeneral: boolean;
      conectados: number;
      lleva: { servicioId: string; tipo: string } | null;
      servicios: { servicioId: string; estado: string }[];
    };
  const estadoDe = async (id: string) =>
    (await panel()).servicios.find((s) => s.servicioId === id)?.estado;
  const conexion = (id: string, conectado: boolean) =>
    m.llamar(
      'POST',
      `/datos/conductor/servicios/${id}/conexion`,
      { conectado, lat: 25.7617, lng: -80.1918 },
      cond.token,
    );
  const general = async () =>
    Number(
      (
        await m.DB.prepare('SELECT conectado FROM repartidores WHERE usuario_id = ?')
          .bind(cond.id)
          .first<{ conectado: number }>()
      )?.conectado,
    );
  return { m, admin, cond, panel, estadoDe, conexion, general };
}

describe('C-SERVICIOS-CONECTADOS · varios a la vez, pausa al llevar uno', () => {
  it('conectado a Comida y Envíos; al llevar una comida, Envíos queda en pausa y vuelve al terminar', async () => {
    const { m, cond, panel, estadoDe } = await conComidaYEnvios();
    const antes = await panel();
    expect(antes.conectados).toBe(2);
    expect(await estadoDe('comida')).toBe('conectado');
    expect(await estadoDe('envios')).toBe('conectado');

    // Acepta una comida: la base lo marca ocupado (conductor_ocupacion).
    await m.DB.prepare(
      "INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos) VALUES (?, 'comida', 1)",
    )
      .bind(cond.id)
      .run();
    const llevando = await panel();
    expect(llevando.lleva).toEqual({ servicioId: 'comida', tipo: 'comida' });
    expect(await estadoDe('comida')).toBe('haciendo');
    expect(await estadoDe('envios')).toBe('en_pausa');
    // Mientras lleva algo, el despacho de operaciones (Envíos, Moto, Carro) no le ofrece nada.
    const ofrecible = await m.DB.prepare(
      `SELECT COUNT(*) AS n FROM conductores_elegibles e WHERE e.conductor_id = ?
          AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = e.conductor_id)`,
    )
      .bind(cond.id)
      .first<{ n: number }>();
    expect(Number(ofrecible?.n)).toBe(0);

    // Entrega: sin ocupación, todo vuelve solo (nada se reescribió).
    await m.DB.prepare('DELETE FROM conductor_ocupacion WHERE conductor_id = ?')
      .bind(cond.id)
      .run();
    expect(await estadoDe('comida')).toBe('conectado');
    expect(await estadoDe('envios')).toBe('conectado');
  });

  it('se desconecta UN servicio; el último apaga el encendido general; conectar uno lo vuelve a encender', async () => {
    const { m, cond, estadoDe, conexion, general } = await conComidaYEnvios();
    expect((await conexion('comida', false)).estado).toBe(200);
    expect(await estadoDe('comida')).toBe('desconectado');
    expect(await estadoDe('envios')).toBe('conectado');
    expect(await general()).toBe(1);
    // Comida apagada: el despacho de comida no la tiene en cuenta (preferencia en 0).
    const pref = await m.DB.prepare(
      "SELECT activa FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id = 'comida'",
    )
      .bind(cond.id)
      .first<{ activa: number }>();
    expect(pref?.activa).toBe(0);

    expect((await conexion('envios', false)).estado).toBe(200);
    expect(await general()).toBe(0);

    const r = await conexion('envios', true);
    expect(r.estado).toBe(200);
    expect(await general()).toBe(1);
    expect(await estadoDe('envios')).toBe('conectado');
    expect(await estadoDe('comida')).toBe('desconectado'); // lo apagado a mano sigue apagado
  });

  it('una app vieja con el encendido general conecta todos los aprobados si ninguno quedó encendido', async () => {
    const { m, estadoDe, conexion, cond } = await conComidaYEnvios();
    await conexion('comida', false);
    await conexion('envios', false);
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.7617, lng: -80.1918 },
      cond.token,
    );
    expect(r.estado).toBe(200);
    expect(await estadoDe('comida')).toBe('conectado');
    expect(await estadoDe('envios')).toBe('conectado');
  });

  it('durante un bloque de Flex todo sale bloqueado y conectar un servicio da 409', async () => {
    const { m, cond, estadoDe, conexion } = await conComidaYEnvios();
    await m.DB.prepare(
      "INSERT INTO empresas (id, nombre, pais, moneda, dueno_id) VALUES ('emp-sc', 'Lakes Supply', 'US', 'USD', ?)",
    )
      .bind(cond.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO rutas_flex (id, empresa_id, nombre, estado, bloque_desde, bloque_hasta) VALUES ('ruta-sc', 'emp-sc', 'Ruta', 'borrador', '2026-11-16 14:00:00', '2026-11-16 17:30:00')",
    ).run();
    await m.DB.prepare(
      "UPDATE rutas_flex SET estado = 'ofrecida', conductor_id = ? WHERE id = 'ruta-sc'",
    )
      .bind(cond.id)
      .run();
    const acepta = await m.llamar(
      'POST',
      '/datos/v1/flex/conductor/rutas/ruta-sc/aceptar',
      {},
      cond.token,
      { 'idempotency-key': `sc-${crypto.randomUUID()}` },
    );
    expect(acepta.estado).toBe(200);
    expect(await estadoDe('comida')).toBe('bloqueado_flex');
    expect(await estadoDe('envios')).toBe('bloqueado_flex');
    expect((await conexion('envios', true)).estado).toBe(409);
  });

  it('perfil compartido: lo del perfil aprobado sale verificado y un papel rechazado trae su motivo', async () => {
    const { m, admin, cond } = await conComidaYEnvios();
    await m.DB.prepare(
      "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por) VALUES (?, '', 'antecedentes_pasajeros', 'aprobado', 'revision_manual', ?)",
    )
      .bind(cond.id, admin.id)
      .run();
    await m.DB.prepare(
      "UPDATE vehiculo_documentos SET estado = 'rechazado', motivo = 'Tómala de día y de frente.' WHERE vehiculo_id = ? AND tipo = 'seguro_pasajeros'",
    )
      .bind(cond.vehiculo)
      .run();
    const r = await m.llamar(
      'GET',
      '/datos/conductor/servicios/moto/requisitos',
      undefined,
      cond.token,
    );
    expect(r.estado).toBe(200);
    const d = r.datos as {
      verificados: { requisito: string }[];
      faltan: { requisito: string; estado: string; motivo: string; grupo: string }[];
    };
    expect(d.verificados.map((x) => x.requisito)).toContain('antecedentes_pasajeros');
    expect(d.verificados.map((x) => x.requisito)).toContain('licencia_moto');
    expect(d.faltan.find((x) => x.requisito === 'seguro_pasajeros')).toMatchObject({
      estado: 'rechazado',
      motivo: 'Tómala de día y de frente.',
      grupo: 'vehiculo',
    });
  });
});

describe('C-SERVICIOS-CONECTADOS · agregar un servicio', () => {
  it('pedir un servicio lo deja en revisión del equipo, nunca aprobado; apagado en la ciudad da 409', async () => {
    const { m, admin, cond, estadoDe } = await conComidaYEnvios();
    const pedir = (id: string) =>
      m.llamar('POST', `/datos/conductor/servicios/${id}/solicitar`, {}, cond.token);
    // Carro todavía no funciona en la ciudad: no se puede pedir ni se dibuja.
    expect(await estadoDe('carro')).toBeUndefined();
    expect((await pedir('carro')).estado).toBe(409);
    for (const ruta of [
      '/datos/admin/servicios/carro',
      '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
    ])
      await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
    expect(await estadoDe('carro')).toBe('agregar');
    const r = await pedir('carro');
    expect(r.estado).toBe(200);
    expect(await estadoDe('carro')).toBe('en_revision');
    const h = await m.DB.prepare(
      "SELECT estado, aprobado_por FROM habilitaciones WHERE conductor_id = ? AND servicio_id = 'carro'",
    )
      .bind(cond.id)
      .first<{ estado: string; aprobado_por: string | null }>();
    expect(h).toEqual({ estado: 'pendiente', aprobado_por: null });
    // Pedirlo otra vez no cambia nada; un servicio ya aprobado tampoco se toca.
    expect((await pedir('carro')).estado).toBe(200);
    expect((await pedir('envios')).estado).toBe(200);
    expect(await estadoDe('envios')).toBe('conectado');
    expect((await pedir('flex')).estado).toBe(404);
  });
});

describe('C-SERVICIOS-CONECTADOS · la regla de cada tarjeta', () => {
  const s = (o: Partial<EstadoConductor>): EstadoConductor => ({
    servicioId: 'carro',
    nombre: 'Carro',
    estadoServicio: 'disponible',
    habilitacion: 'aprobada',
    vehiculoCompatible: true,
    requisitosFaltantes: [],
    preferencia: true,
    puedeActivar: true,
    motivo: 'habilitado',
    ...o,
  });
  const base = { conectadoGeneral: true, enBloqueFlex: false, lleva: null };
  it('un papel rechazado apaga solo el servicio que lo pide', () => {
    expect(
      estadoTarjeta({
        ...base,
        s: s({
          puedeActivar: false,
          preferencia: false,
          requisitosFaltantes: ['seguro_pasajeros'],
        }),
      }),
    ).toBe('en_revision');
    expect(estadoTarjeta({ ...base, s: s({ servicioId: 'comida' }) })).toBe('conectado');
  });
  it('lo que no funciona en la ciudad no se dibuja; lo no pedido sale para agregar', () => {
    expect(estadoTarjeta({ ...base, s: s({ estadoServicio: 'proximamente' }) })).toBeNull();
    expect(
      estadoTarjeta({ ...base, s: s({ habilitacion: 'sin_solicitar', puedeActivar: false }) }),
    ).toBe('agregar');
  });
  it('en pausa al llevar otro, haciendo el que lleva, bloqueado en Flex', () => {
    expect(estadoTarjeta({ ...base, lleva: 'comida', s: s({}) })).toBe('en_pausa');
    expect(estadoTarjeta({ ...base, lleva: 'carro', s: s({}) })).toBe('haciendo');
    expect(estadoTarjeta({ ...base, enBloqueFlex: true, s: s({}) })).toBe('bloqueado_flex');
    expect(estadoTarjeta({ ...base, conectadoGeneral: false, s: s({}) })).toBe('desconectado');
  });
});

describe('C-SERVICIOS-CONECTADOS · puertas y solicitudes', () => {
  it('si una puerta frena el encendido general, no se escribe ninguna preferencia', async () => {
    const { m, cond, conexion } = await conComidaYEnvios();
    await conexion('comida', false);
    await conexion('envios', false);
    await m.DB.prepare("INSERT INTO selfies_control (id, usuario_id) VALUES ('sc-1', ?)")
      .bind(cond.id)
      .run();
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.7617, lng: -80.1918 },
      cond.token,
    );
    expect(r.estado).toBe(409);
    const { results } = await m.DB.prepare(
      'SELECT activa FROM preferencias_servicio WHERE conductor_id = ? AND activa = 1',
    )
      .bind(cond.id)
      .all();
    expect(results).toHaveLength(0);
  });

  it('un servicio rechazado se vuelve a pedir como mucho una vez al día y conserva el motivo', async () => {
    const { m, cond, admin } = await conComidaYEnvios();
    for (const ruta of [
      '/datos/admin/servicios/moto',
      '/datos/admin/servicios/moto/zonas/US-FL-MIAMI',
    ])
      await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
    await m.DB.prepare(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, motivo) VALUES (?, 'moto', 'rechazada', 'Falta el casco')",
    )
      .bind(cond.id)
      .run();
    const pedir = () =>
      m.llamar('POST', '/datos/conductor/servicios/moto/solicitar', {}, cond.token);
    expect((await pedir()).estado).toBe(409); // recién rechazado
    await m.DB.prepare(
      "UPDATE habilitaciones SET actualizado_en = datetime('now','-2 days') WHERE conductor_id = ? AND servicio_id = 'moto'",
    )
      .bind(cond.id)
      .run();
    expect((await pedir()).estado).toBe(200);
    const h = await m.DB.prepare(
      "SELECT estado, motivo FROM habilitaciones WHERE conductor_id = ? AND servicio_id = 'moto'",
    )
      .bind(cond.id)
      .first<{ estado: string; motivo: string }>();
    expect(h).toEqual({ estado: 'pendiente', motivo: 'Falta el casco' });
  });
});
