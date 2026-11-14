import { describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';

/**
 * Divoox Carro (taxi) listo para probar — 13 nov 2026. Venezuela (El Vigía, estado Mérida: efectivo
 * y pago móvil, comisión del saldo prepago) y EE. UU. (Detroit: tarjeta y propina). Ficha:
 * docs/investigaciones-rea/2026-11-13-carro-venezuela.md.
 */

async function escenario(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero El Vigía');
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

const TARIFA_PRUEBA = { base: 150, porKm: 45, porMinuto: 6, minimo: 350 };
const abrirElVigia = (e: E, servicio: 'carro' | 'moto' = 'carro', tarifa?: object) =>
  e.m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio,
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      ...(tarifa ? { tarifa } : {}),
      motivo: 'Ciudad de pruebas de Carro en Venezuela',
    },
    e.admin.token,
  );

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
async function subirA(e: E, ruta: string, token: string) {
  const r = await e.m.crudo(ruta, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: JPEG,
  });
  return { estado: r.status, datos: (await r.json()) as { id: string } };
}

describe('C-CARRO-PAPELES-PAIS: los papeles del taxista dependen de su país', () => {
  it('en Venezuela pide licencia de conducir y antecedentes; al aprobarlos cumplen licencia, historial y antecedentes', async () => {
    const e = await escenario();
    expect((await abrirElVigia(e, 'carro', TARIFA_PRUEBA)).estado).toBe(201);
    const rep = await e.m.cuenta('repartidor', 'Taxista El Vigía');
    expect(
      (await e.m.llamar('PUT', '/datos/conductor/ciudad', { zonaId: EVG.id }, rep.token)).estado,
    ).toBe(200);
    const p = await e.m.llamar('GET', '/datos/conductor/papeles', undefined, rep.token);
    expect(p.datos.perfil.documentosPorServicio.carro).toEqual([
      'licencia_conducir',
      'antecedentes_penales',
    ]);
    expect(p.datos.perfil.documentosVehiculo.carro).toContain('inspeccion');
    const lic = await subirA(e, '/datos/conductor/papeles?tipo=licencia_conducir', rep.token);
    expect(lic.estado).toBe(201);
    const ok = await e.m.llamar(
      'PUT',
      `/datos/admin/papeles-conductor/${lic.datos.id}`,
      { estado: 'aprobado', venceEn: '2030-01-01' },
      e.admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(ok.datos.requisitos.sort()).toEqual(['historial_manejo', 'licencia']);
  });

  it('en EE. UU. la licencia subida no cumple antecedentes ni historial (siguen con el proveedor)', async () => {
    const e = await escenario();
    const rep = await e.m.cuenta('repartidor', 'Conductor Detroit');
    const p = await e.m.llamar('GET', '/datos/conductor/papeles', undefined, rep.token);
    expect(p.datos.perfil.documentosPorServicio.carro).toEqual([]);
    const lic = await subirA(e, '/datos/conductor/papeles?tipo=licencia_conducir', rep.token);
    expect(lic.estado).toBe(201);
    const ok = await e.m.llamar(
      'PUT',
      `/datos/admin/papeles-conductor/${lic.datos.id}`,
      { estado: 'aprobado' },
      e.admin.token,
    );
    expect(ok.datos.requisitos).toEqual([]);
  });
});

describe('C-CARRO-PAPELES-PAIS: la tabla vieja de papeles se rehace sin perder filas', () => {
  it('una base con la lista vieja de tipos acepta la licencia de conducir y conserva lo que tenía', async () => {
    const { rehacerConductorDocumentos } = await import('../esquemaPapeles');
    const e = await escenario();
    const rep = await e.m.cuenta('repartidor', 'Conductor de antes');
    await e.m.DB.prepare('DROP TABLE conductor_documentos').run();
    await e.m.DB.prepare(
      `CREATE TABLE conductor_documentos (id TEXT PRIMARY KEY, conductor_id TEXT NOT NULL REFERENCES usuarios(id),
        tipo TEXT NOT NULL CHECK (tipo IN ('licencia_moto', 'antecedentes_penales')), clave TEXT NOT NULL, vence_en TEXT,
        estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reemplazado')),
        motivo TEXT NOT NULL DEFAULT '', revisado_por TEXT REFERENCES usuarios(id), revisado_en TEXT,
        creado_en TEXT NOT NULL DEFAULT (datetime('now')))`,
    ).run();
    await e.m.DB.prepare(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, estado) VALUES ('d1', ?, 'licencia_moto', 'k', 'aprobado')",
    )
      .bind(rep.id)
      .run();
    expect(await rehacerConductorDocumentos(e.m.DB)).toBe(true);
    expect(await rehacerConductorDocumentos(e.m.DB)).toBe(false);
    const viejo = await e.m.DB.prepare(
      "SELECT tipo, estado FROM conductor_documentos WHERE id = 'd1'",
    ).first<{ tipo: string; estado: string }>();
    expect(viejo).toEqual({ tipo: 'licencia_moto', estado: 'aprobado' });
    await e.m.DB.prepare(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave) VALUES ('d2', ?, 'licencia_conducir', 'k')",
    )
      .bind(rep.id)
      .run();
  });
});
