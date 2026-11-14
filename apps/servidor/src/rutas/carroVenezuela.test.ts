import { describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';

/**
 * Divoox Carro (taxi) listo para probar — 13 nov 2026. Venezuela (El Vigía, estado Mérida: efectivo
 * y pago móvil, comisión del saldo prepago) y EE. UU. (Detroit: tarjeta y propina). Ficha:
 * docs/investigaciones-rea/2026-11-13-carro-venezuela.md.
 */
const ORIGEN = { lat: EVG.lat, lng: EVG.lng, direccion: 'Plaza Bolívar de El Vigía' };

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

const cotizarCarro = (e: E, destino: { lat: number; lng: number }, categoria?: 'xl') =>
  e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    {
      servicio: 'carro',
      origen: ORIGEN,
      destino: { ...destino, direccion: 'Destino' },
      ...(categoria ? { categoria } : {}),
    },
    e.cliente.token,
  );

describe('C-CARRO-TARIFA-VE: Carro en El Vigía con la tarifa del mercado venezolano', () => {
  it('abrir El Vigía sin escribir tarifa pone la de mercado en dólares, con su XL', async () => {
    const e = await escenario();
    const r = await abrirElVigia(e);
    expect(r.estado).toBe(201);
    expect(r.datos.zona).toEqual({ id: EVG.id, pais: 'VE', moneda: 'USD' });
    expect(r.datos.tarifa.moneda).toBe('USD');
    expect(r.datos.tarifa.minimo).toBe(350);
    expect(r.datos.tarifa.xlPb).toBe(15_000);
    expect(r.datos.estado).toBe('disponible');
  });

  it('cotiza el mínimo en un viaje corto, unos 6 a 8 dólares en 9 km, y el XL por 1,5', async () => {
    const e = await escenario();
    await abrirElVigia(e);
    const corto = await cotizarCarro(e, { lat: EVG.lat + 0.008, lng: EVG.lng });
    expect(corto.estado).toBe(201);
    expect(corto.datos.cotizacion.moneda).toBe('USD');
    expect(corto.datos.cotizacion.total).toBe(350);
    const largo = await cotizarCarro(e, { lat: EVG.lat, lng: EVG.lng + 0.063 });
    expect(largo.datos.cotizacion.total).toBeGreaterThan(600);
    expect(largo.datos.cotizacion.total).toBeLessThan(800);
    const xl = await cotizarCarro(e, { lat: EVG.lat, lng: EVG.lng + 0.063 }, 'xl');
    expect(xl.estado).toBe(201);
    // El factor se aplica a cada pieza del precio: cerca de 1,5 veces el carro normal.
    const veces = xl.datos.cotizacion.total / largo.datos.cotizacion.total;
    expect(veces).toBeGreaterThan(1.45);
    expect(veces).toBeLessThan(1.55);
  });

  it('la comisión es el mismo 10 % en dólares, y el saldo calcula las carreras con la tarifa de Carro', async () => {
    const e = await escenario();
    await abrirElVigia(e);
    const { comisionConductor } = await import('../finanzas/conductor');
    const c = await comisionConductor(e.m.DB, {
      servicio: 'car',
      pais: 'VE',
      moneda: 'USD',
      valor: 500,
    });
    expect(c?.monto).toBe(50);
    const { comisionTipicaMoto } = await import('./viajesPasajero');
    expect(
      await comisionTipicaMoto(e.m.DB, { id: EVG.id, pais: 'VE', moneda: 'USD' }),
    ).toBeGreaterThan(0);
  });
});

describe('C-CARRO-POR-PAIS: Carro en Venezuela se abre en producción por la misma compuerta de Moto', () => {
  const abrir = (e: E, pais: string, cuerpo: Record<string, unknown>) =>
    e.m.llamar(
      'PUT',
      `/datos/admin/pasajeros-pais/${pais}/carro`,
      { clave: 'clave-segura-1', ...cuerpo },
      e.admin.token,
    );
  const marca = { abierto: true, solicitudMarca: '97000001', confirmo: true };

  it('nace cerrada: en producción Carro no se abre en El Vigía y la compuerta la lista cerrada', async () => {
    const e = await escenario('divoox.com');
    const lista = await e.m.llamar('GET', '/datos/admin/pasajeros-pais', undefined, e.admin.token);
    expect(lista.datos.paises).toContainEqual({
      servicio: 'carro',
      pais: 'VE',
      abierto: false,
      solicitudMarca: null,
      abiertoEn: null,
    });
    expect((await abrirElVigia(e)).estado).toBe(409);
  });

  it('EE. UU. y Colombia siguen bloqueados por código; Venezuela exige marca, confirmación y contraseña', async () => {
    const e = await escenario('divoox.com');
    expect((await abrir(e, 'US', marca)).estado).toBe(409);
    expect((await abrir(e, 'CO', marca)).estado).toBe(409);
    expect((await abrir(e, 'VE', { abierto: true, confirmo: true })).estado).toBe(422);
    expect((await abrir(e, 'VE', { abierto: true, solicitudMarca: '97000001' })).estado).toBe(422);
    expect((await abrir(e, 'VE', { ...marca, clave: 'otra-clave' })).estado).toBe(403);
  });

  it('abierta en Venezuela, Carro funciona en El Vigía; Detroit sigue bloqueada; abrir Carro no abre Moto', async () => {
    const e = await escenario('divoox.com');
    expect((await abrir(e, 'VE', marca)).estado).toBe(200);
    expect((await abrirElVigia(e)).estado).toBe(201);
    expect((await cotizarCarro(e, { lat: EVG.lat, lng: EVG.lng + 0.03 })).estado).toBe(201);
    const { saludServicios } = await import('./servicios');
    expect(await saludServicios(e.m.DB, 'produccion')).toBe('ok');
    // Moto sigue cerrada en Venezuela aunque Carro esté abierto.
    expect((await abrirElVigia(e, 'moto')).estado).toBe(409);
    const detroit = await e.m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'carro',
        zona: {
          id: 'US-MI-DETROIT',
          nombre: 'Detroit',
          lat: 42.3314,
          lng: -83.0458,
          radioKm: 30,
          zonaHoraria: 'America/Detroit',
        },
        tarifa: { base: 250, porKm: 110, porMinuto: 30, minimo: 800 },
        motivo: 'Prueba de compuerta',
      },
      e.admin.token,
    );
    expect(detroit.estado).toBe(409);
    // Cerrarla apaga Carro en sus ciudades.
    expect((await abrir(e, 'VE', { abierto: false })).estado).toBe(200);
    expect((await cotizarCarro(e, { lat: EVG.lat, lng: EVG.lng + 0.03 })).estado).toBe(409);
  });
});
