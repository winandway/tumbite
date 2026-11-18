import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { vehiculoQueSirve } from './vehiculoQueSirve';

/**
 * C-CAMBIAR-VEHICULO (robot de Android, 18 nov 2026, con los datos del conductor demo de pruebas):
 * con la moto activa, «Carro con pasajero» decía «Falta 1 papel» (la inspección, que el Corolla SÍ
 * tenía aprobada) y no había cómo cambiar de vehículo.
 */
const MOTO = { id: 'moto-1', tipo: 'moto', marca: 'Bera', modelo: 'SBR', anio: 2022 };
const COROLLA = { id: 'carro-1', tipo: 'carro', marca: 'Toyota', modelo: 'Corolla', anio: 2018 };
const REQS = [
  { servicio_id: 'carro', requisito: 'identidad', nivel: 'conductor', vehiculo_tipo: null },
  { servicio_id: 'carro', requisito: 'licencia', nivel: 'conductor', vehiculo_tipo: null },
  {
    servicio_id: 'carro',
    requisito: 'inspeccion_vehiculo',
    nivel: 'vehiculo',
    vehiculo_tipo: null,
  },
  { servicio_id: 'carro', requisito: 'seguro_pasajeros', nivel: 'vehiculo', vehiculo_tipo: null },
];
const base = {
  servicioId: 'carro',
  activoId: 'moto-1',
  vehiculos: [MOTO, COROLLA],
  tiposCompatibles: ['carro'],
  requisitos: REQS,
};

describe('el vehículo con el que un servicio sí funciona', () => {
  it('el Corolla, que tiene la inspección y el seguro, sirve para Carro', () => {
    const cumplidos = new Set([
      'identidad|',
      'licencia|',
      'inspeccion_vehiculo|carro-1',
      'seguro_pasajeros|carro-1',
      'seguro_pasajeros|moto-1',
    ]);
    expect(vehiculoQueSirve({ ...base, cumplidos })?.id).toBe('carro-1');
  });
  it('si al otro vehículo le falta un papel, no se ofrece (se sigue pidiendo el papel)', () => {
    const cumplidos = new Set(['identidad|', 'licencia|', 'seguro_pasajeros|carro-1']);
    expect(vehiculoQueSirve({ ...base, cumplidos })).toBeNull();
  });
  it('si falta algo del conductor (no del vehículo), cambiar de vehículo no lo arregla', () => {
    const cumplidos = new Set([
      'identidad|',
      'inspeccion_vehiculo|carro-1',
      'seguro_pasajeros|carro-1',
    ]);
    expect(vehiculoQueSirve({ ...base, cumplidos })).toBeNull();
  });
  it('nunca propone el vehículo que ya está activo, ni uno de otro tipo o más viejo que el mínimo', () => {
    const cumplidos = new Set([
      'identidad|',
      'licencia|',
      'inspeccion_vehiculo|carro-1',
      'seguro_pasajeros|carro-1',
    ]);
    expect(vehiculoQueSirve({ ...base, activoId: 'carro-1', cumplidos })).toBeNull();
    expect(vehiculoQueSirve({ ...base, tiposCompatibles: ['moto'], cumplidos })).toBeNull();
    expect(
      vehiculoQueSirve({ ...base, anioMinimo: new Map([['carro', 2020]]), cumplidos }),
    ).toBeNull();
  });
});

describe('C-CAMBIAR-VEHICULO de punta a punta: panel de servicios y cambio', () => {
  it('con la moto activa, Carro dice «usa tu Toyota Corolla» y al cambiar queda listo', async () => {
    const m = mundo();
    const c = await conductorDeMoto(m, { lat: 25.77, lng: -80.19 });
    const q = (sql: string, ...v: unknown[]) =>
      m.DB.prepare(sql)
        .bind(...v)
        .run();
    await q(
      "INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('carro', 1)",
    );
    await q("UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'");
    await q(
      "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'carro' AND zona_id = 'US-FL-MIAMI'",
    );
    const carro = 'carro-prueba-1';
    await q(
      "INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado) VALUES (?, ?, 'carro', 'Toyota', 'Corolla', 'Gris', 'CAR123', 'FL', 2022, 4, 'aprobado')",
      carro,
      c.id,
    );
    const admin = await m.cuenta('admin', 'Soporte Revisión Dos');
    await q(
      "INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por, proxima_revision) VALUES (?, 'aprobado', 'licencia', 'kyc/doc', 'kyc/selfie', datetime('now','-3 days'), datetime('now','-2 days'), ?, date('now','+1 year')) ON CONFLICT(usuario_id) DO NOTHING",
      c.id,
      admin.id,
    );
    // Todo lo de Carro aprobado: lo del conductor, y lo del vehículo en el CARRO (no en la moto).
    await q(
      `INSERT OR IGNORE INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por, vence_en)
       SELECT ?, CASE rd.nivel WHEN 'vehiculo' THEN ? ELSE '' END, r.requisito, 'aprobado',
              CASE r.requisito WHEN 'identidad' THEN 'kyc' ELSE 'revision_manual' END, ?, datetime('now', '+1 year')
         FROM (SELECT requisito FROM servicio_requisitos WHERE servicio_id = 'carro'
               UNION SELECT requisito FROM servicio_vehiculo_requisitos WHERE servicio_id = 'carro' AND vehiculo_tipo = 'carro') r
         JOIN requisitos_def rd ON rd.requisito = r.requisito`,
      c.id,
      carro,
      admin.id,
    );
    // La habilitación de Carro se aprobó cuando el conductor usaba el Corolla; hoy usa la moto.
    await q('UPDATE repartidores SET vehiculo_activo_id = ? WHERE usuario_id = ?', carro, c.id);
    await q(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES (?, 'carro', 'aprobada', ?, datetime('now'))",
      c.id,
      admin.id,
    );
    await q(
      'UPDATE repartidores SET vehiculo_activo_id = ? WHERE usuario_id = ?',
      c.vehiculo,
      c.id,
    );
    // Revisor (18 nov 2026): la Driver 25 publicada lee `motivo` (espera «vehiculo_incompatible» o
    // «requisitos_faltantes»); el campo nuevo `cambiarA` no lo cambia.
    const estado = await m.llamar('GET', '/datos/conductor/servicios', undefined, c.token);
    const carroViejo = (
      estado.datos.servicios as { servicioId: string; motivo: string; cambiarA?: unknown }[]
    ).find((s) => s.servicioId === 'carro');
    expect(['requisitos_faltantes', 'vehiculo_incompatible']).toContain(carroViejo?.motivo);
    expect(carroViejo?.cambiarA).toMatchObject({ id: carro });
    type Tarjeta = { servicioId: string; cambiarA?: unknown; estado: string };
    const tarjeta = async () =>
      (
        (await m.llamar('GET', '/datos/conductor/panel-servicios', undefined, c.token)).datos
          .servicios as Tarjeta[]
      ).find((s) => s.servicioId === 'carro');
    expect((await tarjeta())?.cambiarA).toMatchObject({
      id: carro,
      nombre: 'Toyota Corolla',
      tipo: 'carro',
    });
    await q('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?', c.id);
    const r = await m.llamar(
      'PUT',
      '/datos/conductor/vehiculo-activo',
      { vehiculoId: carro },
      c.token,
    );
    expect(r.estado).toBe(200);
    const ya = await tarjeta();
    expect(ya?.cambiarA ?? null).toBeNull();
    expect(ya?.estado).not.toBe('en_revision');
  });
});
